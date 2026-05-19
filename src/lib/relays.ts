// The Nostr relays we subscribe to for kind:38383 (NIP-69) orderbook events.
//
// Kept in the frontend (not the shared library) because the relay list is
// operational config, not a shared type/contract — the backend has its own
// copy at p2psats-backend/src/orders/relays.ts and the two are allowed to
// diverge. If you add or remove relays here, consider whether the backend's
// list should follow; nothing enforces synchronization at runtime.
export const RELAYS: string[] = [
  'wss://nostr.robosats.org',
  'wss://freelay.sovbit.host',
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://relay.mostro.network',
  'wss://relay.primal.net',
  'wss://nos.lol',
]
