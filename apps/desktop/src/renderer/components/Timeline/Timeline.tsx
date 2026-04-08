import { useMemo } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import type { Clip, Track } from "../../types/timeline";
import { TimelineTrack } from "./TimelineTrack";
import "./Timeline.css";

const MIN_TIMELINE_DURATION_SEC = 30;

const fallbackTrack = (kind: "video" | "audio", id: string, name: string): Track => ({
  id,
  name,
  kind,
  clips: [],
});

const getTimelineStart = (clip: Clip): number => {
  const withTimelineAlias = clip as Clip & { timelineStart?: number };
  return withTimelineAlias.timelineStart ?? clip.timelineStartSec ?? 0;
};

const getTimelineEnd = (clip: Clip): number => {
  const withTimelineAlias = clip as Clip & { timelineEnd?: number; timelineEndSec?: number };

  if (typeof withTimelineAlias.timelineEnd === "number") {
    return withTimelineAlias.timelineEnd;
  }

  if (typeof withTimelineAlias.timelineEndSec === "number") {
    return withTimelineAlias.timelineEndSec;
  }

  const duration = Math.max(0, clip.endSec - clip.startSec);
  return getTimelineStart(clip) + duration;
};

export default function Timeline() {
  const tracks = useProjectStore((state) => state.project.tracks);

  const orderedTracks = useMemo(() => {
    const videoTrack = tracks.find((track) => track.kind === "video") ??
      fallbackTrack("video", "video-track", "Video Track");
    const audioTrack = tracks.find((track) => track.kind === "audio") ??
      fallbackTrack("audio", "audio-track", "Audio Track");

    return [videoTrack, audioTrack];
  }, [tracks]);

  const timelineDurationSec = useMemo(() => {
    const endTimes = orderedTracks.flatMap((track) => track.clips.map(getTimelineEnd));
    const maxEnd = endTimes.length > 0 ? Math.max(...endTimes) : 0;
    return Math.max(MIN_TIMELINE_DURATION_SEC, maxEnd);
  }, [orderedTracks]);

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
            currentTimeSec={0}
            getTimelineStart={getTimelineStart}
            getTimelineEnd={getTimelineEnd}
          />
        ))}
      </div>
    </section>
  );
}
