from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from database import get_db
from models import Project
from schemas import MixGenerateRequest, ProjectOut
from services.audio_service import mix_audio, save_audio_bytes, url_to_path

router = APIRouter()


@router.post("/{project_id}/mix/generate", response_model=ProjectOut)
async def generate_mix(
    project_id: str,
    req: MixGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    volumes = req.volumes or {}
    components = []

    if project.beat_url:
        components.append((url_to_path(project.beat_url), volumes.get("beat", 1.0)))

    vocal_url = project.vocal_processed_url or project.vocal_raw_url
    if vocal_url:
        components.append((url_to_path(vocal_url), volumes.get("vocal", 0.9)))

    for i, inst_url in enumerate(project.instrument_urls or []):
        components.append((url_to_path(inst_url), volumes.get(f"instrument_{i}", 0.7)))

    if not components:
        raise HTTPException(400, "No audio components to mix")

    try:
        mixed_bytes = mix_audio(components)
        if not mixed_bytes:
            raise HTTPException(500, "Mix produced no output")

        filename = f"final_mix_{project_id}_{uuid.uuid4().hex[:8]}.mp3"
        project.final_mix_url = save_audio_bytes(mixed_bytes, filename=filename)
        project.status = "mixed"

        await db.commit()
        await db.refresh(project)
        return project
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Mix failed: {e}")
