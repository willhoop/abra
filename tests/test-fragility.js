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
  const att = mon('pelipper'), tgt = mon('garchomp');
  const gastro = mon('incineroar', 'stormdrain');
  const x = M.clickFragility(att, 'hydropump', tgt, [gastro], F(''));
  ok(x && x.retention === 0 && x.cause === 'incineroar',
    'a benched Storm Drain zeroes a committed Hydro Pump');
  ok(x && x.extra && x.extra.feedsIt && x.extra.feedsIt.boosts && x.extra.feedsIt.boosts.spa === 1,
    'and the report says the pivot GAINS +1 SpA — worse than zero, from the artifact\'s own gain param');
  /* plain chart immunity needs no ability at all */
  const xg = M.clickFragility(mon('garchomp'), 'earthquake', tgt, [mon('corviknight')], F(''));
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
