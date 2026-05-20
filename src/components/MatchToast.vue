<script setup lang="ts">
/**
 * MatchToast.vue — fixed-position in-app toast stack for alert matches.
 *
 * Behaviour:
 *  - Watches allOrders + alerts. For each (alertId, orderId) pair not yet in
 *    store.seenMatchPairs, pushes a new toast.
 *  - Stack capped at 3 simultaneous entries. A 4th match drops the OLDEST
 *    (FIFO) — oldest toasts have had the most on-screen time.
 *  - Each toast auto-dismisses after 8 seconds. Manual close (×) also works.
 *  - Chime plays once per session: only when the stack transitions 0 → 1.
 *    Subsequent toasts during the same session are silent (too noisy otherwise).
 *  - SSR-safe: all browser-only code runs inside onMounted / watch callbacks.
 *    The template renders a static empty container during SSG.
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/appStore'
import { matchesRule } from '@p2psats/shared'
import { playChime } from '@/lib/chime'
import type { Order, Alert } from '@p2psats/shared'

const { t } = useI18n()
const store = useAppStore()

// ── Toast data model ─────────────────────────────────────────────────────────

interface Toast {
  id: string          // unique key for v-for (crypto.randomUUID or Date.now fallback)
  alertId: string
  alertName: string | undefined
  alertSummary: string   // compact fallback if no name
  order: Order
  timer: ReturnType<typeof setTimeout> | null
}

const MAX_TOASTS = 3
const DISMISS_MS = 8_000

const toasts = ref<Toast[]>([])

// ── Session chime gate ────────────────────────────────────────────────────────
// True once the first chime has fired this session. Prevents repeated audio.
let chimePlayedThisSession = false

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(alert: Alert): string {
  const side = alert.side === 'any' ? t('matchToast.anySide') : alert.side.toUpperCase()
  const op = alert.premium.op
  const val = alert.premium.value
  const methods = alert.methods.length ? alert.methods.slice(0, 2).join(', ') : '—'
  return `${side} ${alert.currency} ${op} ${val}% · ${methods}`
}

function removeToast(id: string): void {
  const idx = toasts.value.findIndex((entry) => entry.id === id)
  if (idx === -1) return
  const entry = toasts.value[idx]
  if (entry.timer !== null) clearTimeout(entry.timer)
  toasts.value.splice(idx, 1)
}

function addToast(alertId: string, alert: Alert, order: Order): void {
  // Dedup: mark the pair as seen so the watcher won't re-fire on the same order
  const pair = `${alertId}:${order.id}`
  store.seenMatchPairs.add(pair)

  // Cap: drop the oldest toast (FIFO) to make room
  if (toasts.value.length >= MAX_TOASTS) {
    const oldest = toasts.value[0]
    if (oldest.timer !== null) clearTimeout(oldest.timer)
    toasts.value.shift()
  }

  // Chime fires on first toast of the session (stack 0 → 1 transition)
  const shouldChime =
    store.alertSoundEnabled &&
    !chimePlayedThisSession &&
    toasts.value.length === 0

  const toastId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const timer = setTimeout(() => {
    removeToast(toastId)
  }, DISMISS_MS)

  toasts.value.push({
    id: toastId,
    alertId,
    alertName: alert.name,
    alertSummary: buildSummary(alert),
    order,
    timer,
  })

  if (shouldChime) {
    chimePlayedThisSession = true
    void playChime()
  }
}

// ── Watcher: new matches ──────────────────────────────────────────────────────
// We derive matching orders directly from allOrders + alerts so we have the
// full Order objects needed for toast display content. matchesByAlert in the
// store returns only counts; we need the actual order details here.

let stopWatcher: (() => void) | null = null

onMounted(() => {
  stopWatcher = watch(
    [() => store.allOrders, () => store.alerts] as const,
    ([orders, alerts]) => {
      for (const alert of alerts) {
        if (alert.enabled === false) continue
        const matching = orders.filter(
          (o) => store.activeSources.includes(o.source) && matchesRule(o, alert),
        )
        for (const order of matching) {
          const pair = `${alert.id}:${order.id}`
          if (!store.seenMatchPairs.has(pair)) {
            addToast(alert.id, alert, order)
          }
        }
      }
    },
    { immediate: false },
  )
})

onBeforeUnmount(() => {
  if (stopWatcher) stopWatcher()
  for (const toast of toasts.value) {
    if (toast.timer !== null) clearTimeout(toast.timer)
  }
})

// ── Deep link URL ────────────────────────────────────────────────────────────
// Forward-looking: the order deep-link route is not fully resolved yet.
function orderUrl(orderId: string): string {
  return `/?order=${orderId}`
}

// ── Side CSS class helper ─────────────────────────────────────────────────────
function sideClass(side: Order['side']): string {
  return side === 'buy' ? 'mt-side--buy' : 'mt-side--sell'
}

// ── Source display name cap ────────────────────────────────────────────────────
const SOURCE_CAP: Record<string, string> = {
  mostro: 'Mostro',
  lnp2pbot: 'lnp2pbot',
  robosats: 'RoboSats',
  peach: 'Peach',
  hodlhodl: 'HodlHodl',
  nostr: 'Nostr',
}
function sourceLabel(src: string): string {
  return SOURCE_CAP[src] ?? src
}

// ── Escape key: dismiss most-recent toast ─────────────────────────────────────
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && toasts.value.length > 0) {
    const last = toasts.value[toasts.value.length - 1]
    removeToast(last.id)
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <!-- Fixed-position toast container: bottom-right on desktop, full-width near
       bottom on mobile. z-index 9000 floats above nav (100) and page content. -->
  <div
    class="mt-container"
    role="region"
    aria-live="polite"
    aria-label="Alert notifications"
    aria-atomic="false"
  >
    <TransitionGroup name="mt-slide" tag="div" class="mt-stack">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="mt-card"
        role="alert"
      >
        <!-- Header row: title + close button -->
        <div class="mt-hd">
          <div class="mt-title">
            <svg
              class="mt-bell-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span class="mt-title-text">{{ t('matchToast.newMatch') }}</span>
          </div>
          <button
            class="mt-close"
            :aria-label="t('matchToast.close')"
            type="button"
            @click="removeToast(toast.id)"
          >
            ×
          </button>
        </div>

        <!-- Alert name or compact rule summary -->
        <div class="mt-alert-name">
          {{ toast.alertName ?? toast.alertSummary }}
        </div>

        <!-- Order details row -->
        <div class="mt-order-row">
          <span :class="['mt-side', sideClass(toast.order.side)]">
            {{ toast.order.side.toUpperCase() }}
          </span>
          <span class="mt-order-detail">
            {{ toast.order.currency }}
            <span class="mt-prem">
              {{ toast.order.premium >= 0 ? '+' : '' }}{{ toast.order.premium.toFixed(2) }}%
            </span>
            <span class="mt-source">· {{ sourceLabel(toast.order.source) }}</span>
          </span>
        </div>

        <!-- View link — forward-looking (deep-link route not resolved yet) -->
        <div class="mt-footer">
          <a
            :href="orderUrl(toast.order.id)"
            class="mt-view-link"
            :title="t('matchToast.viewComingSoon')"
            @click.prevent="() => { console.warn('[MatchToast] order deep-link not yet implemented; order id:', toast.order.id) }"
          >
            {{ t('matchToast.viewOnOrderbook') }}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* ── Container ─────────────────────────────────────────────────────────────── */
.mt-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9000;
  pointer-events: none; /* transparent to mouse; cards re-enable below */
  width: 320px;
}

.mt-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  width: 100%;
}

/* ── Individual card ───────────────────────────────────────────────────────── */
.mt-card {
  pointer-events: all;
  width: 320px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-md);
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-left: 3px solid var(--accent);
}

/* ── Header row ────────────────────────────────────────────────────────────── */
.mt-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mt-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.mt-bell-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.mt-title-text {
  white-space: nowrap;
}

.mt-close {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--ink-mute);
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
  border-radius: 4px;
  cursor: pointer;
  transition: color 120ms, background 120ms;
  flex-shrink: 0;
}
.mt-close:hover {
  color: var(--ink);
  background: var(--bg-soft);
}

/* ── Alert name / summary ──────────────────────────────────────────────────── */
.mt-alert-name {
  font-family: var(--font-body);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Order detail row ──────────────────────────────────────────────────────── */
.mt-order-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 12.5px;
}

.mt-side {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* Buy = bid green palette from styles.css --bid */
.mt-side--buy {
  background: oklch(0.62 0.14 155 / 0.15);
  color: var(--bid);
}

/* Sell = ask red palette from styles.css --ask */
.mt-side--sell {
  background: oklch(0.6 0.18 25 / 0.15);
  color: var(--ask);
}

.mt-order-detail {
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mt-prem {
  color: var(--ink);
  font-weight: 600;
}

.mt-source {
  color: var(--ink-mute);
  font-size: 11.5px;
}

/* ── Footer / view link ────────────────────────────────────────────────────── */
.mt-footer {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.mt-view-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
  border-radius: 4px;
  padding: 2px 4px;
  transition: background 120ms;
}
.mt-view-link:hover {
  background: var(--accent-tint);
}

/* ── Enter / leave transitions ─────────────────────────────────────────────── */
.mt-slide-enter-active {
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease;
}
.mt-slide-leave-active {
  transition: transform 180ms ease-in, opacity 160ms ease-in;
}
.mt-slide-enter-from {
  transform: translateX(110%);
  opacity: 0;
}
.mt-slide-leave-to {
  transform: translateX(110%);
  opacity: 0;
}
.mt-slide-move {
  transition: transform 200ms ease;
}

/* ── Mobile: full-width near bottom ────────────────────────────────────────── */
@media (max-width: 480px) {
  .mt-container {
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    padding: 0 8px 12px;
  }
  .mt-stack {
    align-items: stretch;
  }
  .mt-card {
    width: 100%;
    border-radius: var(--r-md) var(--r-md) 0 0;
    border-left: none;
    border-top: 3px solid var(--accent);
  }
}
</style>
