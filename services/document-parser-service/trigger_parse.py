import asyncio
import json
from aiokafka import AIOKafkaProducer
import uuid

async def trigger():
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()
    
    # Target document from screenshot
    doc_id = "16a604a2-5859-4673-a61e-7974e824a20b"
    tracking_code = "DVC-1776311940265-16A604A2"
    
    payload = {
        "payload": {
            "documentId": doc_id,
            "trackingCode": tracking_code,
            "rawFileUrl": f"http://localhost:9000/dvc-documents/{doc_id}",
            "mimeType": "application/pdf"
        },
        "correlationId": str(uuid.uuid4())
    }
    
    print(f"Triggering re-parse for {tracking_code}...")
    await producer.send_and_wait("document.received", value=json.dumps(payload).encode('utf-8'))
    print("Event sent to document.received!")
    await producer.stop()

if __name__ == "__main__":
    asyncio.run(trigger())
