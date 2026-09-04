import { api } from "./api.js?v=studyos-course-workspace-1";
import { renderTodayView, buildAcademicCheck } from "./dashboard.js?v=studyos-prep-ui-4";
import { renderTasksView } from "./tasks.js?v=studyos-prep-ui-4";
import { renderCoursesView, renderWeeklyView } from "./courses.js?v=studyos-health-ui-2";
import { renderLecturesView, lectureCaptureModal, lectureReviewModal, lectureMatches } from "./lectures.js?v=studyos-course-workspace-1";
import { renderLabsView } from "./labs.js?v=studyos-course-workspace-1";
import { renderCalendarView } from "./calendar.js?v=studyos-ui-2";
import { renderTimetableView } from "./timetable.js?v=studyos-schedule-ui-3";
import { globalSearch, renderSearchView, renderSearchResults } from "./search.js?v=studyos-search-2";

const statusEl = document.getElementById("status");
const rootEl = document.getElementById("view-root");
const titleEl = document.getElementById("view-title");
const lectureModal = document.getElementById("lecture-capture-modal");
const reviewModal = document.getElementById("lecture-review-modal");
const quickAddModal = document.getElementById("quick-add-modal");
const requestedView = new URLSearchParams(window.location.search).get("view");

const state = {
  currentView: requestedView || "today",
  courses: [],
  tasks: [],
  lectures: [],
  labs: [],
  timetable: [],
  scheduleExceptions: [],
  dashboard: null,
  previousLecture: null,
  selectedCourseId: null,
  coursePanel: "overview",
  courseName: {},
  prepChecklist: ["Review previous lecture", "Revise key concepts", "Carry pending questions"],
  prepChecked: [],
  localAttachments: { tasks: {}, lectures: {}, courses: {}, labs: {} },
  inbox: [],
  questionsByCourse: {},
  examPrepByCourse: {},
  studySessions: [],
  activeSession: null,
  searchQuery: "",
  searchCategory: "All",
  searchResults: [],
  focusedRecord: null,
};

function loadLocal() {
  const saved = JSON.parse(localStorage.getItem("studyos_local") || "{}");
  state.prepChecked = saved.prepChecked || [];
  state.localAttachments = saved.localAttachments || state.localAttachments;
  state.coursePanel = saved.coursePanel || state.coursePanel;
}

function saveLocal() {
  localStorage.setItem("studyos_local", JSON.stringify({
    prepChecked: state.prepChecked,
    localAttachments: state.localAttachments,
    coursePanel: state.coursePanel,
  }));
}

function notificationItems() {
  const preparation = state.dashboard?.tomorrow_preparation || [];
  const items = preparation.map((item) => ({
    kind: "prep",
    label: "Tomorrow",
    title: `Prepare ${item.course_name}`,
    detail: item.last_topic || "Review the last lecture and prepare one question.",
    view: "study",
  }));
  const urgent = state.dashboard?.urgent_items || [];
  urgent.slice(0, 4).forEach((task) => items.push({
    kind: "task",
    label: task.urgency.label,
    title: task.title,
    detail: `${task.course_name || "Course"} · ${task.urgency.label.toLowerCase()}`,
    view: "tasks",
  }));
  return items.slice(0, 8);
}

function renderNotifications() {
  const panel = document.getElementById("notification-panel");
  const count = document.getElementById("notification-count");
  if (!panel || !count) return;
  const items = notificationItems();
  count.textContent = items.length > 9 ? "9+" : String(items.length);
  panel.innerHTML = `<div class="notification-panel-heading"><div><strong>Academic reminders</strong><span>${items.length ? `${items.length} need your attention` : "You are all caught up"}</span></div><button class="notification-close" aria-label="Close notifications">×</button></div>${items.length ? `<ul>${items.map((item, index) => `<li><button data-notification-index="${index}"><span class="notification-kind ${item.kind}">${item.label}</span><strong>${item.title}</strong><small>${item.detail}</small></button></li>`).join("")}</ul>` : `<p class="notification-empty">No urgent academic reminders right now.</p>`}`;
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
    const [health, courses, tasks, lectures, labs, timetable, exceptions, dashboard, inbox, studySessions] = await Promise.all([
      api.health(),
      api.listCourses(),
      api.listTasks(),
      api.listLectures(),
      api.listLabs(),
      api.listTimetable(),
      api.listScheduleExceptions(),
      api.getTodayDashboard(),
      api.listInbox(),
      api.listStudySessions(),
    ]);

    state.courses = courses;
    state.tasks = tasks;
    state.lectures = lectures;
    state.labs = labs;
    state.timetable = timetable;
    state.scheduleExceptions = exceptions;
    state.dashboard = dashboard;
    state.inbox = inbox;
    state.studySessions = studySessions.filter((session) => session.ended_at);
    state.activeSession = studySessions.find((session) => !session.ended_at) || null;
    state.courseName = Object.fromEntries(courses.map((c) => [c.id, c.name]));

    const questionData = await Promise.all(courses.map(async (course) => {
        const questions = await api.listTeacherQuestions(course.id);
        return [course.id, questions.map((question) => ({
          id: question.id,
          text: question.text,
          done: question.is_done,
        }))];
    }));
    state.questionsByCourse = Object.fromEntries(questionData);

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
  const rows = state.inbox.map((item) => `<li>${item.text} <span class="small">(${item.kind || "raw"})</span>
    <div class="row"><button class="action" data-inbox-convert="${item.id}">Convert to Task</button><button class="action danger" data-inbox-delete="${item.id}">Delete</button></div></li>`).join("") || "<li>Inbox is clear.</li>";
  return `<div class="grid cols-2"><div class="card"><h3>Academic Inbox</h3><form id="inbox-form"><label>Capture Item<textarea name="text" required></textarea></label><button class="action primary" type="submit">Add to Inbox</button></form></div><div class="card" style="grid-column:1/-1"><ul class="clean">${rows}</ul></div></div>`;
}

function renderStudyView() {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const sessions = state.studySessions.map((s) => `<li>${s.started_at.slice(0, 10)} • ${state.courseName[s.course_id] || "General"} • ${s.planned_minutes} min • ${s.outcome || "No note"}</li>`).join("") || "<li>No study sessions yet.</li>";
  const courseMemory = state.courses.map((course) => {
    const lastLecture = state.lectures
      .filter((lecture) => lecture.course_id === course.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const questions = state.questionsByCourse[course.id] || [];
    return `<article class="card course-memory">
      <h3>${course.name}</h3>
      <p class="small">Last topic taught · ${lastLecture?.date || "No lecture recorded"}</p>
      <p>${lastLecture?.topics_covered || "No topic captured yet."}</p>
      <p class="small">Questions to ask in next class</p>
      <ul class="clean">${questions.map((question) => `<li>${question.text}</li>`).join("") || "<li>No questions yet.</li>"}</ul>
      <div class="row"><input data-question-input="${course.id}" placeholder="Question for next class"/><button class="action" data-question-add="${course.id}">Add Question</button></div>
    </article>`;
  }).join("") || "<p>No courses.</p>";

  return `<div class="grid cols-2"><div class="card"><h3>Study Session Tracking</h3>
    <form id="study-start-form"><label>Course<select name="course_id" required><option value="">Select</option>${courseOptions}</select></label><label>Planned Duration (min)<input type="number" name="duration" min="1" required /></label><button class="action primary" type="submit">Start Session</button></form>
    ${state.activeSession ? `<div class="card"><p>Active: ${state.courseName[state.activeSession.course_id] || "Course"} (${state.activeSession.planned_minutes} min)</p><button class="action" id="study-stop-btn">Stop & Save Outcome</button></div>` : ""}
  </div><div class="card"><h3>Study History</h3><ul class="clean">${sessions}</ul></div><div class="card" style="grid-column:1/-1"><h3>Class Memory</h3><p class="small">Review the last topic and capture questions before each subject.</p><div class="grid cols-2">${courseMemory}</div></div></div>`;
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
    study: "Class Memory",
  };
  const pageInfo = {
    weekly: ["📊", "Weekly overview", "See your classes, deadlines, and course momentum in one place."],
    tasks: ["☑️", "Task management", "Capture work once, then keep deadlines and progress under control."],
    courses: ["📚", "Course pages", "Your classes, lecture memory, assignments, and timetable by course."],
    lectures: ["🧠", "Lecture memory", "Save the few details that will make the next class easier."],
    labs: ["🧪", "Lab workspace", "Follow every experiment from the task brief to viva."],
    timetable: ["🕐", "Weekly timetable", "Plan your class schedule and keep rooms close at hand."],
    calendar: ["🗓️", "Calendar", "A calm view of upcoming classes, deadlines, labs, and study sessions."],
    search: ["⌕", "Global search", "Find a lecture, task, course, lab, or note in seconds."],
    inbox: ["📥", "Academic inbox", "Quickly capture loose reminders before they fall through the cracks."],
    study: ["🎯", "Class memory", "Review the last topic and prepare questions for your next class."],
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

  const markup = viewMarkup[state.currentView] || "<p>Unknown view</p>";
  const info = pageInfo[state.currentView];
    rootEl.innerHTML = state.currentView === "today"
      ? markup
      : `<div class="page-view"><header class="view-header"><div class="view-icon">${info?.[0] || "✦"}</div><div><p class="eyebrow">StudyOS workspace</p><h1>${info?.[1] || titleEl.textContent}</h1><p>${info?.[2] || "Keep your academic life organised."}</p></div></header>${markup}</div>`;
  document.querySelectorAll(".sidebar button[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.currentView);
  });
  renderNotifications();
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

function openLectureCapture(courseName, courseId) {
  lectureModal.innerHTML = lectureCaptureModal(courseName, courseId);
  lectureModal.showModal();
}

function openLectureReview() {
  reviewModal.innerHTML = lectureReviewModal(state.previousLecture);
  reviewModal.showModal();
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  const viewButton = target.closest("button[data-view]");
  const courseOpener = target.closest("button[data-open-course]");

  if (target.closest(".notification-button")) {
    const button = target.closest(".notification-button");
    const panel = document.getElementById("notification-panel");
    const open = panel?.hasAttribute("hidden");
    if (panel) panel.toggleAttribute("hidden", !open);
    button.setAttribute("aria-expanded", String(open));
    return;
  }

  if (target.matches(".notification-close")) {
    document.getElementById("notification-panel")?.setAttribute("hidden", "");
    document.querySelector(".notification-button")?.setAttribute("aria-expanded", "false");
    return;
  }

  const notificationAction = target.closest("[data-notification-index]");
  if (notificationAction) {
    const item = notificationItems()[Number(notificationAction.dataset.notificationIndex)];
    if (item) {
      state.currentView = item.view;
      render();
    }
    return;
  }

  if (viewButton) {
    state.currentView = viewButton.dataset.view;
    render();
  }

  const searchResult = target.closest("[data-search-result]");
  if (searchResult) {
    const type = searchResult.dataset.searchType;
    const id = Number(searchResult.dataset.searchId);
    const courseId = Number(searchResult.dataset.searchCourse) || null;
    state.focusedRecord = { type, id };
    state.selectedCourseId = courseId;
    state.coursePanel = type === "Subject" ? "overview" : type === "Task" ? "tasks" : type === "Lecture" ? "lectures" : type === "Lab" ? "labs" : "overview";
    state.currentView = type === "Subject" ? "courses" : type === "Task" ? "tasks" : type === "Lecture" ? "lectures" : type === "Lab" ? "labs" : "inbox";
    render();
    requestAnimationFrame(() => document.querySelector(`[data-record-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  if (courseOpener) {
    state.selectedCourseId = Number(courseOpener.dataset.openCourse) || state.selectedCourseId;
    state.coursePanel = courseOpener.dataset.openPanel || "overview";
    state.currentView = "courses";
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
    openLectureCapture(target.dataset.completeClass, target.dataset.courseId);
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
    if (!confirm("Confirm that this task has been submitted?")) return;
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
      await api.addSubtask(taskId, { title: input.value.trim() });
      input.value = "";
      await refreshData();
    }
  }

  if (target.matches("[data-subtask-toggle]")) {
    const subtaskId = Number(target.dataset.subtaskToggle);
    await api.updateSubtask(subtaskId, { is_done: target.checked });
    await refreshData();
  }

  if (target.matches("[data-subtask-delete]")) {
    const subtaskId = Number(target.dataset.subtaskDelete);
    await api.deleteSubtask(subtaskId);
    await refreshData();
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
    if (!confirm("Confirm that this lab has been submitted?")) return;
    await api.submitLab(Number(target.dataset.labSubmit), { method: "Frontend Confirmed", proof_link: "" });
    await refreshData();
  }

  if (target.matches("[data-slot-delete]")) {
    await api.deleteTimetableSlot(Number(target.dataset.slotDelete));
    await refreshData();
  }

  if (target.matches("[data-exception-delete]")) {
    await api.deleteScheduleException(Number(target.dataset.exceptionDelete));
    await refreshData();
  }

  if (target.matches("[data-course-tab]")) {
    state.selectedCourseId = Number(target.dataset.courseTab);
    state.coursePanel = "overview";
    render();
  }

  if (target.matches("[data-course-panel]")) {
    state.coursePanel = target.dataset.coursePanel;
    render();
  }

  if (target.matches("[data-inbox-delete]")) {
    await api.deleteInboxItem(Number(target.dataset.inboxDelete));
    await refreshData();
  }

  if (target.matches("[data-inbox-convert]")) {
    const item = state.inbox.find((entry) => entry.id === Number(target.dataset.inboxConvert));
    if (item && state.courses[0]) {
      await api.createTask({
        course_id: state.courses[0].id,
        title: item.text,
        task_type: "Practice",
        status: "Not Started",
      });
      await api.deleteInboxItem(item.id);
      await refreshData();
    }
  }

  if (target.id === "study-stop-btn" && state.activeSession) {
    const outcome = prompt("What did you accomplish?") || "";
    await api.finishStudySession(state.activeSession.id, { outcome });
    await refreshData();
  }

  if (target.matches("[data-question-add]")) {
    const courseId = Number(target.dataset.questionAdd);
    const input = rootEl.querySelector(`[data-question-input='${courseId}']`);
    if (input?.value?.trim()) {
      await api.createTeacherQuestion(courseId, { text: input.value.trim() });
      input.value = "";
      await refreshData();
    }
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.id === "search-category") {
    state.searchCategory = target.value;
    state.searchResults = globalSearch(state, state.searchQuery, state.searchCategory);
    renderSearchResults(state);
  }
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

    if (form.id === "course-task-form") {
      await api.createTask({ ...toPayload(form), status: "Not Started", progress_percent: 0 });
      form.reset();
      await refreshData();
    }

    if (form.id === "lecture-form") {
      await api.createLecture(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "course-lecture-form") {
      await api.createLecture(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "course-form") {
      await api.createCourse(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "lab-form") {
      await api.createLab(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "course-lab-form") {
      await api.createLab(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "slot-form") {
      await api.createTimetableSlot(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "course-slot-form") {
      await api.createTimetableSlot(toPayload(form));
      form.reset();
      await refreshData();
    }

    if (form.id === "exception-form") {
      const payload = toPayload(form);
      payload.is_cancelled = form.elements.is_cancelled.checked;
      await api.createScheduleException(payload);
      form.reset();
      await refreshData();
    }

    if (form.id === "inbox-form") {
      const payload = toPayload(form);
      await api.createInboxItem(payload);
      form.reset();
      await refreshData();
    }

    if (form.id === "study-start-form") {
      const payload = toPayload(form);
      await api.createStudySession({ course_id: payload.course_id, planned_minutes: payload.duration });
      await refreshData();
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
        await api.createInboxItem({ text: payload.title, kind: payload.type });
      }
      quickAddModal.close();
      await refreshData();
    }

    if (form.id === "lecture-capture-inline") {
      const payload = toPayload(form);
      if (payload.course_id) {
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
    state.searchResults = globalSearch(state, target.value, state.searchCategory);
    renderSearchResults(state);
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
