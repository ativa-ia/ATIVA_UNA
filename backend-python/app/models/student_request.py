from app import db
from datetime import datetime

class StudentRequest(db.Model):
    """Modelo de Solicitação do Aluno para a Coordenação (Ex: Revisão, Extensão)"""
    __tablename__ = 'student_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Tipo da solicitação
    request_type = db.Column(db.String(100), nullable=False) # Ex: "Revisão de Nota", "Justificativa de Falta"
    
    # Detalhe / Mensagem
    description = db.Column(db.Text, nullable=True)
    
    # Status: pending, resolved, rejected
    status = db.Column(db.String(50), default='pending')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    # Relacionamento
    student = db.relationship('User', backref='student_requests', lazy=True)
    
    def __repr__(self):
        return f'<StudentRequest {self.id} type={self.request_type}>'
        
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'request_type': self.request_type,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }
