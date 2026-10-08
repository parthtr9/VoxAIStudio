from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ProjectCreate(BaseModel):
    title: str
    genre: str
    mood: str
    bpm: Optional[int] = None
    key: Optional[str] = None
    vocal_style: Optional[str] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    bpm: Optional[int] = None
    key: Optional[str] = None
    vocal_style: Optional[str] = None
    status: Optional[str] = None
    lyrics: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    title: str
    genre: str
    mood: str
    bpm: Optional[int] = None
    key: Optional[str] = None
    vocal_style: Optional[str] = None
    status: str
    lyrics: Optional[Dict[str, Any]] = None
    chord_progression: Optional[List[str]] = None
    beat_url: Optional[str] = None
    melody_url: Optional[str] = None
    vocal_raw_url: Optional[str] = None
    vocal_processed_url: Optional[str] = None
    instrument_urls: Optional[List[str]] = None
    final_mix_url: Optional[str] = None
    share_token: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LyricsGenerateRequest(BaseModel):
    topic: Optional[str] = None
    structure: Optional[str] = "standard"
    perspective: Optional[str] = "first_person"


class LyricsUpdateRequest(BaseModel):
    lyrics: Dict[str, str]


class BeatSaveRequest(BaseModel):
    """Beat rendered client-side (Tone.js) and uploaded as base64 WAV."""
    audio_base64: str
    energy: Optional[str] = "medium"
    instruments: Optional[List[str]] = []
    duration_seconds: Optional[int] = 30


class MelodySaveRequest(BaseModel):
    """Melody rendered client-side; chords computed client-side (Tonal.js)."""
    audio_base64: str
    chord_progression: List[str]
    chorus_type: Optional[str] = "anthem"


class VocalProcessRequest(BaseModel):
    audio_base64: str
    autotune_intensity: Optional[int] = 50
    style: Optional[str] = "medium"


class InstrumentSaveRequest(BaseModel):
    """Instrument layer rendered client-side and uploaded as base64 WAV."""
    audio_base64: str
    instrument_type: str
    intensity: Optional[str] = "medium"
    duration_seconds: Optional[int] = 30


class MixGenerateRequest(BaseModel):
    volumes: Optional[Dict[str, float]] = {}
    components: Optional[List[str]] = None
