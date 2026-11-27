import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'live-monitoring',
  name: 'Switchyard agent fleet',
  specialty: 'data',
  summary: 'Simulated live monitoring of a fictional freight company’s AI-agent fleet: a one-second seeded stream, lamp-lit status cells with latency sparklines, anomaly rules with stated thresholds, an event log that holds still while you read it, and a pause that freezes the view while data keeps arriving.',
  highlights: [
    'The stream is stateless: every sample is a pure function of seed, agent and wall-clock second, so history, catch-up after a background tab and live ticks all agree.',
    'Anomaly rules run on the stream as it arrives — latency z-score against a frozen 2-minute baseline, a 10-second error rate, throughput against its own average — and every event states the rule and the numbers.',
    'Selecting an agent swaps the fleet chart for that agent’s p95 with its expected band and anomalous spans; switching the 1/5/15-minute window morphs values and domain together (the line-chart-morph technique, adapted locally because the recipe component ships its own dataset).',
    'Calm by design (Essential): KPI numbers jump on purpose (no tweening of live values), no re-sorting, nothing flashes; the only self-moving element is one token-timed ring per received tick on the status lamp, stopped by Pause.',
    'Crisp controls: Pause, the window segments, agent cells and buttons have hover, instant pressed and focus states with one-tick releases (Essential tokens × 0.7); an agent cell keeps its status bar and its selection ring together.',
    'Designed states: connecting (before the first sample), live, paused with “N s behind”, stale, and an operator-paused agent with no samples rather than zeros; the log freezes under pointer or focus and offers “Show N new”.',
  ],
  technology: ['d3', 'svg', 'waapi', 'css'],
  uses: [],
  adapts: ['line-chart-morph'],
  has3d: false,
  accessibility: [
    'Pause stream is a real button (aria-pressed) and freezes every visual update (WCAG 2.2.2); pausing and resuming are announced.',
    'One polite status region announces new anomalies only, summarised, at most once every 15 seconds — never every tick.',
    'Status is word + shape + colour (square healthy, triangle degraded, octagon failing, bars paused); anomalies also carry a text chip.',
    'Agent cells are buttons with their full readout as text; “View as table” lists every agent’s current values; the chart is an image with a computed summary that is also printed below it.',
    'The event log is a focusable scroll region that holds still while focused or hovered; at either end of the log the wheel carries on to the page (no overscroll containment).',
  ],
  reducedMotion: 'The live lamp stops ringing, window changes cut instead of morphing, and pressed states apply without a release transition; values still update every second unless paused.',
  performance: [
    'One 1 s interval drives everything; a tick appends 11 samples, runs three O(120) rules per agent and re-renders once.',
    'Windows are resampled to 240 points (max-preserving for latency so spikes survive); sparklines draw 60 points each.',
    'Buffers hold 15 minutes (900 ticks) per agent and are trimmed in place; a long background gap rebuilds instead of replaying.',
  ],
  dataNote: 'Simulated stream (seed 4127): seeded value noise, jitter and hashed incidents per agent and second, timestamped with your clock in UTC. Agent names, the company and every figure are invented; no real models, customers or systems.',
};
