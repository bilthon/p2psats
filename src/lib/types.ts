// Core domain types for P2P Explorer (NIP-69 orderbook)

export type SourceId = 'mostro' | 'lnp2pbot' | 'robosats' | 'peach';
export type Side = 'buy' | 'sell';
export type Currency = 'USD' | 'EUR' | 'BRL' | 'ARS' | 'MXN' | 'VES' | 'ZAR' | 'RUB' | 'PEN';

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
  reputation: number;
  completion: number;
  trades: number;
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

export type DepthStyle = 'stacked' | 'heatmap';
export type Density = 'compact' | 'balanced' | 'comfy';
export type BookView = 'tabs' | 'split' | 'stacked';

export interface TweakValues {
  depthStyle: DepthStyle;
  density: Density;
  showPremium: boolean;
  highlightAccent: string;
  bookView: BookView;
}
