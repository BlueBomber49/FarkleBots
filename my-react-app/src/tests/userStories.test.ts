/**
 * Five user stories, each tested end to end against the real Game engine and
 * the adapter that feeds the UI.
 *
 * These drive the same objects the screens render from, so a passing run means
 * the state the interface would display is correct, not just that the maths is.
 *
 * Dice are seeded where a story needs a specific roll. `seeded([4,4,4])` makes
 * the next three dice land on 4. Only unfrozen dice consume the sequence, and
 * it wraps, so a short sequence repeats.
 */

import { describe, it, expect } from 'vitest';
import { Game } from '../Backend/game';
import { toSnapshot } from '../Frontend/engine/adapter';
import type { SeatConfig } from '../Frontend/types';

function seeded(faces: number[]) {
  let i = 0;
  return () => (faces[i++ % faces.length] - 1) / 6 + 0.01;
}

const FOUR_SEATS: SeatConfig[] = [
  { id: 's1', name: 'Greedy', strategy: 'greedy', accent: 'greedy' },
  { id: 's2', name: 'Cautious', strategy: 'safe', accent: 'cautious' },
  { id: 's3', name: 'Adaptive', strategy: 'safeWhenAhead', accent: 'adaptive' },
  { id: 's4', name: 'You', strategy: 'human', accent: 'human' },
];

const HUMAN_FIRST: SeatConfig[] = [
  { id: 'h', name: 'You', strategy: 'human', accent: 'human' },
  { id: 'b', name: 'Cautious', strategy: 'safe', accent: 'cautious' },
];

// ---------------------------------------------------------------------------

describe('Story 1: I set up a game and it is ready to play', () => {
  it('opens with every seat on zero, the first seat up, and six dice to throw', () => {
    const snap = toSnapshot(new Game(FOUR_SEATS, 10000));

    expect(snap.seats).toHaveLength(4);
    expect(snap.seats.every((s) => s.banked === 0)).toBe(true);
    expect(snap.seats.filter((s) => s.isActive)).toHaveLength(1);
    expect(snap.seats[0].isActive).toBe(true);
    expect(snap.dice).toHaveLength(6);
    expect(snap.dice.every((d) => !d.locked && !d.selected)).toBe(true);
    expect(snap.turnPot).toBe(0);
    expect(snap.targetScore).toBe(10000);
    expect(snap.winner).toBeNull();
  });

  it('labels each seat with the strategy that was chosen for it', () => {
    const snap = toSnapshot(new Game(FOUR_SEATS, 10000));
    expect(snap.seats.map((s) => s.strategyLabel)).toEqual([
      'Risky, greedy',
      'Plays it safe',
      'Safe when ahead',
      'Human player',
    ]);
    expect(snap.seats[3].isHuman).toBe(true);
    expect(snap.seats[0].isHuman).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('Story 2: I roll, keep the dice that score, and bank them', () => {
  it('adds exactly the banked points to my score and passes the turn on', () => {
    // 1,1,5,2,3,4 -> the two 1s and the 5 score, worth 250.
    const game = new Game(HUMAN_FIRST, 10000, seeded([1, 1, 5, 2, 3, 4]));
    game.roll();

    let snap = toSnapshot(game);
    expect(snap.phase).toBe('awaitingPick');
    const offered = snap.dice.filter((d) => d.scoring).map((d) => d.value);
    expect(offered.sort()).toEqual([1, 1, 5]);

    for (const die of snap.dice.filter((d) => d.scoring)) game.toggleDie(die.id);

    snap = toSnapshot(game);
    expect(snap.phase).toBe('awaitingDecision');
    expect(snap.pendingPick).toBe(250);

    game.bank();
    snap = toSnapshot(game);

    expect(snap.seats[0].banked).toBe(250);
    expect(snap.turnPot).toBe(0);
    expect(snap.seats[0].isActive).toBe(false);
    expect(snap.seats[1].isActive).toBe(true);
    expect(snap.seats[0].timesBanked).toBe(1);
    expect(snap.log.some((e) => e.kind === 'bank' && e.text.includes('250'))).toBe(true);
  });

  it('will not let me keep a die that does not score', () => {
    const game = new Game(HUMAN_FIRST, 10000, seeded([1, 2, 3, 4, 6, 6]));
    game.roll();
    const snap = toSnapshot(game);
    const dud = snap.dice.find((d) => d.value === 3)!;
    expect(dud.scoring).toBe(false);

    game.toggleDie(dud.id);
    // A selection that does not score on its own is worth nothing, so the
    // table stays on the picking step rather than offering bank-or-roll.
    expect(toSnapshot(game).pendingPick).toBe(0);
    expect(toSnapshot(game).phase).toBe('awaitingPick');
  });

  it('shows a verdict that matches what the seat will actually do', () => {
    const game = new Game(FOUR_SEATS, 10000, seeded([1, 1, 5, 2, 3, 4]));
    game.roll();
    game.autoPick();
    const math = toSnapshot(game).math!;
    expect(math).not.toBeNull();
    expect(['ROLL', 'BANK']).toContain(math.verdict);

    const before = toSnapshot(game).seats[0].banked;
    game.stepBot();
    const after = toSnapshot(game);
    // BANK means the score went up now; ROLL means it did not.
    if (math.verdict === 'BANK') expect(after.seats[0].banked).toBeGreaterThan(before);
    else expect(after.seats[0].banked).toBe(before);
  });
});

// ---------------------------------------------------------------------------

describe('Story 3: I farkle, lose the pot, and the game carries on', () => {
  it('clears the pot and hands play to the next seat', () => {
    // 2,3,4,6,6,3 contains no scoring die at all.
    const game = new Game(HUMAN_FIRST, 10000, seeded([2, 3, 4, 6, 6, 3]));
    game.roll();

    let snap = toSnapshot(game);
    expect(snap.phase).toBe('farkle');
    expect(snap.math?.verdict).toBe('BUST');
    expect(snap.log[0].kind).toBe('farkle');

    game.advance();
    snap = toSnapshot(game);
    expect(snap.turnPot).toBe(0);
    expect(snap.seats[0].banked).toBe(0);
    expect(snap.seats[1].isActive).toBe(true);
    expect(snap.seats[0].history.at(-1)).toEqual({ peak: 0, busted: true });
  });

  it('leaves a human to dismiss their own farkle, and a bot to auto-advance', () => {
    // Human seat: the timer must NOT clear the banner. Arena shows a Continue
    // button here, so the player reads it and moves on when ready. If stepBot
    // advanced this, the button would vanish under the cursor.
    const human = new Game(HUMAN_FIRST, 10000, seeded([2, 3, 4, 6, 6, 3]));
    human.roll();
    expect(toSnapshot(human).phase).toBe('farkle');
    expect(human.stepBot()).toBe(false);
    expect(toSnapshot(human).phase).toBe('farkle');
    human.advance(); // what the Continue button calls
    expect(toSnapshot(human).phase).not.toBe('farkle');

    // Bot seat: nobody is going to click anything, so the timer clears it.
    const bots: SeatConfig[] = [
      { id: 'b1', name: 'Cautious', strategy: 'safe', accent: 'cautious' },
      { id: 'b2', name: 'Greedy', strategy: 'greedy', accent: 'greedy' },
    ];
    const bot = new Game(bots, 10000, seeded([2, 3, 4, 6, 6, 3]));
    bot.roll();
    expect(toSnapshot(bot).phase).toBe('farkle');
    expect(bot.stepBot()).toBe(true);
    expect(toSnapshot(bot).phase).not.toBe('farkle');
  });

  it('loses points that were held before the bad roll', () => {
    // Six faces for the opening throw, then three more for the reroll: the
    // remaining dice come up 2,3,4, which scores nothing.
    const game = new Game(HUMAN_FIRST, 10000, seeded([1, 1, 5, 2, 3, 4, 2, 3, 4]));
    game.roll();
    for (const d of toSnapshot(game).dice.filter((x) => x.scoring)) game.toggleDie(d.id);
    expect(toSnapshot(game).pendingPick).toBe(250);

    game.rollAgain(); // commits 250 and throws the other three: 2,3,4
    const snap = toSnapshot(game);
    expect(snap.phase).toBe('farkle');
    game.advance();
    expect(toSnapshot(game).seats[0].banked).toBe(0);
    expect(toSnapshot(game).seats[0].history.at(-1)).toEqual({ peak: 250, busted: true });
  });
});

// ---------------------------------------------------------------------------

describe('Story 4: all six dice score, so I get them all back', () => {
  it('keeps the pot and returns six live dice', () => {
    // Six 1s: four-plus of a kind uses every die, so the dice go hot.
    const game = new Game(HUMAN_FIRST, 10000, seeded([1]));
    game.roll();
    game.autoPick();

    const picked = toSnapshot(game).pendingPick;
    expect(picked).toBeGreaterThan(0);

    game.rollAgain();
    let snap = toSnapshot(game);
    expect(snap.phase).toBe('hotDice');
    expect(snap.turnPot).toBe(picked);
    expect(snap.math?.verdict).toBe('HOT');

    game.advance();
    snap = toSnapshot(game);
    expect(snap.phase).toBe('awaitingRoll');
    expect(snap.dice.filter((d) => !d.locked)).toHaveLength(6);
    expect(snap.turnPot).toBe(picked); // the pot survives
  });
});

// ---------------------------------------------------------------------------

describe('Story 5: I watch bots play and their personalities show', () => {
  const allBots: SeatConfig[] = [
    { id: 'g', name: 'Greedy', strategy: 'greedy', accent: 'greedy' },
    { id: 'c', name: 'Cautious', strategy: 'safe', accent: 'cautious' },
    { id: 'a', name: 'Adaptive', strategy: 'safeWhenAhead', accent: 'adaptive' },
    { id: 'n', name: 'Never1', strategy: 'neverRollsOne', accent: 'extra' },
  ];

  it('always reaches a winner without stalling', () => {
    for (let i = 0; i < 30; i += 1) {
      const game = new Game(allBots, 5000);
      let steps = 0;
      while (!game.isOver && steps < 20000) {
        game.stepBot();
        steps += 1;
      }
      const snap = toSnapshot(game);
      expect(snap.winner, `game ${i} never finished`).not.toBeNull();
      expect(snap.winner!.banked).toBeGreaterThanOrEqual(5000);
      expect(snap.phase).toBe('gameOver');
    }
  });

  it('gives the greedy policy a higher farkle rate than the careful one', () => {
    let greedyBusts = 0, greedyTurns = 0, safeBusts = 0, safeTurns = 0;
    for (let i = 0; i < 40; i += 1) {
      const game = new Game(allBots, 5000);
      let steps = 0;
      while (!game.isOver && steps < 20000) { game.stepBot(); steps += 1; }
      const snap = toSnapshot(game);
      const g = snap.seats.find((s) => s.name === 'Greedy')!;
      const c = snap.seats.find((s) => s.name === 'Cautious')!;
      greedyBusts += g.history.filter((t) => t.busted).length;
      greedyTurns += g.history.length;
      safeBusts += c.history.filter((t) => t.busted).length;
      safeTurns += c.history.length;
    }
    const greedyRate = greedyBusts / greedyTurns;
    const safeRate = safeBusts / safeTurns;
    expect(greedyRate).toBeGreaterThan(safeRate);
  });

  it('records one history entry per finished turn, and stats agree with it', () => {
    const game = new Game(allBots, 3000);
    let steps = 0;
    while (!game.isOver && steps < 20000) { game.stepBot(); steps += 1; }
    for (const seat of toSnapshot(game).seats) {
      const busts = seat.history.filter((t) => t.busted).length;
      // A seat can finish with no completed turns if someone wins on the
      // first lap, and an empty history must report 0 rather than NaN.
      const expected = seat.history.length === 0 ? 0 : busts / seat.history.length;
      expect(seat.farkleRate).toBeCloseTo(expected, 5);
      expect(seat.timesBanked).toBe(seat.history.length - busts);
      expect(seat.farkleRate).toBeGreaterThanOrEqual(0);
      expect(seat.farkleRate).toBeLessThanOrEqual(1);
      // The results table prints this straight out, so it must be a whole
      // number of points, not 683.3333333333334.
      expect(Number.isInteger(seat.avgTurn)).toBe(true);
    }
  });
});
