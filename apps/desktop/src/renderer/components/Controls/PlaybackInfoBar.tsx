import { useEffect, useState } from "react";
import { usePlayerStore } from "../../store/usePlayerStore";
import "./PlaybackInfoBar.css";

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
};

export function PlaybackInfoBar() {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const isScrubbing = usePlayerStore((state) => state.isScrubbing);
  const scrubTime = usePlayerStore((state) => state.scrubTime);
  const [volume, setVolume] = useState(1);

  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;

  useEffect(() => {
    // MVP: keep a simple volume control in the playback info row and push
    // values directly to mpv (0-100 scale).
    void window.mpv.setVolume(Math.round(volume * 100));
  }, [volume]);

  return (
    <section className="playback-info-bar" aria-label="Playback information">
      <div className="playback-time-summary">
        <span className="playback-info-label">Timeline Time</span>
        <strong>
          {formatTime(displayTime)} / {formatTime(duration)}
        </strong>
      </div>

      <div className="playback-volume-summary" aria-label="Preview volume">
        <span className="playback-info-label">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value);
            setVolume(Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 1);
          }}
        />
      </div>
    </section>
  );
}