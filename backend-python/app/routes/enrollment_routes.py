from flask import Blueprint
from app.controllers import enrollment_controller
from app.middleware.auth_middleware import token_required

# Criar blueprint
enrollment_bp = Blueprint('enrollment', __name__)

# Rota de auto-matrícula
@enrollment_bp.route('/auto-enroll', methods=['POST'])
@token_required
def auto_enroll(current_user):
    """POST /api/enrollments/auto-enroll - Auto-matrícula de estudante"""
    return enrollment_controller.auto_enroll_student(current_user)
