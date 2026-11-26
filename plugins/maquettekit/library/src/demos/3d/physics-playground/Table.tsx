'use client';
/**
 * The workbench and its light. Pure three.js — no physics import — so the page can draw it the moment the canvas
 * starts, while the Rapier chunk is still downloading. The tabletop collider lives in World.tsx.
 *
 * One light direction for the whole page: the key comes from the upper left, slightly in front of the table, so
 * shadows fall down and to the right — the same direction as every DOM shadow on the page (styles.module.css).
 */
import { useEffect, useMemo } from 'react';
import { LightingRig, useQuality, type LightingPreset } from '../../../three';
import { TABLE } from './bodies';
import { createWoodMaterial, tableGeometry } from './wood';

/** Key light position: upper left of the frame, a little in front (see KEY_SHADOW in World.tsx). */
export const KEY_LIGHT: [number, number, number] = [-6, 9, 1];

/** A warm workshop: a big window on the left (the key's source), a soft ceiling, a cool bounce from the right. */
const WORKSHOP: LightingPreset = {
  label: 'Workshop', description: 'Window light from the upper left, warm room, cool bounce.', exposure: 1,
  ambient: { color: '#fff1de', intensity: 0.12 },
  // The key is drawn by <KeyLight> (it casts the shadow map); the rig only provides the environment and the fill.
  key: { color: '#fff1dc', intensity: 0, position: KEY_LIGHT },
  fill: { color: '#dfe6f5', intensity: 0.32, position: [6, 3.5, 5] },
  env: {
    room: '#3b3027', intensity: 0.95, panels: [
      { color: '#fff3e0', intensity: 11, position: [-7, 6, 1.5], size: [5, 5] },
      { color: '#ffe9cc', intensity: 2.6, position: [0, 8, 0], size: [9, 7] },
      { color: '#cfdcf2', intensity: 1.6, position: [7, 2.5, 3], size: [4, 4] },
      { color: '#c98a4e', intensity: 0.9, position: [0, -4, 4], size: [12, 3] },
    ],
  },
};

export function Lights() {
  const { shadows, shadowMapSize } = useQuality();
  return (
    <>
      <LightingRig preset={WORKSHOP} shadow="none" />
      <directionalLight
        position={KEY_LIGHT} intensity={2.5} color="#fff1dc" castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]} shadow-bias={-0.00035} shadow-normalBias={0.025}
        shadow-camera-left={-5.2} shadow-camera-right={5.2} shadow-camera-top={5.2} shadow-camera-bottom={-5.2} shadow-camera-near={2} shadow-camera-far={26}
      />
    </>
  );
}

const PLANKS = 5;
const GAP = 0.016;
/** Visual thickness of the planks (the collider is TABLE.thickness; only the top face matters). */
const TOP = 0.22;
const PLANK_TONES = ['#c99e68', '#bf925f', '#cda672', '#c39862', '#c9a06b'];

/** Five planks with hairline gaps, a darker apron and four legs that run out of frame. */
export function Table() {
  const { shadows } = useQuality();
  const res = useMemo(() => {
    const depth = (TABLE.depth - GAP * (PLANKS - 1)) / PLANKS;
    const plank = tableGeometry.plank(TABLE.width, TOP, depth);
    const planks = PLANK_TONES.map((color, i) => createWoodMaterial({ color, seed: 17 + i * 7, scale: 1.25, rings: 2.1, grain: 0.3, roughness: 0.6 }).material);
    const frame = createWoodMaterial({ color: '#6b4a2f', seed: 5, scale: 1.8, rings: 2.4, grain: 0.24, roughness: 0.58 }).material;
    const railLong = tableGeometry.rail(TABLE.width - 0.76, 0.3, 0.12);
    const railShort = tableGeometry.rail(0.12, 0.3, TABLE.depth - 0.76);
    const leg = tableGeometry.leg(0.3, 3.6);
    return { depth, plank, planks, frame, railLong, railShort, leg };
  }, []);
  useEffect(() => () => {
    res.plank.dispose(); res.railLong.dispose(); res.railShort.dispose(); res.leg.dispose();
    res.planks.forEach((m) => m.dispose()); res.frame.dispose();
  }, [res]);

  const hx = TABLE.width / 2, hz = TABLE.depth / 2;
  return (
    <group>
      {res.planks.map((m, i) => (
        <mesh key={i} geometry={res.plank} material={m} receiveShadow={shadows} position={[0, -TOP / 2, -hz + res.depth / 2 + i * (res.depth + GAP)]} />
      ))}
      <mesh geometry={res.railLong} material={res.frame} position={[0, -TOP - 0.15, hz - 0.44]} />
      <mesh geometry={res.railLong} material={res.frame} position={[0, -TOP - 0.15, -hz + 0.44]} />
      <mesh geometry={res.railShort} material={res.frame} position={[hx - 0.44, -TOP - 0.15, 0]} />
      <mesh geometry={res.railShort} material={res.frame} position={[-hx + 0.44, -TOP - 0.15, 0]} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} geometry={res.leg} material={res.frame} position={[sx * (hx - 0.42), -TOP - 1.8, sz * (hz - 0.42)]} />
      ))}
    </group>
  );
}
