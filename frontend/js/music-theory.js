// Native music theory — no external library, no AI.
// Chord progressions are deterministic music theory: genre/mood → roman numerals → chords in key.

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENHARMONIC = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

// Major scale interval pattern (semitones from root)
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

// Diatonic chord qualities per scale degree
const MAJOR_QUALITIES = ["maj", "min", "min", "maj", "maj", "min", "dim"];
const MINOR_QUALITIES = ["min", "dim", "maj", "min", "min", "maj", "maj"];

// Roman numeral → scale degree index (0-based)
const ROMAN_INDEX = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

// Genre + mood → progressions as roman numerals (uppercase = the degree; quality comes from scale).
// Multiple options per combo; we pick by index for variety.
const PROGRESSIONS = {
  // genre -> { default: [...], moodOverrides: { mood: [...] } }
  Pop: {
    mode: "major",
    progs: [["I", "V", "VI", "IV"], ["VI", "IV", "I", "V"], ["I", "IV", "V", "IV"]],
    moods: { Sad: ["VI", "IV", "I", "V"], Romantic: ["I", "VI", "IV", "V"] },
  },
  "R&B": {
    mode: "minor",
    progs: [["I", "IV", "VII", "III"], ["VI", "VII", "I", "I"], ["I", "VII", "VI", "VII"]],
    moods: { Romantic: ["I", "III", "VI", "IV"], Chill: ["I", "IV", "I", "V"] },
  },
  "Hip-Hop": {
    mode: "minor",
    progs: [["I", "VI", "III", "VII"], ["I", "IV", "I", "V"], ["I", "VII", "VI", "V"]],
    moods: { Angry: ["I", "VI", "VII", "I"], Hype: ["I", "V", "VI", "IV"] },
  },
  Afrobeats: {
    mode: "minor",
    progs: [["I", "IV", "V", "I"], ["I", "VII", "VI", "VII"], ["VI", "VII", "I", "I"]],
    moods: { Party: ["I", "V", "VI", "IV"], Chill: ["I", "IV", "I", "V"] },
  },
  Drill: {
    mode: "minor",
    progs: [["I", "VI", "VII", "I"], ["I", "VII", "VI", "VII"], ["I", "V", "VI", "I"]],
    moods: { Angry: ["I", "VI", "VII", "I"] },
  },
  Latin: {
    mode: "minor",
    progs: [["I", "IV", "V", "V"], ["VI", "VII", "I", "I"], ["I", "V", "VI", "IV"]],
    moods: { Party: ["I", "IV", "V", "I"], Romantic: ["I", "VI", "IV", "V"] },
  },
  Country: {
    mode: "major",
    progs: [["I", "IV", "V", "I"], ["I", "V", "VI", "IV"], ["I", "IV", "I", "V"]],
    moods: { Sad: ["VI", "IV", "I", "V"] },
  },
  Soul: {
    mode: "major",
    progs: [["I", "VI", "IV", "V"], ["II", "V", "I", "I"], ["I", "IV", "II", "V"]],
    moods: { Sad: ["VI", "II", "V", "I"], Spiritual: ["I", "IV", "V", "I"] },
  },
  EDM: {
    mode: "minor",
    progs: [["VI", "VII", "I", "V"], ["I", "VII", "VI", "VII"], ["VI", "IV", "I", "V"]],
    moods: { Hype: ["VI", "VII", "I", "I"], Party: ["I", "V", "VI", "IV"] },
  },
  Indie: {
    mode: "major",
    progs: [["I", "V", "VI", "IV"], ["IV", "I", "V", "VI"], ["I", "III", "IV", "IV"]],
    moods: { Reflective: ["VI", "IV", "I", "V"], Chill: ["I", "IV", "VI", "V"] },
  },
};

function normalizeRoot(note) {
  if (!note) return "A";
  note = note.trim();
  // strip trailing 'm' for minor key like "Am" -> "A"
  const root = note.replace(/m$/, "").replace(/maj$/i, "");
  return ENHARMONIC[root] || root;
}

function keyIsMinor(key) {
  return /m$/.test((key || "").trim()) && !/maj/i.test(key || "");
}

function rootIndex(note) {
  const n = ENHARMONIC[note] || note;
  return CHROMATIC.indexOf(n);
}

// Build a chord symbol for a roman numeral in a given key.
function romanToChord(roman, keyRoot, mode) {
  const degree = ROMAN_INDEX[roman];
  if (degree === undefined) return keyRoot;

  const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  const qualities = mode === "minor" ? MINOR_QUALITIES : MAJOR_QUALITIES;

  const base = rootIndex(keyRoot);
  const noteIdx = (base + steps[degree]) % 12;
  const note = CHROMATIC[noteIdx];
  const quality = qualities[degree];

  if (quality === "min") return note + "m";
  if (quality === "dim") return note + "dim";
  return note; // major
}

/**
 * Get a chord progression for a project.
 * @returns { chords: ["Am","F","C","G"], mode: "minor" }
 */
export function getChordProgression(genre, mood, key, variant = 0) {
  const config = PROGRESSIONS[genre] || PROGRESSIONS.Pop;
  const mode = key ? (keyIsMinor(key) ? "minor" : config.mode) : config.mode;
  const keyRoot = key ? normalizeRoot(key) : "C";

  let romans;
  if (config.moods && config.moods[mood]) {
    romans = config.moods[mood];
  } else {
    romans = config.progs[variant % config.progs.length];
  }

  const chords = romans.map((r) => romanToChord(r, keyRoot, mode));
  return { chords, mode, romans };
}

// Chord symbol -> array of note frequencies (Hz) for one octave triad.
// Used by the Tone.js engine to actually play the chord.
const A4 = 440;
function noteToFreq(note, octave = 4) {
  const idx = rootIndex(note.replace(/m$|dim$/, ""));
  if (idx < 0) return A4;
  // MIDI note number: C4 = 60. Our CHROMATIC[0]='C'
  const midi = idx + (octave + 1) * 12;
  return A4 * Math.pow(2, (midi - 69) / 12);
}

export function chordToNotes(chord, octave = 3) {
  const root = chord.replace(/m$|dim$/, "");
  const isMinor = /m$/.test(chord);
  const isDim = /dim$/.test(chord);
  const rootIdx = rootIndex(root);
  if (rootIdx < 0) return [];

  // triad intervals
  const third = isMinor || isDim ? 3 : 4;
  const fifth = isDim ? 6 : 7;

  return [0, third, fifth].map((semi) => {
    const idx = rootIdx + semi;
    const oct = octave + Math.floor(idx / 12);
    const noteName = CHROMATIC[idx % 12];
    return noteToFreq(noteName, oct);
  });
}

// Root note frequency (for bass lines)
export function chordRootFreq(chord, octave = 2) {
  const root = chord.replace(/m$|dim$/, "");
  return noteToFreq(root, octave);
}

// Suggest a scale (note names) for melody generation in the key.
export function getScaleNotes(key, mode) {
  const keyRoot = normalizeRoot(key || "C");
  const isMin = mode ? mode === "minor" : keyIsMinor(key);
  const steps = isMin ? MINOR_STEPS : MAJOR_STEPS;
  const base = rootIndex(keyRoot);
  return steps.map((s) => CHROMATIC[(base + s) % 12]);
}

export function scaleNoteFreqs(key, mode, octave = 4) {
  return getScaleNotes(key, mode).map((n) => noteToFreq(n, octave));
}
