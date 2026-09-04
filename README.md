# StudyOS

StudyOS is a lightweight personal study & course-management web app focused on helping students capture short lecture summaries, track coursework (tasks & labs), and maintain a timetable. It provides a small FastAPI backend with an HTML/JS frontend so you can run everything locally or deploy as a single simple service.

Why this exists
- Capture a "last lecture memory" quickly after class, so you remember key concepts and what to review next.
- Track tasks, subtasks, and lab pipelines (implementation → report → viva) with simple submission records.
- Keep a weekly timetable and an at-a-glance dashboard of upcoming work.

Stack
- Languages: Python (FastAPI) and plain JavaScript for the static frontend.
- Backend: FastAPI, SQLAlchemy with SQLite (single-file DB for easy local backups).
- Frontend: Static HTML/CSS/JS served directly by the FastAPI app (no build step by default).

Quick start (development)
1. Clone the repo:

   git clone https://github.com/BugFixer100/StudyOS.git
   cd StudyOS

2. Create a virtual environment and install dependencies:

   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt

   # (Optional) Backend-only requirements
   pip install -r backend/requirements.txt

3. Run the app with uvicorn (from repo root):

   uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

4. Open the frontend in your browser:

   http://127.0.0.1:8000/

Notes
- The project uses SQLite by default. The DB file is backend/studyos.db and will be created automatically the first time the app runs.
- There is a small seeding script at backend/seed_demo_data.py if you want example data for development:

   python backend/seed_demo_data.py

- FastAPI exposes interactive API docs at http://127.0.0.1:8000/docs while the server is running.

What is intentionally missing / development notes
These are known gaps or planned improvements to make the project production-ready:
- Authentication & user accounts (no user model or login flow yet).
- Database migrations (currently uses Base.metadata.create_all). Add Alembic or similar before production.
- CI & tests: add GitHub Actions, unit and end-to-end tests for core flows.
- Frontend build tooling: currently static files — consider adding a Node toolchain if you want modular JS/CSS and npm packages.
- File uploads/attachments: Attachment model exists but file storage, validation and access control need implementation.
- Configuration & secrets management: no .env or configuration wrapper in place.

Contributing
- Open an issue describing the change you plan to make.
- Create a branch named feature/<short-description> or fix/<short-description> and submit a PR.

Useful files to look at
- backend/main.py — application entrypoint and router registration
- backend/models.py — SQLAlchemy models defining the schema
- backend/database.py — engine, SessionLocal, and get_db dependency
- frontend/ — static HTML, JS and CSS used by the UI
- backend/seed_demo_data.py — helper to populate example rows

Next steps I can take for you
- Add a more complete docs folder (ARCHITECTURE.md) describing the system architecture and data flow.
- Create a CONTRIBUTING.md and a basic GitHub Actions workflow for tests.
- Add a simple .env loader and configuration file to centralize settings.

License
- No LICENSE file yet. If you want a specific license, tell me which (MIT, Apache-2.0, etc.) and I can add it.
