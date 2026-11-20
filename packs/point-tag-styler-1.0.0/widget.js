/* point-tag-styler — reading view for the PointTagStyler program object.
 *
 * Same shape as program-explainer (component-bound WebWidget, or standalone via
 * ?ord=), but tailored: it parses PointTagStyler's own `report` slot into
 * counters and colour-coded lines, and shows the formatting rules it ran with.
 *
 * Slots it reads: report, ok, error, dryRun, sourceRoot, pathTemplate,
 * supervisorStation, categoryMap.  Nothing is sent back except the execute
 * action behind the two-step Run button.
 */
(function () {
  'use strict';
  if (typeof define !== 'function') { return; }   // standalone page: static markup only

  define(['module', 'baja!', 'bajaux/Widget', 'jquery'],
  function (module, baja, Widget, $) {

    var BASE = String(module.uri || '').replace(/[^\/]*$/, '');
    var CSS_ID = 'pts-css-' + BASE.replace(/[^A-Za-z0-9]/g, '_');
    var POLL_MS = 10000;

    /* "LIVE - points=30 matched=24 unmatched=6 skipped=4 dups=0" +
       "created=5 retargeted=0 unchanged=19" */
    var HEAD = /(DRY RUN|LIVE)\s*[-–]\s*points=(\d+)\s+matched=(\d+)\s+unmatched=(\d+)\s+skipped=(\d+)\s+dups=(\d+)/;
    var WRITES = /created=(\d+)\s+retargeted=(\d+)\s+unchanged=(\d+)/;

    function text(v) {
      if (v === null || v === undefined) { return ''; }
      try {
        if (typeof v.getValue === 'function') { return v.getValue(); }
        if (typeof v.getString === 'function') { return v.getString(); }
      } catch (e) { /* proxy shape varies */ }
      return String(v);
    }

    function esc(x) {
      return String(x === null || x === undefined ? '' : x)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return class PointTagStylerView extends Widget {

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
          self._el('ord').text(self._target);
          self._el('name').text(self._target.split('/').pop() || 'PointTagStyler');
          self._load('initial');
          self._bindActions();
          self._loadInstallInfo();
        });
      }

      doDestroy() { this._stopWatch(); }

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

      _el(key) { return this.jq().find('[data-pe="' + key + '"]'); }

      /* ---------- target ---------- */

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

      /* ---------- data ---------- */

      _load(why) {
        var self = this;
        this._el('live').attr('data-state', 'stale').text('● reading');
        baja.Ord.make(this._target).resolve({ lease: true })
          .then(function (t) { return t.getComponent(); })
          .then(function (comp) {
            self._comp = comp;
            try { if (typeof comp.getName === 'function') { self._el('name').text(comp.getName()); } }
            catch (e) { /* keep ord tail */ }
            try {
              if (typeof comp.getType === 'function') {
                self._el('type').text(String(comp.getType()).replace(/^.*?:/, ''));
              }
            } catch (e) { /* optional */ }
            self._paint(comp);
            self._el('live').attr('data-state', 'live').text('● live');
            console.debug('[point-tag-styler] loaded (' + why + ')', self._target);
            self._watch(comp);
          })
          .catch(function (err) {
            self._el('live').attr('data-state', 'down').text('● no data');
            self._el('verdict').text('cannot resolve ' + self._target + ': ' + msg(err));
            self._el('verdictBox').attr('data-tone', 'bad');
            console.debug('[point-tag-styler] resolve failed', err);
          });
      }

      _paint(comp) {
        var rep = '';
        try { rep = String(text(comp.get('report')) || ''); } catch (e) { /* optional */ }
        var ok = true;
        try { ok = String(text(comp.get('ok'))).toLowerCase() !== 'false'; } catch (e) { /* default */ }
        var err = '';
        try { err = String(text(comp.get('error')) || ''); } catch (e) { /* optional */ }

        var h = HEAD.exec(rep);
        var w = WRITES.exec(rep);
        var self = this;
        var set = function (key, val) { self._el(key).text(val === null || val === undefined ? '–' : val); };

        if (h) {
          this._el('mode').text(h[1]).attr('data-mode', h[1] === 'LIVE' ? 'live' : 'dry');
          set('points', h[2]); set('matched', h[3]); set('unmatched', h[4]);
          set('skipped', h[5]); set('dups', h[6]);
        } else {
          ['points', 'matched', 'unmatched', 'skipped', 'dups'].forEach(function (k) { set(k, null); });
        }
        if (w) { set('created', w[1]); set('retargeted', w[2]); set('unchanged', w[3]); }
        else { ['created', 'retargeted', 'unchanged'].forEach(function (k) { set(k, null); }); }
        this._el('writeRow').prop('hidden', !w);

        // Verdict line: the one thing an operator should read first.
        var verdict, tone;
        if (!ok && err) {
          verdict = 'Aborted — no tags were written. ' + err;
          tone = 'bad';
        } else if (!h) {
          verdict = 'No parseable report yet — press Run now (or this station has never run it).';
          tone = 'idle';
        } else if (h[1] === 'LIVE') {
          verdict = 'Live run — ' + h[3] + ' of ' + h[2] + ' points stamped and the station saved.';
          tone = 'ok';
        } else {
          verdict = 'Dry run — ' + h[3] + ' of ' + h[2] + ' points would be stamped, nothing written.';
          tone = 'dry';
        }
        this._el('verdict').text(verdict);
        this._el('verdictBox').attr('data-tone', tone);
        this._el('error').prop('hidden', !err).text(err ? err : '');

        // Config the program actually ran with.
        var cfg = { sourceRoot: 'sourceRoot', pathTemplate: 'pathTemplate',
                    supervisorStation: 'supervisorStation', categoryMap: 'categoryMap' };
        Object.keys(cfg).forEach(function (k) {
          var v = '';
          try { v = String(text(comp.get(cfg[k])) || ''); } catch (e) { /* optional */ }
          self._el(k).text(v || '—');
        });
        var dry = '';
        try { dry = String(text(comp.get('dryRun'))); } catch (e) { /* optional */ }
        this._el('dryRun').text(dry === 'false' ? 'writes tags (dryRun=false)' : 'dry run only (dryRun=true)');

        this._paintReport(rep);
      }

      /** Colour-code the report: SET/PLAN lines, their -> target, DUP/SKIP/ABORT. */
      _paintReport(rep) {
        var lines = rep ? rep.split('\n') : [];
        var body = [];
        this._el('reportCount').text(lines.length ? '(' + lines.length + ' lines)' : '');
        for (var i = 0; i < lines.length; i++) {
          var L = lines[i];
          var cls = '';
          if (/^(SET|PLAN)\b/.test(L)) { cls = 'pe-r-set'; }
          else if (/^\s*->/.test(L)) { cls = 'pe-r-arrow'; }
          else if (/^(DUP|ABORTED)/.test(L)) { cls = 'pe-r-bad'; }
          else if (/^(SKIP|GUARD|REFUSED)/.test(L)) { cls = 'pe-r-warn'; }
          else if (/^(LIVE|DRY RUN)/.test(L)) { cls = 'pe-r-head'; }
          body.push(cls ? '<span class="' + cls + '">' + esc(L) + '</span>' : esc(L));
        }
        this._el('report').html(body.length ? body.join('\n') : 'no report yet');
      }

      /* ---------- live updates ---------- */

      _watch(comp) {
        var self = this;
        this._stopWatch();
        try {
          var Sub = baja.Subscriber;
          if (Sub) {
            var sub = new Sub();
            sub.attach('changed', function () { self._paint(self._comp); });
            this._poll = { stop: function () { try { sub.detach('changed'); } catch (e) {} } };
            console.debug('[point-tag-styler] subscribed to changes');
            return;
          }
        } catch (e) {
          console.debug('[point-tag-styler] subscriber unavailable, polling', e);
        }
        var id = setInterval(function () { if (self._comp) { self._paint(self._comp); } }, POLL_MS);
        this._poll = { stop: function () { clearInterval(id); } };
        this._el('live').attr('data-state', 'live').text('● polling');
      }

      _stopWatch() {
        if (this._poll && this._poll.stop) { try { this._poll.stop(); } catch (e) {} }
        this._poll = null;
      }

      /* ---------- actions ---------- */

      _bindActions() {
        var self = this;
        this._el('refresh').on('click', function () { self._load('refresh'); });
        this._el('run').on('click', function () {
          if (!self._armed) {
            self._armed = true;
            self._el('run').text('Confirm run').addClass('pe-btn-armed');
            self._note('click again within 5s — this writes tags');
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
        if (!this._comp) { this._note('not connected'); return; }
        this._el('run').prop('disabled', true);
        this._note('running…');
        try {
          var r = (typeof this._comp.invokeAction === 'function')
            ? this._comp.invokeAction('execute')
            : (typeof this._comp.invoke === 'function')
              ? this._comp.invoke('execute')
              : (function () { throw new Error('this build cannot invoke actions'); })();
          if (r && typeof r.then === 'function') {
            r.then(function () { self._afterRun('done'); },
                   function (e) { self._afterRun('failed: ' + msg(e)); });
          } else {
            self._afterRun('done');
          }
        } catch (e) {
          this._afterRun('failed: ' + msg(e));
        }
      }

      _afterRun(outcome) {
        this._el('run').prop('disabled', false);
        this._note(outcome);
        var self = this;
        setTimeout(function () { self._load('after-run'); }, 1500);
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
          self._el('pack').text('pack: copied by hand, not installed by PxViewSync');
        });
      }
    };

    function msg(err) {
      try { return (err && err.message) ? err.message : String(err); }
      catch (e) { return 'unknown error'; }
    }
  });
})();
