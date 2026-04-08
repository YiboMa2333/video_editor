import { useMemo } from "react";
import type { MediaItem } from "../../types/media";
import { getThumbnailSrc } from "../../utils/thumbnailMapping";

type ScrubPreviewProps = {
  media?: Pick<MediaItem, "thumbnailDir" | "thumbnailFps" | "name">;
  sourceTimeSec: number;
  visible: boolean;
};

export function ScrubPreview({ media, sourceTimeSec, visible }: ScrubPreviewProps) {
  const src = useMemo(() => {
    if (!media || !visible) {
      return null;
    }

    return getThumbnailSrc(media, sourceTimeSec);
  }, [media, sourceTimeSec, visible]);

  if (!visible || !src) {
    return null;
  }

  return (
    <div className="scrub-preview" aria-hidden>
      <img
        className="scrub-preview-image"
        src={src}
        alt={`${media?.name ?? "media"} scrub preview`}
        draggable={false}
        onError={(event) => {
          // Missing thumbnail files should not break playback; hide the overlay
          // frame and let the real video remain visible underneath.
          (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </div>
  );
}
