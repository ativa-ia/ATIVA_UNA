from flask import request, jsonify
from marshmallow import ValidationError
from app.models.user import User
from app.utils.jwt_utils import generate_token
from app.schemas.user_schema import register_schema, login_schema, forgot_password_schema
from app import db


def register():
    """Cadastro de novo usuário"""
    try:
        # Validar dados de entrada
        data = register_schema.load(request.json)
        
        # Verificar se usuário já existe
        existing_user = User.find_by_email(data['email'])
        if existing_user:
            return jsonify({
                'success': False,
                'message': 'Email já cadastrado'
            }), 400
        
        # Criar usuário
        user = User.create_user(
            email=data['email'],
            password=data['password'],
            role=data['role'],
            name=data['name']
        )
        
        # Gerar token
        token = generate_token(user)
        
        return jsonify({
            'success': True,
            'message': 'Usuário cadastrado com sucesso',
            'user': user.to_dict(),
            'token': token
        }), 201
        
    except ValidationError as err:
        return jsonify({
            'success': False,
            'errors': err.messages
        }), 400
    except Exception as e:
        print(f'Erro no cadastro: {str(e)}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao cadastrar usuário'
        }), 500


def login():
    """Login de usuário"""
    try:
        # Validar dados de entrada
        data = login_schema.load(request.json)
        
        # Buscar usuário
        user = User.find_by_email(data['email'])
        if not user:
            return jsonify({
                'success': False,
                'message': 'Email ou senha incorretos'
            }), 401
        
        # Verificar senha
        if not user.verify_password(data['password']):
            return jsonify({
                'success': False,
                'message': 'Email ou senha incorretos'
            }), 401
        
        # Gerar token
        token = generate_token(user)
        
        return jsonify({
            'success': True,
            'message': 'Login realizado com sucesso',
            'user': user.to_dict(),
            'token': token
        }), 200
        
    except ValidationError as err:
        return jsonify({
            'success': False,
            'errors': err.messages
        }), 400
    except Exception as e:
        print(f'Erro no login: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Erro ao fazer login'
        }), 500


def get_me(current_user):
    """Obter dados do usuário autenticado"""
    try:
        return jsonify({
            'success': True,
            'user': current_user.to_dict()
        }), 200
    except Exception as e:
        print(f'Erro ao buscar usuário: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Erro ao buscar dados do usuário'
        }), 500


def forgot_password():
    """Recuperação de senha (simulado)"""
    try:
        # Validar dados de entrada
        data = forgot_password_schema.load(request.json)
        
        # Verificar se usuário existe
        user = User.find_by_email(data['email'])
        
        # Por segurança, não revelar se o email existe ou não
        if not user:
            return jsonify({
                'success': True,
                'message': 'Se o email estiver cadastrado, você receberá as instruções'
            }), 200
        
        # TODO: Implementar envio de email real
        print(f'📧 Email de recuperação seria enviado para: {data["email"]}')
        
        return jsonify({
            'success': True,
            'message': 'Instruções enviadas para o email'
        }), 200
        
    except ValidationError as err:
        return jsonify({
            'success': False,
            'errors': err.messages
        }), 400
    except Exception as e:
        print(f'Erro na recuperação de senha: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Erro ao processar recuperação de senha'
        }), 500
