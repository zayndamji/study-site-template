/* ==========================================================================
   source-viewer — citation chips that pop up the real source image
   --------------------------------------------------------------------------
   Chips: <button class="sv-chip" data-deck="A" data-from="12" data-to="14">s12–14</button>,
   <span class="sv-ref" …> (upgraded to a button), or plain text such as "s12" / "s12–14" /
   "P03 s12" inside the elements matched by the `selectors` option (see `patterns`).
   Images: manifest <base>index.js (window.<manifestGlobal> = {decks: {…}}), falling back to
   <base>index.json. Each deck is either sprite sheets (<deck>-<kk>.webp, cols×rows frames
   each) or one file per frame (deck.pattern, e.g. "{deck}/{n:03}.webp").
   API: Study.sources.open(deck, from, to, anchorEl) · .close() · .chipify(root) (rescans root, e.g. after
   a widget rewrote its text) · .load()
   ========================================================================== */
(function () {
  'use strict';
  const NAME = 'source-viewer';
  const O = Study.options(NAME);
  const base = O.base === undefined ? 'assets/sources/' : String(O.base || '');
  const num = (v, d) => (isFinite(+v) && v !== null && v !== '' ? +v : d);
  const GLOBAL = O.manifestGlobal || 'STUDY_SOURCES';

  // "{n}", "{n:03}" (zero-padded); unknown fields stay as written
  const fill = (tpl, vals) => String(tpl === undefined || tpl === null ? '' : tpl)
    .replace(/\{(\w+)(?::0?(\d+))?\}/g, (m, k, w) => (k in vals ? (w ? String(vals[k]).padStart(+w, '0') : String(vals[k])) : m));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------------------------------------------------------------- manifest
  let manifest = null, loading = null;
  // a <script> also works for pages opened from disk (file:// blocks fetch); index.json is the fallback
  const viaScript = () => new Promise((res) => {
    if (window[GLOBAL]) { res(window[GLOBAL]); return; }
    const sc = document.createElement('script');
    sc.src = base + 'index.js';
    sc.onload = () => res(window[GLOBAL] || null);
    sc.onerror = () => res(null);
    document.head.append(sc);
  });
  const load = () => loading || (loading = viaScript()
    .then((m) => m || fetch(base + 'index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null))
    .then((m) => (manifest = (m && m.decks) ? m : { decks: {} })));

  // ---------------------------------------------------------------- chips
  const pats = (Array.isArray(O.patterns) ? O.patterns : []).filter((p) => p && p.prefix && p.deck);
  const byPrefix = new Map(pats.map((p) => [String(p.prefix), p]));
  let RX = null;
  if (pats.length) {
    const alt = [...byPrefix.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|');
    const ovr = O.pageOverridePrefix
      ? '(?:(?<![\\w.\\/])' + reEsc(String(O.pageOverridePrefix)) + '([\\w-]*\\d[\\w-]*)\\s+)?'
      : '()';
    // [P03 ]s12[–[s]14] — not inside a word, not followed by a letter, digit or "("
    RX = new RegExp(ovr + '(?<![\\w.\\/])(' + alt + ')(\\d{1,4})(?:\\s*[\\u2013-]\\s*(?:\\2)?(\\d{1,4}))?(?![\\w(])', 'g');
  }
  const SKIP = '.sv-chip, .sv-ref, .sv-pop, script, style, template, textarea, select, button, a, code, pre, .m, .mblock, .eq, [data-sv-skip]'
    + (O.skip ? ', ' + O.skip : '');
  const pageOf = (el) => {
    const c = el.closest && el.closest('[data-sv-page]');
    return c ? c.getAttribute('data-sv-page') : (document.body.dataset.page || '');
  };
  const deckOf = (el) => fill(el.dataset.deck || '', { page: pageOf(el) });

  function makeChip(text, deck, from, to, prefix, label) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sv-chip'; b.textContent = text;
    b.dataset.deck = deck; b.dataset.from = from; b.dataset.to = to;
    if (prefix) b.dataset.prefix = prefix;
    if (label) b.dataset.deckLabel = label;
    prepChip(b);
    return b;
  }
  function prepChip(b) {
    if (b.dataset.svReady !== undefined) return;
    b.dataset.svReady = '';
    if (b.tagName === 'BUTTON') b.type = 'button';
    if (!b.title && O.chipTitle) b.title = O.chipTitle;
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
  }
  // <span class="sv-ref" data-deck … > → <button class="sv-chip" …>
  function upgrade(span) {
    const b = document.createElement('button');
    [...span.attributes].forEach((a) => { if (a.name !== 'class') b.setAttribute(a.name, a.value); });
    b.className = ['sv-chip', ...[...span.classList].filter((c) => c !== 'sv-ref')].join(' ');
    while (span.firstChild) b.append(span.firstChild);
    span.replaceWith(b);
    prepChip(b);
  }

  function chipText(node, host) {
    const s = node.nodeValue;
    RX.lastIndex = 0;
    let m, last = 0, frag = null;
    while ((m = RX.exec(s))) {
      const p = byPrefix.get(m[2]);
      const page = m[1] || pageOf(host);
      if (!p || (!page && String(p.deck).includes('{page}'))) continue;
      const deck = fill(p.deck, { page, prefix: p.prefix });
      // skipMissing: leave citations of decks the manifest does not list as plain text
      if (O.skipMissing && manifest && !manifest.decks[deck]) continue;
      const a = +m[3], b = m[4] ? +m[4] : a;
      frag = frag || document.createDocumentFragment();
      frag.append(s.slice(last, m.index));
      frag.append(makeChip(m[0], deck, Math.min(a, b), Math.max(a, b), p.prefix, p.label ? fill(p.label, { page, prefix: p.prefix }) : ''));
      last = m.index + m[0].length;
    }
    if (!frag) return;
    frag.append(s.slice(last));
    node.replaceWith(frag);
  }

  // force: scan hosts again even if they were scanned before (text already inside a chip is skipped)
  function scan(root, force) {
    root = root || document;
    const all = (sel) => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
    all('.sv-ref').forEach(upgrade);
    all('.sv-chip').forEach(prepChip);
    if (!RX || !O.selectors) return;
    all(O.selectors).forEach((host) => {
      if (host.dataset.svScanned !== undefined && !force) return;
      host.dataset.svScanned = '';
      if (host.closest(SKIP)) return;
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let t;
      while ((t = walker.nextNode())) if (!t.parentElement.closest(SKIP)) nodes.push(t);
      nodes.forEach((n) => chipText(n, host));
    });
  }
  /** Turn citations under root into chips. With skipMissing on, this waits for the manifest. */
  function chipify(root, force) {
    if (O.skipMissing && RX && O.selectors && !manifest) return load().then(() => scan(root, force));
    scan(root, force);
    return Promise.resolve();
  }

  // ---------------------------------------------------------------- popover
  let pop, head, foot, frame, img, msg, cap, rng, pos, prevB, nextB, cur = null, anchor = null;
  const h = Study.h;
  function build() {
    cap = h('span', { class: 'sv-cap' });
    rng = h('span', { class: 'sv-rng' });
    const x = h('button', { type: 'button', class: 'sv-x', 'aria-label': O.close, title: O.close, text: '\u2715', onclick: () => close(true) });
    head = h('div', { class: 'sv-head' }, cap, rng, x);
    img = h('div', { class: 'sv-img', role: 'img' });
    msg = h('div', { class: 'sv-msg', 'aria-live': 'polite' });
    frame = h('div', { class: 'sv-frame' }, img, msg);
    prevB = h('button', { type: 'button', class: 'btn sv-prev', text: O.prev, onclick: () => go(cur.i - 1) });
    nextB = h('button', { type: 'button', class: 'btn sv-next', text: O.next, onclick: () => go(cur.i + 1) });
    pos = h('span', { class: 'sv-pos' });
    foot = h('div', { class: 'sv-foot' }, prevB, pos, nextB);
    pop = h('div', { class: 'sv-pop', role: 'dialog', 'aria-label': O.dialogLabel, tabindex: '-1', hidden: true }, head, frame, foot);
    document.body.append(pop);
    document.addEventListener('keydown', (e) => {
      if (pop.hidden) return;
      if (e.key === 'Escape') { close(true); return; }
      if (e.altKey || e.ctrlKey || e.metaKey || !cur || cur.missing) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur.i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur.i + 1); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.sv-chip')) close(false);
    });
    window.addEventListener('resize', () => { if (!pop.hidden) place(); });
  }

  function setAnchor(el) {
    if (anchor && anchor !== el) { anchor.classList.remove('on'); anchor.setAttribute('aria-expanded', 'false'); }
    anchor = el || null;
    if (anchor) { anchor.classList.add('on'); anchor.setAttribute('aria-expanded', 'true'); }
  }
  function close(refocus) {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    const a = anchor;
    setAnchor(null);
    if (refocus && a && document.contains(a)) a.focus({ preventScroll: true });
  }

  const deckInfo = () => (cur && !cur.missing ? manifest.decks[cur.deck] : null);
  const dims = () => { const d = deckInfo(); return d && d.w && d.h ? { w: +d.w, h: +d.h } : { w: 4, h: 3 }; };

  // beside the chip if there is room, else below (or above) it; page coordinates, so it scrolls with the text
  function place() {
    const d = dims();
    const de = document.documentElement, vw = de.clientWidth, vh = window.innerHeight;
    const sx = window.scrollX, sy = window.scrollY;
    const GAP = 10, EDGE = 12, MAX = num(O.maxWidth, 600), MIN = num(O.minSideWidth, 340);
    const chrome = (head.offsetHeight + foot.offsetHeight + 2) || 92;
    const fitW = (avail) => Math.max(120, Math.min(MAX, avail, (vh - chrome - 2 * EDGE) * d.w / d.h));
    if (!anchor || !document.contains(anchor)) {
      const w = Math.min(fitW(vw - 2 * EDGE), vw - 2 * EDGE);
      pop.style.width = Math.round(w) + 'px';
      pop.dataset.side = 'none';
      pop.style.left = Math.round((vw - w) / 2 + sx) + 'px';
      pop.style.top = Math.round(sy + EDGE) + 'px';
      return;
    }
    const r = anchor.getBoundingClientRect();
    const right = vw - r.right - GAP - EDGE, left = r.left - GAP - EDGE;
    let side, w, x, y;
    if (right >= MIN) { side = 'right'; w = fitW(right); x = r.right + GAP; }
    else if (left >= MIN) { side = 'left'; w = fitW(left); x = r.left - GAP - w; }
    else {
      side = 'below'; w = Math.min(fitW(vw - 2 * EDGE), vw - 2 * EDGE);
      x = Math.min(Math.max(EDGE, r.left + r.width / 2 - w / 2), vw - EDGE - w);
    }
    pop.style.width = Math.round(w) + 'px';
    const ph = pop.offsetHeight || (w * d.h / d.w + chrome);
    if (side === 'below') {
      y = r.bottom + GAP;
      if (y + ph > vh - EDGE && r.top - GAP - ph >= EDGE) { y = r.top - GAP - ph; side = 'above'; }
    } else {
      y = Math.min(Math.max(EDGE, r.top + r.height / 2 - ph / 3), Math.max(EDGE, vh - EDGE - ph));
    }
    pop.dataset.side = side;
    pop.style.left = Math.round(x + sx) + 'px';
    pop.style.top = Math.round(y + sy) + 'px';
    // the notch points at the chip
    pop.style.setProperty('--sv-ny', Math.round(Math.min(Math.max(14, r.top + r.height / 2 - y), ph - 14)) + 'px');
    pop.style.setProperty('--sv-nx', Math.round(Math.min(Math.max(14, r.left + r.width / 2 - x), w - 14)) + 'px');
  }

  // where frame i of deck lives: its own file (deck.pattern) or a cell of a sprite sheet
  function frameOf(deck, d, i) {
    if (d.pattern) return { url: base + fill(d.pattern, { deck, n: i }), size: 'contain', at: '50% 50%' };
    const cols = Math.max(1, num(d.cols, 1)), rows = Math.max(1, num(d.rows, 1)), per = cols * rows;
    const k = Math.floor((i - 1) / per), j = (i - 1) % per, c = j % cols, r = Math.floor(j / cols);
    return {
      url: base + fill(d.sheet || '{deck}-{k:02}.webp', { deck, k }),
      size: (cols * 100) + '% ' + (rows * 100) + '%',
      at: (cols > 1 ? c * 100 / (cols - 1) : 0) + '% ' + (rows > 1 ? r * 100 / (rows - 1) : 0) + '%',
    };
  }
  const cache = new Map();
  const preload = (url) => {
    if (!cache.has(url)) {
      const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(url); im.onerror = rej; im.src = url; });
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return cache.get(url);
  };
  const vals = (i) => {
    const d = deckInfo() || {};
    return { deck: cur.deck, deckLabel: d.label || cur.label || cur.deck, prefix: cur.prefix, n: i, total: d.n || '', from: cur.a, to: cur.b };
  };

  function go(i) {
    const d = deckInfo();
    if (!d) return;
    const n = Math.max(1, num(d.n, 1));
    if (i < 1 || i > n) return;
    cur.i = i;
    const v = vals(i);
    cap.textContent = fill(O.caption, v);
    const badge = cur.a !== cur.b ? O.rangeLabel : O.singleLabel;
    rng.textContent = badge ? fill(badge, v) : '';
    rng.classList.toggle('in', i >= cur.a && i <= cur.b);
    pos.textContent = fill(O.position, v);
    prevB.disabled = i <= 1; nextB.disabled = i >= n;
    foot.hidden = false;
    frame.style.aspectRatio = dims().w + ' / ' + dims().h;
    img.setAttribute('aria-label', fill(O.imageLabel, v));
    const f = frameOf(cur.deck, d, i);
    msg.textContent = O.loading; msg.hidden = false; img.style.opacity = 0;
    preload(f.url).then(() => {
      if (cur.i !== i) return;
      img.style.backgroundImage = 'url("' + f.url.replace(/["\\]/g, '\\$&') + '")';
      img.style.backgroundSize = f.size;
      img.style.backgroundPosition = f.at;
      img.style.opacity = 1; msg.hidden = true;
      [i + 1, i - 1].forEach((j) => { if (j >= 1 && j <= n) preload(frameOf(cur.deck, d, j).url).catch(() => {}); });
    }, () => { if (cur.i === i) msg.textContent = O.error; });
  }

  function showMissing() {
    cap.textContent = cur.label || cur.deck; rng.textContent = ''; pos.textContent = '';
    foot.hidden = true;
    frame.style.aspectRatio = '4 / 3';
    img.style.opacity = 0; img.removeAttribute('aria-label');
    msg.textContent = O.missing; msg.hidden = false;
  }

  function open(deck, from, to, anchorEl) {
    const a = Math.max(1, num(from, 1)), b = Math.max(a, num(to, a));
    return load().then((m) => {
      if (!pop) build();
      setAnchor(anchorEl);
      const prefix = (anchorEl && anchorEl.dataset && anchorEl.dataset.prefix) || (m.decks[deck] && m.decks[deck].prefix) || '';
      const label = (anchorEl && anchorEl.dataset && anchorEl.dataset.deckLabel) || '';
      cur = { deck: String(deck), a, b, i: a, prefix, label, missing: !m.decks[deck] };
      pop.hidden = false;
      if (cur.missing) showMissing(); else go(Math.min(a, Math.max(1, num(m.decks[deck].n, 1))));
      place();
      return pop;
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.sv-chip');
    if (!b || (pop && pop.contains(b))) return;
    e.preventDefault();
    if (anchor === b && pop && !pop.hidden) { close(false); return; }
    const keyboard = e.detail === 0;
    open(deckOf(b), b.dataset.from, b.dataset.to || b.dataset.from, b).then((p) => {
      if (keyboard) p.focus({ preventScroll: true });
    });
  });

  Study.sources = { open, close: () => close(false), chipify: (root) => chipify(root, true), load, frame: (deck, n) => (manifest && manifest.decks[deck] ? frameOf(deck, manifest.decks[deck], n).url : null) };
  Study.define(NAME, { enhance(root) { chipify(root, false); } });
})();
