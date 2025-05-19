# backend/nltk_bootstrap.py
import nltk
from pathlib import Path
import os
import sys
import zipfile

NLTK_DATA_DIR = (Path(__file__).resolve().parent / "nltk_data")

print(f"--- nltk_bootstrap.py starting (for NLTK components like VADER) ---")
print(f"INFO (nltk_bootstrap.py): Target NLTK data directory: {NLTK_DATA_DIR}")

NLTK_DATA_DIR.mkdir(exist_ok=True)
print(f"INFO (nltk_bootstrap.py): NLTK_DATA_DIR exists: {NLTK_DATA_DIR.exists()}")

str_nltk_data_dir = str(NLTK_DATA_DIR)
if str_nltk_data_dir not in nltk.data.path:
    nltk.data.path.insert(0, str_nltk_data_dir)
    print(f"INFO (nltk_bootstrap.py): Prepended '{str_nltk_data_dir}' to nltk.data.path.")
else:
    if nltk.data.path[0] != str_nltk_data_dir:
        nltk.data.path.remove(str_nltk_data_dir)
        nltk.data.path.insert(0, str_nltk_data_dir)
        print(f"INFO (nltk_bootstrap.py): Moved '{str_nltk_data_dir}' to the front of nltk.data.path.")

print(f"INFO (nltk_bootstrap.py): Current nltk.data.path: {nltk.data.path}")

# Only ensure vader_lexicon for SentimentIntensityAnalyzer
resources_to_ensure = {
    "vader_lexicon": {
        "id": "vader_lexicon",
        "check_file": "sentiment/vader_lexicon.zip", # VADER is often used as a zip
        "zip_name_in_category": "sentiment/vader_lexicon.zip" # Relative to NLTK_DATA_DIR
    }
    # Add other NLTK resources here if you use them (e.g., 'wordnet' for NLTK lemmatizer)
}

for name, details in resources_to_ensure.items():
    print(f"--- Checking NLTK resource: {name} ---")
    resource_found = False
    try:
        found_path = nltk.data.find(details["check_file"])
        print(f"INFO (nltk_bootstrap.py): NLTK can find '{details['check_file']}' at: {found_path}.")
        resource_found = True
    except LookupError:
        print(f"WARNING (nltk_bootstrap.py): NLTK could NOT find '{details['check_file']}'.")
        print(f"INFO (nltk_bootstrap.py): Attempting to download '{details['id']}' to '{str_nltk_data_dir}'...")
        try:
            nltk.download(details["id"], download_dir=str_nltk_data_dir, quiet=False)
            print(f"INFO (nltk_bootstrap.py): Download call for '{details['id']}' completed.")
            try:
                found_path = nltk.data.find(details["check_file"])
                print(f"INFO (nltk_bootstrap.py): After download, NLTK can find '{details['check_file']}' at: {found_path}.")
                resource_found = True
            except LookupError:
                print(f"ERROR (nltk_bootstrap.py): After download, NLTK STILL cannot find '{details['check_file']}'.")
        except Exception as e_download:
            print(f"ERROR (nltk_bootstrap.py): nltk.download for '{details['id']}' failed: {e_download}")

    if not resource_found:
        print(f"CRITICAL (nltk_bootstrap.py): NLTK Resource '{name}' ({details['check_file']}) could not be ensured.")
    else:
        print(f"SUCCESS (nltk_bootstrap.py): NLTK Resource '{name}' ({details['check_file']}) is available.")

print(f"--- nltk_bootstrap.py finished ---")