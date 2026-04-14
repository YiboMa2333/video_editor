import { useMemo, useState } from "react";
import { AIPeriodInfo } from "./AIPeriodInfo";
import { AIProgressIndicator } from "./AIProgressIndicator";
import { useAIStore } from "../../store/useAIStore";
import { useProjectStore } from "../../store/useProjectStore";
import { validateAIInstructions } from "../../services/aiInstructionValidator";
import { executeAIInstructions } from "../../services/aiInstructionExecutor";
import type { AIInstructionSet } from "../../types/aiInstructions";
import "./AIEditorPanel.css";

const MIN_AI_PERIOD_SEC = 10;

const sleep = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

export function AIEditorPanel() {
  const isAIPanelOpen = useAIStore((state) => state.isAIPanelOpen);
  const isAIRunning = useAIStore((state) => state.isAIRunning);
  const selectedPeriodStart = useAIStore((state) => state.selectedPeriodStart);
  const selectedPeriodEnd = useAIStore((state) => state.selectedPeriodEnd);
  const instructionText = useAIStore((state) => state.instructionText);
  const progressPercent = useAIStore((state) => state.progressPercent);
  const progressStage = useAIStore((state) => state.progressStage);
  const closePanel = useAIStore((state) => state.closePanel);
  const setInstructionText = useAIStore((state) => state.setInstructionText);
  const startRun = useAIStore((state) => state.startRun);
  const updateProgress = useAIStore((state) => state.updateProgress);
  const finishRun = useAIStore((state) => state.finishRun);
  const resetRun = useAIStore((state) => state.resetRun);

  const project = useProjectStore((state) => state.project);
  const applyAIEdit = useProjectStore((state) => state.applyAIEdit);

  const [lastError, setLastError] = useState<string | null>(null);

  const periodDurationSec = useMemo(() => {
    if (
      typeof selectedPeriodStart !== "number" ||
      typeof selectedPeriodEnd !== "number" ||
      selectedPeriodEnd <= selectedPeriodStart
    ) {
      return 0;
    }

    return selectedPeriodEnd - selectedPeriodStart;
  }, [selectedPeriodEnd, selectedPeriodStart]);

  const hasValidPeriod = periodDurationSec > 0;
  const meetsMinPeriod = periodDurationSec >= MIN_AI_PERIOD_SEC;
  const canStart = hasValidPeriod && meetsMinPeriod && instructionText.trim().length > 0 && !isAIRunning;

  const runAIExecution = async () => {
    const started = startRun();
    if (!started) {
      return;
    }

    setLastError(null);

    try {
      // Stage 1: Parse JSON
      updateProgress(10, "preparing");
      await sleep(100);

      let parsed: unknown;
      try {
        parsed = JSON.parse(instructionText);
      } catch {
        setLastError("Invalid JSON. Please paste valid AI instruction JSON.");
        resetRun();
        return;
      }

      // Stage 2: Validate
      updateProgress(30, "validating instructions");
      await sleep(100);

      const validation = validateAIInstructions(parsed);
      if (!validation.valid) {
        setLastError(validation.errors.join("\n"));
        resetRun();
        return;
      }

      const instructions = parsed as AIInstructionSet;

      // Stage 3: Execute
      updateProgress(60, "applying edits");
      await sleep(100);

      const result = executeAIInstructions(project, instructions);

      if (result.errors.length > 0 && result.appliedCount === 0) {
        setLastError(result.errors.join("\n"));
        resetRun();
        return;
      }

      // Stage 4: Apply as one grouped undo entry
      updateProgress(90, "applying edits");
      applyAIEdit(() => result.project);

      if (result.errors.length > 0) {
        setLastError(`Applied ${result.appliedCount} action(s) with warnings:\n${result.errors.join("\n")}`);
      }

      finishRun();
    } catch {
      resetRun();
      setLastError("Unexpected error during AI execution.");
    }
  };

  if (!isAIPanelOpen) {
    return null;
  }

  return (
    <div className="ai-editor-backdrop" role="presentation">
      <section
        className="ai-editor-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-editor-title"
      >
        <header className="ai-editor-header">
          <h2 id="ai-editor-title">AI Segment</h2>
          <p>Run AI editing for a selected timeline period.</p>
        </header>

        <AIPeriodInfo
          startSec={selectedPeriodStart}
          endSec={selectedPeriodEnd}
          minDurationSec={MIN_AI_PERIOD_SEC}
        />

        <label className="ai-editor-field" htmlFor="ai-instructions">
          <span>Instructions (paste JSON)</span>
          <textarea
            id="ai-instructions"
            placeholder='{"version":1,"actions":[{"type":"deleteRange","start":0,"end":12}]}'
            value={instructionText}
            disabled={isAIRunning}
            onChange={(event) => { setInstructionText(event.target.value); setLastError(null); }}
          />
        </label>

        {!meetsMinPeriod ? (
          <p className="ai-editor-warning">
            Selected period must be at least {MIN_AI_PERIOD_SEC} seconds before AI can start.
          </p>
        ) : null}

        {lastError ? (
          <pre className="ai-editor-error">{lastError}</pre>
        ) : null}

        <AIProgressIndicator
          isVisible={isAIRunning}
          progressPercent={progressPercent}
          stage={progressStage}
        />

        <footer className="ai-editor-actions">
          <button
            type="button"
            className="ai-editor-cancel"
            onClick={closePanel}
            disabled={isAIRunning}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ai-editor-start"
            onClick={() => void runAIExecution()}
            disabled={!canStart}
          >
            {isAIRunning ? "Running..." : "Start"}
          </button>
        </footer>
      </section>
    </div>
  );
}
