/* focus-layout: expand/collapse all, open folds around link targets, unfold for print. */
(function () {
  'use strict';
  Study.define('focus-layout', {
    init(S) {
      const o = S.options('focus-layout');
      const root = document.documentElement;
      if (o.moreIcon) root.style.setProperty('--fl-more', JSON.stringify(String(o.moreIcon)));
      if (o.checkIcon) root.style.setProperty('--fl-check', JSON.stringify(String(o.checkIcon)));
      const article = document.querySelector('article');
      if (!article) return;
      const folds = () => [...article.querySelectorAll('details.reveal')];
      const page = document.body.dataset.kind + ':' + document.body.dataset.page;

      if (o.toggle && folds().length) {
        const btn = S.h('button', { type: 'button', class: 'btn fl-toggle' });
        const sync = () => { btn.textContent = folds().every((d) => d.open) ? o.collapseLabel : o.expandLabel; };
        btn.addEventListener('click', () => {
          const open = !folds().every((d) => d.open);
          folds().forEach((d) => { d.open = open; });
          sync();
        });
        article.addEventListener('toggle', sync, true);
        const theme = document.querySelector('.topbar [data-theme-toggle]');
        if (theme) theme.before(btn); else document.querySelector('.topbar')?.append(btn);
        sync();
      }

      const openAround = (el) => {
        let d = el && el.closest('details');
        while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); }
      };
      if (o.openOnHash) {
        const go = () => {
          if (!location.hash) return;
          let t = null; try { t = document.querySelector(decodeURIComponent(location.hash)); } catch (e) { return; }
          if (!t) return;
          openAround(t); if (t.tagName === 'DETAILS') t.open = true;
          t.scrollIntoView({ block: 'start' }); t.classList.add('fl-flash');
          setTimeout(() => t.classList.remove('fl-flash'), 1300);
        };
        window.addEventListener('hashchange', go);
        go();
      }

      if (o.printOpen) {
        let was = [];
        window.addEventListener('beforeprint', () => { was = folds().map((d) => d.open); folds().forEach((d) => { d.open = true; }); });
        window.addEventListener('afterprint', () => { folds().forEach((d, i) => { d.open = !!was[i]; }); });
      }

      if (o.remember) {
        const key = 'focus-layout:open:' + page;
        const saved = new Set(S.store.get(key, []));
        folds().forEach((d, i) => {
          const id = d.id || 'f' + i;
          if (saved.has(id)) d.open = true;
          d.addEventListener('toggle', () => { d.open ? saved.add(id) : saved.delete(id); S.store.set(key, [...saved]); });
        });
      }
    },
  });
})();
