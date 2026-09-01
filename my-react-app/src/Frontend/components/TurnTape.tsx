import type { TurnRecord } from "../types";

/** Tallest turn the tape can draw before it clips. */
const CEILING = 1500;
/** Slots reserved even early on, so the first turns read as spikes not plateaus. */
const MIN_SLOTS = 14;

interface Props {
  history: TurnRecord[];
  accent: string;
  width?: number;
  height?: number;
}

/**
 * Every turn a seat has played, drawn as one spike.
 *
 * Spike height is the points that were on the table at the turn's peak; a red
 * dot means the turn ended in a farkle and all of it was lost. Read across a
 * row and you can see a policy's personality: greedy runs are tall and littered
 * with red, careful ones are a low even staircase.
 */
export function TurnTape({ history, accent, width = 380, height = 34 }: Props) {
  if (history.length === 0) {
    return (
      <div className="tape-empty">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1={height - 1}
            x2={width}
            y2={height - 1}
            stroke="var(--hairline)"
            strokeWidth="1"
          />
        </svg>
        <span className="tape-empty-note">no turns yet</span>
      </div>
    );
  }

  const step = width / Math.max(history.length, MIN_SLOTS);
  const points: string[] = [];
  const marks: { x: number; y: number; busted: boolean }[] = [];

  history.forEach((turn, i) => {
    const x0 = i * step;
    const peakX = x0 + step * 0.66;
    const x1 = x0 + step;
    const y = height - 1 - Math.min(turn.peak / CEILING, 1) * (height - 5);
    points.push(
      `${x0.toFixed(1)},${height - 1}`,
      `${peakX.toFixed(1)},${y.toFixed(1)}`,
      `${x1.toFixed(1)},${height - 1}`,
    );
    if (turn.peak > 0) marks.push({ x: peakX, y, busted: turn.busted });
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${history.length} turns, ${history.filter((t) => t.busted).length} ended in a farkle`}
    >
      <line
        x1="0"
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke="var(--hairline)"
        strokeWidth="1"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {marks.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r="2.3"
          fill={m.busted ? "var(--danger)" : accent}
        />
      ))}
    </svg>
  );
}
