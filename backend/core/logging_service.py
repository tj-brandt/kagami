# backend/core/logging_service.py
import os
import json
from datetime import datetime, timezone
from pathlib import Path
from . import config

def log_event(event_data: dict, session_info: dict):
    log_file_path = session_info.get("log_file_path")
    if not log_file_path:
        pid = session_info.get("participantId", "unknown")
        sid = session_info.get("sessionId", "unknown")
        log_file_path = Path(config.LOG_DIR) / f"participant_{pid}_{sid}_fallback.jsonl"
        print(f"WARNING: Log file path missing. Using fallback: {log_file_path}")

    Path(log_file_path).parent.mkdir(exist_ok=True)
    
    full_event_data = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "participant_id": session_info.get("participantId"),
        "session_id": session_info.get("sessionId"),
        "turn_number": session_info.get("turn_number"),
        **session_info.get("condition", {}), # Unpack condition details
        **event_data,
    }
    
    try:
        with open(log_file_path, 'a', encoding='utf-8') as f:
            # Use model_dump for Pydantic models if they exist in the data
            f.write(json.dumps(full_event_data, default=lambda o: o.model_dump() if hasattr(o, 'model_dump') else str(o)) + '\n')
    except Exception as e:
        print(f"ERROR: Failed to write to log file {log_file_path}: {e}")