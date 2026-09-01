"""
routers/tasks.py

Endpoints for managing tasks (homework, assignments, reading, etc.):
  GET    /api/tasks                 -> list tasks (optionally filtered)
  GET    /api/tasks/{id}            -> get one task
  POST   /api/tasks                 -> create a task
  PUT    /api/tasks/{id}            -> update a task
  DELETE /api/tasks/{id}            -> delete a task

  POST   /api/tasks/{id}/subtasks           -> add a subtask to a task
  PUT    /api/tasks/subtasks/{subtask_id}   -> update/toggle a subtask
  DELETE /api/tasks/subtasks/{subtask_id}   -> delete a subtask

  POST   /api/tasks/{id}/submit             -> record a submission for a task
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/", response_model=List[schemas.TaskRead])
def list_tasks(
    course_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List tasks, optionally narrowed down.

    Examples:
      /api/tasks                      -> all tasks
      /api/tasks?course_id=3          -> only tasks for course 3
      /api/tasks?status=Not Started   -> only tasks with that status
    """
    query = db.query(models.Task)
    if course_id is not None:
        query = query.filter(models.Task.course_id == course_id)
    if status is not None:
        query = query.filter(models.Task.status == status)
    return query.order_by(models.Task.due_date.asc().nulls_last()).all()


@router.get("/{task_id}", response_model=schemas.TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/", response_model=schemas.TaskRead, status_code=201)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    # Make sure the course actually exists before creating an orphan task.
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    task = models.Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=schemas.TaskRead)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None


# ---------- Subtasks ----------

@router.post("/{task_id}/subtasks", response_model=schemas.SubtaskRead, status_code=201)
def add_subtask(task_id: int, payload: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    subtask = models.Subtask(task_id=task_id, title=payload.title)
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return subtask


@router.put("/subtasks/{subtask_id}", response_model=schemas.SubtaskRead)
def update_subtask(subtask_id: int, payload: schemas.SubtaskUpdate, db: Session = Depends(get_db)):
    subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(subtask, field, value)

    db.commit()
    db.refresh(subtask)
    return subtask


@router.delete("/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    db.delete(subtask)
    db.commit()
    return None


# ---------- Submission (the "are you sure?" safety step) ----------

@router.post("/{task_id}/submit", response_model=schemas.SubmissionRead, status_code=201)
def submit_task(task_id: int, payload: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    """
    Records that a task was submitted, and moves its status to 'Submitted'.

    The frontend is expected to show a confirmation prompt
    ("Are you sure this has been submitted?") BEFORE calling this -
    this endpoint just records the result once confirmed.
    """
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    submission = models.Submission(
        task_id=task_id,
        method=payload.method,
        proof_link=payload.proof_link,
    )
    db.add(submission)

    task.status = "Submitted"

    db.commit()
    db.refresh(submission)
    return submission
