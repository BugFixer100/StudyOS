export function globalSearch(state, query) {
  if (!query) return [];
  const q = query.toLowerCase();
  const results = [];

  state.courses.forEach((c) => {
    if (`${c.name} ${c.instructor || ""}`.toLowerCase().includes(q)) results.push({ type: "Course", title: c.name, detail: c.instructor || "" });
  });

  state.tasks.forEach((t) => {
    if (`${t.title} ${t.description || ""} ${t.notes || ""}`.toLowerCase().includes(q)) results.push({ type: "Task", title: t.title, detail: t.task_type });
  });

  state.lectures.forEach((l) => {
    const text = `${l.topics_covered || ""} ${l.key_concepts || ""} ${l.homework_given || ""}`.toLowerCase();
    if (text.includes(q)) results.push({ type: "Lecture", title: `${state.courseName[l.course_id] || "Course"} (${l.date})`, detail: l.topics_covered || "-" });
  });

  state.labs.forEach((l) => {
    if (`${l.experiment_title} ${l.instructions || ""}`.toLowerCase().includes(q)) results.push({ type: "Lab", title: l.experiment_title, detail: l.pipeline_stage });
  });

  (state.inbox || []).forEach((item) => {
    if (`${item.text}`.toLowerCase().includes(q)) results.push({ type: "Inbox", title: item.text, detail: item.kind || "raw" });
  });

  return results.slice(0, 50);
}

export function renderSearchView(state) {
  const rows = (state.searchResults || []).map((r) => `<li><strong>${r.type}</strong> • ${r.title}<div class="small">${r.detail}</div></li>`).join("") || "<li>Search courses, lectures, tasks, labs, notes, resources...</li>";
  return `<div class="grid cols-2"><div class="card" style="grid-column:1/-1;"><h3>Global Search</h3><input id="global-search-input" placeholder="Search CFG, assignments, labs, notes..." value="${state.searchQuery || ""}" /><ul class="clean">${rows}</ul></div></div>`;
}
