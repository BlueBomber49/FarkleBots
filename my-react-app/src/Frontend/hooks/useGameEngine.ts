import { useCallback, useEffect, useMemo, useState } from "react";
import { Game } from "../../Backend/game";
import { toSnapshot } from "../engine/adapter";
import type { GameSnapshot, SeatConfig } from "../types";

/** Milliseconds between bot steps at 1x. Higher speeds divide this. */
const BASE_TICK = 620;
/** Bot farkle and hot-dice banners flashed past too fast to read at speed.
 *  Human banners are not on a timer at all: they wait for Continue. */
const BANNER_HOLD = 1500;

export type Speed = 1 | 2 | 4;

/**
 * Owns the game and republishes an immutable snapshot after every change.
 *
 * The engine mutates itself, so React is told about changes by replacing the
 * snapshot object rather than by watching the engine. Every component below
 * this hook is a pure function of that snapshot.
 *
 * The game is held in lazy state rather than a ref so it is never touched
 * during render. Arena is remounted with a `key` to start a new game, which is
 * why there is no reset path here.
 */
export function useGameEngine(seats: SeatConfig[], target: number) {
  const [game] = useState(() => new Game(seats, target));
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    toSnapshot(game),
  );
  const [speed, setSpeed] = useState<Speed>(2);
  const [paused, setPaused] = useState(false);

  const act = useCallback(
    (fn: (g: Game) => void) => {
      fn(game);
      setSnapshot(toSnapshot(game));
    },
    [game],
  );

  // Bots step on a timer. Humans are driven by the buttons instead, so the
  // timer stops as soon as the active seat is a person.
  useEffect(() => {
    if (paused || game.isOver || game.awaitingHuman) return;
    const resolving =
      snapshot.phase === "farkle" || snapshot.phase === "hotDice";
    const delay = resolving
      ? BANNER_HOLD / Math.min(speed, 2)
      : BASE_TICK / speed;
    const id = window.setTimeout(() => {
      if (game.stepBot()) setSnapshot(toSnapshot(game));
    }, delay);
    return () => window.clearTimeout(id);
  }, [game, snapshot, paused, speed]);

  const actions = useMemo(
    () => ({
      roll: () => act((g) => g.roll()),
      toggleDie: (id: string) => act((g) => g.toggleDie(id)),
      rollAgain: () => act((g) => g.rollAgain()),
      bank: () => act((g) => g.bank()),
      advance: () => act((g) => g.advance()),
    }),
    [act],
  );

  return { snapshot, actions, speed, setSpeed, paused, setPaused };
}
