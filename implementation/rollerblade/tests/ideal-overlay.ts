import { IdealOverlayLedgerProtocol } from '../ideal-overlay'

const P1 = new IdealOverlayLedgerProtocol(0, 3, [])
const P2 = new IdealOverlayLedgerProtocol(1, 3, [])
const P3 = new IdealOverlayLedgerProtocol(2, 3, [])

P1.write('a')
P2.write('b')
console.log(P3.read())