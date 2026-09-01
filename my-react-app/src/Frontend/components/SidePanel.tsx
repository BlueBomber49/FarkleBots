import "./SidePanel.css";
import { TurnTape } from "./TurnTape";
import { ACCENT_VAR } from "./accents";
import type { GameSnapshot } from "../types";

export type PanelMode = "play" | "stats";

/**
 * The right-hand column. `play` keeps it friendly: the current seat's reasoning
 * in plain words plus the two headline numbers. `stats` widens it and shows the
 * full decision math and a turn tape per seat.
 *
 * Only this column swaps, so the table never moves when you flip the toggle.
 */
export function SidePanel({
  snapshot,
  mode,
}: {
  snapshot: GameSnapshot;
  mode: PanelMode;
}) {
  const active = snapshot.seats.find((s) => s.isActive) ?? snapshot.seats[0];
  const accent = ACCENT_VAR[active.accent];
  const math = snapshot.math;

  if (mode === "play") {
    return (
      <aside className="panel panel-play">
        <div className="think">
          <div className="think-head">
            <span className="think-dot" style={{ background: accent }} />
            <span className="think-name">{active.name} is thinking</span>
          </div>
          <p className="think-body">
            {math?.reasoning ?? "Waiting for the dice."}
          </p>
          {math && (
            <div className="chips">
              <span className="chip chip-bad n">
                bust {(math.farkleChance * 100).toFixed(1)}%
              </span>
              <span className="chip chip-good n">
                roll +{Math.max(math.expectedIfRoll - math.certainIfBank, 0)}
              </span>
            </div>
          )}
        </div>

        <div className="recent">
          <div className="label">Recent</div>
          <ul className="log">
            {snapshot.log.slice(0, 8).map((entry, i) => (
              <li key={entry.id} className={i === 0 ? "" : "log-dim"}>
                <span
                  className="log-dot"
                  style={{ background: ACCENT_VAR[entry.accent] }}
                />
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel panel-stats">
      <div className="math">
        <div className="math-head">
          <span className="math-title">This decision</span>
          {math ? (
            <span className={`verdict verdict-${math.verdict.toLowerCase()}`}>
              {math.verdict}
            </span>
          ) : (
            <span className={`verdict verdict-pending`}>Pending</span>
          )}
        </div>
        {math ? (
          <>
            <div className="math-grid">
              <Cell label="Dice left" value={String(math.diceLeft)} />
              <Cell
                label="Chance of a farkle"
                value={`${(math.farkleChance * 100).toFixed(1)}%`}
                tone="bad"
              />
              <Cell
                label="Expected if I roll"
                value={String(math.expectedIfRoll)}
                tone="good"
              />
              <Cell
                label="Certain if I bank"
                value={String(math.certainIfBank)}
              />
            </div>
            <p className="math-why">{math.reasoning}</p>
          </>
        ) : (
          <>
            <div className="math-grid">
              <Cell label="Dice left" value="-" />
              <Cell label="Chance of a farkle" value="-" tone="bad" />
              <Cell label="Expected if I roll" value="-" tone="good" />
              <Cell label="Certain if I bank" value="-" />
            </div>
            <p className="math-why">Roll to see probabilities</p>
          </>
        )}
      </div>

      <div className="tapes-head">
        <span className="label">Turn history</span>
        <span className="tapes-key">
          height = points risked · red = farkled
        </span>
      </div>

      <div className="tapes">
        {snapshot.seats.map((seat) => (
          <div key={seat.id} className="tape-card">
            <div className="tape-head">
              <span className="tape-who">
                <span
                  className="log-dot"
                  style={{ background: ACCENT_VAR[seat.accent] }}
                />
                <span className="tape-name">{seat.name}</span>
              </span>
              <span className="tape-stats">
                <span className="n">avg {seat.avgTurn}</span>
                <span className={`n${seat.farkleRate >= 0.3 ? " hot" : ""}`}>
                  {Math.round(seat.farkleRate * 100)}% farkle
                </span>
              </span>
            </div>
            <TurnTape history={seat.history} accent={ACCENT_VAR[seat.accent]} />
          </div>
        ))}
      </div>
    </aside>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="cell">
      <div className="cell-label">{label}</div>
      <div className={`cell-value n${tone ? ` cell-${tone}` : ""}`}>
        {value}
      </div>
    </div>
  );
}
