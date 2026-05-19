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
        <h2 class="pb-card-title">Alerts</h2>
        <p class="pb-section-sub">
          Subscribe to NIP-69 events that match your rule. Get notified when a matching order
          appears on any tracked relay.
        </p>
      </div>
      <div class="pb-section-meta">
        {{ store.alerts.length }} alert{{ store.alerts.length === 1 ? '' : 's' }} ·
        {{ store.activeAlerts }} active · {{ store.totalActiveMatches }}
        match{{ store.totalActiveMatches === 1 ? '' : 'es' }} now
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
        :method-options="store.methodsForCcy"
        :on-save="onSave"
      />
    </template>

    <!-- SavedAlerts always visible — shows local drafts when signed out too -->
    <SavedAlerts
      :alerts="store.alerts"
      :current-matches="store.matchesByAlert"
      @remove="store.removeAlert"
      @toggle="store.toggleAlert"
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
