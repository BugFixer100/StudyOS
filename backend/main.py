"""
main.py

Registers all routers and serves the frontend as static files.
Added calendar and export routers to feature/calendar-backup branch.
"""

from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import engine, Base, get_db
import models  # noqa: F401  (imported so its tables get registered with Base)
from routers import courses, tasks, lectures, labs, timetable, dashboard, calendar, export

# Create all tables that are defined in models.py, if they don't
# already exist. Safe to run every time the app starts.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="StudyOS")

# Each router file handles one entity (courses, tasks, lectures, labs,
# timetable). Registering them here is what actually makes their
# endpoints reachable, e.g. GET /api/courses.
app.include_router(courses.router)
app.include_router(tasks.router)
app.include_router(lectures.router)
app.include_router(labs.router)
app.include_router(timetable.router)
app.include_router(dashboard.router)
# New Phase 2 routers
app.include_router(calendar.router)
app.include_router(export.router)


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """
    A simple test route.

    Visiting http://127.0.0.1:8000/api/health in your browser should
    show a JSON response confirming:
    1. The backend server is running
    2. The backend can successfully talk to the SQLite database
    """
    # A trivial query just to prove the database connection works.
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "message": "StudyOS backend is running and connected to the database.",
    }


# Serve the frontend folder as plain static files.
# This means:
#   http://127.0.0.1:8000/         -> frontend/index.html
#   http://127.0.0.1:8000/css/...  -> frontend/css/...
#   http://127.0.0.1:8000/js/...   -> frontend/js/...
frontend_path = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
