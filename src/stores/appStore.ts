// appStore.ts — single Pinia store for all cross-cutting app state.
// localStorage keys use the pe.* prefix (renamed from pb.*).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { midPrice } from '@/lib/data'
import { detectCrosses } from '@/lib/arbitrage'
import { matchesRule } from '@p2psats/shared'
import { useNostrOrderbookStore } from '@/services/nostrOrderbook'
import { useBtcRatesStore } from '@/services/btcRates'
import { toVueOrder } from '@/lib/orderAdapter'
import type { Alert, Currency, Order } from '@p2psats/shared'
import { setLocale as i18nSetLocale, detectInitialLocale, type AppLocale } from '@/i18n'
import { apiClient, ApiError } from '@/services/apiClient'
import type { AlertResponseDto, CreateAlertPayload, NostrEvent } from '@/services/apiClient'
import type { AccountDto } from '@/services/apiClient'

const PE_KEYS = {
  currency: 'pe.currency',
  sources: 'pe.sources',
  theme: 'pe.theme',
  alertSound: 'pe.alertSound', // added by #15
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

// ---------------------------------------------------------------------------
// Alert shape adapters (module-level pure functions)
// ---------------------------------------------------------------------------

/**
 * Convert an AlertResponseDto (backend wire format) into the local Alert shape.
 * The DTO carries an extra computed field (currentMatches) that is not part of
 * the shared Alert type — drop it. Convert createdAt ISO string → epoch ms
 * integer to match the shared type.
 */
function toLocalAlert(dto: AlertResponseDto): Alert {
  return {
    id: dto.id,
    // name is optional in Alert — undefined when null from backend
    ...(dto.name != null ? { name: dto.name } : {}),
    side: dto.side,
    // dto.currency is a plain string; the backend validates it against the
    // same Currency union the shared lib declares — cast is safe here.
    currency: dto.currency as Alert['currency'],
    premium: dto.premium,
    methods: dto.methods,
    sources: dto.sources,
    // Alert uses null (not undefined) for optional amount bounds
    amountMin: dto.amountMin,
    amountMax: dto.amountMax,
    emailEnabled: dto.emailEnabled,
    nostrEnabled: dto.nostrEnabled,
    enabled: dto.enabled,
    createdAt: new Date(dto.createdAt).getTime(),
  }
}

/**
 * Build a CreateAlertPayload from a local Alert. Strips server-generated
 * fields: id, enabled, createdAt.
 */
function toCreatePayload(alert: Alert): CreateAlertPayload {
  return {
    name: alert.name,
    currency: alert.currency,
    side: alert.side,
    premium: alert.premium,
    methods: alert.methods,
    sources: alert.sources,
    amountMin: alert.amountMin ?? null,
    amountMax: alert.amountMax ?? null,
    emailEnabled: alert.emailEnabled,
    nostrEnabled: alert.nostrEnabled,
  }
}

export const useAppStore = defineStore('app', () => {
  // ── Auth state ───────────────────────────────────────────────────────────
  const account = ref<AccountDto | null>(null)
  const signedIn = computed(() => account.value !== null)

  /**
   * Push a freshly-authenticated account into the store. Called by the
   * sign-in completion paths (SignInPanel after verifyNostr, AuthVerifyView
   * after verifyEmail) so the UI reacts immediately — otherwise the new
   * __session cookie is set on the response but `signedIn` stays false
   * until the next reload (when the bootstrap IIFE re-runs auth.me()).
   *
   * On sign-in we also kick off a backend alerts.list() to load the user's
   * alerts. Fire-and-forget — the UI transitions on the synchronous
   * `account.value` assignment; the alerts list lands a moment later.
   * Errors are swallowed (matches the bootstrap IIFE's posture).
   */
  function setAccount(dto: AccountDto | null): void {
    account.value = dto
    if (dto !== null) {
      void apiClient.alerts
        .list()
        .then((remote) => {
          alerts.value = remote.map(toLocalAlert)
        })
        .catch((e) => {
          console.warn('[appStore] alerts.list() after sign-in failed:', e)
        })
    }
  }

  async function signOut(): Promise<void> {
    try {
      await apiClient.auth.logout()
    } catch (e) {
      // Cookie may already be expired; still clear local state.
      console.warn('[appStore] auth.logout() failed:', e)
    }
    account.value = null
    alerts.value = []
  }

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
  // Alerts are backend-owned: populated after sign-in via apiClient.alerts.list().
  const alerts = ref<Alert[]>([])

  // ── In-session match-dedup set ────────────────────────────────────────────
  // Keyed on `${alertId}:${orderId}`. Non-persisted: resets on page reload.
  // #15 (MatchToast) owns the logic that populates this set.
  const seenMatchPairs = ref<Set<string>>(new Set())

  // ── Alert sound setting (added by #15) ───────────────────────────────────
  // Persisted under pe.alertSound. Default true. A future settings UI can
  // expose setAlertSoundEnabled() to let users disable the chime.
  const alertSoundEnabled = ref<boolean>(readStorage<boolean>(PE_KEYS.alertSound, true))

  function setAlertSoundEnabled(v: boolean): void {
    alertSoundEnabled.value = v
    writeStorage(PE_KEYS.alertSound, v)
  }

  // ── Bootstrap: resolve auth + sync backend alerts ────────────────────────
  // This IIFE runs once at first useAppStore() call (Pinia factory lifecycle).
  // Skipped during SSG prerender — import.meta.env.SSR is true during vite-ssg
  // server-side rendering, and there is no auth cookie available at build time.
  // 401 is the normal signed-out case — silenced. Any other error is warned
  // but swallowed so a backend outage never breaks the read-only orderbook.
  if (!import.meta.env.SSR) {
    void (async () => {
      try {
        account.value = await apiClient.auth.me()
        // Signed in: replace local alerts with the backend's authoritative list.
        const remote = await apiClient.alerts.list()
        alerts.value = remote.map(toLocalAlert)
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) {
          console.warn('[appStore] auth.me() failed:', e)
        }
      }
    })()
  }

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

  // Free-tier quota: sourced from the backend's GET /me response so the UI
  // never has to hardcode the limit. Falls back to 4 (matches the current
  // backend free-tier default) for the brief window where /me hasn't
  // resolved yet, or against an older backend that doesn't return the field.
  const maxAlerts = computed(() => account.value?.maxAlerts ?? 4)
  const quotaReached = computed(
    () => signedIn.value && alerts.value.length >= maxAlerts.value,
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

  async function linkEmail(email: string): Promise<void> {
    // Backend sends a magic link with linkToAccountId set so the verify path
    // attaches EmailIdentity to the current account. The store is NOT updated
    // here — identity only appears after the user clicks the link and the
    // /auth/verify?token=... endpoint runs (which calls setAccount via the
    // AuthVerifyView). Errors propagate to the caller for inline display.
    await apiClient.auth.linkEmail(email)
  }

  async function linkNostr(signedEvent: NostrEvent): Promise<void> {
    // Backend verifies the signed kind:27235 event and returns the updated
    // account with the freshly linked NostrIdentity included.
    const { account: updated } = await apiClient.auth.linkNostr(signedEvent)
    setAccount(updated)
  }

  async function addAlert(alert: Alert): Promise<void> {
    // Persist via API, then mirror the response locally. Throws on error so
    // the calling component (AlertBuilder) can surface it.
    const dto = await apiClient.alerts.create(toCreatePayload(alert))
    alerts.value = [toLocalAlert(dto), ...alerts.value]
  }

  async function removeAlert(id: string): Promise<void> {
    await apiClient.alerts.delete(id)
    alerts.value = alerts.value.filter((a) => a.id !== id)
  }

  async function toggleAlert(id: string): Promise<void> {
    const current = alerts.value.find((a) => a.id === id)
    if (!current) return
    const dto = await apiClient.alerts.update(id, { enabled: !current.enabled })
    alerts.value = alerts.value.map((a) => (a.id === id ? toLocalAlert(dto) : a))
  }

  return {
    // auth state
    account,
    signedIn,
    setAccount,
    signOut,
    // persisted state
    locale,
    currency,
    activeSources,
    alerts,
    theme,
    // non-persisted in-session state
    seenMatchPairs,
    // sound setting (added by #15)
    alertSoundEnabled,
    // derived
    allOrders,
    ccyOrders,
    crosses,
    matchesByAlert,
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
    maxAlerts,
    quotaReached,
    // actions
    setLocale,
    setCurrency,
    toggleSource,
    linkEmail,
    linkNostr,
    addAlert,
    removeAlert,
    toggleAlert,
    setTheme,
    toggleTheme,
    setAlertSoundEnabled, // added by #15
  }
})
