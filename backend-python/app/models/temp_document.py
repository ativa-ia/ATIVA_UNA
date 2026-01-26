"""
Modelo para documentos temporários
"""
from app import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

class TempDocument(db.Model):
    """Documentos temporários processados pelo n8n"""
    __tablename__ = 'temp_documents'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    classroom_id = db.Column(db.String(255), nullable=False, index=True)
    filename = db.Column(db.String(500), nullable=False)
    document_data = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'classroom_id': self.classroom_id,
            'filename': self.filename,
            'document_data': self.document_data,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
