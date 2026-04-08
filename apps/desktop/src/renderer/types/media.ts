export interface MediaItem {
  id: string;
  name: string;
  // Original full-quality source media. Keep this for final export.
  originalPath: string;
  // Lightweight preview/proxy media used by the editor for fast seeking.
  proxyPath?: string;
  // Backward-compatible field retained for older code paths.
  path: string;
  isProxyReady?: boolean;
  type: "video" | "audio" | "image" | "unknown";
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
  codec?: string;
}
