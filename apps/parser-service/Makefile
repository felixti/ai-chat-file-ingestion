.PHONY: install install-dev dev test test-cov lint lint-fix format typecheck clean

# --- Setup ---

.venv:
	uv venv

install: .venv pyproject.toml
	uv pip install -e ".[dev]"

install-dev: install

# --- Development ---

dev: install
	uv run python -m src.main

uvicorn: install
	uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000 --timeout-keep-alive 120

# --- Testing ---

test: install
	uv run pytest tests/ -v

test-cov: install
	uv run pytest tests/ -v --cov=src --cov-report=term-missing --cov-fail-under=90

# --- Quality ---

lint: install
	uv run ruff check .

lint-fix: install
	uv run ruff check --fix .

format: install
	uv run ruff format .

format-check: install
	uv run ruff format --check .

typecheck: install
	uv run mypy src/

# --- CI pipeline (runs everything) ---

ci: install lint format-check test-cov

# --- Cleanup ---

clean:
	rm -rf .venv
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name '*.pyc' -delete
	find . -type f -name '.coverage' -delete
