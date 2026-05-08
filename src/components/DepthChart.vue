<script setup lang="ts">
import { computed } from 'vue'
import { midPrice } from '@/lib/data'
import type { CrossResult, Currency, DepthStyle, Order } from '@/lib/types'

const props = defineProps<{
  orders: Order[]
  currency: Currency
  style: DepthStyle
  crosses: CrossResult
}>()

// ── shared helpers ────────────────────────────────────────────────────────────

interface Level {
  price: number
  sats: number
  count: number
  cum: number
}

function buildLevels(orders: Order[], side: 'buy' | 'sell', currency: Currency): Level[] {
  const filtered = orders.filter((o) => o.side === side && o.currency === currency)
  const decimals =
    currency === 'ARS' || currency === 'VES'
      ? -3
      : currency === 'BRL' || currency === 'MXN' || currency === 'RUB'
        ? -1
        : 0
  const round = (n: number) => {
    const f = Math.pow(10, decimals)
    return Math.round(n * f) / f
  }
  const map = new Map<number, Level>()
  filtered.forEach((o) => {
    const k = round(o.price)
    if (!map.has(k)) map.set(k, { price: k, sats: 0, count: 0, cum: 0 })
    const entry = map.get(k)!
    entry.sats += o.amountSats
    entry.count += 1
  })
  let arr = [...map.values()]
  arr.sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price))
  let cum = 0
  arr = arr.map((l) => { cum += l.sats; return { ...l, cum } })
  return arr
}

// ── mid price ─────────────────────────────────────────────────────────────────
const mid = computed(() => midPrice(props.orders, props.currency))

const W = 720, H = 240

// ── 1. Stacked depth ──────────────────────────────────────────────────────────
const stackedData = computed(() => {
  // Horizontal padding is 0 so polygons span the full viewBox width, matching
  // the grid lines. The edge-fade masks then soften the outermost edges.
  const SP = { l: 0, r: 0, t: 16, b: 28 }
  const all = props.orders.filter((o) => o.currency === props.currency)
  if (!all.length) return null

  const buys = props.orders
    .filter((o) => o.side === 'buy' && o.currency === props.currency)
    .sort((a, b) => b.price - a.price)
  const sells = props.orders
    .filter((o) => o.side === 'sell' && o.currency === props.currency)
    .sort((a, b) => a.price - b.price)

  // Price domain. When both sides exist, span the actual data extent. When
  // only one side exists, extend the missing side so the populated side
  // occupies just its own half of the chart.
  let lo: number, hi: number
  if (buys.length > 0 && sells.length > 0) {
    const prices = all.map((o) => o.price)
    lo = Math.min(...prices)
    hi = Math.max(...prices)
  } else if (buys.length > 0) {
    const buyPrices = buys.map((o) => o.price)
    const minBid = Math.min(...buyPrices)
    const maxBid = Math.max(...buyPrices)
    const span = Math.max(maxBid - minBid, maxBid * 0.005)
    lo = minBid
    hi = maxBid + span
  } else {
    const sellPrices = sells.map((o) => o.price)
    const minAsk = Math.min(...sellPrices)
    const maxAsk = Math.max(...sellPrices)
    const span = Math.max(maxAsk - minAsk, minAsk * 0.005)
    lo = minAsk - span
    hi = maxAsk
  }

  const stepSeries = (list: Order[]) => {
    let cum = 0
    const pts = list.map((o) => { cum += o.amountSats; return { p: o.price, cum } })
    return { pts, max: cum }
  }
  const b = stepSeries(buys)
  const s = stepSeries(sells)
  const maxCum = Math.max(b.max, s.max, 1)

  const x = (p: number) => SP.l + ((p - lo) / (hi - lo)) * (W - SP.l - SP.r)
  const y = (v: number) => SP.t + (1 - v / maxCum) * (H - SP.t - SP.b)
  const baseY = H - SP.b

  // Filled polygon: closed path with baseline + outer cliffs. Used with fill only.
  const stepPath = (pts: { p: number; cum: number }[]) => {
    if (!pts.length) return ''
    const sorted = [...pts].sort((a, bv) => a.p - bv.p)
    let d = `M ${x(sorted[0].p)} ${baseY}`
    let prevY = baseY
    sorted.forEach((pt) => {
      const px = x(pt.p), py = y(pt.cum)
      d += ` L ${px} ${prevY} L ${px} ${py}`
      prevY = py
    })
    d += ` L ${x(sorted[sorted.length - 1].p)} ${baseY} Z`
    return d
  }

  // Top step contour: open polyline tracing the cumulative-volume curve,
  // including the inner cliff (toward the spread) but excluding the outer
  // cliff (toward the chart edge) and the bottom baseline.
  const topStepPath = (pts: { p: number; cum: number }[], side: 'buy' | 'sell') => {
    if (!pts.length) return ''
    const sorted = [...pts].sort((a, bv) => a.p - bv.p)
    let d: string
    let prevY: number
    if (side === 'buy') {
      // Bids: top-left → step down through data → drop to baseline at best-bid.
      d = `M ${x(sorted[0].p)} ${y(sorted[0].cum)}`
      prevY = y(sorted[0].cum)
      for (let i = 1; i < sorted.length; i++) {
        const px = x(sorted[i].p), py = y(sorted[i].cum)
        d += ` L ${px} ${prevY} L ${px} ${py}`
        prevY = py
      }
      d += ` L ${x(sorted[sorted.length - 1].p)} ${baseY}`
    } else {
      // Asks: rise from baseline at best-ask → step up through data → top-right.
      d = `M ${x(sorted[0].p)} ${baseY} L ${x(sorted[0].p)} ${y(sorted[0].cum)}`
      prevY = y(sorted[0].cum)
      for (let i = 1; i < sorted.length; i++) {
        const px = x(sorted[i].p), py = y(sorted[i].cum)
        d += ` L ${px} ${prevY} L ${px} ${py}`
        prevY = py
      }
    }
    return d
  }

  const crossZone =
    props.crosses.maxBuy && props.crosses.minSell && props.crosses.pairs.length > 0
      ? {
          x1: x(props.crosses.minSell.price),
          x2: x(props.crosses.maxBuy.price),
          midX:
            (x(props.crosses.minSell.price) + x(props.crosses.maxBuy.price)) / 2,
        }
      : null

  return {
    bidPath: stepPath(b.pts),
    askPath: stepPath(s.pts),
    bidTopPath: topStepPath(b.pts, 'buy'),
    askTopPath: topStepPath(s.pts, 'sell'),
    lo, hi, mid: mid.value,
    crossZone, SP,
  }
})

// ── 2. Heatmap ────────────────────────────────────────────────────────────────
const heatmapData = computed(() => {
  const HP = { l: 8, r: 8, t: 30, b: 28 }
  const cellH = (H - HP.t - HP.b) / 2
  const buckets = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]
  const bw = (W - HP.l - HP.r) / (buckets.length - 1)

  const grid: { buy: Map<number, number>; sell: Map<number, number> } = {
    buy: new Map(),
    sell: new Map(),
  }
  buckets.forEach((b) => { grid.buy.set(b, 0); grid.sell.set(b, 0) })

  props.orders
    .filter((o) => o.currency === props.currency)
    .forEach((o) => {
      const b = Math.max(buckets[0], Math.min(buckets[buckets.length - 1], Math.round(o.premium)))
      grid[o.side].set(b, (grid[o.side].get(b) ?? 0) + o.amountSats)
    })

  const maxV = Math.max(...[...grid.buy.values()], ...[...grid.sell.values()], 1)

  const cells: Array<{
    x: number; y: number; w: number; h: number
    opacity: number; side: 'buy' | 'sell'
    showLabel: boolean; labelText: string
  }> = []

  buckets.forEach((b, bi) => {
    if (bi === 0) return
    const cx = HP.l + bi * bw - bw / 2
    for (const side of ['buy', 'sell'] as const) {
      const v = (grid[side].get(b) ?? 0) / maxV
      const rowY = side === 'sell' ? HP.t : HP.t + cellH
      const opacity = 0.04 + v * 0.95
      const showLabel = v > 0.15
      cells.push({
        x: cx, y: rowY, w: bw, h: cellH - 2,
        opacity, side, showLabel,
        labelText: ((grid[side].get(b) ?? 0) / 1e8).toFixed(2),
      })
    }
  })

  const x0 = HP.l + buckets.indexOf(0) * bw

  return { cells, buckets, bw, HP, cellH, x0 }
})
</script>

<template>
  <!-- 1. Stacked -->
  <svg
    v-if="style === 'stacked' && stackedData"
    :viewBox="`0 0 ${W} ${H}`"
    width="100%"
    height="100%"
    preserveAspectRatio="none"
    style="display: block; font-variant-numeric: tabular-nums"
  >
    <defs>
      <linearGradient id="bidGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="oklch(0.62 0.14 155)" stop-opacity=".4" />
        <stop offset="100%" stop-color="oklch(0.62 0.14 155)" stop-opacity=".05" />
      </linearGradient>
      <linearGradient id="askGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="oklch(0.6 0.18 25)" stop-opacity=".4" />
        <stop offset="100%" stop-color="oklch(0.6 0.18 25)" stop-opacity=".05" />
      </linearGradient>
      <linearGradient id="bidEdgeFadeGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" :x2="W" y2="0">
        <stop offset="0" stop-color="black" />
        <stop offset="0.15" stop-color="white" />
        <stop offset="1" stop-color="white" />
      </linearGradient>
      <linearGradient id="askEdgeFadeGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" :x2="W" y2="0">
        <stop offset="0" stop-color="white" />
        <stop offset="0.85" stop-color="white" />
        <stop offset="1" stop-color="black" />
      </linearGradient>
      <mask id="bidEdgeFade" maskUnits="userSpaceOnUse" x="0" y="0" :width="W" :height="H">
        <rect x="0" y="0" :width="W" :height="H" fill="url(#bidEdgeFadeGrad)" />
      </mask>
      <mask id="askEdgeFade" maskUnits="userSpaceOnUse" x="0" y="0" :width="W" :height="H">
        <rect x="0" y="0" :width="W" :height="H" fill="url(#askEdgeFadeGrad)" />
      </mask>
    </defs>
    <line
      v-for="f in [0.25, 0.5, 0.75]"
      :key="f"
      x1="0" :x2="W"
      :y1="stackedData.SP.t + f * (H - stackedData.SP.t - stackedData.SP.b)"
      :y2="stackedData.SP.t + f * (H - stackedData.SP.t - stackedData.SP.b)"
      stroke="oklch(0.92 0.005 80)" stroke-width="1"
    />
    <path :d="stackedData.bidPath" fill="url(#bidGrad2)" stroke="none" mask="url(#bidEdgeFade)" />
    <path :d="stackedData.askPath" fill="url(#askGrad2)" stroke="none" mask="url(#askEdgeFade)" />
    <path :d="stackedData.bidTopPath" fill="none" stroke="oklch(0.62 0.14 155)" stroke-width="1.2" stroke-linejoin="miter" mask="url(#bidEdgeFade)" />
    <path :d="stackedData.askTopPath" fill="none" stroke="oklch(0.6 0.18 25)" stroke-width="1.2" stroke-linejoin="miter" mask="url(#askEdgeFade)" />

    <!-- Crossover zone -->
    <g v-if="stackedData.crossZone">
      <rect
        :x="stackedData.crossZone.x1"
        :y="stackedData.SP.t"
        :width="Math.max(2, stackedData.crossZone.x2 - stackedData.crossZone.x1)"
        :height="H - stackedData.SP.t - stackedData.SP.b"
        fill="oklch(0.7 0.06 60 / 0.1)"
        stroke="oklch(0.7 0.06 60 / 0.4)" stroke-width="0.5" stroke-dasharray="2 2"
      />
      <text
        :x="stackedData.crossZone.midX"
        :y="stackedData.SP.t + 12"
        text-anchor="middle" font-size="9"
        fill="oklch(0.55 0.06 60)" font-family="Inter Tight, sans-serif"
        font-weight="600" letter-spacing=".06em"
      >crossed</text>
    </g>

    <g v-if="stackedData.mid">
      <line
        :x1="stackedData.SP.l + ((stackedData.mid - stackedData.lo) / (stackedData.hi - stackedData.lo)) * (W - stackedData.SP.l - stackedData.SP.r)"
        :x2="stackedData.SP.l + ((stackedData.mid - stackedData.lo) / (stackedData.hi - stackedData.lo)) * (W - stackedData.SP.l - stackedData.SP.r)"
        :y1="stackedData.SP.t" :y2="H - stackedData.SP.b"
        stroke="oklch(0.45 0.005 80)" stroke-width="1" stroke-dasharray="3 3"
      />
      <text
        :x="stackedData.SP.l + ((stackedData.mid - stackedData.lo) / (stackedData.hi - stackedData.lo)) * (W - stackedData.SP.l - stackedData.SP.r)"
        :y="stackedData.SP.t - 4"
        text-anchor="middle" font-size="10" fill="oklch(0.4 0.005 80)"
        font-family="Inter Tight, sans-serif"
      >mid {{ Math.round(stackedData.mid).toLocaleString() }}</text>
    </g>

    <text x="6" :y="H - 8" font-size="11" fill="oklch(0.5 0.005 80)"
          font-family="Inter Tight, sans-serif">{{ Math.round(stackedData.lo).toLocaleString() }}</text>
    <text :x="W - 6" :y="H - 8" text-anchor="end" font-size="11"
          fill="oklch(0.5 0.005 80)" font-family="Inter, sans-serif">{{ Math.round(stackedData.hi).toLocaleString() }}</text>
  </svg>

  <!-- 2. Heatmap -->
  <svg
    v-else-if="style === 'heatmap'"
    :viewBox="`0 0 ${W} ${H}`"
    width="100%"
    height="100%"
    preserveAspectRatio="none"
    style="display: block; font-variant-numeric: tabular-nums"
  >
    <text :x="heatmapData.HP.l" y="20" font-size="10" fill="oklch(0.55 0.18 25)"
          font-family="Inter Tight, sans-serif" font-weight="600" letter-spacing=".06em">ASKS  ↑</text>
    <text :x="heatmapData.HP.l" :y="H - 8" font-size="10" fill="oklch(0.6 0.14 155)"
          font-family="Inter Tight, sans-serif" font-weight="600" letter-spacing=".06em">BIDS  ↓</text>

    <g v-for="(cell, ci) in heatmapData.cells" :key="ci">
      <rect
        :x="cell.x" :y="cell.y" :width="cell.w" :height="cell.h"
        :fill="`oklch(${cell.side === 'buy' ? '0.62 0.14 155' : '0.6 0.18 25'} / ${cell.opacity})`"
        rx="2"
      />
      <text
        v-if="cell.showLabel"
        :x="cell.x + cell.w / 2"
        :y="cell.y + cell.h / 2 + 3"
        text-anchor="middle" font-size="10"
        fill="white" font-family="Inter Tight, sans-serif" font-weight="600"
      >{{ cell.labelText }}</text>
    </g>

    <text
      v-for="(b, i) in heatmapData.buckets"
      v-show="i % 2 === 0"
      :key="b"
      :x="heatmapData.HP.l + i * heatmapData.bw"
      :y="H - 12"
      text-anchor="middle" font-size="10"
      :fill="b === 0 ? 'oklch(0.35 0.005 80)' : 'oklch(0.55 0.005 80)'"
      font-family="Inter Tight, sans-serif"
      :font-weight="b === 0 ? '600' : '400'"
    >{{ b > 0 ? '+' : '' }}{{ b }}%</text>

    <line
      :x1="heatmapData.x0" :x2="heatmapData.x0"
      :y1="heatmapData.HP.t - 4" :y2="H - heatmapData.HP.b"
      stroke="oklch(0.45 0.005 80)" stroke-width="1" stroke-dasharray="3 3"
    />
  </svg>

  <!-- Fallback empty -->
  <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-mute);font-size:13px">
    No data
  </div>
</template>
