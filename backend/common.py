import os
import re
import nltk
import textstat
import emoji
import json # ✨ Import the json module here ✨
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from empath import Empath
from nltk.tokenize import word_tokenize
import random
from datetime import datetime, timezone

# --- Constants ---
DEFAULT_BOT_NAME = "Kagami"
SESSION_TIMEOUT_SECONDS = 600
LOG_DIR = "experiment_logs"
MIN_LSM_TOKENS = 15
LSM_SMOOTHING_ALPHA = 0.4
UNCERTAINTY_THRESHOLD = 0.5
HEDGING_THRESHOLD = 0.3

# Move TEMPERATURE and MAX_TOKENS back to common.py
TEMPERATURE = 0.7
MAX_TOKENS = 512


# Define TONE_VARIATIONS here, at the top level
TONE_VARIATIONS = [
    "with a lo-fi, nostalgic tone",
    "like an introspective 90s anime character",
    "in a warm, slightly synthy voice",
    "with a calm and expressive retro feel",
    "like a soft-spoken friend from a digital dreamscape"
]

# --- Regex Patterns & Function Word Sets ---
INFORMAL_RE = re.compile(
    r"\b(lol|lmao|rofl|bruh|bro|dude|yo|chill|fam|lit|dope|yolo|savage|no cap|omg|idk|btw|tbh|smh|omfg|wtf|idc|fyi|rn|lmk|hbu|wyd)\b"
    r"|([!?]{2,})"                      # multiple exclamations or question marks
    r"|(\b(ha|he|hi){2,}\b)"             # repeated laughter syllables
    r"|(\w*(\w)\2{2,}\w*)"               # long letter repeats (e.g., "noooo", "yeaaaah")
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

AUX_VERBS = {"am","is","are","was","were","be","being","been",
             "have","has","had","having",
             "do","does","did",
             "will","would","shall","should","may","might","must","can","could"}
CONJUNCTIONS = {"and","but","or","so","yet","for","nor",
                "while","whereas","although","though","because","since","if","unless","until","when","as","that","whether","after","before"}
NEGATIONS = {"no","not","never","none","nobody","n't","nothing","nowhere","neither","nor","ain't","don't","isn't","wasn't","weren't","haven't","hasn't","hadn't","didn't","won't","wouldn't","shan't","shouldn't","mightn't","mustn't","can't","couldn't"}
FUNCTION_WORDS = {
    "i","you","we","he","she","they","me","him","her","us","them",
    "a","an","the", "n't",
    "in","on","at","by","for","with","about","against","between",
    "into","through","during","before","after","above","below","to",
    "from","up","down","over","under"
} | AUX_VERBS | CONJUNCTIONS | NEGATIONS
LSM_CATEGORIES = {
    "pronouns": {"i","you","we","he","she","they","me","him","her","us","them"},
    "articles": {"a","an","the"},
    "prepositions": {"in","on","at","by|for","with","about","against","between",
                     "into","through","during","before","after","above","below",
                     "to","from","up","down","over","under"},
    "aux_verbs": AUX_VERBS,
    "conjunctions": CONJUNCTIONS,
    "negations": NEGATIONS
}
valid_token_pattern = re.compile(r"^[a-z0-9]+$|^n't$", re.IGNORECASE)

# --- NLTK/VADER/Empath Initialization ---
# Ensure punkt and vader_lexicon are downloaded prior to starting the backend.
# This NLTK path setup should be done before using NLTK functions
NLTK_DATA_PATH = os.path.join(os.path.dirname(__file__), "nltk_data")
os.makedirs(NLTK_DATA_PATH, exist_ok=True)
nltk.data.path.append(NLTK_DATA_PATH)

# Initialize tools
sia = SentimentIntensityAnalyzer()
lexicon = Empath()


# --- Helper Functions ---
def tokenize_text(text: str) -> list[str]:
    try:
        # NLTK word_tokenize handles contractions like "ain't", "don't" correctly
        tokens = word_tokenize(text.lower())
        # Filter tokens to include only alphanumeric or 'n't' for consistent function word matching
        return [t for t in tokens if valid_token_pattern.match(t)]
    except LookupError:
        print("NLTK data not found. Please download 'punkt' and 'vader_lexicon'.")
        # Fallback using regex if NLTK tokenization fails
        return re.findall(r"\w+|n't", text.lower())
    except Exception:
        # General fallback for other errors
        return re.findall(r"\w+|n't", text.lower())


def get_category_fraction(text: str, word_set: set) -> float:
    tokens = tokenize_text(text)
    if not tokens:
        return 0.0
    # Ensure comparison is case-insensitive if word_set contains lowercase words
    count = sum(1 for t in tokens if t in word_set)
    return count / len(tokens)

def get_user_style_sample(chat_history, min_tokens=15, max_lookback=3) -> str | None:
    recent_user_turns = [m["content"] for m in reversed(chat_history) if m["role"] == "user"]
    tokens = []
    collected = []

    for msg in recent_user_turns[:max_lookback]:
        msg_tokens = tokenize_text(msg)
        tokens.extend(msg_tokens)
        collected.insert(0, msg)  # Maintain original order
        if len(tokens) >= min_tokens:
            break

    return " ".join(collected) if len(tokens) >= min_tokens else None


def compute_lsm_score(user_text: str, bot_text: str) -> float:
    user_tokens = tokenize_text(user_text.lower())
    bot_tokens = tokenize_text(bot_text.lower())

    if len(user_tokens) < MIN_LSM_TOKENS or len(bot_tokens) < MIN_LSM_TOKENS:
        return 0.5  # Neutral midpoint if too few tokens for reliable LSM

    scores = []

    for cat_words in LSM_CATEGORIES.values():
        fu = sum(1 for t in user_tokens if t in cat_words) / len(user_tokens)
        fb = sum(1 for t in bot_tokens if t in cat_words) / len(bot_tokens)

        denom = fu + fb
        if denom > 1e-9:
            raw_score = 1 - abs(fu - fb) / denom
            smoothed_score = (raw_score + LSM_SMOOTHING_ALPHA) / (1 + LSM_SMOOTHING_ALPHA)
            scores.append(smoothed_score)
        elif abs(fu - fb) < 1e-9:
            scores.append(1.0)
        else:
            scores.append(0.0)

    return sum(scores) / len(scores) if scores else 1.0


def post_process_response(resp: str, is_adaptive: bool) -> str:
    if not is_adaptive:
        # Remove emojis and informal language if not adaptive
        resp = emoji.replace_emoji(resp, replace="")
        # Note: Removing based on regex after generation might cut mid-sentence.
        # A better approach for non-adaptive might be stronger system instructions.
        # This regex removal is kept as per original, but its effect depends on model's output.
        resp = re.sub(INFORMAL_RE, "", resp)

    # Clean up whitespace and formatting
    resp = re.sub(r'\s{2,}', ' ', resp).strip() # Remove multiple spaces
    # Ensure newline before list items starting with * or -
    resp = re.sub(r"([^\n])(\n?)(\s*[\*-]\s+)", r"\1\n\3", resp)
    # Ensure newline before list items starting a response
    resp = re.sub(r"^(\s*[\*-]\s+)", r"\n\1", resp)
    resp = re.sub(r'\s{2,}', ' ', resp).strip() # Re-strip after adding newlines
    resp = re.sub(r'\n{3,}', '\n\n', resp) # Reduce multiple newlines

    return resp


def detect_style_traits(user_input: str) -> dict:
    lower_input = user_input.lower()
    tokens = tokenize_text(user_input) # already filtered
    word_count = len(tokens)

    #Recalculate hedging
    hedge_matches = HEDGING_RE.findall(lower_input)
    hedging_score = len(hedge_matches) / max(1, len(tokens))

    # Recalculate informal based on tokens for better boundary matching
    informal_matches = INFORMAL_RE.findall(user_input)
    informal_score = len(informal_matches) / max(1, len(tokens))

    traits = {
        "word_count": word_count,
        "informal_score": informal_score,
        "hedging_score": hedging_score,  # <-- NEW!
        "emoji": emoji.emoji_count(user_input) > 0,
        "questioning": user_input.strip().endswith("?") or bool(QUESTION_RE.match(lower_input)),
        "exclamatory": user_input.count("!") > 0,
        "short": word_count <= 10,
        "question_count": user_input.count("?"),
        "exclamation_count": user_input.count("!")
    }

    # This interpret_hedging function was defined but not used in the original snippets
    # def interpret_hedging(hedging_score: float) -> str:
    #     """Categorize the hedging level."""
    #     if hedging_score > HEDGING_THRESHOLD:
    #         return "heavy"
    #     elif hedging_score > 0.1:
    #         return "moderate"
    #     else:
    #         return "low"

    # This compute_uncertainty_score function was defined but not used in the original snippets
    # def compute_uncertainty_score(traits: dict) -> float:
    #     """Combine hedging, informal, and questioning into one uncertainty score."""
    #     # Give more weight to hedging + questioning, slight to informality
    #     score = (traits["hedging_score"] * 0.4) + (traits["questioning"] * 0.4) + (traits["informal_score"] * 0.2)
    #     return score

    meta = None
    if re.search(r"\b(short|shorter|concise|brief|less text|too long)\b", lower_input):
        meta = "shorter"
    elif re.search(r"\b(more detail|long|longer|lengthy|elaborate)\b", lower_input):
        meta = "longer"
    elif re.search(r"\b(simple|simpler|easy|easier)\b", lower_input):
        meta = "simpler"
    traits["meta_request"] = meta

    sent = sia.polarity_scores(user_input)
    traits.update({
        "sentiment_neg": sent["neg"],
        "sentiment_neu": sent["neu"],
        "sentiment_pos": sent["pos"],
        "sentiment_compound": sent["compound"]
    })

    sentences = [s for s in re.split(r"[.!?]+", user_input) if s.strip()]
    sen_count = max(1, len(sentences))
    traits.update({
        "avg_sentence_length": word_count / sen_count if sen_count else 0, # Avoid division by zero
        "avg_word_length": sum(len(w) for w in tokens) / max(1, word_count) # Avoid division by zero
    })

    try:
        # textstat might require specific inputs or handle errors.
        # Ensure it's robust or add checks.
        traits["flesch_reading_ease"] = textstat.flesch_reading_ease(user_input)
        traits["fk_grade"] = textstat.flesch_kincaid_grade(user_input)
    except Exception: # Catch potential errors from textstat on malformed input
        traits["flesch_reading_ease"] = -1
        traits["fk_grade"] = -1

    # Calculate function word ratio using the tokenized list
    func_count = sum(1 for w in tokens if w.lower() in FUNCTION_WORDS)
    traits["function_word_ratio"] = func_count / max(1, word_count) # Avoid division by zero

    try:
        # Empath might require specific inputs or handle errors.
        e_cats = lexicon.analyze(user_input, normalize=True) or {}
    except Exception: # Catch potential errors from Empath
        e_cats = {}
    traits.update({
        "empath_social": e_cats.get("social", 0.0),
        "empath_cognitive": e_cats.get("cognitive_processes", 0.0),
        "empath_affect": e_cats.get("affect", 0.0)
    })

    counts = {}
    # Calculate LSM category counts using the tokenized list and lowercase
    lower_tokens = [t.lower() for t in tokens]
    for cat, ws in LSM_CATEGORIES.items():
        # Ensure comparison is case-insensitive
        c = sum(1 for t in lower_tokens if t in ws)

        counts[cat] = c
    traits["lsm_counts"] = counts

    # Specific pronoun checks using lowercase and word boundaries
    traits["pronouns"] = {
        "i": bool(re.search(r"\bi\b", lower_input)),
        "you": bool(re.search(r"\byou\b", lower_input)),
        "we": bool(re.search(r"\bwe\b", lower_input))
    }

    return traits

def generate_dynamic_prompt(template: str, style_profile: dict) -> str:
    persona = DEFAULT_BOT_NAME
    instructions = []

    # Adapt tone based on informality
    if style_profile.get("informal_score", 0) > 0.3:
        instructions.append("Use a slightly casual and relaxed tone, while keeping it warm and welcoming.")
    else:
        tone = random.choice(TONE_VARIATIONS)
        instructions.append(f"Use a polite and clear tone, {tone}.")


    # Acknowledge uncertainty if detected
    uncertainty = (style_profile.get("hedging_score", 0) * 0.4) + (style_profile.get("questioning", 0) * 0.4) + (style_profile.get("informal_score", 0) * 0.2)
    if uncertainty > UNCERTAINTY_THRESHOLD:
        instructions.append("Sound a little more reassuring and offer gentle encouragement when responding.")

    # Meta requests: short, longer, simpler
    if style_profile.get("meta_request") == "shorter":
        instructions.append("Keep responses short and concise.")
    elif style_profile.get("meta_request") == "longer":
        instructions.append("Provide slightly more detailed and expanded responses.")
    elif style_profile.get("meta_request") == "simpler":
        instructions.append("Use simple, easy-to-understand language.")

    # Sentiment-based energy matching
    sentiment = style_profile.get("sentiment_compound", 0)
    if sentiment > 0.5:
        instructions.append("Reflect the user's cheerful mood with slightly more upbeat and lively wording.")
    elif sentiment < -0.5:
        instructions.append("Respond with a softer, more gentle tone to match a somber mood.")

    # Final system instruction construction
    full_instruction = template.replace("{persona}", persona)
    if instructions:
        full_instruction += "\n\nStyle Adaptation Instructions:\n- " + "\n- ".join(instructions)

    return full_instruction

def log_event(event_data: dict, session_info: dict):
    log_file = session_info.get("log_file_path")
    if not log_file:
        print("Warning: No log file path provided.")
        return
    event_data["timestamp_utc"] = datetime.now(timezone.utc).isoformat()
    event_data["participant_id"] = session_info.get("participantId")
    event_data["session_id"] = session_info.get("sessionId")
    event_data["condition"] = session_info.get("condition")
    event_data["avatar_url"] = session_info.get("avatar_url")
    event_data["turn_number"] = session_info.get("turn_number")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, 'a', encoding='utf-8') as f:
        # json is now imported
        json.dump(event_data, f, ensure_ascii=False)
        f.write('\n')

def log_avatar(participant_id: str, avatar_url: str, prompt: str):
    avatar_log_path = os.path.join(LOG_DIR, "avatar_log.jsonl")
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(avatar_log_path, "a", encoding="utf-8") as f:
        # json is now imported
        json.dump({
            "participant_id": participant_id,
            "avatar_url": avatar_url,
            "avatar_prompt": prompt,
            "timestamp_utc": datetime.now(timezone.utc).isoformat()
        }, f)
        f.write('\n')