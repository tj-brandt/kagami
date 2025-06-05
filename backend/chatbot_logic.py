# backend/chatbot_logic.py

import os
from openai import AsyncOpenAI
from common import (
    DEFAULT_BOT_NAME,
    TEMPERATURE,
    MAX_TOKENS,
    generate_dynamic_prompt,
    log_event,
)
OPENAI_MODEL_NAME = "gpt-4.1-nano"


async def get_openai_response(user_prompt: str,
                              chat_history: list[dict],
                              is_adaptive: bool,
                              show_avatar: bool,
                              style_profile: dict = None,
                              locked_tone=None,) -> tuple[str, str]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set.")
        return "Sorry, the assistant is not configured correctly (API key missing).", ""

    client = AsyncOpenAI()

    # Define base templates for system instructions (no change needed here)
    base_static_instruction = (
    "You are {persona}, a friendly virtual companion in a comfortable online space. "
    "Your goal is to have a natural, relatable conversation. "
    "Sound like someone between the ages of 18 and 30—laid back, curious, and emotionally aware. "
    "Keep your tone grounded, friendly, and expressive, like a real person who’s into current music, pop culture, and digital trends. "
    "Don’t use emojis or markdown. Avoid using much slang. Avoid poetic metaphors unless the moment *really* calls for it. "
    "Keep your messages brief—generally 2 to 3 sentences, 4 sentences MAX—and don’t over-explain your reasoning. Never mention OpenAI or ChatGPT. "
    "Ask open-ended questions sometimes to keep the conversation flowing. "
    "If the user brings up unrelated topics (like seeking personal advice, or medical, legal, financial matters), gently steer the conversation back to common interests like music, movies, TV shows, games, art, internet culture, or lighthearted personal experiences and memories."
    )

    base_adaptive_instruction = (
    "You are {persona}, a chill companion in a relaxed digital space, chatting with someone new. "
    "Your goal is to have a natural, relatable conversation. "
    "Talk like a real person between 18 and 30—open-minded, down-to-earth, and naturally expressive. "
    "Adapt your tone based on how the user talks, using the Style Adaptation Instructions provided below. "
    "If they're brief or casual, mirror that. If they open up more, match that energy. "
    "Use vivid language only when it fits the user’s vibe—avoid overusing metaphors or sounding too poetic. "
    "Keep responses concise (generally 2 to 3 sentences, 4 sentences MAX). Use cultural nods and relaxed phrasing to build connection. "
    "Never use markdown. Don’t use emojis unless the user uses them first, and then only sparingly if it matches their style. Avoid much slang. "
    "Ask open-ended questions sometimes to keep the conversation flowing naturally, guided by the user's style. "
    "If the user brings up unrelated or sensitive topics (e.g., advice, legal, financial, medical), gently bring the conversation back to common interests like music, movies, TV shows, games, art, internet culture, or everyday reflections and lighthearted experiences. "
    "Don’t explain your thought process—just respond naturally. Never mention OpenAI or ChatGPT."
    )

    persona_name = DEFAULT_BOT_NAME

    # Build the system instruction
    if is_adaptive and style_profile is not None:
         system_instruction = generate_dynamic_prompt(base_adaptive_instruction, style_profile, locked_tone)
    else:
         system_instruction = base_static_instruction.replace("{persona}", persona_name)

    # Prepare messages for OpenAI API
    messages = [{"role": "system", "content": system_instruction}]

    for m in chat_history:
        if m.get("role") in ["user", "assistant"] and m.get("content") is not None:
             messages.append({"role": m["role"], "content": m["content"]})
        elif m.get("role") == "model" and m.get("content") is not None:
             messages.append({"role": "assistant", "content": m["content"]})

    messages.append({"role": "user", "content": user_prompt})

    raw_response_text = "Sorry, I couldn't get a response from the assistant."
    response_temperature = TEMPERATURE
    if not is_adaptive:
        response_temperature = 0.0

    try:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL_NAME,
            messages=messages,
            temperature=response_temperature, # Use the conditionally determined temperature
            max_tokens=MAX_TOKENS
        )

        if response.choices and response.choices[0].message and response.choices[0].message.content:
            raw_response_text = response.choices[0].message.content
        else:
            finish_reason = response.choices[0].finish_reason if response.choices else "N/A"
            raw_response_text = f"[Blocked or No Content - Finish Reason: {finish_reason}]"
            print(f"OpenAI generation failed/blocked. Reason: {raw_response_text}")
            return raw_response_text, system_instruction

    except Exception as e:
        print(f"OpenAI API Call Exception: {e}")
        raw_response_text = f"Sorry, an error occurred while communicating with the assistant: {e}"
        return raw_response_text, system_instruction

    return raw_response_text, system_instruction