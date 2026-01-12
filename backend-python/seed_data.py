
import sys
import os
sys.path.append(os.getcwd())

from app import create_app, db
from app.models.course import Course
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.user import User

app = create_app()

with app.app_context():
    print("🌱 Iniciando seed do banco de dados...")

    # 1. Criar Curso Padrão
    course = Course.query.first()
    if not course:
        print("Criando curso padrão...")
        course = Course(
            name="Engenharia de Software",
            code="ES_2024",
            description="Bacharelado em Engenharia de Software"
        )
        db.session.add(course)
        db.session.commit()
    print(f"✅ Curso: {course.name} (ID: {course.id})")

    # 2. Criar Turma Padrão
    default_class = Class.query.first()
    if not default_class:
        print("Criando turma padrão...")
        default_class = Class(
            course_id=course.id,
            name="Turma 2024.1",
            semester="2024.1",
            year=2024
        )
        db.session.add(default_class)
        db.session.commit()
    print(f"✅ Turma: {default_class.name} (ID: {default_class.id})")

    # 3. Criar Disciplinas Básicas
    subjects_data = [
        {"name": "Programação Web", "code": "WEB01", "credits": 4},
        {"name": "Banco de Dados", "code": "BD01", "credits": 4},
        {"name": "Inteligência Artificial", "code": "IA01", "credits": 4}
    ]

    for s_data in subjects_data:
        subject = Subject.query.filter_by(code=s_data['code']).first()
        if not subject:
            print(f"Criando disciplina {s_data['name']}...")
            subject = Subject(**s_data)
            db.session.add(subject)
    
    db.session.commit()
    print("✅ Disciplinas verificadas/criadas.")

    print("\n🎉 Seed concluído com sucesso!")
