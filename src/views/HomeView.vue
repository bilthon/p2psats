<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useAppStore } from '@/stores/appStore'
import { useRoute } from 'vue-router'
import { useNostrOrderbookStore } from '@/services/nostrOrderbook'
import { fmtFiat, fmtSatsCompact, REF_RATES } from '@/lib/data'
import ArbitrageBanner from '@/components/ArbitrageBanner.vue'
import DepthChart from '@/components/DepthChart.vue'
import OrderBook from '@/components/OrderBook.vue'
import CrossedPairsList from '@/components/CrossedPairsList.vue'
import OrderDetailDialog from '@/components/OrderDetailDialog.vue'
import SatSymbol from '@/components/SatSymbol.vue'
import type { Order } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.com'

useHead(computed(() => {
  const title = t('seo.home.title')
  const description = t('seo.home.description')
  const canonical = siteUrl + route.path
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    link: [{ rel: 'canonical', href: canonical }],
  }
}))
const store = useAppStore()
const nostr = useNostrOrderbookStore()

const crossRef = ref<HTMLElement | null>(null)

function jumpToCrossed() {
  crossRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const relayTooltip = computed(() => {
  const statuses = Object.values(nostr.relayStatus)
  const total = statuses.length
  const openCount = statuses.filter((s) => s === 'open' || s === 'eosed').length
  return t('home.relaysConnected', { open: openCount, total })
})

const selectedOrder = ref<Order | null>(null)

const rawForSelected = computed(() =>
  selectedOrder.value
    ? nostr.orders.get(`${selectedOrder.value.maker}:${selectedOrder.value.id}`)
    : undefined,
)

const eventForSelected = computed(() =>
  selectedOrder.value
    ? nostr.events.get(`${selectedOrder.value.maker}:${selectedOrder.value.id}`)
    : undefined,
)

watch(
  () => store.currency,
  () => { selectedOrder.value = null },
)
</script>

<template>
  <!-- Stats strip -->
  <section class="pb-stats">
    <div class="pb-stat">
      <div class="pb-stat-label">{{ t('home.stats.midPrice') }}</div>
      <div class="pb-stat-value">
        {{ store.mid ? fmtFiat(store.mid, store.currency) : '—' }}
      </div>
      <div class="pb-stat-sub">{{ t('home.stats.vsRef', { ref: fmtFiat(REF_RATES[store.currency], store.currency) }) }}</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">{{ t('home.stats.bestBid') }}</div>
      <div class="pb-stat-value" style="color: oklch(0.55 0.14 155)">
        {{ store.bestBid ? fmtFiat(store.bestBid, store.currency) : '—' }}
      </div>
      <div class="pb-stat-sub">{{ t('home.stats.buyOrders', store.buys.length) }}</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">{{ t('home.stats.bestAsk') }}</div>
      <div class="pb-stat-value" style="color: oklch(0.55 0.18 25)">
        {{ store.bestAsk ? fmtFiat(store.bestAsk, store.currency) : '—' }}
      </div>
      <div class="pb-stat-sub">{{ t('home.stats.sellOrders', store.sells.length) }}</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">
        {{ store.spread !== null && store.spread < 0 ? t('home.stats.spreadCrossed') : t('home.stats.spread') }}
      </div>
      <div
        class="pb-stat-value"
        :style="{
          color:
            store.spread !== null && store.spread < 0 ? 'oklch(0.5 0.18 50)' : undefined,
        }"
      >
        <template v-if="store.spread !== null">
          <template v-if="store.spread < 0"
            >⚡ {{ fmtFiat(Math.abs(store.spread), store.currency) }}</template
          >
          <template v-else>{{ fmtFiat(store.spread, store.currency) }}</template>
        </template>
        <template v-else>—</template>
      </div>
      <div class="pb-stat-sub">
        <template v-if="store.spreadPct !== null">
          <template v-if="store.spread !== null && store.spread < 0">
            −{{ Math.abs(store.spreadPct).toFixed(2) }}% {{ t('home.invertedSpread') }}
          </template>
          <template v-else>{{ store.spreadPct.toFixed(2) }}%</template>
        </template>
      </div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">{{ t('home.stats.bidDepth') }}</div>
      <div class="pb-stat-value">{{ fmtSatsCompact(store.totalBidsSats, { bare: true }) }} <SatSymbol /></div>
      <div class="pb-stat-sub">{{ t('home.stats.acrossAllBids') }}</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">{{ t('home.stats.askDepth') }}</div>
      <div class="pb-stat-value">{{ fmtSatsCompact(store.totalAsksSats, { bare: true }) }} <SatSymbol /></div>
      <div class="pb-stat-sub">{{ t('home.stats.acrossAllAsks') }}</div>
    </div>

    <div class="pb-live-pill" :title="relayTooltip">
      <span class="pb-live-dot" />
      {{ t('home.live', { count: store.ccyOrders.length }) }}
    </div>
  </section>

  <!-- Arbitrage banner -->
  <ArbitrageBanner
    :crosses="store.crosses"
    :currency="store.currency"
    @jump-to="jumpToCrossed"
  />

  <!-- Depth chart card -->
  <section class="pb-depth-card">
    <div class="pb-card-hd">
      <h2 class="pb-card-title">{{ t('home.depthCardTitle') }}</h2>
    </div>
    <div class="pb-depth-canvas">
      <DepthChart
        :orders="store.ccyOrders"
        :currency="store.currency"
        :crosses="store.crosses"
      />
    </div>
  </section>

  <!-- Order book tables -->
  <OrderBook
    :buys="store.buys"
    :sells="store.sells"
    :currency="store.currency"
    :crossed-buy-ids="store.crosses.crossedBuyIds"
    :crossed-sell-ids="store.crosses.crossedSellIds"
    @select="selectedOrder = $event"
  />

  <!-- Crossed pairs detail -->
  <div ref="crossRef">
    <CrossedPairsList :crosses="store.crosses" :currency="store.currency" />
  </div>

  <!-- Order detail dialog (teleports to body) -->
  <OrderDetailDialog
    v-if="selectedOrder"
    :order="selectedOrder"
    :raw="rawForSelected"
    :event="eventForSelected"
    @close="selectedOrder = null"
  />
</template>
