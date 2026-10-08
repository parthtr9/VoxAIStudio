from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from database import get_db
from models import Project
from schemas import MelodySaveRequest, ProjectOut
from services.audio_service import save_base64_audio_as

router = APIRouter()


@router.post("/{project_id}/melody", response_model=ProjectOut)
async def save_project_melody(
    project_id: str,
    req: MelodySaveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Store a melody rendered client-side. Chords computed client-side (Tonal.js)."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    try:
        filename = f"melody_{project_id}_{uuid.uuid4().hex[:8]}.wav"
        project.melody_url = save_base64_audio_as(req.audio_base64, filename)
        project.chord_progression = req.chord_progression
        await db.commit()
        await db.refresh(project)
        return project
    except Exception as e:
        raise HTTPException(500, f"Melody save failed: {e}")
