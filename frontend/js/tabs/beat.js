import { api } from "../api.js";
import { toast } from "../toast.js";
import { renderBeat } from "../audio-engine.js";

const INSTRUMENTS = [
  "Drums", "Bass", "808s", "Piano", "Guitar",
  "Strings", "Synth", "Brass", "Flute", "Choir",
];

let _projectId, _setProject, _project;
let selectedInstruments = new Set(["Drums", "Bass"]);

export function initBeat(projectId, project, setProject) {
  _projectId = projectId;
  _setProject = setProject;
  _project = project;
  render(project);
}

function render(project) {
  _project = project;
  const el = document.getElementById("tab-beat");
  const beatUrl = project.beat_url ? api.audioUrl(project.beat_url) : null;

  el.innerHTML = `
    <div class="tab-header">
      <h2>Beat</h2>
      <p>Build an instrumental backing track — generated instantly in your browser, no AI</p>
    </div>

    <div class="gen-controls">
      <div class="controls-grid">
        <div class="form-group">
          <label>Energy Level</label>
          <select id="beat-energy">
            <option value="low">Low — Calm, atmospheric</option>
            <option value="medium" selected>Medium — Balanced</option>
            <option value="high">High — Intense, driving</option>
          </select>
        </div>
        <div class="form-group">
          <label>Duration</label>
          <select id="beat-duration">
            <option value="8">8 seconds</option>
            <option value="16" selected>16 seconds</option>
            <option value="32">32 seconds</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 16px;">
        <label>Instruments</label>
        <div class="instruments-select" id="instrument-chips">
          ${INSTRUMENTS.map((i) => `
            <button class="instrument-chip ${selectedInstruments.has(i) ? "selected" : ""}"
              data-name="${i}" type="button">${i}</button>`).join("")}
        </div>
      </div>

      <div class="controls-actions">
        <button class="btn btn-primary" id="beat-gen-btn">🥁 Generate Beat</button>
        <button class="btn btn-secondary" id="beat-preview-btn">▶ Preview Only</button>
        ${beatUrl ? `<button class="btn btn-ghost" id="beat-regen-btn">↺ Regenerate</button>` : ""}
      </div>
      <p style="font-size: 0.78rem; color: var(--text-dim); margin-top: 10px;">
        ⚡ Generated locally using the project's genre (${project.genre}), key (${project.key || "auto"}) & BPM (${project.bpm || 120}). Instant, free, offline.
      </p>
    </div>

    ${beatUrl ? `
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3>Current Beat</h3>
        <span class="badge badge-mixed">Ready</span>
      </div>
      <audio controls style="width: 100%;" src="${beatUrl}"></audio>
    </div>` : `
    <div class="empty-state">
      <div class="empty-icon">🥁</div>
      <h3>No beat yet</h3>
      <p>Pick your instruments and generate a beat instantly</p>
    </div>`}`;

  document.getElementById("instrument-chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".instrument-chip");
    if (!chip) return;
    const name = chip.dataset.name;
    if (selectedInstruments.has(name)) {
      selectedInstruments.delete(name);
      chip.classList.remove("selected");
    } else {
      selectedInstruments.add(name);
      chip.classList.add("selected");
    }
  });

  document.getElementById("beat-gen-btn").addEventListener("click", () => generateBeat(true));
  document.getElementById("beat-preview-btn").addEventListener("click", () => generateBeat(false));
  document.getElementById("beat-regen-btn")?.addEventListener("click", () => {
    if (confirm("Regenerate beat? Current beat will be replaced.")) generateBeat(true);
  });
}

function beatParams() {
  return {
    genre: _project.genre,
    mood: _project.mood,
    bpm: _project.bpm,
    key: _project.key,
    energy: document.getElementById("beat-energy").value,
    duration: parseInt(document.getElementById("beat-duration").value),
    instruments: [...selectedInstruments],
  };
}

async function generateBeat(save) {
  const btn = document.getElementById(save ? "beat-gen-btn" : "beat-preview-btn");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Synthesizing…';

  try {
    const wavBase64 = await renderBeat(beatParams());

    if (!save) {
      // Preview: play in-page without uploading
      const audio = new Audio("data:audio/wav;base64," + wavBase64);
      audio.play();
      toast("Preview playing — click Generate to keep it", "info");
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }

    const updated = await api.saveBeat(_projectId, {
      audio_base64: wavBase64,
      energy: document.getElementById("beat-energy").value,
      instruments: [...selectedInstruments],
      duration_seconds: parseInt(document.getElementById("beat-duration").value),
    });
    _setProject(updated);
    render(updated);
    toast("Beat generated!", "success");
  } catch (e) {
    toast(`Beat failed: ${e.message}`, "error");
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
