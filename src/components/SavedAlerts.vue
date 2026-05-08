<script setup lang="ts">
import type { Alert } from '@/lib/types'

const props = defineProps<{
  alerts: Alert[]
  currentMatches: Record<string, number>
}>()

const emit = defineEmits<{
  remove: [id: string]
  toggle: [id: string]
}>()

function opSymbol(op: string): string {
  const map: Record<string, string> = { '<=': '≤', '>=': '≥', '==': '≈' }
  return map[op] ?? op
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="!alerts.length" class="pb-empty">
    <div class="pb-empty-icon">◔</div>
    <div class="pb-empty-title">No alerts yet</div>
    <div class="pb-empty-sub">
      Build a rule above to get an email the moment a matching order is published to any tracked
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
        @click="emit('toggle', a.id)"
      >
        <span class="pb-alert-toggle-dot" />
      </button>

      <div class="pb-alert-body">
        <div class="pb-alert-title">
          {{
            a.name ||
            `${a.side === 'any' ? 'Any' : a.side === 'buy' ? 'Buy' : 'Sell'} ${a.currency} ${opSymbol(a.premium.op)} ${a.premium.value > 0 ? '+' : ''}${a.premium.value}%`
          }}
        </div>
        <div class="pb-alert-meta">
          <span class="pb-alert-tag">{{ a.side }}</span>
          <span class="pb-alert-tag">{{ a.currency }}</span>
          <span class="pb-alert-tag"
            >prem {{ opSymbol(a.premium.op) }}
            {{ a.premium.value > 0 ? '+' : '' }}{{ a.premium.value }}%</span
          >
          <span v-if="a.methods.length > 0" class="pb-alert-tag"
            >{{ a.methods.length }} method{{ a.methods.length > 1 ? 's' : '' }}</span
          >
          <span v-if="a.sources.length > 0" class="pb-alert-tag"
            >{{ a.sources.length }} source{{ a.sources.length > 1 ? 's' : '' }}</span
          >
          <span class="pb-alert-email">→ {{ a.email }}</span>
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
        @click="emit('remove', a.id)"
        >✕</button
      >
    </div>
  </div>
</template>
