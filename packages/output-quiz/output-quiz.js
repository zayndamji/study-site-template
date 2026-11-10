/* ==========================================================================
   output-quiz — "predict the output" widgets.
   --------------------------------------------------------------------------
   Markup: div.widget.oq[data-id] (data-mode="value" for the one-line variant) holding a
           <pre> listing, a script.oq-expected (type text/plain) with the expected output,
           and an optional template.oq-explain shown once the widget is settled.
   State is saved per data-id under the store key "oq:<id>".
   API: Study.outputQuiz = { compare, compareValue, prepare, tidy, settings, mount, key }
   Events: 'oq:check' on every check; core 'quiz:answer' once a widget is settled.
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('output-quiz');
  const t = (key, vals) => String(O[key] === undefined ? '' : O[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && k in vals ? vals[k] : m));
  const key = (id) => 'oq:' + id;

  // ---------- pure helpers (no DOM) ----------

  /** Strip one common leading indent and the first/last blank line (as code-blocks does). */
  function tidy(text) {
    let s = String(text || '').replace(/\r\n?/g, '\n').replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '');
    const ind = s.split('\n').filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length);
    const k = ind.length ? Math.min(...ind) : 0;
    if (k) s = s.split('\n').map((l) => l.slice(k)).join('\n');
    return s;
  }

  const BOOL = { trimTrailing: true, trimLeading: false, collapseSpaces: false, ignoreBlankLines: false, caseSensitive: true };
  const dataName = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

  /** The comparison settings for a widget: package options (or `base`), overridden by data-* attributes. */
  function settings(host, base) {
    const b = Object.assign({}, O, base || {});
    const ds = (host && host.dataset) || {};
    const s = {};
    Object.keys(BOOL).forEach((k) => {
      const v = host && host.getAttribute ? host.getAttribute('data-' + dataName(k)) : null;
      s[k] = v !== null ? v !== 'false' : b[k] === undefined ? BOOL[k] : !!b[k];
    });
    const att = parseInt(ds.attempts !== undefined ? ds.attempts : b.attempts, 10);
    s.attempts = isFinite(att) && att > 0 ? att : 0;
    s.showExpected = (ds.showExpected || b.showExpected) === 'wrong' ? 'wrong' : 'end';
    s.mode = (ds.mode || b.mode) === 'value' ? 'value' : 'output';
    const rows = parseInt(ds.rows !== undefined ? ds.rows : b.rows, 10);
    s.rows = isFinite(rows) && rows > 0 ? rows : 4;
    return s;
  }

  /** The comparison key of one line under settings s. */
  function lineKey(line, s) {
    let k = line;
    if (s.collapseSpaces) k = k.replace(/[ \t]+/g, ' ');
    if (!s.caseSensitive) k = k.toLowerCase();
    return k;
  }

  /** Split text into lines for comparison: [{text, key}] (text as shown, key as compared). */
  function prepare(text, s) {
    s = s || {};
    let lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map((raw) => {
      let shown = raw;
      if (s.trimTrailing !== false) shown = shown.replace(/[ \t]+$/, '');
      if (s.trimLeading) shown = shown.replace(/^[ \t]+/, '');
      return { text: shown, key: lineKey(shown, s), blank: !raw.trim() };
    });
    if (s.ignoreBlankLines) lines = lines.filter((l) => !l.blank);
    while (lines.length && lines[lines.length - 1].blank) lines.pop();
    return lines.map((l) => ({ text: l.text, key: l.key }));
  }

  /**
   * Compare an output line by line.
   * → { ok, right, total, given, rows: [{n, exp, got, ok}] } (exp/got null where a side has no line)
   */
  function compare(expected, given, s) {
    const E = prepare(expected, s), G = prepare(given, s);
    const rows = [];
    for (let i = 0; i < Math.max(E.length, G.length); i++) {
      const e = E[i], g = G[i];
      rows.push({ n: i + 1, exp: e ? e.text : null, got: g ? g.text : null, ok: !!(e && g && e.key === g.key) });
    }
    const right = rows.filter((r) => r.ok).length;
    return { ok: E.length === G.length && right === E.length, right, total: E.length, given: G.length, rows };
  }

  /**
   * Compare a single value. Every non-blank line of `expected` is an accepted answer; both sides are
   * trimmed. → { ok, right, total: 1, given, accepted: [...], rows: [{n: 1, exp, got, ok}] }
   */
  function compareValue(expected, given, s) {
    s = s || {};
    const accepted = String(expected || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    const got = String(given || '').trim();
    const k = lineKey(got, s);
    const hit = accepted.find((a) => lineKey(a, s) === k);
    const ok = hit !== undefined && got !== '';
    return { ok, right: ok ? 1 : 0, total: 1, given: got ? 1 : 0, accepted,
      rows: [{ n: 1, exp: ok ? hit : accepted[0] === undefined ? null : accepted[0], got: got || null, ok }] };
  }

  // ---------- widget ----------
  const h = (...a) => Study.h(...a);

  function mount(host) {
    if (!host || host.dataset.oqDone) return;
    host.dataset.oqDone = '1';
    const id = host.dataset.id || '';
    const s = settings(host);
    const value = s.mode === 'value';
    const exEl = host.querySelector('script.oq-expected');
    const expected = exEl ? (value ? exEl.textContent : tidy(exEl.textContent)) : (host.dataset.expected || '');
    const explain = host.querySelector('template.oq-explain');
    const cmp = (given) => (value ? compareValue(expected, given, s) : compare(expected, given, s));

    // the listing: code-blocks usually rendered it already; give a language-less block one
    const pre = host.querySelector('pre');
    if (pre && !pre.dataset.cbDone && Study.code) {
      if (!pre.dataset.lang) pre.dataset.lang = O.defaultLang || Study.options('code-blocks').defaultLang || 'text';
      Study.code.render(pre);
    }

    host.classList.add('oq-' + s.mode);
    const input = value
      ? h('input', { type: 'text', class: 'oq-input', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', placeholder: t('valuePlaceholder') || null })
      : h('textarea', { class: 'oq-input', rows: s.rows, wrap: 'off', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', placeholder: t('outputPlaceholder') || null });
    const field = h('label', { class: 'field oq-field' }, h('span', { text: t(value ? 'valuePrompt' : 'outputPrompt') }), input);
    const bCheck = h('button', { type: 'button', class: 'btn primary', text: t('checkLabel') });
    const bReveal = h('button', { type: 'button', class: 'btn', text: t('revealLabel') });
    const bReset = h('button', { type: 'button', class: 'btn', text: t('resetLabel') });
    const status = h('span', { class: 'oq-status' });
    const verdict = h('p', { class: 'oq-verdict' });
    const diff = h('div', { class: 'oq-diff' });
    const note = h('p', { class: 'oq-note' });
    const exOut = h('div', { class: 'oq-explain-out' });
    const result = h('div', { class: 'oq-result', 'aria-live': 'polite' }, verdict, diff, note, exOut);
    result.hidden = true;
    host.append(field, h('div', { class: 'controls oq-controls' }, bCheck, bReveal, bReset, status), result);

    let st = Object.assign({ text: '', tries: 0, status: '', checked: null }, Study.store.get(key(id), {}) || {});
    const save = () => { if (id) Study.store.set(key(id), st); };
    const settled = () => !!st.status;

    function grow() {
      if (value) return;
      const n = input.value.split('\n').length;
      input.rows = Math.max(s.rows, Math.min(n + 1, 30));
    }

    function cell(text, cls) {
      if (text === null) return h('td', { class: cls + ' oq-none', text: t('missingLine') });
      if (text === '') return h('td', { class: cls + ' oq-none', text: t('blankLine') });
      return h('td', { class: cls, text });
    }

    function table(res, withExpected) {
      const head = h('tr', null,
        h('th', { scope: 'col', class: 'oq-n' }, h('span', { class: 'oq-sr', text: t('lineHeading') })),
        h('th', { scope: 'col', class: 'oq-m' }, h('span', { class: 'oq-sr', text: t('markHeading') })),
        h('th', { scope: 'col', text: t('yoursHeading') }),
        withExpected ? h('th', { scope: 'col', text: t('expectedHeading') }) : null);
      const rows = res.rows.map((r) => h('tr', { class: r.ok ? 'oq-ok' : 'oq-no' },
        h('td', { class: 'oq-n', text: value ? '' : String(r.n) }),
        h('td', { class: 'oq-m' }, h('span', { 'aria-hidden': 'true', text: t(r.ok ? 'rightMark' : 'wrongMark') }), h('span', { class: 'oq-sr', text: t(r.ok ? 'rightLine' : 'wrongLine') })),
        cell(r.got, 'oq-got'),
        withExpected ? cell(r.exp, 'oq-exp') : null));
      if (!res.rows.length) rows.push(h('tr', { class: 'oq-ok' }, h('td', { class: 'oq-n' }), h('td', { class: 'oq-m' }), cell(null, 'oq-got'), withExpected ? cell(null, 'oq-exp') : null));
      return h('table', { class: 'oq-table' }, h('thead', null, head), h('tbody', null, rows));
    }

    function render() {
      input.value = st.text;
      grow();
      const done = settled();
      input.readOnly = done;
      bCheck.hidden = done;
      bReveal.hidden = done;
      bReset.hidden = !(done || st.tries || st.text);
      status.textContent = done && st.status === 'right' ? '' : s.attempts
        ? t('triesLeft', { left: Math.max(0, s.attempts - st.tries), max: s.attempts, used: st.tries })
        : st.tries ? t('attemptsMade', { used: st.tries }) : '';
      if (st.checked === null && !done) { result.hidden = true; return; }
      const res = cmp(st.checked === null ? '' : st.checked);
      const withExpected = st.status === 'out' || st.status === 'revealed' || (!res.ok && s.showExpected === 'wrong');
      result.hidden = false;
      let v, cls;
      if (st.status === 'right') { v = t(value ? 'rightValue' : 'right'); cls = 'ok'; }
      else if (st.status === 'revealed') { v = t('revealed'); cls = 'shown'; }
      else if (st.status === 'out') { v = t('outOfTries'); cls = 'no'; }
      else {
        cls = 'no';
        v = value ? t('wrongValue') : t('wrong', { right: res.right, total: res.total, given: res.given });
        if (!value && res.total !== res.given) v += t('lineCount', { total: res.total, given: res.given });
      }
      verdict.className = 'oq-verdict ' + cls;
      verdict.textContent = v;
      diff.replaceChildren(table(res, withExpected));
      const more = value && withExpected && res.accepted.length > 1 ? res.accepted.filter((a) => a !== res.rows[0].exp) : [];
      note.textContent = more.length ? t('alsoAccepted', { list: more.join(', ') }) : '';
      note.hidden = !more.length;
      exOut.replaceChildren();
      exOut.hidden = !(done && explain);
      if (done && explain) { exOut.innerHTML = explain.innerHTML; Study.enhance(exOut); }
    }

    function settle(how, correct) {
      st.status = how;
      save();
      render();
      if (O.quizEvents !== false && id) Study.emit('quiz:answer', { id, index: 0, correct, source: 'output-quiz' });
    }

    function check() {
      if (settled()) return;
      if (!input.value.trim()) {
        result.hidden = false; verdict.className = 'oq-verdict no'; verdict.textContent = t('empty');
        diff.replaceChildren(); note.hidden = true; exOut.hidden = true;
        input.focus();
        return;
      }
      st.text = input.value; st.checked = input.value; st.tries += 1;
      const res = cmp(st.checked);
      Study.emit('oq:check', { id, tries: st.tries, correct: res.ok, right: res.right, total: res.total });
      if (res.ok) return settle('right', true);
      if (s.attempts && st.tries >= s.attempts) return settle('out', false);
      save(); render();
    }

    input.addEventListener('input', () => { st.text = input.value; grow(); bReset.hidden = !(settled() || st.tries || st.text); save(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (value || e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); }
    });
    bCheck.addEventListener('click', check);
    bReveal.addEventListener('click', () => { if (settled()) return; st.text = input.value; st.checked = input.value; settle('revealed', false); });
    bReset.addEventListener('click', () => {
      st = { text: '', tries: 0, status: '', checked: null };
      if (id) Study.store.remove(key(id));
      render();
      input.focus();
    });
    render();
  }

  Study.outputQuiz = { compare, compareValue, prepare, tidy, settings, mount, key };
  Study.define('output-quiz', {
    enhance(root) { Study.$$(root, '.oq').forEach(mount); },
  });
})();
