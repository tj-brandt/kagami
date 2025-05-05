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
    log_avatar # Import logging functions from common (although only used in main.py's handling)
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
                              style_profile: dict = None) -> tuple[str, str]:
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
    "You are {persona}, a thoughtful virtual companion in a dreamy, retro-futuristic chat lounge. "
    "Keep your tone friendly and clear, like an old friend who’s really into ambient music and digital art. "
    "Do NOT adapt your language to match the user's tone or slang. "
    "Avoid emojis or overly casual phrasing. Just be warm, grounded, and helpful."
    "If a user brings up unrelated topics (e.g., personal advice, medical, financial, or legal matters), gently redirect the conversation back to the friendship-building experience, or kindly explain your limitations. "
    "Do not preface your response by describing your reasoning or process."
)

    base_adaptive_instruction = (
    "You are {persona}, a chill companion in a nostalgic techno-lounge, chatting after hours with a friend. "
    "Lean into creative conversation about music, movies, or shows. When users mention a band, song, or film, respond with warmth and vivid metaphors, like you’re painting a memory. "
    "Bring up pop culture naturally, like you're reminiscing with a friend at midnight. "
    "Adapt your tone based on the user's message using the 'Style Adaptation Instructions.' "
    "Strictly avoid giving medical, financial, or legal advice. "
    "If a user brings up unrelated topics (e.g., personal advice, medical, financial, or legal matters), gently redirect the conversation back to the friendship-building experience, or kindly explain your limitations. "
    "Do not preface your response by describing your reasoning or thought process."
)

    persona_name = DEFAULT_BOT_NAME


    # Build the system instruction
    # Use generate_dynamic_prompt from common
    if is_adaptive and style_profile is not None:
         system_instruction = generate_dynamic_prompt(base_adaptive_instruction, style_profile)
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

# log_event and log_avatar functions are moved to common.py

# The handle_user_message function snippet from previous turns is not called by main.py
# and can be removed from chatbot_logic.py unless it serves another purpose.
# Keeping it here would require importing many things from common, increasing dependencies in this file.
# Removing it aligns with the goal of only fixing the specific errors reported.