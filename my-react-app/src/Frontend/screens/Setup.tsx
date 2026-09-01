import { useState } from "react";
import "./Setup.css";
import { STRATEGIES, BOT_STRATEGY_IDS } from "../engine/strategies";
import { ACCENT_ORDER, ACCENT_VAR } from "../components/accents";
import type { SeatConfig, StrategyId } from "../types";

const TARGETS = [2000, 5000, 10000];
const MAX_SEATS = 5;

const DEFAULT_SEATS: SeatConfig[] = [
  { id: "s1", name: "Greedy", strategy: "greedy", accent: "greedy" },
  { id: "s2", name: "Cautious", strategy: "safe", accent: "cautious" },
  { id: "s3", name: "Adaptive", strategy: "safeWhenAhead", accent: "adaptive" },
  { id: "s4", name: "You", strategy: "human", accent: "human" },
];

export function Setup({
  onStart,
}: {
  onStart: (seats: SeatConfig[], target: number) => void;
}) {
  const [seats, setSeats] = useState<SeatConfig[]>(DEFAULT_SEATS);
  const [target, setTarget] = useState(10000);

  const update = (id: string, patch: Partial<SeatConfig>) =>
    setSeats((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSeat = () => {
    if (seats.length >= MAX_SEATS) return;
    const n = seats.length + 1;
    setSeats((prev) => [
      ...prev,
      {
        id: `s${Date.now()}`,
        name: `Bot ${n}`,
        strategy: "neverRollsOne",
        accent: ACCENT_ORDER[prev.length % ACCENT_ORDER.length],
      },
    ]);
  };

  const removeSeat = (id: string) =>
    setSeats((prev) =>
      prev.length > 2 ? prev.filter((s) => s.id !== id) : prev,
    );

  return (
    <div className="setup">
      <div className="setup-brand">
        <span className="setup-mark">
          <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="30" cy="30" r="11" fill="var(--paper)" />
            <circle cx="50" cy="50" r="11" fill="var(--paper)" />
            <circle cx="70" cy="70" r="11" fill="var(--paper)" />
          </svg>
        </span>
        <h1 className="setup-title">FarkleBots</h1>
      </div>
      <p className="setup-tagline">
        Six dice, press your luck. Bots that disagree on when to stop.
      </p>

      <div className="setup-seats">
        {seats.map((seat, i) => (
          <div
            key={seat.id}
            className={`setup-card${seat.strategy === "human" ? " setup-card-human" : ""}`}
            style={
              { "--accent": ACCENT_VAR[seat.accent] } as React.CSSProperties
            }
          >
            <div className="setup-card-head">
              <span className="setup-avatar">{seat.name.charAt(0) || "?"}</span>
              <input
                className="setup-name"
                value={seat.name}
                onChange={(e) => update(seat.id, { name: e.target.value })}
                aria-label={`Name for seat ${i + 1}`}
                maxLength={14}
              />
              {seats.length > 2 && (
                <button
                  type="button"
                  className="setup-remove"
                  onClick={() => removeSeat(seat.id)}
                  aria-label={`Remove ${seat.name}`}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <label
              className="label setup-field-label"
              htmlFor={`strat-${seat.id}`}
            >
              Strategy
            </label>
            <select
              id={`strat-${seat.id}`}
              className="setup-select"
              value={seat.strategy}
              onChange={(e) =>
                update(seat.id, { strategy: e.target.value as StrategyId })
              }
            >
              <option value="human">{STRATEGIES.human.label}</option>
              {BOT_STRATEGY_IDS.map((id) => (
                <option key={id} value={id}>
                  {STRATEGIES[id].label}
                </option>
              ))}
            </select>
            <p className="setup-blurb">{STRATEGIES[seat.strategy].blurb}</p>
          </div>
        ))}
      </div>

      {seats.length < MAX_SEATS && (
        <button type="button" className="setup-add" onClick={addSeat}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add another seat
        </button>
      )}

      <div className="setup-target">
        <span className="label">First to</span>
        <div className="setup-target-row">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              className={`setup-target-btn n${t === target ? " setup-target-on" : ""}`}
              onClick={() => setTarget(t)}
              aria-pressed={t === target}
            >
              {t.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary setup-start"
        onClick={() => onStart(seats, target)}
      >
        Start the game
      </button>
    </div>
  );
}
