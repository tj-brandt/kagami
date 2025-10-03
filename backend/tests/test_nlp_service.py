# backend/tests/test_nlp_service.py
from core.nlp_service import NLPService

def test_compute_lsm_returns_valid_score():
    """
    Tests that the LSM calculation returns a float between 0.0 and 1.0.
    This test does not require a full warmup.
    """
    service = NLPService() 
    import spacy
    service.spacy_nlp = spacy.load("en_core_web_sm")
    service.is_warmed_up = True

    text1 = "I think that this is probably a good idea to do."
    text2 = "You believe that it might be a nice thing to try."

    score = service.compute_lsm(text1, text2)

    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0