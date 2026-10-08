import { api } from "../api.js";
import { toast } from "../toast.js";
import { renderInstrument } from "../audio-engine.js";

let _projectId, _setProject, _project;

export function initInstruments(projectId, project, setProject) {
  _projectId = projectId;
  _setProject = setProject;
  _project = project;
  render(project);
}

function render(project) {
  _project = project;
  const el = document.getElementById("tab-instruments");
  const layers = project.instrument_urls || [];

  el.innerHTML = `
    <div class="tab-header">
      <h2>Instruments</h2>
      <p>Add instrument layers on top of your beat — synthesized locally, no AI</p>
    </div>

    <div class="gen-controls">
      <div class="controls-grid">
        <div class="form-group">
          <label>Instrument Type</label>
          <select id="inst-type">
            <option value="Piano">Piano</option>
            <option value="Guitar">Guitar</option>
            <option value="Strings">Strings</option>
            <option value="Synth">Synth</option>
            <option value="Brass">Brass</option>
            <option value="Flute">Flute</option>
            <option value="Choir">Choir</option>
            <option value="Pad">Pad (atmospheric)</option>
            <option value="Lead">Lead Melody</option>
            <option value="Counter-Melody">Counter-Melody</option>
            <option value="Percussion">Percussion</option>
          </select>
        </div>
        <div class="form-group">
          <label>Intensity</label>
          <select id="inst-intensity">
            <option value="soft">Soft</option>
            <option value="medium" selected>Medium</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
        <div class="form-group">
          <label>Duration</label>
          <select id="inst-duration">
            <option value="8">8 seconds</option>
            <option value="16" selected>16 seconds</option>
            <option value="32">32 seconds</option>
          </select>
        </div>
      </div>
      <div class="controls-actions">
        <button class="btn btn-primary" id="add-instrument-btn">+ Add Layer</button>
        <button class="btn btn-secondary" id="preview-instrument-btn">▶ Preview Only</button>
      </div>
    </div>

    <div class="instrument-layers" id="instrument-layers">
      ${layers.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">🎸</div>
        <h3>No instrument layers</h3>
        <p>Add layers to enrich your beat. Each is generated instantly in your browser.</p>
      </div>` : layers.map((url, i) => layerCard(url, i)).join("")}
    </div>`;

  document.getElementById("add-instrument-btn").addEventListener("click", () => addLayer(true));
  document.getElementById("preview-instrument-btn").addEventListener("click", () => addLayer(false));
}

function layerCard(url, index) {
  const audioUrl = api.audioUrl(url);
  return `
    <div class="instrument-layer-card" id="layer-${index}">
      <div class="layer-icon">🎶</div>
      <div class="layer-info">
        <div class="layer-name">Layer ${index + 1}</div>
        <div class="layer-meta">Instrument track</div>
        <audio controls style="width: 100%; margin-top: 8px; height: 32px;" src="${audioUrl}"></audio>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="window._removeLayer(${index})">🗑</button>
    </div>`;
}

window._removeLayer = async (index) => {
  if (!confirm(`Remove layer ${index + 1}?`)) return;
  try {
    const updated = await api.removeInstrument(_projectId, index);
    _setProject(updated);
    render(updated);
    toast("Layer removed", "info");
  } catch (e) {
    toast(`Error: ${e.message}`, "error");
  }
};

function instParams() {
  return {
    genre: _project.genre,
    mood: _project.mood,
    bpm: _project.bpm,
    key: _project.key,
    instrumentType: document.getElementById("inst-type").value,
    intensity: document.getElementById("inst-intensity").value,
    duration: parseInt(document.getElementById("inst-duration").value),
  };
}

async function addLayer(save) {
  const btn = document.getElementById(save ? "add-instrument-btn" : "preview-instrument-btn");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Synthesizing…';

  try {
    const wavBase64 = await renderInstrument(instParams());

    if (!save) {
      new Audio("data:audio/wav;base64," + wavBase64).play();
      toast("Preview playing", "info");
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }

    const updated = await api.addInstrument(_projectId, {
      audio_base64: wavBase64,
      instrument_type: document.getElementById("inst-type").value,
      intensity: document.getElementById("inst-intensity").value,
      duration_seconds: parseInt(document.getElementById("inst-duration").value),
    });
    _setProject(updated);
    render(updated);
    toast("Layer added!", "success");
  } catch (e) {
    toast(`Failed: ${e.message}`, "error");
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
