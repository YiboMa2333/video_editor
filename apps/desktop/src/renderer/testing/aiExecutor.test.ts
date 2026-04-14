import { describe, it, expect } from "vitest";
import { executeAIInstructions } from "../services/aiInstructionExecutor";
import { validateAIInstructions } from "../services/aiInstructionValidator";
import {
  deleteStartSegment,
  splitAndMoveToEnd,
  duplicateSelected,
  moveClipToEnd,
  deleteRangeThenDuplicate,
} from "./aiInstructionExamples";
import type { AIInstructionSet } from "../types/aiInstructions";
import type { Clip, Track } from "../types/timeline";
import type { Project } from "../types/project";

// ── Helpers ──

const makeClip = (id: string, mediaId: string, startSec: number, endSec: number, timelineStart: number): Clip => ({
  id,
  mediaId,
  startSec,
  endSec,
  timelineStart,
  timelineEnd: timelineStart + (endSec - startSec),
  timelineStartSec: timelineStart,
  timelineEndSec: timelineStart + (endSec - startSec),
});

const makeProject = (clips: Clip[]): Project => ({
  id: "test-project",
  name: "Test",
  media: [],
  tracks: [
    {
      id: "track-video-main",
      name: "Timeline Track",
      kind: "video",
      clips,
    },
  ],
  subtitles: [],
  markers: [],
  annotations: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const getClips = (project: Project): Clip[] => project.tracks[0]?.clips ?? [];

const totalDuration = (clips: Clip[]): number =>
  clips.length === 0 ? 0 : Math.max(...clips.map((c) => c.timelineEnd));

// ── Validation tests ──

describe("validateAIInstructions", () => {
  it("accepts a valid deleteRange instruction", () => {
    const result = validateAIInstructions(deleteStartSegment);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a valid splitClip instruction", () => {
    const result = validateAIInstructions(splitAndMoveToEnd("clip-a"));
    expect(result.valid).toBe(true);
  });

  it("accepts a valid duplicateClip instruction", () => {
    const result = validateAIInstructions(duplicateSelected("clip-a"));
    expect(result.valid).toBe(true);
  });

  it("accepts a valid moveClip instruction", () => {
    const result = validateAIInstructions(moveClipToEnd("clip-a"));
    expect(result.valid).toBe(true);
  });

  it("rejects missing version", () => {
    const result = validateAIInstructions({ actions: [{ type: "deleteRange", start: 0, end: 5 }] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("rejects empty actions array", () => {
    const result = validateAIInstructions({ version: 1, actions: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("empty"))).toBe(true);
  });

  it("rejects deleteRange with end <= start", () => {
    const result = validateAIInstructions({
      version: 1,
      actions: [{ type: "deleteRange", start: 10, end: 5 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("greater than"))).toBe(true);
  });

  it("rejects negative splitTime", () => {
    const result = validateAIInstructions({
      version: 1,
      actions: [{ type: "splitClip", clipId: "c1", splitTime: -1 }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects splitClip outside scope", () => {
    const result = validateAIInstructions({
      version: 1,
      scope: { start: 0, end: 10 },
      actions: [{ type: "splitClip", clipId: "c1", splitTime: 15 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("outside scope"))).toBe(true);
  });

  it("rejects unsupported action type", () => {
    const result = validateAIInstructions({
      version: 1,
      actions: [{ type: "mergeClips" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unsupported"))).toBe(true);
  });

  it("rejects moveClip with missing clipId", () => {
    const result = validateAIInstructions({
      version: 1,
      actions: [{ type: "moveClip", clipId: "", targetIndex: 0 }],
    });
    expect(result.valid).toBe(false);
  });
});

// ── Executor tests ──

describe("executeAIInstructions — deleteRange", () => {
  it("removes the first 12 seconds from a 30-second clip", () => {
    const clip = makeClip("clip-a", "media-1", 0, 30, 0);
    const project = makeProject([clip]);

    const result = executeAIInstructions(project, deleteStartSegment);

    expect(result.appliedCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    const clips = getClips(result.project);
    // The remaining portion should be 18 seconds (30 - 12)
    expect(clips.length).toBe(1);
    expect(clips[0].timelineStart).toBe(0);
    expect(clips[0].timelineEnd).toBeCloseTo(18, 5);
    expect(clips[0].startSec).toBeCloseTo(12, 5);
    expect(clips[0].endSec).toBe(30);
  });

  it("handles delete range across two clips", () => {
    const clip1 = makeClip("clip-a", "m1", 0, 20, 0);
    const clip2 = makeClip("clip-b", "m2", 0, 20, 20);
    const project = makeProject([clip1, clip2]);

    const instructions: AIInstructionSet = {
      version: 1,
      actions: [{ type: "deleteRange", start: 15, end: 25 }],
    };

    const result = executeAIInstructions(project, instructions);
    expect(result.appliedCount).toBe(1);

    const clips = getClips(result.project);
    // clip-a trimmed to [0,15], clip-b trimmed to [25→15, 40→30] → shifted left by 10
    const totalEnd = totalDuration(clips);
    expect(totalEnd).toBeCloseTo(30, 5); // 40 total - 10 deleted
  });
});

describe("executeAIInstructions — splitClip", () => {
  it("splits a clip into two segments at the specified time", () => {
    const clip = makeClip("clip-a", "media-1", 0, 30, 0);
    const project = makeProject([clip]);

    const instructions = splitAndMoveToEnd("clip-a");
    // Only the first action (split at 10s)
    const splitOnly: AIInstructionSet = {
      version: 1,
      actions: [instructions.actions[0]],
    };

    const result = executeAIInstructions(project, splitOnly);

    expect(result.appliedCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    const clips = getClips(result.project);
    expect(clips.length).toBe(2);

    // Left segment: 0-10s
    expect(clips[0].timelineStart).toBe(0);
    expect(clips[0].timelineEnd).toBeCloseTo(10, 5);
    expect(clips[0].startSec).toBe(0);
    expect(clips[0].endSec).toBeCloseTo(10, 5);

    // Right segment: 10-30s
    expect(clips[1].timelineStart).toBeCloseTo(10, 5);
    expect(clips[1].timelineEnd).toBeCloseTo(30, 5);
    expect(clips[1].startSec).toBeCloseTo(10, 5);
    expect(clips[1].endSec).toBe(30);
  });

  it("returns error for splitTime outside clip bounds", () => {
    const clip = makeClip("clip-a", "media-1", 0, 10, 0);
    const project = makeProject([clip]);

    const instructions: AIInstructionSet = {
      version: 1,
      actions: [{ type: "splitClip", clipId: "clip-a", splitTime: 15 }],
    };

    const result = executeAIInstructions(project, instructions);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.appliedCount).toBe(0);
  });
});

describe("executeAIInstructions — duplicateClip", () => {
  it("duplicates a clip and places it after the original", () => {
    const clip = makeClip("clip-a", "media-1", 0, 20, 0);
    const project = makeProject([clip]);

    const result = executeAIInstructions(project, duplicateSelected("clip-a"));

    expect(result.appliedCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    const clips = getClips(result.project);
    expect(clips.length).toBe(2);

    // Original
    expect(clips[0].timelineStart).toBe(0);
    expect(clips[0].timelineEnd).toBeCloseTo(20, 5);

    // Duplicate immediately after
    expect(clips[1].timelineStart).toBeCloseTo(20, 5);
    expect(clips[1].timelineEnd).toBeCloseTo(40, 5);
    expect(clips[1].startSec).toBe(0);
    expect(clips[1].endSec).toBe(20);

    // Different IDs
    expect(clips[1].id).not.toBe(clips[0].id);
  });

  it("returns error for non-existent clipId", () => {
    const clip = makeClip("clip-a", "m1", 0, 10, 0);
    const project = makeProject([clip]);

    const result = executeAIInstructions(project, duplicateSelected("non-existent"));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.appliedCount).toBe(0);
  });
});

describe("executeAIInstructions — moveClip", () => {
  it("moves the first clip to the end of the track", () => {
    const clip1 = makeClip("clip-a", "m1", 0, 10, 0);
    const clip2 = makeClip("clip-b", "m2", 0, 15, 10);
    const project = makeProject([clip1, clip2]);

    const result = executeAIInstructions(project, moveClipToEnd("clip-a"));

    expect(result.appliedCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    const clips = getClips(result.project);
    expect(clips.length).toBe(2);

    // clip-b should now be first, clip-a should be at the end
    expect(clips[0].id).toBe("clip-b");
    expect(clips[0].timelineStart).toBe(0);
    expect(clips[0].timelineEnd).toBeCloseTo(15, 5);

    expect(clips[1].id).toBe("clip-a");
    expect(clips[1].timelineStart).toBeCloseTo(15, 5);
    expect(clips[1].timelineEnd).toBeCloseTo(25, 5);
  });

  it("move to index 0 places clip first", () => {
    const clip1 = makeClip("clip-a", "m1", 0, 10, 0);
    const clip2 = makeClip("clip-b", "m2", 0, 15, 10);
    const project = makeProject([clip1, clip2]);

    const instructions: AIInstructionSet = {
      version: 1,
      actions: [{ type: "moveClip", clipId: "clip-b", targetIndex: 0 }],
    };

    const result = executeAIInstructions(project, instructions);
    expect(result.appliedCount).toBe(1);

    const clips = getClips(result.project);
    expect(clips[0].id).toBe("clip-b");
    expect(clips[1].id).toBe("clip-a");
  });
});

describe("executeAIInstructions — multi-action", () => {
  it("deleteRange then duplicateClip in sequence", () => {
    // 60s clip
    const clip = makeClip("clip-a", "m1", 0, 60, 0);
    const project = makeProject([clip]);

    // Delete 0-5s, then duplicate the remaining clip
    const result = executeAIInstructions(project, deleteRangeThenDuplicate("clip-a"));

    // deleteRange should succeed; duplicateClip uses original "clip-a" which
    // after deleteRange is the remaining 5-60s portion (id preserved when clip start >= end of delete)
    expect(result.appliedCount).toBeGreaterThanOrEqual(1);

    const clips = getClips(result.project);
    // Delete removed 5s (60→55), then duplicate doubled it (55+55=110)
    const total = totalDuration(clips);
    expect(total).toBeCloseTo(110, 5);
  });

  it("reports partial errors when one action fails in a multi-action set", () => {
    const clip = makeClip("clip-a", "m1", 0, 20, 0);
    const project = makeProject([clip]);

    const instructions: AIInstructionSet = {
      version: 1,
      actions: [
        { type: "deleteRange", start: 0, end: 5 },
        { type: "duplicateClip", clipId: "non-existent" },
      ],
    };

    const result = executeAIInstructions(project, instructions);
    // First action should succeed, second should error
    expect(result.appliedCount).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("non-existent");
  });
});

describe("executeAIInstructions — timeline integrity", () => {
  it("clips do not overlap after any operation", () => {
    const clip1 = makeClip("clip-a", "m1", 0, 15, 0);
    const clip2 = makeClip("clip-b", "m2", 0, 15, 15);
    const clip3 = makeClip("clip-c", "m3", 0, 10, 30);
    const project = makeProject([clip1, clip2, clip3]);

    const instructions: AIInstructionSet = {
      version: 1,
      actions: [
        { type: "duplicateClip", clipId: "clip-b" },
        { type: "moveClip", clipId: "clip-a", targetIndex: "end" },
      ],
    };

    const result = executeAIInstructions(project, instructions);
    const clips = getClips(result.project);

    // Verify no overlaps
    const sorted = [...clips].sort((a, b) => a.timelineStart - b.timelineStart);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].timelineStart).toBeGreaterThanOrEqual(sorted[i - 1].timelineEnd - 0.001);
    }
  });

  it("total duration is preserved for move operations", () => {
    const clip1 = makeClip("clip-a", "m1", 0, 10, 0);
    const clip2 = makeClip("clip-b", "m2", 0, 20, 10);
    const project = makeProject([clip1, clip2]);

    const before = totalDuration(getClips(project));

    const result = executeAIInstructions(project, moveClipToEnd("clip-a"));
    const after = totalDuration(getClips(result.project));

    expect(after).toBeCloseTo(before, 5);
  });
});
