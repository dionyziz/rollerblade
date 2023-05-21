export interface AuthenticatedNetwork {
  getChannel(i: number, j: number): AuthenticatedChannel
}

export type AuthenticatedMessage = {
  from: number
  msg: string
}

export interface AuthenticatedChannel { // connects two distinct parties
  send(msg: string): void
  recv(): AuthenticatedMessage[]
}