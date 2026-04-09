export {};

declare global {
  interface Window {
    desktopAPI: {
      openMediaFile: () => Promise<string | null>;
      selectExportFolder: () => Promise<string | null>;
      createPreview: (filePath: string) => Promise<string>;
      createPreviewFromBuffer: (fileName: string, bytes: Uint8Array) => Promise<string>;
      createThumbnails: (filePath: string) => Promise<{
        thumbnailDir: string;
        thumbnailFps: number;
        count: number;
      }>;
      clearCaches: () => Promise<{
        clearedDirectories: string[];
        failedPaths: Array<{ path: string; error: string }>;
      }>;
      exportTimeline: (payload: {
        mode: "single" | "clips";
        outputDir: string;
        project: {
          name: string;
          media: Array<{ id: string; originalPath?: string; path?: string }>;
          tracks: Array<{
            kind: "video" | "audio" | "subtitle";
            clips: Array<{
              id: string;
              mediaId: string;
              startSec: number;
              endSec: number;
              timelineStart?: number;
              timelineEnd?: number;
              timelineStartSec?: number;
              timelineEndSec?: number;
            }>;
          }>;
        };
      }) => Promise<{
        mode: "single" | "clips";
        outputDir: string;
        outputs: string[];
      }>;
      cancelExport: () => Promise<{ ok: boolean; message?: string }>;
      onExportProgress: (listener: (payload: { mode: "single" | "clips"; percent: number; message: string }) => void) => () => void;
    };
    mpv: {
      getStatus: () => Promise<{
        available: boolean;
        connected: boolean;
        mode: "overlay-window" | "external-window-mvp" | "external-fallback";
        lastError: string | null;
      }>;
      attachPreviewHost: (payload: {
        bounds: { x: number; y: number; width: number; height: number };
        scaleFactor?: number;
      }) => Promise<{ ok: boolean; error?: string }>;
      updatePreviewHostBounds: (payload: {
        bounds: { x: number; y: number; width: number; height: number };
        scaleFactor?: number;
      }) => Promise<{ ok: boolean; error?: string }>;
      detachPreviewHost: () => Promise<{ ok: boolean; error?: string }>;
      loadFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
      seek: (timeSec: number) => Promise<{ ok: boolean; error?: string }>;
      play: () => Promise<{ ok: boolean; error?: string }>;
      pause: () => Promise<{ ok: boolean; error?: string }>;
      stop: () => Promise<{ ok: boolean; error?: string }>;
      setVolume: (volumePercent: number) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}
