import type { Clip, Track } from "../../types/timeline";
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
  return (
    <div className="timeline-track-row">
      <div className="timeline-track-label">{track.name}</div>

      <div className="timeline-track-lane">
        <Playhead
          currentTimeSec={currentTimeSec}
          timelineDurationSec={timelineDurationSec}
          className="timeline-lane-playhead"
        />

        {track.clips.length === 0 ? <div className="timeline-track-empty">No clips yet</div> : null}

        {track.clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            timelineDurationSec={timelineDurationSec}
            timelineStartSec={getTimelineStart(clip)}
            timelineEndSec={getTimelineEnd(clip)}
          />
        ))}
      </div>
    </div>
  );
}
