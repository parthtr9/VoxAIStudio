import base64
import io
import os
import uuid
from typing import Optional, List, Tuple

import numpy as np

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


def save_audio_bytes(audio_bytes: bytes, filename: Optional[str] = None, ext: str = "mp3") -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    if not filename:
        filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(audio_bytes)
    return f"/uploads/{filename}"


def save_base64_audio(audio_base64: str, ext: str = "webm") -> Tuple[str, bytes]:
    audio_bytes = base64.b64decode(audio_base64)
    url = save_audio_bytes(audio_bytes, ext=ext)
    return url, audio_bytes


def url_to_path(url: str) -> str:
    """Map a stored audio URL ('/uploads/<name>') to its filesystem path under
    UPLOAD_DIR. Robust to working directory — joins on UPLOAD_DIR by basename."""
    name = url.rstrip("/").rsplit("/", 1)[-1]
    return os.path.join(UPLOAD_DIR, name)


def save_base64_audio_as(audio_base64: str, filename: str) -> str:
    """Decode base64 (strips data URL prefix if present) and save under filename."""
    if "," in audio_base64 and audio_base64.strip().startswith("data:"):
        audio_base64 = audio_base64.split(",", 1)[1]
    audio_bytes = base64.b64decode(audio_base64)
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "wav"
    return save_audio_bytes(audio_bytes, filename=filename, ext=ext)


def analyze_pitch(audio_bytes: bytes, key: Optional[str] = None) -> dict:
    try:
        import librosa

        audio_io = io.BytesIO(audio_bytes)
        y, sr = librosa.load(audio_io, sr=None, mono=True)

        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
        )

        voiced_f0 = f0[voiced_flag] if voiced_flag is not None else np.array([])
        avg_pitch = float(np.nanmean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        std_pitch = float(np.nanstd(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        stability = float(1 - std_pitch / (avg_pitch + 1e-6)) if avg_pitch > 0 else 0.7
        stability = min(max(stability, 0.0), 1.0)

        return {
            "avg_pitch_hz": avg_pitch,
            "pitch_stability": stability,
            "voiced_ratio": float(voiced_flag.mean()) if voiced_flag is not None else 0.6,
            "duration_seconds": float(len(y) / sr),
        }
    except Exception as e:
        return {
            "avg_pitch_hz": 220.0,
            "pitch_stability": 0.7,
            "voiced_ratio": 0.65,
            "duration_seconds": 0.0,
            "note": f"analysis unavailable: {e}",
        }


def generate_coaching(genre: str, key: Optional[str], pitch: dict) -> str:
    """Rule-based vocal coaching from pitch analysis. No LLM."""
    stability = pitch.get("pitch_stability", 0.7)
    voiced = pitch.get("voiced_ratio", 0.6)
    duration = pitch.get("duration_seconds", 0.0)
    avg_hz = pitch.get("avg_pitch_hz", 0.0)

    parts = []

    # Stability assessment
    if stability >= 0.85:
        parts.append("Your pitch control is strong and consistent — held notes stay locked in.")
    elif stability >= 0.65:
        parts.append("Your pitch is mostly solid, with some drift on longer notes.")
    else:
        parts.append(
            "Your pitch wanders on sustained notes — try supporting from your diaphragm "
            "and keeping airflow steady through held words."
        )

    # Voiced ratio (how much actual singing vs silence/breath)
    if voiced < 0.4:
        parts.append("There's a lot of space in the take — move closer to the mic or sing more continuously.")
    elif voiced > 0.8:
        parts.append("Good, full delivery throughout.")

    # Range / pitch context
    if avg_hz > 0:
        if avg_hz < 130:
            parts.append("You're sitting in a low register — great for warmth, push for clarity on consonants.")
        elif avg_hz > 350:
            parts.append("You're in a high register — watch for tension; relax the jaw on the top notes.")

    # Genre-specific note
    genre_tips = {
        "Soul": "Lean into the natural vibrato — it suits soul.",
        "R&B": "Add subtle runs at phrase ends; your tone fits R&B well.",
        "Hip-Hop": "Tighten timing against the beat for a sharper pocket.",
        "Drill": "Keep the delivery flat and confident — works for drill.",
        "Pop": "Aim for clean, bright phrasing — pop rewards precision.",
    }
    if genre in genre_tips:
        parts.append(genre_tips[genre])

    if duration < 3:
        parts.append("(Short clip — record a longer take for more detailed feedback.)")

    return " ".join(parts)


# ─── Autotune / voice morphing ───────────────────────────────────────────────
_NOTE_PC = {
    "C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5,
    "F#": 6, "GB": 6, "G": 7, "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11,
}
_MAJOR = [0, 2, 4, 5, 7, 9, 11]
_MINOR = [0, 2, 3, 5, 7, 8, 10]

# Per-genre correction character: (strength_floor, snap_to_scale, retune_speed)
# strength_floor: minimum correction even if user slider is low
# snap_to_scale: snap to the key's scale (musical) vs nearest chromatic semitone
# retune_speed: 1.0 = hard/instant (robotic), lower = looser (natural)
_GENRE_PROFILE = {
    "Soul":     (0.30, False, 0.5),
    "R&B":      (0.45, False, 0.6),
    "Country":  (0.35, True,  0.5),
    "Indie":    (0.35, False, 0.5),
    "Pop":      (0.60, True,  0.8),
    "Latin":    (0.55, True,  0.7),
    "Afrobeats":(0.55, True,  0.7),
    "EDM":      (0.70, True,  0.9),
    "Hip-Hop":  (0.75, True,  0.95),
    "Drill":    (0.90, True,  1.0),
}


def _key_scale_pcs(key: Optional[str]):
    """Pitch classes (0-11) of the key's scale, or None for chromatic snapping."""
    if not key:
        return None
    k = key.strip()
    is_minor = k.endswith("m") and not k.lower().endswith("maj")
    root = k[:-1] if is_minor else k
    pc = _NOTE_PC.get(root.upper())
    if pc is None:
        return None
    steps = _MINOR if is_minor else _MAJOR
    return {(pc + s) % 12 for s in steps}


def _snap_midi(midi: float, scale_pcs):
    """Nearest MIDI note. If scale given, the in-scale note closest to `midi`."""
    if scale_pcs is None:
        return round(midi)
    base = int(round(midi))
    best, best_dist = base, 99.0
    for cand in range(base - 7, base + 8):
        if cand % 12 in scale_pcs:
            dist = abs(cand - midi)
            if dist < best_dist:
                best, best_dist = cand, dist
    return best


def apply_autotune(
    audio_bytes: bytes,
    key: Optional[str],
    intensity: int,
    genre: str,
    style: Optional[str] = None,
) -> bytes:
    """Scale-aware, frame-by-frame pitch correction (voice morphing).

    Detects pitch over time, snaps each sung note to the nearest correct note in
    the song's key, and re-tunes segment-by-segment. Genre sets the default
    character; an explicit `style` (subtle | medium | heavy) overrides it:
    subtle/natural for Soul/R&B, hard/robotic for Drill/Hip-Hop. No AI, no API.
    """
    try:
        import librosa
        import soundfile as sf

        audio_io = io.BytesIO(audio_bytes)
        try:
            y, sr = librosa.load(audio_io, sr=22050, mono=True)
        except Exception:
            return audio_bytes

        if len(y) < sr // 4:  # too short to correct meaningfully
            out = io.BytesIO(); sf.write(out, y, sr, format="WAV"); return out.getvalue()

        floor, snap_scale, _speed = _GENRE_PROFILE.get(genre, (0.5, True, 0.7))
        # Explicit style overrides the genre default character.
        style_profile = {
            "subtle": (0.30, False),
            "medium": (floor, snap_scale),
            "heavy":  (0.95, True),
        }
        if style in style_profile:
            floor, snap_scale = style_profile[style]
        strength = max(min(intensity / 100.0, 1.0), floor if intensity > 5 else 0.0)
        if strength <= 0.01:
            out = io.BytesIO(); sf.write(out, y, sr, format="WAV"); return out.getvalue()

        scale_pcs = _key_scale_pcs(key) if snap_scale else None

        hop = 512
        f0, voiced, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"),
            sr=sr, hop_length=hop,
        )
        if f0 is None or voiced is None or not np.any(voiced):
            out = io.BytesIO(); sf.write(out, y, sr, format="WAV"); return out.getvalue()

        out = y.copy()
        n = len(f0)

        # Smooth the pitch track (rolling median) before snapping — kills vibrato
        # flicker that would otherwise fragment notes into 1-frame segments.
        midi_track = librosa.hz_to_midi(f0)  # NaN where unvoiced
        win = 7
        half = win // 2
        smoothed = np.full(n, np.nan)
        for k in range(n):
            lo, hi = max(0, k - half), min(n, k + half + 1)
            window = midi_track[lo:hi]
            window = window[~np.isnan(window)]
            if len(window):
                smoothed[k] = np.median(window)

        def is_note(k):
            return voiced[k] and not np.isnan(smoothed[k])

        # Group into note segments: a maximal run of voiced frames whose pitch
        # stays put (no jump > 0.7 semitone). A vibrato'd sustained note is ONE
        # segment; a real note change starts a new one. Then snap the whole
        # segment's median pitch once — avoids per-frame target flicker.
        i = 0
        while i < n:
            if not is_note(i):
                i += 1
                continue
            j = i
            while (j + 1 < n and is_note(j + 1)
                   and abs(smoothed[j + 1] - smoothed[j]) < 0.7):
                j += 1

            s = i * hop
            e = min(len(y), (j + 1) * hop)
            if e - s >= hop:
                seg = y[s:e]
                seg_midi = smoothed[i:j + 1]
                seg_midi = seg_midi[~np.isnan(seg_midi)]
                cur_midi = float(np.median(seg_midi)) if len(seg_midi) else 0.0
                tgt = _snap_midi(cur_midi, scale_pcs)
                shift = (tgt - cur_midi) * strength
                if abs(shift) >= 0.04:
                    shifted = librosa.effects.pitch_shift(seg, sr=sr, n_steps=shift)
                    # short crossfade at edges to avoid clicks
                    xf = min(256, (e - s) // 4)
                    if xf > 0:
                        ramp = np.linspace(0, 1, xf)
                        shifted[:xf] = shifted[:xf] * ramp + seg[:xf] * (1 - ramp)
                        shifted[-xf:] = shifted[-xf:] * (1 - ramp) + seg[-xf:] * ramp
                    out[s:e] = shifted[: e - s]
            i = j + 1

        out_io = io.BytesIO()
        sf.write(out_io, out, sr, format="WAV")
        return out_io.getvalue()
    except Exception:
        return audio_bytes


def mix_audio(component_paths: List[Tuple[str, float]]) -> bytes:
    try:
        from pydub import AudioSegment

        mixed: Optional[AudioSegment] = None
        for filepath, volume in component_paths:
            if not os.path.exists(filepath):
                continue
            ext = filepath.rsplit(".", 1)[-1].lower()
            if ext == "wav":
                seg = AudioSegment.from_wav(filepath)
            elif ext in ("webm", "ogg"):
                seg = AudioSegment.from_file(filepath)
            else:
                seg = AudioSegment.from_mp3(filepath)

            db_change = 20 * np.log10(max(volume, 0.01))
            seg = seg + db_change

            if mixed is None:
                mixed = seg
            else:
                if len(seg) > len(mixed):
                    mixed = mixed + AudioSegment.silent(duration=len(seg) - len(mixed))
                mixed = mixed.overlay(seg)

        if mixed is None:
            return b""

        out = io.BytesIO()
        mixed.export(out, format="mp3", bitrate="192k")
        return out.getvalue()
    except Exception:
        return b""
