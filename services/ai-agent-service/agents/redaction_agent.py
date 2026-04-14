import fitz  # PyMuPDF
import uuid
from minio import Minio
from config import settings
from typing import Optional
import logging

logger = logging.getLogger("ai-agent-service")

# PII patterns to redact — add more patterns as needed
PII_KEYWORDS = [
    "CMND", "CCCD", "Số căn cước", "Số chứng minh",
    "ngày sinh", "date of birth", "số điện thoại", "phone",
    "địa chỉ", "address", "email", "mật khẩu", "password",
]


def _get_minio() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl,
    )


def redact_pdf_bytes(file_bytes: bytes, pii_terms: list[str]) -> bytes:
    """
    Apply black-box redaction over detected PII terms in a PDF.
    Returns redacted PDF bytes.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")

    for page in doc:
        for term in pii_terms:
            areas = page.search_for(term)
            for area in areas:
                # Redact with black rectangle at the application layer
                page.add_redact_annot(area, fill=(0, 0, 0))
        page.apply_redactions()

    redacted_bytes = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return redacted_bytes


async def redact_and_upload(
    document_id: str,
    file_bytes: bytes,
    pii_terms: list[str],
    correlation_id: str,
) -> Optional[str]:
    """
    Redact PII from PDF and upload redacted copy to MinIO.
    Returns the URL of the redacted file, or None if not a PDF.
    """
    if not pii_terms:
        logger.info({"documentId": document_id, "message": "No PII terms to redact"})
        return None

    try:
        redacted_bytes = redact_pdf_bytes(file_bytes, pii_terms)
        object_key = f"redacted/{document_id}/{uuid.uuid4()}_redacted.pdf"

        minio = _get_minio()
        import io
        minio.put_object(
            settings.minio_bucket_redacted,
            object_key,
            io.BytesIO(redacted_bytes),
            length=len(redacted_bytes),
            content_type="application/pdf",
        )

        redacted_url = (
            f"{'https' if settings.minio_use_ssl else 'http'}://"
            f"{settings.minio_endpoint}/{settings.minio_bucket_redacted}/{object_key}"
        )
        logger.info({"documentId": document_id, "redactedUrl": redacted_url, "message": "Redacted PDF uploaded"})
        return redacted_url

    except Exception as exc:
        logger.error({"documentId": document_id, "error": str(exc), "message": "Redaction failed"})
        return None
