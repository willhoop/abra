/* THE SWITCH-IN FEATURES — the sheet reaching the candidate, and Run and Bun's conjunction.
 *
 * Four things are proved here, and every case is FOUND BY SEARCHING the engine's own table for a
 * Pokemon with the needed profile rather than by naming one. A test that names Garchomp rots the
 * day the format drops Garchomp; a test that asks for "a switch-in slower than the foe that survives
 * one hit and not two" keeps meaning the same thing forever. If no such case exists the test FAILS
 * loudly rather than passing vacuously, because "I could not find an example" is information.
 *
 *   1. THE SHEET REACHES THE CANDIDATE. switchFeatures used to build the incoming Pokemon as
 *      {species, hp, boosts, fainted} and nothing else, while switchIn copies nature, item and
 *      ability onto everything that actually comes out. dmgMon gates the sheet on `!!mon.nature`
 *      ("a sheet always declares a nature, so nature => sheet was read"), so with no nature the
 *      item and ability BOTH silently fell back to the average build. Declaring a Choice Scarf must
 *      change the speed read; declaring an ability must change the vector.
 *
 *   2. WILL'S RULE, both directions. "A slow mon that cant take the switch in hit and another hit is
 *      a no switch in" -- but after a KO there IS no switch-in hit. So the SAME slow candidate on
 *      the SAME board must read as dying when the switch is voluntary (two hits) and as surviving
 *      when it is a forced replacement (one hit). This is the entryHits rule and it is the whole
 *      reason `forced` is on the candidate.
 *
 *   3. PER FOE, NOT COLLAPSED. "Score that for both pokemon against both other mons." A replacement
 *      that removes one of two foes must read 0.5, not 0 and not 1.
 *
 *   4. THE BUCKETS PARTITION. koFast, koSlow and diesFirst are mutually exclusive per foe, so their
 *      fractions can never sum above 1. The omitted fourth bucket (survives, no kill) is the
 *      reference level and its absence is what keeps the three out of perfect collinearity.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
/* THE ONE DOOR into the species table, engine/mc_key.js. Requiring it also installs the SEAL, so
 * a raw miss anywhere in this process throws instead of quietly reading undefined. */
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};
const I = n => B.FEATURE_INDEX[n];

/* A board with `foes` across from me and `bench` on mine. sheets maps species -> sheet entry. */
function mkBoard(foes, bench, sheets) {
  const b = new B.Board();
  b.turn = 3;
  const act = {};
  ['a', 'b'].forEach((L, i) => {
    if (foes[i]) act[L] = { species: foes[i], hp: 1, boosts: {}, status: '', fainted: false, nature: '', item: '', ability: '' };
  });
  b.sides.p2.active = act;
  b.sides.p1.active = {};
  b.party.p1 = bench.slice();
  b.party.p2 = foes.slice();
  for (const [sp, info] of Object.entries(sheets || {})) b.setSheet('p1', sp, info);
  return b;
}
const featOf = (board, sp, forced) =>
  B.featuresFor({ raw: null, move: null, targetMon: null, switchTo: sp, forced: !!forced },
    null, board, 'p1', dex, B.PRIOR_FLOOR);

const names = mcKey.keys(MONMISS) || [];
const spe = n => (mcKey.row(n, MONMISS).st || {}).sp || 0;
console.log('SWITCH-IN FEATURES — SHEET, CONJUNCTION, PER-FOE\n');

/* ---- 1. CHOICE SCARF ON THE INCOMING POKEMON ------------------------------------------------
 * Wanted: a bench mon whose bare speed loses to the foe but whose scarfed speed wins. That is the
 * only configuration in which the bug is visible at all -- if it outruns the foe either way, or
 * neither way, the missing 1.5x changes nothing and the test would pass while broken. */
/* THE PAIR IS VERIFIED, NOT ASSUMED. Selecting on MC.mons speed and then asserting what board.js
 * computes was a category error: board.js scores EXPECTED speed over unknown spreads, which is a
 * different quantity from the table's stat line. It happened to agree while the table carried
 * inherited stat lines; rebuilding those from real sheets (2026-07-31) broke the coincidence and the
 * test failed with "1 -> 1" — the bare case already read as faster.
 *
 * So the candidate is now CHECKED against board.js itself before being used: keep searching until a
 * pair is found that board.js genuinely reads as slower-when-bare. That is the only configuration in
 * which the missing 1.5x is visible, and now the test proves it holds rather than hoping. */
let scarfCase = null;
outer:
for (const me of names) {
  const s = spe(me); if (!s) continue;
  for (const foe of names) {
    const f = spe(foe);
    if (!(f > s && f < s * 1.5)) continue;
    const probe = mkBoard([foe], [me], {});
    const xb = featOf(probe, me, true);
    if (xb[I('switchFaster')] !== 0) continue;      // board.js disagrees that this is the slow case
    scarfCase = { me, foe, s, f };
    break outer;
  }
}
if (!scarfCase) { ok(false, 'found a mon whose SCARF decides the speed tie', 'no such pair in the table'); }
else {
  const { me, foe, s, f } = scarfCase;
  const bare = mkBoard([foe], [me], {});
  const scarf = mkBoard([foe], [me], { [me]: { nature: '', item: 'choicescarf', ability: '', moves: [] } });
  const xb = featOf(bare, me, true), xs = featOf(scarf, me, true);
  console.log(`  case: ${me} (spe ${s.toFixed(0)}) into ${foe} (spe ${f.toFixed(0)}) — scarfed ${(s * 1.5).toFixed(0)}`);
  ok(xb[I('switchFaster')] === 0 && xs[I('switchFaster')] === 1,
    'a declared Choice Scarf makes the switch-in read as FASTER',
    `bare switchFaster=${xb[I('switchFaster')]}, scarfed=${xs[I('switchFaster')]}`);
}

/* ---- 1b. THE ABILITY REACHES THE DAMAGE ENGINE ----------------------------------------------
 * Differential rather than species-specific: declaring an ability must be capable of changing the
 * vector. Search for any (bench, foe, ability) where it does. The abilities are taken from the
 * dex, and the one that matters is whichever the search happens to land on. */
let abilCase = null;
const ABILS = ['voltabsorb', 'flashfire', 'waterabsorb', 'levitate', 'thickfat'];
outer:
for (const me of names.slice(0, 80)) {
  for (const foe of names.slice(0, 80)) {
    const base = featOf(mkBoard([foe], [me], {}), me, true);
    for (const ab of ABILS) {
      const withAb = featOf(mkBoard([foe], [me], { [me]: { nature: 'serious', item: '', ability: ab, moves: [] } }), me, true);
      if (withAb.some((v, i) => v !== base[i])) { abilCase = { me, foe, ab, base, withAb }; break outer; }
    }
  }
}
ok(!!abilCase, 'a declared ABILITY changes the switch-in vector (it reaches dmgMon)',
  abilCase ? `${abilCase.me} vs ${abilCase.foe} with ${abilCase.ab}: ` +
    B.FEATURES.filter((f2, i) => abilCase.base[i] !== abilCase.withAb[i]).join(', ')
    : 'no ability changed anything — the sheet is not reaching the damage engine');

/* ---- 2. WILL'S RULE: THE ENTRY HIT EXISTS ONLY ON A VOLUNTARY SWITCH ------------------------
 * Wanted: a SLOWER bench mon that survives one hit from the foe and not two. Then forced (one hit)
 * must read alive and voluntary (entry hit + one more) must read dead. Same board, same candidate,
 * one flag apart -- so nothing but entryHits can explain a difference. */
let hitCase = null;
outer2:
for (const me of names) {
  for (const foe of names) {
    if (spe(foe) <= spe(me)) continue;              // must be slower, or the counts do not differ
    const board = mkBoard([foe], [me], {});
    const forced = featOf(board, me, true);
    const volun = featOf(board, me, false);
    if (forced[I('switchDiesFirst')] === 0 && volun[I('switchDiesFirst')] === 1) {
      hitCase = { me, foe, forced, volun }; break outer2;
    }
  }
}
if (!hitCase) {
  ok(false, "Will's rule: slow + survives one hit but not two", 'no such pair found — entryHits may be inert');
} else {
  const { me, foe, forced, volun } = hitCase;
  console.log(`  case: ${me} (spe ${spe(me).toFixed(0)}) coming in against ${foe} (spe ${spe(foe).toFixed(0)})`);
  ok(forced[I('switchDiesFirst')] === 0, 'FORCED replacement: no entry hit, so it survives to act',
    `switchDiesFirst=${forced[I('switchDiesFirst')]}`);
  ok(volun[I('switchDiesFirst')] === 1, 'VOLUNTARY switch: entry hit + one more, so it dies first',
    `switchDiesFirst=${volun[I('switchDiesFirst')]}`);
  ok(forced.some((v, i) => v !== volun[i]), 'the `forced` flag is not inert');
}

/* ---- 3. SCORED AGAINST BOTH FOES, NOT COLLAPSED INTO A MAX ----------------------------------
 * Wanted: a bench mon that lands in DIFFERENT buckets against two different foes, so the fraction
 * has to be a half. A max-collapse implementation cannot produce 0.5 at all. */
let halfCase = null;
outer3:
for (const me of names) {
  for (const f1 of names.slice(0, 60)) {
    for (const f2 of names.slice(0, 60)) {
      if (f1 === f2) continue;
      const x = featOf(mkBoard([f1, f2], [me], {}), me, true);
      for (const k of ['switchKOFast', 'switchKOSlow', 'switchDiesFirst']) {
        if (Math.abs(x[I(k)] - 0.5) < 1e-9) { halfCase = { me, f1, f2, k, x }; break outer3; }
      }
    }
  }
}
ok(!!halfCase, 'a replacement can score 0.5 — the two foes are read separately',
  halfCase ? `${halfCase.me} vs [${halfCase.f1}, ${halfCase.f2}]: ${halfCase.k}=0.5` : 'never produced a half');

/* ---- 4. THE BUCKETS PARTITION ---------------------------------------------------------------- */
let worst = 0, checked = 0;
for (const me of names.slice(0, 40)) {
  for (const f1 of names.slice(0, 40)) {
    const x = featOf(mkBoard([f1], [me], {}), me, true);
    const sum = x[I('switchKOFast')] + x[I('switchKOSlow')] + x[I('switchDiesFirst')];
    if (sum > worst) worst = sum;
    checked++;
  }
}
ok(worst <= 1 + 1e-9, 'the three buckets never sum above 1 (mutually exclusive per foe)',
  `${checked} boards checked, largest sum ${worst.toFixed(3)}`);

ok(B.dmgFailures.unavailable === 0, 'the damage engine was live',
  `unavailable=${B.dmgFailures.unavailable}`);

console.log(`\nFEATURES: ${B.FEATURES.length}`);
console.log(fails ? `\nSWITCH FEATURES: ${fails} FAILED` : '\nSWITCH FEATURES: all checks passed');
process.exit(fails ? 1 : 0);
