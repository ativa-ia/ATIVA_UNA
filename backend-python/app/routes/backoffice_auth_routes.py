"""
Rotas de autenticação exclusivas para Super Admins (Backoffice).
Prefixo: /api/backoffice/auth
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from app import db
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditLog
from app.utils.admin_jwt_utils import generate_admin_token
from app.middleware.super_admin_middleware import super_admin_jwt_required

backoffice_auth_bp = Blueprint('backoffice_auth', __name__)


@backoffice_auth_bp.route('/login', methods=['POST'])
def admin_login():
    """Login exclusivo para Super Admins.
    Valida credenciais contra a tabela admin_users e gera token com ADMIN_JWT_SECRET.
    """
    data = request.get_json()

    if not data:
        return jsonify({'success': False, 'message': 'Dados não fornecidos'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email e senha são obrigatórios'}), 400

    # Buscar na tabela admin_users (NÃO na tabela users)
    admin = AdminUser.find_by_email(email)

    if not admin:
        # Mensagem genérica para não revelar se o email existe
        return jsonify({'success': False, 'message': 'Credenciais inválidas'}), 401

    if not admin.is_active:
        return jsonify({'success': False, 'message': 'Conta desativada'}), 403

    if not admin.verify_password(password):
        return jsonify({'success': False, 'message': 'Credenciais inválidas'}), 401

    # Atualizar last_login_at
    admin.last_login_at = datetime.utcnow()

    # Registrar auditoria do login
    AuditLog.log_action(
        admin_user_id=admin.id,
        action='LOGIN',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )

    db.session.commit()

    # Gerar token com ADMIN_JWT_SECRET
    token = generate_admin_token(admin)

    return jsonify({
        'success': True,
        'message': 'Login administrativo realizado com sucesso',
        'token': token,
        'admin': admin.to_dict()
    }), 200


@backoffice_auth_bp.route('/me', methods=['GET'])
@super_admin_jwt_required
def admin_me(current_admin):
    """Retorna dados do admin autenticado"""
    return jsonify({
        'success': True,
        'admin': current_admin.to_dict()
    }), 200


@backoffice_auth_bp.route('/verify', methods=['GET'])
@super_admin_jwt_required
def verify_token(current_admin):
    """Verifica se o token admin ainda é válido (útil para o frontend checar sessão)"""
    return jsonify({
        'success': True,
        'valid': True,
        'admin': current_admin.to_dict()
    }), 200
