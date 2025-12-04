from app import db
from datetime import datetime


class Material(db.Model):
    """Modelo de Material de Aula"""
    __tablename__ = 'materials'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'pdf', 'video', 'link'
    url = db.Column(db.String(500))  # URL do arquivo ou link
    size = db.Column(db.String(20))  # Ex: "2.5 MB"
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    uploader = db.relationship('User', backref='materials', lazy=True)
    
    def __repr__(self):
        return f'<Material {self.title}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'title': self.title,
            'type': self.type,
            'url': self.url,
            'size': self.size,
            'uploaded_by': self.uploaded_by,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }
