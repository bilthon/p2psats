<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { CCY_LIST, CCY_LABEL } from '@/lib/data'
import type { Currency } from '@/lib/types'

const props = defineProps<{ modelValue: Currency }>()
const emit = defineEmits<{ 'update:modelValue': [c: Currency] }>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

function select(c: Currency) {
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
      <div class="pb-ccy-menu-hd">Quote currency</div>
      <button
        v-for="c in CCY_LIST"
        :key="c"
        :class="['pb-ccy-item', c === modelValue ? 'pb-ccy-item--on' : '']"
        @click="select(c)"
      >
        <span class="pb-ccy-code">{{ c }}</span>
        <span class="pb-ccy-name">{{ CCY_LABEL[c] }}</span>
        <span v-if="c === modelValue" class="pb-ccy-check">✓</span>
        <span v-else />
      </button>
      <div class="pb-ccy-menu-ft"><span class="pb-ccy-pin">📌</span> Saved to this browser</div>
    </div>
  </div>
</template>
