#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Running custom build.sh script ---"

# 1. Install Python dependencies
echo "Installing Python dependencies from requirements.txt..."
pip install -r requirements.txt

# 2. Pre-download Hugging Face Transformer model files
# This populates the Hugging Face cache in the build environment.
echo "Pre-downloading Hugging Face transformer model: s-nlp/roberta-base-formality-ranker..."
python -c "
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

# Set HF_HOME to a writable directory if default is not available or persistent in build env
# This might not be strictly necessary for Render's default build, but good practice
# os.environ['HF_HOME'] = './.huggingface_cache' 
# os.makedirs(os.environ['HF_HOME'], exist_ok=True)

model_name = 's-nlp/roberta-base-formality-ranker'
print(f'Attempting to download {model_name} tokenizer...')
_ = AutoTokenizer.from_pretrained(model_name)
print(f'Attempting to download {model_name} model...')
_ = AutoModelForSequenceClassification.from_pretrained(model_name)
print('Hugging Face model pre-download complete.')
"

echo "--- build.sh script finished ---"