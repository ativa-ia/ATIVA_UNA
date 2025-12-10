"""
Script para popular o banco com notas de teste
Gera notas realistas para AV1 e AV2
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.grade import Grade
from app.models.user import User
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
import random


def generate_realistic_grade():
    """Gera nota realista com distribuição normal"""
    # 70% entre 6.0-9.0 (maioria dos alunos)
    # 20% entre 3.0-6.0 (alunos com dificuldade)
    # 10% entre 9.0-10.0 (alunos excelentes)
    rand = random.random()
    if rand < 0.7:
        return round(random.uniform(6.0, 9.0), 1)
    elif rand < 0.9:
        return round(random.uniform(3.0, 6.0), 1)
    else:
        return round(random.uniform(9.0, 10.0), 1)


def seed_grades():
    """Popular banco com notas de teste"""
    app = create_app()
    with app.app_context():
        print("🌱 Iniciando seed de notas...")
        
        # Buscar todos os professores
        teachers = User.query.filter_by(role='teacher').all()
        if not teachers:
            print("❌ Nenhum professor encontrado!")
            return
        
        teacher = teachers[0]  # Usar primeiro professor
        print(f"👨‍🏫 Usando professor: {teacher.name} (ID: {teacher.id})")
        
        # Buscar disciplinas que o professor leciona
        teachings = Teaching.query.filter_by(teacher_id=teacher.id).all()
        if not teachings:
            print("❌ Professor não leciona nenhuma disciplina!")
            return
        
        print(f"📚 Professor leciona {len(teachings)} disciplina(s)")
        
        total_grades = 0
        
        for teaching in teachings:
            subject = Subject.query.get(teaching.subject_id)
            print(f"\n📖 Disciplina: {subject.name} (ID: {subject.id})")
            
            # Buscar alunos matriculados
            enrollments = Enrollment.query.filter_by(subject_id=subject.id).all()
            print(f"   👥 {len(enrollments)} alunos matriculados")
            
            if not enrollments:
                print("   ⚠️  Nenhum aluno matriculado nesta disciplina")
                continue
            
            for enrollment in enrollments:
                student = User.query.get(enrollment.student_id)
                if not student:
                    continue
                
                # Verificar se já tem notas
                existing_av1 = Grade.query.filter_by(
                    student_id=student.id,
                    subject_id=subject.id,
                    assessment_type='av1'
                ).first()
                
                existing_av2 = Grade.query.filter_by(
                    student_id=student.id,
                    subject_id=subject.id,
                    assessment_type='av2'
                ).first()
                
                # Criar AV1 se não existir
                if not existing_av1:
                    av1_value = generate_realistic_grade()
                    av1_grade = Grade(
                        student_id=student.id,
                        subject_id=subject.id,
                        assessment_type='av1',
                        grade=av1_value,
                        created_by=teacher.id
                    )
                    db.session.add(av1_grade)
                    total_grades += 1
                    print(f"   ✅ AV1 criada para {student.name}: {av1_value}")
                else:
                    print(f"   ⏭️  AV1 já existe para {student.name}: {existing_av1.grade}")
                
                # Criar AV2 se não existir
                if not existing_av2:
                    av2_value = generate_realistic_grade()
                    av2_grade = Grade(
                        student_id=student.id,
                        subject_id=subject.id,
                        assessment_type='av2',
                        grade=av2_value,
                        created_by=teacher.id
                    )
                    db.session.add(av2_grade)
                    total_grades += 1
                    print(f"   ✅ AV2 criada para {student.name}: {av2_value}")
                else:
                    print(f"   ⏭️  AV2 já existe para {student.name}: {existing_av2.grade}")
        
        try:
            db.session.commit()
            print(f"\n✅ Seed concluído! {total_grades} notas criadas.")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Erro ao salvar notas: {str(e)}")
            import traceback
            print(traceback.format_exc())


if __name__ == '__main__':
    seed_grades()
