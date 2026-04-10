import { useMemo } from "react";
import { AIPeriodInfo } from "./AIPeriodInfo";
import { AIProgressIndicator } from "./AIProgressIndicator";
import { useAIStore } from "../../store/useAIStore";
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

  const runDemoAI = async () => {
    const started = startRun();
    if (!started) {
      return;
    }

    try {
      updateProgress(10, "preparing");
      await sleep(350);
      updateProgress(35, "reading thumbnails");
      await sleep(500);
      updateProgress(65, "matching instructions");
      await sleep(650);
      updateProgress(90, "applying edits");
      await sleep(500);
      finishRun();
    } catch {
      resetRun();
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
          <span>Instructions</span>
          <textarea
            id="ai-instructions"
            placeholder="Example: remove pauses and keep energetic moments"
            value={instructionText}
            disabled={isAIRunning}
            onChange={(event) => setInstructionText(event.target.value)}
          />
        </label>

        {!meetsMinPeriod ? (
          <p className="ai-editor-warning">
            Selected period must be at least {MIN_AI_PERIOD_SEC} seconds before AI can start.
          </p>
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
            onClick={() => void runDemoAI()}
            disabled={!canStart}
          >
            {isAIRunning ? "Running..." : "Start"}
          </button>
        </footer>
      </section>
    </div>
  );
}
