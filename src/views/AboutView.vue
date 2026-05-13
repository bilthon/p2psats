<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
