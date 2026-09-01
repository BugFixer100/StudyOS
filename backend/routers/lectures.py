"""
routers/lectures.py

Endpoints for lecture records (the "Last Lecture Memory" feature):
  GET    /api/lectures                    -> list lectures (optionally by course)
  GET    /api/lectures/{id}               -> get one lecture
  GET    /api/lectures/course/{course_id}/last  -> most recent lecture for a course
  POST   /api/lectures                    -> create a lecture (2-minute capture)
  PUT    /api/lectures/{id}               -> update a lecture (e.g. mark reviewed)
  DELETE /api/lectures/{id}               -> delete a lecture
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/lectures", tags=["lectures"])


@router.get("/", response_model=List[schemas.LectureRead])
def list_lectures(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Lecture)
    if course_id is not None:
        query = query.filter(models.Lecture.course_id == course_id)
    return query.order_by(models.Lecture.date.desc()).all()


@router.get("/course/{course_id}/last", response_model=schemas.LectureRead)
def get_last_lecture(course_id: int, db: Session = Depends(get_db)):
    """
    Returns the most recent lecture for a course - this is what powers
    the 'Previous Lecture' card and the Pre-Class Quick Review.
    """
    lecture = (
        db.query(models.Lecture)
        .filter(models.Lecture.course_id == course_id)
        .order_by(models.Lecture.date.desc())
        .first()
    )
    if not lecture:
        raise HTTPException(status_code=404, detail="No lectures recorded yet for this course")
    return lecture


@router.get("/{lecture_id}", response_model=schemas.LectureRead)
def get_lecture(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture


@router.post("/", response_model=schemas.LectureRead, status_code=201)
def create_lecture(payload: schemas.LectureCreate, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    data = payload.model_dump()
    # A lecture counts as "captured" if at least one real field was filled in,
    # since the spec allows skipping any/all fields.
    has_content = any(
        data.get(field)
        for field in [
            "topics_covered", "key_concepts", "teacher_emphasis",
            "homework_given", "remember_for_next", "confusing_points",
            "mentioned_quiz_exam",
        ]
    )

    lecture = models.Lecture(**data, is_captured=has_content)
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture


@router.put("/{lecture_id}", response_model=schemas.LectureRead)
def update_lecture(lecture_id: int, payload: schemas.LectureUpdate, db: Session = Depends(get_db)):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lecture, field, value)

    db.commit()
    db.refresh(lecture)
    return lecture


@router.delete("/{lecture_id}", status_code=204)
def delete_lecture(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    db.delete(lecture)
    db.commit()
    return None
