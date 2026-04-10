import { useEffect, useState } from "react";
import { EditorControlsPanel, PlaybackInfoBar } from "./components/Controls";
import MainEditorLayout from "./components/Layout/MainEditorLayout";
import MediaBin from "./components/MediaBin/MediaBin";
import { PreviewWindow } from "./components/Preview/PreviewWindow";
import Timeline from "./components/Timeline/Timeline";
import { EditorToolbar } from "./components/Timeline/EditorToolbar";
import { AIEditorPanel } from "./components/AI/AIEditorPanel";
import { checkBackendHealth } from "./services/api";
import "./App.css";

export default function App() {
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    checkBackendHealth().then(setBackend);
  }, []);

  return (
    <main className="app">
      <MainEditorLayout
        mediaList={<MediaBin />}
        previewWindow={<PreviewWindow />}
        playbackInfo={<PlaybackInfoBar />}
        editorControls={<EditorControlsPanel backend={backend} />}
        timelineToolbar={<EditorToolbar />}
        timeline={<Timeline />}
      />
      <AIEditorPanel />
    </main>
  );
}
