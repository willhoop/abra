/* test-roster-text-view.js — the roster's description view must survive a checkout whose text is a FROZEN own
 * property, and must still fill text where the entity carries none. 2026-09-23. No game is played.
 *
 * THE CASE (derived below, not typed): Reg M-B's checkout carries entities whose `desc` / `shortDesc` are
 * non-configurable, non-writable own properties holding '' while `loadTextData()` holds a sentence for them. A
 * Proxy may not report a different value for such a property, so the 0.40.0 view threw on the first read and
 * took seven ability rows of tests/roster.js to COULD-NOT-STAGE with it.
 *
 *   A  the case EXISTS in the selected checkout (else this test would be asking nothing), and a naive Proxy over
 *      one of them really does throw — the control, so the guard is shown to be needed, not assumed
 *   B  through tests/roster_text_view.js every item / move / ability in the dex reads `desc` and `shortDesc`
 *      without throwing, and `moves.all()` walks — the exact thing the seven shape rules do
 *   C  each such entity is left unwrapped, reads the value the checkout declared, and is COUNTED in `kept`
 *   D  the fill path still works: a frozen entity with NO own text property is wrapped and reads the table's
 *      text, with the U+00D7 multiplier normalised — a synthetic dex, so the check does not need the M-C checkout
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
const { textView, pinned } = require(D('tests', 'roster_text_view.js'));

let fails = 0;
const ok = (c, msg) => { console.log('  ' + (c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };

console.log('\nTHE ROSTER TEXT VIEW');

/* D first: it needs no simulator */
{
  const e = Object.freeze({ id: 'fakeitem', name: 'Fake Item', exists: true });
  const raw = { get: () => e, all: () => [e] };
  const fakeDex = { loadTextData: () => ({ Items: { fakeitem: { shortDesc: 'Holder\'s Attack is 1.5× .' } }, Moves: {}, Abilities: {} }),
                    items: raw, moves: { get: () => null, all: () => [] }, abilities: { get: () => null, all: () => [] } };
  const V = textView(fakeDex);
  const got = V.dex.items.get('fakeitem');
  ok(got !== e && got.shortDesc === 'Holder\'s Attack is 1.5x .' && got.name === 'Fake Item' && V.filled.items === 1,
     'D  a frozen entity with no own text is wrapped, reads the table\'s text (x normalised) and is counted filled');
}

const { hasSim } = require(D('engine', 'showdown_path.js'));
if (!hasSim()) { console.log('  NOT RUN (A-C) — the official simulator is absent. This is not a pass.'); process.exit(2); }
const CS = require(D('engine', 'champions_sim.js'));
const dexRaw = CS.sim().Dex.forFormat(CS.FORMAT);
const T = dexRaw.loadTextData();
const TAB = { items: 'Items', moves: 'Moves', abilities: 'Abilities' };
const cases = [];
for (const k of Object.keys(TAB)) for (const e of dexRaw[k].all()) {
  if (e.shortDesc || e.desc) continue;
  const t = (T[TAB[k]] || {})[e.id];
  if (t && (t.shortDesc || t.desc) && (pinned(e, 'desc') || pinned(e, 'shortDesc'))) cases.push([k, e]);
}
console.log('  format ' + CS.FORMAT + ': ' + cases.length + ' entit(ies) with frozen empty text and a text-table sentence');

if (!cases.length) {
  /* A checkout without the case (the Reg M-C one, measured) cannot exercise A-C. Said, not passed silently. */
  console.log('  A-C NOT APPLICABLE to this checkout — it carries no frozen text property. Run under Reg M-B for the case.');
} else {
  const [k0, e0] = cases[0];
  const t0 = T[TAB[k0]][e0.id];
  let threw = null;
  try { void new Proxy(e0, { get: (o, p) => (p === 'shortDesc' ? (t0.shortDesc || t0.desc) : o[p]) }).shortDesc; }
  catch (err) { threw = err.message; }
  ok(!!threw, 'A  control: a naive Proxy over ' + k0 + ' ' + e0.id + ' throws (' + String(threw).slice(0, 70) + '...)');

  const V = textView(dexRaw);
  let err = null, n = 0;
  try {
    for (const k of Object.keys(TAB)) for (const e of V.dex[k].all()) { void e.desc; void e.shortDesc; n++; }
    for (const [k, e] of cases) { const g = V.dex[k].get(e.id); void g.shortDesc; }
  } catch (x) { err = x.message; }
  ok(!err, 'B  ' + n + ' entities read desc/shortDesc through the view without throwing' + (err ? ': ' + err : ''));
  /* compared through `all()`, index for index: the sixteen Hidden Power typings share the id `hiddenpower`, so
   * `get(e.id)` hands back the untyped move, which carries its own text and is not the case */
  const same = cases.every(([k, e]) => { const i = dexRaw[k].all().indexOf(e); const g = V.dex[k].all()[i];
    return g === e && g.shortDesc === e.shortDesc && g.desc === e.desc; });
  ok(same, 'C  every frozen-text entity is handed back unwrapped and reads what the checkout declared on it');
  const keptN = Object.values(V.kept).reduce((a, b) => a + b.length, 0);
  ok(keptN > 0 && cases.every(([k, e]) => V.kept[k].includes(e.id)),
     'C  and is counted in `kept` (' + JSON.stringify(Object.fromEntries(Object.entries(V.kept).map(([k, v]) => [k, v.length]))) + ')');
}

console.log(fails ? '\n  RED — ' + fails + ' clause(s) failed' : '\n  GREEN');
process.exit(fails ? 1 : 0);
