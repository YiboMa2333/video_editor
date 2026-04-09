import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useProjectStore } from "../../store/useProjectStore";
import type { Clip } from "../../types/timeline";
import { getThumbnailIndex, getThumbnailUrl } from "../../utils/thumbnailMapping";

type TimelineClipProps = {
  trackId: string;
  clip: Clip;
  timelineDurationSec: number;
  timelineStartSec: number;
  timelineEndSec: number;
  onDragMove?: (clipId: string, previewStartSec: number, durationSec: number) => void;
  onDragEnd?: (clipId: string, didDrag: boolean) => void;
};

export function TimelineClip({
  trackId,
  clip,
  timelineDurationSec,
  timelineStartSec,
  timelineEndSec,
  onDragMove,
  onDragEnd,
}: TimelineClipProps) {
  const media = useProjectStore((state) =>
    state.project.media.find((item) => item.id === clip.mediaId)
  );
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const selectClip = useProjectStore((state) => state.selectClip);
  const selectTrack = useProjectStore((state) => state.selectTrack);
  const selectMedia = useProjectStore((state) => state.selectMedia);
  const clipRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    initialStartSec: number;
    laneWidthPx: number;
    didDrag: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [isVisible, setIsVisible] = useState(true);
  const [clipWidthPx, setClipWidthPx] = useState(0);
  const [dragPreviewStartSec, setDragPreviewStartSec] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const safeDuration = timelineDurationSec > 0 ? timelineDurationSec : 1;
  const clipStartSec = dragPreviewStartSec ?? timelineStartSec;
  const leftPercent = (Math.max(0, clipStartSec) / safeDuration) * 100;
  const widthPercent = (Math.max(0, timelineEndSec - timelineStartSec) / safeDuration) * 100;
  const clipDuration = Math.max(0, timelineEndSec - timelineStartSec);
  const isSelected = selectedClipId === clip.id;

  useEffect(() => {
    const element = clipRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      setClipWidthPx(element.getBoundingClientRect().width);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const element = clipRef.current;
    if (!element) {
      return;
    }

    const root = element.closest(".timeline-body");
    if (!root || !(root instanceof HTMLElement) || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries.some((entry) => entry.isIntersecting));
      },
      { root, threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const thumbnailFps = media?.thumbnailFps ?? 1;
  const thumbsByWidth = Math.max(1, Math.floor(clipWidthPx / 42));
  const maxThumbs = 30;

  // Cap rendering to keep timeline fast with many clips.
  const renderThumbCount = Math.max(1, Math.min(thumbsByWidth, maxThumbs));

  const thumbnailUrls = useMemo(() => {
    if (!media?.thumbnailDir || !isVisible || clipDuration <= 0) {
      return [] as string[];
    }

    return Array.from({ length: renderThumbCount }, (_, i) => {
      const ratio = (i + 0.5) / renderThumbCount;
      const timelineTime = timelineStartSec + clipDuration * ratio;
      // Map timeline time to source time within the clip
      const sourceTime = clip.startSec + (timelineTime - timelineStartSec) / clipDuration * (clip.endSec - clip.startSec);
      const index = getThumbnailIndex(sourceTime, thumbnailFps);
      return getThumbnailUrl(media, index) ?? "";
    }).filter(Boolean);
  }, [
    media,
    isVisible,
    clipDuration,
    renderThumbCount,
    timelineStartSec,
    thumbnailFps,
    clip,
  ]);

  const finishDrag = (commitMove: boolean) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    const nextStart = dragPreviewStartSec ?? dragState.initialStartSec;
    const didDrag =
      commitMove &&
      dragState.didDrag &&
      Math.abs(nextStart - dragState.initialStartSec) > 1e-4;

    dragStateRef.current = null;
    setIsDragging(false);
    setDragPreviewStartSec(null);

    onDragEnd?.(clip.id, didDrag);
  };

  return (
    <div
      ref={clipRef}
      className={[
        "timeline-clip",
        isSelected ? "timeline-clip-selected" : "",
        isDragging ? "timeline-clip-dragging" : "",
      ].filter(Boolean).join(" ")}
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 1)}%`,
      }}
      title={`${media?.name || clip.mediaId}: ${timelineStartSec.toFixed(2)}s - ${timelineEndSec.toFixed(2)}s`}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const lane = event.currentTarget.parentElement;
        if (!lane) {
          return;
        }

        const laneRect = lane.getBoundingClientRect();
        if (laneRect.width <= 0) {
          return;
        }

        suppressClickRef.current = false;
        dragStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          initialStartSec: timelineStartSec,
          laneWidthPx: laneRect.width,
          didDrag: false,
        };

        setIsDragging(true);
        setDragPreviewStartSec(timelineStartSec);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }

        const deltaPx = event.clientX - dragState.startX;
        if (Math.abs(deltaPx) > 2) {
          dragState.didDrag = true;
        }

        const deltaSec = (deltaPx / dragState.laneWidthPx) * safeDuration;
        const nextStart = Math.max(0, dragState.initialStartSec + deltaSec);
        setDragPreviewStartSec(nextStart);
        onDragMove?.(clip.id, nextStart, clipDuration);
      }}
      onPointerUp={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }

        suppressClickRef.current = dragState.didDrag;
        event.currentTarget.releasePointerCapture(event.pointerId);
        finishDrag(true);
      }}
      onPointerCancel={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }

        event.currentTarget.releasePointerCapture(event.pointerId);
        finishDrag(false);
      }}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        event.stopPropagation();
        selectClip(clip.id);
        selectTrack(trackId);
        selectMedia(clip.mediaId);
      }}
    >
      {thumbnailUrls.length > 0 ? (
        <div className="timeline-clip-thumbnails" aria-hidden>
          {thumbnailUrls.map((url, idx) => (
            <img
              key={`${clip.id}-thumb-${idx}`}
              className="timeline-clip-thumb"
              src={url}
              alt=""
              loading="lazy"
              draggable={false}
              onError={(event) => {
                // Missing/corrupt thumbnail should never break clip rendering.
                (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="timeline-clip-overlay" />
      <span className="timeline-clip-label">{media?.name || clip.mediaId}</span>
    </div>
  );
}
