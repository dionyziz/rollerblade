import { Transaction, Ledger, Transcription } from './types'

export interface UnderlyingLedgerProtocol {
  // TODO: temporal ledger
  // ledger
  read(): Ledger<UnderlyingLedgerProtocol>
  write(tx: Transaction<UnderlyingLedgerProtocol>): void

  // certifiable/transcribable
  transcribe(): Transcription
  untranscribe(ts: Transcription[]): Ledger<UnderlyingLedgerProtocol>

  // bulletin board
  encode(s: string): Transaction<UnderlyingLedgerProtocol>
  decode(tx: Transaction<UnderlyingLedgerProtocol>): string
}
