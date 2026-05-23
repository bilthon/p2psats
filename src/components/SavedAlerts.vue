<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/services/apiClient'
import { useAppStore } from '@/stores/appStore'
import type { Alert } from '@p2psats/shared'

const { t } = useI18n()
const store = useAppStore()

defineProps<{
  alerts: Alert[]
  currentMatches: Record<string, number>
}>()

function opSymbol(op: string): string {
  const map: Record<string, string> = { '<=': 'at most', '>=': 'at least' }
  return map[op] ?? op
}

// Call the store actions directly rather than emitting up to the parent — the
// store's removeAlert/toggleAlert are async and may reject, and a parent's
// fire-and-forget @remove="store.removeAlert" listener would never observe
// the rejection. Owning the call here lets us actually catch errors.
async function onRemove(id: string) {
  try {
    await store.removeAlert(id)
  } catch (err) {
    // Stale-cache fix: if the backend returns 404 the alert is already gone —
    // treat as success. Any non-404 error is logged.
    if (err instanceof ApiError && err.status === 404) {
      return
    }
    console.warn('[SavedAlerts] removeAlert failed:', err)
  }
}

async function onToggle(id: string) {
  try {
    await store.toggleAlert(id)
  } catch (err) {
    console.warn('[SavedAlerts] toggleAlert failed:', err)
  }
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="!alerts.length" class="pb-empty">
    <div class="pb-empty-icon">◔</div>
    <div class="pb-empty-title">No alerts yet</div>
    <div class="pb-empty-sub">
      Build a rule above to get notified the moment a matching order is published to any tracked
      relay.
    </div>
  </div>

  <!-- Alert list -->
  <div v-else class="pb-alerts-list">
    <div
      v-for="a in alerts"
      :key="a.id"
      :class="['pb-alert', a.enabled === false ? 'pb-alert--off' : '']"
    >
      <button
        type="button"
        class="pb-alert-toggle"
        :aria-pressed="a.enabled !== false"
        @click="onToggle(a.id)"
      >
        <span class="pb-alert-toggle-dot" />
      </button>

      <div class="pb-alert-body">
        <div class="pb-alert-title">
          {{
            a.name ||
            `${a.side === 'buy' ? 'Buy' : 'Sell'} ${a.currency} ${opSymbol(a.premium.op)} ${a.premium.value > 0 ? '+' : ''}${a.premium.value}%`
          }}
        </div>
        <div class="pb-alert-meta">
          <span class="pb-alert-tag">{{ a.side }}</span>
          <span class="pb-alert-tag">{{ a.currency }}</span>
          <span class="pb-alert-tag"
            >prem {{ opSymbol(a.premium.op) }}
            {{ a.premium.value > 0 ? '+' : '' }}{{ a.premium.value }}%</span
          >
          <span v-if="a.sources.length > 0" class="pb-alert-tag"
            >{{ a.sources.length }} source{{ a.sources.length > 1 ? 's' : '' }}</span
          >
          <!-- Channel badges -->
          <span
            v-if="a.emailEnabled"
            class="pb-channel-badge pb-channel-badge--email"
            :title="t('alertBuilder.channels.email')"
          >
            ✉ {{ t('savedAlerts.badge.email') }}
          </span>
          <span
            v-if="a.nostrEnabled"
            class="pb-channel-badge pb-channel-badge--nostr"
            :title="t('alertBuilder.channels.nostrDm')"
          >
            ⚡ {{ t('savedAlerts.badge.nostr') }}
          </span>
        </div>
      </div>

      <div class="pb-alert-matches">
        <div class="pb-alert-matches-n">{{ currentMatches[a.id] ?? 0 }}</div>
        <div class="pb-alert-matches-l">
          match{{ (currentMatches[a.id] ?? 0) === 1 ? '' : 'es' }} now
        </div>
      </div>

      <button
        type="button"
        class="pb-alert-remove"
        aria-label="Remove"
        @click="onRemove(a.id)"
        >✕</button
      >
    </div>
  </div>
</template>

<style scoped>
/* ── Channel badges ── */
.pb-channel-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;
  white-space: nowrap;
}

.pb-channel-badge--email {
  background: oklch(0.62 0.14 250 / 0.12);
  color: oklch(0.45 0.14 250);
  border: 1px solid oklch(0.62 0.14 250 / 0.25);
}

.pb-channel-badge--nostr {
  background: oklch(0.65 0.18 310 / 0.12);
  color: oklch(0.48 0.18 310);
  border: 1px solid oklch(0.65 0.18 310 / 0.25);
}

/* Dark theme overrides */
[data-theme='dark'] .pb-channel-badge--email {
  background: oklch(0.62 0.14 250 / 0.18);
  color: oklch(0.75 0.12 250);
  border-color: oklch(0.62 0.14 250 / 0.35);
}

[data-theme='dark'] .pb-channel-badge--nostr {
  background: oklch(0.65 0.18 310 / 0.18);
  color: oklch(0.75 0.15 310);
  border-color: oklch(0.65 0.18 310 / 0.35);
}
</style>
