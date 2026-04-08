import React from 'react';
import './VideoPlayer.css';
import { usePlayerStore } from '../../store/usePlayerStore';

interface VideoControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  volume: number;
  onVolumeChange: (volume: number) => void;
  showPlayButton?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  volume,
  onVolumeChange,
  showPlayButton = true,
}) => {
  const isScrubbing = usePlayerStore((s) => s.isScrubbing);
  const scrubTime = usePlayerStore((s) => s.scrubTime);
  const beginScrub = usePlayerStore((s) => s.beginScrub);
  const endScrub = usePlayerStore((s) => s.endScrub);
  const setScrubTime = usePlayerStore((s) => s.setScrubTime);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const requestSeek = usePlayerStore((s) => s.requestSeek);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTime = scrubTime ?? currentTime;
  const safeSeekMax = Number.isFinite(duration) && duration > 0
    ? duration
    : Math.max(currentTime, scrubTime ?? 0, 0.1);

  const handleSeekInput = (value: string) => {
    const next = parseFloat(value);
    if (!Number.isFinite(next)) return;
    // Guard against invalid/overflow seek values coming from the DOM range.
    const clamped = Math.min(Math.max(0, next), safeSeekMax);
    setScrubTime(clamped);
    setCurrentTime(clamped);
    console.debug('[VideoControls] scrub move', {
      raw: next,
      clamped,
      safeSeekMax,
      currentTime,
      duration,
    });
  };

  const finishScrub = () => {
    const commitTime = Math.min(Math.max(0, scrubTime ?? currentTime), safeSeekMax);

    // Key rule: do not seek real video continuously while dragging.
    // We request a single seek at pointer-up so playback is stable.
    requestSeek(commitTime);
    setCurrentTime(commitTime);
    setScrubTime(null);
    endScrub();
    console.debug('[VideoControls] scrub end');
  };

  return (
    <div className="controls">
      {showPlayButton ? (
        <button className="playButton" onClick={onPlayPause}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      ) : null}

      <div className="timeDisplay">
        <span>{formatTime(displayTime)}</span>
        <span> / </span>
        <span>{formatTime(duration)}</span>
      </div>

      <input
        type="range"
        className="seekBar"
        min="0"
        max={safeSeekMax}
        step="0.1"
        value={isScrubbing ? (scrubTime ?? currentTime) : currentTime}
        onPointerDown={(e) => {
          // Fix: read the current thumb value from the event BEFORE React
          // re-renders, so scrubTime is non-null on the very first render after
          // onPointerDown. Without this, React overrides the <input> value back
          // to `currentTime` (often 0) before the browser's first `input` event
          // fires, making every drag start from position 0.
          const val = parseFloat((e.currentTarget as HTMLInputElement).value);
          beginScrub(); // captures wasPlayingBeforeScrub in the store
          if (Number.isFinite(val)) {
            setScrubTime(val);
            setCurrentTime(val);
          }
          console.debug('[VideoControls] scrub start', { val, currentTime, duration });
        }}
        onChange={(e) => handleSeekInput(e.target.value)}
        onPointerUp={finishScrub}
        onBlur={finishScrub}
      />

      <div className="volumeControl">
        <label>🔊</label>
        <input
          type="range"
          className="volumeSlider"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};
