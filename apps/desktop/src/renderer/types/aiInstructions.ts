export interface AISplitClipAction {
  type: "splitClip";
  clipId: string;
  splitTime: number;
}

export interface AIDeleteRangeAction {
  type: "deleteRange";
  start: number;
  end: number;
}

export interface AIDuplicateClipAction {
  type: "duplicateClip";
  clipId: string;
}

export interface AIMoveClipAction {
  type: "moveClip";
  clipId: string;
  targetIndex: number | "end";
}

export type AIAction =
  | AISplitClipAction
  | AIDeleteRangeAction
  | AIDuplicateClipAction
  | AIMoveClipAction;

export interface AIInstructionSet {
  version: 1;
  scope?: {
    start: number;
    end: number;
  };
  actions: AIAction[];
}
