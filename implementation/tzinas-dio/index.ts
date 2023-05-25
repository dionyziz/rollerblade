import { Relayer } from './rollerblade/relayer'
import { Rollerblade } from './rollerblade/rollerblade'
import { Streamlet } from './streamlet/streamlet'
import { UnderlyingLedgerProtocol } from './underlying-ledger-protocol'

const Y: UnderlyingLedgerProtocol[] = []
const sid = 'rollerblade'
const rollerblade = new Rollerblade<typeof Streamlet>(sid, 1, Y, Streamlet)
const relayer = new Relayer(sid, Y)