/* worked-examples — "more worked examples" cards with a collapsible solution
   and buttons that load the example into a widget on the page.
   See packages/worked-examples/README.md for the markup and options. */
(function () {
  'use strict';
  const opts = Study.options('worked-examples');
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = new WeakMap();

  function parseValue(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  /** Scroll target into view and highlight it briefly (class exm-flash). */
  function flash(target) {
    if (opts.scroll !== false) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    const ms = typeof opts.flashMs === 'number' ? opts.flashMs : 1200;
    if (ms <= 0) return;
    clearTimeout(timers.get(target));
    target.classList.remove('exm-flash');
    void target.offsetWidth; // restart the animation when clicked twice
    target.style.setProperty('--exm-flash-ms', ms + 'ms');
    target.classList.add('exm-flash');
    timers.set(target, setTimeout(() => target.classList.remove('exm-flash'), ms));
  }

  /** Send value to the element with id targetId as a CustomEvent (option eventName, default "load"). */
  function load(targetId, value, from) {
    const target = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
    if (!target) { console.warn('[study] worked-examples: no element with id "' + targetId + '"'); return false; }
    target.dispatchEvent(new CustomEvent(opts.eventName || 'load', { detail: value, bubbles: false }));
    Study.emit('example:load', { target: target.id, value, example: from && from.id ? from.id : null });
    flash(target);
    return true;
  }

  function enhance(root) {
    const all = [...document.querySelectorAll('.exm')];
    root.querySelectorAll('.exm:not([data-enhanced])').forEach((card) => {
      card.dataset.enhanced = '';
      if (opts.numbering !== false) {
        const n = card.querySelector('.exm-n');
        if (n && !n.textContent.trim()) n.textContent = String(opts.numberLabel || 'Example {n}').replace('{n}', all.indexOf(card) + 1);
      }
      card.querySelectorAll('details.exm-sol').forEach((d) => {
        let s = d.querySelector(':scope > summary');
        if (!s) { s = document.createElement('summary'); d.prepend(s); }
        if (!s.textContent.trim()) s.textContent = opts.solutionLabel || 'Show solution';
      });
    });
    const buttons = root.querySelectorAll('.exm [data-load]:not([data-enhanced]), .exm-load[data-load]:not([data-enhanced])');
    buttons.forEach((b) => {
      b.dataset.enhanced = '';
      if (b.tagName === 'BUTTON' && !b.hasAttribute('type')) b.type = 'button';
      if (!b.textContent.trim()) b.textContent = opts.loadLabel || 'Load in widget';
      b.addEventListener('click', () => load(b.dataset.target, parseValue(b.dataset.load), b.closest('.exm')));
    });
  }

  Study.examples = { load, flash };
  Study.define('worked-examples', { enhance });
})();
