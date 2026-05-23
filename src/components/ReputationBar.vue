<script setup lang="ts">
import { computed } from 'vue'
import type { RepProps } from '@p2psats/shared'

const props = defineProps<RepProps>()

// Round to nearest half-star: 4.95 → 5, 4.4 → 4.5, 4.74 → 4.5, 4.8 → 5.
const halfStars = computed(() => {
  if (props.kind !== 'stars') return 0
  const clamped = Math.max(0, Math.min(5, props.rating))
  return Math.round(clamped * 2) / 2
})

// Width-clip percentage applied to the filled overlay for star index `i` (0..4).
// Each star gets either 0%, 50%, or 100% fill based on `halfStars`.
function fillFor(i: number): number {
  const remaining = halfStars.value - i
  if (remaining >= 1) return 100
  if (remaining >= 0.5) return 50
  return 0
}

// Five-pointed star path on a 9×9 viewBox.
const STAR_D =
  'M4.5 0.6 L5.7 3.2 L8.5 3.5 L6.4 5.5 L7 8.4 L4.5 7 L2 8.4 L2.6 5.5 L0.5 3.5 L3.3 3.2 Z'

const FILLED = 'oklch(0.72 0.12 72)'
const UNFILLED = 'oklch(0.72 0.12 72 / 0.15)'
</script>

<template>
  <span class="rep-cell" :title="tooltip">
    <span v-if="kind === 'stars'" class="rep-stars" aria-hidden="true">
      <svg
        v-for="i in 5"
        :key="i"
        width="9"
        height="9"
        viewBox="0 0 9 9"
        class="rep-star"
      >
        <!-- empty star background -->
        <path :d="STAR_D" :fill="UNFILLED" />
        <!-- fill overlay clipped to 0/50/100 % of the star width -->
        <path
          v-if="fillFor(i - 1) > 0"
          :d="STAR_D"
          :fill="FILLED"
          :clip-path="`inset(0 ${100 - fillFor(i - 1)}% 0 0)`"
        />
      </svg>
    </span>
    <span v-else class="rep-empty">—</span>
  </span>
</template>

<style scoped>
.rep-cell {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.rep-stars {
  display: inline-flex;
  gap: 2px;
}
.rep-star {
  display: block;
}
.rep-empty {
  font-family: var(--font-mono);
  font-size: 11px;
  color: oklch(0.65 0.005 80);
}
</style>
