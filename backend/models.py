from sqlalchemy import Column, String, Integer, Float, JSON, DateTime, Text
from sqlalchemy.sql import func
import uuid

from database import Base


def _gen_id():
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_gen_id)
    user_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    genre = Column(String, nullable=False)
    mood = Column(String, nullable=False)
    bpm = Column(Integer, nullable=True)
    key = Column(String, nullable=True)
    vocal_style = Column(String, nullable=True)
    status = Column(String, default="draft")  # draft | mixed | exported

    lyrics = Column(JSON, nullable=True)
    chord_progression = Column(JSON, nullable=True)

    beat_url = Column(String, nullable=True)
    melody_url = Column(String, nullable=True)
    vocal_raw_url = Column(String, nullable=True)
    vocal_processed_url = Column(String, nullable=True)
    instrument_urls = Column(JSON, nullable=True, default=list)
    final_mix_url = Column(String, nullable=True)

    share_token = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TrendCache(Base):
    __tablename__ = "trend_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_of = Column(String, nullable=False)
    genre = Column(String, nullable=False)
    avg_bpm = Column(Float, nullable=True)
    avg_energy = Column(Float, nullable=True)
    avg_danceability = Column(Float, nullable=True)
    avg_valence = Column(Float, nullable=True)
    common_keys = Column(JSON, nullable=True)
    top_songs = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
