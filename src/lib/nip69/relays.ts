// Authoritative relay → platform map for NIP-69 (kind 38383) ingest.
// The list of relays we connect to is derived from the keys of this map.

export const RELAY_PLATFORMS: Record<string, string[]> = {
  'wss://nostr.robosats.org': ['robosats', 'nostr'],
  'wss://freelay.sovbit.host': ['robosats', 'peach', 'nostr'],
  'wss://relay.damus.io': ['lnp2pbot', 'peach', 'nostr'],
  'wss://relay.snort.social': ['hodlhodl', 'lnp2pbot', 'nostr'],
  'wss://relay.mostro.network': ['mostro', 'nostr'],
  'wss://relay.primal.net': ['peach', 'hodlhodl', 'nostr'],
  'wss://nos.lol': ['lnp2pbot', 'mostro', 'nostr'],
}

export const RELAYS: string[] = Object.keys(RELAY_PLATFORMS)
