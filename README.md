# AI Video Editor

Desktop AI video editor (Electron + React + TypeScript).

## 1. Install Requirements (Windows)

Install these tools first:

1. Node.js LTS (includes npm)
2. Git
3. Corepack (included with modern Node.js)

Check versions in PowerShell:

```powershell
node --version
corepack --version
git --version
```

## 2. Folder Arrangement

Use this layout:

```text
D:\AI_video_editor_project\
  ai-video-editor\
  converted-videos\
  _runtime_cache\

D:\video_editor_cache\
  @ai-video-editor\
    desktop\
```

Notes:

1. Keep the repository in `D:\AI_video_editor_project\ai-video-editor`.
2. Keep runtime/downloaded artifacts outside the repo in `D:\AI_video_editor_project\_runtime_cache`.
3. Electron app cache and imported-file working data are stored in `D:\video_editor_cache\@ai-video-editor\desktop`.
4. Compatible converted videos are written to `D:\AI_video_editor_project\converted-videos`.
5. This repository already contains `.npmrc` that points pnpm store data to `_runtime_cache`.
6. If the moved cache folder is read-only, the desktop app automatically falls back to `D:\AI_video_editor_project\_runtime_cache\desktop-user-data` so the app can still start.

## 3. First-Time Setup

Run from PowerShell:

```powershell
cd "D:\AI_video_editor_project\ai-video-editor"
corepack pnpm install
corepack pnpm approve-builds --all
corepack pnpm rebuild electron esbuild
```

Why this is required:

1. pnpm v10 blocks dependency build scripts by default.
2. Electron needs postinstall to download `electron.exe`.

## 4. Open the App

Start desktop app:

```powershell
cd "D:\AI_video_editor_project\ai-video-editor"
corepack pnpm dev:desktop
```

Expected result:

1. Vite dev server starts.
2. Electron window opens with the desktop UI.

## 5. If App Does Not Open: Reset Old Process/Terminal

Use these commands in PowerShell.

Check if old Node/Electron processes are still running:

```powershell
Get-Process node,electron -ErrorAction SilentlyContinue
```

Kill old Node/Electron processes:

```powershell
Stop-Process -Name node,electron -Force -ErrorAction SilentlyContinue
```

If you want to close the old VS Code terminal tab too, use the terminal trash-can button after stopping the process.

Optional: check if common dev ports are occupied:

```powershell
Get-NetTCPConnection -LocalPort 5173,5174 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

If needed, kill by PID (replace 12345):

```powershell
Stop-Process -Id 12345 -Force
```

Start a fresh run in a new terminal:

```powershell
cd "D:\AI_video_editor_project\ai-video-editor"
corepack pnpm dev:desktop
```

## 6. Common Issues

If `pnpm` command is not recognized:

1. Use `corepack pnpm` instead of `pnpm`.

If Electron says install failed:

```powershell
cd "D:\AI_video_editor_project\ai-video-editor"
corepack pnpm approve-builds --all
corepack pnpm rebuild electron esbuild
```

## 7. Main Repo Folders

1. `apps/desktop`: Electron desktop app
2. `docs`: architecture and planning docs
3. `packages`: shared workspace packages
4. `assets`: static resources

## License

MIT