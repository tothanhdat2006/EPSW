import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from config import settings
from logger import get_logger
from consumers.document_parsed import start_consumer, stop_consumer_producer

logger = get_logger(settings.service_name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info({"message": "Starting ai-agent-service"})
    consumer_task = asyncio.create_task(start_consumer())
    yield
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.service_name}
