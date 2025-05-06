# drive_upload.py
import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SERVICE_ACCOUNT_FILE = 'service_account.json'
# broadened scope so you can also modify existing files, if needed
SCOPES = ['https://www.googleapis.com/auth/drive']

# Placeholder (will be overridden by env var if set)
DEFAULT_FOLDER_ID_PLACEHOLDER = ""

def authenticate_drive():
    """Authenticate with Google Drive using a service account."""
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(f"Service account file not found at {SERVICE_ACCOUNT_FILE}")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build('drive', 'v3', credentials=credentials)

def upload_log_to_drive(log_filepath: str, session_id: str):
    DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID") or DEFAULT_FOLDER_ID_PLACEHOLDER
    if not DRIVE_FOLDER_ID:
        raise RuntimeError("Invalid Google Drive folder ID…")

    # 2) Fail fast if log file missing
    if not os.path.exists(log_filepath):
        raise FileNotFoundError(f"Log file not found at {log_filepath}")

    # 3) Perform the upload
    drive = authenticate_drive()
    filename = os.path.basename(log_filepath)
    file_metadata = {
        'name': filename,
        'mimeType': 'application/json',   # use plain JSON for better compatibility
        'parents': [DRIVE_FOLDER_ID]
    }
    media = MediaFileUpload(log_filepath, mimetype='application/json', resumable=True)
    uploaded = drive.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"✅ Uploaded log {filename} (ID: {uploaded.get('id')})")