from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/academic", tags=["academic workflow"])


def _course_or_404(course_id: int, db: Session):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/inbox", response_model=List[schemas.InboxItemRead])
def list_inbox(db: Session = Depends(get_db)):
    return db.query(models.InboxItem).order_by(models.InboxItem.created_at.desc()).all()


@router.post("/inbox", response_model=schemas.InboxItemRead, status_code=201)
def create_inbox_item(payload: schemas.InboxItemCreate, db: Session = Depends(get_db)):
    item = models.InboxItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/inbox/{item_id}", status_code=204)
def delete_inbox_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.InboxItem).filter(models.InboxItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    db.delete(item)
    db.commit()


@router.get("/study-sessions", response_model=List[schemas.StudySessionRead])
def list_study_sessions(db: Session = Depends(get_db)):
    return db.query(models.StudySession).order_by(models.StudySession.started_at.desc()).all()


@router.post("/study-sessions", response_model=schemas.StudySessionRead, status_code=201)
def create_study_session(payload: schemas.StudySessionCreate, db: Session = Depends(get_db)):
    _course_or_404(payload.course_id, db)
    session = models.StudySession(**payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.put("/study-sessions/{session_id}", response_model=schemas.StudySessionRead)
def finish_study_session(session_id: int, payload: schemas.StudySessionUpdate, db: Session = Depends(get_db)):
    session = db.query(models.StudySession).filter(models.StudySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")
    values = payload.model_dump(exclude_unset=True)
    if "outcome" in values and values["outcome"] is not None and "ended_at" not in values:
        values["ended_at"] = datetime.utcnow()
    for field, value in values.items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


@router.get("/courses/{course_id}/exam-plan", response_model=schemas.ExamPlanRead)
def get_exam_plan(course_id: int, db: Session = Depends(get_db)):
    _course_or_404(course_id, db)
    plan = db.query(models.ExamPlan).filter(models.ExamPlan.course_id == course_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Exam plan not found")
    return plan


@router.put("/courses/{course_id}/exam-plan", response_model=schemas.ExamPlanRead)
def upsert_exam_plan(course_id: int, payload: schemas.ExamPlanUpsert, db: Session = Depends(get_db)):
    _course_or_404(course_id, db)
    plan = db.query(models.ExamPlan).filter(models.ExamPlan.course_id == course_id).first()
    if not plan:
        plan = models.ExamPlan(course_id=course_id)
        db.add(plan)
    for field, value in payload.model_dump().items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/courses/{course_id}/exam-topics", response_model=List[schemas.ExamTopicRead])
def list_exam_topics(course_id: int, db: Session = Depends(get_db)):
    _course_or_404(course_id, db)
    return db.query(models.ExamTopic).filter(models.ExamTopic.course_id == course_id).order_by(models.ExamTopic.id).all()


@router.post("/courses/{course_id}/exam-topics", response_model=schemas.ExamTopicRead, status_code=201)
def create_exam_topic(course_id: int, payload: schemas.ExamTopicCreate, db: Session = Depends(get_db)):
    _course_or_404(course_id, db)
    topic = models.ExamTopic(course_id=course_id, name=payload.name)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


@router.put("/exam-topics/{topic_id}", response_model=schemas.ExamTopicRead)
def update_exam_topic(topic_id: int, payload: schemas.ExamTopicUpdate, db: Session = Depends(get_db)):
    topic = db.query(models.ExamTopic).filter(models.ExamTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Exam topic not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    db.commit()
    db.refresh(topic)
    return topic


@router.get("/courses/{course_id}/questions", response_model=List[schemas.TeacherQuestionRead])
def list_teacher_questions(course_id: int, db: Session = Depends(get_db)):
    _course_or_404(course_id, db)
    return db.query(models.TeacherQuestion).filter(models.TeacherQuestion.course_id == course_id).order_by(models.TeacherQuestion.id).all()


@router.post("/courses/{course_id}/questions", response_model=schemas.TeacherQuestionRead, status_code=201)
def create_teacher_question(course_id: int, payload: schemas.TeacherQuestionCreate, db: Session = Depends(get_db)):
    _course_or_404(course_id, db)
    question = models.TeacherQuestion(course_id=course_id, text=payload.text)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.put("/questions/{question_id}", response_model=schemas.TeacherQuestionRead)
def update_teacher_question(question_id: int, payload: schemas.TeacherQuestionUpdate, db: Session = Depends(get_db)):
    question = db.query(models.TeacherQuestion).filter(models.TeacherQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Teacher question not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    db.commit()
    db.refresh(question)
    return question