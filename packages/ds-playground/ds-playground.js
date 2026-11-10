/* ==========================================================================
   ds-playground — interactive playgrounds for abstract data types: press
   operations, watch the structure change (drawn with memory-diagram), step
   through the work of an operation, and count its cost.
   --------------------------------------------------------------------------
   Markup: <div class="widget dsp-playground"><div class="lbl">…</div>
           <script type="application/json">{spec}</script></div>
   Generated elements get classes <classPrefix><role> (default "dsp-") and
   data-dsp="<role>", which this package's CSS uses.
   API: Study.playground = { model(kind, spec), mount(host, spec), kinds, prefix }
   model(…).apply(op, args) → { call, result, hasResult, text, error, cost, steps: [scene] }
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('ds-playground') || {};
  const P = O.classPrefix === undefined || O.classPrefix === null ? 'dsp-' : String(O.classPrefix);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ---- labels: package options, overridden per playground by spec.labels ----
  const fill = (s, vals) => String(s === undefined || s === null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (vals && has(vals, k) ? vals[k] : m));
  function labeler(spec) {
    const own = (spec && spec.labels) || {};
    const t = (key, vals) => fill(has(own, key) ? own[key] : O[key], vals);
    t.op = (name) => (own.opLabels && own.opLabels[name]) || (O.opLabels && O.opLabels[name]) || name;
    return t;
  }

  // ---- kinds: operations (argument types: i index, v value, k key, p priority) and cost counters ----
  const KINDS = {
    vector: { metrics: ['moved'], ops: { add: 'v', insert: 'iv', remove: 'i', get: 'i', set: 'iv', size: '', clear: '' } },
    stack: { metrics: ['touched'], ops: { push: 'v', pop: '', peek: '', isEmpty: '', size: '' } },
    queue: { metrics: ['touched'], ops: { enqueue: 'v', dequeue: '', peek: '', isEmpty: '', size: '' } },
    set: { metrics: ['compares'], ops: { add: 'v', remove: 'v', contains: 'v', size: '' } },
    map: { metrics: ['compares'], ops: { put: 'kv', get: 'k', remove: 'k', containsKey: 'k', size: '' } },
    'pq-heap': { metrics: ['compares', 'swaps'], ops: { enqueue: 'p', dequeue: '', peek: '', isEmpty: '', size: '' } },
    'linked-list': { metrics: ['visited'], ops: { add: 'v', addFront: 'v', insert: 'iv', remove: 'i', get: 'i', size: '' } },
    bst: { metrics: ['visited'], ops: { put: 'k', contains: 'k', remove: 'k', size: '' } },
  };
  const METRIC = { moved: 'costMoved', visited: 'costVisited', swaps: 'costSwaps', compares: 'costCompares', touched: 'costTouched' };

  // numbers before text; numbers by value, text by code points
  function cmp(a, b) {
    const na = typeof a === 'number', nb = typeof b === 'number';
    if (na && nb) return a - b;
    if (na !== nb) return na ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const show = (v) => (v === undefined || v === null ? '' : String(v));
  const quote = (v) => (typeof v === 'string' ? JSON.stringify(v) : show(v));
  const range = (n) => Array.from({ length: n }, (_, j) => j);
  const ERR = (msg) => ({ error: msg });

  // ---- engines: one per kind. Each has load(list), run(op, args, ctx), scene(), info(), contents() ----
  function vectorEngine(spec, t, max) {
    let a = [], cap = null;
    const cap0 = spec.capacity > 0 ? Math.floor(spec.capacity) : null;
    const growth = spec.growth > 1 ? Number(spec.growth) : 2;
    function scene(on, arr, c) {
      on = on || []; arr = arr || a; c = c === undefined ? cap : c;
      const cells = arr.map((v, j) => ({ value: show(v), on: on.includes(j) }));
      for (let j = arr.length; c && j < c; j++) cells.push({ value: '', dim: true });
      return cells.length ? { array: { cells, index: true } } : { array: { cells: [], label: t('emptyLabel') } };
    }
    function insertAt(i, v, ctx) {
      const n = a.length;
      if (n >= max) return ERR(t('errorFull', { max }));
      if (cap !== null && n >= cap) {
        const nc = Math.max(cap + 1, Math.ceil(cap * growth));
        ctx.cost.moved += n;
        ctx.step(scene(range(n), a, nc), 'noteGrow', { n, capacity: nc });
        cap = nc;
      }
      const w = a.slice(); w.length = n + 1;
      for (let j = n - 1; j >= i; j--) {
        w[j + 1] = w[j]; ctx.cost.moved++;
        ctx.step(scene([j + 1], w), 'noteMove', { value: show(w[j]), from: j, to: j + 1 });
      }
      w[i] = v; a = w;
      ctx.step(scene([i]), 'noteWrite', { value: show(v), index: i });
      return {};
    }
    const inRange = (i) => i >= 0 && i < a.length;
    return {
      load(list) { a = list.slice(0, max); cap = cap0 === null ? null : Math.max(cap0, a.length); },
      scene,
      info: () => ({ size: a.length, capacity: cap }),
      contents: () => a.slice(),
      run(op, x, ctx) {
        const n = a.length;
        switch (op) {
          case 'add': return insertAt(n, x[0], ctx);
          case 'insert': return x[0] < 0 || x[0] > n ? ERR(t('errorIndex')) : insertAt(x[0], x[1], ctx);
          case 'remove': {
            const i = x[0];
            if (!inRange(i)) return ERR(t('errorIndex'));
            const val = a[i], w = a.slice();
            ctx.step(scene([i]), 'noteTake', { value: show(val), index: i });
            for (let j = i; j < n - 1; j++) {
              w[j] = w[j + 1]; ctx.cost.moved++;
              ctx.step(scene([j], w), 'noteMove', { value: show(w[j]), from: j + 1, to: j });
            }
            w.pop(); a = w;
            ctx.step(scene(), 'noteRemoved', { size: a.length });
            return { result: val };
          }
          case 'get':
            if (!inRange(x[0])) return ERR(t('errorIndex'));
            ctx.step(scene([x[0]]), 'noteRead', { index: x[0], value: show(a[x[0]]) });
            return { result: a[x[0]] };
          case 'set':
            if (!inRange(x[0])) return ERR(t('errorIndex'));
            a[x[0]] = x[1];
            ctx.step(scene([x[0]]), 'noteWrite', { value: show(x[1]), index: x[0] });
            return {};
          case 'size': return { result: n };
          case 'clear': a = []; return {};
        }
        return null;
      },
    };
  }

  // stack (top = last element) and queue (front = first element)
  function lineEngine(kind, spec, t, max) {
    let a = [];
    const stack = kind === 'stack', vertical = stack && spec.orientation !== 'horizontal';
    function name(j) {
      const n = a.length;
      if (stack) return j === n - 1 ? t('topLabel') : '';
      if (n === 1) return t('frontBackLabel');
      return j === 0 ? t('frontLabel') : j === n - 1 ? t('backLabel') : '';
    }
    function scene(on) {
      on = on || [];
      const n = a.length;
      const cells = a.map((v, j) => ({ name: name(j), value: show(v), on: on.includes(j) }));
      if (vertical) return { stack: [{ name: n ? t('sizeLabel', { size: n }) : t('emptyLabel'), vars: cells.reverse() }], regionLabels: false };
      return { heap: [{ id: 'line', label: n ? '' : t('emptyLabel'), fields: cells }], regionLabels: false };
    }
    const end = () => (stack ? a.length - 1 : 0);
    return {
      load(list) { a = list.slice(0, max); },
      scene,
      info: () => ({ size: a.length }),
      contents: () => a.slice(),
      run(op, x, ctx) {
        switch (op) {
          case 'push': case 'enqueue':
            if (a.length >= max) return ERR(t('errorFull', { max }));
            a.push(x[0]); ctx.cost.touched++;
            ctx.step(scene([a.length - 1]), '');
            return {};
          case 'pop': case 'dequeue': {
            if (!a.length) return ERR(t('errorEmpty'));
            ctx.cost.touched++;
            const v = stack ? a.pop() : a.shift();
            return { result: v };
          }
          case 'peek':
            if (!a.length) return ERR(t('errorEmpty'));
            ctx.cost.touched++;
            ctx.step(scene([end()]), '');
            return { result: a[end()] };
          case 'isEmpty': return { result: a.length === 0 };
          case 'size': return { result: a.length };
        }
        return null;
      },
    };
  }

  /** Binary search over sorted keys, one step per probe; returns {found, at}. */
  function bsearch(keys, key, ctx, sc) {
    let lo = 0, hi = keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      ctx.cost.compares++;
      const c = cmp(key, keys[mid]);
      if (c === 0) { ctx.step(sc([mid], lo, hi), 'noteFound', { key: show(key) }); return { found: true, at: mid }; }
      ctx.step(sc([mid], lo, hi), c < 0 ? 'noteLeft' : 'noteRight', { key: show(key), other: show(keys[mid]) });
      if (c < 0) hi = mid - 1; else lo = mid + 1;
    }
    return { found: false, at: lo };
  }

  // set: sorted values; map: entries sorted by key
  function sortedEngine(kind, spec, t, max) {
    const isMap = kind === 'map';
    let e = []; // set: values; map: [key, value]
    const keys = () => (isMap ? e.map((x) => x[0]) : e);
    function scene(on, lo, hi) {
      on = on || [];
      const dim = (j) => lo !== undefined && (j < lo || j > hi);
      if (isMap) {
        return { stack: [{ name: e.length ? t('sizeLabel', { size: e.length }) : t('emptyLabel'),
          vars: e.map(([k, v], j) => ({ name: show(k), value: show(v), on: on.includes(j), dim: dim(j) })) }], regionLabels: false };
      }
      const cells = e.map((v, j) => ({ value: show(v), on: on.includes(j), dim: dim(j) }));
      return cells.length ? { array: { cells } } : { array: { cells: [], label: t('emptyLabel') } };
    }
    function insert(item) {
      const r = bsearch(keys(), isMap ? item[0] : item, { cost: { compares: 0 }, step() {} }, scene);
      if (r.found) { if (isMap) e[r.at] = item; } else if (e.length < max) e.splice(r.at, 0, item);
    }
    return {
      load(list) { e = []; list.forEach(insert); },
      scene,
      info: () => ({ size: e.length }),
      contents: () => e.map((x) => (isMap ? x.slice() : x)),
      run(op, x, ctx) {
        if (op === 'size') return { result: e.length };
        const key = x[0];
        const r = bsearch(keys(), key, ctx, scene);
        const kv = { key: show(key) };
        switch (op) {
          case 'add': case 'put':
            if (r.found) {
              if (!isMap) { ctx.step(scene([r.at]), 'noteAlready', kv); return { result: false }; }
              e[r.at] = [key, x[1]];
              ctx.step(scene([r.at]), 'noteReplace', { key: show(key), value: show(x[1]) });
              return {};
            }
            if (e.length >= max) return ERR(t('errorFull', { max }));
            e.splice(r.at, 0, isMap ? [key, x[1]] : key);
            ctx.step(scene([r.at]), 'noteInsertAt', kv);
            return isMap ? {} : { result: true };
          case 'remove':
            if (!r.found) { ctx.step(scene(), 'noteNotFound', kv); return isMap ? ERR(t('errorKey')) : { result: false }; }
            {
              const old = e.splice(r.at, 1)[0];
              ctx.step(scene(), 'noteRemoveKey', kv);
              return { result: isMap ? old[1] : true };
            }
          case 'contains': case 'containsKey':
            if (!r.found) ctx.step(scene(), 'noteNotFound', kv);
            return { result: r.found };
          case 'get':
            if (!r.found) { ctx.step(scene(), 'noteNotFound', kv); return ERR(t('errorKey')); }
            return { result: e[r.at][1] };
        }
        return null;
      },
    };
  }

  // priority queue on a binary heap (array h, 0-based inside; shown from index `base`)
  function heapEngine(spec, t, max, pairs) {
    let h = [];
    const base = spec.base === 0 ? 0 : 1;
    const maxHeap = spec.order === 'max';
    const before = (x, y) => (maxHeap ? x.p > y.p : x.p < y.p);
    const fmt = (x) => (pairs ? t('entryFormat', { value: show(x.v), priority: show(x.p) }) : show(x.p));
    function scene(on) {
      on = on || [];
      if (!h.length) return { array: { cells: [], label: t('emptyLabel') } };
      const node = (j) => {
        const nd = { v: fmt(h[j]), on: on.includes(j) };
        const l = 2 * j + 1;
        if (l < h.length) { nd.l = node(l); if (l + 1 < h.length) nd.r = node(l + 1); }
        return nd;
      };
      return { tree: node(0), array: { cells: h.map((x, j) => ({ value: fmt(x), on: on.includes(j) })), index: base } };
    }
    const swap = (i, j) => { const x = h[i]; h[i] = h[j]; h[j] = x; };
    const NOP = { cost: { compares: 0, swaps: 0 }, step() {} };
    function up(j, ctx) {
      let moved = false;
      while (j > 0) {
        const pj = (j - 1) >> 1;
        ctx.cost.compares++;
        if (!before(h[j], h[pj])) { ctx.step(scene([j, pj]), 'noteUpStop', { value: fmt(h[j]), other: fmt(h[pj]) }); return; }
        ctx.step(scene([j, pj]), 'noteUpSwap', { value: fmt(h[j]), other: fmt(h[pj]) });
        swap(j, pj); ctx.cost.swaps++; moved = true;
        ctx.step(scene([pj, j]), 'noteSwapped', { value: fmt(h[pj]), index: pj + base });
        j = pj;
      }
      if (moved) ctx.step(scene([0]), 'noteAtRoot', { value: fmt(h[0]) });
    }
    function down(ctx) {
      let j = 0;
      for (;;) {
        const l = 2 * j + 1, r = l + 1;
        if (l >= h.length) { ctx.step(scene([j]), 'noteDownLeaf', { value: fmt(h[j]) }); return; }
        let b = l;
        if (r < h.length) { ctx.cost.compares++; if (before(h[r], h[l])) b = r; }
        ctx.cost.compares++;
        if (!before(h[b], h[j])) { ctx.step(scene([j, b]), 'noteDownStop', { value: fmt(h[j]), other: fmt(h[b]) }); return; }
        ctx.step(scene([j, b]), 'noteDownSwap', { value: fmt(h[j]), other: fmt(h[b]) });
        swap(j, b); ctx.cost.swaps++;
        ctx.step(scene([b, j]), 'noteSwapped', { value: fmt(h[b]), index: b + base });
        j = b;
      }
    }
    function entry(item) {
      if (typeof item === 'number') return { p: item };
      if (Array.isArray(item)) return pairs ? { v: item[0], p: Number(item[1]) } : { p: Number(item[item.length - 1]) };
      if (item && typeof item === 'object') return { v: item.value, p: Number(item.priority) };
      return { p: Number(item) };
    }
    const out = (x) => (pairs ? x.v : x.p);
    return {
      load(list) {
        h = [];
        list.forEach((item) => { const x = entry(item); if (h.length < max && isFinite(x.p)) { h.push(x); up(h.length - 1, NOP); } });
      },
      scene,
      info: () => ({ size: h.length }),
      contents: () => h.map((x) => (pairs ? { value: x.v, priority: x.p } : x.p)),
      run(op, x, ctx) {
        switch (op) {
          case 'enqueue': {
            if (h.length >= max) return ERR(t('errorFull', { max }));
            const it = pairs ? { v: x[0], p: x[1] } : { p: x[0] };
            h.push(it);
            ctx.step(scene([h.length - 1]), 'noteAppend', { value: fmt(it), index: h.length - 1 + base });
            up(h.length - 1, ctx);
            return {};
          }
          case 'dequeue': {
            if (!h.length) return ERR(t('errorEmpty'));
            const top = h[0];
            ctx.step(scene([0]), 'noteTakeRoot', { value: fmt(top) });
            const last = h.pop();
            if (h.length) { h[0] = last; ctx.step(scene([0]), 'noteMoveLast', { value: fmt(last) }); down(ctx); }
            else ctx.step(scene(), '');
            return { result: out(top) };
          }
          case 'peek':
            if (!h.length) return ERR(t('errorEmpty'));
            ctx.step(scene([0]), '');
            return { result: out(h[0]) };
          case 'isEmpty': return { result: h.length === 0 };
          case 'size': return { result: h.length };
        }
        return null;
      },
    };
  }

  // singly linked list: head (and optional tail) pointers in a frame, nodes on the heap
  function listEngine(spec, t, max) {
    let nodes = [], uid = 0;
    const tail = !!spec.tail;
    const perRow = spec.perRow > 0 ? Math.floor(spec.perRow) : 4;
    const mk = (v) => ({ id: 'n' + (++uid), v });
    function scene(on, cur) {
      on = on || [];
      const n = nodes.length;
      const vars = [{ name: t('headLabel'), ptr: n ? nodes[0].id : null }];
      if (tail) vars.push({ name: t('tailLabel'), ptr: n ? nodes[n - 1].id : null });
      if (cur !== undefined && cur !== null && nodes[cur]) vars.push({ name: t('curLabel'), ptr: nodes[cur].id, on: true });
      const heap = nodes.map((nd, j) => ({ id: nd.id, row: Math.floor(j / perRow), gap: 40, on: on.includes(j),
        fields: [{ name: t('valueField'), value: show(nd.v) }, { name: t('nextField'), ptr: j + 1 < n ? nodes[j + 1].id : null }] }));
      return { stack: [{ name: n ? t('sizeLabel', { size: n }) : t('emptyLabel'), vars }], heap, layout: 'rows', regionLabels: false };
    }
    function walk(upto, ctx) { // cur moves from the head to node `upto`
      for (let j = 0; j <= upto; j++) {
        ctx.cost.visited++;
        ctx.step(scene([j], j), 'noteVisit', { index: j, value: show(nodes[j].v) });
      }
    }
    function insertAt(i, v, ctx) {
      if (nodes.length >= max) return ERR(t('errorFull', { max }));
      if (i > 0) walk(i - 1, ctx);
      nodes.splice(i, 0, mk(v));
      ctx.step(scene([i]), 'noteNewNode', { value: show(v) });
      return {};
    }
    return {
      load(list) { nodes = list.slice(0, max).map(mk); },
      scene,
      info: () => ({ size: nodes.length }),
      contents: () => nodes.map((nd) => nd.v),
      run(op, x, ctx) {
        const n = nodes.length;
        switch (op) {
          case 'addFront': return insertAt(0, x[0], ctx);
          case 'insert': return x[0] < 0 || x[0] > n ? ERR(t('errorIndex')) : insertAt(x[0], x[1], ctx);
          case 'add':
            if (!tail || !n) return insertAt(n, x[0], ctx);
            if (n >= max) return ERR(t('errorFull', { max }));
            ctx.cost.visited++;
            ctx.step(scene([n - 1]), 'noteUseTail', { value: show(nodes[n - 1].v) });
            nodes.push(mk(x[0]));
            ctx.step(scene([n]), 'noteNewNode', { value: show(x[0]) });
            return {};
          case 'get':
            if (x[0] < 0 || x[0] >= n) return ERR(t('errorIndex'));
            walk(x[0], ctx);
            return { result: nodes[x[0]].v };
          case 'remove': {
            const i = x[0];
            if (i < 0 || i >= n) return ERR(t('errorIndex'));
            if (i > 0) walk(i - 1, ctx);
            ctx.cost.visited++; // read the node itself to find what follows it
            ctx.step(scene([i], i > 0 ? i - 1 : null), 'noteUnlink', { value: show(nodes[i].v) });
            const v = nodes.splice(i, 1)[0].v;
            ctx.step(scene(), 'noteRemoved', { size: nodes.length });
            return { result: v };
          }
          case 'size': return { result: n };
        }
        return null;
      },
    };
  }

  // binary search tree of keys
  function bstEngine(spec, t, max) {
    let root = null, count = 0;
    const node = (k) => ({ k, l: null, r: null });
    function scene(on) {
      on = on || [];
      if (!root) return { array: { cells: [], label: t('emptyLabel') } };
      const conv = (n) => {
        const o = { v: show(n.k), on: on.includes(n) };
        if (n.l || n.r) { o.l = n.l ? conv(n.l) : undefined; o.r = n.r ? conv(n.r) : undefined; }
        return o;
      };
      return { tree: conv(root) };
    }
    const levels = (n) => (n ? 1 + Math.max(levels(n.l), levels(n.r)) : 0);
    function descend(k, ctx, foundNote) {
      const path = [];
      let cur = root, parent = null;
      while (cur) {
        ctx.cost.visited++; path.push(cur);
        const c = cmp(k, cur.k);
        if (c === 0) { ctx.step(scene(path), foundNote || 'noteFound', { key: show(k) }); return { node: cur, parent, path }; }
        ctx.step(scene(path), c < 0 ? 'noteLeft' : 'noteRight', { key: show(k), other: show(cur.k) });
        parent = cur; cur = c < 0 ? cur.l : cur.r;
      }
      return { node: null, parent, path };
    }
    function put(k, ctx) {
      if (!root) {
        if (count >= max) return ERR(t('errorFull', { max }));
        root = node(k); count = 1;
        ctx.step(scene([root]), 'noteInsertAt', { key: show(k) });
        return {};
      }
      const r = descend(k, ctx, 'noteAlready');
      if (r.node) return {};
      if (count >= max) return ERR(t('errorFull', { max }));
      const n = node(k);
      if (cmp(k, r.parent.k) < 0) r.parent.l = n; else r.parent.r = n;
      count++;
      ctx.step(scene(r.path.concat([n])), 'noteInsertAt', { key: show(k) });
      return {};
    }
    const NOP = { cost: { visited: 0 }, step() {} };
    const inorder = (n, out) => { if (n) { inorder(n.l, out); out.push(n.k); inorder(n.r, out); } return out; };
    return {
      load(list) { root = null; count = 0; list.forEach((k) => put(k, NOP)); },
      scene,
      info: () => ({ size: count, height: spec.heightEdges ? levels(root) - 1 : levels(root) }),
      contents: () => inorder(root, []),
      run(op, x, ctx) {
        const k = x[0];
        switch (op) {
          case 'put': return put(k, ctx);
          case 'contains': {
            const r = descend(k, ctx);
            if (!r.node) ctx.step(scene(r.path), 'noteNotFound', { key: show(k) });
            return { result: !!r.node };
          }
          case 'remove': {
            const r = descend(k, ctx);
            if (!r.node) { ctx.step(scene(r.path), 'noteNotFound', { key: show(k) }); return { result: false }; }
            const d = r.node;
            if (d.l && d.r) { // two children: the smallest key on the right takes its place
              const path = r.path.slice();
              let sp = d, s = d.r;
              for (;;) {
                ctx.cost.visited++; path.push(s);
                ctx.step(scene(path), 'noteSuccessor', { key: show(d.k), other: show(s.k) });
                if (!s.l) break;
                sp = s; s = s.l;
              }
              const old = d.k;
              d.k = s.k;
              if (sp === d) sp.r = s.r; else sp.l = s.r;
              count--;
              ctx.step(scene([d]), 'noteTakesPlace', { key: show(old), other: show(s.k) });
            } else {
              const child = d.l || d.r;
              if (!r.parent) root = child; else if (r.parent.l === d) r.parent.l = child; else r.parent.r = child;
              count--;
              ctx.step(scene(child ? [child] : []), child ? 'noteSplice' : 'noteRemoveLeaf', { key: show(k) });
            }
            return { result: true };
          }
          case 'size': return { result: count };
        }
        return null;
      },
    };
  }

  /** model(kind, spec) or model(spec): a DOM-free playground model. */
  function model(kind, spec) {
    if (kind && typeof kind === 'object') { spec = kind; kind = spec.kind; }
    spec = spec || {};
    const K = KINDS[kind];
    if (!K) throw new Error('ds-playground: unknown kind ' + JSON.stringify(kind));
    const t = labeler(spec);
    const pairs = kind === 'pq-heap' && !!spec.pairs;
    const sig = Object.assign({}, K.ops, pairs ? { enqueue: 'vp' } : {});
    const offered = (Array.isArray(spec.ops) && spec.ops.length ? spec.ops : Object.keys(sig)).filter((o) => has(sig, o));
    const max = spec.max > 0 ? Math.floor(spec.max) : (O.maxSize > 0 ? O.maxSize : 12);
    const maxLen = spec.maxLength > 0 ? spec.maxLength : (O.maxLength > 0 ? O.maxLength : 8);
    const vtype = spec.valueType || 'any';

    function parse(type, raw) {
      const s = show(raw).trim();
      if (type === 'i') {
        if (typeof raw === 'number') return Number.isInteger(raw) ? { v: raw } : ERR(t('errorInteger'));
        return /^[-+]?\d+$/.test(s) ? { v: Number(s) } : ERR(t('errorInteger'));
      }
      if (type === 'p') {
        if (typeof raw === 'number') return isFinite(raw) ? { v: raw } : ERR(t('errorNumber'));
        return s !== '' && isFinite(Number(s)) ? { v: Number(s) } : ERR(t('errorNumber'));
      }
      if (typeof raw === 'number' && isFinite(raw)) return vtype === 'text' ? { v: String(raw) } : { v: raw };
      if (!s) return ERR(t('errorValue'));
      const num = /^-?\d+(\.\d+)?$/.test(s);
      if (vtype === 'number' && !num) return ERR(t('errorNumber'));
      if (num && vtype !== 'text') return { v: Number(s) };
      if (s.length > maxLen) return ERR(t('errorLong', { n: maxLen }));
      return { v: s };
    }
    const initValue = (v) => { const r = parse('v', v); return r.error ? null : r.v; };

    let E;
    if (kind === 'vector') E = vectorEngine(spec, t, max);
    else if (kind === 'stack' || kind === 'queue') E = lineEngine(kind, spec, t, max);
    else if (kind === 'set' || kind === 'map') E = sortedEngine(kind, spec, t, max);
    else if (kind === 'pq-heap') E = heapEngine(spec, t, max, pairs);
    else if (kind === 'linked-list') E = listEngine(spec, t, max);
    else E = bstEngine(spec, t, max);

    function normInitial(init) {
      if (init === undefined || init === null) return [];
      if (kind === 'map') {
        const list = Array.isArray(init) ? init : Object.keys(init).map((k) => [k, init[k]]);
        return list.filter((x) => Array.isArray(x) && x.length >= 2).map((x) => [initValue(x[0]), initValue(x[1])]).filter((x) => x[0] !== null);
      }
      if (!Array.isArray(init)) return [];
      if (kind === 'pq-heap') return init.map((x) => (Array.isArray(x) ? [initValue(x[0]), x[1]] : x));
      return init.map(initValue).filter((v) => v !== null);
    }
    const decorate = (scene) => {
      if (spec.title) scene.title = spec.title;
      if (spec.scale) scene.scale = spec.scale;
      return scene;
    };
    const zero = () => { const c = {}; K.metrics.forEach((k) => { c[k] = 0; }); return c; };
    const showResult = (v) => (v === true ? t('trueLabel') : v === false ? t('falseLabel') : show(v));

    function apply(op, args) {
      args = args === undefined ? [] : Array.isArray(args) ? args : [args];
      const label = has(sig, op) ? t.op(op) : String(op);
      const fail = (msg, vals) => ({ op, args: vals, call: label + '(' + vals.map(quote).join(', ') + ')', error: msg, text: msg,
        hasResult: false, result: undefined, cost: zero(), steps: [] });
      if (!has(sig, op)) return fail(t('errorOp', { op }), args);
      const types = sig[op].split('');
      const vals = [];
      for (let j = 0; j < types.length; j++) {
        const r = parse(types[j], args[j]);
        if (r.error) return fail(r.error, args.slice(0, types.length));
        vals.push(r.v);
      }
      const cost = zero(), steps = [];
      const ctx = { cost, step(scene, key, v) { steps.push(Object.assign(decorate(scene), { note: key ? t(key, v) : '', cost: Object.assign({}, cost) })); } };
      const out = E.run(op, vals, ctx) || {};
      // engines draw the last step of every operation that does work; the rest get the plain picture
      if (!steps.length && !out.error) ctx.step(E.scene(), '');
      const res = { op, args: vals, call: label + '(' + vals.map(quote).join(', ') + ')', cost, steps,
        error: out.error || null, hasResult: has(out, 'result'), result: out.result };
      res.text = res.error ? res.error : res.hasResult ? t('returned', { value: showResult(out.result) }) : t('noReturn');
      return res;
    }

    E.load(normInitial(spec.initial));
    return {
      kind,
      ops: offered.map((name) => ({ name, label: t.op(name), args: sig[name].split('') })),
      signature: Object.assign({}, sig),
      metrics: K.metrics.slice(),
      metricLabel: (m) => t(METRIC[m]),
      labels: t,
      max,
      apply,
      scene: () => decorate(E.scene()),
      info: () => E.info(),
      size: () => E.info().size,
      contents: () => E.contents(),
      reset(init) { E.load(normInitial(init === undefined ? spec.initial : init)); },
    };
  }

  // ---- the widget ------------------------------------------------------------
  const role = (name, extra) => ({ class: P + name + (extra ? ' ' + extra : ''), 'data-dsp': name });
  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const FIELD = { i: 'indexLabel', k: 'keyLabel', v: 'valueLabel', p: 'priorityLabel' };

  /** Turn a host (element or id) into a playground; spec defaults to the host's JSON child. Returns a handle. */
  function mount(host, spec) {
    host = typeof host === 'string' ? document.getElementById(host) : host;
    if (!host) return null;
    if (host._dsp) return host._dsp;
    if (!spec) {
      const js = host.querySelector(':scope > script[type="application/json"]');
      if (!js) return null;
      try { spec = JSON.parse(js.textContent); } catch (err) { console.error('[study] ds-playground: bad JSON spec', host, err); return null; }
    }
    let m;
    try { m = model(spec.kind, spec); } catch (err) { console.error('[study] ' + err.message, host); return null; }
    host.dataset.dspMounted = '';
    host.setAttribute('data-dsp', 'playground');
    const t = m.labels;
    const stepMode = spec.steps !== false;
    const ui = el('div', role('ui'));
    host.appendChild(ui);

    // fields and operation buttons
    const need = [];
    m.ops.forEach((o) => o.args.forEach((a) => { if (!need.includes(a)) need.push(a); }));
    const inputs = {};
    const fields = el('div', role('fields', 'controls'));
    ['i', 'k', 'v', 'p'].filter((a) => need.includes(a)).forEach((a) => {
      const lab = el('label', { class: 'field' });
      const numeric = a === 'i' || a === 'p' || spec.valueType === 'number';
      const inp = el('input', { type: 'text', inputmode: numeric ? (a === 'i' ? 'numeric' : 'decimal') : null,
        autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', 'data-arg': a });
      lab.append(el('span', {}, t(FIELD[a])), inp);
      fields.appendChild(lab);
      inputs[a] = inp;
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const o = m.ops.find((x) => x.args.includes(a));
        if (o) { e.preventDefault(); press(o); }
      });
    });
    if (need.length) ui.appendChild(fields);
    const ops = el('div', role('ops', 'controls'));
    m.ops.forEach((o) => {
      const b = el('button', Object.assign(role('op', 'btn'), { type: 'button' }), o.label);
      b.addEventListener('click', () => press(o));
      ops.appendChild(b);
    });
    ui.appendChild(ops);

    // presets
    const presets = (Array.isArray(spec.presets) ? spec.presets : []).filter((p) => p && p.name);
    let presetRow = null;
    if (presets.length) {
      const row = el('div', role('presets'));
      ui.appendChild(row);
      if (Study.presets) presetRow = Study.presets.mount(row, presets, (p) => runPreset(p), { selectFirst: false });
      else {
        row.classList.add('controls');
        presets.forEach((p) => { const b = el('button', { type: 'button', class: 'btn' }, p.name); b.addEventListener('click', () => runPreset(p)); row.appendChild(b); });
      }
    }

    // picture, step controls, result, counters, log
    const status = el('p', role('status'));
    const dia = el('div', role('dia', 'diagram-wrap'));
    const note = el('p', Object.assign(role('note'), { 'aria-live': 'polite' }));
    ui.append(status, dia, note);
    let nextB = null, finB = null, count = null;
    if (stepMode) {
      const bar = el('div', role('stepbar', 'controls'));
      nextB = el('button', { type: 'button', class: 'btn primary' }, t('nextLabel'));
      finB = el('button', { type: 'button', class: 'btn' }, t('finishLabel'));
      count = el('span', role('count'));
      bar.append(nextB, finB, count);
      ui.appendChild(bar);
      nextB.addEventListener('click', () => {
        if (!play) return;
        play.k++;
        if (play.k >= play.res.steps.length - 1) finish(play.res); else renderStep();
      });
      finB.addEventListener('click', () => flush());
    }
    const result = el('p', Object.assign(role('result'), { 'aria-live': 'polite' }));
    const costs = el('div', role('costs'));
    const tiles = {};
    m.metrics.forEach((k) => {
      const tile = el('div', role('cost'));
      const last = el('span', role('cnum')), tot = el('span', role('cnum'));
      tile.append(el('span', role('cname'), m.metricLabel(k)), last, el('span', role('csub'), t('costLast')), tot, el('span', role('csub'), t('costTotal')));
      costs.appendChild(tile);
      tiles[k] = { last, tot };
    });
    const logHead = el('p', role('loghead'), t('logLabel'));
    const log = el('ol', role('log'));
    const logEmpty = el('li', role('logempty'), t('logEmpty'));
    const tools = el('div', role('tools', 'controls'));
    const resetB = el('button', { type: 'button', class: 'btn' }, t('resetLabel'));
    const zeroB = el('button', { type: 'button', class: 'btn' }, t('zeroLabel'));
    tools.append(resetB, zeroB);
    ui.append(result, costs, logHead, log, tools);

    // state of the widget
    const total = {};
    let play = null, queue = [], rush = false, sIdx = 0;
    const zeroTotals = () => { m.metrics.forEach((k) => { total[k] = 0; }); };
    function draw(scene) {
      if (Study.memory && Study.memory.draw) dia.replaceChildren(Study.memory.draw(scene));
    }
    function showStatus() {
      const i = m.info();
      const parts = [t('sizeLabel', { size: i.size })];
      if (i.capacity !== undefined && i.capacity !== null) parts.push(t('capacityLabel', { capacity: i.capacity }));
      if (i.height !== undefined) parts.push(t('heightLabel', { height: i.height }));
      status.textContent = parts.filter(Boolean).join(' · ');
    }
    function showCosts(cur, pending) {
      m.metrics.forEach((k) => {
        tiles[k].last.textContent = String(cur ? cur[k] || 0 : 0);
        tiles[k].tot.textContent = String(total[k] + (pending && cur ? cur[k] || 0 : 0));
      });
    }
    function showResult(res) {
      result.textContent = res ? res.text : '';
      if (res && res.error) result.setAttribute('data-error', ''); else result.removeAttribute('data-error');
    }
    function idle() {
      draw(m.scene());
      note.textContent = '';
      showResult(null);
      showStatus();
      showCosts(null, false);
      if (count) { count.textContent = ''; nextB.disabled = finB.disabled = true; }
    }
    function clearLog() { log.replaceChildren(logEmpty); }
    function logLine(res) {
      if (logEmpty.parentNode) logEmpty.remove();
      const li = el('li', role('logitem', res.error ? 'bad' : ''));
      li.appendChild(el('code', {}, res.call));
      const bits = [];
      if (res.text) bits.push(el('span', role('lres'), res.text));
      m.metrics.filter((k) => res.cost[k]).forEach((k) => bits.push(el('span', role('lcost'), t('costShort', { label: m.metricLabel(k), n: res.cost[k] }))));
      bits.forEach((b, j) => { li.append(j ? ' · ' : ' → ', b); });
      log.appendChild(li);
      const limit = O.logLimit > 0 ? O.logLimit : 60;
      while (log.children.length > limit) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight;
    }
    function renderStep() {
      const s = play.res.steps[play.k];
      draw(s);
      note.textContent = s.note || '';
      showResult(null);
      showCosts(s.cost, true);
      count.textContent = t('stepLabel', { k: play.k + 1, n: play.res.steps.length });
      nextB.disabled = finB.disabled = false;
    }
    function finish(res) {
      play = null;
      const s = res.steps[res.steps.length - 1];
      if (s) { draw(s); note.textContent = s.note || ''; }
      m.metrics.forEach((k) => { total[k] += res.cost[k] || 0; });
      showCosts(res.cost, false);
      showResult(res);
      logLine(res);
      showStatus();
      if (count) {
        count.textContent = res.steps.length > 1 ? t('stepLabel', { k: res.steps.length, n: res.steps.length }) : '';
        nextB.disabled = finB.disabled = true;
      }
      if (queue.length) { const q = queue.shift(); exec(q[0], q[1], q[2]); }
    }
    function exec(op, args, watch) {
      const res = m.apply(op, args);
      if (!stepMode || !watch || rush || res.steps.length < 2) finish(res);
      else { play = { res, k: 0 }; renderStep(); }
      return res;
    }
    /** Finish the operation in progress and any queued ones. */
    function flush() {
      rush = true;
      try { if (play) finish(play.res); while (queue.length) { const q = queue.shift(); exec(q[0], q[1], q[2]); } } finally { rush = false; }
    }
    const target = ['k', 'v', 'p'].find((a) => need.includes(a));
    function suggest() {
      const s = spec.suggest;
      let v = null;
      if (s === 'random') v = String(1 + Math.floor(Math.random() * 99));
      else if (Array.isArray(s) && s.length) v = show(s[sIdx++ % s.length]);
      if (v !== null && target) inputs[target].value = v;
    }
    function press(o) {
      flush();
      const res = exec(o.name, o.args.map((a) => (inputs[a] ? inputs[a].value : '')), true);
      if (!res.error && target && o.args.includes(target)) suggest();
      return res;
    }
    function runPreset(p) {
      play = null; queue = [];
      m.reset(p.initial !== undefined ? p.initial : spec.initial);
      zeroTotals(); clearLog(); idle();
      const list = (p.ops || []).filter(Array.isArray);
      const all = p.watch === 'all';
      queue = list.map((x, j) => [x[0], x.slice(1), all || j === list.length - 1]);
      if (queue.length) { const q = queue.shift(); exec(q[0], q[1], q[2]); }
    }
    function reset() {
      play = null; queue = [];
      m.reset(); zeroTotals(); clearLog(); idle();
      if (presetRow) presetRow.clear();
    }
    resetB.addEventListener('click', reset);
    zeroB.addEventListener('click', () => { flush(); zeroTotals(); showCosts(null, false); });

    if (inputs.i) inputs.i.value = '0';
    suggest();
    const start = spec.fields || {};
    [['i', 'index'], ['k', 'key'], ['v', 'value'], ['p', 'priority']].forEach(([a, name]) => {
      if (inputs[a] && has(start, name)) inputs[a].value = show(start[name]);
    });
    zeroTotals(); clearLog(); idle();
    const handle = {
      element: host, model: m, reset, finish: flush,
      run(op, ...args) { flush(); return exec(op, args, true); },
      preset(name) { const p = presets.find((x) => x.name === name); if (p) { if (presetRow) presetRow.select(name); else runPreset(p); } },
    };
    host._dsp = handle;
    return handle;
  }

  const kinds = {};
  Object.keys(KINDS).forEach((k) => { kinds[k] = { ops: Object.assign({}, KINDS[k].ops), metrics: KINDS[k].metrics.slice() }; });
  Study.playground = { model, mount, kinds, prefix: P };
  Study.define('ds-playground', {
    enhance(root) { Study.$$(root, '.' + P + 'playground').forEach((h) => mount(h)); },
  });
})();
