from flask import Blueprint
from app.controllers import subject_controller
from app.middleware.auth_middleware import token_required

# Criar blueprint
subject_bp = Blueprint('subject', __name__)

# Rotas protegidas (requerem autenticação)
@subject_bp.route('', methods=['GET'])
@token_required
def get_subjects(current_user):
    """GET /api/subjects - Listar disciplinas do usuário"""
    return subject_controller.get_user_subjects(current_user)

@subject_bp.route('/<int:subject_id>', methods=['GET'])
@token_required
def get_subject(current_user, subject_id):
    """GET /api/subjects/:id - Detalhes de uma disciplina"""
    return subject_controller.get_subject_details(current_user, subject_id)

@subject_bp.route('/<int:subject_id>/materials', methods=['GET'])
@token_required
def get_materials(current_user, subject_id):
    """GET /api/subjects/:id/materials - Materiais de uma disciplina"""
    return subject_controller.get_subject_materials(current_user, subject_id)

@subject_bp.route('/<int:subject_id>/activities', methods=['GET'])
@token_required
def get_activities(current_user, subject_id):
    """GET /api/subjects/:id/activities - Atividades de uma disciplina"""
    return subject_controller.get_subject_activities(current_user, subject_id)
