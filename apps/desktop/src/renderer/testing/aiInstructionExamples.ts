import type { AIInstructionSet } from "../types/aiInstructions";

/**
 * Example 1 — Delete the first 12 seconds of a 30-second scope.
 */
export const deleteStartSegment: AIInstructionSet = {
  version: 1,
  scope: { start: 0, end: 30 },
  actions: [
    {
      type: "deleteRange",
      start: 0,
      end: 12,
    },
  ],
};

/**
 * Example 2 — Split a clip at 10s, then move the first resulting segment to the end.
 * Requires real clip IDs to be substituted at execution time.
 */
export function splitAndMoveToEnd(clipId: string): AIInstructionSet {
  return {
    version: 1,
    scope: { start: 0, end: 40 },
    actions: [
      {
        type: "splitClip",
        clipId,
        splitTime: 10,
      },
    ],
  };
}

/**
 * Example 3 — Duplicate a selected clip.
 */
export function duplicateSelected(clipId: string): AIInstructionSet {
  return {
    version: 1,
    scope: { start: 0, end: 50 },
    actions: [
      {
        type: "duplicateClip",
        clipId,
      },
    ],
  };
}

/**
 * Example 4 — Move a clip to the end of the track.
 */
export function moveClipToEnd(clipId: string): AIInstructionSet {
  return {
    version: 1,
    actions: [
      {
        type: "moveClip",
        clipId,
        targetIndex: "end",
      },
    ],
  };
}

/**
 * Example 5 — Multi-action: delete a range then duplicate a clip.
 */
export function deleteRangeThenDuplicate(clipId: string): AIInstructionSet {
  return {
    version: 1,
    scope: { start: 0, end: 60 },
    actions: [
      {
        type: "deleteRange",
        start: 0,
        end: 5,
      },
      {
        type: "duplicateClip",
        clipId,
      },
    ],
  };
}
