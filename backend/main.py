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
from datetime import datetime

from drive_upload import upload_log_to_drive

# Load environment variables
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional

# Run NLTK download/check on startup
import download_nltk_data

STATIC_AVATAR_DIR = "static/generated"
# Ensure static directory exists
os.makedirs(STATIC_AVATAR_DIR, exist_ok=True)

# Import common utilities
from common import (
    detect_style_traits,
    compute_lsm_score,
    post_process_response,
    log_event,
    log_avatar,
    MIN_LSM_TOKENS,
    LSM_SMOOTHING_ALPHA,
    LOG_DIR,
    DEFAULT_BOT_NAME,
    tokenize_text,
    TEMPERATURE,
    MAX_TOKENS,
    get_user_style_sample,
)
from chatbot_logic import get_openai_response


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
        "dreamy": {"feelings": ["dreamy","soft","floaty","hazy"],
                   "references": [
                       "like the dreamy opening track of a Beach House album.",
                       "like discovering a hidden gem on SoundCloud at 3 AM.",
                       "like a Studio Ghibli scene just before something magical happens.",
                       "like a faded Polaroid of a summer you almost remember."
                   ]},
        "energetic": {"feelings": ["energetic","bright","pumped","charged","awake"],
                       "references": [
                           "like hitting a perfect combo in DDR.",
                           "like when your favorite Charli XCX track kicks in at full volume.",
                           "like a Friday morning with a fresh playlist drop.",
                           "like an early 2000s pop anthem blasting through wired headphones."
                       ]},
        "nostalgic": {"feelings": ["nostalgic","familiar","reflective","bittersweet"],
                       "references": [
                           "like scrolling Tumblr at 2 AM in 2013.",
                           "like customizing your Myspace profile back in the day.",
                           "like the sound of booting up an iPod Classic.",
                           "like an old MSN away message you forgot you wrote."
                       ]},
        "chill": {"feelings": ["chill","calm","relaxed","mellow"],
                  "references": [
                      "like lo-fi beats echoing in a quiet room.",
                      "like a long walk with no destination.",
                      "like your favorite hoodie and a cup of something warm.",
                      "like being underwater with headphones on."
                  ]},
        "cozy": {"feelings": ["cozy","warm","vibey","relaxed"],
                  "references": [
                      "like redecorating your Animal Crossing home on a rainy day.",
                      "like finding a soft corner of the internet that still feels alive.",
                      "like opening a well-worn book and knowing the first line by heart.",
                      "like your favorite fuzzy socks and a playlist that understands you."
                  ]}
    }
    weights = {
        "morning": ["energetic"]*3 + ["chill"]*2 + ["cozy"],
        "afternoon": ["chill"]*2 + ["cozy","nostalgic"],
        "evening": ["nostalgic","cozy","dreamy"]*2,
        "night": ["dreamy"]*3 + ["nostalgic","cozy"]
    }
    questions = {
        "morning":[
            "What kind of music gets you moving in the morning?",
            "Got a favorite playlist or podcast that kicks off your day?",
            "Do you ever watch anything while eating breakfast — YouTube, cartoons, a comfort show?"
        ],
        "afternoon":[
            "What song’s been stuck in your head today?",
            "Caught anything good on your breaks — a TikTok series, a quick episode?",
            "What’s your ideal chill vibe this afternoon — music, a show, or a bit of both?"
        ],
        "evening":[
            "What’s your go-to comfort show or movie when you’re done with the day?",
            "Heard any good albums or playlists lately for winding down?",
            "What kinds of stories pull you in at night — drama, fantasy, real-life stuff?",
            "Do you have a favorite rewatch for evenings, or do you like trying something new?",
            "What’s your perfect soundtrack for golden-hour walks or chill evenings?"
        ],
        "night":[
            "What's your ideal nighttime vibe — comfort rewatch, deep dive, or scroll spiral?",
            "Got a favorite playlist or show you always come back to late at night?"
        ]
    }
    theme = random.choice(weights.get(time_label, list(themes.keys())))
    feeling = random.choice(themes[theme]["feelings"])
    reference = random.choice(themes[theme]["references"])
    greeting = random.choice(greetings)
    question = random.choice(questions.get(time_label, []))
    if random.choice([True,False]):
        return f"{greeting} This {time_label} feels a little {feeling}. It’s {reference} {question}"
    return f"{greeting} To me, this {time_label} feels {feeling}, {reference} {question}"

# --- OpenAI Image Edits via GPT-Image-1 ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY environment variable.")

# --- FastAPI Setup ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

origins = ["http://localhost:3000","http://127.0.0.1:3000","https://kagami.chat","https://kagami-gkcw.onrender.com"]
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

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)
_sessions: Dict[str, Dict[str, Any]] = {}

# --- Pydantic Models ---
class SessionStartRequest(BaseModel):
    participantId: Optional[str] = None
    avatarUrl: Optional[str] = None
    avatarPrompt: Optional[str] = None
    condition: Optional[Dict[str, bool]] = None

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

class AvatarRequest(BaseModel):
    prompt: str
    sessionId: str

class AvatarResponse(BaseModel):
    url: str
    prompt: str

# --- Session End ---
@app.post("/api/session/end")
async def end_session(req: MessageRequest):
    sid = req.sessionId
    session = _sessions.pop(sid, None)
    if session:
        log_event({"event_type": "session_end"}, session_info=session)
        try:
            upload_log_to_drive(session.get("log_file_path"))
        except Exception as e:
            print(f"Log upload failed for session {sid}: {e}")
        return {"message": f"Session {sid} ended successfully."}
    raise HTTPException(status_code=404, detail="Session not found")

# --- Root/Health Check ---
@app.get("/")
async def read_root():
    return {"message": "Kagami Chat — backend humming smoothly."}

# --- Run with Uvicorn if Executed Directly ---
if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
    # --- Avatar Generation Endpoint ---
@app.post("/api/avatar/generate", response_model=AvatarResponse)
async def generate_avatar(req: AvatarRequest):
    sid = req.sessionId
    session = _sessions.get(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if len(session["generated_avatars"]) >= 5:
        raise HTTPException(status_code=400, detail="Maximum avatar generations reached")

    base_image_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/src/assets/avatars/kagami.png"))
    if not os.path.exists(base_image_path):
        raise HTTPException(status_code=500, detail="Base image not found")

    base_prompt_template = (
        "Edit this cute 3D animal character to match: [__USER_PROMPT__]. "
        "Keep the exact same pose, sitting with legs crossed and hands in the same position. "
        "Maintain a perfectly front-facing camera angle (0° yaw, 0° pitch, 0° roll), with no tilt or rotation. "
        "The entire full-body must remain fully visible, centered, and proportional within the 1024×1024 frame. "
        "Preserve the soft Animal Crossing style. "
        "Only modify the animal species, accessories, and clothing based on the prompt. "
        "**The background must remain fully transparent, with no scenery, patterns, colors, or objects added.**"
    )

    user_prompt = req.prompt.strip()
    if not user_prompt:
        raise HTTPException(status_code=400, detail="Avatar prompt cannot be empty")
    final_prompt = base_prompt_template.replace("[__USER_PROMPT__]", user_prompt)

    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    with open(base_image_path, "rb") as img_file:
        files = {"image": (os.path.basename(base_image_path), img_file, "image/png")}
        data = {
            "model": "gpt-image-1",
            "prompt": final_prompt,
            "size": "1024x1024",
            "quality": "medium",
            "background": "transparent",
        }
        response = requests.post("https://api.openai.com/v1/images/edits", headers=headers, files=files, data=data, timeout=120)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"OpenAI API Error: {response.text}")

    image_b64 = response.json()["data"][0].get("b64_json")
    if not image_b64:
        raise HTTPException(status_code=500, detail="Image generation failed: No image data returned")

    image_bytes = base64.b64decode(image_b64)
    filename = f"{sid}_avatar{len(session['generated_avatars']) + 1}.png"
    filepath = os.path.join(STATIC_AVATAR_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    url = f"/static/generated/{filename}"
    avatar_entry = {"url": url, "prompt": user_prompt}
    session["generated_avatars"].append(avatar_entry)
    log_avatar(session["participantId"], url, user_prompt)
    log_event({
        "event_type": "avatar_generated",
        "avatar_prompt": user_prompt,
        "avatar_url": url
    }, session_info=session)

    return AvatarResponse(url=url, prompt=user_prompt)

# --- Session Start ---
@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest):
    pid = req.participantId.zfill(2) if req.participantId else "00"
    sid = str(uuid.uuid4())
    condition = req.condition or {
        "lsm": random.choice([True, False]),
        "avatar": random.choice([True, False])
    }

    log_file_path = os.path.join(LOG_DIR, f"participant_{pid}_{sid}.jsonl")
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
        "generated_avatars": []
    }

    session = _sessions[sid]
    if req.avatarUrl and req.avatarPrompt:
        try:
            log_avatar(pid, req.avatarUrl, req.avatarPrompt)
        except Exception as e:
            print(f"Avatar logging failed: {e}")

    try:
        initial_greeting = generate_natural_greeting()
    except Exception as e:
        print(f"Greeting generation failed: {e}")
        initial_greeting = f"Hey there, I'm {DEFAULT_BOT_NAME}. Glad you could make it."

    session["history"].append({
        "role": "assistant",
        "content": initial_greeting,
        "turn_number": 0,
        "avatar_url": session.get("avatar_url")
    })

    log_event({
        "event_type": "session_start",
        "participant_id": pid,
        "session_id": sid,
        "initial_condition": condition,
        "initial_greeting": initial_greeting
    }, session_info=session)

    return SessionStartResponse(
        sessionId=sid,
        condition=condition,
        initialHistory=session["history"]
    )

# --- Message Handling ---
@app.post("/api/session/message", response_model=MessageResponse)
async def handle_message(req: MessageRequest):
    sid = req.sessionId
    session = _sessions.get(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session["turn_number"] += 1
    user_text = req.message
    current_turn = session["turn_number"]
    condition = session["condition"]

    # Analyze user style
    traits = detect_style_traits(user_text)
    user_token_count = traits.get("word_count", 0)
    traits["lsm_score_prev"] = session.get("smoothed_lsm_score", 0.5)

    session["history"].append({
        "role": "user",
        "content": user_text,
        "turn_number": current_turn
    })
    log_event({"event_type": "user_message", "content": user_text, "traits": traits}, session_info=session)

    # Get bot response
    bot_raw, _ = await get_openai_response(
        user_prompt=user_text,
        chat_history=session["history"],
        is_adaptive=condition["lsm"],
        show_avatar=bool(session.get("avatar_url")),
        style_profile=traits
    )

    bot_response = post_process_response(bot_raw, condition["lsm"])
    bot_traits = detect_style_traits(bot_response)
    bot_token_count = bot_traits.get("word_count", 0)

    # LSM calculation
    recent_sample = get_user_style_sample(session["history"])
    user_sample = recent_sample if recent_sample else user_text
    raw_lsm = compute_lsm_score(user_sample, bot_response)

    update_smoothed = (
        user_token_count >= MIN_LSM_TOKENS and
        bot_token_count >= MIN_LSM_TOKENS
    )
    prev_score = session.get("smoothed_lsm_score", 0.5)
    new_score = (
        (LSM_SMOOTHING_ALPHA * raw_lsm) +
        ((1 - LSM_SMOOTHING_ALPHA) * prev_score)
    ) if update_smoothed else prev_score

    session["smoothed_lsm_score"] = new_score
    session["history"].append({
        "role": "assistant",
        "content": bot_response,
        "turn_number": current_turn,
        "avatar_url": session.get("avatar_url")
    })

    log_event({
        "event_type": "bot_response",
        "content": bot_response,
        "lsm_score_raw": raw_lsm,
        "lsm_score_smoothed": new_score
    }, session_info=session)

    return MessageResponse(
        response=bot_response,
        styleProfile=traits,
        lsmScore=raw_lsm,
        smoothedLsmAfterTurn=new_score
    )
