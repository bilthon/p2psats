<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import AlertBuilder from '@/components/AlertBuilder.vue'
import SavedAlerts from '@/components/SavedAlerts.vue'
import type { Alert } from '@/lib/types'

const { t } = useI18n()
const store = useAppStore()
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

function onSave(alert: Alert) {
  store.addAlert(alert)
}
</script>

<template>
  <section class="pb-alerts-section" id="alerts">
    <div class="pb-section-hd">
      <div>
        <h2 class="pb-card-title">Alerts</h2>
        <p class="pb-section-sub">
          Subscribe to NIP-69 events that match your rule. Matching orders are emailed the moment
          they're seen on any tracked relay.
        </p>
      </div>
      <div class="pb-section-meta">
        {{ store.alerts.length }} alert{{ store.alerts.length === 1 ? '' : 's' }} ·
        {{ store.activeAlerts }} active · {{ store.totalActiveMatches }}
        match{{ store.totalActiveMatches === 1 ? '' : 'es' }} now
      </div>
    </div>

    <AlertBuilder
      :currency="store.currency"
      :method-options="store.methodsForCcy"
      @save="onSave"
    />

    <SavedAlerts
      :alerts="store.alerts"
      :current-matches="store.matchesByAlert"
      @remove="store.removeAlert"
      @toggle="store.toggleAlert"
    />
  </section>
</template>
