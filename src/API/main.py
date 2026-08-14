"""
MediAssist — FastAPI Backend
=============================
Endpoints:
  POST /api/chat          — Full pipeline: detect → translate → KG/LLM → translate back
  POST /api/translate     — Raw translation utility
  POST /api/medical-query — English-only KG/LLM query (internal use)
  GET  /api/health        — Health check
  GET  /api/languages     — Supported language list
"""

import sys
import os
import requests
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Load .env from src/ (parent of API/) before anything else runs
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
        print(f"✅ .env loaded from {os.path.abspath(_env_path)}")
    else:
        print(f"⚠️  No .env found at {os.path.abspath(_env_path)} — using system env vars")
except ImportError:
    print("⚠️  python-dotenv not installed — run: pip install python-dotenv")

# ---------------------------------------------------------------------------
# Path setup so we can import from sibling KG package
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from KG.knowledge_graph import query_medical_knowledge

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MediAssist API",
    description="Multilingual medical Q&A powered by Knowledge Graph + LLM",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Translation API config
# ---------------------------------------------------------------------------
TRANSLATE_API_URL = "https://bereketfiseha123--translate-multilingual.modal.run"

SUPPORTED_LANGUAGES = {
    "rw": {"name": "Kinyarwanda", "direction_to_en": "rw-en", "direction_from_en": "en-rw"},
    "dav": {"name": "Taita (Dawida)", "direction_to_en": "dav-en", "direction_from_en": "en-dav"},
    "en": {"name": "English", "direction_to_en": None, "direction_from_en": None},
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    language: str = Field(default="en", description="ISO language code: 'en', 'rw', 'dav'")
    conversation_id: Optional[str] = Field(default=None, description="Optional session ID")


class ChatResponse(BaseModel):
    response: str
    original_message: str
    translated_input: Optional[str] = None
    translated_output: Optional[str] = None
    language: str
    kg_used: bool
    source: str


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1)
    direction: str = Field(..., description="e.g. 'rw-en', 'en-rw', 'dav-en', 'en-dav'")


class TranslateResponse(BaseModel):
    translated_text: str
    direction: str
    info: Optional[str] = None


class MedicalQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


class MedicalQueryResponse(BaseModel):
    answer: str
    kg_used: bool
    source: str


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def query_translator(text: str, direction: str) -> tuple[Optional[str], Optional[str]]:
    """
    Calls the Multilingual Modal translation API.
    direction options: 'rw-en', 'en-rw', 'dav-en', 'en-dav'
    Returns (translated_text, info) or (None, None) on failure.
    """
    payload = {"text": text, "direction": direction}
    try:
        response = requests.post(TRANSLATE_API_URL, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("translated_text"), data.get("info")
    except requests.exceptions.RequestException as e:
        print(f"Translation API Request Failed: {e}", file=sys.stderr)
        return None, None


def translate_to_english(text: str, lang_code: str) -> tuple[Optional[str], Optional[str]]:
    """Translate from source language to English. Returns (translated, info)."""
    if lang_code == "en":
        return text, None
    lang = SUPPORTED_LANGUAGES.get(lang_code)
    if not lang or lang["direction_to_en"] is None:
        return text, None
    return query_translator(text, lang["direction_to_en"])


def translate_from_english(text: str, lang_code: str) -> tuple[Optional[str], Optional[str]]:
    """Translate from English back to target language. Returns (translated, info)."""
    if lang_code == "en":
        return text, None
    lang = SUPPORTED_LANGUAGES.get(lang_code)
    if not lang or lang["direction_from_en"] is None:
        return text, None
    return query_translator(text, lang["direction_from_en"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["Utility"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "MediAssist API", "version": "1.0.0"}


@app.get("/api/languages", tags=["Utility"])
def get_supported_languages():
    """Returns the list of supported languages."""
    return {
        "languages": [
            {"code": code, "name": info["name"]}
            for code, info in SUPPORTED_LANGUAGES.items()
        ]
    }


@app.post("/api/translate", response_model=TranslateResponse, tags=["Translation"])
def translate_text(req: TranslateRequest):
    """
    Raw translation endpoint.
    Useful for testing or standalone translation tasks.
    """
    valid_directions = {"rw-en", "en-rw", "dav-en", "en-dav"}
    if req.direction not in valid_directions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid direction '{req.direction}'. Valid options: {sorted(valid_directions)}",
        )
    translated, info = query_translator(req.text, req.direction)
    if translated is None:
        raise HTTPException(status_code=502, detail="Translation service unavailable.")
    return TranslateResponse(translated_text=translated, direction=req.direction, info=info)


@app.post("/api/medical-query", response_model=MedicalQueryResponse, tags=["Medical"])
def medical_query(req: MedicalQueryRequest):
    """
    English-only medical knowledge query.
    Calls the KG retrieval + LLM pipeline directly.
    """
    result = query_medical_knowledge(req.question)
    return MedicalQueryResponse(
        answer=result["answer"],
        kg_used=result["kg_used"],
        source=result["source"],
    )


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
def chat(req: ChatRequest):
    """
    Full multilingual chat pipeline:
      1. Validate language
      2. Translate user message → English  (if not English)
      3. Query KG + LLM with English text
      4. Translate answer → user's language (if not English)
      5. Return structured response
    """
    lang_code = req.language.lower()
    if lang_code not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{lang_code}'. Supported: {list(SUPPORTED_LANGUAGES.keys())}",
        )

    # --- Step 1: Translate input to English ---
    english_question, _info = translate_to_english(req.message, lang_code)
    if english_question is None:
        raise HTTPException(
            status_code=502,
            detail="Translation service failed to translate your message. Please try again.",
        )

    # --- Step 2: Query KG + LLM ---
    kg_result = query_medical_knowledge(english_question)
    english_answer: str = kg_result["answer"]

    # --- Step 3: Translate answer back to user's language ---
    final_answer, _info2 = translate_from_english(english_answer, lang_code)
    if final_answer is None:
        # Fallback: return English answer with a note
        final_answer = english_answer + "\n\n*(Translation to your language is currently unavailable.)*"

    return ChatResponse(
        response=final_answer,
        original_message=req.message,
        translated_input=english_question if lang_code != "en" else None,
        translated_output=None,   # internal detail; omit from user-facing response
        language=lang_code,
        kg_used=kg_result["kg_used"],
        source=kg_result["source"],
    )
