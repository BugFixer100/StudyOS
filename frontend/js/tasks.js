const TASK_TYPES = ["Homework", "Assignment", "Lab Assignment", "Lab Report", "Project", "Quiz Prep", "Exam Prep", "Reading", "Practice", "Coding Task", "Submission", "Presentation", "Viva Prep"];
const TASK_STATUS = ["Not Started", "In Progress", "Blocked", "Submitted", "Completed"];
const PRIORITY = ["Low", "Medium", "High", "Urgent"];

// Maps the backend's own urgency label (task.urgency.label, computed in
// services/urgency.py) to a badge CSS class. This does NOT decide what
// counts as "Overdue" vs "Critical" - it only picks a color for a label
// the backend already computed, so there's exactly one place that owns
// those thresholds.
function urgencyBadgeClass(label) {
  const key = (label || "").toLowerCase();
  if (key === "overdue") return "overdue";
  if (key === "critical" || key === "high") return "urgent";
  if (key === "completed") return "completed";
  return "upcoming"; // Medium, Low, No deadline
}

function urgencyText(urgency) {
  if (!urgency) return "No urgency";
  const days = urgency.days_left;
  if (days === null || days === undefined) return urgency.label;
  const dayText = urgency.is_overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`;
  return `${urgency.label} (${dayText})`;
}

export function renderTasksView(state) {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const tasksHtml = state.tasks.length
    ? state.tasks.map((t) => `<li class="task-item">
        <div class="row">
          <strong>${t.title}</strong>
          <span class="badge ${urgencyBadgeClass(t.urgency?.label)}">${urgencyText(t.urgency)}</span>
        </div>
        <div class="task-meta">Type: ${t.task_type} • Priority: ${t.priority} • Status: ${t.status} • Progress: ${t.progress_percent}%</div>
        <div class="small">Due: ${t.due_date || "-"} ${t.due_time || ""} • Estimate: ${t.estimated_minutes || 0} min</div>
        <div class="small">Submission: ${t.submission_method || "-"} ${t.submission_link ? `• <a href="${t.submission_link}" target="_blank">Link</a>` : ""}</div>
        <details><summary>Notes / Subtasks / Attachments</summary>
          <p>${t.notes || "No notes"}</p>
          <ul class="subtasks">${(t.subtasks || []).map((s) => `<li><label><input type="checkbox" data-subtask-toggle="${s.id}" ${s.is_done ? "checked" : ""}/> ${s.title}</label> <button class="action danger" data-subtask-delete="${s.id}">x</button></li>`).join("") || "<li>No subtasks</li>"}</ul>
          <div class="row">
            <input type="text" data-subtask-input="${t.id}" placeholder="Add subtask" />
            <button class="action" data-subtask-add="${t.id}">Add</button>
          </div>
          <div class="small">Attachments: ${(state.localAttachments.tasks?.[t.id] || []).join(", ") || "None"}</div>
        </details>
        <div class="row">
          <button class="action" data-task-edit="${t.id}">Edit</button>
          <button class="action" data-task-submit="${t.id}">Mark Submitted</button>
          <button class="action danger" data-task-delete="${t.id}">Delete</button>
        </div>
      </li>`).join("")
    : "<li>No tasks available.</li>";

  const dangerTasks = state.tasks.filter((t) => t.urgency?.danger_zone);
  const dangerHtml = dangerTasks.slice(0, 5).map((t) => `<li>${t.title} (${t.urgency.label})</li>`).join("") || "<li>No danger-zone tasks.</li>";

  return `
    <div class="grid cols-2">
      <div class="card">
        <h3>Create Task</h3>
        <form id="task-form">
          <label>Title<input name="title" required /></label>
          <label>Course<select name="course_id" required><option value="">Select</option>${courseOptions}</select></label>
          <label>Type<select name="task_type">${TASK_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label>
          <label>Description<textarea name="description"></textarea></label>
          <div class="row">
            <label>Due Date<input type="date" name="due_date" /></label>
            <label>Due Time<input type="time" name="due_time" /></label>
          </div>
          <div class="row">
            <label>Estimate (min)<input type="number" name="estimated_minutes" min="0" /></label>
            <label>Priority<select name="priority">${PRIORITY.map((p) => `<option>${p}</option>`).join("")}</select></label>
            <label>Status<select name="status">${TASK_STATUS.map((s) => `<option>${s}</option>`).join("")}</select></label>
          </div>
          <label>Progress %<input type="number" name="progress_percent" min="0" max="100" value="0" /></label>
          <label>Submission Method<input name="submission_method" /></label>
          <label>Submission Link<input name="submission_link" /></label>
          <label>Notes<textarea name="notes"></textarea></label>
          <label>Attachments<input type="file" name="attachments" multiple /></label>
          <button class="action primary" type="submit">Save Task</button>
        </form>
      </div>

      <div class="card">
        <h3>Danger Zone</h3>
        <ul class="clean danger-list">${dangerHtml}</ul>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h3>All Tasks</h3>
        <ul class="clean">${tasksHtml}</ul>
      </div>
    </div>`;
}
