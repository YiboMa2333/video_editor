import { useEffect, useState } from "react";
import { checkBackendHealth } from "./services/api";
import { useProjectStore } from "./store/useProjectStore";
import MediaBin from "./components/MediaBin/MediaBin";

export default function App() {
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking");
  const projectName = useProjectStore((s) => s.project.name);

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

      <MediaBin />
    </main>
  );
}
