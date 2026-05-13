// NIP-69 (kind 38383) order parser, ported from nip69-explorer/src/order.ts.
//
// Differences vs source:
//   1. Browser-safe: imports Event from 'nostr-tools' only — no 'ws' dependency,
//      no useWebSocketImplementation. The browser supplies globalThis.WebSocket.
//   2. The exported interface is renamed `Order` → `RawNip69Order` to avoid
//      collision with p2psats's existing UI-layer `Order` type at
//      src/lib/types.ts.
//
// The lnp2pbot quirks (newline-separated `pm`, positional `rating` tuple) and
// the optional-in-practice handling of `expires_at` / `expiration` are
// preserved verbatim — see the source comments.

import { type Event } from 'nostr-tools'

export type OrderKind = 'buy' | 'sell'
export type OrderStatus = 'pending' | 'canceled' | 'in-progress' | 'success' | 'expired'

export interface RawNip69Order {
  id: string
  kind: OrderKind
  fiatCode: string
  status: OrderStatus
  satsAmount: number
  // fa tag may be a range: ["fa","100"] or ["fa","100","200"]
  fiatAmount: { min: number; max?: number }
  paymentMethods: string[]
  premium: number
  expiresAt?: number
  expiration?: number
  platform: string
  source?: string
  rating?: unknown
  network?: string
  layer?: string
  name?: string
  geohash?: string
  bond?: string
  rawEventId: string
  pubkey: string
  createdAt: number
}

const ORDER_KINDS = new Set<string>(['buy', 'sell'])
const ORDER_STATUSES = new Set<string>([
  'pending',
  'canceled',
  'in-progress',
  'success',
  'expired',
])
// expires_at and expiration are spec-mandatory but real implementations omit them, so we
// only require the tags that are universally present in observed wire data.
const MANDATORY = ['d', 'k', 'f', 's', 'amt', 'fa', 'pm', 'premium', 'y', 'z'] as const

type TagMap = Map<string, string[][]>

function buildTagMap(tags: string[][]): TagMap {
  const map: TagMap = new Map()
  for (const tag of tags) {
    const name = tag[0]
    if (!name) continue
    const existing = map.get(name)
    if (existing) {
      existing.push(tag)
    } else {
      map.set(name, [tag])
    }
  }
  return map
}

function first(map: TagMap, name: string): string[] | undefined {
  return map.get(name)?.[0]
}

function val(map: TagMap, name: string): string | undefined {
  return first(map, name)?.[1]
}

export function parseOrder(event: Event): RawNip69Order | null {
  const map = buildTagMap(event.tags)

  for (const tag of MANDATORY) {
    if (!map.has(tag)) return null
  }

  const id = val(map, 'd')
  const k = val(map, 'k')
  const f = val(map, 'f')
  const s = val(map, 's')
  const amtStr = val(map, 'amt')
  const pmStr = val(map, 'pm')
  const premiumStr = val(map, 'premium')
  const platform = val(map, 'y')
  const z = val(map, 'z')

  if (
    !id ||
    !k ||
    !f ||
    !s ||
    amtStr === undefined ||
    !pmStr ||
    premiumStr === undefined ||
    !platform ||
    !z
  ) {
    return null
  }

  if (!ORDER_KINDS.has(k)) return null
  if (!ORDER_STATUSES.has(s)) return null
  if (z !== 'order') return null

  const satsAmount = Number(amtStr)
  if (!Number.isFinite(satsAmount)) return null

  const premium = Number(premiumStr)
  if (!Number.isFinite(premium)) return null

  const expiresAtStr = val(map, 'expires_at')
  let expiresAt: number | undefined
  if (expiresAtStr !== undefined) {
    const n = Number(expiresAtStr)
    if (Number.isFinite(n)) expiresAt = n
  }

  const expirationStr = val(map, 'expiration')
  let expiration: number | undefined
  if (expirationStr !== undefined) {
    const n = Number(expirationStr)
    if (Number.isFinite(n)) expiration = n
  }

  const faTag = first(map, 'fa')
  if (!faTag) return null
  const faMin = Number(faTag[1])
  if (!Number.isFinite(faMin)) return null
  const fiatAmount: { min: number; max?: number } = { min: faMin }
  if (faTag[2] !== undefined) {
    const faMax = Number(faTag[2])
    if (Number.isFinite(faMax)) fiatAmount.max = faMax
  }

  // Spec says comma-separated; lnp2pbot uses newlines; CRLF defensively included.
  const paymentMethods = pmStr
    .split(/[,\r\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Spec calls for JSON, but real implementations (lnp2pbot) emit a positional tuple
  // ["rating", <score>, <total>, <days>...]. Try JSON first, fall back to raw rest.
  let rating: unknown
  const ratingTag = first(map, 'rating')
  if (ratingTag && ratingTag.length > 1) {
    const rest = ratingTag.slice(1)
    if (rest.length === 1) {
      const single = rest[0]
      if (single !== undefined) {
        try {
          rating = JSON.parse(single)
        } catch {
          rating = single
        }
      }
    } else {
      rating = rest
    }
  }

  return {
    id,
    kind: k as OrderKind,
    fiatCode: f,
    status: s as OrderStatus,
    satsAmount,
    fiatAmount,
    paymentMethods,
    premium,
    expiresAt,
    expiration,
    platform,
    source: val(map, 'source'),
    rating,
    network: val(map, 'network'),
    layer: val(map, 'layer'),
    name: val(map, 'name'),
    geohash: val(map, 'g'),
    bond: val(map, 'bond'),
    rawEventId: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
  }
}
