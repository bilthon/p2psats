<script setup lang="ts">
import { SOURCES } from '@/lib/data'

const props = defineProps<{ activeSources: string[] }>()
const emit = defineEmits<{ toggle: [id: string] }>()
</script>

<template>
  <div class="pb-relays">
    <button
      v-for="s in SOURCES"
      :key="s.id"
      :class="['pb-relay', props.activeSources.includes(s.id) ? 'pb-relay--on' : '']"
      :title="
        props.activeSources.includes(s.id)
          ? `Connected: ${s.relay}`
          : `Click to enable ${s.label}`
      "
      @click="emit('toggle', s.id)"
    >
      <span
        class="pb-relay-dot"
        :style="{ background: props.activeSources.includes(s.id) ? s.color : 'oklch(0.85 0.005 80)' }"
      >
        <span
          v-if="props.activeSources.includes(s.id)"
          class="pb-relay-pulse"
          :style="{ background: s.color }"
        />
      </span>
      <span class="pb-relay-label">{{ s.label }}</span>
    </button>
  </div>
</template>
