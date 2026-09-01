"""
schemas.py

This file defines the SHAPE of data going in and out of the API.

Why this is separate from models.py:
- models.py defines what's stored in the DATABASE (SQLAlchemy)
- schemas.py defines what's sent/received over the API (Pydantic)

They usually look similar, but keeping them separate means, for
example, we can hide internal fields from API responses, or require
different fields when CREATING something vs. when READING it back.

Naming convention used throughout:
  XCreate  -> what the client sends to create a new X
  XUpdate  -> what the client sends to update an existing X (all optional)
  XRead    -> what the API sends back (includes id + database fields)
"""

from datetime import date as date_, time as time_, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict

# NOTE: the datetime types are imported with a trailing underscore
# (date_, time_) instead of their normal names (date, time).
#
# Reason: several classes below have a field literally named "date"
# (e.g. Lecture, Lab). If a field called "date" is followed by another
# field like "due_date: Optional[date_]" in the SAME class, Python
# resolves that "date" reference to the FIELD's value, not the type -
# because the field name has already overwritten it in the class's
# namespace by that point. That silently breaks validation. Aliasing
# the import avoids the name collision entirely.


# ---------- Course ----------

class CourseCreate(BaseModel):
    name: str
    type: str  # "theory" or "lab"
    instructor: Optional[str] = None
    color_tag: Optional[str] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    instructor: Optional[str] = None
    color_tag: Optional[str] = None
    is_active: Optional[bool] = None


class CourseRead(BaseModel):
    # model_config lets Pydantic read data straight off SQLAlchemy
    # objects (e.g. course.name) instead of only from dicts.
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    instructor: Optional[str] = None
    color_tag: Optional[str] = None
    is_active: bool


# ---------- ClassSchedule (Timetable) ----------

class ClassScheduleCreate(BaseModel):
    course_id: int
    day_of_week: str
    start_time: time_
    end_time: time_
    room: Optional[str] = None


class ClassScheduleUpdate(BaseModel):
    day_of_week: Optional[str] = None
    start_time: Optional[time_] = None
    end_time: Optional[time_] = None
    room: Optional[str] = None


class ClassScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    day_of_week: str
    start_time: time_
    end_time: time_
    room: Optional[str] = None


# ---------- Lecture ----------

class LectureCreate(BaseModel):
    course_id: int
    date: date_
    topics_covered: Optional[str] = None
    key_concepts: Optional[str] = None
    teacher_emphasis: Optional[str] = None
    homework_given: Optional[str] = None
    remember_for_next: Optional[str] = None
    confusing_points: Optional[str] = None
    mentioned_quiz_exam: Optional[str] = None


class LectureUpdate(BaseModel):
    date: Optional[date_] = None
    topics_covered: Optional[str] = None
    key_concepts: Optional[str] = None
    teacher_emphasis: Optional[str] = None
    homework_given: Optional[str] = None
    remember_for_next: Optional[str] = None
    confusing_points: Optional[str] = None
    mentioned_quiz_exam: Optional[str] = None
    is_captured: Optional[bool] = None
    is_reviewed: Optional[bool] = None


class LectureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    date: date_
    topics_covered: Optional[str] = None
    key_concepts: Optional[str] = None
    teacher_emphasis: Optional[str] = None
    homework_given: Optional[str] = None
    remember_for_next: Optional[str] = None
    confusing_points: Optional[str] = None
    mentioned_quiz_exam: Optional[str] = None
    is_captured: bool
    is_reviewed: bool


# ---------- Task ----------

class TaskCreate(BaseModel):
    course_id: int
    title: str
    task_type: str
    description: Optional[str] = None
    due_date: Optional[date_] = None
    due_time: Optional[time_] = None
    estimated_minutes: Optional[int] = None
    priority: Optional[str] = "Medium"
    status: Optional[str] = "Not Started"
    submission_method: Optional[str] = None
    submission_link: Optional[str] = None
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    task_type: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date_] = None
    due_time: Optional[time_] = None
    estimated_minutes: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    progress_percent: Optional[int] = None
    submission_method: Optional[str] = None
    submission_link: Optional[str] = None
    notes: Optional[str] = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    task_type: str
    description: Optional[str] = None
    created_at: datetime
    due_date: Optional[date_] = None
    due_time: Optional[time_] = None
    estimated_minutes: Optional[int] = None
    priority: str
    status: str
    progress_percent: int
    submission_method: Optional[str] = None
    submission_link: Optional[str] = None
    notes: Optional[str] = None


# ---------- Subtask ----------

class SubtaskCreate(BaseModel):
    task_id: int
    title: str


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None


class SubtaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    title: str
    is_done: bool


# ---------- Lab ----------

class LabCreate(BaseModel):
    course_id: int
    lab_number: Optional[int] = None
    date: Optional[date_] = None
    experiment_title: str
    instructions: Optional[str] = None
    due_date: Optional[date_] = None


class LabUpdate(BaseModel):
    lab_number: Optional[int] = None
    date: Optional[date_] = None
    experiment_title: Optional[str] = None
    instructions: Optional[str] = None
    pipeline_stage: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date_] = None


class LabRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    lab_number: Optional[int] = None
    date: Optional[date_] = None
    experiment_title: str
    instructions: Optional[str] = None
    pipeline_stage: str
    status: str
    due_date: Optional[date_] = None


# ---------- Submission ----------

class SubmissionCreate(BaseModel):
    task_id: Optional[int] = None
    lab_id: Optional[int] = None
    method: Optional[str] = None
    proof_link: Optional[str] = None


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: Optional[int] = None
    lab_id: Optional[int] = None
    submitted_at: datetime
    method: Optional[str] = None
    proof_link: Optional[str] = None


# ---------- Note ----------

class NoteCreate(BaseModel):
    course_id: int
    title: str
    content: Optional[str] = None


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    content: Optional[str] = None
    created_at: datetime


# ---------- Resource ----------

class ResourceCreate(BaseModel):
    course_id: int
    title: str
    link_or_path: str


class ResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    link_or_path: str
