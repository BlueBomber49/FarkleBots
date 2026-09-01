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

const GREEDY_FLOOR = 750;
const GREEDY_RISK = 0.4;
const SAFE_FLOOR = 250;
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
        let roll;
        if (ctx.pot + ctx.banked >= ctx.target) {
          roll = false;
        } else {
          roll = ctx.pot < GREEDY_FLOOR ? true : p > GREEDY_RISK;
        }
        return {
          roll,
          reasoning: roll
            ? `${ctx.diceLeft} dice left and ${pct(p)} to lose it. I haven't hit my floor yet so I'll roll.`
            : `${pct(p)} chance of losing ${ctx.pot} is too big a risk. Banking.`,
        };
      }

      case "safe": {
        const p = farkleChance(ctx.diceLeft);
        const belowFloor = ctx.pot < SAFE_FLOOR;
        const goodOdds = p < SAFE_CEILING;
        let roll = belowFloor && goodOdds;
        if (ctx.pot + ctx.banked >= ctx.target) {
          roll = false;
        }
        return {
          roll,
          reasoning: roll
            ? `Only ${ctx.pot} so far and ${ctx.diceLeft} dice still in hand at ${pct(p)}. Worth one more.`
            : belowFloor
              ? `Just ${ctx.pot}, but ${ctx.diceLeft} dice is a ${pct(p)} risk. Not worth it. Banking.`
              : `${ctx.pot} is enough. I do not need to find out what happens next.`,
        };
      }

      case "safeWhenAhead": {
        const ahead = ctx.banked >= ctx.leaderScore;
        const ceiling = ahead ? 0.2 : 0.45;
        const p = farkleChance(ctx.diceLeft);
        let roll = p < ceiling;
        if (ctx.pot + ctx.banked >= ctx.target) {
          roll = false;
        }
        return {
          roll,
          reasoning: ahead
            ? roll
              ? `I am ahead, so I only take small risks. ${pct(p)} is small enough.`
              : `I am ahead by ${ctx.banked - ctx.leaderScore + 1}. No reason to risk ${ctx.pot}. Banking.`
            : roll
              ? `Behind by ${ctx.leaderScore - ctx.banked}. I have to take a risk of ${pct(p)} to catch up.`
              : `Behind, but ${pct(p)} would probably cost me the ${ctx.pot} I have. Banking.`,
        };
      }

      case "neverRollsOne": {
        if (ctx.diceLeft <= 1) {
          return {
            roll: false,
            reasoning: `One die is a ${pct(farkleChance(1))} chance of failure. I never take it.`,
          };
        }
        let worth = expectedValueOfRolling(ctx.pot, ctx.diceLeft) > ctx.pot;
        if (ctx.pot + ctx.banked >= ctx.target) {
          worth = false;
        }
        return {
          roll: worth,
          reasoning: worth
            ? `${ctx.diceLeft} dice?  Surely I won't farkle here`
            : `${ctx.diceLeft} dice? Not gonna roll it. Banking ${ctx.pot}.`,
        };
      }

      default:
        return { roll: false, reasoning: "Unknown strategy." };
    }
  }
}
