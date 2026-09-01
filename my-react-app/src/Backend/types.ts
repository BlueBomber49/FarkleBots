/**
 * Shared types for the backend domain model.
 * These are re-exported to the frontend for use in snapshots.
 */

export type StrategyId =
  | "human"
  | "greedy"
  | "safe"
  | "safeWhenAhead"
  | "neverRollsOne";

export type AccentId = "greedy" | "cautious" | "adaptive" | "human" | "extra";

export interface TurnRecord {
  /** Points that were on the table at the turn's peak. */
  peak: number;
  /** True if the turn ended in a farkle and the peak was lost. */
  busted: boolean;
}
