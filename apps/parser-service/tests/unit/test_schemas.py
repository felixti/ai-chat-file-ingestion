"""Unit tests for pydantic models."""

import pytest
from pydantic import ValidationError

from src.models.schemas import ConvertResponse, HealthResponse


class TestHealthResponse:
    def test_valid_health_response(self) -> None:
        response = HealthResponse(status="ok")
        assert response.status == "ok"

    def test_valid_ready_response(self) -> None:
        response = HealthResponse(status="ready")
        assert response.status == "ready"

    def test_missing_status_raises(self) -> None:
        with pytest.raises(ValidationError):
            HealthResponse()  # type: ignore[call-arg]


class TestConvertResponse:
    def test_valid_convert_response(self) -> None:
        response = ConvertResponse(
            filename="doc.pdf",
            content_type="application/pdf",
            markdown="# Title\n\nBody",
            metadata={"title": "Doc", "pages": 5},
        )
        assert response.filename == "doc.pdf"
        assert response.content_type == "application/pdf"
        assert response.markdown == "# Title\n\nBody"
        assert response.metadata == {"title": "Doc", "pages": 5}

    def test_default_metadata(self) -> None:
        response = ConvertResponse(
            filename="doc.txt",
            content_type="text/plain",
            markdown="hello",
        )
        assert response.metadata == {}

    def test_missing_required_fields_raises(self) -> None:
        with pytest.raises(ValidationError):
            ConvertResponse()  # type: ignore[call-arg]

    def test_partial_fields_raises(self) -> None:
        with pytest.raises(ValidationError):
            ConvertResponse(filename="doc.txt")  # type: ignore[call-arg]

    def test_metadata_accepts_various_types(self) -> None:
        response = ConvertResponse(
            filename="data.json",
            content_type="application/json",
            markdown="{}",
            metadata={
                "count": 42,
                "active": True,
                "nested": {"key": "value"},
                "list": [1, 2, 3],
            },
        )
        assert response.metadata["count"] == 42
        assert response.metadata["active"] is True
