import sys
import os

from app import create_app, db
from app.models.class_model import Class
from sqlalchemy import func

app = create_app()

with app.app_context():
    # Find class Teste
    cls = Class.query.filter_by(name="Teste").first()
    if not cls:
        print("Class not found!")
        sys.exit()
    
    class_id = cls.id
    print(f"Class ID: {class_id}")
    
    # Import the exact logic
    from app.models.subject import Subject
    from app.models.teaching import Teaching
    from app.models.enrollment import Enrollment
    from app.models.user import User

    # 1. Disciplinas da turma
    subjects = Subject.query.filter_by(class_id=class_id).all()
    
    # === O ERRO PODE ESTAR AQUI ===
    # Na minha linha original de código: 
    # subjects_dict = {
    #     s.id: {
    #         'id': s.id,
    #         ...
    # Essa forma estava errada? O type de s.id etc?
    subjects_dict = {
        s.id: {
            'id': s.id,
            'name': s.name,
            'description': s.description,
            'cover_base64': s.cover_base64
        }
        for s in subjects
    }
    
    print(f"Found {len(subjects)} subjects")
    subject_ids = list(subjects_dict.keys())
    
    print("Subject keys:", subject_ids)

    teachers_map = {}
    students_map = {}

    if subject_ids:
        # 2. Professores da turma
        teachings = (
            db.session.query(Teaching, User.name, User.email)
            .join(User, User.id == Teaching.teacher_id)
            .filter(Teaching.subject_id.in_(subject_ids))
            .all()
        )
        print(f"Found {len(teachings)} teachings")
        for t_obj, t_name, t_email in teachings:
            tid = t_obj.teacher_id
            if tid not in teachers_map:
                teachers_map[tid] = {
                    'id': tid,
                    'name': t_name,
                    'email': t_email,
                    'subjects': []
                }
            subj_data = subjects_dict.get(t_obj.subject_id)
            if subj_data:
                teachers_map[tid]['subjects'].append(subj_data)

        # 3. Alunos matriculados
        enrollments = (
            db.session.query(Enrollment, User.name, User.email)
            .join(User, User.id == Enrollment.student_id)
            .filter(Enrollment.subject_id.in_(subject_ids))
            .all()
        )
        print(f"Found {len(enrollments)} enrollments")
        for e_obj, s_name, s_email in enrollments:
            sid = e_obj.student_id
            if sid not in students_map:
                students_map[sid] = {
                    'id': sid,
                    'name': s_name,
                    'email': s_email,
                    'enrolled_subjects': []
                }
            subj_data = subjects_dict.get(e_obj.subject_id)
            if subj_data:
                students_map[sid]['enrolled_subjects'].append(subj_data)

    print("Students:", students_map)
    import json
    
    res = {
        'success': True,
        'class_id': class_id,
        'class_name': cls.name,
        'teachers': list(teachers_map.values()),
        'students': list(students_map.values())
    }
    try:
        json.dumps(res)
        print("JSON Serialization SUCCESS")
    except Exception as e:
        print(f"JSON Serialization FAILED: {e}")
