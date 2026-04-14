import type { AIAction, AIInstructionSet } from "../types/aiInstructions";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SUPPORTED_TYPES = new Set(["splitClip", "deleteRange", "duplicateClip", "moveClip"]);

function validateAction(action: AIAction, index: number, scope?: { start: number; end: number }): string[] {
  const errors: string[] = [];
  const label = `actions[${index}]`;

  if (!action || typeof action !== "object") {
    errors.push(`${label}: action must be an object.`);
    return errors;
  }

  if (!SUPPORTED_TYPES.has(action.type)) {
    errors.push(`${label}: unsupported action type "${String((action as { type?: unknown }).type)}".`);
    return errors;
  }

  switch (action.type) {
    case "splitClip": {
      if (typeof action.clipId !== "string" || action.clipId.length === 0) {
        errors.push(`${label}: splitClip requires a non-empty clipId.`);
      }
      if (typeof action.splitTime !== "number" || !Number.isFinite(action.splitTime) || action.splitTime < 0) {
        errors.push(`${label}: splitClip requires a non-negative finite splitTime.`);
      }
      if (scope && typeof action.splitTime === "number") {
        if (action.splitTime < scope.start || action.splitTime > scope.end) {
          errors.push(`${label}: splitTime ${action.splitTime} is outside scope [${scope.start}, ${scope.end}].`);
        }
      }
      break;
    }

    case "deleteRange": {
      if (typeof action.start !== "number" || !Number.isFinite(action.start) || action.start < 0) {
        errors.push(`${label}: deleteRange requires a non-negative finite start.`);
      }
      if (typeof action.end !== "number" || !Number.isFinite(action.end) || action.end < 0) {
        errors.push(`${label}: deleteRange requires a non-negative finite end.`);
      }
      if (typeof action.start === "number" && typeof action.end === "number" && action.end <= action.start) {
        errors.push(`${label}: deleteRange end (${action.end}) must be greater than start (${action.start}).`);
      }
      if (scope && typeof action.start === "number" && typeof action.end === "number") {
        if (action.start < scope.start || action.end > scope.end) {
          errors.push(`${label}: deleteRange [${action.start}, ${action.end}] is outside scope [${scope.start}, ${scope.end}].`);
        }
      }
      break;
    }

    case "duplicateClip": {
      if (typeof action.clipId !== "string" || action.clipId.length === 0) {
        errors.push(`${label}: duplicateClip requires a non-empty clipId.`);
      }
      break;
    }

    case "moveClip": {
      if (typeof action.clipId !== "string" || action.clipId.length === 0) {
        errors.push(`${label}: moveClip requires a non-empty clipId.`);
      }
      if (action.targetIndex !== "end" && (typeof action.targetIndex !== "number" || !Number.isFinite(action.targetIndex) || action.targetIndex < 0)) {
        errors.push(`${label}: moveClip requires targetIndex to be a non-negative integer or "end".`);
      }
      break;
    }
  }

  return errors;
}

export function validateAIInstructions(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Input must be a JSON object."] };
  }

  const data = input as Record<string, unknown>;

  if (data.version !== 1) {
    errors.push(`version must be 1, got ${JSON.stringify(data.version)}.`);
  }

  if (data.scope !== undefined) {
    if (!data.scope || typeof data.scope !== "object") {
      errors.push("scope must be an object with start and end.");
    } else {
      const scope = data.scope as Record<string, unknown>;
      if (typeof scope.start !== "number" || !Number.isFinite(scope.start) || scope.start < 0) {
        errors.push("scope.start must be a non-negative finite number.");
      }
      if (typeof scope.end !== "number" || !Number.isFinite(scope.end) || scope.end < 0) {
        errors.push("scope.end must be a non-negative finite number.");
      }
      if (typeof scope.start === "number" && typeof scope.end === "number" && scope.end <= scope.start) {
        errors.push(`scope.end (${scope.end}) must be greater than scope.start (${scope.start}).`);
      }
    }
  }

  if (!Array.isArray(data.actions)) {
    errors.push("actions must be an array.");
    return { valid: false, errors };
  }

  if (data.actions.length === 0) {
    errors.push("actions array must not be empty.");
  }

  const scope = data.scope && typeof data.scope === "object"
    ? data.scope as { start: number; end: number }
    : undefined;

  for (let i = 0; i < data.actions.length; i++) {
    errors.push(...validateAction(data.actions[i] as AIAction, i, scope));
  }

  return { valid: errors.length === 0, errors };
}
