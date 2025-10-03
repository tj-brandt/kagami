# core/nlp_service.py

import asyncio
import re
import textstat
import emoji
import torch
import spacy
import nltk
import os
from typing import Optional
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sentence_transformers import SentenceTransformer, util

from .models import StyleProfile, PronounProfile
from . import config

NLTK_DATA_PATH = "/home/appuser/nltk_data"
if os.path.exists(NLTK_DATA_PATH):
    nltk.data.path.append(NLTK_DATA_PATH)


# Lazy-loaded singletons for VADER and Empath
_SIA = None
_EMPATH_LEXICON = None

def get_sia():
    """Lazy-loads and returns the VADER SentimentIntensityAnalyzer."""
    global _SIA
    if _SIA is None:
        from nltk.sentiment.vader import SentimentIntensityAnalyzer
        try:
            nltk.data.find("sentiment/vader_lexicon.zip")
        except LookupError:
            print("INFO (get_sia): VADER lexicon not found in expected path. Downloading...")
            nltk.download("vader_lexicon")
        _SIA = SentimentIntensityAnalyzer()
    return _SIA


def get_empath():
    """Lazy-loads and returns the Empath lexicon."""
    global _EMPATH_LEXICON
    if _EMPATH_LEXICON is None:
        from empath import Empath
        _EMPATH_LEXICON = Empath()
    return _EMPATH_LEXICON


class NLPService:
    def __init__(self):
        self._doc_cache = {}
        self.MAX_CACHE_SIZE = 100
        self.is_warmed_up = False
        self._warmup_lock = asyncio.Lock()
        self.spacy_nlp = None
        self.formality_model = None
        self.formality_tokenizer = None
        self.formality_device = None
        self.style_embedding_model = None

    async def warm_up(self):
        async with self._warmup_lock:
            if self.is_warmed_up: return
            print("INFO (NLPService): Starting model warm-up...")
            
            # 1. Load spaCy
            print("INFO (NLPService): Loading spaCy model 'en_core_web_sm'...")
            self.spacy_nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])
            self.spacy_nlp.add_pipe('sentencizer')
            print(f"INFO (NLPService): spaCy pipeline configured: {self.spacy_nlp.pipe_names}")

            # 2. Set up device and load formality model
            self.formality_device = "cpu"
            print(f"INFO (NLPService): Loading models onto device: {self.formality_device}")
            formality_model_name = "s-nlp/mdistilbert-base-formality-ranker"
            self.formality_tokenizer = AutoTokenizer.from_pretrained(formality_model_name)
            self.formality_model = AutoModelForSequenceClassification.from_pretrained(formality_model_name)
            self.formality_model.to(self.formality_device).eval()
            print(f"INFO (NLPService): Formality model '{formality_model_name}' loaded.")

            # 3. Load the specialist Style Embedding Model
            style_model_name = "StyleDistance/styledistance"
            self.style_embedding_model = SentenceTransformer(style_model_name, device=self.formality_device)
            print(f"INFO (NLPService): Style Embedding model '{style_model_name}' loaded.")
            
            self.is_warmed_up = True
            print(f"INFO (NLPService): Warm-up complete.")

    def compute_style_similarity(self, text1: str, text2: str) -> float | None:
        """
        Calculates style similarity using sentence-transformer embeddings.
        A higher score (closer to 1.0) means better alignment.
        """
        if not self.is_warmed_up or not text1 or not text2:
            return None
        try:
            embeddings = self.style_embedding_model.encode([text1, text2], convert_to_tensor=True)
            cosine_scores = util.cos_sim(embeddings[0], embeddings[1])
            return cosine_scores.item()
        except Exception as e:
            print(f"ERROR (compute_style_similarity): Failed to compute embedding similarity: {e}")
            return None

    def compute_lsm(self, text1: str, text2: str) -> float:
        if not self.is_warmed_up or not text1 or not text2: return 0.5
        doc1 = self.spacy_nlp(text1)
        doc2 = self.spacy_nlp(text2)
        tokens1 = [t for t in doc1 if not t.is_punct and not t.is_space and config.VALID_TOKEN_TEXT_PATTERN.match(t.text)]
        tokens2 = [t for t in doc2 if not t.is_punct and not t.is_space and config.VALID_TOKEN_TEXT_PATTERN.match(t.text)]
        if len(tokens1) < config.MIN_LSM_TOKENS_FOR_LSM_CALC or len(tokens2) < config.MIN_LSM_TOKENS_FOR_LSM_CALC: return 0.5
        scores = []
        for _, rules in config.LSM_CATEGORIES_SPACY.items():
            user_cat_count, bot_cat_count = 0, 0
            if rules["type"] == "pos":
                user_cat_count = sum(1 for token in tokens1 if token.pos_ in rules["tags"])
                bot_cat_count = sum(1 for token in tokens2 if token.pos_ in rules["tags"])
            elif rules["type"] == "lemma_and_dep":
                user_cat_count = sum(1 for token in tokens1 if token.lemma_.lower() in rules["lemmas"] or token.dep_ == rules["dep_neg_tag"])
                bot_cat_count = sum(1 for token in tokens2 if token.lemma_.lower() in rules["lemmas"] or token.dep_ == rules["dep_neg_tag"])
            fu = user_cat_count / len(tokens1) if tokens1 else 0
            fb = bot_cat_count / len(tokens2) if tokens2 else 0
            category_score = 1 - (abs(fu - fb) / (fu + fb + 0.0001))
            scores.append(category_score)
        return sum(scores) / len(scores) if scores else 0.5
    
    async def analyze_text(self, text: str) -> StyleProfile:
        if text in self._doc_cache:
            return self._doc_cache[text]
        if not self.is_warmed_up: await self.warm_up()
        if not text: text = " "

        with self.spacy_nlp.memory_zone():
            doc = self.spacy_nlp(text)
            tokens = [token.text.lower() for token in doc if token.text.strip()]
            word_count = len(tokens)
            sentence_count = len(list(doc.sents)) or 1
        
        informality_prob = None
        try:
            inputs = self.formality_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(self.formality_device)
            with torch.no_grad():
                logits = self.formality_model(**inputs).logits
                informality_prob = torch.softmax(logits, dim=-1)[0][1].item()
        except Exception as e:
            print(f"ERROR (NLPService): Formality inference failed: {e}")

        sentiment = get_sia().polarity_scores(text)
        empath_cats = get_empath().analyze(text, categories=["social", "cognitive_processes", "affect"], normalize=True) or {}
        lower_text = text.lower()
        
        style_profile = StyleProfile(
            word_count=word_count,
            informal_score_regex=len(config.INFORMAL_RE.findall(lower_text)) / max(1, word_count),
            informality_score_model=informality_prob,
            hedging_score=len(config.HEDGING_RE.findall(lower_text)) / max(1, word_count),
            emoji=emoji.emoji_count(text) > 0,
            questioning=text.strip().endswith("?") or bool(config.QUESTION_RE.match(lower_text)),
            exclamatory=text.count("!") > 0,
            short=word_count <= 10,
            question_count=text.count("?"),
            exclamation_count=text.count("!"),
            meta_request="shorter" if "short" in lower_text else "longer" if "long" in lower_text else None,
            sentiment_neg=sentiment["neg"],
            sentiment_neu=sentiment["neu"],
            sentiment_pos=sentiment["pos"],
            sentiment_compound=sentiment["compound"],
            avg_sentence_length=word_count / sentence_count,
            avg_word_length=sum(len(w) for w in tokens) / max(1, word_count),
            flesch_reading_ease=textstat.flesch_reading_ease(text),
            fk_grade=textstat.flesch_kincaid_grade(text),
            function_word_ratio=sum(1 for t in tokens if t in config.FUNCTION_WORDS) / max(1, word_count),
            empath_social=empath_cats.get("social", 0.0),
            empath_cognitive=empath_cats.get("cognitive_processes", 0.0),
            empath_affect=empath_cats.get("affect", 0.0),
            pronouns=PronounProfile(
                i=bool(re.search(r"\bi\b", lower_text)),
                you=bool(re.search(r"\byou\b", lower_text)),
                we=bool(re.search(r"\bwe\b", lower_text)),
            ),
        )

        if len(self._doc_cache) > self.MAX_CACHE_SIZE:
            self._doc_cache.pop(next(iter(self._doc_cache)))
        self._doc_cache[text] = style_profile

        return style_profile

nlp_service = NLPService()