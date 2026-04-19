# AGENTS.md — Shared Packages

## Overview
This directory is reserved for shared code between the frontend and backend.

## Current State
Empty. No shared packages have been extracted yet.

## Future Candidates
1. **OpenAPI schema → TypeScript types**: Generate TypeScript interfaces from FastAPI's OpenAPI spec to ensure API contract alignment
2. **Shared constants**: File type lists, max file size, supported extensions
3. **Shared validation logic**: Filename sanitization rules (currently duplicated implicitly)

## When to Add Here
- Code needed by both `apps/web/` and `apps/parser-service/`
- API contracts that must stay in sync
- Shared utility functions that don't belong in either app
