/* legacy-globals — old global names for page scripts written before the move to the template.
   Option "globals": { "Old": { "member": "study.path", … }, "Other": "study.path" }.
   A path names something on Study ("sources", "stateMachine", "store", "legacy", "plot.Plane", …)
   or the built-in "rawStore" (JSON localStorage with keys used exactly as given, no site prefix).
   Members are getters, so the order in which packages load does not matter. */
(function () {
  'use strict';
  const O = Study.options('legacy-globals');
  const rawStore = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
  };
  const resolve = (path) => {
    if (path === 'rawStore') return rawStore;
    if (path === 'Study' || path === '') return Study;
    return String(path).split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), Study);
  };
  const globals = O.globals && typeof O.globals === 'object' ? O.globals : {};
  Object.keys(globals).forEach((name) => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) { console.warn('[study] legacy-globals: "' + name + '" is not a valid global name'); return; }
    if (name in window) { console.warn('[study] legacy-globals: window.' + name + ' already exists; left alone'); return; }
    const spec = globals[name];
    if (typeof spec === 'string') {
      Object.defineProperty(window, name, { get: () => resolve(spec), configurable: true });
      return;
    }
    const obj = {};
    Object.keys(spec || {}).forEach((member) => {
      Object.defineProperty(obj, member, { get: () => resolve(spec[member]), enumerable: true, configurable: true });
    });
    Object.defineProperty(window, name, { value: obj, configurable: true });
  });
  Study.define('legacy-globals', {
    init() {
      // after every package has loaded, report paths that name nothing (a typo, or a package not enabled)
      Object.keys(globals).forEach((name) => {
        const spec = globals[name];
        const paths = typeof spec === 'string' ? [spec] : Object.values(spec || {});
        paths.forEach((p) => { if (resolve(p) === undefined) console.warn('[study] legacy-globals: window.' + name + ' uses "' + p + '", which is not defined (is its package enabled?)'); });
      });
    },
  });
})();
