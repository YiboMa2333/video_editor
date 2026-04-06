import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopAPI", {
  openMediaFile: () => ipcRenderer.invoke("dialog:openMediaFile") as Promise<string | null>,
});
