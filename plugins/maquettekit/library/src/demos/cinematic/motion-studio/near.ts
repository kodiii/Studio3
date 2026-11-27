'use client';
import { useEffect, useState, type RefObject } from 'react';

/** True once `ref` comes within `margin` of the viewport (stays true). Used to mount canvases lazily. */
export function useNear(ref: RefObject<Element | null>, margin = '500px'): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}
