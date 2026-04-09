# Change Log

All notable project changes are listed here.

## 2026-04-09 — mpv preview migration, editor UI integration, and Windows deployment hardening

- Reworked editor layout to remove top menu-driven workflow and keep editing actions in the main surface.
  - Removed renderer top bar usage (`File / Edit / View` in the app UI flow).
  - Added unified in-layout controls panel containing import/export access, backend state, preview mode state, and quick timeline jump actions.
  - Kept timeline toolbar and timeline logic unchanged.
- Replaced frame-only preview as primary preview mode with mpv-driven preview control.
  - Added main-process mpv service with JSON IPC command support:
    - `loadFile(path)`
    - `seek(time)`
    - `play()`
    - `pause()`
    - `stop()`
    - `setVolume(percent)`
  - Added preload bridge and renderer typings for safe `window.mpv.*` API usage.
  - Updated preview component flow to reuse existing timeline mapping state (`mapTimelineTimeToSourceTime`) so timeline/clip rendering logic remains unchanged.
  - Added seek dedupe guardrails to avoid over-spam on tiny deltas.
- Added robust Windows mpv runtime discovery and startup resilience.
  - Added executable resolution fallback order for Windows:
    - `AI_VIDEO_EDITOR_MPV_PATH` environment override
    - `D:\project_tools\mpv\mpv.exe`
    - `D:\AI_video_editor_project\_runtime_cache\tools\mpv\mpv.exe`
    - `C:\Program Files\MPV Player\mpv.exe`
    - fallback to `mpv` on PATH
  - Added startup/connect locking and retry behavior to reduce race conditions.
  - Added explicit logging for startup args, mode, IPC connection attempts, and failure paths.
  - Fixed Windows named-pipe formatting for mpv IPC (`\\.\pipe\...`).
- Implemented and iterated Windows embedding strategies.
  - Added native-handle (`--wid`) embedding path and lifecycle sync hooks (attach/update/detach host).
  - Added automatic fallback from failed embedded startup to external mode.
  - Added pseudo-embedded overlay mode (borderless mpv window pinned to preview geometry) to avoid native addons while keeping timeline integration unchanged.
  - Added owner-window move/resize tracking so overlay geometry follows preview placement.
  - Tuned preview/overlay sizing and centering so the video surface appears larger and centered in preview workflow.
- Updated playback info row and editor controls.
  - Added volume slider that sends volume updates to mpv.
  - Added comments and mode labels clarifying MVP/fallback behavior.
- Deployment/ops updates completed during this cycle.
  - Installed mpv and moved project runtime usage to Windows path strategy centered on `D:\project_tools\mpv`.
  - Set user environment fallback for app startup (`AI_VIDEO_EDITOR_MPV_PATH`) and aligned PATH usage to project-controlled location.
  - Verified desktop builds repeatedly after each major change path.

## 2026-04-09 — UI simplification and timeline UX updates

- Simplified the main editor UI to remove project-management focused sections and keep the editing-first surface.
- Removed `New Project` from the desktop `File` menu and removed related renderer/preload bridge wiring.
- Introduced a cleaner editor layout with dedicated top bar, media sidebar, preview area, playback info row, editing toolbar, and timeline section.
- Upgraded media sidebar items to show thumbnail, filename, and duration with clearer selection and add-to-timeline behavior.
- Added toolbar disabled-state logic based on editor conditions:
  - clip selection requirements for split/duplicate
  - valid range requirement for delete-range
  - clip position requirements for move-left/move-right
  - undo-history availability for undo
- Fixed timeline total-duration and time display behavior to track timeline content correctly.
- Removed separate audio lane presentation and switched timeline display/insertion flow to a single-track model for current UX goals.
- Updated import behavior so imported media does not auto-insert into timeline; insertion is explicit via user action.
- Wired delete-all media action to also clear cache usage paths and reset playback/timeline time to `00:00 / 00:00`.
- Reworked seeker/playhead interaction so seeker appears directly under the timeline lane with clearer positioning and scrub behavior.
- Added bidirectional selection sync:
  - selecting media can select its corresponding timeline clip
  - selecting timeline clip syncs media selection
  - both flows seek to clip head for faster edit targeting
- Added selected clip styling improvements for clearer active-edit context.
- Fixed boundary seek bug where jumping to a clip head could display the previous clip's end frame:
  - timeline mapping now uses ordered clip resolution with half-open intervals `[start, end)`
  - preserves end-of-sequence fallback for the final clip boundary

## 2026-04-08 — Frame viewer and thumbnail optimization

- **Refactored VideoPlayer component** (`apps/desktop/src/renderer/components/VideoPlayer/VideoPlayer.tsx`):
  - Removed HTML5 video playback and play/pause controls
  - Converted to **frame viewer mode**: displays individual frames extracted from thumbnails
  - Frame updates in real-time as user drags the timeline seeker bar
  - Synchronized with scrubbing state: shows frame at exact playhead position during drag
  - Removes VideoControls integration; simplifies component lifecycle

- **Fixed thumbnail generation I/O contention** (`apps/desktop/src/renderer/components/MediaBin/ImportButton.tsx`):
  - Issue: `enrichMediaMetadata()` and `createThumbnails()` were both accessing the video file simultaneously during fallback import
  - Solution: Call `enrichMediaMetadata()` **after** thumbnail generation completes to avoid file access conflicts
  - Ensures video duration is properly extracted and clips are created with correct metadata
  - Fallback import path now: `createLocalMediaStub()` → `createThumbnails()` → `enrichMediaMetadata()` → `importItem()`

- **Fixed second video frame display in timeline** (`apps/desktop/src/renderer/components/Timeline/TimelineClip.tsx`):
  - Issue: Timeline clips displayed incorrect frame positions for second and subsequent videos
  - Root cause: Used timeline time directly instead of mapping to clip's source time
  - Solution: Calculate source time by mapping timeline position through clip boundaries
  - Formula: `sourceTime = clip.startSec + (ratio * (clip.endSec - clip.startSec))`
  - Now correctly displays frames for all clips regardless of source media

- **Display filename instead of mediaId on timeline** (`apps/desktop/src/renderer/components/Timeline/TimelineClip.tsx`):
  - Changed clip label from `clip.mediaId` to `media?.name` for better UX
  - Users now see original video filename on tracker bars instead of UUIDs
  - Falls back to mediaId if filename unavailable

- **Adaptive frame rate for long videos** (`apps/desktop/src/main/index.ts`):
  - Added `getVideoDuration()` function using ffprobe to detect video duration
  - Added `calculateOptimalFps()` function with adaptive frame rate based on video length:
    - **≤ 5 min**: 1.0 fps (300 frames max)
    - **5-30 min**: 0.5 fps (500-900 frames)
    - **30 min to 2 hrs**: 0.2 fps (500-1440 frames, 1 frame per 5 seconds)
    - **> 2 hrs**: 0.1 fps (~720 frames, 1 frame per 10 seconds)
  - Automatically detects video duration and selects optimal fps during thumbnail generation
  - Enables efficient frame generation for videos up to 2+ hours without excessive file creation
  - Updated `createThumbnailsAsset()` to accept optional `fps` parameter (undefined triggers auto-calculation)
  - Updated IPC handler `media:createThumbnails` to use auto-calculated fps

- **Updated VideoPlayer.css**:
  - Removed styles for video element, play button, scrub preview overlay
  - Renamed `.videoViewport` to `.frameViewport`
  - Renamed `.video` to `.frame` with `object-fit: contain` for thumbnail images
  - Kept statusBanner and placeholder styles for consistency

- **Updated App.tsx**:
  - Changed VideoPlayer props from `sourcePath` to `durationSec`
  - Now passes `durationSec`, `thumbnailDir`, `thumbnailFps` to frame viewer
  - Displays frame-based preview instead of video playback

## 2026-04-08 — Scrub-thumbnail UI with timeline mapping

- Created scrub preview system enabling frame display during timeline drag
- Implemented `ScrubPreview.tsx` component showing thumbnail overlay during scrub mode
- Created `usePlayerStore.ts` Zustand store for global player state:
  - `isScrubbing`, `scrubTime`, `seekRequestTime` for drag-based scrubbing
  - `currentTime`, `duration`, `isPlaying` for playback state
  - `setIsScrubbing()`, `setScrubTime()`, `requestSeek()`, `clearSeekRequest()` actions
- Created `timelineMapping.ts` utility:
  - `mapTimelineTimeToSourceTime()` converts timeline coordinates to source media time
  - Handles clip boundaries and safe fallback for gaps
- Created `thumbnailMapping.ts` utility:
  - `getThumbnailIndex()`, `getThumbnailUrl()`, `getThumbnailSrc()` for frame lookup
- Integrated timeline seeker with scrub state:
  - `Timeline.tsx` pointer handlers update scrubTime on drag
  - `SeekerBar.tsx` new component for timeline-level seeking
  - One-shot seek on release via `seekRequestTime` effect in VideoPlayer
- Removed proxy-related code (proxyPath, isProxyReady fields) from renderer
- Added Electron IPC handler for `media:createThumbnails` to generate frames locally when backend unavailable
- Integrated desktop thumbnail generation fallback into import flow

## 2026-04-08 — Media playback compatibility fix (Chromium + fallback convert)

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

## 2026-04-08 — Video player (Task 3.3)

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
