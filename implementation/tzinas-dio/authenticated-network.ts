export interface AuthenticatedNetwork {
  getPartyInterface(i: number): PartyAuthenticatedNetwork
}

export type AuthenticatedMessage = {
  from: number
  msg: string
}

export interface PartyAuthenticatedNetwork {
  send(recp: number, msg: string): void
  recv(): AuthenticatedMessage[]
}