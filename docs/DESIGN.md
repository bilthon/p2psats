# P2P Explorer — Design Spec

> **Status:** This document is the canonical spec for the live Vue 3 codebase. It was authored as a handoff for a high-fidelity React/JSX prototype that has since been ported. References below to "the prototype", "source/", JSX files, and "production should…" survive verbatim because they capture intent that's still valuable as documentation. The Vue port lives in `src/`; persistence keys use the `pe.*` prefix (renamed from `pb.*`). For a file-by-file mapping from the original prototype to the ported codebase, see the table at the bottom of this document.

## Overview

**P2P Explorer** is a read-only aggregator for peer-to-peer Bitcoin trading orders that are published over the nostr protocol (NIP-69). It subscribes to public relays operated by mostro, lnp2pbot, robosats, and peach, merges their order events into a single book per fiat currency, and shows price discovery, depth, cross-platform arbitrage opportunities, and a NIP-69-driven email alerts system.

Two top-level pages, switched via a segmented nav:
1. **Order book** — stats, depth chart, full table of bids/asks, crossed-pair detection.
2. **Alerts** — rule builder + saved alerts list with live "matches now" counts.

The site does NOT take orders or hold custody. It only reads from relays and emails users when matching orders appear.

## About the Design Files

The files in `source/` are **design references created in HTML** — a working high-fidelity prototype demonstrating the intended look, layout, interactions, and data shape. They are **not production code to copy directly**.

Your task is to **recreate these designs in the target codebase's existing environment** (whatever framework, design system, and conventions are already in use). If no codebase exists yet, choose the framework most appropriate for the project — React + TypeScript + a real nostr client library (e.g. `nostr-tools` or NDK) is the natural fit.

The prototype uses inline JSX via Babel-in-browser, mocked random data, and `localStorage` for persistence. Production should swap those for real React/build tooling, real nostr relay subscriptions, and a real persistence layer.

## Fidelity

**High-fidelity (hi-fi).** Final colors, typography, spacing, and interactions are settled. Recreate the UI pixel-perfectly using the codebase's existing libraries and patterns. The design tokens section below has the exact values.

## Pages

### 1. Order book page

Layout (top to bottom, all in a single-column 1440px max-width column with 28px horizontal padding):

1. **Header** — 3-column grid (`auto 1fr auto`, gap 32px). Brand on the left, relay status pills centered, currency switcher + settings icon on the right.
2. **Page nav** — pill-style segmented control with two tabs: "Order book" / "Alerts". Each tab shows a live count badge.
3. **Stats strip** — 6 stat chips + a "live · N orders" pill: Mid price, Best bid (green), Best ask (red), Spread (turns amber + ⚡ when crossed), Bid depth (sats), Ask depth (sats).
4. **Arbitrage banner** — full-width card. Green "✓ Book is consistent" state when no crosses; soft cream "N crossed pairs detected" alert state with best-opportunity stats and a "Jump to detail" button when crosses exist.
5. **Depth chart card** — cumulative-depth area chart with hover tooltip; surfaces crossed orders as a dashed band overlay ("crossed" label). Built on echarts (tree-shaken) via vue-echarts.
6. **Order book card** — header has tabs for layout: Tabs (single list with Bids/Asks toggle) / Split (two columns side-by-side) / Stack (bids above asks). Each row: price · amount · sats · payment-method chips · maker name · reputation · age. Crossed rows get a soft amber tint, a 2px left stripe, and a ⚡ marker before the price.
7. **Crossed pairs detail card** — only shown when crosses exist. Lists each (ASK leg → BID leg) pair with spread (% and absolute), highlighting "tractable" pairs (shared payment method + different platforms).
8. **Footer** — single-line, muted.

### 2. Alerts page

1. **Section header** — title + subtitle, meta on the right showing "N alerts · M active · K matches now".
2. **Alert builder** card — Side (Any/Buy/Sell), Premium operator (≤/≥/≈) + percentage, Email field. Disclosure for advanced filters: payment method chips, source chips, min/max amount, optional alert name. Plain-language rule summary updates live below the inputs ("Notify me when a buy order in USD appears with premium ≤ -1% via PIX, Strike."). Reset / Create alert buttons.
3. **Saved alerts list** — each row: enable/disable toggle on the left, title (or auto-generated label) + tag pills + email address in the middle, "matches now" count on the right, ✕ remove button.

## Header components

### Brand
38×38px black rounded square (border-radius 9px) containing a stylized SVG glyph (two vertical bars + two dots representing bids/asks). Wordmark "P2P Explorer" (Inter Tight 600, 18px) above tag "nostr orderbook · NIP-69" (mono 11px, muted).

### Relay status pills
One pill per source (mostro / lnp2pbot / robosats / peach). Pill contains a colored dot + label. When the source is enabled, the dot pulses (animated CSS scale + opacity). Click to toggle that source on/off. Source colors:
- mostro: `#6366F1` (indigo)
- lnp2pbot: `#10B981` (green)
- robosats: `#F59E0B` (amber)
- peach: `#EC4899` (pink)

### Currency switcher
Trigger button reads `BTC / USD` (the quote currency in bold). Clicking opens a dropdown with a search input and a scrollable list of ~140 fiat currencies (the Yadio coverage matched by lnp2pbot and Mostro). The empty-query view pins the original 12 currencies (USD, EUR, BRL, ARS, MXN, VES, ZAR, RUB, PEN, CLP, COP, PYG) plus the currently-selected one, followed by 50 alphabetical entries; typing filters the full list by code or name. Each menu item: 3-letter code in mono + full name + ✓ on the active row. Footer note: "📌 Saved to this browser".

The currency list is sourced from `src/data/currencies.json`, generated at build time by `scripts/fetch-currencies.ts` (no runtime dependency on Yadio). `src/lib/currency.ts` exposes the `FiatCode` type alias (a plain string) and `FIATS`/`FIAT_NAME`/`FIAT_CODE_SET` helpers; the tight `Currency` union from `@p2psats/shared` is retained only as the key type for the local `REF_RATES`/`FIAT_FORMAT` fallback maps.

## Interactions & Behavior

### Live data tick
The prototype refreshes its mocked order set every 12 seconds (changing the data builder's seed). Production should subscribe to NIP-69 events on the configured relays and merge incrementally; the 12s tick is just to demonstrate that the UI reacts to changes.

### Source filtering
Toggling a relay pill filters that source out of the displayed orderbook AND out of alert match counts. Persist the active source list to localStorage.

### Currency switching
Switching the quote currency rebuilds the displayed book. The prototype generates ~9 orders for the selected currency and 2–3 for each other, simulating realistic thin liquidity. Persist the chosen currency to localStorage.

### Page nav
Toggling between Order book / Alerts replaces the page body. Persist the selected page to localStorage so reload returns to the same view.

### Crossed-book detection
A book is "crossed" when the best bid > best ask (an arbitrage condition). The detector iterates buy/sell pairs and returns:
- List of (buy, sell) pairs where `buy.price > sell.price`, sorted by spread descending
- For each pair: spread in fiat, spread %, whether the two orders share at least one payment method, whether they're on different sources
- Sets of buy/sell order IDs that participated in any cross
- Best-bid and best-ask references when a cross exists

Crossed orders get visual emphasis throughout the UI: amber tint + 2px left stripe + ⚡ marker on book rows; tab badges show ⚡N; depth chart adds a subtle dashed "crossed" zone; banner switches from green to cream alert state.

### Order book layout switcher
Three modes (persisted as `bookView` Tweak):
- `tabs` — single list with a Bids/Asks toggle at the top. Tab labels include count and ⚡N if crossed.
- `split` — bids and asks side by side in two columns. Default.
- `stacked` — asks above (descending price), bids below (descending price), classic depth-table feel.

### Depth chart

The depth chart is a single-mode cumulative-area visualization built with echarts (tree-shaken) + vue-echarts. Bids render as a green step-line area on the left; asks as a red step-line area on the right, sharing a common price x-axis. Additional features:

- **Mid line**: dashed vertical line at mid price when both sides exist.
- **Crossed zone**: subtle dashed amber band overlay when `crosses.pairs.length > 0`.
- **Edge fade**: outer 15% of each side fades to transparency via a horizontal LinearGradient.
- **Hover tooltip**: shows price (`fmtFiat`) and cumulative depth (`fmtSatsCompact`) for the nearest side.
- **Domain shifting**: when only one side is present, the domain extends the empty side so the populated side occupies only its own half of the chart.

> A `mirrored` style existed in the original handoff (bids and asks as opposing area charts around a vertical mid-price axis). It was removed because each half was independently scaled to its own price range, so the chart couldn't visually represent a crossed book — the crossing collapsed onto the central axis.

> A `heatmap` style (price-bucket heatmap, color intensity = volume) existed in the SVG implementation. It was removed in favor of a single-mode echarts-based cumulative-area visual.

### Alert rule semantics
A rule matches an order when ALL apply:
- `currency` matches
- `side` is 'any', or matches order side
- premium operator/value: `<=` ≤, `>=` ≥, `==` within ±0.5%
- if `methods` list is non-empty, order must use at least one of them
- if `sources` list is non-empty, order must come from one of them
- if `amountMin` set, order's max fiat ≥ amountMin
- if `amountMax` set, order's min fiat ≤ amountMax

When a rule is disabled (`enabled === false`) it doesn't match anything but stays in the list.

### Alert delivery (production)
The prototype only counts matches in-page. Production needs a backend: persist rules, subscribe to NIP-69 events on tracked relays, evaluate each new event against all active rules, send email with the order details on first match per rule per order ID (dedupe).

### Tweaks panel
A floating panel users open via toolbar toggle, exposing design knobs:
- Order book density (compact / balanced / comfy) — adjusts row padding/font-size
- Order book layout (tabs / split / stack)
- Show premium column (toggle)
- Theme accent color

This panel is a design-time affordance; the production app may or may not expose it to end users.

## State Management

Persisted to localStorage:
- `pe.currency` — string
- `pe.sources` — string[]
- `pe.alerts` — Alert[]
- `pe.page` — 'book' | 'alerts'
- Tweaks panel keys (density, showPremium, highlightAccent, bookView)

In-memory:
- `tickSeed` — drives the mocked refresh
- `allOrders` — derived from buildOrders() across all currencies
- `ccyOrders` — filtered by current currency + active sources
- `crosses` — derived via `detectCrosses(ccyOrders, currency)`
- `matchesByAlert` — `{ [alertId]: number }` count of currently-matching orders per alert

Order shape:
```ts
type Order = {
  id: string;
  source: 'mostro' | 'lnp2pbot' | 'robosats' | 'peach';
  side: 'buy' | 'sell';
  currency: string;
  price: number;             // fiat per BTC
  premium: number;           // signed % vs reference rate
  amountSats: number;
  minFiat: number;
  maxFiat: number;
  methods: PaymentMethod[];  // {id, label}
  maker: string;             // pubkey-derived nickname
  reputation: number;        // 0–100
  trades: number;            // total completed trades
  publishedAt: number;       // ms epoch
};
```

Alert shape:
```ts
type Alert = {
  id: string;
  name?: string;
  side: 'any' | 'buy' | 'sell';
  currency: string;
  premium: { op: '<=' | '>=' | '=='; value: number };
  methods: string[];   // method ids
  sources: string[];   // source ids
  amountMin: number | null;
  amountMax: number | null;
  email: string;
  enabled: boolean;
  createdAt: number;
};
```

## Design Tokens

### Colors

```css
--bg:        oklch(0.99 0.005 80);   /* page background, warm off-white */
--bg-card:   #FFFFFF;                /* cards */
--bg-soft:   oklch(0.96 0.008 75);   /* subtle fills, hover states */
--ink:       oklch(0.22 0.012 70);   /* primary text */
--ink-soft:  oklch(0.42 0.012 70);   /* secondary text */
--ink-mute:  oklch(0.62 0.008 70);   /* tertiary, captions */
--line:      oklch(0.92 0.01 75);    /* borders */

/* Semantic */
--bid:       oklch(0.55 0.14 155);   /* bids / buy-side green */
--ask:       oklch(0.55 0.18 25);    /* asks / sell-side red */
--accent:    #5B5BD6;                /* default accent (Tweakable) */

/* Crossed-state (subdued amber, NOT saturated) */
--cross-bg:        oklch(0.97 0.015 65);
--cross-border:    oklch(0.88 0.04 70);
--cross-ink:       oklch(0.5 0.1 55);
--cross-stripe:    oklch(0.7 0.08 60);
--cross-banner-bg: oklch(0.96 0.02 70);
--cross-icon-bg:   oklch(0.92 0.04 65);
```

### Typography

- Display / UI: **Inter Tight** (400, 500, 600). Used for headings, body text, buttons.
- Mono: **JetBrains Mono** (400, 500, 600). Used for prices, sat amounts, percentages, technical labels (tags, source labels, captions).

Sizes:
- H2 / card title: 16px / 600 / -0.01em letter-spacing
- Section subtitle: 13px / mute color
- Body: 13px
- Stat value: 22px / 600 / mono / tabular-nums
- Stat label: 11px / mono / 0.06em letter-spacing / uppercase / mute
- Table cell: 13px (balanced); 12px (compact); 14px (comfy)
- Mono caption / footer: 11–12px

### Spacing scale
4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 80px. Card padding generally 20–24px. Page padding 24/28.

### Border radius
```css
--r-sm: 6px;
--r-md: 8px;
--r-lg: 12px;
```
Pills/chips: 999px. Logo: 9px.

### Shadows
Light, used sparingly:
```css
0 1px 2px rgba(20, 18, 14, 0.06)        /* tab pill active */
0 1px 3px rgba(20, 18, 14, 0.04)        /* card resting */
-12px 0 40px rgba(20, 18, 14, 0.12)     /* slide-over panels (responsive) */
```

## Responsive behavior

- ≤ 1200px: stats grid collapses to 3 cols; book split layout collapses to single column.
- ≤ 1100px: crossed-pair detail card stacks legs.
- ≤ 900px: header becomes single column; relay row left-aligned; order table hides amount/methods/maker/sats/rep columns; stats grid 2 cols.

## Mocked data → real data

The `data.jsx` file generates fake orders deterministically from a seed. Replace with:
1. A nostr client (e.g. `nostr-tools`) subscribing to the four relays from `SOURCES`.
2. A NIP-69 event parser. The fields the UI consumes are listed in the Order shape above; map relay event tags to that shape.
3. A merge layer that dedupes by event id and replaces stale orders.
4. A reference price feed for premium calculation (the prototype uses static `REF_RATES` per currency; production should use a real spot feed like Kraken or CoinGecko).

`PAYMENT_METHODS` is curated by region — keep this as a static config, but verify the regional mappings against the real method tags published by each platform.

## Files in `source/` (historical → ported)

The original handoff shipped these files; they have been ported to the Vue codebase as listed:

| Prototype file | Ported to |
|---|---|
| `P2P Explorer.html` | `index.html` (Vite mounts `<App />` here) |
| `app.jsx` | `src/App.vue` + `src/views/BookView.vue` + `src/views/AlertsView.vue` + `src/router.ts` + `src/stores/appStore.ts` + `src/composables/useTick.ts` |
| `data.jsx` | `src/lib/data.ts` + `src/lib/types.ts` |
| `book.jsx` | `src/components/OrderBook.vue` + `src/components/OrderTable.vue` |
| `depth.jsx` | `src/components/DepthChart.vue` |
| `arbitrage.jsx` | `src/lib/arbitrage.ts` + `src/components/ArbitrageBanner.vue` + `src/components/CrossedPairsList.vue` |
| `alerts.jsx` | `src/lib/alerts.ts` + `src/components/AlertBuilder.vue` + `src/components/SavedAlerts.vue` |
| `tweaks-panel.jsx` | `src/components/TweaksPanel.vue` |
| `styles.css` | `src/assets/styles.css` (tokens were re-themed during the port) |

## Assets

No image assets. Logo and all icons are inline SVGs. Fonts loaded from Google Fonts (Inter Tight, JetBrains Mono).

## Out of scope for the prototype (build-time decisions)

- Real nostr relay subscription, reconnection, and event dedup.
- Email delivery backend for alerts.
- Authentication / per-user persistence (prototype uses localStorage).
- Order detail / "open in source app" deeplinks.
- Real reference price feed.
- Mobile-first detailed layouts beyond the responsive breakpoints described.
