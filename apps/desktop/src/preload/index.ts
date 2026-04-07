import { contextBridge, ipcRenderer } from "electron";

console.log("Preload script loading...");

contextBridge.exposeInMainWorld("desktopAPI", {
  openMediaFile: () => ipcRenderer.invoke("dialog:openMediaFile") as Promise<string | null>,
  createPreview: (filePath: string) => ipcRenderer.invoke("media:createPreview", filePath) as Promise<string>,
  createPreviewFromBuffer: (fileName: string, bytes: Uint8Array) =>
    ipcRenderer.invoke("media:createPreviewFromBuffer", { fileName, bytes }) as Promise<string>,
});

contextBridge.exposeInMainWorld("electron", {
  onShowNewProjectDialog: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("app:show-new-project-dialog", handler);
    return () => {
      ipcRenderer.removeListener("app:show-new-project-dialog", handler);
    };
  },
});

console.log("Preload script loaded, APIs exposed");
