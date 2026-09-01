import { farkleChance, expectedValueOfRolling } from "../Frontend/engine/odds";
import type { StrategyId } from "./types";

export interface DecisionContext {
  pot: number;
  diceLeft: number;
  banked: number;
  leaderScore: number;
  target: number;
  turnNumber: number;
}

export interface Decision {
  roll: boolean;
  reasoning: string;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Thresholds. These are what actually separate the policies, so they are
 * gathered here rather than buried in the switch.
 *
 * GREEDY_CEILING sits above the 2-dice bust chance (44.4%) so the greedy
 * policy will take that throw, and below the 1-die chance (66.7%) so it still
 * will not do something purely self-destructive.
 *
 * SAFE_CEILING sits below the 3-dice chance (27.8%) so the careful policy only
 * rolls with four or more dice in hand. Without a ceiling at all it would
 * chase its floor with a single die and farkle more often than the greedy one.
 */
const GREEDY_CEILING = 0.5;
const SAFE_FLOOR = 300;
const SAFE_CEILING = 0.2;

export class RollingStrategy {
  private strategyId: StrategyId;

  constructor(strategyId: StrategyId) {
    this.strategyId = strategyId;
  }

  public decide(ctx: DecisionContext): Decision {
    switch (this.strategyId) {
      case "human":
        return { roll: false, reasoning: "Waiting on you." };

      case "greedy": {
        const p = farkleChance(ctx.diceLeft);
        const roll = p < GREEDY_CEILING;
        return {
          roll,
          reasoning: roll
            ? `${ctx.diceLeft} dice left and ${pct(p)} to lose it. Under my ${pct(GREEDY_CEILING)} ceiling, so I roll.`
            : `${pct(p)} chance of losing ${ctx.pot} is past my ceiling. Banking.`,
        };
      }

      case "safe": {
        const p = farkleChance(ctx.diceLeft);
        const belowFloor = ctx.pot < SAFE_FLOOR;
        const goodOdds = p < SAFE_CEILING;
        const roll = belowFloor && goodOdds;
        return {
          roll,
          reasoning: roll
            ? `Only ${ctx.pot} so far and ${ctx.diceLeft} dice still in hand at ${pct(p)}. Worth one more.`
            : belowFloor
              ? `Just ${ctx.pot}, but ${ctx.diceLeft} dice is a ${pct(p)} risk. Not worth it. Banking.`
              : `${ctx.pot} is enough. I do not need to find out what happens next.`,
        };
      }

      case "greedierOverTime": {
        const ceiling = Math.min(0.1 + ctx.turnNumber * 0.02, 0.6);
        const p = farkleChance(ctx.diceLeft);
        const roll = p < ceiling;
        return {
          roll,
          reasoning: roll
            ? `Turn ${ctx.turnNumber}, so my ceiling is up to ${pct(ceiling)}. ${pct(p)} risk is fine.`
            : `Even at turn ${ctx.turnNumber} my ceiling is ${pct(ceiling)} and this is ${pct(p)}. Banking ${ctx.pot}.`,
        };
      }

      case "safeWhenAhead": {
        const ahead = ctx.banked >= ctx.leaderScore;
        const ceiling = ahead ? 0.2 : 0.45;
        const p = farkleChance(ctx.diceLeft);
        const roll = p < ceiling;
        return {
          roll,
          reasoning: ahead
            ? roll
              ? `I am ahead, so I only take small risks. ${pct(p)} is small enough.`
              : `I am ahead by ${ctx.banked - ctx.leaderScore + 1}. No reason to risk ${ctx.pot}. Banking.`
            : roll
              ? `Behind by ${ctx.leaderScore - ctx.banked}. I have to take ${pct(p)} to catch up.`
              : `Behind, but ${pct(p)} would probably cost me the ${ctx.pot} I have. Banking.`,
        };
      }

      case "neverRollsOne": {
        if (ctx.diceLeft <= 1) {
          return {
            roll: false,
            reasoning: `One die is a ${pct(farkleChance(1))} coin flip against me. I never take it.`,
          };
        }
        const worth = expectedValueOfRolling(ctx.pot, ctx.diceLeft) > ctx.pot;
        return {
          roll: worth,
          reasoning: worth
            ? `${ctx.diceLeft} dice is a fair throw. Rolling.`
            : `${ctx.diceLeft} dice no longer pays. Banking ${ctx.pot}.`,
        };
      }

      default:
        return { roll: false, reasoning: "Unknown strategy." };
    }
  }
}
