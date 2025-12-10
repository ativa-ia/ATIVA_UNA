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


def get_student_performance(current_user, student_id, subject_id):
    """Desempenho detalhado de um aluno específico em uma disciplina"""
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
        
        # Buscar aluno
        student = User.query.get(student_id)
        if not student or student.role != 'student':
            return jsonify({'error': 'Student not found'}), 404
        
        # Buscar disciplina
        subject = Subject.query.get(subject_id)
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Verificar se o aluno está matriculado
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            subject_id=subject_id
        ).first()
        
        if not enrollment:
            return jsonify({'error': 'Student not enrolled in this subject'}), 404
        
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
        
        # Calcular média da turma para comparação
        from app.models import QuizResponse
        all_students = Enrollment.query.filter_by(subject_id=subject_id).all()
        class_grades = []
        for enr in all_students:
            av1 = Grade.query.filter_by(
                student_id=enr.student_id,
                subject_id=subject_id,
                assessment_type='av1'
            ).first()
            av2 = Grade.query.filter_by(
                student_id=enr.student_id,
                subject_id=subject_id,
                assessment_type='av2'
            ).first()
            
            if av1 and av2:
                class_grades.append((av1.grade + av2.grade) / 2)
        
        # Calcular ranking do aluno
        class_grades_with_ids = []
        for enr in all_students:
            av1 = Grade.query.filter_by(
                student_id=enr.student_id,
                subject_id=subject_id,
                assessment_type='av1'
            ).first()
            av2 = Grade.query.filter_by(
                student_id=enr.student_id,
                subject_id=subject_id,
                assessment_type='av2'
            ).first()
            
            if av1 and av2:
                student_avg = (av1.grade + av2.grade) / 2
                class_grades.append(student_avg)
                class_grades_with_ids.append({
                    'student_id': enr.student_id,
                    'average': student_avg
                })
        
        class_average = sum(class_grades) / len(class_grades) if class_grades else 0
        
        # Calcular ranking
        class_grades_with_ids.sort(key=lambda x: x['average'], reverse=True)
        ranking = None
        for idx, item in enumerate(class_grades_with_ids):
            if item['student_id'] == student_id:
                ranking = idx + 1
                break
        
        # Calcular tendência (AV2 vs AV1)
        trend = None
        if av1_value is not None and av2_value is not None:
            if av2_value > av1_value:
                trend = 'improving'
            elif av2_value < av1_value:
                trend = 'declining'
            else:
                trend = 'stable'
        
        # Calcular nota necessária para aprovação (média 7.0)
        required_grade = None
        if av1_value is not None and av2_value is None:
            # Só tem AV1, calcular quanto precisa na AV2
            required_grade = (7.0 * 2) - av1_value
            required_grade = max(0, min(10, required_grade))  # Entre 0 e 10
        
        # Buscar atividades
        from app.models import Activity, ActivitySubmission
        activities = Activity.query.filter_by(subject_id=subject_id).all()
        activities_data = []
        for activity in activities:
            submission = ActivitySubmission.query.filter_by(
                activity_id=activity.id,
                student_id=student_id
            ).first()
            
            if submission:
                activities_data.append({
                    'activity_id': activity.id,
                    'title': activity.title,
                    'type': activity.type,
                    'status': submission.status,
                    'grade': submission.grade,
                    'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None,
                    'graded_at': submission.graded_at.isoformat() if submission.graded_at else None
                })
            else:
                activities_data.append({
                    'activity_id': activity.id,
                    'title': activity.title,
                    'type': activity.type,
                    'status': 'pending',
                    'grade': None,
                    'submitted_at': None,
                    'graded_at': None
                })
        
        # Buscar quizzes do aluno nesta disciplina
        from app.models import Quiz
        quizzes = Quiz.query.filter_by(subject_id=subject_id).all()
        quiz_data = []
        for quiz in quizzes:
            response = QuizResponse.query.filter_by(
                quiz_id=quiz.id,
                student_id=student_id
            ).first()
            
            if response:
                quiz_data.append({
                    'quiz_id': quiz.id,
                    'quiz_title': quiz.title,
                    'score': response.score,
                    'total': response.total,
                    'percentage': response.percentage,
                    'submitted_at': response.submitted_at.isoformat() if response.submitted_at else None
                })
        
        return jsonify({
            'student': {
                'id': student.id,
                'name': student.name,
                'email': student.email
            },
            'subject': {
                'id': subject.id,
                'name': subject.name,
                'code': subject.code
            },
            'grades': {
                'av1': av1_value,
                'av2': av2_value,
                'average': round(average, 2) if average is not None else None,
                'status': status
            },
            'class_average': round(class_average, 2),
            'ranking': ranking,
            'total_students': len(all_students),
            'trend': trend,
            'required_grade': round(required_grade, 1) if required_grade is not None else None,
            'activities': activities_data,
            'total_activities': len(activities),
            'completed_activities': sum(1 for a in activities_data if a['status'] in ['submitted', 'graded']),
            'quizzes': quiz_data,
            'total_quizzes': len(quizzes),
            'completed_quizzes': len(quiz_data)
        }), 200
        
    except Exception as e:
        print(f'❌ Error in get_student_performance: {str(e)}')
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
