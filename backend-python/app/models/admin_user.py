from app import db
from datetime import datetime
import bcrypt
import uuid


class AdminUser(db.Model):
    """Modelo de administrador da plataforma (devs/fundadores).
    Completamente isolado da tabela 'users' de alunos/professores.
    """
    __tablename__ = 'admin_users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f'<AdminUser {self.email}>'

    def set_password(self, password):
        """Hash da senha usando bcrypt"""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), bcrypt.gensalt()
        ).decode('utf-8')

    def verify_password(self, password):
        """Verificar senha"""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def to_dict(self):
        """Converter para dicionário (sem senha)"""
        return {
            'id': str(self.id),
            'name': self.name,
            'email': self.email,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
        }

    @staticmethod
    def find_by_email(email):
        return AdminUser.query.filter_by(email=email).first()

    @staticmethod
    def find_by_id(admin_id):
        return AdminUser.query.get(admin_id)
