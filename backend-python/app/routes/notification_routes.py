from flask import Blueprint, request, jsonify
from math import ceil
from sqlalchemy import inspect
from app import db
from app.models.user_notification import UserNotification
from app.models.teaching import Teaching
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.middleware.auth_middleware import token_required

notification_bp = Blueprint('notification', __name__)


def _ensure_user_notifications_table():
    inspector = inspect(db.engine)
    if not inspector.has_table(UserNotification.__tablename__):
        UserNotification.__table__.create(bind=db.engine)


def _create_user_notifications(recipient_ids, title, message, notif_type='general', subject_name=None, source_type=None, source_id=None):
    if not recipient_ids:
        return 0

    notifications = [
        UserNotification(
            recipient_user_id=user_id,
            title=title,
            message=message,
            type=notif_type,
            subject_name=subject_name,
            source_type=source_type,
            source_id=source_id,
        )
        for user_id in recipient_ids
    ]
    db.session.bulk_save_objects(notifications)
    return len(notifications)

@notification_bp.route('/send', methods=['POST'])
@token_required
def send_notification(current_user):
    """
    Envia uma notificação para os alunos de uma disciplina.
    Payload esperado:
    {
        "subject_id": 1,
        "title": "Novo Quiz Disponível",
        "message": "O professor gerou um novo quiz sobre Derivadas.",
        "type": "quiz"
    }
    """
    data = request.get_json()
    _ensure_user_notifications_table()
    
    subject_id = data.get('subject_id')
    title = data.get('title')
    message = data.get('message')
    notif_type = data.get('type', 'general')
    
    if not all([subject_id, title, message]):
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
        
    # Verificar se o professor leciona esta disciplina
    teaching = Teaching.query.filter_by(subject_id=subject_id, teacher_id=current_user.id).first()
    if not teaching:
        return jsonify({'success': False, 'message': 'Disciplina não encontrada ou não autorizada'}), 404
        
    subject = Subject.query.get(subject_id)
        
    enrolled_student_ids = [row[0] for row in db.session.query(Enrollment.student_id).filter_by(subject_id=subject_id).all()]
    sent_count = _create_user_notifications(
        recipient_ids=enrolled_student_ids,
        title=title,
        message=message,
        notif_type=notif_type,
        subject_name=subject.name if subject else None,
        source_type='teacher_notification',
        source_id=None,
    )

    db.session.commit()
    
    # Aqui entraria a integração com Expo Push Notifications
    # Por enquanto, apenas simulamos o sucesso
    print(f"[PUSH MOCK] Enviando para alunos da disciplina {subject.name}: {title} - {message}")
    
    return jsonify({
        'success': True,
        'message': 'Notificação enviada com sucesso!',
        'notification': {
            'title': title,
            'message': message,
            'type': notif_type,
            'subject_name': subject.name if subject else None,
            'sent_to_students': sent_count,
        }
    }), 201

@notification_bp.route('/student/<int:student_id>', methods=['GET'])
@token_required
def get_student_notifications(current_user, student_id):
    """
    Retorna notificações para um aluno (baseado nas disciplinas que ele cursa).
    """
    _ensure_user_notifications_table()

    notifications = UserNotification.query\
        .filter_by(recipient_user_id=student_id)\
        .order_by(UserNotification.created_at.desc())\
        .limit(50)\
        .all()
    
    return jsonify({
        'success': True,
        'notifications': [n.to_dict() for n in notifications]
    })


@notification_bp.route('/mine', methods=['GET'])
@token_required
def get_my_notifications(current_user):
    """
    Retorna notificações do aluno autenticado (baseado nas disciplinas matriculadas).
    """
    _ensure_user_notifications_table()

    try:
        page = max(int(request.args.get('page', 1)), 1)
    except ValueError:
        page = 1

    try:
        per_page = min(max(int(request.args.get('per_page', 20)), 1), 50)
    except ValueError:
        per_page = 20

    base_query = UserNotification.query.filter_by(recipient_user_id=current_user.id)
    total = base_query.count()
    total_pages = ceil(total / per_page) if total > 0 else 0

    notifications = base_query\
        .order_by(UserNotification.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    return jsonify({
        'success': True,
        'notifications': [n.to_dict() for n in notifications],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
        }
    })


@notification_bp.route('/mine/<int:notification_id>', methods=['DELETE'])
@token_required
def delete_my_notification(current_user, notification_id):
    _ensure_user_notifications_table()

    notification = UserNotification.query.filter_by(
        id=notification_id,
        recipient_user_id=current_user.id,
    ).first()

    if not notification:
        return jsonify({'success': False, 'message': 'Notificação não encontrada'}), 404

    db.session.delete(notification)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Notificação removida com sucesso'}), 200
