<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { midPrice, fmtFiat, fmtSatsCompact } from '@/lib/data'
import type { CrossResult, Currency, Order } from '@/lib/types'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
])

const props = defineProps<{
  orders: Order[]
  currency: Currency
  crosses: CrossResult
}>()

// ── Colors ────────────────────────────────────────────────────────────────────
const BID_COLOR = 'oklch(0.62 0.14 155)'
const ASK_COLOR = 'oklch(0.6 0.18 25)'

// Symmetric x-domain padding: 10% of the larger side's distance from center.
const X_DOMAIN_PAD = 0.1

// ── Level building ────────────────────────────────────────────────────────────
interface Level {
  price: number
  sats: number
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
    if (!map.has(k)) map.set(k, { price: k, sats: 0, cum: 0 })
    const entry = map.get(k)!
    entry.sats += o.amountSats
  })
  let arr = [...map.values()]
  // Sort bids descending (best first), asks ascending (best first)
  arr.sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price))
  let cum = 0
  arr = arr.map((l) => { cum += l.sats; return { ...l, cum } })
  return arr
}

// ── Computed option ───────────────────────────────────────────────────────────
const option = computed(() => {
  const allOrders = props.orders.filter((o) => o.currency === props.currency)

  if (!allOrders.length) return null

  const buyLevels = buildLevels(props.orders, 'buy', props.currency)
  const sellLevels = buildLevels(props.orders, 'sell', props.currency)

  const hasBids = buyLevels.length > 0
  const hasAsks = sellLevels.length > 0

  // ── Domain calculation: mirror around center with padding ──────────────────
  // Center the chart so the staircase(s) sit on a mirror of equal range.
  // `center` is the inner edge of available data: the mid for two-sided
  // books, the best bid (bids-only), or the best ask (asks-only).
  let center: number
  let askExtent = 0
  let bidExtent = 0

  if (hasBids && hasAsks) {
    const maxBid = Math.max(...buyLevels.map((l) => l.price))
    const minAsk = Math.min(...sellLevels.map((l) => l.price))
    center = (maxBid + minAsk) / 2
    askExtent = Math.max(...sellLevels.map((l) => l.price)) - center
    bidExtent = center - Math.min(...buyLevels.map((l) => l.price))
  } else if (hasBids) {
    const maxBid = Math.max(...buyLevels.map((l) => l.price))
    center = maxBid
    bidExtent = center - Math.min(...buyLevels.map((l) => l.price))
  } else {
    const minAsk = Math.min(...sellLevels.map((l) => l.price))
    center = minAsk
    askExtent = Math.max(...sellLevels.map((l) => l.price)) - center
  }

  // Floor at 0.5% of center so a single-level book doesn't collapse to width 0.
  const rawHalfSpan = Math.max(askExtent, bidExtent, center * 0.005)
  const halfSpan = rawHalfSpan * (1 + X_DOMAIN_PAD)
  const lo = center - halfSpan
  const hi = center + halfSpan

  // ── Series data ────────────────────────────────────────────────────────────
  // Bids: already sorted desc (best-bid first = highest price first).
  // For the chart we need ascending price order, so we reverse.
  // The cumulative depth at the worst bid (leftmost) = totalBidCum,
  // stepping down to A1 at the best bid (rightmost inner edge).
  // We prepend a baseline point at [bestBid, 0] so the line traces the
  // inner cliff down to 0 — this makes the inner vertical visible via lineStyle.
  const bidData: [number, number][] = []
  if (hasBids) {
    const ascending = [...buyLevels].reverse() // worst→best
    ascending.forEach((l) => bidData.push([l.price, l.cum]))
    // Inner cliff anchor: drop to 0 at bestBid price
    const bestBid = buyLevels[0].price
    bidData.push([bestBid, 0])
  }

  // Asks: already sorted asc (best-ask first = lowest price first).
  // We prepend a [bestAsk, 0] baseline anchor for the inner cliff.
  const askData: [number, number][] = []
  if (hasAsks) {
    const bestAsk = sellLevels[0].price
    askData.push([bestAsk, 0])
    sellLevels.forEach((l) => askData.push([l.price, l.cum]))
  }

  const maxCum = Math.max(
    hasBids ? buyLevels[buyLevels.length - 1].cum : 0,
    hasAsks ? sellLevels[sellLevels.length - 1].cum : 0,
    1,
  )

  // ── Gradients (horizontal edge fade) ─────────────────────────────────────
  // Bid: fade left edge (0→15%), full opacity right (15→100%).
  // Ask: fade right edge (85→100%), full opacity left (0→85%).
  // globalCoord: true means stops are relative to full chart width.
  const bidAreaGrad = {
    type: 'linear' as const,
    x: 0, y: 0, x2: 1, y2: 0,
    global: false,
    colorStops: [
      { offset: 0,    color: 'oklch(0.62 0.14 155 / 0)' },
      { offset: 0.15, color: 'oklch(0.62 0.14 155 / 0.25)' },
      { offset: 1,    color: 'oklch(0.62 0.14 155 / 0.25)' },
    ],
  }
  const bidLineGrad = {
    type: 'linear' as const,
    x: 0, y: 0, x2: 1, y2: 0,
    global: false,
    colorStops: [
      { offset: 0,    color: 'oklch(0.62 0.14 155 / 0)' },
      { offset: 0.15, color: 'oklch(0.62 0.14 155 / 1)' },
      { offset: 1,    color: 'oklch(0.62 0.14 155 / 1)' },
    ],
  }
  const askAreaGrad = {
    type: 'linear' as const,
    x: 0, y: 0, x2: 1, y2: 0,
    global: false,
    colorStops: [
      { offset: 0,    color: 'oklch(0.6 0.18 25 / 0.25)' },
      { offset: 0.85, color: 'oklch(0.6 0.18 25 / 0.25)' },
      { offset: 1,    color: 'oklch(0.6 0.18 25 / 0)' },
    ],
  }
  const askLineGrad = {
    type: 'linear' as const,
    x: 0, y: 0, x2: 1, y2: 0,
    global: false,
    colorStops: [
      { offset: 0,    color: 'oklch(0.6 0.18 25 / 1)' },
      { offset: 0.85, color: 'oklch(0.6 0.18 25 / 1)' },
      { offset: 1,    color: 'oklch(0.6 0.18 25 / 0)' },
    ],
  }

  // ── Mid price markLine ─────────────────────────────────────────────────────
  const mid = midPrice(props.orders, props.currency)
  const midMarkLine = mid != null
    ? {
        silent: true,
        symbol: 'none',
        lineStyle: {
          color: 'oklch(0.45 0.005 80)',
          type: 'dashed' as const,
          dashOffset: 0,
          width: 1,
        },
        label: {
          show: true,
          position: 'insideStartTop' as const,
          formatter: `mid ${Math.round(mid).toLocaleString()}`,
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 10,
          color: 'oklch(0.4 0.005 80)',
        },
        data: [{ xAxis: mid }],
      }
    : undefined

  // ── Crossed zone markArea ──────────────────────────────────────────────────
  const crossedMarkArea =
    props.crosses.pairs.length > 0 && props.crosses.maxBuy && props.crosses.minSell
      ? {
          silent: true,
          itemStyle: {
            color: 'oklch(0.7 0.06 60 / 0.1)',
            borderColor: 'oklch(0.7 0.06 60 / 0.4)',
            borderWidth: 0.5,
            borderType: [2, 2] as [number, number],
          },
          label: {
            show: true,
            position: 'insideTop' as const,
            formatter: 'crossed',
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 9,
            color: 'oklch(0.55 0.06 60)',
            fontWeight: 600,
            letterSpacing: '0.06em',
          },
          data: [
            [
              { xAxis: props.crosses.minSell.price },
              { xAxis: props.crosses.maxBuy.price },
            ],
          ],
        }
      : undefined

  // ── Graphic elements: BIDS/ASKS corner labels ─────────────────────────────
  // Lo/hi price labels are now provided by the xAxis tick labels.
  const graphicElements = [
    // BIDS label — top left
    {
      type: 'text' as const,
      left: 8,
      top: 4,
      style: {
        text: 'BIDS',
        font: '600 10px "Inter Tight", sans-serif',
        fill: BID_COLOR,
        letterSpacing: '0.06em',
      },
    },
    // ASKS label — top right
    {
      type: 'text' as const,
      right: 8,
      top: 4,
      style: {
        text: 'ASKS',
        font: '600 10px "Inter Tight", sans-serif',
        fill: 'oklch(0.55 0.18 25)',
        letterSpacing: '0.06em',
      },
    },
  ]

  // ── Series ─────────────────────────────────────────────────────────────────
  const bidSeries = {
    name: 'bids',
    type: 'line' as const,
    data: bidData,
    // Bid cumulative depth at price P = sum of bids with price >= P.
    // bidData is ordered ascending (worst→best); 'start' makes each plateau
    // take the higher-priced (right) point's y-value, which is the correct
    // cumulative for any price between two adjacent bid levels.
    step: 'start' as const,
    smooth: false,
    symbol: 'none',
    areaStyle: { color: bidAreaGrad },
    lineStyle: { color: bidLineGrad, width: 1.2 },
    // Disable hover emphasis: the default emphasis state recomputes the area
    // gradient and fails to interpolate the alpha-0 endpoint stops, making
    // the series visually disappear on mouseover. Tooltip stays via 'axis'
    // trigger (chart-level, not series-level).
    emphasis: { disabled: true },
    z: 2,
    markLine: midMarkLine,
    markArea: crossedMarkArea,
  }

  const askSeries = {
    name: 'asks',
    type: 'line' as const,
    data: askData,
    // Ask cumulative depth at price P = sum of asks with price <= P.
    // askData is ordered ascending (best→worst); 'end' makes each plateau
    // carry the earlier (left) point's y-value forward to the next x, which
    // is the correct cumulative for any price between two adjacent ask levels.
    step: 'end' as const,
    smooth: false,
    symbol: 'none',
    areaStyle: { color: askAreaGrad },
    lineStyle: { color: askLineGrad, width: 1.2 },
    emphasis: { disabled: true },
    z: 2,
  }

  const series = []
  if (hasBids) series.push(bidSeries)
  if (hasAsks) series.push(askSeries)

  return {
    animation: false,
    grid: {
      top: 24,               // room for BIDS/ASKS corner badges above the canvas
      right: 0,
      bottom: 34,            // room for xAxis tick labels
      left: 52,              // gutter for yAxis tick labels (e.g. "1.2M sats")
      containLabel: false,
    },
    xAxis: {
      type: 'value' as const,
      min: lo,
      max: hi,
      show: true,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: true,
        formatter: (v: number) => fmtFiat(v, props.currency, { bare: true }),
        fontFamily: 'Inter Tight, sans-serif',
        fontSize: 10,
        color: 'oklch(0.5 0.005 80)',
        fontVariantNumeric: 'tabular-nums',
        margin: 8,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: maxCum * 1.05,
      show: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        // Render outside the canvas in the reserved left gutter (grid.left).
        // Keep the middle three gridlines only — the bottom 0 row collides
        // with the xAxis row, and the topmost is too close to the chart edge.
        interval: (index: number) => index === 1 || index === 2 || index === 3,
        formatter: (v: number) => (v > 0 ? fmtSatsCompact(v) : ''),
        fontFamily: 'Inter Tight, sans-serif',
        fontSize: 10,
        color: 'oklch(0.5 0.005 80)',
        fontVariantNumeric: 'tabular-nums',
        margin: 8,
      },
      splitLine: {
        show: true,
        interval: (index: number) => index === 1 || index === 2 || index === 3,
        lineStyle: {
          color: 'oklch(0.92 0.005 80)',
          width: 1,
        },
      },
      splitNumber: 4,
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: {
        type: 'line' as const,
        lineStyle: {
          color: 'oklch(0.6 0.005 80)',
          width: 1,
          type: 'solid' as const,
        },
      },
      backgroundColor: 'oklch(1 0 0 / 0.96)',
      borderColor: 'oklch(0.92 0.005 80)',
      borderRadius: 8,
      extraCssText: 'box-shadow: 0 4px 12px rgba(20,18,10,0.06); font-family: "Inter Tight", sans-serif; font-size: 12px;',
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; data: [number, number]; axisValue: number }>
        if (!items || !items.length) return ''
        const price = items[0].axisValue
        // Find the closest series to show
        // If only one series, show it; if both, pick the one where price is in its range
        let chosen: (typeof items)[0] | null = null
        for (const item of items) {
          if (item.data && item.data[1] > 0) {
            chosen = item
            break
          }
        }
        if (!chosen) chosen = items[0]

        const isBid = chosen.seriesName === 'bids'
        const sideColor = isBid ? BID_COLOR : ASK_COLOR
        const sideLabel = isBid ? 'BID' : 'ASK'
        const cum = chosen.data ? chosen.data[1] : 0

        return [
          `<div style="color:${sideColor};font-weight:600;margin-bottom:3px">${sideLabel}</div>`,
          `<div>Price: <b>${fmtFiat(price, props.currency)}</b></div>`,
          `<div>Depth: <b>${fmtSatsCompact(cum)}</b></div>`,
        ].join('')
      },
    },
    graphic: graphicElements,
    series,
  }
})
</script>

<template>
  <v-chart
    v-if="option"
    class="pb-depth-canvas"
    :option="option"
    :autoresize="true"
  />
  <div
    v-else
    class="pb-depth-empty"
    style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-mute);font-size:13px"
  >
    No data
  </div>
</template>
