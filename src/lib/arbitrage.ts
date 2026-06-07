// arbitrage.ts — detect crossed P2P books.
// A "cross" happens when a bid price >= an ask price.

import type { CrossResult, Order } from '@p2psats/shared'
import type { FiatCode } from '@/lib/currency'

export function detectCrosses(orders: Order[], currency: FiatCode): CrossResult {
  const buys = orders.filter((o) => o.side === 'buy' && o.currency === currency)
  const sells = orders.filter((o) => o.side === 'sell' && o.currency === currency)

  if (!buys.length || !sells.length) {
    return {
      pairs: [],
      crossedBuyIds: new Set(),
      crossedSellIds: new Set(),
      maxBuy: null,
      minSell: null,
    }
  }

  const minSell = sells.reduce((a, b) => (a.price <= b.price ? a : b))
  const maxBuy = buys.reduce((a, b) => (a.price >= b.price ? a : b))

  const pairs: CrossResult['pairs'] = []
  buys.forEach((b) => {
    sells.forEach((s) => {
      if (b.price >= s.price) {
        const sharedMethods = b.methods.filter((bm) => s.methods.find((sm) => sm.id === bm.id))
        const spreadFiat = b.price - s.price
        const spreadPct = ((b.price - s.price) / s.price) * 100
        pairs.push({
          buy: b,
          sell: s,
          spreadFiat,
          spreadPct,
          sharedMethods,
          tractable: sharedMethods.length > 0 && b.source !== s.source,
        })
      }
    })
  })
  pairs.sort((a, b) => b.spreadPct - a.spreadPct)

  const crossedBuyIds = new Set(pairs.map((p) => p.buy.id))
  const crossedSellIds = new Set(pairs.map((p) => p.sell.id))

  return { pairs, crossedBuyIds, crossedSellIds, maxBuy, minSell }
}
