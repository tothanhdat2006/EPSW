import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from config import settings
from logger import get_logger
from consumers.document_parsed import start_consumer, stop_consumer_producer, process_analysis
from agents.chat_agent import conduct_ai_chat
from services.db import get_document_data
from pydantic import BaseModel
from typing import List, Dict

logger = get_logger(settings.service_name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info({"message": "Starting ai-agent-service"})
    try:
        from consumers.document_parsed import start_consumer, stop_consumer_producer
        consumer_task = asyncio.create_task(start_consumer())
        logger.info({"message": "Background consumer task created"})
        yield
    except Exception as e:
        logger.error({"error": str(e), "message": "Critical failure in lifespan"})
        raise
    finally:
        from consumers.document_parsed import stop_consumer_producer
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await stop_consumer_producer()
        logger.info({"message": "ai-agent-service shut down"})


app = FastAPI(
    title="AI Agent Service",
    description="LangChain-powered document classification, extraction, and PII redaction",
    version="1.0.0",
    lifespan=lifespan,
)

class ChatRequest(BaseModel):
    documentId: str
    message: str
    history: List[Dict[str, str]] = []

@app.post("/api/ai/chat")
async def api_chat(req: ChatRequest):
    try:
        logger.info({"documentId": req.documentId, "message": "Chat request received"})
        doc = get_document_data(req.documentId)
        if not doc:
            logger.warning({"documentId": req.documentId, "message": "Document not found for chat"})
            return {"error": "Hồ sơ không tồn tại trong hệ thống. Vui lòng quay lại Dashboard và chọn lại hồ sơ."}
        
        # Get the JSON data from extractedData column - SAFE GET
        context = doc.get("extractedData") or {}
        if isinstance(context, str):
            import json
            context = json.loads(context)
            
        logger.info({"documentId": req.documentId, "hasRawText": bool(context.get("rawText")), "message": "Conducting AI chat"})
        
        # Add a timeout to the chat call
        try:
            response = await asyncio.wait_for(
                conduct_ai_chat(req.message, req.history, context),
                timeout=15.0
            )
            return {"response": response}
        except asyncio.TimeoutError:
            logger.error({"documentId": req.documentId, "message": "Chat timed out"})
            return {"error": "AI đang bận hoặc phản hồi quá lâu. Vui lòng thử lại sau giây lát."}

    except Exception as e:
        logger.error({"error": str(e), "documentId": req.documentId, "message": "Chat failed"})
        return {"error": f"Lỗi hệ thống: {str(e)}"}

class ReAnalyzeRequest(BaseModel):
    documentId: str
    trackingCode: str
    rawText: str

@app.post("/api/ai/re-analyze")
async def api_re_analyze(req: ReAnalyzeRequest):
    try:
        logger.info({"documentId": req.documentId, "message": "Re-analysis requested"})
        raw_text = req.rawText
        tracking_code = req.trackingCode
        raw_file_url = ""
        
        # Always check DB first
        doc = get_document_data(req.documentId)
        if doc:
            tracking_code = doc.get("trackingCode", tracking_code) or req.trackingCode
            raw_file_url = doc.get("rawFileUrl", "")
            context = doc.get("extractedData") or {}
            if isinstance(context, str):
                import json
                context = json.loads(context)
            raw_text = context.get("rawText", raw_text)

        # LOGIC CHANGE: If raw_text is missing, trigger PARSER (Kafka), not AI directly
        if not raw_text:
            logger.info({"documentId": req.documentId, "message": "Raw text missing. Triggering Parser Service (Kafka)..."})
            from consumers.document_parsed import get_producer
            
            msg_payload = {
                "payload": {
                    "documentId": req.documentId,
                    "trackingCode": tracking_code,
                    "rawFileUrl": raw_file_url or f"http://localhost:9000/dvc-documents/{req.documentId}",
                    "mimeType": "application/pdf"
                },
                "correlationId": str(uuid.uuid4())
            }
            producer = await get_producer()
            await producer.send_and_wait("document.received", value=json.dumps(msg_payload).encode("utf-8"))
            return {"status": "success", "message": "Re-parse triggered via Kafka"}

        # If we HAVE text, proceed to AI analysis directly
        logger.info({"documentId": req.documentId, "message": "Raw text found. Triggering AI Analysis directly..."})
        from consumers.document_parsed import process_analysis
        msg_value = {
            "payload": {
                "documentId": req.documentId,
                "trackingCode": tracking_code,
                "rawText": raw_text
            }
        }
        await process_analysis(msg_value)
        return {"status": "success", "message": "AI Analysis re-triggered"}
    except Exception as e:
        logger.error({"error": str(e), "message": "Re-analysis failed"})
        return {"error": f"Re-analysis failed: {str(e)}"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.service_name}
