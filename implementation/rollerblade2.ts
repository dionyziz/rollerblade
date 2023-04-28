declare function assert(value: unknown): asserts value

type transaction = string
type timestamp = number
type temporalLedger = [timestamp, transaction][]

interface DistributedLedgerProtocol {
  readLedger(): temporalLedger
  writeTx(tx: string): void
}

interface TranscribableDistributedLedgerProtocol extends DistributedLedgerProtocol {
  transcribe(): transcription
  untranscribe(transcriptions: transcription[]): temporalLedger
}

type transcription = string

abstract class Bulletin implements TranscribableDistributedLedgerProtocol {
  abstract transcribe(): transcription
  abstract untranscribe(transcriptions: transcription[]): temporalLedger

  abstract readLedger(): temporalLedger
  abstract writeTx(tx: transaction): void

  abstract encodeStringToTx(str: string): transaction
  abstract decodeTxToString(tx: transaction): string

  encodeObjectToTx(obj: object): transaction {
    return this.encodeStringToTx(JSON.stringify(obj))
  }
  decodeTxToObject(tx: transaction): object {
    return JSON.parse(this.decodeTxToString(tx))
  }
}

type partyId = number
type networkMessage = string
type authenticatedNetworkMessage = [partyId, networkMessage]
type userMessage = string
type authenticatedInbox = authenticatedNetworkMessage[]
type outbox = networkMessage[]
type input = userMessage
type output = userMessage

type rollerbladeMessage = {
  type: string,
  payload: any
}

interface DistributedSystem {
  // This needs to be deterministic and use "authenticated channels"
  // One example is streamlet (to be implemented in this language)
  constructor(j: partyId, network: AuthenticatedDiffuse): void // dependency injection
  step(input: input, inbox: authenticatedInbox): [output, outbox]
}

interface AuthenticatedDiffuse {
  writeAll(message: string): void
  receiveAll(): authenticatedInbox
}

class RollerbladeRelayer {
  DLPs: Bulletin[]

  constructor(DLPs: Bulletin[]) {
    this.DLPs = DLPs
  }
  step(userMessage: userMessage) {
    const transcriptions: {
      sourceIndex: number,
      transcription: transcription
    }[] = []

    for (let j = 0; j < this.DLPs.length; ++j) {
      const DLP = this.DLPs[j]
      transcriptions.push({
        sourceIndex: j,
        transcription: DLP.transcribe()
      })
    }

    for (let i = 0; i < this.DLPs.length; ++i) {
      const DLP = this.DLPs[i]
      for (let j = 0; j < transcriptions.length; ++j) {
        const transcription = transcriptions[j]
        if (i == j) {
          continue
        }
        DLP.writeTx(
          DLP.encodeObjectToTx({
            type: 'checkpoint',
            payload: transcription
          })
        )
      }
      DLP.writeTx(
        DLP.encodeObjectToTx({
          type: 'write',
          payload: userMessage
        })
      )
    }
  }
}

export default class Rollerblade {
  DistributedSystem: DistributedSystem // over
  Punder: Bulletin[]

  constructor(Punder: Bulletin[], DistributedSystem: DistributedSystem) {
    this.Punder = Punder
    this.DistributedSystem = DistributedSystem
  }
  reconciliateOutboxUpdate(oldOutbox: Array<any>, newOutbox: Array<any>, j: number, round: number) {
    const inboxSuffix: Array<any> = []

    for (let i = 0; i < newOutbox.length; ++i) {
      const tx = newOutbox[j]

      assert(tx.type == 'send')

      const counterpartyTx = structuredClone(tx)
      counterpartyTx.type = 'receive'
      counterpartyTx.source = j
      counterpartyTx.round = round

      if (oldOutbox.length >= i - 1) {
        if (oldOutbox[i] != counterpartyTx) {
          throw new Error('Safety error in outbox of party ' + j)
          // TODO: deal with exponential message blow-up here;
          //       only allow two equivocating messages per counterparty
        }
      }
      else {
        inboxSuffix.push(counterpartyTx)
      }
    }

    return inboxSuffix
  }
  decodeRollerbladeTx(j: number, tx: transaction): rollerbladeMessage {
    const rollerbladeMessage: rollerbladeMessage = this.Punder[j].decodeTxToObject(tx) as rollerbladeMessage

    assert(rollerbladeMessage.type == 'checkpoint' || rollerbladeMessage.type == 'write') // no 'sends' here

    return rollerbladeMessage
  }
  /*
    Returns a view of the network transcript outbox according to party j based on
    the underlying DLP ledger Lj. The transcript is a sequence of messages
    formatted according to DS desired format.
  */
  view(j: partyId, Lj: temporalLedger, round: number): {
    outbox: outbox,
    output: userMessage
  } {
    const outbox: outbox
    let inbox: Array<any> = []
    const checkpoints: string[] = []

    for (const [timestamp, tx] of Lj) {
      let parsedTx

      try {
        parsedTx = this.decodeRollerbladeTx(j, tx)
      }
      catch {
        continue
      }

      let newEvents: Array<any> = []

      switch (parsedTx.type) {
        case 'checkpoint':
          const checkpoint = parsedTx.payload as string
          checkpoints.push(checkpoint)
          const jPrime = parsedTx.payload.sourceIndex
          const jPrimeLedger = this.Punder[jPrime].untranscribe(checkpoints)

          // TODO: translate overlay rounds into underlay livenesses
          const jPrimeOutbox = this.view(jPrime, jPrimeLedger, round - 1).outbox
          newEvents = this.reconciliateOutboxUpdate(outbox[jPrime], jPrimeOutbox, jPrime, round)
          outbox[jPrime] = jPrimeOutbox
          break
        case 'write':
          newEvents = [round, ['write', parsedTx.payload]]
          break
      }
      inbox = inbox.concat(newEvents)
    }

    const simulationResult = this.simulateOver(j, inbox, round)

    return simulationResult
  }
  simulateOver(j: number, inbox: authenticatedInbox, targetRound: number): {
    outbox: outbox,
    output: userMessage
  } {
    const outbox: outbox = []
    let simulationRound: number = 0
    let roundReceives: Array<any> = []

    class RollerbladeAuthenticatedDiffuse implements AuthenticatedDiffuse {
      writeAll(message: string) {
        outbox.push(message)
      }
      receiveAll(): authenticatedInbox {
        const inboxSuffix = inbox.slice(simulationRound)
        const roundReceivesSuffix = roundReceives.slice(simulationRound)

        return inboxSuffix.concat(roundReceivesSuffix)
      }
    }

    const authenticatedDiffuse = new RollerbladeAuthenticatedDiffuse()

    const distributedSystem = new this.DistributedSystem(j, authenticatedDiffuse)
    let simulationLedger = []

    for (let simulationRound = 0; simulationRound < targetRound; ++simulationRound) {
      let roundWrites: Array<any> = []
      roundReceives = []

      for (let [messageRound, [type, tx]] of inbox) {
        if (messageRound == simulationRound) {
          switch (type) {
            case 'write':
              roundWrites.push(tx)
              break
            case 'receive':
              roundReceives.push(tx)
              break
          }
        }
      }
      { outbox, output } = distributedSystem.step(roundWrites)
    }

    return { outbox, output }
  }
}
