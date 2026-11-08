/* summaries: group filter and print button on the all-sheets page */
(function () {
  'use strict';
  Study.define('summaries', {
    init(S) {
      document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));
      const buttons = [...document.querySelectorAll('[data-sheet-filter]')];
      if (!buttons.length) return;
      const sections = [...document.querySelectorAll('[data-sheet-group]')];
      const rail = new Map([...document.querySelectorAll('.toc a')].map((a) => [a.getAttribute('href').slice(1), a.closest('li')]));
      function apply(f) {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sheetFilter === f)));
        sections.forEach((s) => {
          const hide = f !== 'all' && s.dataset.sheetGroup !== f;
          s.hidden = hide;
          const li = rail.get(s.id); if (li) li.hidden = hide;
        });
        document.querySelectorAll('.toc .toc-group').forEach((g) => {
          let n = g.nextElementSibling, any = false;
          while (n && !n.classList.contains('toc-group')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
          g.hidden = !any;
        });
        S.store.set('summaries:filter', f);
      }
      buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.sheetFilter)));
      const saved = S.store.get('summaries:filter', 'all');
      // a link to one sheet (#s-…) always shows everything so the target is visible
      apply(location.hash || !buttons.some((b) => b.dataset.sheetFilter === saved) ? 'all' : saved);
    },
  });
})();
