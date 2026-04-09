import { useEffect, useMemo, useState } from "react";
import ImportButton from "../MediaBin/ImportButton";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useProjectStore } from "../../store/useProjectStore";
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
  const [isExporting, setIsExporting] = useState(false);
  const [isCancellingExport, setIsCancellingExport] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setScrubTime = usePlayerStore((state) => state.setScrubTime);
  const requestSeek = usePlayerStore((state) => state.requestSeek);
  const project = useProjectStore((state) => state.project);

  const canJumpBackward = currentTime > 0;
  const canJumpForward = duration > 0 && currentTime < duration;
  const hasExportableVideoClips = project.tracks.some(
    (track) => track.kind === "video" && track.clips.length > 0,
  );

  const previewMode = useMemo(() => "mpv (external window, MVP)", []);

  const jumpBy = (deltaSec: number) => {
    const target = Math.max(0, Math.min(duration > 0 ? duration : Number.POSITIVE_INFINITY, currentTime + deltaSec));
    setCurrentTime(target);
    setScrubTime(null);
    requestSeek(target);
  };

  const getFileName = (fullPath: string) => {
    const parts = fullPath.split(/[/\\]+/);
    return parts[parts.length - 1] || fullPath;
  };

  const formatExportResultNotice = (result: { outputDir: string; outputs: string[] }) => {
    const fileNames = result.outputs.map(getFileName);
    return `Export complete (100%). Folder: ${result.outputDir}. Files: ${fileNames.join(", ")}`;
  };

  useEffect(() => {
    const unsubscribe = window.desktopAPI.onExportProgress((progress) => {
      setExportNotice(`Exporting... ${progress.percent}%`);
    });

    return unsubscribe;
  }, []);

  const runExport = async (mode: "single" | "clips") => {
    if (!hasExportableVideoClips || isExporting) {
      return;
    }

    const outputDir = await window.desktopAPI.selectExportFolder();
    if (!outputDir) {
      setExportNotice("Export cancelled: no folder selected.");
      return;
    }

    setIsExporting(true);
    setIsCancellingExport(false);
    setExportNotice(mode === "single" ? "Exporting... 0%" : "Exporting... 0%");

    try {
      const result = await window.desktopAPI.exportTimeline({
        mode,
        outputDir,
        project: {
          name: project.name,
          media: project.media.map((item) => ({
            id: item.id,
            originalPath: item.originalPath,
            path: item.path,
          })),
          tracks: project.tracks.map((track) => ({
            kind: track.kind,
            clips: track.clips.map((clip) => ({
              id: clip.id,
              mediaId: clip.mediaId,
              startSec: clip.startSec,
              endSec: clip.endSec,
              timelineStart: clip.timelineStart,
              timelineEnd: clip.timelineEnd,
              timelineStartSec: clip.timelineStartSec,
              timelineEndSec: clip.timelineEndSec,
            })),
          })),
        },
      });

      setExportNotice(formatExportResultNotice(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/cancel/i.test(message)) {
        setExportNotice("Export cancelled.");
      } else {
        setExportNotice(`Export failed: ${message}`);
      }
    } finally {
      setIsCancellingExport(false);
      setIsExporting(false);
    }
  };

  const cancelExport = async () => {
    if (!isExporting || isCancellingExport) {
      return;
    }

    setIsCancellingExport(true);
    setExportNotice("Cancelling export...");

    try {
      const result = await window.desktopAPI.cancelExport();
      if (!result.ok && result.message) {
        setExportNotice(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportNotice(`Failed to cancel export: ${message}`);
      setIsCancellingExport(false);
    }
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
          title="Export the timeline as one merged video"
          onClick={() => void runExport("single")}
          disabled={!hasExportableVideoClips || isExporting}
        >
          Export Merged
        </button>
        <button
          type="button"
          className="editor-controls-secondary"
          title="Export each timeline clip as clip 1, clip 2, clip 3..."
          onClick={() => void runExport("clips")}
          disabled={!hasExportableVideoClips || isExporting}
        >
          Export Clips
        </button>
        {isExporting ? (
          <button
            type="button"
            className="editor-controls-secondary"
            title="Cancel the active export"
            onClick={() => void cancelExport()}
            disabled={isCancellingExport}
          >
            {isCancellingExport ? "Cancelling..." : "Cancel Export"}
          </button>
        ) : null}
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

      {exportNotice ? <div className="editor-controls-export-notice">{exportNotice}</div> : null}
    </section>
  );
}
