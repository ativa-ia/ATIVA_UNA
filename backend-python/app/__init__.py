from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from app.config import config
import os

# Inicializar extensões
db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name=None):
    """Factory para criar a aplicação Flask"""
    
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Inicializar extensões
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)  # Permitir requisições do React Native
    
    # Registrar blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.subject_routes import subject_bp
    from app.routes.ai_routes import ai_bp
    from app.routes.notification_routes import notification_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(subject_bp, url_prefix='/api/subjects')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    
    # Rota raiz
    @app.route('/')
    def index():
        return {
            'message': 'API Assistente 360',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/api/auth',
                'subjects': '/api/subjects',
                'ai': '/api/ai'
            }
        }
    
    # Rota 404
    @app.errorhandler(404)
    def not_found(error):
        return {
            'success': False,
            'message': 'Rota não encontrada'
        }, 404
    
    # Error handler global
    @app.errorhandler(500)
    def internal_error(error):
        return {
            'success': False,
            'message': 'Erro interno do servidor'
        }, 500
    
    # Criar tabelas no banco de dados
    with app.app_context():
        db.create_all()
    
    return app
