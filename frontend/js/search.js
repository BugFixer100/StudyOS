export function globalSearch(state, query, category = "All") {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const matchesCategory = (type) => category === "All" || category === type;
  const results = [];

  state.courses.forEach((c) => {
    if (matchesCategory("Subject") && `${c.name} ${c.instructor || ""}`.toLowerCase().includes(normalizedQuery)) {
      results.push({ type: "Subject", title: c.name, detail: `${c.type} · ${c.instructor || "Instructor not added"}`, id: c.id });
    }
  });

  state.tasks.forEach((t) => {
    if (matchesCategory("Task") && `${t.title} ${t.description || ""} ${t.notes || ""}`.toLowerCase().includes(normalizedQuery)) {
      results.push({ type: "Task", title: t.title, detail: t.task_type, id: t.id, courseId: t.course_id });
    }
  });

  state.lectures.forEach((l) => {
    const text = `${l.topics_covered || ""} ${l.key_concepts || ""} ${l.homework_given || ""}`.toLowerCase();
    if (matchesCategory("Lecture") && text.includes(normalizedQuery)) {
      results.push({ type: "Lecture", title: `${state.courseName[l.course_id] || "Course"} (${l.date})`, detail: l.topics_covered || "-", id: l.id, courseId: l.course_id });
    }
  });

  state.labs.forEach((l) => {
    if (matchesCategory("Lab") && `${l.experiment_title} ${l.instructions || ""}`.toLowerCase().includes(normalizedQuery)) {
      results.push({ type: "Lab", title: l.experiment_title, detail: l.pipeline_stage, id: l.id, courseId: l.course_id });
    }
  });

  (state.inbox || []).forEach((item) => {
    if (matchesCategory("Inbox") && `${item.text}`.toLowerCase().includes(normalizedQuery)) {
      results.push({ type: "Inbox", title: item.text, detail: item.kind || "raw", id: item.id });
    }
  });

  return results.slice(0, 50);
}

export function renderSearchView(state) {
  return `<div class="grid cols-2"><div class="card" style="grid-column:1/-1;"><h3>Global Search</h3><div class="row"><input id="global-search-input" placeholder="Search a task, subject, lab, lecture..." value="${state.searchQuery || ""}" /><select id="search-category" aria-label="Search category">${["All", "Subject", "Task", "Lab", "Lecture", "Inbox"].map((category) => `<option ${state.searchCategory === category ? "selected" : ""}>${category}</option>`).join("")}</select></div><ul class="clean" id="global-search-results">${renderSearchRows(state)}</ul></div></div>`;
}

function renderSearchRows(state) {
  return (state.searchResults || []).map((r) => `<li><button class="search-result" data-search-result data-search-type="${r.type}" data-search-id="${r.id}" data-search-course="${r.courseId || ""}"><strong>${r.type}</strong> • ${r.title}<div class="small">${r.detail} · Open directly</div></button></li>`).join("") || `<li>${state.searchQuery ? "No matching academic records." : "Search a task, subject, lab, or lecture."}</li>`;
}

export function renderSearchResults(state) {
  const list = document.getElementById("global-search-results");
  if (list) list.innerHTML = renderSearchRows(state);
}
