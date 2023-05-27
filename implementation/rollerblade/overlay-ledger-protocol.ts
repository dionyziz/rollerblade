import { Ledger } from './types'
import { Transaction } from './types'
import { PartyAuthenticatedNetwork } from './authenticated-network'
import { DistributedProtocol } from './distributed-protocol'

export abstract class OverlayLedgerProtocol extends DistributedProtocol {
  constructor(j: number, n: number, network: PartyAuthenticatedNetwork) {
    super(j, n, network)
  }
  abstract execute(): void
  abstract read(): Ledger<this>
  abstract write(tx: Transaction<this>): void
}
