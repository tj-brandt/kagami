# backend/common.py

import os
import re
import nltk
import textstat
import emoji
import json
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
LSM_SMOOTHING_ALPHA = 0.25
UNCERTAINTY_THRESHOLD = 0.5
HEDGING_THRESHOLD = 0.3

TEMPERATURE = 0.7
MAX_TOKENS = 512

TONE_VARIATIONS = [
    "with a chill, slightly nostalgic tone",
    "like someone who’s into music, memes, and late-night convos",
    "in a grounded, curious voice—like a real person, not a narrator",
    "with the laid-back energy of a 3am group chat",
    "like someone who's emotionally aware but doesn't overexplain things"
]

# --- Regex Patterns & Function Word Sets ---
INFORMAL_RE = re.compile(
    r"\b(lol|lmao|rofl|bruh|bro|dude|yo|chill|fam|lit|dope|yolo|savage|no cap|omg|idk|btw|tbh|smh|omfg|wtf|idc|fyi|rn|lmk|hbu|wyd)\b"
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
    "prepositions": {"in","on","at","by","for","with","about","against","between", 
                     "into","through","during","before","after","above","below",
                     "to","from","up","down","over","under"},
    "aux_verbs": AUX_VERBS,
    "conjunctions": CONJUNCTIONS,
    "negations": NEGATIONS
}
valid_token_pattern = re.compile(r"^[a-z0-9]+$|^n't$", re.IGNORECASE)

# --- NLTK/VADER/Empath Initialization ---
NLTK_DATA_PATH = os.path.join(os.path.dirname(__file__), "nltk_data")
os.makedirs(NLTK_DATA_PATH, exist_ok=True)
if NLTK_DATA_PATH not in nltk.data.path:
    nltk.data.path.append(NLTK_DATA_PATH)

# Initialize tools (ensure NLTK data is available)
try:
    sia = SentimentIntensityAnalyzer()
except LookupError:
    print("ERROR: NLTK vader_lexicon not found. Please run the download script or install manually.")
    sia = None 

try:
    lexicon = Empath()
except Exception as e:
     print(f"ERROR: Could not initialize Empath: {e}")
     lexicon = None 

# --- Helper Functions ---
def tokenize_text(text: str) -> list[str]:
    try:
        tokens = word_tokenize(text.lower())
        return [t for t in tokens if valid_token_pattern.match(t)]
    except LookupError:
        print("WARNING: NLTK punkt tokenizer not found during tokenize_text call. Falling back to regex.")
        return re.findall(r"\w+|n't", text.lower())
    except Exception as e:
        print(f"WARNING: Error during NLTK tokenization: {e}. Falling back to regex.")
        return re.findall(r"\w+|n't", text.lower())

def adjust_sentiment_for_emojis(sentiment: dict, text: str) -> dict:
    positive_emojis = {"😊", "😄", "😁", "😚", "☺️", "😍", "😇", "🎉", "💖"}
    negative_emojis = {"😢", "😭", "😠", "😡", "💔", "👿", "😞", "🤬"}

    pos_count = sum(text.count(e) for e in positive_emojis)
    neg_count = sum(text.count(e) for e in negative_emojis)
    adjustment = (pos_count - neg_count) * 0.1

    sentiment["compound"] = max(-1.0, min(1.0, sentiment["compound"] + adjustment))
    return sentiment


def get_category_fraction(text: str, word_set: set) -> float:
    tokens = tokenize_text(text)
    if not tokens:
        return 0.0
    count = sum(1 for t in tokens if t in word_set)
    return count / len(tokens)

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


def compute_lsm_score(user_text: str, bot_text: str) -> float:
    user_tokens = tokenize_text(user_text.lower())
    bot_tokens = tokenize_text(bot_text.lower())
    if not user_text or not bot_text: # Check if texts are empty
        return 0.5
    if not user_tokens or not bot_tokens or len(user_tokens) < MIN_LSM_TOKENS or len(bot_tokens) < MIN_LSM_TOKENS:
        return 0.5 

    scores = []
    for cat, cat_words in LSM_CATEGORIES.items():
        try:
            # Ensure len(tokens) is not zero before division
            fu = sum(1 for t in user_tokens if t in cat_words) / len(user_tokens) if user_tokens else 0
            fb = sum(1 for t in bot_tokens if t in cat_words) / len(bot_tokens) if bot_tokens else 0
            # common.py - inside compute_lsm_score loop for each category
            epsilon = 0.0001 # A small constant

            # fu = user_category_percentage (already calculated)
            # fb = bot_category_percentage (already calculated)

            numerator = abs(fu - fb)
            denominator = fu + fb + epsilon # Add epsilon here

            # The score for this category. If fu and fb are both 0, numerator is 0, 
            # denominator is epsilon, so score is 1 - 0 = 1 (perfect match).
            # If one is 0 and other is X, numerator is X, denominator is X+epsilon,
            # score is 1 - (X / (X+epsilon)), which is close to 0 (no match).
            category_score = 1 - (numerator / denominator) 
            scores.append(category_score)
        except ZeroDivisionError: 
            scores.append(0.5)

    return sum(scores) / len(scores) if scores else 0.5


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


def detect_style_traits(user_input: str) -> dict:
    traits = {} 
    try:
        lower_input = user_input.lower()
        tokens = tokenize_text(user_input)
        word_count = len(tokens)

        hedge_matches = HEDGING_RE.findall(lower_input)
        informal_matches = INFORMAL_RE.findall(user_input) 

        traits = {
            "word_count": word_count,
            "informal_score": len(informal_matches) / max(1, word_count), 
            "hedging_score": len(hedge_matches) / max(1, word_count),
            "emoji": emoji.emoji_count(user_input) > 0,
            "questioning": user_input.strip().endswith("?") or bool(QUESTION_RE.match(lower_input)),
            "exclamatory": user_input.count("!") > 0,
            "short": word_count <= 10,
            "question_count": user_input.count("?"),
            "exclamation_count": user_input.count("!")
        }

        meta = None
        if re.search(r"\b(short|shorter|concise|brief|less text|too long)\b", lower_input):
            meta = "shorter"
        elif re.search(r"\b(more detail|long|longer|lengthy|elaborate)\b", lower_input):
            meta = "longer"
        elif re.search(r"\b(simple|simpler|easy|easier)\b", lower_input):
            meta = "simpler"
        traits["meta_request"] = meta

        if sia:
            sent = sia.polarity_scores(user_input)
            sent = adjust_sentiment_for_emojis(sent, user_input)  # <- New compensation logic
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

        sentences = [s for s in re.split(r"[.!?]+", user_input) if s.strip()]
        sen_count = max(1, len(sentences))
        traits["avg_sentence_length"] = word_count / sen_count if sen_count else 0
        traits["avg_word_length"] = sum(len(w) for w in tokens) / max(1, word_count)
        try:
            traits["flesch_reading_ease"] = textstat.flesch_reading_ease(user_input)
            traits["fk_grade"] = textstat.flesch_kincaid_grade(user_input)
        except Exception:
            traits["flesch_reading_ease"] = None
            traits["fk_grade"] = None

        func_count = sum(1 for w in tokens if w.lower() in FUNCTION_WORDS)
        traits["function_word_ratio"] = func_count / max(1, word_count)
        if lexicon:
            try:
                e_cats = lexicon.analyze(user_input, normalize=True) or {}
                traits.update({
                    "empath_social": e_cats.get("social", 0.0),
                    "empath_cognitive": e_cats.get("cognitive_processes", 0.0),
                    "empath_affect": e_cats.get("affect", 0.0)
                })
            except Exception as e:
                print(f"WARNING: Empath analysis failed: {e}")
                traits.update({"empath_social": None, "empath_cognitive": None, "empath_affect": None})
        else:
             traits.update({"empath_social": None, "empath_cognitive": None, "empath_affect": None})


        counts = {}
        lower_tokens = [t.lower() for t in tokens]
        for cat, ws in LSM_CATEGORIES.items():
            c = sum(1 for t in lower_tokens if t in ws)
            counts[cat] = c
        traits["lsm_counts"] = counts

        traits["pronouns"] = {
            "i": bool(re.search(r"\bi\b", lower_input)),
            "you": bool(re.search(r"\byou\b", lower_input)),
            "we": bool(re.search(r"\bwe\b", lower_input))
        }

    except Exception as e:
        print(f"ERROR during detect_style_traits: {e}")
        return {"error": str(e), "word_count": 0}

    return traits

def generate_dynamic_prompt(template: str, style_profile: dict, locked_tone: str = None) -> str:
    persona = DEFAULT_BOT_NAME
    instructions = []
    pronoun_profile = style_profile.get("pronouns", {})
    if pronoun_profile.get("i") and not pronoun_profile.get("you") and len(instructions) < 3: # Check instruction count to avoid overload
        instructions.append("The user is focusing on their own experiences. It's okay to use 'I' thoughtfully in your response if it fits.")
    elif pronoun_profile.get("you") and not pronoun_profile.get("i") and len(instructions) < 3:
        instructions.append("The user is addressing you directly or asking about your 'thoughts'. Respond naturally using 'you' as appropriate.")
    elif pronoun_profile.get("we") and len(instructions) < 3:
        instructions.append("The user included 'we'. If the context allows, using 'we' can build a sense of connection.")
    try:
        if style_profile.get("informal_score", 0) > 0.3:
            instructions.append("Use a slightly casual and relaxed tone, while keeping it warm and welcoming.")
        else:
            tone = locked_tone or random.choice(TONE_VARIATIONS)
            instructions.append(f"Use a polite and clear tone, {tone}.")
        uncertainty = (style_profile.get("hedging_score", 0) * 0.4) + (style_profile.get("questioning", 0) * 0.4) + (style_profile.get("informal_score", 0) * 0.2)
        if uncertainty > UNCERTAINTY_THRESHOLD:
            instructions.append("Sound a little more reassuring and offer gentle encouragement when responding.")
        if style_profile.get("meta_request") == "shorter":
            instructions.append("Keep responses short and concise.")
        elif style_profile.get("meta_request") == "longer":
            instructions.append("Provide slightly more detailed and expanded responses.")
        elif style_profile.get("meta_request") == "simpler":
            instructions.append("Use simple, easy-to-understand language.")
        if style_profile.get("question_count", 0) >= 2 and style_profile.get("word_count", 100) > 10 and len(instructions) < 3: # Avoid if user is just asking short questions
            instructions.append("The user is quite inquisitive. If it feels natural, consider asking a gentle question back to keep the conversation flowing.")

        if style_profile.get("exclamatory") and style_profile.get("exclamation_count", 0) >= 1 and len(instructions) < 3:
            instructions.append("The user seems to be using exclamations. You can mirror this energy with an exclamation if it genuinely matches the sentiment of your response, but use it sparingly.")
        sentiment = style_profile.get("sentiment_compound", 0)
        if sentiment > 0.5:
            instructions.append("Reflect the user's cheerful mood with slightly more upbeat and lively wording.")
        elif sentiment < -0.5:
            instructions.append("Respond with a softer, more gentle tone to match a somber mood.")

    except Exception as e:
        print(f"ERROR generating dynamic prompt instructions: {e}")

    full_instruction = template.replace("{persona}", persona)
    if instructions:
        full_instruction += "\n\nStyle Adaptation Instructions:\n- " + "\n- ".join(instructions)

    return full_instruction

# --- Logging Function ---
def log_event(event_data: dict, session_info: dict):
    """
    Logs an event to the session-specific JSON Lines file,
    automatically including common session context.
    """
    log_file = session_info.get("log_file_path")
    if not log_file:
        print(f"Warning: No log file path provided in session_info. Cannot log event: {event_data.get('event_type', 'Unknown Event')}")
        # Potentially create a default log file path here if absolutely necessary
        # e.g., log_file = os.path.join(LOG_DIR, "unspecified_session_events.jsonl")
        # However, it's better if session_info always tries to provide one, even for fallbacks.
        return

    # Ensure the directory for the log file exists
    log_dir = os.path.dirname(log_file)
    if log_dir: # Check if dirname returned a non-empty string (it should unless log_file is just a filename)
        os.makedirs(log_dir, exist_ok=True)
    else: # If log_file is just a filename, assume current directory or LOG_DIR
        os.makedirs(LOG_DIR, exist_ok=True)


    # Construct the full event data, prioritizing specific event_data over general session_info for overlapping keys,
    # but ensuring all standard context fields from session_info are present if not in event_data.
    full_event_data = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "participant_id": session_info.get("participantId"),
        "session_id": session_info.get("sessionId"),
        "condition_raw": session_info.get("condition"), 
        "condition_name_from_frontend": session_info.get("condition_name_from_frontend"), 
        "condition_iv_avatar_type": session_info.get("condition_iv_avatar_type"),
        "condition_iv_lsm_type": session_info.get("condition_iv_lsm_type"),
        "avatar_url": session_info.get("avatar_url"),
        "avatar_prompt": session_info.get("avatar_prompt"),   # NEWLY ADDED
        "turn_number": session_info.get("turn_number"),
        # Spread event_data last to allow it to override any of the above if needed,
        # though typically it contains event-specific keys.
        **event_data, 
    }
    
    # Filter out None values from the final log entry for cleaner logs, if desired
    # full_event_data_cleaned = {k: v for k, v in full_event_data.items() if v is not None}


    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            log_line = json.dumps(full_event_data, ensure_ascii=False) # Use full_event_data or full_event_data_cleaned
            f.write(log_line + '\n')
    except TypeError as te:
         print(f"ERROR: TypeError serializing log data to JSON for event {event_data.get('event_type', 'Unknown Event')}. Data: {full_event_data}. Error: {te}")
    except Exception as e:
        print(f"Error writing to log file {log_file} for event {event_data.get('event_type', 'Unknown Event')}: {e}")