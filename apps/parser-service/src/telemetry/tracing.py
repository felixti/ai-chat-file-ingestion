"""OpenTelemetry setup for FastAPI."""

import logging
from typing import Final

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from src.config import Settings

logger: Final = logging.getLogger(__name__)


def init_telemetry(settings: Settings) -> None:
    """Initialize OpenTelemetry tracing."""
    if not settings.enable_telemetry:
        logger.info("Telemetry disabled")
        return

    resource = Resource.create(
        {
            SERVICE_NAME: settings.app_name,
            SERVICE_VERSION: settings.app_version,
        }
    )

    # Avoid overwriting an existing tracer provider (e.g., in parallel tests)
    try:
        _ = trace.get_tracer_provider()
        if hasattr(_, "_active_span_processor"):
            logger.info("Tracer provider already set; skipping initialization")
            return
    except Exception:
        pass

    provider = TracerProvider(resource=resource)

    if settings.otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=settings.otlp_endpoint)
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
        logger.info("OTLP exporter configured: %s", settings.otlp_endpoint)

    trace.set_tracer_provider(provider)
    logger.info("Telemetry initialized")
