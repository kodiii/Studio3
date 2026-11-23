/** Larder — fictional kitchen prep & ordering app. All names, copy and the prep list are sample content. */

export type StepId = 'kitchen' | 'role' | 'goals' | 'connect' | 'brigade' | 'done';
export type RoleId = 'head-chef' | 'owner' | 'sous-chef' | 'manager';
export type GoalId = 'prep' | 'orders' | 'waste' | 'allergens';
export type IntegrationId = 'till' | 'suppliers' | 'calendar';

export const STEPS: { id: Exclude<StepId, 'done'>; short: string }[] = [
  { id: 'kitchen', short: 'Kitchen' },
  { id: 'role', short: 'Role' },
  { id: 'goals', short: 'First lists' },
  { id: 'connect', short: 'Connect' },
  { id: 'brigade', short: 'Brigade' },
];
export const ORDER: StepId[] = ['kitchen', 'role', 'goals', 'connect', 'brigade', 'done'];
export const indexOf = (s: StepId) => ORDER.indexOf(s);

export const ROLES: { id: RoleId; name: string; note: string }[] = [
  { id: 'head-chef', name: 'Head chef', note: 'Opens on tomorrow’s prep and the order sheet.' },
  { id: 'owner', name: 'Owner', note: 'Opens on food cost and supplier spend.' },
  { id: 'sous-chef', name: 'Sous chef', note: 'Opens on the prep list for your section.' },
  { id: 'manager', name: 'Kitchen manager', note: 'Opens on stock counts and deliveries.' },
];

export const GOALS: { id: GoalId; name: string; note: string }[] = [
  { id: 'prep', name: 'Prep lists', note: 'What to make tomorrow, scaled to the bookings.' },
  { id: 'orders', name: 'Supplier orders', note: 'Order sheets from your par levels, ready by close.' },
  { id: 'waste', name: 'Waste log', note: 'What gets binned and why, tallied by the week.' },
  { id: 'allergens', name: 'Allergen sheet', note: 'Every dish against the 14 allergens, kept current.' },
];

export const INTEGRATIONS: { id: IntegrationId; name: string; note: string; reads: string }[] = [
  { id: 'till', name: 'Your till', note: 'Point of sale', reads: 'Reads covers and dishes sold, never card details.' },
  { id: 'suppliers', name: 'Supplier price lists', note: 'Emailed or uploaded', reads: 'Reads pack sizes and prices to cost each order.' },
  { id: 'calendar', name: 'Bookings calendar', note: 'Shared calendar', reads: 'Reads booking counts and private events.' },
];

export const PREP_LIST: { item: string; qty: string; for: string }[] = [
  { item: 'Shallots, brunoise', qty: '1.2 kg', for: 'Three dishes' },
  { item: 'Chicken stock', qty: '8 L', for: 'Sauce base, risotto' },
  { item: 'Pickled rhubarb', qty: '2 jars', for: 'Mackerel starter' },
  { item: 'Brown butter', qty: '600 g', for: 'Hake, cauliflower' },
  { item: 'Focaccia dough', qty: '2 trays', for: 'Bread service' },
];

export interface Data {
  kitchen: string;
  role: RoleId | null;
  goals: GoalId[];
  connected: IntegrationId[];
  invited: string[];
  /** Invite addresses typed but not yet sent, kept so Back/Forward or a reload never loses them. */
  drafts: string[];
  skipped: StepId[];
}
export const EMPTY: Data = { kitchen: '', role: null, goals: [], connected: [], invited: [], drafts: [], skipped: [] };

/* ── Validation (messages say how to fix) ─────────────────────────────── */
export function validateKitchen(v: string): string | null {
  const t = v.trim();
  if (!t) return 'Enter your kitchen’s name, the way your team says it.';
  if (t.length < 2) return 'Use at least 2 characters, for example “The Gannet”.';
  if (t.length > 40) return `Keep it to 40 characters or fewer (now ${t.length}). You can add the full name later.`;
  return null;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function validateEmail(v: string, others: string[]): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!EMAIL.test(t)) return 'Enter an email address like sam@yourkitchen.co.';
  if (others.some((o) => o.trim().toLowerCase() === t.toLowerCase())) return 'You’ve already added this address.';
  return null;
}

/* ── Persistence: the hash names the step, sessionStorage keeps the answers ─ */
export const STORAGE_KEY = 'studio3:larder-onboarding';
export const hashFor = (s: StepId) => `#larder-step=${s}`;
export function stepFromHash(hash: string): StepId | null {
  const m = /larder-step=([a-z]+)/.exec(hash);
  return m && (ORDER as string[]).includes(m[1]) ? (m[1] as StepId) : null;
}
export function load(): { step: StepId; data: Data } | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { step?: StepId; data?: Partial<Data> };
    return { step: v.step && ORDER.includes(v.step) ? v.step : 'kitchen', data: { ...EMPTY, ...v.data } };
  } catch { return null; }
}
export function save(step: StepId, data: Data): void {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data })); } catch { /* private mode: state just won't survive reload */ }
}
export function clear(): void {
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
/** The furthest step the answers allow (the kitchen name is the only hard requirement). */
export const allowed = (s: StepId, d: Data): StepId => (indexOf(s) > 0 && validateKitchen(d.kitchen) ? 'kitchen' : s);
