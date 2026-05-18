// appStore.ts — single Pinia store for all cross-cutting app state.
// localStorage keys use the pe.* prefix (renamed from pb.*).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { methodsForCurrency, midPrice } from '@/lib/data'
import { detectCrosses } from '@/lib/arbitrage'
import { matchesRule } from '@p2psats/shared'
import { useNostrOrderbookStore } from '@/services/nostrOrderbook'
import { useBtcRatesStore } from '@/services/btcRates'
import { toVueOrder } from '@/lib/orderAdapter'
import type { Alert, Currency, Order } from '@p2psats/shared'
import { setLocale as i18nSetLocale, detectInitialLocale, type AppLocale } from '@/i18n'

const PE_KEYS = {
  currency: 'pe.currency',
  sources: 'pe.sources',
  alerts: 'pe.alerts',
  theme: 'pe.theme',
} as const

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

export const useAppStore = defineStore('app', () => {
  // ── Persisted state ──────────────────────────────────────────────────────
  const locale = ref<AppLocale>(detectInitialLocale())
  const currency = ref<Currency>(readStorage<Currency>(PE_KEYS.currency, 'USD'))

  // Theme — persisted under pe.theme, respects prefers-color-scheme on first visit.
  // During SSG prerender (Node) window is undefined — default to 'light'.
  function detectInitialTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light'
    const stored = readStorage<string>(PE_KEYS.theme, '')
    if (stored === 'light' || stored === 'dark') return stored
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    } catch { /* matchMedia not available */ }
    return 'light'
  }

  const theme = ref<'light' | 'dark'>(detectInitialTheme())
  const activeSources = ref<string[]>(
    readStorage<string[]>(PE_KEYS.sources, ['mostro', 'lnp2pbot', 'robosats', 'peach']),
  )
  // One-time localStorage migration: old Alert shape had `email: string`.
  // Shared lib 1.0.0 replaced it with `emailEnabled: boolean` + `nostrEnabled: boolean`.
  const alerts = ref<Alert[]>(
    readStorage<(Alert & { email?: string })[]>(PE_KEYS.alerts, []).map((a) => {
      if ('email' in a && typeof a.email === 'string') {
        const { email: _dropped, ...rest } = a
        return { ...rest, emailEnabled: true, nostrEnabled: false } as Alert
      }
      return a as Alert
    }),
  )

  // ── Derived / computed ───────────────────────────────────────────────────

  // allOrders reads from the live nostr orderbook store and resolves each
  // order's price using the live yadio rate (or the static fallback until the
  // rates store has fetched).
  const allOrders = computed<Order[]>(() => {
    const nostr = useNostrOrderbookStore()
    const btcRates = useBtcRatesStore()
    const result: Order[] = []
    for (const [key, raw] of nostr.orders.entries()) {
      const relay = nostr.seenOn.get(key) ?? 'nostr'
      const liveRate = btcRates.rates[raw.fiatCode]
      const vue = toVueOrder(raw, relay, liveRate)
      if (vue !== null) result.push(vue)
    }
    return result
  })

  const ccyOrders = computed<Order[]>(() =>
    allOrders.value.filter(
      (o) => o.currency === currency.value && activeSources.value.includes(o.source),
    ),
  )

  const crosses = computed(() => detectCrosses(ccyOrders.value, currency.value))

  const matchesByAlert = computed<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    alerts.value.forEach((a) => {
      out[a.id] = allOrders.value.filter(
        (o) => activeSources.value.includes(o.source) && matchesRule(o, a),
      ).length
    })
    return out
  })

  const methodsForCcy = computed(() => methodsForCurrency(currency.value))

  const mid = computed(() => midPrice(ccyOrders.value, currency.value))

  const buys = computed(() => ccyOrders.value.filter((o) => o.side === 'buy'))
  const sells = computed(() => ccyOrders.value.filter((o) => o.side === 'sell'))

  const totalBidsSats = computed(() => buys.value.reduce((s, o) => s + o.amountSats, 0))
  const totalAsksSats = computed(() => sells.value.reduce((s, o) => s + o.amountSats, 0))

  const bestBid = computed(() =>
    buys.value.length ? Math.max(...buys.value.map((o) => o.price)) : null,
  )
  const bestAsk = computed(() =>
    sells.value.length ? Math.min(...sells.value.map((o) => o.price)) : null,
  )
  const spread = computed(() =>
    bestBid.value !== null && bestAsk.value !== null ? bestAsk.value - bestBid.value : null,
  )
  const spreadPct = computed(() =>
    spread.value !== null && mid.value !== null ? (spread.value / mid.value) * 100 : null,
  )

  const activeAlerts = computed(() => alerts.value.filter((a) => a.enabled !== false).length)
  const totalActiveMatches = computed(() =>
    Object.values(matchesByAlert.value).reduce((s, n) => s + n, 0),
  )

  // ── Mutating actions ─────────────────────────────────────────────────────

  function setLocale(l: AppLocale) {
    locale.value = l
    i18nSetLocale(l)
  }

  function setTheme(t: 'light' | 'dark') {
    theme.value = t
    writeStorage(PE_KEYS.theme, t)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t)
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  function setCurrency(c: Currency) {
    currency.value = c
    writeStorage(PE_KEYS.currency, c)
  }

  function toggleSource(id: string) {
    if (activeSources.value.includes(id)) {
      activeSources.value = activeSources.value.filter((s) => s !== id)
    } else {
      activeSources.value = [...activeSources.value, id]
    }
    writeStorage(PE_KEYS.sources, activeSources.value)
  }

  function addAlert(alert: Alert) {
    alerts.value = [alert, ...alerts.value]
    writeStorage(PE_KEYS.alerts, alerts.value)
  }

  function removeAlert(id: string) {
    alerts.value = alerts.value.filter((a) => a.id !== id)
    writeStorage(PE_KEYS.alerts, alerts.value)
  }

  function toggleAlert(id: string) {
    alerts.value = alerts.value.map((a) =>
      a.id === id ? { ...a, enabled: a.enabled === false } : a,
    )
    writeStorage(PE_KEYS.alerts, alerts.value)
  }

  return {
    // state
    locale,
    currency,
    activeSources,
    alerts,
    theme,
    // derived
    allOrders,
    ccyOrders,
    crosses,
    matchesByAlert,
    methodsForCcy,
    mid,
    buys,
    sells,
    totalBidsSats,
    totalAsksSats,
    bestBid,
    bestAsk,
    spread,
    spreadPct,
    activeAlerts,
    totalActiveMatches,
    // actions
    setLocale,
    setCurrency,
    toggleSource,
    addAlert,
    removeAlert,
    toggleAlert,
    setTheme,
    toggleTheme,
  }
})
