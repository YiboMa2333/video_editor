import React, { useEffect, useMemo } from "react";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useProjectStore } from "../../store/useProjectStore";
import { mapTimelineTimeToSourceTime } from "../../utils/timelineMapping";
import type { MediaItem } from "../../types/media";
import { getThumbnailSrc } from "../../utils/thumbnailMapping";
import "./VideoPlayer.css";

interface VideoPlayerProps {
  title?: string;
  thumbnailDir?: string;
  thumbnailFps?: number;
}

const getTimelineStart = (clip: { timelineStartSec?: number; startSec: number }): number => {
  return clip.timelineStartSec ?? 0;
};

const getTimelineEnd = (
  clip: { timelineStartSec?: number; timelineEndSec?: number; startSec: number; endSec: number }
): number => {
  if (typeof clip.timelineEndSec === "number") {
    return clip.timelineEndSec;
  }
  return getTimelineStart(clip) + Math.max(0, clip.endSec - clip.startSec);
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  title = "Frame Viewer",
  thumbnailDir,
  thumbnailFps,
}) => {
  const setStoreCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const scrubTime = usePlayerStore((s) => s.scrubTime);
  const currentTime = usePlayerStore((s) => s.currentTime);

  const tracks = useProjectStore((s) => s.project.tracks);
  const mediaItems = useProjectStore((s) => s.project.media);

  const videoClips = useMemo(
    () => tracks.filter((track) => track.kind === "video").flatMap((track) => track.clips),
    [tracks],
  );

  const mediaById = useMemo(() => {
    const byId = new Map<string, MediaItem>();
    for (const item of mediaItems) {
      byId.set(item.id, item);
    }
    return byId;
  }, [mediaItems]);

  // Display frame at current scrub position (during drag) or current playhead position
  const displayTimelineTime = isScrubbing ? scrubTime ?? currentTime : currentTime;
  const displayMapping = useMemo(
    () => mapTimelineTimeToSourceTime(displayTimelineTime, videoClips),
    [displayTimelineTime, videoClips],
  );

  const displayMedia = useMemo(() => {
    if (displayMapping.clip) {
      return mediaById.get(displayMapping.clip.mediaId);
    }

    if (thumbnailDir) {
      return {
        id: "frame-viewer-fallback",
        name: title,
        originalPath: "",
        path: "",
        thumbnailDir,
        thumbnailFps,
        type: "video",
      } satisfies MediaItem;
    }

    return undefined;
  }, [displayMapping.clip, mediaById, thumbnailDir, thumbnailFps, title]);

  const frameSource = useMemo(() => {
    if (!displayMedia) {
      return null;
    }
    return getThumbnailSrc(displayMedia, displayMapping.sourceTimeSec);
  }, [displayMedia, displayMapping.sourceTimeSec]);

  // Keep store currentTime in sync
  useEffect(() => {
    setStoreCurrentTime(displayTimelineTime);
  }, [displayTimelineTime, setStoreCurrentTime]);

  return (
    <div className="container">
      <div className="header">
        <h3>{title}</h3>
      </div>

      {frameSource ? (
        <div className="frameViewport">
          <img
            className="frame"
            src={frameSource}
            alt={`${title} frame at ${displayTimelineTime.toFixed(2)}s`}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          {isScrubbing ? <div className="statusBanner">Scrubbing with frames…</div> : null}
        </div>
      ) : (
        <div className="placeholder">
          <p>Import a video to begin editing.</p>
        </div>
      )}
    </div>
  );
};
