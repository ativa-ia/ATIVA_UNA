"""
Middleware exclusivo para rotas do Super Admin (Backoffice).
Usa ADMIN_JWT_SECRET para decodificar tokens - tokens de alunos/professores são rejeitados automaticamente.
"""
from functools import wraps
from flask import request, jsonify
from app.utils.admin_jwt_utils import decode_admin_token
from app.models.admin_user import AdminUser


def super_admin_jwt_required(f):
    """Decorador que protege rotas do backoffice.
    
    - Decodifica o token usando ADMIN_JWT_SECRET (não JWT_SECRET de alunos)
    - Valida que o admin existe e está ativo na tabela admin_users
    - Injeta o objeto AdminUser como primeiro argumento da rota
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Permitir OPTIONS (CORS preflight)
        if request.method == 'OPTIONS':
            return jsonify({'success': True}), 200

        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({
                'success': False,
                'message': 'Token não fornecido'
            }), 401

        # Formato: "Bearer TOKEN"
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({
                'success': False,
                'message': 'Formato de token inválido'
            }), 401

        # Decodificar com ADMIN_JWT_SECRET
        payload = decode_admin_token(token)

        if payload is None:
            return jsonify({
                'success': False,
                'message': 'Token administrativo inválido ou expirado'
            }), 401

        # Buscar admin na tabela exclusiva admin_users
        admin_user = AdminUser.find_by_id(payload['id'])

        if not admin_user:
            return jsonify({
                'success': False,
                'message': 'Administrador não encontrado'
            }), 401

        if not admin_user.is_active:
            return jsonify({
                'success': False,
                'message': 'Conta administrativa desativada'
            }), 403

        # Passar AdminUser para a rota
        return f(admin_user, *args, **kwargs)

    return decorated
