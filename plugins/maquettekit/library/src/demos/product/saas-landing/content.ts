/** Tarn — a fictional webhook inbox. Every name, URL, payload and price here is sample content (.example domains). */

export interface Delivery {
  id: string;
  source: 'payments' | 'storefront' | 'crm';
  event: string;
  status: number;
  ms: number;
  at: string;
  body: string;
}

export const INBOX_URL = 'https://in.tarn.example/k7f2-payments';

/** Yesterday's deliveries to the payments inbox, newest first (sample data). `at` is the local time of day. */
export const DELIVERIES: Delivery[] = [
  {
    id: 'dlv_0195', source: 'storefront', event: 'order.created', status: 200, ms: 118, at: '21:18:44',
    body: `{
  "order": "ord_3342",
  "status": "created",
  "items": 1,
  "total": { "amount": 2900, "currency": "eur" },
  "shipping": "pickup"
}`,
  },
  {
    id: 'dlv_0194', source: 'payments', event: 'customer.updated', status: 200, ms: 64, at: '17:02:11',
    body: `{
  "id": "evt_8Kr0Hd",
  "type": "customer.updated",
  "api_version": "2026-09-01",
  "data": {
    "customer": "cus_Lm20",
    "changed": ["address.city"]
  }
}`,
  },
  {
    id: 'dlv_0193', source: 'payments', event: 'invoice.paid', status: 500, ms: 312, at: '14:41:07',
    body: `{
  "id": "evt_8Kq2wR",
  "type": "invoice.paid",
  "api_version": "2026-09-01",
  "created": 1795592467,
  "data": {
    "invoice": "in_4Xa91",
    "customer": "cus_Lm20",
    "amount_paid": 4900,
    "currency": "eur",
    "lines": 3
  }
}`,
  },
  {
    id: 'dlv_0192', source: 'payments', event: 'invoice.paid', status: 200, ms: 96, at: '11:12:55',
    body: `{
  "id": "evt_8Kp7Ta",
  "type": "invoice.paid",
  "api_version": "2026-09-01",
  "created": 1795590775,
  "data": {
    "invoice": "in_4Xa77",
    "customer": "cus_Qe81",
    "amount_paid": 1200,
    "currency": "eur",
    "lines": 1
  }
}`,
  },
  {
    id: 'dlv_0191', source: 'storefront', event: 'order.created', status: 200, ms: 141, at: '08:57:31',
    body: `{
  "order": "ord_3310",
  "status": "created",
  "items": 2,
  "total": { "amount": 6400, "currency": "eur" },
  "shipping": "standard"
}`,
  },
  {
    id: 'dlv_0190', source: 'crm', event: 'contact.updated', status: 200, ms: 77, at: '06:31:02',
    body: `{
  "contact": "ct_7781",
  "changed": ["phone", "consent.email"],
  "updated_by": "import"
}`,
  },
];
/** The delivery that failed, and the one before it that went through (the Inspect step compares them). */
export const FAILED = DELIVERIES.find((d) => d.id === 'dlv_0193') ?? DELIVERIES[0];
export const PASSED = DELIVERIES.find((d) => d.id === 'dlv_0192') ?? DELIVERIES[1];
/** Seconds since midnight for an `at` time. */
export const secondsOf = (at: string): number => { const [h, m, s] = at.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };

export type Target = 'localhost' | 'staging' | 'production';
export const TARGETS: { id: Target; label: string; url: string; note: string }[] = [
  { id: 'localhost', label: 'localhost:3000', url: 'http://localhost:3000/hooks/payments', note: 'Through the Tarn CLI tunnel on your machine.' },
  { id: 'staging', label: 'Staging', url: 'https://staging.api.yourapp.example/hooks/payments', note: 'Your shared test environment.' },
  { id: 'production', label: 'Production', url: 'https://api.yourapp.example/hooks/payments', note: 'Needs a second confirmation, every time.' },
];

/** The differentiator: what a provider re-send changes versus a Tarn replay. */
export const RESEND_DIFF: { key: string; original: string; resent: string }[] = [
  { key: 'id', original: '"evt_8Kq2wR"', resent: '"evt_9Tz0mB"' },
  { key: 'created', original: '1795592467', resent: '1795603112' },
  { key: 'api_version', original: '"2026-09-01"', resent: '"2026-11-15"' },
  { key: 'amount_paid', original: '4900', resent: '4900' },
];

export interface Plan {
  id: 'hobby' | 'team' | 'business';
  name: string;
  forWhom: string;
  monthly: number;
  /** Total for twelve months when billed yearly. */
  yearly: number;
  quota: string;
  features: string[];
  cta: string;
  recommended?: string;
}
export const PLANS: Plan[] = [
  { id: 'hobby', name: 'Hobby', forWhom: 'Side projects and trying Tarn out', monthly: 0, yearly: 0, quota: '10,000 deliveries a month', features: ['1 inbox, 7-day retention', 'Replay to localhost only', 'Search and copy as curl'], cta: 'Create a free inbox' },
  { id: 'team', name: 'Team', forWhom: 'Teams running 2–10 services', monthly: 24, yearly: 240, quota: '500,000 deliveries a month', features: ['Unlimited inboxes, 30-day retention', 'Replay to any target, with a production guard', 'Redaction rules before storage', '5 seats included'], cta: 'Start a 14-day Team trial', recommended: 'Most teams with more than one service need replays beyond localhost; this is the smallest plan that allows them.' },
  { id: 'business', name: 'Business', forWhom: 'Companies with compliance reviews', monthly: 79, yearly: 790, quota: '5 million deliveries a month', features: ['90-day retention, EU or US region', 'Forward-only mode: bodies never stored', 'SSO and an audit log', 'Unlimited seats'], cta: 'Start a 14-day Business trial' },
];
export const OVERAGE = '$4 per extra 100,000 deliveries; we email you at 80% of your quota and never pause an inbox without telling you.';

export const FAQ: { q: string; a: string[] }[] = [
  { q: 'What happens to personal data inside payloads?', a: ['Tarn stores what your providers send. On Team and Business, redaction rules mask fields such as card numbers or email addresses before anything is written to disk.', 'On Hobby, payloads are stored as sent for 7 days. Any inbox can be purged in one action from its settings.'] },
  { q: 'If Tarn is down, do I lose webhooks?', a: ['Tarn answers 200 only after a delivery is stored. While it is unreachable your providers see an error and retry, as they do for any endpoint, so an outage delays deliveries rather than dropping them. How long providers keep retrying is up to them, typically hours.'] },
  { q: 'Can a replay reach production by accident?', a: ['Only if you choose it. Production targets show their full URL on the button and need a second confirmation every time. Hobby inboxes can only replay to localhost.'] },
  { q: 'Will my signature check pass on a replay?', a: ['Tarn keeps the original bytes and headers, so a signature computed over the body still matches. Checks that also reject old timestamps will fail on an old delivery; use your provider’s test secret or a wider tolerance in development.'] },
  { q: 'Can we self-host Tarn?', a: ['Not today. If payloads must stay inside your network, Business can run in forward-only mode: deliveries are passed straight to your endpoint and only their metadata is kept.'] },
  { q: 'How do I cancel?', a: ['From Settings → Billing, in two clicks, with no call. You keep access until the end of the period you paid for, and exports stay available for 30 days.'] },
];

export const formatUsd = (n: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
