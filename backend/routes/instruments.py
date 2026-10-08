from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from database import get_db
from models import Project
from schemas import InstrumentSaveRequest, ProjectOut
from services.audio_service import save_base64_audio_as

router = APIRouter()


@router.post("/{project_id}/instruments", response_model=ProjectOut)
async def add_instrument(
    project_id: str,
    req: InstrumentSaveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Store an instrument layer rendered client-side with Tone.js."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    try:
        filename = f"instrument_{project_id}_{uuid.uuid4().hex[:8]}.wav"
        url = save_base64_audio_as(req.audio_base64, filename)

        urls = list(project.instrument_urls or [])
        urls.append(url)
        project.instrument_urls = urls

        await db.commit()
        await db.refresh(project)
        return project
    except Exception as e:
        raise HTTPException(500, f"Instrument save failed: {e}")


@router.delete("/{project_id}/instruments/{index}", response_model=ProjectOut)
async def remove_instrument(
    project_id: str,
    index: int,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    urls = list(project.instrument_urls or [])
    if index < 0 or index >= len(urls):
        raise HTTPException(400, "Invalid instrument index")

    urls.pop(index)
    project.instrument_urls = urls
    await db.commit()
    await db.refresh(project)
    return project
