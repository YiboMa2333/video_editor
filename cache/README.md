# Cache Directory

This folder is a **placeholder** for application cache and temporary data. The actual cache location is configurable and **external to this repository** by default.

## Cache Behavior

The AI Video Editor creates and manages cache in one of these locations (in priority order):

### 1. User-Configured Path (Recommended)

Set via environment variable:
```powershell
[Environment]::SetEnvironmentVariable("AI_VIDEO_EDITOR_CACHE_DIR", "C:\path\to\cache", "User")
```

### 2. OS-Default Location

If no environment variable is set, the app uses:

- **Windows:** `%APPDATA%\ai-video-editor\cache`
  - Example: `C:\Users\YourUsername\AppData\Roaming\ai-video-editor\cache`
- **macOS:** `~/Library/Caches/ai-video-editor`
- **Linux:** `~/.cache/ai-video-editor` (or `$XDG_CACHE_HOME/ai-video-editor`)

### 3. Fallback Location

If the default cache location is not writable (permission denied, disk full, etc.), the app falls back to:

```
[repository]/cache/
```

Wait—that's this folder! But it's only used as a **last resort**.

## What Gets Cached

The cache stores:

- **Electron user data:** Preferences, window state, recent files list
- **Import cache:** Temporary video files during media import/conversion
- **Preview cache:** Frame thumbnails for timeline scrubbing
- **Converted videos:** H.264/AAC MP4 files converted from imported media (for browser-safe playback)

## Why Is This Outside the Repo?

- **Size:** Cache can grow to several GB; doesn't belong in git
- **Machine-specific:** Different machines need different cache locations
- **Not persistent:** Cache can be cleared without breaking the app
- **Permissions:** Keeping cache outside repo avoids permission issues in shared environments

## Do Not Commit Cache Files

This folder is git-ignored. Files placed here (except this README and .gitkeep) will **not** be committed:

```gitignore
/cache/**
!/cache/README.md
!/cache/.gitkeep
```

## Clearing Cache

To clear app cache, simply delete the cache directory. The app will recreate it on next launch:

```powershell
# If using the fallback:
Remove-Item -Recurse -Force 'cache/'

# Or clear the user's standard cache location:
Remove-Item -Recurse -Force "$env:APPDATA\ai-video-editor\cache"
```

## More Info

- See [tools/README.md](../tools/README.md) for tool configuration
- See [README.md](../README.md) for overall setup instructions
- See [.env.example](../.env.example) for all available environment variables

