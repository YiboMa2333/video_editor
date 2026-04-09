import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project } from "../types/project";
import type { MediaItem } from "../types/media";
import type { Clip, Track } from "../types/timeline";
import {
  deleteRange as deleteTimelineRange,
  duplicateClip as duplicateTimelineClip,
  moveClip as moveTimelineClip,
  splitClip as splitTimelineClip,
} from "../../../../../packages/timeline-engine/src";

interface ProjectState {
  projects: Project[];
  currentProjectId: string;
  project: Project;
  undoProjectHistory: Project[];
  redoProjectHistory: Project[];
  historyUndoDepth: number;
  historyRedoDepth: number;
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
  splitSelectedClip: (splitTime: number) => void;
  deleteSelectedRange: () => void;
  deleteSelectedClip: () => void;
  deleteClipById: (trackId: string, clipId: string) => void;
  duplicateSelectedClip: () => void;
  moveSelectedClipLeft: () => void;
  moveSelectedClipRight: () => void;
  undo: () => void;
  redo: () => void;
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

const syncClipAliases = (clip: Clip): Clip => ({
  ...clip,
  timelineStartSec: clip.timelineStart,
  timelineEndSec: clip.timelineEnd,
});

const syncTrackClipAliases = (clips: Clip[]): Clip[] => clips.map(syncClipAliases);

const removeClipWithRipple = (
  clips: Clip[],
  clipId: string,
): { clips: Clip[]; didDelete: boolean } => {
  const deleteIndex = clips.findIndex((clip) => clip.id === clipId);
  if (deleteIndex < 0) {
    return { clips, didDelete: false };
  }

  const deletedClip = clips[deleteIndex];
  const deleteStart = deletedClip.timelineStart;
  const deleteEnd = deletedClip.timelineEnd;
  const deleteDuration = Math.max(0, deleteEnd - deleteStart);

  const nextClips = clips
    .filter((clip) => clip.id !== clipId)
    .map((clip) => {
      if (deleteDuration > 0 && clip.timelineStart >= deleteEnd) {
        return syncClipAliases(moveTimelineClip(clip, Math.max(0, clip.timelineStart - deleteDuration)));
      }

      return clip;
    });

  return { clips: nextClips, didDelete: true };
};

const cloneProject = (project: Project): Project => structuredClone(project);

const pushProjectHistory = (
  state: ProjectState,
): Pick<ProjectState, "undoProjectHistory" | "redoProjectHistory" | "historyUndoDepth" | "historyRedoDepth"> => {
  const undoProjectHistory = [...state.undoProjectHistory, cloneProject(state.project)].slice(-100);

  return {
    undoProjectHistory,
    redoProjectHistory: [],
    historyUndoDepth: undoProjectHistory.length,
    historyRedoDepth: 0,
  };
};

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
      undoProjectHistory: [],
      redoProjectHistory: [],
      historyUndoDepth: 0,
      historyRedoDepth: 0,
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
          undoProjectHistory: [],
          redoProjectHistory: [],
          historyUndoDepth: 0,
          historyRedoDepth: 0,
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
          undoProjectHistory: [],
          redoProjectHistory: [],
          historyUndoDepth: 0,
          historyRedoDepth: 0,
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
            undoProjectHistory: [],
            redoProjectHistory: [],
            historyUndoDepth: 0,
            historyRedoDepth: 0,
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

      splitSelectedClip: (splitTime) =>
        set((state) => {
          if (!state.selectedClipId || !Number.isFinite(splitTime)) {
            return state;
          }

          let nextSelectedClipId = state.selectedClipId;
          let nextSelectedTrackId = state.selectedTrackId;
          let nextSelectedMediaId = state.selectedMediaId;
          let didSplit = false;

          const nextState = {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => {
                const clipIndex = track.clips.findIndex((clip) => clip.id === state.selectedClipId);
                if (clipIndex < 0) {
                  return track;
                }

                const clip = track.clips[clipIndex];
                const result = splitTimelineClip(clip, splitTime, {
                  createId: () => crypto.randomUUID(),
                });

                if (!result) {
                  return track;
                }

                didSplit = true;
                nextSelectedClipId = result.right.id;
                nextSelectedTrackId = track.id;
                nextSelectedMediaId = clip.mediaId;

                const clips = [...track.clips];
                clips.splice(clipIndex, 1, syncClipAliases(result.left), syncClipAliases(result.right));

                return {
                  ...track,
                  clips,
                };
              }),
              updatedAt: didSplit ? now() : project.updatedAt,
            })),
          };

          if (!didSplit) {
            return state;
          }

          return {
            ...nextState,
            ...pushProjectHistory(state),
            selectedClipId: nextSelectedClipId,
            selectedTrackId: nextSelectedTrackId,
            selectedMediaId: nextSelectedMediaId,
            selectedRangeStartSec: null,
            selectedRangeEndSec: null,
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      deleteSelectedRange: () =>
        set((state) => {
          const start = state.selectedRangeStartSec;
          const end = state.selectedRangeEndSec;

          if (typeof start !== "number" || typeof end !== "number" || end <= start) {
            return state;
          }

          return {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => ({
                ...track,
                clips: syncTrackClipAliases(
                  deleteTimelineRange(track.clips, start, end, {
                    createId: () => crypto.randomUUID(),
                  }),
                ),
              })),
              updatedAt: now(),
            })),
            ...pushProjectHistory(state),
            selectedClipId: null,
            selectedRangeStartSec: null,
            selectedRangeEndSec: null,
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      deleteSelectedClip: () =>
        set((state) => {
          if (!state.selectedClipId) {
            return state;
          }

          let didDelete = false;

          const nextState = {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => {
                const result = removeClipWithRipple(track.clips, state.selectedClipId as string);
                if (!result.didDelete) {
                  return track;
                }

                didDelete = true;
                return {
                  ...track,
                  clips: result.clips,
                };
              }),
              updatedAt: didDelete ? now() : project.updatedAt,
            })),
          };

          if (!didDelete) {
            return state;
          }

          return {
            ...nextState,
            ...pushProjectHistory(state),
            selectedClipId: null,
            selectedTrackId: null,
            selectedRangeStartSec: null,
            selectedRangeEndSec: null,
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      deleteClipById: (trackId, clipId) =>
        set((state) => {
          let didDelete = false;

          const nextState = {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => {
                if (track.id !== trackId) {
                  return track;
                }

                const result = removeClipWithRipple(track.clips, clipId);
                if (!result.didDelete) {
                  return track;
                }

                didDelete = true;
                return {
                  ...track,
                  clips: result.clips,
                };
              }),
              updatedAt: didDelete ? now() : project.updatedAt,
            })),
          };

          if (!didDelete) {
            return state;
          }

          return {
            ...nextState,
            ...pushProjectHistory(state),
            selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
            selectedTrackId: state.selectedClipId === clipId ? null : state.selectedTrackId,
            selectedRangeStartSec: state.selectedClipId === clipId ? null : state.selectedRangeStartSec,
            selectedRangeEndSec: state.selectedClipId === clipId ? null : state.selectedRangeEndSec,
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      duplicateSelectedClip: () =>
        set((state) => {
          if (!state.selectedClipId) {
            return state;
          }

          let duplicatedClipId: string | null = null;
          let duplicatedTrackId: string | null = state.selectedTrackId;
          let duplicatedMediaId: string | null = state.selectedMediaId;

          const nextState = {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => {
                const clipIndex = track.clips.findIndex((clip) => clip.id === state.selectedClipId);
                if (clipIndex < 0) {
                  return track;
                }

                const selectedClip = track.clips[clipIndex];
                const duplicate = syncClipAliases(
                  duplicateTimelineClip(selectedClip, {
                    createId: () => crypto.randomUUID(),
                  }),
                );

                let cursor = duplicate.timelineEnd;
                const shiftedFollowing = track.clips.slice(clipIndex + 1).map((clip) => {
                  if (clip.timelineStart < cursor) {
                    const moved = syncClipAliases(moveTimelineClip(clip, cursor));
                    cursor = moved.timelineEnd;
                    return moved;
                  }

                  cursor = clip.timelineEnd;
                  return syncClipAliases(clip);
                });

                duplicatedClipId = duplicate.id;
                duplicatedTrackId = track.id;
                duplicatedMediaId = duplicate.mediaId;

                return {
                  ...track,
                  clips: [
                    ...track.clips.slice(0, clipIndex + 1),
                    duplicate,
                    ...shiftedFollowing,
                  ],
                };
              }),
              updatedAt: now(),
            })),
          };

          if (!duplicatedClipId) {
            return state;
          }

          return {
            ...nextState,
            ...pushProjectHistory(state),
            selectedClipId: duplicatedClipId,
            selectedTrackId: duplicatedTrackId,
            selectedMediaId: duplicatedMediaId,
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      moveSelectedClipLeft: () =>
        set((state) => {
          if (!state.selectedClipId) {
            return state;
          }

          let moved = false;

          const nextState = {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => {
                const clipIndex = track.clips.findIndex((clip) => clip.id === state.selectedClipId);
                if (clipIndex <= 0) {
                  return track;
                }

                const previousClip = track.clips[clipIndex - 1];
                const selectedClip = track.clips[clipIndex];
                const movedSelectedClip = syncClipAliases(
                  moveTimelineClip(selectedClip, previousClip.timelineStart),
                );
                const movedPreviousClip = syncClipAliases(
                  moveTimelineClip(previousClip, movedSelectedClip.timelineEnd),
                );

                moved = true;

                return {
                  ...track,
                  clips: [
                    ...track.clips.slice(0, clipIndex - 1),
                    movedSelectedClip,
                    movedPreviousClip,
                    ...track.clips.slice(clipIndex + 1),
                  ],
                };
              }),
              updatedAt: moved ? now() : project.updatedAt,
            })),
          };

          if (!moved) {
            return state;
          }

          return {
            ...nextState,
            ...pushProjectHistory(state),
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      moveSelectedClipRight: () =>
        set((state) => {
          if (!state.selectedClipId) {
            return state;
          }

          let moved = false;

          const nextState = {
            ...updateActiveProject(state, (project) => ({
              ...project,
              tracks: project.tracks.map((track) => {
                const clipIndex = track.clips.findIndex((clip) => clip.id === state.selectedClipId);
                if (clipIndex < 0 || clipIndex >= track.clips.length - 1) {
                  return track;
                }

                const selectedClip = track.clips[clipIndex];
                const nextClip = track.clips[clipIndex + 1];
                const movedNextClip = syncClipAliases(
                  moveTimelineClip(nextClip, selectedClip.timelineStart),
                );
                const movedSelectedClip = syncClipAliases(
                  moveTimelineClip(selectedClip, movedNextClip.timelineEnd),
                );

                moved = true;

                return {
                  ...track,
                  clips: [
                    ...track.clips.slice(0, clipIndex),
                    movedNextClip,
                    movedSelectedClip,
                    ...track.clips.slice(clipIndex + 2),
                  ],
                };
              }),
              updatedAt: moved ? now() : project.updatedAt,
            })),
          };

          if (!moved) {
            return state;
          }

          return {
            ...nextState,
            ...pushProjectHistory(state),
            undoStackDepth: nextUndoDepth(state.undoStackDepth),
          };
        }),

      undo: () =>
        set((state) => {
          if (state.undoProjectHistory.length === 0) {
            return state;
          }

          const previousProject = state.undoProjectHistory[state.undoProjectHistory.length - 1];
          const undoProjectHistory = state.undoProjectHistory.slice(0, -1);
          const redoProjectHistory = [...state.redoProjectHistory, cloneProject(state.project)].slice(-100);

          return {
            ...updateActiveProject(state, () => previousProject),
            undoProjectHistory,
            redoProjectHistory,
            historyUndoDepth: undoProjectHistory.length,
            historyRedoDepth: redoProjectHistory.length,
            selectedClipId: null,
            selectedTrackId: null,
            selectedRangeStartSec: null,
            selectedRangeEndSec: null,
          };
        }),

      redo: () =>
        set((state) => {
          if (state.redoProjectHistory.length === 0) {
            return state;
          }

          const nextProject = state.redoProjectHistory[state.redoProjectHistory.length - 1];
          const redoProjectHistory = state.redoProjectHistory.slice(0, -1);
          const undoProjectHistory = [...state.undoProjectHistory, cloneProject(state.project)].slice(-100);

          return {
            ...updateActiveProject(state, () => nextProject),
            undoProjectHistory,
            redoProjectHistory,
            historyUndoDepth: undoProjectHistory.length,
            historyRedoDepth: redoProjectHistory.length,
            selectedClipId: null,
            selectedTrackId: null,
            selectedRangeStartSec: null,
            selectedRangeEndSec: null,
          };
        }),

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
          undoProjectHistory: [],
          redoProjectHistory: [],
          historyUndoDepth: 0,
          historyRedoDepth: 0,
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
