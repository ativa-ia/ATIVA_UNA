from app import db
from datetime import datetime
import bcrypt


class User(db.Model):
    """Modelo de usuário"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'student', 'teacher', 'coordinator'
    name = db.Column(db.String(100), nullable=False)
    registration_number = db.Column(db.String(50), unique=True, nullable=True)  # Matrícula do aluno
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)  # Curso do aluno
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    course = db.relationship('Course', backref='students', lazy=True)
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def set_password(self, password):
        """Hash da senha usando bcrypt"""
        self.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def verify_password(self, password):
        """Verificar senha"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password.encode('utf-8'))
    
    def to_dict(self, include_token=False):
        """Converter para dicionário (sem senha)"""
        data = {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'name': self.name,
            'registration_number': self.registration_number,
            'course_id': self.course_id,
            'course_name': self.course.name if self.course else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        return data
    
    @staticmethod
    def find_by_email(email):
        """Buscar usuário por email"""
        return User.query.filter_by(email=email).first()
    
    @staticmethod
    def find_by_id(user_id):
        """Buscar usuário por ID"""
        return User.query.get(user_id)
    
    @staticmethod
    def create_user(email, password, role, name, registration_number=None, course_id=None):
        """Criar novo usuário"""
        user = User(
            email=email,
            role=role,
            name=name,
            registration_number=registration_number,
            course_id=course_id
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user
