# /Shopping/backend/main.py

import nltk
import os
import uuid
import random
import time

# NEW: OpenAI import
import openai

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional

# ensure our local nltk_data/ is populated before anything else tries VADER
import download_nltk_data   # runs its checks/downloads into ./nltk_data

# Import chatbot_logic functions/constants
try:
    from chatbot_logic import (
        detect_style_traits,
        get_gemini_response,  # async
        compute_lsm_score,
        post_process_response,
        log_event,
        MIN_LSM_TOKENS,
        LSM_SMOOTHING_ALPHA,
        LOG_DIR,
        AVATAR_IMAGE_PATH,
        DEFAULT_BOT_NAME,
        NO_AVATAR_BOT_NAME
    )
except ImportError as e:
    print(f"Error importing chatbot_logic: {e}")

# --- Configure OpenAI API key from env ---
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    print("WARNING: OPENAI_API_KEY is not set. Avatar generation will fail.")

# --- FastAPI setup ---
app = FastAPI()

app.add_middleware(
   CORSMiddleware,
   allow_origins=["http://localhost:3000"],
   allow_methods=["*"],
   allow_headers=["*"],
   allow_credentials=True,
)

os.makedirs(LOG_DIR, exist_ok=True)
_sessions: Dict[str, Dict[str, Any]] = {}

# --- Pydantic models for your existing endpoints ---
class SessionStartRequest(BaseModel):
    participantId: str

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

# --- Endpoint: start session ---
@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest): # Made async because get_gemini_response is async
    pid = req.participantId.zfill(2) # Pad ID if needed for logging
    sid = str(uuid.uuid4()) # Use full UUID string

    # Randomize condition (avatar & LSM) - this logic should be here
    avatar  = random.choice([True, False])
    lsm     = random.choice([True, False])
    condition = {"avatar": avatar, "lsm": lsm}

    # Prepare log file path and initial session data structure
    timestamp_str = time.strftime("%Y%m%d_%H%M%S", time.gmtime()) # UTC time
    log_filename = f"participant_{pid}_{sid}.jsonl"
    log_file_path = os.path.join(LOG_DIR, log_filename)

    _sessions[sid] = {
        "participantId": pid,
        "sessionId": sid,
        "condition": condition,
        "log_file_path": log_file_path,
        "turn_number": 0, # Initialize turn number
        "smoothed_lsm_score": 0.5, # Initialize smoothed LSM
        "history": [] # Initialize history
    }

    # --- Generate and Log Initial Greeting (Turn 0) ---
    # Use the logic function to get the initial greeting
    # No user prompt, empty history for the first call
    # Pass session_info to LLM function for potential internal logging/context
    initial_style_profile = {} # No user input yet
    try:
        initial_greeting_raw, system_instr = await get_gemini_response(
            user_prompt="<System Initialized>", # Internal marker for LLM context if needed
            chat_history=[],
            is_adaptive=condition['lsm'],
            show_avatar=condition['avatar'],
            style_profile=initial_style_profile # Empty profile for turn 0
            # Add session_info= _sessions[sid] here if your get_gemini_response accepts it for logging
        )
        # Post-process the raw greeting based on the assigned condition
        initial_greeting_processed = post_process_response(initial_greeting_raw, condition['lsm'])
    except Exception as e:
        print(f"Error generating initial greeting for session {sid}: {e}")
        initial_greeting_processed = "Hello! I'm ready to help you with your shopping." # Fallback
        system_instr = "" # No instruction used for fallback


    # Add initial greeting to session history
    _sessions[sid]["history"].append({
        "role": "assistant",
        "content": initial_greeting_processed,
        "turn_number": 0,
        "small_avatar_used": AVATAR_IMAGE_PATH if condition['avatar'] else None # Store avatar identifier
        # You could store more metadata here if needed, but keep it minimal for history passed to LLM
    })

    # Log session start event (after history is initialized with greeting)
    # Pass the current state of _sessions[sid] to log_event
    log_event({
        "event_type": "session_start",
        "initial_condition": condition,
        "initial_greeting": initial_greeting_processed,
        "system_instruction_initial": system_instr # Log the prompt used for greeting
    }, session_info=_sessions[sid])


    # Return session details and the initial message(s) to the frontend
    return SessionStartResponse(
        sessionId=sid,
        condition=condition,
        initialHistory=_sessions[sid]["history"] # Return the history, which contains the first message
    )


# --- Endpoint: handle a message ---
@app.post("/api/session/message", response_model=MessageResponse)
async def handle_message(req: MessageRequest): # Needs to be async because get_gemini_response is async
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


    # --- Logging User Message ---
    # 3. Log user message event
    log_event({
        "event_type": "user_message",
        # turn_number is added by log_event using session info
        "user_prompt": user_text,
        "style_profile": traits # Log the full detected profile (includes prev smoothed LSM)
    }, session_info=session)

    # Add user message to session history *before* calling the LLM for context
    session["history"].append({
        "role": "user",
        "content": user_text,
        "turn_number": current_turn
        # Could add user avatar here if you had one
    })


    # --- Generating Bot Response ---
    # 4. Generate Bot Response using ported get_gemini_response
    # Pass the session history *including* the current user message now added
    try:
        # get_gemini_response returns raw text and system instruction used
        bot_response_raw, system_instr_used = await get_gemini_response(
            user_prompt=user_text, # This might be redundant if chat_history includes it,
                                   # but good practice to pass the explicit query.
            chat_history=session["history"], # Pass the full history including the user's latest message
            is_adaptive=condition["lsm"],
            show_avatar=condition["avatar"],
            style_profile=traits # Pass the profile containing prev smoothed LSM
            # Add session_info=session here if your get_gemini_response accepts it for logging
        )
    except Exception as e:
         # Log the error specifically if get_gemini_response doesn't handle all errors
         print(f"Critical Error in get_gemini_response for session {sid}, turn {current_turn}: {e}")
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
    # Need bot token count for LSM smoothing check. Use a simple split or re-call tokenize_text.
    # Re-calling detect_style_traits might be safer if it includes markdown cleaning etc.
    # Or just use a simple split for token count check:
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
    # 7. Add bot message to session history
    session["history"].append({
         "role": "assistant",
         "content": processed_bot_response,
         "turn_number": current_turn, # Turn number for this pair
         "small_avatar_used": AVATAR_IMAGE_PATH if condition['avatar'] else None # Store avatar identifier
         # Could store raw_lsm, smoothed_lsm_after_turn, system_instruction_used here too if needed in history for display/debug
    })


    # 8. Log bot response event
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

# Add any other endpoints like session end/timeout redirection here
@app.post("/api/avatar/generate")
async def generate_avatar(req: AvatarRequest):
    if not openai.api_key:
        raise HTTPException(500, detail="OpenAI API key not configured on server.")
    try:
        # Call OpenAI Image API for 1024×1024
        resp = openai.Image.create(
            prompt=req.prompt,
            n=1,
            size="1024x1024",
            model="dall-e-3"
        )
        url = resp["data"][0]["url"]
        return {"url": url}

    except openai.error.OpenAIError as e:
        # Bubble up any API errors
        raise HTTPException(502, detail=f"OpenAI API error: {e}")