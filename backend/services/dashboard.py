from __future__ import annotations

from datetime import date, datetime, time
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

        if slot.day_of_week == today_name:
            if start_time and start_time >= current_time:
                candidate_slots.append((day_index, start_time, slot))
        else:
            candidate_slots.append((day_index, start_time, slot))

    if not candidate_slots:
        return None

    candidate_slots.sort(key=lambda item: (item[0], item[1]))
    slot = candidate_slots[0][2]
    course = db.query(models.Course).filter(models.Course.id == slot.course_id).first()

    if course is None:
        return None

    return {
        "id": slot.id,
        "course_name": course.name,
        "course_type": course.type,
        "day_of_week": slot.day_of_week,
        "start_time": _serialize_time(slot.start_time),
        "end_time": _serialize_time(slot.end_time),
        "room": slot.room,
        "instructor": course.instructor,
    }


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
        course = db.query(models.Course).filter(models.Course.id == slot.course_id).first()
        if not course:
            continue

        classes_today.append(
            {
                "id": slot.id,
                "course_id": slot.course_id,
                "course_name": course.name,
                "course_type": course.type,
                "start_time": _serialize_time(slot.start_time),
                "end_time": _serialize_time(slot.end_time),
                "room": slot.room,
                "instructor": course.instructor,
                "status": _class_status(slot.start_time, slot.end_time),
            }
        )

    urgent_tasks = (
        db.query(models.Task)
        .filter(models.Task.status != "Completed")
        .all()
    )

    urgent_items = []
    for task in urgent_tasks:
        item = _build_item_from_task(db, task)
        urgency = item["urgency"]
        if urgency["days_left"] is None:
            continue
        if urgency["days_left"] <= 7 or urgency["is_overdue"]:
            urgent_items.append(item)

    urgent_items.sort(
        key=lambda item: (
            item["urgency"]["is_overdue"],
            item["urgency"]["days_left"] if item["urgency"]["days_left"] is not None else 999,
            item["urgency"]["score"],
        ),
        reverse=False,
    )

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

    return {
        "date": date.today().isoformat(),
        "day_of_week": today_name,
        "classes_today": classes_today,
        "next_class": _get_next_class(db),
        "urgent_items": urgent_items[:5],
        "top_actions": top_actions,
    }
