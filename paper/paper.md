---
title: 'Kagami: A Research Platform for Studying Multimodal Personalization in Conversational Agents'
tags: [python, react, conversational-ai, hci, psycholinguistics, experimental-software]
authors:
  - name: T. James Brandt
    orcid: 0000-0000-8294-6235 
    affiliation: 1
affiliations:
  - name: University of Minnesota
    index: 1
date: 3 October 2025
bibliography: paper.bib
---

# Summary

Kagami is a full-stack, open-source software platform for conducting controlled, interactive experiments with conversational agents. Built with a Python FastAPI backend and a React frontend, it provides a reusable instrument for researchers in human-computer interaction (HCI), psychology, and computational linguistics. The platform's primary function is to enable the empirical study of how multimodal personalization—specifically user-controlled visual avatars and real-time adaptive linguistic style—affects users' relational perceptions of AI.

Kagami is designed to support studies such as those investigating the trade-offs between linguistic mimicry and persona stability, a concept known as the synchrony-stability frontier [@brandt2025frontier]. Researchers can configure a 3 × 2 factorial experiment via URL parameters to assign participants to conditions, including a text-only interface, selection from premade avatars, or co-creation of a generative avatar. The software manages the complete experimental flow, from participant onboarding and live, turn-by-turn interaction to high-fidelity data logging. The inclusion of a fully functional mock mode and an automated test suite ensures that experiments can be developed and verified offline, enhancing the platform's reliability and reproducibility. The software has been used to generate findings presented in existing research [@brandt2025paradox].

# Statement of Need

Research into adaptive conversational agents often requires the development of bespoke, single-use software, which creates a significant barrier to reproducibility and slows the pace of innovation. While numerous NLP libraries exist, few tools integrate these components into a complete, end-to-end experimental harness for live HCI studies. Kagami addresses this gap by providing a standardized platform that is both robust and easy to adapt. It is designed for researchers who need to move beyond offline simulations and conduct live, interactive studies without the overhead of building a full-stack application from scratch. By open-sourcing Kagami, we aim to provide the community with a shared instrument to build upon, replicate, and extend research on adaptive AI.

# State of the Field

The study of human-AI interaction relies on a rich ecosystem of open-source libraries. Kagami is an integration layer that builds upon these foundational tools, rather than replacing them. Its linguistic analysis pipeline is powered by established libraries such as spaCy for syntactic parsing [@montani2023], NLTK (VADER) for sentiment analysis [@hutto2014], and Empath for psycholinguistic feature extraction [@fast2016]. The platform's adaptive capabilities are informed by theories of Language Style Matching (LSM) [@niederhoffer2002] and Communication Accommodation Theory (CAT) [@giles1991].

While general-purpose chatbot frameworks exist, Kagami's contribution is its specific focus on providing a reproducible experimental harness. Unlike frameworks that prioritize flexible conversation design, Kagami prioritizes experimental control, implementing features like a base + delta dynamic prompting system and structured, turn-level data logging out of the box. It is designed not as a tool for building commercial chatbots, but as a scientific instrument for researchers investigating the nuances of adaptive, multimodal interaction.

# Key Features and Functionality

The platform is designed around the principle of high experimental control and data fidelity.

*   **Factorial Design:** Kagami is pre-configured to run a 3 (Avatar: `none`, `premade`, `generated`) × 2 (Language Style: `static`, `adaptive`) between-subjects experiment, with conditions assigned via URL parameters.
*   **Dynamic Prompting:** A key feature is the `base + delta` prompting architecture. A constant base prompt defines the agent's core persona, while a condition-specific "delta" is appended to either enforce a static style or inject dynamic, real-time adaptation instructions based on the user's linguistic profile.
*   **Real-time NLP Pipeline:** For each user turn, a `StyleProfile` is generated, quantifying over 25 linguistic features. This profile informs the adaptive prompting logic.
*   **Structured Logging:** All experimental events, from session start to every individual message with its associated linguistic metadata, are logged as structured JSON objects to a `.jsonl` file, ensuring the data is immediately ready for analysis in tools like R or Python.
*   **Mock Mode:** The platform includes a fully-functional mock mode for offline testing and development, allowing the entire test suite to run without requiring external API keys.

For detailed installation and usage instructions, please refer to the project's main `README.md` file.

# Acknowledgements

This software was developed as part of a Master's thesis at the University of Minnesota.

# References