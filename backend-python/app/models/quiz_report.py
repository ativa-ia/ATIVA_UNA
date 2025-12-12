"""
Modelo para armazenar relatórios de quiz
"""
from app import db
from datetime import datetime


class QuizReport(db.Model):
    """Relatório completo de um quiz"""
    __tablename__ = 'quiz_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    generated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Estatísticas gerais (JSON)
    statistics = db.Column(db.JSON, nullable=False)
    # {
    #     'enrolled_count': int,
    #     'response_count': int,
    #     'response_rate': float,
    #     'average_score': float,
    #     'average_percentage': float,
    #     'average_points': float,
    #     'average_time': float
    # }
    
    # Top performers (JSON)
    top_performers = db.Column(db.JSON, nullable=False)
    # [{'student_id': int, 'name': str, 'points': int, 'percentage': float, ...}, ...]
    
    # Análise por questão (JSON)
    question_analysis = db.Column(db.JSON, nullable=False)
    # [{'question_id': int, 'question': str, 'correct_rate': float, ...}, ...]
    
    # Caminho do PDF gerado (opcional)
    pdf_path = db.Column(db.String(500))
    
    # Relationships
    quiz = db.relationship('Quiz', backref='reports', lazy=True)
    generator = db.relationship('User', backref='generated_reports', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'generated_by': self.generated_by,
            'statistics': self.statistics,
            'top_performers': self.top_performers,
            'question_analysis': self.question_analysis,
            'pdf_path': self.pdf_path
        }
