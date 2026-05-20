// nostrProfile.ts — single-purpose Nostr kind:0 (profile metadata) fetcher
// with localStorage caching.
//
// Profile data changes slowly; positive results are cached 24h,
// negative (no kind:0 found) results are cached 1h to avoid hammering
// relays on every render for users who have no profile published.

import { SimplePool } from 'nostr-tools/pool'
import { RELAYS } from '@/lib/relays'

// Extend the orderbook relay list with two profile-aggregator relays for
// better hit rates. DO NOT modify relays.ts — this const is local.
const PROFILE_RELAYS: string[] = [
  ...RELAYS,
  'wss://purplepag.es',
  'wss://relay.nostr.band',
]

const TTL_POSITIVE = 24 * 60 * 60 * 1000 // 24 hours
const TTL_NEGATIVE = 60 * 60 * 1000      // 1 hour

export interface NostrProfile {
  name?: string
  displayName?: string
  picture?: string
  nip05?: string
  about?: string
}

interface CacheEntry {
  profile: NostrProfile | null
  fetchedAt: number
}

// ---------------------------------------------------------------------------
// localStorage helpers (duplicated from appStore.ts pattern to keep this
// module self-contained with zero cross-module side effects)
// ---------------------------------------------------------------------------

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw != null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchNostrProfile(pubkey: string): Promise<NostrProfile | null> {
  // SSR guard: no window / WebSocket available during vite-ssg prerender.
  if (typeof window === 'undefined') return null

  const cacheKey = `pe.nostrProfile.${pubkey}`
  const cached = readStorage<CacheEntry | null>(cacheKey, null)

  if (cached !== null) {
    const ttl = cached.profile !== null ? TTL_POSITIVE : TTL_NEGATIVE
    if (Date.now() - cached.fetchedAt < ttl) {
      return cached.profile
    }
  }

  // Cache miss or expired — fetch from relays.
  const pool = new SimplePool()
  let profile: NostrProfile | null = null

  try {
    const events = await pool.querySync(
      PROFILE_RELAYS,
      { kinds: [0], authors: [pubkey] },
      { maxWait: 5000 },
    )

    if (events.length > 0) {
      // Take the event with the largest created_at.
      const newest = events.reduce((a, b) => (a.created_at >= b.created_at ? a : b))

      try {
        const content = JSON.parse(newest.content) as Record<string, unknown>

        profile = {
          ...(typeof content['name'] === 'string' ? { name: content['name'] } : {}),
          // wire format uses snake_case display_name; map to camelCase
          ...(typeof content['display_name'] === 'string'
            ? { displayName: content['display_name'] }
            : {}),
          ...(typeof content['picture'] === 'string' ? { picture: content['picture'] } : {}),
          ...(typeof content['nip05'] === 'string' ? { nip05: content['nip05'] } : {}),
          ...(typeof content['about'] === 'string' ? { about: content['about'] } : {}),
        }
      } catch {
        // Malformed JSON content — treat as no profile.
        profile = null
      }
    }
  } finally {
    pool.close(PROFILE_RELAYS)
  }

  writeStorage(cacheKey, { profile, fetchedAt: Date.now() } satisfies CacheEntry)
  return profile
}
