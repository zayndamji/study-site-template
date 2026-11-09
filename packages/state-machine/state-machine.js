/* ==========================================================================
   state-machine — state diagrams drawn from a JSON spec, and a simulator that
   steps a machine through an input string (deterministic or not, with ε moves).
   --------------------------------------------------------------------------
   Markup: <div class="widget sm-sim"> (diagram + controls) or <div class="sm-figure">
   (diagram only), each holding <script type="application/json">{spec}</script>.
   Generated elements get classes <classPrefix><role> (default "sm-") for page CSS and
   page scripts, and data-sm="<role>", which this package's CSS uses.
   API: Study.stateMachine = { model, draw, run, step, closure, accepts, table, mount, subHTML }
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('state-machine');
  const P = O.classPrefix === undefined ? 'sm-' : String(O.classPrefix);
  const EPS = 'ε', SIGMA = 'Σ';
  const NS = 'http://www.w3.org/2000/svg';
  const R = 22, ARROW = 9;
  const t = (key, vals) => String(O[key] === undefined ? '' : O[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && k in vals ? vals[k] : m));

  // class + role for a generated element: role(…) → { class: 'sm-state on', 'data-sm': 'state' }
  const role = (name, extra) => ({ class: P + name + (extra ? ' ' + extra : ''), 'data-sm': name });
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const html = (tag, attrs) => {
    const e = document.createElement(tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  };

  // "q0" → q + subscript 0, "{q0, q1}" → {q₀, q₁}, "R12" → R₁₂, "q_s" / "q_{in}" → letter subscripts;
  // letters italic when italic is true
  const SUB = /([A-Za-z])(?:_\{([^}]*)\}|_([A-Za-z0-9]+)|(\d+))/;
  const subHTML = (str) => String(str).replace(new RegExp(SUB.source, 'g'), (_, b, x, y, z) => '<i>' + b + '</i><sub>' + (x || y || z) + '</sub>');
  function rich(text, str, italic) {
    let low = false; // currently on the subscript baseline
    String(str).split(new RegExp('(' + SUB.source.replace(/\((?!\?)/g, '(?:') + '|[A-Za-z]+)')).forEach((part) => {
      if (!part) return;
      const m = new RegExp('^' + SUB.source + '$').exec(part);
      const seg = m ? [[m[1], false, true], [m[2] || m[3] || m[4], true, !m[4]]] : [[part, false, /^[A-Za-z]+$/.test(part)]];
      seg.forEach(([txt, sub, word]) => {
        const o = {};
        if (sub !== low) { o.dy = sub ? 5 : -5; low = sub; }
        if (sub) o['font-size'] = '72%';
        if (word && italic) o['font-style'] = 'italic';
        el('tspan', o, text).textContent = txt;
      });
    });
  }

  /** Spec → model: states with sizes, edges with expanded symbol lists. */
  function model(spec) {
    const states = spec.states.map((s) => {
      const label = s.label || s.id;
      const shown = label.replace(new RegExp(SUB.source, 'g'), (_, c) => c); // subscripts take little width
      const box = s.shape === 'box' || (!s.shape && /[{,]/.test(shown));
      const w = box ? (s.w || Math.max(2 * R, shown.length * 9.5 + 26)) : 2 * (s.r || R);
      const h = box ? (s.h || 40) : 2 * (s.r || R);
      return Object.assign({}, s, { label, box, hw: w / 2, hh: h / 2, r: s.r || R });
    });
    const byId = new Map(states.map((s) => [s.id, s]));
    const alphabet = spec.alphabet || [];
    const edges = (spec.edges || []).map((e, i) => {
      const on = (e.on || []).flatMap((c) => (c === SIGMA ? alphabet : [c]));
      const shown = e.label !== undefined ? e.label : (e.on || []).join(', ');
      return Object.assign({}, e, { i, on, shown });
    });
    edges.forEach((e) => { // opposite straight edges are drawn as two parallel lines
      if (e.bend === undefined && e.from !== e.to && edges.some((f) => f.from === e.to && f.to === e.from))
        e.offset = e.offset === undefined ? 9 : e.offset;
    });
    // nondeterministic if the spec says so, if any edge is a free move, or if a state has two moves on one symbol
    const seen = new Set();
    const twice = edges.some((e) => e.on.some((c) => { const k = e.from + '\u0000' + c; if (seen.has(k)) return true; seen.add(k); return false; }));
    const nfa = spec.kind === 'nfa' || (spec.kind !== 'dfa' && (twice || edges.some((e) => e.on.includes(EPS))));
    return { spec, states, byId, edges, alphabet, start: spec.start, nfa };
  }

  // point where the ray from the centre of s towards (px, py) leaves the state's outline
  function boundary(s, px, py) {
    const dx = px - s.x, dy = py - s.y, d = Math.hypot(dx, dy) || 1;
    if (!s.box) return [s.x + dx / d * s.r, s.y + dy / d * s.r];
    const k = Math.min(s.hw / Math.abs(dx || 1e-9), s.hh / Math.abs(dy || 1e-9));
    return [s.x + dx * k, s.y + dy * k];
  }
  const unit = (x, y) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
  function arrowHead(g, tip, dir) {
    const [ux, uy] = unit(dir[0], dir[1]), px = -uy, py = ux;
    const b = [tip[0] - ux * ARROW, tip[1] - uy * ARROW];
    el('path', Object.assign(role('head'), { d: `M${tip[0]},${tip[1]} L${b[0] + px * 4.5},${b[1] + py * 4.5} L${b[0] - px * 4.5},${b[1] - py * 4.5} Z` }), g);
  }
  function edgeLabel(g, e, x, y, M) {
    const math = e.label !== undefined && e.math;
    const tx = el('text', Object.assign(role('lbl', math ? P + 'math' : ''), { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }), g);
    if (math) tx.setAttribute('data-sm', 'lbl math');
    rich(tx, e.shown, !!math);
    M.ext(x - e.shown.length * 5 - 6, y - 12); M.ext(x + e.shown.length * 5 + 6, y + 12);
  }
  // point on the outline of s, on the line parallel to the centre line through (s + offset)
  function shiftOut(s, ox, oy, ux, uy) {
    if (!s.box) {
      const o2 = ox * ox + oy * oy, along = Math.sqrt(Math.max(0, s.r * s.r - o2));
      return [s.x + ox + ux * along, s.y + oy + uy * along];
    }
    const kx = Math.abs(ux) > 1e-9 ? (Math.sign(ux) * s.hw - ox) / ux : Infinity;
    const ky = Math.abs(uy) > 1e-9 ? (Math.sign(uy) * s.hh - oy) / uy : Infinity;
    const k = Math.min(kx, ky);
    return [s.x + ox + ux * k, s.y + oy + uy * k];
  }

  /** draw(model, {active: Set of state ids, edges: Set of edge indices, only: Set of state ids}) → <svg> */
  function draw(m, o) {
    o = o || {};
    const vis = (id) => !o.only || o.only.has(id);
    const svg = el('svg', Object.assign(role('svg', 'diagram'), { role: 'img' }));
    const g = el('g', {}, svg);
    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    const M = { ext(x, y) { bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); } };
    const ge = el('g', {}, g), gs = el('g', {}, g);
    m.edges.forEach((e) => {
      const a = m.byId.get(e.from), b = m.byId.get(e.to);
      if (!a || !b || !vis(a.id) || !vis(b.id) || e.hidden) return;
      const mods = [o.edges && o.edges.has(e.i) ? 'on' : '', e.on.includes(EPS) ? 'eps' : ''].filter(Boolean).join(' ');
      const eg = el('g', role('edge', mods), ge);
      if (a === b) { // self loop
        const ang = { top: -90, bottom: 90, left: 180, right: 0 }[e.loop || 'top'] * Math.PI / 180;
        const ext = a.box ? (Math.abs(Math.cos(ang)) > 0.5 ? a.hw : a.hh) : a.r;
        const cx = a.x + Math.cos(ang) * (ext - (a.box ? 0 : 4)), cy = a.y + Math.sin(ang) * (ext - (a.box ? 0 : 4));
        const spread = a.box ? 14 : 0;
        const s0 = [cx + Math.cos(ang - Math.PI / 2) * (10 + spread), cy + Math.sin(ang - Math.PI / 2) * (10 + spread)];
        const s1 = [cx + Math.cos(ang + Math.PI / 2) * (10 + spread), cy + Math.sin(ang + Math.PI / 2) * (10 + spread)];
        const p0 = a.box ? s0 : boundary(a, s0[0], s0[1]), p1 = a.box ? s1 : boundary(a, s1[0], s1[1]);
        const L = 34;
        const c0 = [p0[0] + Math.cos(ang) * L - Math.sin(ang) * -8, p0[1] + Math.sin(ang) * L + Math.cos(ang) * -8];
        const c1 = [p1[0] + Math.cos(ang) * L - Math.sin(ang) * 8, p1[1] + Math.sin(ang) * L + Math.cos(ang) * 8];
        const [ux, uy] = unit(p1[0] - c1[0], p1[1] - c1[1]);
        const end = [p1[0] - ux * ARROW, p1[1] - uy * ARROW];
        el('path', { d: `M${p0[0]},${p0[1]} C${c0[0]},${c0[1]} ${c1[0]},${c1[1]} ${end[0]},${end[1]}`, fill: 'none' }, eg);
        arrowHead(eg, p1, [ux, uy]);
        const half = Math.cos(ang) * e.shown.length * 4.6; // horizontal loops: keep the label clear of the loop
        const lx = cx + Math.cos(ang) * 44 + half + (e.lp ? e.lp[0] : 0), ly = cy + Math.sin(ang) * 40 + (e.lp ? e.lp[1] : 0);
        M.ext(cx + Math.cos(ang) * 34 - 24, cy + Math.sin(ang) * 34 - 24); M.ext(cx + Math.cos(ang) * 34 + 24, cy + Math.sin(ang) * 34 + 24);
        edgeLabel(eg, e, lx, ly, M);
        return;
      }
      const [ux, uy] = unit(b.x - a.x, b.y - a.y), px = uy, py = -ux; // p = left of travel on screen; offset, bend and side > 0 go that way
      const off = e.offset || 0, d = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = [(a.x + b.x) / 2 + px * off, (a.y + b.y) / 2 + py * off];
      const ctrl = [mid[0] + px * (e.bend || 0) * d, mid[1] + py * (e.bend || 0) * d];
      let s, tt;
      if (off && !e.bend) {
        s = shiftOut(a, px * off, py * off, ux, uy); tt = shiftOut(b, px * off, py * off, -ux, -uy);
      } else {
        s = boundary(a, ctrl[0], ctrl[1]); tt = boundary(b, ctrl[0], ctrl[1]);
      }
      const dir = e.bend ? [tt[0] - ctrl[0], tt[1] - ctrl[1]] : [tt[0] - s[0], tt[1] - s[1]];
      const [vx, vy] = unit(dir[0], dir[1]);
      const end = [tt[0] - vx * ARROW, tt[1] - vy * ARROW];
      el('path', { d: e.bend ? `M${s[0]},${s[1]} Q${ctrl[0]},${ctrl[1]} ${end[0]},${end[1]}` : `M${s[0]},${s[1]} L${end[0]},${end[1]}`, fill: 'none' }, eg);
      arrowHead(eg, tt, [vx, vy]);
      const at = e.bend ? [0.25 * s[0] + 0.5 * ctrl[0] + 0.25 * tt[0], 0.25 * s[1] + 0.5 * ctrl[1] + 0.25 * tt[1]] : [(s[0] + tt[0]) / 2, (s[1] + tt[1]) / 2];
      const side = e.side || (e.bend ? Math.sign(e.bend) : off ? Math.sign(off) : 1);
      const gap = 12 + (Math.abs(vy) > 0.7 ? e.shown.length * 3.5 : 0);
      const lx = at[0] + px * side * gap + (e.lp ? e.lp[0] : 0), ly = at[1] + py * side * gap + (e.lp ? e.lp[1] : 0);
      M.ext(s[0], s[1]); M.ext(tt[0], tt[1]); M.ext(ctrl[0], ctrl[1]);
      edgeLabel(eg, e, lx, ly, M);
    });
    m.states.forEach((s) => {
      if (!vis(s.id)) return;
      const on = o.active && o.active.has(s.id);
      const mods = [on ? 'on' : '', s.accept ? 'acc' : '', s.dim ? 'dim' : ''].filter(Boolean).join(' ');
      const sg = el('g', role('state', mods), gs);
      if (s.box) {
        el('rect', { x: s.x - s.hw, y: s.y - s.hh, width: 2 * s.hw, height: 2 * s.hh, rx: 8 }, sg);
        if (s.accept) el('rect', { class: 'inner', x: s.x - s.hw + 4, y: s.y - s.hh + 4, width: 2 * s.hw - 8, height: 2 * s.hh - 8, rx: 5 }, sg);
      } else {
        el('circle', { cx: s.x, cy: s.y, r: s.r }, sg);
        if (s.accept) el('circle', { class: 'inner', cx: s.x, cy: s.y, r: s.r - 4.5 }, sg);
      }
      const tx = el('text', Object.assign(role('name'), { x: s.x, y: s.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }), sg);
      rich(tx, s.label, true);
      M.ext(s.x - s.hw, s.y - s.hh); M.ext(s.x + s.hw, s.y + s.hh);
      if (s.id === m.start) {
        const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[m.spec.startDir || 'left'];
        const tip = [s.x + dir[0] * s.hw, s.y + dir[1] * s.hh], tail = [tip[0] + dir[0] * 52, tip[1] + dir[1] * 40];
        const sa = el('g', role('start'), gs);
        el('path', { d: `M${tail[0]},${tail[1]} L${tip[0] + dir[0] * ARROW},${tip[1] + dir[1] * ARROW}`, fill: 'none' }, sa);
        arrowHead(sa, tip, [-dir[0], -dir[1]]);
        const label = t('startLabel');
        if (label) {
          const lt = el('text', Object.assign(role('startlbl'), { x: (tail[0] + tip[0]) / 2 + (dir[1] ? 18 : 0), y: (tail[1] + tip[1]) / 2 - (dir[1] ? 0 : 9), 'text-anchor': dir[1] ? 'start' : 'middle' }), sa);
          lt.textContent = label;
        }
        M.ext(tail[0] - 4, tail[1] - 20); M.ext(tail[0] + 4, tail[1] + 4);
      }
    });
    const pad = 8, W = bb[2] - bb[0] + 2 * pad, H = bb[3] - bb[1] + 2 * pad;
    svg.setAttribute('viewBox', `${bb[0] - pad} ${bb[1] - pad} ${W} ${H}`);
    svg.style.maxWidth = Math.round(W * (m.spec.scale || 1.15)) + 'px';
    svg.style.minWidth = Math.min(Math.round(W * 0.72), 560) + 'px';
    if (m.spec.title) { const ti = el('title', {}, svg); ti.textContent = m.spec.title; }
    return svg;
  }

  // ---- semantics: sets of states (a deterministic machine is the case with singleton sets) ----
  function closure(m, set) {
    const out = new Set(set), stack = [...set];
    while (stack.length) {
      const q = stack.pop();
      m.edges.forEach((e) => { if (e.from === q && e.on.includes(EPS) && !out.has(e.to)) { out.add(e.to); stack.push(e.to); } });
    }
    return out;
  }
  function step(m, set, c) {
    const next = new Set(), used = new Set();
    m.edges.forEach((e) => { if (set.has(e.from) && e.on.includes(c)) { next.add(e.to); used.add(e.i); } });
    const cl = closure(m, next);
    m.edges.forEach((e) => { if (e.on.includes(EPS) && cl.has(e.from) && cl.has(e.to) && next.size) used.add(e.i); });
    return { set: cl, used };
  }
  /** run(model, input) → trace: [{set, used}] for 0, 1, …, n symbols read. */
  function run(m, str) {
    const trace = [{ set: closure(m, new Set([m.start])), used: new Set() }];
    for (const c of str) trace.push(step(m, trace[trace.length - 1].set, c));
    return trace;
  }
  const accepts = (m, set) => m.states.some((s) => s.accept && set.has(s.id));

  /** The transition table as a .tablewrap element; rows of the active states are highlighted. */
  function table(m, active) {
    const syms = m.alphabet.concat(m.nfa && m.edges.some((e) => e.on.includes(EPS)) ? [EPS] : []);
    const wrap = html('div', { class: 'tablewrap' });
    const tb = html('table', Object.assign(role('table', 't'), {}));
    wrap.appendChild(tb);
    const fmt = (ids) => (m.nfa ? '{' + ids.join(', ') + '}' : ids[0] || '—');
    let h = '<thead><tr><th></th>' + syms.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
    m.states.forEach((s) => {
      h += '<tr' + (active && active.has(s.id) ? ' class="on"' : '') + '><th>' + (s.id === m.start ? '→' : '') + (s.accept ? '*' : '') + s.label + '</th>';
      syms.forEach((c) => { h += '<td>' + fmt(m.edges.filter((e) => e.from === s.id && e.on.includes(c)).map((e) => m.byId.get(e.to).label)) + '</td>'; });
      h += '</tr>';
    });
    tb.innerHTML = h + '</tbody>';
    tb.querySelectorAll('th, td').forEach((c) => { c.innerHTML = subHTML(c.innerHTML); });
    return wrap;
  }

  // text added to a page later still gets source chips and other package features
  function enhanceLater(node) {
    if (Study.sources && Study.sources.chipify) Study.sources.chipify(node);
    if (Study.enhance) Study.enhance(node);
  }

  /** Turn a .<prefix>sim / .<prefix>figure host with a JSON spec into a diagram (and simulator). */
  function mount(host) {
    if (host.dataset.smMounted !== undefined) return;
    const js = host.querySelector(':scope > script[type="application/json"]');
    if (!js) return;
    let cfg;
    try { cfg = JSON.parse(js.textContent); } catch (err) { console.error('[study] state-machine: bad JSON spec', host, err); return; }
    host.dataset.smMounted = '';
    host.setAttribute('data-sm', host.classList.contains(P + 'figure') ? 'figure' : 'sim');
    const machines = cfg.machines || [cfg];
    const figure = host.classList.contains(P + 'figure');
    const ui = html('div', role('ui')); host.appendChild(ui);
    let m, input = '', k = 0, trace = [];
    const pick = figure || machines.length < 2 ? null : html('div', role('pick', 'controls'));
    const dia = html('div', role('dia', 'diagram-wrap'));
    const note = html('p', role('note', 'aside'));
    if (pick) ui.appendChild(pick);
    ui.appendChild(dia); ui.appendChild(note);
    let tape, status, field, presets, tbl, bar;
    if (!figure) {
      const row = html('div', { class: 'controls' });
      const lab = html('label', { class: 'field' });
      const span = html('span', {}); span.textContent = t('inputLabel');
      field = html('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
      lab.append(span, field); row.appendChild(lab);
      presets = html('div', role('presets', 'controls'));
      tape = html('div', Object.assign(role('tape'), { 'aria-label': t('tapeLabel') }));
      bar = html('div', { class: 'controls' });
      [['reset', 'resetLabel', 'btn'], ['back', 'backLabel', 'btn'], ['step', 'stepLabel', 'btn primary'], ['run', 'runLabel', 'btn']].forEach(([a, key, c]) => {
        const b = html('button', { type: 'button', class: c, 'data-a': a }); b.textContent = t(key); bar.appendChild(b);
      });
      status = html('p', Object.assign(role('status'), { 'aria-live': 'polite' }));
      ui.append(row, presets, tape, bar, status);
      field.addEventListener('input', () => { input = field.value; reset(); });
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        const a = btn && btn.dataset.a;
        if (!a || bad().length) return;
        if (a === 'reset') k = 0;
        if (a === 'back') k = Math.max(0, k - 1);
        if (a === 'step') k = Math.min(input.length, k + 1);
        if (a === 'run') k = input.length;
        render();
      });
    }
    const bad = () => [...input].filter((c) => !m.alphabet.includes(c));
    function reset() { k = 0; trace = figure || bad().length ? [] : run(m, input); render(); }
    const verdict = (ok, text) => '<span class="' + P + 'verdict verdict ' + (ok ? 'ok' : 'no') + '" data-sm="verdict">' + text + '</span> ';
    function render() {
      const cur = trace[k];
      dia.replaceChildren(draw(m, cur ? { active: cur.set, edges: cur.used } : {}));
      if (tbl) { const nt = table(m, cur && cur.set); tbl.replaceWith(nt); tbl = nt; }
      if (figure) return;
      const wrong = bad();
      tape.replaceChildren(...[...input].map((c, i) => {
        const s = html('span', { class: 'cell' + (i < k ? ' read' : '') + (i === k ? ' next' : '') + (wrong.includes(c) ? ' badc' : '') });
        s.textContent = c; return s;
      }));
      if (!input.length) { const s = html('span', { class: 'cell empty' }); s.textContent = EPS; tape.appendChild(s); }
      bar.querySelectorAll('button').forEach((b) => { b.disabled = !!wrong.length; });
      if (wrong.length) {
        status.innerHTML = verdict(false, t('notInAlphabet')) + [...new Set(wrong)].join(' ') + ' — ' + t('readsOnly', { alphabet: m.alphabet.join(', ') });
        return;
      }
      bar.querySelector('[data-a=back]').disabled = bar.querySelector('[data-a=reset]').disabled = k === 0;
      bar.querySelector('[data-a=step]').disabled = bar.querySelector('[data-a=run]').disabled = k >= input.length;
      const names = m.states.filter((s) => cur.set.has(s.id)).map((s) => s.label);
      const where = m.nfa
        ? t('currentStates', { states: names.join(', ') }) + (names.length ? '' : t('noStatesLeft'))
        : (names[0] ? t('currentState', { state: names[0] }) : t('noTransition'));
      let msg = t('progress', { k, n: input.length }) + ' · ' + subHTML(where);
      if (k === input.length) { const ok = accepts(m, cur.set); msg = verdict(ok, ok ? t('acceptLabel') : t('rejectLabel')) + msg; }
      status.innerHTML = msg;
    }
    function load(i) {
      const c = machines[i];
      m = model(c);
      note.textContent = c.note || ''; note.hidden = !c.note;
      if (c.note) enhanceLater(note);
      if (tbl) { tbl.remove(); tbl = null; }
      if (c.table) { tbl = html('div', {}); ui.insertBefore(tbl, note.nextSibling); }
      if (pick) pick.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
      if (!figure) {
        presets.replaceChildren(...(c.inputs || []).map((s) => {
          const b = html('button', Object.assign(role('preset', 'btn'), { type: 'button' }));
          b.textContent = s === '' ? EPS : s;
          b.addEventListener('click', () => { field.value = s; input = s; reset(); }); return b;
        }));
        input = c.input !== undefined ? c.input : (c.inputs || [''])[0];
        field.value = input;
      }
      reset();
    }
    if (pick) machines.forEach((c, i) => {
      const b = html('button', { type: 'button', class: 'btn' }); b.textContent = c.name || t('machineName', { n: i + 1 });
      b.addEventListener('click', () => load(i)); pick.appendChild(b);
    });
    load(0);
  }

  Study.stateMachine = { model, draw, run, step, closure, accepts, table, mount, subHTML, prefix: P };
  Study.define('state-machine', {
    enhance(root) { Study.$$(root, '.' + P + 'sim, .' + P + 'figure').forEach(mount); },
  });
})();
