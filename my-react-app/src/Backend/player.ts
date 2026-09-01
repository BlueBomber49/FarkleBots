import type { StrategyId, AccentId, TurnRecord } from "./types";

export class Player {
  public id: string;
  public name: string;
  public strategy: StrategyId;
  public accent: AccentId;
  public isHuman: boolean;
  public banked: number;
  public history: TurnRecord[];

  constructor(
    id: string,
    name: string,
    strategy: StrategyId,
    accent: AccentId,
    isHuman: boolean = false
  ) {
    this.id = id;
    this.name = name;
    this.strategy = strategy;
    this.accent = accent;
    this.isHuman = isHuman;
    this.banked = 0;
    this.history = [];
  }

  public bank(points: number): void {
    this.banked += points;
  }

  public recordTurn(peak: number, busted: boolean): void {
    this.history.push({ peak, busted });
  }

  public getStats() {
    const turns = this.history.length;
    const busts = this.history.filter((t) => t.busted).length;
    const scored = this.history.filter((t) => !t.busted);

    return {
      // Rounded here rather than at the call site: this is a points total and
      // the UI renders it raw, so an unrounded mean showed as 683.3333333333334.
      avgTurn:
        scored.length > 0
          ? Math.round(
              scored.reduce((sum, t) => sum + t.peak, 0) / scored.length,
            )
          : 0,
      farkleRate: turns > 0 ? busts / turns : 0,
      timesBanked: scored.length,
    };
  }
}
