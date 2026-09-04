"""
backend/routers/calendar.py

Provides a simple calendar aggregation endpoint that returns events
for ClassSchedule occurrences, Tasks (with due_date/due_time), Labs
(with due_date), and Lectures (on date) between a given start and end.

MVP: no new DB tables; expands weekly ClassSchedule slots into concrete
occurrences between start and end dates.
"""
from datetime import datetime, date, time, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def weekday_str_to_index(day: str) -> int:
    mapping = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    return mapping[day.lower()]


@router.get("/", response_model=List[schemas.CalendarEvent])
def get_calendar(
    start: date,
    end: date,
    db: Session = Depends(get_db),
):
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")

    events = []

    # 1) ClassSchedule occurrences: expand weekly slots between start and end
    schedules = db.query(models.ClassSchedule).all()
    for s in schedules:
        try:
            weekday = weekday_str_to_index(s.day_of_week)
        except KeyError:
            continue

        # find first date on or after start that matches weekday
        cur = start
        days_ahead = (weekday - cur.weekday() + 7) % 7
        cur = cur + timedelta(days=days_ahead)

        while cur <= end:
            # combine date + start_time / end_time into ISO datetimes
            start_dt = datetime.combine(cur, s.start_time)
            end_dt = datetime.combine(cur, s.end_time)
            events.append(
                {
                    "id": f"schedule-{s.id}-{cur.isoformat()}",
                    "source": "class",
                    "title": f"{s.course.name} ({s.room or 'Room'})",
                    "start": start_dt.isoformat(),
                    "end": end_dt.isoformat(),
                    "course_id": s.course_id,
                    "url": None,
                }
            )
            cur = cur + timedelta(days=7)

    # 2) Tasks with due_date
    tasks = db.query(models.Task).filter(models.Task.due_date != None).all()
    for t in tasks:
        d = t.due_date
        if d >= start and d <= end:
            if t.due_time:
                start_dt = datetime.combine(d, t.due_time)
                end_dt = None
            else:
                start_dt = datetime.combine(d, time(hour=9))
                end_dt = None
            events.append(
                {
                    "id": f"task-{t.id}",
                    "source": "task",
                    "title": f"{t.title} [{t.course.name}]",
                    "start": start_dt.isoformat(),
                    "end": end_dt,
                    "course_id": t.course_id,
                    "url": f"/tasks/{t.id}",
                }
            )

    # 3) Labs with due_date
    labs = db.query(models.Lab).filter(models.Lab.due_date != None).all()
    for l in labs:
        d = l.due_date
        if d >= start and d <= end:
            start_dt = datetime.combine(d, time(hour=9))
            events.append(
                {
                    "id": f"lab-{l.id}",
                    "source": "lab",
                    "title": f"Lab: {l.experiment_title} [{l.course.name}]",
                    "start": start_dt.isoformat(),
                    "end": None,
                    "course_id": l.course_id,
                    "url": f"/labs/{l.id}",
                }
            )

    # 4) Lectures on specific dates
    lectures = db.query(models.Lecture).all()
    for lec in lectures:
        d = lec.date
        if d >= start and d <= end:
            start_dt = datetime.combine(d, time(hour=9))
            events.append(
                {
                    "id": f"lecture-{lec.id}",
                    "source": "lecture",
                    "title": f"Lecture: {lec.course.name}",
                    "start": start_dt.isoformat(),
                    "end": None,
                    "course_id": lec.course_id,
                    "url": f"/lectures/{lec.id}",
                }
            )

    # Sort by start datetime
    def sort_key(e):
        return e["start"] or ""

    events.sort(key=sort_key)
    return events
