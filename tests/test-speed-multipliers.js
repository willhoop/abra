/* test-speed-multipliers.js — medicham2's speed constants must agree with the dex.
 *
 * WHY THIS EXISTS (systems audit, 2026-07-31, finding R2 — "the real divergence: speed multipliers")
 *
 * `engine/board.js` DERIVES every speed multiplier by running Showdown's own handlers against a
 * recording stub (`speedStub` / `monSpeedMult`): it asks the dex what a Choice Scarf does rather
 * than being told. `engine/medicham2-browser.js` HARDCODES the same facts in `effSpeed`:
 *
 *     if(m.item==='choicescarf')s*=1.5;
 *     if(tailwind)s*=2;
 *     if(swiftswim&&rain || chlorophyll&&sun || sandrush&&sand || slushrush&&snow)s*=2;
 *     if(m.status==='par')s*=0.5;
 *
 * The audit's finding was not that the numbers are wrong today — they are right today, and this
 * test says so by measuring. The finding was that **nothing compares them**, so a dex change, a
 * regulation rotation or a romhack tweak moves one engine and not the other, and every "who moves
 * first" answer downstream is quietly wrong afterwards. The audit could not build this comparison
 * because `board.js` was off-limits during a training run; it recorded R2 as "partial by my hand,
 * not by omission". This is the missing half, and it touches neither engine.
 *
 * WHY THIS IS A TEST AND NOT A REFACTOR. Deriving medicham2's speeds from the dex would be the
 * better fix and is not available: medicham2 is the BROWSER engine and runs where there is no dex
 * to ask. Hardcoding is forced by where it executes. So the rule (S13, "if it can be derived from
 * an artifact, generate it; never type it") is satisfied the only way it can be here — the typed
 * copy is allowed to exist, and a divergence from the derived source fails a build.
 *
 * HOW IT MEASURES. Not by scraping constants out of the source — a regex over `1.5` would pass on
 * a file that had stopped applying it. Each multiplier is measured as a RATIO of medicham2's own
 * `effSpeed` with the condition on versus off, and compared against the same ratio recovered from
 * the dex handler. What is compared is behaviour on both sides.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));

const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let pass = 0, fail = 0;
const ok = (cond, what, detail) => {
  if (cond) { pass++; console.log(`  ok   ${what}`); }
  else { fail++; console.log(`  FAIL ${what}${detail ? '   -- ' + detail : ''}`); }
};

/* ---- recovering a multiplier from a Showdown handler -------------------------------------------
 * Handlers answer through chainModify rather than by returning a number, so probe with a speed of
 * 100 and read the result back as result/100. This is the identical technique board.js uses at the
 * `speedStub` comment — deliberately, so that if the technique is ever wrong it is wrong in both
 * places and this test cannot certify board.js using a method board.js does not use. */
function dexSpeedMult(handler, ctxExtra, pokemon) {
  if (typeof handler !== 'function') return null;
  let out = null;
  const ctx = Object.assign({
    chainModify: v => { out = 100 * (Array.isArray(v) ? v[0] / v[1] : v); return out; },
    /* PASSTHROUGH, not a recorder -- which is what board.js does and I got wrong first time. The
     * paralysis handler is `spe = this.finalModify(spe); ... return Math.floor(spe*50/100)`: it
     * answers by RETURNING, not through chainModify. Recording here captured the un-halved 100 and
     * masked the returned 50, so the probe reported "dex says 1.0" and accused medicham2 of an
     * invented divergence. */
    finalModify: v => v,
    field: { isWeather: () => false, getPseudoWeather: () => null },
    effectState: {},
  }, ctxExtra || {});
  /* THE STUB MUST CARRY WHAT THE HANDLERS TOUCH, or a real handler throws and the probe reports a
   * missing multiplier rather than a real one. Choice Scarf opens with
   * `if (pokemon.volatiles["dynamax"]) return;` and threw on the first run of this file. Same class
   * of lesson as the entry-effects stub needing `hp: 100`: an under-furnished stub does not fail
   * loudly, it fails as a plausible null. */
  const mon = Object.assign({
    volatiles: {}, status: '', item: '', ability: '', hp: 100, maxhp: 100,
    hasItem: () => false, hasAbility: () => false, effectiveWeather: () => '',
  }, pokemon || {});
  const r = handler.call(ctx, 100, mon);
  if (out == null && typeof r === 'number') out = r;
  return out == null ? null : out / 100;
}

/* buildMon(name, ov) READS ov[name] AND THE VALUE IS THE ITEM STRING. It is not a bag of fields --
 * passing {item: 'choicescarf'} sets nothing and the species keeps its dataset item, which made
 * every ratio below come out at exactly 1.0 and read as four separate engine bugs. Ability is not
 * overridable through buildMon at all (it is derived from the dataset via megaAbility), so it is
 * assigned on the returned object. Written out here because getting it wrong produced a confident
 * wrong answer, which is the failure mode this whole file is about. */
/* ---- THE PROBE BODY IS PUT ON AN EXACTLY-DIVISIBLE SPEED, AND THAT IS NOT A CONVENIENCE ---------
 *
 * ROADMAP #290, 2026-08-20. `effSpeed` no longer multiplies by 1.5 — it reproduces the authority's
 * fixed-point chain, `trunc((trunc(value * modifier) + 2048 - 1) / 4096)` (sim/battle.ts:2337), so
 * the number it returns is an INTEGER exactly as `Pokemon#getStat` is. That is the fix; it is also
 * fatal to a test that recovers a multiplier by DIVIDING two speeds, because the ratio of two
 * truncated integers is not the multiplier. Measured the day it landed: this file reported
 * `Choice Scarf: medicham2 1.496 == dex 1.5` and `paralysis 0.496 == dex 0.5` — two FAILs that were
 * the engine becoming correct.
 *
 * A TOLERANCE WOULD HAVE BEEN THE WRONG FIX. `Math.abs(a - b) < 0.01` passes 1.496 and it also
 * passes a genuine drift of the same size, which is the whole thing this file exists to catch. The
 * ratio identity is EXACT wherever the fixed point is exact, so the probe body is put on a Speed
 * divisible by 4: x2, x1.5 and x0.5 of it are all whole numbers and every comparison below stays at
 * 1e-9. What is given up is that this file no longer sees the truncation at all — that half is
 * `tests/test-mechanics.js`'s `speedMult` sweep, which walks five consecutive base stats and reads
 * the STEP pattern, and which fails if the engine ever goes back to a float. */
const PROBE_SPE = 200;
const atProbeSpeed = (m) => { m.st = Object.assign({}, m.st, { sp: PROBE_SPE }); return m; };
const withItem = (item) => atProbeSpeed(M.buildMon(NAME, { [NAME]: item }));
const withAbility = (ability) => { const m = atProbeSpeed(M.buildMon(NAME, {})); m.ability = ability; return m; };

/* Pick a real species from the artifact rather than naming one — a typed species name is the same
 * hand-maintained-state failure this file exists to catch, one level up. */
const NAME = (() => {
  const src = (global.MC && global.MC.mons) || {};
  for (const [n, v] of Object.entries(src)) if (v && v.st && v.st.sp) return n;
  throw new Error('no species with a speed stat in the engine data artifact');
})();

const FIELD = () => ({ weather: '', twA: 0, twB: 0, tr: 0 });
const base = () => atProbeSpeed(M.buildMon(NAME, {}));

console.log('SPEED MULTIPLIERS — medicham2 hardcodes them; the dex is the source of truth\n');

/* ---- 1. Choice Scarf ------------------------------------------------------------------------ */
{
  const item = dex.items.get('choicescarf');
  const fromDex = dexSpeedMult(item && item.onModifySpe, null, { hasItem: () => true, hasAbility: () => false });
  const off = M.effSpeed(withItem(''), FIELD(), 'A');
  const on = M.effSpeed(withItem('choicescarf'), FIELD(), 'A');
  const fromEngine = on / off;
  ok(fromDex != null, 'the dex exposes a Choice Scarf speed handler', 'no onModifySpe on the item');
  ok(fromDex != null && Math.abs(fromEngine - fromDex) < 1e-9,
    `Choice Scarf: medicham2 ${fromEngine} == dex ${fromDex}`,
    `engine ${fromEngine} vs dex ${fromDex}`);
}

/* ---- 2. Tailwind ----------------------------------------------------------------------------- */
{
  const cond = dex.conditions.get('tailwind');
  const fromDex = dexSpeedMult(cond && cond.onModifySpe, null, {});
  const f = FIELD(); const fTw = FIELD(); fTw.twA = 4;
  const fromEngine = M.effSpeed(base(), fTw, 'A') / M.effSpeed(base(), f, 'A');
  ok(fromDex != null, 'the dex exposes a Tailwind speed handler', 'no onModifySpe on the condition');
  ok(fromDex != null && Math.abs(fromEngine - fromDex) < 1e-9,
    `Tailwind: medicham2 ${fromEngine} == dex ${fromDex}`,
    `engine ${fromEngine} vs dex ${fromDex}`);
}

/* ---- 3. Paralysis ---------------------------------------------------------------------------- */
{
  const cond = dex.conditions.get('par');
  const fromDex = dexSpeedMult(cond && cond.onModifySpe, null, { hasAbility: () => false });
  const p = base(); p.status = 'par';
  const fromEngine = M.effSpeed(p, FIELD(), 'A') / M.effSpeed(base(), FIELD(), 'A');
  ok(fromDex != null, 'the dex exposes a paralysis speed handler', 'no onModifySpe on the condition');
  ok(fromDex != null && Math.abs(fromEngine - fromDex) < 1e-9,
    `paralysis: medicham2 ${fromEngine} == dex ${fromDex}`,
    `engine ${fromEngine} vs dex ${fromDex}`);
}

/* ---- 4. The four weather-speed abilities ------------------------------------------------------
 * Named here because medicham2 names them; that is the point of the comparison. If a regulation
 * adds a fifth, this test still passes and the audit's concern is untouched — so the count is
 * asserted too, against the dex's own list of abilities with a speed handler. */
const WEATHER_ABILITIES = [
  { id: 'swiftswim', field: 'rain', dexWeather: 'raindance' },
  { id: 'chlorophyll', field: 'sun', dexWeather: 'sunnyday' },
  { id: 'sandrush', field: 'sand', dexWeather: 'sandstorm' },
  { id: 'slushrush', field: 'snow', dexWeather: 'snowscape' },
];
for (const w of WEATHER_ABILITIES) {
  const ab = dex.abilities.get(w.id);
  const fromDex = dexSpeedMult(ab && ab.onModifySpe, {
    field: { isWeather: () => true, getPseudoWeather: () => null },
  }, { effectiveWeather: () => w.dexWeather, hasAbility: () => true, hasItem: () => false });
  const f = FIELD(); f.weather = w.field;
  const m = withAbility(w.id);
  const fromEngine = M.effSpeed(m, f, 'A') / M.effSpeed(withAbility(''), FIELD(), 'A');
  ok(fromDex != null, `the dex exposes a ${w.id} speed handler`, 'no onModifySpe on the ability');
  ok(fromDex != null && Math.abs(fromEngine - fromDex) < 1e-9,
    `${w.id} in ${w.field}: medicham2 ${fromEngine} == dex ${fromDex}`,
    `engine ${fromEngine} vs dex ${fromDex}`);
}

/* ---- 5. THE LIST ITSELF, so a NEW speed ability is not silently missed -------------------------
 * The four above are the ones medicham2 knows. If the dex gains a fifth ability whose speed handler
 * doubles under a weather, medicham2 would be silently blind to it and every check above would still
 * pass. Comparing the SETS is what makes this test about the divergence rather than about four
 * constants. */
{
  const known = new Set(WEATHER_ABILITIES.map(w => w.id));
  const dexWeatherSpeed = [];
  for (const ab of dex.abilities.all()) {
    if (typeof ab.onModifySpe !== 'function') continue;
    const src = String(ab.onModifySpe);
    /* A weather-conditional speed handler is one that consults the weather at all. */
    if (!/effectiveWeather|isWeather/.test(src)) continue;
    dexWeatherSpeed.push(ab.id);
  }
  const missing = dexWeatherSpeed.filter(id => !known.has(id));
  ok(missing.length === 0,
    `medicham2 knows every weather-speed ability in the dex (${dexWeatherSpeed.length} found)`,
    missing.length ? `medicham2 does not implement: ${missing.join(', ')} — effSpeed will be wrong for them` : '');
}

console.log(`\nSPEED MULTIPLIER CROSS-CHECK: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
