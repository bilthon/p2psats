// orderAdapter.ts — maps a parsed NIP-69 RawNip69Order to the UI-layer Order type.
//
// This is the Phase 2 adapter seam. It is a pure function with no side effects.
// Returns null when the order cannot be meaningfully represented in the UI
// (e.g. unknown fiat currency).

import type { Order, PaymentMethod, RepProps, SourceId, RawNip69Order, Currency } from '@p2psats/shared'
import { PAYMENT_METHODS, REF_RATES, SOURCES } from './data'
import { FIAT_CODE_SET } from './currency'

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
 * Derive the per-platform reputation summary for the Rep cell in the
 * order tables. Each platform encodes reputation differently:
 *
 *   lnp2pbot — positional string array `[stars, days, trades]` (1–5 stars)
 *   mostro   — object `{ days, total_rating: 1–5, total_reviews }`
 *   peach    — object `{ total_rating: 1–5, total_reviews }` (rating is a
 *              sentinel `1` when total_reviews is 0)
 *   robosats — no rating tag at all
 */
function deriveRep(rating: unknown, platform: string): RepProps {
  // lnp2pbot: positional string array [stars, days, trades]
  if (platform === 'lnp2pbot' && Array.isArray(rating) && rating.length >= 1) {
    const stars = Number(rating[0])
    const days = rating.length >= 2 ? Number(rating[1]) : NaN
    const trades = rating.length >= 3 ? Number(rating[2]) : NaN
    if (Number.isFinite(stars)) {
      const count = Number.isFinite(trades) ? Math.round(trades) : 0
      const daysRounded = Number.isFinite(days) ? Math.round(days) : undefined
      const parts = [`${stars.toFixed(2)} stars`, `${count} trades`]
      if (daysRounded !== undefined) parts.push(`${daysRounded} days on platform`)
      return { kind: 'stars', rating: stars, count, days: daysRounded, tooltip: parts.join(' · ') }
    }
  }

  // mostro / peach: object with total_rating + total_reviews (mostro also has days)
  if ((platform === 'mostro' || platform === 'peach') && rating && typeof rating === 'object') {
    const r = rating as { total_rating?: unknown; total_reviews?: unknown; days?: unknown }
    const reviews = Number(r.total_reviews)
    const stars = Number(r.total_rating)
    // Peach defaults rating to 1 when there are zero reviews — sentinel, not data.
    if (Number.isFinite(reviews) && reviews > 0 && Number.isFinite(stars)) {
      const days = Number(r.days)
      const daysRounded = Number.isFinite(days) ? Math.round(days) : undefined
      const parts = [`${stars.toFixed(2)} stars`, `${reviews} reviews`]
      if (daysRounded !== undefined) parts.push(`${daysRounded} days on platform`)
      return {
        kind: 'stars',
        rating: stars,
        count: reviews,
        days: daysRounded,
        tooltip: parts.join(' · '),
      }
    }
    if (platform === 'peach') return { kind: 'empty', tooltip: 'No reviews yet' }
  }

  // robosats and unknowns: no signal
  if (platform === 'robosats') {
    return { kind: 'empty', tooltip: 'Robosats does not publish reputation data' }
  }
  return { kind: 'empty', tooltip: 'No reputation data' }
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

  const fiatCode = raw.fiatCode
  if (!FIAT_CODE_SET.has(fiatCode)) return null
  const ccy = fiatCode as Currency

  // Resolve source identifier
  const sourceId: SourceId = KNOWN_SOURCES.has(raw.platform as SourceId)
    ? (raw.platform as SourceId)
    : 'nostr'

  const sourceLabel = SOURCE_LABEL_MAP[sourceId] ?? sourceId

  // Derive price from reference rate + premium. Prefer the live rate (yadio
  // via the btcRates store), fall back to the static REF_RATES on first load.
  const refRate = liveRate ?? REF_RATES[ccy] ?? 100_000
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

  // Per-platform reputation summary
  const rep = deriveRep(raw.rating, raw.platform)

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
    makerHandle: raw.name ?? 'N/A',
    rep,
    ageMin,
    kind: 38383,
    expiresIn,
    pmRaw: raw.pmRaw,
  }
}
