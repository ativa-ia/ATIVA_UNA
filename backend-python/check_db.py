from app import create_app, db
from app.models.study_material import StudyMaterial
from app.models.user import User

app = create_app()

with app.app_context():
    materials = StudyMaterial.query.all()
    print(f"Total StudyMaterials: {len(materials)}")
    for m in materials:
        user = User.query.get(m.student_id)
        print(f"ID: {m.id}, Student: {m.student_id} ({user.name if user else 'Unknown'}), Title: {m.title}, URL: {m.content_url}")
