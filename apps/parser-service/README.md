# Parser Service

FastAPI service for converting uploaded files to markdown using Microsoft's `markitdown`.

## Features

- Converts PDF, PPTX, DOCX, XLSX, MD, CSV, TXT, JSON/JSONC/JSONL to markdown
- OpenTelemetry distributed tracing
- Prometheus metrics at `/metrics`
- Health (`/health`) and readiness (`/ready`) endpoints

## Development

```bash
# Install dependencies
make install        # or: uv venv && uv pip install -e ".[dev]"

# Run tests with coverage
make test-cov       # or: uv run pytest --cov=src --cov-report=term-missing

# Start server
make dev            # or: uv run python -m src.main
# or
uv run uvicorn src.main:app --reload
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |
| `/convert` | POST | Upload file and get markdown |
| `/metrics` | GET | Prometheus metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PARSER_APP_NAME` | `parser-service` | Application name |
| `PARSER_PORT` | `8000` | Server port |
| `PARSER_LOG_LEVEL` | `INFO` | Logging level |
| `PARSER_MAX_FILE_SIZE_BYTES` | `52428800` | Max upload size (50MB) |
| `PARSER_ENABLE_TELEMETRY` | `true` | Enable OpenTelemetry |
| `PARSER_OTLP_ENDPOINT` | `None` | OTLP collector endpoint |
