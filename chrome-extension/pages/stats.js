import { getUsageStats } from "../common/storage.js";

const summaryEl = document.getElementById("summary");
const dailyList = document.getElementById("dailyList");
const weeklyList = document.getElementById("weeklyList");
const errorsList = document.getElementById("errorsList");

async function init() {
  const stats = await getUsageStats();
  renderSummary(stats);
  renderList(dailyList, stats.daily);
  renderList(weeklyList, stats.weekly);
  renderErrors(stats.last_errors);
}

function renderSummary(stats) {
  const items = [
    { label: "Total Calls", value: stats.total_calls, color: "text-primary" },
    { label: "Success Rate", value: calculateSuccessRate(stats), color: "text-success" },
    { label: "Total Tokens", value: (stats.token_total || 0).toLocaleString(), color: "text-secondary" },
    { label: "Errors", value: stats.error_calls, color: "text-danger" },
  ];

  summaryEl.className = "grid grid-2"; // Ensure grid layout
  summaryEl.innerHTML = "";
  
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "card stat-card"; // styled in CSS
    div.innerHTML = `
      <div class="stat-label small">${item.label}</div>
      <div class="stat-value ${item.color || ''}">${item.value}</div>
    `;
    summaryEl.appendChild(div);
  });
}

function calculateSuccessRate(stats) {
  if (!stats.total_calls) return "0%";
  const rate = Math.round((stats.success_calls / stats.total_calls) * 100);
  return `${rate}%`;
}

function renderList(container, entries) {
  container.innerHTML = "";
  const list = Object.entries(entries || {}).sort((a, b) => b[0].localeCompare(a[0]));
  
  if (!list.length) {
    container.innerHTML = "<div class='empty-state text-small'>No functionality data recorded yet.</div>";
    return;
  }
  
  const ul = document.createElement("div");
  ul.className = "data-list";
  
  list.slice(0, 10).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "data-row flex justify-between";
    row.innerHTML = `
      <span class="data-key">${key}</span>
      <span class="data-val font-mono">${value}</span>
    `;
    ul.appendChild(row);
  });
  container.appendChild(ul);
}

function renderErrors(errors) {
  errorsList.innerHTML = "";
  if (!errors?.length) {
    errorsList.innerHTML = "<div class='empty-state text-small'>No recent errors.</div>";
    return;
  }
  
  const ul = document.createElement("div");
  ul.className = "data-list error-list";
  
  errors.forEach((error) => {
    const row = document.createElement("div");
    row.className = "data-row error-row";
    const date = new Date(error.timestamp).toLocaleTimeString();
    row.innerHTML = `
      <div class="error-time text-small">${date}</div>
      <div class="error-msg text-danger">${error.message}</div>
    `;
    ul.appendChild(row);
  });
  errorsList.appendChild(ul);
}

init();
