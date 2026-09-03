function pct(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function buildCourseHealth(state, course) {
  const tasks = state.tasks.filter((t) => t.course_id === course.id);
  const lectures = state.lectures.filter((l) => l.course_id === course.id);
  const labs = state.labs.filter((l) => l.course_id === course.id);

  const pending = tasks.filter((t) => t.status !== "Completed" && t.status !== "Submitted").length;
  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "Completed").length;
  const reviewed = lectures.filter((l) => l.is_reviewed).length;
  const active = tasks.filter((t) => t.status === "In Progress").length + labs.filter((l) => l.status === "In Progress").length;

  return {
    taskCompletion: 100 - pct(pending, Math.max(tasks.length, 1)),
    lectureReview: pct(reviewed, Math.max(lectures.length, 1)),
    activity: Math.min(100, active * 20),
    overduePressure: overdue ? Math.max(10, 100 - overdue * 20) : 100,
  };
}

export function renderWeeklyView(state) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayCards = days.map((day) => {
    const classes = state.timetable.filter((s) => s.day_of_week === day);
    const dueTasks = state.tasks.filter((t) => t.due_date && new Date(t.due_date).toLocaleDateString("en-US", { weekday: "long" }) === day);
    return `<div class="card"><h4>${day}</h4><div class="small">Classes: ${classes.length} • Deadlines: ${dueTasks.length}</div><ul class="clean">${classes.map((s) => `<li>${state.courseName[s.course_id] || "Course"} ${s.start_time}-${s.end_time}</li>`).join("") || "<li>No classes</li>"}</ul></div>`;
  }).join("");

  const healthCards = state.courses.map((course) => {
    const health = buildCourseHealth(state, course);
    return `<div class="card"><h4>${course.name}</h4><div class="course-health">
      <div>Task Completion <div class="progress-track"><span style="width:${health.taskCompletion}%"></span></div></div>
      <div>Lecture Review <div class="progress-track"><span style="width:${health.lectureReview}%"></span></div></div>
      <div>Activity <div class="progress-track"><span style="width:${health.activity}%"></span></div></div>
      <div>Deadline Stability <div class="progress-track"><span style="width:${health.overduePressure}%"></span></div></div>
    </div></div>`;
  }).join("") || "<p>No courses yet.</p>";

  return `<div class="grid cols-2"><div class="card" style="grid-column:1/-1"><h3>Weekly Dashboard</h3><div class="grid cols-3">${dayCards}</div></div><div class="card" style="grid-column:1/-1"><h3>Course Health</h3><div class="grid cols-3">${healthCards}</div></div></div>`;
}

export function renderCoursesView(state) {
  const courseTypes = ["theory", "lab"];
  const firstCourseId = state.selectedCourseId || state.courses[0]?.id;
  const selectedCourse = state.courses.find((c) => c.id === firstCourseId);

  const tabs = state.courses.map((c) => `<button data-course-tab="${c.id}" ${c.id === firstCourseId ? 'class="active"' : ""}>${c.name}</button>`).join("");

  if (!selectedCourse) {
    return `<div class="grid cols-2"><div class="card"><h3>Courses</h3><p>No courses found yet. Add your first course to unlock tasks, lectures, and timetable entries.</p></div>${courseForm(courseTypes)}</div>`;
  }

  const tasks = state.tasks.filter((t) => t.course_id === selectedCourse.id);
  const lectures = state.lectures.filter((l) => l.course_id === selectedCourse.id);
  const labs = state.labs.filter((l) => l.course_id === selectedCourse.id);
  const health = buildCourseHealth(state, selectedCourse);

  return `<div class="grid cols-2">
    <div class="card" style="grid-column:1/-1"><div class="today-header"><h3>Course Pages</h3><span class="small">${state.courses.length} course${state.courses.length === 1 ? "" : "s"}</span></div><div class="course-tabs">${tabs}</div></div>
    ${courseForm(courseTypes)}
    <div class="card"><h4>Overview</h4><p><strong>${selectedCourse.name}</strong> (${selectedCourse.type})</p><p>Instructor: ${selectedCourse.instructor || "-"}</p></div>
    <div class="card"><h4>Progress</h4><div>Task Completion <div class="progress-track"><span style="width:${health.taskCompletion}%"></span></div></div></div>
    <div class="card"><h4>Timetable</h4><ul class="clean">${state.timetable.filter((s) => s.course_id === selectedCourse.id).map((s) => `<li>${s.day_of_week} ${s.start_time}-${s.end_time} ${s.room || ""}</li>`).join("") || "<li>No timetable slots</li>"}</ul></div>
    <div class="card"><h4>Lectures</h4><ul class="clean">${lectures.map((l) => `<li>${l.date} • ${l.topics_covered || "No topics"}</li>`).join("") || "<li>No lectures</li>"}</ul></div>
    <div class="card"><h4>Assignments / Homework / Projects</h4><ul class="clean">${tasks.map((t) => `<li>${t.task_type}: ${t.title} (${t.status})</li>`).join("") || "<li>No tasks</li>"}</ul></div>
    <div class="card"><h4>Labs</h4><ul class="clean">${labs.map((l) => `<li>Lab ${l.lab_number || "-"}: ${l.experiment_title} (${l.pipeline_stage})</li>`).join("") || "<li>No labs</li>"}</ul></div>
    <div class="card"><h4>Notes / Resources / Exams</h4><div class="small">Notes and resources are managed via Academic Inbox and Quick Add. Exam prep checklists are in Study Sessions page.</div></div>
  </div>`;
}

function courseForm(courseTypes) {
  return `<div class="card"><h4>Add Course</h4><form id="course-form">
    <label>Name<input name="name" required placeholder="e.g. Compiler Construction" /></label>
    <label>Type<select name="type">${courseTypes.map((type) => `<option value="${type}">${type[0].toUpperCase()}${type.slice(1)}</option>`).join("")}</select></label>
    <label>Instructor<input name="instructor" placeholder="Optional" /></label>
    <label>Color tag<input name="color_tag" type="color" value="#2f6fed" /></label>
    <button class="action primary" type="submit">Add Course</button>
  </form></div>`;
}
