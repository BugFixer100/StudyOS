"""
models.py

This file defines every database TABLE as a Python class.

How to read this file if you're new to SQLAlchemy:
- Each class = one table (e.g. class Course -> table "courses")
- Each Column(...) = one column in that table
- relationship(...) lines don't create columns - they just let you
  write course.tasks in Python and get a list of related Task rows,
  instead of writing a SQL JOIN yourself every time.
- ForeignKey("courses.id") means "this column must match an id that
  exists in the courses table" - this is how we connect tables.

Tables in this file (matches the schema we agreed on):
  Course, ClassSchedule, Lecture, Task, Subtask, Lab, Submission,
  Attachment, Note, Resource
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    Time,
    DateTime,
    Boolean,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "theory" or "lab"
    instructor = Column(String, nullable=True)
    color_tag = Column(String, nullable=True)  # e.g. "#4A90D9", for UI
    is_active = Column(Boolean, default=True)

    # These let you do course.schedules, course.lectures, etc. in code.
    # cascade="all, delete-orphan" means: if a Course is deleted, delete
    # everything that belongs to it too (no orphaned data left behind).
    schedules = relationship("ClassSchedule", back_populates="course", cascade="all, delete-orphan")
    lectures = relationship("Lecture", back_populates="course", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="course", cascade="all, delete-orphan")
    labs = relationship("Lab", back_populates="course", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="course", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="course", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="course", cascade="all, delete-orphan")
    exam_plan = relationship("ExamPlan", back_populates="course", uselist=False, cascade="all, delete-orphan")
    exam_topics = relationship("ExamTopic", back_populates="course", cascade="all, delete-orphan")
    teacher_questions = relationship("TeacherQuestion", back_populates="course", cascade="all, delete-orphan")


class ClassSchedule(Base):
    """A recurring weekly timetable slot, e.g. 'Compiler Construction, Monday 9-11am'."""

    __tablename__ = "class_schedules"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    day_of_week = Column(String, nullable=False)  # "Monday", "Tuesday", ...
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    room = Column(String, nullable=True)

    course = relationship("Course", back_populates="schedules")
    exceptions = relationship("ScheduleException", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleException(Base):
    __tablename__ = "schedule_exceptions"

    id = Column(Integer, primary_key=True)
    schedule_id = Column(Integer, ForeignKey("class_schedules.id"), nullable=False)
    exception_date = Column(Date, nullable=False)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    room = Column(String, nullable=True)
    note = Column(Text, nullable=True)

    schedule = relationship("ClassSchedule", back_populates="exceptions")


class Lecture(Base):
    """
    One lecture record - the core of the 'Last Lecture Memory' feature.

    Every field except course_id and date is optional, because the
    2-minute capture form allows skipping fields.
    """

    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    date = Column(Date, nullable=False, default=datetime.utcnow)

    topics_covered = Column(Text, nullable=True)
    key_concepts = Column(Text, nullable=True)
    teacher_emphasis = Column(Text, nullable=True)
    homework_given = Column(Text, nullable=True)
    remember_for_next = Column(Text, nullable=True)
    confusing_points = Column(Text, nullable=True)
    mentioned_quiz_exam = Column(Text, nullable=True)

    # True once the 2-minute capture form has been filled at all
    # (even partially). Used to detect "lectures with no summary".
    is_captured = Column(Boolean, default=False)

    # True once you've done the pre-class Quick Review for this lecture.
    is_reviewed = Column(Boolean, default=False)

    course = relationship("Course", back_populates="lectures")


class Task(Base):
    """Homework, assignments, reading, exam prep, etc. - anything with a deadline."""

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    title = Column(String, nullable=False)
    task_type = Column(String, nullable=False)  # Homework/Assignment/Reading/etc.
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(Date, nullable=True)
    due_time = Column(Time, nullable=True)

    estimated_minutes = Column(Integer, nullable=True)
    priority = Column(String, default="Medium")  # Low/Medium/High
    status = Column(String, default="Not Started")
    # Not Started / In Progress / Blocked / Submitted / Completed
    progress_percent = Column(Integer, default=0)

    submission_method = Column(String, nullable=True)
    submission_link = Column(String, nullable=True)

    notes = Column(Text, nullable=True)

    course = relationship("Course", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="task", cascade="all, delete-orphan")


class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)

    title = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)

    task = relationship("Task", back_populates="subtasks")


class Lab(Base):
    """
    A lab assignment with its own pipeline, separate from a plain Task
    because labs move through stages (Implementation -> Report -> Viva)
    that a normal homework task doesn't have.
    """

    __tablename__ = "labs"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    lab_number = Column(Integer, nullable=True)
    date = Column(Date, nullable=True)
    experiment_title = Column(String, nullable=False)
    instructions = Column(Text, nullable=True)

    # Task Given / Understanding / Implementation / Testing / Report / Submission / Viva
    pipeline_stage = Column(String, default="Task Given")
    status = Column(String, default="Not Started")

    due_date = Column(Date, nullable=True)

    course = relationship("Course", back_populates="labs")
    submissions = relationship("Submission", back_populates="lab", cascade="all, delete-orphan")


class Submission(Base):
    """
    A record of "I actually submitted this", created after the
    confirmation prompt described in the spec. A Task or Lab can have
    more than one Submission row if you resubmit.
    """

    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)
    method = Column(String, nullable=True)  # e.g. "LMS upload", "Email"
    proof_link = Column(String, nullable=True)  # screenshot path or file link

    task = relationship("Task", back_populates="submissions")
    lab = relationship("Lab", back_populates="submissions")


class Attachment(Base):
    """
    Generic file attachment. Instead of separate tables per attachment
    type, we use parent_type + parent_id to say what this file belongs
    to, e.g. parent_type="lecture", parent_id=12.

    Trade-off: this is not enforced by a real foreign key, so we handle
    that relationship in code, not in the database. This keeps the
    schema simpler; if the app grows a lot bigger, this is one of the
    first things worth revisiting.
    """

    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True)
    parent_type = Column(String, nullable=False)  # "lecture", "task", "lab"
    parent_id = Column(Integer, nullable=False)

    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="notes")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    title = Column(String, nullable=False)
    link_or_path = Column(String, nullable=False)

    course = relationship("Course", back_populates="resources")


class InboxItem(Base):
    __tablename__ = "inbox_items"

    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    kind = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    planned_minutes = Column(Integer, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    outcome = Column(Text, nullable=True)

    course = relationship("Course", back_populates="study_sessions")


class ExamPlan(Base):
    __tablename__ = "exam_plans"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, unique=True)
    exam_date = Column(Date, nullable=True)
    syllabus = Column(Text, nullable=True)

    course = relationship("Course", back_populates="exam_plan")


class ExamTopic(Base):
    __tablename__ = "exam_topics"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    name = Column(String, nullable=False)
    is_done = Column(Boolean, default=False, nullable=False)

    course = relationship("Course", back_populates="exam_topics")


class TeacherQuestion(Base):
    __tablename__ = "teacher_questions"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    text = Column(Text, nullable=False)
    is_done = Column(Boolean, default=False, nullable=False)

    course = relationship("Course", back_populates="teacher_questions")
