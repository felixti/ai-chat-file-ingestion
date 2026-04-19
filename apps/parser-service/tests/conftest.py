"""Pytest fixtures and configuration."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.config import Settings
from src.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    """Provide test-specific settings."""
    return Settings(
        app_name="parser-service-test",
        log_level="DEBUG",
        max_file_size_bytes=1024 * 1024,  # 1MB for tests
        enable_telemetry=False,
        cors_origins="*",
    )


@pytest.fixture
def app(test_settings: Settings) -> FastAPI:
    """Create a FastAPI app with test settings."""
    app = create_app(test_settings)
    # Disable rate limiting for tests
    from src.limiter import limiter
    limiter.enabled = False
    return app


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncClient:
    """Provide an async HTTP client for integration tests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
