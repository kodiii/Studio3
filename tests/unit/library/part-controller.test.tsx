// @vitest-environment jsdom
/**
 * PartController lifecycle: StrictMode runs effect cleanup (dispose) then setup again on the SAME core.
 * Setup must re-attach and re-apply the props, or the controller goes inert. R3F hooks are mocked: the
 * controller only needs `invalidate` and a frame hook, so no WebGL context is involved.
 */
import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDomShims, type Shims } from './dom-shims';
import { PartController, PartControllerCore } from '../../../plugins/maquettekit/library/src/three/components/PartController';

vi.mock('@react-three/fiber', () => ({
  useThree: (sel: (s: { invalidate: () => void }) => unknown) => sel({ invalidate: () => {} }),
  useFrame: () => {},
}));

let shims: Shims;
beforeAll(() => { shims = installDomShims(); });
afterAll(() => shims.restore());
afterEach(() => cleanup());

const model = () => {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Shell', color: '#888888' }));
  body.name = 'Body';
  body.userData = { label: 'Body', explodeDirection: [0, 1, 0], explodeDistance: 1 };
  const lid = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Lid', color: '#222222' }));
  lid.name = 'Lid';
  lid.userData = { label: 'Lid' };
  root.add(body, lid);
  return { root, body, lid, shell: body.material, lidMat: lid.material };
};
const hex = (m: unknown) => (m as MeshStandardMaterial).color.getHexString();

describe('PartControllerCore dispose / reattach', () => {
  it('dispose() restores the model and makes the core inert; reattach() makes it live again', () => {
    const { root, body, shell } = model();
    const core = new PartControllerCore(root);
    expect(core.reattach()).toBe(false); // not disposed: no-op
    core.setOverrides({ 'part:Body': { color: '#ff0000' } });
    expect(body.material).not.toBe(shell);
    core.setExplode(1);
    core.dispose();
    expect(body.material).toBe(shell);
    expect(body.position.y).toBe(0);
    core.setOverrides({ 'part:Body': { color: '#ff0000' } });
    expect(body.material).toBe(shell); // inert while disposed
    expect(core.reattach()).toBe(true);
    expect(body.position.y).toBeCloseTo(1); // explode amount re-applied
    core.setOverrides({ 'part:Body': { color: '#ff0000' } });
    core.setSelected('Body');
    expect(hex(body.material)).toBe('ff0000');
    expect((body.material as MeshStandardMaterial).emissive.getHexString()).not.toBe('000000');
    expect(hex(shell)).toBe('888888'); // the cached original is never mutated
  });
});

describe('<PartController> under StrictMode', () => {
  it('stays live after the StrictMode cleanup/setup cycle and restores the model on unmount', () => {
    const { root, body, lid, shell } = model();
    const onReady = vi.fn((_parts: unknown, core: PartControllerCore) => core.root.getObjectByName('Body') as Mesh);
    const el = (color: string) => (
      <StrictMode>
        <PartController root={root} overrides={{ 'part:Body': { color } }} hidden={['Lid']} selected="Body" onReady={onReady} />
      </StrictMode>
    );
    const view = render(el('#ff0000'));
    expect(hex(body.material)).toBe('ff0000');
    expect(body.material).not.toBe(shell);
    expect(lid.visible).toBe(false);
    expect((body.material as MeshStandardMaterial).emissive.getHexString()).not.toBe('000000');
    // onReady runs after the props are applied: callers see the override clone, not the cached original
    expect(onReady.mock.results.at(-1)!.value.material).toBe(body.material);
    view.rerender(el('#00ff00'));
    expect(hex(body.material)).toBe('00ff00');
    view.unmount();
    expect(body.material).toBe(shell);
    expect(lid.visible).toBe(true);
    expect(hex(shell)).toBe('888888');
  });
});
