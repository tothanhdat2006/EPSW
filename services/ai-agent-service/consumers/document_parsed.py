import json
import asyncio
import uuid
from datetime import datetime, timezone
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from minio import Minio
from config import settings
from logger import get_logger
from agents.classification_agent import classify_document
from agents.extraction_agent import extract_document_data
from agents.redaction_agent import redact_and_upload
from agents.redaction_identification_agent import identify_pii_for_redaction
from services.confidence import compute_overall_confidence
from services.db import update_document_after_analysis
from typing import Optional

_logger = get_logger(settings.service_name)
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
            request_timeout_ms=5000,
        )
        await _producer.start()
    return _producer


def _build_event(event_type: str, payload: dict, correlation_id: str) -> dict:
    return {
        "eventId": str(uuid.uuid4()),
        "correlationId": correlation_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
        "type": event_type,
        "payload": payload,
    }


def _get_minio() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl,
    )


async def process_analysis(msg_value: dict) -> None:
    payload = msg_value.get("payload", {})
    document_id: str = payload["documentId"]
    tracking_code: str = payload["trackingCode"]
    raw_text: str = payload["rawText"]
    correlation_id: str = msg_value.get("correlationId", document_id)

    logger = get_logger(settings.service_name, correlation_id)
    logger.info({"documentId": document_id, "message": "Starting AI analysis"})

    producer = await _get_producer()

    try:
        # Step 1: Classify document
        classification = await classify_document(raw_text)
        logger.info({
            "documentId": document_id,
            "documentType": classification.document_type,
            "confidence": classification.confidence,
            "message": "Classification complete",
        })

        # Step 2: Extract structured data
        extraction = await extract_document_data(raw_text, classification.document_type)

        # Step 3: Compute overall confidence
        overall_confidence, requires_hitl = compute_overall_confidence(
            classification.confidence,
            extraction.extraction_confidence,
        )

        # Step 4: Redact PII if present
        redacted_url: Optional[str] = None
        if classification.contains_pii:
            # Semantic Redaction: Use Qwen to find EXACT strings to redact
            pii_strings = await identify_pii_for_redaction(raw_text)
            
            if pii_strings:
                # Fetch original file bytes for redaction
                try:
                    minio = _get_minio()
                    # Derive object key from tracking code (simplified)
                    obj_key = f"{document_id}/"
                    objects = list(minio.list_objects(settings.minio_bucket_documents, prefix=obj_key))
                    if objects:
                        response = minio.get_object(settings.minio_bucket_documents, objects[0].object_name)
                        file_bytes = response.read()
                        response.close()
                        redacted_url = await redact_and_upload(document_id, file_bytes, pii_strings, correlation_id)
                except Exception as exc:
                    logger.warning({"documentId": document_id, "error": str(exc), "message": "Redaction skipped due to error"})
            else:
                logger.info({"documentId": document_id, "message": "No specific PII strings found by semantic agent"})

        # Step 5: Combine extracted data
        extracted_data = {
            "documentType": classification.document_type,
            "urgency": classification.urgency,
            "securityLevel": classification.security_level,
            "department": classification.department,
            "summary": classification.summary,
            "issuingAuthority": extraction.issuing_authority,
            "issueDate": extraction.issue_date,
            "expiryDate": extraction.expiry_date,
            "subjectName": extraction.subject_name,
            "subjectId": extraction.subject_id,
            "address": extraction.address,
            "purpose": extraction.purpose,
            "referenceNumber": extraction.reference_number,
            "keywords": extraction.keywords,
            "customFields": extraction.custom_fields,
            "rawText": raw_text,
        }

        # Step 6: Route based on confidence threshold (INSTRUCTIONS.md rule)
        if requires_hitl:
            logger.warning({
                "documentId": document_id,
                "confidence": overall_confidence,
                "threshold": settings.confidence_threshold,
                "message": "Confidence below threshold — routing to HITL",
            })

            # Emit to hitl-pending-topic AND hitl.review_required
            hitl_event = _build_event("hitl.review_required", {
                "documentId": document_id,
                "trackingCode": tracking_code,
                "aiConfidence": overall_confidence,
                "partialExtractedData": extracted_data,
                "assignedRole": "CHUYEN_VIEN",
            }, correlation_id)

            pending_event = _build_event("hitl.pending", {
                "documentId": document_id,
                "trackingCode": tracking_code,
                "taskType": "AI_REVIEW",
                "assignedRole": "CHUYEN_VIEN",
                "reason": f"AI confidence {overall_confidence:.1f}% below threshold {settings.confidence_threshold}%",
            }, correlation_id)

            await producer.send_and_wait(settings.kafka_topic_hitl_review, value=hitl_event, key=document_id)
            await producer.send_and_wait(settings.kafka_topic_hitl_pending, value=pending_event, key=document_id)

            update_document_after_analysis(
                document_id=document_id,
                extracted_data=extracted_data,
                ai_confidence=overall_confidence,
                security_level=classification.security_level,
                redacted_file_url=redacted_url,
                status="HITL_REVIEW",
            )
        else:
            logger.info({
                "documentId": document_id,
                "confidence": overall_confidence,
                "message": "Confidence passes threshold — publishing document.analyzed",
            })

            analyzed_event = _build_event("document.analyzed", {
                "documentId": document_id,
                "trackingCode": tracking_code,
                "extractedData": extracted_data,
                "aiConfidence": overall_confidence,
                "securityLevel": classification.security_level,
                "priority": classification.urgency,
                "redactedFileUrl": redacted_url,
            }, correlation_id)

            await producer.send_and_wait(
                settings.kafka_topic_document_analyzed,
                value=analyzed_event,
                key=document_id,
            )

            update_document_after_analysis(
                document_id=document_id,
                extracted_data=extracted_data,
                ai_confidence=overall_confidence,
                security_level=classification.security_level,
                redacted_file_url=redacted_url,
                status="PROCESSING",
            )

    except Exception as exc:
        logger.error({"documentId": document_id, "error": str(exc), "message": "AI analysis failed — routing to HITL"})

        hitl_event = _build_event("hitl.review_required", {
            "documentId": document_id,
            "trackingCode": tracking_code,
            "aiConfidence": 0.0,
            "partialExtractedData": {},
            "assignedRole": "CHUYEN_VIEN",
        }, correlation_id)

        await producer.send_and_wait(settings.kafka_topic_hitl_review, value=hitl_event, key=document_id)
        raise


async def start_consumer() -> None:
    consumer = AIOKafkaConsumer(
        settings.kafka_topic_document_parsed,
        bootstrap_servers=settings.kafka_brokers,
        group_id=settings.kafka_group_id,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        request_timeout_ms=5000,
    )
    await consumer.start()
    _logger.info({"topic": settings.kafka_topic_document_parsed, "message": "AI agent consumer started"})

    try:
        async for msg in consumer:
            try:
                await process_analysis(msg.value)
                await consumer.commit()
            except Exception as exc:
                _logger.error({"error": str(exc), "message": "Failed to process AI analysis"})
                await consumer.commit()
    finally:
        await consumer.stop()


async def stop_consumer_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
