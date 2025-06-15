# Kagami: An Adaptive AI Companion for HCI Research

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python Version](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/downloads/)
[![React Version](https://img.shields.io/badge/react-18.2.0-61DAFB.svg)](https://reactjs.org/)
[![Status: In Development](https://img.shields.io/badge/status-research_in_progress-green.svg)](https://github.com/your-username/kagami)

Kagami is a full-stack experimental platform built from the ground up to investigate how user-driven generative avatars and adaptive language shape human-AI trust, rapport, and engagement. This project serves as the primary research instrument for a Master's thesis in Human Factors & Ergonomics at the University of Minnesota.

The platform is designed to run a 3x2 between-subjects experiment, allowing researchers to precisely measure the effects of different AI personalization strategies in a live, conversational setting.

## 📖 Table of Contents

- [Key Features](#-key-features)
- [Project Architecture](#-project-architecture)
- [The Research Context](#-the-research-context)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup (Python/FastAPI)](#backend-setup-pythonginfastapi)
  - [Frontend Setup (React)](#frontend-setup-react)
- [Usage](#-usage)
- [Contributing](#-contributing)
- [License](#-license)
- [Citation](#-citation)

## ✨ Key Features

- **Adaptive Conversational AI:** A real-time **Language Style Matching (LSM)** pipeline analyzes user input across 30+ linguistic dimensions and dynamically constructs system prompts for an LLM (OpenAI's `gpt-4.1-nano`) to mirror the user's tone.
- **On-the-Fly Avatar Generation:** Utilizes OpenAI's `gpt-image-1` API to allow users to generate a unique companion avatar from a text prompt.
- **Robust Experimental Design:** Natively supports a 3x2 factorial design, randomly assigning users to one of six conditions to test combinations of avatar presence and language adaptivity.
- **Comprehensive Data Logging:** The FastAPI backend meticulously logs every turn of the conversation—including user input, bot response, the exact system prompt used, and calculated linguistic scores—into structured JSONL files for reproducible research.
- **Modern Tech Stack:** Built with a performant Python/FastAPI backend and a responsive React frontend.

## 🏗️ Project Architecture

Kagami is composed of two main components that communicate via a REST API:

### 1. Backend (`/backend`)

- **Framework:** **FastAPI** provides a high-performance, asynchronous API.
- **Core Logic:**
    - **`main.py`**: Defines API endpoints for session management, messaging, and logging.
    - **`common.py`**: Houses the core NLP pipeline for style trait detection and LSM scoring.
    - **`chatbot_logic.py`**: Manages interaction with the OpenAI API.
- **NLP Models:**
    - **spaCy**: For fast sentence segmentation and Part-of-Speech (POS) tagging.
    - **Hugging Face Transformers**: A RoBERTa-based model for formality scoring.
    - **NLTK**: For VADER sentiment analysis.
- **Persistence:** Active session data is persisted to disk to ensure robustness against server restarts.

### 2. Frontend (`/frontend`)

- **Framework:** **React** for a fast, modern Single-Page Application (SPA).
- **State Management:** React Hooks (`useState`, `useEffect`, `useContext`).
- **Styling:** **Tailwind CSS** for utility-first styling.
- **Animation:** **Framer Motion** for smooth page transitions and UI animations.
- **Core Components:**
    - **`App.jsx`**: The root component that manages application state and routing between experimental phases (Intro, Avatar, Chat, etc.).
    - **`ChatScreen.jsx`**: The main chat interface, including a countdown timer and message handling.
    - **`AvatarSelectionScreen.jsx`**: A conditional component that renders either a premade gallery or the generative AI interface.

## 🔬 The Research Context

This platform was designed to address a gap in HCI literature regarding the interactive effects of multimodal (visual + linguistic) and dynamic AI personalization. The central research hypotheses are:

- **H1 (Avatar Presence):** Any avatar will increase user trust over a no-avatar condition.
- **H2 (Adaptive Language):** Adaptive language style matching (LSM) will yield higher rapport than a static style.
- **H3 (Interaction Effect):** The combination of a user-generated avatar and adaptive LSM will produce the strongest relational outcomes.

The research protocol has been submitted to the University of Minnesota's IRB (June 2025) and is awaiting ethical review.

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development and testing purposes.

### Prerequisites

- Python 3.9+ and `pip`
- Node.js v18+ and `npm`
- An OpenAI API key

### Backend Setup (Python/FastAPI)

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Download NLP model data:** The first time you run the app, it may require NLTK data. A bootstrap script is included:
    ```bash
    python download_nltk_data.py
    ```
5.  **Set up environment variables:**
    - Create a `.env` file in the `/backend` directory.
    - Add your OpenAI API key:
      ```
      OPENAI_API_KEY="your_secret_key_here"
      ```
6.  **Run the backend server:**
    ```bash
    uvicorn main:app --reload
    ```
    The API will be running at `http://127.0.0.1:8000`.

### Frontend Setup (React)

1.  **Navigate to the frontend directory (in a new terminal):**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:5173`.

## 🛠️ Usage

Once both servers are running, open your browser to `http://localhost:5173`. You can simulate the experimental flow by passing URL parameters, for example:

`http://localhost:5173/?PROLIFIC_PID=test_user&condition=generated_adaptive&responseid=test_response`

Valid conditions are combinations of `{no_avatar, premade, generated}` and `{static, adaptive}`.

## 🤝 Contributing

This project is primarily an academic research instrument. However, if you have suggestions for improving the code's clarity, performance, or documentation, please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.

## ✍️ Citation

If you use this project or its findings in your own research, please cite the forthcoming Master's thesis:
