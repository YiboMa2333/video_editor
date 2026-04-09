import { contextBridge, ipcRenderer } from "electron";

console.log("Preload script loading...");

contextBridge.exposeInMainWorld("desktopAPI", {
  openMediaFile: () => ipcRenderer.invoke("dialog:openMediaFile") as Promise<string | null>,
  createPreview: (filePath: string) => ipcRenderer.invoke("media:createPreview", filePath) as Promise<string>,
  createPreviewFromBuffer: (fileName: string, bytes: Uint8Array) =>
    ipcRenderer.invoke("media:createPreviewFromBuffer", { fileName, bytes }) as Promise<string>,
  createThumbnails: (filePath: string) =>
    ipcRenderer.invoke("media:createThumbnails", filePath) as Promise<{
      thumbnailDir: string;
      thumbnailFps: number;
      count: number;
    }>,
  clearCaches: () =>
    ipcRenderer.invoke("app:clearCaches") as Promise<{
      clearedDirectories: string[];
      failedPaths: Array<{ path: string; error: string }>;
    }>,
});

contextBridge.exposeInMainWorld("mpv", {
  getStatus: () =>
    ipcRenderer.invoke("mpv:status") as Promise<{
      available: boolean;
      connected: boolean;
      mode: "overlay-window" | "external-window-mvp" | "external-fallback";
      lastError: string | null;
    }>,
  attachPreviewHost: (payload: {
    bounds: { x: number; y: number; width: number; height: number };
    scaleFactor?: number;
  }) =>
    ipcRenderer.invoke("mpv:attachPreviewHost", payload) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  updatePreviewHostBounds: (payload: {
    bounds: { x: number; y: number; width: number; height: number };
    scaleFactor?: number;
  }) =>
    ipcRenderer.invoke("mpv:updatePreviewHostBounds", payload) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  detachPreviewHost: () =>
    ipcRenderer.invoke("mpv:detachPreviewHost") as Promise<{ ok: boolean; error?: string }>,
  loadFile: (filePath: string) =>
    ipcRenderer.invoke("mpv:loadFile", filePath) as Promise<{ ok: boolean; error?: string }>,
  seek: (timeSec: number) =>
    ipcRenderer.invoke("mpv:seek", timeSec) as Promise<{ ok: boolean; error?: string }>,
  play: () => ipcRenderer.invoke("mpv:play") as Promise<{ ok: boolean; error?: string }>,
  pause: () => ipcRenderer.invoke("mpv:pause") as Promise<{ ok: boolean; error?: string }>,
  stop: () => ipcRenderer.invoke("mpv:stop") as Promise<{ ok: boolean; error?: string }>,
  setVolume: (volumePercent: number) =>
    ipcRenderer.invoke("mpv:setVolume", volumePercent) as Promise<{ ok: boolean; error?: string }>,
});

console.log("Preload script loaded, APIs exposed");
