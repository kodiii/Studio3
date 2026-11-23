/**
 * Meridian — a fictional commerce platform. Every name, edge and number here is SAMPLE DATA generated from a fixed
 * seed (deterministic: the same atlas on every load, in every browser).
 */

export type ClusterId = 'edge' | 'identity' | 'commerce' | 'data' | 'platform';
export type NodeKind = 'service' | 'store' | 'queue' | 'external';

export interface Cluster { id: ClusterId; name: string; team: string; blurb: string }
export const CLUSTERS: readonly Cluster[] = [
  { id: 'edge', name: 'Edge', team: 'Front Door', blurb: 'Where traffic enters: shielding, TLS, routing and the two backends-for-frontends.' },
  { id: 'identity', name: 'Identity', team: 'Keyring', blurb: 'Sign-in, sessions, tokens and the consent record.' },
  { id: 'commerce', name: 'Commerce', team: 'Basket', blurb: 'Catalogue, pricing, cart, checkout and the payment hand-off.' },
  { id: 'data', name: 'Data', team: 'Tidewater', blurb: 'The event bus and everything that reads it: search, recommendations, reporting.' },
  { id: 'platform', name: 'Platform', team: 'Groundwork', blurb: 'Configuration, flags, secrets, telemetry and outbound messaging.' },
];
export const KINDS: Record<NodeKind, { label: string; plural: string; shape: string }> = {
  service: { label: 'Service', plural: 'Services', shape: 'sphere' },
  store: { label: 'Data store', plural: 'Data stores', shape: 'cylinder' },
  queue: { label: 'Queue', plural: 'Queues', shape: 'octahedron' },
  external: { label: 'External', plural: 'External providers', shape: 'cube' },
};

type Raw = [id: string, cluster: ClusterId, kind: NodeKind, role: string];
const RAW: Raw[] = [
  ['cdn-shield', 'edge', 'service', 'Caches and absorbs abusive traffic before it reaches the platform.'],
  ['tls-terminator', 'edge', 'service', 'Terminates TLS and forwards plain requests inside the perimeter.'],
  ['gateway', 'edge', 'service', 'Routes every request to the right backend and applies auth checks.'],
  ['rate-limiter', 'edge', 'service', 'Per-client request budgets.'],
  ['bot-filter', 'edge', 'service', 'Scores sessions for automated behaviour.'],
  ['web-bff', 'edge', 'service', 'Backend-for-frontend for the web storefront.'],
  ['mobile-bff', 'edge', 'service', 'Backend-for-frontend for the mobile apps.'],
  ['auth-api', 'identity', 'service', 'Sign-in, sign-out and session validation.'],
  ['token-signer', 'identity', 'service', 'Issues and rotates signed access tokens.'],
  ['mfa-service', 'identity', 'service', 'One-time codes and authenticator challenges.'],
  ['user-profile', 'identity', 'service', 'Names, addresses and preferences.'],
  ['directory-sync', 'identity', 'service', 'Nightly sync of business accounts.'],
  ['session-store', 'identity', 'store', 'Short-lived session records.'],
  ['consent-ledger', 'identity', 'store', 'Append-only record of marketing and data consents.'],
  ['catalog-api', 'commerce', 'service', 'Products, variants and media.'],
  ['pricing-engine', 'commerce', 'service', 'Computes the price of a basket line.'],
  ['promotions', 'commerce', 'service', 'Vouchers and campaign rules.'],
  ['tax-calculator', 'commerce', 'service', 'Sales tax by destination.'],
  ['cart-service', 'commerce', 'service', 'Baskets and saved-for-later lists.'],
  ['checkout', 'commerce', 'service', 'Turns a basket into an order.'],
  ['inventory', 'commerce', 'service', 'Stock levels and reservations.'],
  ['payments-adapter', 'commerce', 'service', 'Talks to the card network on behalf of checkout.'],
  ['order-ledger', 'commerce', 'store', 'The durable record of every order.'],
  ['card-network', 'commerce', 'external', 'Fictional third-party card processor.'],
  ['event-bus', 'data', 'queue', 'Every domain event passes through here.'],
  ['clickstream-ingest', 'data', 'service', 'Collects anonymous browsing events.'],
  ['warehouse-loader', 'data', 'service', 'Batches events into the analytics warehouse.'],
  ['search-indexer', 'data', 'service', 'Keeps the search index in step with the catalogue.'],
  ['search-api', 'data', 'service', 'Query endpoint for storefront search.'],
  ['recommendation', 'data', 'service', '“You might also like” candidates.'],
  ['reporting-api', 'data', 'service', 'Dashboards for merchandisers.'],
  ['analytics-warehouse', 'data', 'store', 'Columnar store for reporting.'],
  ['feature-store', 'data', 'store', 'Precomputed signals for recommendations.'],
  ['search-index', 'data', 'store', 'Inverted index behind search.'],
  ['config-service', 'platform', 'service', 'Runtime configuration for every service.'],
  ['feature-flags', 'platform', 'service', 'Staged roll-outs and kill switches.'],
  ['metrics-gateway', 'platform', 'service', 'Receives metrics from every service.'],
  ['log-shipper', 'platform', 'service', 'Forwards structured logs.'],
  ['scheduler', 'platform', 'service', 'Runs periodic jobs.'],
  ['notification-hub', 'platform', 'service', 'Decides how to reach a customer.'],
  ['secrets-vault', 'platform', 'store', 'Keys and credentials, access-logged.'],
  ['mail-relay', 'platform', 'queue', 'Outbound e-mail queue.'],
  ['sms-gateway', 'platform', 'external', 'Fictional third-party SMS provider.'],
];

/** [caller, callee] — "caller depends on callee". */
const EDGES: [string, string][] = [
  ['cdn-shield', 'tls-terminator'], ['tls-terminator', 'gateway'], ['gateway', 'rate-limiter'], ['gateway', 'bot-filter'],
  ['gateway', 'web-bff'], ['gateway', 'mobile-bff'], ['gateway', 'auth-api'], ['rate-limiter', 'config-service'], ['bot-filter', 'session-store'],
  ['web-bff', 'catalog-api'], ['web-bff', 'cart-service'], ['web-bff', 'search-api'], ['web-bff', 'user-profile'], ['web-bff', 'recommendation'],
  ['mobile-bff', 'catalog-api'], ['mobile-bff', 'cart-service'], ['mobile-bff', 'checkout'], ['mobile-bff', 'user-profile'], ['mobile-bff', 'notification-hub'],
  ['auth-api', 'session-store'], ['auth-api', 'token-signer'], ['auth-api', 'mfa-service'], ['auth-api', 'user-profile'], ['token-signer', 'secrets-vault'],
  ['mfa-service', 'sms-gateway'], ['user-profile', 'consent-ledger'], ['user-profile', 'event-bus'], ['directory-sync', 'user-profile'],
  ['catalog-api', 'inventory'], ['catalog-api', 'pricing-engine'], ['catalog-api', 'event-bus'], ['pricing-engine', 'promotions'],
  ['pricing-engine', 'tax-calculator'], ['pricing-engine', 'feature-flags'], ['cart-service', 'pricing-engine'], ['cart-service', 'inventory'],
  ['cart-service', 'session-store'], ['checkout', 'cart-service'], ['checkout', 'payments-adapter'], ['checkout', 'tax-calculator'],
  ['checkout', 'order-ledger'], ['checkout', 'event-bus'], ['checkout', 'auth-api'], ['checkout', 'notification-hub'],
  ['payments-adapter', 'card-network'], ['payments-adapter', 'secrets-vault'], ['payments-adapter', 'order-ledger'], ['inventory', 'event-bus'],
  ['promotions', 'feature-flags'], ['tax-calculator', 'config-service'], ['clickstream-ingest', 'event-bus'], ['warehouse-loader', 'event-bus'],
  ['warehouse-loader', 'analytics-warehouse'], ['search-indexer', 'event-bus'], ['search-indexer', 'catalog-api'], ['search-indexer', 'search-index'],
  ['search-api', 'search-index'], ['recommendation', 'feature-store'], ['recommendation', 'catalog-api'], ['reporting-api', 'analytics-warehouse'],
  ['reporting-api', 'auth-api'], ['config-service', 'secrets-vault'], ['feature-flags', 'config-service'], ['log-shipper', 'event-bus'],
  ['scheduler', 'warehouse-loader'], ['scheduler', 'search-indexer'], ['scheduler', 'directory-sync'], ['notification-hub', 'mail-relay'],
  ['notification-hub', 'sms-gateway'], ['gateway', 'metrics-gateway'], ['checkout', 'metrics-gateway'], ['auth-api', 'metrics-gateway'],
  ['payments-adapter', 'log-shipper'], ['gateway', 'log-shipper'],
];

/* ── Seeded randomness ─────────────────────────────────────────────────────── */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const SEED = 1729;

export interface AtlasNode {
  index: number;
  id: string;
  cluster: ClusterId;
  kind: NodeKind;
  role: string;
  team: string;
  tier: 1 | 2 | 3;
  /** Sample: requests per minute. */
  rpm: number;
  /** Sample: 95th percentile latency, ms. */
  p95: number;
  /** Sample: error rate, percent. */
  errors: number;
  out: number[];
  in: number[];
}
export interface AtlasEdge { index: number; source: number; target: number; cross: boolean }

const TRAFFIC: Record<ClusterId, [number, number]> = { edge: [18000, 60000], identity: [4000, 22000], commerce: [1500, 16000], data: [600, 9000], platform: [900, 30000] };

function build() {
  const rnd = mulberry32(SEED);
  const nodes: AtlasNode[] = RAW.map(([id, cluster, kind, role], index) => {
    const [lo, hi] = TRAFFIC[cluster];
    const rpm = Math.round(Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))) / 10) * 10;
    const base = kind === 'store' ? 6 : kind === 'queue' ? 3 : kind === 'external' ? 140 : 18;
    const p95 = Math.round(base * (0.6 + rnd() * 2.4));
    const errors = Math.round((kind === 'external' ? 0.4 + rnd() * 2.2 : rnd() ** 3 * 1.4) * 100) / 100;
    const tier = (cluster === 'edge' || id === 'checkout' || id === 'auth-api' || id === 'payments-adapter' ? 1 : rnd() < 0.5 ? 2 : 3) as 1 | 2 | 3;
    return { index, id, cluster, kind, role, team: CLUSTERS.find((c) => c.id === cluster)!.team, tier, rpm, p95, errors, out: [], in: [] };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: AtlasEdge[] = EDGES.map(([a, b], index) => {
    const s = byId.get(a), t = byId.get(b);
    if (!s || !t) throw new Error(`atlas: unknown edge ${a} → ${b}`);
    s.out.push(t.index); t.in.push(s.index);
    return { index, source: s.index, target: t.index, cross: s.cluster !== t.cluster };
  });
  return { nodes, edges };
}
export const { nodes: NODES, edges: EDGES_LIST } = build();

/* ── Layout: a small, deterministic force relaxation (3D, or planar for the 2D view) ─────────────────────────── */

export type Layout = Float32Array; // xyz per node

export function relax(planar: boolean, iterations = 420): Layout {
  const rnd = mulberry32(SEED + (planar ? 7 : 3));
  const n = NODES.length;
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
  const centres = new Map<ClusterId, [number, number, number]>();
  CLUSTERS.forEach((c, i) => {
    const a = (i / CLUSTERS.length) * Math.PI * 2 - Math.PI / 2;
    centres.set(c.id, planar ? [Math.cos(a) * 5.2, -Math.sin(a) * 3.7, 0] : [Math.cos(a) * 4.6, (i % 2 ? 1.2 : -1.1), Math.sin(a) * 4.6]);
  });
  NODES.forEach((node, i) => {
    const c = centres.get(node.cluster)!;
    pos[i * 3] = c[0] + (rnd() - 0.5) * 3;
    pos[i * 3 + 1] = c[1] + (rnd() - 0.5) * 3;
    pos[i * 3 + 2] = planar ? 0 : c[2] + (rnd() - 0.5) * 3;
  });
  const d = [0, 0, 0];
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    const force = new Float32Array(n * 3);
    // pairwise repulsion
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let d2 = 0;
      for (let k = 0; k < 3; k++) { d[k] = pos[i * 3 + k] - pos[j * 3 + k]; d2 += d[k] * d[k]; }
      d2 = Math.max(d2, 0.04);
      const same = NODES[i].cluster === NODES[j].cluster;
      const f = (same ? 0.55 : 1.2) / d2;
      const inv = 1 / Math.sqrt(d2);
      for (let k = 0; k < 3; k++) { force[i * 3 + k] += d[k] * inv * f; force[j * 3 + k] -= d[k] * inv * f; }
    }
    // springs
    for (const e of EDGES_LIST) {
      const i = e.source, j = e.target;
      let d2 = 0;
      for (let k = 0; k < 3; k++) { d[k] = pos[j * 3 + k] - pos[i * 3 + k]; d2 += d[k] * d[k]; }
      const dist = Math.sqrt(Math.max(d2, 1e-6));
      const rest = e.cross ? 3.4 : 1.25;
      const f = (e.cross ? 0.05 : 0.22) * (dist - rest);
      for (let k = 0; k < 3; k++) { force[i * 3 + k] += (d[k] / dist) * f; force[j * 3 + k] -= (d[k] / dist) * f; }
    }
    // cluster gravity + weak centring
    for (let i = 0; i < n; i++) {
      const c = centres.get(NODES[i].cluster)!;
      for (let k = 0; k < 3; k++) force[i * 3 + k] += (c[k] - pos[i * 3 + k]) * 0.16 - pos[i * 3 + k] * 0.012;
    }
    for (let i = 0; i < n * 3; i++) {
      if (planar && i % 3 === 2) continue;
      vel[i] = (vel[i] + Math.max(-1.5, Math.min(1.5, force[i])) * 0.5) * 0.72;
      pos[i] += vel[i] * (0.25 + 0.75 * cool);
    }
  }
  // centre the result
  const mean = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) mean[k] += pos[i * 3 + k] / n;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] -= mean[k];
  return pos;
}

/** Display radius from traffic (log scale), in scene units. */
export const nodeRadius = (n: AtlasNode): number => 0.2 + 0.3 * Math.min(1, Math.max(0, (Math.log10(n.rpm) - 2.7) / 2.1));

/** Bounding sphere of a layout: centre + radius (including the largest node). */
export function layoutBounds(pos: Layout): { center: [number, number, number]; radius: number } {
  const n = pos.length / 3, c = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / n;
  let r = 0;
  for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2]));
  return { center: [c[0], c[1], c[2]], radius: r + 0.5 };
}

/** Cluster colours per theme. Each passes 3:1 against its theme's page background. */
export const PALETTE: Record<'light' | 'dark', Record<ClusterId, string>> = {
  light: { edge: '#c2410c', identity: '#1d4ed8', commerce: '#0f766e', data: '#a16207', platform: '#a21caf' },
  dark: { edge: '#fb8a5c', identity: '#86a8ff', commerce: '#3fc9b4', data: '#e5b648', platform: '#e48ae6' },
};

export const formatRpm = (n: number): string => n.toLocaleString('en-US');
