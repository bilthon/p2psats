<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { nip19 } from 'nostr-tools'
import type { Event } from 'nostr-tools'
import { fmtFiat, fmtSats, fmtPremium, fmtAge } from '@/lib/data'
import type { Order } from '@/lib/types'
import type { RawNip69Order } from '@/lib/nip69/parseOrder'
import SatSymbol from './SatSymbol.vue'
import ReputationBar from './ReputationBar.vue'

const props = defineProps<{
  order: Order
  raw: RawNip69Order | undefined
  event: Event | undefined
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const closeBtn = ref<HTMLButtonElement | null>(null)

// ── Computed helpers ──────────────────────────────────────────────────────────

const npub = computed<string>(() => {
  try {
    return nip19.npubEncode(props.order.maker)
  } catch {
    // Malformed hex pubkey — show the raw hex rather than an error string,
    // so the copy button still yields a useful value.
    return props.order.maker
  }
})

const createdRelative = computed<string>(() => {
  if (!props.raw) return '—'
  const ageMin = (Date.now() / 1000 - props.raw.createdAt) / 60
  return fmtAge(ageMin)
})

const createdIso = computed<string>(() => {
  if (!props.raw) return ''
  return new Date(props.raw.createdAt * 1000).toISOString()
})

// Effective expiry: prefer the NIP-69 `expires_at` tag, fall back to the
// generic NIP-40 `expiration` tag (both are unix timestamps in seconds).
const effectiveExpiry = computed<number | undefined>(
  () => props.raw?.expiresAt ?? props.raw?.expiration,
)

const expiresRelative = computed<string>(() => {
  const exp = effectiveExpiry.value
  if (!exp) return 'no expiry'
  const ageMin = (Date.now() / 1000 - exp) / 60
  return fmtAge(ageMin)
})

const expiresIso = computed<string | null>(() => {
  const exp = effectiveExpiry.value
  if (!exp) return null
  return new Date(exp * 1000).toISOString()
})

const methodsLabel = computed<string>(() =>
  props.order.methods.map((m) => m.label).join(', '),
)


// ── Clipboard ─────────────────────────────────────────────────────────────────

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // Clipboard API not available (e.g. non-secure context) — silently ignore.
  }
}

// ── Keyboard & scroll lock ────────────────────────────────────────────────────

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

const prevOverflow = ref('')

onMounted(async () => {
  prevOverflow.value = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKey)
  await nextTick()
  closeBtn.value?.focus()
})

onUnmounted(() => {
  document.body.style.overflow = prevOverflow.value
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop — click outside the panel to close -->
    <div class="odd-backdrop" @click.self="emit('close')">
      <div class="odd-panel" role="dialog" aria-modal="true" aria-label="Order detail">

        <!-- ── A. Header ──────────────────────────────────────────────────── -->
        <div class="odd-header">
          <div class="odd-header-left">
            <span
              class="odd-side-badge"
              :class="order.side === 'buy' ? 'odd-side-badge--bid' : 'odd-side-badge--ask'"
            >{{ order.side === 'buy' ? 'BID' : 'ASK' }}</span>
            <span class="odd-subtitle">
              {{ raw?.platform ?? order.sourceLabel }} · {{ order.currency }}
            </span>
          </div>
          <button
            ref="closeBtn"
            class="odd-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- ── B. Pricing block ───────────────────────────────────────────── -->
        <div class="odd-section">
          <div class="odd-section-title">Pricing</div>
          <div class="odd-price-grid">
            <div class="odd-kv">
              <div class="odd-kv-label">Price</div>
              <div class="odd-kv-value odd-kv-value--price">
                {{ fmtFiat(order.price, order.currency) }}
              </div>
            </div>
            <div class="odd-kv">
              <div class="odd-kv-label">Premium</div>
              <div class="odd-kv-value">{{ fmtPremium(order.premium) }}</div>
            </div>
            <div class="odd-kv">
              <div class="odd-kv-label">Fiat range</div>
              <div class="odd-kv-value">
                {{ fmtFiat(order.minFiat, order.currency) }}
                –
                {{ fmtFiat(order.maxFiat, order.currency) }}
              </div>
            </div>
            <div class="odd-kv">
              <div class="odd-kv-label">Amount</div>
              <div class="odd-kv-value">{{ fmtSats(order.amountSats, { bare: true }) }} <SatSymbol /></div>
            </div>
          </div>
        </div>

        <!-- ── C. Identity block ─────────────────────────────────────────── -->
        <div class="odd-section">
          <div class="odd-section-title">Identity (dupe diagnostic)</div>
          <div class="odd-id-list">

            <div class="odd-id-row">
              <div class="odd-id-label">d-tag (offer id)</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono">{{ order.id }}</span>
                <button class="odd-copy" title="Copy" @click="copy(order.id)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Maker pubkey (hex)</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono odd-mono--break">{{ order.maker }}</span>
                <button class="odd-copy" title="Copy" @click="copy(order.maker)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Maker npub</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono odd-mono--break">{{ npub }}</span>
                <button class="odd-copy" title="Copy" @click="copy(npub)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Raw event id</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono odd-mono--break">{{ raw?.rawEventId ?? '—' }}</span>
                <button
                  v-if="raw?.rawEventId"
                  class="odd-copy"
                  title="Copy"
                  @click="copy(raw!.rawEventId)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Source platform (y tag)</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono">{{ raw?.platform ?? order.source }}</span>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Source relay</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono odd-mono--break">{{ order.relay }}</span>
                <button
                  v-if="order.relay && order.relay !== 'nostr'"
                  class="odd-copy"
                  title="Copy"
                  @click="copy(order.relay)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Status</div>
              <div class="odd-id-value-wrap">
                <span class="odd-mono">{{ raw?.status ?? '—' }}</span>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Created</div>
              <div class="odd-id-value-wrap odd-id-value-wrap--col">
                <span class="odd-relative">{{ createdRelative }}</span>
                <span v-if="createdIso" class="odd-mono odd-mono--dim">{{ createdIso }}</span>
              </div>
            </div>

            <div class="odd-id-row">
              <div class="odd-id-label">Expires</div>
              <div class="odd-id-value-wrap odd-id-value-wrap--col">
                <span class="odd-relative">{{ expiresRelative }}</span>
                <span v-if="expiresIso" class="odd-mono odd-mono--dim">{{ expiresIso }}</span>
              </div>
            </div>

          </div>
        </div>

        <!-- ── D. NIP-69 metadata ─────────────────────────────────────────── -->
        <div v-if="raw" class="odd-section">
          <div class="odd-section-title">NIP-69 metadata</div>
          <div class="odd-meta-list">
            <div class="odd-meta-row">
              <span class="odd-meta-label">Payment methods</span>
              <span class="odd-meta-value">{{ methodsLabel || '—' }}</span>
            </div>
            <div v-if="raw.network" class="odd-meta-row">
              <span class="odd-meta-label">Network</span>
              <span class="odd-meta-value">{{ raw.network }}</span>
            </div>
            <div v-if="raw.layer" class="odd-meta-row">
              <span class="odd-meta-label">Layer</span>
              <span class="odd-meta-value">{{ raw.layer }}</span>
            </div>
            <div v-if="raw.geohash" class="odd-meta-row">
              <span class="odd-meta-label">Geohash</span>
              <span class="odd-meta-value odd-mono">{{ raw.geohash }}</span>
            </div>
            <div v-if="raw.bond" class="odd-meta-row">
              <span class="odd-meta-label">Bond</span>
              <span class="odd-meta-value">{{ raw.bond }}</span>
            </div>
            <div v-if="raw.source" class="odd-meta-row">
              <span class="odd-meta-label">Source field</span>
              <span class="odd-meta-value odd-mono">{{ raw.source }}</span>
            </div>
            <div v-if="raw.name" class="odd-meta-row">
              <span class="odd-meta-label">Name</span>
              <span class="odd-meta-value">{{ raw.name }}</span>
            </div>
            <template v-if="order.rep.kind === 'stars'">
              <div class="odd-meta-row">
                <span class="odd-meta-label">Reputation</span>
                <span class="odd-meta-value odd-rep-row">
                  <ReputationBar v-bind="order.rep" />
                  <span class="odd-rep-num">{{ order.rep.rating.toFixed(2) }} / 5</span>
                </span>
              </div>
              <div class="odd-meta-row">
                <span class="odd-meta-label">Trades</span>
                <span class="odd-meta-value odd-mono">{{ order.rep.count }}</span>
              </div>
              <div v-if="order.rep.days !== undefined" class="odd-meta-row">
                <span class="odd-meta-label">Days on platform</span>
                <span class="odd-meta-value odd-mono">{{ order.rep.days }}</span>
              </div>
            </template>
            <div v-else class="odd-meta-row">
              <span class="odd-meta-label">Reputation</span>
              <span class="odd-meta-value">{{ order.rep.tooltip }}</span>
            </div>
          </div>
        </div>

        <!-- ── E. Raw event JSON ──────────────────────────────────────────── -->
        <div class="odd-section">
          <details class="odd-details">
            <summary class="odd-details-summary">Raw event JSON</summary>
            <pre class="odd-pre">{{ event ? JSON.stringify(event, null, 2) : 'unavailable' }}</pre>
          </details>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────────────────────── */
.odd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: oklch(0 0 0 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}

/* ── Panel ─────────────────────────────────────────────────────────────────── */
.odd-panel {
  position: relative;
  width: 100%;
  max-width: 640px;
  background: oklch(0.14 0.005 250);
  border: 1px solid oklch(0.28 0.006 250);
  border-radius: 10px;
  overflow: hidden;
  font-family: 'Inter Tight', 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: oklch(0.88 0.005 250);
  margin: auto;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.odd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid oklch(0.22 0.005 250);
}

.odd-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.odd-side-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  flex-shrink: 0;
}

.odd-side-badge--bid {
  background: oklch(0.62 0.14 155 / 0.18);
  color: oklch(0.72 0.16 155);
  border: 1px solid oklch(0.62 0.14 155 / 0.35);
}

.odd-side-badge--ask {
  background: oklch(0.6 0.18 25 / 0.18);
  color: oklch(0.72 0.18 25);
  border: 1px solid oklch(0.6 0.18 25 / 0.35);
}

.odd-subtitle {
  font-size: 12px;
  color: oklch(0.6 0.006 250);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.odd-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid oklch(0.28 0.006 250);
  background: transparent;
  color: oklch(0.6 0.006 250);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}

.odd-close:hover {
  background: oklch(0.22 0.006 250);
  color: oklch(0.9 0.005 250);
}

.odd-close:focus-visible {
  outline: 2px solid oklch(0.62 0.14 245);
  outline-offset: 1px;
}

/* ── Section wrapper ───────────────────────────────────────────────────────── */
.odd-section {
  padding: 14px 16px;
  border-bottom: 1px solid oklch(0.2 0.004 250);
}

.odd-section:last-child {
  border-bottom: none;
}

.odd-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: oklch(0.5 0.008 250);
  margin-bottom: 10px;
}

/* ── B. Pricing grid ───────────────────────────────────────────────────────── */
.odd-price-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 20px;
}

.odd-kv {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.odd-kv-label {
  font-size: 11px;
  color: oklch(0.5 0.006 250);
}

.odd-kv-value {
  font-size: 13px;
  font-weight: 500;
  color: oklch(0.88 0.005 250);
}

.odd-kv-value--price {
  font-size: 15px;
  font-weight: 600;
}

/* ── C. Identity list ──────────────────────────────────────────────────────── */
.odd-id-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.odd-id-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px;
  align-items: start;
  padding: 6px 0;
  border-bottom: 1px solid oklch(0.19 0.004 250);
}

.odd-id-row:last-child {
  border-bottom: none;
}

.odd-id-label {
  font-size: 11px;
  color: oklch(0.5 0.006 250);
  padding-top: 1px;
  flex-shrink: 0;
}

.odd-id-value-wrap {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.odd-id-value-wrap--col {
  flex-direction: column;
  gap: 2px;
}

.odd-mono {
  font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Mono', monospace;
  font-size: 11.5px;
  color: oklch(0.78 0.006 250);
  word-break: break-all;
}

.odd-mono--break {
  word-break: break-all;
}

.odd-mono--dim {
  font-size: 10.5px;
  color: oklch(0.5 0.005 250);
}

.odd-relative {
  font-size: 12.5px;
  color: oklch(0.82 0.006 250);
}

/* ── Copy button ─────────────────────────────────────────────────────────── */
.odd-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid oklch(0.28 0.005 250);
  background: transparent;
  color: oklch(0.5 0.006 250);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}

.odd-copy:hover {
  background: oklch(0.22 0.006 250);
  color: oklch(0.82 0.005 250);
}

/* ── D. Metadata list ──────────────────────────────────────────────────────── */
.odd-meta-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.odd-meta-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px;
  align-items: baseline;
}

.odd-meta-label {
  font-size: 11px;
  color: oklch(0.5 0.006 250);
}

.odd-meta-value {
  font-size: 12.5px;
  color: oklch(0.82 0.006 250);
}

.odd-rep-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.odd-rep-num {
  font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Mono', monospace;
  font-size: 11.5px;
  color: oklch(0.6 0.006 250);
  font-variant-numeric: tabular-nums;
}

/* ── E. Raw event ──────────────────────────────────────────────────────────── */
.odd-details {
  border: 1px solid oklch(0.22 0.005 250);
  border-radius: 6px;
  overflow: hidden;
}

.odd-details-summary {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: oklch(0.6 0.007 250);
  cursor: pointer;
  user-select: none;
  background: oklch(0.17 0.004 250);
  list-style: none;
}

.odd-details-summary::-webkit-details-marker {
  display: none;
}

.odd-details-summary::before {
  content: '▶ ';
  font-size: 9px;
  vertical-align: middle;
  margin-right: 4px;
  transition: transform 0.15s;
  display: inline-block;
}

.odd-details[open] .odd-details-summary::before {
  transform: rotate(90deg);
}

.odd-pre {
  margin: 0;
  padding: 12px;
  background: oklch(0.12 0.004 250);
  font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Mono', monospace;
  font-size: 11px;
  color: oklch(0.72 0.005 250);
  overflow-x: auto;
  white-space: pre;
  max-height: 320px;
  overflow-y: auto;
}
</style>
