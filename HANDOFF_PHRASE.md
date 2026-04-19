# Handoff Phrase

Copy-paste this into your next session to pick up where we left off:

---

## 🚀 Start Here

```
Read HANDOFF.md at repo root for the full context, then start with P0 Fix #1:
"Fix the ChatInterface race condition where setTimeout(() => handleSubmit(e), 0) 
after setContextChunks() causes stale closure — handleSubmit from useVercelChat 
may capture the old system message. Restructure to pass body override directly 
to handleSubmit(e, { body: {...} })."

Files: apps/web/src/components/ChatInterface.tsx, apps/web/src/hooks/useChat.ts
Tests to add: functional test verifying /api/chat request body contains correct system message with context chunks.

Run verification after every change:
  cd apps/web && npm test
  cd apps/web && npx playwright test e2e/chat-full-flow.spec.ts --project=chromium

Current baseline: 100/100 frontend tests pass (90.99% branches), 45/45 backend tests pass, 1/1 Playwright E2E pass.
```

---

## 📋 Alternate Start Points

If you want to tackle a different issue, read `HANDOFF.md` and pick one:

**P0 #2 — Parser client timeout:**
```
"Add AbortController with 30s timeout to parser-client.ts fetch call. 
Catch AbortError and surface 'Upload timed out' to user."
Files: apps/web/src/lib/parser-client.ts
```

**P1 #3 — MessageList memoization:**
```
"Wrap MessageList with React.memo to prevent O(n²) re-renders on long conversations."
Files: apps/web/src/components/MessageList.tsx
```

**P1 #4 — Error Boundaries:**
```
"Add React Error Boundary around ChatInterface in page.tsx so component crashes 
don't kill the entire app."
Files: apps/web/src/app/page.tsx
```

---

## 🗺️ Navigation Guide

| File | Purpose |
|------|---------|
| `HANDOFF.md` | **Full handoff** — completed work, all 15 issues, test baseline |
| `AGENTS.md` (root) | Monorepo architecture overview |
| `apps/web/AGENTS.md` | Frontend deep context (components, hooks, libs, testing) |
| `apps/parser-service/AGENTS.md` | Backend deep context (routes, services, telemetry) |
| `.context/agents/squad-memory.md` | Known issues & next priorities |
| `.context/docs/decisions.md` | Architecture Decision Records |

---

## ⚡ One-Liner

For the impatient:

> "Read HANDOFF.md, fix the ChatInterface race condition (P0 #1), verify with `cd apps/web && npm test && npx playwright test e2e/chat-full-flow.spec.ts`"
