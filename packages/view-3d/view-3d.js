/* view-3d — Study.view3d: a small orthographic 3D viewer drawn in SVG.
   Drag to rotate; arrow keys rotate when the svg has focus; Home resets.
   See packages/view-3d/README.md for the full API. */
(function () {
  'use strict';
  const opts = Study.options('view-3d');
  const M = Study.math;
  const el = M.svgEl;
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /** Float Gram–Schmidt: an orthonormal list spanning the same space (near-zero vectors are skipped). */
  function gramSchmidt(vectors, eps) {
    eps = eps === undefined ? 1e-9 : eps;
    const out = [];
    vectors.forEach((v) => {
      let w = v.map(Number);
      out.forEach((u) => { const c = w.reduce((s, x, i) => s + x * u[i], 0); w = w.map((x, i) => x - c * u[i]); });
      const n = Math.hypot(...w);
      if (n > eps) out.push(w.map((x) => x / n));
    });
    return out;
  }

  /**
   * View(svg, o) → V. o: w, h (viewBox), scale (pixels per unit), yaw, pitch
   * (radians), pitchLimit, dragSpeed, keyStep, keyboard, label, draw(V).
   * Set V.draw = (V) => { …V.line(), V.arrow()… } and call V.redraw().
   */
  function View(svg, o) {
    o = o || {};
    const w = num(o.w, 420), h = num(o.h, 360);
    const yaw0 = num(o.yaw, num(opts.yaw, -0.75)), pitch0 = num(o.pitch, num(opts.pitch, 0.42));
    const limit = num(o.pitchLimit, num(opts.pitchLimit, 1.4));
    const speed = num(o.dragSpeed, num(opts.dragSpeed, 0.01));
    const step = num(o.keyStep, num(opts.keyStep, 0.1));
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.classList.add('plane', 'view3d');
    const V = { svg, w, h, S: num(o.scale, 60), yaw: yaw0, pitch: M.clamp(pitch0, -limit, limit), draw: o.draw || null };
    [...svg.childNodes].forEach((c) => { if (!(c.localName === 'title' || c.localName === 'desc')) c.remove(); });
    const g = el('g', {}, svg);
    V.g = g;

    /** World point [x, y, z] → screen [sx, sy]. z is up. */
    V.P = (p) => {
      const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
      const x1 = p[0] * cy - p[1] * sy, y1 = p[0] * sy + p[1] * cy;
      const up = p[2] * cp + y1 * sp;
      return [w / 2 + V.S * x1, h / 2 - V.S * up];
    };
    /** Distance towards the viewer (larger = nearer); sort by it to paint far things first. */
    V.depth = (p) => {
      const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
      const y1 = p[0] * sy + p[1] * cy;
      return p[2] * sp - y1 * cp;
    };
    V.line = (a, b, cls) => { const p = V.P(a), q = V.P(b); return el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: cls || '' }, g); };
    V.pline = (pts, cls, closed) => el(closed ? 'polygon' : 'polyline',
      { points: pts.map((p) => V.P(p).map((t) => t.toFixed(1)).join(',')).join(' '), class: cls || '' }, g);
    V.dot = (p, r, cls) => { const q = V.P(p); return el('circle', { cx: q[0], cy: q[1], r: r || 4, class: cls || '' }, g); };
    V.text = (p, s, cls, dx, dy) => {
      const q = V.P(p);
      const t = el('text', { x: q[0] + (dx === undefined ? 6 : dx), y: q[1] + (dy === undefined ? -6 : dy), class: cls || '' }, g);
      t.textContent = s;
      return t;
    };
    V.arrow = (a, b, cls) => {
      const p = V.P(a), q = V.P(b), L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L < 1) return null;
      const grp = el('g', { class: cls || '' }, g);
      const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, s = Math.min(num(opts.arrowHead, 11), L * 0.5);
      el('line', { x1: p[0], y1: p[1], x2: q[0] - ux * s * 0.8, y2: q[1] - uy * s * 0.8, class: cls || '' }, grp);
      el('polygon', { class: ('plot-head ' + (cls || '')).trim(), points: [q[0], q[1], q[0] - ux * s - uy * s * 0.45, q[1] - uy * s + ux * s * 0.45, q[0] - ux * s + uy * s * 0.45, q[1] - uy * s - ux * s * 0.45].join(',') }, grp);
      return grp;
    };
    /** The three axes from −R to R with their names (default from the axisNames option). */
    V.axes = (R, names) => {
      R = R || 2.2;
      names = names || opts.axisNames || ['x', 'y', 'z'];
      [[R, 0, 0], [0, R, 0], [0, 0, R]].forEach((e, i) => {
        V.line(e.map((t) => -t), e, 'axis');
        if (names[i]) V.text(e, names[i], 'small', 4, 4);
      });
    };
    /** A filled square patch of span(u, v) through the origin, half-width R. */
    V.planePatch = (u, v, R, cls) => {
      const on = gramSchmidt([u, v]);
      if (on.length < 2) return null;
      const [e1, e2] = on;
      R = R || 2;
      const c = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, t]) => [0, 1, 2].map((i) => R * (s * e1[i] + t * e2[i])));
      return V.pline(c, cls || 'fill c1', true);
    };
    V.redraw = () => { g.replaceChildren(); if (V.draw) V.draw(V); };
    /** Get or set the zoom (pixels per unit); setting redraws. */
    V.scale = (s) => { if (s === undefined) return V.S; V.S = s; V.redraw(); return V.S; };
    /** Set the view angles (radians) and redraw. */
    V.rotate = (yaw, pitch) => { V.yaw = yaw; V.pitch = M.clamp(pitch, -limit, limit); V.redraw(); };
    V.reset = () => V.rotate(yaw0, pitch0);

    // ---- pointer drag ----
    let dragging = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      dragging = [e.clientX, e.clientY, V.yaw, V.pitch];
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      svg.classList.add('v3-dragging');
    });
    svg.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      V.yaw = dragging[2] + (e.clientX - dragging[0]) * speed;
      V.pitch = M.clamp(dragging[3] + (e.clientY - dragging[1]) * speed, -limit, limit);
      V.redraw();
    });
    const end = () => { dragging = null; svg.classList.remove('v3-dragging'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    // ---- keyboard: arrows rotate, Shift = bigger steps, Home resets ----
    if ((o.keyboard === undefined ? opts.keyboard : o.keyboard) !== false) {
      if (!svg.hasAttribute('tabindex')) svg.setAttribute('tabindex', '0');
      if (!svg.hasAttribute('role')) svg.setAttribute('role', 'img');
      const label = o.label || opts.label;
      if (label && !svg.hasAttribute('aria-label')) svg.setAttribute('aria-label', label);
      svg.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const k = step * (e.shiftKey ? 4 : 1);
        if (e.key === 'ArrowLeft') V.rotate(V.yaw - k, V.pitch);
        else if (e.key === 'ArrowRight') V.rotate(V.yaw + k, V.pitch);
        else if (e.key === 'ArrowUp') V.rotate(V.yaw, V.pitch - k);
        else if (e.key === 'ArrowDown') V.rotate(V.yaw, V.pitch + k);
        else if (e.key === 'Home') V.reset();
        else return;
        e.preventDefault();
      });
    }
    if (V.draw) V.redraw();
    return V;
  }

  Study.view3d = { View, gramSchmidt };
  Object.assign(Study.legacy = Study.legacy || {}, { View3D: View, gramSchmidtFloat: gramSchmidt });
  Study.define('view-3d', {});
})();
