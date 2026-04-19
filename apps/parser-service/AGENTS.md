# AGENTS.md — Parser Service (Python FastAPI)

## Overview
A standalone FastAPI microservice that converts uploaded files (PDF, DOCX, PPTX, XLSX, etc.) to markdown using Microsoft's `markitdown` library. Exposes a single primary endpoint `POST /convert` plus health/readiness probes.

## Tech Stack
- **Runtime**: Python 3.12+
- **Framework**: FastAPI + Uvicorn
- **Parsing**: `markitdown[all]` (wraps pandoc, LibreOffice, etc.)
- **Config**: `pydantic-settings` with `PARSER_` env prefix
- **Observability**: OpenTelemetry tracing + Prometheus metrics
- **Testing**: pytest + pytest-asyncio + httpx + pytest-cov

## File Structure & Responsibilities

### `src/main.py`
FastAPI application factory.
- `create_app(settings)` — Builds and configures the FastAPI app with CORS, routes, metrics, telemetry
- `lifespan` context manager — logs startup/shutdown
- **Module-level singleton**: `app = create_app()` — imported by uvicorn
- **Gotcha**: `create_app()` at module level means settings are parsed at import time. In tests, use `create_app(test_settings)` directly.

### `src/config.py`
- `Settings(BaseSettings)` — env vars with `PARSER_` prefix:
  - `PARSER_HOST` (default: `0.0.0.0`)
  - `PARSER_PORT` (default: `8000`)
  - `PARSER_LOG_LEVEL` (default: `INFO`)
  - `PARSER_MAX_FILE_SIZE_BYTES` (default: 50MB)
  - `PARSER_CORS_ORIGINS` (default: `["http://localhost:3000", "http://127.0.0.1:3000"]`)
  - `PARSER_ENABLE_TELEMETRY` (default: `True`)
  - `PARSER_OTLP_ENDPOINT` (optional)
- `get_settings()` — returns a new `Settings()` instance every call (no caching)
- `configure_logging()` — basic StreamHandler logging

### `src/routes/convert.py`
Single endpoint: `POST /convert`
- Accepts `multipart/form-data` with `file` field
- Validates filename is present (400 if empty)
- Delegates to `FileConverter.convert()`
- Error mapping:
  - `UnsupportedFileTypeError` → 415
  - `FileTooLargeError` → 413
  - `ValueError` → 400
  - `RuntimeError` → 500
- **Security**: filename is sanitized before processing (path traversal prevention)

### `src/routes/health.py`
- `GET /health` → `{"status": "ok"}` (200)
- `GET /ready` → checks `converter.is_ready()`; returns 503 if MarkItDown can't initialize

### `src/services/converter.py`
Core conversion logic.

- `sanitize_filename(filename)` — Replaces `\`, `/`, `\x00` with `_`; strips leading dots. Raises `ValueError` for empty or all-dots filenames.
- `get_file_extension(filename)` — Returns lowercase extension via `os.path.splitext`
- `FileConverter` class:
  - `max_file_size_bytes` — configurable per instance
  - `md` property — lazily initializes `MarkItDown()`
  - `is_ready()` — tries to initialize `MarkItDown`, returns bool
  - `validate_file()` — checks extension against `SUPPORTED_EXTENSIONS` and size
  - `convert(file: UploadFile)` — reads content, validates, calls `markitdown`, returns dict
- **Singleton**: `get_converter()` — cached instance initialized from `get_settings()`

**Critical Implementation Notes:**
- `await file.read()` reads the **entire file into memory**. Acceptable for 50MB but not scalable.
- `await file.close()` is called after reading — good practice.
- `markitdown.convert_stream(BytesIO(content), file_extension=extension)` — passes the file extension hint.
- Metadata extraction uses `hasattr(result, "metadata")` guard — markitdown's return type may vary.

### `src/telemetry/tracing.py`
OpenTelemetry setup.
- `init_telemetry(settings)` — configures `TracerProvider` with service name/version
- If `PARSER_OTLP_ENDPOINT` is set, creates OTLP gRPC exporter
- **Global state**: calls `trace.set_tracer_provider(provider)`. Multiple calls in tests can conflict.

### `src/models/schemas.py`
Pydantic v2 models:
- `ConvertResponse` — `filename`, `content_type`, `markdown`, `metadata`
- `HealthResponse` — `status`

## Testing Strategy

### Test Configuration
- `pytest.ini` — sets `asyncio_mode = auto`, `testpaths = tests`, `addopts = -v`
- `pyproject.toml` — also has `[tool.pytest.ini_options]` with `addopts = "--cov=src --cov-report=term-missing"`
- **⚠️ Warning**: pytest complains about config in both files. `pytest.ini` takes precedence for some options. Keep test config in `pytest.ini` and coverage config in `pyproject.toml`.

### Fixtures (`tests/conftest.py`)
- `test_settings` — `Settings` with `max_file_size_bytes=1MB`, `enable_telemetry=False`, `cors_origins=["*"]`
- `app` — FastAPI app built with test settings
- `async_client` — `httpx.AsyncClient` with `ASGITransport` for integration tests

### Unit Tests (`tests/unit/`)
- `test_converter.py` — 16 tests covering:
  - Filename sanitization (path traversal, null bytes, leading dots, empty)
  - Extension extraction
  - Validation (supported types, size boundaries)
  - Conversion success, sanitization, missing filename, unsupported type, too large, runtime error, no metadata
  - Singleton behavior
  - `is_ready()` states
- `test_schemas.py` — 7 tests for Pydantic model validation

### Integration Tests (`tests/integration/test_api.py`)
- `TestHealthEndpoints` — `/health`, `/ready` (ready/not-ready), `/metrics`
- `TestConvertEndpoint` — 9 tests:
  - Success with mocked converter
  - 415 unsupported type
  - 413 file too large
  - 422 missing file key
  - 400 empty filename (direct function call)
  - 500 internal error
  - All 10 supported extensions
  - Path traversal filename sanitization

**Pattern**: All integration tests mock `get_converter()` to avoid importing `markitdown` in CI.

## Running Tests
```bash
cd apps/parser-service
python -m pytest tests/ -v           # with coverage (uses pyproject.toml config)
python -m pytest tests/ -v --no-cov  # without coverage
```

## Running the Service
```bash
# Development
python -m src.main

# Or with uvicorn
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Docker
docker build -t parser-service .
docker run -p 8000:8000 parser-service
```

## Environment Variables
All prefixed with `PARSER_`:
| Variable | Default | Description |
|----------|---------|-------------|
| `PARSER_HOST` | `0.0.0.0` | Bind address |
| `PARSER_PORT` | `8000` | Bind port |
| `PARSER_LOG_LEVEL` | `INFO` | Logging level |
| `PARSER_MAX_FILE_SIZE_BYTES` | `52428800` | Max upload size (50MB) |
| `PARSER_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |
| `PARSER_ENABLE_TELEMETRY` | `True` | Enable OpenTelemetry |
| `PARSER_OTLP_ENDPOINT` | — | OTLP gRPC endpoint (optional) |

## Critical Code Patterns

### Adding a new route
1. Create module in `src/routes/`
2. Use `APIRouter` with `tags`
3. Import and `include_router` in `src/main.py`
4. Add integration tests in `tests/integration/`
5. Use `async def` for I/O-bound handlers

### Adding a new file type support
1. Add extension to `SUPPORTED_EXTENSIONS` frozenset in `src/services/converter.py`
2. Add MIME type mapping to `EXTENSION_TO_MIME`
3. Add test case in `test_convert_various_file_types`
4. Verify `markitdown` supports the extension

### Error handling convention
- Define custom exception class with typed attributes
- Catch in route, log with appropriate level, raise `HTTPException` with correct status code
- Always chain with `from exc` for trace preservation

## Common Pitfalls
- **Module-level `app` singleton**: In tests, always use `create_app(test_settings)` rather than importing `app` from `src.main` if you need different config.
- **Global tracer provider**: `init_telemetry` sets a global. If tests run in parallel and call it with different settings, they can interfere.
- **`pytest.ini` vs `pyproject.toml`**: pytest warns when both contain config. Keep asyncio settings in `pytest.ini` and tool configs (ruff, mypy, coverage) in `pyproject.toml`.
- **`markitdown` initialization**: `MarkItDown()` can be slow on first call (loads pandoc/LibreOffice). The `/ready` endpoint checks this.
- **Memory usage**: `await file.read()` loads entire upload into RAM. For production with very large files, consider streaming or chunked processing.
