/**
 * Bridge from the Backend Game class to the snapshot the UI renders.
 *
 * This converts mutable backend state into immutable snapshots for React.
 */

import { scoreAll } from "../../Backend/farkleRules";
import { farkleChance, expectedValueOfRolling } from "./odds";
import { STRATEGIES } from "./strategies";
import { RollingStrategy } from "../../Backend/rollingStrategy";
import type {
  GameSnapshot,
  DieView,
  SeatView,
  DecisionMath,
} from "../types";
import type { Game } from "../../Backend/game";

export function toSnapshot(game: Game): GameSnapshot {
  const seats: SeatView[] = game.players.map((player, index) => {
    const stats = player.getStats();
    return {
      id: player.id,
      name: player.name,
      strategy: player.strategy,
      strategyLabel: STRATEGIES[player.strategy].label,
      isHuman: player.isHuman,
      banked: player.banked,
      isActive: index === game.activePlayerIndex && !game.isOver,
      accent: player.accent,
      history: player.history,
      avgTurn: stats.avgTurn,
      farkleRate: stats.farkleRate,
      timesBanked: stats.timesBanked,
    };
  });

  // Compute which dice are scoring in the current phase
  let scoringIndexes: number[] = [];
  if (game.currentPhase === "awaitingPick" || game.currentPhase === "awaitingDecision") {
    const liveValues = game.dice.getLiveDice().map((d) => d.currentValue);
    scoringIndexes = scoreAll(liveValues).scoringIndexes;
  }

  // Map live dice to their visual representation
  let liveIndex = -1;
  const dice: DieView[] = game.dice.allDice.map((d) => {
    if (!d.isFrozen) liveIndex += 1;
    return {
      id: d.id,
      value: d.currentValue,
      locked: d.isFrozen,
      selected: d.selected,
      scoring: !d.isFrozen && scoringIndexes.includes(liveIndex),
    };
  });

  const winner =
    game.winner !== null
      ? seats.find((s) => s.id === game.winner) || null
      : null;

  const math = computeDecisionMath(game);

  return {
    seats,
    dice,
    turnPot: game.pot,
    pendingPick: game.pendingPick,
    targetScore: game.targetScore,
    turnNumber: game.turn,
    phase: game.currentPhase,
    log: [...game.entries],
    math,
    winner,
  };
}

function computeDecisionMath(game: Game): DecisionMath | null {
  if (game.isOver) return null;

  if (game.currentPhase === "farkle") {
    return {
      diceLeft: 0,
      farkleChance: 1,
      expectedIfRoll: 0,
      certainIfBank: 0,
      verdict: "BUST",
      reasoning: `A roll with no scoring dice ends the turn. ${game.pot} gone.`,
    };
  }

  if (game.currentPhase === "hotDice") {
    return {
      diceLeft: 6,
      farkleChance: farkleChance(6),
      expectedIfRoll: Math.round(expectedValueOfRolling(game.pot, 6)),
      certainIfBank: game.pot,
      verdict: "HOT",
      reasoning:
        "All six dice scored, so the pot carries and all six come back live.",
    };
  }

  if (game.currentPhase !== "awaitingDecision") return null;

  const liveDice = game.dice.getLiveDice();
  const selectedDice = game.dice.getSelectedDice();
  const wouldRemain = liveDice.length - selectedDice.length;
  const diceLeft = wouldRemain === 0 ? 6 : wouldRemain;
  const currentPot = game.pot + game.pendingPick;

  const bankValue = currentPot;
  const farkleProb = farkleChance(diceLeft);
  const expectedRoll = expectedValueOfRolling(currentPot, diceLeft);

  // The very class the game uses to decide, so the panel can never describe a
  // decision the seat did not make.
  const strategy = new RollingStrategy(game.currentPlayer.strategy);
  const decision = strategy.decide({
    pot: currentPot,
    diceLeft,
    banked: game.currentPlayer.banked,
    leaderScore: game.leaderScore,
    target: game.targetScore,
    turnNumber: game.turn,
  });

  return {
    diceLeft,
    farkleChance: farkleProb,
    expectedIfRoll: Math.round(expectedRoll),
    certainIfBank: bankValue,
    // The verdict is what this seat actually does, not a second opinion from
    // expected value. Deriving it separately let the chip say ROLL while the
    // bot went on to bank.
    verdict: decision.roll ? "ROLL" : "BANK",
    reasoning: decision.reasoning,
  };
}
