import { Clip } from './types';
import { getTimelineEnd, getTimelineStart, withClipBounds } from './clipMath';

export interface DeleteRangeOptions {
    createId?: () => string;
}

const defaultCreateId = () => `clip_${Math.random().toString(36).slice(2, 10)}`;

export function deleteRange(
    clips: Clip[],
    start: number,
    end: number,
    options: DeleteRangeOptions = {},
): Clip[] {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return clips.map((clip) =>
            withClipBounds(clip, {
                startSec: clip.startSec,
                endSec: clip.endSec,
                timelineStart: getTimelineStart(clip),
                timelineEnd: getTimelineEnd(clip),
            }),
        );
    }

    const createId = options.createId ?? defaultCreateId;
    const deleteDuration = end - start;

    return clips.reduce<Clip[]>((acc, clip) => {
        const clipStart = getTimelineStart(clip);
        const clipEnd = getTimelineEnd(clip);

        if (clipEnd <= start) {
            acc.push(
                withClipBounds(clip, {
                    startSec: clip.startSec,
                    endSec: clip.endSec,
                    timelineStart: clipStart,
                    timelineEnd: clipEnd,
                }),
            );
            return acc;
        }

        if (clipStart >= end) {
            acc.push(
                withClipBounds(clip, {
                    startSec: clip.startSec,
                    endSec: clip.endSec,
                    timelineStart: Math.max(0, clipStart - deleteDuration),
                    timelineEnd: Math.max(0, clipEnd - deleteDuration),
                }),
            );
            return acc;
        }

        if (clipStart < start) {
            const leftSourceEnd = clip.startSec + (start - clipStart);

            if (leftSourceEnd > clip.startSec) {
                acc.push(
                    withClipBounds(clip, {
                        startSec: clip.startSec,
                        endSec: leftSourceEnd,
                        timelineStart: clipStart,
                        timelineEnd: start,
                    }),
                );
            }
        }

        if (clipEnd > end) {
            const rightSourceStart = clip.startSec + (end - clipStart);
            const rightDuration = clipEnd - end;

            if (rightDuration > 0 && clip.endSec > rightSourceStart) {
                acc.push(
                    withClipBounds(
                        {
                            ...clip,
                            id: clipStart < start ? createId() : clip.id,
                        },
                        {
                            startSec: rightSourceStart,
                            endSec: clip.endSec,
                            timelineStart: start,
                            timelineEnd: start + rightDuration,
                        },
                    ),
                );
            }
        }

        return acc;
    }, []);
}