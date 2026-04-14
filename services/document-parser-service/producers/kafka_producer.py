import json
import uuid
from datetime import datetime, timezone
from aiokafka import AIOKafkaProducer
from typing import Optional, Any, Dict
from config import settings
import logging

logger = logging.getLogger("document-parser-service")

_producer: Optional[AIOKafkaProducer] = None


async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_brokers,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            enable_idempotence=True,
            acks="all",
        )
        await _producer.start()
    return _producer


async def stop_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None


def _build_event(event_type: str, payload: Dict[str, Any], correlation_id: str) -> Dict[str, Any]:
    return {
        "eventId": str(uuid.uuid4()),
        "correlationId": correlation_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
        "type": event_type,
        "payload": payload,
    }


async def publish_document_parsed(
    document_id: str,
    tracking_code: str,
    raw_text: str,
    page_count: int,
    parse_method: str,
    received_at: str,
    correlation_id: str,
) -> None:
    producer = await get_producer()
    event = _build_event(
        "document.parsed",
        {
            "documentId": document_id,
            "trackingCode": tracking_code,
            "rawText": raw_text,
            "pageCount": page_count,
            "parseMethod": parse_method,
            "receivedAt": received_at,
        },
        correlation_id,
    )
    await producer.send_and_wait(
        settings.kafka_topic_document_parsed,
        value=event,
        key=document_id,
    )
    logger.info({"documentId": document_id, "topic": settings.kafka_topic_document_parsed, "message": "Published document.parsed"})


async def publish_hitl_manual_entry(
    document_id: str,
    tracking_code: str,
    raw_file_url: str,
    error_reason: str,
    correlation_id: str,
) -> None:
    producer = await get_producer()
    event = _build_event(
        "hitl.manual_entry_required",
        {
            "documentId": document_id,
            "trackingCode": tracking_code,
            "rawFileUrl": raw_file_url,
            "errorReason": error_reason,
            "assignedRole": "VAN_THU",
        },
        correlation_id,
    )
    await producer.send_and_wait(
        settings.kafka_topic_hitl_manual_entry,
        value=event,
        key=document_id,
    )
    logger.info({"documentId": document_id, "errorReason": error_reason, "message": "Published hitl.manual_entry_required"})


async def publish_to_dlq(topic: str, raw_message: bytes, error: str, correlation_id: str) -> None:
    producer = await get_producer()
    dlq_topic = f"{topic}{settings.kafka_dlq_suffix}"
    dlq_payload = {
        "originalTopic": topic,
        "error": error,
        "correlationId": correlation_id,
        "rawMessage": raw_message.decode("utf-8", errors="replace"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await producer.send_and_wait(dlq_topic, value=dlq_payload)
    logger.warning({"dlqTopic": dlq_topic, "error": error, "message": "Message sent to DLQ"})
