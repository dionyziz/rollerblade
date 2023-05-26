import { Number, String, Literal, Record, Union, Static } from 'runtypes';
import { OverlayLedgerProtocol } from '../overlay-ledger-protocol'
import {
  AuthenticatedIncomingMessage,
  AuthenticatedOutgoingMessage
} from '../authenticated-network'

export const RuntimeBaseRollerbladeInstruction = Record({
  sid: String,
  type: String,
  data: Record({})
})

export const RuntimeWriteRollerbladeInstruction = RuntimeBaseRollerbladeInstruction.extend({
  type: Literal('write'),
  data: Record({
    payload: String
  })
})
export const RuntimeCheckpointRollerbladeInstruction = RuntimeBaseRollerbladeInstruction.extend({
  type: Literal('checkpoint'),
  data: Record({
    from: Number,
    certificate: String
  })
})
export const RuntimeOnchainRollerbladeInstruction = Union(RuntimeWriteRollerbladeInstruction, RuntimeCheckpointRollerbladeInstruction)

export type WriteRollerbladeInstruction = Static<typeof RuntimeWriteRollerbladeInstruction>
export type CheckpointRollerbladeInstruction = Static<typeof RuntimeCheckpointRollerbladeInstruction>
export type OnchainRollerbladeInstruction = Static<typeof RuntimeOnchainRollerbladeInstruction>

export type PartyNetworkOutbox = AuthenticatedOutgoingMessage[][]
export type PartyNetworkInbox = AuthenticatedIncomingMessage[][]

export type SimulationResult = {
  machine: OverlayLedgerProtocol,
  simulationRound: number,
  outbox: PartyNetworkOutbox
}