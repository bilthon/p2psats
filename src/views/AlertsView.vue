<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/appStore'
import AlertBuilder from '@/components/AlertBuilder.vue'
import SavedAlerts from '@/components/SavedAlerts.vue'
import SignInPanel from '@/components/SignInPanel.vue'
import TestNostrDmAction from '@/components/TestNostrDmAction.vue'
import type { Alert } from '@p2psats/shared'

const { t } = useI18n()
const store = useAppStore()
const { signedIn } = storeToRefs(store)
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.com'

useHead(computed(() => {
  const title = t('seo.alerts.title')
  const description = t('seo.alerts.description')
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

/**
 * Async save handler passed as a prop to AlertBuilder.
 * The store's addAlert is async and throws on backend errors — the error
 * propagates back to AlertBuilder's try/catch which surfaces it inline.
 */
async function onSave(alert: Alert): Promise<void> {
  await store.addAlert(alert)
}
</script>

<template>
  <section class="pb-alerts-section" id="alerts">
    <div class="pb-section-hd">
      <div>
        <h2 class="pb-card-title">{{ t('alerts.heading') }}</h2>
        <p class="pb-section-sub">
          {{ t('alerts.subtitle') }}
        </p>
      </div>
      <div v-if="signedIn" class="pb-section-meta">
        {{ t('alerts.meta.count', { count: store.alerts.length, max: store.maxAlerts }, store.alerts.length) }} ·
        {{ t('alerts.meta.active', { count: store.activeAlerts }, store.activeAlerts) }} ·
        {{ t('alerts.meta.matches', { count: store.totalActiveMatches }, store.totalActiveMatches) }}
      </div>
    </div>

    <!-- Sign-in gate: show SignInPanel when not signed in -->
    <template v-if="!signedIn">
      <div class="pb-signin-gate">
        <p class="pb-signin-gate-sub">
          {{ t('alerts.signInPrompt') }}
        </p>
        <SignInPanel />
      </div>
    </template>

    <!-- Signed-in: show AlertBuilder with async onSave prop -->
    <template v-else>
      <AlertBuilder
        :currency="store.currency"
        :on-save="onSave"
      />
      <TestNostrDmAction />
    </template>

    <!-- SavedAlerts only renders when signed in. It owns its own store calls
         so async errors can be caught locally (a parent fire-and-forget
         listener can't observe the rejected promise from removeAlert /
         toggleAlert). -->
    <SavedAlerts
      v-if="signedIn"
      :alerts="store.alerts"
      :current-matches="store.matchesByAlert"
    />
  </section>
</template>

<style scoped>
.pb-signin-gate {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 0 4px;
}

.pb-signin-gate-sub {
  margin: 0;
  font-size: 13.5px;
  color: var(--ink-soft);
  line-height: 1.5;
}
</style>
