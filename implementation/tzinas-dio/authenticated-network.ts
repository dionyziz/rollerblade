export interface AuthenticatedNetwork {
  getPartyInterface(i: number): PartyAuthenticatedNetwork
}

export type AuthenticatedIncomingMessage = {
  from: number
  msg: string
}

export type AuthenticatedOutgoingMessage = {
  to: number
  msg: string
}

export interface PartyAuthenticatedNetwork {
  send(recp: number, msg: string): void
  recv(): AuthenticatedIncomingMessage[]
}