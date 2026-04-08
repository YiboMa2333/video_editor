type PlayheadProps = {
  currentTimeSec: number;
  timelineDurationSec: number;
  className?: string;
};

export function Playhead({ currentTimeSec, timelineDurationSec, className }: PlayheadProps) {
  const safeDuration = timelineDurationSec > 0 ? timelineDurationSec : 1;
  const safeCurrent = Number.isFinite(currentTimeSec)
    ? Math.max(0, Math.min(currentTimeSec, safeDuration))
    : 0;
  const leftPercent = (safeCurrent / safeDuration) * 100;

  const classes = className ? `timeline-playhead ${className}` : "timeline-playhead";
  return <div className={classes} style={{ left: `${leftPercent}%` }} aria-hidden />;
}
