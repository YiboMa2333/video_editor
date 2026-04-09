// This file contains the moveClip utility function for the timeline engine.

import { Clip } from './types';
import { getClipDuration, withClipBounds } from './clipMath';

export function moveClip(clip: Clip, newStart: number): Clip {
    const duration = getClipDuration(clip);

    // Ensure the new start time does not go negative
    if (newStart < 0) {
        throw new Error("New start time cannot be negative.");
    }

    return withClipBounds(clip, {
        startSec: clip.startSec,
        endSec: clip.endSec,
        timelineStart: newStart,
        timelineEnd: newStart + duration,
    });
}