<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ completion: number; trades: number }>()

const barColor = computed(() => {
  if (props.completion >= 95) return 'oklch(0.62 0.14 155)'
  if (props.completion >= 90) return 'oklch(0.7 0.13 90)'
  return 'oklch(0.6 0.18 25)'
})

const barWidth = computed(() => `${(props.completion - 80) * 5}%`)
</script>

<template>
  <div style="display: flex; align-items: center; gap: 6px">
    <div
      style="
        width: 36px;
        height: 4px;
        border-radius: 999px;
        background: oklch(0.93 0.005 80);
        position: relative;
        overflow: hidden;
      "
    >
      <div
        :style="{
          position: 'absolute',
          inset: '0',
          width: barWidth,
          background: barColor,
          borderRadius: '999px',
        }"
      />
    </div>
    <span
      style="
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: oklch(0.5 0.005 80);
        font-variant-numeric: tabular-nums;
      "
      >{{ trades }}</span
    >
  </div>
</template>
