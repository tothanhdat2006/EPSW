from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import Optional
from config import settings, resolve_llm_api_key, resolve_llm_base_url
from tenacity import retry, stop_after_attempt, wait_exponential


class ExtractionResult(BaseModel):
    issuing_authority: Optional[str] = Field(default=None, description="Authority that issued the document")
    issue_date: Optional[str] = Field(default=None, description="Issue date in ISO format YYYY-MM-DD")
    expiry_date: Optional[str] = Field(default=None, description="Expiry date in ISO format YYYY-MM-DD")
    subject_name: Optional[str] = Field(default=None, description="Full name of the document subject")
    subject_id: Optional[str] = Field(default=None, description="ID number of the document subject")
    address: Optional[str] = Field(default=None, description="Address mentioned in the document")
    purpose: Optional[str] = Field(default=None, description="Purpose stated in the document")
    reference_number: Optional[str] = Field(default=None, description="Official reference/document number")
    keywords: list = Field(default_factory=list, description="Key terms from the document")
    custom_fields: dict = Field(default_factory=dict, description="Any other structured fields found")
    extraction_confidence: int = Field(description="Confidence from 0 to 100 for this extraction")


EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """BẠN LÀ CHUYÊN VIÊN TRÍCH XUẤT DỮ LIỆU TỪ HỒ SƠ HÀNH CHÍNH VIỆT NAM.
Phân tích văn bản và trả về JSON theo đúng cấu trúc sau:

{{
  "issuing_authority": "Cơ quan ban hành hoặc Nơi nhận hồ sơ",
  "issue_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "subject_name": "Họ và tên của người làm đơn/đối tượng chính",
  "subject_id": "Số định danh/CCCD/CMND",
  "address": "Địa chỉ thường trú/liên lạc",
  "purpose": "Nội dung đề nghị hoặc mục đích hồ sơ",
  "reference_number": "Số hiệu văn bản (nếu có)",
  "keywords": ["từ_khóa_1", "từ_khóa_2"],
  "custom_fields": {{}},
  "extraction_confidence": integer (0-100)
}}

BẮT BUỘC:
- Nếu không tìm thấy thông tin, hãy để null.
- Giữ nguyên tiếng Việt có dấu.
- Chỉ trả về JSON."""),
    ("human", "Loại hồ sơ: {document_type}\n\nNội dung văn bản:\n\n{text}\n\nTrả về kết quả JSON:"),
])


def _get_llm() -> ChatOpenAI:
    api_key = resolve_llm_api_key()
    base_url = resolve_llm_base_url()
    return ChatOpenAI(
        model=settings.llm_model,
        temperature=0.0,
        api_key=api_key,
        base_url=base_url,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def extract_document_data(text: str, document_type: str) -> ExtractionResult:
    """
    Extract structured data from document text using LangChain + LLM.
    """
    llm = _get_llm()
    parser = JsonOutputParser(pydantic_object=ExtractionResult)
    chain = EXTRACTION_PROMPT | llm | parser
    result = await chain.ainvoke({"text": text[:8000], "document_type": document_type})
    return ExtractionResult(**result) if isinstance(result, dict) else result
