import { Player } from "./player";
import { AllDice } from "./allDice";
import { RollingStrategy } from "./rollingStrategy";
import { scoreAll, scoreSelection, isFarkle } from "./farkleRules";
import type { SeatConfig, Phase, LogEntry } from "../Frontend/types";

const DICE_COUNT = 6;

export class Game {
  private _players: Player[];
  private allDice: AllDice;
  private activeIndex: number = 0;
  private turnPot: number = 0;
  private turnPeak: number = 0;
  private turnNumber: number = 1;
  private phase: Phase = "awaitingRoll";
  private log: LogEntry[] = [];
  private logId: number = 0;
  private winnerId: string | null = null;
  public targetScore: number;

  constructor(
    seatConfigs: SeatConfig[],
    targetScore: number,
    rng: () => number = Math.random,
  ) {
    this.targetScore = targetScore;
    this.allDice = new AllDice(DICE_COUNT, rng);

    this._players = seatConfigs.map((config) => {
      const player = new Player(
        config.id,
        config.name,
        config.strategy,
        config.accent,
        config.strategy === "human",
      );
      return player;
    });
  }

  // ---- Queries ----

  get currentPlayer(): Player {
    return this._players[this.activeIndex];
  }

  get activePlayerIndex(): number {
    return this.activeIndex;
  }

  get isOver(): boolean {
    return this.winnerId !== null;
  }

  get awaitingHuman(): boolean {
    return (
      this.currentPlayer.isHuman &&
      (this.phase === "awaitingRoll" ||
        this.phase === "awaitingPick" ||
        this.phase === "awaitingDecision")
    );
  }

  get pendingPick(): number {
    const selectedValues = this.allDice
      .getSelectedDice()
      .map((d) => d.currentValue);
    return scoreSelection(selectedValues);
  }

  get leaderScore(): number {
    return Math.max(...this._players.map((p) => p.banked));
  }

  /** Read-only views for the adapter. The fields stay private so only the
   *  game can mutate them, but the UI needs to see them to render. */
  get currentPhase(): Phase {
    return this.phase;
  }

  get dice(): AllDice {
    return this.allDice;
  }

  get entries(): readonly LogEntry[] {
    return this.log;
  }

  get pot(): number {
    return this.turnPot;
  }

  get turn(): number {
    return this.turnNumber;
  }

  get winner(): string | null {
    return this.winnerId;
  }

  get players(): Player[] {
    return this._players;
  }

  // ---- Actions ----

  public roll(): void {
    if (this.phase !== "awaitingRoll" || this.isOver) return;

    const liveDice = this.allDice.rollDice();
    const dieValues = liveDice.map((d) => d.currentValue);
    this.push("roll", `${this.currentPlayer.name} rolls ${liveDice.length}`);

    if (isFarkle(dieValues)) {
      this.phase = "farkle";
      this.push(
        "farkle",
        `${this.currentPlayer.name} farkled and lost ${this.turnPot}`,
      );
    } else {
      this.phase = "awaitingPick";
    }
  }

  public toggleDie(id: string): void {
    if (this.phase !== "awaitingPick" && this.phase !== "awaitingDecision") {
      return;
    }

    const die = this.allDice.allDice.find((d) => d.id === id);
    if (!die || die.isFrozen) return;

    die.selected = !die.selected;
    this.allDice.updateSelectedDice();
    this.phase = this.pendingPick > 0 ? "awaitingDecision" : "awaitingPick";
  }

  public autoPick(): void {
    if (this.phase !== "awaitingPick") return;

    const liveDice = this.allDice.getLiveDice();
    const dieValues = liveDice.map((d) => d.currentValue);
    const { scoringIndexes } = scoreAll(dieValues);

    if (scoringIndexes.length === 0) return;

    liveDice.forEach((d, i) => {
      d.selected = scoringIndexes.includes(i);
    });
    this.allDice.updateSelectedDice();

    const kept = this.allDice
      .getSelectedDice()
      .map((d) => d.currentValue)
      .join(" · ");
    this.push(
      "keep",
      `${this.currentPlayer.name} keeps ${kept} for ${this.pendingPick}`,
    );
    this.phase = "awaitingDecision";
  }

  public rollAgain(): void {
    if (this.phase !== "awaitingDecision") return;

    this.commitPick();

    const availableDice = this.allDice.allDice.filter((d) => !d.isFrozen);
    if (availableDice.length === 0) {
      this.allDice.allDice.forEach((d) => {
        d.isFrozen = false;
        d.selected = false;
      });
      this.phase = "hotDice";
      this.push(
        "hotDice",
        `${this.currentPlayer.name} scored all six, dice come back`,
      );
      return;
    }

    // Roll immediately instead of forcing a second click on the "Roll X dice" button.
    this.phase = "awaitingRoll";
    this.roll();
  }

  public bank(): void {
    if (this.phase !== "awaitingDecision") return;

    this.commitPick();
    const player = this.currentPlayer;
    player.bank(this.turnPot);
    player.recordTurn(this.turnPeak, false);
    this.push("bank", `${player.name} banked ${this.turnPot}`);

    if (player.banked >= this.targetScore) {
      this.winnerId = player.id;
      this.phase = "gameOver";
      this.push("win", `${player.name} reached ${player.banked} and wins`);
      return;
    }

    this.nextSeat();
  }

  public advance(): void {
    if (this.phase === "hotDice") {
      this.allDice.resetTurnDice();
      this.phase = "awaitingRoll";
      return;
    }

    if (this.phase !== "farkle") return;

    const player = this.currentPlayer;
    player.recordTurn(this.turnPeak, true);
    this.nextSeat();
  }

  /**
   * Advance a bot seat by one tick. Returns false when the table is waiting on
   * a person, including on a farkle or hot-dice banner: the human dismisses
   * those with the Continue button so they set their own pace.
   */
  public stepBot(): boolean {
    if (this.isOver || this.currentPlayer.isHuman) return false;

    switch (this.phase) {
      case "awaitingRoll":
        this.roll();
        return true;
      case "awaitingPick":
        this.autoPick();
        return true;
      case "awaitingDecision": {
        if (this.decideAsBot()) {
          this.rollAgain();
        } else {
          this.bank();
        }
        return true;
      }
      case "farkle":
      case "hotDice":
        this.advance();
        return true;
      default:
        return false;
    }
  }

  // ---- Internal helpers ----

  private decideAsBot(): boolean {
    const player = this.currentPlayer;
    const liveDice = this.allDice.getLiveDice();
    const selectedDice = this.allDice.getSelectedDice();
    const wouldRemain = liveDice.length - selectedDice.length;
    const diceLeft = wouldRemain === 0 ? DICE_COUNT : wouldRemain;

    const strategy = new RollingStrategy(player.strategy);
    const decision = strategy.decide({
      pot: this.turnPot + this.pendingPick,
      diceLeft,
      banked: player.banked,
      leaderScore: this.leaderScore,
      target: this.targetScore,
      turnNumber: this.turnNumber,
    });

    return decision.roll;
  }

  private commitPick(): void {
    this.turnPot += this.pendingPick;
    this.turnPeak = Math.max(this.turnPeak, this.turnPot);
    this.allDice.allDice.forEach((d) => {
      if (d.selected) {
        d.isFrozen = true;
        d.selected = false;
      }
    });
    this.allDice.updateSelectedDice();
  }

  private nextSeat(): void {
    this.turnPot = 0;
    this.turnPeak = 0;
    this.allDice.resetTurnDice();
    this.activeIndex = (this.activeIndex + 1) % this._players.length;
    if (this.activeIndex === 0) {
      this.turnNumber += 1;
    }
    this.phase = "awaitingRoll";
  }

  private push(kind: LogEntry['kind'], text: string): void {
    this.logId += 1;
    this.log.unshift({
      id: `l${this.logId}`,
      seatId: this.currentPlayer.id,
      accent: this.currentPlayer.accent,
      text,
      kind,
    });
    if (this.log.length > 40) {
      this.log.pop();
    }
  }
}
