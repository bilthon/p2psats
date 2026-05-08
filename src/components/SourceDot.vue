<script setup lang="ts">
import { computed } from 'vue'
import { SOURCES } from '@/lib/data'

const props = defineProps<{ source: string }>()

const sourceInfo = computed(() => SOURCES.find((s) => s.id === props.source))
</script>

<template>
  <span
    style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: oklch(0.45 0.01 80);
      font-family: var(--font-mono);
    "
  >
    <span
      :style="{
        width: '6px',
        height: '6px',
        borderRadius: '999px',
        background: sourceInfo?.color ?? '#999',
      }"
    />
    {{ sourceInfo?.label ?? source }}
  </span>
</template>
