import { useMemo, useRef } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import type { Clip, Track } from "../../types/timeline";
import { TimelineTrack } from "./TimelineTrack";
import "./Timeline.css";
import { usePlayerStore } from "../../store/usePlayerStore";
import { SeekerBar } from "./SeekerBar";

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
  const currentTimeSec = usePlayerStore((s) => s.currentTime);
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const scrubTime = usePlayerStore((s) => s.scrubTime);
  const beginScrub = usePlayerStore((s) => s.beginScrub);
  const endScrub = usePlayerStore((s) => s.endScrub);
  const setScrubTime = usePlayerStore((s) => s.setScrubTime);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const timelineBodyRef = useRef<HTMLDivElement>(null);

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

  // While scrubbing, timeline UI should follow scrubTime immediately so the
  // playhead and overlays feel responsive without forcing video seeks.
  const displayTimeSec = isScrubbing && scrubTime !== null ? scrubTime : currentTimeSec;

  const clampTimelineTime = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(Math.max(0, value), timelineDurationSec);
  };

  const timelineTimeFromPointer = (clientX: number): number => {
    const body = timelineBodyRef.current;
    if (!body) {
      return displayTimeSec;
    }

    const rect = body.getBoundingClientRect();
    if (rect.width <= 0) {
      return displayTimeSec;
    }

    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return clampTimelineTime(ratio * timelineDurationSec);
  };

  const commitTimelineScrub = () => {
    if (!isScrubbing) {
      return;
    }

    const target = clampTimelineTime(scrubTime ?? currentTimeSec);
    requestSeek(target);
    setCurrentTime(target);
    setScrubTime(null);
    endScrub();
  };

  return (
    <section className="timeline-panel">
      <div className="timeline-panel-header">
        <h2>Timeline</h2>
        <span className="timeline-duration">{timelineDurationSec.toFixed(1)}s</span>
      </div>

      <div
        ref={timelineBodyRef}
        className="timeline-body"
        role="group"
        aria-label="Timeline tracks"
        onPointerDown={(event) => {
          const nextTime = timelineTimeFromPointer(event.clientX);
          beginScrub(nextTime);
          setScrubTime(nextTime);
          setCurrentTime(nextTime);
        }}
        onPointerMove={(event) => {
          if (!isScrubbing) {
            return;
          }

          const nextTime = timelineTimeFromPointer(event.clientX);
          setScrubTime(nextTime);
          setCurrentTime(nextTime);
        }}
        onPointerUp={commitTimelineScrub}
        onPointerLeave={() => {
          if (isScrubbing) {
            commitTimelineScrub();
          }
        }}
      >
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

      <SeekerBar timelineDurationSec={timelineDurationSec} />
    </section>
  );
}
