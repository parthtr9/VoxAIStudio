import anthropic
import os
import json
from typing import Optional

_client = None


def get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def _strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def generate_lyrics(
    genre: str,
    mood: str,
    bpm: Optional[int],
    key: Optional[str],
    topic: Optional[str],
    structure: str,
    perspective: str,
) -> dict:
    prompt = f"""Generate complete, authentic song lyrics for a {genre} song.

Mood: {mood}
BPM: {bpm or "flexible"}
Key: {key or "flexible"}
Topic/Theme: {topic or "open — choose something emotionally resonant for this genre and mood"}
Perspective: {perspective.replace("_", " ")}

Return ONLY a JSON object with these exact keys (no markdown, no explanation):
{{
  "verse1": "...",
  "prechorus": "...",
  "chorus": "...",
  "verse2": "...",
  "bridge": "...",
  "outro": "..."
}}

Rules:
- Each section: 4–8 lines
- Chorus must be the hook — short, memorable, singable
- Bridge should shift perspective or emotional tone
- Genre-appropriate vocabulary and flow
- No placeholder text"""

    client = get_client()
    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    return json.loads(_strip_json(message.content[0].text))


async def generate_vocal_coaching(genre: str, key: Optional[str], pitch_analysis: dict) -> str:
    prompt = f"""You are an expert vocal coach. A singer just recorded a {genre} song in {key or "an unknown key"}.

Pitch analysis:
- Average pitch: {pitch_analysis.get("avg_pitch_hz", 0):.1f} Hz
- Pitch stability: {pitch_analysis.get("pitch_stability", 0):.0%}
- Voiced ratio: {pitch_analysis.get("voiced_ratio", 0):.0%}
- Duration: {pitch_analysis.get("duration_seconds", 0):.1f}s

Give 2–3 sentences of specific, encouraging coaching. Name what went well, then one clear actionable improvement. Sound like a real studio vocal coach — direct, warm, practical."""

    client = get_client()
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text.strip()


async def get_chord_progression(
    genre: str, mood: str, key: Optional[str], chorus_type: str
) -> list:
    prompt = f"""Suggest a 4-chord progression for a {chorus_type} chorus in a {genre} song.
Mood: {mood}
Key: {key or "Am"}

Return ONLY a JSON array of 4 chord symbols. Example: ["Am", "F", "C", "G"]
No explanation. Just the array."""

    client = get_client()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=80,
        messages=[{"role": "user", "content": prompt}],
    )

    return json.loads(_strip_json(message.content[0].text))
