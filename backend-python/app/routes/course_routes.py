from flask import Blueprint, jsonify
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.middleware.auth_middleware import token_required

course_bp = Blueprint('courses', __name__)


@course_bp.route('/public', methods=['GET'])
def get_public_courses():
    """Retorna lista de cursos disponíveis (sem auth, para tela de cadastro)"""
    courses = Course.query.order_by(Course.name).all()
    return jsonify({
        'success': True,
        'courses': [c.to_dict() for c in courses]
    }), 200

@course_bp.route('/me', methods=['GET'])
@token_required
def get_my_courses(current_user):
    """Retorna os cursos nos quais o usuário logado está matriculado"""
    try:
        if current_user.role != 'student':
            return jsonify({'success': False, 'message': 'Apenas alunos possuem múltiplas matrículas de curso suportadas nesta visão'}), 403
            
        enrollments = CourseEnrollment.query.filter_by(user_id=current_user.id, status='active').all()
        
        return jsonify({
            'success': True,
            'courses': [e.to_dict() for e in enrollments]
        }), 200
    except Exception as e:
        import traceback
        print(f'Erro ao buscar cursos do usuário: {str(e)}')
        return jsonify({'success': False, 'message': 'Erro ao buscar cursos'}), 500
