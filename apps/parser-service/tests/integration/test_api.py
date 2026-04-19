"""Integration tests for the FastAPI application."""

import io
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


class TestHealthEndpoints:
    async def test_health_ok(self, async_client: AsyncClient) -> None:
        response = await async_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    async def test_ready_when_converter_ready(self, async_client: AsyncClient) -> None:
        with patch("src.routes.health.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            mock_converter.is_ready.return_value = True
            mock_get_converter.return_value = mock_converter
            response = await async_client.get("/ready")
            assert response.status_code == 200
            assert response.json()["status"] == "ready"

    async def test_ready_when_converter_not_ready(self, async_client: AsyncClient) -> None:
        with patch("src.routes.health.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            mock_converter.is_ready.return_value = False
            mock_get_converter.return_value = mock_converter
            response = await async_client.get("/ready")
            assert response.status_code == 503

    async def test_metrics_endpoint(self, async_client: AsyncClient) -> None:
        response = await async_client.get("/metrics", follow_redirects=True)
        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "")


class TestConvertEndpoint:
    async def test_convert_success(self, async_client: AsyncClient) -> None:
        with patch("src.routes.convert.get_converter") as mock_get_converter:
            from unittest.mock import AsyncMock

            mock_converter = MagicMock()
            mock_converter.convert = AsyncMock(
                return_value={
                    "filename": "test.md",
                    "content_type": "text/markdown",
                    "markdown": "# Hello",
                    "metadata": {},
                }
            )
            mock_get_converter.return_value = mock_converter

            response = await async_client.post(
                "/convert",
                files={"file": ("test.md", io.BytesIO(b"# Hello"), "text/markdown")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "test.md"
            assert data["markdown"] == "# Hello"

    async def test_convert_unsupported_type(self, async_client: AsyncClient) -> None:
        with patch("src.routes.convert.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            from src.services.converter import UnsupportedFileTypeError

            mock_converter.convert = MagicMock(side_effect=UnsupportedFileTypeError("image.png", "png"))
            mock_get_converter.return_value = mock_converter

            response = await async_client.post(
                "/convert",
                files={"file": ("image.png", io.BytesIO(b"\x89PNG"), "image/png")},
            )
            assert response.status_code == 415

    async def test_convert_file_too_large(self, async_client: AsyncClient) -> None:
        with patch("src.routes.convert.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            from src.services.converter import FileTooLargeError

            mock_converter.convert = MagicMock(side_effect=FileTooLargeError("big.pdf", 100_000_000, 50_000_000))
            mock_get_converter.return_value = mock_converter

            response = await async_client.post(
                "/convert",
                files={"file": ("big.pdf", io.BytesIO(b"data"), "application/pdf")},
            )
            assert response.status_code == 413

    async def test_convert_bad_request_missing_filename(self, async_client: AsyncClient) -> None:
        # Missing file key triggers FastAPI validation (422)
        response = await async_client.post("/convert", data={})
        assert response.status_code == 422

    async def test_convert_empty_filename_returns_400(self, async_client: AsyncClient) -> None:
        from unittest.mock import MagicMock

        from fastapi import HTTPException, UploadFile

        from src.routes.convert import convert_file

        empty_file = UploadFile(filename="", file=io.BytesIO(b"data"))
        mock_request = MagicMock()
        mock_request.state._rate_limiting_complete = True
        with pytest.raises(HTTPException) as exc_info:
            await convert_file(mock_request, empty_file)
        assert exc_info.value.status_code == 400

    async def test_convert_internal_error(self, async_client: AsyncClient) -> None:
        with patch("src.routes.convert.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            mock_converter.convert = MagicMock(side_effect=RuntimeError("boom"))
            mock_get_converter.return_value = mock_converter

            response = await async_client.post(
                "/convert",
                files={"file": ("fail.pdf", io.BytesIO(b"data"), "application/pdf")},
            )
            assert response.status_code == 500

    async def test_convert_various_file_types(self, async_client: AsyncClient) -> None:
        from unittest.mock import AsyncMock

        with patch("src.routes.convert.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            mock_converter.convert = AsyncMock(
                return_value={
                    "filename": "doc",
                    "content_type": "text/plain",
                    "markdown": "content",
                    "metadata": {},
                }
            )
            mock_get_converter.return_value = mock_converter

            extensions = ["pdf", "pptx", "docx", "xlsx", "md", "csv", "txt", "json", "jsonc", "jsonl"]
            for ext in extensions:
                response = await async_client.post(
                    "/convert",
                    files={"file": (f"doc.{ext}", io.BytesIO(b"data"), "application/octet-stream")},
                )
                assert response.status_code == 200, f"Failed for {ext}"

    async def test_convert_with_path_traversal_filename(self, async_client: AsyncClient) -> None:
        from unittest.mock import AsyncMock

        with patch("src.routes.convert.get_converter") as mock_get_converter:
            mock_converter = MagicMock()
            mock_converter.convert = AsyncMock(
                return_value={
                    "filename": "safe.txt",
                    "content_type": "text/plain",
                    "markdown": "content",
                    "metadata": {},
                }
            )
            mock_get_converter.return_value = mock_converter

            response = await async_client.post(
                "/convert",
                files={"file": ("../../etc/passwd.txt", io.BytesIO(b"data"), "text/plain")},
            )
            # Route should still call converter which sanitizes
            assert response.status_code == 200
