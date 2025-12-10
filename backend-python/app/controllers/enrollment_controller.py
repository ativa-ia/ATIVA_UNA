from flask import jsonify
from app.models import Subject, Enrollment, Class
from app import db


def auto_enroll_student(current_user):
    """
    Auto-matrícula de estudante em todas as disciplinas disponíveis
    - Verifica se o aluno já tem matrículas
    - Se não tiver, matricula em todas as disciplinas
    - Retorna quantidade de matrículas criadas
    """
    try:
        # Verificar se é estudante
        if current_user.role != 'student':
            return jsonify({
                'success': False,
                'message': 'Apenas estudantes podem usar auto-matrícula'
            }), 403
        
        # Verificar se já tem matrículas
        existing_enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()
        
        if existing_enrollments:
            print(f'ℹ️ Aluno ID={current_user.id} já possui {len(existing_enrollments)} matrículas')
            return jsonify({
                'success': True,
                'message': 'Aluno já possui matrículas',
                'enrollments_created': 0,
                'total_enrollments': len(existing_enrollments)
            }), 200
        
        # Buscar todas as disciplinas disponíveis
        all_subjects = Subject.query.all()
        
        if not all_subjects:
            return jsonify({
                'success': False,
                'message': 'Nenhuma disciplina disponível para matrícula'
            }), 404
        
        # Buscar primeira turma disponível
        default_class = Class.query.first()
        
        if not default_class:
            return jsonify({
                'success': False,
                'message': 'Nenhuma turma disponível no sistema'
            }), 404
        
        # Criar matrículas para cada disciplina
        enrollments_created = 0
        for subject in all_subjects:
            enrollment = Enrollment(
                student_id=current_user.id,
                subject_id=subject.id,
                class_id=default_class.id  # Usar primeira turma disponível
            )
            db.session.add(enrollment)
            enrollments_created += 1
        
        # Commit das matrículas
        db.session.commit()
        
        print(f'✅ Auto-matrícula: {enrollments_created} disciplinas criadas para aluno {current_user.email} (ID={current_user.id})')
        
        return jsonify({
            'success': True,
            'message': f'{enrollments_created} matrículas criadas com sucesso',
            'enrollments_created': enrollments_created
        }), 201
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f'❌ Erro em auto_enroll_student: {str(e)}')
        print(f'Traceback: {error_details}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao criar matrículas',
            'error': str(e)
        }), 500
