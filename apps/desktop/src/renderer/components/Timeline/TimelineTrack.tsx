import { useMemo, useState } from "react";
import type { Clip, Track } from "../../types/timeline";
import { useProjectStore } from "../../store/useProjectStore";
import { TimelineClip } from "./TimelineClip";
import { Playhead } from "./Playhead";

type TimelineTrackProps = {
  track: Track;
  timelineDurationSec: number;
  currentTimeSec: number;
  getTimelineStart: (clip: Clip) => number;
  getTimelineEnd: (clip: Clip) => number;
};

export function TimelineTrack({
  track,
  timelineDurationSec,
  currentTimeSec,
  getTimelineStart,
  getTimelineEnd,
}: TimelineTrackProps) {
  const reorderClipInTrack = useProjectStore((state) => state.reorderClipInTrack);
  const [dragPreview, setDragPreview] = useState<{
    clipId: string;
    originalIndex: number;
    targetIndex: number;
    previewStartSec: number;
    durationSec: number;
  } | null>(null);

  const orderedClips = useMemo(
    () => [...track.clips].sort((a, b) => getTimelineStart(a) - getTimelineStart(b)),
    [getTimelineStart, track.clips],
  );

  const clipMetaById = useMemo(() => {
    const map = new Map<string, { start: number; end: number; duration: number; center: number; index: number }>();
    orderedClips.forEach((clip, index) => {
      const start = getTimelineStart(clip);
      const end = getTimelineEnd(clip);
      map.set(clip.id, {
        start,
        end,
        duration: Math.max(0, end - start),
        center: start + Math.max(0, end - start) / 2,
        index,
      });
    });
    return map;
  }, [getTimelineEnd, getTimelineStart, orderedClips]);

  const previewStartById = useMemo(() => {
    const base = new Map<string, number>();
    for (const clip of orderedClips) {
      base.set(clip.id, getTimelineStart(clip));
    }

    if (!dragPreview) {
      return base;
    }

    const from = dragPreview.originalIndex;
    const to = dragPreview.targetIndex;

    if (to > from) {
      for (let i = from + 1; i <= to; i += 1) {
        const shifted = orderedClips[i];
        const start = base.get(shifted.id);
        if (typeof start === "number") {
          base.set(shifted.id, start - dragPreview.durationSec);
        }
      }
    } else if (to < from) {
      for (let i = to; i < from; i += 1) {
        const shifted = orderedClips[i];
        const start = base.get(shifted.id);
        if (typeof start === "number") {
          base.set(shifted.id, start + dragPreview.durationSec);
        }
      }
    }

    base.set(dragPreview.clipId, dragPreview.previewStartSec);
    return base;
  }, [dragPreview, getTimelineStart, orderedClips]);

  const resolveTargetIndex = (clipId: string, previewStartSec: number): number | null => {
    const current = clipMetaById.get(clipId);
    if (!current) {
      return null;
    }

    const others = orderedClips.filter((clip) => clip.id !== clipId);
    let target = current.index;
    const draggedEnd = previewStartSec + current.duration;

    if (previewStartSec >= current.start) {
      while (target < others.length) {
        const rightMeta = clipMetaById.get(others[target].id);
        if (!rightMeta || draggedEnd <= rightMeta.center) {
          break;
        }
        target += 1;
      }
    } else {
      while (target > 0) {
        const leftMeta = clipMetaById.get(others[target - 1].id);
        if (!leftMeta || previewStartSec >= leftMeta.center) {
          break;
        }
        target -= 1;
      }
    }

    return target;
  };

  const handleDragMove = (clipId: string, previewStartSec: number, durationSec: number) => {
    const nextTargetIndex = resolveTargetIndex(clipId, previewStartSec);
    if (nextTargetIndex === null) {
      return;
    }

    const current = clipMetaById.get(clipId);
    if (!current) {
      return;
    }

    setDragPreview({
      clipId,
      originalIndex: current.index,
      targetIndex: nextTargetIndex,
      previewStartSec,
      durationSec,
    });
  };

  const handleDragEnd = (clipId: string, didDrag: boolean) => {
    const preview = dragPreview;
    setDragPreview(null);

    if (!preview || preview.clipId !== clipId || !didDrag) {
      return;
    }

    if (preview.targetIndex !== preview.originalIndex) {
      reorderClipInTrack(track.id, clipId, preview.targetIndex);
    }
  };

  return (
    <div className="timeline-track-row">
      <div className="timeline-track-label">{track.name}</div>

      <div className="timeline-track-lane">
        <Playhead
          currentTimeSec={currentTimeSec}
          timelineDurationSec={timelineDurationSec}
          className="timeline-lane-playhead"
        />

        {orderedClips.length === 0 ? <div className="timeline-track-empty">No clips yet</div> : null}

        {orderedClips.map((clip) => {
          const meta = clipMetaById.get(clip.id);
          const fallbackStart = getTimelineStart(clip);
          const startSec = previewStartById.get(clip.id) ?? fallbackStart;
          const durationSec = meta?.duration ?? Math.max(0, getTimelineEnd(clip) - fallbackStart);
          return (
          <TimelineClip
            key={clip.id}
            trackId={track.id}
            clip={clip}
            timelineDurationSec={timelineDurationSec}
            timelineStartSec={startSec}
            timelineEndSec={startSec + durationSec}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
          );
        })}
      </div>
    </div>
  );
}
