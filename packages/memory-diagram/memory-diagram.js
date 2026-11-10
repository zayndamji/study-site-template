/* ==========================================================================
   memory-diagram — memory pictures (stack frames, heap objects, pointer arrows,
   linked nodes), trees (binary or any arity) and arrays, drawn as SVG from a JSON
   scene; and a tracer that steps through a list of scenes beside a code listing.
   --------------------------------------------------------------------------
   Markup: <div class="md-figure"> (one scene) or <div class="widget md-trace">
   (steps), each holding <script type="application/json">{spec}</script>.
   Generated elements get classes <classPrefix><role> (default "md-") and
   data-md="<role>", which this package's CSS uses.
   API: Study.memory = { draw(scene) → svg, mount(host), layoutTree(root), prefix }
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('memory-diagram');
  const P = O.classPrefix === undefined ? 'md-' : String(O.classPrefix);
  const NS = 'http://www.w3.org/2000/svg';
  const t = (key, vals) => String(O[key] === undefined ? '' : O[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && k in vals ? vals[k] : m));
  const CH = 9, CH_S = 7.6; // approximate mono character widths at 15px / 13px
  const CELL_H = 30, MIN_CELL = 36, GAP = 10;
  let uid = 0;

  const role = (name, extra) => ({ class: P + name + (extra ? ' ' + extra : ''), 'data-md': name });
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const text = (parent, x, y, str, attrs) => { const e = el('text', Object.assign({ x, y }, attrs), parent); e.textContent = str; return e; };
  const html = (tag, attrs) => {
    const e = document.createElement(tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  };
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  const cellW = (s, min) => Math.max(min || MIN_CELL, str(s).length * CH + 16);

  // ---- cells: a value box, maybe a pointer ----------------------------------
  // cell spec: "5" | 5 | {value, ptr, on, dim, name}
  const norm = (c) => (c !== null && typeof c === 'object' ? c : { value: c });
  function cellText(c) {
    if ('ptr' in c && (c.ptr === null || c.ptr === '')) return c.value !== undefined ? str(c.value) : t('nullLabel');
    if (c.ptr) return c.value !== undefined ? str(c.value) : '';
    return str(c.value);
  }
  function cellWidth(c) {
    const s = cellText(c);
    return c.ptr && !s ? MIN_CELL : cellW(s);
  }

  // ---- memory part: stack frames and heap objects ---------------------------
  const varsW = (v) => (v.cells ? v.cells.map(norm).reduce((a, c) => a + cellWidth(c), 0) : cellWidth(norm(v)));

  /** Heap objects in rows, left to right; returns the size used. */
  function heapRows(heap, g, hx0, hy0, reg) {
    let hy = hy0, w = 0;
    const byRow = new Map();
    heap.forEach((o) => { const r = o.row === undefined ? 0 : o.row; if (!byRow.has(r)) byRow.set(r, []); byRow.get(r).push(o); });
    [...byRow.keys()].sort((a, b) => a - b).forEach((r, ri) => {
      let hx = hx0, rowH = 0;
      if (ri) hy += 22;
      byRow.get(r).forEach((o) => {
        const cells = (o.cells || o.fields || []).map(norm);
        const named = o.fields && cells.some((c) => c.name !== undefined);
        const top = (named ? 18 : 0) + (o.label ? 18 : 0);
        const bottom = o.index ? 16 : 0;
        if (o.x !== undefined) hx = hx0 + o.x;
        const og = el('g', role('obj', [o.on && 'on', o.freed && 'freed', o.dim && 'dim'].filter(Boolean).join(' ')), g);
        let cx = hx;
        if (o.label) text(og, hx, hy + 13, str(o.label), role('olabel'));
        cells.forEach((c, j) => {
          const cw = cellWidth(c);
          if (named && c.name !== undefined) text(og, cx + cw / 2, hy + 13 + (o.label ? 18 : 0), str(c.name), Object.assign(role('field'), { 'text-anchor': 'middle' }));
          drawCell(og, cx, hy + top, cw, c, reg, o.index ? j : null, o.id + '#' + j, o.id + '.' + (c.name || j));
          cx += cw;
        });
        if (!cells.length) { el('rect', { x: hx, y: hy + top, width: MIN_CELL, height: CELL_H, 'data-md': 'cell' }, og); cx = hx + MIN_CELL; }
        reg.objects.set(o.id, { x: hx, y: hy + top, w: cx - hx, h: CELL_H, freed: !!o.freed });
        rowH = Math.max(rowH, top + CELL_H + bottom);
        w = Math.max(w, cx - hx0);
        hx = cx + (o.gap === undefined ? 48 : o.gap);
      });
      hy += rowH;
    });
    return { w, h: hy - hy0 };
  }

  function frameClass(f) { return role('frame', [f.on && 'on', f.dim && 'dim', f.done && 'done'].filter(Boolean).join(' ')); }

  function drawVar(fg, v, x, y, nameRight, reg) {
    text(fg, nameRight, y + 20, str(v.name), Object.assign(role('vname'), { 'text-anchor': 'end' }));
    let cx = x;
    (v.cells ? v.cells.map(norm) : [norm(v)]).forEach((c, j) => {
      const cw = cellWidth(c);
      drawCell(fg, cx, y, cw, Object.assign({}, c, { on: c.on || (!v.cells && v.on) }), reg, v.cells && v.index ? j : null);
      cx += cw;
    });
  }

  function memoryPart(scene, g, x0, y0, reg) {
    if (scene.layout === 'memory') return columnPart(scene, g, x0, y0, reg);
    const stack = scene.stack || [], heap = scene.heap || [];
    const rows = scene.layout === 'rows';
    let w = 0, h = 0;
    // stack column
    let sx = x0, sy = y0, fw = 0;
    if (stack.length) {
      const nameW = Math.max(0, ...stack.flatMap((f) => (f.vars || []).map((v) => str(v.name).length * CH)));
      const valW = Math.max(MIN_CELL, ...stack.flatMap((f) => (f.vars || []).map(varsW)));
      fw = Math.max(nameW + valW + 32, ...stack.map((f) => str(f.name).length * CH + 24), 120);
      if (scene.regionLabels !== false) { text(g, sx, sy + 13, t('stackLabel'), role('region')); sy += 22; }
      stack.forEach((f) => {
        const vars = f.vars || [];
        const fh = vars.length ? 30 + vars.length * (CELL_H + 8) + 6 : 28;
        const fg = el('g', frameClass(f), g);
        el('rect', { x: sx, y: sy, width: fw, height: fh, rx: 4 }, fg);
        if (vars.length) el('line', { x1: sx, y1: sy + 26, x2: sx + fw, y2: sy + 26, 'data-md': 'rule' }, fg);
        text(fg, sx + 10, sy + 18, str(f.name), role('fname'));
        vars.forEach((v, k) => drawVar(fg, v, sx + 20 + nameW, sy + 32 + k * (CELL_H + 8), sx + 10 + nameW, reg));
        sy += fh + GAP;
      });
      w = fw; h = sy - y0;
    }
    // heap region
    if (heap.length) {
      const hx0 = stack.length && !rows ? x0 + fw + 64 : x0;
      let hy = stack.length && rows ? y0 + h + 16 : y0;
      if (scene.regionLabels !== false) { text(g, hx0, hy + 13, t('heapLabel'), role('region')); hy += 22; }
      const r = heapRows(heap, g, hx0, hy, reg);
      w = Math.max(w, hx0 - x0 + r.w);
      h = Math.max(h, hy + r.h - y0);
    }
    return { w, h };
  }

  /** layout "memory": one memory column, stack frames on top (name and first variable on one row), free
      space with growth arrows, the heap band, then the "base" bands (e.g. ["Text"]); addresses beside it. */
  function columnPart(scene, g, x0, y0, reg) {
    const stack = scene.stack || [], heap = scene.heap || [], base = scene.base || [];
    const labels = scene.regionLabels === true;
    const addr = scene.addresses || {};
    const LW = labels ? Math.max(t('stackLabel').length, t('heapLabel').length) * CH_S + 14 : 0;
    const AW = Math.max(str(addr.top).length, str(addr.bottom).length) * CH_S + (addr.top || addr.bottom ? 10 : 0);
    const fnW = Math.max(0, ...stack.map((f) => str(f.name).length * CH));
    const nameW = Math.max(0, ...stack.flatMap((f) => (f.vars || []).map((v) => str(v.name).length * CH)));
    const valW = Math.max(0, ...stack.flatMap((f) => (f.vars || []).map(varsW)));
    const frameW = 10 + fnW + (nameW ? 8 + nameW : 0) + (valW ? 8 + valW : 0) + 10;
    // measure the heap in a scratch group first
    const scratch = el('g', {});
    const hm = heap.length ? heapRows(heap, scratch, 0, 0, { cells: new Map(), objects: new Map(), arrows: [] }) : { w: 0, h: 0 };
    const colW = Math.max(150, frameW, hm.w + 28, ...base.map((b) => str(b).length * CH + 24));
    const cx = x0 + Math.max(LW, AW);
    let y = y0;
    const col = el('g', {}, g);
    const bg = el('rect', Object.assign(role('column'), { x: cx, y: y0, width: colW }), col);
    if (labels && stack.length) text(g, cx - 8, y0 + 20, t('stackLabel'), Object.assign(role('region'), { 'text-anchor': 'end' }));
    stack.forEach((f) => {
      const vars = f.vars || [];
      const fh = Math.max(1, vars.length) * (CELL_H + 6) + 6;
      const fg = el('g', frameClass(f), g);
      el('rect', { x: cx, y, width: colW, height: fh }, fg);
      text(fg, cx + 10, y + 6 + 20, str(f.name), role('fname'));
      vars.forEach((v, k) => drawVar(fg, v, cx + colW - 10 - varsW(v), y + 6 + k * (CELL_H + 6), cx + colW - 18 - varsW(v), reg));
      y += fh;
    });
    const gap = scene.gap === undefined ? 70 : scene.gap;
    if (gap > 0) {
      const ax = cx + colW / 2;
      if (scene.grow !== false && stack.length) el('path', Object.assign(role('grow'), { d: `M${ax},${y + 6} L${ax},${y + 26}`, 'marker-end': 'url(#' + reg.mk + '-grow)' }), g);
      if (scene.grow !== false && (heap.length || base.length)) el('path', Object.assign(role('grow'), { d: `M${ax},${y + gap - 6} L${ax},${y + gap - 26}`, 'marker-end': 'url(#' + reg.mk + '-grow)' }), g);
      y += gap;
    }
    if (heap.length) {
      if (labels) text(g, cx - 8, y + 20, t('heapLabel'), Object.assign(role('region'), { 'text-anchor': 'end' }));
      el('rect', Object.assign(role('band'), { x: cx, y, width: colW, height: hm.h + 28 }), col);
      heapRows(heap, g, cx + 14, y + 14, reg);
      y += hm.h + 28;
    }
    base.forEach((b) => {
      el('rect', Object.assign(role('band'), { x: cx, y, width: colW, height: 34 }), col);
      text(g, cx + colW / 2, y + 22, str(b), Object.assign(role('bname'), { 'text-anchor': 'middle' }));
      y += 34;
    });
    if (y === y0) y += 40;
    bg.setAttribute('height', y - y0);
    if (addr.top !== undefined) text(g, cx - 6, y0 + 13, str(addr.top), Object.assign(role('idx'), { 'text-anchor': 'end' }));
    if (addr.bottom !== undefined) text(g, cx - 6, y - 3, str(addr.bottom), Object.assign(role('idx'), { 'text-anchor': 'end' }));
    const ptrs = reg.arrows.length;
    if (ptrs) reg.colRight = cx + colW;
    return { w: cx - x0 + colW + (ptrs ? 34 : 0), h: y - y0 };
  }

  function drawCell(g, x, y, w, c, reg, index, key, key2) {
    const cg = el('g', role('cell', [c.on && 'on', c.dim && 'dim', 'ptr' in c && !c.ptr && 'null', c.junk && 'junk'].filter(Boolean).join(' ')), g);
    el('rect', { x, y, width: w, height: CELL_H }, cg);
    const s = cellText(c);
    if (s) text(cg, x + w / 2, y + 20, s, Object.assign(role('val'), { 'text-anchor': 'middle' }));
    if (index !== null && index !== undefined) text(g, x + w / 2, y + CELL_H + 13, String(index), Object.assign(role('idx'), { 'text-anchor': 'middle' }));
    const box = { x, y, w, h: CELL_H };
    if (key) reg.cells.set(key, box);
    if (key2) reg.cells.set(key2, box);
    if (c.ptr) {
      const px = s ? x + w - 8 : x + w / 2, py = y + CELL_H / 2;
      el('circle', Object.assign(role('dot'), { cx: px, cy: py, r: 3.5 }), cg);
      reg.arrows.push({ x: px, y: py, to: String(c.ptr), on: c.on });
    }
  }

  function drawArrows(g, reg, mk) {
    reg.arrows.forEach((a) => {
      const hash = a.to.indexOf('#') >= 0 || a.to.indexOf('.') >= 0;
      const box = hash ? reg.cells.get(a.to) : reg.objects.get(a.to);
      const obj = reg.objects.get(a.to.split(/[#.]/)[0]);
      if (!box) { console.warn('[study] memory-diagram: pointer to unknown target', a.to); return; }
      let x2, y2, c1, c2;
      const d = (u) => Math.max(24, Math.abs(u) / 2);
      if (reg.colRight !== undefined && box.y > a.y + 6) { // memory column: down the right margin, into the right edge
        const m = reg.colRight + 34;
        x2 = box.x + box.w; y2 = box.y + box.h / 2;
        c1 = [m, a.y]; c2 = [m, y2];
      } else if (box.x >= a.x + 14 && !hash) { // to the right: into the left edge
        x2 = box.x; y2 = box.y + box.h / 2;
        c1 = [a.x + d(x2 - a.x), a.y]; c2 = [x2 - d(x2 - a.x), y2];
      } else if (box.y > a.y + 6) { // below: into the top
        x2 = box.x + Math.min(box.w / 2, 18); y2 = box.y;
        c1 = [a.x + 30, a.y + 10]; c2 = [x2, y2 - d(y2 - a.y)];
      } else { // otherwise: into the bottom, routed underneath
        x2 = box.x + Math.min(box.w / 2, 18); y2 = box.y + box.h;
        const low = Math.max(a.y, y2) + 34;
        c1 = [a.x + 20, low]; c2 = [x2, low];
      }
      const dangling = obj && obj.freed;
      el('path', Object.assign(role('arrow', [a.on && 'on', dangling && 'dangling'].filter(Boolean).join(' ')), {
        d: `M${a.x},${a.y} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x2},${y2}`,
        'marker-end': `url(#${mk}${a.on ? '-on' : dangling ? '-bad' : ''})`,
      }), g);
    });
  }

  // ---- tree part ------------------------------------------------------------
  // node: {v, l, r} (binary: positions kept even when one child is missing) or {v, c: [...]};
  // optional on, dim, e (label on the edge from the parent), note (text beside the node)
  function layoutTree(root) {
    const nodes = [], edges = [];
    const binary = (function any(n) { return !!n && (('l' in n) || ('r' in n) || (n.c || []).some(any) || any(n.l) || any(n.r)); })(root);
    let slot = 0;
    (function walk(n, depth, parent) {
      if (!n) return null;
      const me = { n, depth, parent };
      nodes.push(me);
      if (parent) edges.push({ from: parent, to: me, label: n.e });
      if (binary) {
        walk(n.l, depth + 1, me);
        me.slot = slot++;
        walk(n.r, depth + 1, me);
      } else {
        const kids = (n.c || []).map((k) => walk(k, depth + 1, me)).filter(Boolean);
        me.slot = kids.length ? (kids[0].slot + kids[kids.length - 1].slot) / 2 : slot++;
      }
      return me;
    })(root, 0, null);
    return { nodes, edges, binary };
  }

  function treePart(scene, g, x0, y0, mk) {
    const L = layoutTree(scene.tree);
    if (!L.nodes.length) return { w: 0, h: 0 };
    const wOf = (n) => Math.max(34, str(n.v).length * CH + 16);
    const sw = Math.max(...L.nodes.map((m) => wOf(m.n))) + (scene.spacing || 14);
    const vh = scene.levelGap || 64;
    const pos = (m) => ({ x: x0 + m.slot * sw + sw / 2, y: y0 + m.depth * vh + 16 });
    let w = 0, h = 0;
    const eg = el('g', {}, g);
    L.edges.forEach((e) => {
      const a = pos(e.from), b = pos(e.to);
      const dx = b.x - a.x, dy = b.y - a.y; // dy > 0: a child is always a level lower
      const sy = a.y + CELL_H / 2, ey = b.y - CELL_H / 2 - 2;
      el('line', Object.assign(role('tedge', e.to.n.on && e.from.n.on ? 'on' : ''), {
        x1: a.x + dx * ((CELL_H / 2) / dy), y1: sy, x2: b.x - dx * ((CELL_H / 2 + 2) / dy), y2: ey,
        'marker-end': scene.arrows ? `url(#${mk})` : null,
      }), eg);
      if (e.label !== undefined) text(eg, (a.x + b.x) / 2 + (dx < 0 ? -8 : dx > 0 ? 8 : 10), (sy + ey) / 2 + 4, str(e.label), Object.assign(role('elabel'), { 'text-anchor': dx < 0 ? 'end' : 'start' }));
    });
    L.nodes.forEach((m) => {
      const p = pos(m), nw = wOf(m.n);
      const ng = el('g', role('tnode', [m.n.on && 'on', m.n.dim && 'dim'].filter(Boolean).join(' ')), g);
      el('rect', { x: p.x - nw / 2, y: p.y - CELL_H / 2, width: nw, height: CELL_H, rx: 4 }, ng);
      text(ng, p.x, p.y + 5, str(m.n.v), Object.assign(role('val'), { 'text-anchor': 'middle' }));
      if (m.n.note !== undefined) text(ng, p.x + nw / 2 + 6, p.y + 5, str(m.n.note), role('tnote'));
      w = Math.max(w, p.x + nw / 2 - x0 + (m.n.note !== undefined ? str(m.n.note).length * CH_S + 8 : 0));
      h = Math.max(h, p.y + CELL_H / 2 - y0);
    });
    return { w, h };
  }

  // ---- array part -----------------------------------------------------------
  // array: [cells] or {cells, index (true | number to start from), label}
  function arrayPart(scene, g, x0, y0, reg) {
    const a = Array.isArray(scene.array) ? { cells: scene.array } : scene.array;
    let x = x0;
    if (a.label) { text(g, x0, y0 + 20, str(a.label), role('olabel')); x += str(a.label).length * CH_S + 12; }
    const start = typeof a.index === 'number' ? a.index : 0;
    (a.cells || []).map(norm).forEach((c, j) => {
      const cw = cellWidth(c);
      drawCell(g, x, y0, cw, c, reg, a.index !== undefined && a.index !== false ? start + j : null);
      x += cw;
    });
    return { w: x - x0, h: CELL_H + (a.index !== undefined && a.index !== false ? 16 : 0) };
  }

  /** One scene → <svg>. */
  function draw(scene) {
    const mk = P + 'arrow-' + (++uid);
    const svg = el('svg', Object.assign(role('svg'), { role: 'img' }));
    if (scene.title) el('title', {}, svg).textContent = scene.title;
    const defs = el('defs', {}, svg);
    [['', 'head'], ['-on', 'head on'], ['-bad', 'head bad'], ['-grow', 'head grow']].forEach(([sfx, cls]) => {
      const m = el('marker', { id: mk + sfx, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', Object.assign(role('head'), { d: 'M0,0 L10,5 L0,10 z', 'data-md': cls }), m);
    });
    const g = el('g', {}, svg);
    const reg = { cells: new Map(), objects: new Map(), arrows: [], mk };
    let y = 4, w = 0;
    if (scene.stack || scene.heap) { const r = memoryPart(scene, g, 4, y, reg); w = Math.max(w, r.w); y += r.h + 18; }
    if (scene.tree) { const r = treePart(scene, g, 4, y, mk); w = Math.max(w, r.w); y += r.h + 18; }
    if (scene.array) { const r = arrayPart(scene, g, 4, y, reg); w = Math.max(w, r.w); y += r.h + 18; }
    drawArrows(el('g', {}, svg), reg, mk);
    // the arrows may route below or beyond the boxes: measure them when possible
    let W = w + 12, H = y;
    reg.arrows.forEach((a) => { H = Math.max(H, a.y + 44); });
    svg.setAttribute('viewBox', `0 0 ${Math.ceil(W)} ${Math.ceil(H)}`);
    svg.setAttribute('width', Math.ceil(W * (scene.scale || 1)));
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    return svg;
  }

  function enhanceLater(node) {
    if (Study.sources && Study.sources.chipify) Study.sources.chipify(node);
    if (Study.enhance) Study.enhance(node);
  }

  const PARTS = ['stack', 'heap', 'tree', 'array', 'layout', 'base', 'gap', 'grow', 'regionLabels', 'addresses', 'arrows', 'spacing', 'levelGap', 'scale'];

  /** Turn a .<prefix>figure / .<prefix>trace host into a diagram (or a tracer). */
  function mount(host) {
    if (host.dataset.mdMounted !== undefined) return;
    const js = host.querySelector(':scope > script[type="application/json"]');
    if (!js) return;
    let cfg;
    try { cfg = JSON.parse(js.textContent); } catch (err) { console.error('[study] memory-diagram: bad JSON spec', host, err); return; }
    host.dataset.mdMounted = '';
    const figure = host.classList.contains(P + 'figure');
    host.setAttribute('data-md', figure ? 'figure' : 'trace');
    const ui = html('div', role('ui'));
    host.appendChild(ui);
    if (figure) {
      const dia = html('div', role('dia', 'diagram-wrap'));
      dia.appendChild(draw(cfg));
      ui.appendChild(dia);
      if (cfg.note) { const n = html('p', role('note', 'aside')); n.innerHTML = cfg.note; ui.appendChild(n); enhanceLater(n); }
      return;
    }
    // tracer: each step inherits the scene parts it does not set from the step before
    const steps = [];
    (cfg.steps || []).forEach((s, i) => {
      const prev = steps[i - 1] || PARTS.reduce((o, k) => (k in cfg ? Object.assign(o, { [k]: cfg[k] }) : o), {});
      const scene = {};
      PARTS.forEach((k) => { if (k in s) scene[k] = s[k]; else if (k in prev) scene[k] = prev[k]; });
      steps.push(Object.assign(scene, { line: s.line, note: s.note, out: 'out' in s ? s.out : prev.out }));
    });
    if (!steps.length) return;
    let code = null;
    if (cfg.code !== undefined) {
      code = html('pre', Object.assign(role('code'), { 'data-lang': cfg.lang || 'text' }));
      if (cfg.codeTitle) code.dataset.title = cfg.codeTitle;
      code.textContent = cfg.code;
      ui.appendChild(code);
    }
    const dia = html('div', role('dia', 'diagram-wrap'));
    const out = html('div', role('out'));
    const note = html('p', Object.assign(role('note'), { 'aria-live': 'polite' }));
    const bar = html('div', { class: 'controls' });
    const count = html('span', role('count'));
    [['reset', 'resetLabel', 'btn'], ['back', 'backLabel', 'btn'], ['next', 'nextLabel', 'btn primary']].forEach(([a, key, c]) => {
      const b = html('button', { type: 'button', class: c, 'data-a': a }); b.textContent = t(key); bar.appendChild(b);
    });
    bar.appendChild(count);
    ui.append(bar, note, dia, out);
    let k = 0;
    const codeLines = () => (code ? code.querySelectorAll('.cb-line') : []);
    function render() {
      const s = steps[k];
      dia.textContent = '';
      dia.appendChild(draw(s));
      note.innerHTML = s.note || '';
      enhanceLater(note);
      count.textContent = t('stepLabel', { k: k + 1, n: steps.length });
      out.hidden = s.out === undefined;
      if (s.out !== undefined) {
        out.textContent = '';
        const lab = html('span', role('outlabel')); lab.textContent = t('outputLabel');
        const pre = html('pre', role('outtext')); pre.textContent = s.out === '' ? ' ' : s.out;
        out.append(lab, pre);
      }
      if (code) {
        if (Study.code && !code.dataset.cbDone) Study.code.render(code);
        const marks = new Set([].concat(s.line === undefined ? [] : s.line).map(Number));
        let first = null;
        codeLines().forEach((ln) => {
          const on = marks.has(+ln.dataset.line);
          ln.classList.toggle('cb-on', on);
          ln.classList.toggle(P + 'now', on);
          if (on && !first) first = ln;
        });
        if (first && code.scrollHeight > code.clientHeight + 4) {
          const top = first.offsetTop - code.clientHeight / 3;
          code.scrollTop = Math.max(0, top);
        }
      }
      bar.querySelector('[data-a="back"]').disabled = k === 0;
      bar.querySelector('[data-a="reset"]').disabled = k === 0;
      bar.querySelector('[data-a="next"]').disabled = k === steps.length - 1;
    }
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      const a = b && b.dataset.a;
      if (a === 'reset') k = 0;
      if (a === 'back') k = Math.max(0, k - 1);
      if (a === 'next') k = Math.min(steps.length - 1, k + 1);
      if (a) render();
    });
    render();
  }

  Study.memory = { draw, mount, layoutTree, prefix: P };
  Study.define('memory-diagram', {
    enhance(root) { Study.$$(root, '.' + P + 'figure, .' + P + 'trace').forEach(mount); },
  });
})();
