import { Transaction } from "../types"
import { UnderlyingLedgerProtocol } from "../underlying-ledger-protocol"
import { CheckpointRollerbladeInstruction } from "./types"

export class Relayer {
  Y: UnderlyingLedgerProtocol[]
  round: number

  constructor(Y: UnderlyingLedgerProtocol[]) {
    this.Y = Y
    this.round = 0
  }
  // runs in every round
  execute() {
    for (let i = 0; i < this.Y.length; ++i) {
      const τ = this.Y[i].transcribe()
      for (let iPrime = 0; iPrime < this.Y.length; ++iPrime) {
        if (iPrime === i) {
          continue
        }
        const instruction: CheckpointRollerbladeInstruction = {
          type: 'checkpoint',
          data: {
            from: i,
            certificate: τ
          }
        }
        const stringified: string = JSON.stringify(instruction)
        const encoded: Transaction<UnderlyingLedgerProtocol> = this.Y[iPrime].encode(stringified)

        this.Y[iPrime].write(encoded)
      }
    }
    this.round += 1
  }
}
