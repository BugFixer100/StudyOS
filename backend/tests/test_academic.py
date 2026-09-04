from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
import models
from database import Base, get_db


def test_academic_workflows_are_persistent_in_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[get_db] = override_get_db
    client = TestClient(main.app)
    try:
        course = client.post("/api/courses/", json={"name": "Networks", "type": "theory"}).json()
        course_id = course["id"]

        inbox = client.post("/api/academic/inbox", json={"text": "Ask about TCP", "kind": "question"})
        assert inbox.status_code == 201
        assert client.get("/api/academic/inbox").json()[0]["text"] == "Ask about TCP"

        session = client.post(
            "/api/academic/study-sessions",
            json={"course_id": course_id, "planned_minutes": 45},
        ).json()
        assert session["ended_at"] is None
        finished = client.put(
            f"/api/academic/study-sessions/{session['id']}",
            json={"outcome": "Reviewed routing tables"},
        ).json()
        assert finished["ended_at"] is not None

        topic = client.post(
            f"/api/academic/courses/{course_id}/exam-topics",
            json={"name": "Subnetting"},
        ).json()
        updated_topic = client.put(
            f"/api/academic/exam-topics/{topic['id']}",
            json={"is_done": True},
        ).json()
        assert updated_topic["is_done"] is True

        plan = client.put(
            f"/api/academic/courses/{course_id}/exam-plan",
            json={"exam_date": "2026-09-20", "syllabus": "Chapters 1-4"},
        ).json()
        assert plan["syllabus"] == "Chapters 1-4"

        question = client.post(
            f"/api/academic/courses/{course_id}/questions",
            json={"text": "When should I use CIDR?"},
        ).json()
        assert client.get(f"/api/academic/courses/{course_id}/questions").json()[0]["id"] == question["id"]
    finally:
        main.app.dependency_overrides.clear()


def test_schedule_exception_cancels_class_on_today_dashboard():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[get_db] = override_get_db
    client = TestClient(main.app)
    try:
        course = client.post("/api/courses/", json={"name": "Databases", "type": "theory"}).json()
        day = date.today().strftime("%A")
        slot = client.post(
            "/api/timetable/",
            json={"course_id": course["id"], "day_of_week": day, "start_time": "09:00", "end_time": "10:00"},
        ).json()
        exception = client.post(
            "/api/timetable/exceptions",
            json={"schedule_id": slot["id"], "exception_date": date.today().isoformat(), "is_cancelled": True},
        )
        assert exception.status_code == 201
        assert client.get("/api/timetable/exceptions").status_code == 200
        dashboard = client.get("/api/dashboard/today").json()
        assert all(item["id"] != slot["id"] for item in dashboard["classes_today"])
    finally:
        main.app.dependency_overrides.clear()