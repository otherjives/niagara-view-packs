# niagara-view-packs

Versioned browser view packs for Niagara program objects. A pack is plain HTML/CSS/JS —
no build step, no module, no license. A station-side program (`PxViewSync`) pulls a pack by
id into `shared/views/<id>/` and optionally binds it as the component's view.

## Layout

```
packs/<pxVersionedId>/
  widget.js     REQUIRED  AMD module exporting a bajaux Widget subclass
  widget.css    optional  injected by widget.js
  index.html    optional  standalone page (also the markup widget.js injects)
  assets/       optional  images/fonts, any depth
tools/check_pack.py       validates every pack (no network)
```

Id rules: `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`. No `@`, no spaces, no `..`.

**Packs are immutable.** Any change to a pack is a new directory (`demo-card-1.0.0` →
`demo-card-1.1.0`). The station skips a pack whose directory already has `widget.js`
unless the sync program's `force` slot is true.

**A pack never contains its own id.** `widget.js` derives its asset base from its own
`module.uri`, so the same directory works no matter what it is called or where it lands.

## Three ways a pack gets onto a screen

| Shape | Mechanism | Needs a px? |
|---|---|---|
| **A. Component view** | `baja:PxView` agent on the component → station-generated `view.px` containing `<WebWidget js="file:^views/<id>/widget.js"/>` | yes — generated, never authored |
| **B. Standalone page** | `/file/views/<id>/index.html?ord=slot:/Programs/MyProgram` | no |
| **C. Assets only** | `file:^views/<id>/…` referenced by something else | no |

Shape A is the only way for the pack to *be* the component's view — every stock Niagara
view agent (`BPxView`, `BDynamicPxView`) renders px, and there is no HTML view agent. The
px is six generated lines; authors never write one.

## How a pack learns which component it is on

`widget.js` resolves its target ORD in this order and never throws:

1. `?ord=…` query parameter (shape B — explicit, always wins)
2. **its own frame URL** — `/ord/<ord>|view:<name>?fullScreen=true` (the reliable channel)
3. the bound widget value (`this.value()` → `getNavOrd()`/`getOrd()`)
4. the parent frame URL / `document.referrer`
5. `station:|slot:/`

**Verified on 4.15.2.38 (2026-11-20):** in a component view, `this.value()` is the
**station**, not the component — `getNavOrd()` returns `station:`. So the frame URL is the
primary channel, and the bound value is only accepted when it is not the station root.
That is why packs must not trust `value()` alone.

## Authoring rules (learned the hard way)

- AMD `define([...], function(...))` — the module export **is** the widget constructor.
- Plain JS only: no build step on the file route, so JSX fails. Use DOM/strings.
- The `css!` plugin does **not** fetch `file:` ORDs — inject a `<link>` from `doInitialize`.
- `index.html` is not embeddable in a px (`file:` HTML → HTTP 400). It is the standalone
  page and the markup source the widget injects; scripts inside it do not run.
- One widget per DOM element; lifecycle `initialize → load → read/save → destroy`.

## Validate before pushing

```bash
python tools/check_pack.py     # → OK
```
