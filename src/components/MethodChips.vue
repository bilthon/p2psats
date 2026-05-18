<script setup lang="ts">
import { computed } from 'vue'
import type { PaymentMethod } from '@p2psats/shared'

const props = withDefaults(
  defineProps<{
    methods: PaymentMethod[]
    max?: number
  }>(),
  { max: 3 },
)

const visible = computed(() => props.methods.slice(0, props.max))
const extra = computed(() => props.methods.length - visible.value.length)
</script>

<template>
  <div
    style="
      display: flex;
      gap: 4px;
      flex-wrap: nowrap;
      overflow: hidden;
      min-width: 0;
      align-items: center;
    "
  >
    <span v-for="m in visible" :key="m.id" class="pb-method-chip" style="flex-shrink: 0">{{
      m.label
    }}</span>
    <span
      v-if="extra > 0"
      class="pb-method-chip pb-method-chip--more"
      style="flex-shrink: 0"
      >+{{ extra }}</span
    >
  </div>
</template>
