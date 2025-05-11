from dotenv import load_dotenv
load_dotenv()                                  # ← populate os.environ now
from drive_upload import upload_log_to_drive   # ← now sees GOOGLE_DRIVE_FOLDER_ID
import json
import os
import nltk
import uuid
import random
import time
import base64
import requests
import openai
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from datetime import datetime, timezone # Added timezone import

# Correct import order: standard libraries, then third-party, then local
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# Local imports
import download_nltk_data # Import this only ONCE
from common import (
    detect_style_traits, compute_lsm_score, post_process_response, log_event,
    MIN_LSM_TOKENS, LSM_SMOOTHING_ALPHA, LOG_DIR, DEFAULT_BOT_NAME,
    tokenize_text, TEMPERATURE, MAX_TOKENS, get_user_style_sample, TONE_VARIATIONS
)
from chatbot_logic import get_openai_response


STATIC_AVATAR_DIR = "static/generated"
os.makedirs(STATIC_AVATAR_DIR, exist_ok=True) # Ensure static dir exists

# --- OpenAI & Drive Config ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY environment variable.")
# Define placeholder for default folder ID
DEFAULT_FOLDER_ID_PLACEHOLDER = "" # Use same placeholder as drive_upload.py
# Get Folder ID from Environment Variable for use in session_end
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", DEFAULT_FOLDER_ID_PLACEHOLDER)
# --- END Config ---


# --- FastAPI Setup (Keep this) ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
origins = ["http://localhost:3000", "http://127.0.0.1:3000", "https://kagami.chat", "https://kagami-gkcw.onrender.com"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url.rstrip("/"))
else:
    print("Warning: FRONTEND_URL not set; CORS may fail.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
# --- END FastAPI Setup ---


# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)
_sessions: Dict[str, Dict[str, Any]] = {}

# --- Pydantic Models (MODIFIED & NEW) ---
class SessionStartRequest(BaseModel):
    participantId: Optional[str] = None
    condition: Optional[Dict[str, bool]] = None # e.g., {"avatar": True, "lsm": False}
    conditionName: Optional[str] = None      # e.g., "avatar_premade_static" - NEW

class SessionStartResponse(BaseModel):
    sessionId: str
    condition: Dict[str, bool] # The {avatar, lsm} object confirmed by backend
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
    sessionId: Optional[str] = None # Allow sessionId to be None here for fallback logging
    participantId: Optional[str] = None
    eventType: str
    eventData: Dict[str, Any] = {}

class SetAvatarDetailsRequest(BaseModel): # NEW MODEL
    sessionId: str
    avatarUrl: str
    avatarPrompt: Optional[str] = None

class AvatarRequest(BaseModel):
    prompt: str
    sessionId: str

class AvatarResponse(BaseModel):
    url: str
    prompt: str

class SessionEndRequest(BaseModel): # Keep this new model
    sessionId: str
# --- END Pydantic Models ---


# --- Helper Functions (Keep these) ---
def get_time_of_day_label():
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    return "night"

def generate_natural_greeting():
    time_label = get_time_of_day_label()
    greetings = [
        "Hey there, I'm Kagami.",
        "Hi there, I'm Kagami.",
        "Hello, I'm Kagami.",
        "Hey, friend, I'm Kagami."
    ]
    themes = {
        "dreamy": {"feelings": ["dreamy", "soft", "floaty", "hazy"],
                   "references": [
                       "like the dreamy opening track of a Beach House album.",
                       "like discovering a hidden gem on SoundCloud at 3 AM.",
                       "like a Studio Ghibli scene just before something magical happens.",
                       "like a faded Polaroid of a summer you almost remember."
                   ]},
        "energetic": {"feelings": ["energetic", "exciting", "spirited", "vibrant", "awake"],
                      "references": [
                          "like hitting a perfect combo in DDR.",
                          "like when your favorite Charli XCX track kicks in at full volume.",
                          "like a Friday morning with a fresh playlist drop.",
                          "like an early 2000s pop anthem blasting through wired headphones."
                      ]},
        "nostalgic": {"feelings": ["nostalgic", "familiar", "reflective", "bittersweet"],
                      "references": [
                          "like scrolling Tumblr at 2 AM in 2013.",
                          "like customizing your Myspace profile back in the day.",
                          "like the sound of booting up an iPod Classic.",
                          "like an old MSN away message you forgot you wrote."
                      ]},
        "chill": {"feelings": ["chill", "calm", "relaxed", "mellow"],
                  "references": [
                      "like lo-fi beats echoing in a quiet room.",
                      "like a long walk with no destination.",
                      "like your favorite hoodie and a cup of something warm.",
                      "like being underwater with headphones on."
                  ]},
        "cozy": {"feelings": ["cozy", "warm", "vibey", "relaxed"],
                 "references": [
                     "like redecorating your Animal Crossing home on a rainy day.",
                     "like finding a soft corner of the internet that still feels alive.",
                     "like opening a well-worn book and knowing the first line by heart.",
                     "like your favorite fuzzy socks and a playlist that understands you."
                 ]}
    }
    weights = {
        "morning": ["energetic"]*3 + ["chill"]*2 + ["cozy"],
        "afternoon": ["chill"]*2 + ["cozy", "nostalgic"],
        "evening": ["nostalgic", "cozy", "dreamy"]*2,
        "night": ["dreamy"]*3 + ["nostalgic", "cozy"]
    }
    questions = {
        "morning": [
            "What kind of music gets you moving in the morning?",
            "Got a favorite playlist or podcast that kicks off your day?",
            "Do you ever watch anything while eating breakfast — YouTube, cartoons, a comfort show?"
        ],
        "afternoon": [
            "What song’s been stuck in your head today?",
            "Caught anything good on your breaks — a TikTok series, a quick episode?",
            "What’s your ideal chill vibe this afternoon — music, a show, or a bit of both?"
        ],
        "evening": [
            "What’s your go-to comfort show or movie when you’re done with the day?",
            "Heard any good albums or playlists lately for winding down?",
            "What kinds of stories pull you in at night — drama, fantasy, real-life stuff?",
            "Do you have a favorite rewatch for evenings, or do you like trying something new?",
            "What’s your perfect soundtrack for golden-hour walks or chill evenings?"
        ],
        "night": [
            "What's your ideal nighttime vibe — comfort rewatch, deep dive, or scroll spiral?",
            "Got a favorite playlist or show you always come back to late at night?"
        ]
    }

    theme = random.choice(weights.get(time_label, list(themes.keys())))
    feeling = random.choice(themes[theme]["feelings"])
    reference = random.choice(themes[theme]["references"])
    greeting = random.choice(greetings)
    question = random.choice(questions.get(time_label, []))

    if random.choice([True, False]):
        return f"{greeting} This {time_label} feels a little {feeling}. It’s {reference} {question}"
    return f"{greeting} To me, this {time_label} feels {feeling}, {reference} {question}"
# --- END Helper Functions ---


# --- API Endpoints ---

@app.post("/api/session/end")
async def end_session(req: SessionEndRequest):
    sid = req.sessionId
    # 1) do NOT pop yet
    session = _sessions.get(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2) log the end event into your JSONL
    log_event({"event_type": "session_end"}, session_info=session)

    # 3) attempt upload; let exceptions bubble so you can catch below
    try:
        log_path = session["log_file_path"]
        upload_log_to_drive(log_path, sid)
    except Exception as e:
        # 4) log upload failure in JSONL
        log_event({
            "event_type": "error",
            "error_source": "log_upload_failed",
            "log_file_path": session["log_file_path"],
            "error_message": str(e)
        }, session_info=session)
        # also print so you see it in console
        print(f"[drive-upload] failed for {sid}: {e}")

    # 5) only now remove it from memory
    _sessions.pop(sid, None)

    return {"message": f"Session {sid} ended and log uploaded (or logged failure)."}

# --- Root/Health Check ---
@app.get("/")
async def read_root():
    return {"message": "Kagami Chat — backend humming smoothly."}


# --- Avatar Generation Endpoint ---
@app.post("/api/avatar/generate", response_model=AvatarResponse)
async def generate_avatar(req: AvatarRequest):
    sid = req.sessionId
    session = _sessions.get(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Wrap core logic in try...except
    try:
        if len(session["generated_avatars"]) >= 5:
            raise HTTPException(status_code=400, detail="Maximum avatar generations reached")

        base_image_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/src/assets/avatars/kagami.png"))
        if not os.path.exists(base_image_path):
             error_msg = "Base image not found for avatar generation."
             print(f"Critical Error: {error_msg}")
             log_event({"event_type": "error","error_source": "avatar_generation_base_image","error_message": error_msg}, session_info=session)
             raise HTTPException(status_code=500, detail=error_msg)

        user_prompt = req.prompt.strip()
        if not user_prompt:
            raise HTTPException(status_code=400, detail="Avatar prompt cannot be empty")
        # Define base_prompt_template *inside* the function or load from config
        base_prompt_template = (
            "Edit this cute 3D animal character to match: [__USER_PROMPT__]. "
            # ... (rest of template) ...
             "**The background must remain fully transparent, with no scenery, patterns, colors, or objects added.**"
        )
        final_prompt = base_prompt_template.replace("[__USER_PROMPT__]", user_prompt)

        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
        # File operations + OpenAI API call
        try:
            with open(base_image_path, "rb") as img_file:
                files = {"image": (os.path.basename(base_image_path), img_file, "image/png")}
                data = { "model": "gpt-image-1", "prompt": final_prompt, "size": "1024x1024", "quality": "medium", "background": "transparent"}
                # Wrap OpenAI API call
                try:
                    response = requests.post("https://api.openai.com/v1/images/edits", headers=headers, files=files, data=data, timeout=120)
                    response.raise_for_status()
                except requests.exceptions.RequestException as api_error:
                    # ... (error logging and raise HTTPException) ...
                    raise HTTPException(status_code=response.status_code if 'response' in locals() else 500, detail=f"Image generation failed: {api_error}")

        except FileNotFoundError:
             # ... (error logging and raise HTTPException) ...
             raise HTTPException(status_code=500, detail="Base image file not found.")
        except Exception as file_error:
             # ... (error logging and raise HTTPException) ...
             raise HTTPException(status_code=500, detail=f"Error reading base image file: {file_error}")

        image_b64 = response.json()["data"][0].get("b64_json")
        if not image_b64:
            # ... (error logging and raise HTTPException) ...
            raise HTTPException(status_code=500, detail="Image generation failed: No base64 image data returned.")

        # Write the file
        image_bytes = base64.b64decode(image_b64)
        filename = f"{sid}_avatar{len(session['generated_avatars']) + 1}.png"
        filepath = os.path.join(STATIC_AVATAR_DIR, filename)
        try:
            with open(filepath, "wb") as f:
                f.write(image_bytes)
        except Exception as write_error:
             # ... (error logging and raise HTTPException) ...
             raise HTTPException(status_code=500, detail=f"Error writing generated avatar file {filename}: {write_error}")


        url = f"/static/generated/{filename}"
        avatar_entry = {"url": url, "prompt": user_prompt}
        session["generated_avatars"].append(avatar_entry)

        # Log successful generation
        log_event({"event_type": "avatar_generated", "avatar_prompt": user_prompt, "avatar_url_generated": url}, session_info=session) # Changed avatar_url to avatar_url_generated for clarity in this specific event

        return AvatarResponse(url=url, prompt=user_prompt)

    except HTTPException:
        raise # Re-raise expected HTTP exceptions
    except Exception as e:
        # Catch any other unexpected exceptions
        # ... (error logging and raise HTTPException) ...
        raise HTTPException(status_code=500, detail="Internal server error during avatar generation.")


# --- Session Start ---
@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest):
    try:
        pid = req.participantId.zfill(2) if req.participantId else "00"
        sid = str(uuid.uuid4())
        
        # Backend condition object, can be overridden by request
        condition_obj_from_req = req.condition or {"lsm": random.choice([True, False]), "avatar": random.choice([True, False])}
        
        avatar_present_in_cond_obj = condition_obj_from_req.get("avatar", False)
        lsm_enabled_in_cond_obj = condition_obj_from_req.get("lsm", False)

        # Determine condition_iv_avatar_type based on conditionName from frontend
        derived_avatar_type = "no_avatar" # Default
        if req.conditionName:
            name_lower = req.conditionName.lower()
            if "premade" in name_lower:
                derived_avatar_type = "premade"
            elif "generated" in name_lower:
                derived_avatar_type = "generated"
            elif "noavatar" in name_lower: # Explicitly check for noavatar
                derived_avatar_type = "no_avatar"
            elif avatar_present_in_cond_obj: 
                derived_avatar_type = "unknown_but_avatar_present" 
                print(f"Warning: conditionName '{req.conditionName}' did not specify premade/generated/noavatar, but avatar is present in condition object.")
        elif avatar_present_in_cond_obj: 
             derived_avatar_type = "unknown_no_condition_name"
             print(f"Warning: Avatar is present in condition object, but no conditionName was provided to derive type.")
        
        # Ensure avatar_present_in_cond_obj aligns with derived_avatar_type for 'no_avatar'
        if derived_avatar_type == "no_avatar":
            condition_obj_from_req["avatar"] = False # Enforce avatar:false for no_avatar conditions

        derived_lsm_type = "adaptive" if lsm_enabled_in_cond_obj else "static"
        
        log_file_path = os.path.join(LOG_DIR, f"participant_{pid}_{sid}.jsonl")

        _sessions[sid] = {
            "participantId": pid, 
            "sessionId": sid, 
            "condition": condition_obj_from_req, 
            "condition_name_from_frontend": req.conditionName, 
            "condition_iv_avatar_type": derived_avatar_type, 
            "condition_iv_lsm_type": derived_lsm_type,
            "log_file_path": log_file_path, 
            "turn_number": 0, 
            "smoothed_lsm_score": 0.5,
            "history": [], 
            "avatar_url": None, 
            "avatar_prompt": None,
            "generated_avatars": [],
            "persona_style_tone": random.choice(TONE_VARIATIONS),
        }
        session = _sessions[sid]

        try: 
            initial_greeting = generate_natural_greeting()
        except Exception as e:
            print(f"Error generating natural greeting: {e}")
            initial_greeting = f"Hey there, I'm {DEFAULT_BOT_NAME}. Glad you could make it."

        session["history"].append({"role": "assistant", "content": initial_greeting, "turn_number": 0}) # avatar_url is not included here initially

        log_event({
            "event_type": "session_start_backend",
            # "participant_id": pid, # Redundant with session_info but good for this specific event
            # "session_id": sid,   # Redundant
            "initial_condition_from_request": req.condition, 
            "condition_name_from_request": req.conditionName, 
            # "derived_condition_iv_avatar_type": derived_avatar_type, # Now part of session_info
            # "derived_condition_iv_lsm_type": derived_lsm_type,     # Now part of session_info
            "backend_confirmed_condition_obj": condition_obj_from_req, 
            "initial_greeting": initial_greeting,
        }, session_info=session)

        return SessionStartResponse(
            sessionId=sid, 
            condition=condition_obj_from_req, 
            initialHistory=session["history"]
        )

    except Exception as e:
        print(f"Critical error during session start: {e}") 
        raise HTTPException(status_code=500, detail=f"Internal server error during session start: {str(e)}")


@app.post("/api/session/set_avatar_details") # NEW ENDPOINT
async def set_avatar_details(req: SetAvatarDetailsRequest):
    session = _sessions.get(req.sessionId)
    if not session:
        print(f"Error: Attempt to set avatar details for non-existent session {req.sessionId}")
        raise HTTPException(status_code=404, detail="Session not found")

    session["avatar_url"] = req.avatarUrl
    if req.avatarPrompt is not None: # Explicitly check for None as empty string might be valid
        session["avatar_prompt"] = req.avatarPrompt
    
    log_event_data = {
        "event_type": "avatar_details_set",
        "avatar_url_set": req.avatarUrl, 
    }
    if req.avatarPrompt is not None:
        log_event_data["avatar_prompt_set"] = req.avatarPrompt 
    
    log_event(log_event_data, session_info=session)

    return {"message": "Avatar details updated successfully."}


# --- Message Handling ---
@app.post("/api/session/message", response_model=MessageResponse)
async def handle_message(req: MessageRequest):
    sid = req.sessionId
    session = _sessions.get(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session["turn_number"] += 1
        user_text = req.message
        current_turn = session["turn_number"]
        condition = session["condition"] # This is the {avatar, lsm} object
        user_traits = detect_style_traits(user_text)
        user_token_count = user_traits.get("word_count", 0)
        user_traits["lsm_score_prev"] = session.get("smoothed_lsm_score", 0.5)

        # User message does not have an avatar_url associated with it
        session["history"].append({"role": "user", "content": user_text, "turn_number": current_turn})
        log_event({"event_type": "user_message", "content": user_text, "user_linguistic_traits": user_traits}, session_info=session)

        bot_raw, system_instruction_used = await get_openai_response(
            user_prompt=user_text, 
            chat_history=session["history"], 
            is_adaptive=condition.get("lsm", False), # Safely get lsm
            show_avatar=bool(session.get("avatar_url")), # Check if avatar_url is set
            style_profile=user_traits,
            locked_tone=session.get("persona_style_tone")
        )

        if bot_raw.startswith("[Error]"):
            # Log this error specifically before post-processing
            log_event({
                "event_type": "error", 
                "error_source": "openai_response_error",
                "error_message": bot_raw,
                "system_instruction_used": system_instruction_used
            }, session_info=session)
            # Pass through, post_process_response might clean it or it becomes the bot_response
            
        bot_response = post_process_response(bot_raw, condition.get("lsm", False))
        bot_traits = detect_style_traits(bot_response)
        bot_token_count = bot_traits.get("word_count", 0)
        recent_sample = get_user_style_sample(session["history"])
        user_sample_for_lsm = recent_sample if recent_sample else user_text # Fallback to current user_text if no sample
        
        raw_lsm = 0.5 # Default LSM
        if user_sample_for_lsm and bot_response: # Ensure texts are not empty for LSM
             raw_lsm = compute_lsm_score(user_sample_for_lsm, bot_response)

        update_smoothed = (user_token_count >= MIN_LSM_TOKENS and bot_token_count >= MIN_LSM_TOKENS)
        prev_score = session.get("smoothed_lsm_score", 0.5)
        new_score = ((LSM_SMOOTHING_ALPHA * raw_lsm) + ((1 - LSM_SMOOTHING_ALPHA) * prev_score)) if update_smoothed else prev_score
        session["smoothed_lsm_score"] = new_score

        # Add bot response to history. Include avatar_url if it's set in the session.
        bot_history_entry = {"role": "assistant", "content": bot_response, "turn_number": current_turn}
        if session.get("avatar_url"): # Only add avatar_url to bot message if it exists
            bot_history_entry["avatar_url"] = session.get("avatar_url")
        session["history"].append(bot_history_entry)
        
        log_event({
            "event_type": "bot_response", "content": bot_response, "lsm_score_raw": raw_lsm,
            "lsm_score_smoothed": new_score, "bot_linguistic_traits": bot_traits,
            "style_profile_used": user_traits, "system_instruction_used": system_instruction_used
        }, session_info=session)

        return MessageResponse(response=bot_response, styleProfile=user_traits, lsmScore=raw_lsm, smoothedLsmAfterTurn=new_score)

    except Exception as e:
        print(f"Error processing message for session {sid}: {e}")
        log_event({
            "event_type": "error", 
            "error_source": "handle_message_exception",
            "error_message": str(e)
        }, session_info=session if session else {"sessionId": sid, "log_file_path": os.path.join(LOG_DIR, f"error_log_{sid}.jsonl")}) # Basic fallback log
        raise HTTPException(status_code=500, detail=f"Internal server error processing message: {str(e)}")


# --- Frontend Event Logging ---
@app.post("/api/log/frontend_event")
async def log_frontend_event(req: FrontendEventRequest):
    try:
        sid = req.sessionId
        session = _sessions.get(sid) if sid else None # Handle if sid is None
        log_data = {"event_type": req.eventType, "event_data": req.eventData}

        if session: 
            log_event(log_data, session_info=session)
        elif req.participantId:
            # Fallback logging if session doesn't exist yet or was lost, but we have PID
            # Create a temporary session_info structure for logging purposes
            # Note: condition details might be missing or inaccurate here
            pid_zfill = req.participantId.zfill(2)
            fallback_log_filename = f"participant_{pid_zfill}_{sid or 'no_sid'}_fallback.jsonl"
            
            fallback_session_info = {
                "participantId": pid_zfill, 
                "sessionId": sid, # Can be None
                "condition": req.eventData.get("backend_condition") or req.eventData.get("initial_condition_raw") or {"lsm": None, "avatar": None}, # Try to get condition from eventData
                "condition_name_from_frontend": req.eventData.get("condition_string_param"),
                "condition_iv_avatar_type": None, # Cannot reliably determine here
                "condition_iv_lsm_type": None,    # Cannot reliably determine here
                "log_file_path": os.path.join(LOG_DIR, fallback_log_filename),
                "avatar_url": None,
                "avatar_prompt": None,
                "turn_number": None 
             }
            log_event(log_data, session_info=fallback_session_info)
            print(f"Fallback log for PID {pid_zfill}, SID {sid or 'N/A'}, Event: {req.eventType}")
        else:
             # Log to a general, non-participant-specific error/event file if no session or PID
             general_log_path = os.path.join(LOG_DIR, "general_frontend_events.jsonl")
             # Construct a minimal log entry
             general_log_entry = {
                 "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                 "event_type": req.eventType,
                 "event_data": req.eventData,
                 "source_ip": req.eventData.get("client_ip", "unknown") # If you plan to log IP
             }
             with open(general_log_path, 'a', encoding='utf-8') as f:
                 f.write(json.dumps(general_log_entry) + '\n')
             print(f"General log (no session/PID): Event: {req.eventType}")


        return {"message": "Frontend event log request received."}

    except Exception as e:
        print(f"Critical error processing frontend log request: {e}")
        # Log this error to a system error log, not participant log
        system_error_log_path = os.path.join(LOG_DIR, "system_errors.jsonl")
        error_entry = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "error_source": "log_frontend_event_exception",
            "error_message": str(e),
            "request_payload": req.model_dump_json() if hasattr(req, 'model_dump_json') else str(req) # Pydantic v2 vs v1
        }
        with open(system_error_log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(error_entry) + '\n')
        raise HTTPException(status_code=500, detail=f"Internal server error processing log request: {str(e)}")

# --- Run with Uvicorn if Executed Directly ---
if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)