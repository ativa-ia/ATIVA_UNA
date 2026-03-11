from flask import jsonify
from app.models import Subject, Enrollment, Class, ClassSubject
from app import db


def auto_enroll_student(current_user):
    """
    Auto-matrícula de estudante em todas as ofertas de disciplina disponíveis
    Agora usa ClassSubject em vez de Subject diretamente
    """
    try:
        if current_user.role != 'student':
            return jsonify({
                'success': False,
                'message': 'Apenas estudantes podem usar auto-matrícula'
            }), 403

        existing_enrollments = Enrollment.query.filter_by(student_id=current_user.id).all()

        if existing_enrollments:
            return jsonify({
                'success': True,
                'message': 'Aluno já possui matrículas',
                'enrollments_created': 0,
                'total_enrollments': len(existing_enrollments)
            }), 200

        db.session.expire_all()

        # Buscar todas as ofertas de disciplina ativas
        all_class_subjects = ClassSubject.query.filter_by(status='active').all()

        if not all_class_subjects:
            return jsonify({
                'success': False,
                'message': 'Nenhuma oferta de disciplina disponível'
            }), 404

        enrollments_created = 0
        for cs in all_class_subjects:
            enrollment = Enrollment(
                student_id=current_user.id,
                class_subject_id=cs.id
            )
            db.session.add(enrollment)
            enrollments_created += 1

        db.session.commit()

        if enrollments_created > 0:
            print(f'-> Auto-matrícula: {enrollments_created} ofertas criadas para aluno {current_user.email}')

        return jsonify({
            'success': True,
            'message': f'{enrollments_created} matrículas criadas com sucesso',
            'enrollments_created': enrollments_created
        }), 201

    except Exception as e:
        import traceback
        print(f'Error em auto_enroll_student: {str(e)}')
        print(f'Traceback: {traceback.format_exc()}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Erro ao criar matrículas',
            'error': str(e)
        }), 500
