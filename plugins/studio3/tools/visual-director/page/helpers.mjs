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
  try {
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type) {
      try {
        if ((type === 'click' || type === 'mousedown' || type === 'pointerdown') && this && /** @type {any} */ (this).nodeType === 1) clickTargets.add(this);
      } catch { /* ignore */ }
      return origAdd.apply(this, /** @type {any} */ (arguments));
    };
  } catch { /* ignore */ }

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
    value: { sel, visible, text, deepActive, clickTargets, INTERACTIVE, POPUP, kb: null },
    enumerable: false, configurable: false, writable: false,
  });
}
