import { useMemo } from "react";
import ImportButton from "../MediaBin/ImportButton";
import { usePlayerStore } from "../../store/usePlayerStore";
import "./EditorControlsPanel.css";

type EditorControlsPanelProps = {
  backend: "checking" | "online" | "offline";
};

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00";
  }

  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export function EditorControlsPanel({ backend }: EditorControlsPanelProps) {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setScrubTime = usePlayerStore((state) => state.setScrubTime);
  const requestSeek = usePlayerStore((state) => state.requestSeek);

  const canJumpBackward = currentTime > 0;
  const canJumpForward = duration > 0 && currentTime < duration;

  const previewMode = useMemo(() => "mpv (external window, MVP)", []);

  const jumpBy = (deltaSec: number) => {
    const target = Math.max(0, Math.min(duration > 0 ? duration : Number.POSITIVE_INFINITY, currentTime + deltaSec));
    setCurrentTime(target);
    setScrubTime(null);
    requestSeek(target);
  };

  return (
    <section className="editor-controls-panel" aria-label="Unified editor controls">
      {/*
        MVP rationale: File/View/Edit top menus were removed to keep editing
        actions in-context. Import/Export now live directly in the editor panel.
      */}
      <div className="editor-controls-primary">
        <ImportButton />
        <button
          type="button"
          className="editor-controls-secondary"
          title="Export workflow placeholder for MVP"
          disabled
        >
          Export
        </button>
      </div>

      <div className="editor-controls-status" role="status" aria-live="polite">
        <span className="editor-controls-pill">Preview: {previewMode}</span>
        <span className={`editor-controls-pill backend-${backend}`}>Backend: {backend}</span>
      </div>

      <div className="editor-controls-view-edit" role="group" aria-label="View and edit quick actions">
        <button
          type="button"
          className="editor-controls-secondary"
          onClick={() => jumpBy(-5)}
          disabled={!canJumpBackward}
        >
          Jump -5s
        </button>
        <button
          type="button"
          className="editor-controls-secondary"
          onClick={() => jumpBy(-1)}
          disabled={!canJumpBackward}
        >
          Jump -1s
        </button>
        <button
          type="button"
          className="editor-controls-secondary"
          onClick={() => jumpBy(1)}
          disabled={!canJumpForward}
        >
          Jump +1s
        </button>
        <button
          type="button"
          className="editor-controls-secondary"
          onClick={() => jumpBy(5)}
          disabled={!canJumpForward}
        >
          Jump +5s
        </button>
        <span className="editor-controls-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </section>
  );
}
