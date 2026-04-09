import { useMemo } from "react";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useProjectStore } from "../../store/useProjectStore";
import { getTimelineEnd, getTimelineStart } from "../../utils/timelineMetrics";

type SeekerBarProps = {
  timelineDurationSec: number;
};

export function SeekerBar({ timelineDurationSec }: SeekerBarProps) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const scrubTime = usePlayerStore((s) => s.scrubTime);
  const beginScrub = usePlayerStore((s) => s.beginScrub);
  const endScrub = usePlayerStore((s) => s.endScrub);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setScrubTime = usePlayerStore((s) => s.setScrubTime);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const tracks = useProjectStore((state) => state.project.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const selectedTrackId = useProjectStore((state) => state.selectedTrackId);
  const selectClip = useProjectStore((state) => state.selectClip);
  const selectTrack = useProjectStore((state) => state.selectTrack);
  const selectMedia = useProjectStore((state) => state.selectMedia);

  const safeMax = useMemo(() => {
    const max = Number.isFinite(timelineDurationSec) ? timelineDurationSec : 0;
    return Math.max(0.1, max);
  }, [timelineDurationSec]);

  const displayTime = isScrubbing ? scrubTime ?? currentTime : currentTime;

  const clampTimelineTime = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(Math.max(0, value), safeMax);
  };

  const selectClipAtTime = (timeSec: number) => {
    const videoTrack = tracks.find((track) => track.kind === "video");
    if (!videoTrack) {
      return;
    }

    const hitClip = videoTrack.clips.find((clip) => {
      const start = getTimelineStart(clip);
      const end = getTimelineEnd(clip);
      return timeSec >= start && timeSec < end;
    });

    if (!hitClip) {
      if (selectedClipId !== null || selectedTrackId !== null) {
        selectClip(null);
        selectTrack(null);
      }
      return;
    }

    if (selectedClipId === hitClip.id && selectedTrackId === videoTrack.id) {
      return;
    }

    selectClip(hitClip.id);
    selectTrack(videoTrack.id);
    selectMedia(hitClip.mediaId);
  };

  const commitScrub = () => {
    const next = clampTimelineTime(scrubTime ?? currentTime);

    // During drag, we only update timeline UI state. On release, request a
    // single real video seek so decode work happens once per scrub gesture.
    requestSeek(next);
    setCurrentTime(next);
    setScrubTime(null);
    endScrub();
  };

  return (
    <div className="timeline-seeker" aria-label="Timeline seeker">
      <input
        type="range"
        className="timeline-seeker-input"
        min={0}
        max={safeMax}
        step={0.01}
        value={clampTimelineTime(displayTime)}
        onPointerDown={(event) => {
          const initial = clampTimelineTime(Number.parseFloat(event.currentTarget.value));
          beginScrub(initial);
          setScrubTime(initial);
          setCurrentTime(initial);
          selectClipAtTime(initial);
        }}
        onChange={(event) => {
          const next = clampTimelineTime(Number.parseFloat(event.target.value));
          setScrubTime(next);
          setCurrentTime(next);
          selectClipAtTime(next);
        }}
        onPointerUp={commitScrub}
        onBlur={() => {
          if (isScrubbing) {
            commitScrub();
          }
        }}
      />
    </div>
  );
}
