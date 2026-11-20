/* program-explainer — a readable UI for any Niagara program object.
 *
 * Shape A (component view): the station loads this as
 *   <WebWidget js="file:^views/<pack-id>/widget.js"/> inside a generated px.
 * Shape B (standalone): /file/views/<pack-id>/index.html?ord=slot:/Programs/X
 *
 * The pack never hard-codes its own id: BASE comes from module.uri, so the same
 * files work wherever the station puts them.
 */
(function () {
  'use strict';
  if (typeof define !== 'function') { return; }   // standalone page: static markup only

  define(['module', 'baja!', 'bajaux/Widget', 'jquery'],
  function (module, baja, Widget, $) {

    var BASE = String(module.uri || '').replace(/[^\/]*$/, '');
    var CSS_ID = 'pe-css-' + BASE.replace(/[^A-Za-z0-9]/g, '_');
    var POLL_MS = 10000;

    function text(v) {
      if (v === null || v === undefined) { return '—'; }
      try {
        if (typeof v.getValue === 'function') { return v.getValue(); }
        if (typeof v.getString === 'function') { return v.getString(); }
      } catch (e) { /* proxy shape varies — fall through */ }
      return String(v);
    }

    return class ProgramExplainer extends Widget {

      constructor(params) {
        super({ params, defaults: { properties: { rootCssClass: 'pe' } } });
      }

      doInitialize(dom) {
        this._injectCss();
        this._dom = dom;
        this._comp = null;
        this._poll = null;

        var self = this;
        this._injectMarkup(function () {
          self._target = self._resolveTargetOrd();
          self._paintIdentity();
          self._load('initial');
          self._bindActions();
          self._loadInstallInfo();
        });
      }

      doDestroy() { this._stopPolling(); }

      /* ---------- markup + css ---------- */

      _injectMarkup(done) {
        var self = this;
        $.get(BASE + 'index.html').done(function (html) {
          var app = null;
          try { app = new DOMParser().parseFromString(html, 'text/html').getElementById('app'); }
          catch (e) { /* fall through */ }
          self._dom.html(app ? app.innerHTML : '<p>index.html missing</p>');
          done();
        }).fail(function () {
          self._dom.html('<p>This pack is missing index.html — reinstall it.</p>');
        });
      }

      _injectCss() {
        if (document.getElementById(CSS_ID)) { return; }
        $('<link rel="stylesheet" type="text/css">')
          .attr('id', CSS_ID).attr('href', BASE + 'widget.css').appendTo('head');
      }

      /** Element with data-pe="<key>", scoped to this widget. */
      _el(key) { return this.jq().find('[data-pe="' + key + '"]'); }

      /* ---------- target ---------- */

      /* Explicit ?ord= → own frame URL (the channel that actually carries the
         bound ORD) → bound value (in a view this is the station) → root. */
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
            if (o) { var s = String(o); if (s && s !== 'station:' && s !== 'station:|slot:/') { return s; } }
          }
        } catch (e) { /* no bound value */ }
        return 'station:|slot:/';
      }

      _ordFromUrl(href) {
        if (!href) { return null; }
        var d = href;
        try { d = decodeURIComponent(href); } catch (e) { /* leave raw */ }
        var m = /\/ord\/(.+?)\|view:/.exec(d);
        if (m) { return m[1]; }
        var m2 = /\/ord\/([^?#]+)/.exec(d);
        return m2 ? m2[1] : null;
      }

      _paintIdentity() {
        this._el('ord').text(this._target);
        this._el('ord').on('click', function () {
          try { document.execCommand('copy'); } catch (e) { /* clipboard optional */ }
        });
        this._el('name').text(this._target.split('/').pop() || 'Program');
        this._el('about').text(
          'A Niagara program object. It runs Java on the station; the slots below are '
          + 'the inputs it reads and the outputs it publishes. The card above shows what '
          + 'it last did, and "Run now" asks it to do that again.'
        );
      }

      /* ---------- data ---------- */

      _load(why) {
        var self = this;
        this._el('live').attr('data-state', 'stale').text('● reading');
        baja.Ord.make(this._target).resolve({ lease: true })
          .then(function (t) { return t.getComponent(); })
          .then(function (comp) {
            self._comp = comp;
            self._paintIdentityFrom(comp);
            self._paintSlots(comp);
            self._paintState(comp);
            self._el('live').attr('data-state', 'live').text('● live');
            console.debug('[program-explainer] loaded (' + why + ')', self._target);
            self._startPush(comp);
          })
          .catch(function (err) {
            self._el('live').attr('data-state', 'down').text('● no data');
            self._el('slots').html('<tr><td colspan="2" class="pe-muted">'
              + 'cannot resolve ' + self._esc(self._target) + ': ' + self._esc(self._msg(err))
              + '</td></tr>');
            console.debug('[program-explainer] resolve failed', err);
          });
      }

      _paintIdentityFrom(comp) {
        var name = this._target.split('/').pop();
        try { if (typeof comp.getName === 'function') { name = comp.getName(); } } catch (e) { /* keep ord tail */ }
        this._el('name').text(name);
        try {
          if (typeof comp.getNavDisplayName === 'function') {
            this._el('about').attr('data-display', String(comp.getNavDisplayName()));
          }
        } catch (e) { /* optional */ }
        try {
          if (typeof comp.getType === 'function') {
            this._el('type').text(String(comp.getType()).replace(/^.*?:/, ''));
          }
        } catch (e) { /* optional */ }
      }

      _slotNames(comp) {
        var names = [];
        try {
          if (typeof comp.getSlotsArray === 'function') {
            var arr = comp.getSlotsArray() || [];
            for (var i = 0; i < arr.length; i++) {
              var n = arr[i] && (typeof arr[i].getName === 'function' ? arr[i].getName() : null);
              if (n) { names.push(String(n)); }
            }
          }
        } catch (e) { /* proxy may not expose slots */ }
        if (!names.length) {
          ['status', 'lastError', 'scanned', 'installed', 'skipped', 'failed'].forEach(function (n) {
            names.push(n);
          });
        }
        return names;
      }

      _paintSlots(comp) {
        var self = this;
        var names = this._slotNames(comp);
        var total = 0;
        try { if (typeof comp.getSlotCount === 'function') { total = Number(comp.getSlotCount()); } }
        catch (e) { /* count is optional */ }
        var rows = [];
        names.forEach(function (n) {
          var raw;
          try { raw = comp.get(n); } catch (e) { return; }
          rows.push('<tr><td><code>' + self._esc(n) + '</code></td><td>'
            + self._esc(text(raw)) + '</td></tr>');
        });
        var partial = total > rows.length;
        this._el('slotCount').text(partial ? '(' + rows.length + ' of ' + total + ')' : '(' + rows.length + ')');
        this._el('slotHint').text(partial
          ? 'This Niagara build does not expose slot enumeration to the browser, so this shows the '
            + rows.length + ' slots the pack knows to look for — the component has ' + total + '.'
          : 'Inputs and outputs of this program object, read live from the station.');
        this._el('slots').html(rows.length ? rows.join('')
          : '<tr><td colspan="2" class="pe-muted">this build cannot read slots</td></tr>');
      }

      _paintState(comp) {
        var self = this;
        var status = '';
        try { status = String(text(comp.get('status'))); } catch (e) { /* optional */ }
        var tone = /^(ERROR|FAIL)/.test(status) ? 'bad' : (/^OK/.test(status) ? 'ok' : '');
        this._el('status').attr('data-tone', tone).text(status || 'no status slot');
        ['scanned', 'installed', 'skipped', 'failed'].forEach(function (k) {
          var v = '–';
          try { v = String(text(comp.get(k))); } catch (e) { /* optional */ }
          self._el(k).text(v);
        });
        var err = '';
        try { err = String(text(comp.get('lastError')) || ''); } catch (e) { /* optional */ }
        this._el('lastError').prop('hidden', !err).text(err ? 'last error: ' + err : '');

        var rows = '';
        try { rows = String(text(comp.get('rows')) || ''); } catch (e) { /* optional */ }
        this._el('rows').text(rows || 'no activity recorded');
      }

      /* Live-ish updates: a real Subscriber if this build supports it, else poll. */
      _startPush(comp) {
        var self = this;
        this._stopPolling();
        try {
          var Sub = baja.Subscriber;
          if (Sub) {
            var sub = new Sub();
            sub.attach('changed', function () {
              self._paintSlots(self._comp);
              self._paintState(self._comp);
            });
            this._poll = { stop: function () { try { sub.detach('changed'); } catch (e) {} } };
            console.debug('[program-explainer] subscribed to changes');
            return;
          }
        } catch (e) {
          console.debug('[program-explainer] subscriber unavailable, polling', e);
        }
        var id = setInterval(function () {
          if (!self._comp) { return; }
          self._paintSlots(self._comp);
          self._paintState(self._comp);
        }, POLL_MS);
        this._poll = { stop: function () { clearInterval(id); } };
        this._el('live').attr('data-state', 'live').text('● polling');
      }

      _stopPolling() {
        if (this._poll && this._poll.stop) { try { this._poll.stop(); } catch (e) {} }
        this._poll = null;
      }

      /* ---------- actions ---------- */

      _bindActions() {
        var self = this;
        this._el('refresh').on('click', function () { self._load('refresh'); });
        // Two-step arm/confirm instead of window.confirm: the modal is blocked in
        // embedded/headless viewers and looks foreign inside a station view.
        this._el('run').on('click', function () {
          if (!self._armed) {
            self._armed = true;
            self._el('run').text('Confirm run').addClass('pe-btn-armed');
            self._note('click again within 5s');
            clearTimeout(self._armTimer);
            self._armTimer = setTimeout(function () { self._disarm(); }, 5000);
            return;
          }
          self._disarm();
          self._doRun();
        });
      }

      _disarm() {
        clearTimeout(this._armTimer);
        this._armed = false;
        this._el('run').text('Run now').removeClass('pe-btn-armed');
        this._note('');
      }

      _doRun() {
        var self = this;
        var btn = this._el('run');
        if (!this._comp) { this._note('not connected'); return; }
        btn.prop('disabled', true);
        this._note('running…');
        try {
          var r = null;
          if (typeof this._comp.invokeAction === 'function') {
            r = this._comp.invokeAction('execute');
          } else if (typeof this._comp.invoke === 'function') {
            r = this._comp.invoke('execute');
          } else {
            throw new Error('this Niagara build does not expose action invoke to the browser');
          }
          if (r && typeof r.then === 'function') {
            r.then(function () { self._afterRun('done'); },
                   function (e) { self._afterRun('failed: ' + self._msg(e)); });
          } else {
            self._afterRun('done');
          }
        } catch (e) {
          this._afterRun('failed: ' + this._msg(e));
        }
      }

      _afterRun(outcome) {
        this._el('run').prop('disabled', false);
        this._note(outcome);
        var self = this;
        setTimeout(function () { self._load('after-run'); }, 1200);
      }

      _note(s) { this._el('runNote').text(s || ''); }

      /* ---------- provenance ---------- */

      _loadInstallInfo() {
        var self = this;
        $.get(BASE + '_install.txt').done(function (t) {
          var id = (/^id=(.*)$/m.exec(t) || [])[1] || 'unknown';
          var sha = (/^commit=(.*)$/m.exec(t) || [])[1] || '';
          var stamp = (/^installed=(.*)$/m.exec(t) || [])[1] || '';
          self._el('pack').text('pack ' + id + (sha ? ' @ ' + sha.slice(0, 10) : '')
            + (stamp ? '  ·  installed ' + stamp : ''));
        }).fail(function () {
          self._el('pack').text('pack: not installed by PxViewSync');
        });
      }

      /* ---------- helpers ---------- */

      _esc(x) {
        return String(x === null || x === undefined ? '' : x)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      _msg(err) {
        try { return (err && err.message) ? err.message : String(err); }
        catch (e) { return 'unknown error'; }
      }
    };
  });
})();
