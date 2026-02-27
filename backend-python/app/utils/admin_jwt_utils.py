"""
JWT utilities exclusivas para Super Admins.
Usa uma chave secreta DIFERENTE (ADMIN_JWT_SECRET) da usada pelos alunos/professores.
Tokens de alunos não podem ser decodificados aqui e vice-versa.
"""
import jwt
import os
from datetime import datetime, timedelta
from flask import current_app


# Chave secreta exclusiva para tokens administrativos
def _get_admin_secret():
    return os.getenv('ADMIN_JWT_SECRET', 'CHANGE_ME_admin_super_secret_key_2026')


def generate_admin_token(admin_user):
    """Gerar JWT token exclusivo para admin.
    - Usa ADMIN_JWT_SECRET (diferente de JWT_SECRET dos alunos)
    - Expira em 12 horas (muito mais curto que tokens de alunos)
    - Inclui type='admin' para identificação extra
    """
    payload = {
        'id': str(admin_user.id),
        'email': admin_user.email,
        'type': 'admin',  # Marcador: este token é de admin
        'exp': datetime.utcnow() + timedelta(hours=12),
        'iat': datetime.utcnow()
    }

    token = jwt.encode(
        payload,
        _get_admin_secret(),
        algorithm='HS256'
    )

    return token


def decode_admin_token(token):
    """Decodificar token usando ADMIN_JWT_SECRET.
    Retorna None se inválido, expirado, ou se não for um token admin.
    """
    try:
        payload = jwt.decode(
            token,
            _get_admin_secret(),
            algorithms=['HS256']
        )

        # Verificação extra: garantir que é um token admin
        if payload.get('type') != 'admin':
            return None

        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
