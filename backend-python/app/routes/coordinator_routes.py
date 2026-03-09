"""
Rotas da API do Coordenador de Curso
Permite monitoramento, gestão de turmas/disciplinas, notificações e recaps.
"""
from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User
from app.models.course import Course
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
from app.models.lesson_recap import LessonRecap
from app.models.student_request import StudentRequest
from app.models.calendar_event import CalendarEvent
from app.models.transcription_session import (
    TranscriptionSession, LiveActivity, LiveActivityResponse
)
from app.models.user_notification import UserNotification
from app.middleware.auth_middleware import token_required, role_required
from sqlalchemy import func, case, distinct
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

coordinator_bp = Blueprint('coordinator', __name__)


# ───────────────────────── helpers ──────────────────────────
def _get_course_subject_ids(course_id):
    """Retorna IDs de disciplinas do curso via classes → teachings."""
    class_ids = [c.id for c in Class.query.filter_by(course_id=course_id).all()]
    if not class_ids:
        return []
    subject_ids = (
        db.session.query(distinct(Teaching.subject_id))
        .filter(Teaching.class_id.in_(class_ids))
        .all()
    )
    return [s[0] for s in subject_ids]


def _get_course_student_ids(course_id):
    """Retorna IDs de alunos matriculados no curso."""
    class_ids = [c.id for c in Class.query.filter_by(course_id=course_id).all()]
    if not class_ids:
        return []
    student_ids = (
        db.session.query(distinct(Enrollment.student_id))
        .filter(Enrollment.class_id.in_(class_ids))
        .all()
    )
    return [s[0] for s in student_ids]


def _get_course_teacher_ids(course_id):
    """Retorna IDs de professores que lecionam no curso."""
    class_ids = [c.id for c in Class.query.filter_by(course_id=course_id).all()]
    if not class_ids:
        return []
    teacher_ids = (
        db.session.query(distinct(Teaching.teacher_id))
        .filter(Teaching.class_id.in_(class_ids))
        .all()
    )
    return [t[0] for t in teacher_ids]


def _verify_coordinator(current_user):
    """Verifica se o coordenador tem curso vinculado. Retorna (course, error_response)."""
    if not current_user.course_id:
        return None, (jsonify({
            'success': False,
            'message': 'Coordenador sem curso vinculado'
        }), 400)
    course = Course.query.get(current_user.course_id)
    if not course:
        return None, (jsonify({
            'success': False,
            'message': 'Curso não encontrado'
        }), 404)
    return course, None


# ═══════════════════════════════════════════════════════════════
#  DASHBOARD & ANALYTICS (read-only)
# ═══════════════════════════════════════════════════════════════

@coordinator_bp.route('/dashboard', methods=['GET'])
@token_required
@role_required('coordinator')
def coordinator_dashboard(current_user):
    """KPIs consolidados do curso (otimizado)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    subject_filter = request.args.get('subject_id', type=int)
    student_filter = request.args.get('student_id', type=int)
    semester_filter = request.args.get('semester', type=str)

    subject_ids = _get_course_subject_ids(course.id)
    student_ids = _get_course_student_ids(course.id)
    teacher_ids = _get_course_teacher_ids(course.id)

    # 1. Consulta consolidada de quizzes para todos os alunos envolvidos
    quiz_stats = {'avg_score': 0, 'participation_rate': 0, 'error_rate': 0}
    risk_students = []

    if subject_ids and student_ids:
        # Recuperando as médias de quiz num único agrupamento
        quiz_query = (
            db.session.query(
                LiveActivityResponse.student_id,
                User.name.label('student_name'),
                func.sum(LiveActivityResponse.score).label('total_score'),
                func.sum(LiveActivityResponse.total).label('total_possible')
            )
            .join(User, User.id == LiveActivityResponse.student_id)
            .join(LiveActivity, LiveActivity.id == LiveActivityResponse.activity_id)
            .outerjoin(TranscriptionSession, TranscriptionSession.id == LiveActivity.session_id)
            .filter(
                TranscriptionSession.subject_id.in_(subject_ids),
                LiveActivity.activity_type == 'quiz',
                LiveActivity.status == 'ended'
            )
            .group_by(LiveActivityResponse.student_id, User.name)
            .all()
        )

        global_score = 0
        global_possible = 0

        for row in quiz_query:
            sid, sname, c_score, c_total = row
            global_score += (c_score or 0)
            global_possible += (c_total or 0)

            avg = round((c_score / c_total * 100) if c_total > 0 else 0)
            err_rate = 100 - avg

            status = 'doing_well'
            if avg < 40:
                status = 'needs_help'
            elif avg < 60:
                status = 'attention'

            if status in ('needs_help', 'attention'):
                risk_students.append({
                    'student_id': sid,
                    'student_name': sname,
                    'avg_score': avg,
                    'error_rate': err_rate,
                    'status': status,
                })

        # Totais
        quiz_stats['avg_score'] = round((global_score / global_possible * 100) if global_possible > 0 else 0)
        quiz_stats['error_rate'] = 100 - quiz_stats['avg_score']
        quiz_stats['participation_rate'] = round(len(quiz_query) / len(student_ids) * 100) if student_ids else 0

    risk_students.sort(key=lambda s: s['avg_score'])

    classes_count = Class.query.filter_by(course_id=course.id).count()

    # Sinal operacional
    critical_count = len([s for s in risk_students if s['status'] == 'needs_help'])
    
    if critical_count >= 3 or quiz_stats['error_rate'] >= 60 or quiz_stats['participation_rate'] < 25:
        signal = {'label': 'Crítico', 'message': 'Intervenção imediata recomendada', 'level': 'critical'}
    elif critical_count >= 1 or quiz_stats['error_rate'] >= 40 or quiz_stats['participation_rate'] < 45:
        signal = {'label': 'Atenção', 'message': 'Acompanhar nas próximas 24h', 'level': 'attention'}
    else:
        signal = {'label': 'Estável', 'message': 'Cenário controlado', 'level': 'stable'}

    # 2. Student Requests (Mocked logic for real DB)
    pending_requests = []
    if student_ids:
        requests_query = (
            StudentRequest.query
            .join(User, User.id == StudentRequest.student_id)
            .filter(StudentRequest.student_id.in_(student_ids))
            .filter(StudentRequest.status == 'pending')
            .order_by(StudentRequest.created_at.desc())
            .limit(5)
            .all()
        )
        for r in requests_query:
            pending_requests.append({
                'id': r.id,
                'student_name': r.student.name.split()[0], # First name
                'request_type': r.request_type,
                'created_at': r.created_at.isoformat() if r.created_at else None
            })

    # 3. Calendar Events & Deadlines
    today = datetime.utcnow().date()
    teacher_deadlines = []
    upcoming_events = []
    
    events_query = CalendarEvent.query.filter(CalendarEvent.event_date >= today).order_by(CalendarEvent.event_date.asc())
    for ev in events_query:
        # Check if event targets Teachers
        if ev.target_role in ('teacher', 'both') and len(teacher_deadlines) < 5:
            teacher_deadlines.append({
                'id': ev.id,
                'title': ev.title,
                'date': ev.event_date.strftime('%b %d')
            })
        # Check if event targets Students
        if ev.target_role in ('student', 'both') and len(upcoming_events) < 5:
            upcoming_events.append({
                'id': ev.id,
                'title': ev.title,
                'date': ev.event_date.strftime('%b %d')
            })

    # 4. Evolução Cronológica de Quizzes (Chart Data)
    classes_query = Class.query.filter_by(course_id=course.id)
    if semester_filter:
        parts = semester_filter.split('.')
        if len(parts) == 2:
            try:
                classes_query = classes_query.filter_by(year=int(parts[0]), semester=parts[1])
            except ValueError:
                pass
    class_ids = [c.id for c in classes_query.all()]
    
    # Alunos elegíveis (daquelas turmas/semestre)
    eligible_enrollments = Enrollment.query.filter(Enrollment.class_id.in_(class_ids)).all()
    eligible_student_ids = [e.student_id for e in eligible_enrollments]

    query_activities = (
        db.session.query(LiveActivity)
        .join(TranscriptionSession, TranscriptionSession.id == LiveActivity.session_id)
        .filter(TranscriptionSession.subject_id.in_(subject_ids))
        .filter(LiveActivity.activity_type == 'quiz')
        .filter(LiveActivity.status == 'ended')
    )
    if subject_filter:
        query_activities = query_activities.filter(TranscriptionSession.subject_id == subject_filter)
        
    activities = query_activities.order_by(LiveActivity.created_at.asc()).all()
    
    chart_labels = []
    class_data = []
    student_data = []
    
    for activity in activities:
        responses = LiveActivityResponse.query.filter_by(activity_id=activity.id).filter(LiveActivityResponse.student_id.in_(eligible_student_ids)).all()
        if not responses:
            continue
            
        total_score = sum([r.score for r in responses])
        total_possible = sum([r.total for r in responses])
        class_avg = round((total_score / total_possible) * 10, 1) if total_possible > 0 else 0.0
        
        # Ex: "10/03"
        label = activity.created_at.strftime('%d/%m') if activity.created_at else "Quiz"
        chart_labels.append(label)
        class_data.append(class_avg)
        
        if student_filter:
            stud_resps = [r for r in responses if r.student_id == student_filter]
            if stud_resps:
                s_score = sum([r.score for r in stud_resps])
                s_poss = sum([r.total for r in stud_resps])
                stud_avg = round((s_score / s_poss) * 10, 1) if s_poss > 0 else 0.0
                student_data.append(stud_avg)
            else:
                student_data.append(0.0)

    # Monta payload
    chart_data = {'labels': chart_labels if chart_labels else ['Atual'], 'datasets': []}
    
    # Dataset padrão vazio se não houver notas
    if not class_data:
        chart_data['datasets'].append({'name': 'Turma', 'data': [0.0]})
    else:
        chart_data['datasets'].append({'name': 'Turma', 'data': class_data})
        if student_filter:
            chart_data['datasets'].append({'name': 'Aluno', 'data': student_data})

    # 5. Get available semesters for the dropdown
    all_course_classes = Class.query.filter_by(course_id=course.id).all()
    semesters_set = {f"{c.year}.{c.semester}" for c in all_course_classes}
    available_semesters = sorted(list(semesters_set), reverse=True)

    return jsonify({
        'success': True,
        'course': course.to_dict(),
        'kpis': {
            'total_students': len(student_ids),
            'total_teachers': len(teacher_ids),
            'total_subjects': len(subject_ids),
            'total_classes': classes_count,
            'quiz_avg_score': quiz_stats['avg_score'],
            'quiz_participation_rate': quiz_stats['participation_rate'],
            'quiz_error_rate': quiz_stats['error_rate'],
        },
        'signal': signal,
        'risk_students': risk_students[:5],
        'pending_requests': pending_requests,
        'teacher_deadlines': teacher_deadlines,
        'upcoming_events': upcoming_events,
        'chart_data': chart_data,
        'available_semesters': available_semesters
    })


@coordinator_bp.route('/subjects', methods=['GET'])
@token_required
@role_required('coordinator')
def list_subjects(current_user):
    """Lista disciplinas do curso com estatísticas (otimizado)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    subject_ids = _get_course_subject_ids(course.id)
    if not subject_ids:
        return jsonify({'success': True, 'subjects': []})

    # Total de matrículas agrupadas por disciplina em uma única Query
    enrollment_counts = (
        db.session.query(Enrollment.subject_id, func.count('*'))
        .filter(Enrollment.subject_id.in_(subject_ids))
        .group_by(Enrollment.subject_id)
        .all()
    )
    enroll_map = {e[0]: e[1] for e in enrollment_counts}

    # Professores agrupados por disciplina em uma única Query
    teachings = (
        db.session.query(Teaching.subject_id, User.name)
        .join(User, User.id == Teaching.teacher_id)
        .filter(Teaching.subject_id.in_(subject_ids))
        .group_by(Teaching.subject_id, User.name)
        .all()
    )
    teacher_map = {}
    for t in teachings:
        teacher_map.setdefault(t[0], set()).add(t[1])

    subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all()

    result = []
    for subj in subjects:
        result.append({
            **subj.to_dict(),
            'enrolled_students': enroll_map.get(subj.id, 0),
            'teachers': list(teacher_map.get(subj.id, [])),
        })

    return jsonify({'success': True, 'subjects': result})


@coordinator_bp.route('/subjects/<int:subject_id>/analytics', methods=['GET'])
@token_required
@role_required('coordinator')
def subject_analytics(current_user, subject_id):
    """Analytics detalhado de uma disciplina (reutiliza lógica do professor)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    # Verificar se disciplina pertence ao curso
    subject_ids = _get_course_subject_ids(course.id)
    if subject_id not in subject_ids:
        return jsonify({'success': False, 'error': 'Disciplina não pertence ao seu curso'}), 403

    # Importar e reutilizar lógica existente
    try:
        from app.routes.transcription_routes import _build_subject_analytics
        days = request.args.get('days', type=int)
        result = _build_subject_analytics(subject_id, days)
        return jsonify(result)
    except (ImportError, AttributeError):
        # Fallback: analytics básico inline
        subject = Subject.query.get(subject_id)
        if not subject:
            return jsonify({'success': False, 'error': 'Disciplina não encontrada'}), 404

        enrolled = Enrollment.query.filter_by(subject_id=subject_id).count()
        sessions = TranscriptionSession.query.filter_by(subject_id=subject_id).all()
        session_ids = [s.id for s in sessions]

        activities = []
        responses = []
        if session_ids:
            activities = LiveActivity.query.filter(
                LiveActivity.session_id.in_(session_ids),
                LiveActivity.activity_type == 'quiz',
            ).all()
            if activities:
                act_ids = [a.id for a in activities]
                responses = LiveActivityResponse.query.filter(
                    LiveActivityResponse.activity_id.in_(act_ids)
                ).all()

        avg_score = 0
        error_rate = 0
        participation = 0
        if responses:
            ts = sum(r.score or 0 for r in responses)
            tt = sum(r.total or 1 for r in responses)
            avg_score = round((ts / tt * 100) if tt > 0 else 0)
            error_rate = 100 - avg_score
            unique_students = len(set(r.student_id for r in responses))
            participation = round(unique_students / enrolled * 100) if enrolled > 0 else 0

        return jsonify({
            'success': True,
            'subject': {'id': subject.id, 'name': subject.name, 'code': subject.code},
            'summary': {
                'enrolled_students': enrolled,
                'total_activities': len(activities),
                'total_quizzes': len([a for a in activities if a.activity_type == 'quiz']),
                'total_summaries': len([a for a in activities if a.activity_type == 'summary']),
                'total_quiz_responses': len(responses),
                'total_summary_interactions': 0,
                'quiz_avg_score': avg_score,
                'quiz_error_rate': error_rate,
                'quiz_participation_rate': participation,
            },
            'performance_bands': [],
            'students': [],
            'recent_quizzes': [],
        })


@coordinator_bp.route('/teachers', methods=['GET'])
@token_required
@role_required('coordinator')
def list_teachers(current_user):
    """Lista professores do curso (otimizado)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    teacher_ids = _get_course_teacher_ids(course.id)
    if not teacher_ids:
        return jsonify({'success': True, 'teachers': []})

    teachers = User.query.filter(User.id.in_(teacher_ids)).all()

    # Disciplinas relacionadas aos professores neste curso
    class_ids = [c.id for c in Class.query.filter_by(course_id=course.id).all()]
    if class_ids:
        teachings = (
            db.session.query(Teaching.teacher_id, Subject.name)
            .join(Subject, Subject.id == Teaching.subject_id)
            .filter(Teaching.teacher_id.in_(teacher_ids), Teaching.class_id.in_(class_ids))
            .all()
        )
    else:
        teachings = []

    teacher_subjects = {}
    for tid, sname in teachings:
        teacher_subjects.setdefault(tid, set()).add(sname)

    # Quantidade de sessões criadas por cada professor e última atividade
    session_stats = (
        db.session.query(
            TranscriptionSession.teacher_id,
            func.count(TranscriptionSession.id).label('count'),
            func.max(TranscriptionSession.started_at).label('last_activity')
        )
        .filter(TranscriptionSession.teacher_id.in_(teacher_ids))
        .group_by(TranscriptionSession.teacher_id)
        .all()
    )
    session_map = {s[0]: {'count': s[1], 'last': s[2]} for s in session_stats}

    result = []
    for t in teachers:
        sj = list(teacher_subjects.get(t.id, []))
        st = session_map.get(t.id, {'count': 0, 'last': None})

        result.append({
            'id': t.id,
            'name': t.name,
            'email': t.email,
            'subjects': sj,
            'subject_count': len(sj),
            'sessions_count': st['count'],
            'last_activity': st['last'].isoformat() if st['last'] else None,
        })

    return jsonify({'success': True, 'teachers': result})


@coordinator_bp.route('/students', methods=['GET'])
@token_required
@role_required('coordinator')
def list_students(current_user):
    """Lista alunos do curso com desempenho (otimizado)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    student_ids = _get_course_student_ids(course.id)
    subject_ids = _get_course_subject_ids(course.id)

    if not student_ids:
        return jsonify({'success': True, 'students': []})

    filter_subject = request.args.get('subject_id', type=int)
    filter_status = request.args.get('status')
    search = request.args.get('search', '').strip()

    # Busca no banco filtrando por nome/matrícula usando ILIKE (case-insensitive)
    student_query = User.query.filter(User.id.in_(student_ids))
    if search:
        search_term = f"%{search}%"
        student_query = student_query.filter(
            (User.name.ilike(search_term)) | (User.registration_number.ilike(search_term))
        )
    students = student_query.all()
    filtered_student_ids = [s.id for s in students]

    target_subjects = [filter_subject] if filter_subject else subject_ids

    # Carregando Participação (LiveActivities respondidas) para simular engajamento num agrupamento
    activity_stats = []
    if filtered_student_ids and target_subjects:
        activity_stats = (
            db.session.query(
                LiveActivityResponse.student_id,
                func.count(LiveActivityResponse.id).label('activities_count'),
                func.max(LiveActivityResponse.created_at).label('last_activity')
            )
            .join(LiveActivity, LiveActivity.id == LiveActivityResponse.activity_id)
            .outerjoin(TranscriptionSession, TranscriptionSession.id == LiveActivity.session_id)
            .filter(
                LiveActivityResponse.student_id.in_(filtered_student_ids),
                TranscriptionSession.subject_id.in_(target_subjects)
            )
            .group_by(LiveActivityResponse.student_id)
            .all()
        )
    activity_map = {row.student_id: row for row in activity_stats}
    
    from datetime import datetime
    now = datetime.utcnow()

    result = []
    for st in students:
        act_stat = activity_map.get(st.id)
        
        att_count = act_stat.activities_count if act_stat else 0
        soc_count = 0 # Feature socrática será adicionada em outro épico
        
        # Métrica 1: Risco de Evasão baseado na última atividade
        last_date = st.created_at
        if hasattr(st, 'last_login') and st.last_login:
            last_date = st.last_login
            
        if act_stat and act_stat.last_activity and act_stat.last_activity > last_date:
            last_date = act_stat.last_activity
            
        days_inactive = (now - last_date).days if last_date else 0
        
        status = 'no_data'
        if days_inactive <= 14:
            status = 'doing_well' # Ativo/Engajado
        elif days_inactive <= 30:
            status = 'attention' # Distante/Atenção
        else:
            status = 'needs_help' # Risco de Evasão (Sumido)

        if filter_status and status != filter_status:
            continue

        result.append({
            'student_id': st.id,
            'student_name': st.name,
            'email': st.email,
            'registration_number': st.registration_number,
            'attendance_count': att_count,
            'socratic_sessions': soc_count,
            'days_inactive': days_inactive,
            'last_active': last_date.isoformat() if last_date else None,
            'status': status,
        })

    # Ordena pelo risco de evasão (quem está sumido há mais tempo no topo)
    result.sort(key=lambda s: s['days_inactive'], reverse=True)

    return jsonify({'success': True, 'students': result})


@coordinator_bp.route('/recaps', methods=['GET'])
@token_required
@role_required('coordinator')
def list_recaps(current_user):
    """Recaps agrupados por disciplina (otimizado)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    subject_ids = _get_course_subject_ids(course.id)
    if not subject_ids:
        return jsonify({'success': True, 'subjects': []})

    subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all()

    # Busca recaps e professores num único JOIN
    recaps_query = (
        db.session.query(LessonRecap, User.name.label('teacher_name'))
        .outerjoin(User, User.id == LessonRecap.teacher_id)
        .filter(LessonRecap.subject_id.in_(subject_ids))
        .order_by(LessonRecap.created_at.desc())
        .all()
    )

    # Organiza recaps por disciplina
    recaps_by_subject = {}
    for recap, t_name in recaps_query:
        recaps_by_subject.setdefault(recap.subject_id, []).append({
            'id': recap.id,
            'session_id': recap.session_id,
            'title': recap.title,
            'ai_summary': recap.ai_summary,
            'teacher_name': t_name or 'Desconhecido',
            'shared_with_students': recap.shared_with_students,
            'created_at': recap.created_at.isoformat() if recap.created_at else None,
        })

    grouped = []
    for sub in subjects:
        recap_list = recaps_by_subject.get(sub.id, [])
        grouped.append({
            'subject_id': sub.id,
            'subject_name': sub.name,
            'subject_code': sub.code,
            'recap_count': len(recap_list),
            'recaps': recap_list,
        })

    grouped.sort(key=lambda g: g['subject_name'])

    return jsonify({'success': True, 'subjects': grouped})


@coordinator_bp.route('/recaps/<int:recap_id>', methods=['GET'])
@token_required
@role_required('coordinator')
def get_recap(current_user, recap_id):
    """Obter recap individual."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    recap = LessonRecap.query.get(recap_id)
    if not recap:
        return jsonify({'success': False, 'error': 'Recap não encontrado'}), 404

    subject_ids = _get_course_subject_ids(course.id)
    if recap.subject_id not in subject_ids:
        return jsonify({'success': False, 'error': 'Recap não pertence ao seu curso'}), 403

    teacher = User.find_by_id(recap.teacher_id) if recap.teacher_id else None
    subject = Subject.query.get(recap.subject_id)

    return jsonify({
        'success': True,
        'recap': {
            'id': recap.id,
            'session_id': recap.session_id,
            'subject_id': recap.subject_id,
            'subject_name': subject.name if subject else None,
            'teacher_id': recap.teacher_id,
            'teacher_name': teacher.name if teacher else 'Desconhecido',
            'title': recap.title,
            'ai_summary': recap.ai_summary,
            'recap_data': recap.recap_data,
            'shared_with_students': recap.shared_with_students,
            'created_at': recap.created_at.isoformat() if recap.created_at else None,
        }
    })


# ═══════════════════════════════════════════════════════════════
#  GESTÃO DE TURMAS
# ═══════════════════════════════════════════════════════════════

@coordinator_bp.route('/classes', methods=['GET'])
@token_required
@role_required('coordinator')
def list_classes(current_user):
    """Listar turmas do curso (otimizado)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    classes = Class.query.filter_by(course_id=course.id).order_by(Class.year.desc(), Class.semester.desc()).all()
    class_ids = [c.id for c in classes]

    if not class_ids:
        return jsonify({'success': True, 'classes': []})

    # Total de estudantes por turma
    enrollments_counts = (
        db.session.query(Enrollment.class_id, func.count('*'))
        .filter(Enrollment.class_id.in_(class_ids))
        .group_by(Enrollment.class_id)
        .all()
    )
    enroll_map = {e[0]: e[1] for e in enrollments_counts}

    # Professores únicos por turma
    teachers_counts = (
        db.session.query(Teaching.class_id, func.count(distinct(Teaching.teacher_id)))
        .filter(Teaching.class_id.in_(class_ids))
        .group_by(Teaching.class_id)
        .all()
    )
    teach_map = {t[0]: t[1] for t in teachers_counts}

    # Disciplinas únicas por turma
    subject_map = {}
    teachings = (
        db.session.query(Teaching.class_id, Subject.name)
        .join(Subject, Subject.id == Teaching.subject_id)
        .filter(Teaching.class_id.in_(class_ids))
        .all()
    )
    for class_id, s_name in teachings:
        subject_map.setdefault(class_id, set()).add(s_name)

    result = []
    for cls in classes:
        result.append({
            **cls.to_dict(),
            'student_count': enroll_map.get(cls.id, 0),
            'teacher_count': teach_map.get(cls.id, 0),
            'subjects': list(subject_map.get(cls.id, [])),
        })

    return jsonify({'success': True, 'classes': result})


@coordinator_bp.route('/classes/<int:class_id>/details', methods=['GET'])
@token_required
@role_required('coordinator')
def get_class_details(current_user, class_id):
    """Visualização de raio-x da turma: Alunos, Professores e Disciplinas."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    cls = Class.query.get(class_id)
    if not cls or cls.course_id != course.id:
        return jsonify({'success': False, 'message': 'Turma não encontrada'}), 404

    # 1. Disciplinas desta turma
    class_subjects_query = (
        db.session.query(Subject)
        .join(Teaching, Teaching.subject_id == Subject.id)
        .filter(Teaching.class_id == class_id)
        .distinct()
        .all()
    )
    subjects_dict = {subj.id: {'id': subj.id, 'name': subj.name, 'code': subj.code} for subj in class_subjects_query}

    # 2. Professores da turma (agrupando por disciplinas lecionadas nela)
    teachings = (
        db.session.query(Teaching, User.name, User.email)
        .join(User, User.id == Teaching.teacher_id)
        .filter(Teaching.class_id == class_id)
        .all()
    )
    
    teachers_map = {}
    for t_obj, t_name, t_email in teachings:
        tid = t_obj.teacher_id
        if tid not in teachers_map:
            teachers_map[tid] = {
                'id': tid,
                'name': t_name,
                'email': t_email,
                'subjects': []
            }
        subj_data = subjects_dict.get(t_obj.subject_id)
        if subj_data:
            teachers_map[tid]['subjects'].append(subj_data)

    # 3. Alunos matriculados (agrupando quais disciplinas eles participam dentro desta turma)
    enrollments = (
        db.session.query(Enrollment, User.name, User.email)
        .join(User, User.id == Enrollment.student_id)
        .filter(Enrollment.class_id == class_id)
        .all()
    )

    students_map = {}
    for e_obj, s_name, s_email in enrollments:
        sid = e_obj.student_id
        if sid not in students_map:
            students_map[sid] = {
                'id': sid,
                'name': s_name,
                'email': s_email,
                'enrolled_subjects': []
            }
        subj_data = subjects_dict.get(e_obj.subject_id)
        if subj_data:
            students_map[sid]['enrolled_subjects'].append(subj_data)

    return jsonify({
        'success': True,
        'class_info': cls.to_dict(),
        'subjects': list(subjects_dict.values()),
        'teachers': list(teachers_map.values()),
        'students': list(students_map.values())
    })

@coordinator_bp.route('/classes', methods=['POST'])
@token_required
@role_required('coordinator')
def create_class(current_user):
    """Criar nova turma."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    data = request.get_json()
    name = data.get('name', '').strip()
    semester = data.get('semester', '').strip()
    year = data.get('year')

    if not all([name, semester, year]):
        return jsonify({'success': False, 'message': 'Nome, semestre e ano são obrigatórios'}), 400

    new_class = Class(
        course_id=course.id,
        name=name,
        semester=semester,
        year=int(year),
    )
    db.session.add(new_class)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Turma "{name}" criada com sucesso',
        'class': new_class.to_dict(),
    }), 201


@coordinator_bp.route('/classes/<int:class_id>', methods=['PUT'])
@token_required
@role_required('coordinator')
def update_class(current_user, class_id):
    """Editar turma."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    cls = Class.query.get(class_id)
    if not cls or cls.course_id != course.id:
        return jsonify({'success': False, 'message': 'Turma não encontrada no seu curso'}), 404

    data = request.get_json()
    if 'name' in data:
        cls.name = data['name'].strip()
    if 'semester' in data:
        cls.semester = data['semester'].strip()
    if 'year' in data:
        cls.year = int(data['year'])

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Turma atualizada com sucesso',
        'class': cls.to_dict(),
    })


@coordinator_bp.route('/classes/<int:class_id>', methods=['DELETE'])
@token_required
@role_required('coordinator')
def delete_class(current_user, class_id):
    """Fechar/excluir turma."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    cls = Class.query.get(class_id)
    if not cls or cls.course_id != course.id:
        return jsonify({'success': False, 'message': 'Turma não encontrada no seu curso'}), 404

    enrollment_count = Enrollment.query.filter_by(class_id=class_id).count()
    teaching_count = Teaching.query.filter_by(class_id=class_id).count()

    db.session.delete(cls)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Turma fechada. {enrollment_count} matrículas e {teaching_count} vínculos removidos.',
    })


@coordinator_bp.route('/classes/<int:class_id>/assign-teacher', methods=['POST'])
@token_required
@role_required('coordinator')
def assign_teacher_to_class(current_user, class_id):
    """Atribuir professor a turma e disciplina."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    cls = Class.query.get(class_id)
    if not cls or cls.course_id != course.id:
        return jsonify({'success': False, 'message': 'Turma não encontrada'}), 404

    data = request.get_json()
    teacher_id = data.get('teacher_id')
    subject_id = data.get('subject_id')
    schedule = data.get('schedule', '')
    location = data.get('location', '')

    if not all([teacher_id, subject_id]):
        return jsonify({'success': False, 'message': 'teacher_id e subject_id são obrigatórios'}), 400

    # Verificar se já existe
    existing = Teaching.query.filter_by(
        teacher_id=teacher_id, subject_id=subject_id, class_id=class_id
    ).first()
    if existing:
        return jsonify({'success': False, 'message': 'Professor já atribuído a esta disciplina nesta turma'}), 409

    teaching = Teaching(
        teacher_id=teacher_id,
        subject_id=subject_id,
        class_id=class_id,
        schedule=schedule,
        location=location,
    )
    db.session.add(teaching)
    db.session.commit()

    teacher = User.find_by_id(teacher_id)
    subject = Subject.query.get(subject_id)

    return jsonify({
        'success': True,
        'message': f'{teacher.name} atribuído a {subject.name} na turma {cls.name}',
    }), 201


@coordinator_bp.route('/classes/<int:class_id>/remove-teacher', methods=['DELETE'])
@token_required
@role_required('coordinator')
def remove_teacher_from_class(current_user, class_id):
    """Remover professor de turma."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    cls = Class.query.get(class_id)
    if not cls or cls.course_id != course.id:
        return jsonify({'success': False, 'message': 'Turma não encontrada'}), 404

    data = request.get_json()
    teacher_id = data.get('teacher_id')
    subject_id = data.get('subject_id')

    teaching = Teaching.query.filter_by(
        teacher_id=teacher_id, subject_id=subject_id, class_id=class_id
    ).first()

    if not teaching:
        return jsonify({'success': False, 'message': 'Vínculo não encontrado'}), 404

    db.session.delete(teaching)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Professor removido da turma com sucesso'})


# ═══════════════════════════════════════════════════════════════
#  GESTÃO DE DISCIPLINAS
# ═══════════════════════════════════════════════════════════════

@coordinator_bp.route('/subjects/<int:subject_id>', methods=['PUT'])
@token_required
@role_required('coordinator')
def update_subject(current_user, subject_id):
    """Editar disciplina (nome, créditos, ementa/descrição)."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    subject_ids = _get_course_subject_ids(course.id)
    if subject_id not in subject_ids:
        return jsonify({'success': False, 'message': 'Disciplina não pertence ao seu curso'}), 403

    subject = Subject.query.get(subject_id)
    if not subject:
        return jsonify({'success': False, 'message': 'Disciplina não encontrada'}), 404

    data = request.get_json()
    if 'name' in data:
        subject.name = data['name'].strip()
    if 'credits' in data:
        subject.credits = int(data['credits'])
    if 'description' in data:
        subject.description = data['description'].strip()
    if 'image_url' in data:
        subject.image_url = data['image_url']

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Disciplina atualizada com sucesso',
        'subject': subject.to_dict(),
    })


@coordinator_bp.route('/subjects/<int:subject_id>/assign-teacher', methods=['POST'])
@token_required
@role_required('coordinator')
def assign_teacher_to_subject(current_user, subject_id):
    """Designar professor para disciplina."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    subject_ids = _get_course_subject_ids(course.id)
    if subject_id not in subject_ids:
        return jsonify({'success': False, 'message': 'Disciplina não pertence ao seu curso'}), 403

    data = request.get_json()
    teacher_id = data.get('teacher_id')
    class_id = data.get('class_id')
    schedule = data.get('schedule', '')
    location = data.get('location', '')

    if not teacher_id:
        return jsonify({'success': False, 'message': 'teacher_id é obrigatório'}), 400

    # Se não informar class_id, usar a primeira turma do curso
    if not class_id:
        first_class = Class.query.filter_by(course_id=course.id).first()
        if not first_class:
            return jsonify({'success': False, 'message': 'Nenhuma turma encontrada no curso'}), 400
        class_id = first_class.id

    existing = Teaching.query.filter_by(
        teacher_id=teacher_id, subject_id=subject_id, class_id=class_id
    ).first()
    if existing:
        return jsonify({'success': False, 'message': 'Professor já atribuído a esta disciplina'}), 409

    teaching = Teaching(
        teacher_id=teacher_id,
        subject_id=subject_id,
        class_id=class_id,
        schedule=schedule,
        location=location,
    )
    db.session.add(teaching)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Professor designado com sucesso'}), 201


@coordinator_bp.route('/subjects/<int:subject_id>/remove-teacher/<int:teacher_id>', methods=['DELETE'])
@token_required
@role_required('coordinator')
def remove_teacher_from_subject(current_user, subject_id, teacher_id):
    """Remover professor de disciplina."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    subject_ids = _get_course_subject_ids(course.id)
    if subject_id not in subject_ids:
        return jsonify({'success': False, 'message': 'Disciplina não pertence ao seu curso'}), 403

    teachings = Teaching.query.filter_by(teacher_id=teacher_id, subject_id=subject_id).all()
    if not teachings:
        return jsonify({'success': False, 'message': 'Professor não encontrado nesta disciplina'}), 404

    for t in teachings:
        db.session.delete(t)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Professor removido da disciplina'})


# ═══════════════════════════════════════════════════════════════
#  NOTIFICAÇÕES
# ═══════════════════════════════════════════════════════════════

@coordinator_bp.route('/notifications/send', methods=['POST'])
@token_required
@role_required('coordinator')
def send_notification(current_user):
    """Enviar notificação para alunos e/ou professores do curso."""
    course, err = _verify_coordinator(current_user)
    if err:
        return err

    data = request.get_json()
    title = data.get('title', '').strip()
    message = data.get('message', '').strip()
    target = data.get('target', 'all')  # 'students', 'teachers', 'all'
    subject_id = data.get('subject_id')  # Opcional: filtrar por disciplina

    if not all([title, message]):
        return jsonify({'success': False, 'message': 'Título e mensagem são obrigatórios'}), 400

    recipient_ids = set()
    subject_name = None

    if subject_id:
        subject = Subject.query.get(subject_id)
        subject_name = subject.name if subject else None

        if target in ('students', 'all'):
            enrollments = Enrollment.query.filter_by(subject_id=subject_id).all()
            recipient_ids.update(e.student_id for e in enrollments)

        if target in ('teachers', 'all'):
            teachings = Teaching.query.filter_by(subject_id=subject_id).all()
            recipient_ids.update(t.teacher_id for t in teachings)
    else:
        if target in ('students', 'all'):
            recipient_ids.update(_get_course_student_ids(course.id))

        if target in ('teachers', 'all'):
            recipient_ids.update(_get_course_teacher_ids(course.id))

    if not recipient_ids:
        return jsonify({'success': False, 'message': 'Nenhum destinatário encontrado'}), 400

    # Criar notificações
    from app.routes.notification_routes import _create_user_notifications, _ensure_user_notifications_table
    _ensure_user_notifications_table()

    sent_count = _create_user_notifications(
        recipient_ids=list(recipient_ids),
        title=title,
        message=message,
        notif_type='notice',
        subject_name=subject_name,
        source_type='coordinator_notification',
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Notificação enviada com sucesso',
        'sent_count': sent_count,
        'target': target,
    }), 201
