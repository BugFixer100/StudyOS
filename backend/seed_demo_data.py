from __future__ import annotations

import argparse
from datetime import date, datetime, time, timedelta

from database import Base, SessionLocal, engine
import models


def reset_database(db):
    db.query(models.Submission).delete()
    db.query(models.Subtask).delete()
    db.query(models.Task).delete()
    db.query(models.Lab).delete()
    db.query(models.Lecture).delete()
    db.query(models.ClassSchedule).delete()
    db.query(models.Resource).delete()
    db.query(models.Note).delete()
    db.query(models.Attachment).delete()
    db.query(models.Course).delete()
    db.commit()


def add_course(db, name, course_type, instructor, color_tag):
    course = models.Course(
        name=name,
        type=course_type,
        instructor=instructor,
        color_tag=color_tag,
        is_active=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def add_schedule(db, course_id, day_of_week, start_h, start_m, end_h, end_m, room):
    slot = models.ClassSchedule(
        course_id=course_id,
        day_of_week=day_of_week,
        start_time=time(start_h, start_m),
        end_time=time(end_h, end_m),
        room=room,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def add_task(db, course_id, title, task_type, due_offset_days, estimated_minutes, priority="High"):
    task = models.Task(
        course_id=course_id,
        title=title,
        task_type=task_type,
        description=f"Demo task for {title}",
        due_date=date.today() + timedelta(days=due_offset_days),
        due_time=time(18, 0),
        estimated_minutes=estimated_minutes,
        priority=priority,
        status="Not Started",
        progress_percent=0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def add_lecture(db, course_id, topics, summary):
    lecture = models.Lecture(
        course_id=course_id,
        date=date.today() - timedelta(days=2),
        topics_covered=topics,
        key_concepts=summary,
        teacher_emphasis="Focus on practical understanding",
        homework_given="Review the notes before next class",
        remember_for_next="Be ready to discuss core examples",
        is_captured=True,
        is_reviewed=False,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture


def seed_demo_data(reset: bool = True):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if reset:
            reset_database(db)

        course = add_course(
            db,
            name="Algorithms",
            course_type="theory",
            instructor="Dr. Khan",
            color_tag="#4A90D9",
        )

        add_course(
            db,
            name="Web Engineering",
            course_type="lab",
            instructor="Engr. Ali",
            color_tag="#28A745",
        )

        today_name = date.today().strftime("%A")
        add_schedule(
            db,
            course.id,
            today_name,
            9,
            0,
            10,
            30,
            "A-101",
        )

        add_schedule(
            db,
            course.id,
            "Thursday",
            14,
            0,
            15,
            30,
            "Lab-2",
        )

        add_task(db, course.id, "Assignment 2", "Assignment", 1, 90, "High")
        add_task(db, course.id, "Practice Quiz Prep", "Quiz Preparation", 3, 45, "Medium")
        add_task(db, course.id, "Read Chapter 5", "Reading", 5, 30, "Low")

        add_lecture(db, course.id, "Sorting and graph traversal", "Focus on time complexity and recursion")

        print("Demo data inserted successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed StudyOS with sample data for dashboard demo.")
    parser.add_argument("--no-reset", action="store_true", help="Keep existing records and just add demo data.")
    args = parser.parse_args()
    seed_demo_data(reset=not args.no_reset)
