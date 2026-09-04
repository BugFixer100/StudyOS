"""
backend/routers/export.py

Provides endpoints to export the application's data as JSON and
import it back. MVP behavior: export metadata for main tables; import
replaces existing data when confirm=True in the payload.

Warning: POST /api/import will DELETE existing rows and replace them
with the provided payload. This operation is destructive and requires
`confirm: true` to proceed.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, engine
import models
import schemas

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export", response_model=schemas.ExportDump)
def export_data(db: Session = Depends(get_db)):
    # Dump rows for main tables. Convert SQLAlchemy objects to dicts
    # via attribute access. Keep attachment metadata only.
    data = {}

    data["courses"] = [
        {
            "id": c.id,
            "name": c.name,
            "type": c.type,
            "instructor": c.instructor,
            "color_tag": c.color_tag,
            "is_active": c.is_active,
        }
        for c in db.query(models.Course).all()
    ]

    data["class_schedules"] = [
        {
            "id": s.id,
            "course_id": s.course_id,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "room": s.room,
        }
        for s in db.query(models.ClassSchedule).all()
    ]

    data["lectures"] = [
        {
            "id": l.id,
            "course_id": l.course_id,
            "date": l.date.isoformat(),
            "topics_covered": l.topics_covered,
            "key_concepts": l.key_concepts,
            "teacher_emphasis": l.teacher_emphasis,
            "homework_given": l.homework_given,
            "remember_for_next": l.remember_for_next,
            "confusing_points": l.confusing_points,
            "mentioned_quiz_exam": l.mentioned_quiz_exam,
            "is_captured": l.is_captured,
            "is_reviewed": l.is_reviewed,
        }
        for l in db.query(models.Lecture).all()
    ]

    data["tasks"] = [
        {
            "id": t.id,
            "course_id": t.course_id,
            "title": t.title,
            "task_type": t.task_type,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "due_time": t.due_time.isoformat() if t.due_time else None,
            "estimated_minutes": t.estimated_minutes,
            "priority": t.priority,
            "status": t.status,
            "progress_percent": t.progress_percent,
            "submission_method": t.submission_method,
            "submission_link": t.submission_link,
            "notes": t.notes,
        }
        for t in db.query(models.Task).all()
    ]

    data["subtasks"] = [
        {"id": s.id, "task_id": s.task_id, "title": s.title, "is_done": s.is_done}
        for s in db.query(models.Subtask).all()
    ]

    data["labs"] = [
        {
            "id": l.id,
            "course_id": l.course_id,
            "lab_number": l.lab_number,
            "date": l.date.isoformat() if l.date else None,
            "experiment_title": l.experiment_title,
            "instructions": l.instructions,
            "pipeline_stage": l.pipeline_stage,
            "status": l.status,
            "due_date": l.due_date.isoformat() if l.due_date else None,
        }
        for l in db.query(models.Lab).all()
    ]

    data["submissions"] = [
        {
            "id": s.id,
            "task_id": s.task_id,
            "lab_id": s.lab_id,
            "submitted_at": s.submitted_at.isoformat(),
            "method": s.method,
            "proof_link": s.proof_link,
        }
        for s in db.query(models.Submission).all()
    ]

    data["attachments"] = [
        {
            "id": a.id,
            "parent_type": a.parent_type,
            "parent_id": a.parent_id,
            "filename": a.filename,
            "filepath": a.filepath,
            "uploaded_at": a.uploaded_at.isoformat(),
        }
        for a in db.query(models.Attachment).all()
    ]

    data["notes"] = [
        {"id": n.id, "course_id": n.course_id, "title": n.title, "content": n.content, "created_at": n.created_at.isoformat()}
        for n in db.query(models.Note).all()
    ]

    data["resources"] = [
        {"id": r.id, "course_id": r.course_id, "title": r.title, "link_or_path": r.link_or_path}
        for r in db.query(models.Resource).all()
    ]

    return data


@router.post("/import")
def import_data(payload: schemas.ImportPayload, db: Session = Depends(get_db)):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Import not confirmed. Set confirm=true to proceed.")

    # Destructive replace. Delete existing rows in reverse dependency order
    # so we don't violate foreign key constraints.
    # Note: SQLite may not enforce FK unless PRAGMA foreign_keys=ON;
    # but we'll still delete in an order that respects relationships.
    db.query(models.Attachment).delete()
    db.query(models.Submission).delete()
    db.query(models.Subtask).delete()
    db.query(models.Task).delete()
    db.query(models.Lab).delete()
    db.query(models.Lecture).delete()
    db.query(models.ClassSchedule).delete()
    db.query(models.Resource).delete()
    db.query(models.Note).delete()
    db.query(models.Course).delete()
    db.commit()

    d = payload.data

    # Insert courses first
    courses_map = {}
    for c in d.courses:
        course = models.Course(
            id=c.get("id"),
            name=c.get("name"),
            type=c.get("type"),
            instructor=c.get("instructor"),
            color_tag=c.get("color_tag"),
            is_active=c.get("is_active", True),
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        courses_map[course.id] = course

    # Class schedules
    for s in d.class_schedules:
        cs = models.ClassSchedule(
            id=s.get("id"),
            course_id=s.get("course_id"),
            day_of_week=s.get("day_of_week"),
            start_time=s.get("start_time"),
            end_time=s.get("end_time"),
            room=s.get("room"),
        )
        # start_time and end_time are ISO strings; let SQLAlchemy coerce
        db.add(cs)
    db.commit()

    # Lectures
    for l in d.lectures:
        lec = models.Lecture(
            id=l.get("id"),
            course_id=l.get("course_id"),
            date=l.get("date"),
            topics_covered=l.get("topics_covered"),
            key_concepts=l.get("key_concepts"),
            teacher_emphasis=l.get("teacher_emphasis"),
            homework_given=l.get("homework_given"),
            remember_for_next=l.get("remember_for_next"),
            confusing_points=l.get("confusing_points"),
            mentioned_quiz_exam=l.get("mentioned_quiz_exam"),
            is_captured=l.get("is_captured", False),
            is_reviewed=l.get("is_reviewed", False),
        )
        db.add(lec)
    db.commit()

    # Tasks
    for t in d.tasks:
        task = models.Task(
            id=t.get("id"),
            course_id=t.get("course_id"),
            title=t.get("title"),
            task_type=t.get("task_type"),
            description=t.get("description"),
            created_at=t.get("created_at"),
            due_date=t.get("due_date"),
            due_time=t.get("due_time"),
            estimated_minutes=t.get("estimated_minutes"),
            priority=t.get("priority"),
            status=t.get("status"),
            progress_percent=t.get("progress_percent"),
            submission_method=t.get("submission_method"),
            submission_link=t.get("submission_link"),
            notes=t.get("notes"),
        )
        db.add(task)
    db.commit()

    # Subtasks
    for s in d.subtasks:
        sub = models.Subtask(
            id=s.get("id"),
            task_id=s.get("task_id"),
            title=s.get("title"),
            is_done=s.get("is_done", False),
        )
        db.add(sub)
    db.commit()

    # Labs
    for l in d.labs:
        lab = models.Lab(
            id=l.get("id"),
            course_id=l.get("course_id"),
            lab_number=l.get("lab_number"),
            date=l.get("date"),
            experiment_title=l.get("experiment_title"),
            instructions=l.get("instructions"),
            pipeline_stage=l.get("pipeline_stage", "Task Given"),
            status=l.get("status", "Not Started"),
            due_date=l.get("due_date"),
        )
        db.add(lab)
    db.commit()

    # Submissions
    for s in d.submissions:
        subm = models.Submission(
            id=s.get("id"),
            task_id=s.get("task_id"),
            lab_id=s.get("lab_id"),
            submitted_at=s.get("submitted_at"),
            method=s.get("method"),
            proof_link=s.get("proof_link"),
        )
        db.add(subm)
    db.commit()

    # Attachments
    for a in d.attachments:
        att = models.Attachment(
            id=a.get("id"),
            parent_type=a.get("parent_type"),
            parent_id=a.get("parent_id"),
            filename=a.get("filename"),
            filepath=a.get("filepath"),
            uploaded_at=a.get("uploaded_at"),
        )
        db.add(att)
    db.commit()

    # Notes
    for n in d.notes:
        note = models.Note(
            id=n.get("id"),
            course_id=n.get("course_id"),
            title=n.get("title"),
            content=n.get("content"),
            created_at=n.get("created_at"),
        )
        db.add(note)
    db.commit()

    # Resources
    for r in d.resources:
        res = models.Resource(
            id=r.get("id"),
            course_id=r.get("course_id"),
            title=r.get("title"),
            link_or_path=r.get("link_or_path"),
        )
        db.add(res)
    db.commit()

    return {"status": "ok", "message": "Import completed."}
