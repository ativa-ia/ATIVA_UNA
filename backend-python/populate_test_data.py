"""
Script para popular o banco Supabase com dados de teste
"""
import os
from dotenv import load_dotenv
from app import create_app, db
from app.models import User, Subject, Course, Class, Enrollment, TranscriptionSession

load_dotenv()

app = create_app()

def populate_test_data():
    with app.app_context():
        print("=" * 60)
        print("POPULANDO BANCO SUPABASE COM DADOS DE TESTE")
        print("=" * 60)
        
        # 1. Criar Cursos
        print("\n📚 Criando cursos...")
        courses_data = [
            {"name": "Engenharia de Software", "code": "ENG-SW"},
            {"name": "Ciência da Computação", "code": "CC"},
            {"name": "Sistemas de Informação", "code": "SI"}
        ]
        
        courses = []
        for course_data in courses_data:
            existing = Course.query.filter_by(code=course_data['code']).first()
            if not existing:
                course = Course(**course_data)
                db.session.add(course)
                courses.append(course)
                print(f"  ✅ Criado: {course_data['name']}")
            else:
                courses.append(existing)
                print(f"  ⏭️  Já existe: {course_data['name']}")
        
        db.session.commit()
        
        # 2. Criar Turmas
        print("\n🎓 Criando turmas...")
        classes_data = [
            {"name": "Turma A - Manhã", "semester": "2024.1", "year": 2024, "course_id": courses[0].id},
            {"name": "Turma B - Tarde", "semester": "2024.1", "year": 2024, "course_id": courses[0].id},
            {"name": "Turma C - Noite", "semester": "2024.1", "year": 2024, "course_id": courses[1].id}
        ]
        
        classes = []
        for class_data in classes_data:
            existing = Class.query.filter_by(
                name=class_data['name'],
                semester=class_data['semester']
            ).first()
            if not existing:
                cls = Class(**class_data)
                db.session.add(cls)
                classes.append(cls)
                print(f"  ✅ Criada: {class_data['name']}")
            else:
                classes.append(existing)
                print(f"  ⏭️  Já existe: {class_data['name']}")
        
        db.session.commit()
        
        # 3. Criar Disciplinas (além da existente ID 10)
        print("\n📖 Criando disciplinas...")
        subjects_data = [
            {"name": "Programação Orientada a Objetos", "code": "POO-101"},
            {"name": "Estruturas de Dados", "code": "ED-102"},
            {"name": "Banco de Dados", "code": "BD-103"},
            {"name": "Engenharia de Software", "code": "ES-104"},
            {"name": "Redes de Computadores", "code": "RC-105"}
        ]
        
        subjects = []
        # Incluir a disciplina existente (ID 10)
        existing_subject = Subject.query.get(10)
        if existing_subject:
            subjects.append(existing_subject)
            print(f"  ⏭️  Mantendo: {existing_subject.name} (ID {existing_subject.id})")
        
        for subject_data in subjects_data:
            existing = Subject.query.filter_by(code=subject_data['code']).first()
            if not existing:
                subject = Subject(**subject_data)
                db.session.add(subject)
                subjects.append(subject)
                print(f"  ✅ Criada: {subject_data['name']}")
            else:
                subjects.append(existing)
                print(f"  ⏭️  Já existe: {subject_data['name']}")
        
        db.session.commit()
        
        # 4. Criar Professores de Teste
        print("\n👨‍🏫 Criando professores...")
        teachers_data = [
            {"name": "Prof. João Silva", "email": "joao.silva@test.com", "password": "123456"},
            {"name": "Prof. Maria Santos", "email": "maria.santos@test.com", "password": "123456"}
        ]
        
        teachers = []
        for teacher_data in teachers_data:
            existing = User.query.filter_by(email=teacher_data['email']).first()
            if not existing:
                teacher = User(
                    name=teacher_data['name'],
                    email=teacher_data['email'],
                    password='temp',
                    role='teacher'
                )
                teacher.set_password(teacher_data['password'])
                db.session.add(teacher)
                teachers.append(teacher)
                print(f"  ✅ Criado: {teacher_data['name']} ({teacher_data['email']})")
            else:
                teachers.append(existing)
                print(f"  ⏭️  Já existe: {teacher_data['name']}")
        
        db.session.commit()
        
        # 5. Criar Alunos de Teste (além dos existentes)
        print("\n👨‍🎓 Criando alunos de teste...")
        students_data = [
            {"name": "Aluno Teste 1", "email": "aluno1@test.com", "password": "123456", "class_id": classes[0].id},
            {"name": "Aluno Teste 2", "email": "aluno2@test.com", "password": "123456", "class_id": classes[0].id},
            {"name": "Aluno Teste 3", "email": "aluno3@test.com", "password": "123456", "class_id": classes[1].id},
            {"name": "Aluno Teste 4", "email": "aluno4@test.com", "password": "123456", "class_id": classes[1].id},
            {"name": "Aluno Teste 5", "email": "aluno5@test.com", "password": "123456", "class_id": classes[2].id}
        ]
        
        students = []
        student_class_map = {}  # Mapear student -> class_id
        for student_data in students_data:
            existing = User.query.filter_by(email=student_data['email']).first()
            if not existing:
                student = User(
                    name=student_data['name'],
                    email=student_data['email'],
                    password='temp',
                    role='student'
                )
                student.set_password(student_data['password'])
                db.session.add(student)
                students.append(student)
                student_class_map[student] = student_data['class_id']
                print(f"  ✅ Criado: {student_data['name']} ({student_data['email']})")
            else:
                students.append(existing)
                # Para alunos existentes, tentar pegar class_id de um enrollment existente
                existing_enrollment = Enrollment.query.filter_by(student_id=existing.id).first()
                if existing_enrollment:
                    student_class_map[existing] = existing_enrollment.class_id
                else:
                    student_class_map[existing] = classes[0].id  # Fallback
                print(f"  ⏭️  Já existe: {student_data['name']}")
        
        db.session.commit()
        
        # 6. Criar Matrículas (Enrollments)
        print("\n📝 Criando matrículas...")
        enrollment_count = 0
        
        # Matricular alunos de teste nas novas disciplinas
        for student in students:
            # Matricular em 2-3 disciplinas aleatórias
            import random
            num_subjects = random.randint(2, min(3, len(subjects)))
            selected_subjects = random.sample(subjects, num_subjects)
            
            for subject in selected_subjects:
                existing = Enrollment.query.filter_by(
                    student_id=student.id,
                    subject_id=subject.id
                ).first()
                
                if not existing:
                    enrollment = Enrollment(
                        student_id=student.id,
                        class_id=student_class_map.get(student, classes[0].id),
                        subject_id=subject.id
                    )
                    db.session.add(enrollment)
                    enrollment_count += 1
        
        db.session.commit()
        print(f"  ✅ Criadas {enrollment_count} novas matrículas")
        
        # 7. Criar Sessões de Transcrição de Teste
        print("\n🎙️  Criando sessões de transcrição...")
        if teachers:
            sessions_data = [
                {
                    "subject_id": subjects[0].id if len(subjects) > 0 else 10,
                    "teacher_id": teachers[0].id,
                    "title": "Aula sobre POO - Herança",
                    "status": "completed",
                    "full_transcript": "Esta é uma transcrição de teste sobre programação orientada a objetos, focando em herança e polimorfismo."
                },
                {
                    "subject_id": subjects[1].id if len(subjects) > 1 else 10,
                    "teacher_id": teachers[0].id,
                    "title": "Estruturas de Dados - Árvores",
                    "status": "completed",
                    "full_transcript": "Nesta aula discutimos árvores binárias, árvores AVL e suas aplicações práticas."
                }
            ]
            
            for session_data in sessions_data:
                session = TranscriptionSession(**session_data)
                db.session.add(session)
                print(f"  ✅ Criada: {session_data['title']}")
            
            db.session.commit()
        
        print("\n" + "=" * 60)
        print("✅ DADOS DE TESTE POPULADOS COM SUCESSO!")
        print("=" * 60)
        
        # Resumo
        print("\n📊 RESUMO:")
        print(f"  Cursos: {Course.query.count()}")
        print(f"  Turmas: {Class.query.count()}")
        print(f"  Disciplinas: {Subject.query.count()}")
        print(f"  Professores: {User.query.filter_by(role='teacher').count()}")
        print(f"  Alunos: {User.query.filter_by(role='student').count()}")
        print(f"  Matrículas: {Enrollment.query.count()}")
        print(f"  Sessões de Transcrição: {TranscriptionSession.query.count()}")
        
        print("\n🔑 CREDENCIAIS DE TESTE:")
        print("  Professor: joao.silva@test.com / 123456")
        print("  Professor: maria.santos@test.com / 123456")
        print("  Aluno: aluno1@test.com / 123456")
        print("  Aluno: aluno2@test.com / 123456")
        print("  (e assim por diante...)")
        print("\n")

if __name__ == '__main__':
    try:
        populate_test_data()
    except Exception as e:
        print(f"\n❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
