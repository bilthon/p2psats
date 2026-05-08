<script setup lang="ts">
import { fmtFiat } from '@/lib/data'
import type { CrossResult, Currency } from '@/lib/types'
import MethodChips from './MethodChips.vue'
import SourceDot from './SourceDot.vue'

const props = defineProps<{
  crosses: CrossResult
  currency: Currency
}>()
</script>

<template>
  <section v-if="crosses.pairs.length" class="pb-cross-card" id="crossed-pairs">
    <div class="pb-card-hd">
      <div>
        <h2 class="pb-card-title">Crossed orders</h2>
        <p class="pb-section-sub" style="margin-top: 4px">
          Bid prices that meet or exceed an ask price. Pairs sharing a payment method and from
          different platforms are tractable arbitrage candidates.
        </p>
      </div>
      <div class="pb-section-meta">
        {{ crosses.pairs.length }} pair{{ crosses.pairs.length === 1 ? '' : 's' }}
      </div>
    </div>

    <div class="pb-cross-list">
      <div
        v-for="(p, i) in crosses.pairs.slice(0, 8)"
        :key="p.buy.id + '_' + p.sell.id"
        :class="['pb-cross', p.tractable ? 'pb-cross--tractable' : '']"
      >
        <div class="pb-cross-rank">#{{ i + 1 }}</div>

        <div class="pb-cross-leg pb-cross-leg--ask">
          <div class="pb-cross-leg-hd">
            <span class="pb-cross-side-tag pb-cross-side-tag--ask">BUY at ASK</span>
            <SourceDot :source="p.sell.source" />
          </div>
          <div class="pb-cross-price" style="color: oklch(0.55 0.18 25)">
            {{ fmtFiat(p.sell.price, currency) }}
          </div>
          <div class="pb-cross-meta">
            <span>@{{ p.sell.makerHandle }}</span>
            <span class="pb-cross-meta-sep">·</span>
            <span
              >{{ fmtFiat(p.sell.minFiat, currency, { bare: true }) }}–{{
                fmtFiat(p.sell.maxFiat, currency, { bare: true })
              }}</span
            >
          </div>
          <div class="pb-cross-methods">
            <MethodChips :methods="p.sell.methods" :max="3" />
          </div>
        </div>

        <div class="pb-cross-arrow" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <path
              d="M2 11h18M14 5l6 6-6 6"
              stroke="currentColor"
              stroke-width="1.6"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <div class="pb-cross-leg pb-cross-leg--bid">
          <div class="pb-cross-leg-hd">
            <span class="pb-cross-side-tag pb-cross-side-tag--bid">SELL to BID</span>
            <SourceDot :source="p.buy.source" />
          </div>
          <div class="pb-cross-price" style="color: oklch(0.55 0.14 155)">
            {{ fmtFiat(p.buy.price, currency) }}
          </div>
          <div class="pb-cross-meta">
            <span>@{{ p.buy.makerHandle }}</span>
            <span class="pb-cross-meta-sep">·</span>
            <span
              >{{ fmtFiat(p.buy.minFiat, currency, { bare: true }) }}–{{
                fmtFiat(p.buy.maxFiat, currency, { bare: true })
              }}</span
            >
          </div>
          <div class="pb-cross-methods">
            <MethodChips :methods="p.buy.methods" :max="3" />
          </div>
        </div>

        <div class="pb-cross-edge">
          <div class="pb-cross-edge-pct">+{{ p.spreadPct.toFixed(2) }}%</div>
          <div class="pb-cross-edge-abs">{{ fmtFiat(p.spreadFiat, currency) }} per BTC</div>
          <div v-if="p.sharedMethods.length > 0" class="pb-cross-shared">
            <span class="pb-cross-shared-dot" />
            via {{ p.sharedMethods.map((m) => m.label).join(', ') }}
          </div>
          <div v-else class="pb-cross-shared pb-cross-shared--none">no shared method</div>
        </div>
      </div>
    </div>
  </section>
</template>
