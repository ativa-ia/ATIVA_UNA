from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
from app.models.class_model import Class
from app.middleware.admin_middleware import admin_required

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user(current_user):
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    role = data.get('role') # 'student', 'teacher', 'admin'
    name = data.get('name')
    
    if not all([email, password, role, name]):
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
        
    if role not in ['student', 'teacher', 'admin']:
        return jsonify({'success': False, 'message': 'Role inválido'}), 400
        
    if User.find_by_email(email):
        return jsonify({'success': False, 'message': 'Email já cadastrado'}), 400
        
    try:
        new_user = User.create_user(email, password, role, name)
        return jsonify({
            'success': True, 
            'message': 'Usuário criado com sucesso',
            'user': new_user.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/subjects', methods=['POST'])
@admin_required
def create_subject(current_user):
    data = request.get_json()
    
    name = data.get('name')
    code = data.get('code')
    description = data.get('description', '')
    credits = data.get('credits', 4)
    
    if not all([name, code]):
        return jsonify({'success': False, 'message': 'Nome e código são obrigatórios'}), 400
        
    if Subject.query.filter_by(code=code).first():
        return jsonify({'success': False, 'message': 'Código de disciplina já existe'}), 400
        
    try:
        subject = Subject(name=name, code=code, description=description, credits=credits)
        db.session.add(subject)
        db.session.commit()
        return jsonify({
            'success': True, 
            'message': 'Disciplina criada com sucesso',
            'subject': subject.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/enroll', methods=['POST'])
@admin_required
def enroll_student(current_user):
    data = request.get_json()
    
    student_id = data.get('student_id')
    subject_id = data.get('subject_id')
    class_id = data.get('class_id', 1) # Default class 1 for now
    
    if not all([student_id, subject_id]):
        return jsonify({'success': False, 'message': 'IDs de aluno e disciplina obrigatórios'}), 400
        
    # Verify existence
    if not User.query.get(student_id):
        return jsonify({'success': False, 'message': 'Aluno não encontrado'}), 404
    if not Subject.query.get(subject_id):
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404
        
    # Check if already enrolled
    existing = Enrollment.query.filter_by(student_id=student_id, subject_id=subject_id).first()
    if existing:
        return jsonify({'success': False, 'message': 'Aluno já matriculado nesta disciplina'}), 400
        
    try:
        enrollment = Enrollment(student_id=student_id, subject_id=subject_id, class_id=class_id)
        db.session.add(enrollment)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Matrícula realizada com sucesso'}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/teach', methods=['POST'])
@admin_required
def assign_teacher(current_user):
    data = request.get_json()
    
    teacher_id = data.get('teacher_id')
    subject_id = data.get('subject_id')
    class_id = data.get('class_id', 1)
    
    if not all([teacher_id, subject_id]):
        return jsonify({'success': False, 'message': 'IDs de professor e disciplina obrigatórios'}), 400
        
    if not User.query.get(teacher_id):
        return jsonify({'success': False, 'message': 'Professor não encontrado'}), 404
    if not Subject.query.get(subject_id):
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404
        
    existing = Teaching.query.filter_by(teacher_id=teacher_id, subject_id=subject_id).first()
    if existing:
        return jsonify({'success': False, 'message': 'Professor já atribuído a esta disciplina'}), 400
        
    try:
        teaching = Teaching(teacher_id=teacher_id, subject_id=subject_id, class_id=class_id)
        db.session.add(teaching)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Professor atribuído com sucesso'}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users(current_user):
    users = User.query.all()
    return jsonify({
        'success': True,
        'users': [u.to_dict() for u in users]
    }), 200

@admin_bp.route('/subjects', methods=['GET'])
@admin_required
def list_subjects(current_user):
    subjects = Subject.query.all()
    return jsonify({
        'success': True,
        'subjects': [s.to_dict() for s in subjects]
    }), 200


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(current_user, user_id):
    """Deletar um usuário do sistema"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404
    
    if user.id == current_user.id:
        return jsonify({'success': False, 'message': 'Você não pode deletar a si mesmo'}), 400

    try:
        # Delete related enrollments and teachings first
        Enrollment.query.filter_by(student_id=user_id).delete()
        Teaching.query.filter_by(teacher_id=user_id).delete()
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Usuário "{user.name}" deletado com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/subjects/<int:subject_id>', methods=['DELETE'])
@admin_required
def delete_subject(current_user, subject_id):
    """Deletar uma disciplina do sistema"""
    subject = Subject.query.get(subject_id)
    if not subject:
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404

    try:
        # Delete related enrollments and teachings first
        Enrollment.query.filter_by(subject_id=subject_id).delete()
        Teaching.query.filter_by(subject_id=subject_id).delete()
        db.session.delete(subject)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Disciplina "{subject.name}" deletada com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/unenroll', methods=['DELETE'])
@admin_required
def unenroll_student(current_user):
    """Desmatricular um aluno de uma disciplina"""
    data = request.get_json()
    student_id = data.get('student_id')
    subject_id = data.get('subject_id')

    if not all([student_id, subject_id]):
        return jsonify({'success': False, 'message': 'IDs de aluno e disciplina obrigatórios'}), 400

    enrollment = Enrollment.query.filter_by(student_id=student_id, subject_id=subject_id).first()
    if not enrollment:
        return jsonify({'success': False, 'message': 'Matrícula não encontrada'}), 404

    try:
        db.session.delete(enrollment)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Aluno desmatriculado com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/unteach', methods=['DELETE'])
@admin_required
def remove_teacher(current_user):
    """Remover um professor de uma disciplina"""
    data = request.get_json()
    teacher_id = data.get('teacher_id')
    subject_id = data.get('subject_id')

    if not all([teacher_id, subject_id]):
        return jsonify({'success': False, 'message': 'IDs de professor e disciplina obrigatórios'}), 400

    teaching = Teaching.query.filter_by(teacher_id=teacher_id, subject_id=subject_id).first()
    if not teaching:
        return jsonify({'success': False, 'message': 'Atribuição não encontrada'}), 404

    try:
        db.session.delete(teaching)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Professor removido da disciplina com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/subjects/<int:subject_id>/enrollments', methods=['GET'])
@admin_required
def get_subject_enrollments(current_user, subject_id):
    """Listar alunos matriculados em uma disciplina"""
    subject = Subject.query.get(subject_id)
    if not subject:
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404

    enrollments = Enrollment.query.filter_by(subject_id=subject_id).all()
    students = []
    for e in enrollments:
        student = User.query.get(e.student_id)
        if student:
            students.append({'id': student.id, 'name': student.name, 'email': student.email})

    return jsonify({'success': True, 'students': students}), 200

@admin_bp.route('/subjects/<int:subject_id>/teachings', methods=['GET'])
@admin_required
def get_subject_teachings(current_user, subject_id):
    """Listar professores atribuídos a uma disciplina"""
    subject = Subject.query.get(subject_id)
    if not subject:
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404

    teachings = Teaching.query.filter_by(subject_id=subject_id).all()
    teachers = []
    for t in teachings:
        teacher = User.query.get(t.teacher_id)
        if teacher:
            teachers.append({'id': teacher.id, 'name': teacher.name, 'email': teacher.email})

    return jsonify({'success': True, 'teachers': teachers}), 200

