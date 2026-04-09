// This file exports TypeScript types and interfaces used throughout the utility functions.

export interface Clip {
    id: string;
    mediaId: string;
    startSec: number;
    endSec: number;
    timelineStart: number;
    timelineEnd: number;
    timelineStartSec?: number;
    timelineEndSec?: number;
}

export interface SplitClipResult {
    left: Clip;
    right: Clip;
}

export interface ClipData {
    clips: Clip[];
}