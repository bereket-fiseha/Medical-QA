# MediAssist — Multilingual Medical Chatbot

A full-stack medical Q&A chatbot that supports **English**, **Kinyarwanda (rw)**, and **Taita/Dawida (dav)**.
Users ask questions in their native language; the system transparently translates, queries the medical knowledge pipeline, and returns the answer back in the same language.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Architecture & Data Flow](#2-architecture--data-flow)
3. [Component Breakdown](#3-component-breakdown)
   - [API — FastAPI Backend](#api--fastapi-backend)
   - [KG — Knowledge Graph + LLM](#kg--knowledge-graph--llm)
   - [UI — Next.js Frontend](#ui--nextjs-frontend)
4. [Prerequisites](#4-prerequisites)
5. [Environment Setup](#5-environment-setup)
6. [Running the Project](#6-running-the-project)
7. [API Reference](#7-api-reference)
8. [Extending the Knowledge Graph](#8-extending-the-knowledge-graph)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Project Structure

```
src/
├── API/                        # FastAPI backend
│   ├── main.py                 # All API endpoints
│   ├── startup.py              # Helper: loads .env and launches server
│   └── requirements.txt        # (see src/requirements.txt at root)
│
├── KG/                         # Knowledge Graph + LLM module
│   ├── __init__.py
│   └── knowledge_graph.py      # KG retrieval + GPT-4o-mini (placeholder)
│
├── UI/                         # Next.js 15 frontend (App Router)
│   ├── app/
│   │   ├── globals.css         # Tailwind base styles + Google Fonts
│   │   ├── layout.tsx          # Root HTML layout, metadata
│   │   └── page.tsx            # Entry point → renders <ChatPage />
│   ├── components/
│   │   ├── ChatPage.tsx        # Root client component, all state lives here
│   │   ├── Sidebar.tsx         # Language picker, quick topics, new chat
│   │   ├── Topbar.tsx          # Current language pill + status indicator
│   │   ├── WelcomeScreen.tsx   # Shown before the first message
│   │   ├── MessageBubble.tsx   # Renders a single user/assistant/error message
│   │   ├── TypingIndicator.tsx # Animated "…" bubble while waiting for API
│   │   ├── ChatInput.tsx       # Auto-resizing textarea + send button
│   │   └── TranslationToast.tsx# Floating notification during translation
│   ├── lib/
│   │   ├── types.ts            # Shared TypeScript interfaces
│   │   ├── constants.ts        # Languages, quick topics, suggestion cards
│   │   ├── api.ts              # fetch() wrappers for the FastAPI backend
│   │   ├── format.ts           # Markdown formatter + disclaimer extractor
│   │   └── nanoid.ts           # Tiny collision-resistant ID generator
│   ├── next.config.ts          # Rewrites /api/* → FastAPI (no CORS needed)
│   ├── tailwind.config.ts      # Design tokens, custom animations
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── package.json
│   └── .env.local              # FASTAPI_URL (defaults to localhost:8000)
│
├── .env                        # Your local secrets (never commit)
├── .env.example                # Template — copy to .env
└── requirements.txt            # Python dependencies for API + KG
```

---

## 2. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser  (UI — Next.js on :3000)                               │
│                                                                  │
│  User types in Kinyarwanda / Taita / English                    │
│       │                                                          │
│       │  POST /api/chat   (proxied by next.config.ts rewrites)  │
│       ▼                                                          │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Backend  (API/main.py  on :8000)                       │
│                                                                  │
│  1. Validate language code                                       │
│  2. Translate input → English   ──► Modal Translation API       │
│                                     (bereketfiseha123 endpoint) │
│  3. Query KG + LLM  ──────────────► KG/knowledge_graph.py       │
│                                     ├─ retrieve_from_kg()  [TODO]│
│                                     └─ call_llm() → GPT-4o-mini │
│  4. Translate answer → user language ► Modal Translation API    │
│  5. Return ChatResponse JSON                                     │
├─────────────────────────────────────────────────────────────────┤
│  Browser renders answer in the correct language                  │
└─────────────────────────────────────────────────────────────────┘
```

The Next.js rewrite in `UI/next.config.ts` means the browser always calls `/api/*` on the same origin — no CORS configuration needed in development or production.

---

## 3. Component Breakdown

### API — FastAPI Backend

**File:** `API/main.py`

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness check — confirms server is up |
| `/api/languages` | GET | Returns the list of supported languages |
| `/api/chat` | POST | Full pipeline: translate → KG/LLM → translate back |
| `/api/translate` | POST | Raw translation utility (useful for testing) |
| `/api/medical-query` | POST | English-only KG/LLM query, skips translation |

**Key internal helpers in `main.py`:**
- `query_translator(text, direction)` — calls the Modal multilingual API
- `translate_to_english(text, lang_code)` — wraps query_translator for input
- `translate_from_english(text, lang_code)` — wraps query_translator for output

---

### KG — Knowledge Graph + LLM

**File:** `KG/knowledge_graph.py`

This is the core intelligence module. It has two stages:

| Function | Status | Description |
|---|---|---|
| `retrieve_from_kg(query)` | **Placeholder** | Returns `None` — wire your graph retrieval here |
| `call_llm(question, kg_context)` | Active | Calls GPT-4o-mini; falls back to a static response if no API key |
| `query_medical_knowledge(question)` | Active | Public entry point called by FastAPI |

**To plug in a real Knowledge Graph**, edit `retrieve_from_kg()` to return a context string from your graph (Neo4j Cypher, SPARQL, vector search, etc.). That string is automatically injected into the GPT-4o-mini prompt as `[Relevant Medical Knowledge]`.

---

### UI — Next.js Frontend

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Lucide icons

#### `components/ChatPage.tsx`
The root client component. Owns all application state:
- `messages` — full conversation history
- `currentLang` — selected language code (`en` | `rw` | `dav`)
- `status` — `ready` | `loading` | `translating` | `error`
- `isTyping` — controls the typing indicator
- `inputValue` — controlled textarea value

Calls `lib/api.ts → sendChatMessage()` and distributes results to child components.

#### `components/Sidebar.tsx`
- Language switcher (English / Kinyarwanda / Taita)
- Quick topic buttons (pre-filled prompts)
- New Conversation button
- Collapses on mobile behind an overlay

#### `components/Topbar.tsx`
- Hamburger menu to toggle sidebar
- Current language pill
- Live status dot (green = ready, amber pulsing = processing, red = error)

#### `components/WelcomeScreen.tsx`
Shown before the first message. Displays four suggestion cards. Clicking any card fires the prompt immediately.

#### `components/MessageBubble.tsx`
Renders one message. Handles three roles:
- `user` — blue right-aligned bubble
- `assistant` — white left-aligned card with markdown rendering and disclaimer box
- `error` — red tinted card

Displays translation tag, source badge (e.g. "GPT-4o-mini (placeholder)"), and timestamp in the meta row below the bubble.

#### `components/TypingIndicator.tsx`
Three-dot animated bubble shown while the API call is in flight.

#### `components/ChatInput.tsx`
- Auto-resizing textarea (up to 140px tall)
- Language badge reflects selected language
- Placeholder text changes per language
- Send on `Enter`, newline on `Shift+Enter`
- Character counter (max 2000)

#### `components/TranslationToast.tsx`
Floating pill notification that appears when a non-English request is being translated (e.g. "Translating from Kinyarwanda to English…"). Auto-hides after 3 seconds.

#### `lib/api.ts`
Two functions:
- `sendChatMessage(req)` — `POST /api/chat`, throws on non-2xx with a clean error message
- `checkHealth()` — `GET /api/health`, returns boolean

#### `lib/format.ts`
- `formatAssistantText(raw)` — strips the medical disclaimer into a separate field, converts `**bold**`, `*italic*`, bullet lists, and numbered lists to HTML
- `formatTime(date)` — formats a Date to HH:MM

#### `lib/constants.ts`
Single source of truth for languages, quick topic prompts, and welcome screen suggestions. Edit this file to add new languages or topics.

#### `lib/types.ts`
Shared TypeScript interfaces: `Message`, `ChatApiRequest`, `ChatApiResponse`, `Language`, `LanguageCode`.

---

## 4. Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Internet access | — | Translation API + OpenAI are external |

---

## 5. Environment Setup

### Python (.env)

```bash
# From src/
cp .env.example .env
```

Open `.env` and fill in:

```env
# Required for GPT-4o-mini responses
OPENAI_API_KEY=sk-...your-key...

# Optional — override the translation API URL
# TRANSLATE_API_URL=https://bereketfiseha123--translate-multilingual.modal.run
```

> **No API key?** The system still works — the KG module falls back to a clearly labelled placeholder response so you can test the full pipeline without spending tokens.

### Next.js (.env.local)

`UI/.env.local` is already pre-configured:

```env
FASTAPI_URL=http://localhost:8000
```

Change this only if your FastAPI runs on a different port or host.

---

## 6. Running the Project

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — FastAPI Backend

```bash
# From the src/ directory
pip install -r requirements.txt

# Start the server
uvicorn API.main:app --reload --port 8000
```

Verify it's running:
```
http://localhost:8000/api/health     → { "status": "ok" }
http://localhost:8000/docs           → Interactive Swagger UI
```

### Terminal 2 — Next.js Frontend

```bash
# From src/UI/
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

> On Windows, if you get an execution policy error run this first:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

### Production build

```bash
# UI
cd src/UI
npm run build
npm start          # serves on :3000

# API (no --reload in production)
uvicorn API.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 7. API Reference

### `POST /api/chat`

The main endpoint. Handles the full multilingual pipeline.

**Request body:**
```json
{
  "message": "Ndwaye inkorora n'umuriro. Ni iki nakora?",
  "language": "rw",
  "conversation_id": "optional-session-id"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | Yes | User's question (max 2000 chars) |
| `language` | string | Yes | `"en"`, `"rw"`, or `"dav"` |
| `conversation_id` | string | No | Optional session tracking ID |

**Response:**
```json
{
  "response": "...",            // Answer in the user's language
  "original_message": "...",   // Original user text
  "translated_input": "...",   // English translation of the input (null if English)
  "language": "rw",
  "kg_used": false,
  "source": "GPT-4o-mini (placeholder)"
}
```

### `POST /api/translate`

**Request body:**
```json
{
  "text": "Hello, how are you?",
  "direction": "en-rw"
}
```

Valid directions: `rw-en`, `en-rw`, `dav-en`, `en-dav`

### `POST /api/medical-query`

English-only, skips translation. Useful for backend testing.

```json
{ "question": "What are symptoms of malaria?" }
```

---

## 8. Extending the Knowledge Graph

Open `KG/knowledge_graph.py` and implement `retrieve_from_kg()`:

```python
def retrieve_from_kg(query: str) -> Optional[str]:
    # Example: Neo4j Cypher query
    # driver = GraphDatabase.driver(NEO4J_URI, auth=(USER, PASS))
    # results = driver.session().run("MATCH (d:Disease) WHERE ...")
    # return format_results(results)

    # Example: SPARQL against SNOMED CT / ICD-10
    # sparql.setQuery(f"SELECT ?label WHERE {{ ?s rdfs:label '{query}' }}")

    # Example: vector similarity search
    # embedding = embed(query)
    # results = vector_store.search(embedding, top_k=5)
    # return "\n".join(r.text for r in results)

    return None  # Remove this line once implemented
```

The returned string is automatically prepended to the GPT-4o-mini prompt as:
```
[Relevant Medical Knowledge]
<your KG context here>

[Patient Question]
<user's question>
```

---

## 9. Troubleshooting

**`npm run dev` fails with "execution policy" error (Windows)**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run dev
```

**`ModuleNotFoundError: No module named 'KG'`**
Make sure you run uvicorn from the `src/` directory, not from inside `API/`:
```bash
# Correct — from src/
uvicorn API.main:app --reload --port 8000
```

**Translation returns `null` / 502 error**
The Modal translation API is an external service. Check your internet connection and confirm the endpoint is reachable:
```bash
curl -X POST https://bereketfiseha123--translate-multilingual.modal.run \
  -H "Content-Type: application/json" \
  -d '{"text": "hello", "direction": "en-rw"}'
```

**OpenAI returns a placeholder response instead of a real answer**
The `.env` file is missing or the `OPENAI_API_KEY` is not set. The system will still work — it just returns the static placeholder text.

**UI shows "Unable to connect to the MediAssist server"**
The FastAPI backend is not running. Start it in a separate terminal (see [Running the Project](#6-running-the-project)).

**Port 8000 already in use**
```bash
uvicorn API.main:app --reload --port 8001
# Then update UI/.env.local:
# FASTAPI_URL=http://localhost:8001
```
