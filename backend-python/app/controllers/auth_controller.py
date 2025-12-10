from flask import request, jsonify
from marshmallow import ValidationError
from app.models.user import User
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
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
        
        # Auto-matrícula para estudantes
        if user.role == 'student':
            # Buscar todas as disciplinas disponíveis
            all_subjects = Subject.query.all()
            
            if all_subjects:
                # Buscar primeira turma disponível
                from app.models.class_model import Class
                default_class = Class.query.first()
                
                if default_class:
                    # Criar matrículas para cada disciplina
                    enrollments_created = 0
                    for subject in all_subjects:
                        enrollment = Enrollment(
                            student_id=user.id,
                            subject_id=subject.id,
                            class_id=default_class.id  # Usar primeira turma disponível
                        )
                        db.session.add(enrollment)
                        enrollments_created += 1
                    
                    print(f'✅ Auto-matrícula no registro: {enrollments_created} disciplinas para aluno {user.email}')
                else:
                    print(f'⚠️ Nenhuma turma disponível para auto-matrícula de {user.email}')
            else:
                print(f'⚠️ Nenhuma disciplina disponível para auto-matrícula de {user.email}')
        
        # Commit do usuário e matrículas
        db.session.commit()
        
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
        import traceback
        error_details = traceback.format_exc()
        print(f'Erro no cadastro: {str(e)}')
        print(f'Detalhes: {error_details}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao cadastrar usuário',
            'error_type': type(e).__name__,
            'error_detail': str(e)
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


def update_profile(current_user):
    """Atualizar perfil do usuário"""
    try:
        data = request.json
        
        # Atualizar nome se fornecido
        if 'name' in data and data['name']:
            current_user.name = data['name']
        
        # Atualizar email se fornecido
        if 'email' in data and data['email']:
            # Verificar se o novo email já está em uso
            if data['email'] != current_user.email:
                existing_user = User.find_by_email(data['email'])
                if existing_user:
                    return jsonify({
                        'success': False,
                        'message': 'Este email já está em uso'
                    }), 400
                current_user.email = data['email']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Perfil atualizado com sucesso',
            'user': current_user.to_dict()
        }), 200
        
    except Exception as e:
        print(f'Erro ao atualizar perfil: {str(e)}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao atualizar perfil'
        }), 500


def change_password(current_user):
    """Alterar senha do usuário"""
    try:
        data = request.json
        
        # Validar campos obrigatórios
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({
                'success': False,
                'message': 'Senha atual e nova senha são obrigatórias'
            }), 400
        
        # Verificar senha atual
        if not current_user.verify_password(data['current_password']):
            return jsonify({
                'success': False,
                'message': 'Senha atual incorreta'
            }), 401
        
        # Validar nova senha
        if len(data['new_password']) < 6:
            return jsonify({
                'success': False,
                'message': 'A nova senha deve ter no mínimo 6 caracteres'
            }), 400
        
        # Atualizar senha
        current_user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Senha alterada com sucesso'
        }), 200
        
    except Exception as e:
        print(f'Erro ao alterar senha: {str(e)}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao alterar senha'
        }), 500
