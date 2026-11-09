/* plot-2d — Study.plot: an SVG coordinate plane with draggable handles.
   See packages/plot-2d/README.md for the full API. */
(function () {
  'use strict';
  const opts = Study.options('plot-2d');
  const M = Study.math;
  const el = M.svgEl;
  const EPS = 1e-9;
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /**
   * Plane(svg, o) draws a grid and axes into svg and returns a drawing object P.
   * o: xmin xmax ymin ymax (default −5…5), w (viewBox width), h (default keeps
   * squares square), step | stepx/stepy (grid spacing), grid, axes, labels,
   * labelEvery / labelEveryY, labelDp.
   */
  function Plane(svg, o) {
    o = Object.assign({ xmin: -5, xmax: 5, ymin: -5, ymax: 5 }, o || {});
    const w = num(o.w, num(opts.width, 440));
    const h = num(o.h, Math.round(w * (o.ymax - o.ymin) / (o.xmax - o.xmin)));
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.classList.add('plane');
    const P = { svg, w, h, o };
    P.X = (x) => (x - o.xmin) / (o.xmax - o.xmin) * w;
    P.Y = (y) => (o.ymax - y) / (o.ymax - o.ymin) * h;
    // start from an empty svg, keeping any accessible <title>/<desc> the author wrote
    [...svg.childNodes].forEach((c) => { if (!(c.localName === 'title' || c.localName === 'desc')) c.remove(); });
    P.bg = el('g', { class: 'plot-bg' }, svg);
    P.fg = el('g', { class: 'plot-fg' }, svg);
    P.top = el('g', { class: 'plot-top' }, svg);
    const sx = o.stepx || o.step || 1, sy = o.stepy || o.step || 1;
    const showGrid = o.grid !== false, showAxes = o.axes !== false;
    for (let x = Math.ceil(o.xmin / sx) * sx; x <= o.xmax + EPS; x += sx) {
      const isAxis = Math.abs(x) < EPS;
      if (isAxis ? showAxes : showGrid) el('line', { x1: P.X(x), y1: 0, x2: P.X(x), y2: h, class: isAxis ? 'axis' : 'grid' }, P.bg);
    }
    for (let y = Math.ceil(o.ymin / sy) * sy; y <= o.ymax + EPS; y += sy) {
      const isAxis = Math.abs(y) < EPS;
      if (isAxis ? showAxes : showGrid) el('line', { x1: 0, y1: P.Y(y), x2: w, y2: P.Y(y), class: isAxis ? 'axis' : 'grid' }, P.bg);
    }
    if (o.labels !== false) {
      const dp = num(o.labelDp, 2);
      const lx = o.labelEvery || sx * 2;
      for (let x = Math.ceil(o.xmin / lx) * lx; x <= o.xmax + EPS; x += lx) {
        if (Math.abs(x) < EPS) continue;
        el('text', { x: P.X(x) + 2, y: Math.min(h - 3, Math.max(11, P.Y(0) + 12)), class: 'small' }, P.bg).textContent = M.fmt(x, dp);
      }
      const ly = o.labelEveryY || sy * 2;
      for (let y = Math.ceil(o.ymin / ly) * ly; y <= o.ymax + EPS; y += ly) {
        if (Math.abs(y) < EPS) continue;
        el('text', { x: Math.min(w - 22, Math.max(2, P.X(0) + 3)), y: P.Y(y) - 2, class: 'small' }, P.bg).textContent = M.fmt(y, dp);
      }
    }
    /** Pointer event → world coordinates [x, y]. */
    P.toWorld = (evt) => {
      const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      return [o.xmin + q.x / w * (o.xmax - o.xmin), o.ymax - q.y / h * (o.ymax - o.ymin)];
    };
    /** Remove everything drawn in fg and top (the grid stays). */
    P.clear = () => { P.fg.replaceChildren(); P.top.replaceChildren(); };
    P.line = (a, b, cls, g) => el('line', { x1: P.X(a[0]), y1: P.Y(a[1]), x2: P.X(b[0]), y2: P.Y(b[1]), class: cls || '' }, g || P.fg);
    /** Arrow from a to b (world coordinates); returns the <g> holding shaft and head. */
    P.arrow = (a, b, cls, g) => {
      const x1 = P.X(a[0]), y1 = P.Y(a[1]), x2 = P.X(b[0]), y2 = P.Y(b[1]);
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 1) return null;
      const grp = el('g', { class: cls || '' }, g || P.fg);
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, s = Math.min(num(opts.arrowHead, 11), L * 0.5);
      // the class goes on the <g> and on both parts, so page CSS that targets `line.cls` or
      // `polygon.cls` (as older hand-rolled helpers did) still colours the arrow
      el('line', { x1, y1, x2: x2 - ux * s * 0.8, y2: y2 - uy * s * 0.8, class: cls || '' }, grp);
      el('polygon', { class: ('plot-head ' + (cls || '')).trim(), points: [x2, y2, x2 - ux * s - uy * s * 0.45, y2 - uy * s + ux * s * 0.45, x2 - ux * s + uy * s * 0.45, y2 - uy * s - ux * s * 0.45].join(',') }, grp);
      return grp;
    };
    const pts = (list) => list.map((p) => P.X(p[0]).toFixed(2) + ',' + P.Y(p[1]).toFixed(2)).join(' ');
    P.poly = (list, cls, g) => el('polygon', { points: pts(list), class: cls || '' }, g || P.fg);
    P.pline = (list, cls, g) => el('polyline', { points: pts(list), class: cls || '' }, g || P.fg);
    /** Dot of radius r (screen units) at p. */
    P.dot = (p, r, cls, g) => el('circle', { cx: P.X(p[0]), cy: P.Y(p[1]), r: r || 4, class: cls || '' }, g || P.fg);
    /** Text at p, offset by (dx, dy) screen units (default 6, −6); drawn on top. */
    P.text = (p, s, cls, dx, dy, g) => {
      const t = el('text', { x: P.X(p[0]) + (dx === undefined ? 6 : dx), y: P.Y(p[1]) + (dy === undefined ? -6 : dy), class: cls || '' }, g || P.top);
      t.textContent = s;
      return t;
    };
    /** The whole line a·x + b·y = c across the view. */
    P.infLine = (a, b, c, cls, g) => {
      const pad = 2 * Math.max(o.xmax - o.xmin, o.ymax - o.ymin);
      if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return null;
      let p, q;
      if (Math.abs(b) >= Math.abs(a)) { p = [o.xmin - pad, (c - a * (o.xmin - pad)) / b]; q = [o.xmax + pad, (c - a * (o.xmax + pad)) / b]; }
      else { p = [(c - b * (o.ymin - pad)) / a, o.ymin - pad]; q = [(c - b * (o.ymax + pad)) / a, o.ymax + pad]; }
      return P.line(p, q, cls, g);
    };
    P.inView = (p) => p[0] >= o.xmin && p[0] <= o.xmax && p[1] >= o.ymin && p[1] <= o.ymax;
    /** Clamp a world point into the view. */
    P.clampToView = (p) => [M.clamp(p[0], o.xmin, o.xmax), M.clamp(p[1], o.ymin, o.ymax)];
    /**
     * A draggable handle named id at p: a visible dot plus a larger invisible
     * hit area, both tagged data-h=id (what drag() looks for). Drawn on top.
     */
    P.handle = (id, p, cls) => {
      const g = el('g', { class: 'handle ' + (cls || ''), 'data-h': id }, P.top);
      el('circle', { cx: P.X(p[0]), cy: P.Y(p[1]), r: num(opts.hitRadius, 16), class: 'hit' }, g);
      el('circle', { cx: P.X(p[0]), cy: P.Y(p[1]), r: num(opts.handleRadius, 7) }, g);
      return g;
    };
    return P;
  }

  /**
   * drag(svg, P, onMove(id, [x, y], evt), onClick?([x, y], evt)) — pointer-drag
   * any element inside svg carrying data-h (P.handle makes these). A press on
   * empty space that does not move calls onClick. Returns a function that
   * removes the listeners.
   */
  function drag(svg, P, onMove, onClick) {
    let active = null, start = null;
    svg.classList.add('plot-draggable');
    const down = (e) => {
      if (e.button !== undefined && e.button > 0) return;
      const hd = e.target.closest && e.target.closest('[data-h]');
      start = [e.clientX, e.clientY];
      if (hd && svg.contains(hd)) {
        active = hd.getAttribute('data-h');
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
        svg.classList.add('plot-dragging');
        e.preventDefault();
      } else active = '';
    };
    const move = (e) => { if (active) onMove(active, P.toWorld(e), e); };
    const up = (e) => {
      const wasClick = active === '' && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 5;
      if (wasClick && onClick) onClick(P.toWorld(e), e);
      active = null; start = null; svg.classList.remove('plot-dragging');
    };
    const cancel = () => { active = null; start = null; svg.classList.remove('plot-dragging'); };
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', cancel);
    return () => {
      svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', cancel);
      svg.classList.remove('plot-draggable', 'plot-dragging');
    };
  }

  Study.plot = { Plane, drag, snap: M.snap, clamp: M.clamp };
  Object.assign(Study.legacy = Study.legacy || {}, { Plane, drag });
  Study.define('plot-2d', {});
})();
