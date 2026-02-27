from app import db
from datetime import datetime


class AuditLog(db.Model):
    """Registro de auditoria das ações realizadas por Super Admins.
    Cada ação no backoffice gera um registro imutável.
    """
    __tablename__ = 'audit_logs'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    admin_user_id = db.Column(db.String(36), db.ForeignKey('admin_users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)      # Ex: 'DELETE_USER', 'UPDATE_SETTING'
    target_type = db.Column(db.String(50), nullable=True)    # Ex: 'users', 'subjects'
    target_id = db.Column(db.String(50), nullable=True)      # ID do registro afetado
    old_data = db.Column(db.JSON, nullable=True)             # Dado antes da alteração
    new_data = db.Column(db.JSON, nullable=True)             # Dado após a alteração
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    # Relationship
    admin_user = db.relationship('AdminUser', backref='audit_logs', lazy=True)

    def __repr__(self):
        return f'<AuditLog {self.action} by {self.admin_user_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'admin_user_id': self.admin_user_id,
            'admin_name': self.admin_user.name if self.admin_user else None,
            'action': self.action,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'old_data': self.old_data,
            'new_data': self.new_data,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @staticmethod
    def log_action(admin_user_id, action, target_type=None, target_id=None,
                   old_data=None, new_data=None, ip_address=None, user_agent=None):
        """Registrar uma ação de auditoria"""
        log = AuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            old_data=old_data,
            new_data=new_data,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        # Não faz commit aqui - o commit deve ser feito pela rota que chamou
        return log
