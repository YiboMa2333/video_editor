import { create } from "zustand";

export type AIProgressStage =
  | "preparing"
  | "reading thumbnails"
  | "matching instructions"
  | "applying edits"
  | "done"
  | null;

type AIState = {
  isAIPanelOpen: boolean;
  isAIRunning: boolean;
  selectedPeriodStart: number | null;
  selectedPeriodEnd: number | null;
  instructionText: string;
  progressPercent: number;
  progressStage: AIProgressStage;
  openPanel: (startSec: number, endSec: number) => void;
  closePanel: () => void;
  setInstructionText: (text: string) => void;
  startRun: () => boolean;
  updateProgress: (percent: number, stage?: Exclude<AIProgressStage, null>) => void;
  finishRun: () => void;
  resetRun: () => void;
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
};

export const useAIStore = create<AIState>()((set, get) => ({
  isAIPanelOpen: false,
  isAIRunning: false,
  selectedPeriodStart: null,
  selectedPeriodEnd: null,
  instructionText: "",
  progressPercent: 0,
  progressStage: null,

  openPanel: (startSec, endSec) =>
    set({
      isAIPanelOpen: true,
      selectedPeriodStart: Math.max(0, startSec),
      selectedPeriodEnd: Math.max(0, endSec),
      progressPercent: 0,
      progressStage: null,
    }),

  closePanel: () => {
    if (get().isAIRunning) {
      return;
    }

    set({ isAIPanelOpen: false, progressPercent: 0, progressStage: null });
  },

  setInstructionText: (instructionText) => set({ instructionText }),

  startRun: () => {
    if (get().isAIRunning) {
      return false;
    }

    set({
      isAIRunning: true,
      progressPercent: 0,
      progressStage: "preparing",
    });

    return true;
  },

  updateProgress: (percent, stage) =>
    set((state) => ({
      progressPercent: clampPercent(percent),
      progressStage: stage ?? state.progressStage,
    })),

  finishRun: () =>
    set({
      isAIRunning: false,
      instructionText: "",
      progressPercent: 100,
      progressStage: "done",
    }),

  resetRun: () =>
    set({
      isAIRunning: false,
      instructionText: "",
      progressPercent: 0,
      progressStage: null,
    }),
}));
