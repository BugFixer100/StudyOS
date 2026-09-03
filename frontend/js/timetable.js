const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function renderTimetableView(state) {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const rows = DAYS.map((day) => {
    const slots = state.timetable.filter((s) => s.day_of_week === day);
    return `<div class="card"><h4>${day}</h4><ul class="clean">${slots.map((s) => `<li>${state.courseName[s.course_id] || "Course"} ${s.start_time}-${s.end_time} ${s.room || ""}<div class="row"><button class="action danger" data-slot-delete="${s.id}">Delete</button></div></li>`).join("") || "<li>No classes</li>"}</ul></div>`;
  }).join("");

  return `<div class="grid cols-2">
    <div class="card">
      <h3>Add Class Schedule</h3>
      <form id="slot-form">
        <label>Course<select name="course_id" required><option value="">Select</option>${courseOptions}</select></label>
        <label>Day<select name="day_of_week">${DAYS.map((d) => `<option>${d}</option>`).join("")}</select></label>
        <div class="row">
          <label>Start<input type="time" name="start_time" required /></label>
          <label>End<input type="time" name="end_time" required /></label>
        </div>
        <label>Room<input name="room" /></label>
        <button class="action primary" type="submit">Save Slot</button>
      </form>
    </div>
    <div class="card" style="grid-column:1/-1;"><h3>Weekly Timetable</h3><div class="grid cols-3">${rows}</div></div>
  </div>`;
}
