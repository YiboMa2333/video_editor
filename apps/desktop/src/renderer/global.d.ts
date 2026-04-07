export {};

declare global {
  interface Window {
    desktopAPI: {
      openMediaFile: () => Promise<string | null>;
      createPreview: (filePath: string) => Promise<string>;
      createPreviewFromBuffer: (fileName: string, bytes: Uint8Array) => Promise<string>;
    };
    electron?: {
      onShowNewProjectDialog: (callback: () => void) => () => void;
    };
  }
}
