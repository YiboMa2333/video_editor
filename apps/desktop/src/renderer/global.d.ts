export {};

declare global {
  interface Window {
    desktopAPI: {
      openMediaFile: () => Promise<string | null>;
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
    };
  }
}
