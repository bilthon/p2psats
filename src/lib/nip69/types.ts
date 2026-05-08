// Public type surface for the NIP-69 ingest layer.

export type { RawNip69Order, OrderKind, OrderStatus } from './parseOrder'

export type RelayStatus = 'connecting' | 'open' | 'eosed' | 'error' | 'closed'
