import { createBrowserMediaStub, createLocalMediaStub } from "../../services/api";
import { useProjectStore } from "../../store/useProjectStore";
import { useRef, useState } from "react";

export default function ImportButton() {
  const addMedia = useProjectStore((s) => s.addMedia);
  const selectMedia = useProjectStore((s) => s.selectMedia);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importItem = (item: ReturnType<typeof createLocalMediaStub>) => {
    addMedia(item);
    selectMedia(item.id);
  };

  const onBrowserFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsLoading(true);
      let item = createBrowserMediaStub(file);

      if (item.type === "video" && window.desktopAPI?.createPreviewFromBuffer) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const previewPath = await window.desktopAPI.createPreviewFromBuffer(file.name, bytes);
        item = {
          ...item,
          path: previewPath,
        };
      }

      importItem(item);
    } catch (error) {
      console.error("Import failed:", error);
      alert(error instanceof Error ? error.message : "Failed to import media.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  const onImport = async () => {
    if (window.desktopAPI?.openMediaFile) {
      try {
        setIsLoading(true);
        const filePath = await window.desktopAPI.openMediaFile();
        if (!filePath) {
          return;
        }

        importItem(createLocalMediaStub(filePath));
        return;
      } finally {
        setIsLoading(false);
      }
    }

    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        onChange={onBrowserFileChange}
        style={{ display: "none" }}
      />
      <button onClick={onImport} disabled={isLoading}>
        {isLoading ? "Importing..." : "Import Media"}
      </button>
    </>
  );
}
