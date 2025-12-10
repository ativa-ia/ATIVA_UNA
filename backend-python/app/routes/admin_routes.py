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

@admin_bp.route('/enroll-all-students', methods=['POST'])
@admin_required
def enroll_all_students(current_user):
    """
    Matricula TODOS os alunos em TODAS as disciplinas
    Perfeito para apresentações e testes
    """
    try:
        # Buscar todos os alunos
        all_students = User.query.filter_by(role='student').all()
        
        if not all_students:
            return jsonify({
                'success': False,
                'message': 'Nenhum aluno encontrado no sistema'
            }), 404
        
        # Buscar todas as disciplinas
        all_subjects = Subject.query.all()
        
        if not all_subjects:
            return jsonify({
                'success': False,
                'message': 'Nenhuma disciplina encontrada no sistema'
            }), 404
        
        # Buscar primeira turma disponível
        default_class = Class.query.first()
        
        if not default_class:
            return jsonify({
                'success': False,
                'message': 'Nenhuma turma disponível no sistema'
            }), 404
        
        # Matricular cada aluno em cada disciplina
        enrollments_created = 0
        enrollments_skipped = 0
        
        for student in all_students:
            for subject in all_subjects:
                # Verificar se já está matriculado
                existing = Enrollment.query.filter_by(
                    student_id=student.id,
                    subject_id=subject.id
                ).first()
                
                if not existing:
                    enrollment = Enrollment(
                        student_id=student.id,
                        subject_id=subject.id,
                        class_id=default_class.id
                    )
                    db.session.add(enrollment)
                    enrollments_created += 1
                else:
                    enrollments_skipped += 1
        
        # Commit todas as matrículas
        db.session.commit()
        
        print(f'✅ Matrícula em massa: {enrollments_created} matrículas criadas, {enrollments_skipped} já existiam')
        
        return jsonify({
            'success': True,
            'message': f'{enrollments_created} matrículas criadas com sucesso',
            'enrollments_created': enrollments_created,
            'enrollments_skipped': enrollments_skipped,
            'total_students': len(all_students),
            'total_subjects': len(all_subjects)
        }), 201
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f'❌ Erro em enroll_all_students: {str(e)}')
        print(f'Traceback: {error_details}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao criar matrículas em massa',
            'error': str(e)
        }), 500
