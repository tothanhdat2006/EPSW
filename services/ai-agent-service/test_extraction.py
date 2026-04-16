from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from agents.extraction_agent import EXTRACTION_PROMPT, _get_llm
from config import settings
import dashscope
import asyncio
import json

# Set international endpoint
dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

async def debug_extraction():
    print(f"Debugging AI Extraction with International Endpoint ({settings.llm_model})...")
    llm = _get_llm()
    # Try with raw string output first to see what Qwen is doing
    chain = EXTRACTION_PROMPT | llm | StrOutputParser()
    
    text = """
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ

Kính gửi: Công an xã Đại Đồng, huyện Thạch Thất, Hà Nội

1. Họ, chữ đệm và tên: NGUYỄN VĂN A
2. Ngày, tháng, năm sinh: 15 / 05 / 1990
3. Giới tính: Nam
4. Số định danh cá nhân: 001090012345
5. Số điện thoại liên hệ: 0912345678
6. Email: nguyenvana@gmail.com
7. Họ, chữ đệm và tên chủ hộ: NGUYỄN VĂN B
8. Mối quan hệ với chủ hộ: Con đẻ
9. Số định danh cá nhân của chủ hộ: 001060001234
10. Nội dung đề nghị: Đăng ký thường trú vào chỗ ở hợp pháp mới.
"""
    
    try:
        raw_result = await chain.ainvoke({"text": text, "document_type": "RESIDENTIAL_REGISTRATION (CT01)"})
        print("\n--- RAW LLM RESPONSE ---")
        print(raw_result)
    except Exception as e:
        print(f"FAILED TO GET RAW RESPONSE: {str(e)}")

if __name__ == "__main__":
    asyncio.run(debug_extraction())
