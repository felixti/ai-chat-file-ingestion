# AGENTS.md — Frontend (Next.js 15)

## Overview

The frontend is a single-page chat application. Users upload files, which get parsed into markdown, chunked, indexed, and then used as context for LLM queries. All intelligence (chunking, embedding, search) runs in the browser.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript strict
- **Styling**: Tailwind CSS
- **AI SDK**: Vercel AI SDK (`ai`, `@ai-sdk/openai`) for streaming chat
- **Embeddings**: `@huggingface/transformers.js` (`Xenova/all-MiniLM-L6-v2`)
- **Search**: `minisearch` for lexical pre-filtering
- **Testing**: jest + ts-jest + Testing Library + Playwright

## File Structure & Responsibilities

### `src/app/`

- `page.tsx` — Root page, renders `<ChatInterface />`
- `layout.tsx` — Root layout with metadata
- `api/chat/route.ts` — **Next.js API route** that proxies chat requests to the LLM. Accepts `{messages, baseURL, model, apiKey, system}` and returns a `streamText().toDataStreamResponse()`.

### `src/components/`

All components are functional, `'use client'`, and use named exports.

- `ChatInterface.tsx` — **Orchestrator component**. Coordinates file upload, chunk indexing, embedding ranking, and chat submission. Contains the main state machine.
  - **⚠️ CRITICAL BUG PATTERN**: `handleSubmitWithPrefilter` uses `setTimeout(() => handleSubmit(e), 0)` to delay chat submission after `setContextChunks()`. This is a race-condition workaround. `handleSubmit` from `useVercelChat` may capture a stale closure. If you need to pass dynamic context, prefer using `handleSubmit(e, { body: { ... } })` or restructure so `system` message is computed at submit time.
  - **Accessibility note**: "Clear file & chat" button resets all state.

- `FileUploader.tsx` — Drag-and-drop file input with keyboard support.
  - **Anti-pattern**: Uses `document.getElementById('file-input')?.click()` for click delegation. Should use a React ref instead.
  - ARIA labels: `aria-label="File upload dropzone"`, `role="button"`

- `ChatInput.tsx` — Text input + send button.
  - Handles both form submit and Enter key (without shift)
  - Disables input while loading
  - Shows "Context: file loaded" indicator

- `MessageList.tsx` — Renders chat messages.
  - User messages: plain text, blue bubble
  - Assistant messages: `react-markdown` rendered, gray bubble
  - **Performance issue**: No memoization (`React.memo`). Long conversations re-render entire list on every new message → O(n²) rendering.

### `src/hooks/`

Custom hooks follow the pattern: `useState` for UI state, `useCallback` for handlers, `useRef` for singletons/mutable state that shouldn't trigger re-renders.

- `useChat.ts` — Wraps Vercel AI SDK's `useChat`. Builds a `system` message from `contextChunks`.
  - **Gotcha**: `systemMessage` is built at render time from `options.contextChunks`. If `contextChunks` changes after render but before `handleSubmit` executes, the old system message is sent.
  - `submitWithContext` is a no-op wrapper around `handleSubmit`. Consider removing.

- `useFileUpload.ts` — File validation + upload to parser service.
  - Validates size (50MB max) and extension/MIME type
  - **Issue**: `split('.').pop()` breaks for multi-dot extensions like `tar.gz` (returns `.gz`). Our supported types don't include these, so it's acceptable but fragile.
  - **Issue**: `fetch` in `parser-client.ts` has **no timeout**. A hanging parser service freezes the UI.

- `useChunkIndex.ts` — Chunk text and build a `minisearch` index.
  - Creates a **new** `ChunkIndex` on every `indexMarkdown` call. Old index is GC'd.
  - `isIndexing` state exists but chunking is synchronous — it flips true/false immediately.

- `useEmbeddings.ts` — Loads embedding model and provides `embed`, `embedBatch`, `rankBySimilarity`.
  - Uses `useRef` to cache the `EmbeddingPipeline` singleton
  - **Model load**: First call downloads ~80MB from HuggingFace CDN. Can take 10-60s on slow connections.
  - **Error handling**: All three methods catch errors, set `error` state, and return `null`/`[]`.

### `src/lib/`

Pure functions and classes. No React dependencies.

- `chunking.ts` — Paragraph-aware text chunking.
  - **Algorithm**: Split on `\n\n+` → fit paragraphs into chunks ≤ maxChars → split long paragraphs on sentence boundaries → merge small adjacent chunks.
  - **CRITICAL FIX APPLIED**: `splitLongParagraph` now guarantees forward progress with `start = Math.max(start + 1, end - effectiveOverlap)`. Previous versions hung when `overlapChars >= maxChars`.
  - `effectiveOverlap = Math.min(overlapChars, maxChars - 1)`
  - Default: 512 tokens max, 50 token overlap, 4 chars/token
  - Uses `uuidv4()` for chunk IDs. In tests, the `uuid` import caused jest worker hangs — fixed by the chunking fix (was actually the infinite loop, not uuid).

- `embeddings.ts` — `EmbeddingPipeline` singleton wrapping `@huggingface/transformers.js`.
  - **Type safety issue**: `private extractor: any = null;` — should be typed.
  - `embedBatch` handles both single-item and multi-item arrays. The model's output shape varies: single text returns one object; array returns array.
  - `cosineSimilarity` is a pure function with vector length validation.

- `minisearch-index.ts` — `ChunkIndex` class wrapping `minisearch`.
  - Stores chunks in both `minisearch` (for search) and a `Map` (for retrieval by ID)
  - `search(query, limit=5)` returns lexical matches sorted by BM25-like score
  - **Note**: `storeFields: ['text']` means text is always present in results, so the fallback `|| this.chunks.get(...)` is rarely hit.

- `llm-client.ts` — Thin wrapper around `@ai-sdk/openai`.
  - `createLLMClient(config)` returns an AI SDK model provider
  - Default config targets Ollama at `http://localhost:11434/v1` with model `llama3.2`

- `parser-client.ts` — `fetch` wrapper for `/api/convert`.
  - **Issue**: No `AbortController` / timeout. A slow parser response hangs indefinitely.
  - Maps HTTP 413 → "File too large", 415 → "Unsupported file type"

### `src/types/`

Shared TypeScript interfaces. No runtime validation — API responses are cast with `as ParseResult`.

## Testing Strategy

### Unit Tests (`tests/unit/`)

- `chunking.test.ts` — 19 tests covering empty text, paragraph splits, overlap, sentence boundaries, merge logic, forward progress
- `embeddings.test.ts` — Mocked pipeline tests + cosine similarity math
- `llm-client.test.ts` — Client factory tests
- `minisearch-index.test.ts` — Index CRUD and search
- `components.test.tsx` — FileUploader, ChatInput, MessageList rendering
- `hooks.test.ts` — useFileUpload (validation, success, error, clear) and useChunkIndex
- `useChat.test.ts` — Mocked Vercel AI SDK wrapper
- `useEmbeddings.test.ts` — Mocked embedding hook with error paths

### Integration Tests (`tests/integration/`)

- `file-flow.test.ts` — Mocked `fetch` end-to-end: upload → parse → chunk → index → search

### Functional Tests (`tests/functional/`)

- `chat-e2e.test.tsx` — Jest/jsdom tests rendering `<ChatInterface />` with fully mocked dependencies

### E2E Tests (`e2e/`)

- `chat-full-flow.spec.ts` — **Playwright** test in real Chromium:
  - Mocks `/api/convert` and `/api/chat`
  - Blocks HuggingFace CDN downloads (`route.abort`) to keep tests fast
  - Validates: file upload UI → "File loaded" → chat input → submit → assistant response visible

## Critical Code Patterns

### Adding a new hook

1. Define return interface explicitly
2. Use `useRef` for cached singletons (pipelines, indexes)
3. Use `useCallback` for all async handlers
4. Catch errors with `err instanceof Error ? err.message : 'Fallback'` pattern
5. Add tests in `tests/unit/` with jest mocks

### Adding a new component

1. `'use client'` directive for interactivity
2. Named exports
3. Co-located tests in `tests/unit/components.test.tsx` or new file
4. Use `aria-label` and `role` for test selectors
5. Prefer `userEvent` over `fireEvent` for interactions

### Modifying the chunking algorithm

1. The forward-progress invariant is **critical**: every iteration must advance `start` by ≥ 1
2. Test with periodic text (e.g., `'word '.repeat(200)`) to catch `text.indexOf` fallback issues
3. Test with `overlapChars > maxChars` to catch infinite loops

## Common Pitfalls

- **jest picks up Playwright tests**: `jest.config.js` ignores `/e2e/` directory. If you create new `.spec.ts` files outside `tests/`, add the path to `testPathIgnorePatterns`.
- **transformers.js in jest**: The ESM-only `@huggingface/transformers` package is mocked in all jest tests. Never import it directly in jest — use the mock.
- **Vercel AI SDK data stream format**: For mocking in Playwright, use `0:"text"\n` for text chunks and `d:{"finishReason":"stop"}\n` for finish. Content-Type should be `text/plain; charset=utf-8` with header `x-vercel-ai-data-stream: v1`.
- **Next.js rewrites in Docker**: `next.config.js` reads `PARSER_SERVICE_URL` env var. In Docker, this must point to `http://parser-service:8000` (service name), not `localhost`.
