# AI Video Editor

A lightweight desktop video editor built with **Electron 33**, **React 18**, and **TypeScript**.

## Current Status

**v0.1.0 (Draft)** – Desktop MVP with basic video timeline editing (drag-reorder clips, trim, split, export). AI-powered features coming later.

**What's Included Now:**
- Timeline with multiple tracks (video, audio placeholders)
- Clip import, trim, split, duplicate, delete, and drag-to-reorder
- Video preview with mpv player
- Export to merged video or individual clips
- Minimal but functional UI

**Not Yet Implemented:**
- AI proxy generation / auto-editing features
- Audio track editing
- Subtitle support
- Color grading / effects

## System Requirements

### Windows (Recommended)
- Windows 10 or later (64-bit)
- Node.js LTS (20.x or newer)
- Git
- mpv player (for video preview)

### macOS/Linux
- Node.js LTS
- Git
- mpv (via Homebrew or package manager)

## Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/YiboMa2333/ai_video_editor.git
cd ai-video-editor
```

### Step 2: Install Dependencies

```powershell
# Windows (PowerShell)
corepack pnpm install
corepack pnpm approve-builds --all
corepack pnpm rebuild electron esbuild
```

```bash
# macOS/Linux
corepack pnpm install
corepack pnpm approve-builds --all
corepack pnpm rebuild electron esbuild
```

**Tip:** If you see `"pnpm: command not found"`, use `corepack pnpm` instead of `pnpm`.

### Step 3: Install External Tools

The app requires **mpv** for video preview. Install it:

**Windows (winget):**
```powershell
winget install --id shinchiro.mpv -e --accept-package-agreements --accept-source-agreements
```

**Or use our setup helper (Windows):**
```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

**macOS (Homebrew):**
```bash
brew install mpv
```

**Linux (apt):**
```bash
sudo apt-get install mpv
```

For more tool setup options, see [tools/README.md](tools/README.md).

### Step 4: Launch the App

```powershell
# Windows
corepack pnpm dev:desktop
```

```bash
# macOS / Linux
corepack pnpm dev:desktop
```

Expected output:
```
✓ Build complete in 2.5s
App window opening...
```

The desktop editor should open. If it doesn't, check the [Troubleshooting](#troubleshooting) section.

---

## Directory Structure

```
ai-video-editor/
├── apps/
│   ├── api/                    # FastAPI server (planned, not active)
│   └── desktop/                # Electron desktop app
│       ├── src/
│       │   ├── main/           # Electron main process
│       │   ├── preload/        # IPC bridge
│       │   ├── renderer/       # React UI
│       │   └── ...
│       ├── electron.vite.config.ts
│       └── package.json
├── packages/
│   └── timeline-engine/        # Shared timeline logic
├── tools/                       # External tools (mpv, python, etc.)
├── cache/                       # App cache placeholder
├── setup.ps1                    # Windows setup helper script
├── .env.example                 # Environment variables template
└── README.md                    # This file
```

---

## Configuration

### Environment Variables

All paths and tools are configurable via environment variables. Create a `.env` file in the repo root (copy from `.env.example`):

```powershell
# Windows
copy .env.example .env
# Edit .env with your preferred paths
```

**Common Variables:**

| Variable | Purpose | Default |
|---|---|---|
| `AI_VIDEO_EDITOR_CACHE_DIR` | App cache/data location | OS-specific (see below) |
| `AI_VIDEO_EDITOR_TOOLS_DIR` | Tools directory | `[repo]/tools` |
| `AI_VIDEO_EDITOR_MPV_PATH` | mpv executable path | Auto-detected |
| `AI_VIDEO_EDITOR_CONVERTED_VIDEOS_DIR` | Converted videos folder | `[parent]/converted-videos` |

**Default Cache Locations (if not configured):**

- **Windows:** `%APPDATA%\ai-video-editor\cache`
  - Example: `C:\Users\YourName\AppData\Roaming\ai-video-editor\cache`
- **macOS:** `~/Library/Caches/ai-video-editor`
- **Linux:** `~/.cache/ai-video-editor` (or `$XDG_CACHE_HOME/ai-video-editor`)

### Permanent Configuration

To set an environment variable permanently on Windows:

```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_MPV_PATH", "C:\path\to\mpv.exe", "User")
# Restart VS Code or open a new PowerShell terminal for changes to take effect
```

For macOS/Linux:
```bash
echo 'export AI_VIDEO_EDITOR_CACHE_DIR="$HOME/Videos/VideoEditorCache"' >> ~/.bashrc
source ~/.bashrc
```

---

## Usage

### Import Media
1. Click **"Add Media"** button
2. Select video/audio files (MP4, MOV, MKV, etc.)
3. Wait for conversion to MP4 (may take 30-60 seconds for large files)

### Edit Timeline
- **Drag clips** to reorder
- **Double-click clip edge** to trim
- **Right-click clip** for trim/split/delete options
- **Scroll** to zoom timeline in/out

### Playback
- Use the **seeker bar** to scrub, or
- Click **Play** button to preview

### Export
- Click **Export Merged** for a single concatenated video
- Click **Export Clips** for individual MP4 files
- Choose output folder and wait for encoding

---

## Troubleshooting

### "App Won't Open" or "Blank Window"

**Check if old processes are still running:**
```powershell
Get-Process node,electron -ErrorAction SilentlyContinue
Stop-Process -Name node,electron -Force
```

**Then restart:**
```powershell
corepack pnpm dev:desktop
```

### "mpv not found" Error

The app needs mpv for video preview.

**Install it:**
```powershell
# Windows (winget)
winget install --id shinchiro.mpv -e

# Or manually with our helper
powershell -ExecutionPolicy Bypass -File setup.ps1
```

**Or tell the app where mpv is:**
```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_MPV_PATH", "C:\path\to\mpv.exe", "User")
# Restart terminal or VS Code
```

**Or add mpv to system PATH:**
1. Search "Environment Variables" in Windows
2. Select `Path` and click **Edit**
3. Add path to mpv directory (e.g., `C:\Program Files\MPV Player`)
4. Click **OK**, restart VS Code

### "FFmpeg Binary Not Found"

FFmpeg is bundled via npm. If this error appears:

```powershell
corepack pnpm rebuild electron esbuild
corepack pnpm dev:desktop
```

### "Cache Directory Permission Denied"

The app will automatically use a fallback location if the default cache directory is not writable. Check the startup logs:

```
[paths] Cache directory not writable: [path]. Using fallback: [other path]
```

To use a custom cache path:
```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_CACHE_DIR", "D:\MyCache", "User")
```

### "pnpm: Command Not Found"

Use `corepack pnpm` instead:
```powershell
corepack pnpm install
corepack pnpm dev:desktop
```

Or set up pnpm globally:
```powershell
corepack enable
corepack use pnpm@latest
```

### Slow Startup or High CPU

First startup converts video formats, which is normal (30-60 seconds). Subsequent launches are faster.

On slower machines, consider closing other apps while using the editor.

### "Can't Resolve Import" in VS Code

For the `apps/api/` folder:

1. Ctrl+Shift+P → **Python: Select Interpreter**
2. Look for your Python 3.10+ installation
3. If none found, install Python from https://python.org

See [tools/Python.md](tools/Python.md) for detailed Python setup.

---

## Development

### Project Structure

- **packages/timeline-engine/**: Pure functions for timeline operations (moveClip, splitClip, deleteRange, etc.)
- **apps/desktop/src/main/**: Electron main process (FFmpeg, file I/O, mpv service)
- **apps/desktop/src/preload/**: IPC bridge for secure main ↔ renderer communication
- **apps/desktop/src/renderer/**: React UI components and Zustand store
- **apps/api/**: FastAPI server for AI features (future)

### Debugging

**Main Process:**
```powershell
corepack pnpm dev:desktop
# Look for console output in your terminal
```

**DevTools (Renderer)**
- In the running app window: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)

### Building for Production

```powershell
corepack pnpm build:desktop
```

Output will be in `apps/desktop/out/`.

---

## Tools & External Dependencies

The app uses several external tools. If you need to customize their locations:

### mpv (Video Player)
- Default: System PATH or `C:\Program Files\MPV Player\mpv.exe`
- Or: Place at `tools/mpv/mpv.exe` in the repo
- Or: Set `AI_VIDEO_EDITOR_MPV_PATH` environment variable

See [tools/README.md](tools/README.md) for detailed setup.

### FFmpeg (Video Encoding)
- Auto-installed via npm (`ffmpeg-static`)
- No manual setup needed

### Python (Optional, for API Server)
- Required: Python 3.10 or later
- Location: Anywhere on your system PATH
- Or: Configure via `AI_VIDEO_EDITOR_PYTHON_PATH`

See [tools/Python.md](tools/Python.md) for venv setup.

---

## Cache & Data

### Where Does the App Store Data?

- **App cache/preferences:** OS-specific cache directory (see Configuration above)
- **Converted videos:** `[parent]/converted-videos/` (or `AI_VIDEO_EDITOR_CONVERTED_VIDEOS_DIR`)
- **Thumbnails:** `runtime/cache/thumbnails/` (inside repo)
- **Timeline data:** Saved in user's project files (not yet persistent in v0.1.0)

### Clearing Cache

To start fresh:

```powershell
# Windows: Delete cache folder
Remove-Item -RecurseForce "$env:APPDATA\ai-video-editor\cache"

# Or clear fallback cache
Remove-Item -RecurseForce "cache\"
```

The app will recreate cache on next launch.

---

## Contributing

This is a personal project. Feel free to fork and extend!

**Future Goals:**
- AI-powered proxy generation
- Audio/subtitle track editing
- Color grading and effects
- Cloud storage integration

---

## License

MIT

---

## Support

- **Documentation:** See [tools/README.md](tools/README.md), [cache/README.md](cache/README.md), [tools/Python.md](tools/Python.md)
- **Setup Helper:** Run `setup.ps1` on Windows
- **Configuration:** Edit `.env` (copy from `.env.example`)

For issues, check the **Troubleshooting** section above or review the app logs in the cache directory.
