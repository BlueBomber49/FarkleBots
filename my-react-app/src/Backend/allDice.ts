import { Dice } from "./dice";
import { scoreAll } from "./farkleRules";

export class AllDice {
  public allDice!: Dice[];
  public liveDice: Dice[]; //Separate out the dice rolled each round for scoring purposes
  public selectedDice: Dice[];
  constructor(numDice = 6, rng: () => number = Math.random) {
    this.allDice = Array.from(
      { length: numDice },
      (_, i) => new Dice("d" + i, [1, 2, 3, 4, 5, 6], rng),
    );
    this.liveDice = [];
    this.selectedDice = [];
  }

  public rollDice() {
    this.liveDice = [];
    for (let i = 0; i < this.allDice.length; i++) {
      let currentDice = this.allDice[i];
      if (currentDice.isFrozen) {
        //Dice is frozen, don't add to set
        continue;
      } else {
        currentDice.roll();
        this.allDice[i] = currentDice;
        this.liveDice.push(currentDice);
      }
    }
    return this.liveDice;
  }

  public scoreDice(diceToScore: Dice[]): number {
    const values = diceToScore.map((d) => d.currentValue);
    return scoreAll(values).points;
  }

  public getLiveDice() {
    return this.liveDice;
  }

  public getSelectedDice() {
    return this.selectedDice;
  }

  public lockSelectedDice() {
    for (const dice of this.selectedDice) {
      dice.isFrozen = !dice.isFrozen;
    }
  }

  public resetTurnDice() {
    for (const dice of this.allDice) {
      dice.currentValue = 1;
      dice.isFrozen = false;
      dice.selected = false;
    }
  }

  public updateSelectedDice() {
    this.selectedDice = this.allDice.filter((d) => d.selected && !d.isFrozen);
  }

  public toggleDieSelection(dieId: string) {
    const die = this.allDice.find((d) => d.id === dieId);
    if (die && !die.isFrozen) {
      die.selected = !die.selected;
      this.updateSelectedDice();
    }
  }
}
