from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from config import settings
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger("ai-agent-service")

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def update_document_after_analysis(
    document_id: str,
    extracted_data: Dict[str, Any],
    ai_confidence: float,
    security_level: str,
    redacted_file_url: Optional[str],
    status: str,
) -> None:
    """
    Write AI analysis results back to the Document record in PostgreSQL.
    """
    session: Session = SessionLocal()
    try:
        import json
        session.execute(
            text("""
                UPDATE "Document"
                SET
                    "extractedData"    = :extracted_data::jsonb,
                    "aiConfidence"     = :ai_confidence,
                    "securityLevel"    = :security_level::"SecurityLevel",
                    "redactedFileUrl"  = :redacted_file_url,
                    "status"           = :status::"DocStatus",
                    "updatedAt"        = NOW()
                WHERE id = :document_id
            """),
            {
                "extracted_data": json.dumps(extracted_data, default=str, ensure_ascii=False),
                "ai_confidence": ai_confidence,
                "security_level": security_level,
                "redacted_file_url": redacted_file_url,
                "status": status,
                "document_id": document_id,
            },
        )
        session.commit()
        logger.info({"documentId": document_id, "status": status, "message": "Document updated after AI analysis"})
    except Exception as exc:
        session.rollback()
        logger.error({"documentId": document_id, "error": str(exc), "message": "Failed to update document"})
        raise
    finally:
        session.close()


def get_document_data(document_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the complete document record from PostgreSQL.
    """
    session: Session = SessionLocal()
    try:
        result = session.execute(
            text('SELECT * FROM "Document" WHERE id = :id'),
            {"id": document_id}
        ).mappings().first()
        
        if result:
            # result is a RowMapping, convert to dict
            return dict(result)
        return None
    except Exception as exc:
        logger.error({"documentId": document_id, "error": str(exc), "message": "Failed to fetch document data"})
        return None
    finally:
        session.close()
