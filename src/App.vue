<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/appStore'
import { useNostrOrderbookStore } from '@/services/nostrOrderbook'
import { useBtcRatesStore } from '@/services/btcRates'
import CurrencySwitcher from '@/components/CurrencySwitcher.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import RelayStatus from '@/components/RelayStatus.vue'
import type { Currency } from '@/lib/types'

const { t } = useI18n()
const store = useAppStore()
const nostr = useNostrOrderbookStore()
const btcRates = useBtcRatesStore()
const router = useRouter()
const route = useRoute()

onMounted(() => {
  nostr.connect()
  btcRates.start()
})

onUnmounted(() => {
  nostr.disconnect()
  btcRates.stop()
})

function goHome() {
  void router.push('/')
}

function onCurrencyChange(c: Currency) {
  store.setCurrency(c)
}
</script>

<template>
  <div class="pb-app pb-app--nav">
    <!-- ── Header ──────────────────────────────────────────── -->
    <header class="pb-header">
      <div class="pb-brand">
        <div class="pb-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M5 4v16M19 4v16M5 12h14"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle cx="9" cy="8" r="1.6" fill="currentColor" />
            <circle cx="15" cy="16" r="1.6" fill="currentColor" />
          </svg>
        </div>
        <div class="pb-brand-text">
          <div class="pb-brand-name">P2P sats</div>
          <div class="pb-brand-tag">{{ t('app.brandTag') }}</div>
        </div>
      </div>

      <RelayStatus
        :active-sources="store.activeSources"
        @toggle="store.toggleSource"
      />

      <div class="pb-header-right">
        <LanguageSwitcher />
        <CurrencySwitcher :model-value="store.currency" @update:model-value="onCurrencyChange" />
      </div>
    </header>

    <!-- ── Page nav ────────────────────────────────────────── -->
    <nav class="pb-nav" aria-label="Primary">
      <button
        type="button"
        :class="['pb-nav-item', route.path === '/' ? 'pb-nav-item--on' : '']"
        @click="goHome"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18M3 12h18M3 18h12" />
        </svg>
        <span>{{ t('nav.orderBook') }}</span>
        <span class="pb-nav-count">{{ store.ccyOrders.length }}</span>
      </button>
      <button
        type="button"
        class="pb-nav-item pb-nav-item--disabled"
        disabled
        aria-disabled="true"
        :title="t('nav.alerts') + ' ' + t('nav.alertsComingSoon')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span>{{ t('nav.alerts') }}</span>
        <span class="pb-nav-soon">{{ t('nav.alertsComingSoon') }}</span>
      </button>
    </nav>

    <!-- ── Page content ────────────────────────────────────── -->
    <main class="pb-main">
      <RouterView :key="store.locale" />
    </main>

    <!-- ── Footer ──────────────────────────────────────────── -->
    <footer class="pb-foot">
      <div class="pb-foot-row pb-foot-row--top">
        <div class="pb-foot-brand">
          {{ t('footer.brand') }}<span class="pb-foot-tag">{{ t('footer.tag') }}</span>
        </div>
        <nav class="pb-foot-links" aria-label="Footer">
          <RouterLink to="/" class="pb-foot-link">{{ t('footer.home') }}</RouterLink>
          <RouterLink to="/about" class="pb-foot-link">{{ t('footer.about') }}</RouterLink>
          <RouterLink to="/contact" class="pb-foot-link">{{ t('footer.contact') }}</RouterLink>
        </nav>
      </div>
      <div class="pb-foot-row pb-foot-row--bottom">
        <span>{{ t('footer.aggregated') }}</span>
        <span class="pb-foot-sep">·</span>
        <span>{{ t('footer.referenceRate') }}</span>
      </div>
    </footer>
  </div>
</template>
