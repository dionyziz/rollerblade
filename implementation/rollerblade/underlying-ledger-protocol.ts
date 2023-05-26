import { Transaction, Ledger, Transcription, TemporalLedger } from './types'

export abstract class UnderlyingLedgerProtocol {
  // ledger
  abstract read(): TemporalLedger<UnderlyingLedgerProtocol>
  abstract write(tx: Transaction<UnderlyingLedgerProtocol>): void

  // certifiable/transcribable
  abstract transcribe(): Transcription
  // static
  abstract untranscribe(ts: Transcription[]): TemporalLedger<UnderlyingLedgerProtocol>

  // bulletin board
  abstract encode(s: string): Transaction<UnderlyingLedgerProtocol>
  abstract decode(tx: Transaction<UnderlyingLedgerProtocol>): string
}
