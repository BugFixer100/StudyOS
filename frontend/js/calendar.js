import { formatTime } from "./time.js?v=studyos-course-workspace-1";

const COLORS = {
  class: "#3b82f6",
  assignment: "#f59e0b",
  lab: "#22c55e",
  exam: "#ef4444",
  study: "#a855f7",
};

function eventRow(event) {
  return `<li><span class="event-dot" style="background:${event.color}"></span>${event.title}</li>`;
}

export function collectEvents(state) {
  const classEvents = state.timetable.map((s) => ({
    dateLabel: s.day_of_week,
    title: `${state.courseName[s.course_id] || "Course"} ${formatTime(s.start_time)}-${formatTime(s.end_time)}`,
    type: "class",
    color: COLORS.class,
  }));

  const taskEvents = state.tasks.map((t) => ({
    dateLabel: t.due_date || "No date",
    title: `${t.task_type}: ${t.title}`,
    type: "assignment",
    color: COLORS.assignment,
  }));

  const labEvents = state.labs.map((l) => ({
    dateLabel: l.due_date || l.date || "No date",
    title: `Lab ${l.lab_number || ""}: ${l.experiment_title}`,
    type: "lab",
    color: COLORS.lab,
  }));

  const studyEvents = (state.studySessions || []).map((s) => ({
    dateLabel: s.started_at ? s.started_at.slice(0, 10) : "No date",
    title: `Study ${state.courseName[s.course_id] || "General"} (${s.planned_minutes}m)`,
    type: "study",
    color: COLORS.study,
  }));

  return [...classEvents, ...taskEvents, ...labEvents, ...studyEvents];
}

export function renderCalendarView(state) {
  const events = collectEvents(state);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weeklyCells = days.map((d) => `<div class="calendar-cell"><h5>${d}</h5><ul class="clean">${events.filter((e) => e.dateLabel === d).map(eventRow).join("") || "<li>-</li>"}</ul></div>`).join("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 6);
  const upcoming = events.filter((e) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dateLabel)) return false;
    const eventDate = new Date(`${e.dateLabel}T00:00:00`);
    return eventDate >= today && eventDate <= weekEnd;
  }).sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));

  return `<div class="grid cols-2">
    <div class="card" style="grid-column:1/-1;">
      <h3>Weekly Calendar View</h3><div class="calendar-grid">${weeklyCells}</div>
    </div>
    <div class="card">
      <h3>Next 7 days</h3>
      <ul class="clean">${upcoming.map((e) => `<li>${e.dateLabel} • ${eventRow(e)}</li>`).join("") || "<li>No dated events.</li>"}</ul>
    </div>
  </div>`;
}
