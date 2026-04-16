from langchain_community.chat_models.tongyi import ChatTongyi
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from config import settings
from tenacity import retry, stop_after_attempt, wait_exponential


class RedactionIdentificationResult(BaseModel):
    pii_terms: list[str] = Field(description="Exact strings found in the text that should be redacted (names, IDs, phone numbers, etc.)")
    analysis: str = Field(description="Brief explanation of why these terms were selected")


REDACTION_IDENTIFICATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a Professional Administrative Officer. You are a security specialist in Vietnamese government administration.
Your task is to identify all Personally Identifiable Information (PII) in the document text that must be redacted for privacy protection.

Identify exact strings for:
- Full Names (Tên riêng)
- ID Numbers (Số CMND/CCCD/Passport)
- Phone Numbers (Số điện thoại)
- Specific Addresses (Địa chỉ chi tiết)
- Email addresses
- Bank account numbers

Return a JSON object with the list of exact strings to be redacted."""),
    ("human", "Document text:\n\n{text}\n\nReturn strings to redact as JSON:"),
])


def _get_llm() -> ChatTongyi:
    return ChatTongyi(
        model=settings.llm_model,
        temperature=0.0,
        dashscope_api_key=settings.dashscope_api_key,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def identify_pii_for_redaction(text: str) -> list[str]:
    """
    Use Qwen to identify specific PII strings that need to be redacted.
    """
    llm = _get_llm()
    parser = JsonOutputParser(pydantic_object=RedactionIdentificationResult)
    chain = REDACTION_IDENTIFICATION_PROMPT | llm | parser
    result = await chain.ainvoke({"text": text[:8000]})
    
    if isinstance(result, dict):
        return result.get("pii_terms", [])
    return result.pii_terms
