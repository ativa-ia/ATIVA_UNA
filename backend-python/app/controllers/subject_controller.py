from flask import jsonify, request
from app.models import Subject, Enrollment, Teaching, Material, Activity, User, ClassSubject, Class
from app import db


def get_user_subjects(current_user):
    """
    Buscar ofertas de disciplinas do usuário logado
    - Se aluno: retorna ofertas em que está matriculado
    - Se professor: retorna ofertas que leciona
    Retorna dados da oferta (ClassSubject) com info do Subject de catálogo
    """
    try:
        course_id = request.args.get('course_id', type=int)

        if current_user.role == 'student':
            enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()
            cs_ids = [e.class_subject_id for e in enrollments]
            query = ClassSubject.query.filter(ClassSubject.id.in_(cs_ids)) if cs_ids else None

        elif current_user.role == 'teacher':
            teachings = Teaching.query.filter_by(teacher_id=current_user.id).all()
            cs_ids = [t.class_subject_id for t in teachings]
            query = ClassSubject.query.filter(ClassSubject.id.in_(cs_ids)) if cs_ids else None
        else:
            return jsonify({'error': 'Invalid user role'}), 400

        # Aplicar filtro por curso caso tenha sido eviado
        if query and course_id:
            query = query.join(Class).filter(Class.course_id == course_id)
            
        class_subjects = query.all() if query else []

        subjects_data = []
        for cs in class_subjects:
            subject = cs.subject
            s_dict = subject.to_dict()
            # Adicionar class_subject_id para o frontend usar nas chamadas
            s_dict['class_subject_id'] = cs.id
            s_dict['subject_id'] = subject.id  # retrocompat
            
            # Adicionar dados da turma
            if cs.class_id:
                cls = Class.query.get(cs.class_id)
                if cls:
                    s_dict['class_id'] = cls.id
                    s_dict['class_name'] = cls.name
                    s_dict['class_year'] = cls.year
                    s_dict['class_semester'] = cls.semester

            # Buscar professor responsável
            teaching = Teaching.query.filter_by(class_subject_id=cs.id).first()
            if teaching:
                teacher = User.query.get(teaching.teacher_id)
                s_dict['professor'] = teacher.name if teacher else 'Professor'
            else:
                s_dict['professor'] = 'Professor'

            subjects_data.append(s_dict)

        return jsonify(subjects_data), 200

    except Exception as e:
        import traceback
        print(f"Error em get_user_subjects: {str(e)}")
        print(f'Traceback: {traceback.format_exc()}')
        return jsonify({'error': str(e)}), 500


def get_subject_details(current_user, subject_id):
    """
    Buscar detalhes de uma disciplina/oferta.
    subject_id aqui funciona tanto como class_subject_id quanto subject_id para retrocompat.
    """
    try:
        # Tentar primeiro como class_subject_id
        cs = ClassSubject.query.get(subject_id)
        if cs:
            subject = cs.subject
            class_subject_id = cs.id
        else:
            # Fallback: buscar como subject_id do catálogo
            subject = Subject.query.get(subject_id)
            if not subject:
                return jsonify({'error': 'Subject not found'}), 404
            # Encontrar primeiro ClassSubject associado ao user
            if current_user.role == 'student':
                enrollment = Enrollment.query.join(ClassSubject).filter(
                    Enrollment.student_id == current_user.id,
                    ClassSubject.subject_id == subject_id
                ).first()
                class_subject_id = enrollment.class_subject_id if enrollment else None
            elif current_user.role == 'teacher':
                teaching = Teaching.query.join(ClassSubject).filter(
                    Teaching.teacher_id == current_user.id,
                    ClassSubject.subject_id == subject_id
                ).first()
                class_subject_id = teaching.class_subject_id if teaching else None
            else:
                class_subject_id = None

        # Verificar acesso
        if current_user.role == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                class_subject_id=class_subject_id
            ).first() if class_subject_id else None
            if not enrollment:
                return jsonify({'error': 'Access denied'}), 403

        elif current_user.role == 'teacher':
            teaching = Teaching.query.filter_by(
                teacher_id=current_user.id,
                class_subject_id=class_subject_id
            ).first() if class_subject_id else None
            if not teaching:
                return jsonify({'error': 'Access denied'}), 403

        # Buscar teaching
        teaching = Teaching.query.filter_by(class_subject_id=class_subject_id).first() if class_subject_id else None

        # Montar resposta
        subject_data = subject.to_dict()
        subject_data['class_subject_id'] = class_subject_id

        if teaching:
            teacher = User.query.get(teaching.teacher_id)
            subject_data['professor'] = teacher.name if teacher else None
            subject_data['schedule'] = teaching.schedule
            subject_data['location'] = teaching.location

            pending_activities = Activity.query.filter_by(class_subject_id=class_subject_id).count() if class_subject_id else 0
            subject_data['pending_activities'] = pending_activities

        return jsonify(subject_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_subject_materials(current_user, subject_id):
    """Buscar materiais de uma oferta de disciplina"""
    try:
        # Interpretar como class_subject_id
        cs = ClassSubject.query.get(subject_id)
        class_subject_id = cs.id if cs else subject_id
        subject = cs.subject if cs else Subject.query.get(subject_id)

        if not subject:
            return jsonify({'error': 'Subject not found'}), 404

        # Verificar acesso
        if current_user.role == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id, class_subject_id=class_subject_id
            ).first()
            if not enrollment:
                return jsonify({'error': 'Access denied'}), 403
        elif current_user.role == 'teacher':
            teaching = Teaching.query.filter_by(
                teacher_id=current_user.id, class_subject_id=class_subject_id
            ).first()
            if not teaching:
                return jsonify({'error': 'Access denied'}), 403

        materials = Material.query.filter_by(class_subject_id=class_subject_id).order_by(Material.uploaded_at.desc()).all()

        materials_data = []
        for material in materials:
            material_dict = material.to_dict()
            material_dict['subject'] = subject.name
            if material.uploaded_at:
                material_dict['upload_date'] = material.uploaded_at.strftime('%d %b')
            materials_data.append(material_dict)

        return jsonify(materials_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_subject_activities(current_user, subject_id):
    """Buscar atividades de uma oferta de disciplina"""
    try:
        cs = ClassSubject.query.get(subject_id)
        class_subject_id = cs.id if cs else subject_id
        subject = cs.subject if cs else Subject.query.get(subject_id)

        if not subject:
            return jsonify({'error': 'Subject not found'}), 404

        if current_user.role == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id, class_subject_id=class_subject_id
            ).first()
            if not enrollment:
                return jsonify({'error': 'Access denied'}), 403
        elif current_user.role == 'teacher':
            teaching = Teaching.query.filter_by(
                teacher_id=current_user.id, class_subject_id=class_subject_id
            ).first()
            if not teaching:
                return jsonify({'error': 'Access denied'}), 403

        activities = Activity.query.filter_by(class_subject_id=class_subject_id).order_by(Activity.created_at.desc()).all()

        activities_data = []
        for activity in activities:
            activity_dict = activity.to_dict()
            activity_dict['subject'] = subject.name
            activities_data.append(activity_dict)

        return jsonify(activities_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_student_materials(current_user):
    """Buscar todos os materiais do aluno logado"""
    from app.models.study_material import StudyMaterial

    if current_user.role != 'student':
        return jsonify({'error': 'Apenas alunos podem acessar seus materiais'}), 403

    try:
        # Buscar class_subject_ids do aluno
        enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()
        cs_ids = [e.class_subject_id for e in enrollments]

        general_materials = Material.query.filter(Material.class_subject_id.in_(cs_ids)).all() if cs_ids else []

        personal_materials = StudyMaterial.query.filter_by(student_id=current_user.id).order_by(StudyMaterial.created_at.desc()).all()

        all_materials = []

        for m in general_materials:
            m_dict = m.to_dict()
            cs = ClassSubject.query.get(m.class_subject_id)
            m_dict['subject'] = cs.subject.name if cs and cs.subject else 'Disciplina'
            m_dict['source'] = 'class'
            m_dict['size'] = m_dict.get('file_size')
            if m.uploaded_at:
                m_dict['uploadDate'] = m.uploaded_at.strftime('%d %b')
            all_materials.append(m_dict)

        for m in personal_materials:
            m_dict = m.to_dict()
            cs = ClassSubject.query.get(m.class_subject_id)
            m_dict['subject'] = cs.subject.name if cs and cs.subject else 'Disciplina'
            m_dict['source'] = 'personal'
            m_dict['size'] = m_dict.get('file_size')
            m_dict['url'] = m_dict.get('content_url')
            if m.created_at:
                m_dict['uploadDate'] = m.created_at.strftime('%d %b')
            all_materials.append(m_dict)

        all_materials.sort(key=lambda x: x.get('id', 0), reverse=True)

        return jsonify(all_materials), 200

    except Exception as e:
        print(f"Erro ao buscar materiais do aluno: {e}")
        return jsonify({'error': str(e)}), 500


def upload_material(current_user, subject_id):
    """Upload de material de suporte pelo professor"""
    from datetime import datetime
    try:
        if current_user.role != 'teacher':
            return jsonify({'error': 'Apenas professores podem enviar materiais'}), 403

        # subject_id pode ser class_subject_id
        class_subject_id = subject_id
        teaching = Teaching.query.filter_by(
            teacher_id=current_user.id,
            class_subject_id=class_subject_id
        ).first()

        if not teaching:
            return jsonify({'error': 'Você não leciona esta disciplina'}), 403

        data = request.get_json() or {}

        title = data.get('title')
        url = data.get('url')
        material_type = data.get('type', 'document')
        size = data.get('size')

        if not title or not url:
            return jsonify({'error': 'Título e URL são obrigatórios'}), 400

        material = Material(
            class_subject_id=class_subject_id,
            title=title,
            type=material_type,
            url=url,
            size=size,
            uploaded_by=current_user.id
        )

        db.session.add(material)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Material enviado com sucesso',
            'material': material.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
