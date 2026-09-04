const STAGES = ["Task Given", "Understanding", "Implementation", "Testing", "Report", "Submission", "Viva"];

export function renderLabsView(state) {
  const courseOptions = state.courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  const labsHtml = state.labs.length
    ? state.labs.map((lab) => {
      const stageIdx = Math.max(0, STAGES.indexOf(lab.pipeline_stage));
      const percent = Math.round((stageIdx / (STAGES.length - 1)) * 100);
      return `<li data-record-id="${lab.id}">
        <strong>Lab ${lab.lab_number || "-"}</strong> • ${state.courseName[lab.course_id] || "Course"} • ${lab.experiment_title}
        <div class="small">Date: ${lab.date || "-"} • Due: ${lab.due_date || "-"} • Status: ${lab.status}</div>
        <div class="small">Pipeline: ${lab.pipeline_stage}</div>
        <div class="progress-track"><span style="width:${percent}%"></span></div>
        <div class="row">
          <select data-lab-stage="${lab.id}">${STAGES.map((s) => `<option ${s === lab.pipeline_stage ? "selected" : ""}>${s}</option>`).join("")}</select>
          <button class="action" data-lab-submit="${lab.id}">Submit</button>
          <button class="action danger" data-lab-delete="${lab.id}">Delete</button>
        </div>
      </li>`;
    }).join("")
    : "<li>No labs yet.</li>";

  return `<div class="grid cols-2">
    <div class="card">
      <h3>Create Lab</h3>
      <form id="lab-form">
        <label>Course<select name="course_id" required><option value="">Select</option>${courseOptions}</select></label>
        <div class="row">
          <label>Lab #<input type="number" name="lab_number" /></label>
          <label>Date<input type="date" name="date" /></label>
        </div>
        <label>Task / Experiment Title<input name="experiment_title" required /></label>
        <label>Instructions<textarea name="instructions"></textarea></label>
        <label>Submission Deadline<input type="date" name="due_date" /></label>
        <button class="action primary" type="submit">Save Lab</button>
      </form>
    </div>
    <div class="card" style="grid-column:1/-1;">
      <h3>Lab Management Pipeline</h3>
      <div class="small">Task Given → Understanding → Implementation → Testing → Report → Submission → Viva</div>
      <ul class="clean">${labsHtml}</ul>
    </div>
  </div>`;
}
