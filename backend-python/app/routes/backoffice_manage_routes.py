"""
Rotas exclusivas de gestão da plataforma para Super Admins (Backoffice).
Prefixo: /api/backoffice/manage

Todas as rotas são protegidas por @super_admin_jwt_required (ADMIN_JWT_SECRET).
Tokens de alunos/professores são completamente inúteis aqui.
"""
from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User
from app.models.subject import Subject
from app.models.class_model import Class
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
from app.models.audit_log import AuditLog
from app.middleware.super_admin_middleware import super_admin_jwt_required

backoffice_manage_bp = Blueprint('backoffice_manage', __name__)


# ============================================================
# DASHBOARD / STATS
# ============================================================

@backoffice_manage_bp.route('/stats', methods=['GET'])
@super_admin_jwt_required
def get_platform_stats(current_admin):
    """Retorna estatísticas vitais da plataforma inteira para o Dashboard"""
    try:
        total_users = User.query.count()
        total_students = User.query.filter_by(role='student').count()
        total_teachers = User.query.filter_by(role='teacher').count()
        total_school_admins = User.query.filter_by(role='admin').count()

        total_subjects = Subject.query.count()
        total_enrollments = Enrollment.query.count()

        return jsonify({
            'success': True,
            'stats': {
                'users': {
                    'total': total_users,
                    'students': total_students,
                    'teachers': total_teachers,
                    'school_admins': total_school_admins
                },
                'academic': {
                    'subjects': total_subjects,
                    'enrollments': total_enrollments
                }
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/enroll-all-students', methods=['POST'])
@super_admin_jwt_required
def enroll_all_students(current_admin):
    """Matricula TODOS os alunos em TODAS as disciplinas (demos/testes)."""
    try:
        all_students = User.query.filter_by(role='student').all()
        if not all_students:
            return jsonify({'success': False, 'message': 'Nenhum aluno encontrado'}), 404

        all_subjects = Subject.query.all()
        if not all_subjects:
            return jsonify({'success': False, 'message': 'Nenhuma disciplina encontrada'}), 404

        default_class = Class.query.first()
        if not default_class:
            return jsonify({'success': False, 'message': 'Nenhuma turma disponível'}), 404

        created = 0
        skipped = 0
        for student in all_students:
            for subject in all_subjects:
                exists = Enrollment.query.filter_by(student_id=student.id, subject_id=subject.id).first()
                if not exists:
                    db.session.add(Enrollment(student_id=student.id, subject_id=subject.id, class_id=default_class.id))
                    created += 1
                else:
                    skipped += 1

        AuditLog.log_action(admin_user_id=str(current_admin.id), action='AUTO_ENROLL_ALL',
                            target_type='enrollments', new_data={'created': created, 'skipped': skipped})
        db.session.commit()

        return jsonify({'success': True, 'message': f'{created} matrículas criadas', 'enrollments_created': created, 'enrollments_skipped': skipped}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================
# PROFESSORES
# ============================================================

@backoffice_manage_bp.route('/teachers', methods=['GET'])
@super_admin_jwt_required
def list_teachers(current_admin):
    """Lista todos os professores do sistema (role=teacher) com status de aprovação."""
    teachers = User.query.filter_by(role='teacher').order_by(User.created_at.desc()).all()
    result = []
    for t in teachers:
        d = t.to_dict()
        # Quantidade de disciplinas atribuídas
        d['subjects_count'] = Teaching.query.filter_by(teacher_id=t.id).count()
        result.append(d)
    return jsonify({'success': True, 'teachers': result}), 200


@backoffice_manage_bp.route('/teachers/<int:teacher_id>/approve', methods=['PATCH'])
@super_admin_jwt_required
def approve_teacher(current_admin, teacher_id):
    """Aprovar um professor (ativa is_approved se existir, ou apenas confirma)."""
    teacher = User.query.get(teacher_id)
    if not teacher or teacher.role != 'teacher':
        return jsonify({'success': False, 'message': 'Professor não encontrado'}), 404

    # Se o modelo User tiver flag is_approved, setar aqui
    # Por enquanto, só registramos a ação na auditoria
    AuditLog.log_action(admin_user_id=str(current_admin.id), action='APPROVE_TEACHER',
                        target_type='users', target_id=str(teacher_id),
                        new_data={'name': teacher.name, 'email': teacher.email},
                        ip_address=request.remote_addr)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Professor "{teacher.name}" aprovado com sucesso'}), 200


@backoffice_manage_bp.route('/teachers/<int:teacher_id>', methods=['DELETE'])
@super_admin_jwt_required
def delete_teacher(current_admin, teacher_id):
    """Remove um professor e suas atribuições."""
    teacher = User.query.get(teacher_id)
    if not teacher or teacher.role != 'teacher':
        return jsonify({'success': False, 'message': 'Professor não encontrado'}), 404

    old_data = teacher.to_dict()
    try:
        Teaching.query.filter_by(teacher_id=teacher_id).delete()
        db.session.delete(teacher)
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='DELETE_TEACHER',
                            target_type='users', target_id=str(teacher_id), old_data=old_data,
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Professor "{old_data["name"]}" removido'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================
# AUDIT LOGS
# ============================================================

@backoffice_manage_bp.route('/audit-logs', methods=['GET'])
@super_admin_jwt_required
def list_audit_logs(current_admin):
    """Retorna o histórico de auditoria, do mais recente ao mais antigo."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    query = AuditLog.query.order_by(AuditLog.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    logs = []
    for log in pagination.items:
        logs.append(log.to_dict())

    return jsonify({
        'success': True,
        'logs': logs,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    }), 200


# ============================================================
# GESTÃO DE USUÁRIOS (CRUD completo para Super Admin)
# ============================================================

@backoffice_manage_bp.route('/users', methods=['GET'])
@super_admin_jwt_required
def list_all_users(current_admin):
    """Lista TODOS os usuários da tabela users (alunos, professores, admins escola)."""
    role_filter = request.args.get('role')
    query = User.query
    if role_filter:
        query = query.filter_by(role=role_filter)
    users = query.order_by(User.created_at.desc()).all()
    return jsonify({'success': True, 'users': [u.to_dict() for u in users]}), 200


@backoffice_manage_bp.route('/users', methods=['POST'])
@super_admin_jwt_required
def create_user(current_admin):
    """Criar qualquer tipo de usuário na plataforma."""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')
    name = data.get('name')

    if not all([email, password, role, name]):
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
    if User.find_by_email(email):
        return jsonify({'success': False, 'message': 'Email já cadastrado'}), 400

    try:
        new_user = User.create_user(email, password, role, name,
                                     registration_number=data.get('registration_number'),
                                     course_id=data.get('course_id'))
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='CREATE_USER',
                            target_type='users', target_id=str(new_user.id),
                            new_data=new_user.to_dict(), ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Usuário criado', 'user': new_user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/users/<int:user_id>', methods=['DELETE'])
@super_admin_jwt_required
def delete_user(current_admin, user_id):
    """Deletar um usuário, incluindo matrículas e atribuições."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404

    old_data = user.to_dict()
    try:
        Enrollment.query.filter_by(student_id=user_id).delete()
        Teaching.query.filter_by(teacher_id=user_id).delete()
        db.session.delete(user)
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='DELETE_USER',
                            target_type='users', target_id=str(user_id), old_data=old_data,
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Usuário "{old_data["name"]}" deletado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================
# GESTÃO DE DISCIPLINAS
# ============================================================

@backoffice_manage_bp.route('/subjects', methods=['GET'])
@super_admin_jwt_required
def list_all_subjects(current_admin):
    """Lista TODAS as disciplinas da plataforma."""
    subjects = Subject.query.order_by(Subject.name).all()
    return jsonify({'success': True, 'subjects': [s.to_dict() for s in subjects]}), 200


@backoffice_manage_bp.route('/subjects', methods=['POST'])
@super_admin_jwt_required
def create_subject(current_admin):
    """Criar uma nova disciplina."""
    data = request.get_json()
    name = data.get('name')
    code = data.get('code')

    if not all([name, code]):
        return jsonify({'success': False, 'message': 'Nome e código são obrigatórios'}), 400
    if Subject.query.filter_by(code=code).first():
        return jsonify({'success': False, 'message': 'Código já existe'}), 400

    try:
        subject = Subject(name=name, code=code, description=data.get('description', ''), credits=data.get('credits', 4))
        db.session.add(subject)
        db.session.flush()
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='CREATE_SUBJECT',
                            target_type='subjects', target_id=str(subject.id),
                            new_data=subject.to_dict(), ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Disciplina criada', 'subject': subject.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/subjects/<int:subject_id>', methods=['DELETE'])
@super_admin_jwt_required
def delete_subject(current_admin, subject_id):
    """Deletar uma disciplina e cascatear relacionamentos."""
    subject = Subject.query.get(subject_id)
    if not subject:
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404

    old_data = subject.to_dict()
    try:
        Enrollment.query.filter_by(subject_id=subject_id).delete()
        Teaching.query.filter_by(subject_id=subject_id).delete()
        db.session.delete(subject)
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='DELETE_SUBJECT',
                            target_type='subjects', target_id=str(subject_id), old_data=old_data,
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Disciplina "{old_data["name"]}" deletada'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/subjects/<int:subject_id>/enrollments', methods=['GET'])
@super_admin_jwt_required
def get_subject_enrollments(current_admin, subject_id):
    """Alunos matriculados em uma disciplina."""
    enrollments = Enrollment.query.filter_by(subject_id=subject_id).all()
    students = []
    for e in enrollments:
        student = User.query.get(e.student_id)
        if student:
            students.append({'id': student.id, 'name': student.name, 'email': student.email})
    return jsonify({'success': True, 'students': students}), 200


@backoffice_manage_bp.route('/subjects/<int:subject_id>/teachings', methods=['GET'])
@super_admin_jwt_required
def get_subject_teachings(current_admin, subject_id):
    """Professores atribuídos a uma disciplina."""
    teachings = Teaching.query.filter_by(subject_id=subject_id).all()
    teachers = []
    for t in teachings:
        teacher = User.query.get(t.teacher_id)
        if teacher:
            teachers.append({'id': teacher.id, 'name': teacher.name, 'email': teacher.email})
    return jsonify({'success': True, 'teachers': teachers}), 200


# ============================================================
# MATRÍCULA / ATRIBUIÇÃO INDIVIDUAL
# ============================================================

@backoffice_manage_bp.route('/enroll', methods=['POST'])
@super_admin_jwt_required
def enroll_student(current_admin):
    """Matricular um aluno em uma disciplina."""
    data = request.get_json()
    student_id = data.get('student_id')
    subject_id = data.get('subject_id')
    class_id = data.get('class_id', 1)

    if not all([student_id, subject_id]):
        return jsonify({'success': False, 'message': 'IDs de aluno e disciplina obrigatórios'}), 400
    if Enrollment.query.filter_by(student_id=student_id, subject_id=subject_id).first():
        return jsonify({'success': False, 'message': 'Aluno já matriculado nesta disciplina'}), 400

    try:
        enrollment = Enrollment(student_id=student_id, subject_id=subject_id, class_id=class_id)
        db.session.add(enrollment)
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='ENROLL_STUDENT',
                            target_type='enrollments', new_data={'student_id': student_id, 'subject_id': subject_id},
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Matrícula realizada'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/teach', methods=['POST'])
@super_admin_jwt_required
def assign_teacher(current_admin):
    """Atribuir um professor a uma disciplina."""
    data = request.get_json()
    teacher_id = data.get('teacher_id')
    subject_id = data.get('subject_id')
    class_id = data.get('class_id', 1)

    if not all([teacher_id, subject_id]):
        return jsonify({'success': False, 'message': 'IDs de professor e disciplina obrigatórios'}), 400
    if Teaching.query.filter_by(teacher_id=teacher_id, subject_id=subject_id).first():
        return jsonify({'success': False, 'message': 'Professor já atribuído a esta disciplina'}), 400

    try:
        teaching = Teaching(teacher_id=teacher_id, subject_id=subject_id, class_id=class_id)
        db.session.add(teaching)
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='ASSIGN_TEACHER',
                            target_type='teachings', new_data={'teacher_id': teacher_id, 'subject_id': subject_id},
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Professor atribuído'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/unenroll', methods=['DELETE'])
@super_admin_jwt_required
def unenroll_student(current_admin):
    """Desmatricular um aluno de uma disciplina."""
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
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='UNENROLL_STUDENT',
                            target_type='enrollments', old_data={'student_id': student_id, 'subject_id': subject_id},
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Aluno desmatriculado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@backoffice_manage_bp.route('/unteach', methods=['DELETE'])
@super_admin_jwt_required
def remove_teacher_assignment(current_admin):
    """Remover um professor de uma disciplina."""
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
        AuditLog.log_action(admin_user_id=str(current_admin.id), action='REMOVE_TEACHER',
                            target_type='teachings', old_data={'teacher_id': teacher_id, 'subject_id': subject_id},
                            ip_address=request.remote_addr)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Professor removido da disciplina'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
