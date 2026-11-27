'use client';
import { useCallback, useEffect, useRef } from 'react';
import { cssEase, duration as D } from '../../motion';

/**
 * The surface's signature move: when a DOM control drives a state machine input, a signal-coloured cue light sweeps
 * under that input's readout, in the same frame the canvas starts to react. Under reduced motion the readout only
 * flashes (opacity, ≤ 200 ms). Running sweeps are cancelled on unmount.
 */
export function useCueSweep(reduced: boolean): (el: Element | null) => void {
  const running = useRef(new Map<Element, Animation>());
  useEffect(() => {
    const map = running.current;
    return () => { for (const a of map.values()) a.cancel(); map.clear(); };
  }, []);
  return useCallback((el: Element | null) => {
    if (!el || typeof el.animate !== 'function') return;
    const map = running.current;
    map.get(el)?.cancel();
    const a = reduced
      ? el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: D.fast, easing: 'linear' })
      // The cue element paints `background: linear-gradient(accent) no-repeat` at 0 size (see .cueValue): the light
      // grows in from the left, holds, and leaves to the right. The value text starts in the accent and eases back.
      : el.animate(
        [
          { backgroundSize: '0% 2px', backgroundPosition: '0% 100%', color: 'var(--mk-accent, #bf2f09)' },
          { backgroundSize: '100% 2px', backgroundPosition: '0% 100%', offset: 0.42 },
          { backgroundSize: '100% 2px', backgroundPosition: '100% 100%', offset: 0.58 },
          { backgroundSize: '0% 2px', backgroundPosition: '100% 100%' },
        ],
        { duration: D.slow + D.base, easing: cssEase('inOut') },
      );
    map.set(el, a);
    const done = () => { if (map.get(el) === a) map.delete(el); };
    a.finished.then(done, done);
  }, [reduced]);
}
