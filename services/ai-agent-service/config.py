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

    llm_model: str = "gpt-4o-mini"
    openai_api_key: Optional[str] = None
    llm_temperature: float = 0.0

    # HITL confidence threshold per INSTRUCTIONS.md
    confidence_threshold: float = 70.0

    class Config:
        env_file = ".env"


settings = Settings()
