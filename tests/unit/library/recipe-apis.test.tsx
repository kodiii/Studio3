// @vitest-environment jsdom
/**
 * The composition APIs the Lead & Lag demo relies on: LottieIcon forwards its ref and data-* / aria-* props, and the
 * cursor follower re-reads a hovered target whose attributes change and takes the colours of a [data-cursor-area].
 */
import { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { installDomShims, type Shims } from './dom-shims';
import { LottieIcon } from '../../../plugins/maquettekit/library/src/effects/lottie-micro-interactions';
import { ICONS } from '../../../plugins/maquettekit/library/src/effects/lottie-micro-interactions/icons';
import { FollowerEngine, type FollowerOptions } from '../../../plugins/maquettekit/library/src/effects/cursor-follower/engine';
import { spring } from '../../../plugins/maquettekit/library/src/motion';

let shims: Shims;
beforeAll(() => { shims = installDomShims(); });
afterAll(() => shims.restore());
afterEach(() => { cleanup(); document.body.innerHTML = ''; });

describe('LottieIcon', () => {
  it('forwards its ref and passes data-* and aria-* props to the button; its own state attributes win', () => {
    const ref = createRef<HTMLButtonElement>();
    const data = ICONS.heart.build(2);
    const { getByRole } = render(
      <LottieIcon
        ref={ref}
        animationData={data}
        segments={ICONS.heart.segments}
        label="Save"
        pressed
        data-cursor="magnet"
        data-save=""
        aria-describedby="hint"
        aria-pressed={false}
      />,
    );
    const button = getByRole('button', { name: 'Save' });
    expect(ref.current).toBe(button);
    expect(button.getAttribute('data-cursor')).toBe('magnet');
    expect(button.hasAttribute('data-save')).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('hint');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('data-state')).toBe('on');
  });
});

function pointer(type: string, target: Element, x = 10, y = 10): void {
  const e = new MouseEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  target.dispatchEvent(e);
}

function follower() {
  const scope = document.createElement('div');
  document.body.appendChild(scope);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K) => document.createElement(tag);
  const svg = () => document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const layers = [el('div'), el('div')];
  const labels: string[] = [];
  const opts: FollowerOptions = { follow: spring.release, size: 36, stretch: 0.55, dot: true, pull: 0.3, padding: 8 };
  const engine = new FollowerEngine(
    { scope, layers, ringBody: el('div'), ring: svg(), dot: el('div'), labelBody: el('div'), fill: el('div'), fillRect: svg(), shadow: el('div'), text: el('span') },
    () => opts,
    { wake: () => {}, sleep: () => {}, label: (t) => labels.push(t), state: () => {} },
    false,
  );
  engine.attach();
  return { scope, layers, labels, engine };
}

describe('CursorFollower engine', () => {
  it('re-reads the label of the hovered target when it changes under a resting pointer', async () => {
    const { scope, labels, engine } = follower();
    const hit = document.createElement('span');
    hit.setAttribute('data-cursor-label', 'Play');
    scope.appendChild(hit);
    pointer('pointermove', hit);
    expect(labels).toEqual(['Play']);
    hit.setAttribute('data-cursor-label', 'Pause');
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver callbacks are microtasks
    expect(labels).toEqual(['Play', 'Pause']);
    engine.detach();
    hit.setAttribute('data-cursor-label', 'Play');
    await new Promise((r) => setTimeout(r, 0));
    expect(labels).toEqual(['Play', 'Pause']); // nothing observed after detach
  });

  it('takes the colours of a [data-cursor-area] while the pointer is inside it, and gives them back', () => {
    const { scope, layers, engine } = follower();
    const area = document.createElement('section');
    area.setAttribute('data-cursor-area', '');
    area.style.setProperty('--cursor-ring', '#f1ebde');
    area.style.setProperty('--cursor-halo', '#0b0a08');
    const inner = document.createElement('p');
    area.appendChild(inner);
    const outside = document.createElement('p');
    scope.append(area, outside);
    pointer('pointermove', inner);
    for (const l of layers) {
      expect(l.style.getPropertyValue('--cursor-area-ring')).toBe('#f1ebde');
      expect(l.style.getPropertyValue('--cursor-area-halo')).toBe('#0b0a08');
    }
    pointer('pointermove', outside);
    for (const l of layers) expect(l.style.getPropertyValue('--cursor-area-ring')).toBe('');
    pointer('pointermove', inner);
    engine.detach();
    for (const l of layers) expect(l.style.getPropertyValue('--cursor-area-ring')).toBe('');
  });
});
