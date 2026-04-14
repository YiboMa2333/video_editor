import type { Clip, Track } from "../types/timeline";
import type { AIAction, AIInstructionSet } from "../types/aiInstructions";
import type { Project } from "../types/project";
import {
  deleteRange as deleteTimelineRange,
  duplicateClip as duplicateTimelineClip,
  moveClip as moveTimelineClip,
  splitClip as splitTimelineClip,
} from "../../../../../packages/timeline-engine/src";

const VIDEO_TRACK_ID = "track-video-main";

const syncClipAliases = (clip: Clip): Clip => ({
  ...clip,
  timelineStartSec: clip.timelineStart,
  timelineEndSec: clip.timelineEnd,
});

const packClipsFromZero = (clips: Clip[]): Clip[] => {
  const packed: Clip[] = [];
  let cursor = 0;

  for (const clip of clips) {
    const duration = Math.max(0, clip.timelineEnd - clip.timelineStart);
    const moved = syncClipAliases(moveTimelineClip(clip, cursor));
    packed.push(moved);
    cursor += duration;
  }

  return packed;
};

export interface ExecutionResult {
  project: Project;
  appliedCount: number;
  errors: string[];
}

function findTrackAndClip(tracks: Track[], clipId: string): { track: Track; clip: Clip; clipIndex: number } | null {
  for (const track of tracks) {
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex >= 0) {
      return { track, clip: track.clips[clipIndex], clipIndex };
    }
  }
  return null;
}

function applyAction(
  tracks: Track[],
  action: AIAction,
  actionIndex: number,
): { tracks: Track[]; error?: string } {
  switch (action.type) {
    case "splitClip": {
      const found = findTrackAndClip(tracks, action.clipId);
      if (!found) {
        return { tracks, error: `actions[${actionIndex}]: clip "${action.clipId}" not found.` };
      }

      const result = splitTimelineClip(found.clip, action.splitTime, {
        createId: () => crypto.randomUUID(),
      });

      if (!result) {
        return { tracks, error: `actions[${actionIndex}]: splitTime ${action.splitTime} is outside clip bounds.` };
      }

      return {
        tracks: tracks.map((track) => {
          if (track.id !== found.track.id) return track;
          const clips = [...track.clips];
          clips.splice(found.clipIndex, 1, syncClipAliases(result.left), syncClipAliases(result.right));
          return { ...track, clips };
        }),
      };
    }

    case "deleteRange": {
      return {
        tracks: tracks.map((track) => ({
          ...track,
          clips: deleteTimelineRange(track.clips, action.start, action.end, {
            createId: () => crypto.randomUUID(),
          }).map(syncClipAliases),
        })),
      };
    }

    case "duplicateClip": {
      const found = findTrackAndClip(tracks, action.clipId);
      if (!found) {
        return { tracks, error: `actions[${actionIndex}]: clip "${action.clipId}" not found.` };
      }

      const duplicate = syncClipAliases(
        duplicateTimelineClip(found.clip, {
          createId: () => crypto.randomUUID(),
        }),
      );

      return {
        tracks: tracks.map((track) => {
          if (track.id !== found.track.id) return track;
          const clips = [...track.clips];
          clips.splice(found.clipIndex + 1, 0, duplicate);
          // Re-pack to avoid overlaps
          return { ...track, clips: packClipsFromZero(clips) };
        }),
      };
    }

    case "moveClip": {
      const found = findTrackAndClip(tracks, action.clipId);
      if (!found) {
        return { tracks, error: `actions[${actionIndex}]: clip "${action.clipId}" not found.` };
      }

      return {
        tracks: tracks.map((track) => {
          if (track.id !== found.track.id) return track;
          const sorted = [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart);
          const currentIndex = sorted.findIndex((c) => c.id === action.clipId);
          if (currentIndex < 0) return track;

          const withoutClip = sorted.filter((c) => c.id !== action.clipId);
          const targetIdx = action.targetIndex === "end"
            ? withoutClip.length
            : Math.min(withoutClip.length, Math.max(0, action.targetIndex));

          const reordered = [...withoutClip];
          reordered.splice(targetIdx, 0, sorted[currentIndex]);

          return { ...track, clips: packClipsFromZero(reordered) };
        }),
      };
    }

    default:
      return { tracks, error: `actions[${actionIndex}]: unsupported action type.` };
  }
}

export function executeAIInstructions(
  project: Project,
  instructions: AIInstructionSet,
): ExecutionResult {
  let currentTracks = project.tracks;
  let appliedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < instructions.actions.length; i++) {
    const action = instructions.actions[i];
    const result = applyAction(currentTracks, action, i);

    if (result.error) {
      errors.push(result.error);
    } else {
      appliedCount++;
    }

    currentTracks = result.tracks;
  }

  const updatedProject: Project = {
    ...project,
    tracks: currentTracks,
    updatedAt: new Date().toISOString(),
  };

  return { project: updatedProject, appliedCount, errors };
}
