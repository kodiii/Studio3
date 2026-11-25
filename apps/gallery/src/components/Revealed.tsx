'use client';
import { useEffect } from 'react';

/**
 * Renders nothing. Placed beside lazy content inside a Suspense boundary, its effect runs once that content is on
 * screen — the moment a stage can drop aria-busy.
 */
export function Revealed({ onReveal }: { onReveal: () => void }) {
  useEffect(() => { onReveal(); }, [onReveal]);
  return null;
}
