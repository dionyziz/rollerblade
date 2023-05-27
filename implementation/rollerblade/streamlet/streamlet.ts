import { PartyAuthenticatedNetwork } from '../authenticated-network'
import { OverlayLedgerProtocol } from '../overlay-ledger-protocol'
import { TemporalLedger } from '../types'
import { Transaction } from '../types'

export class Streamlet extends OverlayLedgerProtocol {
  round = 0
  epoch = 0

  // TODO: calculate these
  promisedU: number = 5
  promisedV: number = 7

  constructor(j: number, n: number, network: PartyAuthenticatedNetwork) {
    super(j, n, network)
  }
  execute() {
    if (this.round % 2 == 0) {
      // First half of epoch -- propose
      // TODO
    }
    else {
      // Second half of epoch -- vote
      // TODO
      this.epoch += 1
    }
    this.round += 1
  }
  read(): TemporalLedger<Streamlet> {
    // TODO
    return []
  }
  write(tx: Transaction<Streamlet>): void { // ...
  }
}
