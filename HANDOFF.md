# Handoff — AI Chat Monorepo: Gate 5 Complete → Fix Phase

**Date:** 2026-04-18  
**From:** Tech Lead (Gate 5 Integration Session)  
**To:** Next session engineer  
**Status:** ✅ Gate 1–5 complete. Ready for fix/improvement phase.

---

## ✅ What Was Completed This Session

### 1. Chunking Bug + Jest Hang — FIXED
- **File:** `apps/web/src/lib/chunking.ts`
- **Root cause:** `splitLongParagraph` entered infinite loop when `overlapChars >= maxChars` or with periodic text.
- **Fix:** `start = Math.max(start + 1, end - effectiveOverlap)` guarantees forward progress.
- **Result:** Chunking test went from 79s hang → 0.7s pass.

### 2. Playwright E2E Test — ADDED
- **File:** `apps/web/e2e/chat-full-flow.spec.ts`
- Tests full flow: upload PDF → parse → chunk → query → LLM response
- Mocks `/api/convert`, `/api/chat`, and blocks HuggingFace CDN for speed
- **Status:** Passes consistently (~1s)

### 3. Docker Compose — ADDED
- **Files:** `docker-compose.yml`, `apps/web/Dockerfile`, `apps/web/next.config.js`, `.env.example`
- Multi-stage Next.js build + Python parser service with healthcheck dependency

### 4. Coverage ≥ 90% — ACHIEVED
- **Frontend:** 100/100 tests pass, 90.99% branch coverage
- **Backend:** 45/45 tests pass, ~94% coverage
- Added missing branch coverage tests for error paths, edge cases

### 5. AGENTS.md Init-Deep — CREATED
- `AGENTS.md` at root, `apps/web/`, `apps/parser-service/`, `packages/shared/`
- Deep semantic context for AI agents working in each boundary

---

## 🔴 Priority Fix List (Start Here)

These are the issues found during deep code review. Pick from the top.

### P0 — Critical Bugs

1. **Race condition in ChatInterface (`apps/web/src/components/ChatInterface.tsx`)**
   - `handleSubmitWithPrefilter` uses `setTimeout(() => handleSubmit(e), 0)` after `setContextChunks()`.
   - `handleSubmit` from `useVercelChat` may have stale closure → wrong `system` message sent to LLM.
   - **Fix:** Use `handleSubmit(e, { body: { ...config, system: buildSystemMessage(topChunks) } })` or restructure `useChat.ts` to accept dynamic system messages at submit time.
   - **Files to change:** `ChatInterface.tsx`, `useChat.ts`
   - **Tests to add:** Functional test verifying context chunks appear in the `/api/chat` request body

2. **No fetch timeout in parser client (`apps/web/src/lib/parser-client.ts`)**
   - `fetch('/api/convert')` has no `AbortController` / timeout.
   - Hanging parser service freezes UI indefinitely.
   - **Fix:** Add `AbortController` with 30s timeout, catch `AbortError` → "Upload timed out".
   - **Files to change:** `parser-client.ts`
   - **Tests to add:** Mock delayed response + verify timeout error in `hooks.test.ts`

### P1 — Performance & Reliability

3. **MessageList O(n²) re-renders (`apps/web/src/components/MessageList.tsx`)**
   - No `React.memo`. Long conversations re-render entire list per new message.
   - **Fix:** `export const MessageList = React.memo(function MessageList(...) { ... })`
   - **Files to change:** `MessageList.tsx`
   - **Tests:** Existing tests should still pass; add perf regression test if desired

4. **No React Error Boundaries**
   - A crash in any component kills the entire app.
   - **Fix:** Add an ErrorBoundary around `ChatInterface` in `page.tsx`.
   - **Files to change:** `page.tsx` (new ErrorBoundary component or use `react-error-boundary`)

5. **FileUploader uses DOM anti-pattern (`apps/web/src/components/FileUploader.tsx`)**
   - `document.getElementById('file-input')?.click()` breaks refs/testing.
   - **Fix:** Use `useRef<HTMLInputElement>(null)` and `inputRef.current?.click()`.
   - **Files to change:** `FileUploader.tsx`
   - **Tests:** Update component tests — they already use the hidden input directly so minimal changes

### P2 — Code Quality

6. **embeddings.ts uses `any` (`apps/web/src/lib/embeddings.ts`)**
   - `private extractor: any = null` loses type safety.
   - **Fix:** Define interface for the transformers.js pipeline output, or use `unknown` with runtime guards.
   - **Files to change:** `embeddings.ts`

7. **pytest config split (`apps/parser-service/pytest.ini` + `pyproject.toml`)**
   - pytest warns about config in both files.
   - **Fix:** Consolidate pytest config into `pytest.ini` only. Keep `pyproject.toml` for tool configs (ruff, mypy).
   - **Files to change:** `pyproject.toml`, `pytest.ini`

8. **No retry logic on fetch calls**
   - `parser-client.ts` and `llm-client.ts` have no retry on transient failures.
   - **Fix:** Add exponential backoff retry wrapper (3 retries, max 5s delay).
   - **Files to change:** `parser-client.ts`, `llm-client.ts` (or create `lib/fetch-with-retry.ts`)

### P3 — Architecture / Future

9. **Empty `packages/shared/`**
   - Extract shared types/constants (file extensions, max size, API schemas).
   - **Files to create:** `packages/shared/types.ts`, `packages/shared/constants.ts`

10. **No correlation IDs across services**
    - Add `X-Request-ID` header propagation from frontend → parser → LLM.
    - **Files to change:** `parser-client.ts`, `api/chat/route.ts`, `parser-service` middleware

---

## 📁 Files You Should Read First

To get oriented quickly, read these in order:

1. `AGENTS.md` (root) — monorepo overview
2. `AGENTS.md` (`apps/web/`) — frontend deep context
3. `AGENTS.md` (`apps/parser-service/`) — backend deep context
4. `.context/agents/squad-memory.md` — known issues and priorities
5. The specific file you need to fix (see Priority Fix List above)

---

## 🧪 How to Verify Your Fixes

```bash
# Full test suite (run from repo root)
npm run test              # jest + pytest
npm run test:e2e          # Playwright

# Or individually
cd apps/web && npm test   # frontend jest with coverage
cd apps/parser-service && python -m pytest tests/ -v  # backend pytest

# Build check
cd apps/web && npm run build
```

---

## 🎯 Recommended First Task

**Fix the ChatInterface race condition (P0 #1).** It affects core functionality (context injection into LLM queries) and touches the most critical user path. After fixing:

1. Add a test in `tests/functional/chat-e2e.test.tsx` that verifies the `/api/chat` request body contains the correct `system` message with context chunks.
2. Run `cd apps/web && npm test` to confirm no regressions.
3. Run `cd apps/web && npx playwright test e2e/chat-full-flow.spec.ts` to confirm E2E still passes.

---

## 📊 Current Metrics

| Metric | Value |
|--------|-------|
| Frontend tests | 100/100 pass |
| Frontend branch coverage | 90.99% |
| Backend tests | 45/45 pass |
| Playwright E2E | 1/1 pass |
| Next.js build | ✅ |
| Docker Compose config | ✅ valid |

---

## 📝 Context Notes

- **Browser-side embeddings**: `@huggingface/transformers.js` downloads ~80MB model on first use. E2E tests block this download (`route.abort` on huggingface.co) to stay fast. Unit tests mock the pipeline entirely.
- **Vercel AI SDK data stream v1 format**: For mocking in tests/Playwright, use:
  ```
  0:"text chunk"
  d:{"finishReason":"stop"}
  ```
  Content-Type: `text/plain; charset=utf-8`, Header: `x-vercel-ai-data-stream: v1`
- **Parser service mocked in all jest tests**: Real `markitdown` is never invoked in jest. Integration tests mock `get_converter()`.
