import { OverlayLedgerProtocol } from "./overlay-ledger-protocol";
import { Transaction, Ledger } from "./types";
import { AuthenticatedChannel } from "./authenticated-network";

const ledger: Ledger<IdealOverlayLedgerProtocol> = []

export class IdealOverlayLedgerProtocol extends OverlayLedgerProtocol {
  constructor(j: number, n: number, network: AuthenticatedChannel[]) {
    super(j, n, network)
  }
  execute(): void {}
  read(): Ledger<this> {
    return ledger
  }
  write(tx: Transaction<this>): void {
    ledger.push(tx)
  }
}