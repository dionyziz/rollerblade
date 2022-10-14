// TODO: rename "over" to "blade" and "under" to "wheel"

/*
interface DLP {
  readLedger()
  writeLedger(tx)
  marshall()
  unmarshall(transcription) // TODO: handle multiple clients
  decodeStringTx(tx) // TODO: clearer names for "tx" vs "stringtx" here
  encodeStringTx(tx)
}

interface SMR {
  constructor()
  step(environmentTx) // returns current ledger
}

interface Sigma {
  broadcastSigned(message)
  receiveVerified()
}
*/

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

class Rollerblade {
  constructor(i, Punder, Pover) {
    this.i = i // unused
    this.Punder = Punder
    this.Pover = Pover
  }
  reconciliateOutboxUpdate(oldOutbox, newOutbox, j) {
    const inboxSuffix = []

    for (const j in newOutbox) {
      const tx = newOutbox[j]

      assert(tx.type == 'send')

      const counterpartyTx = clone(tx)
      counterpartyTx.type = 'receive'
      counterpartyTx.source = j

      if (oldOutbox.length < j) {
        if (oldOutbox[j] != counterpartyTx) {
          throw // safety error in j's outbox
          // TODO: deal with exponential message blow-up here;
          //       only allow two equivocating messages per counterparty
        }
      }
      else {
        inboxSuffix.push(pairTx)
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
    const tapes = []
    const inbox = []

    for (let _ of this.P_under) {
      tapes.push([])
    }

    for (const tx in Lj) {
      let parsedTx

      try {
        parsedTx = this.decodeRollerbladeTx(tx)
      }
      catch {
        continue
      }

      let newEvents = []

      switch (parsedTx.type) {
        case 'checkpoint':
          const jPrime = parsedTx.sourceIndex
          const payload = parsedTx.payload

          const jPrimeOutbox = this.view(jPrime, payload, round) // TODO: round keeping; do we need round - 1 here?
          newEvents = this.reconciliateOutboxUpdate(outbox[jPrime], jPrimeOutbox, jPrime)
          outbox[jPrime] = jPrimeOutbox
          break
        case 'write':
          newEvents = [['write', parsedTx.payload]]
          break
      }
      inbox = inbox.concat(newEvents)
    }

    const outbox = this.simulateOver(j, inbox, round)

    return outbox
  }
  simulateOver(j, inbox, round) {
    const outbox = []

    const sigma = {
      broadcastSigned(message) {
        outbox.push(['send', message])
      },
      receiveVerified() {
        if (inbox.length > 0) {
          const messages = inbox.pop() // TODO: and assert that popped = ('receive', messages)
          return messages
        }
        // TODO: unclear how to handle multiple messages from different sources?
        // TODO: also unclear how to handle multiple messages from the same source?
        // TODO: what happens if the Pover simulation calls receive() but we have an empty inbox?
        return messages
      }
    }
    const PoverSimulation = new this.Pover(j, sigma)
    let simulationLedger = []

    for (let r = 0; r < round; ++r) {
      const environmentTransactions = inbox.pop() // TODO: and asset that popped = ('write', txs)
      simulationLedger = PoverSimulation.step(environmentTransactions)
    }

    return { outbox, simulationLedger }
  }
  majorityVote(L) {
    const ret = []

    // TODO: not sure about this part; is this kind of majority voting always correct?
    for (let i = 0; ; i++) {
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
  step(currentRound) { // TODO: maybe we don't need to run this in lockstep; use co-routines?
    for (let j in this.Punder) {
      const transcript = this.Punder[j].marshall()

      for (let k in this.Punder) {
        if (k == j) {
          continue
        }

        this.Punder[k].encodeStringTx(['checkpoint', j, transcript])
      }
    }
  }
  readLedger(currentRound) {
    const overLedgers = []

    for (let j in this.P_under) {
      const underLedger = this.P_under[j].readLedger()
      overLedgers.push(
        this.simulateOver(
          j,
          this.view(j, underLedger, currentRound),
          currentRound
        ).simulationLedger
      )
    }
    return majorityVote(overLedgers)
  }
  // tx: string
  writeLedger(tx) {
    for (let j in this.P_under) {
      // TODO: here we have one write per tx, but the reader may expect one write per round
      this.P_under[j].writeLedger(this.encodeRollerbladeTx(j, ['write', tx]))
    }
  }
}
