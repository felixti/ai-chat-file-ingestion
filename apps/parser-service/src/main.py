"""FastAPI application factory."""

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Final

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import make_asgi_app
from slowapi import _rate_limit_exceeded_handler
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import Settings, configure_logging, get_settings
from src.limiter import limiter
from src.routes import convert, health
from src.telemetry.tracing import init_telemetry

logger: Final = logging.getLogger(__name__)


def _lifespan(settings: Settings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info("%s v%s starting up", settings.app_name, settings.app_version)
        yield
        logger.info("%s shutting down", settings.app_name)

    return lifespan


class MetricsAuthMiddleware(BaseHTTPMiddleware):
    """Restrict /metrics to internal/private IP addresses."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/metrics"):
            host = request.client.host if request.client else ""
            if host not in ("127.0.0.1", "localhost", "::1"):
                return Response("Forbidden", status_code=403)
        return await call_next(request)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    if settings is None:
        settings = get_settings()

    configure_logging(settings.log_level)
    init_telemetry(settings)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=_lifespan(settings),
    )

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(429, _rate_limit_exceeded_handler)
    limiter._app = app

    # CORS — restrict to actual needs
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    # Metrics auth
    app.add_middleware(MetricsAuthMiddleware)

    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # Routes
    app.include_router(health.router)
    app.include_router(convert.router)



    # Prometheus metrics
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    # OpenTelemetry instrumentation
    if settings.enable_telemetry:
        FastAPIInstrumentor.instrument_app(app)

    return app


app = create_app()


def main() -> None:
    """Entrypoint for running the application with uvicorn."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
