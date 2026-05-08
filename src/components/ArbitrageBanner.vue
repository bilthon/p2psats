<script setup lang="ts">
import { computed } from 'vue'
import { fmtFiat } from '@/lib/data'
import type { CrossResult, Currency } from '@/lib/types'

const props = defineProps<{
  crosses: CrossResult
  currency: Currency
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
      <div class="pb-arb-title">Book is consistent</div>
      <div class="pb-arb-sub">No crossed orders right now — every bid is below every ask.</div>
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
        <span class="pb-arb-title-text"
          >{{ crosses.pairs.length }} crossed pair{{
            crosses.pairs.length === 1 ? '' : 's'
          }}
          detected</span
        >
        <span v-if="tractable > 0" class="pb-arb-pill"
          >{{ tractable }} with shared payment method</span
        >
      </div>
      <div v-if="top" class="pb-arb-sub">
        Best opportunity: buy at <b>{{ fmtFiat(top.sell.price, currency) }}</b> ({{
          top.sell.sourceLabel
        }}), sell at <b>{{ fmtFiat(top.buy.price, currency) }}</b> ({{ top.buy.sourceLabel }}) —
        spread <b class="pb-arb-spread">+{{ top.spreadPct.toFixed(2) }}%</b> ({{
          fmtFiat(top.spreadFiat, currency)
        }}
        per BTC)
      </div>
    </div>
    <button type="button" class="pb-arb-cta" @click="emit('jumpTo')">
      See all <span aria-hidden="true">↓</span>
    </button>
  </div>
</template>
