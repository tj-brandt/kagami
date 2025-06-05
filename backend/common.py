# backend/common.py
import os
import re
import textstat
import emoji
import json
import random
from datetime import datetime, timezone
from typing import Optional, Any
from pathlib import Path

import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

from empath import Empath
from spacy_setup import get_spacy_nlp_instance
from formality_model_setup import get_formality_model_components, get_formality_device
import torch

# --- Global variables for Formality Model ---
FORMALITY_MODEL: Optional[torch.nn.Module] = None
FORMALITY_TOKENIZER: Optional[Any] = None
FORMALITY_DEVICE: Optional[torch.device] = None

def initialize_formality_model():
    """
    Initializes the global formality model, tokenizer, and device by fetching them
    from formality_model_setup.py. This should be called once at application startup.
    """
    global FORMALITY_MODEL, FORMALITY_TOKENIZER, FORMALITY_DEVICE
    if FORMALITY_MODEL is None or FORMALITY_TOKENIZER is None:
        print("INFO (common.py - initialize_formality_model): Initializing formality model components in common.py...")
        FORMALITY_MODEL, FORMALITY_TOKENIZER = get_formality_model_components()
        FORMALITY_DEVICE = get_formality_device()
        if FORMALITY_MODEL and FORMALITY_TOKENIZER:
            print("INFO (common.py - initialize_formality_model): Formality model and tokenizer successfully loaded into common.py globals.")
        else:
            print("ERROR (common.py - initialize_formality_model): Failed to load formality model/tokenizer from formality_model_setup into common.py globals. Check formality_model_setup.py logs.")
    else:
        print("INFO (common.py - initialize_formality_model): Formality model components already initialized in common.py.")

# --- Constants (minimal for this example, ensure constants are present) ---
DEFAULT_BOT_NAME = "Kagami"
LOG_DIR = "experiment_logs"
MIN_LSM_TOKENS_FOR_LSM_CALC = 5
MIN_LSM_TOKENS_FOR_SMOOTHING = 15
LSM_SMOOTHING_ALPHA = 0.25
UNCERTAINTY_THRESHOLD = 0.5
HEDGING_THRESHOLD = 0.3
TEMPERATURE = 0.7
MAX_TOKENS = 512
SESSION_STATE_DIR = "session_state"

# --- Regex Patterns & Function Word Sets (for non-LSM style traits) ---
INFORMAL_RE = re.compile(
    r"\b(lol|lmao|rofl|bruh|bro|dude|yo|chill|fam|lit|dope|yolo|savage|no cap|omg|idk|btw|tbh|smh|omfg|wtf|idc|fyi|rn|lmk|hbu|wyd|tf|ngl|ikr|fr|af|imo|imho|gotcha|gimme|gonna|wanna|gotta|kinda|sorta|sup|wassup|hella|nah|yea|yep|dope|vibing|vibe)\b"
    r"|([!?]{2,})"
    r"|(\b(ha|he|hi){2,}\b)"
    r"|(\w*(\w)\2{2,}\w*)"
    r"|(<3|¯\\_\(ツ\)_/¯)",
    re.IGNORECASE | re.UNICODE
)
HEDGING_RE = re.compile(
    r"\b(maybe|probably|possibly|perhaps|might|could|seems|appears|suggests|i think|i guess|idk|not sure|kind of|sort of|somewhat|a bit|i suppose)\b",
    re.IGNORECASE
)
QUESTION_RE = re.compile(
    r"\b(who|what|when|where|why|how|is|are|am|was|were|do|does|did|can|could|should|would|will|shall|may|might|have|has|had)\b.*",
    re.IGNORECASE
)
_AUX_VERBS_SET = {"am","is","are","was","were","be","being","been", "have","has","had","having", "do","does","did", "will","would","shall","should","may","might","must","can","could"}
_CONJUNCTIONS_SET = {"and","but","or","so","yet","for","nor", "while","whereas","although","though","because","since","if","unless","until","when","as","that","whether","after","before"}
_NEGATIONS_FUNCTION_WORDS_SET = {"no","not","never","none","nobody","n't","nothing","nowhere","neither","nor","ain't","don't","isn't","wasn't","weren't","haven't","hasn't","hadn't","didn't","won't","wouldn't","shan't","shouldn't","mightn't","mustn't","can't","couldn't"}
FUNCTION_WORDS = {
    "i","you","we","he","she","they","me","him","her","us","them", "a","an","the",
    "in","on","at","by","for","with","about","against","between", "into","through","during",
    "before","after","above","below","to", "from","up","down","over","under"
} | _AUX_VERBS_SET | _CONJUNCTIONS_SET | _NEGATIONS_FUNCTION_WORDS_SET

valid_token_text_pattern = re.compile(r"^[a-z0-9]+$|^n't$", re.IGNORECASE)

# --- Advanced LSM Categories (Using spaCy POS tags and Lemmas) ---
LSM_CATEGORIES_SPACY = {
    "pronouns": {"type": "pos", "tags": {"PRON"}},
    "articles": {"type": "pos", "tags": {"DET"}},
    "prepositions_conjunctions": {"type": "pos", "tags": {"ADP", "SCONJ", "CCONJ"}},
    "aux_verbs": {"type": "pos", "tags": {"AUX"}},
    "negations": {
        "type": "lemma_and_dep",
        "lemmas": {"not"},
        "dep_neg_tag": "neg"
    },
}

# Initialize tools
try:
    sia = SentimentIntensityAnalyzer() # NLTK VADER
except LookupError:
    print("ERROR (common.py): NLTK vader_lexicon not found. Check nltk_bootstrap.py.")
    sia = None
except Exception as e:
    print(f"ERROR (common.py): Failed to initialize SentimentIntensityAnalyzer: {e}")
    sia = None

try:
    lexicon = Empath()
except Exception as e:
     print(f"ERROR (common.py): Could not initialize Empath: {e}")
     lexicon = None

def get_text_formality_score(text: str) -> Optional[float]:
    """
    Calculates the informality score of a given text using the loaded transformer model.
    Returns a float (e.g., 0.0 for very formal, 1.0 for very informal) or None if the model isn't loaded
    or an error occurs.
    """
    global FORMALITY_MODEL, FORMALITY_TOKENIZER, FORMALITY_DEVICE # Access the globals

    if FORMALITY_MODEL is None or FORMALITY_TOKENIZER is None:
        print("WARNING (common.py - get_text_formality_score): Formality model/tokenizer not loaded. Cannot calculate score.")
        return None

    if not text or not text.strip():
        return None 

    try:
        inputs = FORMALITY_TOKENIZER(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
        inputs = {k: v.to(FORMALITY_DEVICE) for k, v in inputs.items()} # Move inputs to the model's device

        with torch.no_grad(): # Disable gradient calculations for inference
            outputs = FORMALITY_MODEL(**inputs)
            logits = outputs.logits

        # For s-nlp ranker:
        # Logit 0: "formal", Logit 1: "informal"
        probabilities = torch.softmax(logits, dim=-1)
        informality_prob = probabilities[0][1].item() # Probability of the second class (informal)

        return informality_prob

    except Exception as e:
        print(f"ERROR (common.py - get_text_formality_score): Error during formality model inference for text '{text[:100]}...': {e}")
        return None


# --- Helper Functions ---

def tokenize_text(text: str) -> list[str]:
    nlp_spacy = get_spacy_nlp_instance()
    if not nlp_spacy:
        print("WARNING (common.py - tokenize_text): spaCy model not loaded. Falling back to basic regex for general tokenization.")
        raw_tokens = re.findall(r"\b\w+(?:'\w+)?\b|[\.,!?;]", text.lower())
        return [t for t in raw_tokens if valid_token_text_pattern.match(t) and t.strip()]
    try:
        doc = nlp_spacy(text)
        tokens = [token.text.lower() for token in doc if token.text.strip() and valid_token_text_pattern.match(token.text.lower())]
        return tokens
    except Exception as e:
        print(f"ERROR (common.py - tokenize_text general): Error during spaCy tokenization: {e}. Falling back to regex.")
        raw_tokens = re.findall(r"\b\w+(?:'\w+)?\b|[\.,!?;]", text.lower())
        return [t for t in raw_tokens if valid_token_text_pattern.match(t) and t.strip()]

def compute_lsm_score(user_text: str, bot_text: str) -> float:
    nlp_spacy = get_spacy_nlp_instance()
    if not nlp_spacy or not user_text or not bot_text:
        return 0.5

    user_doc = nlp_spacy(user_text)
    bot_doc = nlp_spacy(bot_text)

    user_valid_tokens = [t for t in user_doc if not t.is_punct and not t.is_space and valid_token_text_pattern.match(t.text)]
    bot_valid_tokens = [t for t in bot_doc if not t.is_punct and not t.is_space and valid_token_text_pattern.match(t.text)]

    if len(user_valid_tokens) < MIN_LSM_TOKENS_FOR_LSM_CALC or len(bot_valid_tokens) < MIN_LSM_TOKENS_FOR_LSM_CALC:
        return 0.5

    scores = []
    for category_name, rules in LSM_CATEGORIES_SPACY.items():
        user_cat_count = 0
        bot_cat_count = 0

        if rules["type"] == "pos":
            user_cat_count = sum(1 for token in user_valid_tokens if token.pos_ in rules["tags"])
            bot_cat_count = sum(1 for token in bot_valid_tokens if token.pos_ in rules["tags"])
        elif rules["type"] == "lemma_and_dep":
            user_cat_count = sum(1 for token in user_valid_tokens if token.lemma_.lower() in rules["lemmas"] or token.dep_ == rules["dep_neg_tag"])
            bot_cat_count = sum(1 for token in bot_valid_tokens if token.lemma_.lower() in rules["lemmas"] or token.dep_ == rules["dep_neg_tag"])

        fu = user_cat_count / len(user_valid_tokens) if user_valid_tokens else 0
        fb = bot_cat_count / len(bot_valid_tokens) if bot_valid_tokens else 0

        epsilon = 0.0001
        numerator = abs(fu - fb)
        denominator = fu + fb + epsilon
        category_score = 1 - (numerator / denominator)
        scores.append(category_score)

    return sum(scores) / len(scores) if scores else 0.5

def detect_style_traits(user_input: str) -> dict:
    nlp_spacy = get_spacy_nlp_instance() # Ensure spacy_setup.py works and get_spacy_nlp_instance() is available
    traits = {}
    try:
        lower_input_for_regex = user_input.lower()
        tokens_for_counts = tokenize_text(user_input) # Ensure tokenize_text is robust
        word_count = len(tokens_for_counts) if tokens_for_counts else 0

        # --- Calculate formality using the new transformer model ---
        # This call should now work as get_text_formality_score is defined above
        informality_score_transformer = get_text_formality_score(user_input)

        hedge_matches = HEDGING_RE.findall(lower_input_for_regex)
        informal_matches = INFORMAL_RE.findall(user_input)


        traits = {
            "word_count": word_count,
            "informal_score_regex": len(informal_matches) / max(1, word_count),
            "informality_score_model": informality_score_transformer, # Will be float or None
            "hedging_score": len(hedge_matches) / max(1, word_count),
            "emoji": emoji.emoji_count(user_input) > 0, # Ensure emoji library is imported
            "questioning": user_input.strip().endswith("?") or bool(QUESTION_RE.match(lower_input_for_regex)),
            "exclamatory": user_input.count("!") > 0,
            "short": word_count <= 10,
            "question_count": user_input.count("?"),
            "exclamation_count": user_input.count("!")
        }

        meta = None
        if re.search(r"\b(short|shorter|concise|brief|less text|too long)\b", lower_input_for_regex):
            meta = "shorter"
        elif re.search(r"\b(more detail|long|longer|lengthy|elaborate)\b", lower_input_for_regex):
            meta = "longer"
        elif re.search(r"\b(simple|simpler|easy|easier)\b", lower_input_for_regex):
            meta = "simpler"
        traits["meta_request"] = meta

        if sia: # Check if sia was successfully initialized
            sent = sia.polarity_scores(user_input)
            sent = adjust_sentiment_for_emojis(sent, user_input)
            traits.update({
                "sentiment_neg": sent["neg"],
                "sentiment_neu": sent["neu"],
                "sentiment_pos": sent["pos"],
                "sentiment_compound": sent["compound"]
            })
        else:
            traits.update({
                "sentiment_neg": None, "sentiment_neu": None,
                "sentiment_pos": None, "sentiment_compound": None
            })

        if nlp_spacy and "senter" in nlp_spacy.pipe_names:
            doc_for_sents = nlp_spacy(user_input)
            num_sentences = len(list(doc_for_sents.sents))
            sen_count = max(1, num_sentences)
        else:
            sentences_from_regex = [s for s in re.split(r"[.!?]+", user_input) if s.strip()]
            sen_count = max(1, len(sentences_from_regex))

        traits["avg_sentence_length"] = word_count / sen_count if sen_count > 0 else 0
        traits["avg_word_length"] = sum(len(w) for w in tokens_for_counts) / max(1, word_count) if tokens_for_counts else 0

        try:
            traits["flesch_reading_ease"] = textstat.flesch_reading_ease(user_input) # Ensure textstat is imported
            traits["fk_grade"] = textstat.flesch_kincaid_grade(user_input)
        except Exception: # Be specific with exception if textstat has known errors for empty strings
            traits["flesch_reading_ease"] = None
            traits["fk_grade"] = None

        func_count = sum(1 for w in tokens_for_counts if w in FUNCTION_WORDS) if tokens_for_counts else 0
        traits["function_word_ratio"] = func_count / max(1, word_count)

        if lexicon: # Check if Empath lexicon was loaded
            try:
                e_cats = lexicon.analyze(user_input, normalize=True) or {}
                traits.update({
                    "empath_social": e_cats.get("social", 0.0),
                    "empath_cognitive": e_cats.get("cognitive_processes", 0.0),
                    "empath_affect": e_cats.get("affect", 0.0)
                })
            except Exception as e_empath:
                print(f"WARNING (common.py - detect_style_traits): Empath analysis failed: {e_empath}")
                traits.update({"empath_social": None, "empath_cognitive": None, "empath_affect": None})
        else:
             traits.update({"empath_social": None, "empath_cognitive": None, "empath_affect": None})

        traits["pronouns"] = {
            "i": bool(re.search(r"\bi\b", lower_input_for_regex)),
            "you": bool(re.search(r"\byou\b", lower_input_for_regex)),
            "we": bool(re.search(r"\bwe\b", lower_input_for_regex))
        }

    except Exception as e:
        print(f"ERROR (common.py - detect_style_traits): Unhandled exception: {e}")
        # Return a consistent error structure
        return {
            "error": str(e), "word_count": 0, "informal_score_regex": 0, "hedging_score": 0,
            "informality_score_model": None # Ensure all expected keys are present even on error
            
        }
    return traits

def adjust_sentiment_for_emojis(sentiment: dict, text: str) -> dict:
    positive_emojis = {"😊", "😄", "😁", "😚", "☺️", "😍", "😇", "🎉", "💖"}
    negative_emojis = {"😢", "😭", "😠", "😡", "💔", "👿", "😞", "🤬"}
    pos_count = sum(text.count(e) for e in positive_emojis)
    neg_count = sum(text.count(e) for e in negative_emojis)
    adjustment = (pos_count - neg_count) * 0.1
    sentiment["compound"] = max(-1.0, min(1.0, sentiment["compound"] + adjustment))
    return sentiment

def get_user_style_sample(chat_history, min_tokens=15, max_lookback=3) -> str | None:
    recent_user_turns = [m["content"] for m in reversed(chat_history) if m["role"] == "user"]
    tokens = []
    collected = []
    for msg in recent_user_turns[:max_lookback]:
        msg_tokens = tokenize_text(msg)
        tokens.extend(msg_tokens)
        collected.insert(0, msg)
        if len(tokens) >= min_tokens:
            break
    return " ".join(collected) if len(tokens) >= min_tokens else None

def post_process_response(resp: str, is_adaptive: bool) -> str:
    processed_resp = resp
    if not is_adaptive:
        processed_resp = emoji.replace_emoji(processed_resp, replace="")
        processed_resp = re.sub(INFORMAL_RE, "", processed_resp)
    processed_resp = re.sub(r'\s{2,}', ' ', processed_resp).strip()
    processed_resp = re.sub(r"([^\n])(\n?)(\s*[\*-]\s+)", r"\1\n\3", processed_resp)
    processed_resp = re.sub(r"^(\s*[\*-]\s+)", r"\n\1", processed_resp)
    processed_resp = re.sub(r'\s{2,}', ' ', processed_resp).strip()
    processed_resp = re.sub(r'\n{3,}', '\n\n', processed_resp)
    return processed_resp

def generate_dynamic_prompt(template: str, style_profile: dict, locked_tone: str = None) -> str:
    persona = DEFAULT_BOT_NAME
    instructions = []
    pronoun_profile = style_profile.get("pronouns", {})

    if pronoun_profile.get("i") and not pronoun_profile.get("you") and len(instructions) < 3:
        instructions.append("The user is focusing on their own experiences. It's okay to use 'I' thoughtfully in your response if it fits.")
    elif pronoun_profile.get("you") and not pronoun_profile.get("i") and len(instructions) < 3:
        instructions.append("The user is addressing you directly or asking about your 'thoughts'. Respond naturally using 'you' as appropriate.")
    elif pronoun_profile.get("we") and len(instructions) < 3:
        instructions.append("The user included 'we'. If the context allows, using 'we' can build a sense of connection.")

    try:
        # --- Informality Handling using the Transformer Model Score ---
        model_informality_score = style_profile.get("informality_score_model") 
        regex_informal_score = style_profile.get("informal_score_regex", 0) 

        # Threshold for model's informality score (0.0 = very formal, 1.0 = very informal)
        MODEL_INFORMALITY_THRESHOLD = 0.3 # Adjust this threshold based on observation

        used_model_for_informality_decision = False
        tone_instruction_set = False

        if model_informality_score is not None: # Check if the model provided a score
            used_model_for_informality_decision = True
            if model_informality_score > MODEL_INFORMALITY_THRESHOLD:
                instructions.append("Use a slightly casual and relaxed tone, while keeping it warm and welcoming.")
                tone_instruction_set = True
        
        if not tone_instruction_set:
            instructions.append("Maintain a polite, clear, and consistently friendly tone.")
            tone_instruction_set = True
        # --- End Informality Handling ---

        # Uncertainty calculation can still use the regex score or other simple features
        current_informal_for_uncertainty = regex_informal_score # Or decide if model_informality_score should play a role
        uncertainty = (style_profile.get("hedging_score", 0) * 0.4) + \
                      (style_profile.get("questioning", 0) * 0.4) + \
                      (current_informal_for_uncertainty * 0.2)
        if uncertainty > UNCERTAINTY_THRESHOLD:
            instructions.append("Sound a little more reassuring and offer gentle encouragement when responding.")
        
        if style_profile.get("meta_request") == "shorter":
            instructions.append("Keep responses short and concise.")
        elif style_profile.get("meta_request") == "longer":
            instructions.append("Provide slightly more detailed and expanded responses.")
        elif style_profile.get("meta_request") == "simpler":
            instructions.append("Use simple, easy-to-understand language.")

        if style_profile.get("question_count", 0) >= 2 and style_profile.get("word_count", 100) > 10 and len(instructions) < 3:
            instructions.append("The user is quite inquisitive. If it feels natural, consider asking a gentle question back to keep the conversation flowing.")
        
        if style_profile.get("exclamatory") and style_profile.get("exclamation_count", 0) >= 1 and len(instructions) < 3:
            instructions.append("The user seems to be using exclamations. You can mirror this energy with an exclamation if it genuinely matches the sentiment of your response, but use it sparingly.")
        
        sentiment = style_profile.get("sentiment_compound", 0)
        if sentiment > 0.5:
            instructions.append("Reflect the user's cheerful mood with slightly more upbeat and lively wording.")
        elif sentiment < -0.5:
            instructions.append("Respond with a softer, more gentle tone to match a somber mood.")

    except Exception as e:
        print(f"ERROR (common.py - generate_dynamic_prompt): {e}")

    full_instruction = template.replace("{persona}", persona)
    if instructions:
        full_instruction += "\n\nStyle Adaptation Instructions:\n- " + "\n- ".join(instructions)
    return full_instruction

def log_event(event_data: dict, session_info: dict):
    log_file = session_info.get("log_file_path")
    if not log_file:
        pid = session_info.get("participantId", "unknown_pid")
        sid = session_info.get("sessionId", "unknown_sid")
        fallback_log_file = os.path.join(LOG_DIR, f"participant_{pid}_{sid}_event_log_error.jsonl")
        print(f"Warning (common.py - log_event): No log_file_path. Event: {event_data.get('event_type', 'Unknown Event')}. Logging to: {fallback_log_file}")
        log_file = fallback_log_file
    log_dir_for_file = os.path.dirname(log_file)
    if log_dir_for_file: os.makedirs(log_dir_for_file, exist_ok=True)
    else: os.makedirs(LOG_DIR, exist_ok=True)
    full_event_data = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "participant_id": session_info.get("participantId"), "session_id": session_info.get("sessionId"),
        "condition_raw": session_info.get("condition"), "condition_name_from_frontend": session_info.get("condition_name_from_frontend"),
        "condition_iv_avatar_type": session_info.get("condition_iv_avatar_type"), "condition_iv_lsm_type": session_info.get("condition_iv_lsm_type"),
        "avatar_url": session_info.get("avatar_url"), "avatar_prompt": session_info.get("avatar_prompt"),
        "turn_number": session_info.get("turn_number"), **event_data,
    }
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(full_event_data, ensure_ascii=False) + '\n')
    except TypeError as te:
         print(f"ERROR (common.py - log_event): TypeError. Data: {full_event_data}. Error: {te}")
    except Exception as e:
        print(f"Error (common.py - log_event): writing to log {log_file}. Event: {event_data.get('event_type', 'Unknown Event')}: {e}")