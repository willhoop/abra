/* tests/census_authority.js — THE AUTHORITY'S NUMBER FOR A CENSUS ROW, DERIVED ON THE RUN, UNDER THE SELECTED REGULATION.
 * 2026-09-22 (MEASURE, abra/regmc 0.40.0).
 *
 * WHY THIS EXISTS. Several rows of tests/test-mechanics.js assert a number "the authority deals on this board" — and the
 * number was measured once, under Reg M-B, and typed into the pass condition. Under Reg M-C the same species is built
 * with other stats, the typed number is a fact about a board the run is not playing, and the row reads MISSING against
 * an engine that is right (docs/_reports/2026-09-22-regmc-engine.md §8). A number the row needs from the authority is
 * asked of the authority, on the selected regulation's checkout, with the ENGINE BODY'S OWN STATS copied onto the
 * authority's body so the two are pricing the same board ("the stats aligned", as the rows already describe it).
 *
 * WHAT IT CALLS. `engine/champions_sim.js` (the checkout and format the regulation selects) and, per question, one
 * Showdown `Battle` with two bodies a side. Nothing here re-implements a formula: damage is `battle.actions.getDamage`
 * (one packet) or `battle.actions.useMove` (the whole hit loop, for a move that deals more than one packet), and a line
 * the authority writes is read off `battle.log`.
 *
 * THE DIE. Every roll is pinned: `random(16)` returns the damage-roll index the caller names (the harness's own mapping
 * of a uniform to an index is `damageRollIndex` in engine/medicham2-browser.js, `15 - floor(u * 16)`, so the engine's
 * rng 0.5 is index 7 and rng 0.99 is index 0), and every `randomChance(n, d)` draws `d - 1`, so a 100%-accurate move
 * lands and no crit, secondary below 100% or other chance effect fires. */
'use strict';
const path = require('path');
const CS = require(path.join(__dirname, '..', 'engine', 'champions_sim.js'));

const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
let _sim = null;
const sim = () => (_sim = _sim || CS.sim());

/* the engine body's fields -> a Showdown set, and the engine's stats onto the authority's body */
function setOf(body, moves) {
  const D = sim().Dex.forFormat(CS.FORMAT);
  const sp = D.species.get(body.name);
  if (!sp || !sp.exists) throw new Error('census_authority: the authority has no species for ' + body.name);
  return { name: sp.name, species: sp.name, level: 50, item: body.item || '',
           ability: body.ability && body.ability !== 'none' ? body.ability : 'No Ability',
           moves: moves && moves.length ? moves : ['splash'], evs: {}, ivs: {}, nature: 'Hardy' };
}
function align(p, body) {
  const s = body.st;
  p.storedStats = { atk: s.at, def: s.df, spa: s.sa, spd: s.sd, spe: s.sp };
  p.maxhp = s.hp; p.baseMaxhp = s.hp; p.hp = body.curHP != null ? body.curHP : s.hp;
  if (!body.ability || body.ability === 'none') { p.ability = 'noability'; p.baseAbility = 'noability'; }
  if (!body.item) { p.item = ''; }
}
function battle(p1Bodies, p2Bodies, movesOf) {
  const S = sim();
  const b = new S.Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'p1', team: p1Bodies.map(x => setOf(x, movesOf && movesOf(x))) });
  b.setPlayer('p2', { name: 'p2', team: p2Bodies.map(x => setOf(x, movesOf && movesOf(x))) });
  if (b.requestState === 'teampreview') b.makeChoices('team ' + p1Bodies.map((_, i) => i + 1).join(''),
                                                      'team ' + p2Bodies.map((_, i) => i + 1).join(''));
  p1Bodies.forEach((x, i) => align(b.p1.pokemon[i], x));
  p2Bodies.forEach((x, i) => align(b.p2.pokemon[i], x));
  return b;
}
function pin(b, rollIndex) {
  const orig = b.random.bind(b), origChance = b.randomChance.bind(b);
  b.random = (m, n) => (m === 16 && n === undefined ? rollIndex : (n === undefined ? (m ? m - 1 : 0.999999) : n - 1));
  b.randomChance = (num, den) => den - 1 < num;
  return () => { b.random = orig; b.randomChance = origChance; };
}

/* ONE PACKET: `getDamage` on the aimed foe (p2a). `spread` marks the move a spread hit, the one input the authority's
 * multi-target modifier reads (`modifyDamage`: `if (move.spreadHit) baseDamage = this.battle.modify(baseDamage, 0.75)`).
 * `truncSpread` replaces that one call with a truncation -- the counterfactual a row must be able to tell apart. */
function damageAt(att, def, moveId, o) {
  o = o || {};
  const b = battle([att, o.ally || att], [def, o.foe2 || def], x => [moveId]);
  const src = b.p1.active[0], tgt = b.p2.active[0];
  const un = pin(b, o.rollIndex == null ? 7 : o.rollIndex);
  const origModify = b.modify.bind(b);
  if (o.truncSpread) b.modify = (v, num, den) => (num === 0.75 && den === undefined ? Math.floor(v * 0.75) : origModify(v, num, den));
  try {
    const m = b.dex.getActiveMove(moveId);
    m.willCrit = false;
    if (o.spread) m.spreadHit = true;
    return b.actions.getDamage(src, tgt, m);
  } finally { un(); b.modify = origModify; }
}

/* THE WHOLE HIT LOOP: `useMove` from p1a at p2a, and what p2a lost -- the only reading that sees a second packet. */
function hitTotal(att, def, moveId, o) {
  o = o || {};
  const b = battle([att, o.ally || att], [def, o.foe2 || def], x => [moveId]);
  const src = b.p1.active[0], tgt = b.p2.active[0];
  if (o.bigTarget) { tgt.maxhp *= 8; tgt.baseMaxhp = tgt.maxhp; tgt.hp = tgt.maxhp; }
  const un = pin(b, o.rollIndex == null ? 7 : o.rollIndex);
  try {
    const before = tgt.hp;
    b.actions.useMove(moveId, src, { target: tgt });
    return before - tgt.hp;
  } finally { un(); }
}

/* THE LINES THE AUTHORITY WRITES when p1a uses `moveId` on p2a (optionally with p1a pre-statused), filtered by `keep`. */
function linesOf(att, def, moveId, o) {
  o = o || {};
  const b = battle([att, o.ally || att], [def, o.foe2 || def], x => [moveId]);
  const src = b.p1.active[0], tgt = b.p2.active[0];
  if (o.bigTarget) { tgt.maxhp *= 8; tgt.baseMaxhp = tgt.maxhp; tgt.hp = tgt.maxhp; }
  if (o.preStatus) src.setStatus(o.preStatus);
  const un = pin(b, o.rollIndex == null ? 7 : o.rollIndex);
  const mark = b.log.length;
  try { b.actions.useMove(moveId, src, { target: tgt }); } finally { un(); }
  return b.log.slice(mark).filter(l => !o.keep || o.keep.test(l));
}

module.exports = { damageAt, hitTotal, linesOf, FORMAT: CS.FORMAT, idOf };
