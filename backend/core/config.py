# backend/core/config.py
import re
from typing import Set
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    GOOGLE_DRIVE_FOLDER_ID: str

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8')

settings = Settings()


# --- Application Constants (these are not environment-specific) ---
DEFAULT_BOT_NAME: str = "Kagami"
LOG_DIR: str = "experiment_logs"
SESSION_STATE_DIR: str = "session_state"

# --- OpenAI Model Settings ---
TEMPERATURE: float = 0.7
MAX_TOKENS: int = 512
OPENAI_MODEL_NAME: str = "gpt-4.1-nano"

# --- LSM & Style Adaptation Settings ---
LSM_SMOOTHING_ALPHA: float = 0.25
MIN_LSM_TOKENS_FOR_SMOOTHING: int = 15
MIN_LSM_TOKENS_FOR_LSM_CALC: int = 5
UNCERTAINTY_THRESHOLD: float = 0.5
HEDGING_THRESHOLD: float = 0.3
MODEL_INFORMALITY_THRESHOLD: float = 0.3

# --- Regex & Word Sets for NLP Analysis ---
INFORMAL_RE: re.Pattern = re.compile(r"\b(lol|lmao|...)\b|([!?]{2,})", re.I) # Keep your full regex
HEDGING_RE: re.Pattern = re.compile(r"\b(maybe|probably|...)\b", re.I) # Keep your full regex
QUESTION_RE: re.Pattern = re.compile(r"\b(who|what|...)\b.*", re.I) # Keep your full regex
VALID_TOKEN_TEXT_PATTERN: re.Pattern = re.compile(r"^[a-z0-9]+$|^n't$", re.IGNORECASE)

FUNCTION_WORDS: Set[str] = {
    "i","you","we","he","she","they","me","him","her","us","them", "a","an","the", "in","on","at","by",
    "for","with","about","against","between","into","through","during","before","after","above","below",
    "to","from","up","down","over","under", "am","is","are","was","were","be","being","been","have",
    "has","had","having","do","does","did","will","would","shall","should","may","might","must","can",
    "could", "and","but","or","so","yet","for","nor","while","whereas","although","though","because",
    "since","if","unless","until","when","as","that","whether", "no","not","never","none","n't"
}

LSM_CATEGORIES_SPACY: dict = {
    "pronouns": {"type": "pos", "tags": {"PRON"}},
    "articles": {"type": "pos", "tags": {"DET"}},
    "prepositions_conjunctions": {"type": "pos", "tags": {"ADP", "SCONJ", "CCONJ"}},
    "aux_verbs": {"type": "pos", "tags": {"AUX"}},
    "negations": { "type": "lemma_and_dep", "lemmas": {"not"}, "dep_neg_tag": "neg" },
}