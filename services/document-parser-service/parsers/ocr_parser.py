import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
from typing import Tuple
import logging

logger = logging.getLogger("document-parser-service")

# Tesseract config: Vietnamese + English OCR
TESSERACT_CONFIG = "--oem 3 --psm 3 -l vie+eng"


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
            logger.debug({"page": page_num + 1, "chars": len(page_text), "method": "ocr"})
        except pytesseract.TesseractError as exc:
            logger.warning({"page": page_num + 1, "error": str(exc), "message": "OCR failed for page"})

    doc.close()
    return "\n".join(text_parts), page_count


def ocr_image(file_bytes: bytes, mime_type: str) -> Tuple[str, int]:
    """
    Run OCR on a standalone image (JPEG/PNG/TIFF).
    Returns (extracted_text, 1).
    """
    img = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG)
    return text, 1
