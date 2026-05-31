<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { FIATS } from '@/lib/currency'
import type { FiatEntry, FiatCode } from '@/lib/currency'

const { t } = useI18n()

const props = defineProps<{ modelValue: FiatCode }>()
const emit = defineEmits<{ 'update:modelValue': [c: FiatCode] }>()

const open = ref(false)
const query = ref('')
const searchRef = ref<HTMLInputElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)

const PINNED_CODES = ['USD', 'EUR', 'BRL', 'ARS', 'MXN', 'VES', 'ZAR', 'RUB', 'PEN', 'CLP', 'COP', 'PYG']
const PINNED_SET = new Set(PINNED_CODES)
const PINNED: FiatEntry[] = PINNED_CODES.flatMap((c) => {
  const e = FIATS.find((f) => f.code === c)
  return e ? [e] : []
})

const filtered = computed((): FiatEntry[] => {
  const q = query.value.trim()
  if (q) {
    const upper = q.toUpperCase()
    const lower = q.toLowerCase()
    return FIATS.filter(
      (f) => f.code.includes(upper) || f.name.toLowerCase().includes(lower),
    )
  }
  // No query: pinned set first (plus selected if not already pinned), then next 50 alpha
  const extra = PINNED_SET.has(props.modelValue) ? [] : (FIATS.find((f) => f.code === props.modelValue) ? [FIATS.find((f) => f.code === props.modelValue)!] : [])
  const pinned = [...PINNED, ...extra]
  const pinnedSetFull = new Set(pinned.map((f) => f.code))
  const rest = FIATS.filter((f) => !pinnedSetFull.has(f.code)).slice(0, 50)
  return [...pinned, ...rest]
})

function onDocClick(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

watch(open, (v) => {
  if (v) {
    query.value = ''
    nextTick(() => searchRef.value?.focus())
  }
})

function select(c: FiatCode) {
  emit('update:modelValue', c)
  open.value = false
}
</script>

<template>
  <div ref="wrapRef" class="pb-ccy-wrap">
    <button class="pb-ccy-trigger" @click="open = !open">
      <span class="pb-ccy-pair"
        >BTC / <span class="pb-ccy-strong">{{ modelValue }}</span></span
      >
      <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
        <path d="M0 0h10L5 6z" fill="currentColor" opacity=".5" />
      </svg>
    </button>
    <div v-if="open" class="pb-ccy-menu">
      <div class="pb-ccy-menu-hd">{{ t('currencySwitcher.heading') }}</div>
      <input
        ref="searchRef"
        v-model="query"
        type="search"
        class="pb-ccy-search"
        :placeholder="t('currencySwitcher.search')"
        autocomplete="off"
      />
      <div class="pb-ccy-items">
        <button
          v-for="f in filtered"
          :key="f.code"
          :class="['pb-ccy-item', f.code === modelValue ? 'pb-ccy-item--on' : '']"
          @click="select(f.code)"
        >
          <span class="pb-ccy-code">{{ f.code }}</span>
          <span class="pb-ccy-name">{{ f.name }}</span>
          <span v-if="f.code === modelValue" class="pb-ccy-check">✓</span>
          <span v-else />
        </button>
      </div>
      <div class="pb-ccy-menu-ft"><span class="pb-ccy-pin">📌</span> {{ t('currencySwitcher.saved') }}</div>
    </div>
  </div>
</template>
