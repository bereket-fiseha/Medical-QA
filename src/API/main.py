"""
MediAssist — FastAPI Backend
=============================
Endpoints:
  POST /api/chat             — SSE stream: stage events + final answer
  POST /api/detect-language  — Detect language via Modal lang-ID endpoint
  POST /api/translate        — Raw translation utility
  POST /api/medical-query    — English-only KG/LLM query (internal use)
  GET  /api/warmup           — Warm up the serverless translation server
  GET  /api/health           — Health check
  GET  /api/languages        — Supported language list

Modal endpoints (serverless):
  Translation : https://bereketfiseha123--translate-multilingual.modal.run
  Lang ID     : https://bereketfiseha123--identify-language.modal.run

SSE event types emitted by /api/chat:
  stage   — pipeline progress  { stage, label, detected_language?, confidence? }
  result  — final answer       { response, language, detected_language?, ... }
  error   — pipeline failure   { detail }
"""

import sys
import os
import time
import requests
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Load .env
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
    print("⚠️  python-dotenv not installed")

# ---------------------------------------------------------------------------
# KG module
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from KG.knowledge_graph import query_medical_knowledge

# ---------------------------------------------------------------------------
# Modal API endpoints — override via .env if needed
# ---------------------------------------------------------------------------
TRANSLATE_API_URL = os.getenv(
    "TRANSLATE_API_URL",
    "https://bereketfiseha123--translate-multilingual.modal.run"
)
# Set to empty string or leave unset until the lang-ID Modal app is deployed
LANG_ID_URL = os.getenv("LANG_ID_URL", "https://bereketfiseha123--identify-language.modal.run")

SUPPORTED_LANGUAGES = {
    "rw":  {"name": "Kinyarwanda",    "direction_to_en": "rw-en",  "direction_from_en": "en-rw"},
    "dav": {"name": "Taita (Dawida)", "direction_to_en": "dav-en", "direction_from_en": "en-dav"},
    "en":  {"name": "English",        "direction_to_en": None,      "direction_from_en": None},
}

_LANG_DISPLAY = {"en": "English", "rw": "Kinyarwanda", "sw": "Swahili", "dav": "Kidawida"}


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MediAssist API",
    description="Multilingual NCD & Diet Q&A — SSE pipeline",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------
def _sse(event: str, data: dict) -> str:
    """Format a single SSE message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Modal helpers
# ---------------------------------------------------------------------------
def detect_language(text: str) -> tuple[str, float]:
    """
    Calls the Modal lang-ID endpoint.
    Returns ("en", 0.0) immediately if LANG_ID_URL is not configured.
    """
    if not LANG_ID_URL:
        print("ℹ️  LANG_ID_URL not configured — lang-ID not available yet. Defaulting to 'en'.")
        return "en", 0.0
    try:
        resp = requests.post(LANG_ID_URL, json={"text": text}, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        lang_code  = data.get("language_code", "en")
        confidence = float(data.get("confidence", 0.0))
        print(f"🔍 Detected: {lang_code} ({confidence:.2%})")
        return lang_code, confidence
    except requests.exceptions.RequestException as e:
        print(f"⚠️  Lang-ID failed: {e}", file=sys.stderr)
        return "en", 0.0


def query_translator(text: str, direction: str) -> tuple[Optional[str], Optional[str]]:
    try:
        resp = requests.post(TRANSLATE_API_URL, json={"text": text, "direction": direction}, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        print(f"✅ Translated [{direction}]: {data.get('translated_text','')[:80]}")
        return data.get("translated_text"), data.get("info")
    except requests.exceptions.RequestException as e:
        print(f"❌ Translation failed: {e}", file=sys.stderr)
        return None, None


def translate_to_english(text: str, lang_code: str) -> tuple[Optional[str], Optional[str]]:
    if lang_code == "en":
        return text, None
    lang = SUPPORTED_LANGUAGES.get(lang_code)
    if not lang or not lang["direction_to_en"]:
        return text, None
    return query_translator(text, lang["direction_to_en"])


def translate_from_english(text: str, lang_code: str) -> tuple[Optional[str], Optional[str]]:
    if lang_code == "en":
        return text, None
    lang = SUPPORTED_LANGUAGES.get(lang_code)
    if not lang or not lang["direction_from_en"]:
        return text, None
    return query_translator(text, lang["direction_from_en"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="en", description="'en'|'rw'|'dav'|'auto'")
    conversation_id: Optional[str] = None


class DetectLanguageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)

class DetectLanguageResponse(BaseModel):
    language: str
    language_name: str
    confidence: float
    supported: bool

class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1)
    direction: str

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
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["Utility"])
def health_check():
    return {"status": "ok", "service": "MediAssist API", "version": "2.0.0"}


@app.get("/api/warmup", tags=["Utility"])
def warmup_translation_server():
    t0 = time.perf_counter()
    try:
        resp = requests.post(
            TRANSLATE_API_URL,
            json={"text": "hello", "direction": "en-rw"},
            timeout=90,
        )
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        if resp.status_code == 200:
            return {"status": "ready", "elapsed_ms": elapsed_ms}
        return {"status": "degraded", "elapsed_ms": elapsed_ms, "http_status": resp.status_code}
    except requests.exceptions.Timeout:
        return {"status": "timeout", "elapsed_ms": 90000}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "detail": str(e),
                "elapsed_ms": int((time.perf_counter() - t0) * 1000)}


@app.get("/api/languages", tags=["Utility"])
def get_supported_languages():
    return {"languages": [{"code": c, "name": i["name"]} for c, i in SUPPORTED_LANGUAGES.items()]}


@app.post("/api/detect-language", response_model=DetectLanguageResponse, tags=["Language Detection"])
def detect_language_endpoint(req: DetectLanguageRequest):
    lang_code, confidence = detect_language(req.text)
    lang_info = SUPPORTED_LANGUAGES.get(lang_code)
    return DetectLanguageResponse(
        language=lang_code,
        language_name=lang_info["name"] if lang_info else _LANG_DISPLAY.get(lang_code, lang_code),
        confidence=round(confidence, 4),
        supported=lang_code in SUPPORTED_LANGUAGES,
    )


@app.post("/api/translate", response_model=TranslateResponse, tags=["Translation"])
def translate_text(req: TranslateRequest):
    valid = {"rw-en", "en-rw", "dav-en", "en-dav"}
    if req.direction not in valid:
        raise HTTPException(400, f"Invalid direction. Valid: {sorted(valid)}")
    translated, info = query_translator(req.text, req.direction)
    if translated is None:
        raise HTTPException(502, "Translation service unavailable.")
    return TranslateResponse(translated_text=translated, direction=req.direction, info=info)


@app.post("/api/medical-query", response_model=MedicalQueryResponse, tags=["Medical"])
def medical_query(req: MedicalQueryRequest):
    result = query_medical_knowledge(req.question)
    return MedicalQueryResponse(answer=result["answer"], kg_used=result["kg_used"], source=result["source"])


@app.post("/api/chat", tags=["Chat"])
def chat(req: ChatRequest):
    """
    Full multilingual chat pipeline — simple POST/JSON response.
    """
    raw_lang = req.language.lower().strip()
    detected_lang_code: Optional[str] = None
    detection_confidence: Optional[float] = None
    lang_code = raw_lang

    if raw_lang == "auto":
        detected_lang_code, detection_confidence = detect_language(req.message)
        lang_code = detected_lang_code
        if lang_code not in SUPPORTED_LANGUAGES:
            print(f"⚠️  '{lang_code}' unsupported — defaulting to en")
            lang_code = "en"

    if lang_code not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language '{lang_code}'.")

    english_question, _ = translate_to_english(req.message, lang_code)
    if english_question is None:
        raise HTTPException(502, "Translation service failed. Please try again.")

    kg_result = query_medical_knowledge(english_question)
    english_answer: str = kg_result["answer"]

    final_answer, _ = translate_from_english(english_answer, lang_code)
    if final_answer is None:
        final_answer = english_answer + "\n\n*(Translation unavailable.)*"

    return {
        "response":             final_answer,
        "original_message":     req.message,
        "translated_input":     english_question if lang_code != "en" else None,
        "language":             lang_code,
        "detected_language":    detected_lang_code,
        "detection_confidence": round(detection_confidence, 4) if detection_confidence else None,
        "kg_used":              kg_result["kg_used"],
        "source":               kg_result["source"],
    }
