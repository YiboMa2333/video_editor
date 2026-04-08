import type { Clip, Track } from "../types/timeline";

export const getTimelineStart = (clip: Clip): number => {
  const withTimelineAlias = clip as Clip & { timelineStart?: number };
  return withTimelineAlias.timelineStart ?? clip.timelineStartSec ?? 0;
};

export const getTimelineEnd = (clip: Clip): number => {
  const withTimelineAlias = clip as Clip & { timelineEnd?: number; timelineEndSec?: number };

  if (typeof withTimelineAlias.timelineEnd === "number") {
    return withTimelineAlias.timelineEnd;
  }

  if (typeof withTimelineAlias.timelineEndSec === "number") {
    return withTimelineAlias.timelineEndSec;
  }

  const duration = Math.max(0, clip.endSec - clip.startSec);
  return getTimelineStart(clip) + duration;
};

export const getTimelineDuration = (tracks: Track[]): number => {
  const endTimes = tracks.flatMap((track) => track.clips.map(getTimelineEnd));
  return endTimes.length > 0 ? Math.max(...endTimes) : 0;
};