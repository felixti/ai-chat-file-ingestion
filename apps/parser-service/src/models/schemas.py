"""Pydantic models for request/response validation."""

from typing import Any

from pydantic import BaseModel, Field


class ConvertResponse(BaseModel):
    """Response model for the /convert endpoint."""

    filename: str
    content_type: str
    markdown: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Response model for health and readiness endpoints."""

    status: str
