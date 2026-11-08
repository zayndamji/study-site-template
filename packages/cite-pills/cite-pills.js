/* cite-pills: <span class="cite" data-page="42">Ex 1.2</span> → pill "Ex 1.2 · p. 42".
   Optional link to a PDF page (option href), several sources (data-source + option sources),
   <td class="cite"> in tables (no pill chrome). Idempotent: processed elements get data-cp. */
(function () {
  'use strict';
  const O = Study.options('cite-pills');
  const root = document.documentElement;
  root.setAttribute('data-cp-icon', O.icon || 'book');
  if (O.sourcePill !== false) root.setAttribute('data-cp-src', '');

  const fill = (tpl, vals, enc) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vals ? (enc ? encodeURIComponent(vals[k]) : vals[k]) : m));
  const cfgFor = (el) => Object.assign({}, O, (el.dataset.source && O.sources && O.sources[el.dataset.source]) || {});

  function linkify(el, url, c) {
    const a = document.createElement('a');
    a.href = url;
    if (c.newTab !== false) { a.target = '_blank'; a.rel = 'noopener'; }
    if (el.tagName === 'TD') {            // keep the cell; link its contents
      while (el.firstChild) a.append(el.firstChild);
      el.append(a);
      return el;
    }
    [...el.attributes].forEach((at) => a.setAttribute(at.name, at.value));
    while (el.firstChild) a.append(el.firstChild);
    el.replaceWith(a);
    return a;
  }

  function pill(el) {
    if (el.hasAttribute('data-cp')) return;
    el.setAttribute('data-cp', '');
    const c = cfgFor(el);
    const isCell = el.tagName === 'TD';
    if (!isCell) el.classList.add('cp-pill');
    if (c.icon && c.icon !== O.icon) el.classList.add('cp-icon-' + c.icon);
    const page = (el.dataset.page || '').trim();
    if (!page) return;
    const n = Number(page);
    const pdfPage = el.dataset.pdfPage || (page !== '' && isFinite(n) ? String(n + (Number(c.offset) || 0)) : page);
    const vals = { page, pdfPage };
    const old = el.querySelector(':scope > .pg, :scope > .cp-pg');
    if (old) old.classList.add('cp-pg');
    else if (c.pageLabel) el.append(Study.h('span', { class: 'cp-pg', text: fill(c.pageLabel, vals) }));
    if (c.title && !el.title) el.title = fill(c.title, vals);
    if (c.href && el.tagName !== 'A') linkify(el, fill(c.href, vals, true), c);
  }

  Study.define('cite-pills', {
    enhance(r) {
      [...(r.matches && r.matches('.cite') ? [r] : []), ...r.querySelectorAll('.cite')]
        .forEach((el) => { if (el.tagName === 'SPAN' || el.tagName === 'TD' || el.tagName === 'A') pill(el); });
    },
  });
})();
