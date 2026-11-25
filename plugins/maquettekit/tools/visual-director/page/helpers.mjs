// @ts-check
/**
 * Page-side helper library, installed with context.addInitScript().
 * Self-contained: must not reference anything outside its own body.
 * Exposes a non-enumerable `window.__S3VD__` used by the page-evaluated check functions.
 */
export function installPageHelpers() {
  const w = /** @type {any} */ (window);
  if (w.__S3VD__) return;
  const clickTargets = new WeakSet();
  /** Pointer-input event types whose handlers only run when the pointer actually reaches the element. */
  const POINTER_TYPES = ['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'pointerenter', 'pointerleave', 'pointerover', 'pointerout', 'pointermove',
    'mousedown', 'mouseup', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousemove', 'touchstart', 'touchend'];
  /** element → { type: listener count } for pointer-input listeners added with addEventListener */
  const listenerTypes = new WeakMap();
  try {
    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type) {
      try {
        if (this && /** @type {any} */ (this).nodeType === 1) {
          if (type === 'click') clickTargets.add(this);
          if (POINTER_TYPES.indexOf(type) !== -1) {
            const rec = listenerTypes.get(this) || {};
            rec[type] = (rec[type] || 0) + 1;
            listenerTypes.set(this, rec);
          }
        }
      } catch { /* ignore */ }
      return origAdd.apply(this, /** @type {any} */ (arguments));
    };
    EventTarget.prototype.removeEventListener = function (type) {
      try {
        const rec = this && listenerTypes.get(this);
        if (rec && rec[type]) rec[type] -= 1;
      } catch { /* ignore */ }
      return origRemove.apply(this, /** @type {any} */ (arguments));
    };
  } catch { /* ignore */ }

  const REACT_EVENT = /^on(Click|DoubleClick|ContextMenu|Pointer(?:Down|Up|Enter|Leave|Over|Out|Move)|Mouse(?:Down|Up|Enter|Leave|Over|Out|Move)|Touch(?:Start|End))(?:Capture)?$/;
  /**
   * Pointer-input handler types attached to an element: native listeners, inline/property handlers (onclick=…),
   * React props (React delegates events to the root, but keeps each element's props on a `__reactProps$…` key)
   * and Solid's delegated `$$click` style handlers. Returns [] when none are known.
   * @param {any} el
   */
  function handlerTypes(el) {
    const out = new Set();
    if (!el || el.nodeType !== 1) return [];
    const rec = listenerTypes.get(el);
    if (rec) for (const t of Object.keys(rec)) if (rec[t] > 0) out.add(t);
    for (const t of POINTER_TYPES) { try { if (typeof el['on' + t] === 'function') out.add(t); } catch { /* ignore */ } }
    let keys = [];
    try { keys = Object.keys(el); } catch { /* ignore */ }
    for (const k of keys) {
      if (k.startsWith('__reactProps$')) {
        const props = el[k];
        if (props && typeof props === 'object') {
          for (const name of Object.keys(props)) {
            const m = REACT_EVENT.exec(name);
            if (m && typeof props[name] === 'function') out.add(m[1] === 'DoubleClick' ? 'dblclick' : m[1].toLowerCase());
          }
        }
      } else if (k.startsWith('$$') && POINTER_TYPES.indexOf(k.slice(2)) !== -1 && typeof el[k] === 'function') {
        out.add(k.slice(2));
      }
    }
    return Array.from(out);
  }

  /** @param {any} el */
  function sel(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && cur !== document.documentElement && parts.length < 4) {
      if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id) && document.querySelectorAll('#' + cur.id).length === 1) {
        parts.unshift('#' + cur.id);
        return parts.join(' > ');
      }
      let p = cur.localName;
      const cls = Array.from(cur.classList).filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 2);
      if (cls.length) p += '.' + cls.join('.');
      const parent = cur.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.localName === cur.localName);
        if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
      }
      parts.unshift(p);
      cur = parent;
    }
    if (cur === document.body) parts.unshift('body');
    return parts.join(' > ');
  }

  /** @param {any} el */
  function visible(el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility === 'visible' && cs.opacity !== '0';
  }

  /** @param {any} el @param {number} [n] */
  function text(el, n) {
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim().slice(0, n || 80);
  }

  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  const INTERACTIVE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"])';
  const POPUP = 'dialog[open],[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[aria-modal="true"],[popover]';

  Object.defineProperty(w, '__S3VD__', {
    value: { sel, visible, text, deepActive, clickTargets, handlerTypes, POINTER_TYPES, INTERACTIVE, POPUP, kb: null },
    enumerable: false, configurable: false, writable: false,
  });
}
