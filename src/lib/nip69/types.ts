// Public type surface for the NIP-69 ingest layer.

export type { RawNip69Order, OrderKind, OrderStatus } from '@p2psats/shared/nip69/parseOrder'

export type RelayStatus = 'connecting' | 'open' | 'eosed' | 'error' | 'closed'
