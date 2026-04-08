import { useEffect, useState } from "react";
import { PlaybackInfoBar } from "./components/Controls/PlaybackInfoBar";
import MainEditorLayout from "./components/Layout/MainEditorLayout";
import TopBar from "./components/Layout/TopBar";
import MediaBin from "./components/MediaBin/MediaBin";
import Timeline from "./components/Timeline/Timeline";
import { EditorToolbar } from "./components/Timeline/EditorToolbar";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import { checkBackendHealth } from "./services/api";
import { useProjectStore } from "./store/useProjectStore";
import "./App.css";

export default function App() {
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking");
  const selectedMediaId = useProjectStore((state) => state.selectedMediaId);
  const media = useProjectStore((state) => state.project.media);

  const selectedMedia = media.find((item) => item.id === selectedMediaId);

  useEffect(() => {
    checkBackendHealth().then(setBackend);
  }, []);

  return (
    <main className="app">
      <TopBar backend={backend} />
      <MainEditorLayout
        mediaList={<MediaBin />}
        previewWindow={
          <VideoPlayer
            thumbnailDir={selectedMedia?.thumbnailDir}
            thumbnailFps={selectedMedia?.thumbnailFps}
            title={selectedMedia?.name || "Preview"}
          />
        }
        playbackInfo={<PlaybackInfoBar />}
        timelineToolbar={<EditorToolbar />}
        timeline={<Timeline />}
      />
    </main>
  );
}
