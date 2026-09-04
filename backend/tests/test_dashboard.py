from datetime import date

from services.dashboard import build_today_dashboard


class DummyQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows


class DummyDB:
    def __init__(self):
        self.courses = []
        self.tasks = []
        self.class_slots = []

    def query(self, model):
        if model.__name__ == "ClassSchedule":
            return DummyQuery(self.class_slots)
        if model.__name__ == "Task":
            return DummyQuery(self.tasks)
        if model.__name__ == "Course":
            return DummyQuery(self.courses)
        return DummyQuery([])


def test_build_today_dashboard_includes_classes_and_top_actions():
    db = DummyDB()

    class Course:
        def __init__(self, id, name, type, instructor):
            self.id = id
            self.name = name
            self.type = type
            self.instructor = instructor

    class ClassSchedule:
        def __init__(self, id, course_id, day_of_week, start_time, end_time, room):
            self.id = id
            self.course_id = course_id
            self.day_of_week = day_of_week
            self.start_time = start_time
            self.end_time = end_time
            self.room = room

    class Task:
        def __init__(self, id, course_id, title, task_type, status, priority, due_date, estimated_minutes):
            self.id = id
            self.course_id = course_id
            self.title = title
            self.task_type = task_type
            self.status = status
            self.priority = priority
            self.due_date = due_date
            self.estimated_minutes = estimated_minutes

    today_name = date.today().strftime("%A")

    course = Course(1, "Algorithms", "theory", "Dr. Khan")
    db.courses.append(course)

    db.class_slots.append(
        ClassSchedule(1, 1, today_name, __import__("datetime").time(9, 0), __import__("datetime").time(10, 30), "A-101")
    )

    db.tasks.append(
        Task(1, 1, "Assignment 2", "Assignment", "Not Started", "High", date.today() + __import__("datetime").timedelta(days=1), 120)
    )

    result = build_today_dashboard(db)

    assert result["day_of_week"] == today_name
    assert len(result["classes_today"]) >= 1
    assert len(result["top_actions"]) >= 1
    assert result["top_actions"][0]["title"] == "Assignment 2"


def test_build_today_dashboard_excludes_submitted_tasks():
    db = DummyDB()

    class Course:
        def __init__(self):
            self.id = 1
            self.name = "Algorithms"
            self.type = "theory"
            self.instructor = None

    class Task:
        def __init__(self):
            self.id = 1
            self.course_id = 1
            self.title = "Submitted assignment"
            self.task_type = "Assignment"
            self.status = "Submitted"
            self.priority = "High"
            self.due_date = date.today()
            self.estimated_minutes = 60

    db.courses.append(Course())
    db.tasks.append(Task())

    result = build_today_dashboard(db)

    assert result["top_actions"] == []
    assert result["urgent_items"] == []
