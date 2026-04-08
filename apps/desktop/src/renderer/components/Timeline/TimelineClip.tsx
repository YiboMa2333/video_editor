import type { Clip } from "../../types/timeline";

type TimelineClipProps = {
  clip: Clip;
  timelineDurationSec: number;
  timelineStartSec: number;
  timelineEndSec: number;
};

export function TimelineClip({
  clip,
  timelineDurationSec,
  timelineStartSec,
  timelineEndSec,
}: TimelineClipProps) {
  const safeDuration = timelineDurationSec > 0 ? timelineDurationSec : 1;
  const leftPercent = (Math.max(0, timelineStartSec) / safeDuration) * 100;
  const widthPercent = (Math.max(0, timelineEndSec - timelineStartSec) / safeDuration) * 100;

  return (
    <div
      className="timeline-clip"
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 1)}%`,
      }}
      title={`${clip.mediaId}: ${timelineStartSec.toFixed(2)}s - ${timelineEndSec.toFixed(2)}s`}
    >
      <span className="timeline-clip-label">{clip.mediaId}</span>
    </div>
  );
}
