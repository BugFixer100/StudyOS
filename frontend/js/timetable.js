import { formatTime } from "./time.js?v=studyos-course-workspace-1";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function renderScheduleSlot(slot, state) {
  const courseName = state.courseName[slot.course_id] || "Course";
  const courseType = state.courses.find((course) => course.id === slot.course_id)?.type || "Class";
  const room = slot.room ? ` · ${slot.room}` : "";
  return `<article class="schedule-slot"><div class="schedule-time"><strong>${formatTime(slot.start_time)}</strong><span>${formatTime(slot.end_time)}</span></div><div class="schedule-course"><strong>${courseName}</strong><span>${courseType}${room}</span></div><button class="schedule-delete" aria-label="Delete ${courseName}" data-slot-delete="${slot.id}">×</button></article>`;
}

function renderScheduleException(item, state) {
  const slot = state.timetable.find((candidate) => candidate.id === item.schedule_id);
  const slotLabel = slot ? `${state.courseName[slot.course_id] || "Course"} ${formatTime(slot.start_time)}` : "Schedule";
  const changeLabel = item.is_cancelled ? "Cancelled" : `Moved to ${formatTime(item.start_time)}`;
  return `<li>${item.exception_date} • ${slotLabel} • ${changeLabel} ${item.note || ""}<button class="action danger" data-exception-delete="${item.id}">Delete</button></li>`;
}

export function renderTimetableView(state) {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const slotOptions = state.timetable.map((s) => `<option value="${s.id}">${state.courseName[s.course_id] || "Course"} ${s.day_of_week} ${formatTime(s.start_time)}</option>`).join("");
  const rows = DAYS.map((day) => {
    const slots = state.timetable.filter((s) => s.day_of_week === day);
    const countLabel = `${slots.length} class${slots.length === 1 ? "" : "es"}`;
    const slotMarkup = slots.map((slot) => renderScheduleSlot(slot, state)).join("") || '<p class="schedule-empty">No classes</p>';
    return `<section class="schedule-day"><header><h3>${day}</h3><span>${countLabel}</span></header><div class="schedule-slots">${slotMarkup}</div></section>`;
  }).join("");

  const exceptions = (state.scheduleExceptions || []).map((item) => renderScheduleException(item, state)).join("") || "<li>No schedule exceptions.</li>";

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
    <div class="card"><h3>One-day change</h3><form id="exception-form">
      <label>Class<select name="schedule_id" required>${slotOptions}</select></label>
      <label>Date<input type="date" name="exception_date" required /></label>
      <label><input type="checkbox" name="is_cancelled" value="true" /> Cancel this class</label>
      <div class="row"><label>New start<input type="time" name="start_time" /></label><label>New end<input type="time" name="end_time" /></label></div>
      <label>New room<input name="room" /></label><label>Note<input name="note" /></label>
      <button class="action primary" type="submit">Save Change</button>
    </form><ul class="clean">${exceptions}</ul></div>
    <div class="schedule-board" style="grid-column:1/-1;"><div class="schedule-board-heading"><div><span class="eyebrow">Your week</span><h2>Weekly timetable</h2></div><p>Classes grouped by day with clear times and rooms.</p></div><div class="schedule-week">${rows}</div></div>
  </div>`;
}
