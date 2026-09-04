export function renderLecturesView(state) {
  const options = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const rows = state.lectures.length
    ? state.lectures
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((l, idx) => `<li data-record-id="${l.id}">
          <strong>#${idx + 1} ${state.courseName[l.course_id] || "Course"}</strong> • ${l.date}
          <div class="small">Topics: ${l.topics_covered || "-"}</div>
          <div class="small">Concepts: ${l.key_concepts || "-"}</div>
          <div class="small">Homework: ${l.homework_given || "-"}</div>
          <button class="action" data-lecture-edit="${l.id}">Edit</button>
          <button class="action danger" data-lecture-delete="${l.id}">Delete</button>
        </li>`).join("")
    : "<li>No lectures recorded.</li>";

  return `<div class="grid cols-2">
    <div class="card">
      <h3>Last Lecture Memory</h3>
      <form id="lecture-form">
        <label>Course<select name="course_id" required><option value="">Select</option>${options}</select></label>
        <label>Date<input type="date" name="date" required /></label>
        <label>Topics Covered<textarea name="topics_covered"></textarea></label>
        <label>Important Concepts<textarea name="key_concepts"></textarea></label>
        <label>Teacher Emphasis<textarea name="teacher_emphasis"></textarea></label>
        <label>Homework Given<textarea name="homework_given"></textarea></label>
        <label>Remember for Next Class<textarea name="remember_for_next"></textarea></label>
        <label>Anything Confusing?<textarea name="confusing_points"></textarea></label>
        <label>Quiz/Assignment/Exam Mentioned<textarea name="mentioned_quiz_exam"></textarea></label>
        <button class="action primary" type="submit">Save Lecture</button>
      </form>
    </div>
    <div class="card" style="grid-column:1/-1;">
      <h3>Lecture History (Searchable)</h3>
      <input id="lecture-search" placeholder="Where did we study CFG?" />
      <ul class="clean" id="lecture-history-list">${rows}</ul>
    </div>
  </div>`;
}

export function lectureMatches(lecture, query) {
  const text = [
    lecture.topics_covered,
    lecture.key_concepts,
    lecture.teacher_emphasis,
    lecture.homework_given,
    lecture.remember_for_next,
    lecture.confusing_points,
    lecture.mentioned_quiz_exam,
  ].join(" ").toLowerCase();
  return text.includes(query.toLowerCase());
}

export function lectureCaptureModal(courseName = "Course", courseId = "") {
  const today = new Date().toISOString().slice(0, 10);
  return `<form id="lecture-capture-inline"><h3>WHAT DID YOU LEARN? (${courseName})</h3>
    <input type="hidden" name="course_id" value="${courseId}" />
    <label>Date<input type="date" name="date" value="${today}" required /></label>
    <label>Topics covered<textarea name="topics_covered"></textarea></label>
    <label>Important concepts<textarea name="key_concepts"></textarea></label>
    <label>What did teacher emphasize?<textarea name="teacher_emphasis"></textarea></label>
    <label>Homework/task given?<textarea name="homework_given"></textarea></label>
    <label>What to remember for next class?<textarea name="remember_for_next"></textarea></label>
    <label>Anything confusing?<textarea name="confusing_points"></textarea></label>
    <label>Teacher mentioned quiz/assignment/exam?<textarea name="mentioned_quiz_exam"></textarea></label>
    <div class="row"><button class="action primary" type="submit">Save</button><button class="action" type="button" data-close-modal>Skip</button></div>
  </form>`;
}

export function lectureReviewModal(lecture) {
  if (!lecture) return "<p>No previous lecture found.</p>";
  return `<div><h3>Last Lecture Review</h3>
    <p><strong>Topics:</strong> ${lecture.topics_covered || "-"}</p>
    <p><strong>Concepts:</strong> ${lecture.key_concepts || "-"}</p>
    <p><strong>Homework:</strong> ${lecture.homework_given || "-"}</p>
    <p><strong>Teacher Emphasis:</strong> ${lecture.teacher_emphasis || "-"}</p>
    <button class="action primary" data-mark-reviewed="${lecture.id}">Mark Reviewed</button>
    <button class="action" data-close-modal>Close</button>
  </div>`;
}
