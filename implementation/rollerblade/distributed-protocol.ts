import { PartyAuthenticatedNetwork } from "./authenticated-network";

// We assume this class is deterministic
export abstract class DistributedProtocol {
  constructor(j: number, n: number, network: PartyAuthenticatedNetwork) {}
  // The semantics of "read" and "write" are not specified
  // and in particular are not specific to ledgers
  // We assume that read does not alter the state of the system
  abstract read(): any
  abstract write(data: string): void
  abstract execute(): void
}