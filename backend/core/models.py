# backend/core/models.py
from pydantic import BaseModel, Field
from typing import Optional, Dict

class PronounProfile(BaseModel):
    i: bool
    you: bool
    we: bool

class StyleProfile(BaseModel):
    word_count: int
    informal_score_regex: float
    informality_score_model: Optional[float]
    hedging_score: float
    emoji: bool
    questioning: bool
    exclamatory: bool
    short: bool
    question_count: int
    exclamation_count: int
    meta_request: Optional[str]
    sentiment_neg: float
    sentiment_neu: float
    sentiment_pos: float
    sentiment_compound: float
    avg_sentence_length: float
    avg_word_length: float
    flesch_reading_ease: float
    fk_grade: float
    function_word_ratio: float
    empath_social: float
    empath_cognitive: float
    empath_affect: float
    pronouns: PronounProfile
    lsm_score_prev: Optional[float] = None
    error: Optional[str] = None