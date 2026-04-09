import { Clip } from './types';
import { getClipDuration, getTimelineEnd, withClipBounds } from './clipMath';

export interface DuplicateClipOptions {
    createId?: () => string;
    timelineStart?: number;
}

const defaultCreateId = () => `clip_${Math.random().toString(36).slice(2, 10)}`;

export function duplicateClip(clip: Clip, options: DuplicateClipOptions = {}): Clip {
    const duration = getClipDuration(clip);

    if (duration <= 0) {
        throw new Error('Cannot duplicate a clip with zero duration.');
    }

    const timelineStart = Math.max(0, options.timelineStart ?? getTimelineEnd(clip));
    const createId = options.createId ?? defaultCreateId;

    return withClipBounds(
        {
            ...clip,
            id: createId(),
        },
        {
            startSec: clip.startSec,
            endSec: clip.endSec,
            timelineStart,
            timelineEnd: timelineStart + duration,
        },
    );
}