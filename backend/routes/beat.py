from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from database import get_db
from models import Project
from schemas import BeatSaveRequest, ProjectOut
from services.audio_service import save_base64_audio_as

router = APIRouter()


@router.post("/{project_id}/beat", response_model=ProjectOut)
async def save_project_beat(
    project_id: str,
    req: BeatSaveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Store a beat rendered client-side with Tone.js. No external AI call."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    try:
        filename = f"beat_{project_id}_{uuid.uuid4().hex[:8]}.wav"
        project.beat_url = save_base64_audio_as(req.audio_base64, filename)
        await db.commit()
        await db.refresh(project)
        return project
    except Exception as e:
        raise HTTPException(500, f"Beat save failed: {e}")
