<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import SignInPanel from '@/components/SignInPanel.vue'

const { t } = useI18n()
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.com'

useHead(computed(() => {
  const title = t('signIn.seo.title')
  const description = t('signIn.seo.description')
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
      // Instruct search engines not to index the sign-in page
      { name: 'robots', content: 'noindex' },
    ],
    link: [{ rel: 'canonical', href: canonical }],
  }
}))
</script>

<template>
  <section class="sv-section">
    <div class="sv-header">
      <h1 class="pb-card-title sv-title">{{ t('signIn.heading') }}</h1>
      <p class="pb-section-sub">{{ t('signIn.sub') }}</p>
    </div>
    <SignInPanel />
  </section>
</template>

<style scoped>
.sv-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px 16px;
}

.sv-header {
  text-align: center;
  max-width: 480px;
}

.sv-title {
  font-size: 22px;
  margin: 0 0 6px;
}
</style>
