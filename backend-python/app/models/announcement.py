from app import db
from datetime import datetime


class Announcement(db.Model):
    """Modelo de Aviso/Comunicado"""
    __tablename__ = 'announcements'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    published_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    published_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    publisher = db.relationship('User', backref='announcements', lazy=True)
    
    def __repr__(self):
        return f'<Announcement {self.title}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'title': self.title,
            'description': self.description,
            'published_by': self.published_by,
            'published_at': self.published_at.isoformat() if self.published_at else None
        }
