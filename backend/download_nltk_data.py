# backend/download_nltk_data.py
import nltk
from pathlib import Path
import os # For os.path.join if used, though Path is better
import zipfile # For potential manual unzipping if ever needed for a resource

SCRIPT_DIR = Path(__file__).resolve().parent
NLTK_DATA_DIR_NAME = "nltk_data"
PROJECT_NLTK_DATA_PATH = SCRIPT_DIR / NLTK_DATA_DIR_NAME

# Define resources needed by NLTK components you are still using (e.g., VADER)
RESOURCES_TO_DOWNLOAD = {
    "vader_lexicon": {
        "id": "vader_lexicon", # ID used by nltk.download()
        "check_path": "sentiment/vader_lexicon.zip", # Path NLTK uses for find()
        "zip_name": "vader_lexicon.zip" # Actual name of the zip file in its category folder
        }
}

def ensure_project_nltk_data_path_configured():
    print(f"INFO (download_nltk_data): Ensuring project NLTK data directory exists: {PROJECT_NLTK_DATA_PATH}")
    PROJECT_NLTK_DATA_PATH.mkdir(exist_ok=True)
    
    str_project_path = str(PROJECT_NLTK_DATA_PATH)
    if str_project_path not in nltk.data.path:
        nltk.data.path.insert(0, str_project_path)
        print(f"INFO (download_nltk_data): Prepended '{str_project_path}' to nltk.data.path.")
    print(f"INFO (download_nltk_data): Current NLTK search paths: {nltk.data.path}")

def check_resource_present(resource_id: str, details: dict) -> bool:
    """Checks if NLTK can find the resource, prioritizing the project path."""
    try:
        # Check if the primary file/folder NLTK looks for exists
        nltk.data.find(details["check_path"], paths=[str(PROJECT_NLTK_DATA_PATH)])
        print(f"✅ NLTK can find '{details['check_path']}' in project path: {PROJECT_NLTK_DATA_PATH / details['check_path']}")
        return True
    except LookupError:
        # If not found directly, also check if the zip file itself exists,
        # as sometimes nltk.data.find() needs the unzipped version for certain checks.
        category = details["check_path"].split('/')[0]
        expected_zip_file = PROJECT_NLTK_DATA_PATH / category / details["zip_name"]
        if expected_zip_file.is_file():
            print(f"⚠️ Found ZIP '{expected_zip_file}', but NLTK couldn't load '{details['check_path']}'. May need unzipping or is for a different structure.")
            # For VADER, the zip is usually what's loaded directly by SentimentIntensityAnalyzer.
            # If this path is hit for VADER, it might mean the zip is there but SIA can't use it.
            # However, nltk.download usually handles this.
            return False # Treat as not fully available if find fails.
        print(f"INFO (download_nltk_data): Resource '{details['check_path']}' not found in project path.")
        return False

def download_resource(resource_id: str, details: dict):
    print(f"⬇️ Attempting to download '{resource_id}' to: {PROJECT_NLTK_DATA_PATH}")
    try:
        nltk.download(resource_id, download_dir=str(PROJECT_NLTK_DATA_PATH), quiet=False)
        # Verify after download
        nltk.data.find(details["check_path"], paths=[str(PROJECT_NLTK_DATA_PATH)]) # Re-check
        print(f"✅ '{resource_id}' downloaded and verified successfully in '{PROJECT_NLTK_DATA_PATH}'.")
        return True
    except LookupError:
        print(f"⛔ ERROR: NLTK could not find '{details['check_path']}' from project path even after download of '{resource_id}'.")
        # Specific check for unzipping if it's a known issue for a particular resource (less likely for VADER)
        category = details["check_path"].split('/')[0]
        zip_file_path = PROJECT_NLTK_DATA_PATH / category / details["zip_name"]
        if zip_file_path.is_file() and details.get("needs_unzip", False): # Add 'needs_unzip': True to resource dict if required
             print(f"Attempting to unzip {zip_file_path}...")
             try:
                 with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
                     extract_path = PROJECT_NLTK_DATA_PATH / category
                     zip_ref.extractall(extract_path)
                 print(f"Unzipped '{zip_file_path}' to '{extract_path}'. Please verify.")
                 # Try finding again
                 nltk.data.find(details["check_path"], paths=[str(PROJECT_NLTK_DATA_PATH)])
                 print(f"✅ '{resource_id}' found after manual unzip.")
                 return True
             except Exception as e_unzip:
                 print(f"⛔ ERROR unzipping {zip_file_path}: {e_unzip}")
                 return False
        return False
    except Exception as e:
        print(f"⛔ ERROR downloading '{resource_id}': {e}")
        return False

def main():
    print("--- Starting NLTK Data Download/Verification (Project-Specific) ---")
    ensure_project_nltk_data_path_configured()
    
    all_successful = True
    for name, details in RESOURCES_TO_DOWNLOAD.items():
        print(f"\n--- Processing NLTK resource: {name} ---")
        if not check_resource_present(name, details):
            if not download_resource(name, details):
                all_successful = False
        else:
            print(f"INFO: Resource '{name}' already available. Skipping download.")
            
    if all_successful:
        print("\n--- NLTK Data Download/Verification Finished Successfully ---")
    else:
        print("\n--- NLTK Data Download/Verification Finished with Errors ---")
        print("   Please address the errors above. Some NLTK-dependent features might not function correctly.")

if __name__ == "__main__":
    main()