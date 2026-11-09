/* resume-link: core.js stores the last opened page's href as `last-page`; show it on home. */
(function () {
  'use strict';
  Study.define('resume-link', {
    init(S) {
      const o = S.options('resume-link');
      if (S.page && o.kinds && !o.kinds.includes(S.page.kind)) return;
      if (!document.body.classList.contains('home')) {
        if (S.page) S.store.set('resume-link:last', S.page.href);
        return;
      }
      const href = S.store.get('resume-link:last', S.store.get('last-page', ''));
      const p = S.pages.find((x) => x.href === href && x.status === 'ready');
      if (!p) return;
      const k = (S.config.kinds || {})[p.kind] || {};
      const text = String(o.label).replace('{title}', p.title).replace('{label}', p.label).replace('{id}', p.id).replace('{badge}', p.badge || p.id).replace('{num}', p.num == null ? p.id : String(p.num)).replace('{noun}', k.noun || '');
      const a = S.h('a', { class: 'home-extra resume-link', href: p.href, text });
      const host = o.where === 'tools' ? document.querySelector('.catalog-tools') : document.querySelector('.home-intro');
      if (host) host.append(a);
    },
  });
})();
