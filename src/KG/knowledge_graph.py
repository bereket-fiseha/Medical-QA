"""
Health-nutrition knowledge graph reader for NCD dietary guidance.
Loads the TTL graph via RDFLib (no server required) and answers questions
through structured SPARQL routing, KG-augmented LLM, or LLM fallback.
Requires: pip install rdflib
"""

from __future__ import annotations

import os
import re
import sys
import textwrap
from pathlib import Path
from typing import Optional

try:
    from openai import OpenAI as _OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False

try:
    from rdflib import ConjunctiveGraph, URIRef, Literal, Namespace
except ImportError as exc:
    raise ImportError("rdflib is required. Install with: pip install rdflib") from exc


# ── Graph source ──────────────────────────────────────────────────────────────

_TTL_URL = (
    "https://raw.githubusercontent.com/bereket-fiseha/Medical-QA/main/src/final_validated_kg.ttl"
)
_DEFAULT_LOCAL = Path(__file__).parent / "final_validated_kg.ttl"

# ── Namespaces ────────────────────────────────────────────────────────────────

HLTH  = Namespace("http://purl.org/health/schema#")
LOCAL = Namespace("http://health-nutrition-kgm.org/modules/local_foods#")
OBO   = Namespace("http://purl.obolibrary.org/obo/")
RDFS  = Namespace("http://www.w3.org/2000/01/rdf-schema#")

SPARQL_PREFIXES = """
PREFIX hlth:  <http://purl.org/health/schema#>
PREFIX local: <http://health-nutrition-kgm.org/modules/local_foods#>
PREFIX obo:   <http://purl.obolibrary.org/obo/>
PREFIX prov:  <http://www.w3.org/ns/prov#>
PREFIX doc:   <http://purl.org/health/documents/>
PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX xsd:   <http://www.w3.org/2001/XMLSchema#>
""".strip()

CONDITION_IRIS = {
    "hypertension":        "http://purl.obolibrary.org/obo/DOID_10763",
    "type 2 diabetes":     "http://purl.obolibrary.org/obo/DOID_9352",
    "type2 diabetes":      "http://purl.obolibrary.org/obo/DOID_9352",
    "diabetes":            "http://purl.obolibrary.org/obo/DOID_9352",
    "osteoarthritis":      "http://purl.obolibrary.org/obo/DOID_8398",
    "rheumatoid arthritis":"http://purl.obolibrary.org/obo/DOID_7148",
    "lupus":               "http://purl.obolibrary.org/obo/DOID_9074",
    "gout":                "http://purl.obolibrary.org/obo/DOID_13189",
}

DISCLAIMER = (
    "\n\nThis information is for educational purposes only. "
    "Please consult a qualified healthcare professional for medical advice, "
    "diagnosis, or treatment."
)


# ── Graph loading ─────────────────────────────────────────────────────────────

_graph: ConjunctiveGraph | None = None


def _load_graph() -> ConjunctiveGraph:
    global _graph
    if _graph is not None:
        return _graph

    g = ConjunctiveGraph()

    env_path = os.getenv("KG_TTL_PATH")
    if env_path:
        p = Path(env_path)
        if p.exists():
            g.parse(str(p), format="turtle")
            _graph = g
            return _graph

    if _DEFAULT_LOCAL.exists():
        g.parse(str(_DEFAULT_LOCAL), format="turtle")
        _graph = g
        return _graph

    import urllib.request
    with urllib.request.urlopen(_TTL_URL, timeout=30) as resp:
        g.parse(data=resp.read().decode("utf-8"), format="turtle")
    _graph = g
    return _graph


def get_graph() -> ConjunctiveGraph:
    return _load_graph()


# ── Safety guard ──────────────────────────────────────────────────────────────

_SECURITY_RE = [re.compile(p, re.IGNORECASE) for p in [
    r"ignore\s+(all\s+)?(previous|prior|above|system|your)\s+(instructions?|rules?|restrictions?|constraints?|prompt|health)",
    r"(system\s+override|act\s+as\s+(a\s+)?(rogue|different|new)|forget\s+your\s+rules)",
    r"(you\s+are\s+now|pretend\s+(you\s+are|to\s+be)|roleplay\s+as|jailbreak)",
    r"(new\s+persona|dan\s+mode|developer\s+mode|unrestricted\s+mode)",
    r"\b(drop|delete|truncate|purge|wipe)\s+(all|table|graph|database|dataset)",
    r"(update\s+the\s+(graph|rules|database)|insert\s+into)",
    r"(dump\s+(all|every|the\s+entire)|copy\s+(the\s+)?(dataset|graph|database))",
    r"(fictional\s+(disease|condition)|poisonous\s+ingredient)",
    r"(tell\s+me\s+(exactly\s+)?which\s+(disease|condition)s?\s+(they\s+have|the\s+user\s+has))",
    r"(which\s+(three\s+)?(diseases?|conditions?)\s+(they|the\s+(user|patient))\s+have)",
]]

_BOUNDARY_RE = [re.compile(p, re.IGNORECASE) for p in [
    r"(do\s+i\s+have|is\s+this\s+(definitely|caused\s+by)|diagnos(e|is|ed))",
    r"(stage\s+[12]\s+(hypertension|diabetes)|worsening|getting\s+worse)",
    r"(stop\s+taking\s+(my\s+)?(medication|metformin|lisinopril|insulin|pills?))",
    r"(correct\s+dosage|how\s+much\s+(metformin|insulin|lisinopril))",
    r"(drug\s+interaction|interact.*prescription|grapefruit.*medication)",
    r"(blood\s+sugar.*(350|400|500|600)|feel\s+(dizzy|faint))",
    r"(chest\s+pain|shortness\s+of\s+breath|joint.*swell.*lock)",
    r"(medical\s+emergency|what\s+to\s+do\s+immediately|right\s+now\s+to\s+(drop|fix|treat))",
    r"(cellular\s+level|insulin\s+resistance\s+(mechanism|pathway|work))",
    r"(global\s+population|worldwide\s+prevalence|how\s+many\s+people\s+(have|suffer))",
    r"(historical\s+origin|history\s+of\s+(dash|keto|mediterranean)\s+diet)",
]]

_BOUNDARY_REPLY = (
    "This question is outside the scope of the health-nutrition knowledge graph. "
    "The system provides dietary guidance for managing NCDs (Hypertension, Type 2 Diabetes, "
    "Osteoarthritis, Autoimmune Conditions). It does not provide medical diagnoses, "
    "prescription advice, symptom assessments, or clinical decision support. "
    "Please consult a qualified healthcare professional." + DISCLAIMER
)

_SECURITY_REPLY = (
    "This request has been blocked. The system does not execute destructive operations, "
    "override safety constraints, or expose raw graph data."
)


def _classify(question: str) -> str:
    for pattern in _SECURITY_RE:
        if pattern.search(question):
            return "security"
    for pattern in _BOUNDARY_RE:
        if pattern.search(question):
            return "boundary"
    return "safe"


# ── SPARQL helpers ────────────────────────────────────────────────────────────

def _sparql(query: str) -> list[dict]:
    full_query = SPARQL_PREFIXES + "\n\n" + query
    g = get_graph()
    results = []
    try:
        for row in g.query(full_query):
            record = {}
            for var in row.labels:
                val = row[var]
                if val is None:
                    record[str(var)] = None
                elif isinstance(val, URIRef):
                    s = str(val)
                    record[str(var)] = s.split("#")[-1] if "#" in s else s.split("/")[-1]
                elif isinstance(val, Literal):
                    record[str(var)] = str(val)
                else:
                    record[str(var)] = str(val)
            results.append(record)
    except Exception as exc:
        print(f"[KG] SPARQL error: {exc}", file=sys.stderr)
    return results


def _condition_iri(question: str) -> str | None:
    q = question.lower()
    for keyword, iri in CONDITION_IRIS.items():
        if keyword in q:
            return iri
    return None


def _label_list(rows: list[dict], key: str = "label") -> list[str]:
    seen, out = set(), []
    for r in rows:
        v = r.get(key)
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _fmt(items: list[str]) -> str:
    return "\n".join(f"  - {i}" for i in items) if items else "  (none found)"


# ── KG query functions ────────────────────────────────────────────────────────

def _try_foods_to_avoid(question: str) -> list[dict]:
    iri = _condition_iri(question)
    if not iri:
        return []
    return _sparql(f"""
SELECT DISTINCT ?label WHERE {{
  <{iri}> hlth:should_avoid ?food .
  ?food rdfs:label ?label .
}}""")


def _try_foods_recommended(question: str) -> list[dict]:
    iri = _condition_iri(question)
    if not iri:
        return []
    return _sparql(f"""
SELECT DISTINCT ?label WHERE {{
  {{  ?food hlth:helps_manage <{iri}> . ?food rdfs:label ?label . }}
  UNION
  {{  <{iri}> hlth:managed_by ?food .
      ?food a hlth:FoodItem . ?food rdfs:label ?label . }}
  UNION
  {{  ?diet hlth:recommends ?food .
      ?diet hlth:managed_by <{iri}> .
      ?food rdfs:label ?label . }}
}}""")


def _try_can_lead_to(question: str) -> list[dict]:
    iri = _condition_iri(question)
    if not iri:
        return []
    return _sparql(f"""
SELECT DISTINCT ?label WHERE {{
  <{iri}> hlth:can_lead_to ?other .
  ?other rdfs:label ?label .
}}""")


def _try_symptoms(question: str) -> list[dict]:
    iri = _condition_iri(question)
    if not iri:
        return []
    return _sparql(f"""
SELECT DISTINCT ?label WHERE {{
  <{iri}> hlth:has_symptom ?sym .
  ?sym rdfs:label ?label .
}}""")


def _try_management(question: str) -> list[dict]:
    iri = _condition_iri(question)
    if not iri:
        return []
    return _sparql(f"""
SELECT DISTINCT ?label WHERE {{
  <{iri}> hlth:managed_by ?mgmt .
  ?mgmt rdfs:label ?label .
}}""")


def _try_definition(question: str) -> list[dict]:
    iri = _condition_iri(question)
    if not iri:
        return []
    return _sparql(f"""
SELECT ?label ?def WHERE {{
  <{iri}> rdfs:label ?label .
  OPTIONAL {{ <{iri}> obo:IAO_0000115 ?def }}
}} LIMIT 1""")


# ── Intent router ─────────────────────────────────────────────────────────────

def _route(question: str) -> str | None:
    q = question.lower()

    if any(kw in q for kw in ["avoid", "restrict", "not eat", "should not", "shouldn't", "bad for"]):
        rows = _try_foods_to_avoid(question)
        if rows:
            cond = next((k.title() for k in CONDITION_IRIS if k in q), "the condition")
            return f"Foods to avoid for {cond}:\n\n{_fmt(_label_list(rows))}" + DISCLAIMER

    if any(kw in q for kw in ["recommend", "eat", "good for", "help", "manage", "beneficial",
                               "should eat", "what food", "which food"]):
        rows = _try_foods_recommended(question)
        if rows:
            cond = next((k.title() for k in CONDITION_IRIS if k in q), "the condition")
            return (
                f"Foods and dietary strategies recommended for {cond}:\n\n"
                + _fmt(_label_list(rows)) + DISCLAIMER
            )

    if any(kw in q for kw in ["lead to", "cause", "complication", "result in", "risk of"]):
        rows = _try_can_lead_to(question)
        if rows:
            cond = next((k.title() for k in CONDITION_IRIS if k in q), "the condition")
            return f"{cond} can lead to:\n\n{_fmt(_label_list(rows))}" + DISCLAIMER

    if any(kw in q for kw in ["symptom", "sign", "feel like", "presents as"]):
        rows = _try_symptoms(question)
        if rows:
            cond = next((k.title() for k in CONDITION_IRIS if k in q), "the condition")
            return (
                f"Symptoms associated with {cond}:\n\n"
                + _fmt(_label_list(rows)) + DISCLAIMER
            )

    if any(kw in q for kw in ["manag", "treat", "control", "handle", "deal with",
                               "lifestyle", "strategy", "strategies"]):
        rows = _try_management(question)
        if rows:
            cond = next((k.title() for k in CONDITION_IRIS if k in q), "the condition")
            return (
                f"Management strategies for {cond}:\n\n"
                + _fmt(_label_list(rows)) + DISCLAIMER
            )

    if any(kw in q for kw in ["what is", "what are", "define", "describe",
                               "tell me about", "explain"]):
        rows = _try_definition(question)
        if rows:
            label = rows[0].get("label", "")
            defn  = rows[0].get("def", "")
            if defn:
                return f"{label}\n\n{defn}" + DISCLAIMER

    iri = _condition_iri(question)
    if iri:
        avoid  = _label_list(_try_foods_to_avoid(question))
        recomm = _label_list(_try_foods_recommended(question))
        leads  = _label_list(_try_can_lead_to(question))
        syms   = _label_list(_try_symptoms(question))
        mgmt   = _label_list(_try_management(question))
        cond   = next((k.title() for k in CONDITION_IRIS if k in q), "Condition")

        parts = [f"{cond} - Knowledge Graph Summary\n"]
        if recomm: parts.append(f"Recommended foods / strategies:\n{_fmt(recomm)}\n")
        if avoid:  parts.append(f"Foods to avoid:\n{_fmt(avoid)}\n")
        if mgmt:   parts.append(f"Management approaches:\n{_fmt(mgmt)}\n")
        if leads:  parts.append(f"Can lead to:\n{_fmt(leads)}\n")
        if syms:   parts.append(f"Symptoms:\n{_fmt(syms)}\n")

        if len(parts) > 1:
            return "\n".join(parts) + DISCLAIMER

    return None


def retrieve_from_kg(question: str) -> str | None:
    try:
        return _route(question)
    except Exception as exc:
        print(f"[KG] Retrieval error: {exc}", file=sys.stderr)
        return None


# ── LLM fallback ──────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are MediAssist, a health and nutrition assistant for NCD dietary guidance.

You are given structured data retrieved from a knowledge graph. Your answer must be
based strictly and exclusively on that data. Do not add, infer, or generate any fact,
food, nutrient, condition, or recommendation that is not explicitly present in the
data provided to you. If the data does not contain enough information to answer the
question, say so plainly.

Keep answers concise (2-4 paragraphs). Do not provide medical diagnoses, prescription
advice, or dosage recommendations. Always remind the user to consult a healthcare
professional.
"""


def _call_llm_augment(question: str, kg_rows: list[dict]) -> str:
    """
    Calls the LLM to produce a fluent answer, grounded strictly in kg_rows.
    Only called when kg_rows is non-empty.
    """
    lines = [
        f"  {i+1}. " + ", ".join(f"{k}={v}" for k, v in r.items())
        for i, r in enumerate(kg_rows[:40])
    ]
    context_block = (
        "\n\nData retrieved from the knowledge graph (use only this data in your answer):\n"
        + "\n".join(lines)
    )

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user",   "content": question + context_block},
    ]

    cmu_key = os.getenv("CMU_AI_GATEWAY_KEY")
    if cmu_key:
        try:
            import urllib.request, json as _json
            payload = _json.dumps({
                "model": "gpt-4.1-mini",
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": 600,
            }).encode()
            req = urllib.request.Request(
                "https://ai-gateway.andrew.cmu.edu/v1/chat/completions",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {cmu_key}",
                },
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = _json.loads(resp.read())
            return data["choices"][0]["message"]["content"].strip() + DISCLAIMER
        except Exception as exc:
            print(f"[KG] CMU gateway failed: {exc}", file=sys.stderr)

    if _openai_available:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                client = _OpenAI(api_key=api_key)
                resp = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.1,
                    max_tokens=600,
                )
                return resp.choices[0].message.content.strip() + DISCLAIMER
            except Exception as exc:
                print(f"[KG] OpenAI failed: {exc}", file=sys.stderr)

    return (
        "No LLM available. Set CMU_AI_GATEWAY_KEY or OPENAI_API_KEY for augmented answers."
        + DISCLAIMER
    )


# ── Public entry point ────────────────────────────────────────────────────────

def query_medical_knowledge(question: str) -> dict:
    """
    Main entry point called by the FastAPI layer.

    Returns:
        answer  (str)  - final answer to show the user
        kg_used (bool) - True when the answer came fully or partially from the graph
        source  (str)  - human-readable source label
        blocked (bool) - True if the safety guard intercepted the question
    """
    classification = _classify(question)

    if classification == "security":
        return {"answer": _SECURITY_REPLY, "kg_used": False,
                "source": "Safety Guard", "blocked": True}

    if classification == "boundary":
        return {"answer": _BOUNDARY_REPLY, "kg_used": False,
                "source": "Safety Guard (out of scope)", "blocked": True}

    kg_answer = retrieve_from_kg(question)
    if kg_answer:
        return {"answer": kg_answer, "kg_used": True,
                "source": "Knowledge Graph", "blocked": False}

    iri = _condition_iri(question)
    kg_rows: list[dict] = []
    if iri:
        for fn in [_try_foods_recommended, _try_foods_to_avoid,
                   _try_management, _try_symptoms, _try_can_lead_to]:
            kg_rows.extend(fn(question))

    if kg_rows:
        return {"answer": _call_llm_augment(question, kg_rows),
                "kg_used": True, "source": "KG-augmented LLM", "blocked": False}

    return {
        "answer": (
            "The knowledge graph does not contain information relevant to this question. "
            "No answer can be provided." + DISCLAIMER
        ),
        "kg_used": False,
        "source": "No KG data",
        "blocked": False,
    }


# ── CLI ───────────────────────────────────────────────────────────────────────

def _cli():
    print("\nHealth-Nutrition Knowledge Graph - interactive mode")
    print("Type a question, or 'quit' to exit.\n")

    try:
        g = get_graph()
        print(f"Graph loaded: {len(g):,} triples\n")
    except Exception as exc:
        print(f"[ERROR] Could not load graph: {exc}", file=sys.stderr)
        sys.exit(1)

    while True:
        try:
            question = input("Q: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if question.lower() in ("quit", "exit", "q"):
            print("Goodbye.")
            break

        if not question:
            continue

        result = query_medical_knowledge(question)
        print(f"\nSource: {result['source']}")
        print()
        for line in result["answer"].splitlines():
            print(
                textwrap.fill(line, width=90, initial_indent="  ",
                              subsequent_indent="  ")
                if line.strip() else ""
            )
        print()


if __name__ == "__main__":
    _cli()
