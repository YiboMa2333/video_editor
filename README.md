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
  _runtime_cache\
```

Notes:

1. Keep the repository in `D:\AI_video_editor_project\ai-video-editor`.
2. Keep runtime/downloaded artifacts outside the repo in `D:\AI_video_editor_project\_runtime_cache`.
3. This repository already contains `.npmrc` that points pnpm store data to `_runtime_cache`.

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

## 5. Common Issues

If `pnpm` command is not recognized:

1. Use `corepack pnpm` instead of `pnpm`.

If Electron says install failed:

```powershell
cd "D:\AI_video_editor_project\ai-video-editor"
corepack pnpm approve-builds --all
corepack pnpm rebuild electron esbuild
```

## 6. Main Repo Folders

1. `apps/desktop`: Electron desktop app
2. `docs`: architecture and planning docs
3. `packages`: shared workspace packages
4. `assets`: static resources

## License

MIT