/* math-kit — Study.math: exact fractions, number formatting, small vector and
   2×2 helpers, HTML matrices and SVG helpers for widget scripts.
   See packages/math-kit/README.md for the full API. */
(function () {
  'use strict';
  const opts = Study.options('math-kit');
  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = opts.unicodeMinus === false ? '-' : '−';
  const BRACKETS = { square: 'mat-square', round: 'mat-round', bar: 'mat-bar', none: 'mat-none', soft: 'mat-soft' };
  // strict: false keeps the forgiving behaviour of older hand-rolled helpers (no exceptions)
  const STRICT = opts.strict !== false;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  /** Create an SVG element with attributes, optionally appended to parent. */
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------- numbers ----------
  /** Replace ASCII hyphens with the configured minus sign. */
  const minus = (s) => String(s).replace(/-/g, MINUS);
  /** Round to dp decimals (default 3) and drop trailing zeros; −0 prints as 0. */
  function fmt(x, dp) {
    if (dp === undefined) dp = 3;
    x = Number(x);
    if (Number.isNaN(x)) return opts.notANumber === undefined ? '—' : String(opts.notANumber);
    const inf = opts.infinity === undefined ? '∞' : String(opts.infinity);
    if (!isFinite(x)) return x < 0 ? MINUS + inf : inf;
    if (Math.abs(x) < 0.5 * Math.pow(10, -dp)) x = 0;
    return minus(String(+x.toFixed(dp)));
  }
  const snap = (v, step) => Math.round(v / step) * step;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /** Greatest common divisor of two integers (gcd(0, 0) = 0, or 1 when strict is off). */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || (STRICT ? 0 : 1); }
  const lcm = (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a / gcd(a, b) * b));

  // ---------- exact fractions: plain {n, d} objects, always reduced, d > 0 ----------
  const isFrac = (p) => p !== null && typeof p === 'object' && typeof p.n === 'number' && typeof p.d === 'number';
  function make(n, d) {
    if (!STRICT) {
      // no checks: a zero denominator gives d = 0, huge values lose exactness quietly
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d);
      return { n: n / g, d: d / g };
    }
    if (d === 0) throw new RangeError('Study.math: fraction with zero denominator');
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
      throw new RangeError('Study.math: fraction ' + n + '/' + d + ' is not exact (needs integers below 2^53)');
    }
    if (d < 0) { n = -n; d = -d; }
    if (n === 0) return { n: 0, d: 1 };
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  /** F(3, 4) → 3/4 · F(5) → 5 · F("−0.25") → −1/4 · F(0.5) → 1/2 · F(frac) → copy. */
  function F(n, d) {
    if (isFrac(n) && d === undefined) return make(n.n, n.d);
    if (typeof n === 'string') {
      const p = parse(n);
      if (!p) throw new TypeError('Study.math.F: cannot read "' + n + '" as a number');
      return d === undefined ? p : div(p, F(d));
    }
    if (d === undefined) d = 1;
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      // a non-integer number: go through its shortest decimal spelling
      const p = parse(String(n)), q = parse(String(d));
      if (!p || !q) throw new TypeError('Study.math.F: not a finite number');
      return div(p, q);
    }
    return make(n, d);
  }
  const ZERO = { n: 0, d: 1 }, ONE = { n: 1, d: 1 };
  const frac = (x) => (isFrac(x) ? x : F(x));
  function add(p, q) {
    p = frac(p); q = frac(q);
    const g = gcd(p.d, q.d);
    return make(p.n * (q.d / g) + q.n * (p.d / g), (p.d / g) * q.d);
  }
  const neg = (p) => { p = frac(p); return make(-p.n, p.d); };
  const sub = (p, q) => add(p, neg(q));
  function mul(p, q) {
    p = frac(p); q = frac(q);
    if (p.n === 0 || q.n === 0) return ZERO;
    const g1 = gcd(p.n, q.d), g2 = gcd(q.n, p.d);
    return make((p.n / g1) * (q.n / g2), (p.d / g2) * (q.d / g1));
  }
  function inv(p) {
    p = frac(p);
    if (p.n === 0 && STRICT) throw new RangeError('Study.math: division by zero');
    return make(p.d, p.n);
  }
  const div = (p, q) => mul(p, inv(q));
  const isZero = (p) => frac(p).n === 0;
  const sign = (p) => Math.sign(frac(p).n);
  const abs = (p) => { p = frac(p); return make(Math.abs(p.n), p.d); };
  const cmp = (p, q) => sign(sub(p, q));
  const eq = (p, q) => { p = frac(p); q = frac(q); return p.n === q.n && p.d === q.d; };
  const value = (p) => { p = frac(p); return p.n / p.d; };
  const isInt = (p) => frac(p).d === 1;
  /** "3/4", "−2", "0" — with the configured minus sign. */
  const str = (p) => { p = frac(p); return minus(p.d === 1 ? String(p.n) : p.n + '/' + p.d); };
  /**
   * Read "3/4", "-0.25", "−1/2", " 7 ", ".5", "1e-3" as an exact fraction.
   * Returns null for anything else (including a zero denominator).
   */
  function parse(s) {
    if (isFrac(s)) return make(s.n, s.d);
    if (typeof s === 'number') s = String(s);
    if (typeof s !== 'string') return null;
    s = s.trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
    let m = /^([-+]?\d+)\/([-+]?\d+)$/.exec(s);
    if (m) {
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (b === 0 || !Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
      return make(a, b);
    }
    m = /^([-+]?)(\d*)(?:\.(\d*))?(?:e([-+]?\d+))?$/i.exec(s);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) return null;
    const digits = (m[2] || '') + (m[3] || '');
    let exp = (m[4] ? parseInt(m[4], 10) : 0) - (m[3] || '').length;
    let n = parseInt(digits || '0', 10);
    if (!Number.isSafeInteger(n) || Math.abs(exp) > 15) return null;
    if (m[1] === '-') n = -n;
    try {
      if (exp >= 0) return make(n * Math.pow(10, exp), 1);
      return make(n, Math.pow(10, -exp));
    } catch (e) { return null; }
  }
  // F doubles as the fraction namespace: F.add(p, q), F.str(p), F.parse(s), …
  Object.assign(F, { add, sub, mul, div, neg, inv, abs, isZero, sign, cmp, eq, value, isInt, str, parse, is: isFrac, ZERO, ONE });
  // F.toString(p) works too; F.toString() with no argument still prints the function.
  Object.defineProperty(F, 'toString', {
    value(p) { return arguments.length ? str(p) : Function.prototype.toString.call(F); },
    writable: true, configurable: true,
  });

  // ---------- exact vectors (arrays of fractions; numbers and strings are accepted) ----------
  const vec = {
    of: (a) => a.map(frac),
    dot: (a, b) => a.reduce((s, x, i) => add(s, mul(x, b[i])), ZERO),
    add: (a, b) => a.map((x, i) => add(x, b[i])),
    sub: (a, b) => a.map((x, i) => sub(x, b[i])),
    scale: (c, a) => a.map((x) => mul(c, x)),
    isZero: (a) => a.every(isZero),
    str: (a) => '(' + a.map(str).join(', ') + ')',
  };

  // ---------- 2×2 floats: M = [[a, b], [c, d]], v = [x, y] ----------
  const m2 = {
    mv: (M, v) => [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]],
    mm: (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
      [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]],
    det: (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0],
    /** Inverse, or null when the determinant is 0. */
    inv: (M) => {
      const d = m2.det(M);
      if (d === 0) return null;
      return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]];
    },
  };

  // ---------- HTML matrices ----------
  /** Default entry formatter: fractions → "a/b", numbers → fmt(x), anything else as given (HTML). */
  const show = (x) => (isFrac(x) ? str(x) : typeof x === 'number' ? fmt(x) : String(x));
  /**
   * mat(rows, f?, o?) → '<span class="mat">…</span>' HTML string.
   * rows: array of equal-length arrays. f(entry, i, j): entry → HTML (default show).
   * o.bracket: "square" | "round" | "bar" | "soft" | "none" (default: the package option); o.class: extra classes.
   */
  function mat(rows, f, o) {
    if (f && typeof f === 'object') { o = f; f = null; }
    f = f || show; o = o || {};
    const cols = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;
    const cls = ['mat', BRACKETS[o.bracket || opts.bracket || 'square'] || '', o.class || ''].filter(Boolean).join(' ');
    return '<span class="' + cls + '" style="grid-template-columns:repeat(' + Math.max(cols, 1) + ',auto)">' +
      rows.map((r, i) => r.map((x, j) => '<span>' + f(x, i, j) + '</span>').join('')).join('') + '</span>';
  }
  /** col(v, f?, o?) → a column vector (an n×1 mat). */
  const col = (v, f, o) => {
    if (f && typeof f === 'object') { o = f; f = null; }
    return mat(v.map((x) => [x]), f ? (x, i) => f(x, i) : null, o);
  };

  Study.math = {
    NS, $, svgEl, minus, fmt, snap, clamp, gcd, lcm,
    F, add, sub, mul, div, neg, inv, abs, isZero, sign, cmp, eq, value, isInt, str, parse, isFrac,
    vec, m2, mat, col, show,
  };

  // ---------- optional flat aliases for migrating old page scripts ----------
  // Other widget packages add their own names (Plane, drag, View3D, presetButtons, …)
  // to the same shared object, whichever order the packages load in.
  const legacy = Study.legacy = Study.legacy || {};
  Object.assign(legacy, {
    NS, $, el: svgEl, minus, fmt, gcd, lcm, F, snap, clamp,
    fadd: add, fsub: sub, fmul: mul, fdiv: div, fneg: neg, fzero: isZero, fval: value, fs: str, parseF: parse, fsign: sign,
    vdot: vec.dot, vsub: vec.sub, vscale: vec.scale, vzero: vec.isZero,
    mv: m2.mv, mm: m2.mm, det2: m2.det, inv2: m2.inv, mat, col,
  });
  const alias = opts.globalAlias;
  if (typeof alias === 'string' && alias) {
    if (alias in window && window[alias] !== legacy) console.warn('[study] math-kit: window.' + alias + ' already exists; globalAlias not set');
    else window[alias] = legacy;
  }

  Study.define('math-kit', {});
})();
