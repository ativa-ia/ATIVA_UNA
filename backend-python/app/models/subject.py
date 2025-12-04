from app import db
from datetime import datetime


class Subject(db.Model):
    """Modelo de Disciplina"""
    __tablename__ = 'subjects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    description = db.Column(db.Text)
    credits = db.Column(db.Integer, default=4)
    image_url = db.Column(db.String(500))  # URL da imagem da disciplina
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    teachings = db.relationship('Teaching', backref='subject', lazy=True, cascade='all, delete-orphan')
    enrollments = db.relationship('Enrollment', backref='subject', lazy=True, cascade='all, delete-orphan')
    materials = db.relationship('Material', backref='subject', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('Activity', backref='subject', lazy=True, cascade='all, delete-orphan')
    announcements = db.relationship('Announcement', backref='subject', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Subject {self.name}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'credits': self.credits,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
