import json
import os
import re
import requests
from flask import request, jsonify
from marshmallow import ValidationError
from app.models.user import User
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
from app.models.system_setting import SystemSetting
from app.utils.jwt_utils import generate_token
from app.schemas.user_schema import register_schema, login_schema, forgot_password_schema
from app import db


def _send_support_email(from_user, subject: str, message: str):
    """Envia email de suporte via Resend API. Retorna (ok, error_message)."""
    resend_api_key = (os.getenv('RESEND_API_KEY') or '').strip().strip('"').strip("'")
    support_to = (os.getenv('SUPPORT_EMAIL_TO', 'suporte1ativa@gmail.com') or '').strip().strip('"').strip("'")
    support_from = (os.getenv('SUPPORT_EMAIL_FROM', 'onboarding@resend.dev') or '').strip().strip('"').strip("'")

    if not resend_api_key:
        return False, 'Configuração de email indisponível no servidor (RESEND_API_KEY ausente)'

    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, support_from):
        return False, 'SUPPORT_EMAIL_FROM inválido. Use apenas um email, ex: onboarding@resend.dev'

    if not re.match(email_regex, support_to):
        return False, 'SUPPORT_EMAIL_TO inválido. Use apenas um email de destino'

    email_subject = f'[ATIVA IA][SUPORTE] {subject.strip()}'
    email_text = (
        f'Nova solicitação de suporte enviada pelo app.\n\n'
        f'Usuário ID: {from_user.id}\n'
        f'Nome: {from_user.name}\n'
        f'Email: {from_user.email}\n'
        f'Papel: {from_user.role}\n\n'
        f'Mensagem:\n{message.strip()}\n'
    )

    payload = {
        'from': support_from,
        'to': [support_to],
        'subject': email_subject,
        'text': email_text,
        'reply_to': from_user.email,
    }

    try:
        response = requests.post(
            'https://api.resend.com/emails',
            headers={
                'Authorization': f'Bearer {resend_api_key}',
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=20,
        )

        if response.status_code >= 400:
            print(f'Erro Resend [{response.status_code}]: {response.text}')
            try:
                error_json = response.json()
                resend_message = error_json.get('message') or error_json.get('error') or response.text
            except Exception:
                resend_message = response.text

            return False, f'Erro Resend ({response.status_code}): {resend_message}'

        return True, None
    except Exception as e:
        print(f'Erro ao enviar email de suporte: {str(e)}')
        return False, 'Não foi possível enviar o suporte no momento'


def _perform_auto_enrollment(user):
    """Lógica compartilhada de auto-matrícula.
    Consulta as configurações ENABLE_AUTO_ENROLLMENT e AUTO_ENROLLMENT_SUBJECTS
    antes de matricular o aluno.
    Retorna a quantidade de matrículas criadas (não faz commit).
    """
    # Verificar se auto-matrícula está habilitada
    enable_setting = SystemSetting.query.get('ENABLE_AUTO_ENROLLMENT')
    if enable_setting and enable_setting.value.lower() == 'false':
        print(f'ℹ️ Auto-matrícula desabilitada para {user.email}')
        return 0

    # Verificar quais disciplinas matricular
    subjects_setting = SystemSetting.query.get('AUTO_ENROLLMENT_SUBJECTS')
    
    if subjects_setting and subjects_setting.value and subjects_setting.value != 'all':
        try:
            subject_ids = json.loads(subjects_setting.value)
            if isinstance(subject_ids, list) and len(subject_ids) > 0:
                subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all()
            else:
                subjects = Subject.query.all()
        except (json.JSONDecodeError, TypeError):
            subjects = Subject.query.all()
    else:
        subjects = Subject.query.all()

    if not subjects:
        print(f'⚠️ Nenhuma disciplina disponível para auto-matrícula de {user.email}')
        return 0

    from app.models.class_model import Class
    default_class = Class.query.first()

    if not default_class:
        print(f'⚠️ Nenhuma turma disponível para auto-matrícula de {user.email}')
        return 0

    enrollments_created = 0
    for subject in subjects:
        # Evitar duplicatas
        existing = Enrollment.query.filter_by(
            student_id=user.id, subject_id=subject.id
        ).first()
        if not existing:
            enrollment = Enrollment(
                student_id=user.id,
                subject_id=subject.id,
                class_id=default_class.id
            )
            db.session.add(enrollment)
            enrollments_created += 1

    if enrollments_created > 0:
        print(f'✅ Auto-matrícula: {enrollments_created} disciplinas para {user.email}')
    
    return enrollments_created


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
            role=data.get('role', 'student'),
            name=data['name'],
            registration_number=data.get('registration_number'),
            course_id=data.get('course_id')
        )
        
        # Auto-matrícula para estudantes (consulta configurações)
        if user.role == 'student':
            _perform_auto_enrollment(user)
        
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


def quick_access():
    """Acesso rápido sem senha - para apresentação
    
    Aceita apenas nome e email:
    - Se email existe: faz login automático
    - Se email não existe: cria conta student com senha padrão
    """
    try:
        data = request.json
        
        # Validar campos obrigatórios
        if not data.get('email'):
            return jsonify({
                'success': False,
                'message': 'Email é obrigatório'
            }), 400
        
        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': 'Nome é obrigatório'
            }), 400
        
        email = data['email'].strip().lower()
        name = data['name'].strip()
        
        # Validar formato de email
        import re
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, email):
            return jsonify({
                'success': False,
                'message': 'Email inválido'
            }), 400
        
        # Verificar se usuário já existe
        existing_user = User.find_by_email(email)
        
        if existing_user:
            # Usuário existe - fazer login automático
            print(f'✅ Quick Access - Login automático: {email}')
            token = generate_token(existing_user)
            
            return jsonify({
                'success': True,
                'message': 'Acesso realizado com sucesso',
                'user': existing_user.to_dict(),
                'token': token,
                'is_new_user': False
            }), 200
        
        else:
            # Usuário não existe - criar conta student com senha padrão
            print(f'✅ Quick Access - Criando novo aluno: {email}')
            
            # Senha padrão para acesso rápido
            default_password = 'ativaai2024'
            
            # Criar usuário
            user = User.create_user(
                email=email,
                password=default_password,
                role='student',
                name=name
            )
            
            # Auto-matrícula (consulta configurações)
            _perform_auto_enrollment(user)
            
            # Commit
            db.session.commit()
            
            # Gerar token
            token = generate_token(user)
            
            return jsonify({
                'success': True,
                'message': 'Conta criada e acesso realizado com sucesso',
                'user': user.to_dict(),
                'token': token,
                'is_new_user': True
            }), 201
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f'❌ Erro no quick access: {str(e)}')
        print(f'Detalhes: {error_details}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao processar acesso',
            'error_detail': str(e)
        }), 500


def send_support_message(current_user):
    """Recebe mensagem de suporte do app e envia por email sem app externo."""
    try:
        data = request.json or {}
        subject = (data.get('subject') or '').strip()
        message = (data.get('message') or '').strip()

        if not subject:
            return jsonify({
                'success': False,
                'message': 'Assunto é obrigatório'
            }), 400

        if not message:
            return jsonify({
                'success': False,
                'message': 'Mensagem é obrigatória'
            }), 400

        if len(subject) > 120:
            return jsonify({
                'success': False,
                'message': 'Assunto muito longo (máximo 120 caracteres)'
            }), 400

        if len(message) > 4000:
            return jsonify({
                'success': False,
                'message': 'Mensagem muito longa (máximo 4000 caracteres)'
            }), 400

        ok, error_message = _send_support_email(current_user, subject, message)
        if not ok:
            return jsonify({
                'success': False,
                'message': error_message or 'Erro ao enviar suporte'
            }), 500

        return jsonify({
            'success': True,
            'message': 'Mensagem enviada para suporte com sucesso'
        }), 200

    except Exception as e:
        print(f'Erro no envio de suporte: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Erro ao processar solicitação de suporte'
        }), 500
