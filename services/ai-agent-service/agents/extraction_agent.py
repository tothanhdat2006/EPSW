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
    extraction_confidence: float = Field(description="Confidence from 0.0 to 100.0 for this extraction")


EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at extracting structured data from Vietnamese government documents.
Extract all relevant fields from the document text.
For dates, use ISO format (YYYY-MM-DD).
For names and addresses, preserve the original Vietnamese text.
Return a JSON object matching the schema exactly.
Set extraction_confidence to your certainty from 0-100."""),
    ("human", "Document type: {document_type}\n\nDocument text:\n\n{text}\n\nReturn extracted data as JSON:"),
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
