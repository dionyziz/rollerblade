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
  CheckpointRollerbladeInstruction,
  OnchainRollerbladeInstruction,
  RuntimeOnchainRollerbladeInstruction,
  PartyNetworkInbox,
  PartyNetworkOutbox,
  SimulationResult
} from './types'
import { DistributedProtocol } from '../distributed-protocol'
import { assert } from '../assert'

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
    sid: string,
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
        return RuntimeOnchainRollerbladeInstruction.match(
          (instruction: WriteRollerbladeInstruction) => {
            if (instruction.sid != sid) {
              return null
            }
            return [timestamp, instruction]
          },
          (instruction: CheckpointRollerbladeInstruction) => [timestamp, instruction]
        )(parsed)
      }
    ).filter(parsed => parsed !== null) as [timestamp, OnchainRollerbladeInstruction][]
  }

  // Create all the simulation inputs (network inputs [inbox] and user inputs [writes])
  // needed to simulate party i from round 0 to round simulationRound (inclusive),
  // ledger L_i was read at realityRound (or later)
  createSimulationInputs(
    i: number,
    L_i: TemporalLedger<UnderlyingLedgerProtocol>,
    simulationRound: number,
    realityRound: number
  ): {
    inbox: PartyNetworkInbox, // network inputs: round => [(from, msg), ...]
    writes: string[][], // user inputs: round => [write, ...]
  } {
    // Timeliness: Now that we have read L^i at realityRound, we know
    // that, at future reads of L^i, no new transactions with timestamps
    // smaller than realityRound - v will appear.
    if (simulationRound >= realityRound - this.v) {
      throw new Error(`Not enough data to simulate up to round ${simulationRound} (reality round: ${realityRound})`)
    }

    const txs = Rollerblade.decodeUnderlyingLedger(this.Y[i], L_i)
    const inbox: PartyNetworkInbox = []
    const writes: string[][] = []

    // counterparty id => number of netins processed
    const recordedMessageCount: number[] = []

    for (let iPrime = 0; iPrime < this.Y.length; ++iPrime) {
      recordedMessageCount.push(0)
    }

    // Fill in inbox and writes up to simulationRound (exclusive),
    // as inbox and writes of round simulationRound - 1 are used
    // as inputs to simulate round simulationRound
    for (let r = 0; r < simulationRound; ++r) {
      inbox.push([])
      writes.push([])
    }

    for (let tx of txs) {
      const [r, instruction] = tx!

      if (r >= simulationRound) {
        break
      }

      assert(r > 0)

      switch (instruction['type']) {
        case 'write':
          writes[r].push(instruction['data']['payload'])
          break
        case 'checkpoint':
          // "message" from "from" to i, received at time txRound,
          // this will play a role in simulation round txRound + 1 or later
          const { from, certificate }: { from: number, certificate: Transcription } = instruction['data']
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
          const { outbox: outboxFrom } = this.simulateZ(
            from,
            L_from,
            r - this.Y[i].promisedU - this.Y[from].promisedV - 1,
            r - this.Y[i].promisedU
          )

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
            inbox[r].push(authenticatedMsg)
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

  simulateZ(i: number, L_i: TemporalLedger<UnderlyingLedgerProtocol>, simulationRound: number, realityRound: number): SimulationResult {
    const { inbox, writes } = this.createSimulationInputs(i, L_i, simulationRound, realityRound)

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
    const Z_i: DistributedProtocol = new this.Π(i, this.n, network)

    Z_i.execute() // execute round 0 without any inputs
    for (let r = 0; r < simulationRound; ++r) {
      for (const write of writes[r]) {
        Z_i.write(write)
      }
      inboxThisRound = inbox[r]
      outboxThisRound = []
      // execute round r + 1, with writes and network inputs from round r
      Z_i.execute()
      outbox.push(outboxThisRound)
    }
    // "execute" has been executed a total of simulationRound + 1 times
    // from round 0 to round simulationRound (inclusive)

    return {
      machine: Z_i,
      simulationRound,
      outbox
    }
  }

  readFromMachine(i: number, simulationRound: number) {
    // TODO: u might be different for each underlying
    const L_i: TemporalLedger<UnderlyingLedgerProtocol> = this.Y[i].read()
    const sim: SimulationResult = this.simulateZ(i, L_i, simulationRound, this.round)

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
