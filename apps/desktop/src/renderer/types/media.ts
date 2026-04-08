export interface MediaItem {
  id: string;
  name: string;
  // Original source media path used for preview and final export.
  originalPath: string;
  thumbnailDir?: string;
  thumbnailFps?: number;
  // Backward-compatible alias retained for older code paths.
  path: string;
  type: "video" | "audio" | "image" | "unknown";
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
  codec?: string;
}
