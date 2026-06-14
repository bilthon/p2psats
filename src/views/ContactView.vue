<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.app'

useHead(computed(() => {
  const title = t('seo.contact.title')
  const description = t('seo.contact.description')
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

const npub = (import.meta.env.VITE_CONTACT_NPUB as string | undefined)?.trim() || ''
const email = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
</script>

<template>
  <article class="pb-page">
    <h1 class="pb-page-title">{{ t('contact.title') }}</h1>

    <p class="pb-page-lead">{{ t('contact.lead') }}</p>

    <ul class="pb-contact-list">
      <li>
        <span class="pb-contact-label">{{ t('contact.nostr') }}</span>
        <span class="pb-contact-value">
          <a
            v-if="npub"
            :href="`https://njump.me/${npub}`"
            target="_blank"
            rel="noopener"
            class="pb-page-link"
            >{{ npub }}</a
          >
          <em v-else>{{ t('contact.notConfigured') }}</em>
        </span>
      </li>
      <li>
        <span class="pb-contact-label">{{ t('contact.email') }}</span>
        <span class="pb-contact-value">
          <a v-if="email" :href="`mailto:${email}`" class="pb-page-link">{{ email }}</a>
          <em v-else>{{ t('contact.notConfigured') }}</em>
        </span>
      </li>
    </ul>
  </article>
</template>
