from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from database import get_db
from models import TrendCache

router = APIRouter()

_STATIC_TRENDS = [
    {
        "genre": "Hip-Hop",
        "avg_bpm": 90,
        "avg_energy": 0.75,
        "avg_danceability": 0.82,
        "avg_valence": 0.45,
        "common_keys": ["Cm", "Gm", "Fm"],
        "description": "Dark trap energy, heavy 808s, hi-hat rolls",
    },
    {
        "genre": "R&B",
        "avg_bpm": 85,
        "avg_energy": 0.55,
        "avg_danceability": 0.72,
        "avg_valence": 0.60,
        "common_keys": ["Bbm", "Fm", "Am"],
        "description": "Smooth & moody, melodic hooks, layered harmonies",
    },
    {
        "genre": "Pop",
        "avg_bpm": 120,
        "avg_energy": 0.80,
        "avg_danceability": 0.85,
        "avg_valence": 0.70,
        "common_keys": ["C", "G", "Am"],
        "description": "Bright driving beats, anthemic choruses",
    },
    {
        "genre": "Afrobeats",
        "avg_bpm": 105,
        "avg_energy": 0.78,
        "avg_danceability": 0.91,
        "avg_valence": 0.82,
        "common_keys": ["Am", "Dm", "Em"],
        "description": "Rhythmic percussion, infectious grooves, feel-good",
    },
    {
        "genre": "EDM",
        "avg_bpm": 128,
        "avg_energy": 0.92,
        "avg_danceability": 0.88,
        "avg_valence": 0.65,
        "common_keys": ["Am", "Cm", "Dm"],
        "description": "Four-on-the-floor, euphoric drops, synth leads",
    },
    {
        "genre": "Drill",
        "avg_bpm": 144,
        "avg_energy": 0.70,
        "avg_danceability": 0.76,
        "avg_valence": 0.30,
        "common_keys": ["Cm", "Fm", "Bbm"],
        "description": "Sliding 808s, dark piano loops, aggressive energy",
    },
]


@router.get("")
async def get_trends(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrendCache).order_by(desc(TrendCache.created_at)).limit(20)
    )
    cached = result.scalars().all()

    if cached:
        return {
            "trends": [
                {
                    "genre": t.genre,
                    "avg_bpm": t.avg_bpm,
                    "avg_energy": t.avg_energy,
                    "avg_danceability": t.avg_danceability,
                    "avg_valence": t.avg_valence,
                    "common_keys": t.common_keys,
                }
                for t in cached
            ],
            "source": "cache",
        }

    return {"trends": _STATIC_TRENDS, "source": "static"}
