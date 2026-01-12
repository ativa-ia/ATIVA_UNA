from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO
from app.config import config
import os

import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar extensões
db = SQLAlchemy()
migrate = Migrate()
socketio = SocketIO(cors_allowed_origins="*")  # Permitir conexões do React Native


def create_app(config_name=None):
    """Factory para criar a aplicação Flask"""
    
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Inicializar extensões
    try:
        logger.info("Inicializando extensoes...")
        db.init_app(app)
        migrate.init_app(app, db)
        socketio.init_app(app)
        CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, expose_headers=["Content-Disposition"])
        logger.info("Extensoes inicializadas com sucesso.")
    except Exception as e:
        logger.error(f"Erro ao inicializar extensoes: {e}")
    
    # Registrar blueprints
    try:
        logger.info("Registrando blueprints...")
        from app.routes.auth_routes import auth_bp
        from app.routes.subject_routes import subject_bp
        from app.routes.ai_routes import ai_bp
        from app.routes.notification_routes import notification_bp
        from app.routes.admin_routes import admin_bp
        from app.routes.chat_routes import chat_bp
        from app.routes.enrollment_routes import enrollment_bp
        from app.routes.transcription_routes import transcription_bp
        
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.register_blueprint(subject_bp, url_prefix='/api/subjects')
        app.register_blueprint(ai_bp, url_prefix='/api/ai')
        app.register_blueprint(notification_bp, url_prefix='/api/notifications')
        app.register_blueprint(admin_bp, url_prefix='/api/admin')
        app.register_blueprint(chat_bp, url_prefix='/api/chat')
        app.register_blueprint(enrollment_bp, url_prefix='/api/enrollments')
        app.register_blueprint(transcription_bp, url_prefix='/api/transcription')
        logger.info("Blueprints registrados com sucesso.")
    except Exception as e:
        logger.error(f"Erro ao registrar blueprints: {e}")
    
    # Rota raiz
    @app.route('/')
    def index():
        return {
            'message': 'API ATIVA IA',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/api/auth',
                'subjects': '/api/subjects',
                'ai': '/api/ai'
            }
        }
    
    # Rota de Health Check
    @app.route('/health')
    def health_check():
        logger.info("Health check endpoint called")
        return {
            'status': 'ok',
            'message': 'Server is healthy',
            'version': '1.0.0'
        }, 200
    
    # Rota de Debug (temporária para diagnóstico)
    @app.route('/debug')
    def debug_info():
        db_url = os.getenv('DATABASE_URL', 'NOT SET')
        # Mascarar a senha
        masked_url = 'NOT SET'
        if db_url and db_url != 'NOT SET' and '@' in db_url:
            parts = db_url.split('@')
            user_part = parts[0].split(':')[0] if ':' in parts[0] else parts[0]
            masked_url = user_part + ':****@' + parts[1]
        return {
            'flask_env': os.getenv('FLASK_ENV', 'NOT SET (using development)'),
            'database_url_configured': db_url != 'NOT SET',
            'database_url_preview': masked_url,
            'sqlalchemy_uri_set': bool(app.config.get('SQLALCHEMY_DATABASE_URI')),
            'debug_mode': app.config.get('DEBUG', False)
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
    # with app.app_context():
    #     db.create_all()
    
    return app
