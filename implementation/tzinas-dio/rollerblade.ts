import { Streamlet } from './streamlet'
import { Transaction, Ledger, Transcription } from './types'
import { OverlayLedgerProtocol } from './overlay-ledger-protocol'
import { UnderlyingLedgerProtocol } from './underlying-ledger-protocol'
import { AuthenticatedChannel, AuthenticatedNetwork } from './authenticated-network'

class RollerbladeNetwork implements AuthenticatedNetwork {
  getChannel(i: number, j: number): AuthenticatedChannel {
  }
}

export class Rollerblade<
  // T is a metaclass of a class that extends abstract class OverlayLedgerProtocol,
  // so that new Π() can be used
  T extends new (...args: any[]) => InstanceType<T> & OverlayLedgerProtocol
> {
  // a Rollerblade party
  Z: OverlayLedgerProtocol[] = []

  // Rollerblade realizes a concrete consensus protocol;
  // TODO: abstract this to any protocol Π
  constructor(
    j: number,
    Y: UnderlyingLedgerProtocol[],
    Π: T) {
  }
  maxLedger(ledgers: Ledger<T>[]): Ledger<Rollerblade<T>> {
    // majority gate
    const lengths = ledgers.map(ledger => ledger.length)
    const max = Math.max(...lengths)

    for (let k = 0; k < max; ++k) {
      const freq = Map<Transaction<T>, number>()

      for (const ledger of ledgers) {
        if (k >= ledger.length) {
          continue
        }
        const tx: Transaction<T> = ledger[k]

      }
    }
  }
  // TODO: generalize
  read(): Ledger<Rollerblade<T>> {
    // TODO: implement read functionality
    return []
  }
  write(tx: Transaction<Rollerblade<T>>): void {
    // TODO: implement write functionality
  }
}