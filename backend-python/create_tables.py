from app import create_app, db
from app.models.study_material import StudyMaterial

app = create_app()
with app.app_context():
    db.create_all()
    print("Tables created successfully, including StudyMaterial.")
