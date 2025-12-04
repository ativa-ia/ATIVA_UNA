from flask import Blueprint, request, jsonify
from app import db
from app.models.notification import Notification
from app.models.teaching import Teaching
from app.models.subject import Subject
from app.middleware.auth_middleware import token_required

notification_bp = Blueprint('notification', __name__)

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
        
    # Criar notificação no banco
    new_notif = Notification(
        title=title,
        message=message,
        type=notif_type,
        subject_id=subject_id,
        teacher_id=current_user.id,
        sent_to_students=True # Simulando envio imediato
    )
    
    db.session.add(new_notif)
    db.session.commit()
    
    # Aqui entraria a integração com Expo Push Notifications
    # Por enquanto, apenas simulamos o sucesso
    print(f"[PUSH MOCK] Enviando para alunos da disciplina {subject.name}: {title} - {message}")
    
    return jsonify({
        'success': True,
        'message': 'Notificação enviada com sucesso!',
        'notification': new_notif.to_dict()
    }), 201

@notification_bp.route('/student/<int:student_id>', methods=['GET'])
# @token_required # Comentado para facilitar testes se necessário, mas idealmente protegido
def get_student_notifications(student_id):
    """
    Retorna notificações para um aluno (baseado nas disciplinas que ele cursa).
    Nota: Como não temos tabela de matricula (Enrollment) completa ainda, 
    vamos retornar as notificações das disciplinas que o aluno 'segue' (mock).
    """
    # Mock: Retorna últimas 10 notificações gerais
    notifications = Notification.query.order_by(Notification.created_at.desc()).limit(10).all()
    
    return jsonify({
        'success': True,
        'notifications': [n.to_dict() for n in notifications]
    })
