# Kagami: A Research Platform for Multimodal Human-AI Interaction

[![Backend CI](https://github.com/tj-brandt/kagami/actions/workflows/ci.yml/badge.svg)](https://github.com/tj-brandt/kagami/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.17260926.svg)](https://doi.org/10.5281/zenodo.17260926)

**Kagami (鏡)** is a full-stack, open-source research platform for running controlled studies of conversational agents. It helps investigate how **avatar personalization** and **language-style matching (LSM)** affect user experience. The system includes a React frontend, a FastAPI backend, and a lightweight test suite.

---

## Table of contents

* [Statement of need](#statement-of-need)
* [Features](#features)
* [Architecture](#architecture)
* [Quickstart](#quickstart)

  * [Backend (Poetry, Python 3.12)](#backend-poetry-python-312)
  * [Frontend (Node 18+)](#frontend-node-18)
  * [Run in mock mode](#run-in-mock-mode)
* [Testing](#testing)
* [Configuration](#configuration)
* [Continuous Integration](#continuous-integration)
* [Troubleshooting](#troubleshooting)
* [Citing Kagami](#citing-kagami)
* [License](#license)

---

## Statement of need

Researchers often build bespoke software to study adaptive chatbot behaviors, which hinders reproducibility. Kagami addresses this by providing a reusable instrument that:

* Implements a configurable **3×2 factorial** experiment for multimodal personalization.
* Includes a real-time **LSM** pipeline and a `base + delta` prompting scheme for controlled manipulation.
* Supports multiple visual conditions, including **premade** and **generative** avatars.
* Logs turn-level experimental data to structured `.jsonl` for analysis.

## Features

* **Experimental conditions:** `avatar` (`none` / `premade` / `generated`) × `lsm` (`static` / `adaptive`).
* **Real-time analysis:** `spaCy`, NLTK VADER, Empath, TextStat, Hugging Face `transformers`, and Sentence-Transformers.
* **Structured data:** All interactions are logged as JSONL (see `docs/log_schema.json`).
* **Test suite:** Runs offline in mock mode for quick feedback.

## Architecture

* **Frontend:** React + Tailwind UI, chat flow and avatar selection UIs.
* **Backend:** FastAPI with endpoints for session lifecycle, avatar generation (image API), LSM analysis, and logging.
* **Storage:** Local/static file serving; production can mount `/var/data`.

---

## Quickstart

### Backend (Poetry, Python 3.12)

We use Poetry for dependency management and **commit `poetry.lock`** for reproducible installs (application use case). Poetry now recommends installation via **pipx** to keep Poetry isolated system-wide.

```bash
# One-time: install Poetry via pipx (recommended)
pipx install "poetry==1.8.3"
poetry --version   # should print 1.8.3

# Create env & install
cd backend
poetry env use 3.12
poetry install --no-interaction

# (If needed) Install the spaCy model locally
poetry run python -m spacy download en_core_web_sm
```

The spaCy docs explicitly show `python -m spacy download en_core_web_sm` as the standard method to install the small English model.

### Frontend (Node 18+)

```bash
cd frontend
npm install
npm start
```

### Run in mock mode

In one terminal (backend):

```bash
cd backend
export KAGAMI_MOCK=1
export KAGAMI_SKIP_WARMUP=1
poetry run uvicorn main:app --reload
```

In another (frontend):

```bash
cd frontend
npm start
```

Open `http://localhost:3000`.

---

## Testing

The test suite is offline and uses mock mode:

```bash
cd backend
export KAGAMI_MOCK=1
export KAGAMI_SKIP_WARMUP=1
poetry run pytest
```

---

## Configuration

Create `backend/.env` with at least:

```
OPENAI_API_KEY=your-key
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
FRONTEND_URL=http://localhost:3000
```

**Static files:** The backend auto-creates its static directory **before** mounting Starlette’s `StaticFiles`. Starlette validates the configured directory at mount time, which is why ensuring it exists is important. (We create it automatically.)

---

## Continuous Integration

We use GitHub Actions to test the backend:

* **Poetry pinned and installed via `snok/install-poetry@v1`**. The action installs and configures Poetry on the runner.
* **Lockfile policy:** `poetry.lock` is committed; CI **does not** regenerate it—CI runs `poetry install` to honor the lock. Poetry documents committing the lockfile for application projects for reproducible builds.

Typical steps:

```yaml
- uses: actions/checkout@v4

- uses: snok/install-poetry@v1
  with:
    version: 1.8.3
    virtualenvs-create: true
    virtualenvs-in-project: true

- run: poetry install --no-interaction
- run: poetry run python -m spacy download en_core_web_sm
- run: poetry run pytest
```

---

## Troubleshooting

**Poetry error:** `Could not parse version constraint: <empty>`
Use the pinned Poetry version (e.g., `1.8.3`) installed via pipx, which isolates Poetry from OS package managers and avoids unexpected upgrades.

**Starlette static directory error**
Starlette performs a configuration check to ensure the directory exists. Kagami creates the directory before mounting; if you change the path, ensure it exists or create it at startup.

**spaCy model missing**
Install the model explicitly: `python -m spacy download en_core_web_sm`.

---

## Citing Kagami

If you use this software in your research, please cite the repository. A `CITATION.cff` file is included so GitHub’s **Cite this repository** shows formatted metadata.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details. This project utilizes open-source software, including @heroicons/react (MIT License) and other dependencies. We thank the open-source community for their contributions.