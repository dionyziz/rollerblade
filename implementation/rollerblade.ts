declare function assert(value: unknown): asserts value

interface DLP {
  readLedger()
  writeLedger(tx): void
}

interface Bulletin extends DLP {
  transcribe(): string
  untranscribe(transcriptions: string[])
  decodeTxToString(tx): string
  encodeStringToTx(tx)
}

interface SMR {
  constructor()
  step(environmentTx) // returns current ledger
}

interface OralBroadcast {
  broadcastSigned(message: string): void
  receiveVerified()
}

function sigmaFromView(view) {
  class Sigma {
    constructor() {
    }

    broadcastSigned(message) {
    }

    receiveVerified() {
    }
  }
}

export default class Rollerblade {
  Pover
  Punder
  id: string

  constructor(id: string, Punder, Pover) {
    this.id = id
    this.Punder = Punder
    this.Pover = Pover
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
  decodeRollerbladeTx(j, tx) {
    const stringTx = this.Punder[j].decodeStringTx(tx)

    // TODO: handle errors
    const parsedTx = JSON.parse(stringTx)

    assert(parsedTx.type == 'checkpoint' || parsedTx.type == 'write') // no 'sends' here
  }
  encodeRollerbladeTx(j, tx) {
    const stringTx = JSON.stringify(tx)

    return this.Punder[j].encodeStringTx(stringTx)
  }
  /*
    Returns a view of the network transcript outbox according to party j based on
    the underlying DLP ledger Lj. The transcript is a sequence of

    ['send', message]

    formatted according to Pover's desired format.
  */
  view(j, Lj, round) {
    const outbox: Array<any> = []
    let inbox: Array<any> = []
    const checkpoints: Array<any> = []

    for (let j in this.Punder) {
      outbox[j] = []
      checkpoints[j] = []
    }

    for (const [round, tx] of Lj) {
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
          const checkpoint = parsedTx.payload
          checkpoints.push(checkpoint)
          const jPrime = parsedTx.sourceIndex
          const jPrimeLedger = this.Punder[jPrime].untranscribe(checkpoints)

          const jPrimeOutbox = this.view(jPrime, jPrimeLedger, round - 1).outbox // TODO: translate overlay rounds into underlay livenesses
          newEvents = this.reconciliateOutboxUpdate(outbox[jPrime], jPrimeOutbox, jPrime, round)
          outbox[jPrime] = jPrimeOutbox
          break
        case 'write':
          newEvents = [round, ['write', parsedTx.payload]]
          break
      }
      inbox = inbox.concat(newEvents)
    }

    const myOutbox = this.simulateOver(j, inbox, round)

    return myOutbox
  }
  simulateOver(j, inbox, targetRound) {
    const outbox: Array<[string, any]> = []
    let simulationRound = 0
    let roundReceives: Array<any> = []

    const sigma = {
      broadcastSigned(message) {
        outbox.push(['send', message])
      },
      receiveVerified() {
        return roundReceives
      }
    }
    const PoverSimulation = new this.Pover(j, sigma)
    let simulationLedger = []

    for (simulationRound = 0; simulationRound < targetRound; ++simulationRound) {
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
          }
        }
      }
      simulationLedger = PoverSimulation.step(roundWrites)
    }

    return { outbox, simulationLedger }
  }
  majorityVote(L) {
    const ret: Array<any> = []

    for (let i = 0; ; ++i) {
      const freq = {}
      for (const ledger of L) {
        if (typeof ledger[i] === 'undefined') {
          continue
        }
        if (!(ledger[i] in freq)) {
          freq[ledger[i]] = 0
        }
        freq[ledger[i]]++
      }
      let pushed = false
      for (const tx in freq) {
        if (freq[tx] > L.length / 2) {
          ret.push(tx)
          pushed = true
          break
        }
      }
      if (!pushed) {
        break
      }
    }

    return ret
  }
  step(currentRound: number) {
    // relay
    for (let j in this.Punder) {
      const transcript = this.Punder[j].marshall()

      for (let k in this.Punder) {
        if (k == j) {
          continue
        }

        this.Punder[k].writeLedger(
          this.Punder[k].encodeStringTx(['checkpoint', j, transcript])
        )
      }
    }
  }
  readLedger(currentRound: number) {
    const overLedgers: Array<any> = []

    for (let j in this.Punder) {
      const underLedger = this.Punder[j].readLedger()
      overLedgers.push(
        this.simulateOver(
          j,
          this.view(j, underLedger, currentRound),
          currentRound
        ).simulationLedger
      )
    }
    return this.majorityVote(overLedgers)
  }
  writeLedger(tx: string) {
    for (let j in this.Punder) {
      this.Punder[j].writeLedger(this.encodeRollerbladeTx(j, ['write', tx]))
    }
  }
}

function relay() {
  const checkpoints: Array<any> = []

  for (let j in this.Punder) {
    checkpoints.push({
      sourceIndex: j,
      payload: this.Punder[j].transcribe()
    })
  }

  for (let j in this.Punder) {
    for (let checkpoint of checkpoints) {
      this.Punder.writeLedger(this.encodeRollerbladeTx(j, ['checkpoint', checkpoint]))
    }
  }
}
