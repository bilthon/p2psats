<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BookView, Currency, Density, Order } from '@/lib/types'
import OrderTable from './OrderTable.vue'

const props = defineProps<{
  buys: Order[]
  sells: Order[]
  currency: Currency
  density: Density
  showPremium: boolean
  view: BookView
  crossedBuyIds: Set<string>
  crossedSellIds: Set<string>
}>()

const emit = defineEmits<{ changeView: [v: BookView] }>()

const activeTab = ref<'buy' | 'sell'>('buy')

const rowH = computed(() => {
  if (props.density === 'compact') return 30
  if (props.density === 'comfy') return 44
  return 36
})

const crossedBuyN = computed(() => props.crossedBuyIds.size)
const crossedSellN = computed(() => props.crossedSellIds.size)

function sortedOrders(orders: Order[], side: 'buy' | 'sell'): Order[] {
  return [...orders].sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price))
}

const sortedBuys = computed(() => sortedOrders(props.buys, 'buy'))
const sortedSells = computed(() => sortedOrders(props.sells, 'sell'))

const BID_COLOR = 'oklch(0.62 0.14 155)'
const ASK_COLOR = 'oklch(0.6 0.18 25)'
const BID_TINT = 'oklch(0.62 0.14 155 / 0.07)'
const ASK_TINT = 'oklch(0.6 0.18 25 / 0.07)'

const VIEW_OPTIONS: Array<{ v: BookView; l: string }> = [
  { v: 'tabs', l: 'Tabs' },
  { v: 'split', l: 'Split' },
  { v: 'stacked', l: 'Stack' },
]
</script>

<template>
  <section class="pb-book-card">
    <!-- Header -->
    <div class="pb-book-hd">
      <div class="pb-book-tabs" role="tablist" aria-label="Order book side">
        <button
          role="tab"
          :aria-selected="activeTab === 'buy'"
          :class="['pb-book-tab', activeTab === 'buy' ? 'pb-book-tab--on pb-book-tab--bid' : '']"
          @click="activeTab = 'buy'"
        >
          <span class="pb-side-dot" :style="{ background: BID_COLOR }" />
          Bids
          <span class="pb-book-tab-count">{{ buys.length }}</span>
          <span v-if="crossedBuyN > 0" class="pb-book-tab-cross" :title="`${crossedBuyN} crossed`"
            >⚡{{ crossedBuyN }}</span
          >
        </button>
        <button
          role="tab"
          :aria-selected="activeTab === 'sell'"
          :class="['pb-book-tab', activeTab === 'sell' ? 'pb-book-tab--on pb-book-tab--ask' : '']"
          @click="activeTab = 'sell'"
        >
          <span class="pb-side-dot" :style="{ background: ASK_COLOR }" />
          Asks
          <span class="pb-book-tab-count">{{ sells.length }}</span>
          <span
            v-if="crossedSellN > 0"
            class="pb-book-tab-cross"
            :title="`${crossedSellN} crossed`"
            >⚡{{ crossedSellN }}</span
          >
        </button>
      </div>
      <div class="pb-book-view">
        <button
          v-for="o in VIEW_OPTIONS"
          :key="o.v"
          type="button"
          :class="['pb-tab', view === o.v ? 'pb-tab--on' : '']"
          @click="emit('changeView', o.v)"
        >
          {{ o.l }}
        </button>
      </div>
    </div>

    <!-- Split view: two columns -->
    <div v-if="view === 'split'" class="pb-book-grid">
      <OrderTable
        title="Bids"
        side="buy"
        :orders="sortedBuys"
        :currency="currency"
        :row-h="rowH"
        :show-premium="showPremium"
        :crossed-ids="crossedBuyIds"
        :side-color="BID_COLOR"
        :side-tint="BID_TINT"
        :embedded="true"
      />
      <OrderTable
        title="Asks"
        side="sell"
        :orders="sortedSells"
        :currency="currency"
        :row-h="rowH"
        :show-premium="showPremium"
        :crossed-ids="crossedSellIds"
        :side-color="ASK_COLOR"
        :side-tint="ASK_TINT"
        :embedded="true"
      />
    </div>

    <!-- Stacked view: bids above asks -->
    <div v-else-if="view === 'stacked'" class="pb-book-stack">
      <OrderTable
        title="Bids"
        side="buy"
        :orders="sortedBuys"
        :currency="currency"
        :row-h="rowH"
        :show-premium="showPremium"
        :crossed-ids="crossedBuyIds"
        :side-color="BID_COLOR"
        :side-tint="BID_TINT"
        :embedded="true"
      />
      <OrderTable
        title="Asks"
        side="sell"
        :orders="sortedSells"
        :currency="currency"
        :row-h="rowH"
        :show-premium="showPremium"
        :crossed-ids="crossedSellIds"
        :side-color="ASK_COLOR"
        :side-tint="ASK_TINT"
        :embedded="true"
      />
    </div>

    <!-- Tabs view: single list -->
    <OrderTable
      v-else
      :title="activeTab === 'buy' ? 'Bids' : 'Asks'"
      :side="activeTab"
      :orders="activeTab === 'buy' ? sortedBuys : sortedSells"
      :currency="currency"
      :row-h="rowH"
      :show-premium="showPremium"
      :crossed-ids="activeTab === 'buy' ? crossedBuyIds : crossedSellIds"
      :side-color="activeTab === 'buy' ? BID_COLOR : ASK_COLOR"
      :side-tint="activeTab === 'buy' ? BID_TINT : ASK_TINT"
      :embedded="true"
      :hide-title="true"
    />
  </section>
</template>
