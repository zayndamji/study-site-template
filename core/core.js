/* ==========================================================================
   Study Site core script  —  window.Study
   --------------------------------------------------------------------------
   Loaded in <head> (blocking) so the theme applies before first paint and so
   inline page scripts can use Study.* right away. DOM work waits for
   DOMContentLoaded, by which time inline widget scripts have run.

   Public API (stable; packages and page scripts rely on it):
     Study.data                 site data written by the build (config, pages)
     Study.config               = Study.data.config
     Study.page                 the current page's catalog entry, or null (home)
     Study.store.get(k, d) / .set(k, v) / .remove(k)   prefixed localStorage
     Study.define(name, { init(Study), enhance(root, Study) })   register a package
     Study.options(name)        a package's merged options from site.json
     Study.enhance(root)        (re)run steppers, quizzes and package enhancers
                                on content added after load; safe to repeat
     Study.on(evt, fn) / Study.emit(evt, detail)   events: 'ready',
                                'review:change', 'quiz:answer', 'theme:change'
     Study.h(tag, attrs, ...children)   tiny DOM builder
     Study.ready(fn)            run fn after core init (or now, if done)
     Study.send(target, value, { event, fill, bubbles })   hand a value to a widget
                                (element or id): write a plain object's keys into its
                                [data-field]/[name] controls (fill, default true; each
                                changed control gets input + change events), then
                                dispatch CustomEvent `event` (default "load") with the
                                value as detail. Returns the element, or null.
     Study.fill(el, object)     only the control writing; returns how many changed
   Storage keys (with the configured prefix, default "study:"):
     theme · reviewed:<unit> · total:<unit> · quiz:<id> · last-page
   ========================================================================== */
(function () {
  'use strict';
  const data = window.STUDY_DATA || { config: { storagePrefix: 'study:' }, pages: [], packages: {} };
  const prefix = data.config.storagePrefix || 'study:';
  const bus = new EventTarget();
  const packages = [];
  let booted = false;
  const readyQueue = [];

  const L = Object.assign({}, data.config.labels || {});
  const t = (key, vals) => String(L[key] === undefined ? key : L[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && vals[k] !== undefined ? vals[k] : m));
  const $$ = (rootEl, sel) => [...((rootEl && rootEl.matches && rootEl.matches(sel)) ? [rootEl] : []), ...(rootEl || document).querySelectorAll(sel)];

  const store = {
    key: (k) => prefix + k,
    get(k, d) { try { const v = localStorage.getItem(prefix + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(prefix + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    remove(k) { try { localStorage.removeItem(prefix + k); } catch (e) { /* storage unavailable */ } },
  };

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c !== null && c !== undefined && c !== false) e.append(c); });
    return e;
  }

  // ---- hand a value to a widget (used by preset rows, worked-example load buttons, page scripts) ----
  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  function fillControls(target, value) {
    let n = 0;
    if (!target || !isPlain(value)) return 0;
    for (const key in value) {
      const sel = '[data-field="' + CSS.escape(key) + '"], [name="' + CSS.escape(key) + '"]';
      target.querySelectorAll(sel).forEach((c) => {
        if (!('value' in c)) return;
        const v = value[key];
        if (c.type === 'checkbox') c.checked = !!v;
        else if (c.type === 'radio') c.checked = String(c.value) === String(v);
        else c.value = Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v);
        c.dispatchEvent(new Event('input', { bubbles: true }));
        c.dispatchEvent(new Event('change', { bubbles: true }));
        n++;
      });
    }
    return n;
  }
  function send(target, value, o) {
    o = o || {};
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) { console.warn('[study] send: no element with id "' + target + '"'); return null; }
    if (o.fill !== false && isPlain(value)) fillControls(el, value);
    el.dispatchEvent(new CustomEvent(o.event || 'load', { detail: value, bubbles: !!o.bubbles }));
    return el;
  }

  const Study = window.Study = {
    version: '1.0.0',
    data,
    config: data.config,
    pages: data.pages || [],
    page: null,
    store,
    h,
    t,
    $$,
    on(evt, fn) { bus.addEventListener(evt, (e) => fn(e.detail)); },
    emit(evt, detail) { bus.dispatchEvent(new CustomEvent(evt, { detail })); },
    options(name) { return (data.packages && data.packages[name]) || {}; },
    define(name, def) {
      packages.push(Object.assign({ name }, def));
      if (booted) { if (def.init) def.init(Study); if (def.enhance) def.enhance(document, Study); }
    },
    enhance(root) {
      root = root || document;
      enhanceSteppers(root); enhanceQuizzes(root);
      packages.forEach((p) => { if (p.enhance) { try { p.enhance(root, Study); } catch (err) { console.error('[study] ' + p.name + '.enhance', err); } } });
    },
    ready(fn) { if (booted) fn(Study); else readyQueue.push(fn); },
    send,
    fill: fillControls,
  };

  // ---- theme: system -> light -> dark (applied immediately to avoid a flash) ----
  const root = document.documentElement;
  const applyTheme = (t) => { if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t); };
  let theme = store.get('theme', data.config.defaultTheme || 'system');
  applyTheme(theme);
  // one icon per mode; shown instead of the words on narrow screens (the words stay for screen readers)
  const THEME_ICONS = {
    system: '<circle cx="10" cy="10" r="6.8"/><path class="fill" d="M10 3.2a6.8 6.8 0 0 1 0 13.6z"/>',
    light: '<circle cx="10" cy="10" r="3.4"/><path d="M10 1.9v2.2M10 15.9v2.2M1.9 10h2.2M15.9 10h2.2M4.3 4.3l1.5 1.5M14.2 14.2l1.5 1.5M4.3 15.7l1.5-1.5M14.2 5.8l1.5-1.5"/>',
    dark: '<path d="M15.8 12.4A6.6 6.6 0 0 1 7.6 4.2a6.6 6.6 0 1 0 8.2 8.2z"/>',
  };
  function bindTheme() {
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      const name = (m) => t('theme' + m[0].toUpperCase() + m.slice(1));
      b.classList.add('theme-btn');
      const label = () => {
        b.textContent = '';
        b.insertAdjacentHTML('afterbegin', '<svg class="theme-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' + THEME_ICONS[theme] + '</svg>');
        b.append(h('span', { class: 'theme-text' }, h('span', { class: 'theme-prefix', text: t('theme') }), name(theme)));
        b.title = t('themeTitle', { mode: name(theme) });
      };
      label();
      b.addEventListener('click', () => {
        theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
        applyTheme(theme); store.set('theme', theme); label(); Study.emit('theme:change', theme);
      });
    });
  }

  // ---- page switcher (rendered by the build; this only navigates) ----
  function bindPicker() {
    document.querySelectorAll('.page-picker select').forEach((s) => {
      s.addEventListener('change', () => { if (s.value) window.location.href = s.value; });
    });
  }

  // ---- section rail, scrollspy, per-section review progress ----
  function initRail() {
    const body = document.body;
    const unit = body.dataset.unit;
    const reviewOn = body.hasAttribute('data-review') && unit;
    const sections = [...document.querySelectorAll('article section.note[id], main section.note[id]')];
    const toc = document.querySelector('.toc');
    if (!toc || !sections.length) { const rail = document.querySelector('.rail'); if (rail && !sections.length) rail.hidden = true; return; }
    const key = 'reviewed:' + unit;
    const reviewed = new Set(reviewOn ? store.get(key, []) : []);
    const links = new Map();
    let group = null;
    sections.forEach((s) => {
      if (s.dataset.tocGroup && s.dataset.tocGroup !== group) {
        group = s.dataset.tocGroup;
        toc.appendChild(h('li', { class: 'toc-group', text: group }));
      }
      const hd = s.querySelector('h2');
      if (!hd) return;
      const n = hd.querySelector('.n');
      const title = s.dataset.tocTitle || [...hd.childNodes].filter((x) => !(x.classList && x.classList.contains('n'))).map((x) => x.textContent).join('').trim();
      const a = h('a', { href: '#' + s.id },
        h('span', { class: 'n', text: n ? n.textContent : '' }),
        h('span', { class: 't', text: title }),
        h('span', { class: 'chk', 'aria-hidden': 'true', text: '✓' }));
      toc.appendChild(h('li', null, a)); links.set(s.id, a);
      if (reviewOn && s.dataset.noReview === undefined) {
        const btn = h('button', { type: 'button' });
        const sync = () => {
          const on = reviewed.has(s.id);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          btn.textContent = on ? t('reviewDone') : t('reviewMark');
          a.classList.toggle('done', on);
        };
        btn.addEventListener('click', () => {
          reviewed.has(s.id) ? reviewed.delete(s.id) : reviewed.add(s.id);
          store.set(key, [...reviewed]); sync(); updateProgress();
          Study.emit('review:change', { unit, section: s.id, reviewed: reviewed.has(s.id) });
        });
        sync(); s.appendChild(h('div', { class: 'review' }, btn));
      }
    });
    const reviewable = sections.filter((s) => s.dataset.noReview === undefined && s.querySelector('h2'));
    const prog = document.querySelector('.rail .progress');
    function updateProgress() {
      const done = reviewable.filter((s) => reviewed.has(s.id)).length;
      store.set('total:' + unit, reviewable.length);
      if (prog) {
        prog.querySelector('.txt').textContent = t('progress', { done, total: reviewable.length });
        prog.querySelector('.meter > span').style.width = (reviewable.length ? 100 * done / reviewable.length : 0) + '%';
      }
    }
    if (reviewOn) updateProgress(); else if (prog) prog.hidden = true;

    // the narrow-screen bar also names the section being read
    const sum = toc.closest('details') && toc.closest('details').querySelector('summary');
    const now = sum ? h('span', { class: 'rail-now', 'aria-hidden': 'true' }) : null;
    if (now) sum.appendChild(now);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const a = links.get(e.target.id); if (a) a.classList.add('active');
        if (now && a) now.textContent = [a.querySelector('.n').textContent, a.querySelector('.t').textContent].filter(Boolean).join(' ');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach((s) => io.observe(s));
    const d = toc.closest('details');
    const wide = window.matchMedia('(min-width: 961px)');
    toc.addEventListener('click', (e) => {
      if (e.target.closest('a') && d && !wide.matches) d.open = false;
    });
    // wide: the list is always open; narrow: a slim bar (kept on screen by CSS) that opens it
    const syncOpen = () => { if (d) d.open = wide.matches; };
    syncOpen();
    if (wide.addEventListener) wide.addEventListener('change', syncOpen); else if (wide.addListener) wide.addListener(syncOpen);
  }

  // ---- steppers: reveal an ordered list one item at a time ----
  function enhanceSteppers(rootEl) {
    rootEl.querySelectorAll('.stepper:not([data-enhanced])').forEach((st) => {
      st.dataset.enhanced = '';
      const items = [...st.querySelectorAll(':scope ol.steps > li')];
      if (!items.length) return;
      let k = 1;
      const bar = h('div', { class: 'controls' });
      bar.append(h('button', { type: 'button', class: 'btn', 'data-a': 'back', text: t('stepBack') }),
        h('button', { type: 'button', class: 'btn primary', 'data-a': 'next', text: t('stepNext') }),
        h('button', { type: 'button', class: 'btn', 'data-a': 'all', text: t('stepAll') }),
        h('span', { class: 'status', 'aria-live': 'polite' }));
      st.appendChild(bar);
      const status = bar.querySelector('.status');
      function render() {
        items.forEach((li, i) => { li.hidden = i >= k; li.classList.toggle('current', i === k - 1); });
        bar.querySelector('[data-a=back]').disabled = k <= 1;
        bar.querySelector('[data-a=next]').disabled = k >= items.length;
        bar.querySelector('[data-a=all]').disabled = k >= items.length;
        status.textContent = t('stepStatus', { k, n: items.length });
      }
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'next') k = Math.min(items.length, k + 1);
        if (b.dataset.a === 'back') k = Math.max(1, k - 1);
        if (b.dataset.a === 'all') k = items.length;
        render();
      });
      render();
    });
  }

  // ---- quizzes: answers persist per quiz id ----
  function enhanceQuizzes(rootEl) {
    rootEl.querySelectorAll('.quiz[data-id]:not([data-enhanced])').forEach((qz) => {
      qz.dataset.enhanced = '';
      const key = 'quiz:' + qz.dataset.id;
      let saved = store.get(key, {});
      const qs = [...qz.querySelectorAll('.q')];
      const head = qz.querySelector('.quiz-head');
      const score = h('span', { class: 'score' });
      const reset = h('button', { type: 'button', class: 'btn', text: t('quizReset') });
      if (head) { head.appendChild(score); head.appendChild(reset); }
      function show(q, picked) {
        const ans = q.dataset.answer;
        const fb = q.querySelector('.q-feedback');
        q.querySelectorAll('.q-opts button').forEach((b) => {
          b.disabled = true;
          if (b.dataset.v === ans) b.classList.add('right');
          else if (b.dataset.v === picked) b.classList.add('wrong');
        });
        const ok = picked === ans;
        if (!fb) return;
        fb.hidden = false;
        const ex = q.querySelector('template.q-explain');
        fb.innerHTML = '<span class="verdict ' + (ok ? 'ok' : 'no') + '">' + (ok ? t('quizCorrect') : t('quizWrong')) + '</span>' + (ex ? ex.innerHTML : '');
        Study.enhance(fb);
      }
      function tally() {
        const n = Object.keys(saved).length;
        const right = qs.filter((q, i) => saved[i] === q.dataset.answer).length;
        score.textContent = n ? t('quizScore', { right, answered: n, left: qs.length - n }) : (qs.length === 1 ? t('quizCountOne') : t('quizCount', { n: qs.length }));
      }
      qs.forEach((q, i) => {
        q.querySelectorAll('.q-opts button').forEach((b) => {
          b.type = 'button';
          b.addEventListener('click', () => {
            if (saved[i] !== undefined) return;
            saved[i] = b.dataset.v; store.set(key, saved); show(q, b.dataset.v); tally();
            Study.emit('quiz:answer', { id: qz.dataset.id, index: i, correct: b.dataset.v === q.dataset.answer });
          });
        });
        if (saved[i] !== undefined) show(q, saved[i]);
      });
      reset.addEventListener('click', () => {
        saved = {}; store.set(key, saved);
        qs.forEach((q) => {
          q.querySelectorAll('.q-opts button').forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
          const fb = q.querySelector('.q-feedback'); if (fb) { fb.hidden = true; fb.innerHTML = ''; }
        });
        tally();
      });
      tally();
    });
  }

  // ---- home catalog: search, filters, "/" shortcut ----
  function initHome() {
    const search = document.getElementById('catalog-search');
    if (!search) return;
    const groups = [...document.querySelectorAll('[data-catalog-group]')];
    const buttons = [...document.querySelectorAll('.group-filters [data-filter]')];
    const status = document.getElementById('search-status');
    const empty = document.getElementById('empty-state');
    const normalize = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    let filter = 'all';
    function render() {
      const query = normalize(search.value.trim());
      const num = query.match(/^(?:[a-z]+\.?\s*)?0*(\d+)$/);
      let count = 0;
      groups.forEach((g) => {
        let visible = 0;
        g.querySelectorAll('[data-search-row]').forEach((row) => {
          const hay = normalize(row.dataset.search);
          const byNum = num && row.dataset.num !== undefined && row.dataset.num !== '' && Number(row.dataset.num) === Number(num[1]);
          const matches = !query ? true : row.hasAttribute('data-never-match') ? false : byNum || (!num && query.split(/\s+/).every((w) => hay.includes(w)));
          const inFilter = filter === 'all' || row.dataset.group === filter || row.dataset.kind === filter;
          row.hidden = !matches || !inFilter;
          if (!row.hidden) visible++;
        });
        g.hidden = !visible; count += visible;
      });
      if (empty) empty.hidden = count > 0;
      if (status) status.textContent = count === 1 ? t('matchesOne') : t('matches', { n: count });
      Study.emit('home:filter', { query, filter, count });
    }
    search.addEventListener('input', render);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { search.value = ''; render(); }
      if (e.key === 'Enter') {
        const links = document.querySelectorAll('[data-search-row]:not([hidden]) a');
        if (links.length === 1) links[0].click();
      }
    });
    buttons.forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filter;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    }));
    const clear = document.getElementById('clear-search');
    if (clear) clear.addEventListener('click', () => {
      search.value = ''; filter = 'all';
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === 'all')));
      render(); search.focus();
    });
    document.addEventListener('keydown', (e) => {
      const a = document.activeElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && !a.isContentEditable) { e.preventDefault(); search.focus(); }
    });
    window.addEventListener('pageshow', render);
    render();
  }

  function boot() {
    const id = document.body.dataset.page;
    const kind = document.body.dataset.kind;
    Study.page = Study.pages.find((p) => p.id === id && p.kind === kind) || null;
    if (Study.page) store.set('last-page', Study.page.href);
    bindTheme(); bindPicker(); initRail(); initHome();
    packages.forEach((p) => { if (p.init) { try { p.init(Study); } catch (err) { console.error('[study] ' + p.name + '.init', err); } } });
    booted = true;
    Study.enhance(document);
    readyQueue.splice(0).forEach((fn) => fn(Study));
    Study.emit('ready', Study);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
