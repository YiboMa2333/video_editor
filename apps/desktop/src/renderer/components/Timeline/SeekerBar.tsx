import { useMemo } from "react";
import { usePlayerStore } from "../../store/usePlayerStore";

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
        }}
        onChange={(event) => {
          const next = clampTimelineTime(Number.parseFloat(event.target.value));
          setScrubTime(next);
          setCurrentTime(next);
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
