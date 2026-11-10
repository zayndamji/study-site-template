/* ==========================================================================
   growth-chart — operation counts / running time against input size.
   --------------------------------------------------------------------------
   Markup: div.widget.gc-chart holding a .lbl and a JSON script (type application/json) with
           the spec: { "curves": [...], "series": [...], "x": [min, max], "yScale": "log", … }.
   Draws on a plot-2d Plane (world coordinates are log10 values on log axes).
   API: Study.growth = { mount(host, spec?), parse(fn, base?), value(fn, n, o?), log10(fn, n, o?),
                         label(fn, o?), bestFit(points, candidates?, o?), ticks, format, curveNames }
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('growth-chart');
  const t = (key, vals) => String(O[key] === undefined ? '' : O[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && k in vals ? vals[k] : m));
  const LN10 = Math.LN10;
  const isNum = (v) => typeof v === 'number' && isFinite(v);

  // ---------- curves ----------
  const SUP_IN = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n' };
  const SUP_OUT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
  const sup = (s) => String(s).split('').map((c) => SUP_OUT[c] || c).join('');
  const N = '(\\d+(?:\\.\\d+)?)';
  const RULES = [
    [/^1$/, () => ({ kind: 'const' })],
    [/^logn$/, () => ({ kind: 'log' })],
    [/^nlogn$/, () => ({ kind: 'nlog', k: 1 })],
    [new RegExp('^n\\^' + N + 'logn$'), (m) => ({ kind: 'nlog', k: +m[1] })],
    [new RegExp('^log\\^' + N + 'n$'), (m) => ({ kind: 'logpow', k: +m[1] })],
    [/^n$/, () => ({ kind: 'pow', k: 1 })],
    [/^sqrtn$/, () => ({ kind: 'pow', k: 0.5 })],
    [new RegExp('^n\\^' + N + '$'), (m) => ({ kind: 'pow', k: +m[1] })],
    [/^n\^n$/, () => ({ kind: 'nn' })],
    [new RegExp('^' + N + '\\^n$'), (m) => (+m[1] > 0 ? { kind: 'exp', c: +m[1] } : null)],
    [/^c\^n$/, (m, base) => (isNum(base) && base > 0 ? { kind: 'exp', c: base } : null)],
    [/^n!$/, () => ({ kind: 'fact' })],
  ];

  /** Normalise a curve name: lower case, no spaces, superscripts → ^, ·*×() dropped, lg/log2 → log. */
  function normName(fn) {
    return String(fn === undefined || fn === null ? '' : fn).toLowerCase().replace(/\s+/g, '').replace(/\*\*/g, '^')
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]+/g, (m) => '^' + m.split('').map((c) => SUP_IN[c]).join(''))
      .replace(/[·*×()]/g, '').replace(/√/g, 'sqrt').replace(/lg/g, 'log').replace(/log_?2(?=n|\^)/g, 'log');
  }

  /** Parse a curve name ("n^2", "n log n", "2^n", "c^n" with base, "n!", …) → curve object, or null. */
  function parse(fn, base) {
    if (fn && typeof fn === 'object' && fn.kind) return fn;
    const s = normName(fn);
    for (const [rx, make] of RULES) {
      const m = rx.exec(s);
      if (m) { const c = make(m, base); if (c) c.name = canonical(c); return c; }
    }
    return null;
  }

  function canonical(c) {
    switch (c.kind) {
      case 'const': return '1';
      case 'log': return 'log n';
      case 'nlog': return c.k === 1 ? 'n log n' : 'n^' + c.k + ' log n';
      case 'logpow': return 'log^' + c.k + ' n';
      case 'pow': return c.k === 1 ? 'n' : 'n^' + c.k;
      case 'nn': return 'n^n';
      case 'exp': return c.c + '^n';
      case 'fact': return 'n!';
      default: return '';
    }
  }

  /** Default display name in maths notation (option "names" may replace it). */
  function label(fn, o) {
    o = o || {};
    const c = parse(fn, o.base);
    if (!c) return String(fn);
    const names = O.names || {};
    if (names[c.name]) return String(names[c.name]);
    const k = (v) => (Number.isInteger(v) ? sup(v) : '^' + v);
    switch (c.kind) {
      case 'const': return '1';
      case 'log': return 'log n';
      case 'nlog': return c.k === 1 ? 'n log n' : 'n' + k(c.k) + ' log n';
      case 'logpow': return 'log' + k(c.k) + ' n';
      case 'pow': return c.k === 1 ? 'n' : c.k === 0.5 ? '√n' : 'n' + k(c.k);
      case 'nn': return 'nⁿ';
      case 'exp': return c.c + 'ⁿ';
      case 'fact': return 'n!';
      default: return c.name;
    }
  }

  /** log Γ(x) (Lanczos, g = 7), for n! = Γ(n + 1) at large or fractional n. */
  const LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LZ[0];
    const tt = x + 7.5;
    for (let i = 1; i < 9; i++) a += LZ[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(tt) - tt + Math.log(a);
  }

  const logB = (n, b) => Math.log(n) / Math.log(isNum(b) && b > 1 ? b : 2);

  /**
   * log10 of curve fn at n (times o.scale); finite even where the value itself overflows
   * (2ⁿ, n! at large n). −Infinity where the value is 0 or undefined (log n at n ≤ 1).
   * o: { scale, base (for "c^n"), logBase }
   */
  function log10(fn, n, o) {
    o = o || {};
    const c = parse(fn, o.base);
    if (!c || !isNum(n)) return NaN;
    const b = o.logBase !== undefined ? o.logBase : O.logBase;
    const sc = isNum(o.scale) && o.scale > 0 ? Math.log10(o.scale) : 0;
    const l10 = (v) => (v > 0 ? Math.log10(v) : -Infinity);
    let r;
    switch (c.kind) {
      case 'const': r = 0; break;
      case 'log': r = l10(logB(n, b)); break;
      case 'nlog': r = n > 0 ? c.k * Math.log10(n) + l10(logB(n, b)) : -Infinity; break;
      case 'logpow': { const g = logB(n, b); r = g > 0 ? c.k * Math.log10(g) : -Infinity; break; }
      case 'pow': r = n > 0 ? c.k * Math.log10(n) : n === 0 && c.k === 0 ? 0 : -Infinity; break;
      case 'nn': r = n > 0 ? n * Math.log10(n) : 0; break;
      case 'exp': r = n * Math.log10(c.c); break;
      case 'fact': r = n >= 0 ? lgamma(n + 1) / LN10 : NaN; break;
      default: r = NaN;
    }
    return r + sc;
  }

  /** Value of curve fn at n (times o.scale); may be Infinity where it overflows. */
  function value(fn, n, o) {
    o = o || {};
    const c = parse(fn, o.base);
    if (!c || !isNum(n)) return NaN;
    const b = o.logBase !== undefined ? o.logBase : O.logBase;
    const sc = isNum(o.scale) && o.scale > 0 ? o.scale : 1;
    let v;
    switch (c.kind) {
      case 'const': v = 1; break;
      case 'log': v = n > 0 ? logB(n, b) : NaN; break;
      case 'nlog': v = n > 0 ? Math.pow(n, c.k) * logB(n, b) : n === 0 ? 0 : NaN; break;
      case 'logpow': v = n > 0 ? Math.pow(logB(n, b), c.k) : NaN; break;
      case 'pow': v = n >= 0 ? Math.pow(n, c.k) : NaN; break;
      case 'nn': v = n > 0 ? Math.pow(n, n) : 1; break;
      case 'exp': v = Math.pow(c.c, n); break;
      case 'fact':
        if (n < 0) v = NaN;
        else if (Number.isInteger(n) && n <= 170) { v = 1; for (let i = 2; i <= n; i++) v *= i; }
        else v = Math.exp(lgamma(n + 1));
        break;
      default: v = NaN;
    }
    return v * sc;
  }

  /**
   * Which curve grows like the points [[n, v], …]? For each candidate the ratios v / f(n) are
   * taken over the larger half of the points (at least three); the curve whose ratios vary least
   * (standard deviation of their logs) matches best. → [{fn, name, label, factor, spread}] best
   * first, or [] with fewer than three usable points.
   */
  function bestFit(points, candidates, o) {
    o = o || {};
    const pts = (points || []).filter((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1]) && p[0] > 0 && p[1] > 0)
      .slice().sort((a, b) => a[0] - b[0]);
    if (pts.length < 3) return [];
    const use = pts.slice(Math.max(0, Math.min(Math.floor(pts.length / 2), pts.length - 3)));
    const out = [];
    (candidates || O.fitCandidates || []).forEach((fn, order) => {
      const c = parse(fn, o.base);
      if (!c) return;
      const lr = [];
      use.forEach(([n, v]) => {
        const l = log10(c, n, { logBase: o.logBase });
        if (isNum(l)) lr.push(Math.log10(v) - l);
      });
      if (lr.length < 2) return;
      const mean = lr.reduce((a, b) => a + b, 0) / lr.length;
      const spread = Math.sqrt(lr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lr.length);
      out.push({ fn, name: c.name, label: label(c), factor: Math.pow(10, mean), spread, order });
    });
    out.sort((a, b) => (Math.abs(a.spread - b.spread) < 1e-9 ? a.order - b.order : a.spread - b.spread));
    return out.map(({ order, ...r }) => r);
  }

  // ---------- numbers ----------
  const loc = () => O.locale || undefined;
  function plain(v, dp) {
    try { return Number(v).toLocaleString(loc(), { maximumFractionDigits: dp }); } catch (e) { return String(+Number(v).toFixed(dp)); }
  }
  /** Format a value, given as a number and/or its log10 (for values beyond floating point). */
  function format(v, l) {
    if (l === undefined) l = v > 0 ? Math.log10(v) : v === 0 ? -Infinity : NaN;
    if (v === 0 || l === -Infinity) return '0';
    if (!isNum(l)) return t('noValue');
    if (l >= 9 || l < -3) {
      let e = Math.floor(l), m = Math.pow(10, l - e);
      if (m >= 9.995) { m = 1; e += 1; }
      return plain(m, 2) + '×10' + sup(e);
    }
    if (!isNum(v)) v = Math.pow(10, l);
    return plain(v, v >= 100 ? 0 : v >= 1 ? 2 : 3);
  }
  const fmtN = (n) => plain(n, Number.isInteger(n) ? 0 : 2);

  /** Tick positions. linear(lo, hi, count) → nice values; decades(lo, hi) → log10 exponents. */
  const ticks = {
    linear(lo, hi, count) {
      const span = hi - lo;
      if (!(span > 0)) return [lo];
      const raw = span / Math.max(1, count || 5);
      const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999) || 10 * p;
      const out = [];
      for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12) || 0);
      return out;
    },
    decades(lo, hi, max) {
      const a = Math.ceil(lo - 1e-9), b = Math.floor(hi + 1e-9);
      const step = Math.max(1, Math.ceil((b - a) / Math.max(1, max || 6)));
      const out = [];
      for (let e = Math.ceil(a / step) * step; e <= b; e += step) out.push(e || 0);
      return out;
    },
    /** log x axis: powers of 2 for short ranges, of 10 for long ones (as n values). */
    logX(lo, hi, max) {
      if (hi / lo >= 1000) return ticks.decades(Math.log10(lo), Math.log10(hi), max).map((e) => Math.pow(10, e));
      const a = Math.ceil(Math.log2(lo) - 1e-9), b = Math.floor(Math.log2(hi) + 1e-9);
      const step = Math.max(1, Math.ceil((b - a + 1) / Math.max(1, max || 6)));
      const out = [];
      for (let e = a; e <= b; e += step) out.push(Math.pow(2, e));
      return out;
    },
  };
  /** Label of the decade 10^e; `wide` (the axis reaches past 10⁶) writes every power from 100 up as 10ᵉ. */
  const decadeLabel = (e, wide) => (e >= 0 && e <= (wide ? 1 : 4) ? plain(Math.pow(10, e), 0) : '10' + sup(e));

  // ---------- the chart ----------
  let uid = 0;
  const h = (...a) => Study.h(...a);

  function readSpec(host) {
    const sc = host.querySelector('script[type="application/json"]');
    if (!sc) return null;
    try { return JSON.parse(sc.textContent); } catch (e) { console.error('[growth-chart] spec is not valid JSON', e); return null; }
  }

  function range(r, d) {
    if (Array.isArray(r) && isNum(r[0]) && isNum(r[1]) && r[1] > r[0]) return [r[0], r[1]];
    if (r && isNum(r.min) && isNum(r.max) && r.max > r.min) return [r.min, r.max];
    return d;
  }

  function mount(host, spec) {
    if (!host || host.dataset.gcDone) return null;
    spec = spec || readSpec(host);
    if (!spec || !Study.plot) return null;
    host.dataset.gcDone = '1';
    const id = 'gc' + (++uid);
    const integer = spec.integer !== undefined ? !!spec.integer : O.integerN !== false;
    const xName = spec.xLabel || t('xLabel') || 'n';
    const yTitle = spec.yLabel !== undefined ? String(spec.yLabel) : t('yLabel');
    const xlog = spec.xScale === 'log';
    const st = { ylog: spec.yScale === 'log' };
    const [x0, xEnd] = range(spec.x, [xlog ? 1 : 0, 32]);
    st.xmax = xEnd;
    const yFixed = range(spec.y, null);
    let slot = 0;
    const nextSlot = (want) => (isNum(want) ? want : (slot++ % 8) + 1);

    // items: curves, then data series (each series may add a best-fit curve)
    const items = [];
    (spec.curves || []).forEach((c) => {
      const curve = parse(c.fn, c.base);
      if (!curve) { console.warn('[growth-chart] unknown curve "' + c.fn + '"'); return; }
      const scale = isNum(c.scale) && c.scale > 0 ? c.scale : 1;
      const name = c.label || (scale !== 1 ? plain(scale, 3) + '·' : '') + label(curve);
      items.push({ type: 'curve', curve, scale, label: name, color: nextSlot(c.color), dash: !!c.dash, on: !c.hidden });
    });
    (spec.series || []).forEach((s) => {
      const pts = (s.points || []).filter((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1])).sort((a, b) => a[0] - b[0]);
      const it = { type: 'series', points: pts, label: s.label || '', color: nextSlot(s.color), line: s.line !== false, on: !s.hidden };
      const wantFit = s.fit !== undefined ? s.fit : spec.fit;
      if (wantFit) {
        const cands = Array.isArray(wantFit) ? wantFit : Array.isArray(spec.fit) ? spec.fit : O.fitCandidates;
        const fits = bestFit(pts, cands, { logBase: O.logBase });
        it.fit = fits[0] || null;
        it.fitAsked = true;
      }
      items.push(it);
    });

    // controls
    const sl = spec.maxN === false || (spec.maxN === undefined && O.slider === false) ? null
      : range(spec.maxN, [Math.max(x0 + 1, Math.ceil(x0 + (xEnd - x0) / 8)), xEnd * 4]);
    const controls = h('div', { class: 'controls gc-controls' });
    let slider = null, sliderOut = null;
    const slLog = sl && (xlog || sl[1] / Math.max(sl[0], 1e-9) >= 50) && sl[0] > 0;
    const posToN = (p) => {
      const f = p / 1000;
      let n = slLog ? sl[0] * Math.pow(sl[1] / sl[0], f) : sl[0] + (sl[1] - sl[0]) * f;
      return integer ? Math.round(n) : +n.toPrecision(3);
    };
    const nToPos = (n) => Math.round(1000 * (slLog ? Math.log(n / sl[0]) / Math.log(sl[1] / sl[0]) : (n - sl[0]) / (sl[1] - sl[0])));
    if (sl) {
      st.xmax = Math.min(Math.max(st.xmax, sl[0]), sl[1]);
      slider = h('input', { type: 'range', min: 0, max: 1000, step: 1, value: nToPos(st.xmax) });
      sliderOut = h('output', { class: 'gc-max-out' });
      controls.append(h('label', { class: 'field gc-max' }, h('span', null, t('maxLabel', { x: xName }), ' ', sliderOut), slider));
    }
    let logBtn = null;
    if (spec.logToggle !== undefined ? spec.logToggle : O.logToggle !== false) {
      logBtn = h('button', { type: 'button', class: 'btn gc-log', 'aria-pressed': String(st.ylog), text: t('logLabel') });
      controls.append(logBtn);
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'gc-svg');
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('role', 'slider');
    const plot = h('div', { class: 'gc-plot' }, svg);
    const at = h('p', { class: 'gc-at' });
    const legend = h('ul', { class: 'gc-legend', role: 'list', 'aria-label': t('legendLabel') });
    const fitBox = h('div', { class: 'gc-fit' });
    const sc = host.querySelector(':scope > script[type="application/json"]');
    const parts = [controls.childNodes.length ? controls : null, plot, at, legend, fitBox].filter(Boolean);
    if (sc) sc.after(...parts); else host.append(...parts);

    items.forEach((it) => {
      const sw = h('span', { class: 'gc-sw gc-sw-' + it.type + (it.dash ? ' gc-dash' : ''), style: '--gc-c: var(--gc-' + it.color + ')', 'aria-hidden': 'true' });
      it.btn = h('button', { type: 'button', class: 'btn gc-key', 'aria-pressed': String(it.on) }, sw, h('span', { class: 'gc-name', text: it.label }));
      it.val = h('span', { class: 'gc-val' });
      legend.append(h('li', null, it.btn, it.val));
      it.btn.addEventListener('click', () => { it.on = !it.on; it.btn.setAttribute('aria-pressed', String(it.on)); draw(); });
    });

    // fit lines
    function fitLines() {
      fitBox.replaceChildren();
      items.filter((it) => it.fitAsked).forEach((it) => {
        const txt = it.fit ? t('fitText', { series: it.label, curve: it.fit.label, factor: format(it.fit.factor) }) : t('fitTooFew', { series: it.label });
        if (txt) fitBox.append(h('p', { text: txt }));
      });
      fitBox.hidden = !fitBox.childNodes.length;
    }
    fitLines();

    let P = null, geo = null, cursor = null;
    st.n = isNum(spec.at) ? spec.at : st.xmax;
    const tx = (n) => (xlog ? Math.log10(n) : n);
    const fromX = (x) => (xlog ? Math.pow(10, x) : x);
    const ty = (l) => (st.ylog ? l : Math.pow(10, l));
    const itemLog = (it, n) => (it.type === 'curve' ? log10(it.curve, n, { scale: it.scale }) : NaN);
    const fitLog = (it, n) => log10(it.fit.fn, n, { scale: it.fit.factor });

    function yRange(lo, hi) {
      if (yFixed) return st.ylog ? [Math.log10(Math.max(yFixed[0], 1e-300)), Math.log10(yFixed[1])] : yFixed;
      let mn = Infinity, mx = -Infinity;
      const see = (l) => { if (isNum(l)) { mn = Math.min(mn, l); mx = Math.max(mx, l); } };
      items.forEach((it) => {
        if (!it.on) return;
        if (it.type === 'curve') for (let i = 0; i <= 40; i++) see(itemLog(it, fromX(tx(lo) + (tx(hi) - tx(lo)) * i / 40)));
        else it.points.forEach(([n, v]) => { if (n >= lo && n <= hi && v > 0) see(Math.log10(v)); });
      });
      if (!isNum(mn)) { mn = 0; mx = 1; }
      if (st.ylog) {
        let a = Math.floor(mn + 1e-9), b = Math.ceil(mx - 1e-9);
        if (b <= a) b = a + 1;
        return [a, b];
      }
      const top = Math.min(Math.pow(10, mx), 1e300);
      const tk = ticks.linear(0, top, 5);
      const step = tk.length > 1 ? tk[1] - tk[0] : top;
      return [0, Math.ceil(top / step - 1e-9) * step || 1];
    }

    function draw() {
      const W = Math.max(260, Math.round(plot.clientWidth || Study.options('plot-2d').width || 440));
      const H = Math.max(180, +(spec.height || O.height) || 300);
      const lo = x0, hi = st.xmax;
      const [ya, yb] = yRange(lo, hi);
      // y tick labels decide the left margin
      const yt = st.ylog ? ticks.decades(ya, yb, Math.max(3, Math.floor(H / 48))).map((e) => [e, decadeLabel(e, yb > 6)])
        : ticks.linear(ya, yb, Math.max(3, Math.floor(H / 56))).map((v) => [v, format(v)]);
      const L = Math.max(30, 12 + 7.4 * Math.max(...yt.map((p) => p[1].length))), R = 14, T = yTitle ? 26 : 12, B = 40;
      const ax0 = tx(lo), ax1 = tx(hi);
      const kx = (ax1 - ax0) / Math.max(1, W - L - R), ky = (yb - ya) / Math.max(1, H - T - B);
      P = Study.plot.Plane(svg, { xmin: ax0 - L * kx, xmax: ax1 + R * kx, ymin: ya - B * ky, ymax: yb + T * ky, w: W, h: H, grid: false, axes: false, labels: false });
      geo = { W, H, L, R, T, B, ax0, ax1, ya, yb, lo, hi };
      const el = Study.math.svgEl;
      // grid, axes, ticks
      yt.forEach(([v, s]) => {
        P.line([ax0, v], [ax1, v], 'grid', P.bg);
        const tt = P.text([ax0, v], s, 'small', -6, 4, P.bg); tt.setAttribute('text-anchor', 'end');
      });
      const xt = xlog ? ticks.logX(lo, hi, Math.max(3, Math.floor((W - L - R) / 64))).map((n) => [Math.log10(n), fmtN(n)])
        : ticks.linear(lo, hi, Math.max(3, Math.floor((W - L - R) / 64))).map((n) => [n, fmtN(n)]);
      xt.forEach(([x, s]) => {
        P.line([x, ya], [x, yb], 'grid', P.bg);
        const tt = P.text([x, ya], s, 'small', 0, 16, P.bg); tt.setAttribute('text-anchor', 'middle');
      });
      P.line([ax0, ya], [ax1, ya], 'axis', P.bg);
      P.line([ax0, ya], [ax0, yb], 'axis', P.bg);
      const xt2 = P.text([ax1, ya], xName, 'gc-title', 0, 33, P.bg); xt2.setAttribute('text-anchor', 'end');
      if (yTitle) { const tt = P.text([ax0, yb], yTitle, 'gc-title', -L + 4, -12, P.bg); tt.setAttribute('text-anchor', 'start'); }
      // curves, clipped to the plot area
      const defs = el('defs', null, svg);
      const clip = el('clipPath', { id: id + '-clip' }, defs);
      el('rect', { x: L, y: T, width: Math.max(0, W - L - R), height: Math.max(0, H - T - B) }, clip);
      const g = el('g', { 'clip-path': 'url(#' + id + '-clip)' }, P.fg);
      const span = yb - ya;
      const yc = (l) => Math.max(ya - span, Math.min(yb + span, ty(l)));
      const samples = Math.max(60, Math.round((W - L - R) / 2));
      const trace = (fnLog, cls, gg) => {
        let seg = [];
        const flush = () => { if (seg.length > 1) P.pline(seg, cls, gg); seg = []; };
        for (let i = 0; i <= samples; i++) {
          const x = ax0 + (ax1 - ax0) * i / samples;
          const l = fnLog(fromX(x));
          if (l === -Infinity && !st.ylog) seg.push([x, 0]);
          else if (!isNum(l)) flush();
          else seg.push([x, yc(l)]);
        }
        flush();
      };
      items.forEach((it) => {
        if (!it.on) return;
        const gg = el('g', { class: 'gc-item', style: '--pc: var(--gc-' + it.color + ')' }, g);
        if (it.type === 'curve') trace((n) => itemLog(it, n), 'gc-curve' + (it.dash ? ' dash' : ''), gg);
        else {
          if (it.fit && O.fitCurve !== false) {
            trace((n) => fitLog(it, n), 'gc-fitline thin dash', gg);
            const tl = el('title', null, gg); tl.textContent = t('fitLabel', { factor: format(it.fit.factor), curve: it.fit.label });
          }
          const vis = it.points.filter(([n, v]) => n >= lo && n <= hi && (v > 0 || !st.ylog));
          const xy = vis.map(([n, v]) => [tx(n), v > 0 ? yc(Math.log10(v)) : st.ylog ? ya : 0]);
          if (it.line && xy.length > 1) P.pline(xy, 'gc-link thin', gg);
          xy.forEach((p) => P.dot(p, 3.5, 'gc-pt', gg));
        }
      });
      cursor = el('g', { class: 'gc-cursor' }, P.top);
      if (sliderOut) sliderOut.textContent = fmtN(st.xmax);
      svg.setAttribute('aria-label', t('chartLabel', { x: xName, min: fmtN(lo), max: fmtN(hi) }));
      svg.setAttribute('aria-valuemin', String(lo));
      svg.setAttribute('aria-valuemax', String(hi));
      readout();
    }

    function nearest(it, n) {
      let best = null;
      it.points.forEach((p) => { if (p[0] >= geo.lo && p[0] <= geo.hi && (!best || Math.abs(p[0] - n) < Math.abs(best[0] - n))) best = p; });
      return best;
    }

    function readout() {
      if (!geo) return;
      let n = Math.min(geo.hi, Math.max(geo.lo, st.n));
      if (integer) n = Math.min(Math.floor(geo.hi), Math.max(Math.ceil(geo.lo), Math.round(n)));
      st.n = n;
      at.textContent = t('atLabel', { x: xName, n: fmtN(n) });
      const spoken = [];
      cursor.replaceChildren();
      const span = geo.yb - geo.ya;
      const yc = (l) => Math.max(geo.ya - span, Math.min(geo.yb + span, ty(l)));
      const inY = (l) => isNum(l) && ty(l) >= geo.ya - 1e-9 && ty(l) <= geo.yb + 1e-9;
      P.line([tx(n), geo.ya], [tx(n), geo.yb], 'gc-guide thin dash', cursor);
      items.forEach((it) => {
        let txt;
        if (!it.on) txt = t('hiddenValue');
        else if (it.type === 'curve') {
          const l = itemLog(it, n);
          txt = isNum(l) || l === -Infinity ? format(value(it.curve, n, { scale: it.scale }), l) : t('noValue');
          if (inY(l)) { const d = P.dot([tx(n), yc(l)], 4.5, 'gc-mark pin', cursor); d.setAttribute('style', '--pc: var(--gc-' + it.color + ')'); }
        } else {
          const p = nearest(it, n);
          if (!p) txt = t('noValue');
          else {
            txt = p[0] === n ? format(p[1]) : t('seriesAt', { v: format(p[1]), x: xName, n: fmtN(p[0]) });
            const l = p[1] > 0 ? Math.log10(p[1]) : -Infinity;
            if (inY(l)) { const d = P.dot([tx(p[0]), yc(l)], 5.5, 'gc-mark hollow', cursor); d.setAttribute('style', '--pc: var(--gc-' + it.color + ')'); }
          }
        }
        it.val.textContent = txt;
        if (it.on) spoken.push(it.label + ' ' + txt);
      });
      svg.setAttribute('aria-valuenow', String(n));
      svg.setAttribute('aria-valuetext', t('cursorText', { x: xName, n: fmtN(n), values: spoken.join(', ') }));
    }

    // pointer and keys move the readout
    const moveTo = (evt) => {
      if (!P || !geo) return;
      const x = P.toWorld(evt)[0];
      st.n = fromX(Math.min(geo.ax1, Math.max(geo.ax0, x)));
      readout();
    };
    svg.addEventListener('pointermove', moveTo);
    svg.addEventListener('pointerdown', moveTo);
    svg.addEventListener('keydown', (e) => {
      if (!geo) return;
      const k = e.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(k)) return;
      e.preventDefault();
      const dir = k === 'ArrowLeft' || k === 'ArrowDown' || k === 'PageDown' ? -1 : 1;
      const big = k === 'PageUp' || k === 'PageDown' ? 10 : 1;
      if (k === 'Home') st.n = geo.lo;
      else if (k === 'End') st.n = geo.hi;
      else if (xlog) st.n = Math.pow(10, Math.log10(st.n) + dir * big * (geo.ax1 - geo.ax0) / 50);
      else st.n += dir * big * (integer ? Math.max(1, Math.round((geo.hi - geo.lo) / 50)) : (geo.hi - geo.lo) / 50);
      if (integer && xlog) st.n = dir > 0 ? Math.max(Math.ceil(st.n), Math.round(st.n)) : Math.round(st.n);
      readout();
    });
    if (slider) {
      slider.addEventListener('input', () => {
        const follow = st.n >= st.xmax;
        st.xmax = Math.max(posToN(+slider.value), x0 + (integer ? 1 : 1e-6));
        slider.setAttribute('aria-valuetext', fmtN(st.xmax));
        if (follow || st.n > st.xmax) st.n = st.xmax;
        draw();
      });
      slider.setAttribute('aria-valuetext', fmtN(st.xmax));
    }
    if (logBtn) logBtn.addEventListener('click', () => { st.ylog = !st.ylog; logBtn.setAttribute('aria-pressed', String(st.ylog)); draw(); });

    draw();
    if (typeof ResizeObserver === 'function') {
      let lastW = plot.clientWidth, raf = 0;
      new ResizeObserver(() => {
        const w = plot.clientWidth;
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }).observe(plot);
    }
    return { items, state: st, redraw: draw };
  }

  Study.growth = {
    mount, parse, value, log10, label, bestFit, ticks, format, lgamma,
    curveNames: ['1', 'log n', 'n', 'n log n', 'n^2', 'n^3', '2^n', 'c^n', 'n!', 'n^k', 'k^n', 'sqrt n', 'n^n', 'log^k n', 'n^k log n'],
  };
  Study.define('growth-chart', {
    enhance(root) { Study.$$(root, '.gc-chart').forEach((el) => mount(el)); },
  });
})();
