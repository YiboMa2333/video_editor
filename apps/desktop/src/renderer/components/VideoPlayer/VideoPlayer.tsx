import React, { useRef, useState, useEffect } from 'react';
import { VideoControls } from './VideoControls';
import { resolveMediaSource } from '../../services/api';
import './VideoPlayer.css';

interface VideoPlayerProps {
  src?: string;
  title?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title = 'Video Preview' }) => {
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
  const directSource = src ? resolveMediaSource(src) : undefined;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
    setPlaybackSource(undefined);
    setHasTriedPreviewFallback(false);
    setHasLoadedMetadata(false);
  }, [src]);

  useEffect(() => {
    let cancelled = false;

    const prepareSource = async () => {
      if (!src) {
        setPlaybackSource(undefined);
        return;
      }

      setPlaybackSource(resolveMediaSource(src));
    };

    prepareSource();

    return () => {
      cancelled = true;
    };
  }, [src]);

  const attemptPreviewFallback = async () => {
    if (!src) {
      setPlaybackError("Unable to load media.");
      return;
    }

    if (!/^[a-zA-Z]:\\/.test(src) || !window.desktopAPI?.createPreview || hasTriedPreviewFallback) {
      setPlaybackError(
        "This file format or codec is not supported by the embedded Chromium player."
      );
      return;
    }

    try {
      setHasTriedPreviewFallback(true);
      setIsPreparingPreview(true);
      setPlaybackError(null);
      const previewPath = await window.desktopAPI.createPreview(src);
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
    if (!src || !/^[a-zA-Z]:\\/.test(src) || !playbackSource) {
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
  }, [src, playbackSource, directSource, hasLoadedMetadata, hasTriedPreviewFallback, isPreparingPreview]);

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
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle seeking
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
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
      </div>

      {src ? (
        <>
          {isPreparingPreview ? <div className="statusBanner">Generating compatible preview...</div> : null}
          <video
            ref={videoRef}
            className="video"
            src={playbackSource}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
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
