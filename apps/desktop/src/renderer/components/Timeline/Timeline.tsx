import { useEffect, useMemo } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import type { Track } from "../../types/timeline";
import { TimelineTrack } from "./TimelineTrack";
import "./Timeline.css";
import { usePlayerStore } from "../../store/usePlayerStore";
import { SeekerBar } from "./SeekerBar";
import { getTimelineDuration, getTimelineEnd, getTimelineStart } from "../../utils/timelineMetrics";

const fallbackTrack = (): Track => ({
  id: "video-track",
  name: "Timeline Track",
  kind: "video",
  clips: [],
});

export default function Timeline() {
  const tracks = useProjectStore((state) => state.project.tracks);
  const currentTimeSec = usePlayerStore((s) => s.currentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const scrubTime = usePlayerStore((s) => s.scrubTime);

  const orderedTracks = useMemo<Track[]>(() => {
    const videoTrack = tracks.find((track) => track.kind === "video") ?? fallbackTrack();
    return [videoTrack];
  }, [tracks]);

  const timelineDurationSec = useMemo(() => {
    return getTimelineDuration(orderedTracks);
  }, [orderedTracks]);

  useEffect(() => {
    setDuration(timelineDurationSec);
  }, [setDuration, timelineDurationSec]);

  // While scrubbing, timeline UI should follow scrubTime immediately so the
  // playhead and overlays feel responsive without forcing video seeks.
  const displayTimeSec = isScrubbing && scrubTime !== null ? scrubTime : currentTimeSec;

  return (
    <section className="timeline-panel">
      <div className="timeline-panel-header">
        <h2>Timeline</h2>
        <span className="timeline-duration">{timelineDurationSec.toFixed(1)}s</span>
      </div>

      <div className="timeline-body" role="group" aria-label="Timeline tracks">
        {orderedTracks.map((track) => (
          <TimelineTrack
            key={track.id}
            track={track}
            timelineDurationSec={timelineDurationSec}
            currentTimeSec={displayTimeSec}
            getTimelineStart={getTimelineStart}
            getTimelineEnd={getTimelineEnd}
          />
        ))}
      </div>

      <div className="timeline-seeker-row" aria-label="Timeline seeker row">
        <div className="timeline-seeker-spacer" aria-hidden />
        <div className="timeline-seeker-lane">
          <SeekerBar timelineDurationSec={timelineDurationSec} />
        </div>
      </div>
    </section>
  );
}
