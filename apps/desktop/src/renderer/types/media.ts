export interface MediaItem {
  id: string;
  name: string;
  path: string;
  type: "video" | "audio" | "image" | "unknown";
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
  codec?: string;
}
