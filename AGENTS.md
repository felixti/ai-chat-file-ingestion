# AGENTS.md — AI Chat Monorepo

## Overview
This is a full-stack AI chat application with file ingestion. It consists of:
- **Frontend**: Next.js 15 app with browser-side chunking, embedding, and search
- **Backend**: Python FastAPI parser service using Microsoft's `markitdown`
- **Goal**: Upload any document → extract text → chunk → embed → query with LLM context

## Monorepo Layout
```
├── apps/web/              # Next.js 15 (port 3000)
│   ├── src/app/           # App Router pages + API routes
│   ├── src/components/    # React UI components
│   ├── src/hooks/         # Custom React hooks
│   ├── src/lib/           # Business logic (chunking, embeddings, search, LLM)
│   ├── src/types/         # Shared TypeScript types
│   ├── tests/             # jest unit + integration tests
│   └── e2e/               # Playwright E2E tests
├── apps/parser-service/   # Python FastAPI (port 8000)
│   ├── src/routes/        # HTTP endpoints
│   ├── src/services/      # File conversion logic
│   ├── src/telemetry/     # OpenTelemetry tracing
│   ├── src/models/        # Pydantic schemas
│   └── tests/             # pytest unit + integration tests
├── packages/shared/       # (reserved for shared types/contracts)
└── docker-compose.yml     # One-command local dev
```

## Key Architectural Decisions
1. **Browser-side intelligence**: Chunking, embedding, and search all happen in the browser via `@huggingface/transformers.js` and `minisearch`. Zero server cost for vectorization; data never leaves the browser.
2. **Python parser service**: `markitdown` requires Python ecosystem (pandoc, LibreOffice for some parsers). Cannot run in Node.js.
3. **OpenAI-compatible API**: Uses Vercel AI SDK with configurable baseURL/model. Works with Ollama, OpenAI, Groq, etc.
4. **Two-stage retrieval**: `minisearch` lexical pre-filter → embedding cosine similarity ranking → top-3 chunks to LLM.

## Running the Project
```bash
# Docker Compose (recommended)
docker compose up --build

# Manual — backend
cd apps/parser-service
pip install -e ".[dev]"
python -m src.main

# Manual — frontend
cd apps/web
npm install
npm run dev
```

## Testing
```bash
# Root orchestration
npm run test        # runs both frontend jest + backend pytest
npm run test:web    # frontend jest with coverage
npm run test:parser # backend pytest with coverage
npm run test:e2e    # Playwright E2E tests
```

## Environment Variables
See `.env.example` at repo root. Key vars:
- `PARSER_SERVICE_URL` — where Next.js proxies `/api/convert` (default: `http://localhost:8000`)
- `PARSER_HOST`, `PARSER_PORT`, `PARSER_CORS_ORIGINS` — parser service config
- `PARSER_ENABLE_TELEMETRY` — toggle OpenTelemetry

## Known Cross-Cutting Issues
- **No retry logic** on parser client or LLM client fetches
- **No request ID / correlation ID** propagation across services
- **Frontend has no React Error Boundaries** — a crash in any component kills the entire app
- **Parser service reads entire file into memory** (`await file.read()`) — acceptable up to 50MB but not scalable
- **pytest config split** between `pyproject.toml` and `pytest.ini` — can cause confusion about which takes precedence
