"""
routers/timetable.py

Endpoints for the recurring weekly timetable:
  GET    /api/timetable            -> list all schedule slots (optionally by course or day)
  GET    /api/timetable/{id}       -> get one slot
  POST   /api/timetable            -> create a slot
  PUT    /api/timetable/{id}       -> update a slot
  DELETE /api/timetable/{id}       -> delete a slot

This is intentionally kept simple: no recurrence rules, no exceptions
for holidays, etc. Each row is just "this course happens on this day,
this time, in this room, every week." That's enough to answer "what
classes do I have today" and "what's my next class."
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/timetable", tags=["timetable"])

VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.get("/", response_model=List[schemas.ClassScheduleRead])
def list_schedule(
    course_id: Optional[int] = None,
    day_of_week: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.ClassSchedule)
    if course_id is not None:
        query = query.filter(models.ClassSchedule.course_id == course_id)
    if day_of_week is not None:
        query = query.filter(models.ClassSchedule.day_of_week == day_of_week)
    return query.order_by(models.ClassSchedule.start_time.asc()).all()


@router.post("/", response_model=schemas.ClassScheduleRead, status_code=201)
def create_schedule_slot(payload: schemas.ClassScheduleCreate, db: Session = Depends(get_db)):
    if payload.day_of_week not in VALID_DAYS:
        raise HTTPException(status_code=400, detail=f"day_of_week must be one of: {', '.join(VALID_DAYS)}")

    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    slot = models.ClassSchedule(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.put("/{schedule_id}", response_model=schemas.ClassScheduleRead)
def update_schedule_slot(schedule_id: int, payload: schemas.ClassScheduleUpdate, db: Session = Depends(get_db)):
    slot = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")

    data = payload.model_dump(exclude_unset=True)
    if "day_of_week" in data and data["day_of_week"] not in VALID_DAYS:
        raise HTTPException(status_code=400, detail=f"day_of_week must be one of: {', '.join(VALID_DAYS)}")

    for field, value in data.items():
        setattr(slot, field, value)

    db.commit()
    db.refresh(slot)
    return slot


@router.get("/exceptions", response_model=List[schemas.ScheduleExceptionRead])
def list_schedule_exceptions(
    schedule_id: Optional[int] = None,
    exception_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.ScheduleException)
    if schedule_id is not None:
        query = query.filter(models.ScheduleException.schedule_id == schedule_id)
    if exception_date is not None:
        query = query.filter(models.ScheduleException.exception_date == exception_date)
    return query.order_by(models.ScheduleException.exception_date.asc()).all()


@router.post("/exceptions", response_model=schemas.ScheduleExceptionRead, status_code=201)
def create_schedule_exception(payload: schemas.ScheduleExceptionCreate, db: Session = Depends(get_db)):
    slot = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == payload.schedule_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")
    if not payload.is_cancelled and (payload.start_time is None) != (payload.end_time is None):
        raise HTTPException(status_code=400, detail="start_time and end_time must be provided together")
    exception = models.ScheduleException(**payload.model_dump())
    db.add(exception)
    db.commit()
    db.refresh(exception)
    return exception


@router.delete("/exceptions/{exception_id}", status_code=204)
def delete_schedule_exception(exception_id: int, db: Session = Depends(get_db)):
    exception = db.query(models.ScheduleException).filter(models.ScheduleException.id == exception_id).first()
    if not exception:
        raise HTTPException(status_code=404, detail="Schedule exception not found")
    db.delete(exception)
    db.commit()


@router.get("/{schedule_id}", response_model=schemas.ClassScheduleRead)
def get_schedule_slot(schedule_id: int, db: Session = Depends(get_db)):
    slot = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")
    return slot


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule_slot(schedule_id: int, db: Session = Depends(get_db)):
    slot = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == schedule_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")
    db.delete(slot)
    db.commit()
    return None
