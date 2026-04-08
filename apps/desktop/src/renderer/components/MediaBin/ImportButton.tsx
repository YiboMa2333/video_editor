import {
  createBrowserMediaStub,
  createLocalMediaStub,
  enrichMediaMetadata,
  importMediaThroughBackend,
} from "../../services/api";
import { useProjectStore } from "../../store/useProjectStore";
import { useRef, useState } from "react";

export default function ImportButton() {
  const addMedia = useProjectStore((s) => s.addMedia);
  const addClipFromMedia = useProjectStore((s) => s.addClipFromMedia);
  const selectMedia = useProjectStore((s) => s.selectMedia);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importItem = (item: ReturnType<typeof createLocalMediaStub>) => {
    addMedia(item);
    addClipFromMedia(item.id);
    selectMedia(item.id);
  };

  const onBrowserFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsLoading(true);
      const item = createBrowserMediaStub(file);

      const enrichedItem = await enrichMediaMetadata(item);
      importItem(enrichedItem);
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

        // Prefer backend import so proxy generation happens in one place.
        let importedItem;
        try {
          importedItem = await importMediaThroughBackend(filePath);
          const enrichedItem = await enrichMediaMetadata(importedItem);
          importItem(enrichedItem);
        } catch {
          // Fallback: backend unavailable. Import locally and generate timeline
          // thumbnails via Electron main process so scrub-preview still works.
          importedItem = createLocalMediaStub(filePath);

          if (window.desktopAPI?.createThumbnails) {
            try {
              const thumbs = await window.desktopAPI.createThumbnails(filePath);
              if (thumbs.count > 0) {
                importedItem = {
                  ...importedItem,
                  thumbnailDir: thumbs.thumbnailDir,
                  thumbnailFps: thumbs.thumbnailFps,
                };
              }
            } catch (thumbError) {
              console.warn("Local thumbnail generation failed:", thumbError);
            }
          }

          // Call enrichMediaMetadata after thumbnail generation completes to avoid I/O conflicts.
          const enrichedItem = await enrichMediaMetadata(importedItem);
          importItem(enrichedItem);
        }
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
