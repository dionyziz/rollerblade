"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function sigmaFromView(view) {
    var Sigma = /** @class */ (function () {
        function Sigma() {
        }
        Sigma.prototype.broadcastSigned = function (message) {
        };
        Sigma.prototype.receiveVerified = function () {
        };
        return Sigma;
    }());
}
var Rollerblade = /** @class */ (function () {
    function Rollerblade(id, Punder, Pover) {
        this.id = id;
        this.Punder = Punder;
        this.Pover = Pover;
    }
    Rollerblade.prototype.reconciliateOutboxUpdate = function (oldOutbox, newOutbox, j, round) {
        var inboxSuffix = [];
        for (var i = 0; i < newOutbox.length; ++i) {
            var tx = newOutbox[j];
            assert(tx.type == 'send');
            var counterpartyTx = structuredClone(tx);
            counterpartyTx.type = 'receive';
            counterpartyTx.source = j;
            counterpartyTx.round = round;
            if (oldOutbox.length >= i - 1) {
                if (oldOutbox[i] != counterpartyTx) {
                    throw new Error('Safety error in outbox of party ' + j);
                    // TODO: deal with exponential message blow-up here;
                    //       only allow two equivocating messages per counterparty
                }
            }
            else {
                inboxSuffix.push(counterpartyTx);
            }
        }
        return inboxSuffix;
    };
    Rollerblade.prototype.decodeRollerbladeTx = function (j, tx) {
        var stringTx = this.Punder[j].decodeStringTx(tx);
        // TODO: handle errors
        var parsedTx = JSON.parse(stringTx);
        assert(parsedTx.type == 'checkpoint' || parsedTx.type == 'write'); // no 'sends' here
    };
    Rollerblade.prototype.encodeRollerbladeTx = function (j, tx) {
        var stringTx = JSON.stringify(tx);
        return this.Punder[j].encodeStringTx(stringTx);
    };
    /*
      Returns a view of the network transcript outbox according to party j based on
      the underlying DLP ledger Lj. The transcript is a sequence of
  
      ['send', message]
  
      formatted according to Pover's desired format.
    */
    Rollerblade.prototype.view = function (j, Lj, round) {
        var outbox = [];
        var inbox = [];
        var checkpoints = [];
        for (var j_1 in this.Punder) {
            outbox[j_1] = [];
            checkpoints[j_1] = [];
        }
        for (var _i = 0, Lj_1 = Lj; _i < Lj_1.length; _i++) {
            var _a = Lj_1[_i], round_1 = _a[0], tx = _a[1];
            var parsedTx = void 0;
            try {
                parsedTx = this.decodeRollerbladeTx(j, tx);
            }
            catch (_b) {
                continue;
            }
            var newEvents = [];
            switch (parsedTx.type) {
                case 'checkpoint':
                    var checkpoint = parsedTx.payload;
                    checkpoints.push(checkpoint);
                    var jPrime = parsedTx.sourceIndex;
                    var jPrimeLedger = this.Punder[jPrime].untranscribe(checkpoints);
                    var jPrimeOutbox = this.view(jPrime, jPrimeLedger, round_1 - 1).outbox; // TODO: translate overlay rounds into underlay livenesses
                    newEvents = this.reconciliateOutboxUpdate(outbox[jPrime], jPrimeOutbox, jPrime, round_1);
                    outbox[jPrime] = jPrimeOutbox;
                    break;
                case 'write':
                    newEvents = [round_1, ['write', parsedTx.payload]];
                    break;
            }
            inbox = inbox.concat(newEvents);
        }
        var myOutbox = this.simulateOver(j, inbox, round);
        return myOutbox;
    };
    Rollerblade.prototype.simulateOver = function (j, inbox, targetRound) {
        var outbox = [];
        var simulationRound = 0;
        var roundReceives = [];
        var sigma = {
            broadcastSigned: function (message) {
                outbox.push(['send', message]);
            },
            receiveVerified: function () {
                return roundReceives;
            }
        };
        var PoverSimulation = new this.Pover(j, sigma);
        var simulationLedger = [];
        for (simulationRound = 0; simulationRound < targetRound; ++simulationRound) {
            var roundWrites = [];
            roundReceives = [];
            for (var _i = 0, inbox_1 = inbox; _i < inbox_1.length; _i++) {
                var _a = inbox_1[_i], messageRound = _a[0], _b = _a[1], type = _b[0], tx = _b[1];
                if (messageRound == simulationRound) {
                    switch (type) {
                        case 'write':
                            roundWrites.push(tx);
                            break;
                        case 'receive':
                            roundReceives.push(tx);
                    }
                }
            }
            simulationLedger = PoverSimulation.step(roundWrites);
        }
        return { outbox: outbox, simulationLedger: simulationLedger };
    };
    Rollerblade.prototype.majorityVote = function (L) {
        var ret = [];
        for (var i = 0;; ++i) {
            var freq = {};
            for (var _i = 0, L_1 = L; _i < L_1.length; _i++) {
                var ledger = L_1[_i];
                if (typeof ledger[i] === 'undefined') {
                    continue;
                }
                if (!(ledger[i] in freq)) {
                    freq[ledger[i]] = 0;
                }
                freq[ledger[i]]++;
            }
            var pushed = false;
            for (var tx in freq) {
                if (freq[tx] > L.length / 2) {
                    ret.push(tx);
                    pushed = true;
                    break;
                }
            }
            if (!pushed) {
                break;
            }
        }
        return ret;
    };
    Rollerblade.prototype.step = function (currentRound) {
        // relay
        for (var j in this.Punder) {
            var transcript = this.Punder[j].marshall();
            for (var k in this.Punder) {
                if (k == j) {
                    continue;
                }
                this.Punder[k].writeLedger(this.Punder[k].encodeStringTx(['checkpoint', j, transcript]));
            }
        }
    };
    Rollerblade.prototype.readLedger = function (currentRound) {
        var overLedgers = [];
        for (var j in this.Punder) {
            var underLedger = this.Punder[j].readLedger();
            overLedgers.push(this.simulateOver(j, this.view(j, underLedger, currentRound), currentRound).simulationLedger);
        }
        return this.majorityVote(overLedgers);
    };
    Rollerblade.prototype.writeLedger = function (tx) {
        for (var j in this.Punder) {
            this.Punder[j].writeLedger(this.encodeRollerbladeTx(j, ['write', tx]));
        }
    };
    return Rollerblade;
}());
exports.default = Rollerblade;
function relay() {
    var checkpoints = [];
    for (var j in this.Punder) {
        checkpoints.push({
            sourceIndex: j,
            payload: this.Punder[j].transcribe()
        });
    }
    for (var j in this.Punder) {
        for (var _i = 0, checkpoints_1 = checkpoints; _i < checkpoints_1.length; _i++) {
            var checkpoint = checkpoints_1[_i];
            this.Punder.writeLedger(this.encodeRollerbladeTx(j, ['checkpoint', checkpoint]));
        }
    }
}
