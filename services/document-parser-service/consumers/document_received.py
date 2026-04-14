import json
import asyncio
from aiokafka import AIOKafkaConsumer
from minio import Minio
from config import settings
from logger import get_logger
from parsers.pdf_parser import extract_text_from_pdf, is_native_pdf
from parsers.ocr_parser import ocr_pdf, ocr_image
from producers.kafka_producer import (
    publish_document_parsed,
    publish_hitl_manual_entry,
    publish_to_dlq,
)
from tenacity import retry, stop_after_attempt, wait_exponential

_logger = get_logger(settings.service_name)

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/tiff"}


def _get_minio_client() -> Minio:
    host, port = settings.minio_endpoint.split(":") if ":" in settings.minio_endpoint else (settings.minio_endpoint, "9000")
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _download_file(minio: Minio, bucket: str, object_key: str) -> bytes:
    response = minio.get_object(bucket, object_key)
    data = response.read()
    response.close()
    response.release_conn()
    return data


async def _process_message(msg_value: dict) -> None:
    payload = msg_value.get("payload", {})
    document_id: str = payload["documentId"]
    tracking_code: str = payload["trackingCode"]
    raw_file_url: str = payload["rawFileUrl"]
    mime_type: str = payload.get("mimeType", "application/pdf")
    correlation_id: str = msg_value.get("correlationId", document_id)

    logger = get_logger(settings.service_name, correlation_id)
    logger.info({"documentId": document_id, "mimeType": mime_type, "message": "Processing document.received"})

    minio = _get_minio_client()

    # Derive bucket and object key from URL: http://host:port/bucket/key
    url_parts = raw_file_url.split("/", 4)
    bucket = url_parts[3] if len(url_parts) > 3 else settings.minio_bucket_documents
    object_key = url_parts[4] if len(url_parts) > 4 else document_id

    file_bytes = _download_file(minio, bucket, object_key)

    raw_text = ""
    page_count = 1
    parse_method = "PDF_READER"

    if mime_type in IMAGE_MIME_TYPES:
        raw_text, page_count = ocr_image(file_bytes, mime_type)
        parse_method = "OCR"
    elif mime_type == "application/pdf":
        if is_native_pdf(file_bytes):
            raw_text, page_count = extract_text_from_pdf(file_bytes)
            parse_method = "PDF_READER"
        else:
            raw_text, page_count = ocr_pdf(file_bytes)
            parse_method = "OCR"

    if len(raw_text.strip()) < 20:
        logger.warning({"documentId": document_id, "textLength": len(raw_text), "message": "Insufficient text extracted — routing to HITL"})
        await publish_hitl_manual_entry(
            document_id=document_id,
            tracking_code=tracking_code,
            raw_file_url=raw_file_url,
            error_reason="UNREADABLE",
            correlation_id=correlation_id,
        )
        return

    from datetime import datetime, timezone
    await publish_document_parsed(
        document_id=document_id,
        tracking_code=tracking_code,
        raw_text=raw_text,
        page_count=page_count,
        parse_method=parse_method,
        received_at=datetime.now(timezone.utc).isoformat(),
        correlation_id=correlation_id,
    )


async def start_consumer() -> None:
    consumer = AIOKafkaConsumer(
        settings.kafka_topic_document_received,
        bootstrap_servers=settings.kafka_brokers,
        group_id=settings.kafka_group_id,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )
    await consumer.start()
    _logger.info({"topic": settings.kafka_topic_document_received, "message": "Consumer started"})

    try:
        async for msg in consumer:
            try:
                await _process_message(msg.value)
                await consumer.commit()
            except Exception as exc:
                correlation_id = (msg.value or {}).get("correlationId", "unknown")
                _logger.error({"error": str(exc), "correlationId": correlation_id, "message": "Failed to process message"})
                await publish_to_dlq(
                    topic=settings.kafka_topic_document_received,
                    raw_message=msg.value if isinstance(msg.value, bytes) else json.dumps(msg.value).encode(),
                    error=str(exc),
                    correlation_id=correlation_id,
                )
                await consumer.commit()
    finally:
        await consumer.stop()
