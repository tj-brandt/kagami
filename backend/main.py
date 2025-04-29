# /Kagami/backend/main.py
import os
import uuid
import random
import time
import base64
import requests
from dotenv import load_dotenv
import openai
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

# Load environment variables
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional

import download_nltk_data   # runs its checks/downloads into ./nltk_data

STATIC_AVATAR_DIR = "static/generated"

# Ensure directory exists
os.makedirs(STATIC_AVATAR_DIR, exist_ok=True)


# Import chatbot_logic functions/constants
try:
    from chatbot_logic import (
        detect_style_traits,
        get_openai_response,  # async
        compute_lsm_score,
        post_process_response,
        log_event,
        log_avatar,
        MIN_LSM_TOKENS,
        LSM_SMOOTHING_ALPHA,
        LOG_DIR,
        DEFAULT_BOT_NAME,
    )
except ImportError as e:
    print(f"Error importing chatbot_logic: {e}")
    raise SystemExit(f"Failed to import chatbot_logic: {e}")


# --- Configure Image Generation API (OpenAI GPT-Image-1 and Google Cloud Vertex AI/Imagen) ---
# Keep OpenAI configuration for GPT-Image-1
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing OpenAI API Key")

_aiplatform_initialized = False

# --- FastAPI setup ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- CORS Configuration ---
# Allow localhost during local development
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Dynamically add your deployed frontend URL if available
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    clean_frontend_url = frontend_url.rstrip('/')  # 🧼 Remove trailing slash
    print(f"Adding FRONTEND_URL to CORS origins: {clean_frontend_url}")
    origins.append(clean_frontend_url)
else:
    print("Warning: FRONTEND_URL environment variable not set. CORS might fail in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(LOG_DIR, exist_ok=True)
_sessions: Dict[str, Dict[str, Any]] = {}

# --- Pydantic models for existing endpoints ---
class SessionStartRequest(BaseModel):
    participantId: Optional[str] = None  # Optional now
    avatarUrl: Optional[str] = None
    avatarPrompt: Optional[str] = None
    condition: Optional[Dict[str, Any]] = None


class SessionStartResponse(BaseModel):
    sessionId: str
    condition: Dict[str, bool]
    initialHistory: List[Dict[str, Any]]

class MessageRequest(BaseModel):
    sessionId: str
    message: str

class MessageResponse(BaseModel):
    response: str
    styleProfile: Dict[str, Any]
    lsmScore: float
    smoothedLsmAfterTurn: float

# --- NEW: Avatar generation request model ---
class AvatarRequest(BaseModel):
    prompt: str
    sessionId: str  # Added sessionId here as requested

# --- Endpoint: get session info ---
@app.get("/api/session/{session_id}")
async def get_session_info(session_id: str):
    """Returns basic session info, including cached generated avatars."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Ensure 'generated_avatars' key exists even if empty, matching the return structure
    return {
        "generated_avatars": session.get("generated_avatars", []),
        "condition": session.get("condition", {}),
        "participantId": session.get("participantId", "00"),
    }


# --- Endpoint: start session ---
@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest):
    pid = req.participantId.zfill(2) if req.participantId else "00" # Pad ID if needed for logging
    sid = str(uuid.uuid4()) # Use full UUID string

    # Randomize condition (avatar & LSM) - this logic should be here
    condition = req.condition or {
    "lsm": random.choice([True, False]),
    "avatar": random.choice([True, False])
    }

    # Prepare log file path and initial session data structure
    timestamp_str = time.strftime("%Y%m%d_%H%M%S", time.gmtime()) # UTC time
    log_filename = f"participant_{pid}_{sid}.jsonl"
    log_file_path = os.path.join(LOG_DIR, log_filename)

    _sessions[sid] = {
        "participantId": pid,
        "sessionId": sid,
        "condition": condition,
        "log_file_path": log_file_path,
        "turn_number": 0,
        "smoothed_lsm_score": 0.5,
        "history": [],
        "avatar_url": req.avatarUrl,
        "avatar_prompt": req.avatarPrompt,
        "generated_avatars": [] # Initialize empty list for caching generated avatars
    }

    # Log avatar details if provided
    # This happens *after* session state is created with avatar_url/prompt
    if req.avatarUrl and req.avatarPrompt:
        try:
            # Log the avatar URL and prompt used for this participant
            log_avatar(pid, req.avatarUrl, req.avatarPrompt)
        except Exception as e:
            print(f"Warning: Failed to log avatar for session {sid}, participant {pid}: {e}")


    # --- Generate and Log Initial Greeting (Turn 0) ---
    # Use the logic function to get the initial greeting
    # No user prompt, empty history for the first call
    # Pass session_info to LLM function for potential internal logging/context
    initial_style_profile = {} # No user input yet
    session = _sessions[sid] # Get the session data we just created

    try:
        initial_greeting_raw, system_instr = await get_openai_response(
            user_prompt="<System Initialized>", # Internal marker for LLM context if needed
            chat_history=[],
            is_adaptive=condition['lsm'],
            # Use session state here, which was just populated from req
            show_avatar=bool(session.get("avatar_url")),
            style_profile=initial_style_profile # Empty profile for turn 0
            
        )
        # Post-process the raw greeting based on the assigned condition
        initial_greeting_processed = post_process_response(initial_greeting_raw, condition['lsm'])
    except Exception as e:
        print(f"Error generating initial greeting for session {sid}: {e}")
        initial_greeting_processed = "Hello! I'm ready to help you with your shopping." # Fallback
        system_instr = "" # No instruction used for fallback


    # Add initial greeting to session history
    session["history"].append({
        "role": "assistant",
        "content": initial_greeting_processed,
        "turn_number": 0,
        "avatar_url": session.get("avatar_url") # Include avatar_url in history entry
    })

    # Log session start event (after history is initialized with greeting)
    # Pass the current state of session to log_event
    log_event({
        "event_type": "session_start",
        "initial_condition": condition,
        "initial_greeting": initial_greeting_processed,
        "system_instruction_initial": system_instr,
        "avatar_url": session.get("avatar_url"),
        "avatar_prompt": session.get("avatar_prompt")
    }, session_info=session)


    # Return session details and the initial message(s) to the frontend
    return SessionStartResponse(
        sessionId=sid,
        condition=condition,
        initialHistory=session["history"] # Return the history, which contains the first message
    )


# --- Endpoint: handle a message ---
@app.post("/api/session/message", response_model=MessageResponse)
async def handle_message(req: MessageRequest):
    sid = req.sessionId
    session = _sessions.get(sid) # Use .get() to avoid KeyError if session not found

    if not session:
        print(f"Error: Session ID not found: {sid}")
        raise HTTPException(status_code=404, detail="Session not found or expired")


    # --- State Management for the Turn ---
    session["turn_number"] += 1 # Increment turn counter *before* processing the user message
    current_turn = session["turn_number"]

    user_text = req.message
    condition = session["condition"]
    # chat_history is session["history"], accessed directly below


    # --- Processing User Input ---
    # 1. Detect User Style for CURRENT prompt using ported function
    traits = detect_style_traits(user_text)
    user_token_count = traits.get("word_count", 0) # Get token count from detected traits

    # 2. Add PREVIOUS smoothed LSM score to the profile for prompt generation
    traits["lsm_score_prev"] = session["smoothed_lsm_score"]

    # --- Add User Message to History (BEFORE calling LLM) ---
    # It's important the LLM sees the user's message in the history context
    session["history"].append({
        "role": "user",
        "content": user_text,
        "turn_number": current_turn,
        # User messages don't typically have an avatar displayed in the same way,
        # but you could include user info if needed later
        # "avatar_url": None # Or user avatar if you implement that
    })

    # --- Logging User Message ---
    # 3. Log user message event (log *after* adding to history if history affects logging)
    log_event({
        "event_type": "user_message",
        # turn_number is added by log_event using session info
        "user_prompt": user_text,
        "style_profile": traits # Log the full detected profile (includes prev smoothed LSM)
    }, session_info=session)

    # --- Generating Bot Response ---
    # Pass the session history *including* the current user message now added
    try:
        bot_response_raw, system_instr_used = await get_openai_response(
            user_prompt=user_text, # Pass current prompt explicitly
            chat_history=session["history"], # Pass the full history including the user's latest message
            is_adaptive=condition["lsm"],
            show_avatar=bool(session.get("avatar_url")), # Use session state for avatar info
            style_profile=traits # Pass the profile containing prev smoothed LSM
        )
    except Exception as e:
         # Log the error specifically if get_openai_response doesn't handle all errors
         print(f"Critical Error in get_openai_response for session {sid}, turn {current_turn}: {e}")
         # Set variables to indicate failure and provide a fallback response
         processed_bot_response = "Sorry, I encountered an unexpected error while trying to generate a response. Please try again later."
         raw_lsm = 0.5 # Default LSM if response fails
         new_smoothed_lsm = session["smoothed_lsm_score"] # Don't update smoothed LSM
         system_instr_used = "" # No meaningful instruction used for error response
         lsm_reason = "Error generating response."

         # Log the error event
         log_event({
            "event_type": "llm_generation_failed",
            "error_message": str(e),
            "user_prompt": user_text,
            "system_instruction_used": system_instr_used, # Log what prompt was *attempted*
            "style_profile_used_for_prompt": traits # Log profile used
         }, session_info=session)

         # Return the error response immediately
         # Note: The user message *was* added to history, but the bot response is an error.
         # Consider if you need to add the error response to history as well.
         # For now, following original logic: don't add error response to history.
         return MessageResponse(
             response=processed_bot_response,
             styleProfile=traits, # Return the user traits detected
             lsmScore=raw_lsm,
             smoothedLsmAfterTurn=new_smoothed_lsm
         )


    # --- Post-processing and LSM Calculation (only if LLM call was successful) ---
    # This section only runs if the try block above succeeded without an exception
    # 5. Post-process the raw response
    processed_bot_response = post_process_response(bot_response_raw, condition["lsm"])
    # Need bot token count for LSM smoothing check.
    bot_traits      = detect_style_traits(processed_bot_response)
    bot_token_count = bot_traits.get("word_count", 0)

    # 6. Calculate Turn LSM and Update Smoothed Score
    # Use the raw user prompt and the PROCESSED bot response
    raw_lsm = compute_lsm_score(user_text, processed_bot_response)


    # Determine if smoothed score should be updated based on token counts
    update_smoothed_lsm = True
    lsm_reason = ""

    if user_token_count < MIN_LSM_TOKENS:
        update_smoothed_lsm = False
        lsm_reason += f"User ({user_token_count}) < {MIN_LSM_TOKENS} tokens. "
    if bot_token_count < MIN_LSM_TOKENS:
        update_smoothed_lsm = False
        lsm_reason += f"Bot ({bot_token_count}) < {MIN_LSM_TOKENS} tokens."

    # Calculate the new smoothed LSM score
    prev_smoothed_lsm = session["smoothed_lsm_score"]
    if update_smoothed_lsm:
        new_smoothed_lsm = (LSM_SMOOTHING_ALPHA * raw_lsm) + ((1 - LSM_SMOOTHING_ALPHA) * prev_smoothed_lsm)
        session["smoothed_lsm_score"] = new_smoothed_lsm # Update state in _sessions
        if not lsm_reason: lsm_reason = f"Smoothed Score Updated: {new_smoothed_lsm:.3f}"
    else:
         new_smoothed_lsm = prev_smoothed_lsm # Keep the old one
         if not lsm_reason: lsm_reason = "Smoothed Score Not Updated (token count below min)."


    # --- Adding Bot Message to History and Logging ---
    # 7. Add bot message to session history (AFTER generating and processing it)
    session["history"].append({
        "role": "assistant",
        "content": processed_bot_response,
        "turn_number": current_turn,
        "avatar_url": session.get("avatar_url") # Include avatar_url in history entry
    })


    # 8. Log bot response event (log *after* adding to history if history affects logging)
    log_event({
        "event_type": "bot_response",
        "user_prompt": user_text, # Log the prompt it responded to
        "raw_response": bot_response_raw,
        "processed_response": processed_bot_response,
        "style_profile_used_for_prompt": traits, # Profile used for THIS response generation (includes prev smoothed LSM)
        "lsm_score_raw_turn": raw_lsm,
        "smoothed_lsm_after_turn": new_smoothed_lsm,
        "lsm_update_reason": lsm_reason,
        "system_instruction_used": system_instr_used,
        # condition, participant_id, session_id, turn_number added by log_event using session_info
    }, session_info=session)


    # --- Return Response to Frontend ---
    # 9. Return the processed response and full data to the frontend
    return MessageResponse(
        response=processed_bot_response,
        styleProfile=traits, # Return the profile detected for the *user's* message
        lsmScore=raw_lsm, # Raw LSM for *this* turn (User vs Processed Bot)
        smoothedLsmAfterTurn=new_smoothed_lsm # Smoothed LSM *after* this turn (used for *next* turn's prompt)
    )

# --- Endpoint: generate avatar ---
@app.post("/api/avatar/generate")
async def generate_avatar(req: AvatarRequest):
    try:
        sid = req.sessionId
        if sid not in _sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        session = _sessions[sid]

        if "generated_avatars" in session and len(session["generated_avatars"]) >= 5:
            raise HTTPException(status_code=400, detail="Maximum avatar generations reached.")

        base_image_path = "../frontend/src/assets/avatars/capybara.png"
        if not os.path.exists(base_image_path):
            raise HTTPException(status_code=500, detail="Base image not found.")

        base_prompt_template = (
        "Edit this cute 3D animal character to match: [__USER_PROMPT__]. "
        "Keep the exact same pose, fully seated on the stool, with legs and hands in the same position. "
        "Maintain a perfectly front-facing camera angle (0° yaw, 0° pitch, 0° roll), with no tilt or rotation. "
        "The entire full-body must remain fully visible, centered, and proportional within the 1024×1024 frame. "
        "Preserve the soft Animal Crossing style, warm lighting, and original stool/chair design. "
        "Only modify the animal species, accessories, and clothing based on the prompt. "
        "**The background must remain fully transparent, with no scenery, patterns, colors, or objects added.**"
    )
        user_specific_prompt = req.prompt.strip()
        final_prompt = base_prompt_template.replace("[__USER_PROMPT__]", user_specific_prompt)

        print(f"Generating avatar with GPT-Image-1 for session {sid}...")

        # Use manual POST to OpenAI
        url = "https://api.openai.com/v1/images/edits"
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        }
        files = {
            "image": open(base_image_path, "rb"),
        }
        data = {
            "model": "gpt-image-1",
            "prompt": final_prompt,
            "size": "1024x1024",
            "quality": "medium",
            "background": "transparent",
        }

        response = requests.post(url, headers=headers, files=files, data=data, timeout=600)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {response.text}")

        response_json = response.json()
        image_base64 = response_json["data"][0]["b64_json"]

        # Decode and save the avatar
        image_bytes = base64.b64decode(image_base64)
        avatar_filename = f"{sid}_avatar{len(session['generated_avatars']) + 1}.png"
        avatar_path = os.path.join(STATIC_AVATAR_DIR, avatar_filename)

        with open(avatar_path, "wb") as f:
            f.write(image_bytes)

        # Construct the public URL (assuming your backend serves /static/generated/)
        avatar_url = f"/static/generated/{avatar_filename}"

        session["generated_avatars"].append({
            "url": avatar_url,
            "prompt": user_specific_prompt
        })

        return {"url": avatar_url}

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Avatar generation error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Add any other endpoints like session end/timeout redirection here
# Example: Basic session cleanup (optional, depends on requirements)
# @app.post("/api/session/end")
# async def end_session(req: MessageRequest): # Reuse or create new model
#     sid = req.sessionId
#     session = _sessions.pop(sid, None) # Remove session if exists
#     if session:
#         log_event({"event_type": "session_end"}, session_info=session)
#         return {"message": "Session ended successfully."}
#     else:
#         raise HTTPException(status_code=404, detail="Session not found.")

# Optional: Add root endpoint for health check
@app.get("/")
async def read_root():
    return {"message": "Shopping Chatbot Backend is running."}

# Allow running with uvicorn directly (for development)
if __name__ == "__main__":
    import uvicorn
    # Ensure AI Platform is initialized before starting the server if running directly
    # Keep this if you intend to use Vertex AI/Imagen for other purposes in this app
    # if not initialize_aiplatform():
    #    print("INFO: AI Platform initialization failed. Imagen features will not be available.")
       # Optionally exit if initialization is critical
       # import sys
       # sys.exit(1)
    # Note: initialize_aiplatform() is NOT needed for the /api/avatar/generate endpoint which uses OpenAI


    # Use environment variables for host/port or defaults
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)