import React, { useRef, useState, useEffect } from 'react';
import { VideoControls } from './VideoControls';
import { resolveMediaSource } from '../../services/api';
import './VideoPlayer.css';

interface VideoPlayerProps {
  originalPath?: string;
  proxyPath?: string;
  isProxyReady?: boolean;
  title?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  originalPath,
  proxyPath,
  isProxyReady,
  title = 'Video Preview',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackSource, setPlaybackSource] = useState<string | undefined>();
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [hasTriedPreviewFallback, setHasTriedPreviewFallback] = useState(false);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const preferredPath = proxyPath && isProxyReady !== false ? proxyPath : originalPath ?? proxyPath;
  const directSource = preferredPath ? resolveMediaSource(preferredPath) : undefined;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackError(null);
    setPlaybackSource(undefined);
    setHasTriedPreviewFallback(false);
    setHasLoadedMetadata(false);
  }, [originalPath, proxyPath, isProxyReady]);

  useEffect(() => {
    const prepareSource = async () => {
      if (!preferredPath) {
        setPlaybackSource(undefined);
        return;
      }

      setPlaybackSource(resolveMediaSource(preferredPath));
    };

    prepareSource();
  }, [preferredPath]);

  const attemptPreviewFallback = async () => {
    if (!originalPath) {
      setPlaybackError("Unable to load media.");
      return;
    }

    if (!/^[a-zA-Z]:\\/.test(originalPath) || !window.desktopAPI?.createPreview || hasTriedPreviewFallback) {
      setPlaybackError(
        "This file format or codec is not supported by the embedded Chromium player."
      );
      return;
    }

    try {
      setHasTriedPreviewFallback(true);
      setIsPreparingPreview(true);
      setPlaybackError(null);
      const previewPath = await window.desktopAPI.createPreview(originalPath);
      setPlaybackSource(previewPath);
    } catch (error) {
      setPlaybackError(
        error instanceof Error ? error.message : "Preview generation failed."
      );
    } finally {
      setIsPreparingPreview(false);
    }
  };

  useEffect(() => {
    if (!originalPath || !/^[a-zA-Z]:\\/.test(originalPath) || !playbackSource) {
      return;
    }

    if (playbackSource !== directSource || hasLoadedMetadata || hasTriedPreviewFallback || isPreparingPreview) {
      return;
    }

    const timer = window.setTimeout(() => {
      const element = videoRef.current;
      const loadedDuration = element?.duration ?? NaN;
      const hasUsableMetadata =
        !!element &&
        element.readyState >= HTMLMediaElement.HAVE_METADATA &&
        Number.isFinite(loadedDuration) &&
        loadedDuration > 0;

      if (!hasUsableMetadata) {
        void attemptPreviewFallback();
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [originalPath, playbackSource, directSource, hasLoadedMetadata, hasTriedPreviewFallback, isPreparingPreview]);

  // Update current time as video plays
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Update duration when metadata loads
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const loadedDuration = videoRef.current.duration;

      if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
        setDuration(loadedDuration);
        setHasLoadedMetadata(true);
        setPlaybackError(null);
        return;
      }
    }

    void attemptPreviewFallback();
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        void videoRef.current.play();
      }
    }
  };

  // Handle seeking
  const handleSeek = (time: number) => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    const safeDuration = Number.isFinite(element.duration) && element.duration > 0
      ? element.duration
      : duration;
    const nextTime = Math.min(Math.max(0, time), safeDuration || 0);

    element.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  // Handle volume change
  const handleVolumeChange = (vol: number) => {
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setVolume(vol);
    }
  };

  // Pause on video end
  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className="container">
      <div className="header">
        <h3>{title}</h3>
        <button
          className="headerPlayButton"
          onClick={handlePlayPause}
          disabled={!preferredPath || isPreparingPreview}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>

      {preferredPath ? (
        <>
          {proxyPath && isProxyReady === false ? <div className="statusBanner">Generating preview...</div> : null}
          {isPreparingPreview ? <div className="statusBanner">Generating compatible preview...</div> : null}
          <video
            ref={videoRef}
            className="video"
            src={playbackSource}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleEnded}
            onError={() => {
              void attemptPreviewFallback();
            }}
            controlsList="nodownload"
          >
            Your browser does not support HTML5 video.
          </video>

          {playbackError ? <div className="errorBanner">{playbackError}</div> : null}

          <VideoControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            showPlayButton={false}
          />
        </>
      ) : (
        <div className="placeholder">
          <p>No video selected. Import media to preview.</p>
        </div>
      )}
    </div>
  );
};
