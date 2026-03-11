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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
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
        # Buscar primeira matrícula ativa (para retrocompatibilidade)
        active_enrollment = None
        if self.role == 'student' and self.course_enrollments:
            active_enrollment = next(
                (ce for ce in self.course_enrollments if ce.status == 'active'),
                self.course_enrollments[0] if self.course_enrollments else None
            )

        data = {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'name': self.name,
            'registration_number': active_enrollment.registration_number if active_enrollment else None,
            'course_id': active_enrollment.course_id if active_enrollment else None,
            'course_name': active_enrollment.course.name if active_enrollment and active_enrollment.course else None,
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
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()  # Garante que o user.id existe antes de criar o enrollment

        # Se informou course_id, criar a matrícula institucional
        if course_id:
            from app.models.course_enrollment import CourseEnrollment
            enrollment = CourseEnrollment(
                user_id=user.id,
                course_id=course_id,
                registration_number=registration_number,
            )
            db.session.add(enrollment)

        db.session.commit()
        return user
