import { api } from "./api.js";
import { toast } from "./toast.js";
import { initLyrics } from "./tabs/lyrics.js";
import { initBeat } from "./tabs/beat.js";
import { initMelody } from "./tabs/melody.js";
import { initVocals } from "./tabs/vocals.js";
import { initInstruments } from "./tabs/instruments.js";
import { initMix } from "./tabs/mix.js";

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const projectId = params.get("id");

if (!projectId) {
  location.href = "index.html";
}

// Shared project state
export let project = null;

export function setProject(p) {
  project = p;
  renderSidebar();
  updateIndicators();
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function renderSidebar() {
  const p = project;

  $("project-title-input").value = p.title;
  document.title = `${p.title} — VoxAI Studio`;

  const statusEl = $("nav-status");
  statusEl.className = `badge badge-${p.status}`;
  statusEl.textContent = p.status.charAt(0).toUpperCase() + p.status.slice(1);

  $("project-meta").innerHTML = `
    <div class="project-meta-item">
      <span class="meta-label">Genre</span>
      <span class="meta-value">${p.genre}</span>
    </div>
    <div class="project-meta-item">
      <span class="meta-label">Mood</span>
      <span class="meta-value">${p.mood}</span>
    </div>
    <div class="project-meta-item">
      <span class="meta-label">BPM</span>
      <span class="meta-value">${p.bpm || "–"}</span>
    </div>
    <div class="project-meta-item">
      <span class="meta-label">Key</span>
      <span class="meta-value">${p.key || "–"}</span>
    </div>`;

  $("project-progress").innerHTML = [
    { label: "Lyrics", ready: !!p.lyrics },
    { label: "Beat", ready: !!p.beat_url },
    { label: "Melody", ready: !!p.melody_url },
    { label: "Vocals", ready: !!p.vocal_processed_url },
    { label: "Instruments", ready: (p.instrument_urls || []).length > 0 },
    { label: "Final Mix", ready: !!p.final_mix_url },
  ].map((item) => `
    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.825rem; color: var(--text-secondary);">
      <div class="status-dot ${item.ready ? "ready" : "missing"}"></div>
      ${item.label}
    </div>`).join("");

  const hasMix = !!p.final_mix_url;
  const exportBtn = $("export-btn");
  const shareBtn = $("share-btn");

  exportBtn.disabled = !hasMix;
  shareBtn.disabled = !hasMix;

  if (hasMix) {
    exportBtn.onclick = () => {
      const a = document.createElement("a");
      a.href = api.audioUrl(p.final_mix_url);
      a.download = `${p.title.replace(/\s+/g, "_")}_mix.mp3`;
      a.click();
    };
    shareBtn.onclick = () => {
      const url = api.audioUrl(p.final_mix_url);
      navigator.clipboard.writeText(url).then(() => toast("Mix link copied!", "success"));
    };
  }
}

function updateIndicators() {
  const p = project;
  const map = {
    lyrics: !!p.lyrics,
    beat: !!p.beat_url,
    melody: !!p.melody_url,
    vocals: !!p.vocal_processed_url,
    instruments: (p.instrument_urls || []).length > 0,
    mix: !!p.final_mix_url,
  };
  for (const [key, ready] of Object.entries(map)) {
    const el = $(`ind-${key}`);
    if (el) el.className = `tab-indicator ${ready ? "ready" : ""}`;
  }
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
const tabs = document.querySelectorAll(".tab-btn");
tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
    $(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ─── Title autosave ────────────────────────────────────────────────────────
let titleTimer = null;
$("project-title-input").addEventListener("input", (e) => {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(async () => {
    try {
      const updated = await api.updateProject(projectId, { title: e.target.value });
      setProject(updated);
    } catch {}
  }, 800);
});

// ─── Boot ──────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const p = await api.getProject(projectId);
    setProject(p);

    initLyrics(projectId, p, setProject);
    initBeat(projectId, p, setProject);
    initMelody(projectId, p, setProject);
    initVocals(projectId, p, setProject);
    initInstruments(projectId, p, setProject);
    initMix(projectId, p, setProject);
  } catch (e) {
    toast("Failed to load project", "error");
    setTimeout(() => (location.href = "index.html"), 2000);
  }
}

boot();
