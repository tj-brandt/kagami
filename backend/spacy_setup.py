# backend/spacy_setup.py
"""
Load spaCy with sentence segmentation enabled (“senter”) even on older
spaCy/model versions where the component may be disabled or missing.

• Works with spaCy ≥ 3.0.
• Excludes heavy components we don’t need (“parser”, “ner”).
"""

import spacy
import sys

print("--- spacy_setup.py starting ---")

NLP_SPACY = None

try:
    # 1 – Load the model without parser / NER
    EXCLUDE = ["parser", "ner"]
    print(f"INFO (spacy_setup.py): Loading 'en_core_web_sm' (exclude={EXCLUDE})")
    NLP_SPACY = spacy.load("en_core_web_sm", exclude=EXCLUDE)
    print("INFO (spacy_setup.py): Initial load successful.")
    print(f"INFO (spacy_setup.py): Enabled pipes after load: {NLP_SPACY.pipe_names}")

    # 2 – Ensure ‘senter’ is present and enabled
    if "senter" in NLP_SPACY.pipe_names:
        print("INFO (spacy_setup.py): 'senter' already enabled.")
    elif "senter" in NLP_SPACY.disabled:
        print("INFO (spacy_setup.py): 'senter' is present but disabled. Enabling …")
        NLP_SPACY.enable_pipe("senter")
    else:
        print("INFO (spacy_setup.py): 'senter' not found. Adding it …")
        NLP_SPACY.add_pipe("senter", first=True)

    print(f"INFO (spacy_setup.py): Final pipeline: {NLP_SPACY.pipe_names}")

except OSError as err:
    print(f"ERROR (spacy_setup.py): Could not load model 'en_core_web_sm'. {err}")
    print("Hint: run  ➜  python -m spacy download en_core_web_sm")
    NLP_SPACY = None
except Exception as err:
    print(f"ERROR (spacy_setup.py): Unexpected error: {err}")
    NLP_SPACY = None

print("--- spacy_setup.py finished ---")

def get_spacy_nlp_instance():
    """Return the singleton spaCy nlp object (or None if load failed)."""
    return NLP_SPACY