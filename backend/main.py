# --- Python & Third-Party Imports ---
import asyncio
from dotenv import load_dotenv
load_dotenv()
import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
import uuid
import traceback
from PIL import Image
from io import BytesIO
import time
import httpx
import base64
import json
from pathlib import Path  
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import requests
import psutil
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core.config import settings 


# --- Local Core Service & Logic Imports ---
from core import config
from core.nlp_service import nlp_service
from core.config import settings
from core.logging_service import log_event
from core.models import StyleProfile
from core.utils import post_process_response, get_user_style_sample
from chatbot_logic import get_openai_response
from drive_upload import upload_log_to_drive


# --- Environment-Aware Path Configuration ---
IS_PRODUCTION = os.getenv("RENDER") == "true"

if IS_PRODUCTION:
    STATIC_FILES_BASE_PATH = Path("/var/data")
    print("INFO: Production environment detected. Using '/var/data' for static files.")
else:
    STATIC_FILES_BASE_PATH = Path(__file__).parent / "local_static_data"
    print(f"INFO: Development environment detected. Using '{STATIC_FILES_BASE_PATH}' for static files.")

GENERATED_AVATAR_DIR = STATIC_FILES_BASE_PATH / "generated"
REPO_STATIC_DIR = Path(__file__).parent / "static"


# --- FastAPI Setup ---
app = FastAPI()

app.mount("/static", StaticFiles(directory=STATIC_FILES_BASE_PATH), name="persistent_static")

# CORS Setup
origins = {"http://localhost:3000", "http://127.0.0.1:3000", "https://kagami.chat"}
if settings.FRONTEND_URL:
    origins.update({url.strip() for url in settings.FRONTEND_URL.split(',') if url.strip()})
print(f"INFO: Allowing CORS for the following origins: {list(origins)}")
app.add_middleware(CORSMiddleware, allow_origins=list(origins), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# --- App State & Startup ---
_sessions: Dict[str, Dict[str, Any]] = {}
os.makedirs(config.LOG_DIR, exist_ok=True)
os.makedirs(GENERATED_AVATAR_DIR, exist_ok=True)


from download_models import main as download_models_main
@app.on_event("startup")
async def startup_event():
    print("INFO (main.py): Application startup.")
    print("INFO (main.py): Triggering background NLP model warm-up...")
    asyncio.create_task(nlp_service.warm_up())
    load_all_session_states()
    print("INFO (main.py): Server is live. Warm-up is running in background.")

# --- Pydantic Models (API Contracts) ---
class SessionStartRequest(BaseModel):
    participantId: str
    conditionName: str
class SessionStartResponse(BaseModel):
    sessionId: str
    condition: Dict[str, Any]
    initialHistory: List[Dict[str, Any]]
class MessageRequest(BaseModel):
    sessionId: str
    message: str
class MessageResponse(BaseModel):
    response: str
    styleProfile: Dict[str, Any]
    lsmScore: float
    smoothedLsmAfterTurn: float
class FrontendEventRequest(BaseModel):
    sessionId: Optional[str] = None
    participantId: Optional[str] = None
    eventType: str
    eventData: Dict[str, Any] = {}
class SetAvatarDetailsRequest(BaseModel):
    sessionId: str
    avatarUrl: str
    avatarPrompt: Optional[str] = None
class AvatarRequest(BaseModel):
    prompt: str
    sessionId: str
class AvatarResponse(BaseModel):
    url: str
    prompt: str
class SessionEndRequest(BaseModel):
    sessionId: str


# --- Helper Functions for Session State ---
def log_memory_usage():
    process = psutil.Process(os.getpid())
    mem_mb = process.memory_info().rss / 1024 / 1024
    print(f"[RESOURCE] Memory Used: {mem_mb:.2f} MB | CPU: {process.cpu_percent(interval=0.1):.2f}%")
def get_session_state_file_path(session_id: str) -> Path:
    session_dir = Path(__file__).parent / config.SESSION_STATE_DIR
    session_dir.mkdir(exist_ok=True)
    return session_dir / f"{session_id}.json"
def save_session_state(session_id: str):
    if session_data := _sessions.get(session_id):
        try:
            serializable_data = session_data.copy()
            if isinstance(serializable_data.get("log_file_path"), Path):
                serializable_data["log_file_path"] = str(serializable_data["log_file_path"])
            with open(get_session_state_file_path(session_id), 'w', encoding='utf-8') as f:
                json.dump(serializable_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"ERROR: Failed to save session {session_id} state to disk: {e}")
def load_all_session_states():
    session_state_dir_path = Path(__file__).parent / config.SESSION_STATE_DIR
    if not session_state_dir_path.exists(): return
    for filepath in session_state_dir_path.glob('*.json'):
        try:
            with open(filepath, 'r', encoding='utf-8') as f: session_data = json.load(f)
            if session_id := session_data.get("sessionId"):
                if isinstance(session_data.get("log_file_path"), str):
                    session_data["log_file_path"] = Path(session_data["log_file_path"])
                _sessions[session_id] = session_data
        except Exception as e: print(f"ERROR: Failed to load session from {filepath}: {e}")
    print(f"INFO: Loaded {len(_sessions)} active sessions.")
def generate_natural_greeting():
    return "Hey there, I'm Kagami. What's on your mind today, or how's your day been so far?"

# --- API Endpoints ---
@app.get("/")
async def read_root(): return {"message": "Kagami Chat — backend humming smoothly."}

@app.post("/api/session/end")
async def end_session(req: SessionEndRequest, tasks: BackgroundTasks):
    sid = req.sessionId
    session = _sessions.get(sid)
    if not session:
        print(f"INFO: Session end called for non-existent/already-ended session: {sid}")
        return {"message": "Session already ended or not found."}

    log_event({"event_type": "session_end"}, session_info=session)
    
    try:
        log_path = str(session["log_file_path"])
        if "demo_user" not in session.get("participantId", ""):
            tasks.add_task(
                upload_log_to_drive,
                log_path,
                sid,
                settings.GOOGLE_DRIVE_FOLDER_ID
            )
    except Exception as e:
        log_event({"event_type": "error", "error_source": "log_upload_task_creation_failed", "error_message": str(e)}, session_info=session)
        print(f"[drive-upload-task] failed to queue for {sid}: {e}")

    filepath = get_session_state_file_path(sid)
    if filepath.exists():
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"ERROR: Failed to delete session state file {filepath}: {e}")
    
    _sessions.pop(sid, None)

    return {"message": "Session ended successfully and log processing queued."}


# --- Avatar Generation Endpoint ---
@app.post("/api/avatar/generate", response_model=AvatarResponse)
async def generate_avatar(req: AvatarRequest):
    sid = req.sessionId
    session = _sessions.get(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        if len(session["generated_avatars"]) >= 5:
            raise HTTPException(status_code=400, detail="Maximum avatar generations reached")

        base_image_path = REPO_STATIC_DIR / "base_images" / "kagami.webp"
        if not base_image_path.exists():
             error_msg = f"Base image not found at path: {base_image_path}"
             log_event({"event_type": "error","error_source": "avatar_generation_base_image","error_message": error_msg}, session_info=session)
             raise HTTPException(status_code=500, detail="Base image not found.")

        user_prompt = req.prompt.strip()
        if not user_prompt:
            raise HTTPException(status_code=400, detail="Avatar prompt cannot be empty")
        
        base_prompt_template = (
            "Edit this cute 3D animal character to match: [__USER_PROMPT__]. "
            "Keep the exact same pose, sitting with legs crossed and hands in the same position. "
            "Maintain a perfectly front-facing camera angle (0° yaw, 0° pitch, 0° roll), with no tilt or rotation. "
            "The entire full-body must remain fully visible, centered, and proportional within the 1024×1024 frame. "
            "Preserve the soft Animal Crossing style. "
            "Only modify the animal species, accessories, and clothing based on the prompt. "
            "**The background must remain fully transparent, with no scenery, patterns, colors, or objects added.**"
        )
        final_prompt = base_prompt_template.replace("[__USER_PROMPT__]", user_prompt)

        headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
        
        try:
            with open(base_image_path, "rb") as img_file:
                files = { "image": (base_image_path.name, img_file, "image/webp") }
                data = {
                    "model": "gpt-image-1",
                    "prompt": final_prompt,
                    "background": "transparent",
                    "output_format": "webp",
                    "size": "1024x1024",
                    "quality": "medium",
                    "n": 1,
                }
                response = requests.post("https://api.openai.com/v1/images/edits", headers=headers, files=files, data=data, timeout=120)
                response.raise_for_status()

        except requests.exceptions.RequestException as api_error:
            error_details = api_error.response.json() if api_error.response else str(api_error)
            raise HTTPException(status_code=api_error.response.status_code if api_error.response else 500, detail=f"Image generation API failed: {error_details}")
        
        image_b64 = response.json()["data"][0].get("b64_json")
        if not image_b64:
            raise HTTPException(status_code=500, detail="API returned no image data.")

        webp_bytes = base64.b64decode(image_b64)
        filename = f"{sid}_avatar{len(session['generated_avatars']) + 1}.webp"
        filepath = GENERATED_AVATAR_DIR / filename
        
        try:
            with open(filepath, "wb") as f:
                f.write(webp_bytes)
        except Exception as write_error:
             raise HTTPException(status_code=500, detail=f"Error writing generated avatar file: {write_error}")

        url = f"/static/generated/{filename}"
        avatar_entry = {"url": url, "prompt": user_prompt}
        session["generated_avatars"].append(avatar_entry)
        log_event({"event_type": "avatar_generated", "avatar_prompt": user_prompt, "avatar_url_generated": url}, session_info=session)
        
        return AvatarResponse(url=url, prompt=user_prompt)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected internal error occurred: {e}")


# --- Session Start ---
@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest):
    try:
        pid = req.participantId
        sid = str(uuid.uuid4())
        condition_name_from_frontend = req.conditionName.lower()
        condition_details = {
            "generated_adaptive": {"avatar": True, "lsm": True, "avatarType": "generated"},
            "generated_static":   {"avatar": True, "lsm": False, "avatarType": "generated"},
            "premade_adaptive":   {"avatar": True, "lsm": True, "avatarType": "premade"},
            "premade_static":     {"avatar": True, "lsm": False, "avatarType": "premade"},
            "none_adaptive":      {"avatar": False, "lsm": True, "avatarType": "none"},
            "none_static":        {"avatar": False, "lsm": False, "avatarType": "none"},
        }
        backend_condition_obj = condition_details.get(condition_name_from_frontend)
        if not backend_condition_obj:
            raise HTTPException(status_code=400, detail=f"Invalid conditionName provided: '{condition_name_from_frontend}'")
        log_file_path = Path(config.LOG_DIR) / f"participant_{pid}_{sid}.jsonl"
        _sessions[sid] = {
            "participantId": pid, "sessionId": sid, "condition": backend_condition_obj,
            "condition_name_from_frontend": condition_name_from_frontend, "log_file_path": log_file_path,
            "turn_number": 0, "smoothed_lsm_score": 0.5, "history": [], "avatar_url": None,
            "avatar_prompt": None, "generated_avatars": [],
        }
        session = _sessions[sid]
        initial_greeting = generate_natural_greeting()
        session["history"].append({"role": "assistant", "content": initial_greeting, "turn_number": 0})
        log_event({
            "event_type": "session_start_backend", "condition_name_from_request": req.conditionName,
            "backend_confirmed_condition_obj": backend_condition_obj, "initial_greeting": initial_greeting,
        }, session_info=session)
        save_session_state(sid)
        return SessionStartResponse(sessionId=sid, condition=backend_condition_obj, initialHistory=session["history"])
    except Exception as e:
        print(f"Critical error during session start: {e}")
        log_event({"event_type":"error", "error_source":"session_start_exception", "error_message": str(e)}, session_info={})
        raise HTTPException(status_code=500, detail=f"Internal server error during session start: {str(e)}")
    
@app.post("/api/session/set_avatar_details") 
async def set_avatar_details(req: SetAvatarDetailsRequest):
    session = _sessions.get(req.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session["avatar_url"] = req.avatarUrl
    if req.avatarPrompt is not None: 
        session["avatar_prompt"] = req.avatarPrompt
    log_event_data = {"event_type": "avatar_details_set", "avatar_url_set": req.avatarUrl}
    if req.avatarPrompt is not None:
        log_event_data["avatar_prompt_set"] = req.avatarPrompt 
    log_event(log_event_data, session_info=session)
    save_session_state(req.sessionId)
    return {"message": "Avatar details updated successfully."}


# --- Message Handling ---
@app.post("/api/session/message", response_model=MessageResponse)
async def handle_message(req: MessageRequest):
    try:
        start_time = time.time()
        log_memory_usage()
        session = _sessions.get(req.sessionId)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session["turn_number"] += 1
        user_style_text_sample = get_user_style_sample(session["history"]) or req.message
        user_traits: StyleProfile = await nlp_service.analyze_text(user_style_text_sample)
        user_traits.lsm_score_prev = session.get("smoothed_lsm_score", 0.5)
        session["history"].append({"role": "user", "content": req.message, "turn_number": session["turn_number"]})
        
        log_event({"event_type": "user_message", "content": req.message, "user_linguistic_traits": user_traits.model_dump()}, session_info=session)
        
        bot_raw, system_instruction_used, usage_data = await get_openai_response(
            user_prompt=req.message, chat_history=session["history"],
            is_adaptive=session["condition"].get("lsm", False), style_profile=user_traits)
        
        bot_response = post_process_response(bot_raw, session["condition"].get("lsm", False))
        bot_traits = await nlp_service.analyze_text(bot_response)
        raw_lsm = nlp_service.compute_lsm(user_style_text_sample, bot_response)
        style_similarity = nlp_service.compute_style_similarity(user_style_text_sample, bot_response)
        
        update_smoothed = (user_traits.word_count >= config.MIN_LSM_TOKENS_FOR_SMOOTHING and bot_traits.word_count >= config.MIN_LSM_TOKENS_FOR_SMOOTHING)
        prev_score = session.get("smoothed_lsm_score", 0.5)
        new_score = ((config.LSM_SMOOTHING_ALPHA * raw_lsm) + ((1 - config.LSM_SMOOTHING_ALPHA) * prev_score)) if update_smoothed else prev_score
        session["smoothed_lsm_score"] = new_score
        
        duration = time.time() - start_time
        session["history"].append({"role": "assistant", "content": bot_response, "turn_number": session["turn_number"]})
        
        log_event({
            "event_type": "bot_response", "content": bot_response, "lsm_score_raw": raw_lsm,
            "style_similarity_cosine": style_similarity, "lsm_score_smoothed": new_score,
            "bot_linguistic_traits": bot_traits.model_dump(), "style_profile_used_for_prompt": user_traits.model_dump(),
            "system_instruction_used": system_instruction_used.replace("\n\n[GUARDRAIL_FIRED=TRUE]", ""),"guardrail_fired": "[GUARDRAIL_FIRED=TRUE]" in system_instruction_used,
            "response_latency_sec": duration, "openai_usage": usage_data.model_dump() if usage_data else None
        }, session_info=session)
        
        save_session_state(req.sessionId)
        
        return MessageResponse(response=bot_response, styleProfile=user_traits.model_dump(), lsmScore=raw_lsm, smoothedLsmAfterTurn=new_score)

    except Exception as e:
        print("--- ❌ CRITICAL ERROR IN HANDLE_MESSAGE ---")
        traceback.print_exc()
        print("-----------------------------------------")
        raise HTTPException(status_code=500, detail=f"An unexpected internal error occurred: {e}")

# --- Frontend Event Logging ---
@app.post("/api/log/frontend_event")
async def log_frontend_event(req: FrontendEventRequest):
    try:
        sid = req.sessionId
        session = _sessions.get(sid) if sid else None
        log_data = {"event_type": req.eventType, "event_data": req.eventData}
        if session: log_event(log_data, session_info=session)
        elif req.participantId:
            pid_zfill = str(req.participantId).zfill(2)
            fallback_log_filename = f"participant_{pid_zfill}_{sid or 'no_sid'}_fallback.jsonl"
            fallback_session_info = {
                "participantId": pid_zfill, "sessionId": sid, 
                "condition": req.eventData.get("backend_condition") or req.eventData.get("initial_condition_raw") or {"lsm": None, "avatar": None},
                "log_file_path": os.path.join(config.LOG_DIR, fallback_log_filename)
             }
            log_event(log_data, session_info=fallback_session_info)
        else:
             general_log_path = os.path.join(config.LOG_DIR, "general_frontend_events.jsonl")
             general_log_entry = {"timestamp_utc": datetime.now(timezone.utc).isoformat(), "event_type": req.eventType, "event_data": req.eventData}
             with open(general_log_path, 'a', encoding='utf-8') as f: f.write(json.dumps(general_log_entry) + '\n')
        return {"message": "Frontend event log request received."}
    except Exception as e:
        system_error_log_path = os.path.join(config.LOG_DIR, "system_errors.jsonl")
        error_entry = {"timestamp_utc": datetime.now(timezone.utc).isoformat(), "error_source": "log_frontend_event_exception", "error_message": str(e)}
        with open(system_error_log_path, 'a', encoding='utf-8') as f: f.write(json.dumps(error_entry) + '\n')
        raise HTTPException(status_code=500, detail=f"Internal server error processing log request: {str(e)}")