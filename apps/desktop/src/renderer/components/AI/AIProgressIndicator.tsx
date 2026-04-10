import type { AIProgressStage } from "../../store/useAIStore";

type AIProgressIndicatorProps = {
  isVisible: boolean;
  progressPercent: number;
  stage: AIProgressStage;
};

const normalizePercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
};

export function AIProgressIndicator({ isVisible, progressPercent, stage }: AIProgressIndicatorProps) {
  if (!isVisible) {
    return null;
  }

  const safePercent = normalizePercent(progressPercent);

  return (
    <section className="ai-progress" aria-live="polite" aria-label="AI processing progress">
      <div className="ai-progress-row">
        <span>AI Progress</span>
        <strong>{Math.round(safePercent)}%</strong>
      </div>
      <div className="ai-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safePercent)}>
        <div className="ai-progress-fill" style={{ width: `${safePercent}%` }} />
      </div>
      {stage ? <div className="ai-progress-stage">Stage: {stage}</div> : null}
    </section>
  );
}
