/* kpi-tile — Niagara view pack widget (AMD module, no build step).
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
          dom.html(app ? app.innerHTML : '<h2>kpi-tile</h2><div class="ord">resolving…</div>');
          self.jq().find('.ord').text(String(self._target || ''));
        }).fail(function () {
          dom.html('<h2>kpi-tile</h2><div class="ord">index.html unavailable</div>');
        });
      }

      /* Target precedence — verified against 4.15.2.38:
       *   1. ?ord=                       explicit (standalone shape B)
       *   2. our own frame URL           /ord/<ord>|view:<name>  <- the reliable one
       *   3. bound value                 NOTE: in a view this is the STATION, not the
       *                                  component, so it only counts if it is not root
       *   4. parent frame / referrer
       *   5. station root
       * Never throws; always returns an ORD string. */
      _resolveTargetOrd() {
        var q = /[?&]ord=([^&]+)/.exec(window.location.search || '');
        if (q) { return decodeURIComponent(q[1]); }

        var own = this._ordFromUrl(window.location.href);
        if (own) { return own; }

        try {
          var v = this.value && this.value();
          if (v) {
            var o = (typeof v.getNavOrd === 'function') ? v.getNavOrd()
                  : (typeof v.getOrd === 'function')    ? v.getOrd() : null;
            if (o) {
              var s = String(o);
              if (s && s !== 'station:' && s !== 'station:|slot:/') { return s; }
            }
          }
        } catch (e) { /* no bound value */ }

        var candidates = [];
        try { if (window.parent && window.parent !== window) { candidates.push(window.parent.location.href); } } catch (e) {}
        try { candidates.push(document.referrer); } catch (e) {}
        for (var i = 0; i < candidates.length; i++) {
          var c = this._ordFromUrl(candidates[i]);
          if (c) { return c; }
        }
        return 'station:|slot:/';
      }

      /* Pull the bound ORD out of a station page URL: /ord/<ord>|view:<name>?... */
      _ordFromUrl(href) {
        if (!href) { return null; }
        var d = href;
        try { d = decodeURIComponent(href); } catch (e) { /* leave raw */ }
        var m = /\/ord\/(.+?)\|view:/.exec(d);
        if (m) { return m[1]; }
        var m2 = /\/ord\/([^?#]+)/.exec(d);
        return m2 ? m2[1] : null;
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
