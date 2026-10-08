const API_BASE = "http://localhost:8000";

async function apiRequest(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  listProjects: () => apiRequest("GET", "/api/projects"),
  getProject: (id) => apiRequest("GET", `/api/projects/${id}`),
  createProject: (data) => apiRequest("POST", "/api/projects", data),
  updateProject: (id, data) => apiRequest("PATCH", `/api/projects/${id}`, data),
  deleteProject: (id) => apiRequest("DELETE", `/api/projects/${id}`),

  generateLyrics: (id, data) => apiRequest("POST", `/api/projects/${id}/lyrics/generate`, data),
  saveLyrics: (id, lyrics) => apiRequest("PATCH", `/api/projects/${id}/lyrics`, { lyrics }),

  // Beat/melody/instruments are synthesized client-side (Tone.js) and uploaded as WAV.
  saveBeat: (id, data) => apiRequest("POST", `/api/projects/${id}/beat`, data),

  saveMelody: (id, data) => apiRequest("POST", `/api/projects/${id}/melody`, data),

  processVocal: (id, data) => apiRequest("POST", `/api/projects/${id}/vocal/process`, data),

  addInstrument: (id, data) => apiRequest("POST", `/api/projects/${id}/instruments`, data),
  removeInstrument: (id, index) => apiRequest("DELETE", `/api/projects/${id}/instruments/${index}`),

  generateMix: (id, data) => apiRequest("POST", `/api/projects/${id}/mix/generate`, data),

  getTrends: () => apiRequest("GET", "/api/trends"),

  audioUrl: (path) => path ? `${API_BASE}${path}` : null,
};
