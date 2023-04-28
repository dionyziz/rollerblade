interface FKnownOrigin {

}

class FIdealKnownOrigin {
  inboxes: [number, string][][] = []

  constructor(n: number) {
    for (let i = 0; i < n; ++i) {
      this.inboxes.push([])
    }
  }

  getPartyOracle(party: number) {
    const self = this

    class KnownOriginOracle {
      party: number

      constructor(party: number) {
        this.party = party
      }

      send(dest: number, msg: string) {
        return self._send(this.party, dest, msg)
      }

      recv() {
        return self._recv(this.party)
      }
    }

    return new KnownOriginOracle(party)
  }

  _send(caller: number, dest: number, msg: string) {
    this.inboxes[dest].push([caller, msg])
  }

  _recv(caller: number) {
    const inbox = this.inboxes[caller]
    this.inboxes[caller] = []
    return inbox
  }
}
