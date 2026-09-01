"""
routers/labs.py

Endpoints for lab tracking (the pipeline: Task Given -> Understanding ->
Implementation -> Testing -> Report -> Submission -> Viva):
  GET    /api/labs                  -> list labs (optionally by course)
  GET    /api/labs/{id}             -> get one lab
  POST   /api/labs                  -> create a lab
  PUT    /api/labs/{id}             -> update a lab (e.g. move pipeline_stage)
  DELETE /api/labs/{id}             -> delete a lab
  POST   /api/labs/{id}/submit      -> record a submission for a lab
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/labs", tags=["labs"])

# The fixed order of stages, used only to validate incoming updates.
PIPELINE_STAGES = [
    "Task Given",
    "Understanding",
    "Implementation",
    "Testing",
    "Report",
    "Submission",
    "Viva",
]


@router.get("/", response_model=List[schemas.LabRead])
def list_labs(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Lab)
    if course_id is not None:
        query = query.filter(models.Lab.course_id == course_id)
    return query.order_by(models.Lab.due_date.asc().nulls_last()).all()


@router.get("/{lab_id}", response_model=schemas.LabRead)
def get_lab(lab_id: int, db: Session = Depends(get_db)):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")
    return lab


@router.post("/", response_model=schemas.LabRead, status_code=201)
def create_lab(payload: schemas.LabCreate, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    lab = models.Lab(**payload.model_dump())
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return lab


@router.put("/{lab_id}", response_model=schemas.LabRead)
def update_lab(lab_id: int, payload: schemas.LabUpdate, db: Session = Depends(get_db)):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    data = payload.model_dump(exclude_unset=True)
    if "pipeline_stage" in data and data["pipeline_stage"] not in PIPELINE_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"pipeline_stage must be one of: {', '.join(PIPELINE_STAGES)}",
        )

    for field, value in data.items():
        setattr(lab, field, value)

    db.commit()
    db.refresh(lab)
    return lab


@router.delete("/{lab_id}", status_code=204)
def delete_lab(lab_id: int, db: Session = Depends(get_db)):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")
    db.delete(lab)
    db.commit()
    return None


@router.post("/{lab_id}/submit", response_model=schemas.SubmissionRead, status_code=201)
def submit_lab(lab_id: int, payload: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    submission = models.Submission(
        lab_id=lab_id,
        method=payload.method,
        proof_link=payload.proof_link,
    )
    db.add(submission)

    lab.pipeline_stage = "Submission"
    lab.status = "Submitted"

    db.commit()
    db.refresh(submission)
    return submission
