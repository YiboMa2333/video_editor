import { useEffect, useState } from "react";
import { checkBackendHealth } from "./services/api";
import { useProjectStore } from "./store/useProjectStore";
import MediaBin from "./components/MediaBin/MediaBin";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import "./App.css";

export default function App() {
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking");
  const projectName = useProjectStore((s) => s.project.name);
  const selectedMediaId = useProjectStore((s) => s.selectedMediaId);
  const media = useProjectStore((s) => s.project.media);

  const selectedMedia = media.find((m) => m.id === selectedMediaId);

  useEffect(() => {
    checkBackendHealth().then(setBackend);
  }, []);

  return (
    <main className="app">
      <header className="topbar">
        <h1>AI Video Editor</h1>
        <div className="status">
          Backend:{" "}
          <span className={backend === "online" ? "ok" : backend === "offline" ? "bad" : ""}>
            {backend}
          </span>
        </div>
      </header>

      <section className="panel">
        <h2>Project</h2>
        <p>{projectName}</p>
      </section>

      <div style={{ display: "flex", gap: "1px", flex: 1, height: "400px", minHeight: "400px" }}>
        <div style={{ flex: 1, minWidth: "250px", overflow: "auto", borderRight: "1px solid #3e3e42" }}>
          <MediaBin />
        </div>
        <div style={{ flex: 1, minWidth: "400px" }}>
          <VideoPlayer src={selectedMedia?.path} title={selectedMedia?.name || "Video Preview"} />
        </div>
      </div>
    </main>
  );
}
