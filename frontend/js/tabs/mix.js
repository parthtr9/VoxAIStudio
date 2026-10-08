import { api } from "../api.js";
import { toast } from "../toast.js";

let _projectId, _setProject;
const volumes = {};

export function initMix(projectId, project, setProject) {
  _projectId = projectId;
  _setProject = setProject;
  render(project);
}

function render(project) {
  const el = document.getElementById("tab-mix");
  const hasMix = !!project.final_mix_url;
  const mixUrl = hasMix ? api.audioUrl(project.final_mix_url) : null;

  const components = buildComponents(project);
  const hasAny = components.some((c) => c.ready);

  el.innerHTML = `
    <div class="tab-header">
      <h2>Mix</h2>
      <p>Combine all your pieces into one finished song</p>
    </div>

    <div class="mix-components" id="mix-components">
      ${components.map(componentRow).join("")}
    </div>

    ${hasAny ? `
    <div style="margin-bottom: 24px;">
      <button class="btn btn-primary btn-lg" id="mix-gen-btn" ${hasMix ? "" : ""}>
        🎛 Generate Final Mix
      </button>
      ${hasMix ? `<span style="margin-left: 12px; font-size: 0.875rem; color: var(--success);">✓ Mix ready — regenerate to update</span>` : ""}
    </div>` : `
    <div class="empty-state">
      <div class="empty-icon">🎛</div>
      <h3>Nothing to mix yet</h3>
      <p>Add at least a beat or vocal recording, then come back to generate your final mix.</p>
    </div>`}

    ${hasMix ? `
    <div class="final-mix-box">
      <h3 style="margin-bottom: 4px;">🎉 Final Mix Ready</h3>
      <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px;">${project.title}</p>
      <audio controls style="width: 100%; max-width: 500px;" src="${mixUrl}"></audio>
      <div class="final-mix-actions">
        <a href="${mixUrl}" download="${project.title.replace(/\s+/g, "_")}_mix.mp3" class="btn btn-primary">
          ⬇ Download MP3
        </a>
        <button class="btn btn-secondary" onclick="copyShareLink()">
          🔗 Copy Share Link
        </button>
      </div>
    </div>` : ""}`;

  // Volume sliders
  components.forEach((c) => {
    if (!c.ready) return;
    const slider = document.getElementById(`vol-${c.key}`);
    if (slider) {
      slider.addEventListener("input", () => {
        volumes[c.key] = parseFloat(slider.value);
        document.getElementById(`vol-display-${c.key}`).textContent =
          `${Math.round(slider.value * 100)}%`;
      });
    }
  });

  document.getElementById("mix-gen-btn")?.addEventListener("click", generateMix);

  window.copyShareLink = () => {
    const url = api.audioUrl(project.final_mix_url);
    navigator.clipboard.writeText(url).then(() => toast("Mix link copied!", "success"));
  };
}

function buildComponents(project) {
  const layers = project.instrument_urls || [];
  const components = [
    {
      key: "beat",
      label: "Beat",
      icon: "🥁",
      ready: !!project.beat_url,
      url: project.beat_url,
    },
    {
      key: "vocal",
      label: "Vocals",
      icon: "🎤",
      ready: !!(project.vocal_processed_url || project.vocal_raw_url),
      url: project.vocal_processed_url || project.vocal_raw_url,
      note: project.vocal_processed_url ? "Processed" : "Raw",
    },
    ...layers.map((url, i) => ({
      key: `instrument_${i}`,
      label: `Instrument Layer ${i + 1}`,
      icon: "🎶",
      ready: true,
      url,
    })),
  ];
  return components;
}

function componentRow(c) {
  const vol = volumes[c.key] ?? (c.key === "beat" ? 1.0 : c.key === "vocal" ? 0.9 : 0.7);
  return `
    <div class="mix-component ${c.ready ? "" : "disabled"}">
      <div class="status-dot ${c.ready ? "ready" : "missing"}"></div>
      <span style="font-size: 1.2rem;">${c.icon}</span>
      <div class="component-info">
        <div class="component-name">${c.label}</div>
        <div class="component-status">${c.ready ? (c.note || "Ready") : "Not generated yet"}</div>
      </div>
      ${c.ready ? `
      <div style="display: flex; align-items: center; gap: 8px;">
        <input
          type="range"
          class="volume-slider"
          id="vol-${c.key}"
          min="0" max="1" step="0.05"
          value="${vol}"
        />
        <span id="vol-display-${c.key}" style="font-size: 0.8rem; color: var(--text-secondary); width: 36px;">
          ${Math.round(vol * 100)}%
        </span>
      </div>` : ""}
    </div>`;
}

async function generateMix() {
  const btn = document.getElementById("mix-gen-btn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Mixing…';

  try {
    const updated = await api.generateMix(_projectId, { volumes });
    _setProject(updated);
    render(updated);
    toast("Final mix ready! 🎉", "success");
  } catch (e) {
    toast(`Mix failed: ${e.message}`, "error");
    btn.disabled = false;
    btn.innerHTML = "🎛 Generate Final Mix";
  }
}
