import { api } from "../api.js";
import { toast } from "../toast.js";

const SECTIONS = [
  { key: "verse1",   label: "Verse 1" },
  { key: "prechorus",label: "Pre-Chorus" },
  { key: "chorus",   label: "Chorus" },
  { key: "verse2",   label: "Verse 2" },
  { key: "bridge",   label: "Bridge" },
  { key: "outro",    label: "Outro" },
];

let _projectId, _setProject, _lyrics = {};
let saveTimer = null;

function render(project) {
  _lyrics = project.lyrics || {};
  const el = document.getElementById("tab-lyrics");

  el.innerHTML = `
    <div class="tab-header">
      <h2>Lyrics</h2>
      <p>Generate, edit, and refine your song's words</p>
    </div>

    <div class="gen-controls">
      <div class="controls-grid">
        <div class="form-group">
          <label>Topic / Theme</label>
          <input id="lyrics-topic" type="text" placeholder="e.g. late nights, new beginnings…" />
        </div>
        <div class="form-group">
          <label>Perspective</label>
          <select id="lyrics-perspective">
            <option value="first_person">First Person (I/me)</option>
            <option value="second_person">Second Person (you)</option>
            <option value="storytelling">Storytelling (he/she/they)</option>
          </select>
        </div>
      </div>
      <div class="controls-actions">
        <button class="btn btn-primary" id="lyrics-gen-btn">
          ✨ Generate Lyrics
        </button>
        ${_lyrics && Object.keys(_lyrics).length > 0 ? `
        <button class="btn btn-secondary" id="lyrics-regen-btn">
          ↺ Regenerate All
        </button>` : ""}
      </div>
    </div>

    <div id="lyrics-sections" class="lyrics-sections">
      ${renderSections()}
    </div>`;

  attachListeners();
}

function renderSections() {
  if (!_lyrics || !Object.keys(_lyrics).length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No lyrics yet</h3>
        <p>Generate lyrics with AI or type your own in each section below after clicking Generate.</p>
      </div>`;
  }

  return SECTIONS.map(({ key, label }) => `
    <div class="lyrics-section">
      <div class="lyrics-section-header">
        <span class="lyrics-section-label">${label}</span>
        <button class="btn btn-ghost btn-sm" onclick="window._lyricsRegen('${key}')">↺ Redo</button>
      </div>
      <textarea
        id="ls-${key}"
        placeholder="Write ${label.toLowerCase()} here…"
        rows="5"
      >${(_lyrics[key] || "").trim()}</textarea>
    </div>`).join("");
}

function attachListeners() {
  const genBtn = document.getElementById("lyrics-gen-btn");
  const regenBtn = document.getElementById("lyrics-regen-btn");

  if (genBtn) genBtn.addEventListener("click", () => generateAll());
  if (regenBtn) regenBtn.addEventListener("click", () => generateAll());

  SECTIONS.forEach(({ key }) => {
    const ta = document.getElementById(`ls-${key}`);
    if (!ta) return;
    ta.addEventListener("input", () => {
      _lyrics[key] = ta.value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveLyrics, 1000);
    });
  });
}

async function generateAll() {
  const btn = document.getElementById("lyrics-gen-btn");
  const topic = document.getElementById("lyrics-topic")?.value || "";
  const perspective = document.getElementById("lyrics-perspective")?.value || "first_person";

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Generating…';

  try {
    const updated = await api.generateLyrics(_projectId, { topic, perspective });
    _setProject(updated);
    _lyrics = updated.lyrics || {};
    document.getElementById("lyrics-sections").innerHTML = renderSections();
    attachListeners();
    toast("Lyrics generated!", "success");
  } catch (e) {
    toast(`Error: ${e.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "✨ Generate Lyrics";
  }
}

async function regenSection(sectionKey) {
  const topic = document.getElementById("lyrics-topic")?.value || "";
  toast(`Regenerating ${sectionKey}…`, "info");
  try {
    const updated = await api.generateLyrics(_projectId, { topic, perspective: "first_person" });
    if (updated.lyrics?.[sectionKey]) {
      _lyrics[sectionKey] = updated.lyrics[sectionKey];
      const ta = document.getElementById(`ls-${sectionKey}`);
      if (ta) ta.value = _lyrics[sectionKey];
      await saveLyrics();
      toast("Section updated!", "success");
    }
  } catch (e) {
    toast(`Error: ${e.message}`, "error");
  }
}

async function saveLyrics() {
  try {
    const updated = await api.saveLyrics(_projectId, _lyrics);
    _setProject(updated);
  } catch {}
}

window._lyricsRegen = regenSection;

export function initLyrics(projectId, project, setProject) {
  _projectId = projectId;
  _setProject = setProject;
  render(project);
}
