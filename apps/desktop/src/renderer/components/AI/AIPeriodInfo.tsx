type AIPeriodInfoProps = {
  startSec: number | null;
  endSec: number | null;
  minDurationSec: number;
};

const formatSec = (value: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${Math.max(0, value).toFixed(2)}s`;
};

export function AIPeriodInfo({ startSec, endSec, minDurationSec }: AIPeriodInfoProps) {
  const duration =
    typeof startSec === "number" &&
    typeof endSec === "number" &&
    Number.isFinite(startSec) &&
    Number.isFinite(endSec) &&
    endSec > startSec
      ? endSec - startSec
      : 0;

  const isValid = duration >= minDurationSec;

  return (
    <div className="ai-period-info" aria-live="polite">
      <div className="ai-period-row">
        <span>Start</span>
        <strong>{formatSec(startSec)}</strong>
      </div>
      <div className="ai-period-row">
        <span>End</span>
        <strong>{formatSec(endSec)}</strong>
      </div>
      <div className="ai-period-row">
        <span>Duration</span>
        <strong>{duration > 0 ? `${duration.toFixed(2)}s` : "--"}</strong>
      </div>
      <div className={`ai-period-validation ${isValid ? "ai-period-valid" : "ai-period-invalid"}`}>
        {isValid
          ? "Selection is ready for AI processing."
          : `Selection must be at least ${minDurationSec} seconds.`}
      </div>
    </div>
  );
}
