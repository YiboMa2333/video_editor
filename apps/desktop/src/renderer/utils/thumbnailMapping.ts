import type { MediaItem } from "../types/media";
import { resolveMediaSource } from "../services/api";

/**
 * Convert timeline time to thumbnail index.
 *
 * Thumbnails reduce scrubbing cost because the UI can show cached still images
 * instead of requesting decode from the video pipeline on every tiny movement.
 */
export function getThumbnailIndex(time: number, fps: number): number {
  const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  const safeFps = Math.max(0.1, Number.isFinite(fps) ? fps : 1);
  return Math.floor(safeTime * safeFps);
}

export function getThumbnailUrl(media: Pick<MediaItem, "thumbnailDir" | "thumbnailFps">, index: number): string | undefined {
  if (!media.thumbnailDir) {
    return undefined;
  }

  const fileNumber = Math.max(1, Math.floor(index) + 1);
  const padded = String(fileNumber).padStart(4, "0");
  const normalizedDir = media.thumbnailDir.replace(/[\\/]+$/, "");
  const thumbPath = `${normalizedDir}/thumb_${padded}.jpg`;
  return resolveMediaSource(thumbPath);
}

/**
 * Resolve nearest thumbnail URL for an arbitrary source time.
 */
export function getThumbnailSrc(
  media: Pick<MediaItem, "thumbnailDir" | "thumbnailFps">,
  time: number,
): string | null {
  if (!media.thumbnailDir) {
    return null;
  }

  const fps = media.thumbnailFps ?? 1;
  const idx = getThumbnailIndex(time, fps);
  return getThumbnailUrl(media, idx) ?? null;
}
