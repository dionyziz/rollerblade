import { AuthenticatedChannel, AuthenticatedNetwork } from '../authenticated-network'
import { OverlayLedgerProtocol } from '../overlay-ledger-protocol'
import { Ledger } from '../types'
import { Transaction } from '../types'

export class Streamlet extends OverlayLedgerProtocol {
  round = 0
  epoch = 0

  constructor(j: number, n: number, network: AuthenticatedChannel[]) {
    super(j, n, network)
  }
  execute() {
    this.round += 1 // <-- τ.push({ round 5: {this.round, this.epoch, line: 14...} })
    if (this.round % 2 == 0) { // <-- τ.push(...)
      // First half of epoch -- propose // <--
      // TODO
    }
    else {
      // Second half of epoch -- vote
      // TODO
      this.epoch += 1 // <--
    }
  }
  read(): Ledger<Streamlet> { // τ.push("I saw a read")
    // TODO
    return []
  }
  write(tx: Transaction<Streamlet>): void { // ...
  }
}
