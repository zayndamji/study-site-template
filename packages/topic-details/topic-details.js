/* topic-details: toggles body.show-topics, which reveals each row's .sub description. */
(function () {
  'use strict';
  Study.define('topic-details', {
    init(S) {
      const box = document.getElementById('topic-details');
      if (!box) return;
      const o = S.options('topic-details');
      const on = o.remember ? S.store.get('topic-details:on', !!o.defaultOn) : !!o.defaultOn;
      const apply = (v) => { box.checked = v; document.body.classList.toggle('show-topics', v); };
      apply(on);
      box.addEventListener('change', () => { apply(box.checked); if (o.remember) S.store.set('topic-details:on', box.checked); });
    },
  });
})();
