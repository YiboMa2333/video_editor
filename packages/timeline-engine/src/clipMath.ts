import { Clip } from './types';

export const getTimelineStart = (clip: Clip): number => clip.timelineStart ?? clip.timelineStartSec ?? 0;

export const getTimelineEnd = (clip: Clip): number => clip.timelineEnd ?? clip.timelineEndSec ?? getTimelineStart(clip) + Math.max(0, clip.endSec - clip.startSec);

export const getClipDuration = (clip: Clip): number => Math.max(0, getTimelineEnd(clip) - getTimelineStart(clip));

export const withClipBounds = (
    clip: Clip,
    bounds: {
        startSec: number;
        endSec: number;
        timelineStart: number;
        timelineEnd: number;
    },
): Clip => ({
    ...clip,
    startSec: bounds.startSec,
    endSec: bounds.endSec,
    timelineStart: bounds.timelineStart,
    timelineEnd: bounds.timelineEnd,
    timelineStartSec: bounds.timelineStart,
    timelineEndSec: bounds.timelineEnd,
});