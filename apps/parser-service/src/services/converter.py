"""File conversion logic using markitdown."""

import logging
import os
import re
from io import BytesIO
from typing import Any, Final

from fastapi import UploadFile
from markitdown import MarkItDown

logger: Final = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS: Final[frozenset[str]] = frozenset(
    ["pdf", "pptx", "docx", "xlsx", "md", "csv", "txt", "json", "jsonc", "jsonl"]
)

# Mapping of extensions to common MIME types for validation
EXTENSION_TO_MIME: Final[dict[str, str]] = {
    "pdf": "application/pdf",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "md": "text/markdown",
    "csv": "text/csv",
    "txt": "text/plain",
    "json": "application/json",
    "jsonc": "application/json",
    "jsonl": "application/jsonlines",
}


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename to prevent path traversal attacks.

    Removes directory separators and null bytes, then strips leading dots.
    """
    if not filename:
        raise ValueError("Filename cannot be empty")

    # Replace path separators and null bytes
    cleaned = filename.replace("\\", "_").replace("/", "_").replace("\x00", "")
    # Strip leading dots to prevent hidden file issues
    cleaned = cleaned.lstrip(".")
    if not cleaned:
        raise ValueError("Filename is invalid after sanitization")
    return cleaned


def get_file_extension(filename: str) -> str:
    """Extract the lowercase file extension from a filename."""
    _, ext = os.path.splitext(filename)
    return ext.lstrip(".").lower()


class UnsupportedFileTypeError(Exception):
    """Raised when an unsupported file type is submitted."""

    def __init__(self, filename: str, extension: str) -> None:
        self.filename = filename
        self.extension = extension
        super().__init__(f"Unsupported file type: '{extension}' for file '{filename}'")


class FileTooLargeError(Exception):
    """Raised when a file exceeds the maximum allowed size."""

    def __init__(self, filename: str, size: int, max_size: int) -> None:
        self.filename = filename
        self.size = size
        self.max_size = max_size
        super().__init__(f"File '{filename}' too large: {size} bytes (max {max_size} bytes)")


_HTML_COMMENT_RE: Final[re.Pattern[str]] = re.compile(r"<!--.*?-->", re.DOTALL)


def _clean_markdown(text: str) -> str:
    """Post-process markitdown output for cleaner LLM context.

    Strips HTML comments (e.g. PPTX slide markers) and normalizes
    excessive blank lines.
    """
    # Strip HTML comments like <!-- Slide number: 1 -->
    text = _HTML_COMMENT_RE.sub("", text)
    # Collapse 3+ consecutive newlines down to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class FileConverter:
    """Service for converting uploaded files to markdown."""

    def __init__(self, max_file_size_bytes: int = 50 * 1024 * 1024) -> None:
        self.max_file_size_bytes = max_file_size_bytes
        self._md: MarkItDown | None = None

    @property
    def md(self) -> MarkItDown:
        """Lazy-initialize the MarkItDown instance."""
        if self._md is None:
            self._md = MarkItDown()
        return self._md

    def is_ready(self) -> bool:
        """Check if the converter is ready to process files."""
        try:
            _ = self.md
            return True
        except Exception as exc:
            logger.warning("MarkItDown not ready: %s", exc)
            return False

    def validate_file(self, filename: str, content_type: str, size: int) -> None:
        """Validate a file before conversion.

        Raises:
            UnsupportedFileTypeError: If the file extension is not supported.
            FileTooLargeError: If the file exceeds the maximum size.
        """
        extension = get_file_extension(filename)
        if extension not in SUPPORTED_EXTENSIONS:
            raise UnsupportedFileTypeError(filename, extension)
        if size > self.max_file_size_bytes:
            raise FileTooLargeError(filename, size, self.max_file_size_bytes)

    async def convert(self, file: UploadFile) -> dict[str, Any]:
        """Convert an uploaded file to markdown.

        Returns:
            A dictionary with keys: filename, content_type, markdown, metadata.

        Raises:
            ValueError: If the file is missing or invalid.
            UnsupportedFileTypeError: If the file type is not supported.
            FileTooLargeError: If the file is too large.
            RuntimeError: If conversion fails.
        """
        if file.filename is None:
            raise ValueError("Uploaded file has no filename")

        sanitized = sanitize_filename(file.filename)
        extension = get_file_extension(sanitized)

        # Read file content
        content = await file.read()
        await file.close()

        content_type = file.content_type or EXTENSION_TO_MIME.get(extension, "application/octet-stream")
        self.validate_file(sanitized, content_type, len(content))

        logger.info("Converting file: %s (%s, %d bytes)", sanitized, content_type, len(content))

        try:
            result = self.md.convert_stream(BytesIO(content), file_extension=extension)
        except Exception as exc:
            logger.exception("Conversion failed for file: %s", sanitized)
            raise RuntimeError(f"Failed to convert file '{sanitized}': {exc}") from exc

        raw_text = result.text_content or ""
        text = _clean_markdown(raw_text)

        logger.info(
            "Converted file: %s (%s) — raw text length: %d, cleaned markdown length: %d",
            sanitized,
            extension,
            len(raw_text),
            len(text),
        )

        metadata: dict[str, Any] = {}
        if hasattr(result, "metadata") and result.metadata is not None:
            metadata = dict(result.metadata)

        return {
            "filename": sanitized,
            "content_type": content_type,
            "markdown": text,
            "metadata": metadata,
        }


# Singleton instance
_converter_instance: FileConverter | None = None


def get_converter() -> FileConverter:
    """Return the singleton FileConverter instance."""
    global _converter_instance
    if _converter_instance is None:
        from src.config import get_settings

        settings = get_settings()
        _converter_instance = FileConverter(max_file_size_bytes=settings.max_file_size_bytes)
    return _converter_instance
