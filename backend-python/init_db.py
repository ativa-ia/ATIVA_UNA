"""
Script para inicializar o banco de dados e popular com dados de teste
"""
from app import create_app, db
from app.models import (
    User, Course, Class, Subject, Enrollment, 
    Teaching, Material, Activity, Announcement
)
from datetime import datetime


def init_database():
    """Criar todas as tabelas"""
    print("Criando tabelas do banco de dados...")
    db.create_all()
    print("[OK] Tabelas criadas com sucesso!")


def seed_data():
    """Popular banco com dados de teste"""
    print("\nPopulando banco de dados com dados de teste...")
    
    # Limpar dados existentes (exceto usuários)
    Announcement.query.delete()
    Activity.query.delete()
    Material.query.delete()
    Teaching.query.delete()
    Enrollment.query.delete()
    Subject.query.delete()
    Class.query.delete()
    Course.query.delete()
    
    # 1. Criar Cursos
    print("Criando cursos...")
    curso_cc = Course(
        name="Ciência da Computação",
        code="CC",
        description="Bacharelado em Ciência da Computação"
    )
    curso_si = Course(
        name="Sistemas de Informação",
        code="SI",
        description="Bacharelado em Sistemas de Informação"
    )
    db.session.add_all([curso_cc, curso_si])
    db.session.commit()
    
    # 2. Criar Turmas
    print("Criando turmas...")
    turma_cc_2024 = Class(
        course_id=curso_cc.id,
        name="CC 2024.1",
        semester="2024.1",
        year=2024
    )
    turma_si_2024 = Class(
        course_id=curso_si.id,
        name="SI 2024.1",
        semester="2024.1",
        year=2024
    )
    db.session.add_all([turma_cc_2024, turma_si_2024])
    db.session.commit()
    
    # 3. Criar Disciplinas
    print("Criando disciplinas...")
    disciplinas = [
        Subject(
            name="Cálculo I",
            code="MAT101",
            description="Fundamentos de Cálculo Diferencial e Integral",
            credits=4,
            image_url="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400"
        ),
        Subject(
            name="Algoritmos Avançados",
            code="CC201",
            description="Estruturas de Dados e Algoritmos Avançados",
            credits=4,
            image_url="https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400"
        ),
        Subject(
            name="Engenharia de Software",
            code="CC301",
            description="Metodologias e Práticas de Engenharia de Software",
            credits=4,
            image_url="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400"
        ),
        Subject(
            name="Redes de Computadores",
            code="CC302",
            description="Fundamentos de Redes e Protocolos",
            credits=4,
            image_url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400"
        ),
    ]
    db.session.add_all(disciplinas)
    db.session.commit()
    
    # 4. Buscar ou criar usuários de teste
    print("Verificando usuários de teste...")
    
    # Professor
    professor = User.find_by_email("professor@test.com")
    if not professor:
        professor = User.create_user(
            email="professor@test.com",
            password="senha123",
            role="teacher",
            name="Prof. Dr. Arnaldo Silva"
        )
        print("[OK] Professor criado")
    
    # Aluno
    aluno = User.find_by_email("aluno@test.com")
    if not aluno:
        aluno = User.create_user(
            email="aluno@test.com",
            password="senha123",
            role="student",
            name="João Silva"
        )
        print("[OK] Aluno criado")
    
    # 5. Criar Teachings (Professor leciona disciplinas)
    print("Criando vínculos professor-disciplina...")
    teachings = [
        Teaching(
            teacher_id=professor.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[0].id,  # Cálculo I
            schedule="Terças e Quintas, 10:00 - 12:00",
            location="Sala B-204"
        ),
        Teaching(
            teacher_id=professor.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[1].id,  # Algoritmos Avançados
            schedule="Segundas e Quartas, 14:00 - 16:00",
            location="Lab A-101"
        ),
        Teaching(
            teacher_id=professor.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[2].id,  # Engenharia de Software
            schedule="Terças e Quintas, 08:00 - 10:00",
            location="Sala C-305"
        ),
        Teaching(
            teacher_id=professor.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[3].id,  # Redes de Computadores
            schedule="Sextas, 10:00 - 14:00",
            location="Lab B-202"
        ),
    ]
    db.session.add_all(teachings)
    db.session.commit()
    
    # 6. Criar Enrollments (Aluno matriculado nas disciplinas)
    print("Criando matrículas do aluno...")
    enrollments = [
        Enrollment(
            student_id=aluno.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[0].id  # Cálculo I
        ),
        Enrollment(
            student_id=aluno.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[1].id  # Algoritmos Avançados
        ),
        Enrollment(
            student_id=aluno.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[2].id  # Engenharia de Software
        ),
        Enrollment(
            student_id=aluno.id,
            class_id=turma_cc_2024.id,
            subject_id=disciplinas[3].id  # Redes de Computadores
        ),
    ]
    db.session.add_all(enrollments)
    db.session.commit()
    
    # 7. Criar Materiais
    print("Criando materiais de aula...")
    materials = [
        # Cálculo I
        Material(
            subject_id=disciplinas[0].id,
            title="Slides - Introdução ao Cálculo",
            type="pdf",
            url="https://example.com/calculo-intro.pdf",
            size="2.5 MB",
            uploaded_by=professor.id
        ),
        Material(
            subject_id=disciplinas[0].id,
            title="Vídeo Aula - Derivadas",
            type="video",
            url="https://example.com/derivadas.mp4",
            uploaded_by=professor.id
        ),
        Material(
            subject_id=disciplinas[0].id,
            title="Lista de Exercícios 01",
            type="pdf",
            url="https://example.com/lista01.pdf",
            size="1.8 MB",
            uploaded_by=professor.id
        ),
        # Algoritmos Avançados
        Material(
            subject_id=disciplinas[1].id,
            title="Apostila - Estruturas de Dados",
            type="pdf",
            url="https://example.com/estruturas.pdf",
            size="5.2 MB",
            uploaded_by=professor.id
        ),
        Material(
            subject_id=disciplinas[1].id,
            title="Link - Documentação Python",
            type="link",
            url="https://docs.python.org",
            uploaded_by=professor.id
        ),
        # Engenharia de Software
        Material(
            subject_id=disciplinas[2].id,
            title="Slides - Metodologias Ágeis",
            type="pdf",
            url="https://example.com/agile.pdf",
            size="3.1 MB",
            uploaded_by=professor.id
        ),
        # Redes de Computadores
        Material(
            subject_id=disciplinas[3].id,
            title="Apostila - Protocolos de Rede",
            type="pdf",
            url="https://example.com/protocolos.pdf",
            size="4.7 MB",
            uploaded_by=professor.id
        ),
    ]
    db.session.add_all(materials)
    db.session.commit()
    
    # 8. Criar Atividades
    print("Criando atividades...")
    activities = [
        Activity(
            subject_id=disciplinas[2].id,  # Engenharia de Software
            title="Entrega do Projeto Final",
            description="Desenvolvimento de um sistema completo usando metodologias ágeis",
            type="assignment",
            due_date="em 3 dias",
            created_by=professor.id
        ),
        Activity(
            subject_id=disciplinas[0].id,  # Cálculo I
            title="Prova P2",
            description="Avaliação sobre derivadas e integrais",
            type="quiz",
            due_date="em 5 dias",
            created_by=professor.id
        ),
    ]
    db.session.add_all(activities)
    db.session.commit()
    
    print("\n[OK] Banco de dados populado com sucesso!")
    print(f"\nResumo:")
    print(f"  - {len([curso_cc, curso_si])} cursos")
    print(f"  - {len([turma_cc_2024, turma_si_2024])} turmas")
    print(f"  - {len(disciplinas)} disciplinas")
    print(f"  - {len(teachings)} vinculos professor-disciplina")
    print(f"  - {len(enrollments)} matriculas")
    print(f"  - {len(materials)} materiais")
    print(f"  - {len(activities)} atividades")
    print(f"\nUsuarios de teste:")
    print(f"  - Professor: professor@test.com / senha123")
    print(f"  - Aluno: aluno@test.com / senha123")


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        init_database()
        seed_data()
        print("\n[CONCLUIDO] Processo concluido!")
