from flask import jsonify, request
from app.models import Subject, Enrollment, Teaching, Material, Activity, User
from app import db


def get_user_subjects(current_user):
    """
    Buscar disciplinas do usuário logado
    - Se aluno: retorna disciplinas em que está matriculado
    - Se professor: retorna disciplinas que leciona
    """
    try:
        if current_user.role == 'student':
            # Buscar matrículas do aluno
            enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()
            subject_ids = [e.subject_id for e in enrollments]
            subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all() if subject_ids else []
            
        elif current_user.role == 'teacher':
            # Buscar disciplinas que o professor leciona
            teachings = Teaching.query.filter_by(teacher_id=current_user.id).all()
            subject_ids = [t.subject_id for t in teachings]
            subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all()
        else:
            return jsonify({'error': 'Invalid user role'}), 400
        
        # Converter para dicionário e adicionar professor
        subjects_data = []
        for subject in subjects:
            s_dict = subject.to_dict()
            # Buscar professor responsável
            teaching = Teaching.query.filter_by(subject_id=subject.id).first()
            if teaching:
                teacher = User.query.get(teaching.teacher_id)
                s_dict['professor'] = teacher.name if teacher else 'Professor'
            else:
                s_dict['professor'] = 'Professor'
            
            subjects_data.append(s_dict)
        
        return jsonify(subjects_data), 200
        
    except Exception as e:
        import traceback
        print(f'❌ Erro em get_user_subjects: {str(e)}')
        print(f'Traceback: {traceback.format_exc()}')
        return jsonify({'error': str(e)}), 500



def get_subject_details(current_user, subject_id):
    """
    Buscar detalhes completos de uma disciplina
    Inclui: nome, código, professor, horário, local
    """
    try:
        # Verificar se o subject existe
        subject = Subject.query.get(subject_id)
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Verificar se o usuário tem acesso a esta disciplina
        if current_user.role == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                subject_id=subject_id
            ).first()
            if not enrollment:
                return jsonify({'error': 'Access denied'}), 403
                
        elif current_user.role == 'teacher':
            teaching = Teaching.query.filter_by(
                teacher_id=current_user.id,
                subject_id=subject_id
            ).first()
            if not teaching:
                return jsonify({'error': 'Access denied'}), 403
        
        # Buscar informações do teaching (professor, horário, local)
        teaching = Teaching.query.filter_by(subject_id=subject_id).first()
        
        # Montar resposta
        subject_data = subject.to_dict()
        
        if teaching:
            teacher = User.query.get(teaching.teacher_id)
            subject_data['professor'] = teacher.name if teacher else None
            subject_data['schedule'] = teaching.schedule
            subject_data['location'] = teaching.location
            
            # Contar atividades pendentes
            pending_activities = Activity.query.filter_by(subject_id=subject_id).count()
            subject_data['pending_activities'] = pending_activities
        
        return jsonify(subject_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_subject_materials(current_user, subject_id):
    """
    Buscar materiais de uma disciplina
    """
    try:
        # Verificar se o subject existe
        subject = Subject.query.get(subject_id)
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Verificar se o usuário tem acesso
        if current_user.role == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                subject_id=subject_id
            ).first()
            if not enrollment:
                return jsonify({'error': 'Access denied'}), 403
                
        elif current_user.role == 'teacher':
            teaching = Teaching.query.filter_by(
                teacher_id=current_user.id,
                subject_id=subject_id
            ).first()
            if not teaching:
                return jsonify({'error': 'Access denied'}), 403
        
        # Buscar materiais
        materials = Material.query.filter_by(subject_id=subject_id).order_by(Material.uploaded_at.desc()).all()
        
        # Converter para dicionário e adicionar nome da disciplina
        materials_data = []
        for material in materials:
            material_dict = material.to_dict()
            material_dict['subject'] = subject.name
            # Formatar data de upload
            if material.uploaded_at:
                material_dict['upload_date'] = material.uploaded_at.strftime('%d %b')
            materials_data.append(material_dict)
        
        return jsonify(materials_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_subject_activities(current_user, subject_id):
    """
    Buscar atividades de uma disciplina
    """
    try:
        # Verificar se o subject existe
        subject = Subject.query.get(subject_id)
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Verificar se o usuário tem acesso
        if current_user.role == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                subject_id=subject_id
            ).first()
            if not enrollment:
                return jsonify({'error': 'Access denied'}), 403
                
        elif current_user.role == 'teacher':
            teaching = Teaching.query.filter_by(
                teacher_id=current_user.id,
                subject_id=subject_id
            ).first()
            if not teaching:
                return jsonify({'error': 'Access denied'}), 403
        
        # Buscar atividades
        activities = Activity.query.filter_by(subject_id=subject_id).order_by(Activity.created_at.desc()).all()
        
        # Converter para dicionário e adicionar nome da disciplina
        activities_data = []
        for activity in activities:
            activity_dict = activity.to_dict()
            activity_dict['subject'] = subject.name
            activities_data.append(activity_dict)
        
        return jsonify(activities_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_student_materials(current_user):
    """
    Buscar todos os materiais do aluno logado (inclusive StudyMaterial distribuídos automaticamente)
    """
    from app.models.study_material import StudyMaterial
    
    if current_user.role != 'student':
        return jsonify({'error': 'Apenas alunos podem acessar seus materiais'}), 403
        
    try:
        # 1. Buscar materiais gerais das disciplinas matriculadas (Material)
        enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()
        subject_ids = [e.subject_id for e in enrollments]
        
        general_materials = Material.query.filter(Material.subject_id.in_(subject_ids)).all() if subject_ids else []
        
        # 2. Buscar materiais distribuídos especificamente (StudyMaterial)
        personal_materials = StudyMaterial.query.filter_by(student_id=current_user.id).order_by(StudyMaterial.created_at.desc()).all()
        
        # Combinar e formatar
        all_materials = []
        
        # Adicionar materiais gerais
        for m in general_materials:
            m_dict = m.to_dict()
            subject = Subject.query.get(m.subject_id)
            m_dict['subject'] = subject.name if subject else 'Disciplina'
            m_dict['source'] = 'class' # Material da turma
            if m.uploaded_at:
                m_dict['upload_date'] = m.uploaded_at.strftime('%d %b')
            all_materials.append(m_dict)
            
        # Adicionar materiais pessoais
        for m in personal_materials:
            m_dict = m.to_dict()
            subject = Subject.query.get(m.subject_id)
            m_dict['subject'] = subject.name if subject else 'Disciplina'
            m_dict['source'] = 'personal' # Material pessoal/reforço
            if m.created_at:
                m_dict['upload_date'] = m.created_at.strftime('%d %b')
            all_materials.append(m_dict)
            
        # Ordenar por data (mais recente primeiro)
        # Note: upload_date format '15 Nov' is hard to sort, so we trust database order or sort client side.
        # But for merged lists, we might want to sort by ID or raw date if available.
        # Simple sorting by ID desc as proxy for proper date sorting across tables
        all_materials.sort(key=lambda x: x.get('id', 0), reverse=True)
            
        return jsonify(all_materials), 200
        
    except Exception as e:
        print(f"Erro ao buscar materiais do aluno: {e}")
        return jsonify({'error': str(e)}), 500
