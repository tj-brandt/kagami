# /Shopping/backend/download_nltk_data.py
import nltk
import os
import sys

# Define a path relative to the script for downloads
# This is a common practice to keep data local to the project/backend
NLTK_DATA_PATH = os.path.join(os.path.dirname(__file__), "nltk_data")
os.makedirs(NLTK_DATA_PATH, exist_ok=True)
nltk.data.path.append(NLTK_DATA_PATH)

print(f"Attempting to download NLTK data to: {NLTK_DATA_PATH}")

# Download 'punkt' tokenizer
try:
    nltk.data.find('tokenizers/punkt')
    print("NLTK 'punkt' tokenizer already found.")
except LookupError:
    print("Downloading NLTK 'punkt' tokenizer...")
    try:
        nltk.download('punkt', download_dir=NLTK_DATA_PATH)
        print("NLTK 'punkt' downloaded successfully.")
    except Exception as e:
        print(f"Error downloading 'punkt': {e}")
        print("Please check your internet connection or try running the download with administrator privileges.")
        # You might want to exit here if download fails
        # sys.exit(1)


# Download 'vader_lexicon'
try:
    nltk.data.find('sentiment/vader_lexicon.zip/vader_lexicon/')
    print("NLTK 'vader_lexicon' already found.")
except LookupError:
    print("Downloading NLTK 'vader_lexicon'...")
    try:
        nltk.download('vader_lexicon', download_dir=NLTK_DATA_PATH)
        print("NLTK 'vader_lexicon' downloaded successfully.")
    except Exception as e:
        print(f"Error downloading 'vader_lexicon': {e}")
        print("Please check your internet connection or try running the download with administrator privileges.")
        # You might want to exit here if download fails
        # sys.exit(1)

print("\nNLTK data check/download process finished.")
print("Ensure no critical errors occurred above.")
print("You can now try starting the backend server.")