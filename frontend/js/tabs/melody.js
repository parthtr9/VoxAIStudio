import { api } from "../api.js";
import { toast } from "../toast.js";
import { renderMelody } from "../audio-engine.js";
import { getChordProgression } from "../music-theory.js";

let _projectId, _setProject, _project;
let _variant = 0;

export function initMelody(projectId, project, setProject) {
  _projectId = projectId;
  _setProject = setProject;
  _project = project;
  render(project);
}

function currentChords() {
  const { chords } = getChordProgression(_project.genre, _project.mood, _project.key, _variant);
  return chords;
}

function render(project) {
  _project = project;
  const el = document.getElementById("tab-melody");
  const melodyUrl = project.melody_url ? api.audioUrl(project.melody_url) : null;
  // Show saved chords if present, else a freshly computed preview
  const chords = (project.chord_progression && project.chord_progression.length)
    ? project.chord_progression
    : currentChords();

  el.innerHTML = `
    <div class="tab-header">
      <h2>Melody / Chorus</h2>
      <p>Chord progression from music theory + a singable melody reference — all local, no AI</p>
    </div>

    <div class="gen-controls">
      <div class="controls-grid">
        <div class="form-group">
          <label>Chorus Type</label>
          <select id="chorus-type">
            <option value="anthem">Anthem / Big Hook</option>
            <option value="emotional">Emotional / Melodic</option>
            <option value="trap">Trap Chorus</option>
            <option value="sing-along">Sing-Along</option>
            <option value="pre-chorus">Pre-Chorus Builder</option>
          </select>
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h3>Chord Progression</h3>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-ghost btn-sm" id="chord-shuffle-btn">⟳ Try Another</button>
            <button class="btn btn-ghost btn-sm" id="chord-copy-btn">Copy</button>
          </div>
        </div>
        <div class="chord-display" id="chord-display">
          ${chords.map((c) => `<div class="chord-pill">${c}</div>`).join("")}
        </div>
        <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 10px;">
          Derived from ${project.genre} in ${project.key || "C"} — pure music theory, no AI.
        </p>
      </div>

      <div class="controls-actions">
        <button class="btn btn-primary" id="melody-gen-btn">🎵 Generate Melody</button>
        <button class="btn btn-secondary" id="melody-preview-btn">▶ Preview Only</button>
      </div>
    </div>

    ${melodyUrl ? `
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3>Melody Reference</h3>
        <span style="font-size: 0.78rem; color: var(--text-secondary);">Demo reference — the template to sing to</span>
      </div>
      <audio controls style="width: 100%;" src="${melodyUrl}"></audio>
    </div>` : `
    <div class="empty-state">
      <div class="empty-icon">🎵</div>
      <h3>No melody saved yet</h3>
      <p>Preview the chords, then generate a melody reference</p>
    </div>`}`;

  document.getElementById("chord-shuffle-btn").addEventListener("click", () => {
    _variant++;
    document.getElementById("chord-display").innerHTML =
      currentChords().map((c) => `<div class="chord-pill">${c}</div>`).join("");
  });

  document.getElementById("chord-copy-btn").addEventListener("click", () => {
    const text = currentChords().join(" – ");
    navigator.clipboard.writeText(text).then(() => toast("Copied!", "success"));
  });

  document.getElementById("melody-gen-btn").addEventListener("click", () => generateMelody(true));
  document.getElementById("melody-preview-btn").addEventListener("click", () => generateMelody(false));
}

async function generateMelody(save) {
  const btn = document.getElementById(save ? "melody-gen-btn" : "melody-preview-btn");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Synthesizing…';

  const chords = currentChords();
  const chorusType = document.getElementById("chorus-type").value;

  try {
    const wavBase64 = await renderMelody({
      genre: _project.genre,
      mood: _project.mood,
      key: _project.key,
      bpm: _project.bpm,
      chords,
      chorusType,
    });

    if (!save) {
      new Audio("data:audio/wav;base64," + wavBase64).play();
      toast("Preview playing", "info");
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }

    const updated = await api.saveMelody(_projectId, {
      audio_base64: wavBase64,
      chord_progression: chords,
      chorus_type: chorusType,
    });
    _setProject(updated);
    render(updated);
    toast("Melody generated!", "success");
  } catch (e) {
    toast(`Melody failed: ${e.message}`, "error");
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
