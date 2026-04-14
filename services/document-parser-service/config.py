from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    service_name: str = "document-parser-service"
    log_level: str = "INFO"

    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "document-parser-group"
    kafka_topic_document_received: str = "document.received"
    kafka_topic_document_parsed: str = "document.parsed"
    kafka_topic_hitl_manual_entry: str = "hitl.manual_entry_required"
    kafka_dlq_suffix: str = ".dlq"
    kafka_max_retries: int = 3

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minio_admin"
    minio_secret_key: str = "minio_password"
    minio_bucket_documents: str = "dvc-documents"
    minio_use_ssl: bool = False

    database_url: str = "postgresql://dvc_user:dvc_password@localhost:5432/dvc_db"

    @property
    def kafka_broker_list(self) -> List[str]:
        return self.kafka_brokers.split(",")

    class Config:
        env_file = ".env"


settings = Settings()
