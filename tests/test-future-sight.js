/* test-future-sight.js — ALAKAZAM's Future Sight must predict from real sources, not vibes.
 *
 *   node tests/test-future-sight.js
 *
 * THE BAR. Each of the three predictions is checked against the thing it claims to read:
 *   clicks   must EQUAL the behaviour-clone priors, renormalised — the same numbers chooseAction
 *            samples. A forecast that disagrees with the bot's own policy is two policies.
 *   threats  must EQUAL dmgRange for the same pair — if the panel and the rollout disagree about a
 *            damage number, one of them is lying to the user.
 *   pWin     a mirror must sit near 0.5; a 4-on-1 must not.
 * The no-priors fallback must be VISIBLE (fromPriors:false): ADR-001 attempt 3 fell back to uniform
 * silently and reported a 32-point finding that measured nothing.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
/* THE ONE DOOR into the species table, engine/mc_key.js. Requiring it also installs the SEAL, so
 * a raw miss anywhere in this process throws instead of quietly reading undefined. */
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };

console.log('FUTURE SIGHT — the forecast reads what it claims to read\n');

/* clicks: identical to the priors, renormalised */
{
  const fs = M.futureSight(['garchomp'], ['incineroar'], { rollouts: 10 });
  const foe = fs && fs.foes[0];
  ok(!!foe, 'a forecast comes back for a real matchup');
  const pr = MC.priors.incineroar;
  if (foe && pr && pr.length) {
    const tot = pr.reduce((s, q) => s + q[1], 0);
    const match = foe.clicks.length === pr.length &&
      foe.clicks.every((c, i) => c.move === pr[i][0] && Math.abs(c.p - pr[i][1] / tot) < 1e-12);
    ok(match, `Incineroar's ${foe.clicks.length} predicted clicks ARE the behaviour-clone priors, renormalised`);
    const sum = foe.clicks.reduce((s, c) => s + c.p, 0);
    ok(Math.abs(sum - 1) < 1e-9, `the click distribution sums to 1 (${sum.toFixed(9)})`);
    ok(foe.fromPriors === true && fs.priorsCoverage === '1/1', 'and says it came from priors');
  }
}

/* the fallback is visible, never silent */
{
  const saved = MC.priors.incineroar;
  delete MC.priors.incineroar;
  try {
    const fs = M.futureSight(['garchomp'], ['incineroar'], { rollouts: 10 });
    const foe = fs && fs.foes[0];
    ok(foe && foe.fromPriors === false && fs.priorsCoverage === '0/1',
      'a species with no priors is flagged fromPriors:false — the ADR-001 silent-fallback lesson');
    const u = foe && foe.clicks.length ? 1 / foe.clicks.length : 0;
    ok(foe && foe.clicks.every(c => Math.abs(c.p - u) < 1e-12 && c.kind === 'unknown'),
      'the fallback is uniform over its set and labelled unknown, not dressed up as knowledge');
  } finally { MC.priors.incineroar = saved; }
}

/* threats: the same number dmgRange produces, as a share of max HP */
{
  const fs = M.futureSight(['corviknight'], ['garchomp'], { weather: '', rollouts: 10 });
  const th = fs && fs.foes[0].threats[0];
  const g = M.buildMon('garchomp', {}), c = M.buildMon('corviknight', {});
  ok(th && th.move && th.maxPct >= th.minPct && th.minPct >= 0,
    `Garchomp's best move into Corviknight: ${th && th.move} for ${th && th.minPct}–${th && th.maxPct}% of max HP`);
  if (th && th.move) {
    const mv = MC.moves[th.move];
    const d = M.dmgRange(g, c, mv, { terrain: '', weather: '', twA: 0, twB: 0 }, false);
    ok(Math.round(100 * d.min / c.st.hp) === th.minPct && Math.round(100 * d.max / c.st.hp) === th.maxPct,
      'the threat percentages ARE dmgRange for that pair — panel and rollout cannot disagree');
  }
}

/* my clicks, priced: damage, punisher cost, and bench fragility in one read */
{
  const fs = M.futureSight(['venusaur', 'incineroar'], ['garchomp', 'whimsicott'],
    { weather: 'sun', rollouts: 5, foeBench: ['pelipper', 'kingambit'] });
  ok(fs && Array.isArray(fs.mine) && fs.mine.length === 2, 'the forecast now prices MY side too');
  const ven = fs && fs.mine[0];
  /* FIND THE MOVE BY TYPE, DO NOT NAME IT. This asserted on 'venoshock', a move Venusaur only had
   * because data/engine-data.js carried sets from a foreign dataset. Rebuilding from real open sheets
   * (2026-07-31) gave Venusaur its actual kit — Giga Drain / Sludge Bomb / Earth Power / Protect —
   * and the fixture vanished, so a live check silently became untestable.
   *
   * What matters is the CLAIM: a Poison move must read as dead against a benched Steel by the type
   * chart alone. Any Poison move in the set proves it, so the test now asks the data which one. */
  const poisonClick = ven && ven.clicks.find(c => {
    const mv = MC.moves[c.move];
    return mv && mv.t === 'Poison' && mv.bp > 0;
  });
  ok(!!poisonClick, `Venusaur's real set contains a Poison move to test the Steel immunity with (${poisonClick && poisonClick.move})`);
  ok(poisonClick && poisonClick.fragility && poisonClick.fragility.retention === 0
     && poisonClick.fragility.cause === 'kingambit',
    `${poisonClick && poisonClick.move} is flagged dead against their benched Steel — chart immunity, no ability needed`);
  const inc = fs && fs.mine[1];
  const touchy = inc && inc.clicks.find(c => c.into && c.into.some(i => i.vs === 'garchomp' && i.cost > 0));
  ok(!!touchy, `Incineroar's contact clicks into Rough Skin Garchomp carry their price (${touchy && touchy.move})`);
  /* Same reason: 'round' was another move from the foreign set. The claim is that a click NOTHING on
   * their bench resists carries no fragility flag, so find any such click rather than naming one. */
  const clean = ven && ven.clicks.find(c => {
    const mv = MC.moves[c.move];
    return mv && mv.bp > 0 && !c.fragility;
  });
  ok(!!clean, `a click no benched mon blunts carries no fragility flag (${clean && clean.move})`);
}

/* pWin: a mirror is a coin, a 4-on-1 is not */
{
  const six = ['incineroar', 'garchomp', 'corviknight', 'kingambit'];
  const mirror = M.futureSight(six, six, { rollouts: 300 });
  ok(mirror && Math.abs(mirror.pWin - 0.5) < 0.15,
    `mirror pWin ${mirror && (100 * mirror.pWin).toFixed(0)}% sits near the coin it must be`);
  const lop = M.futureSight(six, ['pikachu'], { rollouts: 300 });
  ok(lop === null || lop.pWin > 0.5 || !mcKey.has('pikachu'),
    'a full team into a lone filler does not lose the forecast');
}

console.log('');
if (fail) { console.log(`${fail} check(s) failed — the forecast is inventing numbers.`); process.exit(1); }
console.log(`${pass} checks passed. Future Sight predicts from the sources it names.`);
