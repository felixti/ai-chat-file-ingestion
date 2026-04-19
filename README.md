# AI Chat with File Ingestion

A full-stack AI chat application that lets you upload documents, extract their text, and query an LLM with the document content as context.

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Next.js    │──────│  Python FastAPI  │──────│  markitdown  │
│  (Browser)  │      │  (Parser Service)│      │  (Python)    │
└─────────────┘      └─────────────────┘      └──────────────┘
```

- **Frontend**: Next.js 15 app with browser-side chunking, embedding, and search
- **Backend**: Python FastAPI parser service using Microsoft's `markitdown`
- **LLM**: OpenAI-compatible API via Vercel AI SDK (Ollama primary target)

## How It Works

### File Upload & Indexing Flow

```
     ┌──────────┐
     │  User    │──────┐
     │ drops    │      │ 1. Select file
     │ file     │      ▼
     └──────────┘   ┌────────────────────┐
                    │   FileUploader     │
                    │   Component        │
                    └────────┬───────────┘
                             │ 2. onFileSelect(file)
                             ▼
                    ┌────────────────────┐
                    │  useFileUpload()   │
                    │   • validate file  │
                    │   • upload to API  │
                    └────────┬───────────┘
                             │ 3. POST /api/convert
                             │    (FormData with file)
                             ▼
                    ┌────────────────────┐
                    │   Next.js Rewrite  │───► Parser Service
                    │   /api/convert ──► │     :8000/convert
                    └────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  Parser Service    │
                    │  (Python/FastAPI)  │
                    │   markitdown       │
                    │   converts file    │
                    │   → markdown text  │
                    └────────┬───────────┘
                             │ 4. {filename, markdown}
                             ▼
                    ┌────────────────────┐
                    │  ChatInterface     │
                    │  useEffect() fires │
                    └────────┬───────────┘
                             │ 5. indexMarkdown(md)
                             ▼
              ┌──────────────┴──────────────┐
              │      CHUNKING & INDEXING    │
              │         (browser-side)      │
              └─────────────────────────────┘

              ┌─────────────────────────┐
              │    chunkText(markdown)  │
              │  • split by paragraphs  │
              │  • merge small chunks   │
              │  • max ~2048 chars each │
              └───────────┬─────────────┘
                          │ 6. Chunk[]
                          ▼
              ┌─────────────────────────┐
              │   new ChunkIndex()      │
              │  ┌─────────────────┐    │
              │  │   minisearch    │    │
              │  │  inverted index │    │
              │  │  (word → chunk) │    │
              │  └─────────────────┘    │
              └─────────────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ "N chunks   │
                   │  indexed"   │◄── UI badge
                   └─────────────┘
```

### Chat Query Flow (Two-Stage Retrieval)

```
     ┌──────────┐
     │  User    │──────┐
     │ types    │      │ 7. "What was revenue?"
     │ query    │      ▼
     └──────────┘   ┌────────────────────┐
                    │   ChatInput          │
                    │   onSubmit()         │
                    └────────┬─────────────┘
                             │ 8. handleSubmitWithPrefilter()
                             ▼
                    ┌────────────────────┐
                    │  Stage 1:          │
                    │  minisearch        │
                    │  search(query)     │
                    │                    │
                    │  Lexical match:    │
                    │  finds chunks with │
                    │  query words       │
                    │  (fast, no model)  │
                    └────────┬───────────┘
                             │ 9. top 5 chunks
                             ▼
                    ┌────────────────────┐
                    │  Stage 2:          │
                    │  Embeddings        │
                    │                    │
                    │  embedBatch([      │
                    │    query,           │
                    │    chunk1,          │
                    │    ...chunk5        │
                    │  ])                 │
                    │                     │
                    │  Model:             │
                    │  Xenova/all-MiniLM  │
                    │  -L6-v2             │
                    │  (384-dim vectors)  │
                    └────────┬───────────┘
                             │ 10. 6 vectors
                             ▼
                    ┌────────────────────┐
                    │  Cosine Similarity │
                    │                    │
                    │  sim(query, chunk) │
                    │    = dot(a,b) /    │
                    │    (|a| × |b|)     │
                    │                    │
                    │  Range: -1 to +1   │
                    └────────┬───────────┘
                             │ 11. ranked[]
                             ▼
                    ┌────────────────────┐
                    │  Take top 3 chunks │
                    │  by similarity     │
                    └────────┬───────────┘
                             │ 12. topChunks[3]
                             ▼
                    ┌────────────────────┐
                    │  buildSystemMsg()  │
                    │                     │
                    │  "You are helpful…  │
                    │   [1] Revenue was   │
                    │   $10M this year    │
                    │   [2] Expenses $8M" │
                    └────────┬───────────┘
                             │ 13. POST /api/chat
                             ▼
                    ┌────────────────────┐
                    │   LLM (Ollama/    │
                    │   OpenAI/etc)     │
                    │   generates       │
                    │   response        │
                    └────────┬───────────┘
                             │ 14. streamed answer
                             ▼
                          ┌──────┐
                          │ User │
                          │ sees │
                          │answer│
                          └──────┘
```

**Why two stages?**
- **minisearch** = instant lexical filter (word matching, no model download)
- **embeddings** = slow but semantic (understands meaning, not just words)
- Together: minisearch narrows to 5 candidates, embeddings rank only those 5 — fast + accurate

## Features

- 📄 **File Upload**: Drag-and-drop or click to upload PDF, PPTX, DOCX, XLSX, MD, CSV, TXT, JSON/JSONC/JSONL
- 🔍 **Intelligent Search**: Two-stage retrieval — minisearch lexical pre-filter → embedding cosine similarity → top-3 chunks to LLM
- 🧠 **Browser-Side AI**: Chunking, embedding, and search all happen in the browser via `@huggingface/transformers.js`
- 💬 **Streaming Chat**: Real-time LLM responses with Vercel AI SDK streaming
- 🎛️ **Model Selector**: Choose from server-allowlisted models in the UI dropdown
- 🔒 **Security**: Server-side LLM config, rate limiting, input validation, CORS restrictions

## Quick Start

### Prerequisites

- **Node.js 18+** and `npm`
- **Python 3.12+**
- **uv** (Python toolchain) — https://docs.astral.sh/uv/getting-started/installation
- **Ollama** (for local LLM mode) — https://ollama.com/download

### 1. Configure Environment

```bash
cp .env.example .env
```

Pick your LLM mode:

#### Local Ollama (free, runs on your GPU/CPU)

```bash
# Pull models you want to use
ollama pull qwen3.6
ollama pull llama3.2
```

```env
# .env
LLM_BASE_URL=http://localhost:11434/v1
LLM_DEFAULT_MODEL=qwen3.6
LLM_ALLOWLIST=qwen3.6,qwen3.6:35b-a3b,llama3.2
LLM_API_KEY=ollama   # required by OpenAI SDK but ignored by Ollama
```

#### Ollama Cloud (no GPU needed, uses your API key)

Get an API key at https://ollama.com/account → "API Keys"

```env
# .env
LLM_BASE_URL=https://ollama.com/v1
LLM_DEFAULT_MODEL=qwen3.6
LLM_ALLOWLIST=qwen3.6,qwen3.6:35b-a3b,llama3.2,gpt-oss:120b
LLM_API_KEY=sk-ollama-xxxxxxxxxxxxxxxx   # your actual key
```

### 2. Start the Parser Service (Python)

```bash
cd apps/parser-service
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
python -m src.main
```

Verify: `curl http://localhost:8000/health` → `{"status":"healthy"}`

### 3. Start the Web App (Node.js)

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000

### Docker Compose (Alternative)

```bash
docker compose up --build
```

## Quality Harness

Git hooks enforce the same checks locally that run in CI. No broken code reaches `main`.

### Install hooks (once)

```bash
npm install          # installs husky + lint-staged at root
npm run prepare      # enables husky hooks
```

### What runs when

| Hook | Trigger | Checks |
|------|---------|--------|
| `pre-commit` | `git commit` | Lint + format **staged files only** (ruff, ESLint, Prettier, jest on changed files) |
| `pre-push` | `git push` | Full suite: typecheck, lint, tests, build |

### Manual commands

```bash
# Frontend
npm run lint:web        # ESLint
npm run format:check:web # Prettier check
npm run typecheck:web   # tsc --noEmit
npm run test:web        # jest with coverage

# Backend
npm run lint:parser     # ruff check
npm run test:parser     # pytest

# Full suite (same as CI)
npm run test:all
```

### Bypass (emergency only)

```bash
git commit -m "wip" --no-verify   # skip pre-commit
git push --no-verify                # skip pre-push
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| AI SDK | Vercel AI SDK, `@ai-sdk/openai` |
| Browser AI | `@huggingface/transformers.js`, `minisearch` |
| Backend | Python 3.12, FastAPI, pydantic, uv |
| Parsing | `markitdown` (Microsoft) |
| Observability | OpenTelemetry, Prometheus |
| Testing | jest, pytest, Playwright |

## Project Structure

```
├── apps/web/                 # Next.js frontend
│   ├── src/app/              # App Router pages + API routes
│   ├── src/components/       # React UI components
│   ├── src/hooks/            # Custom React hooks
│   ├── src/lib/              # Business logic
│   ├── tests/                # jest tests
│   └── e2e/                  # Playwright tests
├── apps/parser-service/      # Python FastAPI backend
│   ├── src/routes/           # HTTP endpoints
│   ├── src/services/         # File conversion logic
│   ├── src/telemetry/        # OpenTelemetry tracing
│   └── tests/                # pytest tests
├── packages/shared/          # Shared constants
└── docker-compose.yml        # One-command local dev
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Model dropdown empty | `/api/models` fetch failed | Check `.env` has `LLM_ALLOWLIST` set; for cloud mode ensure `LLM_API_KEY` is valid |
| `Connection refused` on chat | Ollama not running | Start Ollama: `ollama serve` (local) or verify API key (cloud) |
| `Rate limit exceeded` | Hit 20 req/min limit | Wait 60s; limiter is in-memory and resets on server restart |
| Parser returns 500 | `markitdown` missing system deps | Install pandoc/LibreOffice (see parser-service README) |
| File upload stuck | Parser service not reachable | Check `PARSER_SERVICE_URL` matches where parser is running |

## Security Notes

- LLM configuration (`baseURL`, `model`, `apiKey`) is **server-side only** — never exposed to the browser
- File uploads are validated by extension and size (max 50MB)
- Rate limiting: 10 req/min on `/convert`, 20 req/min on `/api/chat`
- Metrics endpoint (`/metrics`) restricted to localhost

## Publishing to GitHub

### Prerequisites

Install the [GitHub CLI](https://cli.github.com/):

```bash
# macOS
brew install gh

# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# Login
gh auth login
```

### Create the repo

```bash
cd /path/to/this/project

# Initialize git (if not already)
git init

# Stage everything
git add .

# Check that .env files are NOT staged
git status

# You should NOT see .env, .env.local, or node_modules/ in the staged list.
# If you do, check .gitignore is correct.

# First commit
git commit -m "Initial commit"

# Create public repo on GitHub
gh repo create ai-chat-file-ingestion --public --source=. --remote=origin --push

# Or private:
# gh repo create ai-chat-file-ingestion --private --source=. --remote=origin --push
```

**Verify `.env` is NOT tracked:**

```bash
git check-ignore -v .env
# Should print: .gitignore:2:.env    .env
```

If `.env` is already tracked by git (from before `.gitignore`), remove it from git history:

```bash
git rm --cached .env
git rm --cached apps/web/.env apps/parser-service/.env
git commit -m "Remove .env files from tracking"
```

## License

MIT
