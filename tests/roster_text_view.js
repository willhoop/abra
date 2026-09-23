/* roster_text_view.js — the description view tests/roster.js reads its shape rules through. 2026-09-23.
 *
 * MOVED OUT OF tests/roster.js SO IT CAN BE TESTED WITHOUT LOADING THE ROSTER (tests/test-roster-text-view.js).
 *
 * WHY THE VIEW EXISTS (MEASURE, abra/regmc 0.40.0). The shape rules read `desc` / `shortDesc`, and the Reg M-C
 * checkout builds an Item / Move / Ability without its text; the text lives in `dex.loadTextData()`. So this
 * hands back a view of the same dex whose items / moves / abilities wrap an entity with no text of its own in a
 * Proxy that reads the text table's. The shared dex the battles use is not modified.
 *
 * AND WHY IT THREW ON REG M-B (2026-09-23). A Proxy's `get` may NOT report a value other than the target's own
 * for a property that is non-configurable and non-writable (ECMAScript [[Get]] invariant). Reg M-B's checkout
 * carries its sixteen Hidden Power typings (and Nihil Light) with `desc` / `shortDesc` as frozen own properties
 * holding '', while its text table holds a sentence for Hidden Power. The wrap fired, the first read threw
 * `'get' on proxy: property 'shortDesc' is a read-only and non-configurable data property ... expected '' but
 * got 'Var...'`, and every shape rule that walks `moves.all()` threw with it: Iron Fist, Mega Launcher, Reckless,
 * Sharpness, Strong Jaw, Technician and Tough Claws went COULD-NOT-STAGE on the ruler.
 *
 * THE GUARD: an entity whose `desc` or `shortDesc` is a frozen OWN property is left UNWRAPPED and reads what the
 * checkout declared on it — exactly what every Reg M-B run before 0.40.0 read. It is COUNTED (`kept`, per kind,
 * with the ids), because a guard that silently declined to fill text would look exactly like one that filled it.
 * An entity with no own text property (every Reg M-C entity, measured: none carries one) is wrapped as before. */
'use strict';

/* true when a Proxy could not legally report another value for `p` on `e` */
function pinned(e, p) {
  const d = Object.getOwnPropertyDescriptor(e, p);
  return !!(d && !d.configurable && 'value' in d && !d.writable);
}

function textView(dexRaw) {
  const filled = { items: 0, moves: 0, abilities: 0 };
  const kept = { items: [], moves: [], abilities: [] };
  const T = typeof dexRaw.loadTextData === 'function' ? dexRaw.loadTextData() : null;
  if (!T) return { dex: dexRaw, filled, kept };
  const view = Object.create(dexRaw);
  for (const [k, tab] of [['items', 'Items'], ['moves', 'Moves'], ['abilities', 'Abilities']]) {
    const raw = dexRaw[k], wrapped = new WeakMap(), keptSeen = new WeakSet();
    const wrap = (e) => {
      if (!e || typeof e !== 'object' || e.shortDesc || e.desc) return e;
      const t = (T[tab] || {})[e.id];
      if (!t || !(t.shortDesc || t.desc)) return e;
      if (pinned(e, 'desc') || pinned(e, 'shortDesc')) {
        if (!keptSeen.has(e)) { keptSeen.add(e); kept[k].push(e.id); }
        return e;
      }
      if (!wrapped.has(e)) {
        filled[k]++;
        /* THE NEWER TEXT WRITES A MULTIPLIER AS "1.5×" (U+00D7) WHERE THE OLDER WROTE "1.5x", which every rule
         * that reads a multiplier out of the prose matches on. The sign is normalised; nothing else is. */
        const norm = s => (s == null ? s : String(s).replace(/(\d)×/g, '$1x'));
        const d = norm(t.desc || t.shortDesc), sd = norm(t.shortDesc || t.desc);
        wrapped.set(e, new Proxy(e, { get: (o, p) => (p === 'desc' ? d : p === 'shortDesc' ? sd : o[p]) }));
      }
      return wrapped.get(e);
    };
    const tv = Object.create(raw);
    tv.get = (x) => wrap(raw.get(x));
    tv.all = () => raw.all().map(wrap);
    if (typeof raw.getByID === 'function') tv.getByID = (x) => wrap(raw.getByID(x));
    view[k] = tv;
  }
  return { dex: view, filled, kept };
}

module.exports = { textView, pinned };
