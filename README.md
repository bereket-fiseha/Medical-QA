# MediAssist — Multilingual NCD & Diet Chatbot

A full-stack Medical Q&A chatbot focused on **Non-Communicable Diseases (NCDs) and diet/nutrition**, supporting **English**, **Kinyarwanda (rw)**, and **Taita/Dawida (dav)**.
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
│   └── knowledge_graph.py      # KG retrieval (primary) + GPT-4o-mini (temp fallback)
│
├── UI/                         # Next.js 15 frontend (App Router)
│   ├── app/
│   │   ├── globals.css         # Tailwind base styles + Google Fonts
│   │   ├── layout.tsx          # Root HTML layout, metadata
│   │   └── page.tsx            # Entry point → renders <ChatPage />
│   ├── components/
│   │   ├── ChatPage.tsx        # Root client component, all state lives here
│   │   ├── Sidebar.tsx         # Language picker, new chat button
│   │   ├── Topbar.tsx          # Current language pill + status indicator
│   │   ├── WelcomeScreen.tsx   # Shown before the first message (NCD suggestion cards)
│   │   ├── MessageBubble.tsx   # Renders a single user/assistant/error message
│   │   ├── TypingIndicator.tsx # Animated "…" bubble while waiting for API
│   │   ├── ChatInput.tsx       # Auto-resizing textarea + send button
│   │   └── TranslationToast.tsx# Floating notification during translation
│   ├── lib/
│   │   ├── types.ts            # Shared TypeScript interfaces
│   │   ├── constants.ts        # Languages + NCD-focused suggestion cards
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
│  3. Query knowledge pipeline ─────► KG/knowledge_graph.py       │
│       │                                                          │
│       ├─ retrieve_from_kg() returns answer?                      │
│       │     YES → use KG answer directly  (GPT never called)    │
│       │     NO  → _call_gpt_fallback()    (temporary)           │
│                                                                  │
│  4. Translate answer → user language ► Modal Translation API    │
│  5. Return ChatResponse JSON                                     │
├─────────────────────────────────────────────────────────────────┤
│  Browser renders answer in the correct language                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key design principle:** `retrieve_from_kg()` is the authoritative answer source. When it returns a string, that string goes directly to the user — `_call_gpt_fallback()` is never reached. GPT is a temporary stand-in only while the KG is being built. The `source` field in every API response tells you which path was taken:
- `"Knowledge Graph"` — answer came from KG, GPT was not used
- `"GPT-4o-mini (temporary fallback)"` — KG returned nothing, GPT was used

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

### KG — Knowledge Graph (Primary Answer Source)

**File:** `KG/knowledge_graph.py`

This is the core intelligence module. Answer source priority is strict:

| Priority | Function | Status | Description |
|---|---|---|---|
| **1 — Primary** | `retrieve_from_kg(query)` | **TODO** | Returns a complete answer string, or `None` if not found. When it returns a value, GPT is never called. |
| **2 — Fallback** | `_call_gpt_fallback(question)` | Active (temporary) | Called only when `retrieve_from_kg()` returns `None`. Uses GPT-4o-mini. Remove once KG is fully wired. |
| Entry point | `query_medical_knowledge(question)` | Active | Called by FastAPI. Runs priority 1, then priority 2 if needed. |

**The `source` field in API responses reflects which path was taken:**
- `"Knowledge Graph"` → KG answered, GPT was bypassed
- `"GPT-4o-mini (temporary fallback)"` → KG had no answer, GPT was used

**To wire in your KG**, implement `retrieve_from_kg()` — see [Section 8](#8-wiring-in-the-knowledge-graph).

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
- New Conversation button
- Collapses on mobile behind an overlay

#### `components/Topbar.tsx`
- Hamburger menu to toggle sidebar
- Current language pill
- Live status dot (green = ready, amber pulsing = processing, red = error)

#### `components/WelcomeScreen.tsx`
Shown before the first message. Displays four NCD-focused suggestion cards (hypertension, diabetes, heart attack, diet). Clicking any card fires the prompt immediately. Topic pills at the bottom show the scope: Hypertension, Diabetes, Heart Disease, Stroke, Obesity, Diet & Nutrition.

#### `components/MessageBubble.tsx`
Renders one message. Handles three roles:
- `user` — blue right-aligned bubble
- `assistant` — white left-aligned card with markdown rendering and disclaimer box
- `error` — red tinted card

Displays translation tag, source badge (e.g. `"Knowledge Graph"` or `"GPT-4o-mini (temporary fallback)"`), and timestamp in the meta row below the bubble.

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
Single source of truth for languages and NCD-focused welcome screen suggestion cards. Edit this file to add new languages or update suggestion prompts.

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
  "source": "GPT-4o-mini (temporary fallback)"
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

## 8. Wiring in the Knowledge Graph

Open `KG/knowledge_graph.py` and implement `retrieve_from_kg()`. This is the **only function you need to change** — everything else (translation, API routing, UI display) is already wired up.

**Contract:** return a plain string answer, or `None` if nothing found.

```python
def retrieve_from_kg(query: str) -> Optional[str]:
    # When this returns a string → sent directly to user, GPT is never called
    # When this returns None   → GPT-4o-mini fallback is used temporarily

```

Once `retrieve_from_kg()` returns real answers:
- `kg_used` in the API response flips to `true`
- The source badge in the UI shows `"Knowledge Graph"` instead of `"GPT-4o-mini (temporary fallback)"`
- You can safely remove `_call_gpt_fallback()` and the `openai` dependency

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

**`OPENAI_API_KEY` is set but GPT still not responding**
Restart the uvicorn server after editing `.env` — environment variables are loaded at startup, not on each request.

**`kg_used` is always `false` in API responses**
Expected — `retrieve_from_kg()` currently returns `None` (not yet implemented). Once you wire in your KG, it will return `true`.

**OpenAI returns a placeholder response instead of a real answer**
The `.env` file is missing or `OPENAI_API_KEY` is not set. The GPT fallback will return a descriptive error message instead. See [Environment Setup](#5-environment-setup).

**UI shows "Unable to connect to the MediAssist server"**
The FastAPI backend is not running. Start it in a separate terminal (see [Running the Project](#6-running-the-project)).

**Port 8000 already in use**
```bash
uvicorn API.main:app --reload --port 8001
# Then update UI/.env.local:
# FASTAPI_URL=http://localhost:8001
```
