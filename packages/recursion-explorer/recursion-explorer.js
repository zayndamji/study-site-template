/* ==========================================================================
   recursion-explorer — run a recursive function for real and step through it.
   --------------------------------------------------------------------------
   A page script describes the code (shown with code-blocks) and the same
   function written in JavaScript with a few recording hooks. The package runs
   it once, records every event (call, line, print, local variable, return,
   extra state), then lets the reader step through the run: the current line,
   the call stack (a memory-diagram column), the call tree growing in call
   order with return values, the output, a nested expression view and counters
   all move together.

   API: Study.recursion = { mount(host, spec) → controller, record(spec, values) → run }
   Recording hooks inside a program (first argument of every function):
     rx.line(n)                 the line now running in the current call
     rx.call(name, args, opts)  call another recorded function; returns its value
                                opts: { label, wait: "n * □" (□ = the value it returns) }
     rx.print(text)             a line of output
     rx.set(name, value)        a local variable of the current call
     rx.show(key, scene)        an extra memory-diagram scene (array, grid, …) under the views
     rx.tag(mark, note)         mark the current call's tree node: "ok" | "bad" (+ optional note)
     rx.note(html)              a sentence for this step
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('recursion-explorer');
  const P = O.classPrefix === undefined ? 'rx-' : String(O.classPrefix);
  const t = (key, vals) => String(O[key] === undefined ? '' : O[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && k in vals ? vals[k] : m));
  const HOLE = '□';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function fmtValue(v) {
    if (v === undefined) return '';
    if (v === null) return 'null';
    if (typeof v === 'string') return '"' + v + '"';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (Array.isArray(v)) return '{' + v.map(fmtValue).join(', ') + '}';
    if (typeof v === 'object') return '{' + Object.keys(v).map((k) => k + ': ' + fmtValue(v[k])).join(', ') + '}';
    return String(v);
  }

  function paramNames(fn) {
    const m = /^[^(]*\(([^)]*)\)/.exec(Function.prototype.toString.call(fn));
    if (!m) return [];
    return m[1].split(',').map((s) => s.replace(/=.*$/, '').trim()).filter(Boolean).slice(1);
  }

  class Stop extends Error {}

  /** Run the program once and record its events. */
  function record(spec, values) {
    const fmt = spec.format || fmtValue;
    const limit = spec.maxSteps || O.maxSteps || 3000;
    const depthLimit = spec.maxDepth || O.maxDepth || 200;
    const events = [];
    const frames = [];       // all calls: {id, name, label, params, parent, depth}
    const live = [];         // ids of calls in progress
    let stopped = '';
    const push = (e) => { if (events.length >= limit) { stopped = t('limitText', { n: limit }); throw new Stop(); } events.push(e); };
    const cur = () => live[live.length - 1];
    const rx = {
      line(n) { push({ t: 'line', id: cur(), line: n }); },
      print(s) { push({ t: 'print', id: cur(), text: String(s) }); },
      set(name, value) { push({ t: 'set', id: cur(), name, value: fmt(value) }); },
      show(key, scene) { push({ t: 'show', id: cur(), key, scene: JSON.parse(JSON.stringify(scene)) }); },
      tag(mark, note) { push({ t: 'tag', id: cur(), mark, note }); },
      note(html) { push({ t: 'note', id: cur(), html }); },
      call(name, args, opts) {
        const fn = spec.functions[name];
        if (!fn) throw new Error('recursion-explorer: no function "' + name + '"');
        args = args || [];
        opts = opts || {};
        const id = frames.length;
        const parent = cur();
        const names = (spec.params && spec.params[name]) || paramNames(fn);
        const params = names.map((n, i) => ({ name: n, value: fmt(args[i]) }));
        const label = opts.label || (spec.callLabel ? spec.callLabel(name, args) : name + '(' + args.map(fmt).join(', ') + ')');
        const depth = parent === undefined ? 0 : frames[parent].depth + 1;
        if (depth > depthLimit) { stopped = t('depthText', { n: depthLimit }); throw new Stop(); }
        frames.push({ id, name, label, params, parent, depth });
        push({ t: 'call', id, parent, wait: opts.wait });
        live.push(id);
        let v;
        try { v = fn.apply(null, [rx].concat(args)); } finally { if (!(stopped)) live.pop(); }
        push({ t: 'return', id, value: v === undefined ? undefined : fmt(v), parent });
        return v;
      },
    };
    let result;
    try {
      // the driver is call 0, its frame named by spec.mainName
      const drive = spec.main || ((r, vals) => r.call(Object.keys(spec.functions)[0], (spec.args || []).map((a) => vals[a])));
      frames.push({ id: 0, name: '', label: spec.mainName || t('mainName'), params: [], parent: undefined, depth: -1, main: true });
      live.push(0);
      push({ t: 'start', id: 0 });
      result = drive(rx, values || {});
      push({ t: 'end', id: 0, value: result === undefined ? undefined : fmt(result) });
    } catch (err) {
      if (!(err instanceof Stop)) { stopped = t('errorText', { message: err.message }); console.error('[study] recursion-explorer:', err); }
    }
    return { events, frames, stopped, result };
  }

  /** The state after events[0..k]. */
  function stateAt(run, k) {
    const st = { stack: [], calls: [], output: [], shows: {}, line: null, note: '', lastPrint: -1, depth: 0, maxDepth: 0, nCalls: 0, returned: [], done: null };
    const info = new Map(); // id → {vars: Map, wait, resolved, ret, mark, tagNote, line}
    const get = (id) => { if (!info.has(id)) info.set(id, { vars: new Map(), wait: null, resolved: null, ret: undefined, mark: '', tagNote: '', line: null }); return info.get(id); };
    let live = [0];
    for (let i = 0; i <= k && i < run.events.length; i++) {
      const e = run.events[i];
      const me = get(e.id);
      if (i === k) st.note = '';
      switch (e.t) {
        case 'call': {
          const f = run.frames[e.id];
          f.params.forEach((p) => get(e.id).vars.set(p.name, p.value));
          if (e.parent !== undefined) { const pi = get(e.parent); pi.wait = e.wait || null; pi.resolved = null; }
          live.push(e.id);
          st.nCalls++;
          st.depth = live.length - 1;
          st.maxDepth = Math.max(st.maxDepth, st.depth);
          st.calls.push(e.id);
          break;
        }
        case 'return': {
          me.ret = e.value;
          st.returned.push(e.value);
          live = live.filter((x) => x !== e.id);
          if (e.parent !== undefined) { const pi = get(e.parent); if (pi.wait) pi.resolved = pi.wait.split(HOLE).join(e.value); }
          st.depth = live.length - 1;
          if (i === k) st.done = e.id;
          break;
        }
        case 'line': me.line = e.line; break;
        case 'print': st.output.push(e.text); st.lastPrint = i; break;
        case 'set': me.vars.set(e.name, e.value); break;
        case 'show': st.shows[e.key] = e.scene; break;
        case 'tag': me.mark = e.mark || ''; me.tagNote = e.note || ''; break;
        case 'note': if (i === k) st.note = e.html; break;
        default: break;
      }
    }
    st.live = live;
    st.info = info;
    st.event = run.events[Math.min(k, run.events.length - 1)];
    const top = st.done !== null ? st.done : live[live.length - 1];
    st.top = top;
    st.line = (info.get(top) || {}).line;
    if (st.event && st.event.t === 'print') st.printing = true;
    return st;
  }

  /** Nested expression of the live calls, e.g. answer = 3 + (2 + total(1)). */
  function expression(run, st) {
    const chain = st.live.slice();
    if (st.done !== null) chain.push(st.done);
    let inner = null;
    for (let j = chain.length - 1; j >= 0; j--) {
      const f = run.frames[chain[j]], i = st.info.get(chain[j]) || {};
      let own;
      if (inner === null) own = chain[j] === st.done && i.ret !== undefined ? i.ret : (i.resolved || (f.main ? '' : f.label));
      else if (i.wait) {
        // parenthesize a compound operand only where it meets an operator: "n * □" yes, "x = □" no
        const wrap = /\s/.test(inner) && /[+*/%-]\s*□|□\s*[+*/%-]/.test(i.wait);
        own = i.wait.split(HOLE).join(wrap ? '(' + inner + ')' : inner);
      }
      else own = inner;
      inner = own;
    }
    return inner || '';
  }

  function autoNote(run, st) {
    const e = st.event;
    if (!e) return '';
    const f = run.frames[e.id];
    const lab = f ? f.label : '';
    switch (e.t) {
      case 'start': return t('startText', { call: lab });
      case 'call': return t('callText', { caller: e.parent !== undefined ? run.frames[e.parent].label : '', call: lab });
      case 'return': return e.value === undefined ? t('returnVoidText', { call: lab }) : t('returnText', { call: lab, value: e.value });
      case 'print': return t('printText', { call: lab, text: e.text });
      case 'set': return t('setText', { call: lab, name: e.name, value: e.value });
      case 'line': return t('lineText', { call: lab, line: e.line });
      case 'end': return e.value === undefined ? t('endText', {}) : t('endValueText', { value: e.value });
      default: return '';
    }
  }

  function treeOf(run, st, spec) {
    const seen = new Set(st.calls);
    const kids = new Map();
    st.calls.forEach((id) => { const p = run.frames[id].parent; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(id); });
    const onPath = new Set();
    let x = st.top;
    while (x !== undefined) { onPath.add(x); x = run.frames[x].parent; }
    const node = (id) => {
      const f = run.frames[id], i = st.info.get(id) || {};
      const n = { v: f.label, key: id, c: (kids.get(id) || []).filter((c) => seen.has(c)).map(node) };
      if (id === st.top && !f.main) n.on = true;
      else if (onPath.has(id) && !f.main) n.mark = 'path';
      if (i.ret !== undefined) n.note = t('treeReturn', { value: i.ret });
      if (i.tagNote) n.note = (n.note ? n.note + ' ' : '') + i.tagNote;
      if (i.mark) n.mark = i.mark;
      if (f.main) n.v = f.label;
      return n;
    };
    const roots = kids.get(0) || [];
    if (!roots.length) return null;
    if (roots.length === 1 && !spec.treeMain) return node(roots[0]);
    return node(0);
  }

  function stackOf(run, st, spec) {
    const frames = (spec.above || []).map((f) => Object.assign({}, f));
    const ids = st.live.slice();
    if (st.done !== null) ids.push(st.done);
    ids.forEach((id) => {
      const f = run.frames[id], i = st.info.get(id) || { vars: new Map() };
      if (f.main && spec.mainFrame === false) return;
      const vars = [...i.vars].map(([name, value]) => ({ name, value }));
      const fr = { name: f.main ? f.label : t('frameName', { name: f.name, call: f.label }), vars };
      if (id === st.top) fr.on = true;
      if (id === st.done) {
        fr.done = true;
        if (i.ret !== undefined) fr.vars = vars.concat([{ name: t('returnsLabel'), value: i.ret, on: true }]);
      }
      frames.push(fr);
    });
    return frames;
  }

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function mount(host, spec) {
    if (typeof host === 'string') host = document.querySelector(host);
    if (!host || host.dataset.rxMounted !== undefined) return null;
    host.dataset.rxMounted = '';
    host.classList.add(P + 'explorer');
    host.setAttribute('data-rx', 'explorer');
    const views = spec.views || ['code', 'expr', 'stack', 'tree', 'output', 'stats', 'state'];
    const ui = el('div', { class: P + 'ui', 'data-rx': 'ui' });
    host.appendChild(ui);

    // inputs + presets
    const values = {};
    (spec.inputs || []).forEach((inp) => { values[inp.name] = inp.value; });
    let form = null;
    if ((spec.inputs || []).length) {
      form = el('div', { class: 'controls', 'data-rx': 'inputs' });
      spec.inputs.forEach((inp) => {
        const lab = el('label', { class: 'field' });
        lab.appendChild(el('span', {}, inp.label || inp.name));
        const f = el('input', { type: inp.type === 'text' ? 'text' : 'number', 'data-field': inp.name, value: inp.value,
          min: inp.min, max: inp.max, step: inp.step || (inp.type === 'text' ? undefined : 1), spellcheck: 'false', autocomplete: 'off' });
        if (inp.size) f.style.width = inp.size + 'ch';
        lab.appendChild(f);
        form.appendChild(lab);
        f.addEventListener('change', () => { values[inp.name] = read(inp, f); rerun(); if (presetRow && presetRow.clear) presetRow.clear(t('ownValues')); });
      });
      ui.appendChild(form);
    }
    const read = (inp, f) => {
      if (inp.type === 'text') return f.value;
      let v = Number(f.value);
      if (!isFinite(v)) v = inp.value;
      if (inp.min !== undefined) v = Math.max(inp.min, v);
      if (inp.max !== undefined) v = Math.min(inp.max, v);
      f.value = v;
      return v;
    };
    let presetRow = null, presetHost = null, presetNote = null;
    let run, steps, depthAt, k = 0, timer = null;
    if (spec.presets && spec.presets.length && Study.presets && Study.presets.mount) {
      presetHost = el('div', { 'data-rx': 'presets' }); presetNote = el('p', { class: 'aside', 'data-rx': 'pnote' });
      ui.append(presetHost, presetNote);
    }

    // code
    let code = null;
    if (views.includes('code') && spec.code !== undefined) {
      code = el('pre', { class: P + 'code', 'data-rx': 'code', 'data-lang': spec.lang || 'text' });
      if (spec.codeTitle) code.dataset.title = spec.codeTitle;
      code.textContent = spec.code;
    }

    // controls
    const bar = el('div', { class: 'controls', 'data-rx': 'bar' });
    const btn = (a, key, cls) => { const b = el('button', { type: 'button', class: cls || 'btn', 'data-a': a }, t(key)); bar.appendChild(b); return b; };
    btn('reset', 'resetLabel'); btn('back', 'backLabel'); btn('step', 'stepLabel', 'btn primary');
    btn('over', 'overLabel'); btn('out', 'outLabel'); const play = btn('play', 'playLabel'); btn('end', 'endLabel');
    const count = el('span', { 'data-rx': 'count', class: P + 'count' });
    bar.appendChild(count);
    const note = el('p', { 'data-rx': 'note', class: P + 'note', 'aria-live': 'polite' });
    const panes = el('div', { 'data-rx': 'panes', class: P + 'panes' });
    const pane = (key, label, wide) => {
      const p = el('div', { 'data-rx': 'pane', 'data-view': key, class: P + 'pane' + (wide ? ' wide' : '') });
      if (label) p.appendChild(el('div', { 'data-rx': 'phead', class: P + 'phead' }, label));
      const body = el('div', { 'data-rx': 'pbody', class: P + 'pbody' });
      p.appendChild(body);
      panes.appendChild(p);
      return { p, body };
    };
    const vExpr = views.includes('expr') ? pane('expr', t('exprLabel'), true) : null;
    const vCode = code ? pane('code', t('codeLabel')) : null;
    if (vCode) vCode.body.appendChild(code);
    const vStack = views.includes('stack') ? pane('stack', t('stackLabel')) : null;
    const vTree = views.includes('tree') ? pane('tree', t('treeLabel'), true) : null;
    const vState = views.includes('state') ? pane('state', t('stateLabel'), true) : null;
    const vOut = views.includes('output') ? pane('output', t('outputLabel')) : null;
    const vStats = views.includes('stats') ? pane('stats', t('statsLabel')) : null;
    ui.append(bar, note, panes);

    function rerun() {
      stopPlay();
      run = record(spec, values);
      const coarse = spec.steps === 'calls';
      steps = [];
      run.events.forEach((e, i) => { if (!coarse || /^(start|call|return|print|end|show)$/.test(e.t)) steps.push(i); });
      if (!steps.length) steps.push(0);
      depthAt = [];
      let d = 1;
      run.events.forEach((e) => { if (e.t === 'call') d++; if (e.t === 'return') d--; depthAt.push(d); });
      k = 0;
      // a pane that this run never uses is hidden
      const has = (type) => run.events.some((e) => e.t === type);
      if (vExpr) vExpr.p.hidden = !run.events.some((e) => e.t === 'call' && e.wait);
      if (vOut) vOut.p.hidden = !has('print');
      if (vState) vState.p.hidden = !has('show');
      if (vTree) vTree.p.hidden = !has('call');
      render();
    }
    function render() {
      const ei = steps[k];
      const st = stateAt(run, ei);
      count.textContent = t('countLabel', { k: k + 1, n: steps.length });
      const n = st.note || autoNote(run, st);
      note.innerHTML = n + (run.stopped && k === steps.length - 1 ? ' <strong>' + esc(run.stopped) + '</strong>' : '');
      if (code) {
        if (Study.code && !code.dataset.cbDone) Study.code.render(code);
        let first = null;
        code.querySelectorAll('.cb-line').forEach((ln) => {
          const on = st.line !== null && st.line !== undefined && +ln.dataset.line === st.line;
          ln.classList.toggle('cb-on', on);
          if (on) first = ln;
        });
        if (first && code.scrollHeight > code.clientHeight + 4) code.scrollTop = Math.max(0, first.offsetTop - code.clientHeight / 3);
      }
      if (vExpr && !vExpr.p.hidden) { vExpr.body.textContent = ''; const c = el('code', { 'data-lang': spec.lang || 'text' }, expression(run, st)); vExpr.body.appendChild(c); if (Study.enhance) Study.enhance(vExpr.body); }
      if (vStack && Study.memory) {
        vStack.body.textContent = '';
        const scene = Object.assign({ layout: 'memory', gap: 48, regionLabels: false }, spec.stackScene || {}, { stack: stackOf(run, st, spec) });
        const wrap = el('div', { class: 'diagram-wrap' });
        wrap.appendChild(Study.memory.draw(scene));
        vStack.body.appendChild(wrap);
      }
      if (vTree && !vTree.p.hidden && Study.memory) {
        vTree.body.textContent = '';
        const tree = treeOf(run, st, spec);
        if (tree) {
          const wrap = el('div', { class: 'diagram-wrap' });
          wrap.appendChild(Study.memory.draw(Object.assign({ arrows: !!spec.treeArrows, spacing: 10, levelGap: 56 }, spec.treeScene || {}, { tree })));
          vTree.body.appendChild(wrap);
        }
      }
      if (vState && !vState.p.hidden && Study.memory) {
        vState.body.textContent = '';
        Object.keys(st.shows).forEach((key) => {
          const wrap = el('div', { class: 'diagram-wrap' });
          wrap.appendChild(Study.memory.draw(st.shows[key]));
          vState.body.appendChild(wrap);
        });
      }
      if (vOut && !vOut.p.hidden) {
        vOut.body.textContent = '';
        const pre = el('pre', { 'data-rx': 'out', class: P + 'out' });
        st.output.forEach((line, j) => {
          const last = j === st.output.length - 1 && st.printing;
          const s = el('span', last ? { class: P + 'last', 'data-rx': 'last' } : {}, line);
          pre.appendChild(s); pre.appendChild(document.createTextNode('\n'));
        });
        if (!st.output.length) pre.textContent = ' ';
        vOut.body.appendChild(pre);
      }
      if (vStats) {
        vStats.body.textContent = '';
        const dl = el('dl', { 'data-rx': 'stats', class: P + 'stats' });
        const row = (key, val) => { dl.appendChild(el('dt', {}, t(key))); dl.appendChild(el('dd', {}, String(val))); };
        row('callsLabel', st.nCalls);
        row('depthLabel', Math.max(0, st.depth));
        row('maxDepthLabel', st.maxDepth);
        if (spec.showReturns !== false) row('returnsOrderLabel', st.returned.filter((v) => v !== undefined).join(', ') || '—');
        vStats.body.appendChild(dl);
      }
      bar.querySelector('[data-a="back"]').disabled = k === 0;
      bar.querySelector('[data-a="reset"]').disabled = k === 0;
      ['step', 'over', 'out', 'end'].forEach((a) => { bar.querySelector('[data-a="' + a + '"]').disabled = k >= steps.length - 1; });
      if (k >= steps.length - 1) stopPlay();
      host.dispatchEvent(new CustomEvent('rx:step', { detail: { k, n: steps.length, state: st } }));
    }
    const depthOf = (ei) => depthAt[ei];
    function stepOver() {
      const d = depthOf(steps[k]);
      let j = k + 1;
      while (j < steps.length - 1 && depthOf(steps[j]) > d) j++;
      // land after the returned call, not on its return event
      k = j;
    }
    function stepOut() {
      const st = stateAt(run, steps[k]);
      const me = st.top;
      let j = k + 1;
      while (j < steps.length - 1 && !(run.events[steps[j]].t === 'return' && run.events[steps[j]].id === me)) j++;
      k = j;
    }
    function stopPlay() { if (timer) { clearInterval(timer); timer = null; play.textContent = t('playLabel'); play.setAttribute('aria-pressed', 'false'); } }
    function startPlay() {
      if (k >= steps.length - 1) k = 0;
      play.textContent = t('pauseLabel'); play.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => { if (k < steps.length - 1) { k++; render(); } else stopPlay(); }, spec.speed || O.speed || 700);
    }
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      const a = b && b.dataset.a;
      if (!a) return;
      if (a === 'play') { if (timer) stopPlay(); else startPlay(); return; }
      stopPlay();
      if (a === 'reset') k = 0;
      if (a === 'back') k = Math.max(0, k - 1);
      if (a === 'step') k = Math.min(steps.length - 1, k + 1);
      if (a === 'over') stepOver();
      if (a === 'out') stepOut();
      if (a === 'end') k = steps.length - 1;
      render();
    });
    if (vTree) vTree.body.addEventListener('click', (e) => {
      const node = e.target.closest('[data-key]');
      if (!node) return;
      const id = +node.getAttribute('data-key');
      const j = steps.findIndex((ei) => run.events[ei].t === 'call' && run.events[ei].id === id);
      if (j >= 0) { stopPlay(); k = j; render(); }
    });
    if (presetHost) {
      presetRow = Study.presets.mount(presetHost, spec.presets.map((p) => ({ name: p.label, note: p.note, value: p.values })), (pr) => {
        Object.assign(values, pr.value);
        if (form) (spec.inputs || []).forEach((inp) => { const f = form.querySelector('[data-field="' + inp.name + '"]'); if (f && inp.name in pr.value) f.value = pr.value[inp.name]; });
        rerun();
      }, { note: presetNote });
    }
    if (!run) rerun();
    return {
      run: () => run, step: (n) => { k = Math.max(0, Math.min(steps.length - 1, n)); render(); },
      set: (vals) => { Object.assign(values, vals); rerun(); }, get steps() { return steps.length; }, get index() { return k; },
    };
  }

  Study.recursion = { mount, record, stateAt, expression, format: fmtValue, prefix: P };
  Study.define('recursion-explorer', {});
})();
