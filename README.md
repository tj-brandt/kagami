# Kagami: A Research Platform for Multimodal Human-AI Interaction

[![React Version](https://img.shields.io/badge/react-18.3-61DAFB.svg)](https://reactjs.org/)
[![Python Version](https://img.shields.io/badge/python-3.12-3776AB.svg)](https://www.python.org/)
[![Frameworks](https://img.shields.io/badge/Frameworks-FastAPI%20%7C%20TailwindCSS-blue.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Status: Thesis In Progress](https://img.shields.io/badge/status-thesis_in_progress-green.svg)](https://github.com/tj-brandt/kagami)

**Kagami (鏡)**, the Japanese word for "mirror," is a full-stack web application built from the ground up as a research instrument for a Master's thesis. It is a sophisticated experimental platform designed to empirically investigate how multimodal personalization—specifically **user-controlled avatars** and **adaptive language style**—influences a user's relational perceptions of a companion chatbot.

The platform facilitates a live, controlled 3x2 between-subjects experiment, allowing for the precise measurement and analysis of human-AI interaction dynamics.

## 1. Research Context & Experimental Design

The entire platform was built to answer a core research question:

> **How does multimodal personalization—specifically the combination of visual avatar representation and adaptive language style—affect a user's relational perceptions (e.g., trust, rapport, social presence) of a companion AI?**

To investigate this, the study employs a **3x2 between-subjects factorial design**, manipulating two independent variables to create six unique experimental conditions:

*   **Factor 1: Avatar Agency (3 Levels)**
    1.  `none`: A baseline text-only interface.
    2.  `premade`: The user selects a visual avatar from a curated, predefined gallery.
    3.  `generated`: The user actively co-creates a unique avatar by providing a text prompt to a generative image model (OpenAI gpt-image-1).

*   **Factor 2: Language Style Matching (LSM) (2 Levels)**
    1.  `static`: The chatbot, Kagami, maintains a consistent, predefined friendly persona and conversational style.
    2.  `adaptive`: The chatbot analyzes the user's writing style in real-time and subtly mirrors it, guided by a dynamic prompting system.

## 2. System Architecture

Kagami is a modern, decoupled full-stack application composed of a React.js frontend and a Python (FastAPI) backend. The entire system is containerized with Docker for maximum reproducibility and is designed for cloud deployment on platforms like Render.

#### High-Level User & Data Flow
```
Prolific Platform --> [Qualtrics Survey (Pre)] --(Redirect w/ URL Params)--> [KAGAMI React App]
                                                                                      |
+-------------------------------------------------------------------------------------+
| 1. Session Start: React sends PID & condition to Backend.                           |
| 2. Interaction:   User messages are sent to Backend.                                |
| 3. Analysis:      Backend NLP Service analyzes user text.                           |
| 4. Adaptation:    Backend Prompt Service creates dynamic LLM instruction.           |
| 5. Generation:    Backend calls OpenAI API for text/image response.                 |
| 6. Logging:       Backend logs every event to a secure .jsonl file.                 |
| 7. Response:      Backend returns bot message to React.                             |
+-------------------------------------------------------------------------------------+
                                                                                      |
[KAGAMI React App] --(Chat Ends)--> [Qualtrics Survey (Post)] --(Redirect)--> Prolific Platform
```

### Component Breakdown

#### **Frontend (`/frontend`)**
A responsive single-page application built with **React** that manages the entire user experience.
-   **State Management:** **Zustand** (`sessionStore`, `chatStore`) provides a minimal, centralized state for managing the experimental phase, session data, and chat messages.
-   **API Communication:** A dedicated service (`src/services/api.js`) centralizes all **Axios** calls to the backend, featuring automatic retries and using `navigator.sendBeacon` for robust session-end logging.
-   **UI & Styling:** **Tailwind CSS** for utility-first styling and **Framer Motion** for smooth page transitions and animations.
-   **Core Components:**
    -   `App.jsx`: The root component that acts as a state machine, parsing URL parameters and controlling the flow between phases: `loading` -> `intro` -> `avatar` -> `chat` -> `survey`.
    -   `ChatScreen.jsx`: The main chat interface, powered by the `useChatTimer` hook and featuring a dynamic layout that adapts to avatar/no-avatar conditions.
    -   `AvatarSelectionScreen.jsx`: A conditional component that renders either the `PremadeAvatarGallery` or the `GeneratedAvatarInterface` based on the user's assigned experimental condition.

#### **Backend (`/backend`)**
An asynchronous API server built with **Python** and **FastAPI**.
-   **`main.py`**: The main application entrypoint. Manages FastAPI setup, CORS, session lifecycle endpoints (`/session/start`, `/session/end`), and routes all API requests.
-   **`core/nlp_service.py`**: The core of the language analysis. It uses a suite of pre-loaded models to generate a detailed `StyleProfile` for each user utterance. Models include **spaCy** (syntax), **NLTK VADER** (sentiment), **textstat** (readability), **Empath** (psychological attributes), and **Hugging Face Transformers** for formality (`mdistilbert-base-formality-ranker`) and style similarity (`StyleDistance/styledistance`).
-   **`core/prompt_service.py`**: Dynamically constructs the LLM system prompt. In the `adaptive` condition, it uses the `StyleProfile` to add targeted instructions, guiding the LLM to mirror the user's style.
-   **`core/logging_service.py`**: A robust, centralized logger that writes structured `jsonl` data for every significant event, ensuring all experimental data is captured for later analysis according to the schema in `docs/log_schema.json`.
-   **`drive_upload.py`**: A utility, run as a background task, that securely uploads the final session log to a specified Google Drive folder.

#### **Third-Party Services & Deployment**
-   **OpenAI API:** Used for `gpt-4.1-nano` (conversational engine) and `gpt-image-1` (avatar generation via the edits API).
-   **Google Drive API:** For secure, long-term storage of anonymized research data.
-   **Render:** The platform is deployed on Render, configured via `render.yaml`. The multi-stage `Dockerfile` is optimized for production by pre-downloading all ML models into the image, ensuring fast startup times.

## 3. Core Technical Concepts

#### A. Real-time Language Style Matching (LSM)
The `adaptive` condition is driven by a sophisticated NLP pipeline (`nlp_service.py`) and a dynamic prompting system (`prompt_service.py`) designed for high experimental control.
1.  **Analysis:** On every turn, the user's text is analyzed to produce a `StyleProfile` containing 26 distinct linguistic features. These include metrics for readability, sentiment, pragmatic style (e.g., informality, hedging), psychological attributes (Empath), and structural properties.
2.  **Controlled Adaptive Prompting:** To isolate the effect of adaptation, the `prompt_service.py` uses a **`base + delta` structure**. A shared base prompt, identical across all conditions, defines the bot's core persona and safety rules.
    *   In the **static** condition, a minimal `static_delta` is appended, instructing the bot to maintain its consistent style.
    *   In the **adaptive** condition, an `adaptive_delta` is appended. This delta contains dynamic instructions based on the user's `StyleProfile` (e.g., `"The user seems casual. Match this with a relaxed, friendly tone."`).
    *   This structure ensures that the *only* significant difference between conditions is the explicit instruction to adapt, minimizing potential confounds like prompt length or rule asymmetry.

#### B. Controlled Generative Avatar Creation

#### B. Controlled Generative Avatar Creation
The avatar generation process (`main.py`'s `/avatar/generate` endpoint) is carefully controlled to balance user creativity with experimental consistency.
1.  A neutral base image (`kagami.webp`) is used as a template.
2.  The user's text prompt is injected into a larger, more detailed "master prompt" for the OpenAI Image Edits API.
3.  This master prompt includes strong **guardrails** to maintain the original character pose, camera angle, and art style, and to enforce a transparent background for clean UI integration. This ensures that only the intended features (species, clothing, accessories) are modified.

## 4. Technical Setup & Local Development

This project is containerized, but can also be run locally for development.

### Prerequisites
-   [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose (Recommended)
-   [Python 3.12+](https://www.python.org/) & [Poetry](https://python-poetry.org/)
-   [Node.js v18+](https://nodejs.org/) & npm
-   A Google Cloud Platform project with the Drive API enabled and a `service_account.json` credentials file.

### Environment Configuration
1.  **Backend:** Create a file named `.env` in `backend/`. Use `backend/.env.example` as a template. You must provide `OPENAI_API_KEY` and `GOOGLE_DRIVE_FOLDER_ID`.
2.  **Frontend:** Create a file named `.env.local` in `frontend/`. At a minimum, set `REACT_APP_BACKEND_URL=http://localhost:8000`.
3.  **Google Credentials:** Place your `service_account.json` file inside the `backend/` directory.

### Running Locally (without Docker)

1.  **Run the Backend:**
    ```bash
    cd backend
    poetry install
    poetry run uvicorn main:app --reload
    # The API will be available at http://localhost:8000
    ```
2.  **Run the Frontend (in a new terminal):**
    ```bash
    cd frontend
    npm install
    npm start
    # The app will be available at http://localhost:3000
    ```

### Simulating an Experiment
To test the full experimental flow, append URL parameters to the frontend URL:
`http://localhost:3000/?PROLIFIC_PID=test_user&avatar=generated&lsm=adaptive&responseid=test_response`

-   `avatar` can be `none`, `premade`, or `generated`.
-   `lsm` can be `static` or `adaptive`.

## 5. License
This project is licensed under the MIT License. See the `LICENSE` file for details.