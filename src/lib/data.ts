// data.ts — NIP-69 order book aggregator data and utilities.
// The data adapter seam has been wired to a real nostr subscription via
// src/lib/orderAdapter.ts (Phase 2). The mock builder (buildMockOrders) is
// retained for unit tests and a future ?demo=1 flag.
// Everything else (formatters, constants) stays stable.

import type { Currency, Order, PaymentMethod, Source, SourceId } from './types'

// ── Reference rates (fiat per 1 BTC). Realistic-ish May 2026 numbers. ─────────
export const REF_RATES: Record<Currency, number> = {
  USD: 92_400,
  EUR: 85_120,
  BRL: 472_000,
  ARS: 96_500_000,
  MXN: 1_580_000,
  VES: 3_412_000,
  ZAR: 1_692_000,
  RUB: 8_415_000,
  PEN: 343_700,
}

export const FIAT_FORMAT: Record<Currency, { symbol: string; decimals: number; locale: string }> = {
  USD: { symbol: '$',   decimals: 0, locale: 'en-US' },
  EUR: { symbol: '€',   decimals: 0, locale: 'de-DE' },
  BRL: { symbol: 'R$',  decimals: 0, locale: 'pt-BR' },
  ARS: { symbol: 'AR$', decimals: 0, locale: 'es-AR' },
  MXN: { symbol: 'MX$', decimals: 0, locale: 'es-MX' },
  VES: { symbol: 'Bs.', decimals: 0, locale: 'es-VE' },
  ZAR: { symbol: 'R',   decimals: 0, locale: 'en-ZA' },
  RUB: { symbol: '₽',   decimals: 0, locale: 'ru-RU' },
  PEN: { symbol: 'S/',  decimals: 0, locale: 'es-PE' },
}

export const CCY_LIST: Currency[] = ['USD', 'EUR', 'BRL', 'ARS', 'MXN', 'VES', 'ZAR', 'RUB', 'PEN']

export const CCY_LABEL: Record<Currency, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  BRL: 'Brazilian Real',
  ARS: 'Argentine Peso',
  MXN: 'Mexican Peso',
  VES: 'Bolívar Soberano',
  ZAR: 'South African Rand',
  RUB: 'Russian Ruble',
  PEN: 'Peruvian Sol',
}

export const SOURCES: Source[] = [
  { id: 'mostro',    label: 'mostro',   relay: 'relay.mostro.network',   color: '#6366F1' },
  { id: 'lnp2pbot',  label: 'lnp2pbot', relay: 'relay.lnp2pbot.com',     color: '#10B981' },
  { id: 'robosats',  label: 'robosats', relay: 'nostr.robosats.org',     color: '#F59E0B' },
  { id: 'peach',     label: 'peach',    relay: 'relay.peachbitcoin.com', color: '#EC4899' },
  { id: 'hodlhodl',  label: 'hodlhodl', relay: '—',                      color: '#8B5CF6' },
  { id: 'nostr',     label: 'nostr',    relay: '—',                      color: '#94A3B8' },
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'sepa',          label: 'SEPA',          group: 'bank',   regions: ['EUR'] },
  { id: 'wire',          label: 'Wire',          group: 'bank',   regions: ['USD'] },
  { id: 'ach',           label: 'ACH',           group: 'bank',   regions: ['USD'] },
  { id: 'pix',           label: 'PIX',           group: 'bank',   regions: ['BRL'] },
  { id: 'spei',          label: 'SPEI',          group: 'bank',   regions: ['MXN'] },
  { id: 'transferencia', label: 'Transferencia', group: 'bank',   regions: ['ARS', 'VES', 'PEN'] },
  { id: 'eft',           label: 'EFT',           group: 'bank',   regions: ['ZAR'] },
  { id: 'sbp',           label: 'SBP',           group: 'bank',   regions: ['RUB'] },
  { id: 'cash',          label: 'Cash',          group: 'cash',   regions: '*' },
  { id: 'revolut',       label: 'Revolut',       group: 'wallet', regions: ['EUR', 'GBP'] },
  { id: 'wise',          label: 'Wise',          group: 'wallet', regions: '*' },
  { id: 'paypal',        label: 'PayPal',        group: 'wallet', regions: ['USD', 'EUR'] },
  { id: 'venmo',         label: 'Venmo',         group: 'wallet', regions: ['USD'] },
  { id: 'cashapp',       label: 'Cash App',      group: 'wallet', regions: ['USD'] },
  { id: 'mpesa',         label: 'M-Pesa',        group: 'mobile', regions: ['KES', 'ZAR'] },
  { id: 'mercadopago',   label: 'Mercado Pago',  group: 'wallet', regions: ['ARS', 'MXN', 'BRL'] },
  { id: 'zelle',         label: 'Zelle',         group: 'bank',   regions: ['USD', 'VES'] },
  { id: 'lightning',     label: 'Lightning',     group: 'btc',    regions: '*' },
  { id: 'giftcard',      label: 'Gift card',     group: 'gift',   regions: '*' },
]

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNpub(rng: () => number): string {
  const hex = 'abcdef0123456789'
  let s = 'npub1'
  for (let i = 0; i < 58; i++) s += hex[Math.floor(rng() * hex.length)]
  return s
}

const MAKER_HANDLES = [
  'satoshi', 'hodlr', 'lncrypt', 'blockfox', 'minty', 'midnight',
  'kyo', 'ada', 'zk', 'nakamori', 'bramble', 'quill', 'kobold', 'fission',
]

// Build a mock order set for a given currency. Premium is %-deviation from REF.
// Retained for unit tests and the ?demo=1 flag; real orders come via orderAdapter.ts.
export function buildMockOrders(currency: Currency, count = 22, seed = 42): Order[] {
  const rng = mulberry32(seed + currency.charCodeAt(0) * 7)
  const ref = REF_RATES[currency]
  const orders: Order[] = []
  const methodsForCcy = PAYMENT_METHODS.filter(
    (m) => m.regions === '*' || (m.regions as string[]).includes(currency),
  )

  for (let i = 0; i < count; i++) {
    const side: 'buy' | 'sell' = rng() < 0.5 ? 'buy' : 'sell'
    const bias = side === 'buy' ? -1 : 1
    const crosses = rng() < 0.12
    const premBase = 0.05 + Math.pow(rng(), 1.6) * 5.95
    const jitter = rng() * 0.6
    const sign = crosses ? -bias : bias
    const premium = +(sign * (premBase + jitter)).toFixed(2)
    const price = Math.round(ref * (1 + premium / 100))

    const decade: [number, number] =
      currency === 'ARS' || currency === 'VES'
        ? [50_000, 50_000_000]
        : currency === 'BRL' || currency === 'MXN' || currency === 'RUB'
          ? [100, 200_000]
          : [25, 25_000]

    const minF = Math.round(decade[0] * (0.5 + rng()))
    const maxF = Math.round(minF * (1.2 + rng() * 6))
    const amountSats = Math.round((maxF / price) * 1e8)

    const nMethods = 1 + Math.floor(rng() * 2.6)
    const picked: PaymentMethod[] = []
    while (picked.length < nMethods && picked.length < methodsForCcy.length) {
      const m = methodsForCcy[Math.floor(rng() * methodsForCcy.length)]
      if (!picked.find((p) => p.id === m.id)) picked.push(m)
    }

    const source = SOURCES[Math.floor(rng() * SOURCES.length)]
    const ageMin = Math.floor(rng() * 720)
    const rep = Math.floor(rng() * 200)
    const completion = 80 + Math.floor(rng() * 21)

    orders.push({
      id: 'evt_' + (seed + i).toString(16).padStart(6, '0') + Math.floor(rng() * 1e6).toString(16),
      side,
      price,
      premium,
      currency,
      minFiat: minF,
      maxFiat: maxF,
      amountSats,
      methods: picked,
      source: source.id as SourceId,
      sourceLabel: source.label,
      relay: source.relay,
      maker: makeNpub(rng),
      makerHandle:
        MAKER_HANDLES[Math.floor(rng() * MAKER_HANDLES.length)] + Math.floor(rng() * 99),
      reputation: rep,
      completion,
      trades: Math.floor(rng() * 400),
      ageMin,
      kind: 38383,
      expiresIn: 60 + Math.floor(rng() * 540),
    })
  }
  return orders
}

// ── Format helpers ────────────────────────────────────────────────────────────
export function fmtFiat(n: number, ccy: Currency, opts: { bare?: boolean } = {}): string {
  const f = FIAT_FORMAT[ccy] ?? FIAT_FORMAT['USD']
  const v = Math.round(n)
  const formatted = v.toLocaleString(f.locale, { maximumFractionDigits: f.decimals })
  return opts.bare ? formatted : `${f.symbol}${formatted}`
}

export function fmtSats(sats: number): string {
  return Math.round(sats).toLocaleString('en-US') + ' sats'
}

export function fmtSatsCompact(sats: number): string {
  if (sats >= 1e8) return (sats / 1e6).toFixed(1) + 'M sats'
  if (sats >= 1e6) return (sats / 1e6).toFixed(2) + 'M sats'
  if (sats >= 1e3) return (sats / 1e3).toFixed(0) + 'k sats'
  return Math.round(sats).toLocaleString('en-US') + ' sats'
}

export function fmtAge(min: number): string {
  if (min < 1) return 'just now'
  if (min < 60) return min + 'm ago'
  const h = Math.floor(min / 60)
  if (h < 24) return h + 'h ' + (min % 60) + 'm ago'
  return Math.floor(h / 24) + 'd ago'
}

export function fmtPremium(p: number): string {
  const sign = p > 0 ? '+' : ''
  return sign + p.toFixed(2) + '%'
}

export function fmtTimeShort(min: number): string {
  if (min < 1) return 'now'
  if (min < 60) return min + 'm'
  const h = Math.floor(min / 60)
  if (h < 24) return h + 'h'
  return Math.floor(h / 24) + 'd'
}

export function midPrice(orders: Order[], currency: Currency): number | null {
  const buys = orders.filter((o) => o.side === 'buy' && o.currency === currency).map((o) => o.price)
  const sells = orders
    .filter((o) => o.side === 'sell' && o.currency === currency)
    .map((o) => o.price)
  if (!buys.length || !sells.length) return null
  return (Math.max(...buys) + Math.min(...sells)) / 2
}

export function methodsForCurrency(currency: Currency): PaymentMethod[] {
  return PAYMENT_METHODS.filter(
    (m) => m.regions === '*' || (m.regions as string[]).includes(currency),
  )
}
