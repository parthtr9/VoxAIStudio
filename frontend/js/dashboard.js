import { api } from "./api.js";
import { toast } from "./toast.js";

const $ = (id) => document.getElementById(id);

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(status) {
  const map = {
    draft: '<span class="badge badge-draft">Draft</span>',
    mixed: '<span class="badge badge-mixed">Mixed</span>',
    exported: '<span class="badge badge-exported">Exported</span>',
  };
  return map[status] || map.draft;
}

function projectCard(p) {
  return `
    <div class="card card-interactive project-card" onclick="openProject('${p.id}')">
      <button class="btn btn-ghost btn-icon btn-sm delete-btn" onclick="deleteProject(event, '${p.id}')">🗑</button>
      <div class="project-card-genre">${p.genre} · ${p.mood}</div>
      <div class="project-card-title">${p.title}</div>
      <div class="project-card-meta">
        ${p.bpm ? `<span>♩ ${p.bpm} BPM</span>` : ""}
        ${p.key ? `<span>🎵 ${p.key}</span>` : ""}
        <span>📅 ${formatDate(p.updated_at || p.created_at)}</span>
      </div>
      <div class="project-card-footer">
        ${statusBadge(p.status)}
        <div style="font-size: 0.78rem; color: var(--text-dim); display: flex; gap: 6px;">
          ${p.lyrics ? "📝" : ""}
          ${p.beat_url ? "🥁" : ""}
          ${p.vocal_processed_url ? "🎤" : ""}
          ${p.final_mix_url ? "✅" : ""}
        </div>
      </div>
    </div>`;
}

function newCard() {
  return `
    <div class="new-project-card" onclick="showModal()">
      <div class="new-project-icon">+</div>
      <div style="font-size: 0.9rem; font-weight: 500;">New Project</div>
    </div>`;
}

async function loadProjects() {
  try {
    const projects = await api.listProjects();
    $("projects-loading").style.display = "none";
    const grid = $("projects-grid");
    grid.style.display = "grid";
    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="new-project-card" onclick="showModal()">
          <div class="new-project-icon">+</div>
          <div style="font-size: 0.9rem; font-weight: 500;">Create your first project</div>
        </div>`;
    } else {
      grid.innerHTML = projects.map(projectCard).join("") + newCard();
    }
  } catch (e) {
    $("projects-loading").innerHTML = `
      <span style="color: var(--error);">⚠ Could not connect to backend. Make sure it's running on port 8000.</span>`;
  }
}

async function loadTrends() {
  try {
    const { trends } = await api.getTrends();
    const grid = $("trends-grid");
    grid.innerHTML = trends.map((t) => `
      <div class="card trend-card" onclick="applyTrend(${JSON.stringify(t).replace(/"/g, '&quot;')})">
        <div class="trend-genre">${t.genre}</div>
        <div class="trend-desc">${t.description || ""}</div>
        <div class="trend-stats">
          <div class="trend-stat">
            <div class="trend-stat-value">${t.avg_bpm}</div>
            <div class="trend-stat-label">BPM</div>
          </div>
          <div class="trend-stat">
            <div class="trend-stat-value">${Math.round(t.avg_energy * 100)}%</div>
            <div class="trend-stat-label">Energy</div>
          </div>
          <div class="trend-stat">
            <div class="trend-stat-value">${(t.common_keys || [])[0] || "–"}</div>
            <div class="trend-stat-label">Key</div>
          </div>
        </div>
      </div>`).join("");
  } catch (e) {
    $("trends-grid").innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">Trends unavailable</p>';
  }
}

function showModal() {
  $("new-project-modal").style.display = "flex";
  $("project-title").focus();
}

function hideModal() {
  $("new-project-modal").style.display = "none";
  $("new-project-form").reset();
}

window.openProject = (id) => {
  window.location.href = `project.html?id=${id}`;
};

window.deleteProject = async (e, id) => {
  e.stopPropagation();
  if (!confirm("Delete this project? This cannot be undone.")) return;
  try {
    await api.deleteProject(id);
    toast("Project deleted", "info");
    loadProjects();
  } catch (err) {
    toast(`Failed: ${err.message}`, "error");
  }
};

window.showModal = showModal;

window.applyTrend = (trend) => {
  showModal();
  setTimeout(() => {
    const genreEl = $("project-genre");
    for (const opt of genreEl.options) {
      if (opt.value === trend.genre) { genreEl.value = trend.genre; break; }
    }
    if (trend.avg_bpm) $("project-bpm").value = Math.round(trend.avg_bpm);
    if (trend.common_keys?.[0]) $("project-key").value = trend.common_keys[0];
  }, 50);
};

$("new-project-btn").addEventListener("click", showModal);
$("close-modal").addEventListener("click", hideModal);
$("cancel-modal").addEventListener("click", hideModal);

$("new-project-modal").addEventListener("click", (e) => {
  if (e.target === $("new-project-modal")) hideModal();
});

$("new-project-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("create-btn");
  btn.disabled = true;
  btn.textContent = "Creating…";

  const data = {
    title: $("project-title").value.trim() || "Untitled Song",
    genre: $("project-genre").value,
    mood: $("project-mood").value,
    bpm: $("project-bpm").value ? parseInt($("project-bpm").value) : null,
    key: $("project-key").value || null,
    vocal_style: $("project-vocal").value,
  };

  try {
    const project = await api.createProject(data);
    hideModal();
    toast("Project created!", "success");
    window.location.href = `project.html?id=${project.id}`;
  } catch (err) {
    toast(`Error: ${err.message}`, "error");
    btn.disabled = false;
    btn.textContent = "Create Project →";
  }
});

loadProjects();
loadTrends();
