.PHONY: help install install-web install-parser up down dev dev-web dev-parser test test-web test-parser test-e2e lint lint-web lint-parser format format-web format-parser typecheck typecheck-web typecheck-parser build build-web clean

# Detect OS for background process handling
OS := $(shell uname)
ifeq ($(OS),Linux)
	BG_START := nohup
	BG_END := > /dev/null 2>&1 &
	KILL := pkill -f
endif
ifeq ($(OS),Darwin)
	BG_START := nohup
	BG_END := > /dev/null 2>&1 &
	KILL := pkill -f
endif

# Default target
help:
	@echo "Available targets:"
	@echo ""
	@echo "  Setup:"
	@echo "    make install          Install all dependencies (web + parser)"
	@echo "    make install-web      Install frontend dependencies only"
	@echo "    make install-parser   Install backend dependencies only"
	@echo ""
	@echo "  Development (foreground):"
	@echo "    make dev              Start both web and parser in parallel (logs mixed)"
	@echo "    make dev-web          Start frontend only"
	@echo "    make dev-parser       Start backend only"
	@echo ""
	@echo "  Development (background):"
	@echo "    make up               Start both services in background"
	@echo "    make down             Stop all background services"
	@echo ""
	@echo "  Testing:"
	@echo "    make test             Run all tests (web + parser)"
	@echo "    make test-web         Frontend tests only"
	@echo "    make test-parser      Backend tests only"
	@echo "    make test-e2e         Playwright E2E tests only"
	@echo ""
	@echo "  Quality:"
	@echo "    make lint             Lint everything"
	@echo "    make format           Format everything"
	@echo "    make typecheck        Type-check everything"
	@echo "    make ci               Run full CI pipeline locally"
	@echo ""
	@echo "  Build:"
	@echo "    make build            Build frontend for production"
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean            Clean build artifacts and caches"

# --- Installation ---

install: install-web install-parser
	@echo "✅ All dependencies installed"

install-web:
	@echo "📦 Installing frontend dependencies..."
	cd apps/web && npm install

install-parser:
	@echo "📦 Installing backend dependencies..."
	cd apps/parser-service && uv venv && uv pip install -e ".[dev]"

# --- Development (foreground) ---

# Run both in parallel with mixed output (Ctrl+C stops both)
dev:
	@echo "🚀 Starting both services..."
	@echo "   Frontend: http://localhost:3000"
	@echo "   Parser:   http://localhost:8000"
	@echo "   Press Ctrl+C to stop both"
	@echo ""
	trap 'kill %1 %2 2>/dev/null' EXIT; \
		cd apps/web && npm run dev & \
		cd apps/parser-service && uv run python -m src.main & \
		wait

dev-web:
	@echo "🚀 Starting frontend..."
	cd apps/web && npm run dev

dev-parser:
	@echo "🚀 Starting parser service..."
	cd apps/parser-service && make dev

# --- Development (background) ---

up: up-parser up-web
	@echo ""
	@echo "✅ Services started in background:"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Parser:   http://localhost:8000"
	@echo "   Run 'make down' to stop"

up-web:
	@echo "▶️  Starting frontend in background..."
	cd apps/web && nohup npm run dev > web.log 2>&1 &

up-parser:
	@echo "▶️  Starting parser in background..."
	cd apps/parser-service && nohup uv run python -m src.main > parser.log 2>&1 &

down:
	@echo "🛑 Stopping background services..."
	-pkill -f "next dev" 2>/dev/null
	-pkill -f "python -m src.main" 2>/dev/null
	@echo "✅ Services stopped"
	@echo "   Logs: apps/web/web.log, apps/parser-service/parser.log"

# --- Testing ---

test: test-parser test-web
	@echo ""
	@echo "✅ All tests passed"

test-web:
	@echo "🧪 Running frontend tests..."
	cd apps/web && npm test

test-parser:
	@echo "🧪 Running backend tests..."
	cd apps/parser-service && make test

test-e2e:
	@echo "🎭 Running E2E tests..."
	cd apps/web && npx playwright test e2e/ --project=chromium

# --- Quality ---

lint: lint-parser lint-web
	@echo ""
	@echo "✅ All lint checks passed"

lint-web:
	@echo "🔍 Linting frontend..."
	cd apps/web && npx eslint .

lint-parser:
	@echo "🔍 Linting backend..."
	cd apps/parser-service && make lint

format: format-parser format-web
	@echo ""
	@echo "✅ All formatting done"

format-web:
	@echo "🎨 Formatting frontend..."
	cd apps/web && npx prettier --write .

format-parser:
	@echo "🎨 Formatting backend..."
	cd apps/parser-service && make format

format-check: format-check-web format-check-parser
	@echo ""
	@echo "✅ All format checks passed"

format-check-web:
	@echo "🔍 Checking frontend formatting..."
	cd apps/web && npx prettier --check .

format-check-parser:
	@echo "🔍 Checking backend formatting..."
	cd apps/parser-service && make format-check

typecheck: typecheck-web typecheck-parser
	@echo ""
	@echo "✅ All type checks passed"

typecheck-web:
	@echo "🔍 Type-checking frontend..."
	cd apps/web && npx tsc --noEmit

typecheck-parser:
	@echo "🔍 Type-checking backend..."
	cd apps/parser-service && make typecheck

# --- Full CI pipeline ---

ci: lint typecheck test build
	@echo ""
	@echo "🎉 Full CI pipeline passed locally"

# --- Build ---

build: build-web

build-web:
	@echo "🔨 Building frontend..."
	cd apps/web && npm run build

# --- Cleanup ---

clean: clean-web clean-parser
	@echo ""
	@echo "✅ Cleaned all artifacts"

clean-web:
	@echo "🧹 Cleaning frontend..."
	cd apps/web && rm -rf .next node_modules coverage

clean-parser:
	@echo "🧹 Cleaning backend..."
	cd apps/parser-service && make clean
