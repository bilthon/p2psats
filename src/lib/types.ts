// Core domain types for P2P Explorer (NIP-69 orderbook)

export type SourceId = 'mostro' | 'lnp2pbot' | 'robosats' | 'peach' | 'hodlhodl' | 'nostr';
export type Side = 'buy' | 'sell';
export type Currency =
  | 'USD' | 'EUR' | 'BRL' | 'ARS' | 'MXN' | 'VES' | 'ZAR' | 'RUB' | 'PEN'
  | 'CLP' | 'COP' | 'PYG';

export interface PaymentMethod {
  id: string;
  label: string;
  group: string;
  regions: string[] | '*';
}

export interface Source {
  id: SourceId;
  label: string;
  relay: string;
  color: string;
}

// Per-platform reputation summary, derived in orderAdapter.deriveRep().
// `kind: 'stars'` covers lnp2pbot/mostro/peach orders that have actual review
// data; `kind: 'empty'` covers robosats (no rating tag) and the peach-zero
// sentinel (`total_reviews: 0`, `total_rating: 1`). The tooltip carries the
// platform-specific disambiguation for the empty cases.
export type RepProps =
  | { kind: 'stars'; rating: number; count: number; days?: number; tooltip: string }
  | { kind: 'empty'; tooltip: string };

export interface Order {
  id: string;
  source: SourceId;
  side: Side;
  currency: Currency;
  price: number;
  premium: number;
  amountSats: number;
  minFiat: number;
  maxFiat: number;
  methods: PaymentMethod[];
  maker: string;
  makerHandle: string;
  rep: RepProps;
  ageMin: number;
  relay: string;
  sourceLabel: string;
  kind: number;
  expiresIn: number;
}

export interface Alert {
  id: string;
  name?: string;
  side: 'any' | Side;
  currency: Currency;
  premium: { op: '<=' | '>=' | '=='; value: number };
  methods: string[];
  sources: string[];
  amountMin: number | null;
  amountMax: number | null;
  email: string;
  enabled: boolean;
  createdAt: number;
}

export interface CrossedPair {
  buy: Order;
  sell: Order;
  spreadFiat: number;
  spreadPct: number;
  sharedMethods: PaymentMethod[];
  tractable: boolean;
}

export interface CrossResult {
  pairs: CrossedPair[];
  crossedBuyIds: Set<string>;
  crossedSellIds: Set<string>;
  maxBuy: Order | null;
  minSell: Order | null;
}

