// Pinia store: live NIP-69 (kind 38383) orderbook over a SimplePool.
//
// Browser-safe by design — relies on globalThis.WebSocket and does NOT call
// useWebSocketImplementation or import 'ws'.
//
// The store is the single source of truth for parsed NIP-69 orders coming off
// the wire. The Vue layer (Phase 2) reads `orders` / `relayStatus` /
// `lastEventAt` and decides how to project them into UI shape.

import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import type { Event } from 'nostr-tools'

import { parseOrder, type RawNip69Order } from '@p2psats/shared/nip69/parseOrder'
import { RELAYS } from '@p2psats/shared/nip69/relays'
import type { RelayStatus } from '@/lib/nip69/types'

// Minimal subscription handle shape we rely on. We avoid importing
// `SubCloser` directly so the store stays compatible across nostr-tools 2.x
// patch revisions.
type SubHandle = { close: (reason?: string) => void }

// Initial relay status snapshot — every configured relay starts as 'connecting'.
function initialRelayStatus(): Record<string, RelayStatus> {
  const out: Record<string, RelayStatus> = {}
  for (const url of RELAYS) out[url] = 'connecting'
  return out
}

export const useNostrOrderbookStore = defineStore('nostrOrderbook', () => {
  // ── State ────────────────────────────────────────────────────────────────

  // Keyed by replaceable-event coordinate `${pubkey}:${dTag}`. Stored as a
  // shallowRef so we can mutate the Map in place and call triggerRef() to
  // notify reactive consumers — far cheaper than rebuilding the Map on each
  // event.
  const orders = shallowRef<Map<string, RawNip69Order>>(new Map())

  // Raw nostr Event objects, keyed identically to `orders`. Consumers that
  // need the full event (e.g. OrderDetailDialog's JSON view) read from here.
  // triggerRef(events) is called alongside triggerRef(orders) in scheduleFlush
  // so both refs fire in the same microtask batch.
  const events = shallowRef<Map<string, Event>>(new Map())

  // First relay URL that delivered each order (same key as `orders`). Powers
  // the per-row "source relay" UI without changing the parsed-order shape.
  const seenOn = shallowRef<Map<string, string>>(new Map())

  const relayStatus = ref<Record<string, RelayStatus>>(initialRelayStatus())

  const lastEventAt = ref<number>(0)

  // ── Internal (non-reactive) refs ────────────────────────────────────────

  let pool: SimplePool | null = null
  let sub: SubHandle | null = null
  let sweepHandle: ReturnType<typeof setInterval> | null = null
  // Trailing-edge coalescer for triggerRef(orders) — avoids firing one
  // reactive update per event during the initial backfill burst.
  let flushHandle: ReturnType<typeof setTimeout> | null = null
  function scheduleFlush() {
    if (flushHandle !== null) return
    flushHandle = setTimeout(() => {
      flushHandle = null
      triggerRef(orders)
      triggerRef(events)
    }, 50)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function setRelayStatus(url: string, status: RelayStatus) {
    // Defensive: only update keys we know about so unrelated callbacks can't
    // pollute the map.
    if (url in relayStatus.value) {
      relayStatus.value = { ...relayStatus.value, [url]: status }
    }
  }

  function ingest(ev: Event) {
    const parsed = parseOrder(ev)
    if (!parsed) return

    // NIP-01 addressable-event coordinate: kind:pubkey:d. Kind is fixed at
    // 38383, so pubkey:d is sufficient as a dedupe key inside this store.
    const key = `${parsed.pubkey}:${parsed.id}`

    const existing = orders.value.get(key)
    if (existing) {
      // Replaceable-event resolution: keep newest by created_at, ties broken
      // by lexicographically smaller event id (NIP-01 §replaceable events).
      if (parsed.createdAt < existing.createdAt) return
      if (
        parsed.createdAt === existing.createdAt &&
        parsed.rawEventId >= existing.rawEventId
      ) {
        return
      }
    }

    orders.value.set(key, parsed)
    events.value.set(key, ev)
    // Attribute the order to the first relay we saw it on. SimplePool
    // populates `seenOn` only when `trackRelays = true` (set in connect()),
    // and does so before calling onevent — so the lookup is safe here.
    if (pool && !seenOn.value.has(key)) {
      const seen = pool.seenOn.get(parsed.rawEventId)
      const url = seen ? seen.values().next().value?.url : undefined
      if (url) seenOn.value.set(key, url)
    }
    scheduleFlush()
    lastEventAt.value = Date.now()
  }

  function sweepExpired() {
    const nowSec = Date.now() / 1000
    let mutated = false
    for (const [key, o] of orders.value) {
      // Effective expiry: NIP-69 `expires_at` first, NIP-40 `expiration` as
      // fallback. Both are unix timestamps in seconds.
      const exp = o.expiresAt ?? o.expiration
      if (exp !== undefined && exp < nowSec) {
        orders.value.delete(key)
        events.value.delete(key)
        seenOn.value.delete(key)
        mutated = true
      }
    }
    if (mutated) {
      triggerRef(orders)
      triggerRef(events)
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  function connect() {
    if (pool) return // idempotent

    pool = new SimplePool()
    // Required for per-event relay attribution via `pool.seenOn`.
    pool.trackRelays = true

    pool.onRelayConnectionSuccess = (url: string) => {
      setRelayStatus(url, 'open')
    }
    pool.onRelayConnectionFailure = (url: string) => {
      setRelayStatus(url, 'error')
    }

    // subscribeMany(relays, filter, params) — note: single Filter, not Filter[].
    // `oneose` and `onclose` in this version do NOT receive a per-relay url;
    // `onclose` receives an array of reasons (one per relay). We mark all
    // relays 'eosed' on first EOSE — relay-by-relay tracking would require
    // per-relay subscriptions, which is out of scope for Phase 1.
    sub = pool.subscribeMany(
      RELAYS,
      { kinds: [38383] },
      {
        onevent: (ev: Event) => {
          if (import.meta.env.DEV) {
            console.debug('[nostrOrderbook] event', ev.id.slice(0, 8))
          }
          ingest(ev)
        },
        oneose: () => {
          for (const url of RELAYS) {
            if (relayStatus.value[url] === 'open' || relayStatus.value[url] === 'connecting') {
              setRelayStatus(url, 'eosed')
            }
          }
        },
        onclose: (reasons: string[]) => {
          if (import.meta.env.DEV) {
            console.debug('[nostrOrderbook] subscription closed', reasons)
          }
          for (const url of RELAYS) setRelayStatus(url, 'closed')
        },
      },
    )

    // Periodic sweep of expired orders. 15 s cadence is a good compromise
    // between UI freshness and waking the event loop unnecessarily.
    sweepHandle = setInterval(sweepExpired, 15_000)
  }

  function disconnect() {
    // No-op when never connected — preserves the initial 'connecting' status
    // so a stray disconnect() call doesn't paint the UI as 'closed'.
    if (!pool && !sub && !sweepHandle && !flushHandle) return

    if (sweepHandle !== null) {
      clearInterval(sweepHandle)
      sweepHandle = null
    }
    if (flushHandle !== null) {
      clearTimeout(flushHandle)
      flushHandle = null
    }
    if (sub) {
      try {
        sub.close()
      } catch {
        // best-effort — already-closed subs throw in some versions
      }
      sub = null
    }
    if (pool) {
      try {
        pool.close(RELAYS)
      } catch {
        // ditto
      }
      pool = null
    }
    for (const url of RELAYS) setRelayStatus(url, 'closed')
  }

  return {
    // state
    orders,
    events,
    seenOn,
    relayStatus,
    lastEventAt,
    // actions
    connect,
    disconnect,
  }
})
