import os
import re
import json
import emoji
import google.generativeai as genai
import nltk
import textstat
from datetime import datetime, timezone
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from empath import Empath
from nltk.tokenize import word_tokenize

# --- Constants ---
AVATAR_IMAGE_PATH = "franko.png"
DEFAULT_BOT_NAME = "SoraSync"
NO_AVATAR_BOT_NAME = "ShopBot"
GEMINI_MODEL_NAME = "gemini-2.0-flash-thinking-exp-01-21"
SESSION_TIMEOUT_SECONDS = 600
LOG_DIR = "experiment_logs"
MIN_LSM_TOKENS = 15
LSM_SMOOTHING_ALPHA = 0.4

# --- Regex Patterns & Function Word Sets ---
INFORMAL_RE = re.compile(
    r"\b(sup|bruh|yo|dude|frank[iy]+|lol|lmao|deadass|ain't|gonna|wanna|gotta|"
    r"kinda|sorta|lemme|dunno|ya|nah|tho|fr|btw|imo|idk|omg|ur|u|yea+h*|funn+y+|ben|"
    r"smh|tbh|omfg|wtf|idc|fyi|jk|rn|lmk|gr[38]t|l8r|b4|sk8|h8)\b|"
    r"\b(ha){2,}\b|\b(he){2,}\b|\b(hi){2,}\b|"
    r"\b\w*([aeiou])\1{2,}\w*\b|"
    r"[!?\.]{2,}(\s|$)|"
    r":\-?p\b|:\-?3\b|;\-?p\b|:\-?d\b|<3|:'\((?!\w)|¯\\_\(ツ\)_/¯",
    re.IGNORECASE | re.UNICODE
)
HEDGING_RE = re.compile(
    r"\b(maybe|not sure|kinda|sort of|might|possibly|perhaps|seems|appears|suggests|i think|i guess|idk)\b",
    re.IGNORECASE
)
AUX_VERBS = {"am","is","are","was","were","be","being","been",
             "have","has","had","having",
             "do","does","did",
             "will","would","shall","should","may","might","must","can","could"}
CONJUNCTIONS = {"and","but","or","so","yet","for","nor",           
                "while","whereas","although","though","because","since","if","unless","until","when","as","that","whether","after","before"}
NEGATIONS = {"no","not","never","none","nobody","nothing","nowhere","neither","nor","ain't","don't","isn't","wasn't","weren't","haven't","hasn't","hadn't","didn't","won't","wouldn't","shan't","shouldn't","mightn't","mustn't","can't","couldn't"}
FUNCTION_WORDS = {
    "i","you","we","he","she","they","me","him","her","us","them",
    "a","an","the",
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
# Ensure punkt and vader_lexicon are downloaded prior to starting the backend.
sia = SentimentIntensityAnalyzer()
lexicon = Empath()

# --- Helper Functions ---
def tokenize_text(text: str) -> list[str]:
    try:
        tokens = word_tokenize(text.lower())
        return [t for t in tokens if valid_token_pattern.match(t)]
    except Exception:
        return re.findall(r"\w+|n't", text.lower())


def get_category_fraction(text: str, word_set: set) -> float:
    tokens = tokenize_text(text)
    if not tokens:
        return 0.0
    count = sum(1 for t in tokens if t in word_set)
    return count / len(tokens)


def compute_lsm_score(user_text: str, bot_text: str) -> float:
    scores = []
    for cat_words in LSM_CATEGORIES.values():
        fu = get_category_fraction(user_text, cat_words)
        fb = get_category_fraction(bot_text,  cat_words)
        denom = fu + fb
        if denom > 1e-6:
            scores.append(1 - abs(fu - fb) / denom)
        elif abs(fu - fb) < 1e-6:
            scores.append(1.0)
        else:
            scores.append(0.0)
    return sum(scores) / len(scores) if scores else 1.0


def post_process_response(resp: str, is_adaptive: bool) -> str:
    if not is_adaptive:
        resp = emoji.replace_emoji(resp, replace="")
        resp = re.sub(INFORMAL_RE, "", resp)
    resp = re.sub(r'\s{2,}', ' ', resp).strip()
    resp = re.sub(r"([^\n])(\n?)(\s*[\*-]\s+)", r"\1\n\3", resp)
    resp = re.sub(r"^(\s*[\*-]\s+)", r"\n\1", resp)
    resp = re.sub(r'\s{2,}', ' ', resp).strip()
    resp = re.sub(r'\n{3,}', '\n\n', resp)
    return resp


def detect_style_traits(user_input: str) -> dict:
    lower_input = user_input.lower()
    tokens = tokenize_text(user_input)
    word_count = len(tokens)
    is_informal = bool(INFORMAL_RE.search(user_input))
    traits = {
        "word_count": word_count,
        "emoji": emoji.emoji_count(user_input) > 0,
        "informal": is_informal,
        "hedging": bool(HEDGING_RE.search(lower_input)),
        "questioning": user_input.strip().endswith("?"),
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
        "avg_sentence_length": word_count / sen_count,
        "avg_word_length": sum(len(w) for w in tokens) / max(1, word_count)
    })
    try:
        traits["flesch_reading_ease"] = textstat.flesch_reading_ease(user_input)
        traits["fk_grade"] = textstat.flesch_kincaid_grade(user_input)
    except Exception:
        traits["flesch_reading_ease"] = -1
        traits["fk_grade"] = -1
    func_count = sum(1 for w in tokens if w in FUNCTION_WORDS)
    traits["function_word_ratio"] = func_count / max(1, word_count)
    try:
        e_cats = lexicon.analyze(user_input, normalize=True) or {}
    except Exception:
        e_cats = {}
    traits.update({
        "empath_social": e_cats.get("social", 0.0),
        "empath_cognitive": e_cats.get("cognitive_processes", 0.0),
        "empath_affect": e_cats.get("affect", 0.0)
    })
    counts = {}
    for cat, ws in LSM_CATEGORIES.items():
        c = sum(1 for t in tokenize_text(lower_input) if t in ws or (t=="n't" and any(w.endswith("n't") for w in ws)))
        counts[cat] = c
    traits["lsm_counts"] = counts
    traits["pronouns"] = {
        "i": bool(re.search(r"\bi\b", lower_input)),
        "you": bool(re.search(r"\byou\b", lower_input)),
        "we": bool(re.search(r"\bwe\b", lower_input))
    }
    return traits

def generate_dynamic_prompt(template: str,
                            style_profile: dict,
                            show_avatar: bool) -> str:
    """
    Minimal stub so you don’t get a NameError.
    Just injects the persona name into your template.
    """
    persona = DEFAULT_BOT_NAME if show_avatar else NO_AVATAR_BOT_NAME
    return template.replace("{persona}", persona)

async def get_gemini_response(user_prompt: str,
                              chat_history: list[dict],
                              is_adaptive: bool,
                              show_avatar: bool,
                              style_profile: dict = None) -> tuple[str, str]:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable not set.")
        return "Sorry, the assistant is not configured correctly (API key missing).", ""
    genai.configure(api_key=api_key)
    base_static_template = (
        "You are {persona}, a friendly AI shopping assistant focused on helping users find products. "
        "Maintain a consistent, clear, and helpful style. Do NOT adapt your style to the user's language, tone, or format. "
        "Avoid slang and emojis. Keep responses relevant to shopping. Strictly avoid medical, financial, or legal advice. "
        "If asked for non-shopping advice, politely redirect or state limitations. Do not preface your response with reasoning steps."
    )
    base_adaptive_template = (
        "You are {persona}, a friendly AI shopping assistant focused on helping users find products. "
        "Adapt your communication style based on the user's last message, following the specific 'Style Adaptation Instructions' provided. "
        "Keep responses relevant to shopping. Strictly avoid medical, financial, or legal advice. "
        "If asked for non-shopping advice, politely redirect or state limitations. Do not preface your response with reasoning steps."
    )
    persona_name = DEFAULT_BOT_NAME if show_avatar else NO_AVATAR_BOT_NAME
    if is_adaptive and style_profile is not None:
        system_instruction = generate_dynamic_prompt(base_adaptive_template, style_profile, show_avatar)
    else:
        system_instruction = base_static_template.replace("{persona}", persona_name)
    messages = []
    for m in chat_history:
        if m.get("role") and m.get("content") is not None:
            role = "model" if m["role"] == "assistant" else "user"
            messages.append({"role": role, "parts": [{"text": m["content"]}]})
    messages.append({"role": "user", "parts": [{"text": user_prompt}]})
    raw_response_text = "Sorry, I couldn't get a response from the assistant."
    try:
        model = genai.GenerativeModel(GEMINI_MODEL_NAME, system_instruction=system_instruction)
        cfg = genai.types.GenerationConfig(temperature=0.7, max_output_tokens=512)
        safety_settings = {}
        resp = model.generate_content(
            messages,
            generation_config=cfg,
            safety_settings=safety_settings
        )
        if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
            raw_response_text = resp.candidates[0].content.parts[0].text
        else:
            finish_reason = resp.candidates[0].finish_reason if resp.candidates else "N/A"
            block_reason = resp.prompt_feedback.block_reason if resp.prompt_feedback else "N/A"
            raw_response_text = f"[Blocked or No Content - Finish: {finish_reason}, Block: {block_reason}]"
            print(f"Gemini generation failed/blocked. Reason: {raw_response_text}")
    except Exception as e:
        print(f"Gemini API Call Exception: {e}")
    return raw_response_text, system_instruction


def log_event(event_data: dict, session_info: dict):
    log_file = session_info.get("log_file_path")
    if not log_file:
        print("Warning: No log file path provided.")
        return
    event_data["timestamp_utc"] = datetime.now(timezone.utc).isoformat()
    event_data["participant_id"] = session_info.get("participantId")
    event_data["session_id"] = session_info.get("sessionId")
    event_data["condition"] = session_info.get("condition")
    event_data["turn_number"] = session_info.get("turn_number")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, 'a', encoding='utf-8') as f:
        json.dump(event_data, f, ensure_ascii=False)
        f.write('\n')
