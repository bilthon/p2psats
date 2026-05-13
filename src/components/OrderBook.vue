<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Currency, Order } from '@/lib/types'
import OrderTable from './OrderTable.vue'

const { t } = useI18n()

const props = defineProps<{
  buys: Order[]
  sells: Order[]
  currency: Currency
  crossedBuyIds: Set<string>
  crossedSellIds: Set<string>
}>()

// Comfy density everywhere (the previous tweakable density setting was retired
// along with the TweaksPanel). 44 px matches the prior `comfy` row height.
const rowH = 44

const emit = defineEmits<{ select: [order: Order] }>()

const activeTab = ref<'buy' | 'sell'>('buy')

// Split layout on desktop (≥ 768 px), tabbed list on narrower viewports.
// Reactive via matchMedia so resizing the window swaps live without reload.
// Guard: during SSG prerender window is mocked but matchMedia is absent.
const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(min-width: 768px)')
  : null
const isDesktop = ref(mql ? mql.matches : true)
function onMqlChange(e: MediaQueryListEvent) {
  isDesktop.value = e.matches
}
onMounted(() => mql?.addEventListener('change', onMqlChange))
onUnmounted(() => mql?.removeEventListener('change', onMqlChange))
const view = computed<'split' | 'tabs'>(() => (isDesktop.value ? 'split' : 'tabs'))

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
</script>

<template>
  <section class="pb-book-card">
    <!-- Header (tabs mode only — in split mode each OrderTable renders its
         own Bids/Asks title with count, so the header would just duplicate). -->
    <div v-if="view === 'tabs'" class="pb-book-hd">
      <div class="pb-book-tabs" role="tablist" :aria-label="t('order.book.aria.side')">
        <button
          role="tab"
          :aria-selected="activeTab === 'buy'"
          :class="['pb-book-tab', activeTab === 'buy' ? 'pb-book-tab--on pb-book-tab--bid' : '']"
          @click="activeTab = 'buy'"
        >
          <span class="pb-side-dot" :style="{ background: BID_COLOR }" />
          {{ t('order.book.tabs.bids') }}
          <span class="pb-book-tab-count">{{ buys.length }}</span>
          <span v-if="crossedBuyN > 0" class="pb-book-tab-cross" :title="t('order.book.crossedTooltip', crossedBuyN)"
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
          {{ t('order.book.tabs.asks') }}
          <span class="pb-book-tab-count">{{ sells.length }}</span>
          <span
            v-if="crossedSellN > 0"
            class="pb-book-tab-cross"
            :title="t('order.book.crossedTooltip', crossedSellN)"
            >⚡{{ crossedSellN }}</span
          >
        </button>
      </div>
    </div>

    <!-- Split layout (desktop) — two columns -->
    <div v-if="view === 'split'" class="pb-book-grid">
      <OrderTable
        :title="t('order.book.tabs.bids')"
        side="buy"
        :orders="sortedBuys"
        :currency="currency"
        :row-h="rowH"
        :show-premium="true"
        :crossed-ids="crossedBuyIds"
        :side-color="BID_COLOR"
        :side-tint="BID_TINT"
        :embedded="true"
        @select="emit('select', $event)"
      />
      <OrderTable
        :title="t('order.book.tabs.asks')"
        side="sell"
        :orders="sortedSells"
        :currency="currency"
        :row-h="rowH"
        :show-premium="true"
        :crossed-ids="crossedSellIds"
        :side-color="ASK_COLOR"
        :side-tint="ASK_TINT"
        :embedded="true"
        @select="emit('select', $event)"
      />
    </div>

    <!-- Tabs layout (mobile) — single list driven by activeTab -->
    <OrderTable
      v-else
      :title="activeTab === 'buy' ? t('order.book.tabs.bids') : t('order.book.tabs.asks')"
      :side="activeTab"
      :orders="activeTab === 'buy' ? sortedBuys : sortedSells"
      :currency="currency"
      :row-h="rowH"
      :show-premium="true"
      :crossed-ids="activeTab === 'buy' ? crossedBuyIds : crossedSellIds"
      :side-color="activeTab === 'buy' ? BID_COLOR : ASK_COLOR"
      :side-tint="activeTab === 'buy' ? BID_TINT : ASK_TINT"
      :embedded="true"
      :hide-title="true"
      @select="emit('select', $event)"
    />
  </section>
</template>
