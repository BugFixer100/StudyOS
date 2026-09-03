import { api } from "./api.js";
import { renderTodayView, buildAcademicCheck } from "./dashboard.js";
import { renderTasksView } from "./tasks.js";
import { renderCoursesView, renderWeeklyView } from "./courses.js";
import { renderLecturesView, lectureCaptureModal, lectureReviewModal, lectureMatches } from "./lectures.js";
import { renderLabsView } from "./labs.js";
import { renderCalendarView } from "./calendar.js";
import { renderTimetableView } from "./timetable.js";
import { globalSearch, renderSearchView } from "./search.js";

const statusEl = document.getElementById("status");
const rootEl = document.getElementById("view-root");
const titleEl = document.getElementById("view-title");
const lectureModal = document.getElementById("lecture-capture-modal");
const reviewModal = document.getElementById("lecture-review-modal");
const quickAddModal = document.getElementById("quick-add-modal");

const state = {
  currentView: "today",
  courses: [],
  tasks: [],
  lectures: [],
  labs: [],
  timetable: [],
  dashboard: null,
  previousLecture: null,
  selectedCourseId: null,
  courseName: {},
  prepChecklist: ["Review previous lecture", "Revise key concepts", "Carry pending questions"],
  prepChecked: [],
  localSubtasks: {},
  localAttachments: { tasks: {}, lectures: {}, courses: {}, labs: {} },
  inbox: [],
  questionsByCourse: {},
  examPrepByCourse: {},
  studySessions: [],
  activeSession: null,
  searchQuery: "",
  searchResults: [],
};

function loadLocal() {
  Object.assign(state, JSON.parse(localStorage.getItem("studyos_local") || "{}"));
}

function saveLocal() {
  localStorage.setItem("studyos_local", JSON.stringify({
    prepChecked: state.prepChecked,
    localSubtasks: state.localSubtasks,
    localAttachments: state.localAttachments,
    inbox: state.inbox,
    questionsByCourse: state.questionsByCourse,
    examPrepByCourse: state.examPrepByCourse,
    studySessions: state.studySessions,
    activeSession: state.activeSession,
  }));
}

function toPayload(form) {
  const data = new FormData(form);
  const obj = Object.fromEntries(data.entries());
  Object.keys(obj).forEach((k) => {
    if (obj[k] === "") delete obj[k];
  });
  if (obj.course_id) obj.course_id = Number(obj.course_id);
  if (obj.lab_number) obj.lab_number = Number(obj.lab_number);
  if (obj.estimated_minutes) obj.estimated_minutes = Number(obj.estimated_minutes);
  if (obj.progress_percent !== undefined) obj.progress_percent = Number(obj.progress_percent || 0);
  return obj;
}

async function refreshData() {
  statusEl.textContent = "Loading data...";
  try {
    const [health, courses, tasks, lectures, labs, timetable, dashboard] = await Promise.all([
      api.health(),
      api.listCourses(),
      api.listTasks(),
      api.listLectures(),
      api.listLabs(),
      api.listTimetable(),
      api.getTodayDashboard(),
    ]);

    state.courses = courses;
    state.tasks = tasks;
    state.lectures = lectures;
    state.labs = labs;
    state.timetable = timetable;
    state.dashboard = dashboard;
    state.courseName = Object.fromEntries(courses.map((c) => [c.id, c.name]));

    const nextCourseId = state.courses.find((c) => c.name === dashboard?.next_class?.course_name)?.id;
    state.previousLecture = null;
    if (nextCourseId) {
      try {
        state.previousLecture = await api.getLastLecture(nextCourseId);
      } catch (err) {
        state.previousLecture = null;
      }
    }

    statusEl.textContent = `✅ ${health.message}`;
    render();
  } catch (err) {
    statusEl.textContent = `❌ ${err.message}`;
  }
}

function renderInboxView() {
  const rows = state.inbox.map((item, idx) => `<li>${item.text} <span class="small">(${item.kind || "raw"})</span>
    <div class="row"><button class="action" data-inbox-convert="${idx}">Convert to Task</button><button class="action danger" data-inbox-delete="${idx}">Delete</button></div></li>`).join("") || "<li>Inbox is clear.</li>";
  return `<div class="grid cols-2"><div class="card"><h3>Academic Inbox</h3><form id="inbox-form"><label>Capture Item<textarea name="text" required></textarea></label><button class="action primary" type="submit">Add to Inbox</button></form></div><div class="card" style="grid-column:1/-1"><ul class="clean">${rows}</ul></div></div>`;
}

function examProgress(courseId) {
  const cfg = state.examPrepByCourse[courseId] || { exam_date: "", syllabus: "", topics: [] };
  const done = cfg.topics.filter((t) => t.done).length;
  const total = cfg.topics.length || 1;
  return { cfg, pct: Math.round((done / total) * 100) };
}

function renderStudyView() {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const sessions = state.studySessions.slice().reverse().map((s) => `<li>${s.date} • ${state.courseName[s.course_id] || "General"} • ${s.duration} min • ${s.outcome || "No note"}</li>`).join("") || "<li>No study sessions yet.</li>";
  const exams = state.courses.map((course) => {
    const { cfg, pct } = examProgress(course.id);
    return `<details><summary>${course.name} Exam Prep (${pct}%)</summary>
      <div class="small">Exam date: ${cfg.exam_date || "-"}</div>
      <div class="small">Syllabus: ${cfg.syllabus || "-"}</div>
      <ul class="clean">${(cfg.topics || []).map((t, i) => `<li><label><input type="checkbox" data-exam-topic-toggle="${course.id}:${i}" ${t.done ? "checked" : ""}/> ${t.name}</label></li>`).join("") || "<li>No topics</li>"}</ul>
      <div class="row"><input data-exam-topic-input="${course.id}" placeholder="Weak topic/resource"/><button class="action" data-exam-topic-add="${course.id}">Add Topic</button></div>
      <div class="row"><input data-question-input="${course.id}" placeholder="Question to ask teacher"/><button class="action" data-question-add="${course.id}">Add Question</button></div>
      <div class="small">Questions: ${(state.questionsByCourse[course.id] || []).map((q) => `• ${q.text}${q.done ? " ✅" : ""}`).join(" ") || "None"}</div>
    </details>`;
  }).join("") || "<p>No courses.</p>";

  return `<div class="grid cols-2"><div class="card"><h3>Study Session Tracking</h3>
    <form id="study-start-form"><label>Course<select name="course_id" required><option value="">Select</option>${courseOptions}</select></label><label>Planned Duration (min)<input type="number" name="duration" min="1" required /></label><button class="action primary" type="submit">Start Session</button></form>
    ${state.activeSession ? `<div class="card"><p>Active: ${state.courseName[state.activeSession.course_id] || "Course"} (${state.activeSession.duration} min)</p><button class="action" id="study-stop-btn">Stop & Save Outcome</button></div>` : ""}
  </div><div class="card"><h3>Weekly Study Statistics</h3><ul class="clean">${sessions}</ul></div><div class="card" style="grid-column:1/-1"><h3>Exam Preparation & Questions To Ask Teacher</h3>${exams}</div></div>`;
}

function render() {
  const titles = {
    today: "Today Dashboard",
    weekly: "Weekly Dashboard",
    tasks: "Task Management",
    courses: "Courses",
    lectures: "Lecture Memory",
    labs: "Lab Management",
    timetable: "Timetable",
    calendar: "Calendar",
    search: "Global Search",
    inbox: "Academic Inbox",
    study: "Study Sessions & Exams",
  };
  titleEl.textContent = titles[state.currentView] || "StudyOS";

  const viewMarkup = {
    today: renderTodayView(state),
    weekly: renderWeeklyView(state),
    tasks: renderTasksView(state),
    courses: renderCoursesView(state),
    lectures: renderLecturesView(state),
    labs: renderLabsView(state),
    timetable: renderTimetableView(state),
    calendar: renderCalendarView(state),
    search: renderSearchView(state),
    inbox: renderInboxView(),
    study: renderStudyView(),
  };

  rootEl.innerHTML = viewMarkup[state.currentView] || "<p>Unknown view</p>";
  document.querySelectorAll(".sidebar button[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.currentView);
  });
}

function parseQuickAdd(text) {
  const input = text.toLowerCase();
  if (input.includes("assignment") || input.includes("homework") || input.includes("lab")) {
    const due = /due\s+(\d{4}-\d{2}-\d{2})/.exec(input);
    return { type: "task", title: text, task_type: input.includes("lab") ? "Lab Assignment" : (input.includes("assignment") ? "Assignment" : "Homework"), due_date: due?.[1] };
  }
  if (input.includes("lecture")) return { type: "lecture", title: text };
  if (input.includes("deadline")) return { type: "deadline", title: text };
  return { type: "inbox", title: text };
}

function openQuickAdd() {
  quickAddModal.innerHTML = `<form id="quick-add-form"><h3>+ Quick Add</h3><label>Natural language input<textarea name="text" placeholder="ML assignment due 2026-09-10"></textarea></label><button class="action primary" type="submit">Parse & Add</button><button class="action" type="button" data-close-modal>Close</button></form>`;
  quickAddModal.showModal();
}

function openLectureCapture(courseName) {
  lectureModal.innerHTML = lectureCaptureModal(courseName);
  lectureModal.showModal();
}

function openLectureReview() {
  reviewModal.innerHTML = lectureReviewModal(state.previousLecture);
  reviewModal.showModal();
}

document.addEventListener("click", async (event) => {
  const target = event.target;

  if (target.matches(".sidebar button[data-view]")) {
    state.currentView = target.dataset.view;
    render();
  }

  if (target.id === "refresh-btn") await refreshData();
  if (target.id === "quick-add-open") openQuickAdd();
  if (target.id === "open-review-modal") openLectureReview();
  if (target.matches("[data-close-modal]")) {
    lectureModal.close();
    reviewModal.close();
    quickAddModal.close();
  }

  if (target.matches("[data-prep]")) {
    const idx = Number(target.dataset.prep);
    state.prepChecked = target.checked ? [...new Set([...(state.prepChecked || []), idx])] : (state.prepChecked || []).filter((x) => x !== idx);
    saveLocal();
  }

  if (target.matches("[data-check-academics], #check-academics")) {
    alert(buildAcademicCheck(state).join("\n"));
  }

  if (target.matches("[data-complete-class]")) {
    openLectureCapture(target.dataset.completeClass);
  }

  if (target.matches("[data-mark-reviewed]")) {
    const id = Number(target.dataset.markReviewed);
    await api.updateLecture(id, { is_reviewed: true });
    reviewModal.close();
    await refreshData();
  }

  if (target.matches("[data-task-delete]")) {
    await api.deleteTask(Number(target.dataset.taskDelete));
    await refreshData();
  }

  if (target.matches("[data-task-submit]")) {
    const id = Number(target.dataset.taskSubmit);
    await api.submitTask(id, { method: "Frontend Confirmed", proof_link: "" });
    await refreshData();
  }

  if (target.matches("[data-task-edit]")) {
    const id = Number(target.dataset.taskEdit);
    const task = state.tasks.find((t) => t.id === id);
    const title = prompt("Edit task title", task?.title || "");
    if (title) {
      await api.updateTask(id, { title });
      await refreshData();
    }
  }

  if (target.matches("[data-subtask-add]")) {
    const taskId = Number(target.dataset.subtaskAdd);
    const input = rootEl.querySelector(`[data-subtask-input='${taskId}']`);
    if (input?.value?.trim()) {
      state.localSubtasks[taskId] = [...(state.localSubtasks[taskId] || []), { title: input.value.trim(), done: false }];
      input.value = "";
      saveLocal();
      render();
    }
  }

  if (target.matches("[data-subtask-toggle]")) {
    const [taskId, idx] = target.dataset.subtaskToggle.split(":").map(Number);
    const subtasks = state.localSubtasks[taskId] || [];
    subtasks[idx].done = target.checked;
    saveLocal();
  }

  if (target.matches("[data-lecture-delete]")) {
    await api.deleteLecture(Number(target.dataset.lectureDelete));
    await refreshData();
  }

  if (target.matches("[data-lecture-edit]")) {
    const id = Number(target.dataset.lectureEdit);
    const lecture = state.lectures.find((l) => l.id === id);
    const topics = prompt("Edit topics", lecture?.topics_covered || "");
    if (topics !== null) {
      await api.updateLecture(id, { topics_covered: topics });
      await refreshData();
    }
  }

  if (target.matches("[data-lab-delete]")) {
    await api.deleteLab(Number(target.dataset.labDelete));
    await refreshData();
  }

  if (target.matches("[data-lab-submit]")) {
    await api.submitLab(Number(target.dataset.labSubmit), { method: "Frontend Confirmed", proof_link: "" });
    await refreshData();
  }

  if (target.matches("[data-slot-delete]")) {
    await api.deleteTimetableSlot(Number(target.dataset.slotDelete));
    await refreshData();
  }

  if (target.matches("[data-course-tab]")) {
    state.selectedCourseId = Number(target.dataset.courseTab);
    render();
  }

  if (target.matches("[data-inbox-delete]")) {
    state.inbox.splice(Number(target.dataset.inboxDelete), 1);
    saveLocal();
    render();
  }

  if (target.matches("[data-inbox-convert]")) {
    const item = state.inbox[Number(target.dataset.inboxConvert)];
    if (item && state.courses[0]) {
      await api.createTask({
        course_id: state.courses[0].id,
        title: item.text,
        task_type: "Practice",
        status: "Not Started",
      });
      state.inbox = state.inbox.filter((x) => x !== item);
      saveLocal();
      await refreshData();
    }
  }

  if (target.id === "study-stop-btn" && state.activeSession) {
    const outcome = prompt("What did you accomplish?") || "";
    state.studySessions.push({ ...state.activeSession, outcome, date: new Date().toISOString().slice(0, 10) });
    state.activeSession = null;
    saveLocal();
    render();
  }

  if (target.matches("[data-exam-topic-add]")) {
    const courseId = Number(target.dataset.examTopicAdd);
    const input = rootEl.querySelector(`[data-exam-topic-input='${courseId}']`);
    if (input?.value?.trim()) {
      const cfg = state.examPrepByCourse[courseId] || { exam_date: "", syllabus: "", topics: [] };
      cfg.topics.push({ name: input.value.trim(), done: false });
      state.examPrepByCourse[courseId] = cfg;
      input.value = "";
      saveLocal();
      render();
    }
  }

  if (target.matches("[data-exam-topic-toggle]")) {
    const [courseId, idx] = target.dataset.examTopicToggle.split(":").map(Number);
    const topic = state.examPrepByCourse[courseId]?.topics?.[idx];
    if (topic) {
      topic.done = target.checked;
      saveLocal();
    }
  }

  if (target.matches("[data-question-add]")) {
    const courseId = Number(target.dataset.questionAdd);
    const input = rootEl.querySelector(`[data-question-input='${courseId}']`);
    if (input?.value?.trim()) {
      state.questionsByCourse[courseId] = [...(state.questionsByCourse[courseId] || []), { text: input.value.trim(), done: false }];
      input.value = "";
      saveLocal();
      render();
    }
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.matches("input[name='attachments']")) {
    const form = target.closest("form");
    const taskId = form?.dataset?.taskId;
    if (taskId && target.files?.length) {
      state.localAttachments.tasks[taskId] = [...(state.localAttachments.tasks[taskId] || []), ...Array.from(target.files).map((f) => f.name)];
      saveLocal();
    }
  }

  if (target.matches("select[data-lab-stage]")) {
    const labId = Number(target.dataset.labStage);
    await api.updateLab(labId, { pipeline_stage: target.value });
    await refreshData();
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;

  try {
    if (form.id === "task-form") {
      const payload = toPayload(form);
      await api.createTask(payload);
      const files = form.querySelector("input[name='attachments']")?.files || [];
      if (files.length) {
        const taskTitle = payload.title;
        const task = state.tasks.find((t) => t.title === taskTitle);
        if (task) {
          state.localAttachments.tasks[task.id] = [...(state.localAttachments.tasks[task.id] || []), ...Array.from(files).map((f) => f.name)];
          saveLocal();
        }
      }
      form.reset();
      await refreshData();
    }

    if (form.id === "lecture-form") {
      await api.createLecture(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "lab-form") {
      await api.createLab(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "slot-form") {
      await api.createTimetableSlot(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "inbox-form") {
      const payload = toPayload(form);
      state.inbox.push({ text: payload.text, created_at: new Date().toISOString() });
      saveLocal();
      form.reset();
      render();
    }

    if (form.id === "study-start-form") {
      const payload = toPayload(form);
      state.activeSession = { course_id: payload.course_id, duration: payload.duration };
      saveLocal();
      render();
    }

    if (form.id === "quick-add-form") {
      const payload = parseQuickAdd(toPayload(form).text || "");
      if (payload.type === "task" && state.courses[0]) {
        await api.createTask({
          course_id: state.courses[0].id,
          title: payload.title,
          task_type: payload.task_type,
          due_date: payload.due_date,
          status: "Not Started",
        });
      } else if (payload.type === "lecture" && state.courses[0]) {
        await api.createLecture({ course_id: state.courses[0].id, date: new Date().toISOString().slice(0, 10), topics_covered: payload.title });
      } else {
        state.inbox.push({ text: payload.title, kind: payload.type });
        saveLocal();
      }
      quickAddModal.close();
      await refreshData();
    }

    if (form.id === "lecture-capture-inline") {
      const payload = toPayload(form);
      const nextCourseName = state.dashboard?.next_class?.course_name;
      const course = state.courses.find((c) => c.name === nextCourseName) || state.courses[0];
      if (course) {
        payload.course_id = course.id;
        await api.createLecture(payload);
      }
      lectureModal.close();
      await refreshData();
    }
  } catch (err) {
    alert(`Action failed: ${err.message}`);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "global-search-input") {
    state.searchQuery = target.value;
    state.searchResults = globalSearch(state, target.value);
    render();
  }

  if (target.id === "lecture-search") {
    const q = target.value.trim();
    const filtered = q ? state.lectures.filter((l) => lectureMatches(l, q)) : state.lectures;
    const list = rootEl.querySelector("#lecture-history-list");
    if (list) {
      list.innerHTML = filtered.map((l, idx) => `<li><strong>#${idx + 1} ${state.courseName[l.course_id] || "Course"}</strong> • ${l.date}<div class='small'>${l.topics_covered || "-"}</div></li>`).join("") || "<li>No results</li>";
    }
  }
});

loadLocal();
refreshData();
setInterval(refreshData, 60000);
