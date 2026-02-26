from flask import Blueprint, jsonify
from app.models.course import Course

course_bp = Blueprint('courses', __name__)


@course_bp.route('/public', methods=['GET'])
def get_public_courses():
    """Retorna lista de cursos disponíveis (sem auth, para tela de cadastro)"""
    courses = Course.query.order_by(Course.name).all()
    return jsonify({
        'success': True,
        'courses': [c.to_dict() for c in courses]
    }), 200
