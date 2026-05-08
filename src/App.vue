<script setup lang="ts">
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import CurrencySwitcher from '@/components/CurrencySwitcher.vue'
import RelayStatus from '@/components/RelayStatus.vue'
import TweaksPanel from '@/components/TweaksPanel.vue'
import type { Currency } from '@/lib/types'

const store = useAppStore()
const router = useRouter()
const route = useRoute()

function navigateTo(page: 'book' | 'alerts') {
  void router.push('/' + page)
}

function onCurrencyChange(c: Currency) {
  store.setCurrency(c)
}

// Tweaks panel ref for the open/close toggle button
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
          <div class="pb-brand-name">P2P Explorer</div>
          <div class="pb-brand-tag">nostr orderbook · NIP-69</div>
        </div>
      </div>

      <RelayStatus
        :active-sources="store.activeSources"
        @toggle="store.toggleSource"
      />

      <div class="pb-header-right">
        <CurrencySwitcher :model-value="store.currency" @update:model-value="onCurrencyChange" />

        <TweaksPanel>
          <template #trigger="{ toggle, open }">
            <button
              :class="['pb-icon-btn', open ? 'pb-icon-btn--on' : '']"
              title="Settings / Tweaks"
              aria-label="Settings"
              @click="toggle"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
            </button>
          </template>
        </TweaksPanel>
      </div>
    </header>

    <!-- ── Page nav ────────────────────────────────────────── -->
    <nav class="pb-nav" aria-label="Primary">
      <button
        type="button"
        :class="['pb-nav-item', route.path === '/book' ? 'pb-nav-item--on' : '']"
        @click="navigateTo('book')"
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
        <span>Order book</span>
        <span class="pb-nav-count">{{ store.ccyOrders.length }}</span>
      </button>
      <button
        type="button"
        :class="['pb-nav-item', route.path === '/alerts' ? 'pb-nav-item--on' : '']"
        @click="navigateTo('alerts')"
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
        <span>Alerts</span>
        <span v-if="store.alerts.length > 0" class="pb-nav-count">{{
          store.activeAlerts
        }}</span>
      </button>
    </nav>

    <!-- ── Page content ────────────────────────────────────── -->
    <RouterView />

    <!-- ── Footer ──────────────────────────────────────────── -->
    <footer class="pb-foot">
      <span>Aggregated from public nostr relays. Read-only — this site doesn't take orders.</span>
      <span class="pb-foot-sep">·</span>
      <span>Reference rate from Kraken spot.</span>
    </footer>
  </div>
</template>
