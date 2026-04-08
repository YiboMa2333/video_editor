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
  setProject: (project: Project) => void;
  createProject: (name?: string) => void;
  switchProject: (projectId: string) => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  selectMedia: (mediaId: string | null) => void;
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
const AUDIO_TRACK_ID = "track-audio-main";

const buildTrack = (kind: Track["kind"]): Track => ({
  id: kind === "video" ? VIDEO_TRACK_ID : AUDIO_TRACK_ID,
  name: kind === "video" ? "Video Track" : "Audio Track",
  kind,
  clips: [],
});

const ensureTrack = (tracks: Track[], kind: "video" | "audio"): Track[] => {
  if (tracks.some((track) => track.kind === kind)) {
    return tracks;
  }

  return [...tracks, buildTrack(kind)];
};

const getTimelineTrackEnd = (track: Track): number =>
  track.clips.reduce((maxEnd, clip) => {
    const endFromBounds =
      typeof clip.timelineEnd === "number"
        ? clip.timelineEnd
        : (clip.timelineStart ?? clip.timelineStartSec ?? 0) + Math.max(0, clip.endSec - clip.startSec);
    return Math.max(maxEnd, endFromBounds);
  }, 0);

const appendClipToTrack = (tracks: Track[], trackKind: "video" | "audio", clip: Clip): Track[] =>
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

const stripImportedMedia = (project: Project): Project => ({
  ...project,
  media: [],
  tracks: project.tracks.map((track) => ({
    ...track,
    clips: [],
  })),
  updatedAt: now(),
});

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [initialProject],
      currentProjectId: initialProject.id,
      project: initialProject,
      selectedClipId: null,
      selectedTrackId: null,
      selectedMediaId: null,

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
          };
        }),

      selectClip: (selectedClipId) => set({ selectedClipId }),
      selectTrack: (selectedTrackId) => set({ selectedTrackId }),
      selectMedia: (selectedMediaId) => set({ selectedMediaId }),

      addMedia: (item) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            media: [...project.media, item],
            updatedAt: now(),
          })),
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

            let tracks = project.tracks;
            const shouldCreateVideoClip = media.type === "video";
            const shouldCreateAudioClip = media.type === "audio" || media.hasAudio === true || media.type === "video";

            if (!shouldCreateVideoClip && !shouldCreateAudioClip) {
              return project;
            }

            if (shouldCreateVideoClip) {
              tracks = ensureTrack(tracks, "video");
            }

            if (shouldCreateAudioClip) {
              tracks = ensureTrack(tracks, "audio");
            }

            const videoTrack = tracks.find((track) => track.kind === "video");
            const audioTrack = tracks.find((track) => track.kind === "audio");
            const insertionStart = Math.max(
              shouldCreateVideoClip && videoTrack ? getTimelineTrackEnd(videoTrack) : 0,
              shouldCreateAudioClip && audioTrack ? getTimelineTrackEnd(audioTrack) : 0
            );

            if (shouldCreateVideoClip) {
              const videoClip: Clip = {
                id: crypto.randomUUID(),
                mediaId,
                startSec: 0,
                endSec: durationSec,
                timelineStart: insertionStart,
                timelineEnd: insertionStart + durationSec,
                timelineStartSec: insertionStart,
                timelineEndSec: insertionStart + durationSec,
              };
              tracks = appendClipToTrack(tracks, "video", videoClip);
            }

            if (shouldCreateAudioClip) {
              const audioClip: Clip = {
                id: crypto.randomUUID(),
                mediaId,
                startSec: 0,
                endSec: durationSec,
                timelineStart: insertionStart,
                timelineEnd: insertionStart + durationSec,
                timelineStartSec: insertionStart,
                timelineEndSec: insertionStart + durationSec,
              };
              tracks = appendClipToTrack(tracks, "audio", audioClip);
            }

            return {
              ...project,
              tracks,
              updatedAt: now(),
            };
          }),
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

            const tracks = ensureTrack(project.tracks, "video");
            const videoTrack = tracks.find((track) => track.kind === "video");
            const timelineStart = videoTrack ? getTimelineTrackEnd(videoTrack) : 0;

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

            const tracks = ensureTrack(project.tracks, "audio");
            const audioTrack = tracks.find((track) => track.kind === "audio");
            const timelineStart = audioTrack ? getTimelineTrackEnd(audioTrack) : 0;

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
              tracks: appendClipToTrack(tracks, "audio", clip),
              updatedAt: now(),
            };
          }),
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
        })),

      addTrack: (track) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            tracks: [...project.tracks, track],
            updatedAt: now(),
          })),
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
        })),

      renameProject: (name) =>
        set((state) => ({
          ...updateActiveProject(state, (project) => ({
            ...project,
            name,
            updatedAt: now(),
          })),
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
        projects: state.projects,
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
