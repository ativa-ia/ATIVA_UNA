# Importar models aqui para facilitar imports
from app.models.user import User
from app.models.course import Course
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.enrollment import Enrollment
from app.models.teaching import Teaching
from app.models.material import Material
from app.models.activity import Activity
from app.models.announcement import Announcement

__all__ = [
    'User',
    'Course',
    'Class',
    'Subject',
    'Enrollment',
    'Teaching',
    'Material',
    'Activity',
    'Announcement'
]
