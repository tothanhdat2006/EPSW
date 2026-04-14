import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from config import settings
from logger import get_logger
from consumers.document_received import start_consumer
from producers.kafka_producer import stop_producer

logger = get_logger(settings.service_name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info({"message": "Starting document-parser-service"})
    consumer_task = asyncio.create_task(start_consumer())
    yield
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    await stop_producer()
    logger.info({"message": "document-parser-service shut down"})


app = FastAPI(
    title="Document Parser Service",
    description="Parses PDF and scanned documents via PyMuPDF and Tesseract OCR",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.service_name}
