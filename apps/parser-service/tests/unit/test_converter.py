"""Unit tests for converter service."""

import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi import UploadFile

from src.services.converter import (
    FileConverter,
    FileTooLargeError,
    UnsupportedFileTypeError,
    get_converter,
    get_file_extension,
    sanitize_filename,
)


class TestSanitizeFilename:
    def test_simple_filename(self) -> None:
        assert sanitize_filename("document.pdf") == "document.pdf"

    def test_path_traversal_backslash(self) -> None:
        assert sanitize_filename("..\\..\\etc\\passwd") == "_.._etc_passwd"

    def test_path_traversal_slash(self) -> None:
        assert sanitize_filename("../../../etc/passwd") == "_.._.._etc_passwd"

    def test_null_bytes(self) -> None:
        assert sanitize_filename("file\x00.txt") == "file.txt"

    def test_leading_dots_removed(self) -> None:
        assert sanitize_filename("..hidden.txt") == "hidden.txt"

    def test_empty_filename_raises(self) -> None:
        with pytest.raises(ValueError, match="Filename cannot be empty"):
            sanitize_filename("")

    def test_only_dots_raises(self) -> None:
        with pytest.raises(ValueError, match="invalid after sanitization"):
            sanitize_filename("...")


class TestGetFileExtension:
    def test_pdf(self) -> None:
        assert get_file_extension("document.PDF") == "pdf"

    def test_no_extension(self) -> None:
        assert get_file_extension("README") == ""

    def test_multiple_dots(self) -> None:
        assert get_file_extension("archive.tar.gz") == "gz"


class TestFileConverterValidation:
    def test_supported_extension_passes(self) -> None:
        converter = FileConverter()
        converter.validate_file("doc.pdf", "application/pdf", 1024)

    def test_unsupported_extension_raises(self) -> None:
        converter = FileConverter()
        with pytest.raises(UnsupportedFileTypeError):
            converter.validate_file("script.py", "text/x-python", 1024)

    def test_too_large_file_raises(self) -> None:
        converter = FileConverter(max_file_size_bytes=100)
        with pytest.raises(FileTooLargeError):
            converter.validate_file("big.pdf", "application/pdf", 101)

    def test_exact_size_boundary(self) -> None:
        converter = FileConverter(max_file_size_bytes=100)
        converter.validate_file("exact.pdf", "application/pdf", 100)


class TestFileConverterConvert:
    @pytest.fixture
    def converter(self) -> FileConverter:
        return FileConverter()

    @pytest.fixture
    def mock_md(self) -> MagicMock:
        mock = MagicMock()
        mock.convert_stream.return_value = MagicMock(
            text_content="# Hello\n\nWorld",
            metadata={"title": "Hello"},
        )
        return mock

    async def test_convert_success(self, converter: FileConverter, mock_md: MagicMock) -> None:
        converter._md = mock_md
        upload = UploadFile(filename="test.md", file=io.BytesIO(b"# Hello\n\nWorld"))
        result = await converter.convert(upload)
        assert result["filename"] == "test.md"
        assert result["content_type"] == "text/markdown"
        assert result["markdown"] == "# Hello\n\nWorld"
        assert result["metadata"] == {"title": "Hello"}

    async def test_convert_sanitizes_filename(self, converter: FileConverter, mock_md: MagicMock) -> None:
        converter._md = mock_md
        upload = UploadFile(filename="../secret.md", file=io.BytesIO(b"data"))
        result = await converter.convert(upload)
        assert result["filename"] == "_secret.md"

    async def test_convert_no_filename_raises(self, converter: FileConverter) -> None:
        upload = UploadFile(filename=None, file=io.BytesIO(b"data"))  # type: ignore[arg-type]
        with pytest.raises(ValueError, match="no filename"):
            await converter.convert(upload)

    async def test_convert_unsupported_type_raises(self, converter: FileConverter) -> None:
        upload = UploadFile(filename="image.png", file=io.BytesIO(b"\x89PNG"))
        with pytest.raises(UnsupportedFileTypeError):
            await converter.convert(upload)

    async def test_convert_too_large_raises(self, converter: FileConverter) -> None:
        converter.max_file_size_bytes = 5
        upload = UploadFile(filename="big.txt", file=io.BytesIO(b"123456"))
        with pytest.raises(FileTooLargeError):
            await converter.convert(upload)

    async def test_convert_runtime_error(self, converter: FileConverter, mock_md: MagicMock) -> None:
        mock_md.convert_stream.side_effect = Exception("boom")
        converter._md = mock_md
        upload = UploadFile(filename="fail.pdf", file=io.BytesIO(b"data"))
        with pytest.raises(RuntimeError, match="Failed to convert"):
            await converter.convert(upload)

    async def test_convert_no_metadata(self, converter: FileConverter) -> None:
        mock_md = MagicMock()
        mock_md.convert_stream.return_value = MagicMock(text_content="hello", metadata=None)
        converter._md = mock_md
        upload = UploadFile(filename="plain.txt", file=io.BytesIO(b"hello"))
        result = await converter.convert(upload)
        assert result["metadata"] == {}


class TestGetConverter:
    def test_returns_singleton(self) -> None:
        c1 = get_converter()
        c2 = get_converter()
        assert c1 is c2

    @patch("src.services.converter._converter_instance", None)
    def test_respects_settings(self) -> None:
        with patch("src.config.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(max_file_size_bytes=12345)
            converter = get_converter()
            assert converter.max_file_size_bytes == 12345


class TestFileConverterIsReady:
    def test_ready_when_md_initializes(self) -> None:
        converter = FileConverter()
        with patch.object(converter, "_md", MagicMock()):
            assert converter.is_ready() is True

    def test_not_ready_when_md_fails(self) -> None:
        converter = FileConverter()
        with (
            patch.object(converter, "_md", None),
            patch("src.services.converter.MarkItDown", side_effect=Exception("fail")),
        ):
            assert converter.is_ready() is False
