import ImportButton from "../MediaBin/ImportButton";
import "./TopBar.css";

interface TopBarProps {
  backend: "checking" | "online" | "offline";
}

export default function TopBar({ backend }: TopBarProps) {
  return (
    <header className="editor-topbar">
      <div className="editor-topbar-left">
        <div className="editor-brand-block">
          <p className="editor-eyebrow">Editing Workspace</p>
          <h1>AI Video Editor</h1>
        </div>

        <nav className="editor-menubar" aria-label="Editor menus">
          <button type="button" className="editor-menu-button">
            File
          </button>
          <button type="button" className="editor-menu-button">
            Edit
          </button>
          <button type="button" className="editor-menu-button">
            View
          </button>
        </nav>
      </div>

      <div className="editor-topbar-right">
        <div className="editor-topbar-actions">
          <ImportButton />
          <button type="button" className="topbar-secondary-button" disabled>
            Export
          </button>
        </div>

        <span className={`backend-badge backend-${backend}`}>
          Backend {backend}
        </span>
      </div>
    </header>
  );
}