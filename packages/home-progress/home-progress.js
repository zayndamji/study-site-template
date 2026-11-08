/* home-progress: per-page review meters on the home catalog.
   Reads the keys core.js writes on each page: reviewed:<unit> (list) and total:<unit> (count).
   A page's total is only known after it has been opened once. */
(function () {
  'use strict';
  Study.define('home-progress', {
    init(S) {
      const o = S.options('home-progress');
      document.querySelectorAll('[data-search-row][data-unit]').forEach((row) => {
        const unit = row.dataset.unit;
        const done = (S.store.get('reviewed:' + unit, []) || []).length;
        const total = S.store.get('total:' + unit, 0);
        const state = row.querySelector('.state');
        if (!state || !total || (o.hideUnstarted && !done)) return;
        const pct = Math.round(100 * Math.min(done, total) / total);
        const text = done >= total && o.doneLabel ? o.doneLabel
          : String(o.label).replace('{done}', done).replace('{total}', total).replace('{percent}', pct);
        state.textContent = '';
        state.append(S.h('span', { class: 'hp-txt', text }));
        if (o.meter) state.append(S.h('span', { class: 'meter hp-meter', 'aria-hidden': 'true' }, S.h('span', { style: 'width:' + pct + '%' })));
        row.classList.toggle('hp-complete', done >= total);
      });
    },
  });
})();
