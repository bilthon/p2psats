import { writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const OUT = resolve(import.meta.dirname, '../src/data/currencies.json')

const DENYLIST = new Set([
  'XAU', 'XAG', 'XPT', 'XPD', 'XDR', 'XBT', 'BTC', 'SAT', 'SATS', 'USDT', 'USDC', 'DAI',
  'VEF', 'VEB', 'ZWD', 'ZWL', 'ZWR', 'ZMK', 'MRO', 'STD', 'BYR', 'SVC',
  'LVL', 'LTL', 'EEK', 'SKK', 'SIT', 'MTL', 'CYP', 'ROL', 'TRL', 'GHC',
  'SDD', 'AZM', 'MZM', 'TMM',
])

interface FiatEntry { code: string; name: string }

function filter(raw: Record<string, string>): FiatEntry[] {
  return Object.entries(raw)
    .filter(([code]) => /^[A-Z]{3}$/.test(code) && !DENYLIST.has(code))
    .map(([code, name]) => ({ code, name: name.trim() }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

/** Returns null on network/API failure (caller decides how to handle). */
async function fetchCurrencies(): Promise<FiatEntry[] | null> {
  try {
    const res = await fetch('https://api.yadio.io/currencies')
    if (!res.ok) {
      console.error(`Warning: Yadio responded ${res.status} ${res.statusText} — skipping check.`)
      return null
    }
    const json = (await res.json()) as Record<string, string>
    const entries = filter(json)
    if (entries.length < 50) {
      console.error(`Warning: Yadio returned a suspiciously short list (${entries.length} entries) — skipping check.`)
      return null
    }
    return entries
  } catch (err) {
    console.error(`Warning: Could not reach Yadio — ${String(err)} — skipping check.`)
    return null
  }
}

const mode = process.argv[2] ?? '--write'

if (mode === '--write') {
  const entries = await fetchCurrencies()
  if (entries === null) {
    console.error('Aborting write due to fetch failure.')
    process.exit(1)
  }
  writeFileSync(OUT, JSON.stringify(entries, null, 2) + '\n')
  console.log(`Wrote ${entries.length} currencies to src/data/currencies.json`)
} else if (mode === '--check') {
  const entries = await fetchCurrencies()
  if (entries === null) {
    // Network/API outage — do not fail the build.
    console.log('Yadio unreachable; drift check skipped.')
    process.exit(0)
  }
  let committed: string
  try {
    committed = readFileSync(OUT, 'utf8')
  } catch {
    console.error('src/data/currencies.json not found — run currencies:sync first')
    process.exit(1)
  }
  const fresh = JSON.stringify(entries, null, 2) + '\n'
  const freshHash = createHash('sha256').update(fresh).digest('hex')
  const committedHash = createHash('sha256').update(committed).digest('hex')
  if (freshHash !== committedHash) {
    const a = JSON.parse(committed) as FiatEntry[]
    const aCodes = new Set(a.map((e) => e.code))
    const bCodes = new Set(entries.map((e) => e.code))
    const added = entries.filter((e) => !aCodes.has(e.code)).map((e) => e.code)
    const removed = a.filter((e) => !bCodes.has(e.code)).map((e) => e.code)
    console.error('Currency list has drifted from committed file.')
    if (added.length) console.error('  Added:  ', added.join(', '))
    if (removed.length) console.error('  Removed:', removed.join(', '))
    console.error('Run: npm run currencies:sync')
    process.exit(1)
  }
  console.log(`OK — ${entries.length} currencies, no drift.`)
} else {
  console.error(`Unknown mode: ${mode}. Use --write or --check.`)
  process.exit(1)
}
