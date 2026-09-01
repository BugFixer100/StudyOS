"""
routers/courses.py

Endpoints for managing courses:
  GET    /api/courses          -> list all courses
  GET    /api/courses/{id}     -> get one course
  POST   /api/courses          -> create a course
  PUT    /api/courses/{id}     -> update a course
  DELETE /api/courses/{id}     -> delete a course (and everything under it)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("/", response_model=List[schemas.CourseRead])
def list_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).all()


@router.get("/{course_id}", response_model=schemas.CourseRead)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/", response_model=schemas.CourseRead, status_code=201)
def create_course(payload: schemas.CourseCreate, db: Session = Depends(get_db)):
    course = models.Course(**payload.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.put("/{course_id}", response_model=schemas.CourseRead)
def update_course(course_id: int, payload: schemas.CourseUpdate, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Only update fields that were actually provided in the request.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)  # cascade in models.py removes related tasks/lectures/labs/etc.
    db.commit()
    return None
