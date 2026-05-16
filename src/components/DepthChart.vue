<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
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
import { fmtFiat, fmtSatsCompact, getUserLocale } from '@/lib/data'
import { useIntlLocale } from '@/i18n/composables'
import type { CrossResult, Currency, Order } from '@/lib/types'
import { useBtcRatesStore } from '@/services/btcRates'
import { useAppStore } from '@/stores/appStore'
import SatSymbol from './SatSymbol.vue'

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

const btcRates = useBtcRatesStore()
const appStore = useAppStore()
const intl = useIntlLocale()

// ── Custom cursor tracking (replaces ECharts tooltip for accuracy) ───────────
// ECharts' built-in tooltip throttles renders at the data-point level, so the
// price field appeared to step across plateaus. We listen to mousemove on the
// chart wrapper, convert the pixel x to an axis value via convertFromPixel,
// and render a Vue overlay so price updates per-pixel.
const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const cursorPrice = ref<number | null>(null)
const cursorPx = ref<{ x: number; y: number } | null>(null)

interface ChartLike {
  // When the finder targets a single axis (xAxisIndex only), ECharts' grid
  // coordinate system resolves to axis.coordToData(axis.toLocalCoord(value)).
  // toLocalCoord expects a scalar pixel coordinate, NOT an [x, y] array.
  // Passing an array produces NaN and the method returns null.
  convertFromPixel(finder: { xAxisIndex: number }, value: number): number | null
}

function onChartMove(e: MouseEvent) {
  const chart = chartRef.value as unknown as ChartLike | null
  if (!chart) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  // Pass only the x pixel value — ECharts' single-axis path in Grid.convertFromPixel
  // calls axis.toLocalCoord(value) which treats value as a scalar.
  const axisVal = chart.convertFromPixel({ xAxisIndex: 0 }, x)
  if (typeof axisVal === 'number' && Number.isFinite(axisVal)) {
    cursorPrice.value = axisVal
    cursorPx.value = { x, y }
  } else {
    cursorPrice.value = null
    cursorPx.value = null
  }
}

function onChartLeave() {
  cursorPrice.value = null
  cursorPx.value = null
}

// Reactive tooltip styles that update when the theme changes.
const tipStyle = computed<CSSProperties>(() => {
  const isDark = appStore.theme === 'dark'
  return {
    position: 'absolute',
    pointerEvents: 'none',
    background: isDark ? 'oklch(0.22 0.005 80 / 0.96)' : 'oklch(1 0 0 / 0.96)',
    border: `1px solid ${isDark ? 'oklch(0.35 0.005 80)' : 'oklch(0.92 0.005 80)'}`,
    borderRadius: '8px',
    padding: '8px 10px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.45)' : '0 4px 12px rgba(20,18,10,0.06)',
    fontFamily: "'Inter Tight', sans-serif",
    fontSize: '12px',
    whiteSpace: 'nowrap',
    zIndex: 5,
  }
})

// Cumulative depth at a given price. For bids: sum of bids with price >= P.
// For asks: sum of asks with price <= P. O(n) per call which is fine at our
// orderbook scale.
function depthAt(price: number, side: 'buy' | 'sell'): number {
  let sats = 0
  for (const o of props.orders) {
    if (o.currency !== props.currency || o.side !== side) continue
    if (side === 'buy' && o.price >= price) sats += o.amountSats
    if (side === 'sell' && o.price <= price) sats += o.amountSats
  }
  return sats
}

// Side and depth at the cursor's current price. `side` is null when the
// cursor is in the spread region (no depth on either side at that price).
type CursorInfo = { price: number; side: 'buy' | 'sell' | null; depth: number }

const cursorInfo = computed<CursorInfo | null>(() => {
  const price = cursorPrice.value
  if (price === null) return null
  const bidDepth = depthAt(price, 'buy')
  if (bidDepth > 0) return { price, side: 'buy', depth: bidDepth }
  const askDepth = depthAt(price, 'sell')
  if (askDepth > 0) return { price, side: 'sell', depth: askDepth }
  return { price, side: null, depth: 0 }
})

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
  // High-nominal-per-BTC currencies (millions/billions per BTC) bucket to the
  // nearest 1000; mid-nominal ones to the nearest 10; the rest to the nearest 1.
  const decimals =
    currency === 'ARS' || currency === 'VES' || currency === 'PYG'
      || currency === 'COP' || currency === 'CLP'
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
  void intl.value
  // Reference theme so this computed reacts when the theme toggles.
  const isDark = appStore.theme === 'dark'
  const themeColors = {
    axisLabel:   isDark ? 'oklch(0.55 0.005 80)' : 'oklch(0.5 0.005 80)',
    splitLine:   isDark ? 'oklch(0.32 0.005 80)' : 'oklch(0.92 0.005 80)',
    cursorLine:  isDark ? 'oklch(0.55 0.005 80)' : 'oklch(0.6 0.005 80)',
    midLine:     isDark ? 'oklch(0.65 0.005 80)' : 'oklch(0.45 0.005 80)',
    midLabel:    isDark ? 'oklch(0.70 0.005 80)' : 'oklch(0.4 0.005 80)',
    tipBg:       isDark ? 'oklch(0.22 0.005 80 / 0.96)' : 'oklch(1 0 0 / 0.96)',
    tipBorder:   isDark ? 'oklch(0.35 0.005 80)' : 'oklch(0.92 0.005 80)',
    tipShadow:   isDark ? '0 4px 12px rgba(0,0,0,0.45)' : '0 4px 12px rgba(20,18,10,0.06)',
  }
  const allOrders = props.orders.filter((o) => o.currency === props.currency)

  if (!allOrders.length) return null

  const buyLevels = buildLevels(props.orders, 'buy', props.currency)
  const sellLevels = buildLevels(props.orders, 'sell', props.currency)

  const hasBids = buyLevels.length > 0
  const hasAsks = sellLevels.length > 0

  // ── Domain calculation: yadio-centered with padding ────────────────────────
  // When yadio has resolved a rate for this currency, center the chart on it
  // (P2P platforms price their premiums against yadio, so it's the natural
  // reference). Otherwise fall back to the legacy mirror-around-mid algorithm
  // so the chart still works during the startup window or when yadio doesn't
  // carry the currency.
  const yadioRate = btcRates.rates[props.currency]
  const yadioUsable =
    typeof yadioRate === 'number' && Number.isFinite(yadioRate) && yadioRate > 0

  let center: number
  let rawHalfSpan: number

  if (yadioUsable) {
    // Yadio path — single expression covers two-sided / one-sided / inverted
    // cases. Drawing from buyLevels/sellLevels (not raw orders) keeps `lo` and
    // `hi` aligned with the rounded staircase anchors for ARS/VES/etc.
    center = yadioRate
    const allLevelPrices = [
      ...buyLevels.map((l) => l.price),
      ...sellLevels.map((l) => l.price),
    ]
    const maxDistance = Math.max(...allLevelPrices.map((p) => Math.abs(p - center)))
    rawHalfSpan = Math.max(maxDistance, center * 0.005)
  } else {
    // Fallback path — the legacy mirror-around-mid algorithm.
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
    rawHalfSpan = Math.max(askExtent, bidExtent, center * 0.005)
  }

  const halfSpan = rawHalfSpan * (1 + X_DOMAIN_PAD)
  const lo = center - halfSpan
  const hi = center + halfSpan

  // ── Series data ────────────────────────────────────────────────────────────
  // Bids: already sorted desc (best-bid first = highest price first).
  // For the chart we need ascending price order, so we reverse.
  // The cumulative depth at the worst bid (leftmost) = totalBidCum,
  // stepping down to the best bid (rightmost inner edge).
  // We prepend [lo, totalBidCum] so the staircase reaches the chart's left
  // edge at full depth, and append [bestBid, 0] so the line traces the inner
  // cliff down to 0.
  const bidData: [number, number][] = []
  if (hasBids) {
    const ascending = [...buyLevels].reverse() // worst→best
    const totalBidCum = ascending[0].cum // cum at lowest bid = total bid volume
    bidData.push([lo, totalBidCum])
    ascending.forEach((l) => bidData.push([l.price, l.cum]))
    const bestBid = buyLevels[0].price
    bidData.push([bestBid, 0])
  }

  // Asks: already sorted asc (best-ask first = lowest price first).
  // We prepend [bestAsk, 0] for the inner cliff, and append [hi, totalAskCum]
  // so the staircase reaches the chart's right edge at full depth.
  const askData: [number, number][] = []
  if (hasAsks) {
    const bestAsk = sellLevels[0].price
    askData.push([bestAsk, 0])
    sellLevels.forEach((l) => askData.push([l.price, l.cum]))
    const totalAskCum = sellLevels[sellLevels.length - 1].cum
    askData.push([hi, totalAskCum])
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

  // ── Yadio reference markLine ───────────────────────────────────────────────
  // Yadio is the only reference line shown — the mid-price line was removed
  // because it added clutter without new information now that yadio sits at
  // the chart's center.
  // `yadioRate` is already declared above in the domain block; reuse it here.
  const YADIO_COLOR = 'oklch(0.7 0.17 55)' // warm orange

  type MarkLineEntry = {
    xAxis: number
    label: {
      formatter: string
      position: 'end'
      rotate: 0
      distance: number
      color: string
    }
    lineStyle: { color: string }
  }
  const markLineData: MarkLineEntry[] = []
  if (typeof yadioRate === 'number' && Number.isFinite(yadioRate)) {
    markLineData.push({
      xAxis: yadioRate,
      label: {
        formatter: `yadio · ${Math.round(yadioRate).toLocaleString(getUserLocale())}`,
        // 'end' = top of the vertical line (above the chart's plot area).
        // rotate: 0 forces horizontal text instead of the default 90° perp.
        position: 'end',
        rotate: 0,
        distance: 4,
        color: YADIO_COLOR,
      },
      lineStyle: { color: YADIO_COLOR },
    })
  }
  const midMarkLine = markLineData.length
    ? {
        silent: true,
        symbol: 'none',
        // Default style applies to entries that don't override lineStyle.
        lineStyle: {
          color: themeColors.midLine,
          type: 'dashed' as const,
          dashOffset: 0,
          width: 1,
        },
        label: {
          show: true,
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 10,
          color: themeColors.midLabel,
        },
        data: markLineData,
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
    // Mid + yadio markLines are owned by bidSeries when bids exist; if the
    // book is asks-only, attach them here so the lines still render.
    markLine: !hasBids ? midMarkLine : undefined,
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
        color: themeColors.axisLabel,
        fontVariantNumeric: 'tabular-nums',
        margin: 8,
        hideOverlap: true,
      },
      // Standalone axis pointer for the vertical line. The tooltip popup is
      // a Vue overlay (see template), so triggerTooltip stays off.
      axisPointer: {
        show: true,
        snap: false,
        type: 'line' as const,
        triggerTooltip: false,
        lineStyle: {
          color: themeColors.cursorLine,
          width: 1,
          type: 'solid' as const,
        },
        label: { show: false },
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
        // Rich-text segments so the trailing sat symbol renders in the
        // Satoshi Symbol font even though ECharts draws axis labels via
        // canvas (no DOM, so no <SatSymbol /> here).
        formatter: (v: number) => (v > 0 ? `${fmtSatsCompact(v, { bare: true })} {sat|!}` : ''),
        fontFamily: 'Inter Tight, sans-serif',
        fontSize: 10,
        color: themeColors.axisLabel,
        fontVariantNumeric: 'tabular-nums',
        margin: 8,
        rich: {
          sat: {
            fontFamily: 'Satoshi Symbol, sans-serif',
            fontSize: 10,
            color: themeColors.axisLabel,
          },
        },
      },
      splitLine: {
        show: true,
        interval: (index: number) => index === 1 || index === 2 || index === 3,
        lineStyle: {
          color: themeColors.splitLine,
          width: 1,
        },
      },
      splitNumber: 4,
    },
    // Built-in tooltip disabled — see the Vue overlay in the template that
    // tracks cursor moves with per-pixel resolution.
    tooltip: { show: false },
    graphic: graphicElements,
    series,
  }
})
</script>

<template>
  <div
    class="pb-depth-host"
    style="position:relative;width:100%;height:100%"
    @mousemove="onChartMove"
    @mouseleave="onChartLeave"
  >
    <v-chart
      v-if="option"
      ref="chartRef"
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
    <div
      v-if="cursorInfo && cursorPx"
      class="pb-depth-tip"
      :style="{
        ...tipStyle,
        left: cursorPx.x + 14 + 'px',
        top: cursorPx.y + 14 + 'px',
      }"
    >
      <div
        v-if="cursorInfo.side"
        :style="{
          color: cursorInfo.side === 'buy' ? BID_COLOR : ASK_COLOR,
          fontWeight: 600,
          marginBottom: '3px',
        }"
      >{{ cursorInfo.side === 'buy' ? 'BID' : 'ASK' }}</div>
      <div>Price: <b>{{ fmtFiat(cursorInfo.price, currency) }}</b></div>
      <div v-if="cursorInfo.side">
        Depth: <b>{{ fmtSatsCompact(cursorInfo.depth, { bare: true }) }} <SatSymbol /></b>
      </div>
    </div>
  </div>
</template>
