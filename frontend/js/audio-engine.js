// Audio engine — Tone.js synthesis, fully client-side. No AI, no API.
// Generates beats / melodies / instrument layers and renders them offline to WAV.
// Tone is loaded globally via CDN <script> in project.html.

import { chordToNotes, chordRootFreq, scaleNoteFreqs } from "./music-theory.js";

const Tone = window.Tone;

// ─── Genre drum patterns (16-step grids; 1 = hit) ───────────────────────────
// k=kick, s=snare, h=hihat, o=open-hat
const PATTERNS = {
  Pop: {
    k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  "Hip-Hop": {
    k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  "R&B": {
    k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  Drill: {
    k: [1,0,0,0, 0,1,0,0, 1,0,0,1, 0,0,0,0],
    s: [0,0,0,0, 0,0,0,1, 0,0,0,0, 1,0,0,0],
    h: [1,1,0,1, 1,1,1,0, 1,1,0,1, 1,0,1,1],
  },
  Afrobeats: {
    k: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,0,0],
    s: [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,1,0],
    h: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0],
  },
  EDM: {
    k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
  },
  Latin: {
    k: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    s: [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0],
    h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  Country: {
    k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  Soul: {
    k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  Indie: {
    k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
};

const ENERGY_GAIN = { low: 0.6, medium: 0.85, high: 1.0 };

function getPattern(genre) {
  return PATTERNS[genre] || PATTERNS.Pop;
}

// ─── WAV encoding ────────────────────────────────────────────────────────────
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const len = buffer.length * numCh * 2 + 44;
  const ab = new ArrayBuffer(len);
  const view = new DataView(ab);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  let pos = 0;
  writeStr(pos, "RIFF"); pos += 4;
  view.setUint32(pos, len - 8, true); pos += 4;
  writeStr(pos, "WAVE"); pos += 4;
  writeStr(pos, "fmt "); pos += 4;
  view.setUint32(pos, 16, true); pos += 4;
  view.setUint16(pos, 1, true); pos += 2;          // PCM
  view.setUint16(pos, numCh, true); pos += 2;
  view.setUint32(pos, sampleRate, true); pos += 4;
  view.setUint32(pos, sampleRate * numCh * 2, true); pos += 4;
  view.setUint16(pos, numCh * 2, true); pos += 2;
  view.setUint16(pos, 16, true); pos += 2;
  writeStr(pos, "data"); pos += 4;
  view.setUint32(pos, buffer.length * numCh * 2, true); pos += 4;

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }
  return ab;
}

function wavToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toNativeBuffer(rendered) {
  // Tone.Offline may resolve to a ToneAudioBuffer or a raw AudioBuffer
  if (rendered && typeof rendered.get === "function") return rendered.get();
  return rendered;
}

// ─── Beat rendering ──────────────────────────────────────────────────────────
export async function renderBeat({ genre, mood, bpm, key, energy = "medium", instruments = [], duration = 16 }) {
  await Tone.start();
  const tempo = bpm || 120;
  const secPerBeat = 60 / tempo;
  const stepDur = secPerBeat / 4;       // 16th notes
  const barDur = stepDur * 16;
  const bars = Math.max(1, Math.round(duration / barDur));
  const totalDur = bars * barDur + 0.5;
  const gain = ENERGY_GAIN[energy] || 0.85;
  const pattern = getPattern(genre);

  const useBass = instruments.length === 0 || instruments.some((i) =>
    ["Bass", "808s"].includes(i));
  const useChords = instruments.length === 0 || instruments.some((i) =>
    ["Piano", "Synth", "Strings", "Guitar"].includes(i));

  const chordRoots = scaleNoteFreqs(key, null, 2); // bass octave roots from scale

  const rendered = await Tone.Offline(() => {
    const master = new Tone.Gain(gain).toDestination();
    const comp = new Tone.Compressor(-18, 3).connect(master);

    // Drums
    const kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.05 }).connect(comp);
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    }).connect(comp);
    const hat = new Tone.MetalSynth({
      frequency: 250, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(new Tone.Gain(0.3).connect(comp));

    // Bass
    const bass = new Tone.MonoSynth({
      oscillator: { type: genre === "Drill" || genre === "Hip-Hop" ? "sine" : "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.2, baseFrequency: 100, octaves: 2.5 },
    }).connect(new Tone.Gain(0.5).connect(comp));

    for (let bar = 0; bar < bars; bar++) {
      const barStart = bar * barDur;
      for (let step = 0; step < 16; step++) {
        const t = barStart + step * stepDur;
        if (pattern.k[step]) kick.triggerAttackRelease("C1", "8n", t);
        if (pattern.s[step]) snare.triggerAttackRelease("16n", t);
        if (pattern.h[step]) hat.triggerAttackRelease("32n", t, 0.4);
      }
      // Bass on the 1 and the "and" of 3 (simple, musical)
      if (useBass && chordRoots.length) {
        const r1 = chordRoots[0];
        const r2 = chordRoots[(bar % 4) % chordRoots.length] || r1;
        bass.triggerAttackRelease(r1, secPerBeat * 1.5, barStart);
        bass.triggerAttackRelease(r2, secPerBeat * 1.5, barStart + secPerBeat * 2);
      }
    }

    // Chord stabs (pad) tied to scale — gentle harmonic bed
    if (useChords) {
      const pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.8 },
      }).connect(new Tone.Gain(0.18).connect(comp));
      const scaleFreqs = scaleNoteFreqs(key, null, 4);
      for (let bar = 0; bar < bars; bar++) {
        const triad = [scaleFreqs[0], scaleFreqs[2], scaleFreqs[4]].filter(Boolean);
        pad.triggerAttackRelease(triad, barDur * 0.9, bar * barDur);
      }
    }
  }, totalDur);

  return wavToBase64(audioBufferToWav(toNativeBuffer(rendered)));
}

// ─── Melody rendering (sings the chord progression as a lead) ────────────────
export async function renderMelody({ genre, mood, key, chords = [], chorusType = "anthem", bpm }) {
  await Tone.start();
  const tempo = bpm || 110;
  const secPerBeat = 60 / tempo;
  const chordDur = secPerBeat * 2;          // each chord = 2 beats
  const totalDur = chords.length * chordDur + 1;

  const leadType = {
    anthem: "sawtooth",
    emotional: "triangle",
    trap: "square",
    "sing-along": "triangle",
    "pre-chorus": "sine",
  }[chorusType] || "triangle";

  const rendered = await Tone.Offline(() => {
    const master = new Tone.Gain(0.85).toDestination();
    const reverb = new Tone.Reverb(1.5).connect(master);

    // Chord bed
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 1 },
    }).connect(new Tone.Gain(0.3).connect(reverb));

    // Lead "vocal" reference melody
    const lead = new Tone.MonoSynth({
      oscillator: { type: leadType },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 },
    }).connect(new Tone.Gain(0.5).connect(reverb));

    chords.forEach((chord, i) => {
      const t = i * chordDur;
      const notes = chordToNotes(chord, 3);
      if (notes.length) pad.triggerAttackRelease(notes, chordDur * 0.95, t);

      // Lead arpeggiates the chord tones — a singable reference line
      const leadNotes = chordToNotes(chord, 4);
      const noteOrder = [0, 2, 1, 2];
      for (let n = 0; n < 4; n++) {
        const freq = leadNotes[noteOrder[n] % leadNotes.length];
        if (freq) lead.triggerAttackRelease(freq, secPerBeat * 0.45, t + n * (chordDur / 4));
      }
    });
  }, totalDur);

  return wavToBase64(audioBufferToWav(toNativeBuffer(rendered)));
}

// ─── Instrument layer rendering ──────────────────────────────────────────────
export async function renderInstrument({ genre, mood, bpm, key, instrumentType, intensity = "medium", duration = 16 }) {
  await Tone.start();
  const tempo = bpm || 120;
  const secPerBeat = 60 / tempo;
  const barDur = secPerBeat * 4;
  const bars = Math.max(1, Math.round(duration / barDur));
  const totalDur = bars * barDur + 0.5;
  const gain = { soft: 0.4, medium: 0.65, heavy: 0.9 }[intensity] || 0.65;

  const scaleFreqs = scaleNoteFreqs(key, null, instrumentType === "Bass" ? 2 : 4);

  const config = {
    Piano:   { osc: "triangle", env: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.6 } },
    Guitar:  { osc: "sawtooth", env: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 } },
    Strings: { osc: "sawtooth", env: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 1.2 } },
    Synth:   { osc: "square", env: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.5 } },
    Brass:   { osc: "sawtooth", env: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.4 } },
    Flute:   { osc: "sine", env: { attack: 0.1, decay: 0.1, sustain: 0.8, release: 0.5 } },
    Choir:   { osc: "triangle", env: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1.5 } },
    Pad:     { osc: "triangle", env: { attack: 0.6, decay: 0.4, sustain: 0.9, release: 2 } },
    Lead:    { osc: "sawtooth", env: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 } },
    "Counter-Melody": { osc: "triangle", env: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.4 } },
    Percussion: { osc: "sine", env: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } },
  }[instrumentType] || { osc: "triangle", env: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.6 } };

  const rendered = await Tone.Offline(() => {
    const master = new Tone.Gain(gain).toDestination();
    const reverb = new Tone.Reverb(1.2).connect(master);

    if (instrumentType === "Percussion") {
      const perc = new Tone.MetalSynth({
        frequency: 200, envelope: config.env, harmonicity: 5, modulationIndex: 16, octaves: 1.2,
      }).connect(new Tone.Gain(0.4).connect(master));
      const stepDur = secPerBeat / 2;
      for (let i = 0; i < bars * 8; i++) {
        if (i % 2 === 0) perc.triggerAttackRelease("16n", i * stepDur, 0.5);
      }
    } else if (["Pad", "Strings", "Choir"].includes(instrumentType)) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: config.osc }, envelope: config.env,
      }).connect(reverb);
      const triad = [scaleFreqs[0], scaleFreqs[2], scaleFreqs[4]].filter(Boolean);
      for (let bar = 0; bar < bars; bar++) {
        synth.triggerAttackRelease(triad, barDur * 0.95, bar * barDur);
      }
    } else {
      // Melodic line over the scale
      const synth = new Tone.MonoSynth({
        oscillator: { type: config.osc }, envelope: config.env,
      }).connect(reverb);
      const motif = [0, 2, 4, 2, 3, 1, 0, 4];
      const noteDur = secPerBeat * 0.5;
      const totalNotes = Math.floor(totalDur / noteDur);
      for (let i = 0; i < totalNotes; i++) {
        const freq = scaleFreqs[motif[i % motif.length] % scaleFreqs.length];
        if (freq) synth.triggerAttackRelease(freq, noteDur * 0.9, i * noteDur);
      }
    }
  }, totalDur);

  return wavToBase64(audioBufferToWav(toNativeBuffer(rendered)));
}

// ─── Live preview (non-offline) ──────────────────────────────────────────────
export async function ensureAudioReady() {
  await Tone.start();
}
