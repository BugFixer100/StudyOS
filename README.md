# StudyOS

StudyOS is a personal university study management system for courses, recurring
classes, lecture memory, tasks, labs, deadlines, and daily priorities.

## Run locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd backend
../.venv/bin/uvicorn main:app --reload
```

Open <http://127.0.0.1:8000/> after the server starts. The API documentation is
available at <http://127.0.0.1:8000/docs>.

To load sample academic data, run this from `backend/`:

```bash
../.venv/bin/python seed_demo_data.py
```

The seed command resets the local SQLite database by default. Use
`--no-reset` to append the sample records instead.

## Test and validate

From the repository root:

```bash
.venv/bin/python -m pytest -q
for file in frontend/js/*.js; do node --check "$file"; done
```

The backend currently provides CRUD APIs for courses, timetable slots, tasks,
subtasks, submissions, lecture captures, and lab pipeline records. The Today
dashboard combines today's classes, the next class, previous lecture memory,
and urgency-ranked actions.

## Incremental completion backlog

1. Add API integration tests for CRUD, validation, submissions, and lab stage
   transitions.
2. Add timetable editing and lecture-capture flows to the browser smoke test.
3. Add browser smoke coverage for timetable exceptions and reminders.
