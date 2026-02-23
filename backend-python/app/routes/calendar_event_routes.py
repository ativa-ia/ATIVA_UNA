from datetime import datetime, date
from calendar import monthrange

from flask import Blueprint, jsonify, request
from sqlalchemy import inspect

from app import db
from app.middleware.auth_middleware import token_required
from app.middleware.admin_middleware import admin_required
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.models.user_notification import UserNotification


calendar_event_bp = Blueprint('calendar_event', __name__)


def _ensure_calendar_events_table():
    inspector = inspect(db.engine)
    if not inspector.has_table(CalendarEvent.__tablename__):
        CalendarEvent.__table__.create(bind=db.engine)
    if not inspector.has_table(UserNotification.__tablename__):
        UserNotification.__table__.create(bind=db.engine)


def _parse_date(value: str):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except Exception:
        return None


def _target_users_for_event(target_role: str):
    if target_role == 'student':
        return User.query.filter_by(role='student').all()
    if target_role == 'teacher':
        return User.query.filter_by(role='teacher').all()
    return User.query.filter(User.role.in_(['student', 'teacher'])).all()


def _notify_event_change(event: CalendarEvent, action: str):
    users = _target_users_for_event(event.target_role)
    if not users:
        return

    if action == 'created':
        title = f"Novo {'aviso' if event.event_type == 'notice' else 'evento'} no calendário"
        message = f"{event.title} em {event.event_date.strftime('%d/%m/%Y')}."
    else:
        title = f"{'Aviso' if event.event_type == 'notice' else 'Evento'} atualizado"
        message = f"{event.title} foi atualizado para {event.event_date.strftime('%d/%m/%Y')}."

    inbox_items = [
        UserNotification(
            recipient_user_id=user.id,
            title=title,
            message=message,
            type='notice' if event.event_type == 'notice' else 'general',
            subject_name='Calendário Acadêmico',
            source_type='calendar_event',
            source_id=event.id,
        )
        for user in users
    ]

    db.session.bulk_save_objects(inbox_items)


@calendar_event_bp.route('', methods=['GET'])
@token_required
def list_calendar_events(current_user):
    _ensure_calendar_events_table()

    role_filter = request.args.get('role', '').strip().lower()
    date_filter = request.args.get('date', '').strip()
    month_filter = request.args.get('month', '').strip()  # YYYY-MM

    query = CalendarEvent.query.filter_by(is_active=True)

    if current_user.role == 'student':
        query = query.filter(CalendarEvent.target_role.in_(['student', 'both']))
    elif current_user.role == 'teacher':
        query = query.filter(CalendarEvent.target_role.in_(['teacher', 'both']))
    elif role_filter in ['student', 'teacher', 'both']:
        query = query.filter(CalendarEvent.target_role == role_filter)

    if date_filter:
        parsed_date = _parse_date(date_filter)
        if not parsed_date:
            return jsonify({'success': False, 'message': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        query = query.filter(CalendarEvent.event_date == parsed_date)

    if month_filter:
        try:
            year, month = month_filter.split('-')
            month_start = date(int(year), int(month), 1)
            month_end = date(int(year), int(month), monthrange(int(year), int(month))[1])
            query = query.filter(CalendarEvent.event_date >= month_start, CalendarEvent.event_date <= month_end)
        except Exception:
            return jsonify({'success': False, 'message': 'Formato de mês inválido. Use YYYY-MM'}), 400

    events = query.order_by(CalendarEvent.event_date.asc(), CalendarEvent.created_at.desc()).all()

    return jsonify({'success': True, 'events': [event.to_dict() for event in events]}), 200


@calendar_event_bp.route('', methods=['POST'])
@admin_required
def create_calendar_event(current_user):
    _ensure_calendar_events_table()

    data = request.get_json() or {}

    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    event_date_raw = (data.get('event_date') or '').strip()
    event_type = (data.get('event_type') or 'event').strip().lower()
    target_role = (data.get('target_role') or 'both').strip().lower()

    if not title:
        return jsonify({'success': False, 'message': 'Título é obrigatório'}), 400

    parsed_date = _parse_date(event_date_raw)
    if not parsed_date:
        return jsonify({'success': False, 'message': 'Data inválida. Use YYYY-MM-DD'}), 400

    if event_type not in ['event', 'notice']:
        return jsonify({'success': False, 'message': 'Tipo inválido. Use event ou notice'}), 400

    if target_role not in ['student', 'teacher', 'both']:
        return jsonify({'success': False, 'message': 'Público inválido. Use student, teacher ou both'}), 400

    event = CalendarEvent(
        title=title,
        description=description or None,
        event_date=parsed_date,
        event_type=event_type,
        target_role=target_role,
        created_by=current_user.id,
    )

    db.session.add(event)
    db.session.flush()
    _notify_event_change(event, 'created')
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Evento/aviso criado com sucesso',
        'event': event.to_dict()
    }), 201


@calendar_event_bp.route('/<int:event_id>', methods=['DELETE'])
@admin_required
def delete_calendar_event(current_user, event_id):
    _ensure_calendar_events_table()

    event = CalendarEvent.query.get(event_id)
    if not event:
        return jsonify({'success': False, 'message': 'Evento não encontrado'}), 404

    db.session.delete(event)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Evento removido com sucesso'}), 200


@calendar_event_bp.route('/<int:event_id>', methods=['PUT'])
@admin_required
def update_calendar_event(current_user, event_id):
    _ensure_calendar_events_table()

    event = CalendarEvent.query.get(event_id)
    if not event:
        return jsonify({'success': False, 'message': 'Evento não encontrado'}), 404

    data = request.get_json() or {}

    title = (data.get('title') or event.title).strip()
    description = (data.get('description') if data.get('description') is not None else event.description)
    event_date_raw = (data.get('event_date') or event.event_date.isoformat()).strip()
    event_type = (data.get('event_type') or event.event_type).strip().lower()
    target_role = (data.get('target_role') or event.target_role).strip().lower()

    if not title:
        return jsonify({'success': False, 'message': 'Título é obrigatório'}), 400

    parsed_date = _parse_date(event_date_raw)
    if not parsed_date:
        return jsonify({'success': False, 'message': 'Data inválida. Use YYYY-MM-DD'}), 400

    if event_type not in ['event', 'notice']:
        return jsonify({'success': False, 'message': 'Tipo inválido. Use event ou notice'}), 400

    if target_role not in ['student', 'teacher', 'both']:
        return jsonify({'success': False, 'message': 'Público inválido. Use student, teacher ou both'}), 400

    event.title = title
    event.description = description.strip() if isinstance(description, str) and description.strip() else None
    event.event_date = parsed_date
    event.event_type = event_type
    event.target_role = target_role

    _notify_event_change(event, 'updated')
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Evento/aviso atualizado com sucesso',
        'event': event.to_dict(),
    }), 200
