"""Health and readiness endpoints."""

from fastapi import APIRouter, HTTPException

from src.models.schemas import HealthResponse
from src.services.converter import get_converter

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> dict[str, str]:
    """Return basic health status."""
    return {"status": "ok"}


@router.get("/ready", response_model=HealthResponse)
async def readiness_check() -> dict[str, str]:
    """Return readiness status based on converter availability."""
    converter = get_converter()
    if converter.is_ready():
        return {"status": "ready"}
    raise HTTPException(status_code=503, detail="Service not ready")
