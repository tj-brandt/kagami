# backend/Dockerfile

# --- Stage 1: Build a lean base with Python and Poetry ---
FROM python:3.12.3-slim as base
# --- ADD HF_HOME to the environment variables ---
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/opt/poetry_cache \
    PIP_DEFAULT_TIMEOUT=100 \
    PIP_RETRIES=5 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/huggingface_cache

RUN apt-get update && apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir poetry

# --- Stage 2: Install Python dependencies ---
FROM base as deps
WORKDIR /app

# --- CREATE the cache directory early ---
RUN mkdir -p $HF_HOME

COPY pyproject.toml poetry.lock ./

RUN --mount=type=cache,target=$POETRY_CACHE_DIR poetry install --no-root --only main

# --- Stage 3: Download and cache ML models ---
FROM deps as models
WORKDIR /app

COPY download_models.py ./

RUN poetry run python download_models.py

# --- Stage 4: Final application image ---
FROM models as final
WORKDIR /app
COPY . .

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]