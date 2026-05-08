// Pinia store: live BTC reference rates from yadio.io (same source lnp2pbot
// uses, so 0% premium orders on lnp2pbot match this rate by construction).
//
// Browser-safe: plain `fetch`, no Node-only APIs. No new npm deps.
//
// The store falls back to the static REF_RATES baked into data.ts until the
// first successful fetch resolves, so the UI always has a number to show.

import { defineStore } from 'pinia'
import { ref } from 'vue'

const YADIO_URL = 'https://api.yadio.io/exrates/BTC'

// 5 minutes — yadio caches their feed and there's no value to polling faster.
const REFRESH_MS = 5 * 60_000

interface YadioResponse {
  BTC: Record<string, number>
  base?: string
  timestamp?: number
}

export const useBtcRatesStore = defineStore('btcRates', () => {
  // Map of fiat code → price of 1 BTC in that fiat. Empty until first fetch.
  const rates = ref<Record<string, number>>({})
  const lastFetchedAt = ref<number>(0)
  const lastError = ref<string | null>(null)

  let timer: ReturnType<typeof setInterval> | null = null
  let inflight: Promise<void> | null = null

  async function fetchRates(): Promise<void> {
    // Coalesce concurrent calls so rapid currency switches or remounts don't
    // trigger multiple in-flight requests.
    if (inflight) return inflight

    inflight = (async () => {
      try {
        const res = await fetch(YADIO_URL, { method: 'GET' })
        if (!res.ok) {
          throw new Error(`yadio HTTP ${res.status}`)
        }
        const json = (await res.json()) as YadioResponse
        if (!json?.BTC || typeof json.BTC !== 'object') {
          throw new Error('yadio response missing BTC map')
        }
        rates.value = json.BTC
        lastFetchedAt.value = Date.now()
        lastError.value = null
      } catch (err) {
        lastError.value = err instanceof Error ? err.message : String(err)
        if (import.meta.env.DEV) {
          console.warn('[btcRates] fetch failed:', lastError.value)
        }
      } finally {
        inflight = null
      }
    })()

    return inflight
  }

  function start(): void {
    // idempotent — safe to call from multiple onMounted hooks
    if (timer !== null) return
    void fetchRates()
    timer = setInterval(() => {
      void fetchRates()
    }, REFRESH_MS)
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  return {
    rates,
    lastFetchedAt,
    lastError,
    fetchRates,
    start,
    stop,
  }
})
