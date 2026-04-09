import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useProjectStore } from "../../store/useProjectStore";
import { mapTimelineTimeToSourceTime } from "../../utils/timelineMapping";
import type { MediaItem } from "../../types/media";
import "./PreviewWindow.css";

type MpvStatus = {
  available: boolean;
  connected: boolean;
  mode: "overlay-window" | "external-window-mvp" | "external-fallback";
  lastError: string | null;
};

const seekEpsilonSec = 0.05;

const getPreferredPath = (media?: Pick<MediaItem, "originalPath" | "path">): string | null => {
  if (!media) {
    return null;
  }
  return media.originalPath || media.path || null;
};

export function PreviewWindow() {
  const [mpvStatus, setMpvStatus] = useState<MpvStatus | null>(null);
  const [statusText, setStatusText] = useState("Initializing mpv preview...");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedMediaId = useProjectStore((state) => state.selectedMediaId);
  const media = useProjectStore((state) => state.project.media);
  const tracks = useProjectStore((state) => state.project.tracks);

  const currentTime = usePlayerStore((state) => state.currentTime);
  const isScrubbing = usePlayerStore((state) => state.isScrubbing);
  const scrubTime = usePlayerStore((state) => state.scrubTime);
  const seekRequestTime = usePlayerStore((state) => state.seekRequestTime);
  const clearSeekRequest = usePlayerStore((state) => state.clearSeekRequest);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const lastLoadedPathRef = useRef<string | null>(null);
  const lastSeekSourceRef = useRef<number | null>(null);

  const selectedMedia = useMemo(() => {
    return media.find((item) => item.id === selectedMediaId);
  }, [media, selectedMediaId]);

  const videoClips = useMemo(
    () => tracks.filter((track) => track.kind === "video").flatMap((track) => track.clips),
    [tracks],
  );

  const mediaById = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const item of media) {
      map.set(item.id, item);
    }
    return map;
  }, [media]);

  const displayTimelineTime = isScrubbing ? scrubTime ?? currentTime : currentTime;

  const displayMapping = useMemo(
    () => mapTimelineTimeToSourceTime(displayTimelineTime, videoClips),
    [displayTimelineTime, videoClips],
  );

  const activePreviewMedia = useMemo(() => {
    if (displayMapping.clip) {
      return mediaById.get(displayMapping.clip.mediaId);
    }

    return selectedMedia;
  }, [displayMapping.clip, mediaById, selectedMedia]);

  const activePreviewPath = getPreferredPath(activePreviewMedia);

  const refreshStatus = async () => {
    try {
      const status = await window.mpv.getStatus();
      setMpvStatus(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMpvStatus({
        available: false,
        connected: false,
        mode: "external-window-mvp",
        lastError: message,
      });
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    let disposed = false;
    let rafId: number | null = null;

    const getBoundsPayload = () => {
      const rect = node.getBoundingClientRect();

      // Pseudo-embedded overlay should sit centered and large inside the
      // preview panel rather than hugging the top-left corner.
      const widthScale = 0.96;
      const heightScale = 0.9;
      const targetWidth = Math.max(320, Math.round(rect.width * widthScale));
      const targetHeight = Math.max(180, Math.round(rect.height * heightScale));
      const targetX = rect.left + (rect.width - targetWidth) / 2;
      const targetY = rect.top + (rect.height - targetHeight) / 2;

      return {
        bounds: {
          x: targetX,
          y: targetY,
          width: targetWidth,
          height: targetHeight,
        },
        scaleFactor: 1,
      };
    };

    const reportBounds = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        void window.mpv.updatePreviewHostBounds(getBoundsPayload());
      });
    };

    void (async () => {
      const attachResult = await window.mpv.attachPreviewHost(getBoundsPayload());
      if (!attachResult.ok) {
        console.warn("[preview] overlay attach failed, external fallback remains active", attachResult.error);
      } else {
        console.log("[preview] overlay host attached");
        // New overlay host session may have been recreated. Force next preview
        // effect to load/seek again so frame is visible in the host surface.
        lastLoadedPathRef.current = null;
        lastSeekSourceRef.current = null;
      }
      if (!disposed) {
        await refreshStatus();
      }
    })();

    const resizeObserver = new ResizeObserver(() => {
      reportBounds();
    });
    resizeObserver.observe(node);
    window.addEventListener("resize", reportBounds);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", reportBounds);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      // Lifecycle rule: when preview host unmounts, detach embedded target.
      void window.mpv.detachPreviewHost();
    };
  }, []);

  useEffect(() => {
    // Timeline logic intentionally stays unchanged. We only swap preview engine
    // from frame image rendering to mpv IPC commands.
    if (!activePreviewPath) {
      setStatusText("Import media to open an mpv preview window.");
      return;
    }

    if (lastLoadedPathRef.current === activePreviewPath) {
      return;
    }

    void (async () => {
      const result = await window.mpv.loadFile(activePreviewPath);
      if (!result.ok) {
        setStatusText(`mpv load failed: ${result.error || "unknown error"}`);
        await refreshStatus();
        return;
      }

      lastLoadedPathRef.current = activePreviewPath;
      setStatusText(`Loaded in mpv: ${activePreviewMedia?.name || "media"}`);

      if (Number.isFinite(displayMapping.sourceTimeSec)) {
        const seekResult = await window.mpv.seek(Math.max(0, displayMapping.sourceTimeSec));
        if (seekResult.ok) {
          lastSeekSourceRef.current = Math.max(0, displayMapping.sourceTimeSec);
        }
      }

      await refreshStatus();
    })();
  }, [activePreviewMedia?.name, activePreviewPath, displayMapping.sourceTimeSec]);

  useEffect(() => {
    // Keep explicit timeline/user seek gestures authoritative.
    if (seekRequestTime === null) {
      return;
    }

    const mapping = mapTimelineTimeToSourceTime(seekRequestTime, videoClips);
    const sourceTime = Math.max(0, mapping.sourceTimeSec);
    const last = lastSeekSourceRef.current;

    if (last !== null && Math.abs(last - sourceTime) < seekEpsilonSec) {
      clearSeekRequest();
      return;
    }

    void (async () => {
      const result = await window.mpv.seek(sourceTime);
      if (result.ok) {
        lastSeekSourceRef.current = sourceTime;
      } else {
        setStatusText(`mpv seek failed: ${result.error || "unknown error"}`);
      }
      clearSeekRequest();
      await refreshStatus();
    })();
  }, [clearSeekRequest, seekRequestTime, videoClips]);

  useEffect(() => {
    if (isPlaying) {
      void window.mpv.play();
      return;
    }

    void window.mpv.pause();
  }, [isPlaying]);

  const isUnavailable = mpvStatus !== null && (!mpvStatus.available || Boolean(mpvStatus.lastError));
  const previewModeLabel =
    mpvStatus?.mode === "overlay-window"
      ? "overlay pinned"
      : mpvStatus?.mode === "external-fallback"
        ? "external fallback"
        : "external window";

  return (
    <section className="preview-window" aria-label="Preview window">
      <header className="preview-window-header">
        <h3>Preview (mpv)</h3>
        <span className="preview-mode-tag">Mode: {previewModeLabel}</span>
      </header>

      <div className="preview-window-body">
        <div className="preview-embed-surface" ref={containerRef} />

        <div className="preview-overlay-panel">
          <p className="preview-status-line">{statusText}</p>
          <p className="preview-help-copy">
            Playback runs in mpv instead of Chromium video to better match final playback behavior. Embedded mode uses the Windows
            pseudo-embedded overlay (borderless mpv window pinned to this region) and falls back to external mode if unavailable.
          </p>

          {isUnavailable ? (
            <div className="preview-warning" role="alert">
              <strong>mpv unavailable.</strong>
              <span>
                Install mpv and ensure it is on PATH, or set AI_VIDEO_EDITOR_MPV_PATH. Error: {mpvStatus?.lastError || "unknown"}
              </span>
            </div>
          ) : (
            <div className="preview-ok" role="status">
              <span>mpv IPC connected: {mpvStatus?.connected ? "yes" : "starting"}</span>
              <span>Selected media: {activePreviewMedia?.name || "none"}</span>
            </div>
          )}
        </div>
      </div>

      {/* TODO: Add explicit in-UI toggle between embedded and external preview modes. */}
    </section>
  );
}
