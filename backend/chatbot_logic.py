# backend/chatbot_logic.py
import os
from openai import AsyncOpenAI
from core.models import StyleProfile
from core.prompt_service import generate_dynamic_prompt
from core import config
from core.config import settings

async def get_openai_response(
    user_prompt: str,
    chat_history: list[dict],
    is_adaptive: bool,
    style_profile: StyleProfile,
) -> tuple[str, str, dict | None]:
    """
    Generates a response from OpenAI using production settings.
    It delegates all prompt creation logic to the prompt_service.
    """
    if os.getenv("KAGAMI_MOCK") == "1":
        print("--- MOCK MODE ENABLED: Returning canned response. ---")
        return ("This is a mock response from Kagami.", "mock_system_prompt", None)
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


    # 1. Generate the entire system prompt from the prompt service.
    system_instruction = generate_dynamic_prompt(is_adaptive, style_profile)
    
    # 2. Assemble messages for the API call.
    messages = [{"role": "system", "content": system_instruction}]
    messages.extend([{"role": m["role"], "content": m["content"]} for m in chat_history if m.get("role") in ["user", "assistant"] and m.get("content") is not None])
    messages.append({"role": "user", "content": user_prompt})

    usage = None
    try:
        # 3. Call the OpenAI API with production settings.
        response = await client.chat.completions.create(
            model=config.OPENAI_MODEL_NAME,
            messages=messages,
            temperature=config.TEMPERATURE,
            max_tokens=config.MAX_TOKENS
        )
        response_text = response.choices[0].message.content or "[Blocked or Empty Response]"
        usage = response.usage
    except Exception as e:
        print(f"ERROR: OpenAI API call failed: {e}")
        response_text = "Sorry, an error occurred on my end."

    return response_text, system_instruction, usage