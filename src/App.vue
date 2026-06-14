<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useAppStore } from '@/stores/appStore'
import { useNostrOrderbookStore } from '@/services/nostrOrderbook'
import { useBtcRatesStore } from '@/services/btcRates'
import CurrencySwitcher from '@/components/CurrencySwitcher.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import RelayStatus from '@/components/RelayStatus.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import MatchToast from '@/components/MatchToast.vue'
import UserMenu from '@/components/UserMenu.vue'
import type { FiatCode } from '@/lib/currency'
import logoUrl from '@/assets/img/p2psats.png'
import { OG_LOCALE } from '@/i18n'

const { t } = useI18n()
const store = useAppStore()

// Site-wide head defaults. Individual views override title/description/canonical.
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.app'
const ogImageUrl = `${siteUrl}/og.png`

useHead(computed(() => ({
  htmlAttrs: { lang: store.locale },
  meta: [
    { property: 'og:site_name', content: 'P2P sats' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: OG_LOCALE[store.locale] ?? 'en_US' },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'P2P sats — live peer-to-peer Bitcoin order book aggregated from Nostr relays' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: ogImageUrl },
  ],
})))
const nostr = useNostrOrderbookStore()
const btcRates = useBtcRatesStore()
const router = useRouter()
const route = useRoute()

onMounted(() => {
  // Sync the Pinia theme state to the DOM attribute on client boot.
  // The FOUC-prevention script in index.html already sets data-theme before
  // paint, but calling setTheme here ensures the store and DOM stay in sync
  // in case they somehow diverge (e.g. localStorage updated in another tab).
  store.setTheme(store.theme)
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

function onCurrencyChange(c: FiatCode) {
  store.setCurrency(c)
}

// Build stamp surfaced in the footer. Values come from vite.config.ts `define`
// (see __APP_VERSION__/__APP_COMMIT__ in src/vite-env.d.ts).
const buildVersion = __APP_VERSION__
const buildCommit = __APP_COMMIT__
</script>

<template>
  <div class="pb-app pb-app--nav">
    <!-- ── Fixed-position toast stack (floats above all routed views) ─── -->
    <MatchToast />

    <!-- ── Header ──────────────────────────────────────────── -->
    <header class="pb-header">
      <div class="pb-brand">
        <div class="pb-logo" aria-hidden="true">
          <img :src="logoUrl" alt="P2P sats logo" width="32" height="32" />
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
        <ThemeToggle />
        <LanguageSwitcher />
        <CurrencySwitcher :model-value="store.currency" @update:model-value="onCurrencyChange" />
        <UserMenu />
      </div>
    </header>

    <!-- ── Page nav ────────────────────────────────────────── -->
    <nav :class="['pb-nav', route.path === '/alerts' ? 'pb-nav--alerts' : 'pb-nav--book']" aria-label="Primary">
      <button
        type="button"
        :class="['pb-nav-item', route.path === '/' ? 'pb-nav-item--on' : '']"
        @click="goHome"
      >
        <svg
          class="pb-nav-icon pb-nav-icon--book"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path class="pb-nav-book-line pb-nav-book-line--1" d="M3 6h18" />
          <path class="pb-nav-book-line pb-nav-book-line--2" d="M3 12h18" />
          <path class="pb-nav-book-line pb-nav-book-line--3" d="M3 18h12" />
        </svg>
        <span>{{ t('nav.orderBook') }}</span>
        <span class="pb-nav-count">{{ store.ccyOrders.length }}</span>
      </button>
      <RouterLink to="/alerts" class="pb-nav-item" active-class="pb-nav-item--on">
        <svg
          class="pb-nav-icon pb-nav-icon--alerts"
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
      </RouterLink>
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
        <span class="pb-foot-sep">·</span>
        <span class="pb-foot-build" :title="`v${buildVersion} · ${buildCommit}`">
          v{{ buildVersion }} · {{ buildCommit }}
        </span>
      </div>
    </footer>
  </div>
</template>
