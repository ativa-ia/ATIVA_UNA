from app import create_app, db
from app.models.transcription_session import LiveActivity
import json

app = create_app()

with app.app_context():
    # Get last quiz activity
    activity = LiveActivity.query.filter_by(activity_type='quiz').order_by(LiveActivity.id.desc()).first()
    
    if activity:
        print(f"Activity ID: {activity.id}")
        print(f"Title: {activity.title}")
        print("Questions:")
        content = activity.content
        if isinstance(content, str):
            content = json.loads(content)
            
        questions = content.get('questions', [])
        for i, q in enumerate(questions):
            try:
                correct = q.get('correct')
            except:
                correct = 'Error'
            print(f"Q{i}: {q.get('question', '')[:50]}... | Correct: {correct}")
            
        # Also check responses
        print("-" * 20)
        print("Last Responses:")
        for resp in activity.responses:
            answers = resp.response_data.get('answers', {})
            print(f"RespID: {resp.id} | Answers: {answers} | Score: {resp.score}")
    else:
        print("No quiz found")
