/* source-links — the build links "§ Heading" references already in the page; this links the ones
   that page scripts write later (at start-up, and whenever Study.enhance(root) runs).
   The page's source address comes from <meta name="source-links-url">, written by the build. */
(function () {
  'use strict';
  const O = Study.options('source-links');
  const meta = document.querySelector('meta[name="source-links-url"]');
  const url = meta ? meta.getAttribute('content') : '';
  const marker = O.marker || '';
  const sel = (Array.isArray(O.selectors) ? O.selectors : []).join(', ');
  const seps = O.separators || '';
  const splitRx = seps ? new RegExp('(\\s*[' + seps.replace(/[\\\]^-]/g, '\\$&') + ']\\s*)') : null;
  // same encoding as the build (Python quote with safe=''), with "-" escaped for text fragments
  const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/-/g, '%2D');
  function fragment(heading) {
    const h = heading.replace(/[“”"]/g, '').replace(/\(.*?\)/g, '').trim();
    return h.split(/\s*…\s*|\s*\.\.\.\s*/).map((x) => x.trim()).filter(Boolean).map(enc).join(',');
  }
  function linkPart(part) {
    const frag = O.textFragments === false ? '' : fragment(part.split(marker).slice(1).join(marker));
    const a = document.createElement('a');
    a.className = 'src-link';
    a.href = url + (frag ? '#:~:text=' + frag : '');
    if (O.newTab !== false) { a.target = '_blank'; a.rel = 'noopener'; }
    if (O.linkTitle) a.title = O.linkTitle;
    a.textContent = part.trim();
    return a;
  }
  function link(root) {
    if (!url || !marker || !sel) return;
    root = root || document;
    const hosts = [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
    hosts.forEach((host) => {
      if (host.children.length || !host.textContent.includes(marker)) return;   // text-only, as at build time
      const parts = splitRx ? host.textContent.split(splitRx) : [host.textContent];
      host.textContent = '';
      parts.forEach((part) => {
        if (part.includes(marker) && !(splitRx && new RegExp('^' + splitRx.source + '$').test(part))) {
          const lead = part.slice(0, part.length - part.trimStart().length);
          if (lead) host.append(lead);
          host.append(linkPart(part));
        } else host.append(part);
      });
    });
  }
  Study.sourceLinks = { link };
  Study.define('source-links', { enhance(root) { link(root); } });
})();
