# backend/drive_upload.py
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

LOCAL_SERVICE_ACCOUNT_PATH = 'service_account.json'
RENDER_SECRET_PATH = '/etc/secrets/service_account.json'

SERVICE_ACCOUNT_FILE = (
    RENDER_SECRET_PATH 
    if os.path.exists(RENDER_SECRET_PATH) 
    else LOCAL_SERVICE_ACCOUNT_PATH
)

SCOPES = ['https://www.googleapis.com/auth/drive']

def authenticate_drive():
    """Authenticate with Google Drive using a service account."""
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(
            f"Service account file not found. Checked: {RENDER_SECRET_PATH} and {LOCAL_SERVICE_ACCOUNT_PATH}"
        )
    
    print(f"INFO (drive_upload): Authenticating with service account file at: {SERVICE_ACCOUNT_FILE}")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build('drive', 'v3', credentials=credentials)

def upload_log_to_drive(log_filepath: str, session_id: str, drive_folder_id: str):
    if not drive_folder_id:
        print(f"ERROR (drive_upload): GOOGLE_DRIVE_FOLDER_ID was not provided for session {session_id}.")
        return

    if not os.path.exists(log_filepath):
        print(f"ERROR (drive_upload): Log file not found at {log_filepath} for session {session_id}.")
        return
    
    try:
        drive = authenticate_drive()
        filename = os.path.basename(log_filepath)
        file_metadata = {
            'name': filename,
            'mimeType': 'application/jsonl', 
            'parents': [drive_folder_id]
        }
        media = MediaFileUpload(log_filepath, mimetype='application/jsonl', resumable=True)
        uploaded = drive.files().create(body=file_metadata, media_body=media, fields='id').execute()
        print(f"✅ (drive_upload): Successfully uploaded log {filename} (ID: {uploaded.get('id')}) for session {session_id}.")
    except Exception as e:
        print(f"--- ❌ CRITICAL ERROR IN drive_upload ---")
        print(f"Session ID: {session_id}")
        print(f"Log Filepath: {log_filepath}")
        import traceback
        traceback.print_exc()
        print(f"-----------------------------------------")