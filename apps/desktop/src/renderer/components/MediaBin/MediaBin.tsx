import { resolveMediaSource } from "../../services/api";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useProjectStore } from "../../store/useProjectStore";
import { getTimelineStart } from "../../utils/timelineMetrics";
import { getThumbnailSrc } from "../../utils/thumbnailMapping";
import { useState } from "react";
import "./MediaBin.css";

const formatDuration = (durationSec?: number): string => {
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(durationSec));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function MediaBin() {
  const media = useProjectStore((s) => s.project.media);
  const tracks = useProjectStore((s) => s.project.tracks);
  const selectedMediaId = useProjectStore((s) => s.selectedMediaId);
  const selectMedia = useProjectStore((s) => s.selectMedia);
  const selectClip = useProjectStore((s) => s.selectClip);
  const selectTrack = useProjectStore((s) => s.selectTrack);
  const addClipFromMedia = useProjectStore((s) => s.addClipFromMedia);
  const clearAllImportedMedia = useProjectStore((s) => s.clearAllImportedMedia);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setScrubTime = usePlayerStore((s) => s.setScrubTime);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const endScrub = usePlayerStore((s) => s.endScrub);
  const resetPlayer = usePlayerStore((s) => s.reset);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const onDeleteAll = async () => {
    const shouldDelete = window.confirm(
      "Delete all imported media and clear thumbnails/cache files?"
    );
    if (!shouldDelete) {
      return;
    }

    setIsClearingAll(true);

    try {
      clearAllImportedMedia();
      resetPlayer();

      if (window.desktopAPI?.clearCaches) {
        const report = await window.desktopAPI.clearCaches();
        if (report.failedPaths.length > 0) {
          const preview = report.failedPaths
            .slice(0, 3)
            .map((item) => `${item.path}: ${item.error}`)
            .join("\n");
          alert(
            `Media cleared, but ${report.failedPaths.length} cache path(s) could not be removed.\n${preview}`
          );
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to clear media and caches.");
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <section className="panel media-list-panel">
      <div className="panel-header">
        <h2>Media List</h2>
        <div className="panel-actions">
          <button className="button-danger" onClick={onDeleteAll} disabled={isClearingAll}>
            {isClearingAll ? "Clearing..." : "Delete All"}
          </button>
        </div>
      </div>

      {media.length === 0 ? (
        <p className="muted">No media imported yet.</p>
      ) : (
        <ul className="media-list">
          {media.map((m) => {
            const thumbSrc = m.thumbnailDir
              ? getThumbnailSrc(m, 0)
              : m.type === "image"
                ? resolveMediaSource(m.originalPath || m.path)
                : null;
            const canAddToTimeline = typeof m.durationSec === "number" && m.durationSec > 0;

            const selectMediaAndSeekFirstClip = () => {
              selectMedia(m.id);

              const firstClipMatch = tracks
                .flatMap((track) => track.clips.map((clip) => ({ trackId: track.id, clip })))
                .find((item) => item.clip.mediaId === m.id);

              if (!firstClipMatch) {
                selectClip(null);
                selectTrack(null);
                return;
              }

              const clipHead = getTimelineStart(firstClipMatch.clip);
              selectClip(firstClipMatch.clip.id);
              selectTrack(firstClipMatch.trackId);
              setCurrentTime(clipHead);
              setScrubTime(null);
              requestSeek(clipHead);
              endScrub();
            };

            return (
              <li
                key={m.id}
                className={selectedMediaId === m.id ? "media-item media-item-selected" : "media-item"}
                onClick={selectMediaAndSeekFirstClip}
                onDoubleClick={() => {
                  if (canAddToTimeline) {
                    addClipFromMedia(m.id);
                    selectMediaAndSeekFirstClip();
                  }
                }}
              >
                <div className="media-thumb-shell" aria-hidden>
                  {thumbSrc ? (
                    <img
                      className="media-thumb-image"
                      src={thumbSrc}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span className="media-thumb-fallback">{m.type.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>

                <div className="media-item-body">
                  <div className="media-item-row">
                    <div className="media-item-copy">
                      <strong className="media-item-name">{m.name}</strong>
                      <span className="media-item-meta">{m.type}</span>
                    </div>
                    <span className="media-item-duration">{formatDuration(m.durationSec)}</span>
                  </div>

                  <div className="path media-item-path">{m.path}</div>

                  <div className="media-item-actions">
                    <button
                      type="button"
                      className="media-item-add-button"
                      disabled={!canAddToTimeline}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (canAddToTimeline) {
                          addClipFromMedia(m.id);
                        }
                      }}
                    >
                      Add to Timeline
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
