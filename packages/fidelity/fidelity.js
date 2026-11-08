/* fidelity: fills marker labels in content added after load (the build fills the static HTML).
   <span class="beyond"></span> · <div class="beyond-block"> · <div class="erratum"><span class="lbl"></span>… */
(function () {
  'use strict';
  const O = Study.options('fidelity');
  const all = (root, sel) => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
  function label(box, text) {
    if (!text) return;
    const lbl = [...box.children].find((c) => c.classList.contains('lbl'));
    if (lbl) { if (!lbl.textContent.trim()) lbl.textContent = text; return; }
    box.prepend(Study.h('span', { class: 'lbl', text }));
  }
  Study.define('fidelity', {
    enhance(root) {
      all(root, 'span.beyond').forEach((el) => { if (!el.textContent.trim() && !el.children.length && O.beyondLabel) el.textContent = O.beyondLabel; });
      all(root, '.beyond-block').forEach((el) => label(el, O.beyondBlockLabel));
      all(root, '.erratum').forEach((el) => label(el, O.erratumLabel));
    },
  });
})();
