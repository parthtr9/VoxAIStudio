from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Project
from schemas import LyricsGenerateRequest, LyricsUpdateRequest, ProjectOut
from services.claude_service import generate_lyrics

router = APIRouter()


@router.post("/{project_id}/lyrics/generate", response_model=ProjectOut)
async def generate_project_lyrics(
    project_id: str,
    req: LyricsGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    try:
        lyrics = await generate_lyrics(
            genre=project.genre,
            mood=project.mood,
            bpm=project.bpm,
            key=project.key,
            topic=req.topic,
            structure=req.structure,
            perspective=req.perspective,
        )
        project.lyrics = lyrics
        await db.commit()
        await db.refresh(project)
        return project
    except Exception as e:
        raise HTTPException(500, f"Lyrics generation failed: {e}")


@router.patch("/{project_id}/lyrics", response_model=ProjectOut)
async def save_lyrics(
    project_id: str,
    req: LyricsUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    project.lyrics = req.lyrics
    await db.commit()
    await db.refresh(project)
    return project
