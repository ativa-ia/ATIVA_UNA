from flask import request, jsonify
import logging

logger = logging.getLogger(__name__)

# Rotas que NUNCA serão bloqueadas pelo modo manutenção
_WHITELISTED_PREFIXES = (
    '/api/backoffice',   # Painel administrativo – acesso garantido
    '/api/settings',     # Configurações – admin precisa gerenciar durante manutenção
    '/api/auth',         # Login / registro – necessário para acessar o backoffice
    '/api/health',       # Health check
    '/health',
    '/debug',
)


def maintenance_check():
    """
    Verificação de manutenção executada antes de cada requisição.
    Retorna 503 se MAINTENANCE_MODE == 'true' e a rota não for whitelist.
    """
    # Ignorar rotas do backoffice e health‑check
    if any(request.path.startswith(prefix) for prefix in _WHITELISTED_PREFIXES):
        return None  # continua normalmente

    # IMPORTANTÍSSIMO: Nunca bloquear requisições OPTIONS (CORS preflight).
    # Se o preflight receber 503, o navegador/React Native bloqueia a requisição inteira
    # e acusa "Network Error", impedindo o app de ler o JSON {"maintenance": true}
    if request.method == 'OPTIONS':
        return None

    try:
        from app.models.system_setting import SystemSetting
        from app import db
        # Força o SQLAlchemy a recarregar as entidades da sessão do banco de dados, ignorando o cache longo da request
        db.session.expire_all()
        
        setting = SystemSetting.query.get('MAINTENANCE_MODE')
        
        if setting and setting.value.strip().lower() == 'true':
            response = jsonify({
                'success': False,
                'maintenance': True,
                'message': 'O sistema está temporariamente em manutenção. Tente novamente em breve.',
            })
            response.status_code = 503
            # Adiciona cabeçalhos de CORS explicitamente porque requisições barradas no before_request
            # às vezes não recebem os cabeçalhos automáticos do Flask-CORS.
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
            return response
    except Exception as e:
        # Em caso de erro ao consultar o banco, não bloqueamos o acesso
        logger.warning(f'[MaintenanceMiddleware] Falha ao verificar modo manutenção: {e}')

    return None  # continua normalmente


def register_maintenance_middleware(app):
    """Registra o middleware de manutenção no app Flask."""
    app.before_request(maintenance_check)
