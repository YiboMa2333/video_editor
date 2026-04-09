import { Clip, SplitClipResult } from './types';
import { getClipDuration, getTimelineEnd, getTimelineStart, withClipBounds } from './clipMath';

export interface SplitClipOptions {
    createId?: () => string;
}

const defaultCreateId = () => `clip_${Math.random().toString(36).slice(2, 10)}`;

export function splitClip(
    clip: Clip,
    splitTime: number,
    options: SplitClipOptions = {},
): SplitClipResult | null {
    const timelineStart = getTimelineStart(clip);
    const timelineEnd = getTimelineEnd(clip);

    if (splitTime <= timelineStart || splitTime >= timelineEnd) {
        return null;
    }

    const timelineDuration = getClipDuration(clip);
    const sourceDuration = Math.max(0, clip.endSec - clip.startSec);

    if (timelineDuration <= 0 || sourceDuration <= 0 || timelineDuration !== sourceDuration) {
        throw new Error('Invalid clip bounds for splitClip.');
    }

    const createId = options.createId ?? defaultCreateId;
    const splitOffset = splitTime - timelineStart;
    const sourceSplitTime = clip.startSec + splitOffset;

    const left = withClipBounds({
        ...clip,
        id: createId(),
    }, {
        startSec: clip.startSec,
        endSec: sourceSplitTime,
        timelineStart,
        timelineEnd: splitTime,
    });

    const right = withClipBounds({
        ...clip,
        id: createId(),
    }, {
        startSec: sourceSplitTime,
        endSec: clip.endSec,
        timelineStart: splitTime,
        timelineEnd,
    });

    return { left, right };
}