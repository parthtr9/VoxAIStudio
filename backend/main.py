from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from database import create_tables
from routes import projects, lyrics, beat, melody, vocals, instruments, mix, trends


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    os.makedirs("uploads", exist_ok=True)
    yield


app = FastAPI(title="VoxAI Studio API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(lyrics.router, prefix="/api/projects", tags=["lyrics"])
app.include_router(beat.router, prefix="/api/projects", tags=["beat"])
app.include_router(melody.router, prefix="/api/projects", tags=["melody"])
app.include_router(vocals.router, prefix="/api/projects", tags=["vocals"])
app.include_router(instruments.router, prefix="/api/projects", tags=["instruments"])
app.include_router(mix.router, prefix="/api/projects", tags=["mix"])
app.include_router(trends.router, prefix="/api/trends", tags=["trends"])

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}
