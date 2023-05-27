import { OverlayLedgerProtocol } from "../overlay-ledger-protocol";
import { Ledger, Transaction } from "../types";
import { UnderlyingLedgerProtocol } from "../underlying-ledger-protocol";
import { Rollerblade } from "./rollerblade";

export class ComposedConsensus<
  // T is a metaclass of a class that extends abstract class OverlayLedgerProtocol,
  // so that new Π() can be used
  T extends new (...args: any[]) => InstanceType<T> & OverlayLedgerProtocol
> extends Rollerblade<T> {
  constructor(
    sid: string,
    j: number,
    Y: UnderlyingLedgerProtocol[],
    Π: T
  ) {
    super(sid, j, Y, Π)
  }

  // Ledger<T> == Ledger<Rollerblade<T>>
  maxLedger(ledgers: Ledger<T>[]): Ledger<Rollerblade<T>> {
    // majority gate
    const lengths = ledgers.map(ledger => ledger.length)
    const max = Math.max(...lengths)
    const ret: Ledger<Rollerblade<T>> = []

    for (let k = 0; k < max; ++k) {
      const freq = new Map<Transaction<T>, number>()

      for (const ledger of ledgers) {
        if (k >= ledger.length) {
          continue
        }
        const tx: Transaction<T> = ledger[k]
        if (!freq.has(tx)) {
          freq.set(tx, 0)
        }
        freq.set(tx, freq.get(tx)! + 1)
      }

      for (const [tx, count] of freq) {
        if (count > ledgers.length / 2) {
          ret.push(tx)
          break // unnecessary under secure majority assumptions
        }
      }
    }

    return ret
  }

  read(): Ledger<Rollerblade<T>> {
    const L: Ledger<OverlayLedgerProtocol>[] = []

    for (let i = 0; i < this.n; ++i) {
      L.push(this.readFromMachine(i, this.round - this.v - 1))
    }

    return this.maxLedger(L)
  }

  write(tx: Transaction<Rollerblade<T>>): void {
    for (let i = 0; i < this.n; ++i) {
      this.writeToMachine(i, tx)
    }
  }
}