import { Transaction, Transcription, timestamp, TemporalLedger, TemporalTransaction } from '../types'
import { OverlayLedgerProtocol } from '../overlay-ledger-protocol'
import { UnderlyingLedgerProtocol } from '../underlying-ledger-protocol'
import {
  AuthenticatedIncomingMessage,
  AuthenticatedOutgoingMessage,
  PartyAuthenticatedNetwork
} from '../authenticated-network'
import {
  WriteRollerbladeInstruction,
  OnchainRollerbladeInstruction,
  RuntimeOnchainRollerbladeInstruction,
  PartyNetworkInbox,
  PartyNetworkOutbox,
  SimulationResult
} from './types'
import { DistributedProtocol } from '../distributed-protocol'

export class Rollerblade<
  // T is a metaclass of a class that extends abstract class DistributedProtocol,
  // so that new Π() can be used
  T extends new (...args: any[]) => InstanceType<T> & DistributedProtocol
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

  execute() {
    this.round += 1
  }

  static decodeUnderlyingLedger(
    Y_i: UnderlyingLedgerProtocol,
    L_i: TemporalLedger<UnderlyingLedgerProtocol>
  ): [timestamp, OnchainRollerbladeInstruction][] {
    return L_i.map(
      (temporalTx: TemporalTransaction<UnderlyingLedgerProtocol>): [timestamp, OnchainRollerbladeInstruction] | null => {
        const {timestamp, tx} = temporalTx

        let parsed: {} = {}
        try {
          // This will fail if this is not a bulletin board transaction
          const decoded = Y_i.decode(tx)
          // This will fail if the payload is not valid JSON
          parsed = JSON.parse(decoded)
        }
        catch (e) {
          return null
        }

        if (!RuntimeOnchainRollerbladeInstruction.guard(parsed)) {
          // appropriate properties are not defined -- this underlying bulletin transaction
          // does not store rollerblade data
          return null
        }

        // assume this is valid rollerblade data
        // (no problem if not)
        return [timestamp, parsed]
      }
    ).filter(parsed => parsed !== null) as [timestamp, OnchainRollerbladeInstruction][]
  }

  createSimulationInputs(i: number, L_i: TemporalLedger<UnderlyingLedgerProtocol>): {
    inbox: PartyNetworkInbox, // round => [(from, msg), ...]
    writes: string[][], // round => [write, ...]
  } {
    const txs = Rollerblade.decodeUnderlyingLedger(this.Y[i], L_i)
    const inbox: PartyNetworkInbox = []
    const writes: string[][] = []

    // counterparty id => number of netins processed
    const recordedMessageCount: number[] = []

    for (let tx of txs) {
      const [timestamp, parsed] = tx!

      if (timestamp >= inbox.length) {
        for (let r = inbox.length; r <= timestamp; ++r) {
          inbox.push([])
        }
      }
      if (timestamp >= writes.length) {
        for (let r = writes.length; r <= timestamp; ++r) {
          writes.push([])
        }
      }

      switch (parsed['type']) {
        case 'write':
          writes[timestamp].push(parsed['data']['payload'])
          break
        case 'checkpoint':
          const { from, certificate }: { from: number, certificate: Transcription } = parsed['data']
          let L_from: TemporalLedger<UnderlyingLedgerProtocol>
          // TODO: in the case of transcriptions instead of certificates, handle multiple transcriptions
          try {
            L_from = this.Y[from].untranscribe([certificate])
          }
          catch (e) {
            // wrong checkpoint
            continue
          }
          const { outbox: outboxFrom } = this.simulateZ(from, L_from)

          function flattenOutbox(outbox: PartyNetworkOutbox): AuthenticatedIncomingMessage[] {
            const ret: AuthenticatedIncomingMessage[] = []

            for (const roundMsgs of outbox) {
              for (const {to, msg} of roundMsgs) {
                ret.push({from: to, msg})
              }
            }

            return ret
          }

          // in case of transcription unliveness, unprocessedNetouts will be empty
          const unprocessedNetouts = flattenOutbox(outboxFrom).slice(recordedMessageCount[from])
          recordedMessageCount[from] += unprocessedNetouts.length

          for (const authenticatedMsg of unprocessedNetouts) {
            inbox[timestamp].push(authenticatedMsg)
          }
          break
        // no 'netout'
      }
    }
    return {
      inbox,
      writes
    }
  }

  // TODO: Make static
  simulateZ(i: number, L_i: TemporalLedger<UnderlyingLedgerProtocol>): SimulationResult {
    const { inbox, writes } = this.createSimulationInputs(i, L_i)

    // Z_i's netout: round => [(recp, msg)...]
    const outbox: PartyNetworkOutbox = []
    let inboxThisRound: AuthenticatedIncomingMessage[] = []
    let outboxThisRound: AuthenticatedOutgoingMessage[] = []

    class RollerbladeNetworkSimulation implements PartyAuthenticatedNetwork {
      send(to: number, msg: string): void {
        outboxThisRound.push({ to, msg })
      }
      recv(): AuthenticatedIncomingMessage[] {
        return inboxThisRound
      }
    }

    const network: RollerbladeNetworkSimulation = new RollerbladeNetworkSimulation()
    const Z_i: OverlayLedgerProtocol = new this.Π(i, this.n, network)

    for (let simulationRound = 0; simulationRound < inbox.length; ++simulationRound) {
      for (const write of writes[simulationRound]) {
        Z_i.write(write)
      }
      inboxThisRound = inbox[simulationRound]
      outboxThisRound = []
      Z_i.execute()
      outbox.push(outboxThisRound)
    }

    return {
      machine: Z_i,
      simulationRound: inbox.length,
      outbox
    }
  }

  // TODO: pass round number?
  readFromMachine(i: number) {
    // For now assume all underlying liveness u's are the same
    // The reality will be that
    // simulationRound ~= this.round / u
    // but for now we are working with
    // simulationRound = this.round
    // TODO: Fix simulation-reality time discrepancy

    const L_i: TemporalLedger<UnderlyingLedgerProtocol> = this.Y[i].read()
    const sim: SimulationResult = this.simulateZ(i, L_i)

    return sim.machine.read()
  }

  writeToMachine(i: number, data: string) {
    const instruction: WriteRollerbladeInstruction = {
      sid: this.sid,
      type: 'write',
      data: {
        payload: data
      }
    }
    const stringified = JSON.stringify(instruction)
    const Y_i = this.Y[i]
    const encoded: Transaction<UnderlyingLedgerProtocol> = Y_i.encode(stringified)

    Y_i.write(encoded)
  }
}