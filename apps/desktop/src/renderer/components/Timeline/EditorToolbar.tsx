import { useMemo } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import "./TimelineToolbar.css";

type ToolbarAction = {
  label: string;
  disabled: boolean;
  hint: string;
};

export function EditorToolbar() {
  const tracks = useProjectStore((state) => state.project.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const selectedRangeStartSec = useProjectStore((state) => state.selectedRangeStartSec);
  const selectedRangeEndSec = useProjectStore((state) => state.selectedRangeEndSec);
  const undoStackDepth = useProjectStore((state) => state.undoStackDepth);

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
  const canUndo = undoStackDepth > 0;

  const actions: ToolbarAction[] = [
    {
      label: "Split",
      disabled: !hasSelectedClip,
      hint: hasSelectedClip ? "Split the selected clip at the playhead." : "Select a clip to enable split.",
    },
    {
      label: "Delete Range",
      disabled: !hasValidRange,
      hint: hasValidRange ? "Remove the selected timeline range." : "Set an in and out range to enable delete range.",
    },
    {
      label: "Duplicate",
      disabled: !hasSelectedClip,
      hint: hasSelectedClip ? "Duplicate the selected clip." : "Select a clip to enable duplicate.",
    },
    {
      label: "Move Left",
      disabled: !canMoveLeft,
      hint: canMoveLeft ? "Move the selected clip earlier in its track." : "The selected clip is already first or nothing is selected.",
    },
    {
      label: "Move Right",
      disabled: !canMoveRight,
      hint: canMoveRight ? "Move the selected clip later in its track." : "The selected clip is already last or nothing is selected.",
    },
    {
      label: "Undo",
      disabled: !canUndo,
      hint: canUndo ? "Undo the most recent edit." : "No undo history is available yet.",
    },
  ];

  return (
    <section className="timeline-toolbar" aria-label="Timeline editing tools">
      <div className="timeline-toolbar-copy">
        <span className="timeline-toolbar-label">Editing Toolbar</span>
        <strong>Arrange and refine clips</strong>
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
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}