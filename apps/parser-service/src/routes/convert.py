"""File conversion endpoint."""

import logging
from typing import Annotated, Any, Final

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from src.limiter import limiter
from src.models.schemas import ConvertResponse
from src.services.converter import (
    FileTooLargeError,
    UnsupportedFileTypeError,
    get_converter,
)

logger: Final = logging.getLogger(__name__)

router = APIRouter(tags=["convert"])


@router.post(
    "/convert",
    response_model=ConvertResponse,
    status_code=status.HTTP_200_OK,
    summary="Convert an uploaded file to markdown",
)
@limiter.limit("10/minute")
async def convert_file(
    request: Request,
    file: Annotated[UploadFile, File(...)],
) -> dict[str, Any]:
    """Convert an uploaded file to markdown using markitdown.

    - **file**: The file to convert (max 50MB).
    - Supported types: pdf, pptx, docx, xlsx, md, csv, txt, json, jsonc, jsonl.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing filename in upload",
        )

    converter = get_converter()

    try:
        result = await converter.convert(file)
    except UnsupportedFileTypeError as exc:
        logger.warning("Unsupported file type: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except FileTooLargeError as exc:
        logger.warning("File too large: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        logger.warning("Bad request: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        logger.exception("Conversion failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal conversion error",
        ) from exc

    return result
