import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAIStore } from "../../store/useAIStore";
import "./TimelineToolbar.css";

type ToolbarAction = {
  label: string;
  disabled: boolean;
  hint: string;
  onClick: () => void;
};

export function EditorToolbar() {
  const MIN_AI_PERIOD_SEC = 10;
  const [rangeNotice, setRangeNotice] = useState<string | null>(null);
  const tracks = useProjectStore((state) => state.project.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const selectedRangeStartSec = useProjectStore((state) => state.selectedRangeStartSec);
  const selectedRangeEndSec = useProjectStore((state) => state.selectedRangeEndSec);
  const setSelectedRange = useProjectStore((state) => state.setSelectedRange);
  const clearSelectedRange = useProjectStore((state) => state.clearSelectedRange);
  const splitSelectedClip = useProjectStore((state) => state.splitSelectedClip);
  const deleteSelectedRange = useProjectStore((state) => state.deleteSelectedRange);
  const deleteSelectedClip = useProjectStore((state) => state.deleteSelectedClip);
  const duplicateSelectedClip = useProjectStore((state) => state.duplicateSelectedClip);
  const moveSelectedClipLeft = useProjectStore((state) => state.moveSelectedClipLeft);
  const moveSelectedClipRight = useProjectStore((state) => state.moveSelectedClipRight);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const historyUndoDepth = useProjectStore((state) => state.historyUndoDepth);
  const historyRedoDepth = useProjectStore((state) => state.historyRedoDepth);
  const currentTimeSec = usePlayerStore((state) => state.currentTime);
  const openAIPanel = useAIStore((state) => state.openPanel);

  const selectedClipLocation = useMemo(() => {
    if (!selectedClipId) {
      return null;
    }

    for (const track of tracks) {
      const clipIndex = track.clips.findIndex((clip) => clip.id === selectedClipId);
      if (clipIndex >= 0) {
        return {
          trackId: track.id,
          clipIndex,
          clipCount: track.clips.length,
        };
      }
    }

    return null;
  }, [selectedClipId, tracks]);

  const hasSelectedClip = selectedClipLocation !== null;
  const hasValidRange =
    typeof selectedRangeStartSec === "number" &&
    typeof selectedRangeEndSec === "number" &&
    selectedRangeEndSec > selectedRangeStartSec;
  const canMoveLeft = hasSelectedClip && selectedClipLocation.clipIndex > 0;
  const canMoveRight =
    hasSelectedClip && selectedClipLocation.clipIndex < selectedClipLocation.clipCount - 1;
  const canUndo = historyUndoDepth > 0;
  const canRedo = historyRedoDepth > 0;
  const selectedRangeDurationSec = hasValidRange
    ? (selectedRangeEndSec ?? 0) - (selectedRangeStartSec ?? 0)
    : 0;
  const hasValidAIPeriod = hasValidRange && selectedRangeDurationSec >= MIN_AI_PERIOD_SEC;

  const formatTimelineTime = (timeSec: number | null): string => {
    if (typeof timeSec !== "number" || !Number.isFinite(timeSec)) {
      return "--:--";
    }

    const roundedSeconds = Math.max(0, Math.floor(timeSec));
    const hours = Math.floor(roundedSeconds / 3600);
    const minutes = Math.floor((roundedSeconds % 3600) / 60);
    const seconds = roundedSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const applyRangeBoundary = (boundary: "start" | "end") => {
    const safeCurrentTime = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0;
    const startCandidate = boundary === "start" ? safeCurrentTime : selectedRangeStartSec ?? safeCurrentTime;
    const endCandidate = boundary === "end" ? safeCurrentTime : selectedRangeEndSec ?? safeCurrentTime;
    setSelectedRange(Math.min(startCandidate, endCandidate), Math.max(startCandidate, endCandidate));

    const formattedTime = formatTimelineTime(safeCurrentTime);
    setRangeNotice(
      boundary === "start"
        ? `Set range head at: ${formattedTime}`
        : `Set range tail at: ${formattedTime}`,
    );
  };

  const rangeLabel = hasValidRange
    ? `Range ${selectedRangeStartSec?.toFixed(2)}s - ${selectedRangeEndSec?.toFixed(2)}s`
    : "No delete range selected";
  const aiSelectionLabel = hasValidRange
    ? `AI period: ${selectedRangeDurationSec.toFixed(2)}s`
    : "Select a timeline period to enable AI Segment";

  const setInLabel =
    typeof selectedRangeStartSec === "number"
      ? `Set In: ${formatTimelineTime(selectedRangeStartSec)}`
      : "Set In";
  const setOutLabel =
    typeof selectedRangeEndSec === "number"
      ? `Set Out: ${formatTimelineTime(selectedRangeEndSec)}`
      : "Set Out";

  const actions: ToolbarAction[] = [
    {
      label: "Split",
      disabled: !hasSelectedClip,
      hint: hasSelectedClip ? "Split the selected clip at the playhead." : "Select a clip to enable split.",
      onClick: () => splitSelectedClip(currentTimeSec),
    },
    {
      label: "Duplicate",
      disabled: !hasSelectedClip,
      hint: hasSelectedClip ? "Duplicate the selected clip." : "Select a clip to enable duplicate.",
      onClick: duplicateSelectedClip,
    },
    {
      label: "Delete Clip",
      disabled: !hasSelectedClip,
      hint: hasSelectedClip ? "Delete the selected clip from timeline and clip list." : "Select a clip to enable delete.",
      onClick: deleteSelectedClip,
    },
    {
      label: setInLabel,
      disabled: false,
      hint: "Store the current playhead position as the range start.",
      onClick: () => applyRangeBoundary("start"),
    },
    {
      label: setOutLabel,
      disabled: false,
      hint: "Store the current playhead position as the range end.",
      onClick: () => applyRangeBoundary("end"),
    },
    {
      label: "Clear Range",
      disabled: !hasValidRange,
      hint: hasValidRange ? "Clear the selected delete range." : "No range is selected.",
      onClick: clearSelectedRange,
    },
    {
      label: "Delete Range",
      disabled: !hasValidRange,
      hint: hasValidRange ? "Remove the selected timeline range." : "Set an in and out range to enable delete range.",
      onClick: deleteSelectedRange,
    },
    {
      label: "AI Segment",
      disabled: !hasValidAIPeriod,
      hint: !hasValidRange
        ? "Set In and Set Out to choose an AI period."
        : !hasValidAIPeriod
          ? `AI needs at least ${MIN_AI_PERIOD_SEC} seconds in the selected period.`
          : "Open AI editor for the selected timeline period.",
      onClick: () => {
        if (!hasValidRange) {
          return;
        }

        openAIPanel(selectedRangeStartSec ?? 0, selectedRangeEndSec ?? 0);
      },
    },
    {
      label: "Move Left",
      disabled: !canMoveLeft,
      hint: canMoveLeft ? "Move the selected clip earlier in its track." : "The selected clip is already first or nothing is selected.",
      onClick: moveSelectedClipLeft,
    },
    {
      label: "Move Right",
      disabled: !canMoveRight,
      hint: canMoveRight ? "Move the selected clip later in its track." : "The selected clip is already last or nothing is selected.",
      onClick: moveSelectedClipRight,
    },
    {
      label: "Undo",
      disabled: !canUndo,
      hint: canUndo ? "Undo the most recent timeline edit." : "No timeline edits to undo.",
      onClick: undo,
    },
    {
      label: "Redo",
      disabled: !canRedo,
      hint: canRedo ? "Redo the most recently undone edit." : "Undo an action to enable redo.",
      onClick: redo,
    },
  ];

  return (
    <section className="timeline-toolbar" aria-label="Timeline editing tools">
      <div className="timeline-toolbar-copy">
        <span className="timeline-toolbar-label">Editing Toolbar</span>
        <strong>Arrange and refine clips</strong>
        <span className="timeline-toolbar-status">{rangeLabel}</span>
        <span className={`timeline-toolbar-status ${hasValidAIPeriod ? "" : "timeline-toolbar-warning"}`}>
          {aiSelectionLabel}
        </span>
        {rangeNotice ? <span className="timeline-toolbar-notice">{rangeNotice}</span> : null}
      </div>

      <div className="timeline-toolbar-actions" role="toolbar" aria-label="Timeline editing actions">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="timeline-toolbar-button"
            disabled={action.disabled}
            title={action.hint}
            aria-disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}