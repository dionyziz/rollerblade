import { Number, String, Literal, Record, Union, Static } from 'runtypes';
import {
  AuthenticatedIncomingMessage,
  AuthenticatedOutgoingMessage
} from '../authenticated-network'
import { DistributedProtocol } from '../distributed-protocol';

export const RuntimeBaseRollerbladeInstruction = Record({
  type: String,
  data: Record({})
})

export const RuntimeWriteRollerbladeInstruction = RuntimeBaseRollerbladeInstruction.extend({
  sid: String,
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
  machine: DistributedProtocol,
  simulationRound: number,
  outbox: PartyNetworkOutbox
}
