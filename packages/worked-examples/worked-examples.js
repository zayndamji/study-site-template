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

  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /**
   * The value a button carries: data-load (JSON or a plain string), merged with any
   * data-load-<key> attributes ({ key: value }; each value is JSON or a plain string).
   * Returns undefined when the button carries nothing.
   */
  function valueOf(b) {
    let v = 'load' in b.dataset ? parseValue(b.dataset.load) : undefined;
    const extra = {};
    let any = false;
    for (const k in b.dataset) {
      const m = /^load([A-Z0-9].*)$/.exec(k);
      if (!m) continue;
      extra[m[1].charAt(0).toLowerCase() + m[1].slice(1)] = parseValue(b.dataset[k]);
      any = true;
    }
    if (!any) return v;
    if (v === undefined || v === null) return extra;
    return isPlain(v) ? Object.assign({}, v, extra) : Object.assign({ value: v }, extra);
  }

  /**
   * Send value to the element with id targetId through core Study.send: fill its named fields
   * (option fillFields), then dispatch option eventName (default "load") with the value as detail.
   */
  function load(targetId, value, from) {
    const target = Study.send(targetId, value, { event: opts.eventName || 'load', fill: opts.fillFields !== false });
    if (!target) return false;
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
    // only buttons that name a target: a bare data-load is left to the page's own script
    const sel = opts.selector || '.exm [data-target], .exm-load[data-target]';
    Study.$$(root, sel).forEach((b) => {
      if ('enhanced' in b.dataset || !b.dataset.target) return;
      if (valueOf(b) === undefined) return;
      b.dataset.enhanced = '';
      if (b.tagName === 'BUTTON' && !b.hasAttribute('type')) b.type = 'button';
      if (!b.textContent.trim()) b.textContent = opts.loadLabel || 'Load in widget';
      b.addEventListener('click', () => load(b.dataset.target, valueOf(b), b.closest('.exm')));
    });
  }

  /** Only the field writing (respects option fillFields); returns how many controls changed. */
  const fill = (target, value) => (opts.fillFields === false ? 0 : Study.fill(target, value));
  Study.examples = { load, flash, fill, valueOf };
  Study.define('worked-examples', { enhance });
})();
