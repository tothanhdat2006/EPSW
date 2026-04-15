from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    service_name: str = "ai-agent-service"
    log_level: str = "INFO"

    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "ai-agent-group"
    kafka_topic_document_parsed: str = "document.parsed"
    kafka_topic_document_analyzed: str = "document.analyzed"
    kafka_topic_hitl_review: str = "hitl.review_required"
    kafka_topic_hitl_pending: str = "hitl.pending-topic"
    kafka_dlq_suffix: str = ".dlq"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minio_admin"
    minio_secret_key: str = "minio_password"
    minio_bucket_documents: str = "dvc-documents"
    minio_bucket_redacted: str = "dvc-redacted"
    minio_use_ssl: bool = False

    database_url: str = "postgresql://dvc_user:dvc_password@localhost:5432/dvc_db"

    # LLM (provider-agnostic)
    # Supported providers:
    # - "alibaba" / "dashscope" / "qwen": Alibaba Cloud DashScope OpenAI-compatible API
    # - "openai": OpenAI API
    llm_provider: str = "alibaba"
    llm_model: str = "qwen-plus"
    llm_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None
    # Backward-compat (deprecated): prefer LLM_API_KEY
    openai_api_key: Optional[str] = None
    llm_temperature: float = 0.0

    # HITL confidence threshold per INSTRUCTIONS.md
    confidence_threshold: float = 70.0

    class Config:
        env_file = ".env"


settings = Settings()


def resolve_llm_api_key() -> Optional[str]:
    return settings.llm_api_key or settings.openai_api_key


def resolve_llm_base_url() -> Optional[str]:
    if settings.llm_base_url:
        return settings.llm_base_url
    provider = (settings.llm_provider or "").strip().lower()
    if provider in {"alibaba", "dashscope", "qwen"}:
        # DashScope OpenAI-compatible endpoint
        return "https://dashscope.aliyuncs.com/compatible-mode/v1"
    return None
