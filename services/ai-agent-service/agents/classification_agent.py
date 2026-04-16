from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import Optional
from config import settings, resolve_llm_api_key, resolve_llm_base_url
from tenacity import retry, stop_after_attempt, wait_exponential


class ClassificationResult(BaseModel):
    document_type: str = Field(description="Type of document, e.g. 'BUSINESS_LICENSE', 'BIRTH_CERTIFICATE'")
    urgency: str = Field(description="One of: NORMAL, URGENT, FLASH")
    security_level: str = Field(description="One of: UNCLASSIFIED, RESTRICTED, CONFIDENTIAL, SECRET")
    department: str = Field(description="Responsible department code, e.g. 'SO_KH_DT', 'UBND_TINH'")
    summary: str = Field(description="Concise 1-2 sentence summary of document purpose and subject in Vietnamese")
    confidence: int = Field(description="Confidence score from 0 to 100")
    contains_pii: bool = Field(description="Whether the document contains Personally Identifiable Information")
    pii_fields: Optional[list] = Field(default=None, description="List of PII field names found")


CLASSIFICATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """BẠN LÀ CHUYÊN VIÊN PHÂN TÍCH HỒ SƠ HÀNH CHÍNH CHUYÊN NGHIỆP.
Phân tích văn bản tiếng Việt và trả về JSON theo đúng cấu trúc sau:

{{
  "document_type": "Loại hồ sơ (VD: TỜ KHAI CT01)",
  "urgency": "NORMAL | URGENT | FLASH",
  "security_level": "UNCLASSIFIED | RESTRICTED | CONFIDENTIAL | SECRET",
  "department": "Phòng/Ban xử lý (VD: CONG_AN_XA)",
  "summary": "Tóm tắt ngắn gọn mục đích và đối tượng (1-2 câu tiếng Việt)",
  "confidence": integer (0-100),
  "contains_pii": boolean,
  "pii_fields": ["danh_sach_truong_can_che_mo"]
}}

BẮT BUỘC:
- Chỉ trả về JSON, không giải thích gì thêm.
- Tóm tắt (summary) phải súc tích, chuyên nghiệp.
"""),
    ("human", "Nội dung văn bản:\n\n{text}\n\nTrả về kết quả JSON:"),
])


def _get_llm() -> ChatOpenAI:
    api_key = resolve_llm_api_key()
    base_url = resolve_llm_base_url()
    return ChatOpenAI(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        api_key=api_key,
        base_url=base_url,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def classify_document(text: str) -> ClassificationResult:
    """
    Classify a document using LangChain + LLM.
    Retries up to 3 times on transient failures.
    """
    llm = _get_llm()
    parser = JsonOutputParser(pydantic_object=ClassificationResult)
    chain = CLASSIFICATION_PROMPT | llm | parser
    result = await chain.ainvoke({"text": text[:8000]})  # Truncate to avoid token limits
    return ClassificationResult(**result) if isinstance(result, dict) else result
