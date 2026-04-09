# Tools Directory

This folder is a placeholder for external tools and dependencies that the AI Video Editor needs to run. Tools should be downloaded/installed by the user following the setup instructions in the main [README.md](../README.md).

## Structure

```
tools/
├── mpv/                    # Media player for video preview
├── python/                 # Python interpreter (optional, for API server)
├── ffmpeg/                 # FFmpeg binaries (auto-managed by npm)
└── README.md               # This file
```

## Setup Instructions by Tool

### mpv (Required for Video Preview)

The desktop app uses **mpv** as the video playback engine for the preview pane.

**Windows Installation:**

1. Download mpv from https://github.com/mpv-player/mpv.git/ or use a package manager:
   ```powershell
   winget install --id shinchiro.mpv -e --accept-package-agreements --accept-source-agreements
   ```

2. Copy the mpv executable to the repository:
   - If installed via winget or standard MSI: Copy `mpv.exe` to `tools/mpv/mpv.exe`
   - Or: Set the environment variable `AI_VIDEO_EDITOR_MPV_PATH` to point to your mpv.exe location

3. Verify installation:
   ```powershell
   tools/mpv/mpv.exe --version
   ```

**Alternative Setup Option:**

Instead of copying to `tools/mpv/`, you can add mpv to your system PATH or set an environment variable:

- **Add to PATH:** Add mpv's directory to your User/System PATH environment variable. The app will find it automatically.
- **Environment Variable:** 
  ```powershell
  [Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_MPV_PATH", "C:\path\to\mpv.exe", "User")
  ```

**Fallback Behavior:**

If mpv is not found in `tools/mpv/` or via the environment variable, the app looks for:
1. `C:\Program Files\MPV Player\mpv.exe` (standard Windows installation)
2. `mpv` on system PATH

**Migration Note (From Previous Setup):**

The old setup recommended placing mpv at `D:\project_tools\mpv\mpv.exe`. You can now place it anywhere and tell the app via the environment variable or system PATH.

---

### Python (Optional - For API Server)

The `apps/api` folder contains a FastAPI server for video processing (planned feature).

**Setup (Windows):**

1. Ensure Python 3.10+ is installed globally:
   ```powershell
   python --version
   ```

2. (Optional) Create a virtual environment in `tools/python/`:
   ```powershell
   python -m venv tools/python/venv
   tools/python/venv/Scripts/Activate.ps1
   ```

3. Install API dependencies from the repo root:
   ```powershell
   pip install -r apps/api/requirements.txt
   ```

4. Run the API server:
   ```powershell
   cd apps/api
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

**Environment Variable (Optional):**

If you want the app to use a specific Python installation:
```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_PYTHON_PATH", "C:\path\to\python.exe", "User")
```

---

### FFmpeg (Auto-Managed)

FFmpeg is automatically bundled and managed via npm (`ffmpeg-static` package). You do **not** need to install it manually.

To verify FFmpeg is available:
```powershell
corepack pnpm install
```

If you want to use a custom FFmpeg binary, place it in `tools/ffmpeg/ffmpeg.exe` and the app will detect it.

---

## Environment Variables Reference

All paths can be overridden via environment variables:

| Variable Name | Purpose | Example |
|---|---|---|
| `AI_VIDEO_EDITOR_CACHE_DIR` | App cache/user data location | `C:\custom\cache` |
| `AI_VIDEO_EDITOR_TOOLS_DIR` | Tools directory location | `C:\custom\tools` |
| `AI_VIDEO_EDITOR_MPV_PATH` | mpv executable location | `C:\apps\mpv\mpv.exe` |
| `AI_VIDEO_EDITOR_PYTHON_PATH` | Python executable location | `C:\apps\python\python.exe` |
| `AI_VIDEO_EDITOR_CONVERTED_VIDEOS_DIR` | Converted videos cache | `D:\videos\converted` |

To set an environment variable permanently on Windows:
```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_MPV_PATH", "C:\path\to\mpv.exe", "User")
```

Restart VS Code or open a new PowerShell terminal for changes to take effect.

---

## Troubleshooting

### "mpv not found" Error

If the app fails to launch video preview:

1. **Check if mpv is installed:**
   ```powershell
   where mpv
   ```

2. **If not found, install it:**
   ```powershell
   winget install --id shinchiro.mpv -e
   ```

3. **Copy to tools folder:**
   ```powershell
   Copy-Item "C:\Program Files\MPV Player\mpv.exe" -Destination "tools/mpv/mpv.exe"
   ```

4. **Or set environment variable:**
   ```powershell
   [Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_MPV_PATH", "C:\Program Files\MPV Player\mpv.exe", "User")
   ```

### FFmpeg "Binary Not Found" Error

This shouldn't happen if you ran `pnpm install`. Try:
```powershell
corepack pnpm rebuild electron esbuild
```

### Python Import Errors

If the API server won't start:
1. Verify Python is installed: `python --version`
2. Reinstall dependencies: `pip install -r apps/api/requirements.txt`
3. Use the same Python interpreter in VS Code: Ctrl+Shift+P → "Python: Select Interpreter"

---

## Notes

- **Do not commit tool binaries** to git (they're in `.gitignore`)
- **Do not commit** the `tools/*/[binaries]` directories
- This folder structure is primarily for **Windows development**
- On macOS/Linux, most tools are available via Homebrew or package managers
- The app will automatically create cache directories as needed

