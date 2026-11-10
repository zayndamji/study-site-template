/* ==========================================================================
   code-blocks — syntax-highlighted code listings.
   --------------------------------------------------------------------------
   Markup: <pre data-lang="cpp" data-mark="2,4-5" data-title="main.cpp" data-numbers="true">…</pre>
   (or <pre><code class="language-cpp">…</code></pre>); inline <code data-lang="py">…</code>.
   The source text is read as plain text (write &lt; &gt; &amp; as usual) and re-rendered with
   <span class="cb-kw|cb-ty|cb-str|cb-num|cb-com|cb-pre|cb-fn"> tokens, one .cb-line per line.
   API: Study.code = { highlight(text, lang) → HTML, lines(text, lang, {mark}) → HTML,
                       render(preElement), languages, lang(name) }
   ========================================================================== */
(function () {
  'use strict';
  const O = Study.options('code-blocks');
  const t = (key, vals) => String(O[key] === undefined ? '' : O[key]).replace(/\{(\w+)\}/g, (m, k) => (vals && k in vals ? vals[k] : m));
  const words = (s) => new Set(s.split(/\s+/).filter(Boolean));
  const extraTypes = Array.isArray(O.types) ? O.types : [];

  const C_KW = 'break case catch class const constexpr continue default delete do else enum explicit extern for friend goto if inline namespace new noexcept operator private protected public return sizeof static struct switch template this throw try typedef typename union using virtual volatile while nullptr true false NULL override final';
  const C_TY = 'auto bool char double float int long short signed unsigned void size_t string vector map set pair ostream istream';
  const LANGS = {
    cpp: { line: '//', block: ['/*', '*/'], str: ['"', "'"], pre: true, kw: words(C_KW), ty: words(C_TY + ' ' + 'std') },
    c: { line: '//', block: ['/*', '*/'], str: ['"', "'"], pre: true, kw: words(C_KW), ty: words(C_TY) },
    java: { line: '//', block: ['/*', '*/'], str: ['"', "'"], kw: words('abstract break case catch class continue default do else enum extends final finally for if implements import instanceof interface new package private protected public return static super switch this throw throws try while true false null var'), ty: words('boolean byte char double float int long short void String Integer Object') },
    js: { line: '//', block: ['/*', '*/'], str: ['"', "'", '`'], kw: words('async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield true false null undefined'), ty: words('Array Map Set Object String Number Boolean Promise') },
    py: { line: '#', block: null, str: ['"""', "'''", '"', "'"], kw: words('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None'), ty: words('int float str bool list dict set tuple object') },
    text: null,
  };
  const ALIAS = { 'c++': 'cpp', cc: 'cpp', h: 'cpp', hpp: 'cpp', javascript: 'js', python: 'py', plain: 'text', none: 'text' };
  const langOf = (name) => { const n = String(name || '').toLowerCase(); return ALIAS[n] || n; };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /** Split text into [cls, text] tokens (cls '' = plain). */
  function tokens(text, lang) {
    const L = LANGS[langOf(lang)];
    if (!L) return [['', text]];
    const out = [];
    const push = (cls, s) => { if (!s) return; const last = out[out.length - 1]; if (last && last[0] === cls && cls === '') last[1] += s; else out.push([cls, s]); };
    let i = 0, lineStart = true;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (ch === '\n') { push('', ch); i++; lineStart = true; continue; }
      if (lineStart && L.pre && ch === '#') { // spaces before it were pushed as plain text
        let j = text.indexOf('\n', i); if (j < 0) j = n;
        const lineText = text.slice(i, j);
        const m = /^(#\s*\w+)(\s*)(.*)$/.exec(lineText);
        if (m) { push('cb-pre', m[1]); push('', m[2]); push(/^[<"]/.test(m[3]) ? 'cb-str' : '', m[3]); } else push('cb-pre', lineText);
        i = j; continue;
      }
      if (ch !== ' ' && ch !== '\t') lineStart = false;
      if (L.line && text.startsWith(L.line, i)) {
        let j = text.indexOf('\n', i); if (j < 0) j = n;
        push('cb-com', text.slice(i, j)); i = j; continue;
      }
      if (L.block && text.startsWith(L.block[0], i)) {
        let j = text.indexOf(L.block[1], i + L.block[0].length); j = j < 0 ? n : j + L.block[1].length;
        push('cb-com', text.slice(i, j)); i = j; continue;
      }
      const q = L.str.find((s) => text.startsWith(s, i));
      if (q) {
        let j = i + q.length;
        while (j < n && !text.startsWith(q, j)) { if (text[j] === '\\') j++; else if (q.length === 1 && text[j] === '\n') break; j++; }
        j = Math.min(n, j + (text.startsWith(q, j) ? q.length : 0));
        push('cb-str', text.slice(i, j)); i = j; continue;
      }
      const num = /^(?:0[xX][\da-fA-F']+|\d[\d']*(?:\.\d+)?(?:[eE][+-]?\d+)?[uUlLfF]*|\.\d+)/.exec(text.slice(i, i + 40));
      if (num && !/[\w$]/.test(text[i - 1] || '')) { push('cb-num', num[0]); i += num[0].length; continue; }
      const id = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, i + 80));
      if (id) {
        const w = id[0];
        const after = text.slice(i + w.length, i + w.length + 2);
        let cls = '';
        if (L.kw.has(w)) cls = 'cb-kw';
        else if (L.ty.has(w) || extraTypes.includes(w) || /^[A-Z]/.test(w) && /[a-z]/.test(w)) cls = 'cb-ty';
        else if (/^\s*\(/.test(after)) cls = 'cb-fn';
        push(cls, w); i += w.length; continue;
      }
      push('', ch); i++;
    }
    return out;
  }

  /** Highlighted HTML for a fragment (no line wrappers). */
  function highlight(text, lang) {
    return tokens(text, lang).map(([c, s]) => (c ? '<span class="' + c + '">' + esc(s) + '</span>' : esc(s))).join('');
  }

  /** "2,4-6" → Set {2,4,5,6} */
  function parseMarks(spec) {
    const set = new Set();
    String(spec || '').split(/[\s,]+/).forEach((part) => {
      const m = /^(\d+)(?:-(\d+))?$/.exec(part);
      if (!m) return;
      for (let k = +m[1]; k <= +(m[2] || m[1]); k++) set.add(k);
    });
    return set;
  }

  /** Highlighted HTML with one <span class="cb-line"> per line; marks: Set or "2,4-6". */
  function lines(text, lang, opts) {
    const mark = opts && opts.mark instanceof Set ? opts.mark : parseMarks(opts && opts.mark);
    const rows = [[]];
    tokens(text, lang).forEach(([c, s]) => {
      s.split('\n').forEach((piece, k) => { if (k) rows.push([]); if (piece) rows[rows.length - 1].push([c, piece]); });
    });
    if (rows.length > 1 && rows[rows.length - 1].length === 0) rows.pop();
    const sr = t('markLabel');
    return rows.map((r, k) => {
      const on = mark.has(k + 1);
      const body = r.map(([c, s]) => (c ? '<span class="' + c + '">' + esc(s) + '</span>' : esc(s))).join('') || ' ';
      return '<span class="cb-line' + (on ? ' cb-on' : '') + '" data-line="' + (k + 1) + '">' + (on && sr ? '<span class="cb-sr">' + esc(sr) + ': </span>' : '') + body + '</span>';
    }).join('');
  }

  /** Strip one common leading indent and the first/last blank line. */
  function tidy(text) {
    let s = text.replace(/\r\n?/g, '\n').replace(/^\n/, '').replace(/\n[ \t]*$/, '');
    const ind = s.split('\n').filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length);
    const k = ind.length ? Math.min(...ind) : 0;
    if (k) s = s.split('\n').map((l) => l.slice(k)).join('\n');
    return s;
  }

  function render(pre) {
    if (pre.dataset.cbDone) return;
    const code = pre.querySelector(':scope > code');
    const host = code || pre;
    const cls = /(?:^|\s)language-([\w+#-]+)/.exec((code && code.className) || '') || /(?:^|\s)language-([\w+#-]+)/.exec(pre.className);
    const lang = langOf(pre.dataset.lang || (code && code.dataset.lang) || (cls && cls[1]) || O.defaultLang || '');
    if (!lang) return;
    pre.dataset.cbDone = '1';
    const src = tidy(host.textContent);
    const numbered = pre.dataset.numbers ? pre.dataset.numbers !== 'false' : !!O.lineNumbers;
    pre.classList.add('cb');
    if (numbered) pre.classList.add('cb-numbered');
    const inner = code || document.createElement('code');
    inner.innerHTML = lines(src, lang, { mark: pre.dataset.mark });
    if (!code) { pre.textContent = ''; pre.appendChild(inner); }
    if (pre.dataset.title && !(pre.parentElement && pre.parentElement.classList.contains('cb-figure'))) {
      const fig = document.createElement('figure');
      fig.className = 'cb-figure';
      const cap = document.createElement('figcaption');
      cap.className = 'cb-title';
      cap.textContent = t('titleLabel', { title: pre.dataset.title });
      pre.parentNode.insertBefore(fig, pre);
      fig.appendChild(cap);
      fig.appendChild(pre);
    }
  }

  function renderInline(code) {
    if (code.dataset.cbDone || code.closest('pre')) return;
    const cls = /(?:^|\s)language-([\w+#-]+)/.exec(code.className);
    const lang = langOf(code.dataset.lang || (cls && cls[1]) || (O.inline ? O.defaultLang : ''));
    if (!lang || !LANGS[lang]) return;
    code.dataset.cbDone = '1';
    code.classList.add('cb-inline');
    code.innerHTML = highlight(code.textContent, lang);
  }

  Study.code = { highlight, lines, render, tidy, tokens, languages: Object.keys(LANGS), lang: langOf };
  Study.define('code-blocks', {
    enhance(root) {
      Study.$$(root, 'pre').forEach(render);
      Study.$$(root, 'code').forEach(renderInline);
    },
  });
})();
