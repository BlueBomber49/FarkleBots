/**
 * Display metadata for the rolling policies.
 *
 * The DECISIONS live in Backend/rollingStrategy.ts and are made there. This
 * file deliberately holds no logic: when both files implemented `decide`, the
 * bot acted on one copy while the interface explained the other, so any change
 * to one would have made the UI describe a decision that never happened.
 */

import type { StrategyId } from '../types';

export interface StrategyInfo {
  id: StrategyId;
  label: string;
  blurb: string;
}

export const STRATEGIES: Record<StrategyId, StrategyInfo> = {
  human: {
    id: 'human',
    label: 'Human player',
    blurb: 'You choose which dice to keep and when to bank.',
  },
  greedy: {
    id: 'greedy',
    label: 'Risky, greedy',
    blurb: 'Keeps rolling while the bust chance stays under 50 percent.',
  },
  safe: {
    id: 'safe',
    label: 'Plays it safe',
    blurb: 'Banks at 300, and never rolls on poor odds to get there.',
  },
  greedierOverTime: {
    id: 'greedierOverTime',
    label: 'Greedier over time',
    blurb: 'Starts careful and raises its risk ceiling every turn.',
  },
  safeWhenAhead: {
    id: 'safeWhenAhead',
    label: 'Safe when ahead',
    blurb: 'Plays it safe in the lead, gets greedy when behind.',
  },
  neverRollsOne: {
    id: 'neverRollsOne',
    label: 'Never rolls one die',
    blurb: 'Will not throw a lone die whatever the pot is worth.',
  },
};

export const BOT_STRATEGY_IDS: StrategyId[] = [
  'greedy',
  'safe',
  'greedierOverTime',
  'safeWhenAhead',
  'neverRollsOne',
];
