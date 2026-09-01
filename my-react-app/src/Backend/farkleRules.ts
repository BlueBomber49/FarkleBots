/**
 * Farkle scoring rules, shared between backend and frontend.
 * Copied from src/Frontend/engine/rules.ts
 */

export interface ScoreResult {
  /** Points the given dice are worth. */
  points: number;
  /** Indexes of the dice that take part in a scoring combination. */
  scoringIndexes: number[];
  /** True when every die given scores, which is what makes dice "hot". */
  usesAllDice: boolean;
}

function counts(values: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const v of values) c[v] += 1;
  return c;
}

/**
 * Best score for a set of dice, assuming you keep everything that scores.
 * Used to decide whether a roll farkled.
 */
export function scoreAll(values: number[]): ScoreResult {
  const c = counts(values);
  const all = values.map((_, i) => i);

  // Whole-set combinations first, they're always best
  const isStraight = values.length === 6 && c.slice(1).every((n) => n === 1);
  if (isStraight)
    return { points: 1500, scoringIndexes: all, usesAllDice: true };

  if (values.length === 6) {
    const pairs = c.filter((n) => n === 2).length;
    if (pairs === 3)
      return { points: 1500, scoringIndexes: all, usesAllDice: true };

    const triplets = c.filter((n) => n === 3).length;
    if (triplets === 2)
      return { points: 2500, scoringIndexes: all, usesAllDice: true };

    const hasFour = c.some((n) => n === 4);
    const hasPair = c.some((n) => n === 2);
    if (hasFour && hasPair)
      return { points: 1500, scoringIndexes: all, usesAllDice: true };
  }

  let points = 0;
  const scoringIndexes: number[] = [];
  const taken = new Set<number>();

  const take = (face: number, howMany: number) => {
    let left = howMany;
    for (let i = 0; i < values.length && left > 0; i += 1) {
      if (values[i] === face && !taken.has(i)) {
        taken.add(i);
        scoringIndexes.push(i);
        left -= 1;
      }
    }
  };

  //Scoring for N of a kind (6, 5, 4, or 3)
  for (let face = 1; face <= 6; face += 1) {
    const n = c[face];
    if (n >= 3) {
      if (n === 6) points += 3000;
      else if (n === 5) points += 2000;
      else if (n === 4) points += 1000;
      else points += face === 1 ? 1000 : face * 100;
      take(face, n);
    }
  }

  // Leftover single 1s and 5s.
  for (let i = 0; i < values.length; i += 1) {
    if (taken.has(i)) continue;
    if (values[i] === 1) {
      points += 100;
      taken.add(i);
      scoringIndexes.push(i);
    } else if (values[i] === 5) {
      points += 50;
      taken.add(i);
      scoringIndexes.push(i);
    }
  }

  scoringIndexes.sort((a, b) => a - b);
  return {
    points,
    scoringIndexes,
    usesAllDice: values.length > 0 && scoringIndexes.length === values.length,
  };
}

/** A roll farkles when no die in it takes part in any scoring combination. */
export function isFarkle(values: number[]): boolean {
  return scoreAll(values).points === 0;
}

/** Score exactly the dice a player chose to keep. Returns 0 for an illegal set. */
export function scoreSelection(values: number[]): number {
  if (values.length === 0) return 0;
  const result = scoreAll(values);
  return result.usesAllDice ? result.points : 0;
}

/** Which indexes of this roll could legally be kept on their own. */
export function scoringIndexes(values: number[]): number[] {
  return scoreAll(values).scoringIndexes;
}

export function rollDice(n: number, rng: () => number = Math.random): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(rng() * 6));
}
