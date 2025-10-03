# backend/download_models.py
import nltk
import spacy
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sentence_transformers import SentenceTransformer
import os 

def main():
    print("--- Starting Model Download Process ---")

    # Define the target directory for NLTK data
    nltk_data_dir = "/home/appuser/nltk_data"
    os.makedirs(nltk_data_dir, exist_ok=True)

    # 1. NLTK Data (VADER)
    print(f"\n[1/4] Downloading NLTK's VADER lexicon to '{nltk_data_dir}'...")
    # Tell NLTK to download to our specific directory
    nltk.download("vader_lexicon", download_dir=nltk_data_dir)
    print("✅ VADER lexicon downloaded.")

    # 2. spaCy Model
    model_name = "en_core_web_sm"
    print(f"\n[2/4] Downloading compatible spaCy model: '{model_name}'...")
    spacy.cli.download(model_name)
    print(f"✅ spaCy model '{model_name}' downloaded.")

    # 3. Hugging Face Formality Model
    hf_model_name = "s-nlp/mdistilbert-base-formality-ranker"
    print(f"\n[3/4] Downloading Hugging Face model: '{hf_model_name}'...")
    AutoTokenizer.from_pretrained(hf_model_name)
    AutoModelForSequenceClassification.from_pretrained(hf_model_name)
    print(f"✅ Hugging Face model '{hf_model_name}' downloaded.")

    # 4. Hugging Face Style Embedding Model
    style_model_name = "StyleDistance/styledistance"
    print(f"\n[4/4] Downloading Style Embedding model: '{style_model_name}'...")
    try:
        SentenceTransformer(style_model_name)
        print(f"✅ Style Embedding model '{style_model_name}' downloaded successfully.")
    except Exception as e:
        print(f"🔥 Failed to download Style Embedding model: {e}")

    print("\n--- Model Download Process Finished ---")

if __name__ == "__main__":
    main()