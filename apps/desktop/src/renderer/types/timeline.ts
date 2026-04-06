export interface Clip {
  id: string;
  mediaId: string;
  startSec: number;
  endSec: number;
  timelineStartSec: number;
}

export interface AudioClip extends Clip {
  gainDb?: number;
}

export interface Track {
  id: string;
  name: string;
  kind: "video" | "audio" | "subtitle";
  clips: Clip[];
}

export interface Marker {
  id: string;
  timeSec: number;
  label?: string;
}

export interface AIAnnotation {
  id: string;
  timeStartSec: number;
  timeEndSec: number;
  type: "scene" | "object" | "speech" | "custom";
  payload?: Record<string, unknown>;
}
