"""
Script para popular o banco de dados com dados realistas.
Executa diretamente no Supabase via conexão remota.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models.user import User
from app.models.subject import Subject
from app.models.course import Course
from app.models.class_model import Class
from app.models.teaching import Teaching
from app.models.enrollment import Enrollment
from app.models.material import Material
from app.models.activity import Activity
from app.models.notification import Notification

def seed_database():
    print("🌱 Iniciando seed do banco de dados...")
    
    os.environ['FLASK_ENV'] = 'production'
    app = create_app('production')
    
    with app.app_context():
        # ========== 1. USUÁRIOS ==========
        print("\n👤 Criando usuários...")
        
        users_data = [
            # Admin
            {"email": "admin@assistente360.com", "password": "admin123", "role": "admin", "name": "Administrador"},
            # Professores
            {"email": "maria.silva@edu.br", "password": "prof123", "role": "teacher", "name": "Profª Maria Silva"},
            {"email": "joao.santos@edu.br", "password": "prof123", "role": "teacher", "name": "Prof. João Santos"},
            {"email": "ana.costa@edu.br", "password": "prof123", "role": "teacher", "name": "Profª Ana Costa"},
            {"email": "carlos.lima@edu.br", "password": "prof123", "role": "teacher", "name": "Prof. Carlos Lima"},
            # Alunos
            {"email": "lucas.aluno@edu.br", "password": "aluno123", "role": "student", "name": "Lucas Oliveira"},
            {"email": "julia.aluno@edu.br", "password": "aluno123", "role": "student", "name": "Julia Mendes"},
            {"email": "pedro.aluno@edu.br", "password": "aluno123", "role": "student", "name": "Pedro Henrique"},
            {"email": "maria.aluno@edu.br", "password": "aluno123", "role": "student", "name": "Maria Clara"},
            {"email": "rafael.aluno@edu.br", "password": "aluno123", "role": "student", "name": "Rafael Costa"},
        ]
        
        created_users = {}
        for u in users_data:
            existing = User.find_by_email(u["email"])
            if not existing:
                user = User.create_user(u["email"], u["password"], u["role"], u["name"])
                created_users[u["email"]] = user
                print(f"  ✅ {u['role']}: {u['name']}")
            else:
                created_users[u["email"]] = existing
                print(f"  ⏭️ Já existe: {u['name']}")
        
        # ========== 2. CURSOS ==========
        print("\n🎓 Criando cursos...")
        
        courses_data = [
            {"name": "Ciência da Computação", "code": "CC"},
            {"name": "Engenharia de Software", "code": "ES"},
            {"name": "Sistemas de Informação", "code": "SI"},
        ]
        
        created_courses = {}
        for c in courses_data:
            existing = Course.query.filter_by(code=c["code"]).first()
            if not existing:
                course = Course(name=c["name"], code=c["code"])
                db.session.add(course)
                db.session.commit()
                created_courses[c["code"]] = course
                print(f"  ✅ {c['name']}")
            else:
                created_courses[c["code"]] = existing
                print(f"  ⏭️ Já existe: {c['name']}")
        
        # ========== 3. TURMAS ==========
        print("\n📚 Criando turmas...")
        
        classes_data = [
            {"course_code": "CC", "name": "CC-2024.2", "semester": "2024.2", "year": 2024},
            {"course_code": "ES", "name": "ES-2024.2", "semester": "2024.2", "year": 2024},
            {"course_code": "SI", "name": "SI-2024.2", "semester": "2024.2", "year": 2024},
        ]
        
        created_classes = {}
        for cl in classes_data:
            existing = Class.query.filter_by(name=cl["name"]).first()
            if not existing:
                class_obj = Class(
                    course_id=created_courses[cl["course_code"]].id,
                    name=cl["name"],
                    semester=cl["semester"],
                    year=cl["year"]
                )
                db.session.add(class_obj)
                db.session.commit()
                created_classes[cl["name"]] = class_obj
                print(f"  ✅ {cl['name']}")
            else:
                created_classes[cl["name"]] = existing
                print(f"  ⏭️ Já existe: {cl['name']}")
        
        # ========== 4. DISCIPLINAS ==========
        print("\n📖 Criando disciplinas...")
        
        subjects_data = [
            {"name": "Programação I", "code": "PROG1", "description": "Fundamentos de programação com Python", "credits": 4},
            {"name": "Cálculo I", "code": "CALC1", "description": "Limites, derivadas e integrais", "credits": 4},
            {"name": "Banco de Dados I", "code": "BD1", "description": "Modelagem e SQL", "credits": 4},
            {"name": "Algoritmos e Estruturas de Dados", "code": "AED", "description": "Listas, filas, pilhas e árvores", "credits": 4},
            {"name": "Programação Orientada a Objetos", "code": "POO", "description": "Classes, herança e polimorfismo", "credits": 4},
            {"name": "Desenvolvimento Web", "code": "WEB", "description": "HTML, CSS, JavaScript e React", "credits": 4},
            {"name": "Inteligência Artificial", "code": "IA", "description": "Machine Learning e Deep Learning", "credits": 4},
            {"name": "Redes de Computadores", "code": "REDES", "description": "Protocolos TCP/IP e arquiteturas", "credits": 4},
        ]
        
        created_subjects = {}
        for s in subjects_data:
            existing = Subject.query.filter_by(code=s["code"]).first()
            if not existing:
                subject = Subject(name=s["name"], code=s["code"], description=s["description"], credits=s["credits"])
                db.session.add(subject)
                db.session.commit()
                created_subjects[s["code"]] = subject
                print(f"  ✅ {s['name']}")
            else:
                created_subjects[s["code"]] = existing
                print(f"  ⏭️ Já existe: {s['name']}")
        
        # ========== 5. ATRIBUIR PROFESSORES (TEACHING) ==========
        print("\n👨‍🏫 Atribuindo professores às disciplinas...")
        
        # Prof. Maria Silva -> PROG1, POO (Área de Programação)
        # Prof. João Santos -> CALC1, AED (Área de Matemática/Lógica)
        # Profª Ana Costa -> BD1, WEB (Área de Dados/Web)
        # Prof. Carlos Lima -> IA, REDES (Área de IA/Infra)
        
        teachings_data = [
            {"teacher_email": "maria.silva@edu.br", "subject_code": "PROG1"},
            {"teacher_email": "maria.silva@edu.br", "subject_code": "POO"},
            {"teacher_email": "joao.santos@edu.br", "subject_code": "CALC1"},
            {"teacher_email": "joao.santos@edu.br", "subject_code": "AED"},
            {"teacher_email": "ana.costa@edu.br", "subject_code": "BD1"},
            {"teacher_email": "ana.costa@edu.br", "subject_code": "WEB"},
            {"teacher_email": "carlos.lima@edu.br", "subject_code": "IA"},
            {"teacher_email": "carlos.lima@edu.br", "subject_code": "REDES"},
        ]
        
        default_class = created_classes.get("CC-2024.2") or list(created_classes.values())[0]
        
        for t in teachings_data:
            teacher = created_users.get(t["teacher_email"])
            subject = created_subjects.get(t["subject_code"])
            if teacher and subject:
                existing = Teaching.query.filter_by(teacher_id=teacher.id, subject_id=subject.id).first()
                if not existing:
                    teaching = Teaching(teacher_id=teacher.id, subject_id=subject.id, class_id=default_class.id)
                    db.session.add(teaching)
                    db.session.commit()
                    print(f"  ✅ {teacher.name} -> {subject.name}")
                else:
                    print(f"  ⏭️ Já existe: {teacher.name} -> {subject.name}")
        
        # ========== 6. MATRICULAR ALUNOS (ENROLLMENT) ==========
        print("\n🎓 Matriculando alunos...")
        
        # Lucas: PROG1, CALC1, AED (Foco em fundamentos)
        # Julia: POO, BD1, WEB (Foco em desenvolvimento)
        # Pedro: PROG1, POO, IA (Foco em programação/IA)
        # Maria: CALC1, BD1, REDES (Foco em dados/infra)
        # Rafael: AED, WEB, IA, REDES (Mix avançado)
        
        enrollments_data = [
            {"student_email": "lucas.aluno@edu.br", "subjects": ["PROG1", "CALC1", "AED"]},
            {"student_email": "julia.aluno@edu.br", "subjects": ["POO", "BD1", "WEB"]},
            {"student_email": "pedro.aluno@edu.br", "subjects": ["PROG1", "POO", "IA"]},
            {"student_email": "maria.aluno@edu.br", "subjects": ["CALC1", "BD1", "REDES"]},
            {"student_email": "rafael.aluno@edu.br", "subjects": ["AED", "WEB", "IA", "REDES"]},
        ]
        
        for e in enrollments_data:
            student = created_users.get(e["student_email"])
            if student:
                for subj_code in e["subjects"]:
                    subject = created_subjects.get(subj_code)
                    if subject:
                        existing = Enrollment.query.filter_by(student_id=student.id, subject_id=subject.id).first()
                        if not existing:
                            enrollment = Enrollment(student_id=student.id, subject_id=subject.id, class_id=default_class.id)
                            db.session.add(enrollment)
                            db.session.commit()
                            print(f"  ✅ {student.name} -> {subject.name}")
                        else:
                            print(f"  ⏭️ Já existe: {student.name} -> {subject.name}")
        
        # ========== 7. MATERIAIS ==========
        print("\n📄 Criando materiais...")
        
        admin = created_users.get("admin@assistente360.com")
        
        materials_data = [
            {"subject_code": "PROG1", "title": "Apostila Python Básico", "type": "pdf", "size": "2.5 MB"},
            {"subject_code": "PROG1", "title": "Vídeo-aula: Estruturas de Controle", "type": "video", "size": "45 min"},
            {"subject_code": "CALC1", "title": "Lista de Exercícios - Limites", "type": "pdf", "size": "1.2 MB"},
            {"subject_code": "BD1", "title": "Slides: Modelagem ER", "type": "pdf", "size": "3.1 MB"},
            {"subject_code": "BD1", "title": "Tutorial SQL", "type": "link", "size": "Web"},
            {"subject_code": "POO", "title": "e-Book: Design Patterns", "type": "pdf", "size": "5.0 MB"},
            {"subject_code": "WEB", "title": "Curso React Completo", "type": "video", "size": "10h"},
            {"subject_code": "IA", "title": "Introdução ao Machine Learning", "type": "pdf", "size": "4.2 MB"},
        ]
        
        for m in materials_data:
            subject = created_subjects.get(m["subject_code"])
            if subject and admin:
                existing = Material.query.filter_by(title=m["title"], subject_id=subject.id).first()
                if not existing:
                    material = Material(
                        subject_id=subject.id,
                        title=m["title"],
                        type=m["type"],
                        size=m["size"],
                        uploaded_by=admin.id
                    )
                    db.session.add(material)
                    db.session.commit()
                    print(f"  ✅ {m['title']}")
                else:
                    print(f"  ⏭️ Já existe: {m['title']}")
        
        # ========== 8. ATIVIDADES ==========
        print("\n📝 Criando atividades...")
        
        activities_data = [
            {"subject_code": "PROG1", "title": "Lista 1 - Variáveis e Operadores", "type": "assignment", "due_date": "em 7 dias"},
            {"subject_code": "PROG1", "title": "Quiz - Estruturas de Repetição", "type": "quiz", "due_date": "em 3 dias"},
            {"subject_code": "CALC1", "title": "Prova 1 - Limites e Derivadas", "type": "assignment", "due_date": "em 14 dias"},
            {"subject_code": "BD1", "title": "Projeto: Modelagem de BD", "type": "assignment", "due_date": "em 10 dias"},
            {"subject_code": "POO", "title": "Trabalho - Sistema de Cadastro", "type": "assignment", "due_date": "em 21 dias"},
            {"subject_code": "WEB", "title": "Mini-projeto: Landing Page", "type": "assignment", "due_date": "em 5 dias"},
            {"subject_code": "IA", "title": "Exercício - Regressão Linear", "type": "assignment", "due_date": "em 7 dias"},
            {"subject_code": "REDES", "title": "Quiz - Modelo OSI", "type": "quiz", "due_date": "em 2 dias"},
        ]
        
        for a in activities_data:
            subject = created_subjects.get(a["subject_code"])
            if subject and admin:
                existing = Activity.query.filter_by(title=a["title"], subject_id=subject.id).first()
                if not existing:
                    activity = Activity(
                        subject_id=subject.id,
                        title=a["title"],
                        type=a["type"],
                        due_date=a["due_date"],
                        created_by=admin.id
                    )
                    db.session.add(activity)
                    db.session.commit()
                    print(f"  ✅ {a['title']}")
                else:
                    print(f"  ⏭️ Já existe: {a['title']}")
        
        print("\n" + "="*50)
        print("🎉 SEED CONCLUÍDO COM SUCESSO!")
        print("="*50)
        print("\n📊 RESUMO:")
        print(f"  - Usuários: {User.query.count()}")
        print(f"  - Cursos: {Course.query.count()}")
        print(f"  - Turmas: {Class.query.count()}")
        print(f"  - Disciplinas: {Subject.query.count()}")
        print(f"  - Teachings: {Teaching.query.count()}")
        print(f"  - Matrículas: {Enrollment.query.count()}")
        print(f"  - Materiais: {Material.query.count()}")
        print(f"  - Atividades: {Activity.query.count()}")
        
        print("\n🔐 CREDENCIAIS DE TESTE:")
        print("  Admin: admin@assistente360.com / admin123")
        print("  Professor: maria.silva@edu.br / prof123")
        print("  Aluno: lucas.aluno@edu.br / aluno123")

if __name__ == "__main__":
    seed_database()
