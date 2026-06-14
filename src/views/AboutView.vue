<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.app'

useHead(computed(() => {
  const title = t('seo.about.title')
  const description = t('seo.about.description')
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
</script>

<template>
  <article class="pb-page">
    <h1 class="pb-page-title">{{ t('about.title') }}</h1>

    <p class="pb-page-lead">{{ t('about.lead') }}</p>

    <p>{{ t('about.p1') }}</p>

    <p>{{ t('about.p2') }}</p>

    <p>{{ t('about.p3') }}</p>
  </article>
</template>
