from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from flask_compress import Compress
# socketio.init_app(app)
from app.config import config
import os
import time

import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar extensões
db = SQLAlchemy()
migrate = Migrate()
compress = Compress()
# socketio = SocketIO(cors_allowed_origins="*")  # Permitir conexões do React Native

_app_start_time = time.time()  # Track server start time for uptime


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
        compress.init_app(app)  # Compressão Gzip automática para economizar egress
        # socketio.init_app(app)
        # CORS: supports_credentials=True não deve ser usado com origins='*'
        CORS(app, resources={r"/*": {"origins": "*"}})
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
        from app.routes.presentation_routes import presentation_bp
        from app.routes.settings_routes import settings_bp
        from app.routes.document_routes import document_bp
        from app.routes.socratic_routes import socratic_bp
        from app.routes.calendar_event_routes import calendar_event_bp
        from app.routes.course_routes import course_bp
        from app.routes.backoffice_auth_routes import backoffice_auth_bp
        from app.routes.backoffice_manage_routes import backoffice_manage_bp
        
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.register_blueprint(subject_bp, url_prefix='/api/subjects')
        app.register_blueprint(ai_bp, url_prefix='/api/ai')
        app.register_blueprint(notification_bp, url_prefix='/api/notifications')
        app.register_blueprint(admin_bp, url_prefix='/api/admin')
        app.register_blueprint(chat_bp, url_prefix='/api/chat')
        app.register_blueprint(enrollment_bp, url_prefix='/api/enrollments')
        app.register_blueprint(transcription_bp, url_prefix='/api/transcription')
        app.register_blueprint(presentation_bp, url_prefix='/api/presentation')
        app.register_blueprint(settings_bp, url_prefix='/api/settings')
        app.register_blueprint(document_bp, url_prefix='/api/documents')
        app.register_blueprint(socratic_bp, url_prefix='/api/socratic')
        app.register_blueprint(calendar_event_bp, url_prefix='/api/calendar-events')
        app.register_blueprint(course_bp, url_prefix='/api/courses')
        app.register_blueprint(backoffice_auth_bp, url_prefix='/api/backoffice/auth')
        app.register_blueprint(backoffice_manage_bp, url_prefix='/api/backoffice/manage')
        logger.info("Blueprints registrados com sucesso.")
    except Exception as e:
        logger.error(f"Erro ao registrar blueprints: {e}")

    # Registrar middleware de manutenção
    try:
        from app.middleware.maintenance_middleware import register_maintenance_middleware
        register_maintenance_middleware(app)
        logger.info("Middleware de manutenção registrado.")
    except Exception as e:
        logger.error(f"Erro ao registrar middleware de manutenção: {e}")
    
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
    @app.route('/api/health')
    def health_check():
        logger.info("Health check endpoint called")
        
        # Verificar Banco de Dados
        db_status = "offline"
        try:
            from sqlalchemy import text
            db.session.execute(text('SELECT 1'))
            db_status = "online"
        except Exception as e:
            logger.error(f"Health Check DB Error: {e}")
            db_status = "offline"

        # Verificar OpenAI API
        openai_status = "offline"
        try:
            api_key = os.getenv('OPENAI_API_KEY', '')
            if not api_key:
                openai_status = "no_key"
            elif not api_key.startswith('sk-'):
                openai_status = "invalid_key"
            else:
                import requests as http_requests
                check = http_requests.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': f'Bearer {api_key}'},
                    timeout=5
                )
                if check.status_code == 200:
                    openai_status = "online"
                elif check.status_code == 401:
                    openai_status = "unauthorized"
                else:
                    openai_status = "error"
        except Exception as e:
            logger.error(f"Health Check OpenAI Error: {e}")
            openai_status = "offline"

        # Calcular Uptime
        uptime_seconds = int(time.time() - _app_start_time)
        hours, remainder = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_str = f"{hours}h {minutes}m {seconds}s"

        overall = 'ok'
        if db_status != 'online' or openai_status not in ('online',):
            overall = 'degraded'
        if db_status != 'online' and openai_status not in ('online',):
            overall = 'critical'

        response = {
            'status': overall,
            'services': {
                'api': 'online',
                'database': db_status,
                'openai': openai_status
            },
            'uptime': uptime_str,
            'uptime_seconds': uptime_seconds,
            'version': '1.0.0'
        }
        
        return response, 200
    
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
