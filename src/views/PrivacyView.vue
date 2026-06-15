<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute, RouterLink } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://p2psats.app'

useHead(computed(() => {
  const title = t('seo.privacy.title')
  const description = t('seo.privacy.description')
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

// Update this date whenever the policy changes.
const effectiveDate = '2026-06-06'

const contactEmail = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
</script>

<template>
  <article class="pb-page">
    <h1 class="pb-page-title">{{ t('privacy.title') }}</h1>

    <p class="pb-page-lead">{{ t('privacy.lead') }}</p>

    <h2>{{ t('privacy.collectTitle') }}</h2>
    <ul>
      <li>{{ t('privacy.collect.email') }}</li>
      <li>{{ t('privacy.collect.nostr') }}</li>
      <li>{{ t('privacy.collect.accountId') }}</li>
      <li>{{ t('privacy.collect.alerts') }}</li>
      <li>{{ t('privacy.collect.dispatchLogs') }}</li>
    </ul>

    <h2>{{ t('privacy.whyTitle') }}</h2>
    <ul>
      <li>{{ t('privacy.why.auth') }}</li>
      <li>{{ t('privacy.why.dispatch') }}</li>
    </ul>

    <h2>{{ t('privacy.cookiesTitle') }}</h2>
    <p>{{ t('privacy.cookies') }}</p>

    <h2>{{ t('privacy.subprocessorsTitle') }}</h2>
    <ul>
      <li>{{ t('privacy.subprocessors.resend') }}</li>
      <li>{{ t('privacy.subprocessors.yadio') }}</li>
    </ul>
    <p>{{ t('privacy.subprocessors.hosting') }}</p>

    <h2>{{ t('privacy.retentionTitle') }}</h2>
    <ul>
      <li>{{ t('privacy.retention.alerts') }}</li>
      <li>{{ t('privacy.retention.logs') }}</li>
    </ul>

    <h2>{{ t('privacy.rightsTitle') }}</h2>
    <p>{{ t('privacy.rights.intro') }}</p>
    <ul>
      <li>{{ t('privacy.rights.access') }}</li>
      <li>{{ t('privacy.rights.deletion') }}</li>
    </ul>
    <p>{{ t('privacy.rights.deletionNote') }}</p>
    <p>{{ t('privacy.rights.response') }}</p>

    <h2>{{ t('privacy.contactTitle') }}</h2>
    <p v-if="contactEmail">
      {{ t('privacy.contact.pre') }}
      <a :href="`mailto:${contactEmail}`" class="pb-page-link">{{ contactEmail }}</a>{{ t('privacy.contact.post') }}
    </p>
    <p v-else>
      {{ t('privacy.contact.fallbackPre') }}<RouterLink to="/contact" class="pb-page-link">{{ t('privacy.contact.fallbackLinkLabel') }}</RouterLink>{{ t('privacy.contact.fallbackPost') }}
    </p>

    <p class="pb-page-meta">{{ t('privacy.effectiveDate') }} {{ effectiveDate }}</p>
  </article>
</template>
