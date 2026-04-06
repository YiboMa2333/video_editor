import { create } from "zustand";
import type { Project } from "../types/project";
import type { MediaItem } from "../types/media";
import type { Clip, Track } from "../types/timeline";

interface ProjectState {
  project: Project;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  setProject: (project: Project) => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  addMedia: (item: MediaItem) => void;
  addTrack: (track: Track) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<Clip>) => void;
}

const now = () => new Date().toISOString();

const initialProject: Project = {
  id: crypto.randomUUID(),
  name: "Untitled Project",
  media: [],
  tracks: [],
  subtitles: [],
  markers: [],
  annotations: [],
  createdAt: now(),
  updatedAt: now(),
};

export const useProjectStore = create<ProjectState>()((set) => ({
  project: initialProject,
  selectedClipId: null,
  selectedTrackId: null,

  setProject: (project) => set({ project }),
  selectClip: (selectedClipId) => set({ selectedClipId }),
  selectTrack: (selectedTrackId) => set({ selectedTrackId }),

  addMedia: (item) =>
    set((state) => ({
      project: {
        ...state.project,
        media: [...state.project.media, item],
        updatedAt: now(),
      },
    })),

  addTrack: (track) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: [...state.project.tracks, track],
        updatedAt: now(),
      },
    })),

  updateClip: (trackId, clipId, patch) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track) =>
          track.id !== trackId
            ? track
            : {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId ? { ...clip, ...patch } : clip
                ),
              }
        ),
        updatedAt: now(),
      },
    })),
}));
