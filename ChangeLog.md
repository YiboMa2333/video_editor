# Change Log

All notable project changes are listed here.

## 2026-04-07

- Created monorepo root folders:
  - `apps/`
  - `packages/`
  - `docs/`
  - `assets/`
  - `scripts/`
  - `.github/workflows/`
  - `runtime/`
- Created root files:
  - `README.md`
  - `.gitignore`
  - `LICENSE`
  - `package.json`
  - `pnpm-workspace.yaml`
- Created docs files:
  - `docs/architecture.md`
  - `docs/roadmap.md`
  - `docs/timeline-data-model.md`
- Configured `pnpm-workspace.yaml` with:
  - `apps/*`
  - `packages/*`

## 2026-04-07 鈥?Desktop UI scaffold (up to Task 3.3)

- Scaffolded Electron + React + TypeScript desktop app in `apps/desktop/`
- Created `apps/desktop/package.json` with electron-vite, React 18, Zustand
- Created `apps/desktop/tsconfig.json`
- Created `apps/desktop/electron.vite.config.ts`
- Created `apps/desktop/index.html`
- Created Electron main process: `src/main/main.ts`
  - BrowserWindow creation
  - IPC handler for native file-open dialog (media import)
- Created preload bridge: `src/preload/preload.ts`
  - Exposes `desktopAPI.openMediaFile()` via contextBridge
- Created renderer entry: `src/renderer/main.tsx`
- Created `src/renderer/global.d.ts` (Window type augmentation)
- Created `src/renderer/App.tsx` 鈥?top-level layout with backend health check
- Created `src/renderer/styles.css` 鈥?dark theme base styles
- Created frontend data models:
  - `types/media.ts` 鈥?MediaItem
  - `types/timeline.ts` 鈥?Clip, AudioClip, Track, Marker, AIAnnotation
  - `types/subtitle.ts` 鈥?Subtitle
  - `types/project.ts` 鈥?Project (aggregate root)
- Created Zustand store: `store/useProjectStore.ts`
  - Project state, media list, track/clip CRUD, selection
- Created `services/api.ts`
  - `checkBackendHealth()` 鈥?non-blocking backend probe
  - `createLocalMediaStub()` 鈥?builds MediaItem from file path
- Created MediaBin UI components:
  - `components/MediaBin/ImportButton.tsx`
  - `components/MediaBin/MediaBin.tsx`
- Updated root `package.json` with `dev:desktop` and `build:desktop` scripts
- Backend function code intentionally deferred

## 2026-04-07 鈥?Repo size and pushability fixes

- Moved generated/downloaded folders outside `ai-video-editor/` into `D:\AI_video_editor_project\_runtime_cache\`
  - Root dependency folder moved: `node_modules/`
  - Desktop dependency folder moved: `apps/desktop/node_modules/`
  - Desktop build output moved: `apps/desktop/out/`
- Created junction links so existing app paths still work:
  - `ai-video-editor/node_modules` -> `_runtime_cache/repo_node_modules`
  - `ai-video-editor/apps/desktop/node_modules` -> `_runtime_cache/desktop_node_modules`
  - `ai-video-editor/apps/desktop/out` -> `_runtime_cache/desktop_out`
- Added `ai-video-editor/.gitignore` to prevent generated folders from being committed
- Added `ai-video-editor/.npmrc` to store pnpm downloaded/cache data outside repo:
  - `store-dir=../_runtime_cache/.pnpm-store`
  - `virtual-store-dir=../_runtime_cache/.pnpm-virtual-store`

## 2026-04-08 鈥?Video player (Task 3.3)

- Created VideoPlayer component: `components/VideoPlayer/VideoPlayer.tsx`
  - HTML5 `<video>` element with ref-based state management
  - Displays title and placeholder when no media selected
  - Tracks: current time, duration, play/pause, volume
- Created VideoControls component: `components/VideoPlayer/VideoControls.tsx`
  - Play/Pause button
  - Time display (hh:mm:ss format)
  - Seek bar (range input with click-to-seek)
  - Volume control slider (0.0-1.0)
  - Handle end-of-video automatically
- Created `components/VideoPlayer/VideoPlayer.css`
  - Styled with dark theme matching VS Code
  - Responsive layout with flex columns
  - Custom range input styling for seek/volume
- Updated `useProjectStore.ts` to add:
  - `selectedMediaId` state field
  - `selectMedia()` action
- Updated `MediaBin.tsx` to:
  - Show selection highlighting when media is clicked
  - Call `selectMedia()` on item click
- Updated `ImportButton.tsx` to auto-select imported media
- Updated `App.tsx` to:
  - Import and render VideoPlayer component
  - Create two-column layout (MediaBin left, VideoPlayer right)
  - Pass selected media path and name to VideoPlayer
- Created `App.css` with updated layout supporting flex columns
- App builds and launches successfully with VideoPlayer functional

## 2026-04-08 鈥?Timeline UI skeleton (Task 4.1)

- Created `apps/desktop/src/renderer/components/Timeline/` folder with:
  - `Timeline.tsx` 鈥?main timeline panel; renders ordered video + audio tracks inside a scrollable `.timeline-panel`
  - `TimelineTrack.tsx` 鈥?single track row with a label column and a lane that displays clips and the playhead
  - `TimelineClip.tsx` 鈥?rectangular clip block positioned via `left %` / `width %` calculated from timeline duration
  - `Playhead.tsx` 鈥?vertical position indicator driven by `currentTimeSec` / `timelineDurationSec` props
  - `Timeline.css` 鈥?dark-theme styles: track rows, clip colours, playhead line, panel header
- Updated `apps/desktop/src/renderer/App.tsx`:
  - Imported `Timeline` and rendered it below the video preview
  - Wrapped preview + timeline in a `.preview-scroll-area` flex column to support combined scrolling
- Updated `apps/desktop/src/renderer/App.css`:
  - Added `.preview-scroll-area` with `overflow-y: auto` and `flex: 1`
- Updated `apps/desktop/src/renderer/types/timeline.ts`:
  - Added optional `timelineStart` and `timelineEnd` fields to `Clip` for explicit timeline positioning

## 2026-04-08 鈥?Map imported media to timeline clips (Task 4.2)

- Updated `apps/desktop/src/renderer/services/api.ts`:
  - Added `enrichMediaMetadata(item)` 鈥?probes an imported `MediaItem` using a hidden `<video>` / `<audio>` element to extract real `duration` and `hasAudio`, then returns an enriched copy
- Updated `apps/desktop/src/renderer/store/useProjectStore.ts`:
  - Added `addVideoClip(mediaId, durationSec)` 鈥?appends a clip to the video track, placed after the current last clip
  - Added `addAudioClip(mediaId, durationSec)` 鈥?appends a clip to the audio track
  - Added `addClipFromMedia(mediaId, durationSec, hasAudio)` 鈥?convenience action that calls both above based on `hasAudio`
  - Added internal helpers: `ensureTrack`, `buildTrack`, `appendClipToTrack`, `getTimelineTrackEnd`
- Updated `apps/desktop/src/renderer/components/MediaBin/ImportButton.tsx`:
  - After import, calls `enrichMediaMetadata()` to obtain real duration and audio flag
  - Then calls `addClipFromMedia()` to auto-populate the timeline with the imported media

## 2026-04-08 鈥?Media playback compatibility fix (Chromium + fallback convert)

- Updated `apps/desktop/src/renderer/components/MediaBin/ImportButton.tsx`:
  - Desktop import now prefers `window.desktopAPI.openMediaFile()` to keep the original local file path.
  - Browser file input remains fallback-only.
- Updated `apps/desktop/src/renderer/components/VideoPlayer/VideoPlayer.tsx`:
  - Playback logic changed to: try original source first.
  - If Chromium decode fails (`onError`) or metadata stalls (black screen / `0.00/0.00`), trigger conversion fallback once.
  - Added metadata watchdog to auto-fallback when no usable metadata is loaded.
- Updated `apps/desktop/src/main/index.ts` conversion output behavior:
  - Converted files are written to `D:\AI_video_editor_project\converted-videos`.
  - Output file name format changed to `converted_{filename}.mp4`.
  - Sanitizes filename for Windows-invalid characters.
  - Removed stale-output reuse; fallback conversion now regenerates output each time to avoid old incompatible files.
- Updated `apps/desktop/src/main/index.ts` FFmpeg fallback command to Chromium-safe MP4:

```bash
ffmpeg -i input.ext \
  -c:v libx264 \
  -profile:v baseline \
  -level 3.0 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac \
  -ar 44100 \
  -ac 2 \
  -b:a 128k \
  converted_{filename}.mp4
```

- Updated `apps/desktop/src/main/index.ts` local media transport:
  - Registered `local-media://` via `protocol.registerSchemesAsPrivileged(...)` with stream-enabled privileges.
  - This fixes custom-protocol playback handling for converted files in Electron/Chromium.
- Updated `apps/desktop/src/main/index.ts` path resolution:
  - Added repo-root discovery (instead of relying on `process.cwd()`), preventing wrong output folder resolution during dev runs.
