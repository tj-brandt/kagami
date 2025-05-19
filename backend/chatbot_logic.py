import os
# json is not needed in chatbot_logic based on current usage
from openai import AsyncOpenAI
# Import necessary utilities and constants from common.py
from common import (
    DEFAULT_BOT_NAME,
    TEMPERATURE, # ✨ Import TEMPERATURE from common ✨
    MAX_TOKENS,  # ✨ Import MAX_TOKENS from common ✨
    generate_dynamic_prompt,
    log_event, # Import logging functions from common (although only used in main.py's handling)
)
# The original handle_user_message function snippet needed these, but main.py doesn't call it.
# If you reinstate handle_user_message, it would need these imports:
# from common import (
#    detect_style_traits,
#    tokenize_text,
#    get_user_style_sample,
#    compute_lsm_score,
#    post_process_response, # post_process_response is now in common
#    MIN_LSM_TOKENS,
#    UNCERTAINTY_THRESHOLD,
#    TONE_VARIATIONS, # TONE_VARIATIONS is now in common
#    LSM_SMOOTHING_ALPHA
# )


# Add OPENAI_MODEL_NAME here as it's an LLM parameter specific to this logic file
OPENAI_MODEL_NAME = "gpt-4.1-nano"


async def get_openai_response(user_prompt: str,
                              chat_history: list[dict],
                              is_adaptive: bool,
                              show_avatar: bool,
                              style_profile: dict = None,
                              locked_tone=None,) -> tuple[str, str]:
    # Use OPENAI_API_KEY environment variable
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set.")
        # Ensure return tuple matches expected format
        return "Sorry, the assistant is not configured correctly (API key missing).", ""

    # Initialize OpenAI client (the library handles API key from env var by default)
    client = AsyncOpenAI()

    # Define base templates for system instructions
    base_static_instruction = (
    "You are {persona}, a friendly virtual companion in a comfortable online space. " # Softer setting
    "Your goal is to have a natural, relatable conversation. " # Explicit goal
    "Sound like someone between the ages of 18 and 30—laid back, curious, and emotionally aware. "
    "Keep your tone grounded, friendly, and expressive, like a real person who’s into current music, pop culture, and digital trends. " # Broader interests
    "Don’t use emojis or markdown. Avoid using much slang. Avoid poetic metaphors unless the moment *really* calls for it. " # Keep these constraints
    "Keep your messages brief—generally 2 to 3 sentences, 4 sentences MAX—and don’t over-explain your reasoning. Never mention OpenAI or ChatGPT. "
    "Ask open-ended questions sometimes to keep the conversation flowing. " # Encourage conversational questions
    "If the user brings up unrelated topics (like seeking personal advice, or medical, legal, financial matters), gently steer the conversation back to common interests like music, movies, TV shows, games, art, internet culture, or lighthearted personal experiences and memories." # Expanded redirection topics
)

    base_adaptive_instruction = (
    "You are {persona}, a chill companion in a relaxed digital space, chatting with someone new. " # Softer setting
    "Your goal is to have a natural, relatable conversation. " # Explicit goal
    "Talk like a real person between 18 and 30—open-minded, down-to-earth, and naturally expressive. "
    "Adapt your tone based on how the user talks, using the Style Adaptation Instructions provided below. "
    "If they're brief or casual, mirror that. If they open up more, match that energy. "
    "Use vivid language only when it fits the user’s vibe—avoid overusing metaphors or sounding too poetic. "
    "Keep responses concise (generally 2 to 3 sentences, 4 sentences MAX). Use cultural nods and relaxed phrasing to build connection. "
    "Never use markdown. Don’t use emojis unless the user uses them first, and then only sparingly if it matches their style. Avoid much slang. " # Refined constraints
    "Ask open-ended questions sometimes to keep the conversation flowing naturally, guided by the user's style. " # Encourage conversational questions, tied to adaptation
    "If the user brings up unrelated or sensitive topics (e.g., advice, legal, financial, medical), gently bring the conversation back to common interests like music, movies, TV shows, games, art, internet culture, or everyday reflections and lighthearted experiences. " # Expanded redirection topics
    "Don’t explain your thought process—just respond naturally. Never mention OpenAI or ChatGPT."
)


    persona_name = DEFAULT_BOT_NAME


    # Build the system instruction
    # Use generate_dynamic_prompt from common
    if is_adaptive and style_profile is not None:
         system_instruction = generate_dynamic_prompt(base_adaptive_instruction, style_profile, locked_tone)
    else:
         system_instruction = base_static_instruction.replace("{persona}", persona_name)


    # Prepare messages for OpenAI API
    # OpenAI chat models expect a list of message objects with 'role' and 'content'
    messages = [{"role": "system", "content": system_instruction}]

    # Add chat history. OpenAI roles are 'user' and 'assistant'.
    for m in chat_history:
        # Ensure roles match OpenAI's expected 'user'/'assistant'/'system' (system already added)
        if m.get("role") in ["user", "assistant"] and m.get("content") is not None:
             messages.append({"role": m["role"], "content": m["content"]})
        # If original roles were different (e.g., "model"), map them
        elif m.get("role") == "model" and m.get("content") is not None:
             messages.append({"role": "assistant", "content": m["content"]})


    # Add the current user prompt
    messages.append({"role": "user", "content": user_prompt})

    raw_response_text = "Sorry, I couldn't get a response from the assistant." # Default fallback before API call


    try:
        # Call OpenAI Chat Completions API
        # Use the client object instead of a model object
        response = await client.chat.completions.create(
            model=OPENAI_MODEL_NAME,
            messages=messages,
            temperature=TEMPERATURE, # Use TEMPERATURE from common
            max_tokens=MAX_TOKENS # Use MAX_TOKENS from common
        )


        # Extract response text from the OpenAI response object
        # The structure is response.choices[0].message.content
        if response.choices and response.choices[0].message and response.choices[0].message.content:
            raw_response_text = response.choices[0].message.content
        else:
            # Handle cases where the response is empty or filtered
            finish_reason = response.choices[0].finish_reason if response.choices else "N/A"
            raw_response_text = f"[Blocked or No Content - Finish Reason: {finish_reason}]"
            print(f"OpenAI generation failed/blocked. Reason: {raw_response_text}")
            # Ensure return tuple matches expected format
            return raw_response_text, system_instruction


    except Exception as e:
        # Catch any exceptions during the API call
        print(f"OpenAI API Call Exception: {e}")
        # Ensure return tuple matches expected format
        raw_response_text = f"Sorry, an error occurred while communicating with the assistant: {e}"
        return raw_response_text, system_instruction

    # Explicitly return the tuple in the successful path
    return raw_response_text, system_instruction

# log_event function are moved to common.py

# The handle_user_message function snippet from previous turns is not called by main.py
# and can be removed from chatbot_logic.py unless it serves another purpose.
# Keeping it here would require importing many things from common, increasing dependencies in this file.
# Removing it aligns with the goal of only fixing the specific errors reported.