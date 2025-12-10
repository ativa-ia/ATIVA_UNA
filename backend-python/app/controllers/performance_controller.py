from flask import jsonify, request
from app import db
from app.models import Grade, User, Subject, Enrollment, Teaching
from datetime import datetime


def register_grades(current_user):
    """Registrar/atualizar notas AV1 ou AV2"""
    try:
        # Apenas professores podem lançar notas
        if current_user.role != 'teacher':
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        subject_id = data.get('subject_id')
        assessment_type = data.get('assessment_type')  # 'av1' ou 'av2'
        grades_data = data.get('grades')  # [{ student_id, grade }]
        
        # Validações
        if not subject_id or not assessment_type or not grades_data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if assessment_type not in ['av1', 'av2']:
            return jsonify({'error': 'Invalid assessment type'}), 400
        
        # Verificar se o professor leciona esta disciplina
        teaching = Teaching.query.filter_by(
            teacher_id=current_user.id,
            subject_id=subject_id
        ).first()
        
        if not teaching:
            return jsonify({'error': 'You do not teach this subject'}), 403
        
        # Processar cada nota
        results = []
        for grade_item in grades_data:
            student_id = grade_item.get('student_id')
            grade_value = grade_item.get('grade')
            
            # Validar nota (0-10)
            if grade_value < 0 or grade_value > 10:
                results.append({
                    'student_id': student_id,
                    'success': False,
                    'error': 'Grade must be between 0 and 10'
                })
                continue
            
            # Verificar se já existe nota
            existing_grade = Grade.query.filter_by(
                student_id=student_id,
                subject_id=subject_id,
                assessment_type=assessment_type
            ).first()
            
            if existing_grade:
                # Atualizar
                existing_grade.grade = grade_value
                existing_grade.updated_at = datetime.utcnow()
            else:
                # Criar nova
                new_grade = Grade(
                    student_id=student_id,
                    subject_id=subject_id,
                    assessment_type=assessment_type,
                    grade=grade_value,
                    created_by=current_user.id
                )
                db.session.add(new_grade)
            
            results.append({
                'student_id': student_id,
                'success': True
            })
        
        db.session.commit()
        
        return jsonify({
            'message': 'Grades registered successfully',
            'results': results
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f'❌ Error in register_grades: {str(e)}')
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


def get_class_performance(current_user, subject_id):
    """Desempenho geral da turma em uma disciplina"""
    try:
        # Apenas professores
        if current_user.role != 'teacher':
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Verificar se leciona a disciplina
        teaching = Teaching.query.filter_by(
            teacher_id=current_user.id,
            subject_id=subject_id
        ).first()
        
        if not teaching:
            return jsonify({'error': 'You do not teach this subject'}), 403
        
        # Buscar disciplina
        subject = Subject.query.get(subject_id)
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Buscar todos os alunos matriculados
        enrollments = Enrollment.query.filter_by(subject_id=subject_id).all()
        student_ids = [e.student_id for e in enrollments]
        
        students_data = []
        total_av1 = 0
        total_av2 = 0
        count_av1 = 0
        count_av2 = 0
        
        for student_id in student_ids:
            student = User.query.get(student_id)
            if not student:
                continue
            
            # Buscar notas
            av1_grade = Grade.query.filter_by(
                student_id=student_id,
                subject_id=subject_id,
                assessment_type='av1'
            ).first()
            
            av2_grade = Grade.query.filter_by(
                student_id=student_id,
                subject_id=subject_id,
                assessment_type='av2'
            ).first()
            
            av1_value = av1_grade.grade if av1_grade else None
            av2_value = av2_grade.grade if av2_grade else None
            
            # Calcular média
            average = None
            if av1_value is not None and av2_value is not None:
                average = (av1_value + av2_value) / 2
            elif av1_value is not None:
                average = av1_value
            elif av2_value is not None:
                average = av2_value
            
            # Determinar status
            status = 'pending'
            if average is not None:
                if average >= 9.0:
                    status = 'excellent'
                elif average >= 7.0:
                    status = 'good'
                elif average >= 5.0:
                    status = 'warning'
                else:
                    status = 'critical'
            
            # Contar para médias
            if av1_value is not None:
                total_av1 += av1_value
                count_av1 += 1
            if av2_value is not None:
                total_av2 += av2_value
                count_av2 += 1
            
            students_data.append({
                'student_id': student_id,
                'student_name': student.name,
                'av1': av1_value,
                'av2': av2_value,
                'average': round(average, 2) if average is not None else None,
                'status': status
            })
        
        # Calcular estatísticas
        avg_av1 = total_av1 / count_av1 if count_av1 > 0 else 0
        avg_av2 = total_av2 / count_av2 if count_av2 > 0 else 0
        avg_final = (avg_av1 + avg_av2) / 2 if count_av1 > 0 and count_av2 > 0 else 0
        
        # Contar aprovados (média >= 7.0)
        approved = sum(1 for s in students_data if s['average'] and s['average'] >= 7.0)
        approval_rate = (approved / len(students_data) * 100) if students_data else 0
        
        return jsonify({
            'subject': {
                'id': subject.id,
                'name': subject.name,
                'code': subject.code
            },
            'stats': {
                'total_students': len(students_data),
                'average_av1': round(avg_av1, 2),
                'average_av2': round(avg_av2, 2),
                'average_final': round(avg_final, 2),
                'approval_rate': round(approval_rate, 1),
                'approved': approved,
                'at_risk': sum(1 for s in students_data if s['status'] in ['warning', 'critical'])
            },
            'students': students_data
        }), 200
        
    except Exception as e:
        print(f'❌ Error in get_class_performance: {str(e)}')
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


def get_student_grades_all(current_user):
    """Todas as notas do aluno logado em todas as disciplinas"""
    try:
        # Apenas alunos
        if current_user.role != 'student':
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Buscar matrículas do aluno
        enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()
        
        subjects_data = []
        total_average = 0
        count_subjects = 0
        
        for enrollment in enrollments:
            subject = Subject.query.get(enrollment.subject_id)
            if not subject:
                continue
            
            # Buscar notas
            av1_grade = Grade.query.filter_by(
                student_id=current_user.id,
                subject_id=subject.id,
                assessment_type='av1'
            ).first()
            
            av2_grade = Grade.query.filter_by(
                student_id=current_user.id,
                subject_id=subject.id,
                assessment_type='av2'
            ).first()
            
            av1_value = av1_grade.grade if av1_grade else None
            av2_value = av2_grade.grade if av2_grade else None
            
            # Calcular média
            average = None
            if av1_value is not None and av2_value is not None:
                average = (av1_value + av2_value) / 2
                total_average += average
                count_subjects += 1
            
            # Determinar status
            status = 'pending'
            if average is not None:
                if average >= 7.0:
                    status = 'approved'
                elif average >= 5.0:
                    status = 'warning'
                else:
                    status = 'failed'
            
            subjects_data.append({
                'subject_id': subject.id,
                'subject_name': subject.name,
                'subject_code': subject.code,
                'av1': av1_value,
                'av2': av2_value,
                'average': round(average, 2) if average is not None else None,
                'status': status
            })
        
        # Média geral
        general_average = total_average / count_subjects if count_subjects > 0 else 0
        
        return jsonify({
            'student': {
                'id': current_user.id,
                'name': current_user.name
            },
            'general_average': round(general_average, 2),
            'total_subjects': len(subjects_data),
            'subjects': subjects_data
        }), 200
        
    except Exception as e:
        print(f'❌ Error in get_student_grades_all: {str(e)}')
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
