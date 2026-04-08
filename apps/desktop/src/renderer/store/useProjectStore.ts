import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project } from "../types/project";
import type { MediaItem } from "../types/media";
import type { Clip, Track } from "../types/timeline";

interface ProjectState {
  projects: Project[];
  currentProjectId: string;
  project: Project;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedMediaId: string | null;
  selectedRangeStartSec: number | null;
  selectedRangeEndSec: number | null;
  undoStackDepth: number;
  setProject: (project: Project) => void;
  createProject: (name?: string) => void;
  switchProject: (projectId: string) => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  selectMedia: (mediaId: string | null) => void;
  setSelectedRange: (startSec: number | null, endSec: number | null) => void;
  clearSelectedRange: () => void;
  addMedia: (item: MediaItem) => void;
  addClipFromMedia: (mediaId: string) => void;
  addVideoClip: (mediaId: string) => void;
  addAudioClip: (mediaId: string) => void;
  clearAllImportedMedia: () => void;
  addTrack: (track: Track) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<Clip>) => void;
  renameProject: (name: string) => void;
  resetProjectState: () => void;
}

const nextUndoDepth = (currentDepth: number): number => Math.min(currentDepth + 1, 100);

const now = () => new Date().toISOString();

const buildProject = (name = "Untitled Project"): Project => ({
  id: crypto.randomUUID(),
  name,
  media: [],
  tracks: [],
  subtitles: [],
  markers: [],
  annotations: [],
  createdAt: now(),
  updatedAt: now(),
});

const initialProject = buildProject();

const VIDEO_TRACK_ID = "track-video-main";

const buildTrack = (): Track => ({
  id: VIDEO_TRACK_ID,
  name: "Timeline Track",
  kind: "video",
  clips: [],
});

const ensureSingleTrack = (tracks: Track[]): Track[] => {
  const existing = tracks.find((track) => track.kind === "video" && track.id === VIDEO_TRACK_ID)
    ?? tracks.find((track) => track.kind === "video");

  if (existing) {
    return [
      {
        ...existing,
        id: VIDEO_TRACK_ID,
        name: "Timeline Track",
        kind: "video",
      },
    ];
  }

  return [buildTrack()];
};

const getTimelineTrackEnd = (track: Track): number =>
  track.clips.reduce((maxEnd, clip) => {
    const endFromBounds =
      typeof clip.timelineEnd === "number"
        ? clip.timelineEnd
        : (clip.timelineStart ?? clip.timelineStartSec ?? 0) + Math.max(0, clip.endSec - clip.startSec);
    return Math.max(maxEnd, endFromBounds);
  }, 0);

const appendClipToTrack = (tracks: Track[], trackKind: "video", clip: Clip): Track[] =>
  tracks.map((track) =>
    track.kind === trackKind
      ? {
          ...track,
          clips: [...track.clips, clip],
        }
      : track
  );

const updateActiveProject = (
  state: ProjectState,
  updater: (project: Project) => Project
): Pick<ProjectState, "project" | "projects"> => {
  const project = updater(state.project);

  return {
    project,
    projects: state.projects.map((item) => (item.id === project.id ? project : item)),
  };
};

// Sanitize a media item before persisting — only keep small, safe fields.
// This prevents blob URLs, large accumulated strings, or accidental extra
// fields from bloating localStorage and causing JSON.stringify failures.
const safeSerializeMediaItem = (item: MediaItem): MediaItem => ({
  id: item.id,
  name: item.name,
  // Blob URLs are session-only and invalid on reload — strip them.
  originalPath: /^blob:/i.test(item.originalPath) ? "" : item.originalPath,
  path: /^blob:/i.test(item.path) ? "" : item.path,
  type: item.type,
  durationSec: item.durationSec,
  hasAudio: item.hasAudio,
  thumbnailDir: item.thumbnailDir,
  thumbnailFps: item.thumbnailFps,
});

const stripImportedMedia = (project: Project): Project => ({
  ...project,
  media: [],
  tracks: project.tracks.map((track) => ({
    ...track,
    clips: [],
  })),
  updatedAt: now(),
});

const normalizeMediaItem = (item: MediaItem): MediaItem => {
  const originalPath = item.originalPath || item.path;
  const path = originalPath;

  return {
    ...item,
    originalPath,
    thumbnailDir: item.thumbnailDir,
    thumbnailFps: item.thumbnailFps,
    path,
  };
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [initialProject],
      currentProjectId: initialProject.id,
      project: initialProject,
      selectedClipId: null,
      selectedTrackId: null,
      selectedMediaId: null,
      selectedRangeStartSec: null,
      selectedRangeEndSec: null,
      undoStackDepth: 0,

      setProject: (project) =>
        set((state) => ({
          project,
          currentProjectId: project.id,
          projects: state.projects.some((item) => item.id === project.id)
            ? state.projects.map((item) => (item.id === project.id ? project : item))
            : [...state.projects, project],
          selectedClipId: null,
          selectedTrackId: null,
          selectedMediaId: null,
          selectedRangeStartSec: null,
          selectedRangeEndSec: null,
          undoStackDepth: 0,
        })),

      createProject: (name) => {
        const project = buildProject(name?.trim() || `Untitled Project ${new Date().toLocaleTimeString()}`);
        set((state) => ({
          project,
          currentProjectId: project.id,
          projects: [...state.projects, project],
          selectedClipId: null,
          selectedTrackId: null,
          selectedMediaId: null,
          selectedRangeStartSec: null,
          selectedRangeEndSec: null,
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        }));
      },

      switchProject: (projectId) =>
        set((state) => {
          const project = state.projects.find((item) => item.id === projectId) ?? state.project;
          return {
            project,
            currentProjectId: project.id,
            selectedClipId: null,
            selectedTrackId: null,
            selectedMediaId: null,
            selectedRangeStartSec: null,
            selectedRangeEndSec: null,
          };
        }),

      selectClip: (selectedClipId) => set({ selectedClipId }),
      selectTrack: (selectedTrackId) => set({ selectedTrackId }),
      selectMedia: (selectedMediaId) => set({ selectedMediaId }),
      setSelectedRange: (selectedRangeStartSec, selectedRangeEndSec) =>
        set({ selectedRangeStartSec, selectedRangeEndSec }),
      clearSelectedRange: () => set({ selectedRangeStartSec: null, selectedRangeEndSec: null }),

      addMedia: (item) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            media: [...project.media, normalizeMediaItem(item)],
            updatedAt: now(),
          })),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      addClipFromMedia: (mediaId) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => {
            const media = project.media.find((item) => item.id === mediaId);
            if (!media) {
              return project;
            }

            const durationSec = media.durationSec ?? 0;
            if (durationSec <= 0) {
              return project;
            }

            if (media.type === "unknown") {
              return project;
            }

            let tracks = ensureSingleTrack(project.tracks);
            const timelineTrack = tracks[0];
            const insertionStart = getTimelineTrackEnd(timelineTrack);

            const clip: Clip = {
              id: crypto.randomUUID(),
              mediaId,
              startSec: 0,
              endSec: durationSec,
              timelineStart: insertionStart,
              timelineEnd: insertionStart + durationSec,
              timelineStartSec: insertionStart,
              timelineEndSec: insertionStart + durationSec,
            };

            tracks = appendClipToTrack(tracks, "video", clip);

            return {
              ...project,
              tracks,
              updatedAt: now(),
            };
          }),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      addVideoClip: (mediaId) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => {
            const media = project.media.find((item) => item.id === mediaId);
            if (!media || media.type !== "video") {
              return project;
            }

            const durationSec = media.durationSec ?? 0;
            if (durationSec <= 0) {
              return project;
            }

            const tracks = ensureSingleTrack(project.tracks);
            const timelineStart = getTimelineTrackEnd(tracks[0]);

            const clip: Clip = {
              id: crypto.randomUUID(),
              mediaId,
              startSec: 0,
              endSec: durationSec,
              timelineStart,
              timelineEnd: timelineStart + durationSec,
              timelineStartSec: timelineStart,
              timelineEndSec: timelineStart + durationSec,
            };

            return {
              ...project,
              tracks: appendClipToTrack(tracks, "video", clip),
              updatedAt: now(),
            };
          }),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      addAudioClip: (mediaId) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => {
            const media = project.media.find((item) => item.id === mediaId);
            if (!media || (media.type !== "audio" && media.hasAudio !== true && media.type !== "video")) {
              return project;
            }

            const durationSec = media.durationSec ?? 0;
            if (durationSec <= 0) {
              return project;
            }

            const tracks = ensureSingleTrack(project.tracks);
            const timelineStart = getTimelineTrackEnd(tracks[0]);

            const clip: Clip = {
              id: crypto.randomUUID(),
              mediaId,
              startSec: 0,
              endSec: durationSec,
              timelineStart,
              timelineEnd: timelineStart + durationSec,
              timelineStartSec: timelineStart,
              timelineEndSec: timelineStart + durationSec,
            };

            return {
              ...project,
              tracks: appendClipToTrack(tracks, "video", clip),
              updatedAt: now(),
            };
          }),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      clearAllImportedMedia: () =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            media: [],
            tracks: project.tracks.map((track) => ({
              ...track,
              clips: [],
            })),
            updatedAt: now(),
          })),
          selectedMediaId: null,
          selectedClipId: null,
          selectedTrackId: null,
          selectedRangeStartSec: null,
          selectedRangeEndSec: null,
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      addTrack: (track) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            tracks:
              track.kind === "video"
                ? ensureSingleTrack([...project.tracks, track])
                : ensureSingleTrack(project.tracks),
            updatedAt: now(),
          })),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      updateClip: (trackId, clipId, patch) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            tracks: project.tracks.map((track) =>
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
          })),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      renameProject: (name) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            name,
            updatedAt: now(),
          })),
          undoStackDepth: nextUndoDepth(state.undoStackDepth),
        })),

      resetProjectState: () => {
        const freshProject = buildProject();
        set({
          projects: [freshProject],
          currentProjectId: freshProject.id,
          project: freshProject,
          selectedClipId: null,
          selectedTrackId: null,
          selectedMediaId: null,
          selectedRangeStartSec: null,
          selectedRangeEndSec: null,
          undoStackDepth: 0,
        });
      },
    }),
    {
      name: "ai-video-editor-projects",
      version: 2,
      migrate: (persistedState, version) => {
        const typedState = persistedState as Partial<ProjectState> | undefined;
        if (!typedState || version >= 2 || !typedState.projects) {
          return persistedState;
        }

        return {
          ...typedState,
          projects: typedState.projects.map(stripImportedMedia),
        };
      },
      partialize: (state) => ({
        projects: state.projects.map((project) => ({
          ...project,
          media: project.media.map(safeSerializeMediaItem),
        })),
        currentProjectId: state.currentProjectId,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<ProjectState> | undefined;
        const projects = typedState?.projects?.length ? typedState.projects : currentState.projects;
        const currentProjectId = typedState?.currentProjectId ?? projects[0].id;
        const project = projects.find((item) => item.id === currentProjectId) ?? projects[0];

        return {
          ...currentState,
          ...typedState,
          projects,
          currentProjectId,
          project,
        };
      },
    }
  )
);
