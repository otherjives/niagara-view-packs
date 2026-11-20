/* point-tag-styler 2.0.0 — reading view for the PointTagStyler program object.
 *
 * SELF-CONTAINED BY DESIGN. Everything (markup + CSS) is in this one file, so the
 * view does not fetch index.html/widget.css at runtime. A px WebWidget in some
 * renderers (notably Workbench, which can resolve file:^ to a local path) runs
 * under a file:// origin where XHR to sibling files is blocked — that made the
 * 1.x pack render nothing. No fetch, nothing to block.
 *
 * API used (all probed against 4.15.2.38, not guessed):
 *   comp.getSlots().$keys      -> full slot-name list
 *   comp.get(name)             -> value (primitives come back as JS primitives)
 *   comp.getSlot(name).$setValue(v) -> WRITE a slot (dry-run toggle)
 *   comp.invoke('execute')     -> run the program
 *
 * Buttons:
 *   Dry run — sets dryRun true, runs, restores the slot. Writes nothing.
 *   Apply   — sets dryRun false, runs (arm/confirm). This stamps tags.
 */
(function () {
  'use strict';
  if (typeof define !== 'function') { return; }   // standalone page renders index.html

  define(['module', 'baja!', 'bajaux/Widget', 'jquery'],
  function (module, baja, Widget, $) {

    var CSS = [
      '.pts{--fg:#1d2129;--mut:#6b7280;--line:#e4e7ec;--bg:#fff;--soft:#f7f8fa;--acc:#2f5d8a;--warn:#a4441f;--ok:#2f7d4f;',
      'box-sizing:border-box;height:100%;overflow:auto;padding:18px 20px 26px;background:var(--bg);color:var(--fg);',
      'font:14px/1.5 system-ui,"Segoe UI",Roboto,sans-serif}',
      '.pts *{box-sizing:border-box}',
      '.pts-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--line)}',
      '.pts-name{margin:0 0 4px;font-size:20px;font-weight:650;letter-spacing:-.01em}',
      '.pts-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--mut);font-size:12.5px}',
      '.pts-kind{text-transform:uppercase;letter-spacing:.06em;font-size:11px;font-weight:600;color:var(--acc)}',
      '.pts-ord{font:12px ui-monospace,Consolas,monospace;background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:2px 6px;word-break:break-all}',
      '.pts-acts{display:flex;align-items:center;gap:10px;flex:0 0 auto}',
      '.pts-live{color:var(--ok);font-size:11.5px;font-weight:600}',
      '.pts-live[data-s="stale"]{color:var(--mut)}.pts-live[data-s="down"]{color:var(--warn)}',
      '.pts-btn{appearance:none;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:7px;padding:6px 12px;font:13px system-ui,"Segoe UI",Roboto,sans-serif;cursor:pointer}',
      '.pts-btn:hover{background:var(--soft)}.pts-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.pts-primary{border-color:var(--acc);background:var(--acc);color:#fff}.pts-primary:hover{background:#274d73}',
      '.pts-arm{border-color:var(--warn);background:var(--warn);color:#fff}.pts-arm:hover{background:#8d3919}',
      '.pts-card{margin-top:16px;padding:14px 16px;border:1px solid var(--line);border-radius:10px}',
      '.pts-card h2{margin:0 0 10px;font-size:12px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);display:flex;gap:8px;align-items:baseline}',
      '.pts-n{font-weight:500;letter-spacing:0;text-transform:none}',
      '.pts-hint{margin:0 0 10px;color:var(--mut);font-size:12.5px}',
      '.pts-verdict{display:flex;align-items:center;gap:10px;margin-top:16px;padding:11px 14px;border:1px solid var(--line);border-left:3px solid var(--line);border-radius:8px;background:var(--soft)}',
      '.pts-verdict[data-tone="ok"]{border-left-color:var(--ok);background:#eaf5ee}',
      '.pts-verdict[data-tone="dry"]{border-left-color:var(--warn);background:#fdf3e7}',
      '.pts-verdict[data-tone="bad"]{border-left-color:var(--warn);background:#fbeeea}',
      '.pts-badge{flex:0 0 auto;padding:2px 8px;border-radius:4px;background:var(--fg);color:var(--bg);font:600 10.5px/1.6 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}',
      '.pts-badge[data-mode="dry"]{background:var(--warn);color:#fff}',
      '.pts-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:10px}',
      '.pts-tile{padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--soft)}',
      '.pts-tile b{display:block;font-size:22px;font-weight:650;font-variant-numeric:tabular-nums;line-height:1.2}',
      '.pts-tile i{display:block;margin-top:2px;font-style:normal;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}',
      '.pts-tile[data-warn="1"] b{color:var(--warn)}',
      '.pts-tile.sm b{font-size:17px}',
      '.pts-grid2{margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}',
      '.pts-err{margin:12px 0 0;padding:8px 10px;border-left:3px solid var(--warn);background:#fbeeea;border-radius:0 6px 6px 0;color:var(--warn);font:12px ui-monospace,Consolas,monospace;white-space:pre-wrap}',
      '.pts-run{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap}',
      '.pts-note{color:var(--mut);font-size:12px}',
      '.pts-table{width:100%;border-collapse:collapse;font-size:13px}',
      '.pts-table th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);font-weight:600;padding:0 10px 6px 0;border-bottom:1px solid var(--line);white-space:nowrap}',
      '.pts-table td{padding:7px 10px 7px 0;border-bottom:1px solid #f0f2f5;vertical-align:top;word-break:break-word}',
      '.pts-table tr:last-child td{border-bottom:0}',
      '.pts-table code{font:12px ui-monospace,Consolas,monospace}',
      '.pts-kv th{width:1%;white-space:nowrap;text-transform:none;letter-spacing:0;font-size:12.5px;color:var(--mut);font-weight:500}',
      '.pts-pre{margin:0;padding:10px 12px;max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--soft);font:11.5px/1.55 ui-monospace,Consolas,monospace;white-space:pre}',
      '.pts-pre.wrap{white-space:pre-wrap;word-break:break-word}',
      '.pts-set{font-weight:600}.pts-arrow{color:var(--acc)}.pts-bad{color:var(--warn);font-weight:600}.pts-warn{color:var(--warn)}.pts-head-r{font-weight:650}',
      '.pts-foot{margin-top:18px;padding-top:12px;border-top:1px solid var(--line);color:var(--mut);font-size:11.5px}',
      '.pts-sep{padding:0 6px;color:var(--line)}',
      '@media (prefers-color-scheme:dark){.pts{--fg:#e6e8eb;--mut:#9aa2ad;--line:#2c3138;--bg:#171a1f;--soft:#1e222a;--acc:#7aa7d4;--warn:#e08a63;--ok:#6fbf8f}',
      '.pts-verdict[data-tone="ok"]{background:#16251c}.pts-verdict[data-tone="dry"]{background:#2a2114}.pts-verdict[data-tone="bad"]{background:#2a1a14}',
      '.pts-badge{background:#cfd6de;color:#10141a}.pts-badge[data-mode="dry"]{background:var(--warn);color:#10141a}',
      '.pts-err{background:#2a1a14}.pts-primary{color:#10141a}.pts-table td{border-bottom-color:#23272e}}'
    ].join('');

    var MARKUP = [
      '<div class="pts">',
      '<div class="pts-head"><div>',
      '<h1 class="pts-name" data-p="name">…</h1>',
      '<div class="pts-sub"><span class="pts-kind" data-p="kind">program</span><span>·</span>',
      '<code class="pts-ord" data-p="ord"></code></div></div>',
      '<div class="pts-acts"><span class="pts-live" data-p="live">● reading</span>',
      '<button class="pts-btn" data-p="refresh" type="button">Refresh</button></div></div>',

      '<div class="pts-verdict" data-p="vbox"><span class="pts-badge" data-p="mode">—</span>',
      '<span data-p="verdict">reading…</span></div>',

      '<div class="pts-card"><h2>Last run</h2>',
      '<div class="pts-tiles" data-p="tiles">',
      '<div class="pts-tile"><b data-p="points">–</b><i>points</i></div>',
      '<div class="pts-tile"><b data-p="matched">–</b><i>matched</i></div>',
      '<div class="pts-tile" data-warn="1"><b data-p="unmatched">–</b><i>unmatched</i></div>',
      '<div class="pts-tile" data-warn="1"><b data-p="skipped">–</b><i>skipped</i></div>',
      '<div class="pts-tile" data-warn="1"><b data-p="dups">–</b><i>duplicates</i></div></div>',
      '<div class="pts-tiles pts-grid2" data-p="writes">',
      '<div class="pts-tile sm"><b data-p="created">–</b><i>created</i></div>',
      '<div class="pts-tile sm"><b data-p="retargeted">–</b><i>retargeted</i></div>',
      '<div class="pts-tile sm"><b data-p="unchanged">–</b><i>unchanged</i></div></div>',
      '<p class="pts-err" data-p="error" hidden></p>',
      '<div class="pts-run">',
      '<button class="pts-btn" data-p="dry" type="button">Dry run</button>',
      '<button class="pts-btn pts-primary" data-p="apply" type="button">Apply</button>',
      '<span class="pts-note" data-p="note"></span></div></div>',

      '<div class="pts-card"><h2>Formatting rules</h2>',
      '<p class="pts-hint">What this program was told to do on its last run.</p>',
      '<table class="pts-table pts-kv"><tbody>',
      '<tr><th>Source root</th><td><code data-p="sourceRoot"></code></td></tr>',
      '<tr><th>Target template</th><td><code data-p="pathTemplate"></code></td></tr>',
      '<tr><th>Supervisor</th><td><code data-p="supervisorStation"></code></td></tr>',
      '<tr><th>Category map</th><td><code data-p="categoryMap"></code></td></tr>',
      '<tr><th>dryRun slot</th><td><span data-p="dryRun"></span></td></tr>',
      '</tbody></table></div>',

      '<div class="pts-card"><h2>Unmatched <span class="pts-n" data-p="unmatchedN"></span></h2>',
      '<p class="pts-hint">Points the formatter refused, and why. Nothing is written for these.</p>',
      '<table class="pts-table"><thead><tr><th>Reason</th><th>Count</th><th>Example</th></tr></thead>',
      '<tbody data-p="reasons"><tr><td colspan="3">—</td></tr></tbody></table></div>',

      '<div class="pts-card"><h2>Report <span class="pts-n" data-p="reportN"></span></h2>',
      '<p class="pts-hint">Every point it touched: source point, then the export path stamped on it.</p>',
      '<pre class="pts-pre" data-p="report">no report yet</pre></div>',

      '<div class="pts-card"><h2>All slots <span class="pts-n" data-p="slotN"></span></h2>',
      '<p class="pts-hint">Every slot on the component, read live. Long values are collapsed.</p>',
      '<table class="pts-table"><thead><tr><th>Slot</th><th>Value</th></tr></thead>',
      '<tbody data-p="slots"><tr><td colspan="2">reading…</td></tr></tbody></table></div>',

      '<div class="pts-foot"><span data-p="pack">pack: unknown</span><span class="pts-sep">·</span>',
      '<span>served from the station file space</span></div>',
      '</div>'
    ].join('');

    var HEAD = /(DRY RUN|LIVE)\s*[-–]\s*points=(\d+)\s+matched=(\d+)\s+unmatched=(\d+)\s+skipped=(\d+)\s+dups=(\d+)/;
    var WRITES = /created=(\d+)\s+retargeted=(\d+)\s+unchanged=(\d+)/;

    var text = function (v) {
      if (v === null || v === undefined) { return ''; }
      try {
        if (typeof v.getValue === 'function') { return v.getValue(); }
        if (typeof v.getString === 'function') { return v.getString(); }
      } catch (e) { /* primitive */ }
      return String(v);
    };

    var esc = function (x) {
      return String(x === null || x === undefined ? '' : x)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    return class PointTagStylerView2 extends Widget {

      constructor(params) { super({ params, defaults: { properties: { rootCssClass: 'pts' } } }); }

      doInitialize(dom) {
        this._dom = dom;
        this._comp = null;
        this._poll = null;
        this._injectCss();
        dom.html(MARKUP);
        this._target = this._resolveTargetOrd();
        this._paintIdentity();
        this._bind();
        this._load('initial');
        this._provenance();
      }

      doDestroy() { this._stopWatch(); }

      _injectCss() {
        var id = 'pts-css';
        if (document.getElementById(id)) { return; }
        $('<style type="text/css">').attr('id', id).text(CSS).appendTo('head');
      }

      _el(k) { return this.jq().find('[data-p="' + k + '"]'); }

      /* ?ord= → own frame URL → parent frame URL → bound value → station root.
         Every step is logged so a wrong target is diagnosable, not mysterious. */
      _resolveTargetOrd() {
        var q = /[?&]ord=([^&]+)/.exec(window.location.search || '');
        if (q) { return this._pick('ord param', decodeURIComponent(q[1])); }

        var own = this._ordFromUrl(window.location.href);
        if (own) { return this._pick('frame url', own); }

        try {
          var par = window.parent && window.parent !== window ? window.parent.location.href : null;
          var p = this._ordFromUrl(par);
          if (p) { return this._pick('parent frame', p); }
        } catch (e) { /* cross-origin */ }

        try {
          var v = this.value && this.value();
          if (v) {
            var o = (typeof v.getNavOrd === 'function') ? v.getNavOrd()
                  : (typeof v.getOrd === 'function')    ? v.getOrd() : null;
            if (o) {
              var s = String(o);
              if (s && s !== 'station' && s !== 'station:') { return this._pick('bound value', s); }
            }
          }
        } catch (e) { /* no bound value */ }

        return this._pick('FALLBACK station root', 'station:|slot:/');
      }

      _pick(how, ord) {
        console.debug('[point-tag-styler] target via ' + how + ' -> ' + ord);
        return ord;
      }

      _ordFromUrl(href) {
        if (!href) { return null; }
        var d = href;
        try { d = decodeURIComponent(href); } catch (e) { /* raw */ }
        var m = /\/ord\/(.+?)\|view:/.exec(d);
        if (m) { return m[1]; }
        var m2 = /\/ord\/([^?#]+)/.exec(d);
        return m2 ? m2[1] : null;
      }

      _paintIdentity() {
        this._el('ord').text(this._target);
        this._el('name').text(this._target.split('/').pop() || 'program');
      }

      /* ---------- load ---------- */

      _load(why) {
        var self = this;
        this._el('live').attr('data-s', 'stale').text('● reading');
        baja.Ord.make(this._target).resolve({ lease: true })
          .then(function (t) { return t.getComponent(); })
          .then(function (comp) {
            self._comp = comp;
            self._paint(comp);
            self._el('live').attr('data-s', 'live').text('● live');
            console.debug('[point-tag-styler] loaded (' + why + ')', self._target);
            self._watch(comp);
          })
          .catch(function (err) {
            self._el('live').attr('data-s', 'down').text('● no data');
            self._el('vbox').attr('data-tone', 'bad');
            self._el('verdict').text('Cannot resolve ' + self._target + ' — ' + self._msg(err));
            self._el('slots').html('<tr><td colspan="2">' + esc(self._msg(err)) + '</td></tr>');
            console.debug('[point-tag-styler] resolve failed', err);
          });
      }

      _paint(comp) {
        var self = this;
        var g = function (k) { try { return text(comp.get(k)); } catch (e) { return ''; } };
        var set = function (k, v) { self._el(k).text(v === null || v === undefined ? '–' : v); };

        try { if (typeof comp.getName === 'function') { this._el('name').text(comp.getName()); } } catch (e) {}
        try {
          if (typeof comp.getType === 'function') {
            this._el('kind').text(String(comp.getType()).replace(/^.*?:/, ''));
          }
        } catch (e) {}

        var rep = g('report');
        var ok = String(g('ok')).toLowerCase() !== 'false';
        var err = g('error');
        var h = HEAD.exec(rep);
        var w = WRITES.exec(rep);

        if (h) {
          this._el('mode').attr('data-mode', h[1] === 'LIVE' ? 'live' : 'dry').text(h[1]);
          set('points', h[2]); set('matched', h[3]); set('unmatched', h[4]); set('skipped', h[5]); set('dups', h[6]);
        } else {
          ['points', 'matched', 'unmatched', 'skipped', 'dups'].forEach(function (k) { set(k, null); });
          this._el('mode').attr('data-mode', 'none').text('—');
        }
        if (w) { set('created', w[1]); set('retargeted', w[2]); set('unchanged', w[3]); }
        else { ['created', 'retargeted', 'unchanged'].forEach(function (k) { set(k, null); }); }
        this._el('writes').css('display', w && h && h[1] === 'LIVE' ? '' : 'none');

        var verdict, tone;
        if (!ok && err) { verdict = 'Aborted — nothing was written. ' + err; tone = 'bad'; }
        else if (!h) { verdict = 'No report yet — this program has not run on this station.'; tone = 'idle'; }
        else if (h[1] === 'LIVE') { verdict = 'Live run — ' + h[3] + ' of ' + h[2] + ' points stamped, station saved.'; tone = 'ok'; }
        else { verdict = 'Dry run — ' + h[3] + ' of ' + h[2] + ' points would be stamped. Nothing written.'; tone = 'dry'; }
        this._el('verdict').text(verdict);
        this._el('vbox').attr('data-tone', tone);
        this._el('error').prop('hidden', !err).text(err || '');

        this._el('sourceRoot').text(g('sourceRoot') || '—');
        this._el('pathTemplate').text(g('pathTemplate') || '—');
        this._el('supervisorStation').text(g('supervisorStation') || '—');
        this._el('categoryMap').text(g('categoryMap') || '—');
        var dry = g('dryRun');
        this._el('dryRun').text(dry === 'true' ? 'true — next run writes nothing' : 'false — next run writes tags');

        this._paintReasons(rep);
        this._paintReport(rep);
        this._paintSlots(comp);
      }

      /** UNMATCHED blocks carry "reason :: ord" — tally them, that's the actionable bit. */
      _paintReasons(rep) {
        var seen = {}, order = [];
        var lines = (rep || '').split('\n');
        for (var i = 0; i < lines.length; i++) {
          var m = /^\s{2,}([a-z0-9()\-]+)\s+::\s+(.+)$/.exec(lines[i]);
          if (!m) { continue; }
          var k = m[1];
          if (!seen[k]) { seen[k] = { n: 0, ex: m[2].trim() }; order.push(k); }
          seen[k].n++;
        }
        var self = this;
        var rows = order.map(function (k) {
          return '<tr><td><code>' + esc(k) + '</code></td><td>' + seen[k].n + '</td>'
               + '<td><code>' + esc(seen[k].ex) + '</code></td></tr>';
        });
        this._el('unmatchedN').text(order.length ? '(' + order.length + ' reasons)' : '');
        this._el('reasons').html(rows.length ? rows.join('') : '<tr><td colspan="3">none</td></tr>');
      }

      _paintReport(rep) {
        var lines = rep ? rep.split('\n') : [];
        var out = [];
        for (var i = 0; i < lines.length; i++) {
          var L = lines[i], cls = '';
          if (/^(SET|PLAN)\b/.test(L)) { cls = 'pts-set'; }
          else if (/^\s*->/.test(L)) { cls = 'pts-arrow'; }
          else if (/^(DUP|ABORTED)/.test(L)) { cls = 'pts-bad'; }
          else if (/^(SKIP|UNMATCHED|SKIPPED|no-)/.test(L)) { cls = 'pts-warn'; }
          else if (/^(LIVE|DRY RUN)/.test(L)) { cls = 'pts-head-r'; }
          out.push(cls ? '<span class="' + cls + '">' + esc(L) + '</span>' : esc(L));
        }
        this._el('reportN').text(lines.length ? '(' + lines.length + ' lines)' : '');
        this._el('report').html(out.length ? out.join('\n') : 'no report yet');
      }

      /** Full slot enumeration — the thing 1.x could not do. */
      _paintSlots(comp) {
        var names = [];
        try {
          var ks = comp.getSlots() && comp.getSlots().$keys;
          names = Array.isArray(ks) ? ks.slice() : (ks ? Object.keys(ks) : []);
        } catch (e) { console.debug('[point-tag-styler] getSlots failed', e); }

        var rows = [];
        for (var i = 0; i < names.length; i++) {
          var n = String(names[i]), v = '';
          try { v = String(text(comp.get(n))); } catch (e) { v = '(unreadable)'; }
          var shown = v.length > 180 ? v.slice(0, 180) + '… (' + v.length + ' chars)' : v;
          if (n === 'code' && v) {
            rows.push('<tr><td><code>' + esc(n) + '</code></td><td><details><summary>'
              + v.length + ' chars of Java</summary><pre class="pts-pre wrap">' + esc(v) + '</pre></details></td></tr>');
          } else {
            rows.push('<tr><td><code>' + esc(n) + '</code></td><td>' + esc(shown) + '</td></tr>');
          }
        }
        this._el('slotN').text(names.length ? '(' + names.length + ')' : '');
        this._el('slots').html(rows.length ? rows.join('')
          : '<tr><td colspan="2">this build cannot enumerate slots</td></tr>');
      }

      /* ---------- live ---------- */

      _watch(comp) {
        var self = this;
        this._stopWatch();
        try {
          if (baja.Subscriber) {
            var sub = new baja.Subscriber();
            sub.attach('changed', function () { self._paint(self._comp); });
            this._poll = { stop: function () { try { sub.detach('changed'); } catch (e) {} } };
            return;
          }
        } catch (e) { console.debug('[point-tag-styler] subscriber unavailable, polling', e); }
        var id = setInterval(function () { if (self._comp) { self._paint(self._comp); } }, 10000);
        this._poll = { stop: function () { clearInterval(id); } };
        this._el('live').attr('data-s', 'live').text('● polling');
      }

      _stopWatch() {
        if (this._poll && this._poll.stop) { try { this._poll.stop(); } catch (e) {} }
        this._poll = null;
      }

      /* ---------- actions ---------- */

      _bind() {
        var self = this;
        this._el('refresh').on('click', function () { self._load('refresh'); });
        this._el('dry').on('click', function () { self._dry(); });
        this._el('apply').on('click', function () {
          if (!self._armed) {
            self._armed = true;
            self._el('apply').text('Confirm apply').addClass('pts-arm');
            self._note('click again within 5s — this writes tags');
            clearTimeout(self._armT);
            self._armT = setTimeout(function () { self._disarm(); }, 5000);
            return;
          }
          self._disarm();
          self._apply();
        });
      }

      _disarm() {
        clearTimeout(this._armT);
        this._armed = false;
        this._el('apply').text('Apply').removeClass('pts-arm');
        this._note('');
      }

      _note(s) { this._el('note').text(s || ''); }

      _setDry(v) {
        var s = this._comp.getSlot('dryRun');
        var r = s.$setValue(v);
        return (r && r.then) ? r : Promise.resolve();
      }

      /** invoke() is fire-and-forget (returns undefined), so the only way to know
       *  the program has finished is to watch its report slot change. Without
       *  this, restoring dryRun raced the run and the program read it back as
       *  false — producing a LIVE run from a "dry" click. */
      _waitReport(before, ms) {
        var self = this;
        var t0 = Date.now();
        return new Promise(function (resolve) {
          var tick = function () {
            var now = '';
            try { now = String(text(self._comp.get('report'))); } catch (e) { /* gone */ }
            if (now !== before || Date.now() - t0 > ms) { return resolve(now); }
            setTimeout(tick, 250);
          };
          setTimeout(tick, 250);
        });
      }

      _report() {
        try { return String(text(this._comp.get('report'))); } catch (e) { return ''; }
      }

      /** Dry run: flip the slot, run, wait for it to finish, put the slot back. */
      _dry() {
        var self = this;
        if (!this._comp) { return this._note('not connected'); }
        this._note('running dry…');
        this._el('dry').prop('disabled', true);
        var before = this._report();
        this._setDry(true)
          .then(function () { return self._comp.invoke('execute'); })
          .then(function () { return self._waitReport(before, 20000); })
          .then(function () { return self._setDry(false); })
          .then(function () {
            self._note(self._report().indexOf('DRY RUN') === 0
              ? 'dry run complete — nothing written'
              : 'ran, but the program did not report DRY RUN');
            self._after();
          })
          .catch(function (e) {
            self._setDry(false).then(function () {
              self._note('dry run failed: ' + self._msg(e));
              self._el('dry').prop('disabled', false);
            });
          });
      }

      /** Apply: dryRun=false then run, waiting for completion. Writes tags. */
      _apply() {
        var self = this;
        if (!this._comp) { return this._note('not connected'); }
        this._note('applying…');
        this._el('apply').prop('disabled', true);
        var before = this._report();
        this._setDry(false)
          .then(function () { return self._comp.invoke('execute'); })
          .then(function () { return self._waitReport(before, 30000); })
          .then(function () { self._note('applied'); self._after(); })
          .catch(function (e) {
            self._note('apply failed: ' + self._msg(e));
            self._el('apply').prop('disabled', false);
          });
      }

      _after() {
        var self = this;
        setTimeout(function () {
          self._el('dry').prop('disabled', false);
          self._el('apply').prop('disabled', false);
          if (self._comp) { self._paint(self._comp); }
        }, 1200);
      }

      /* ---------- provenance ---------- */

      _provenance() {
        var self = this;
        $.get((module.uri || '').replace(/[^\/]*$/, '') + '_install.txt').done(function (t) {
          var id = (/^id=(.*)$/m.exec(t) || [])[1] || 'unknown';
          var sha = (/^commit=(.*)$/m.exec(t) || [])[1] || '';
          var stamp = (/^installed=(.*)$/m.exec(t) || [])[1] || '';
          self._el('pack').text('pack ' + id + (sha ? ' @ ' + sha.slice(0, 10) : '') + (stamp ? ' · ' + stamp : ''));
        }).fail(function () {
          self._el('pack').text('pack: copied by hand, not installed by PxViewSync');
        });
      }

      _msg(err) {
        try { return (err && err.message) ? err.message : String(err); } catch (e) { return 'unknown error'; }
      }
    };
  });
})();
