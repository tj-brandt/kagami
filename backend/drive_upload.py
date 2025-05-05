# drive_upload.py
import os
import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the token.json file.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def authenticate_drive():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)

def upload_log_to_drive(log_data: dict, session_id: str):
    drive_service = authenticate_drive()
    
    filename = f"{session_id}_log.json"
    filepath = os.path.join("logs", filename)
    os.makedirs("logs", exist_ok=True)
    
    with open(filepath, "w") as f:
        json.dump(log_data, f, indent=2)

    file_metadata = {
        'name': filename,
        'mimeType': 'application/json'
    }
    media = MediaFileUpload(filepath, mimetype='application/json')
    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()
    print(f"Uploaded to Google Drive with file ID: {file.get('id')}")
