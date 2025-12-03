from flask import Blueprint
from app.controllers import auth_controller
from app.middleware.auth_middleware import token_required

# Criar blueprint
auth_bp = Blueprint('auth', __name__)

# Rotas públicas
auth_bp.route('/register', methods=['POST'])(auth_controller.register)
auth_bp.route('/login', methods=['POST'])(auth_controller.login)
auth_bp.route('/forgot-password', methods=['POST'])(auth_controller.forgot_password)

# Rotas protegidas (requerem autenticação)
auth_bp.route('/me', methods=['GET'])(token_required(auth_controller.get_me))
