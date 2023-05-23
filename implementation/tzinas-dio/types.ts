export type timestamp = number
export type Transaction<T> = string
export type Ledger<T> = Transaction<T>[]
export type TemporalTransaction<T> = {
  timestamp: number,
  tx: Transaction<T>
}
export type TemporalLedger<T> = TemporalTransaction<T>[]
export type Transcription = string