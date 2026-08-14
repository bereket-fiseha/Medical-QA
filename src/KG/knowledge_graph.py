"""
Knowledge Graph + LLM Module
==============================
Pipeline priority:
  1. retrieve_from_kg(query)  →  if it returns an answer, use it DIRECTLY — no LLM
  2. call_llm(query)          →  temporary fallback ONLY when KG returns nothing

When your real KG is wired up, GPT is bypassed entirely.
"""

import os
import sys
from typing import Optional

# ---------------------------------------------------------------------------
# Optional OpenAI — only used as a temporary fallback when KG has no answer
# ---------------------------------------------------------------------------
try:
    from openai import OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False


# System prompt — only used by the GPT fallback, not the KG path
_FALLBACK_SYSTEM_PROMPT = """You are MediAssist, a knowledgeable and compassionate medical AI assistant
specialising in Non-Communicable Diseases (NCDs) and diet/nutrition.

Your focus areas include:
- Hypertension (high blood pressure)
- Type 2 diabetes and blood sugar management
- Cardiovascular diseases (heart disease, coronary artery disease, atherosclerosis)
- Stroke prevention and recovery
- Obesity and weight management
- Chronic kidney disease related to NCDs
- Diet and nutrition guidance for NCD prevention and management

Guidelines:
- Provide clear, evidence-based information relevant to NCDs and diet
- Always recommend consulting a qualified healthcare professional for diagnosis or treatment
- Be empathetic and use plain language
- Do not diagnose; explain symptoms, conditions, lifestyle changes, and dietary guidance
- Keep answers concise but complete (2–4 paragraphs max)
"""

DISCLAIMER = (
    "\n\n⚕️ *This information is for educational purposes only. "
    "Please consult a qualified healthcare professional for medical advice, "
    "diagnosis, or treatment.*"
)


# STEP 1 — Knowledge Graph retrieval
def retrieve_from_kg(query: str) -> Optional[str]:
    """
    Query the Knowledge Graph and return a complete answer string,
    or None if no relevant answer is found.

    This is the PRIMARY answer source. When this returns a value,
    it is sent directly to the user — GPT is NOT called.

    TODO: Replace the body of this function with your real KG logic:
      - SPARQL query against SNOMED CT / ICD-10 / custom ontology
      - Neo4j Cypher traversal
      - Vector similarity search over medical embeddings
      - Any structured retrieval that returns a human-readable answer

    Returns:
        str  — complete answer to show the user  (GPT is skipped)
        None — no answer found, fall through to GPT fallback
    """
    # ----------------------------------------------------------------
    # Example skeleton (uncomment and adapt when KG is ready):
    #
    # from your_kg_client import KGClient
    # client = KGClient(os.getenv("KG_URI"))
    # result = client.query(query)
    # if result:
    #     return result.format_answer()   # must return a plain string
    # ----------------------------------------------------------------

    return None   # ← KG not wired yet; falls through to GPT fallback


# STEP 2 — GPT fallback (temporary, used ONLY when KG returns None)

def _call_gpt_fallback(question: str) -> str:
    """
    Temporary GPT-4o-mini fallback.
    Called ONLY when retrieve_from_kg() returns None.
    Remove / disable this once the real KG is fully integrated.
    """
    if _openai_available:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": _FALLBACK_SYSTEM_PROMPT},
                        {"role": "user",   "content": question},
                    ],
                    temperature=0.3,
                    max_tokens=600,
                )
                answer = response.choices[0].message.content.strip()
                return answer + DISCLAIMER
            except Exception as e:
                print(f"⚠️  GPT fallback failed: {e}", file=sys.stderr)

    # No API key or openai not installed
    return (
        "[KG answer not available — GPT fallback also unavailable]\n\n"
        f'Your question "{question}" could not be answered right now. '
        "Please ensure the Knowledge Graph is connected or set OPENAI_API_KEY "
        "as a temporary fallback."
        + DISCLAIMER
    )


# Public entry point — called by FastAPI
def query_medical_knowledge(question: str) -> dict:
    """
    Main entry point called by the FastAPI layer.

    Priority:
      1. KG answer  → returned directly, GPT is skipped entirely
      2. GPT answer → used only when KG returns None (temporary)

    Args:
        question (str): Medical question in English.

    Returns:
        dict: {
            "answer": str,    # final answer to show the user
            "kg_used": bool,  # True when answer came from KG
            "source": str     # human-readable source label
        }
    """
    # --- Priority 1: Knowledge Graph ---
    kg_answer = retrieve_from_kg(question)
    if kg_answer is not None:
        return {
            "answer": kg_answer,
            "kg_used": True,
            "source": "Knowledge Graph",
        }

    # --- Priority 2: GPT fallback (temporary) ---
    gpt_answer = _call_gpt_fallback(question)
    return {
        "answer": gpt_answer,
        "kg_used": False,
        "source": "GPT-4o-mini (temporary fallback)",
    }
