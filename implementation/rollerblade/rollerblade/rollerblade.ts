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
  v: number // maximum promised timeliness

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
    this.v = Math.max(...Y.map(y => y.promisedV))
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

  // Create all the simulation inputs (network inputs [inbox] and user inputs [writes])
  // needed to simulate party i from round 0 to round simulationRound (inclusive),
  // when external reality has reached round realityRound (ledger L_i has been read at realityRound)
  createSimulationInputs(
    i: number,
    L_i: TemporalLedger<UnderlyingLedgerProtocol>,
    simulationRound: number,
    realityRound: number // the one global "reality" clock shared by all rollerblade parties j
  ): {
    inbox: PartyNetworkInbox, // network inputs: round => [(from, msg), ...]
    writes: string[][], // user inputs: round => [write, ...]
  } {
    const txs = Rollerblade.decodeUnderlyingLedger(this.Y[i], L_i)
    const inbox: PartyNetworkInbox = []
    const writes: string[][] = []

    // counterparty id => number of netins processed
    const recordedMessageCount: number[] = []

    for (let tx of txs) {
      const [txRound, parsed] = tx!

      assert(txRound > 0)

      if (txRound >= inbox.length) {
        assert(inbox.length === writes.length)
        for (let r = inbox.length; r <= txRound; ++r) {
          inbox.push([])
          writes.push([])
        }
      }

      switch (parsed['type']) {
        case 'write':
          writes[txRound].push(parsed['data']['payload'])
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
          // The time relationship between simulation and reality is 1:1
          // Time passes at the same rate within the simulation and in reality
          // (For every round that passes in reality, a round passes in the simulation)
          const { outbox: outboxFrom } = this.simulateZ(from, L_from, txRound - 1)

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
            inbox[txRound].push(authenticatedMsg)
          }
          break
        // no 'netout'
      }
    }

    // Timeliness: Now that we have read L^i at realityRound, we know
    // that, at future reads of L^i, no new transactions with timestamps
    // smaller than realityRound - v will appear.
    if (simulationRound >= realityRound - this.v) {
      throw new Error(`Not enough data to simulate up to round ${simulationRound} (reality round: ${realityRound})`)
    }

    return {
      inbox,
      writes
    }
  }

  simulateZ(i: number, L_i: TemporalLedger<UnderlyingLedgerProtocol>, simulationRound: number): SimulationResult {
    const { inbox, writes } = this.createSimulationInputs(i, L_i, simulationRound)

    assert(inbox.length === writes.length) // number of rounds available
    assert(inbox.length < simulationRound) // we have enough data to simulate up to round r

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
  readFromMachine(i: number, r: number) {
    // TODO: u and v might be different for each underlying
    // The reality will be that
    // simulationRound ~= this.round / u
    // but for now we are working with
    // simulationRound = this.round
    // TODO: Fix simulation-reality time discrepancy

    const L_i: TemporalLedger<UnderlyingLedgerProtocol> = this.Y[i].read()
    const sim: SimulationResult = this.simulateZ(i, L_i, r)

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

function assert(arg0: boolean) {
  throw new Error('Function not implemented.')
}
