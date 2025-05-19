# backend/nltk_setup.py
import nltk
from pathlib import Path

NLTK_DATA_PROJECT_PATH = Path(__file__).resolve().parent / "nltk_data"
NLTK_DATA_PROJECT_PATH.mkdir(exist_ok=True)

def configure_nltk_path():
    str_path = str(NLTK_DATA_PROJECT_PATH)
    if str_path not in nltk.data.path:
        nltk.data.path.insert(0, str_path)