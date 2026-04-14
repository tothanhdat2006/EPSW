import fitz  # PyMuPDF
from typing import Tuple
import logging

logger = logging.getLogger("document-parser-service")


def extract_text_from_pdf(file_bytes: bytes) -> Tuple[str, int]:
    """
    Extract text from a native (text-based) PDF using PyMuPDF.
    Returns (extracted_text, page_count).
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    text_parts = []

    for page_num, page in enumerate(doc):
        page_text = page.get_text("text")
        if page_text.strip():
            text_parts.append(page_text)
        else:
            logger.debug({"page": page_num + 1, "message": "Empty text on page, may need OCR"})

    doc.close()
    return "\n".join(text_parts), page_count


def is_native_pdf(file_bytes: bytes) -> bool:
    """
    Heuristic: a PDF is 'native' (text-based) if PyMuPDF extracts at least
    50 characters per page on average.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    if len(doc) == 0:
        doc.close()
        return False

    total_chars = sum(len(page.get_text("text").strip()) for page in doc)
    avg_chars_per_page = total_chars / len(doc)
    doc.close()
    return avg_chars_per_page >= 50
