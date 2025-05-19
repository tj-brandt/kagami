# backend/formality_model_setup.py
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os

print("--- formality_model_setup.py starting ---")

FORMALITY_TOKENIZER = None
FORMALITY_MODEL = None
MODEL_NAME = "s-nlp/roberta-base-formality-ranker" # Specified model

# Determine device (use GPU if available, otherwise CPU)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"INFO (formality_model_setup.py): Using device: {DEVICE}")

try:
    print(f"INFO (formality_model_setup.py): Loading tokenizer for '{MODEL_NAME}'...")
    FORMALITY_TOKENIZER = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    print(f"INFO (formality_model_setup.py): Loading model '{MODEL_NAME}'...")
    FORMALITY_MODEL = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    
    FORMALITY_MODEL.to(DEVICE) # Move model to the determined device
    FORMALITY_MODEL.eval()     # Set model to evaluation mode (important for inference)
    
    print(f"INFO (formality_model_setup.py): Formality model '{MODEL_NAME}' loaded successfully to {DEVICE} and set to eval mode.")

except OSError as e:
    print(f"ERROR (formality_model_setup.py): Model or Tokenizer for '{MODEL_NAME}' not found or failed to load. Error: {e}")
    print(f"Ensure you have an internet connection, and the model name is correct on Hugging Face Hub.")
except Exception as e:
    print(f"ERROR (formality_model_setup.py): An unexpected error occurred while loading the formality model: {e}")

print("--- formality_model_setup.py finished ---")

def get_formality_model_components():
    """
    Returns the loaded formality model and tokenizer.
    """
    return FORMALITY_MODEL, FORMALITY_TOKENIZER

def get_formality_device():
    """
    Returns the device (CPU/GPU) the model is on.
    """
    return DEVICE