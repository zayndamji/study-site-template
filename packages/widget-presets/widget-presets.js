/* widget-presets — Study.presets: rows of annotated preset buttons for any
   widget. Each preset can carry a one-line note explaining why it is worth
   trying; the note of the chosen preset is shown under the row.
   See packages/widget-presets/README.md for the full API. */
(function () {
  'use strict';
  const opts = Study.options('widget-presets');
  const handles = new WeakMap();
  const byId = (x) => (typeof x === 'string' ? document.getElementById(x) : x);

  function makeNote(after) {
    const p = document.createElement('p');
    p.className = 'preset-note';
    p.setAttribute('aria-live', 'polite');
    p.hidden = true;
    after.insertAdjacentElement('afterend', p);
    return p;
  }

  /** Show html (author-written, may contain markup) in a note element; empty hides it. */
  function showNote(noteEl, html, label) {
    if (!noteEl) return;
    noteEl.replaceChildren();
    if (!html) { noteEl.hidden = true; return; }
    if (label) {
      const l = document.createElement('span');
      l.className = 'preset-note-label';
      l.textContent = label;
      noteEl.append(l, ' ');
    }
    const t = document.createElement('span');
    t.className = 'preset-note-text';
    t.innerHTML = html;
    noteEl.append(t);
    noteEl.hidden = false;
  }

  /**
   * mount(container, list, onPick, o) → handle
   *   list:   [{ name, note?, value?, … }] — the whole object is passed to onPick
   *   onPick: (preset, index) => void
   *   o.note: element for the notes; omitted → one is created after the
   *           container when any preset has a note; false → no notes
   *   o.selectFirst (package option): start with the first preset selected
   *   o.pickFirst (true): also call onPick for that first selection
   *   o.noteLabel (package option): text shown before each note
   */
  function mount(container, list, onPick, o) {
    container = byId(container);
    o = o || {};
    const old = handles.get(container);
    if (old && old.created) old.buttons.forEach((b) => b.remove());
    const label = o.noteLabel !== undefined ? o.noteLabel : opts.noteLabel;
    let noteEl = o.note === false ? null : byId(o.note) || (old && old.note) || null;
    if (!noteEl && o.note !== false && list.some((p) => p.note)) noteEl = makeNote(container);
    container.classList.add('presets');
    if (!container.hasAttribute('role')) container.setAttribute('role', 'group');
    let current = -1;
    const buttons = list.map((p, i) => {
      const b = o.buttons ? o.buttons[i] : document.createElement('button');
      b.type = 'button';
      b.classList.add('btn');
      if (!o.buttons) { b.textContent = p.name; container.appendChild(b); }
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => select(i));
      return b;
    });
    function mark(i) {
      current = i;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    }
    /** Select preset i (index or name); calls onPick unless {pick: false}. */
    function select(i, so) {
      if (typeof i === 'string') i = list.findIndex((p) => p.name === i);
      if (i < 0 || i >= list.length) return;
      mark(i);
      showNote(noteEl, list[i].note || '', label);
      if (!(so && so.pick === false) && onPick) onPick(list[i], i);
    }
    /** Un-press every button (e.g. after the reader edits the widget by hand) and show text as the note. */
    function clear(text) { mark(-1); showNote(noteEl, text || '', ''); }
    const handle = { container, list, buttons, note: noteEl, select, clear, current: () => current, created: !o.buttons };
    handles.set(container, handle);
    const first = o.selectFirst !== undefined ? o.selectFirst : opts.selectFirst !== false;
    if (first && list.length) select(0, { pick: o.pickFirst !== false });
    return handle;
  }

  // ---- declarative rows: <div class="presets" data-target="widgetId"><button data-preset='…' data-note="…">…</button></div>
  function parseValue(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  function enhance(root) {
    root.querySelectorAll('.presets[data-target]:not([data-enhanced])').forEach((box) => {
      box.dataset.enhanced = '';
      const btns = [...box.querySelectorAll('button[data-preset]')];
      const list = btns.map((b) => ({ name: b.textContent.trim(), note: b.dataset.note || '', value: parseValue(b.dataset.preset) }));
      const note = box.dataset.noteTarget ? document.getElementById(box.dataset.noteTarget) : undefined;
      const sf = box.dataset.selectFirst;
      mount(box, list, (p, i) => {
        const target = document.getElementById(box.dataset.target);
        if (!target) { console.warn('[study] widget-presets: no element with id "' + box.dataset.target + '"'); return; }
        target.dispatchEvent(new CustomEvent(opts.eventName || 'preset', { detail: p.value, bubbles: true }));
        Study.emit('preset:pick', { target: box.dataset.target, index: i, name: p.name, value: p.value });
      }, { buttons: btns, note, selectFirst: sf === undefined ? undefined : sf !== 'false' });
    });
  }

  Study.presets = {
    mount,
    /** The handle of a mounted row (element or id), or null. */
    get: (container) => handles.get(byId(container)) || null,
    /** Un-press a row's buttons and show text (optional) as its note. */
    clear: (container, text) => { const hd = handles.get(byId(container)); if (hd) hd.clear(text); },
  };
  // old-style helper: presetButtons(box, list, onPick) marks the first preset without calling onPick
  Object.assign(Study.legacy = Study.legacy || {}, {
    presetButtons: (box, list, onPick) => mount(box, list, onPick, { note: false, selectFirst: true, pickFirst: false }),
  });
  Study.define('widget-presets', { enhance });
})();
