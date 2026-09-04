from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

import models
from services.urgency import compute_urgency


DAY_ORDER = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}


def _serialize_time(value: Optional[time]) -> Optional[str]:
    if value is None:
        return None
    return value.strftime("%H:%M")


def _class_status(start_time: Optional[time], end_time: Optional[time]) -> str:
    if start_time is None or end_time is None:
        return "Upcoming"

    now = datetime.now().time()
    if start_time <= now <= end_time:
        return "In Progress"
    if now < start_time:
        return "Upcoming"
    return "Completed"


def _exception_for_slot(db: Session, slot_id: int, target_date: date):
    return (
        db.query(models.ScheduleException)
        .filter(
            models.ScheduleException.schedule_id == slot_id,
            models.ScheduleException.exception_date == target_date,
        )
        .first()
    )


def _dashboard_priority_rank(item: Dict[str, Any]) -> tuple:
    """
    Ranks urgent items for display order, matching the dashboard priority
    order from the product spec: things due today first, THEN overdue
    work, THEN upcoming items soonest-first.

    Without this, sorting by is_overdue as the primary key would put
    ALL overdue items after ALL non-overdue items - meaning a task
    overdue by 5 days would rank below a task simply due in 7 days,
    which contradicts the spec's explicit priority order.
    """
    days_left = item["urgency"]["days_left"]
    is_overdue = item["urgency"]["is_overdue"]

    if days_left == 0:
        return (0, 0)
    if is_overdue:
        return (1, days_left)  # more overdue (more negative) sorts first
    return (2, days_left)  # future, soonest first


def _get_course_name(db: Session, course_id: int) -> Optional[str]:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    return course.name if course else None


def _get_next_class(db: Session) -> Optional[Dict[str, Any]]:
    slots = db.query(models.ClassSchedule).all()
    if not slots:
        return None

    today_name = date.today().strftime("%A")
    now = datetime.now()

    candidate_slots = []
    for slot in slots:
        course = db.query(models.Course).filter(models.Course.id == slot.course_id).first()
        if not course:
            continue

        day_index = DAY_ORDER.get(slot.day_of_week, 7)
        today_index = DAY_ORDER.get(today_name, 7)
        current_time = now.time()
        start_time = slot.start_time

        exception = _exception_for_slot(db, slot.id, date.today())
        if exception and exception.is_cancelled:
            continue
        effective_start = exception.start_time if exception and exception.start_time else slot.start_time
        effective_end = exception.end_time if exception and exception.end_time else slot.end_time
        if slot.day_of_week == today_name:
            if effective_start and effective_start >= current_time:
                candidate_slots.append((day_index, effective_start, slot, exception, effective_end))
        else:
            candidate_slots.append((day_index, effective_start, slot, exception, effective_end))

    if not candidate_slots:
        return None

    candidate_slots.sort(key=lambda item: (item[0], item[1]))
    _, effective_start, slot, exception, effective_end = candidate_slots[0]
    course = db.query(models.Course).filter(models.Course.id == slot.course_id).first()

    if course is None:
        return None

    return {
        "id": slot.id,
        "course_name": course.name,
        "course_type": course.type,
        "day_of_week": slot.day_of_week,
        "start_time": _serialize_time(effective_start),
        "end_time": _serialize_time(effective_end),
        "room": exception.room if exception and exception.room else slot.room,
        "instructor": course.instructor,
    }


def _get_tomorrow_preparation(db: Session) -> List[Dict[str, Any]]:
    tomorrow = date.today() + timedelta(days=1)
    tomorrow_name = tomorrow.strftime("%A")
    slots = (
        db.query(models.ClassSchedule)
        .filter(models.ClassSchedule.day_of_week == tomorrow_name)
        .order_by(models.ClassSchedule.start_time.asc())
        .all()
    )
    lectures = db.query(models.Lecture).all()
    questions = db.query(models.TeacherQuestion).all()
    tasks = db.query(models.Task).all()
    preparation = []

    for slot in slots:
        exception = _exception_for_slot(db, slot.id, tomorrow)
        if exception and exception.is_cancelled:
            continue
        course = db.query(models.Course).filter(models.Course.id == slot.course_id).first()
        if not course:
            continue
        last_lecture = max(
            (lecture for lecture in lectures if lecture.course_id == course.id),
            key=lambda lecture: lecture.date,
            default=None,
        )
        course_questions = [
            question.text
            for question in questions
            if question.course_id == course.id and not question.is_done
        ][:3]
        due_tasks = [
            task.title
            for task in tasks
            if task.course_id == course.id
            and task.status not in {"Completed", "Submitted"}
            and task.due_date is not None
            and task.due_date <= tomorrow
        ][:3]
        effective_start = exception.start_time if exception and exception.start_time else slot.start_time
        effective_end = exception.end_time if exception and exception.end_time else slot.end_time
        preparation.append({
            "schedule_id": slot.id,
            "course_id": course.id,
            "course_name": course.name,
            "course_type": course.type,
            "start_time": _serialize_time(effective_start),
            "end_time": _serialize_time(effective_end),
            "room": exception.room if exception and exception.room else slot.room,
            "last_topic": last_lecture.topics_covered if last_lecture else None,
            "last_lecture_date": last_lecture.date.isoformat() if last_lecture else None,
            "questions_to_ask": course_questions,
            "due_tasks": due_tasks,
        })
    return preparation


def _build_item_from_task(db: Session, task: models.Task) -> Dict[str, Any]:
    urgency = compute_urgency(
        due_date=task.due_date,
        estimated_minutes=task.estimated_minutes,
        priority=task.priority,
        status=task.status,
    )

    course_name = _get_course_name(db, task.course_id)

    return {
        "id": task.id,
        "title": task.title,
        "course_name": course_name,
        "task_type": task.task_type,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "estimated_minutes": task.estimated_minutes,
        "urgency": urgency,
    }


def build_today_dashboard(db: Session) -> Dict[str, Any]:
    today_name = date.today().strftime("%A")

    class_slots = (
        db.query(models.ClassSchedule)
        .filter(models.ClassSchedule.day_of_week == today_name)
        .order_by(models.ClassSchedule.start_time.asc())
        .all()
    )

    classes_today = []
    for slot in class_slots:
        exception = _exception_for_slot(db, slot.id, date.today())
        if exception and exception.is_cancelled:
            continue
        course = db.query(models.Course).filter(models.Course.id == slot.course_id).first()
        if not course:
            continue

        effective_start = exception.start_time if exception and exception.start_time else slot.start_time
        effective_end = exception.end_time if exception and exception.end_time else slot.end_time
        classes_today.append(
            {
                "id": slot.id,
                "course_id": slot.course_id,
                "course_name": course.name,
                "course_type": course.type,
                "start_time": _serialize_time(effective_start),
                "end_time": _serialize_time(effective_end),
                "room": exception.room if exception and exception.room else slot.room,
                "instructor": course.instructor,
                "status": _class_status(slot.start_time, slot.end_time),
            }
        )

    urgent_tasks = [
        task
        for task in db.query(models.Task).all()
        if task.status not in {"Completed", "Submitted"}
    ]

    urgent_items = []
    for task in urgent_tasks:
        item = _build_item_from_task(db, task)
        urgency = item["urgency"]
        if urgency["days_left"] is None:
            continue
        if urgency["days_left"] <= 7 or urgency["is_overdue"]:
            urgent_items.append(item)

    urgent_items.sort(key=_dashboard_priority_rank)

    top_actions = []
    for task in urgent_tasks:
        item = _build_item_from_task(db, task)
        if item["urgency"]["days_left"] is not None:
            top_actions.append(item)

    top_actions.sort(
        key=lambda item: item["urgency"]["score"],
        reverse=True,
    )
    top_actions = top_actions[:5]

    reminders = []
    for item in urgent_items[:3]:
        reminders.append({"kind": "deadline", "title": f"{item['title']} is {item['urgency']['label'].lower()}"})
    uncaptured = (
        db.query(models.Lecture)
        .filter(models.Lecture.is_captured == False)  # noqa: E712
        .order_by(models.Lecture.date.desc())
        .all()
    )
    for lecture in uncaptured[:3]:
        course_name = _get_course_name(db, lecture.course_id)
        reminders.append({"kind": "lecture", "title": f"Capture the {course_name or 'course'} lecture from {lecture.date.isoformat()}"})

    return {
        "date": date.today().isoformat(),
        "day_of_week": today_name,
        "classes_today": classes_today,
        "next_class": _get_next_class(db),
        "tomorrow_preparation": _get_tomorrow_preparation(db),
        "urgent_items": urgent_items[:5],
        "top_actions": top_actions,
        "reminders": reminders[:5],
    }
