/* test-mc-seal.js — A WRONG SPELLING OF A SPECIES NAME CAN NO LONGER BE SILENT.
 *
 *   node tests/test-mc-seal.js
 *
 * WHY THIS IS A SECOND FILE AND NOT A SECTION OF tests/test-mc-key.js
 * ------------------------------------------------------------------
 * `tests/test-mc-key.js` is a STATIC check: it reads source text and bans shapes. It has been beaten
 * three times, each time by a shape nobody had thought to list — `buildMon(s.toLowerCase())` on
 * 2026-08-23, a bare `globalThis.` prefix in eight files the night after. That is not a bug in its
 * regexes. A list of wrong forms cannot catch a form nobody thought of, and no amount of care makes
 * it able to.
 *
 * This file asserts a RUNTIME guarantee instead, and a runtime guarantee has no list in it:
 *
 *   1. THE TABLE IS SEALED. `MC.mons` is a Proxy. Reading a key it does not have THROWS `LookupMiss`,
 *      naming the correct key when the miss is a spelling. There is no spelling, prefix, alias,
 *      concatenation or computed expression that avoids this, because the trap is on the OBJECT and
 *      every one of those forms ends in a property access on that object.
 *
 *   2. THE LOOKUP IS TOTAL. `buildMon` resolves through the table's own flattened index, so
 *      'Rotom-Wash', 'rotom-wash', 'Rotom Wash' and 'rotomwash' all build the SAME body. A spelling
 *      difference cannot lose a species, because spelling no longer decides anything.
 *
 * Together those two say: a name that IS in the table is found however it is spelled, and a name
 * that is NOT crashes at the call site instead of returning undefined. The four historical incidents
 * were all the second half — every one of them returned undefined or null and NOTHING THREW.
 *
 * ALL FIVE HISTORICAL INSTANCES ARE REPLAYED BELOW AS LIVE CODE, not as strings matched by a regex,
 * so this check cannot be quietly narrowed later: narrowing it means deleting an executable
 * assertion about a bug that really happened.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('MC SEAL — a wrong species spelling throws; a right one is found however it is written\n');

require(D('data', 'engine-data.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));

/* Which error came out, as a word. 'undefined' means the read succeeded and gave nothing back,
 * which for a miss is the entire defect this file exists to end. */
function verdict(fn) {
  try { const v = fn(); return v === undefined ? 'undefined' : (v === null ? 'null' : 'value'); }
  catch (e) { return e.name === 'LookupMiss' ? 'THROWS' : ('threw ' + e.name + ': ' + e.message.split('\n')[0]); }
}

/* ---- 1. THE SEAL IS INSTALLED ---------------------------------------------------------------- */
ok(!!(globalThis.MC && globalThis.MC.mons), 'MC.mons is published');
ok(typeof mcKey.sealed === 'function' && mcKey.sealed(),
  'MC.mons is SEALED — requiring engine/mc_key.js installs the trap, with no call needed');

/* ---- 2. A REAL KEY STILL READS, AND THE TABLE STILL BEHAVES LIKE AN OBJECT -------------------- */
ok(verdict(() => globalThis.MC.mons['rotom-wash']) === 'value', "MC.mons['rotom-wash'] still returns its row");
ok(Object.keys(globalThis.MC.mons).length > 300, 'enumeration still works (' + Object.keys(globalThis.MC.mons).length + ' keys)');
ok(('rotom-wash' in globalThis.MC.mons) && !('rotomwash' in globalThis.MC.mons),
  '`in` still answers membership WITHOUT throwing — the declared way to ask a raw question');
ok(JSON.stringify(globalThis.MC.mons).length > 1000, 'JSON.stringify walks the sealed table');
ok(verdict(() => globalThis.MC.mons.then) === 'undefined',
  'host probes (`then`, await, console.log) read undefined instead of throwing — otherwise a Promise resolution explodes');

/* ---- 3. A WRONG SPELLING THROWS, AND THE MESSAGE NAMES THE RIGHT KEY -------------------------- */
const spellings = ['rotomwash', 'venusaurmega', 'slowkinggalar', 'ninetalesalola', 'gourgeistsuper'];
for (const s of spellings) {
  ok(verdict(() => globalThis.MC.mons[s]) === 'THROWS',
    'MC.mons[' + JSON.stringify(s) + '] THROWS instead of returning undefined');
}
let named = '';
try { globalThis.MC.mons['venusaurmega']; } catch (e) { named = e.message; }
ok(/venusaur-mega/.test(named), 'the message NAMES the key the caller meant (venusaur-mega), so the fix is inside the error');
ok(/mcKey/.test(named), '...and names the one door, so the reader is told what to do instead');

/* A species that is genuinely in no table at all throws too — but a caller may DECLARE it. */
ok(verdict(() => globalThis.MC.mons['definitelynotapokemon']) === 'THROWS', 'a name that is in no table at all also throws');
ok(mcKey.row('definitelynotapokemon', { mayMiss: 'the probe asks for a name that does not exist' }) === null,
  'a DECLARED miss through the door still returns null — absence stays expressible');

/* ---- 4. THE LOOKUP IS TOTAL: SPELLING NO LONGER DECIDES ANYTHING ------------------------------ */
const MEDI = require(D('engine', 'medicham2-browser.js'));
const OPTS = { mayMiss: 'probe sweeps names that may be absent' };
const spelt = ['Rotom-Wash', 'rotom-wash', 'Rotom Wash', 'rotomwash', 'ROTOMWASH'];
const built = spelt.map(s => MEDI.buildMon(s, {}));
ok(built.every(b => b && b.st), 'buildMon builds a body from every spelling (' + spelt.join(', ') + ')');
ok(new Set(built.map(b => b && JSON.stringify(b.st))).size === 1, '...and every one of them is the SAME body');

/* The 2026-07-30 bug, as live code: a key built by concatenation with no hyphen. */
const cat = 'venusaur' + 'mega';
ok(!!MEDI.buildMon(cat, {}) && MEDI.buildMon(cat, {}).st.sa === MEDI.buildMon('venusaur-mega', {}).st.sa,
  "buildMon('venusaur'+'mega') builds the MEGA — the 2026-07-30 concatenation bug cannot recur");

/* The 2026-08-23 bug, as live code: every legal species FLATTENED before the call. */
require(D('engine', 'showdown_path.js'));
if (process.env.SHOWDOWN_PATH) {
  const CS = require(D('engine', 'champions_sim.js'));
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const legal = dex.species.all().filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal');
  const inTable = legal.filter(s => mcKey(s.name, OPTS));
  const dropped = inTable.filter(s => !MEDI.buildMon(String(s.name).toLowerCase().replace(/[^a-z0-9]/g, ''), {}));
  ok(dropped.length === 0,
    'every one of the ' + inTable.length + ' table-backed legal species survives a FLATTENED name '
    + '(dropped: ' + (dropped.slice(0, 4).map(s => s.name).join(', ') || 'none') + ') — the 2026-08-23 bug was 138 of 345');
} else {
  console.log('  (SHOWDOWN_PATH unset — the whole-dex flattened sweep did not run)');
}

/* ---- 5. THE PLANTED BREAKS ---------------------------------------------------------------------
 *
 * The two shapes that have actually beaten the static gate, EXECUTED rather than pattern-matched:
 * a bare `globalThis.` prefix, and the table aliased through a local variable. Plus a computed key,
 * a destructure, a template string and a Reflect.get, none of which appears in any list anywhere in
 * this repo. None is detectable by reading source text; all of them end in a property access, which
 * is exactly why the trap catches every one and a regex catches none. */
const PLANTED = [
  ['globalThis. prefix, a spelling on no list anywhere', () => globalThis.MC.mons['gyaradosmega']],
  ['aliased through a local variable', () => { const T = globalThis.MC.mons; return T['ninetalesalola']; }],
  ['aliased twice, through a function return', () => { const g = () => globalThis.MC; return g().mons['charizardmegay']; }],
  ['a key built at run time by concatenation', () => { const k = 'slowking' + 'galar'; return globalThis.MC.mons[k]; }],
  ['destructured straight off the table', () => { const { toxtricitylowkey } = globalThis.MC.mons; return toxtricitylowkey; }],
  ['a template string', () => { const f = 'wash'; return globalThis.MC.mons[`rotom${f}`]; }],
  ['Reflect.get, bypassing the syntax entirely', () => Reflect.get(globalThis.MC.mons, 'urshifurapidstrike')],
];
for (const [name, fn] of PLANTED) ok(verdict(fn) === 'THROWS', 'PLANTED BREAK caught: ' + name);

/* ---- 6. ALL FIVE HISTORICAL INSTANCES, AS LIVE CODE ------------------------------------------- */
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const HISTORY = [
  ['THROWS', 'board.js 2026-08-01 — MC.mons[norm(x)], 101 of 308 keys unreachable',
    () => globalThis.MC.mons[norm('Rotom-Wash')]],
  ['THROWS', 'backtest_winrate.js 2026-08-01 — .filter(n => MC.mons[n]) silently dropped every forme team',
    () => ['charizard', 'rotomwash'].filter(n => globalThis.MC.mons[n])],
  ['THROWS', 'forced_switch_audit.js 2026-08-01 — MC.mons[norm(species)] || null for every forme',
    () => globalThis.MC.mons[norm('Slowking-Galar')] || null],
  /* THIS ONE MUST SUCCEED, and that difference is the whole design. The other four are RAW TABLE
   * reads and the fix is that they crash. This one is the RESOLVER's own door, and the fix there is
   * TOTALITY — if it threw, the species would still be lost, just noisily. Asserting all five with
   * one expected verdict would hide exactly that. */
  ['value', 'test-engine-diff.js 2026-08-23 — buildMon(s.toLowerCase()) dropped 138 of 345 species',
    () => MEDI.buildMon('Rotom-Wash'.toLowerCase(), {})],
  ['THROWS', 'test-rollout-seed.js 2026-08-23 — .map(s => s.id).filter(id => globalThis.MC.mons[id])',
    () => ['rotomwash'].map(x => x).filter(id => globalThis.MC.mons[id])],
];
for (const [want, name, fn] of HISTORY) ok(verdict(fn) === want, 'HISTORY (' + want + '): ' + name);

/* ---- 7. THE COST -------------------------------------------------------------------------------
 * A Proxy on a shared table is only acceptable if it is not on a hot path, and "not on a hot path"
 * is a measurement rather than an opinion. */
const raw = mcKey.rawTable('the cost probe times the sealed read against the unsealed one');
const N = 200000, k = 'rotom-wash';
let acc = 0;
let t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) acc += raw[k].st.sp;
const bare = Number(process.hrtime.bigint() - t0) / 1e6;
t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) acc += globalThis.MC.mons[k].st.sp;
const sealed = Number(process.hrtime.bigint() - t0) / 1e6;
console.log('\n  cost: ' + N + ' reads — raw ' + bare.toFixed(1) + ' ms, sealed ' + sealed.toFixed(1) + ' ms ('
  + ((sealed - bare) / N * 1e6).toFixed(0) + ' ns per read added). checksum ' + (acc > 0 ? 'ok' : 'ZERO'));
ok(sealed / N * 1e6 < 2000,
  'the seal costs under 2 us per read (' + (sealed / N * 1e6).toFixed(0) + ' ns) — and buildMon reads it ONCE PER BODY, not per turn');

console.log('\nMC SEAL TESTS: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
