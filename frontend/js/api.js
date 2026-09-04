const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  health: () => request("/api/health"),
  getTodayDashboard: () => request("/api/dashboard/today"),

  listCourses: () => request("/api/courses/"),
  createCourse: (payload) => request("/api/courses/", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateCourse: (id, payload) => request(`/api/courses/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteCourse: (id) => request(`/api/courses/${id}`, { method: "DELETE" }),

  listTasks: () => request("/api/tasks/"),
  createTask: (payload) => request("/api/tasks/", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateTask: (id, payload) => request(`/api/tasks/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
  submitTask: (id, payload) => request(`/api/tasks/${id}/submit`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),

  addSubtask: (taskId, payload) => request(`/api/tasks/${taskId}/subtasks`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateSubtask: (subtaskId, payload) => request(`/api/tasks/subtasks/${subtaskId}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteSubtask: (subtaskId) => request(`/api/tasks/subtasks/${subtaskId}`, { method: "DELETE" }),

  listLectures: () => request("/api/lectures/"),
  createLecture: (payload) => request("/api/lectures/", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateLecture: (id, payload) => request(`/api/lectures/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteLecture: (id) => request(`/api/lectures/${id}`, { method: "DELETE" }),
  getLastLecture: (courseId) => request(`/api/lectures/course/${courseId}/last`),

  listLabs: () => request("/api/labs/"),
  createLab: (payload) => request("/api/labs/", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateLab: (id, payload) => request(`/api/labs/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteLab: (id) => request(`/api/labs/${id}`, { method: "DELETE" }),
  submitLab: (id, payload) => request(`/api/labs/${id}/submit`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),

  listTimetable: () => request("/api/timetable/"),
  createTimetableSlot: (payload) => request("/api/timetable/", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateTimetableSlot: (id, payload) => request(`/api/timetable/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteTimetableSlot: (id) => request(`/api/timetable/${id}`, { method: "DELETE" }),
};
