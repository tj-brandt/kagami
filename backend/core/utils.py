# backend/core/utils.py
import re
from typing import List, Dict

def post_process_response(resp: str, is_adaptive: bool) -> str:
    """Cleans up the raw response from the LLM."""
    processed_resp = resp.strip()
    processed_resp = re.sub(r'\s{2,}', ' ', processed_resp)
    processed_resp = re.sub(r"([^\n])(\n?)(\s*[\*-]\s+)", r"\1\n\3", processed_resp)
    processed_resp = re.sub(r'\s{2,}', ' ', processed_resp).strip()
    processed_resp = re.sub(r'\n{3,}', '\n\n', processed_resp)
    return processed_resp

def get_user_style_sample(chat_history: List[Dict[str, str]], max_lookback: int = 3) -> str:
    """Gets a concatenated string of recent user turns for LSM analysis."""
    recent_user_turns = [m["content"] for m in reversed(chat_history) if m["role"] == "user"]
    return " ".join(recent_user_turns[:max_lookback])