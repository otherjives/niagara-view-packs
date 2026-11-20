/* demo-card — Niagara view pack widget (AMD module, no build step).
 *
 * Shape A (component view): loaded by the station as
 *   <WebWidget js="file:^views/<pack-id>/widget.js"/> inside a generated px.
 * Shape B (standalone page): opened as
 *   /file/views/<pack-id>/index.html?ord=slot:/Programs/X
 *   — no requirejs there, so this module returns immediately and the static
 *   markup in index.html is what you see.
 *
 * Never hard-code the pack id here: BASE comes from this module's own URL.
 */
(function () {
  'use strict';
  if (typeof define !== 'function') { return; }   // standalone page — static markup only

  define(['module', 'baja!', 'bajaux/Widget', 'jquery'],
  function (module, baja, Widget, $) {

    var BASE = String(module.uri || '').replace(/[^\/]*$/, '');   // .../views/<id>/
    var CSS_ID = 'vp-css-' + BASE.replace(/[^A-Za-z0-9]/g, '_');

    return class ViewPackWidget extends Widget {

      constructor(params) {
        super({ params, defaults: { properties: { rootCssClass: 'vp-card' } } });
      }

      doInitialize(dom) {
        this._injectCss();
        this._injectMarkup(dom);
        this._target = this._resolveTargetOrd();
        this.jq().find('.ord').text(String(this._target));
        // Pack behaviour goes here. this._target is a station ORD string.
      }

      /* Markup lives in index.html so the standalone page and the component view
         share one document. Scripts inside the fetched HTML never run (innerHTML
         semantics) — behaviour belongs in this module. */
      _injectMarkup(dom) {
        var self = this;
        $.get(BASE + 'index.html').done(function (html) {
          var app = null;
          try {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            app = doc.getElementById('app');
          } catch (e) { /* fall through to the inline default below */ }
          dom.html(app ? app.innerHTML : '<h2>demo-card</h2><div class="ord">resolving…</div>');
          self.jq().find('.ord').text(String(self._target || ''));
        }).fail(function () {
          dom.html('<h2>demo-card</h2><div class="ord">index.html unavailable</div>');
        });
      }

      /* Target precedence: explicit ?ord= → bound value → parent/referrer → root.
         Never throws; always returns an ORD string. */
      _resolveTargetOrd() {
        var q = /[?&]ord=([^&]+)/.exec(window.location.search || '');
        if (q) { return decodeURIComponent(q[1]); }
        try {
          var v = this.value && this.value();
          if (v) {
            if (typeof v.getNavOrd === 'function') { return String(v.getNavOrd()); }
            if (typeof v.getOrd === 'function')    { return String(v.getOrd()); }
          }
        } catch (e) { /* no bound value */ }
        var candidates = [];
        try { if (window.parent && window.parent !== window) { candidates.push(window.parent.location.href); } } catch (e) {}
        try { candidates.push(document.referrer); } catch (e) {}
        for (var i = 0; i < candidates.length; i++) {
          var m = /ord\/(.+?)(?:\||\?|$)/.exec(decodeURIComponent(candidates[i] || ''));
          if (m) { return decodeURIComponent(m[1]); }
        }
        return 'station:|slot:/';
      }

      _injectCss() {
        if (document.getElementById(CSS_ID)) { return; }
        $('<link rel="stylesheet" type="text/css">')
          .attr('id', CSS_ID)
          .attr('href', BASE + 'widget.css')
          .appendTo('head');
      }
    };
  });
})();
