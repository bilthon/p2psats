<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED, type AppLocale } from '@/i18n'

const { t } = useI18n()
const store = useAppStore()

const LANG_LABELS: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
}

const LANG_CODE: Record<AppLocale, string> = {
  en: 'EN',
  es: 'ES',
  'pt-BR': 'PT',
}

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

function select(l: AppLocale) {
  store.setLocale(l)
  open.value = false
}
</script>

<template>
  <div ref="wrapRef" class="pb-ccy-wrap">
    <button class="pb-ccy-trigger" @click="open = !open">
      <span class="pb-ccy-strong">{{ LANG_CODE[store.locale] }}</span>
      <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
        <path d="M0 0h10L5 6z" fill="currentColor" opacity=".5" />
      </svg>
    </button>
    <div v-if="open" class="pb-ccy-menu">
      <div class="pb-ccy-menu-hd">{{ t('languageSwitcher.heading') }}</div>
      <button
        v-for="l in SUPPORTED"
        :key="l"
        :class="['pb-ccy-item', l === store.locale ? 'pb-ccy-item--on' : '']"
        @click="select(l)"
      >
        <span class="pb-ccy-code">{{ LANG_CODE[l] }}</span>
        <span class="pb-ccy-name">{{ LANG_LABELS[l] }}</span>
        <span v-if="l === store.locale" class="pb-ccy-check">✓</span>
        <span v-else />
      </button>
    </div>
  </div>
</template>
