import asyncio
import json
from agents.classification_agent import classify_document
from agents.extraction_agent import extract_document_data
from config import settings
import dashscope

# Ensure international endpoint
dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

SAMPLE_CT01_TEXT = """
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ

Kính gửi: Công an xã Đại Đồng, huyện Thạch Thất, Hà Nội

1. Họ, chữ đệm và tên: NGUYỄN VĂN A
2. Ngày, tháng, năm sinh: 15 / 05 / 1990
3. Số định danh cá nhân: 001090012345
10. Nội dung đề nghị: Đăng ký thường trú vào chỗ ở hợp pháp mới.
"""

async def verify_autofill():
    try:
        classification = await classify_document(SAMPLE_CT01_TEXT)
        extraction = await extract_document_data(SAMPLE_CT01_TEXT, "CT01")
        
        autofill_data = {
            "issuingAuthority": extraction.issuing_authority,
            "subjectName": extraction.subject_name,
            "subjectId": extraction.subject_id,
            "purpose": extraction.purpose,
            "summary": classification.summary
        }
        
        print("--- VERIFICATION RESULT ---")
        # Use ascii=True to avoid Windows terminal encoding errors
        print(json.dumps(autofill_data, indent=2, ensure_ascii=True))
        
        if autofill_data["subjectName"] == "NGUYỄN VĂN A" and autofill_data["summary"]:
            print("\nRESULT: SUCCESS")
        else:
            print("\nRESULT: FAILED")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(verify_autofill())
