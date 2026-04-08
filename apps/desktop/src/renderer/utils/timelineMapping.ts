import type { Clip } from "../types/timeline";

export type TimelineResolution = {
  /** The clip that contains the requested timeline time. */
  clip: Clip | null;
  /**
   * The corresponding time inside the source media file.
   *
   * Formula: clip.startSec + (timelineTimeSec - timelineStart)
   *
   * - clip.startSec    → where this clip segment begins in the source file
   * - timelineTimeSec  → where the playhead is on the timeline
   * - timelineStart    → where this clip begins on the timeline
   */
  sourceTimeSec: number;
};

const getClipTimelineStart = (clip: Clip): number => {
  const withAlias = clip as Clip & { timelineStart?: number };
  return Number.isFinite(withAlias.timelineStart)
    ? (withAlias.timelineStart as number)
    : clip.timelineStartSec ?? 0;
};

const getClipTimelineEnd = (clip: Clip): number => {
  const withAlias = clip as Clip & { timelineEnd?: number };
  if (Number.isFinite(withAlias.timelineEnd)) {
    return withAlias.timelineEnd as number;
  }

  if (Number.isFinite(clip.timelineEndSec)) {
    return clip.timelineEndSec as number;
  }

  return getClipTimelineStart(clip) + Math.max(0, clip.endSec - clip.startSec);
};

/**
 * Map a timeline playhead position to the matching source-file timestamp.
 *
 * Returns null when no clip covers the given timeline time (a gap).
 * Logs the mapping or the miss so debugging is possible without guessing.
 */
export function resolveSourceTime(
  timelineTimeSec: number,
  clips: readonly Clip[],
  getTimelineStart: (clip: Clip) => number,
  getTimelineEnd: (clip: Clip) => number,
): TimelineResolution | null {
  if (!Number.isFinite(timelineTimeSec)) {
    console.warn("[timelineMapping] resolveSourceTime: timelineTimeSec is not finite", {
      timelineTimeSec,
    });
    return null;
  }

  const activeClip = clips.find((clip) => {
    const start = getTimelineStart(clip);
    const end = getTimelineEnd(clip);
    return timelineTimeSec >= start && timelineTimeSec <= end;
  });

  if (!activeClip) {
    // Not an error — the playhead may be in a gap between clips.
    console.debug("[timelineMapping] no clip at timeline time", { timelineTimeSec });
    return null;
  }

  const timelineStart = getTimelineStart(activeClip);
  const timelineEnd = getTimelineEnd(activeClip);
  const offset = timelineTimeSec - timelineStart;

  // Clamp offset to the clip's duration so sourceTimeSec never exceeds endSec.
  const clipDuration = Math.max(0, activeClip.endSec - activeClip.startSec);
  const clampedOffset = Math.min(Math.max(0, offset), clipDuration);
  const sourceTimeSec = activeClip.startSec + clampedOffset;

  console.debug("[timelineMapping] timeline→source", {
    clipId: activeClip.id,
    timelineTimeSec,
    timelineStart,
    timelineEnd,
    clipStartSec: activeClip.startSec,
    clipEndSec: activeClip.endSec,
    offset,
    clampedOffset,
    sourceTimeSec,
  });

  return { clip: activeClip, sourceTimeSec };
}

/**
 * Timeline time is the editor source of truth. This helper maps timeline time
 * to source media time for the active clip.
 *
 * sourceTime = clip.startSec + (timelineTime - clip.timelineStart)
 */
export function mapTimelineTimeToSourceTime(
  timelineTimeSec: number,
  clips: readonly Clip[],
): TimelineResolution {
  const safeTimelineTime = Number.isFinite(timelineTimeSec) ? Math.max(0, timelineTimeSec) : 0;

  if (!Number.isFinite(timelineTimeSec)) {
    console.warn("[timelineMapping] mapTimelineTimeToSourceTime: invalid timeline time", {
      timelineTimeSec,
    });
  }

  const activeClip = clips.find((clip) => {
    const start = getClipTimelineStart(clip);
    const end = getClipTimelineEnd(clip);
    return safeTimelineTime >= start && safeTimelineTime <= end;
  });

  if (!activeClip) {
    // Safe fallback: no clip at this timeline position (gap). We return the
    // timeline time itself so the caller can still seek consistently.
    console.warn("[timelineMapping] no active clip for timeline time", {
      timelineTimeSec: safeTimelineTime,
      clipCount: clips.length,
    });
    return {
      clip: null,
      sourceTimeSec: safeTimelineTime,
    };
  }

  const timelineStart = getClipTimelineStart(activeClip);
  const timelineEnd = getClipTimelineEnd(activeClip);
  const rawSourceTime = activeClip.startSec + (safeTimelineTime - timelineStart);
  const sourceTimeSec = Math.min(Math.max(activeClip.startSec, rawSourceTime), activeClip.endSec);

  console.debug("[timelineMapping] mapTimelineTimeToSourceTime", {
    clipId: activeClip.id,
    timelineTimeSec: safeTimelineTime,
    timelineStart,
    timelineEnd,
    sourceStart: activeClip.startSec,
    sourceEnd: activeClip.endSec,
    sourceTimeSec,
  });

  return {
    clip: activeClip,
    sourceTimeSec,
  };
}
