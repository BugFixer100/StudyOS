function badgeClass(status) {
  const key = (status || "").toLowerCase();
  if (key.includes("overdue")) return "overdue";
  if (key.includes("critical") || key.includes("urgent") || key.includes("due today")) return "urgent";
  if (key.includes("progress")) return "progress";
  if (key.includes("completed")) return "completed";
  return "upcoming";
}

function formatTaskUrgency(urgency) {
  if (!urgency) return "No urgency";
  if (urgency.is_overdue) return `OVERDUE (${Math.abs(urgency.days_left)}d)`;
  if (urgency.days_left === 0) return "DUE TODAY";
  if (urgency.days_left <= 2) return `Urgent (${urgency.days_left}d)`;
  if (urgency.days_left <= 6) return `Plan Soon (${urgency.days_left}d)`;
  return `Upcoming (${urgency.days_left}d)`;
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
  const previousLecture = state.previousLecture;

  const classRows = classes.length
    ? classes
      .map((c) => `<li>
        <strong>${c.course_name}</strong> (${c.course_type}) ${c.start_time}-${c.end_time}
        <div class="small">Room: ${c.room || "-"} • Instructor: ${c.instructor || "-"}</div>
        <span class="badge ${badgeClass(c.status)}">${c.status}</span>
        <button class="action" data-complete-class="${c.course_name}" data-course-id="${c.course_id || ""}">Mark Class Complete</button>
      </li>`)
      .join("")
    : "<li>No classes today.</li>";

  const urgentRows = urgentItems.length
    ? urgentItems.map((t) => `<li><strong>${t.title}</strong> • ${t.course_name || "-"} • <span class="badge ${badgeClass(formatTaskUrgency(t.urgency))}">${formatTaskUrgency(t.urgency)}</span></li>`).join("")
    : "<li>No urgent tasks.</li>";

  const actionRows = topActions.length
    ? topActions.map((t, i) => `<li>#${i + 1} ${t.title} (${t.priority})</li>`).join("")
    : "<li>No prioritized actions.</li>";

  const prepChecklist = (state.prepChecklist || ["Review previous lecture", "Re-check homework", "Prepare questions for teacher"])
    .map((item, i) => `<label><input type="checkbox" data-prep="${i}" ${state.prepChecked?.includes(i) ? "checked" : ""}/> ${item}</label>`)
    .join("");

  const reviewCard = previousLecture
    ? `<div class="card">
        <h3>Previous Lecture</h3>
        <div class="small">${previousLecture.date}</div>
        <p><strong>Topics:</strong> ${previousLecture.topics_covered || "-"}</p>
        <p><strong>Teacher Emphasis:</strong> ${previousLecture.teacher_emphasis || "-"}</p>
        <p><strong>Homework:</strong> ${previousLecture.homework_given || "-"}</p>
        <button class="action" id="open-review-modal">Mark Reviewed</button>
      </div>`
    : `<div class="card"><h3>Previous Lecture</h3><p class="small">No lecture memory yet for upcoming course.</p></div>`;

  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="today-header"><h3>Today's Classes</h3><button class="action" id="check-academics">CHECK MY ACADEMICS</button></div>
        <ul class="clean">${classRows}</ul>
      </div>
      <div class="card">
        <h3>Next Class</h3>
        ${nextClass ? `<p><strong>${nextClass.course_name}</strong> (${nextClass.day_of_week} ${nextClass.start_time})</p>` : "<p>No upcoming class.</p>"}
        <h4>Preparation Checklist</h4>
        <div class="grid">${prepChecklist}</div>
      </div>
      ${reviewCard}
      <div class="card">
        <h3>Urgent Tasks (Top 5)</h3>
        <ul class="clean danger-list">${urgentRows}</ul>
      </div>
      <div class="card">
        <h3>Top 5 Actions</h3>
        <ul class="clean">${actionRows}</ul>
      </div>
      <div class="card">
        <h3>Reminder Timeline</h3>
        <ul class="clean">
          <li>7 days before</li><li>3 days before</li><li>1 day before</li><li>6 hours before</li><li>1 hour before</li>
        </ul>
      </div>
    </div>`;
}
