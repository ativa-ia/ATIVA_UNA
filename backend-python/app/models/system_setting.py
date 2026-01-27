from app import db

class SystemSetting(db.Model):
    """Modelo para configurações do sistema"""
    __tablename__ = 'system_settings'
    
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(200))
    is_public = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'is_public': self.is_public
        }
