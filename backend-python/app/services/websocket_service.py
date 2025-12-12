"""
Serviço WebSocket para atualizações em tempo real de quiz
"""
from flask_socketio import emit, join_room, leave_room
from app import socketio
import logging

logger = logging.getLogger(__name__)


@socketio.on('connect')
def handle_connect():
    """Cliente conectou ao WebSocket"""
    logger.info(f"Cliente conectado")
    emit('connected', {'message': 'Conectado ao servidor WebSocket'})


@socketio.on('disconnect')
def handle_disconnect():
    """Cliente desconectou do WebSocket"""
    logger.info(f"Cliente desconectado")


@socketio.on('join_quiz')
def handle_join_quiz(data):
    """
    Professor/Aluno entra na room do quiz para receber atualizações
    data: {'quiz_id': int}
    """
    quiz_id = data.get('quiz_id')
    if quiz_id:
        room = f"quiz_{quiz_id}"
        join_room(room)
        logger.info(f"Cliente entrou na room: {room}")
        emit('joined_quiz', {'quiz_id': quiz_id, 'room': room})


@socketio.on('leave_quiz')
def handle_leave_quiz(data):
    """
    Cliente sai da room do quiz
    data: {'quiz_id': int}
    """
    quiz_id = data.get('quiz_id')
    if quiz_id:
        room = f"quiz_{quiz_id}"
        leave_room(room)
        logger.info(f"Cliente saiu da room: {room}")


def emit_ranking_update(quiz_id, ranking_data):
    """
    Emite atualização de ranking para todos na room do quiz
    
    Args:
        quiz_id: ID do quiz
        ranking_data: Dados do ranking (dict com ranking, enrolled_count, etc)
    """
    room = f"quiz_{quiz_id}"
    logger.info(f"Emitindo atualização de ranking para room: {room}")
    socketio.emit('ranking_update', ranking_data, room=room)


def emit_quiz_ended(quiz_id):
    """
    Emite evento de quiz encerrado para todos na room
    
    Args:
        quiz_id: ID do quiz
    """
    room = f"quiz_{quiz_id}"
    logger.info(f"Emitindo quiz encerrado para room: {room}")
    socketio.emit('quiz_ended', {'quiz_id': quiz_id}, room=room)


def emit_new_response(quiz_id, student_data):
    """
    Emite evento quando um aluno submete resposta
    
    Args:
        quiz_id: ID do quiz
        student_data: Dados do aluno que respondeu
    """
    room = f"quiz_{quiz_id}"
    logger.info(f"Emitindo nova resposta para room: {room}")
    socketio.emit('new_response', student_data, room=room)
