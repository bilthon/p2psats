// alerts.ts — alert rule matching logic

import type { Alert, Order } from './types'

export function matchesRule(order: Order, rule: Alert): boolean {
  if (rule.enabled === false) return false
  if (order.currency !== rule.currency) return false
  if (rule.side !== 'any' && order.side !== rule.side) return false

  const p = order.premium
  if (rule.premium.op === '<=' && !(p <= rule.premium.value)) return false
  if (rule.premium.op === '>=' && !(p >= rule.premium.value)) return false
  if (rule.premium.op === '==' && Math.abs(p - rule.premium.value) > 0.5) return false

  if (rule.methods.length && !order.methods.some((m) => rule.methods.includes(m.id))) return false
  if (rule.sources.length && !rule.sources.includes(order.source)) return false
  if (rule.amountMin && order.maxFiat < rule.amountMin) return false
  if (rule.amountMax && order.minFiat > rule.amountMax) return false

  return true
}

export const DEFAULT_RULE = {
  side: 'any' as const,
  currency: 'USD' as const,
  premium: { op: '<=' as const, value: -1 },
  methods: [] as string[],
  sources: [] as string[],
  amountMin: null as number | null,
  amountMax: null as number | null,
  email: '',
  name: '',
}
