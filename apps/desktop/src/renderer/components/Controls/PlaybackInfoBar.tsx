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

  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;

  return (
    <section className="playback-info-bar" aria-label="Playback information">
      <div className="playback-time-summary">
        <span className="playback-info-label">Timeline Time</span>
        <strong>
          {formatTime(displayTime)} / {formatTime(duration)}
        </strong>
      </div>
    </section>
  );
}