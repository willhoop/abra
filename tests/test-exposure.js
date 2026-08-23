/* test-exposure.js — the pricing-risk engine must price what the rollout plays, no more, no less.
 *
 *   node tests/test-exposure.js
 *
 * THE BAR. Every price must be reconstructible from the artifact by hand, and every gate the
 * rollout obeys (trigger, immunity, Guts, forme, faint-only) must zero the price in the same
 * places. A price the simulation never charges is a phantom tax; a charge the price misses is
 * exactly the Flame Body blind spot this engine exists to remove.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
/* THE ONE DOOR into the species table, engine/mc_key.js. Enumerating and indexing MC.mons by
 * hand is what made 101 of 308 keys unreachable in four files at once; requiring this file also
 * installs the SEAL, so a raw miss anywhere in this process throws instead of reading undefined. */
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const X = require(path.join(ROOT, 'engine', 'exposure.js'));
const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };
const mon = (name, ab) => { const m0 = M.buildMon(name, {}); if (m0 && ab) m0.ability = ab; return m0; };
const H = X.DEFAULT_HORIZON;

console.log('EXPOSURE — the price of the click, reconstructed by hand\n');

/* Flame Body on a physical attacker: p=0.3, cost = physShare*0.5-halving + 5/16 chip */
{
  const att = mon('garchomp'), tgt = mon('incineroar', 'flamebody');
  const x = X.punishExposure(att, tgt, 'ironhead');
  ok(!!x, 'contact into Flame Body is priced at all (the blind spot this engine removes)');
  if (x) {
    const p = TAGS.param('ability', 'flamebody', 'punishesAttacker').inflicts[0].chance;
    const share = X.physicalShare(att);
    ok(Math.abs(x.outputHalvedFrac - p * share) < 1e-9,
      `burn halves output at exactly chance x physical share (${p} x ${share.toFixed(2)} = ${x.outputHalvedFrac.toFixed(3)})`);
    ok(Math.abs(x.selfHPFrac - p * H / 16) < 1e-9,
      `plus the chip: ${p} x ${H}/16 of own HP over the measured half-game horizon`);
  }
}

/* the same click priced at zero where the rollout charges nothing */
{
  const fire = mon('incineroar'), fb = mon('garchomp', 'flamebody');
  const x1 = X.punishExposure(fire, fb, 'flareblitz');
  ok(!x1 || x1.outputHalvedFrac === 0,
    'a Fire-type attacker prices burn at zero — canTakeStatus, the same gate the rollout uses');
  const att = mon('garchomp'); att.status = 'brn';
  const x2 = X.punishExposure(att, mon('incineroar', 'flamebody'), 'ironhead');
  ok(!x2 || (x2.outputHalvedFrac === 0 && x2.selfHPFrac === 0),
    'an already-statused attacker cannot be burned again: price zero');
  /* Will's catch: Guts is not "immune", it PROFITS — x1.5 attack while statused (dmgRange's own
   * rule), so the output channel must go NEGATIVE: a proc on a Guts body is something to seek. */
  const guts = mon('garchomp', 'guts');
  const x3 = X.punishExposure(guts, mon('incineroar', 'flamebody'), 'ironhead');
  const p3 = TAGS.param('ability', 'flamebody', 'punishesAttacker').inflicts[0].chance;
  ok(x3 && Math.abs(x3.outputHalvedFrac - (p3 * -0.5 * X.physicalShare(guts))) < 1e-9 && x3.selfHPFrac > 0,
    `Guts prices the proc as a GAIN: output ${x3 && x3.outputHalvedFrac.toFixed(3)} (negative = seek it), chip still charged`);
  const x4 = X.punishExposure(mon('garchomp'), mon('incineroar', 'flamebody'), 'earthquake');
  ok(x4 === null, 'a NON-contact click into Flame Body costs nothing (trigger from the tag)');
}

/* Rough Skin: a flat, certain toll — 1/8 per hit, no probability */
{
  const x = X.punishExposure(mon('corviknight'), mon('incineroar', 'roughskin'), 'ironhead');
  ok(x && Math.abs(x.selfHPFrac - 1 / 8) < 1e-9,
    `Rough Skin prices at exactly 1/8 of own max HP (${x && x.selfHPFrac})`);
}

/* Aftermath: priced ONLY through kill probability */
{
  const att = mon('corviknight'), tgt = mon('incineroar', 'aftermath');
  tgt.curHP = tgt.st.hp;
  const alive = X.punishExposure(att, tgt, 'ironhead');
  ok(alive === null, 'Aftermath into a healthy body prices at zero — it fires on death, not on touch');
  tgt.curHP = 1;
  const kill = X.punishExposure(att, tgt, 'ironhead');
  ok(kill && Math.abs(kill.selfHPFrac - 1 / 4) < 1e-9,
    `killing it prices the full 1/4 (${kill && kill.selfHPFrac})`);
}

/* Effect Spore: three exclusive branches, each gated by the attacker's own immunities */
{
  const att = mon('garchomp'), tgt = mon('incineroar', 'effectspore');
  const x = X.punishExposure(att, tgt, 'ironhead');
  ok(x && x.parts.length === 3, `all three Effect Spore branches priced (${x && x.parts.length})`);
  const steel = mon('corviknight');
  const xs = X.punishExposure(steel, tgt, 'ironhead');
  ok(xs && xs.parts.every(p => !/poison/.test(p.what)),
    'a Steel attacker prices the poison branch at zero, keeps sleep and paralysis');
}

/* Gooey: stages, not HP */
{
  const x = X.punishExposure(mon('corviknight'), mon('incineroar', 'gooey'), 'ironhead');
  ok(x && x.stagesLost === 1 && x.selfHPFrac === 0,
    `Gooey prices as 1 speed stage per touch, no HP (${x && x.stagesLost})`);
}

/* the para speed cost: priced only where an order actually flips, TR inverts it */
{
  const F = { terrain: '', weather: '', twA: 0, twB: 0, tr: 0 };
  const att = mon('garchomp'), tgt = mon('incineroar', 'static');
  /* a foe whose speed sits between att's half and full speed — the flip case, found not assumed */
  const half = M.effSpeed(Object.assign({}, att, { status: 'par' }), F, 'A');
  const full = M.effSpeed(att, F, 'A');
  const between = (mcKey.keys(MONMISS) || []).map(n => mon(n)).find(m0 => {
    const s = M.effSpeed(m0, F, 'B'); return s > half && s < full;
  });
  ok(!!between, `found a foe between half and full speed (${between && between.name}) — the flip case exists`);
  if (between) {
    const x = X.punishExposure(att, tgt, 'ironhead', { foes: [between], field: F });
    const p = TAGS.param('ability', 'static', 'punishesAttacker').inflicts[0].chance;
    ok(x && Math.abs(x.speedFlipsFrac - p * 1) < 1e-9,
      `losing the order to it prices at chance x 1 flip (${x && x.speedFlipsFrac.toFixed(3)})`);
    const slower = (mcKey.keys(MONMISS) || []).map(n => mon(n)).find(m0 => M.effSpeed(m0, F, 'B') < half);
    const x2 = X.punishExposure(att, tgt, 'ironhead', { foes: [slower], field: F });
    ok(x2 && x2.speedFlipsFrac === 0,
      'a foe you outspeed even at half speed prices the half at zero — it flips nothing');
    const xTR = X.punishExposure(att, tgt, 'ironhead', { foes: [between], field: Object.assign({}, F, { tr: 3 }) });
    ok(xTR && xTR.speedFlipsFrac < 0,
      `under Trick Room the same flip is a GAIN (${xTR && xTR.speedFlipsFrac.toFixed(3)}) — slower moves first`);
  }
}

/* Gulp Missile: forme-gated, skipped whole — same as the wire */
{
  const x = X.punishExposure(mon('corviknight'), mon('incineroar', 'gulpmissile'), 'ironhead');
  ok(x === null, 'forme-gated members price at zero, exactly as the rollout skips them');
}

/* THE POINT OF ALL OF IT: the price changes the click. Same attacker, same moves, same target —
 * only the attacker's max HP moves, which scales the punisher price without touching the damage
 * dealt. At real HP the contact nuke wins; at a max HP that makes 1/8-per-touch enormous, the
 * scorer must walk around the Rough Skin. */
{
  const tgt = mon('incineroar', 'roughskin');
  const F = { terrain: '', weather: '', twA: 0, twB: 0 };
  /* First finding of the priced scorer, kept as the test: Iron Head beats Air Slash by only ~6 HP
   * into this target, and the Rough Skin toll is ~22 — so at REAL HP the right click is already
   * the non-contact one, and the scorer now says so. Brave Bird's margin survives both its recoil
   * and the toll, so it wins at real HP; inflate max HP (which scales the toll, not the damage)
   * and the same scorer walks around the Rough Skin. */
  const att = mon('corviknight');
  att.moves = ['bravebird', 'airslash'];
  const cheap = M.bestMoveVs(att, tgt, F);
  ok(cheap && cheap.id === 'bravebird' && cheap.cost > 0,
    `at real HP Brave Bird still wins WITH recoil and the toll priced (cost ${cheap && cheap.cost} HP)`);
  att.st = Object.assign({}, att.st, { hp: 20000 });
  const dear = M.bestMoveVs(att, tgt, F);
  ok(dear && dear.id === 'airslash',
    `when the same touch costs 2,500 HP the scorer walks around the Rough Skin (picked ${dear && dear.id})`);
  att.st = Object.assign({}, att.st, { hp: 175 });
  const ih = mon('corviknight'); ih.moves = ['ironhead', 'airslash'];
  const close = M.bestMoveVs(ih, tgt, F);
  ok(close && close.id === 'airslash',
    'and the 6-HP Iron Head edge is correctly NOT worth a 22-HP toll — the price flips a real margin');
}

/* the cost data itself now rides the generated move table — no name lists left to go stale */
{
  ok(JSON.stringify(MC.moves.bravebird.rc) === '[33,100]' && JSON.stringify(MC.moves.headsmash.rc) === '[1,2]',
    'recoil fractions are dex-generated fields on the move table (Brave Bird 33/100, Head Smash 1/2)');
  ok(MC.moves.superpower.self && MC.moves.superpower.self.atk === -1 && MC.moves.overheat.self.spa === -2,
    'self stat drops likewise (Superpower -1/-1, Overheat -2 SpA) — the hand tables are deleted');
}

console.log('');
if (fail) { console.log(`${fail} price(s) disagree with the artifact.`); process.exit(1); }
console.log(`${pass} checks passed. The price and the simulation read one artifact.`);
