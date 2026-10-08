import { api } from "../api.js";
import { toast } from "../toast.js";

let _projectId, _setProject;
let _mediaRecorder = null;
let _recordedChunks = [];
let _isRecording = false;
let _rawAudio = null; // base64 string
let _lastCoaching = null; // cached so re-render keeps it visible

export function initVocals(projectId, project, setProject) {
  _projectId = projectId;
  _setProject = setProject;
  render(project);
}

function render(project) {
  const el = document.getElementById("tab-vocals");
  const rawUrl = project.vocal_raw_url ? api.audioUrl(project.vocal_raw_url) : null;
  const procUrl = project.vocal_processed_url ? api.audioUrl(project.vocal_processed_url) : null;

  el.innerHTML = `
    <div class="tab-header">
      <h2>Vocals</h2>
      <p>Record your voice, apply pitch correction, and get coaching</p>
    </div>

    <div class="vocal-steps">
      <!-- Step 1: Record -->
      <div class="vocal-step">
        <div class="vocal-step-num">1</div>
        <h3>Record</h3>

        <div class="waveform-container" id="waveform">
          <div id="waveform-idle" style="color: var(--text-dim); font-size: 0.875rem;">
            Press Record to start
          </div>
          <div id="waveform-recording" style="display: none; width: 100%; padding: 8px 16px;">
            <div class="waveform-bars" id="waveform-bars"></div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="record-btn">🎤 Record</button>
          <button class="btn btn-secondary" id="stop-btn" disabled>⏹ Stop</button>
          <label class="btn btn-secondary" style="cursor: pointer;">
            📁 Upload File
            <input type="file" accept="audio/*" id="upload-audio" style="display: none;" />
          </label>
        </div>

        ${rawUrl ? `
        <div style="margin-top: 16px;">
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">Raw Recording</p>
          <audio controls style="width: 100%;" src="${rawUrl}"></audio>
        </div>` : ""}
      </div>

      <!-- Step 2: Process -->
      <div class="vocal-step" id="process-step" ${!rawUrl && !_rawAudio ? 'style="opacity: 0.5; pointer-events: none;"' : ""}>
        <div class="vocal-step-num">2</div>
        <h3>Voice Morphing — Autotune & Pitch Correction</h3>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 14px;">
          Snaps every note to the correct pitch in your song's key (${project.key || "auto"}). Genre-tuned: natural for Soul/R&B, hard robotic for Trap/Drill.
        </p>

        <div class="controls-grid" style="margin-bottom: 16px;">
          <div class="form-group">
            <label>Style</label>
            <select id="autotune-style">
              <option value="subtle">Subtle — Natural (Soul/R&B)</option>
              <option value="medium" selected>Medium — Clean (Pop)</option>
              <option value="heavy">Heavy — Robotic (Trap/Drill)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Intensity <span id="intensity-val">50</span>%</label>
            <input type="range" id="autotune-intensity" min="0" max="100" value="50" />
          </div>
        </div>

        <button class="btn btn-primary" id="process-btn">
          ⚡ Process Vocals
        </button>

        ${procUrl ? `
        <div style="margin-top: 16px;">
          <div class="compare-toggle">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('raw-audio').style.display='block'; document.getElementById('proc-audio').style.display='none';">Before</button>
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('raw-audio').style.display='none'; document.getElementById('proc-audio').style.display='block';">After</button>
          </div>
          ${rawUrl ? `<audio id="raw-audio" controls style="width: 100%; display: none;" src="${rawUrl}"></audio>` : ""}
          <audio id="proc-audio" controls style="width: 100%;" src="${procUrl}"></audio>
        </div>` : ""}
      </div>

      <!-- Step 3: Coaching -->
      <div class="vocal-step" id="coaching-step" ${!procUrl ? 'style="opacity: 0.5; pointer-events: none;"' : ""}>
        <div class="vocal-step-num">3</div>
        <h3>Vocal Coaching <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 400;">(optional)</span></h3>
        <div id="coaching-output">
          ${_lastCoaching
            ? `<div class="coaching-box">🎓 ${_lastCoaching}</div>`
            : '<p style="font-size: 0.875rem; color: var(--text-secondary);">Feedback appears automatically after you process your vocals.</p>'}
        </div>
      </div>
    </div>`;

  // Range display
  const rangeEl = document.getElementById("autotune-intensity");
  const valEl = document.getElementById("intensity-val");
  if (rangeEl) rangeEl.addEventListener("input", () => { valEl.textContent = rangeEl.value; });

  // Record
  document.getElementById("record-btn").addEventListener("click", startRecording);
  document.getElementById("stop-btn").addEventListener("click", stopRecording);

  // Upload
  document.getElementById("upload-audio").addEventListener("change", handleUpload);

  // Process
  document.getElementById("process-btn")?.addEventListener("click", processVocals);
}

function makeWaveformBars() {
  const container = document.getElementById("waveform-bars");
  if (!container) return;
  container.innerHTML = Array.from({ length: 40 }, (_, i) => `
    <div class="waveform-bar" style="
      animation-delay: ${(i * 0.05).toFixed(2)}s;
      height: ${20 + Math.random() * 40}px;
    "></div>`).join("");
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _recordedChunks = [];
    _mediaRecorder = new MediaRecorder(stream);
    _mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _recordedChunks.push(e.data);
    };
    _mediaRecorder.onstop = handleRecordingStop;
    _mediaRecorder.start(100);
    _isRecording = true;

    document.getElementById("record-btn").disabled = true;
    document.getElementById("stop-btn").disabled = false;
    document.getElementById("waveform-idle").style.display = "none";
    document.getElementById("waveform-recording").style.display = "flex";
    makeWaveformBars();
  } catch (e) {
    toast(`Microphone access denied: ${e.message}`, "error");
  }
}

function stopRecording() {
  if (_mediaRecorder && _isRecording) {
    _mediaRecorder.stop();
    _mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    _isRecording = false;
    document.getElementById("record-btn").disabled = false;
    document.getElementById("stop-btn").disabled = true;
    document.getElementById("waveform-recording").style.display = "none";
    document.getElementById("waveform-idle").textContent = "Recording saved — ready to process";
    document.getElementById("waveform-idle").style.display = "block";
  }
}

function handleRecordingStop() {
  const blob = new Blob(_recordedChunks, { type: "audio/webm" });
  const reader = new FileReader();
  reader.onloadend = () => {
    _rawAudio = reader.result.split(",")[1]; // base64
    enableProcessStep();
  };
  reader.readAsDataURL(blob);
}

function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onloadend = () => {
    _rawAudio = reader.result.split(",")[1];
    enableProcessStep();
    toast("File loaded — ready to process", "success");
  };
  reader.readAsDataURL(file);
}

function enableProcessStep() {
  const step = document.getElementById("process-step");
  if (step) {
    step.style.opacity = "1";
    step.style.pointerEvents = "auto";
  }
}

async function processVocals() {
  const audioData = _rawAudio;
  if (!audioData) {
    toast("No recording to process", "error");
    return;
  }

  const btn = document.getElementById("process-btn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Processing…';

  const data = {
    audio_base64: audioData,
    autotune_intensity: parseInt(document.getElementById("autotune-intensity")?.value || "50"),
    style: document.getElementById("autotune-style")?.value || "medium",
  };

  try {
    // Process returns the coaching + analysis; it also persisted the audio URLs.
    const result = await api.processVocal(_projectId, data);
    _lastCoaching = result.coaching || null;

    const updated = await api.getProject(_projectId);
    _setProject(updated);
    render(updated);   // re-render reads _lastCoaching, so coaching stays visible

    toast("Vocals processed!", "success");
  } catch (e) {
    toast(`Processing failed: ${e.message}`, "error");
    btn.disabled = false;
    btn.innerHTML = "⚡ Process Vocals";
  }
}
