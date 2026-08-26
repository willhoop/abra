/* test-fragility.js — the Solar Beam question, answered with numbers that reconstruct by hand.
 *
 *   node tests/test-fragility.js
 *
 * Will: "what about the risk of me clicking solar beam but them switching in pelipper mid beam".
 * clickFragility answers with worst-case retention against their BENCH, per his own threat list:
 * weather flips, type immunities, priority blocks. Every case here checks the number against the
 * artifact param that produced it — a fragility the artifact cannot explain is an invented one.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
/* THE ABSORBER IS DERIVED, BECAUSE THE ONE THIS FILE NAMED CANNOT OCCUR - 2026-08-26.
 *
 * The type-immunity block below staged STORM DRAIN. Storm Drain is legal in Reg M-B by every test
 * `isNonstandard` can apply, and it has ZERO legal carriers: no species in this regulation has it,
 * so no game of Champions can contain it. Two rows were red for a mechanic that cannot happen, and
 * the engine was correctly returning retention 1 because it has never been asked to price it.
 *
 * `PF.playable('ability', id)` is the filter that catches this and `isNonstandard` does not - see
 * the carriers block in engine/fixture_preflight.js. The replacement is not typed either: the
 * absorbers are read off the format by asking which legal, CARRIED abilities refuse a move by its
 * type, and the SpA-gaining one among them is what the original row was about. */
const PF = require(path.join(ROOT, 'engine', 'fixture_preflight.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };
const mon = (n, ab) => { const m0 = M.buildMon(n, {}); if (m0 && ab) m0.ability = ab; return m0; };
const F = sky => ({ terrain: '', weather: sky || '', twA: 0, twB: 0 });

console.log('FRAGILITY — what their bench does to my committed click\n');

/* THE SCENARIO ITSELF: Solar Beam in sun, Pelipper in the back. */
{
  const att = mon('venusaur'), tgt = mon('garchomp');
  const x = M.clickFragility(att, 'solarbeam', tgt, [mon('pelipper')], F('sun'));
  ok(x && x.cause === 'pelipper' && /rain/.test(x.how),
    `sun Solar Beam vs benched Pelipper: named as the threat (${x && x.how})`);
  /* the retention is the rain number over the sun number, both from dmgRange itself */
  const sun = M.dmgRange(att, tgt, MC.moves.solarbeam, F('sun'), false).max;
  const rain = M.dmgRange(att, tgt, MC.moves.solarbeam, F('rain'), false).max;
  ok(x && Math.abs(x.retention - rain / sun) < 1e-3 && x.retention < 0.55,
    `retention ${x && x.retention} IS dmgRange(rain)/dmgRange(sun) = ${(rain / sun).toFixed(3)} — the beam loses half`);
  ok(x && x.fragile === true, 'and the click is flagged fragile');
  const safe = M.clickFragility(att, 'solarbeam', tgt, [mon('kingambit')], F('sun'));
  ok(!safe || safe.retention === 1,
    'the same click against a bench with NO setter is not fragile — the threat must exist on the sheet');
}

/* Will's Heat Wave case: no charge mechanics involved, just rain's x0.5 on Fire — the flip
 * re-values through the WHOLE damage engine, so every weather consequence rides at once. */
{
  const x = M.clickFragility(mon('incineroar'), 'heatwave', mon('whimsicott'), [mon('pelipper')], F(''));
  ok(x && x.fragile && x.retention > 0.4 && x.retention < 0.55 && x.cause === 'pelipper',
    `Heat Wave into a benched Pelipper retains ${x && x.retention} — rain halves Fire, nothing else needed`);
  const x2 = M.clickFragility(mon('pelipper'), 'hydropump', mon('whimsicott'), [mon('torkoal')], F(''));
  ok(x2 && x2.fragile && x2.retention < 0.55,
    `and the mirror for free: Hydro Pump into a benched Torkoal retains ${x2 && x2.retention}`);
}

/* type immunity: the absorber prices to zero AND reports what it gains */
{
  /* THE POPULATION, derived: every ability in this regulation that a legal body can actually carry
   * and that refuses a move on its TYPE. Showdown writes that as an `onTryHit` reading `move.type`,
   * which is a structural property of the handler rather than a name anybody typed here.
   * Printed with the run, because a derived set nobody looked at is the failure in docs/LESSONS.md 4. */
  const ABSORB = { thunderbolt: 'Electric', hydropump: 'Water', energyball: 'Grass',
                   heatwave: 'Fire', earthquake: 'Ground' };
  /* THE FIRST VERSION OF THIS DERIVATION OVER-MATCHED, AND PRINTING IT IS WHAT CAUGHT IT. It joined
   * EVERY `on*` handler into one blob and read the type literals out of that, which put DRY SKIN
   * under Fire — Dry Skin does not absorb Fire, it takes 1.25x MORE from it, and the Fire literal
   * lives in a different handler on the same ability. The sweep went red on `dryskin/heatwave
   * retention=1` against an engine that was right. Only `onTryHit`'s OWN source counts, because
   * refusing the hit is what `onTryHit` is. */
  const byType = {};
  for (const ab of PF.dex.abilities.all()) {
    if (!PF.playable('ability', ab.id).ok) continue;
    if (typeof ab.onTryHit !== 'function') continue;
    const src = String(ab.onTryHit);
    for (const t of new Set((src.match(/move\.type === "([A-Za-z]+)"/g) || [])
        .map(x => x.replace(/.*"([A-Za-z]+)"/, '$1')))) {
      (byType[t] = byType[t] || []).push(ab.id);
    }
  }
  console.log('  derived absorbers: '
    + Object.entries(byType).map(([t, a]) => t + '=' + a.join('/')).join('  '));

  const tgt = mon('kingambit');   /* neutral to all of the above, so the chart cannot do the work */
  let staged = 0; const bad = [];
  for (const [mv, type] of Object.entries(ABSORB)) {
    for (const ab of (byType[type] || [])) {
      staged++;
      const x = M.clickFragility(mon('archaludon'), mv, tgt, [mon('incineroar', ab)], F(''));
      if (!x || x.retention !== 0 || x.cause !== 'incineroar') bad.push(ab + '/' + mv + ' retention=' + (x && x.retention));
      else if (!x.extra || !x.extra.feedsIt) bad.push(ab + '/' + mv + ' reports no gain');
    }
  }
  ok(staged > 0, `${staged} benched absorbers staged from the format — a sweep over nothing cannot pass`);
  ok(bad.length === 0, `every benched absorber zeroes the committed click and says what it gains${bad.length ? ': ' + bad.join(', ') : ''}`);
  /* AND THE GAIN IS THE ARTIFACT'S OWN PARAM, not a shrug. Lightning Rod is what Storm Drain used to
   * stand for here — same shape, +1 SpA — and unlike Storm Drain it has legal carriers. */
  const lr = M.clickFragility(mon('archaludon'), 'thunderbolt', tgt, [mon('incineroar', 'lightningrod')], F(''));
  ok(lr && lr.extra && lr.extra.feedsIt && lr.extra.feedsIt.boosts && lr.extra.feedsIt.boosts.spa === 1,
    'the report says the pivot GAINS +1 SpA — worse than zero, from the artifact\'s own gain param');
  /* the control that proves the ability is doing it: the same bench with no absorber keeps the click */
  const ctl = M.clickFragility(mon('archaludon'), 'thunderbolt', tgt, [mon('incineroar', 'blaze')], F(''));
  ok(!ctl || ctl.retention === 1, 'and the same body WITHOUT the ability does not blunt it at all');
  /* plain chart immunity needs no ability at all */
  const xg = M.clickFragility(mon('garchomp'), 'earthquake', mon('garchomp'), [mon('corviknight')], F(''));
  ok(xg && xg.retention === 0 && /chart/.test(xg.how),
    'a benched Flying body zeroes a committed Earthquake straight off the type chart');
}

/* priority block: the Farigiraf case — a priority click dies, a normal click does not */
{
  const att = mon('kingambit'), tgt = mon('incineroar');
  const wall = mon('garchomp', 'armortail');
  const sp = M.clickFragility(att, 'suckerpunch', tgt, [wall], F(''));
  const ih = M.clickFragility(att, 'ironhead', tgt, [wall], F(''));
  if (!MC.moves.suckerpunch) ok(true, 'sucker punch not in pool — skipped');
  else {
    ok(sp && sp.retention === 0 && /priority/.test(sp.how),
      'a benched Armor Tail body zeroes a committed Sucker Punch');
    ok(!ih || ih.retention === 1,
      'the same bench does nothing to Iron Head — the block reads the move\'s own priority');
  }
}

/* weather-dependent TYPE is honored: sand Weather Ball is Rock, and a Ground-immunity pivot
 * does not confuse it */
{
  const att = mon('pelipper'), tgt = mon('garchomp');
  const x = M.clickFragility(att, 'weatherball', tgt, [mon('incineroar', 'voltabsorb')], F('sand'));
  ok(!x || x.retention === 1,
    'sand Weather Ball (a Rock move right now) sails past a benched Volt Absorb');
}

console.log('');
if (fail) { console.log(`${fail} fragility number(s) the artifact cannot explain.`); process.exit(1); }
console.log(`${pass} checks passed. The bench threat is priced from the sheet, not guessed.`);
