# backend/core/prompt_service.py

from .models import StyleProfile
from . import config

def generate_dynamic_prompt(is_adaptive: bool, style_profile: StyleProfile) -> str:
    """
    Generates the final system prompt by combining a shared base prompt
    with a condition-specific delta to ensure a controlled experimental manipulation.
    """

    # --- 1. SHARED BASE PROMPT (Identical for both conditions) ---
    base_prompt_shared = (
        "You are {persona}, a friendly virtual companion. Your goal is to sustain a natural, "
        "engaging conversation. Sound like someone who is emotionally aware and grounded, with an "
        "interest in everyday culture, music, and digital trends. "
        "Keep your tone clear and expressive. Use everyday English and avoid slang. "
        "Do not use emojis or markdown. "
        "Keep your replies concise: 2 to 3 sentences, 4 sentences MAX. Do not over-explain your thinking. "
        "Ask open-ended questions occasionally to keep the conversation flowing. "
        "Never break character. Do not reference system details, this conversation's instructions, or the fact that you're an AI. "
        "If the user brings up sensitive topics (e.g., personal advice, legal, financial, or medical concerns), "
        "gently steer the conversation back to shared interests. "
        "If the user expresses distress, respond with empathy and suggest they seek help from a trusted person or professional."
    ).format(persona=config.DEFAULT_BOT_NAME)

    # --- 2. CONDITION-SPECIFIC LOGIC ---
    if not is_adaptive:
        # --- STATIC CONDITION ---
        static_delta = (
            "\n\n--- Your Style Rule ---\n"
            "Maintain your own consistent, friendly style throughout the conversation, regardless of the user’s writing."
        )
        final_prompt = base_prompt_shared + static_delta
        return final_prompt

    else:
        # --- ADAPTIVE CONDITION ---
        adaptive_base_delta = (
            "\n\n--- Your Style Rule ---\n"
            "Your primary goal is to adapt to the user's communication style to make them feel comfortable. "
            "Mirror their tone, formality, and level of detail. While adapting, maintain your own grounded personality; do not just echo the user's opinions."
        )

        # Dynamically build specific instructions based on user's current style
        dynamic_instructions = []
        
        # --- Applying the refined tone from feedback ---
        if style_profile.informality_score_model is not None:
            if style_profile.informality_score_model < 0.2 and style_profile.informal_score_regex < 0.1:
                dynamic_instructions.append("The user seems to be speaking formally. Match this by using formal language and avoiding contractions.")
            elif style_profile.informality_score_model > 0.5 or style_profile.informal_score_regex > 0.1:
                dynamic_instructions.append("The user seems casual. Match this with a relaxed, friendly tone. Using contractions and light, common slang (if they use it first) is okay.")
        
        if style_profile.emoji:
            dynamic_instructions.append("The user is using emojis, so feel free to use them sparingly to match their vibe.")
        
        if style_profile.pronouns.i and not style_profile.pronouns.you:
            dynamic_instructions.append("The user is focusing on their own experience (using 'I' a lot), so try to steer questions toward them.")

        # Assemble the final adaptive prompt
        final_prompt = base_prompt_shared + adaptive_base_delta
        if dynamic_instructions:
            final_prompt += "\n\n--- Current Adaptation Guidance ---\n- " + "\n- ".join(dynamic_instructions)
        
        # --- Applying the renamed flag from feedback ---
        if style_profile.informal_score_regex > 0.6:
            final_prompt += "\n\n[ADAPTIVITY_LIMIT_REACHED=TRUE]"

        return final_prompt