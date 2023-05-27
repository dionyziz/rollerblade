import { Transaction, Ledger, Transcription, TemporalLedger } from './types'

export abstract class UnderlyingLedgerProtocol {
  // Ledger functionality
  // (if Underlying is good, then this is safe)
  abstract read(): TemporalLedger<UnderlyingLedgerProtocol>
  abstract write(tx: Transaction<UnderlyingLedgerProtocol>): void
  // promised liveness parameter
  // (if Underlying is good, then this is respected)
  abstract readonly promisedU: number
  // promised timeliness parameter
  // (if Underlying is good, then this is respected)
  abstract readonly promisedV: number

  // Certifiable/Transcribable functionality
  abstract transcribe(): Transcription
  // static
  abstract untranscribe(ts: Transcription[]): TemporalLedger<UnderlyingLedgerProtocol>

  // Bulletin board functionality
  abstract encode(s: string): Transaction<UnderlyingLedgerProtocol>
  abstract decode(tx: Transaction<UnderlyingLedgerProtocol>): string
}
