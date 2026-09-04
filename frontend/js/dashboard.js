import { formatTime } from "./time.js?v=studyos-course-workspace-1";

function badgeClass(status) {
  const key = (status || "").toLowerCase();
  if (key.includes("progress")) return "progress";
  if (key.includes("completed")) return "completed";
  return "upcoming";
}

// Maps the backend's own urgency label (task.urgency.label, computed in
// services/urgency.py) to one of the existing badge CSS classes. This
// does NOT recompute urgency - it only decides which color to use for
// a label the backend already decided on, so there's exactly one place
// (the backend) that defines what counts as "Overdue" vs "Critical" etc.
function urgencyBadgeClass(label) {
  const key = (label || "").toLowerCase();
  if (key === "overdue") return "overdue";
  if (key === "critical" || key === "high") return "urgent";
  if (key === "completed") return "completed";
  return "upcoming"; // Medium, Low, No deadline
}

// Pure display formatting: combines the backend's label with the
// backend's own days_left/is_overdue numbers so the badge reads like
// "Overdue (3d)" or "Critical (today)". No thresholds are decided here -
// those numbers and the label word both come straight from the API
// response (task.urgency), this just arranges them into readable text.
function formatTaskUrgency(urgency) {
  if (!urgency) return "No urgency";
  const days = urgency.days_left;
  if (days === null || days === undefined) return urgency.label;
  const dayText = urgency.is_overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`;
  return `${urgency.label} (${dayText})`;
}

function humanDate(value) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

export function buildAcademicCheck(state) {
  const findings = [];
  const today = new Date();

  const noDeadline = state.tasks.filter((t) => !t.due_date).length;
  if (noDeadline) findings.push(`${noDeadline} task(s) have no deadline.`);

  const overdue = state.tasks.filter((t) => t.due_date && new Date(t.due_date) < today && t.status !== "Completed");
  if (overdue.length) findings.push(`${overdue.length} task(s) are overdue.`);

  const noLectureSummary = state.lectures.filter((l) => !l.is_captured).length;
  if (noLectureSummary) findings.push(`${noLectureSummary} lecture(s) missing summaries.`);

  const labsNoSubmission = state.labs.filter((l) => l.pipeline_stage !== "Submission" && l.pipeline_stage !== "Viva").length;
  if (labsNoSubmission) findings.push(`${labsNoSubmission} lab(s) pending submission stage.`);

  const inactiveCourses = state.courses.filter((c) => !state.lectures.some((l) => l.course_id === c.id));
  if (inactiveCourses.length) findings.push(`${inactiveCourses.length} course(s) have no lecture history yet.`);

  return findings.length ? findings : ["Great! No urgent academic gaps detected right now."];
}

export function renderTodayView(state) {
  const classes = state.dashboard?.classes_today || [];
  const urgentItems = state.dashboard?.urgent_items || [];
  const topActions = state.dashboard?.top_actions || [];
  const nextClass = state.dashboard?.next_class;
  const tomorrowPreparation = state.dashboard?.tomorrow_preparation || [];
  const previousLecture = state.previousLecture;

  const classRows = classes.length
    ? classes.map((c) => `<li class="class-row">
        <time>${formatTime(c.start_time)}</time><span class="class-dot ${badgeClass(c.status)}"></span>
        <div><strong>${c.course_name}</strong><small>${c.course_type || "Class"}${c.room ? ` · ${c.room}` : ""}</small></div>
        <span class="schedule-status ${badgeClass(c.status)}">${c.status}</span>
      </li>`).join("")
    : `<li class="empty-state">No classes scheduled for today.</li>`;

  const urgentTask = urgentItems[0] || topActions[0];
  const urgentCourseId = state.tasks.find((task) => task.id === urgentTask?.id)?.course_id || "";
  const taskRows = topActions.length
    ? topActions.slice(0, 3).map((t) => `<li><label><input type="checkbox" data-top-task="${t.id}"/> <span>${t.title}</span></label></li>`).join("")
    : `<li class="empty-state">Your top tasks will appear here.</li>`;
  const reminders = state.dashboard?.reminders || topActions.slice(1, 4);
  const reminderRows = reminders.length
    ? reminders.map((t) => `<li>${t.title}</li>`).join("")
    : `<li>Review your upcoming coursework.</li><li>Capture notes after class.</li>`;
  const previousLectureContent = previousLecture
    ? `<p class="lecture-topic">${previousLecture.topics_covered || "Previous lecture"}</p>
       <p><span>Teacher emphasized:</span> ${previousLecture.teacher_emphasis || "No emphasis recorded."}</p>`
    : `<p class="lecture-topic">No lecture memory yet</p><p><span>Tip:</span> Capture a short summary after your next class.</p>`;
  const tomorrowRows = tomorrowPreparation.length
    ? tomorrowPreparation.map((item) => `<article class="prep-item">
        <div class="prep-item-heading"><div><strong>${item.course_name}</strong><span>${formatTime(item.start_time)}–${formatTime(item.end_time)}${item.room ? ` · ${item.room}` : ""}</span></div><span class="prep-type">${item.course_type}</span></div>
        <div class="prep-columns"><div><b>Review</b><p>${item.last_topic || "No previous topic recorded."}</p></div><div><b>Focus</b><p>${item.due_tasks.length ? item.due_tasks.join(" · ") : "Key concepts and examples"}</p></div><div><b>Ask your teacher</b><p>${item.questions_to_ask.length ? item.questions_to_ask.join(" · ") : "No question captured yet."}</p></div></div>
      </article>`).join("")
    : `<p class="empty-state">No classes scheduled tomorrow.</p>`;

  return `<section class="today-dashboard">
    <div class="dashboard-greeting"><h1>Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, Fida <span>👋</span></h1><p>${humanDate(state.dashboard?.date)}</p></div>
    <section class="schedule-card">
      <div class="section-heading"><h2>Today’s classes</h2><button class="text-button" id="check-academics">Check academics</button></div>
      <ul class="class-list">${classRows}</ul>
    </section>
    <section class="prep-notification">
      <div class="prep-notification-header"><div><span class="eyebrow">Before tomorrow</span><h2>Prepare for your next classes</h2></div><span class="prep-count">${tomorrowPreparation.length} class${tomorrowPreparation.length === 1 ? "" : "es"}</span></div>
      <p class="prep-intro">Review the last topic, notice pending work, and carry one good question into class.</p>
      <div class="prep-list">${tomorrowRows}</div>
    </section>
    <div class="dashboard-columns">
      <div class="dashboard-stack">
        <article class="focus-card urgent-card">
          <div class="card-kicker"><span class="priority-dot"></span>Urgent</div>
          ${urgentTask ? `<h2>${urgentTask.title}</h2><p>${formatTaskUrgency(urgentTask.urgency)}${urgentTask.course_name ? ` · ${urgentTask.course_name}` : ""}</p><p class="subtle">${urgentTask.status || "Not Started"}</p><button class="blue-button" data-open-course="${urgentCourseId}" data-open-panel="tasks">Open course workspace <span>→</span></button>` : `<h2>You’re all caught up</h2><p>No urgent tasks right now.</p><button class="blue-button" data-view="courses">Open courses <span>→</span></button>`}
        </article>
        <article class="panel-card task-card"><h2><span>🎯</span> Today’s top tasks</h2><ul class="check-list">${taskRows}</ul></article>
      </div>
      <div class="dashboard-stack">
        <article class="focus-card next-class-card">
              <div class="next-heading"><span>📚 Next class</span><strong>${nextClass ? formatTime(nextClass.start_time) : "—"}</strong></div>
          ${nextClass ? `<h2>${nextClass.course_name}</h2>` : `<h2>No upcoming class</h2>`}
          <div class="previous-lecture"><h3>Last lecture</h3>${previousLectureContent}</div>
          ${nextClass ? `<button class="blue-button" id="open-review-modal">Quick review <span>→</span></button>` : ""}
        </article>
        <article class="panel-card reminder-card"><h2><span>🧠</span> Don’t forget</h2><ul>${reminderRows}</ul></article>
      </div>
    </div>
  </section>`;
}
