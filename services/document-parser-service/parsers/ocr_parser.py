import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
from typing import Tuple
import logging

from config import settings
import os

# Tesseract config: Vietnamese + English OCR
# Point to the local tessdata folder for Vietnamese support
TESSDATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tessdata")
os.environ["TESSDATA_PREFIX"] = TESSDATA_DIR
TESSERACT_CONFIG = "-l vie+eng"

# Setup custom Tesseract path if provided
if settings.tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def ocr_pdf(file_bytes: bytes) -> Tuple[str, int]:
    """
    Run OCR on a scanned PDF.  Each page is rendered to an image then passed
    through Tesseract.  Returns (extracted_text, page_count).
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    text_parts = []

    for page_num, page in enumerate(doc):
        # Render at 300 DPI for best OCR accuracy
        mat = fitz.Matrix(300 / 72, 300 / 72)
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        try:
            page_text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG)
            text_parts.append(page_text)
            logger.info({"page": page_num + 1, "chars": len(page_text), "method": "ocr"})
        except Exception as exc:
            logger.error({"page": page_num + 1, "error": str(exc), "message": "OCR failed for page. Real OCR is required."})
            # We don't use mock anymore as requested. 
            # We raise so document_received can handle or route to HITL
            raise Exception(f"OCR failed on page {page_num + 1}: {str(exc)}")

    doc.close()
    return "\n".join(text_parts), page_count


def ocr_image(file_bytes: bytes, mime_type: str) -> Tuple[str, int]:
    """
    Run OCR on a standalone image (JPEG/PNG/TIFF).
    Returns (extracted_text, 1).
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG)
        return text, 1
    except Exception as exc:
        logger.error({"error": str(exc), "message": "OCR failed for image. Real OCR is required."})
        raise
