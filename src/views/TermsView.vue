<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.app'

useHead(computed(() => {
  const title = t('seo.terms.title')
  const description = t('seo.terms.description')
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

// Update this date whenever the terms change.
const effectiveDate = '2026-06-06'
</script>

<template>
  <article class="pb-page">
    <h1 class="pb-page-title">{{ t('terms.title') }}</h1>

    <p class="pb-page-lead">{{ t('terms.lead') }}</p>

    <h2>{{ t('terms.serviceTitle') }}</h2>
    <ul>
      <li>{{ t('terms.service.readOnly') }}</li>
      <li>{{ t('terms.service.noFunds') }}</li>
      <li>{{ t('terms.service.noAdvice') }}</li>
    </ul>

    <h2>{{ t('terms.warrantyTitle') }}</h2>
    <ul>
      <li>{{ t('terms.warranty.asIs') }}</li>
      <li>{{ t('terms.warranty.uptime') }}</li>
    </ul>

    <h2>{{ t('terms.suspensionTitle') }}</h2>
    <p>{{ t('terms.suspension') }}</p>

    <p class="pb-page-meta">{{ t('terms.effectiveDate') }} {{ effectiveDate }}</p>
  </article>
</template>
