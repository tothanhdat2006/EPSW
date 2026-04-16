import asyncio
from services.db import get_document_data
import json

async def check():
    tracking_code = "DVC-1776311940265-16A604A2"
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from config import settings
    
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        res = session.execute(
            text('SELECT id, "trackingCode", "status", "extractedData" FROM "Document" WHERE "trackingCode" = :tc'),
            {"tc": tracking_code}
        ).mappings().first()
        
        if res:
            print(f"Document Found: {res['id']}")
            print(f"Status: {res['status']}")
            data = res['extractedData']
            if isinstance(data, str):
                data = json.loads(data)
            
            print(f"ExtractedData Keys: {list(data.keys()) if data else 'Empty'}")
            if data and 'rawText' in data:
                print(f"RawText Sample: {data['rawText'][:100]}...")
            else:
                print("❌ rawText is MISSING from extractedData!")
        else:
            print("❌ Document not found by tracking code.")
    finally:
        session.close()

if __name__ == "__main__":
    asyncio.run(check())
