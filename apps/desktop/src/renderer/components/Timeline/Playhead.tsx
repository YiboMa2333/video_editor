type PlayheadProps = {
  currentTimeSec: number;
  timelineDurationSec: number;
};

export function Playhead({ currentTimeSec, timelineDurationSec }: PlayheadProps) {
  const safeDuration = timelineDurationSec > 0 ? timelineDurationSec : 1;
  const leftPercent = (Math.max(0, Math.min(currentTimeSec, safeDuration)) / safeDuration) * 100;

  return <div className="timeline-playhead" style={{ left: `${leftPercent}%` }} aria-hidden />;
}
