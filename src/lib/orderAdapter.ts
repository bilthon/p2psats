// orderAdapter.ts — maps a parsed NIP-69 RawNip69Order to the UI-layer Order type.
//
// This is the Phase 2 adapter seam. It is a pure function with no side effects.
// Returns null when the order cannot be meaningfully represented in the UI
// (e.g. unknown fiat currency).

import type { Order, PaymentMethod, SourceId } from './types'
import type { RawNip69Order } from './nip69/parseOrder'
import { CCY_LIST, PAYMENT_METHODS, REF_RATES, SOURCES } from './data'
import type { Currency } from './types'

// All recognised platform identifiers. Any raw.platform not in this set falls
// back to the 'nostr' catch-all source.
const KNOWN_SOURCES = new Set<SourceId>([
  'mostro',
  'lnp2pbot',
  'robosats',
  'peach',
  'hodlhodl',
  'nostr',
])

// Build a lookup map from SOURCES for O(1) label resolution.
const SOURCE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s.label]),
)

// Case-insensitive index over known PaymentMethods for tolerant matching.
// Keys are lowercased id and lowercased label.
const PM_BY_LOWER = new Map<string, PaymentMethod>()
for (const pm of PAYMENT_METHODS) {
  PM_BY_LOWER.set(pm.id.toLowerCase(), pm)
  PM_BY_LOWER.set(pm.label.toLowerCase(), pm)
}

function resolvePaymentMethod(raw: string): PaymentMethod {
  const lower = raw.trim().toLowerCase()
  return (
    PM_BY_LOWER.get(lower) ?? {
      id: raw.trim(),
      label: raw.trim(),
      group: 'other',
      regions: '*',
    }
  )
}

/**
 * Parse the lnp2pbot positional rating tuple.
 *
 * The rating tag may be:
 *   - A positional string array (from parseOrder rest branch): ["0.97", "42", "30"]
 *   - A JSON object/scalar (unlikely in practice but handled)
 *   - Something else entirely
 *
 * When it looks like ["score", "total", ...]:
 *   score is a 0..1 fraction (or occasionally already 0..100 for legacy data).
 *   total is the number of trades.
 */
function parseRating(rating: unknown): { reputation: number; completion: number; trades: number } {
  const fallback = { reputation: 0, completion: 100, trades: 0 }

  if (!rating) return fallback

  // Array variant — positional tuple from parseOrder
  if (Array.isArray(rating) && rating.length >= 2) {
    const score = Number(rating[0])
    const total = Number(rating[1])
    if (!Number.isFinite(score) || !Number.isFinite(total)) return fallback

    const trades = Math.round(total) || 0

    // Determine whether score is a 0..1 fraction or a 0..100 integer.
    // If it's greater than 1, treat as already-percentaged.
    let completionRaw: number
    if (score > 1) {
      completionRaw = score
    } else {
      completionRaw = score * 100
    }
    const completion = Math.min(100, Math.max(0, Math.round(completionRaw)))

    return { reputation: trades, completion, trades }
  }

  return fallback
}

export function toVueOrder(
  raw: RawNip69Order,
  sourceRelay: string,
  // Live BTC reference rate for this order's fiat code, from the rates store.
  // Falls back to the static REF_RATES baked into data.ts when the live rate
  // hasn't loaded yet so the UI always has something to render.
  liveRate?: number,
): Order | null {
  // Only live, fillable orders should reach the depth chart and tables.
  // Canceled / in-progress / success / expired orders are dropped here.
  if (raw.status !== 'pending') return null

  // Filter to known currencies only
  const ccy = raw.fiatCode as Currency
  if (!CCY_LIST.includes(ccy)) return null

  // Resolve source identifier
  const sourceId: SourceId = KNOWN_SOURCES.has(raw.platform as SourceId)
    ? (raw.platform as SourceId)
    : 'nostr'

  const sourceLabel = SOURCE_LABEL_MAP[sourceId] ?? sourceId

  // Derive price from reference rate + premium. Prefer the live rate (yadio
  // via the btcRates store), fall back to the static REF_RATES on first load.
  const refRate = liveRate ?? REF_RATES[ccy]
  const price = Math.round(refRate * (1 + raw.premium / 100))

  // Market-priced orders (lnp2pbot) publish `amt: 0` and only commit a fiat
  // range. Derive an effective max-sats from the order's post-premium price:
  //   sats = (fiatAmount.max ?? fiatAmount.min) / price * 1e8
  // Fixed-sats orders (raw.satsAmount > 0) keep the wire value unchanged.
  const effectiveSats = (() => {
    if (raw.satsAmount > 0) return raw.satsAmount
    const fiat = raw.fiatAmount.max ?? raw.fiatAmount.min
    if (price <= 0 || !Number.isFinite(price)) return 0
    if (fiat <= 0 || !Number.isFinite(fiat)) return 0
    return Math.round((fiat / price) * 1e8)
  })()

  // Payment method resolution — tolerant
  const methods: PaymentMethod[] = raw.paymentMethods.map(resolvePaymentMethod)

  // Rating extraction
  const { reputation, completion, trades } = parseRating(raw.rating)

  // Age in minutes since the event was created
  const ageMin = Math.max(0, Math.floor((Date.now() / 1000 - raw.createdAt) / 60))

  // Time remaining before expiry (seconds); 0 if no expiresAt
  const expiresIn = raw.expiresAt ? Math.max(0, raw.expiresAt - Math.floor(Date.now() / 1000)) : 0

  return {
    id: raw.id,
    source: sourceId,
    sourceLabel,
    relay: sourceRelay,
    side: raw.kind,
    currency: ccy,
    premium: raw.premium,
    price,
    amountSats: effectiveSats,
    minFiat: raw.fiatAmount.min,
    maxFiat: raw.fiatAmount.max ?? raw.fiatAmount.min,
    methods,
    maker: raw.pubkey,
    makerHandle: raw.name ?? raw.pubkey.slice(0, 8),
    reputation,
    completion,
    trades,
    ageMin,
    kind: 38383,
    expiresIn,
  }
}
