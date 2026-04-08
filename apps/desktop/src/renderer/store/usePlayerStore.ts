import { create } from "zustand";

type PlayerState = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isScrubbing: boolean;
  wasPlayingBeforeScrub: boolean;
  scrubTime: number | null;
  seekRequestTime: number | null;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsScrubbing: (isScrubbing: boolean) => void;
  setWasPlayingBeforeScrub: (wasPlayingBeforeScrub: boolean) => void;
  setScrubTime: (time: number | null) => void;
  requestSeek: (timelineTime: number) => void;
  clearSeekRequest: () => void;
  beginScrub: (initialTimelineTime?: number) => void;
  endScrub: () => void;
  reset: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isScrubbing: false,
  wasPlayingBeforeScrub: false,
  scrubTime: null,
  seekRequestTime: null,
  setCurrentTime: (time) =>
    set({ currentTime: Number.isFinite(time) ? Math.max(0, time) : 0 }),
  setDuration: (duration) =>
    set({ duration: Number.isFinite(duration) ? Math.max(0, duration) : 0 }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsScrubbing: (isScrubbing) => set({ isScrubbing }),
  setWasPlayingBeforeScrub: (wasPlayingBeforeScrub) => set({ wasPlayingBeforeScrub }),
  setScrubTime: (time) =>
    set({
      scrubTime: time === null ? null : Number.isFinite(time) ? Math.max(0, time) : null,
    }),
  requestSeek: (timelineTime) =>
    set({ seekRequestTime: Number.isFinite(timelineTime) ? Math.max(0, timelineTime) : 0 }),
  clearSeekRequest: () => set({ seekRequestTime: null }),
  beginScrub: (initialTimelineTime) =>
    set((state) => ({
      isScrubbing: true,
      wasPlayingBeforeScrub: state.isPlaying,
      scrubTime:
        typeof initialTimelineTime === "number" && Number.isFinite(initialTimelineTime)
          ? Math.max(0, initialTimelineTime)
          : state.currentTime,
    })),
  endScrub: () => set({ isScrubbing: false }),
  reset: () =>
    set({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isScrubbing: false,
      wasPlayingBeforeScrub: false,
      scrubTime: null,
      seekRequestTime: null,
    }),
}));
