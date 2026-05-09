<script setup lang="ts">
import { computed } from 'vue'
import { fmtFiat, fmtSatsCompact, fmtTimeShort } from '@/lib/data'
import type { Currency, Order } from '@/lib/types'
import MethodChips from './MethodChips.vue'
import SourceDot from './SourceDot.vue'
import ReputationBar from './ReputationBar.vue'
import SatSymbol from './SatSymbol.vue'

const emit = defineEmits<{ select: [order: Order] }>()

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
      <table class="pb-table-grid">
        <colgroup>
          <col class="col-price" />
          <col v-if="showPremium" class="col-prem" />
          <col class="col-amount" />
          <col class="col-sats" />
          <col class="col-methods" />
          <col class="col-rep" />
          <col class="col-src" />
          <col class="col-age" />
        </colgroup>
        <thead class="pb-thead">
          <tr>
            <th class="col-price">Price</th>
            <th v-if="showPremium" class="col-prem">Premium</th>
            <th class="col-amount">Amount range</th>
            <th class="col-sats">Sats</th>
            <th class="col-methods">Payment</th>
            <th class="col-rep">Rep</th>
            <th class="col-src">Source</th>
            <th class="col-age">Age</th>
          </tr>
        </thead>
        <tbody class="pb-tbody">
          <tr
            v-for="o in orders"
            :key="o.id"
            :class="['pb-row', crossedIds.has(o.id) ? 'pb-row--crossed' : '']"
            style="cursor: pointer"
            role="button"
            tabindex="0"
            :style="{
              background: `linear-gradient(to ${side === 'buy' ? 'right' : 'left'}, ${sideTint} ${(o.amountSats / maxAmt) * 100}%, transparent ${(o.amountSats / maxAmt) * 100}%)`,
            }"
            @click="emit('select', o)"
            @keydown.enter.prevent="emit('select', o)"
            @keydown.space.prevent="emit('select', o)"
          >
            <td class="col-price" :style="{ color: sideColor, fontWeight: '600' }">
              <span v-if="crossedIds.has(o.id)" class="pb-cross-mark" title="Price crosses an order on the other side">⚡</span>
              {{ fmtFiat(o.price, o.currency, { bare: true }) }}
            </td>
            <td v-if="showPremium" class="col-prem">
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
            </td>
            <td class="col-amount">
              <span class="pb-num">{{ fmtFiat(o.minFiat, o.currency) }}</span>
              <span class="pb-num-sep"> – </span>
              <span class="pb-num">{{ fmtFiat(o.maxFiat, o.currency, { bare: true }) }}</span>
            </td>
            <td class="col-sats pb-num pb-num--muted">{{ fmtSatsCompact(o.amountSats, { bare: true }) }} <SatSymbol /></td>
            <td class="col-methods"><MethodChips :methods="o.methods" /></td>
            <td class="col-rep">
              <ReputationBar :completion="o.completion" :trades="o.trades" />
            </td>
            <td class="col-src"><SourceDot :source="o.source" /></td>
            <td class="col-age pb-num pb-num--muted">{{ fmtTimeShort(o.ageMin) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
