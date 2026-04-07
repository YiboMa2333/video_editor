import { useEffect, useState } from "react";
import { checkBackendHealth } from "./services/api";
import { useProjectStore } from "./store/useProjectStore";
import MediaBin from "./components/MediaBin/MediaBin";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import "./App.css";

export default function App() {
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking");
  const [projectDraftName, setProjectDraftName] = useState("");
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const projectName = useProjectStore((s) => s.project.name);
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectedMediaId = useProjectStore((s) => s.selectedMediaId);
  const media = useProjectStore((s) => s.project.media);
  const renameProject = useProjectStore((s) => s.renameProject);
  const createProject = useProjectStore((s) => s.createProject);
  const switchProject = useProjectStore((s) => s.switchProject);

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
