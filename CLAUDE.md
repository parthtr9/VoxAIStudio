# CLAUDE.md — VoxAI Studio

> AI-powered music creation platform for singers and producers.
> Users create projects, use modular tools to build songs, and export a finished audio file ready to share or post.

---

## What This App Does

VoxAI Studio is a project-based music creation tool. Every session lives inside a **Project**. A project is one song in progress. Inside that project, the user has access to a full toolbox — lyrics, beats, melody, autotune, chorus, instruments — and combines those pieces into a finished song they can download and share.

The app serves two types of users simultaneously:
- **Singers** — who want lyrics, vocal coaching, autotune, and a backing track to record over
- **Producers** — who want beats, chord progressions, instrument layers, and full song structure

Both types end up in the same project workspace. The tools they use just differ.

---

## Core Concept: The Project

Everything in this app revolves around a Project. Think of it like a session in a recording studio.

```
Project
├── metadata        (title, genre, mood, BPM, key, created date)
├── lyrics          (verses, chorus, bridge — generated or manually written)
├── beat            (generated instrumental/backing track audio)
├── vocal_take      (user's recorded or uploaded vocal)
├── autotune_result (processed vocal after pitch correction)
├── final_mix       (combined vocal + beat = finished song)
└── notes           (user's own production notes)
```

A project is not linear. The user can jump to any tool at any time. They might generate a beat first, then write lyrics, then record vocals. Or they might start with lyrics and build everything else around them. The app never forces a sequence.

---

## User Flow — Step by Step

### 1. Landing / Dashboard

User lands on their dashboard. They see:
- A list of their existing projects (title, genre, last edited, status)
- A prominent **"New Project"** button
- No clutter. Clean and fast.

**Status options per project:**
- `draft` — in progress
- `mixed` — final mix generated, not yet exported
- `exported` — downloaded/shared

---

### 2. New Project Setup

When the user creates a new project they fill in a short setup form:

| Field | Type | Purpose |
|---|---|---|
| Project title | text | Name of the song |
| Genre | select | Pop, R&B, Hip-Hop, Afrobeats, Drill, Latin, Country, Soul, EDM, Indie |
| Mood | select | Sad, Hype, Romantic, Angry, Chill, Party, Spiritual, Reflective |
| BPM | number or auto | Tempo of the song (can be auto-suggested based on genre) |
| Key | select or auto | Musical key (can be auto-suggested) |
| Vocal style | select | Raw/Spoken → Melodic/Sung slider |

These settings become the **project context** — every tool inside the project uses them as defaults. The user can change them anytime.

---

### 3. Project Workspace

After setup, the user enters the **Project Workspace**. This is the main screen. It has:

**Left sidebar — Project Info**
- Project title (editable inline)
- Genre, mood, BPM, key (editable)
- Project status
- Export button (disabled until final mix exists)

**Main area — Tool Tabs**

The workspace has six tool tabs. Each tab is a self-contained module. All tabs are always available — the user can use them in any order.

```
[ Lyrics ]  [ Beat ]  [ Melody ]  [ Vocals ]  [ Instruments ]  [ Mix ]
```

---

## The Six Tools (Tabs)

### Tab 1 — Lyrics

**Purpose:** Generate, edit, and refine the song's lyrics.

**What the user can do:**
- Auto-generate full lyrics based on project genre/mood (calls AI)
- Enter a theme or topic to guide the lyrics
- Choose song structure: verse/chorus/bridge or custom
- Choose perspective: first person, second person, storytelling
- Edit any generated line directly in the UI
- Regenerate individual sections (just the chorus, just verse 2, etc.)
- See lyrics organized by section with clear labels

**Output:** Structured lyrics saved to the project. Sections are labeled and individually editable.

**System behavior:**
- Lyrics are stored as a JSON structure: `{ verse1: "", prechorus: "", chorus: "", verse2: "", bridge: "", outro: "" }`
- Each section can be independently regenerated without affecting others
- Lyrics feed into the Melody tab and the Vocals tab automatically

---

### Tab 2 — Beat

**Purpose:** Generate an instrumental backing track for the song.

**What the user can do:**
- Auto-generate a beat using the project genre, mood, BPM, and key
- Adjust beat parameters: energy level, drums on/off, bass on/off, melody layer on/off
- Choose instrument focus: piano, guitar, 808s, strings, synths, percussion, etc. (multi-select)
- Regenerate until satisfied
- Preview the beat with an audio player
- Lock the beat (prevents accidental regeneration)

**Output:** An audio file (MP3/WAV) saved to the project as `beat.mp3`. Visible in the Mix tab.

**System behavior:**
- Beat generation is offloaded to Hugging Face Inference API (MusicGen or ACE-Step)
- Request payload: `{ genre, mood, bpm, key, instruments[], energy, duration_seconds }`
- Beat is stored as a file reference in the project, not embedded in the DB
- If a beat already exists, the tab shows it with a "Regenerate" button (with confirmation)

---

### Tab 3 — Melody / Chorus

**Purpose:** Generate a singable melodic hook — the part that gets stuck in your head.

**What the user can do:**
- Generate a chorus melody based on the lyrics chorus section and project settings
- Choose chorus type: anthem/big hook, emotional/melodic, trap chorus, sing-along, pre-chorus builder
- Hear a demo vocal melody (AI-generated reference vocal showing how the melody sounds)
- See chord progression for the chorus (e.g., Am – F – C – G)
- Copy chord progression to use in production
- Generate a pre-chorus build separately

**Output:** Audio reference for the melody + chord progression text saved to project.

**System behavior:**
- Melody generation uses project's chorus lyrics as input
- Returns a reference vocal track (not the user's voice — a demo AI vocal)
- Chord progression is stored as text: `["Am", "F", "C", "G"]`
- This tab bridges the Lyrics tab and the Vocals tab — the melody is the template the user sings to

---

### Tab 4 — Vocals

**Purpose:** Record, process, and improve the user's actual voice.

This is the singer-focused tab. It has three sub-sections:

#### 4a — Record
- In-browser recording using Web Audio API (no plugins, no downloads)
- Visual waveform while recording
- Playback immediately after
- Option to re-record or keep
- Option to upload an audio file instead of recording

#### 4b — Autotune / Pitch Correction
- After recording, user clicks "Process Vocals"
- System analyzes the vocal for pitch accuracy against the project key
- Applies pitch correction tuned to the genre:
  - Subtle correction for soul/R&B (natural sound)
  - Medium correction for pop (clean, modern)
  - Heavy/robotic for trap/drill (classic autotune effect)
- User hears before/after comparison with toggle
- Pitch correction intensity slider (0–100)

#### 4c — Vocal Coaching (optional)
- AI analyzes the recording and gives plain-English feedback
- Example output: "Your verse sounds strong. The chorus tends to go flat on held notes — try supporting from your diaphragm. Your tone suits this genre well."
- This is non-blocking — user can skip this entirely

**Output:** Processed vocal audio saved as `vocal_processed.mp3` to the project.

**System behavior:**
- Raw recording stored temporarily in browser (not uploaded until user confirms)
- Processing calls backend endpoint: `POST /api/projects/:id/vocal/process`
- Payload: `{ audio_base64, genre, key, autotune_intensity, style }`
- Coaching feedback generated by sending pitch analysis data + genre to Claude API
- Processed vocal returned as audio file, stored in project

---

### Tab 5 — Instruments

**Purpose:** Add individual instrument layers on top of the beat.

**What the user can do:**
- Add specific instrument layers: lead melody, pad, counter-melody, fills
- Each instrument layer is generated separately and can be toggled on/off
- Choose instrument type and intensity per layer
- Hear each layer isolated or combined with the beat
- Remove layers they don't want

**Output:** One or more instrument audio stems saved to the project.

**System behavior:**
- Each instrument layer is a separate API call to MusicGen/ACE-Step
- Layers stored as `instrument_1.mp3`, `instrument_2.mp3`, etc.
- Mix tab handles combining them

---

### Tab 6 — Mix

**Purpose:** Combine all pieces into a single finished song.

**What the user can do:**
- See all project components with their status:
  - Beat — ✓ ready / ✗ missing
  - Vocals — ✓ ready / ✗ missing
  - Instruments — ✓ 2 layers / ✗ none
- Adjust volume levels for each component (simple sliders)
- Toggle components on/off before mixing
- Click "Generate Final Mix" to combine everything into one audio file
- Preview the full mixed song
- Download as MP3 or WAV
- Share via a generated link (unique URL per project)

**Output:** `final_mix.mp3` — the finished song.

**System behavior:**
- Mix is done server-side using pydub (Python audio library, free, no GPU needed)
- No ML inference needed for mixing — it's just audio layering with volume normalization
- Final mix stored as a file, URL stored in project record
- Share link is a public URL that serves the audio file with project metadata (title, genre)

---

## Trend Intelligence (Cross-Project Feature)

Not a tab — lives in the sidebar or a separate "Explore" section.

**What it does:**
- Shows what genres and styles are charting right now
- Displays audio feature patterns for trending songs (BPM range, energy, key, mood)
- User can click a trend and apply its settings to their current project
- Example: "R&B this week — avg 92 BPM, minor key, high danceability, low energy"

**System behavior:**
- Trend data is cached weekly — not fetched live on every request
- A background job (cron) runs once a week, pulls Billboard + Spotify data, stores in DB
- Frontend reads from cache, never directly from Spotify API
- If cache is stale, show last known data with a "Last updated X days ago" label

---

## Project States & Transitions

```
new project created
        ↓
   [ draft ]  ←──── user works on tools, saves progress
        ↓
   [ mixed ]  ←──── user generates final mix
        ↓
  [ exported ] ←─── user downloads or shares
```

Projects stay in `draft` until the user explicitly generates a final mix. They can always go back and change things and re-mix.

---

## What Gets Saved (Data Model — High Level)

### User
```
id, email, display_name, created_at
```

### Project
```
id, user_id, title, genre, mood, bpm, key, vocal_style
status (draft | mixed | exported)
lyrics (JSON)
chord_progression (JSON array)
beat_url (file path or CDN URL)
vocal_raw_url
vocal_processed_url
instrument_urls (JSON array)
final_mix_url
share_token (unique string for public sharing)
created_at, updated_at
```

### TrendCache
```
id, week_of (date), genre, avg_bpm, avg_energy, avg_danceability
avg_valence, common_keys (JSON), top_songs (JSON), created_at
```

---

## Key Design Principles

**1. Non-linear workflow**
Never force the user down a specific path. All tools are always accessible. A producer can skip the Vocals tab entirely. A singer can skip Instruments. The Mix tab handles whatever exists.

**2. Everything saves automatically**
No save button. Every edit, every generation, every recording saves to the project immediately. User never loses work.

**3. Audio is files, not database blobs**
Audio files are stored on disk or a file CDN (like Cloudflare R2 free tier or Supabase Storage free tier). The database only stores URLs/paths. This keeps the DB lightweight and fast.

**4. AI is always optional**
Every AI-generated output can be replaced with a manual upload. User can skip lyric generation and type their own. Can skip beat generation and upload their own beat. The AI tools assist — they never block.

**5. One project = one song**
Keep projects focused. No multi-song projects. Clean, simple mental model.

**6. Share-first design**
The whole point is a finished song they can post. The share/download flow should be the most satisfying moment in the app — not buried in settings.

---

## Out of Scope (For Now)

- Collaboration / multi-user projects
- In-app social feed or commenting
- DAW-level editing (EQ, compression, effects chain)
- Real-time audio streaming
- Mobile native app (web-first, but should be mobile-responsive)
- Monetization / payments

---

## Tech Stack (Lightweight)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | No build step, instant load, already built |
| Backend | Python + FastAPI | Minimal, fast, easy to deploy |
| Database | SQLite (dev) → Supabase free tier (prod) | Zero cost, no server to manage |
| File Storage | Supabase Storage or Cloudflare R2 free tier | Audio files need a CDN, not a DB |
| AI — Lyrics | Claude API | Already integrated, best quality |
| AI — Music | Hugging Face Inference API | Free tier, no GPU needed on our side |
| AI — Vocal FX | Python pydub + librosa | Runs on CPU, no GPU needed |
| Hosting — Frontend | GitHub Pages | Free, permanent, fast |
| Hosting — Backend | Render free tier or HF Spaces | Spins up on demand |
| Trend Data | Weekly cron job → SQLite cache | No live API calls during user sessions |
