import type { Currency } from '@p2psats/shared'
import rawCurrencies from '@/data/currencies.json'

export type FiatCode = string
export interface FiatEntry { code: FiatCode; name: string }

export const FIATS: readonly FiatEntry[] = rawCurrencies as FiatEntry[]
export const FIAT_CODES: readonly FiatCode[] = FIATS.map((f) => f.code)
export const FIAT_CODE_SET = new Set<string>(FIAT_CODES)
export const FIAT_NAME: Record<FiatCode, string> = Object.fromEntries(FIATS.map((f) => [f.code, f.name]))

const KNOWN_CODES = [
  'USD', 'EUR', 'BRL', 'ARS', 'MXN', 'VES', 'ZAR', 'RUB', 'PEN', 'CLP', 'COP', 'PYG',
] as const satisfies readonly Currency[]

const KNOWN = new Set<string>(KNOWN_CODES)
export const isKnownCurrency = (c: FiatCode): c is Currency => KNOWN.has(c)
