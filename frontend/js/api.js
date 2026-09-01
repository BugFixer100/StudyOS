/*
  api.js

  This file will hold all the functions that talk to our backend
  (e.g. getTasks(), getTodayDashboard(), createTask()).

  For now it just has one function to confirm the skeleton works end
  to end: frontend -> backend -> database.
*/

async function checkHealth() {
  const statusEl = document.getElementById("status");
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    statusEl.textContent = "✅ " + data.message;
  } catch (err) {
    statusEl.textContent = "❌ Could not reach backend: " + err.message;
  }
}
