<script setup lang="ts">
import { computed } from 'vue'
import { fmtFiat, fmtSatsCompact, fmtTimeShort } from '@/lib/data'
import type { Currency, Order } from '@/lib/types'
import MethodChips from './MethodChips.vue'
import SourceDot from './SourceDot.vue'
import ReputationBar from './ReputationBar.vue'

const props = defineProps<{
  title: string
  side: 'buy' | 'sell'
  orders: Order[]
  currency: Currency
  rowH: number
  showPremium: boolean
  crossedIds: Set<string>
  sideColor: string
  sideTint: string
  embedded?: boolean
  hideTitle?: boolean
}>()

const maxAmt = computed(() => Math.max(...props.orders.map((o) => o.amountSats), 1))

function premColor(premium: number): string {
  if (premium > 0) return 'oklch(0.55 0.18 25)'
  if (premium < 0) return 'oklch(0.55 0.14 155)'
  return 'oklch(0.45 0.005 80)'
}
</script>

<template>
  <div :class="['pb-table-wrap', embedded ? 'pb-table-wrap--embedded' : '']">
    <!-- Table title header (hidden in tabs mode) -->
    <div v-if="!hideTitle" class="pb-table-header">
      <div class="pb-table-title">
        <span class="pb-side-dot" :style="{ background: sideColor }" />
        <span style="font-weight: 600; letter-spacing: 0.01em">{{ title }}</span>
        <span class="pb-table-count">{{ orders.length }}</span>
      </div>
      <div class="pb-table-help">
        {{ side === 'buy' ? 'Makers want to buy BTC' : 'Makers want to sell BTC' }}
      </div>
    </div>

    <div class="pb-table" :style="{ '--row-h': rowH + 'px' }">
      <div class="pb-thead">
        <div class="col-price">Price</div>
        <div v-if="showPremium" class="col-prem">Premium</div>
        <div class="col-amount">Amount range</div>
        <div class="col-sats">Sats</div>
        <div class="col-methods">Payment</div>
        <div class="col-maker">Maker</div>
        <div class="col-rep">Rep</div>
        <div class="col-src">Source</div>
        <div class="col-age">Age</div>
      </div>
      <div class="pb-tbody">
        <div
          v-for="o in orders"
          :key="o.id"
          :class="['pb-row', crossedIds.has(o.id) ? 'pb-row--crossed' : '']"
        >
          <div
            class="pb-row-bg"
            :style="{
              background: `linear-gradient(to ${side === 'buy' ? 'right' : 'left'}, ${sideTint} ${(o.amountSats / maxAmt) * 100}%, transparent ${(o.amountSats / maxAmt) * 100}%)`,
            }"
          />
          <div class="col-price" :style="{ color: sideColor, fontWeight: '600' }">
            <span v-if="crossedIds.has(o.id)" class="pb-cross-mark" title="Price crosses an order on the other side">⚡</span>
            {{ fmtFiat(o.price, o.currency, { bare: true }) }}
          </div>
          <div v-if="showPremium" class="col-prem">
            <span
              :style="{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '11px',
                fontWeight: '500',
                color: premColor(o.premium),
                fontVariantNumeric: 'tabular-nums',
              }"
              >{{ o.premium > 0 ? '+' : '' }}{{ o.premium.toFixed(2) }}%</span
            >
          </div>
          <div class="col-amount">
            <span class="pb-num">{{ fmtFiat(o.minFiat, o.currency) }}</span>
            <span class="pb-num-sep"> – </span>
            <span class="pb-num">{{ fmtFiat(o.maxFiat, o.currency, { bare: true }) }}</span>
          </div>
          <div class="col-sats pb-num pb-num--muted">{{ fmtSatsCompact(o.amountSats) }}</div>
          <div class="col-methods"><MethodChips :methods="o.methods" /></div>
          <div class="col-maker">
            <span class="pb-maker-handle">@{{ o.makerHandle }}</span>
          </div>
          <div class="col-rep">
            <ReputationBar :completion="o.completion" :trades="o.trades" />
          </div>
          <div class="col-src"><SourceDot :source="o.source" /></div>
          <div class="col-age pb-num pb-num--muted">{{ fmtTimeShort(o.ageMin) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
