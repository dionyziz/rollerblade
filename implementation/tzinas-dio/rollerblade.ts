import { Streamlet } from './streamlet'
import { Transaction, Ledger, Transcription } from './types'
import { OverlayLedgerProtocol } from './overlay-ledger-protocol'
import { UnderlyingLedgerProtocol } from './underlying-ledger-protocol'
import { AuthenticatedChannel, AuthenticatedNetwork } from './authenticated-network'

/*
class RollerbladeNetwork implements AuthenticatedNetwork {
  getChannel(i: number, j: number): AuthenticatedChannel {
  }
}
*/

export class Rollerblade<
  // T is a metaclass of a class that extends abstract class OverlayLedgerProtocol,
  // so that new Π() can be used
  T extends new (...args: any[]) => InstanceType<T> & OverlayLedgerProtocol
> {
  sid: string // shared session id among all the parties of this rollerblade
  n: number
  Y: UnderlyingLedgerProtocol[] = []
  Π: T
  round: number = 0
  // a Rollerblade party
  // Rollerblade realizes a concrete consensus protocol;
  // TODO: abstract this to any protocol Π
  constructor(
    sid: string,
    j: number,
    Y: UnderlyingLedgerProtocol[],
    Π: T) {
    this.sid = sid
    this.n = Y.length
    this.Y = Y
    this.Π = Π
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
  execute() {
    this.round += 1
  }
  simulateZ(i: number, round: number) {
    const L_i: Ledger<UnderlyingLedgerProtocol> = this.Y[i].read()

    const txs = L_i.map(tx => {
      try {
        // This will fail if this is not a bulletin board transaction
        const decoded = this.Y[i].decode(tx)
        // This will fail if the payload is not valid JSON
        const parsed = JSON.parse(decoded)

        // 'sid' is not defined -- this underlying bulletin transaction
        // does not store rollerblade data
        if (parsed['sid'] === undefined) {
          return null
        }

        // assume this is valid rollerblade data
        // (no problem if not)
        return parsed
      }
      catch (e) {
        return null
      }
    }).filter(parsed => parsed !== null)

    txs.forEach(parsed => {
      parsed
    })
  }
  // TODO: generalize
  read(): Ledger<Rollerblade<T>> {
    // TODO: implement read functionality
    const L: Ledger<OverlayLedgerProtocol>[] = []
    const Z: OverlayLedgerProtocol[] = []

    for (let i = 0; i < this.n; ++i) {
      const z = new this.Π(i, this.n, authChannels)
      Z.push(z)
    }

    // For now assume all underlying liveness u's are the same
    // The reality will be that
    // simulationRound ~= this.round / u
    // but for now we are working with
    // simulationRound = this.round
    // TODO: Fix simulation-reality time discrepancy
    const simulationRound = this.round

    for (let i = 0; i < Z.length; ++i) {
      L.push(Z[i].read())
    }
    return this.maxLedger(L)
  }
  write(tx: Transaction<Rollerblade<T>>): void {
    // TODO: implement write functionality
  }
}