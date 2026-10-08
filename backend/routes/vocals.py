from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from database import get_db
from models import Project
from schemas import VocalProcessRequest
from services.audio_service import (
    save_base64_audio,
    analyze_pitch,
    apply_autotune,
    save_audio_bytes,
    generate_coaching,
)

router = APIRouter()


@router.post("/{project_id}/vocal/process")
async def process_vocal(
    project_id: str,
    req: VocalProcessRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    raw_url, audio_bytes = save_base64_audio(req.audio_base64, ext="webm")
    project.vocal_raw_url = raw_url

    pitch_data = analyze_pitch(audio_bytes, project.key)

    processed_bytes = apply_autotune(
        audio_bytes, project.key, req.autotune_intensity, project.genre, req.style
    )
    proc_filename = f"vocal_proc_{project_id}_{uuid.uuid4().hex[:8]}.wav"
    project.vocal_processed_url = save_audio_bytes(processed_bytes, filename=proc_filename, ext="wav")

    coaching = generate_coaching(project.genre, project.key, pitch_data)

    await db.commit()
    await db.refresh(project)

    return {
        "vocal_raw_url": project.vocal_raw_url,
        "vocal_processed_url": project.vocal_processed_url,
        "pitch_analysis": pitch_data,
        "coaching": coaching,
    }
