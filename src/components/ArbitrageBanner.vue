<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmtFiat } from '@/lib/data'
import type { CrossResult } from '@p2psats/shared'
import type { FiatCode } from '@/lib/currency'

const { t } = useI18n()

const props = defineProps<{
  crosses: CrossResult
  currency: FiatCode
}>()

const emit = defineEmits<{ jumpTo: [] }>()

const top = computed(() => props.crosses.pairs[0] ?? null)
const tractable = computed(() => props.crosses.pairs.filter((p) => p.tractable).length)
</script>

<template>
  <!-- Consistent state -->
  <div v-if="!crosses.pairs.length" class="pb-arb pb-arb--clean">
    <div class="pb-arb-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
    <div class="pb-arb-body">
      <div class="pb-arb-title">{{ t('arbitrage.clean.title') }}</div>
      <div class="pb-arb-sub">{{ t('arbitrage.clean.sub') }}</div>
    </div>
  </div>

  <!-- Alert state -->
  <div v-else class="pb-arb pb-arb--alert">
    <div class="pb-arb-icon pb-arb-icon--alert" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2 12h4l3-9 6 18 3-9h4" />
      </svg>
    </div>
    <div class="pb-arb-body">
      <div class="pb-arb-title">
        <span class="pb-arb-title-text">{{ t('arbitrage.detected', crosses.pairs.length) }}</span>
        <span v-if="tractable > 0" class="pb-arb-pill">{{ t('arbitrage.shared', { count: tractable }) }}</span>
      </div>
      <div v-if="top" class="pb-arb-sub">
        {{ t('arbitrage.best', {
          ask: fmtFiat(top.sell.price, currency),
          askSrc: top.sell.sourceLabel,
          bid: fmtFiat(top.buy.price, currency),
          bidSrc: top.buy.sourceLabel,
          spread: `+${top.spreadPct.toFixed(2)}%`,
          fiat: fmtFiat(top.spreadFiat, currency),
        }) }}
      </div>
    </div>
    <button type="button" class="pb-arb-cta" @click="emit('jumpTo')">
      {{ t('arbitrage.cta') }} <span aria-hidden="true">↓</span>
    </button>
  </div>
</template>
