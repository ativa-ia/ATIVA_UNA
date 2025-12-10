from flask import Blueprint
from app.middleware.auth_middleware import token_required
from app.controllers import performance_controller

performance_bp = Blueprint('performance', __name__)


# Professor - Lançar notas
@performance_bp.route('/grades', methods=['POST'])
@token_required
def register_grades(current_user):
    """Registrar notas AV1 ou AV2"""
    return performance_controller.register_grades(current_user)


# Professor - Desempenho da turma
@performance_bp.route('/class/<int:subject_id>', methods=['GET'])
@token_required
def get_class_performance(current_user, subject_id):
    """Obter desempenho geral da turma"""
    return performance_controller.get_class_performance(current_user, subject_id)


# Aluno - Todas as notas
@performance_bp.route('/student/grades', methods=['GET'])
@token_required
def get_student_grades_all(current_user):
    """Obter todas as notas do aluno"""
    return performance_controller.get_student_grades_all(current_user)


# Professor - Desempenho individual do aluno
@performance_bp.route('/student/<int:student_id>/subject/<int:subject_id>', methods=['GET'])
@token_required
def get_student_performance(current_user, student_id, subject_id):
    """Obter desempenho detalhado de um aluno em uma disciplina"""
    return performance_controller.get_student_performance(current_user, student_id, subject_id)
