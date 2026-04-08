import React, { useState } from 'react';
import './VideoPlayer.css';

interface VideoControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  showPlayButton?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  showPlayButton = true,
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTime = scrubTime ?? currentTime;

  const handleSeekInput = (value: string) => {
    const next = parseFloat(value);
    if (!Number.isFinite(next)) return;
    setScrubTime(next);
    onSeek(next);
  };

  const finishScrub = () => {
    setIsScrubbing(false);
    setScrubTime(null);
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
        max={duration || 0}
        step="0.1"
        value={isScrubbing ? (scrubTime ?? currentTime) : currentTime}
        onPointerDown={() => setIsScrubbing(true)}
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
