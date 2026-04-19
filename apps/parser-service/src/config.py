"""Application configuration using pydantic-settings."""

import logging
from functools import lru_cache
from typing import Final

from pydantic_settings import BaseSettings

logger: Final = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "parser-service"
    app_version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    max_file_size_bytes: int = 50 * 1024 * 1024  # 50MB
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    enable_telemetry: bool = True
    otlp_endpoint: str | None = None

    model_config = {"env_prefix": "PARSER_", "case_sensitive": False, "env_file": None}

    def get_cors_origins(self) -> list[str]:
        """Return CORS origins as a list."""
        if not self.cors_origins:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def configure_logging(log_level: str) -> None:
    """Configure structured logging for the application."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
