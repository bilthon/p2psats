// useTick.ts — 12-second data tick composable.
// Call once at the app root (App.vue) to start the interval.
// The tick advances appStore.tickSeed which triggers reactive rebuilds.

import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/appStore'

const TICK_INTERVAL_MS = 12_000

export function useTick() {
  const store = useAppStore()
  let intervalId: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    intervalId = setInterval(() => {
      store.advanceTick()
    }, TICK_INTERVAL_MS)
  })

  onUnmounted(() => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  })
}
