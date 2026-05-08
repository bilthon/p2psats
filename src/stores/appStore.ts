// appStore.ts — single Pinia store for all cross-cutting app state.
// localStorage keys use the pe.* prefix (renamed from pb.*).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CCY_LIST, buildOrders, methodsForCurrency, midPrice } from '@/lib/data'
import { detectCrosses } from '@/lib/arbitrage'
import { matchesRule } from '@/lib/alerts'
import type { Alert, Currency, Order, TweakValues } from '@/lib/types'

// pe.page is intentionally omitted — the route URL is the source of truth for
// the active page; persisting it redundantly would risk drift on cross-tab use.
const PE_KEYS = {
  currency: 'pe.currency',
  sources: 'pe.sources',
  alerts: 'pe.alerts',
  density: 'pe.density',
  showPremium: 'pe.showPremium',
  highlightAccent: 'pe.highlightAccent',
  bookView: 'pe.bookView',
} as const

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw != null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

export const useAppStore = defineStore('app', () => {
  // ── Persisted state ──────────────────────────────────────────────────────
  const currency = ref<Currency>(readStorage<Currency>(PE_KEYS.currency, 'USD'))
  const activeSources = ref<string[]>(
    readStorage<string[]>(PE_KEYS.sources, ['mostro', 'lnp2pbot', 'robosats', 'peach']),
  )
  const alerts = ref<Alert[]>(readStorage<Alert[]>(PE_KEYS.alerts, []))

  // Tweaks
  const density = ref<TweakValues['density']>(
    readStorage<TweakValues['density']>(PE_KEYS.density, 'balanced'),
  )
  const showPremium = ref<boolean>(readStorage<boolean>(PE_KEYS.showPremium, true))
  const highlightAccent = ref<string>(
    readStorage<string>(PE_KEYS.highlightAccent, '#5B5BD6'),
  )
  const bookView = ref<TweakValues['bookView']>(
    readStorage<TweakValues['bookView']>(PE_KEYS.bookView, 'split'),
  )

  // ── Tick seed (in-memory only — drives mocked refresh) ───────────────────
  const tickSeed = ref(0)

  // ── DEMO: empty-side rotation ────────────────────────────────────────────
  // Cycles the active currency's book through {full, bid-only, ask-only,
  // empty} on every tick so the UI's null-mid / one-sided behavior is visible.
  // Remove this block (and `demoPhase` from the return) when wiring real nostr.
  const DEMO_PHASES = ['full', 'bid-only', 'ask-only', 'empty'] as const
  type DemoPhase = (typeof DEMO_PHASES)[number]
  const demoPhase = computed<DemoPhase>(
    () => DEMO_PHASES[tickSeed.value % DEMO_PHASES.length] ?? 'full',
  )

  // ── Derived / computed ───────────────────────────────────────────────────

  const allOrders = computed<Order[]>(() => {
    const all: Order[] = []
    const seed = 100 + tickSeed.value
    const phase = demoPhase.value
    CCY_LIST.forEach((c) => {
      const isActive = c === currency.value
      const count = isActive ? 9 : 2
      let orders = buildOrders(c, count, seed)
      if (isActive) {
        if (phase === 'bid-only') orders = orders.filter((o) => o.side === 'buy')
        else if (phase === 'ask-only') orders = orders.filter((o) => o.side === 'sell')
        else if (phase === 'empty') orders = []
      }
      orders.forEach((o) => all.push(o))
    })
    return all
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

  function advanceTick() {
    tickSeed.value++
  }

  // Tweaks setters
  function setDensity(v: TweakValues['density']) {
    density.value = v
    writeStorage(PE_KEYS.density, v)
  }
  function setShowPremium(v: boolean) {
    showPremium.value = v
    writeStorage(PE_KEYS.showPremium, v)
  }
  function setHighlightAccent(v: string) {
    highlightAccent.value = v
    writeStorage(PE_KEYS.highlightAccent, v)
    document.documentElement.style.setProperty('--pe-accent', v)
  }
  function setBookView(v: TweakValues['bookView']) {
    bookView.value = v
    writeStorage(PE_KEYS.bookView, v)
  }

  // Apply accent on store creation
  if (highlightAccent.value !== '#5B5BD6') {
    document.documentElement.style.setProperty('--pe-accent', highlightAccent.value)
  }

  return {
    // state
    currency,
    activeSources,
    alerts,
    tickSeed,
    demoPhase,
    density,
    showPremium,
    highlightAccent,
    bookView,
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
    setCurrency,
    toggleSource,
    addAlert,
    removeAlert,
    toggleAlert,
    advanceTick,
    setDensity,
    setShowPremium,
    setHighlightAccent,
    setBookView,
  }
})
