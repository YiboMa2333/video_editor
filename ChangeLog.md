# Change Log

Canonical project history now lives in `D:\AI_video_editor_project\ChangeLog.md`.

This file is intentionally kept as a pointer so changelog updates stay in one place.

## 2026-04-10 - Timeline drag reorder preview and seeker interaction updates

- Updated timeline drag-to-move to use threshold-based reordering preview:
	- While dragging right, when the dragged clip tail passes the center of right neighbor clips, those clips preview-shift left.
	- While dragging left, when the dragged clip head passes the center of left neighbor clips, those clips preview-shift right.
	- Real clip arrangement is now committed only on pointer release.
- Added track-level reorder commit logic in project store:
	- Added `reorderClipInTrack(trackId, clipId, targetIndex)`.
	- Added timeline packing helper so reordered clips are laid out contiguously without leftover blank gaps.
- Updated timeline clip click behavior:
	- Clicking a clip in timeline now only updates selection.
	- Timeline click no longer forces seeker/playhead jump to clip head.
	- Clip-head seek remains in media-list clip click flow.
- Updated timeline seeker behavior:
	- While scrubbing with seeker bar, entering a clip range auto-selects that clip and its track/media context.
	- Leaving clip ranges clears clip/track selection.
- Added quick jump controls:
	- Added `Jump -1s` and `Jump +1s` buttons alongside existing `Jump -5s` and `Jump +5s` controls.

## 2026-04-10 - Preview reactivation controls and overlay UX polish

- Updated preview window recovery flow with explicit reactivation:
	- Added `Reactivate mpv player` button in preview panel.
	- Reactivation reattaches preview host, reloads active media, seeks to mapped timeline/source time, and reapplies play/pause state.
	- Added `isReactivating` guard and improved status messaging for user guidance.
- Refactored preview host payload calculation into reusable helper:
	- Shared geometry computation used for both attach and bounds updates.
	- Keeps pseudo-embedded overlay centered and sized for preview viewport.
- Added preview action-row/button styling and disabled/hover states for reactivation control.
