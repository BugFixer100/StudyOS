const TASK_TYPES = ["Homework", "Assignment", "Lab Assignment", "Lab Report", "Project", "Quiz Prep", "Exam Prep", "Reading", "Practice", "Coding Task", "Submission", "Presentation", "Viva Prep"];
const TASK_STATUS = ["Not Started", "In Progress", "Blocked", "Submitted", "Completed"];
const PRIORITY = ["Low", "Medium", "High", "Urgent"];

export function dangerZoneTasks(tasks) {
  return tasks.filter((task) => {
    const daysLeft = task.due_date ? Math.ceil((new Date(task.due_date) - new Date()) / 86400000) : null;
    const highRiskDeadline = daysLeft !== null && daysLeft <= 2;
    const overdue = daysLeft !== null && daysLeft < 0;
    const heavyWork = (task.estimated_minutes || 0) >= 180;
    const notStarted = task.status === "Not Started";
    const highPriority = task.priority === "High" || task.priority === "Urgent";
    return overdue || (highRiskDeadline && (heavyWork || notStarted || highPriority));
  });
}

function urgencyLabel(task) {
  if (!task.due_date) return "No deadline";
  const days = Math.ceil((new Date(task.due_date) - new Date()) / 86400000);
  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE TODAY";
  if (days <= 2) return "Urgent";
  if (days <= 6) return "Plan Soon";
  return "Upcoming";
}

export function renderTasksView(state) {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const tasksHtml = state.tasks.length
    ? state.tasks.map((t) => `<li class="task-item">
        <div class="row">
          <strong>${t.title}</strong>
          <span class="badge ${urgencyLabel(t).toLowerCase().replace(/\s/g,"")}">${urgencyLabel(t)}</span>
        </div>
        <div class="task-meta">Type: ${t.task_type} • Priority: ${t.priority} • Status: ${t.status} • Progress: ${t.progress_percent}%</div>
        <div class="small">Due: ${t.due_date || "-"} ${t.due_time || ""} • Estimate: ${t.estimated_minutes || 0} min</div>
        <div class="small">Submission: ${t.submission_method || "-"} ${t.submission_link ? `• <a href="${t.submission_link}" target="_blank">Link</a>` : ""}</div>
        <details><summary>Notes / Subtasks / Attachments</summary>
          <p>${t.notes || "No notes"}</p>
          <ul class="subtasks">${(state.localSubtasks[t.id] || []).map((s, idx) => `<li><label><input type="checkbox" data-subtask-toggle="${t.id}:${idx}" ${s.done ? "checked" : ""}/> ${s.title}</label></li>`).join("") || "<li>No subtasks</li>"}</ul>
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

  const dangerHtml = dangerZoneTasks(state.tasks).slice(0, 5).map((t) => `<li>${t.title} (${urgencyLabel(t)})</li>`).join("") || "<li>No danger-zone tasks.</li>";

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
