from __future__ import annotations

import argparse
from datetime import date, datetime, time, timedelta

from database import Base, SessionLocal, engine
import models


def reset_database(db):
    for model in (
        models.TeacherQuestion,
        models.ExamTopic,
        models.ExamPlan,
        models.StudySession,
        models.InboxItem,
        models.Submission,
        models.Subtask,
        models.ScheduleException,
        models.Task,
        models.Lab,
        models.Lecture,
        models.ClassSchedule,
        models.Resource,
        models.Note,
        models.Attachment,
        models.Course,
    ):
        db.query(model).delete()
    db.commit()


def add_course(db, name, course_type, instructor, color_tag):
    course = models.Course(name=name, type=course_type, instructor=instructor, color_tag=color_tag, is_active=True)
    db.add(course)
    db.flush()
    return course


def add_schedule(db, course, day, start_h, start_m, end_h, end_m, room):
    slot = models.ClassSchedule(
        course_id=course.id,
        day_of_week=day,
        start_time=time(start_h, start_m),
        end_time=time(end_h, end_m),
        room=room,
    )
    db.add(slot)
    db.flush()
    return slot


def add_task(db, course, title, task_type, due_offset, minutes, priority="Medium", status="Not Started"):
    task = models.Task(
        course_id=course.id,
        title=title,
        task_type=task_type,
        description=f"Demo work item for {course.name}: {title}",
        due_date=date.today() + timedelta(days=due_offset),
        due_time=time(18, 0),
        estimated_minutes=minutes,
        priority=priority,
        status=status,
        progress_percent=100 if status in {"Submitted", "Completed"} else 0,
    )
    db.add(task)
    db.flush()
    return task


def add_fixed_task(db, course, title, task_type, due_date, minutes, priority="High", due_time_value=None):
    task = models.Task(
        course_id=course.id,
        title=title,
        task_type=task_type,
        description=f"Imported LMS submission for {course.name}.",
        due_date=due_date,
        due_time=due_time_value or time(23, 59),
        estimated_minutes=minutes,
        priority=priority,
        status="Not Started",
        progress_percent=0,
        submission_method="LMS upload",
    )
    db.add(task)
    db.flush()
    return task


def add_lecture(db, course, days_ago, topics, concepts, captured=True):
    lecture = models.Lecture(
        course_id=course.id,
        date=date.today() - timedelta(days=days_ago),
        topics_covered=topics,
        key_concepts=concepts,
        teacher_emphasis="Focus on practical understanding and examples.",
        homework_given="Review the examples before the next class.",
        remember_for_next="Bring one question from your revision.",
        confusing_points="Clarify the edge cases.",
        mentioned_quiz_exam="Quiz mentioned for the next unit.",
        is_captured=captured,
        is_reviewed=days_ago > 1,
    )
    db.add(lecture)
    db.flush()
    return lecture


def add_lab(db, course, number, title, due_offset, stage="Implementation"):
    lab = models.Lab(
        course_id=course.id,
        lab_number=number,
        date=date.today() - timedelta(days=1),
        experiment_title=title,
        instructions="Implement the experiment, test it, and prepare a short report.",
        pipeline_stage=stage,
        status="Submitted" if stage == "Submission" else "In Progress",
        due_date=date.today() + timedelta(days=due_offset),
    )
    db.add(lab)
    db.flush()
    return lab


def seed_demo_data(reset: bool = True):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if reset:
            reset_database(db)

        course_specs = [
            ("Compiler Construction", "theory", "Dr. Ahmed", "#2563EB"),
            ("Machine Learning", "theory", "Dr. Fatima", "#7C3AED"),
            ("Web Engineering", "theory", "Dr. Khan", "#0891B2"),
            ("Linear Algebra", "theory", "Dr. Rahman", "#059669"),
            ("Operating Systems", "theory", "Dr. Ali", "#D97706"),
            ("Computer Architecture", "theory", "Dr. Sana", "#DC2626"),
            ("Compiler Construction Lab", "lab", "Engr. Ahmed", "#1D4ED8"),
            ("Machine Learning Lab", "lab", "Engr. Fatima", "#6D28D9"),
            ("Web Engineering Lab", "lab", "Engr. Khan", "#0E7490"),
            ("Operating Systems Lab", "lab", "Engr. Ali", "#B45309"),
        ]
        courses = {name: add_course(db, name, kind, instructor, color) for name, kind, instructor, color in course_specs}

        timetable = [
            ("Compiler Construction Lab", "Monday", 9, 0, 10, 40, "LR-107, B-V"),
            ("Compiler Construction Lab", "Monday", 11, 10, 12, 0, "LR-107, B-V"),
            ("Machine Learning Lab", "Monday", 14, 0, 15, 40, "R-209, B-V"),
            ("Machine Learning Lab", "Monday", 16, 10, 17, 50, "R-209, B-V"),
            ("Compiler Construction", "Tuesday", 9, 0, 10, 40, "R-307, B-V"),
            ("Web Engineering Lab", "Tuesday", 14, 0, 15, 40, "LR-011, B-V"),
            ("Web Engineering Lab", "Tuesday", 16, 10, 17, 50, "LR-011, B-V"),
            ("Web Engineering", "Wednesday", 9, 0, 10, 40, "R-012, B-V"),
            ("Machine Learning", "Wednesday", 11, 10, 12, 0, "R-206, B-V"),
            ("Machine Learning", "Wednesday", 12, 10, 13, 0, "R-206, B-V"),
            ("Linear Algebra", "Wednesday", 14, 0, 15, 40, "R-001, B-V"),
            ("Linear Algebra", "Wednesday", 16, 10, 17, 50, "R-001, B-V"),
            ("Operating Systems Lab", "Thursday", 9, 0, 10, 40, "LR-010, B-V"),
            ("Operating Systems Lab", "Thursday", 11, 10, 12, 0, "LR-010, B-V"),
            ("Operating Systems", "Thursday", 14, 0, 15, 40, "R-001, B-V"),
            ("Computer Architecture", "Friday", 14, 0, 15, 40, "R-003, B-V"),
            ("Computer Architecture", "Friday", 16, 10, 17, 50, "R-003, B-V"),
        ]
        slots = [add_schedule(db, courses[name], day, sh, sm, eh, em, room) for name, day, sh, sm, eh, em, room in timetable]

        today_slot = next((slot for slot in slots if slot.day_of_week == date.today().strftime("%A")), slots[0])
        db.add(models.ScheduleException(
            schedule_id=today_slot.id,
            exception_date=date.today() + timedelta(days=7),
            is_cancelled=True,
            note="University holiday demo exception",
        ))

        for index, (name, _, _, _) in enumerate(course_specs):
            course = courses[name]
            add_lecture(db, course, 2, f"{name}: core concepts", "Definitions, examples, and practical trade-offs.")
            add_task(db, course, f"{name} weekly review", "Reading", index % 6 + 1, 30, "Low")

        assignment = add_task(db, courses["Machine Learning"], "Implement linear regression", "Assignment", 1, 120, "High")
        db.add(models.Subtask(task_id=assignment.id, title="Prepare dataset", is_done=True))
        db.add(models.Subtask(task_id=assignment.id, title="Evaluate model", is_done=False))
        submitted = add_task(db, courses["Web Engineering"], "Landing page submission", "Assignment", -1, 90, "High", "Submitted")
        db.add(models.Submission(task_id=submitted.id, method="LMS upload", proof_link="demo://submission"))

        # LMS deadlines supplied from the student's course dashboard.
        add_fixed_task(db, courses["Operating Systems Lab"], "Lab 2 - Sec E", "Lab Assignment", date(2026, 9, 2), 90)
        add_fixed_task(db, courses["Compiler Construction"], "Introduction to Compiler Technology - (2 Marks)", "Assignment", date(2026, 9, 4), 60)
        add_fixed_task(db, courses["Machine Learning Lab"], "Lab 2 Submission", "Lab Submission", date(2026, 9, 7), 120)
        add_fixed_task(db, courses["Web Engineering Lab"], "Assignment — Lab 04 CSS layout", "Assignment", date(2026, 9, 8), 90)
        add_fixed_task(db, courses["Web Engineering Lab"], "Quiz 1 - HTML", "Quiz", date(2026, 9, 8), 30, "Medium", time(14, 36))
        add_fixed_task(db, courses["Compiler Construction"], "CFG - Elimination of Ambiguity, Nondeterminism and Left Recursion - (3 Marks)", "Assignment", date(2026, 9, 13), 90)
        add_fixed_task(db, courses["Operating Systems Lab"], "Project Proposal", "Project", date(2026, 9, 25), 180)

        lab = add_lab(db, courses["Compiler Construction Lab"], 1, "Build a lexical analyzer", 3)
        db.add(models.Submission(lab_id=lab.id, method="Lab portal", proof_link="demo://lab-report"))
        add_lab(db, courses["Machine Learning Lab"], 2, "Train a classification model", 5, "Testing")
        add_lab(db, courses["Web Engineering Lab"], 3, "Build REST API endpoints", 7, "Report")
        add_lab(db, courses["Operating Systems Lab"], 4, "Process scheduling simulation", 10, "Understanding")

        for course in courses.values():
            db.add(models.ExamPlan(course_id=course.id, exam_date=date.today() + timedelta(days=28), syllabus="Units 1-5"))
            db.add(models.ExamTopic(course_id=course.id, name="Core definitions", is_done=True))
            db.add(models.ExamTopic(course_id=course.id, name="Practice problems", is_done=False))
            db.add(models.TeacherQuestion(course_id=course.id, text="What should I review before the next class?"))

        db.add(models.InboxItem(text="Ask about the compiler project rubric", kind="question"))
        db.add(models.InboxItem(text="Remember to bring lab report printout", kind="reminder"))
        now = datetime.utcnow()
        db.add(models.StudySession(
            course_id=courses["Machine Learning"].id,
            planned_minutes=45,
            started_at=now - timedelta(days=1, minutes=45),
            ended_at=now - timedelta(days=1),
            outcome="Reviewed gradient descent",
        ))
        db.commit()
        print(f"Demo data inserted: {len(courses)} courses, {len(slots)} timetable slots, full workflow samples.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed StudyOS with the full university timetable and workflow demo data.")
    parser.add_argument("--no-reset", action="store_true", help="Keep existing records and append demo data.")
    args = parser.parse_args()
    seed_demo_data(reset=not args.no_reset)
