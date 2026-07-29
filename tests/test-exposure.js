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
  const guts = mon('garchomp', 'guts');
  const x3 = X.punishExposure(guts, mon('incineroar', 'flamebody'), 'ironhead');
  ok(x3 && x3.outputHalvedFrac === 0 && x3.selfHPFrac > 0,
    'Guts keeps the chip but prices the halving at zero — same as dmgRange');
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

/* Gulp Missile: forme-gated, skipped whole — same as the wire */
{
  const x = X.punishExposure(mon('corviknight'), mon('incineroar', 'gulpmissile'), 'ironhead');
  ok(x === null, 'forme-gated members price at zero, exactly as the rollout skips them');
}

console.log('');
if (fail) { console.log(`${fail} price(s) disagree with the artifact.`); process.exit(1); }
console.log(`${pass} checks passed. The price and the simulation read one artifact.`);
