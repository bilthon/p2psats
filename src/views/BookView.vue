<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useNostrOrderbookStore } from '@/services/nostrOrderbook'
import { fmtFiat, fmtSatsCompact, REF_RATES } from '@/lib/data'
import ArbitrageBanner from '@/components/ArbitrageBanner.vue'
import DepthChart from '@/components/DepthChart.vue'
import OrderBook from '@/components/OrderBook.vue'
import CrossedPairsList from '@/components/CrossedPairsList.vue'

const store = useAppStore()
const nostr = useNostrOrderbookStore()

// Ref for the crossed-pairs section for smooth scroll
const crossRef = ref<HTMLElement | null>(null)

function jumpToCrossed() {
  crossRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  nostr.connect()
})

onUnmounted(() => {
  nostr.disconnect()
})

// Relay status tooltip: "N/M relays connected"
const relayTooltip = computed(() => {
  const statuses = Object.values(nostr.relayStatus)
  const total = statuses.length
  const openCount = statuses.filter((s) => s === 'open' || s === 'eosed').length
  return `${openCount}/${total} relays connected`
})
</script>

<template>
  <!-- Stats strip -->
  <section class="pb-stats">
    <div class="pb-stat">
      <div class="pb-stat-label">Mid price</div>
      <div class="pb-stat-value">
        {{ store.mid ? fmtFiat(store.mid, store.currency) : '—' }}
      </div>
      <div class="pb-stat-sub">vs ref {{ fmtFiat(REF_RATES[store.currency], store.currency) }}</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">Best bid</div>
      <div class="pb-stat-value" style="color: oklch(0.55 0.14 155)">
        {{ store.bestBid ? fmtFiat(store.bestBid, store.currency) : '—' }}
      </div>
      <div class="pb-stat-sub">{{ store.buys.length }} buy orders</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">Best ask</div>
      <div class="pb-stat-value" style="color: oklch(0.55 0.18 25)">
        {{ store.bestAsk ? fmtFiat(store.bestAsk, store.currency) : '—' }}
      </div>
      <div class="pb-stat-sub">{{ store.sells.length }} sell orders</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">
        {{ store.spread !== null && store.spread < 0 ? 'Spread (crossed)' : 'Spread' }}
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
            −{{ Math.abs(store.spreadPct).toFixed(2) }}% inverted
          </template>
          <template v-else>{{ store.spreadPct.toFixed(2) }}%</template>
        </template>
      </div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">Bid depth</div>
      <div class="pb-stat-value">{{ fmtSatsCompact(store.totalBidsSats) }}</div>
      <div class="pb-stat-sub">across all bids</div>
    </div>

    <div class="pb-stat">
      <div class="pb-stat-label">Ask depth</div>
      <div class="pb-stat-value">{{ fmtSatsCompact(store.totalAsksSats) }}</div>
      <div class="pb-stat-sub">across all asks</div>
    </div>

    <div class="pb-live-pill" :title="relayTooltip">
      <span class="pb-live-dot" />
      live · {{ store.ccyOrders.length }} orders
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
      <h2 class="pb-card-title">Order book depth</h2>
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
    :density="store.density"
    :show-premium="store.showPremium"
    :view="store.bookView"
    :crossed-buy-ids="store.crosses.crossedBuyIds"
    :crossed-sell-ids="store.crosses.crossedSellIds"
    @change-view="store.setBookView"
  />

  <!-- Crossed pairs detail -->
  <div ref="crossRef">
    <CrossedPairsList :crosses="store.crosses" :currency="store.currency" />
  </div>
</template>
