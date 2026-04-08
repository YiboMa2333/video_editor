import { useEffect, useState } from "react";
import { checkBackendHealth } from "./services/api";
import { useProjectStore } from "./store/useProjectStore";
import MediaBin from "./components/MediaBin/MediaBin";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import Timeline from "./components/Timeline/Timeline";
import "./App.css";

export default function App() {
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking");
  const [projectDraftName, setProjectDraftName] = useState("");
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const [isResettingApp, setIsResettingApp] = useState(false);
  const projectName = useProjectStore((s) => s.project.name);
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectedMediaId = useProjectStore((s) => s.selectedMediaId);
  const media = useProjectStore((s) => s.project.media);
  const renameProject = useProjectStore((s) => s.renameProject);
  const createProject = useProjectStore((s) => s.createProject);
  const switchProject = useProjectStore((s) => s.switchProject);
  const resetProjectState = useProjectStore((s) => s.resetProjectState);

  const selectedMedia = media.find((m) => m.id === selectedMediaId);

  useEffect(() => {
    checkBackendHealth().then(setBackend);
  }, []);

  useEffect(() => {
    setProjectDraftName(projectName);
  }, [projectName]);

  useEffect(() => {
    const handleNewProject = () => {
      const suggestedName = `Project ${projects.length + 1}`;
      const newName = window.prompt("Enter new project name:", suggestedName) ?? suggestedName;
      createProject(newName.trim() || suggestedName);
      setProjectMessage(`Created ${newName.trim() || suggestedName}`);
    };

    window.addEventListener("app:new-project", handleNewProject as EventListener);
    return () => {
      window.removeEventListener("app:new-project", handleNewProject as EventListener);
    };
  }, [createProject, projects.length]);

  useEffect(() => {
    if (!projectMessage) {
      return;
    }

    const timer = window.setTimeout(() => setProjectMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [projectMessage]);

  const onCleanCache = async () => {
    const shouldReset = window.confirm(
      "This will remove converted videos and app cache, reset local project data, and reload the app. Continue?"
    );
    if (!shouldReset) {
      return;
    }

    setIsResettingApp(true);

    try {
      const report = await window.desktopAPI.clearCaches();
      resetProjectState();
      localStorage.removeItem("ai-video-editor-projects");

      if (report.failedPaths.length > 0) {
        const failedList = report.failedPaths
          .slice(0, 3)
          .map((item) => `${item.path}: ${item.error}`)
          .join("\n");
        alert(
          `Cache reset completed with ${report.failedPaths.length} warning(s).\n${failedList}`
        );
      }

      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to clean caches.");
    } finally {
      setIsResettingApp(false);
    }
  };

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
        <div className="project-name-row">
          <input
            className="project-name-input"
            value={projectDraftName}
            onChange={(event) => setProjectDraftName(event.target.value)}
            placeholder="Project name"
          />
          <button
            onClick={() => {
              const nextName = projectDraftName.trim() || "Untitled Project";
              renameProject(nextName);
              setProjectMessage(`Saved project name as ${nextName}`);
            }}
          >
            Rename
          </button>
          <button className="button-danger" onClick={onCleanCache} disabled={isResettingApp}>
            {isResettingApp ? "Cleaning..." : "Clean Cache"}
          </button>
        </div>
        {projectMessage ? <p className="project-message">{projectMessage}</p> : null}
      </section>

      <section className="panel">
        <h2>Projects</h2>

        {projects.length === 0 ? (
          <p className="muted">No projects created yet.</p>
        ) : (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  className={project.id === currentProjectId ? "project-list-item active" : "project-list-item"}
                  onClick={() => switchProject(project.id)}
                >
                  <span>{project.name}</span>
                  <span className="muted">{project.media.length} media</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="editor-layout">
        <div className="workspace-row">
          <div className="media-column">
            <MediaBin />
          </div>
          <div className="preview-column">
            <div className="preview-scroll-area">
              <VideoPlayer
                originalPath={selectedMedia?.originalPath ?? selectedMedia?.path}
                proxyPath={selectedMedia?.proxyPath}
                isProxyReady={selectedMedia?.isProxyReady}
                title={selectedMedia?.name || "Video Preview"}
              />
              <Timeline />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
