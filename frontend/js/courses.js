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
  const activePanel = state.coursePanel || "overview";

  const tabs = state.courses.map((c) => `<button data-course-tab="${c.id}" ${c.id === firstCourseId ? 'class="active"' : ""}>${c.name}</button>`).join("");

  if (!selectedCourse) {
    return `<div class="grid cols-2"><div class="card"><h3>Courses</h3><p>No courses found yet. Add your first course to unlock tasks, lectures, and timetable entries.</p></div>${courseForm(courseTypes)}</div>`;
  }

  const tasks = state.tasks.filter((t) => t.course_id === selectedCourse.id);
  const lectures = state.lectures.filter((l) => l.course_id === selectedCourse.id);
  const labs = state.labs.filter((l) => l.course_id === selectedCourse.id);
  const health = buildCourseHealth(state, selectedCourse);

  const slots = state.timetable.filter((s) => s.course_id === selectedCourse.id);
  const panelButtons = [["overview", "Overview"], ["tasks", "Tasks & assignments"], ["lectures", "Lectures"], ["labs", "Labs"], ["timetable", "Timetable"]]
    .map(([key, label]) => `<button data-course-panel="${key}" class="${activePanel === key ? "active" : ""}">${label}</button>`).join("");

  return `<section class="course-page">
    <div class="card course-selector"><div class="today-header"><div><h3>My courses</h3><span class="small">${state.courses.length} course${state.courses.length === 1 ? "" : "s"} · choose one to manage its work</span></div><button class="action" data-course-panel="new-course">＋ Add course</button></div><div class="course-tabs">${tabs}</div></div>
    <article class="course-workspace">
      <header class="course-workspace-header"><div><p class="eyebrow">Course workspace</p><h2>${selectedCourse.name}</h2><p>${selectedCourse.type} · ${selectedCourse.instructor || "Instructor not added"}</p></div><div class="course-health-score"><strong>${health.taskCompletion}%</strong><span>tasks complete</span></div></header>
      <nav class="course-panel-tabs" aria-label="${selectedCourse.name} tools">${panelButtons}</nav>
      ${renderCoursePanel(activePanel, { selectedCourse, tasks, lectures, labs, slots, health, courseTypes })}
    </article>
    ${activePanel === "new-course" ? courseForm(courseTypes) : ""}
  </section>`;
}

function renderCoursePanel(panel, data) {
  const { selectedCourse: course, tasks, lectures, labs, slots, health } = data;
  if (panel === "tasks") return `<div class="course-panel two-column-panel">
    <div class="card"><h3>Add task or assignment</h3><p class="small">This item will belong only to <strong>${course.name}</strong>.</p>${courseTaskForm(course)}</div>
    <div class="card"><h3>${course.name} tasks</h3><ul class="clean course-record-list">${tasks.map((t) => `<li><div class="today-header"><strong>${t.title}</strong><span class="badge ${t.status === "Completed" ? "completed" : "upcoming"}">${t.status}</span></div><div class="small">${t.task_type} · Due ${t.due_date || "not set"} · ${t.priority}</div><div class="row"><button class="action" data-task-edit="${t.id}">Edit</button><button class="action" data-task-submit="${t.id}">Submit</button><button class="action danger" data-task-delete="${t.id}">Delete</button></div></li>`).join("") || "<li class='empty-state'>No tasks or assignments for this course yet.</li>"}</ul></div>
  </div>`;
  if (panel === "lectures") return `<div class="course-panel two-column-panel"><div class="card"><h3>Capture a lecture</h3><p class="small">A short record is enough—keep the important details for next time.</p>${courseLectureForm(course)}</div><div class="card"><h3>${course.name} lecture memory</h3><ul class="clean course-record-list">${lectures.map((l) => `<li><strong>${l.date}</strong><div>${l.topics_covered || "No topics recorded"}</div><div class="small">Teacher emphasis: ${l.teacher_emphasis || "-"}</div><div class="row"><button class="action" data-lecture-edit="${l.id}">Edit</button><button class="action danger" data-lecture-delete="${l.id}">Delete</button></div></li>`).join("") || "<li class='empty-state'>No lectures saved for this course yet.</li>"}</ul></div></div>`;
  if (panel === "labs") return `<div class="course-panel two-column-panel"><div class="card"><h3>Add lab work</h3><p class="small">Create a lab for <strong>${course.name}</strong> and move it through its stages.</p>${courseLabForm(course)}</div><div class="card"><h3>${course.name} labs</h3><ul class="clean course-record-list">${labs.map((l) => `<li><strong>Lab ${l.lab_number || "-"}: ${l.experiment_title}</strong><div class="small">Due ${l.due_date || "not set"} · ${l.pipeline_stage}</div><div class="row"><select data-lab-stage="${l.id}">${["Task Given", "Understanding", "Implementation", "Testing", "Report", "Submission", "Viva"].map((s) => `<option ${s === l.pipeline_stage ? "selected" : ""}>${s}</option>`).join("")}</select><button class="action" data-lab-submit="${l.id}">Submit</button><button class="action danger" data-lab-delete="${l.id}">Delete</button></div></li>`).join("") || "<li class='empty-state'>No labs for this course yet.</li>"}</ul></div></div>`;
  if (panel === "timetable") return `<div class="course-panel two-column-panel"><div class="card"><h3>Add class schedule</h3><p class="small">This slot will only appear in the timetable for <strong>${course.name}</strong>.</p>${courseSlotForm(course)}</div><div class="card"><h3>${course.name} timetable</h3><ul class="clean course-record-list">${slots.map((s) => `<li><strong>${s.day_of_week}</strong> · ${s.start_time}–${s.end_time}<div class="small">${s.room || "Room not set"}</div><button class="action danger" data-slot-delete="${s.id}">Delete slot</button></li>`).join("") || "<li class='empty-state'>No classes scheduled for this course yet.</li>"}</ul></div></div>`;
  return `<div class="course-panel course-overview"><div class="course-stat"><span>Tasks</span><strong>${tasks.length}</strong><small>${tasks.filter((t) => t.status !== "Completed").length} still open</small></div><div class="course-stat"><span>Lectures</span><strong>${lectures.length}</strong><small>${lectures.filter((l) => !l.is_reviewed).length} to review</small></div><div class="course-stat"><span>Labs</span><strong>${labs.length}</strong><small>${labs.filter((l) => l.pipeline_stage !== "Submission" && l.pipeline_stage !== "Viva").length} in progress</small></div><div class="course-stat"><span>Classes</span><strong>${slots.length}</strong><small>scheduled each week</small></div><div class="card course-progress-card"><h3>Course progress</h3><div class="course-health"><div>Task completion<div class="progress-track"><span style="width:${health.taskCompletion}%"></span></div></div><div>Lecture review<div class="progress-track"><span style="width:${health.lectureReview}%"></span></div></div></div></div></div>`;
}

function courseTaskForm(course) {
  const types = ["Homework", "Assignment", "Lab Assignment", "Lab Report", "Project", "Quiz Prep", "Exam Prep", "Reading", "Practice", "Coding Task", "Submission", "Presentation", "Viva Prep"];
  return `<form id="course-task-form"><input type="hidden" name="course_id" value="${course.id}"/><label>Title<input name="title" required placeholder="e.g. Assignment 2"/></label><label>Type<select name="task_type">${types.map((type) => `<option>${type}</option>`).join("")}</select></label><div class="row"><label>Due date<input type="date" name="due_date"/></label><label>Due time<input type="time" name="due_time"/></label></div><div class="row"><label>Priority<select name="priority"><option>Medium</option><option>High</option><option>Urgent</option><option>Low</option></select></label><label>Estimate (minutes)<input type="number" name="estimated_minutes" min="0"/></label></div><label>Notes<textarea name="notes" placeholder="What needs to be done?"></textarea></label><button class="action primary" type="submit">Add to ${course.name}</button></form>`;
}

function courseLectureForm(course) { const today = new Date().toISOString().slice(0, 10); return `<form id="course-lecture-form"><input type="hidden" name="course_id" value="${course.id}"/><label>Date<input type="date" name="date" value="${today}" required/></label><label>Topics covered<textarea name="topics_covered"></textarea></label><label>Teacher emphasis<textarea name="teacher_emphasis"></textarea></label><label>Homework given<textarea name="homework_given"></textarea></label><label>Remember for next class<textarea name="remember_for_next"></textarea></label><button class="action primary" type="submit">Save lecture memory</button></form>`; }

function courseLabForm(course) { return `<form id="course-lab-form"><input type="hidden" name="course_id" value="${course.id}"/><div class="row"><label>Lab number<input type="number" name="lab_number"/></label><label>Date<input type="date" name="date"/></label></div><label>Task / experiment title<input name="experiment_title" required/></label><label>Instructions<textarea name="instructions"></textarea></label><label>Submission deadline<input type="date" name="due_date"/></label><button class="action primary" type="submit">Add lab</button></form>`; }

function courseSlotForm(course) { const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; return `<form id="course-slot-form"><input type="hidden" name="course_id" value="${course.id}"/><label>Day<select name="day_of_week">${days.map((d) => `<option>${d}</option>`).join("")}</select></label><div class="row"><label>Start<input type="time" name="start_time" required/></label><label>End<input type="time" name="end_time" required/></label></div><label>Room<input name="room" placeholder="e.g. A-101"/></label><button class="action primary" type="submit">Add schedule</button></form>`; }

function courseForm(courseTypes) {
  return `<div class="card"><h4>Add Course</h4><form id="course-form">
    <label>Name<input name="name" required placeholder="e.g. Compiler Construction" /></label>
    <label>Type<select name="type">${courseTypes.map((type) => `<option value="${type}">${type[0].toUpperCase()}${type.slice(1)}</option>`).join("")}</select></label>
    <label>Instructor<input name="instructor" placeholder="Optional" /></label>
    <label>Color tag<input name="color_tag" type="color" value="#2f6fed" /></label>
    <button class="action primary" type="submit">Add Course</button>
  </form></div>`;
}
