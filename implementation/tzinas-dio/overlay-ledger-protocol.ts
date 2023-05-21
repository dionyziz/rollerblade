import { Ledger } from './types'
import { Transaction } from './types'
import { AuthenticatedChannel } from './authenticated-network'

export abstract class OverlayLedgerProtocol {
  constructor(j: number, n: number, network: AuthenticatedChannel[]) {}
  abstract execute(): void
  abstract read(): Ledger<this>
  abstract write(tx: Transaction<this>): void
}
