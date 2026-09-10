/* probe_item_disposition.js — THE `wrong_if` FALSIFICATION FOR THE ITEM-DISPOSITION LEAF.
 *
 *   SHOWDOWN_PATH=... node tests/probe_item_disposition.js
 *
 * `data/game-differential.json` `state.not_compared` carries a CANDIDATE row for item DISPOSITION
 * (`lastItem` / `ateBerry`) and states its own falsification:
 *
 *   "a path in either engine writes the field on a REMOVAL rather than on a consumption — then the
 *    two shapes diverge on bookkeeping and the leaf would MANUFACTURE divergences. Falsified by a
 *    staged Knock Off with both fields printed side by side."
 *
 * THIS FILE IS THAT STAGING, AND IT ASKS THE CONVERSE TOO. A row that only checks "does a removal
 * write the field" cannot see the OTHER way two write-site sets fail to line up: a CONSUMPTION one
 * engine records and the other does not. Showdown has TWO write sites (`eatItem` at
 * sim/pokemon.ts:1805-1809 writes both fields; `useItem` at :1846 writes `lastItem` alone) and
 * medicham2 has one general one (`consumeBerry`, the `m._lastItem=` / `m._ateBerry=` pair) plus two
 * `_ateBerry`-only sites that mirror the authority's own quirks (a flung berry force-eaten on the
 * TARGET, and a Bug Bite / Pluck berry eaten by the THIEF). So the `useItem` family — Focus Sash, the
 * herbs, a gem, Air Balloon — is a consumption the authority records and this engine does not, and
 * that asymmetry parts a board just as hard as a removal would.
 *
 * EIGHT ARMS, each printing `lastItem` and `ateBerry` from BOTH engines at every turn boundary:
 *
 *   ko-leftovers    a plain REMOVAL. Both engines must write NOTHING — this is the row's wrong_if.
 *   ko-colbur       the PUBLISHED disagreement (knock_off_roadmap_80): the berry resists the Dark
 *                   move and is eaten inside the damage calculation, so it is a consumption.
 *   ko-sitrus       taken BEFORE its onUpdate can see the HP — a removal that looks like an eat.
 *   eat-sitrus      the control: the same berry, the same body, eaten because the HP crossed half
 *                   under a move that does not strip. Both engines must write BOTH fields.
 *   sash-used       the `useItem` family. Showdown writes `lastItem` and not `ateBerry`. THIS ARM
 *                   WAS RED until 2026-09-10 — medicham2 had no `useItem` door at all.
 *   trick-swap      a SWAP. `takeItem`/`setItem` on both sides — neither field on either engine.
 *   thief-steal     a removal by the attacker, with the item moving. Same expectation.
 *   eat-then-switch the BENCH. Neither engine clears either field on a switch-out, so the leaf is
 *                   compared on a benched body too and the seven arms above could not see it.
 *
 * VERDICTS. `MATCH` is both engines holding the same pair. `PARTS` is a real state disagreement and
 * is the finding, not a failure of this probe — what it means for the LEAF depends on which arm it
 * lands in: a PARTS on a removal arm is the row's wrong_if and refuses the wire; a PARTS on a
 * consumption arm is an ENGINE defect the leaf would reveal.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));

/* EVERY BODY AND EVERY MOVE HERE IS CHECKED AGAINST THE FORMAT'S OWN LEARNSET BEFORE IT IS STAGED.
 * `tests/test-fixture-legality.js` found four illegal Knock Off fixtures in game_differential.js
 * (Incineroar cannot learn it in this regulation), so a staged set is asserted, never assumed. */
const legalSet = (species, moves) => {
  const bad = moves.filter(m => !CS.canLearn(species, m));
  if (bad.length) { console.log('  FIXTURE ILLEGAL — ' + species + ' cannot learn ' + bad.join(', ')); process.exit(1); }
  return true;
};
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
const one = (species, item, ability, moves) => {
  legalSet(species, moves);
  return [{ species, item, ability, moves }];
};

/* ---- WHAT EACH ENGINE HOLDS ---------------------------------------------------------------------
 * medicham2's own field names, read off its header block (`_lastItem` = `Pokemon#lastItem`,
 * `_ateBerry` = `Pokemon#ateBerry`). Nothing is recomputed here — both sides are a raw field read, so
 * a disagreement is the engines' and never this reader's. */
const mediPair = (m) => ({ lastItem: N.id(m._lastItem || ''), ateBerry: !!m._ateBerry });
const sdPair = (p) => ({ lastItem: N.id(p.lastItem || ''), ateBerry: !!p.ateBerry });
const fmt = (x) => (x.lastItem || '-') + '/' + (x.ateBerry ? 'ate' : '--');

const ARMS = [
  { id: 'ko-leftovers', kind: 'REMOVAL', hpBoost: 8,
    why: 'Knock Off takes an inert item — the row\'s own wrong_if',
    expect: 'neither engine writes either field',
    A: ['pangoro', '', 'Iron Fist', ['Knock Off', 'Protect']],
    B: ['gengar', 'Leftovers', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'knockoff', p2: 'suckerpunch' },
  { id: 'ko-colbur', kind: 'CONSUMPTION', hpBoost: 8,
    why: 'the published knock_off_roadmap_80 arm — Colbur resists the Dark move and is EATEN inside '
       + 'the damage calculation, so Knock Off never gets to take it',
    expect: 'BOTH engines write colburberry / ate',
    A: ['pangoro', '', 'Iron Fist', ['Knock Off', 'Protect']],
    B: ['gengar', 'Colbur Berry', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'knockoff', p2: 'suckerpunch' },
  { id: 'ko-sitrus', kind: 'REMOVAL', hpBoost: 3,
    why: 'Sitrus is `onUpdate` and tests hp <= maxhp/2 AFTER the hit, by which time the item is '
       + 'already gone — a removal that a careless model records as an eat',
    expect: 'neither engine writes either field',
    A: ['pangoro', '', 'Iron Fist', ['Knock Off', 'Protect']],
    B: ['gengar', 'Sitrus Berry', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'knockoff', p2: 'suckerpunch' },
  { id: 'eat-sitrus', kind: 'CONSUMPTION', hpBoost: 3,
    why: 'THE CONTROL. The same berry on the same body, crossed below half by a move that does not '
       + 'strip. If this arm does not write on both engines the fixture is broken and every other '
       + 'row here is unreadable.',
    expect: 'BOTH engines write sitrusberry / ate',
    A: ['pangoro', '', 'Iron Fist', ['Crunch', 'Protect']],
    B: ['gengar', 'Sitrus Berry', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'crunch', p2: 'suckerpunch' },
  { id: 'sash-used', kind: 'CONSUMPTION', hpBoost: 1,
    why: 'the `useItem` family. Showdown writes `lastItem` at sim/pokemon.ts:1846; medicham2 spends '
       + 'the Sash through `_sv.consumesItem` and, until 2026-09-10, wrote no field at all. THIS IS '
       + 'THE ARM THAT WAS RED. It read `-/--` against `focussash/--` on the run that first wired the '
       + 'board leaf, and 192 of 961 pinned-pool games parted on exactly this. `recordItemUsed` is '
       + 'the door it now goes through.',
    expect: 'BOTH engines write focussash / -- . `ateBerry` stays FALSE: nothing was eaten, which is '
          + 'the authority's own split between `useItem` and `eatItem` and not a narrowing here.',
    A: ['pangoro', '', 'Iron Fist', ['Crunch', 'Protect']],
    B: ['gengar', 'Focus Sash', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'crunch', p2: 'suckerpunch' },
  { id: 'trick-swap', kind: 'REMOVAL', hpBoost: 8,
    why: 'a SWAP — `takeItem` then `setItem` on both bodies',
    expect: 'neither engine writes either field on either body',
    A: ['pangoro', 'Leftovers', 'Iron Fist', ['Knock Off', 'Protect']],
    B: ['gengar', 'Sitrus Berry', 'Cursed Body', ['Trick', 'Protect']],
    p1: 'protect', p2: 'trick' },
  { id: 'thief-steal', kind: 'REMOVAL', hpBoost: 8,
    why: 'a removal where the item MOVES to the attacker',
    expect: 'neither engine writes either field on either body',
    A: ['pangoro', '', 'Iron Fist', ['Thief', 'Protect']],
    B: ['gengar', 'Leftovers', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'thief', p2: 'suckerpunch' },
  /* ---- THE BENCH ARM, AND THE ACTIVES-ONLY READER ABOVE CANNOT SEE IT ----------------------------
   * `board_state.js` compares the PARTY as well as the two standing bodies, so a leaf is compared on
   * a benched body too. That is a different question from the seven above: the authority keeps ONE
   * `Pokemon` object per party slot and `clearVolatile` touches neither field, so a berry eaten before
   * a switch is still recorded on the bench. medicham2 must carry the same two fields across its own
   * switch-out, and NOTHING in the seven arms above would notice if it did not. */
  { id: 'eat-then-switch', kind: 'CONSUMPTION', hpBoost: 3, bench: 'gengar',
    why: 'the berry is eaten and the body then LEAVES. Both engines must still hold the record on the '
       + 'benched body — neither `clearVolatile` nor a medicham2 switch-out may drop it.',
    expect: 'BOTH engines hold sitrusberry / ate on the BENCHED Gengar',
    A: ['pangoro', '', 'Iron Fist', ['Crunch', 'Protect']],
    B: ['gengar', 'Sitrus Berry', 'Cursed Body', ['Sucker Punch', 'Protect']],
    p1: 'crunch', p2: 'suckerpunch', p2turn2: { sw: 'corviknight' } },
];

console.log('\n  ITEM DISPOSITION — `lastItem` / `ateBerry`, RAW, FROM BOTH ENGINES');
console.log('  (printed BEFORE the leaf is wired. `-/--` is "no field written".)\n');
console.log('  ' + 'arm'.padEnd(14) + 'kind'.padEnd(13) + 'body'.padEnd(10)
  + 'medicham2'.padEnd(22) + 'showdown'.padEnd(22) + 'verdict');

const rows = [];
let parted = 0, removalParted = 0;
for (const arm of ARMS) {
  const A = one(...arm.A).concat(BENCH('clefable', 'milotic', 'weavile'));
  const B = one(...arm.B).concat(BENCH('toxapex', 'corviknight', 'snorlax'));
  const a = G.buildPair(A, { hpBoost: arm.hpBoost }), b = G.buildPair(B, { hpBoost: arm.hpBoost });
  if (!a || !b) { rows.push({ ...arm, verdict: 'COULD NOT BUILD THE PAIR' }); continue; }
  const script = [{ p1: [{ m: arm.p1, t: arm.p1 === 'protect' ? undefined : 0 }, { m: 'protect' }],
                    p2: [{ m: arm.p2, t: arm.p2 === 'protect' ? undefined : 0 }, { m: 'protect' }] },
                  { p1: [{ m: 'protect' }, { m: 'protect' }],
                    p2: [arm.p2turn2 || { m: 'protect' }, { m: 'protect' }] },
                  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }];
  /* BOTH SIDES' LEAD SLOT, at every boundary, unioned — `lastItem` and `ateBerry` are NOT cleared at
   * a turn reset in either engine (medicham2 says so out loud beside its `_usedItemThisTurn` reset;
   * Showdown clears neither in `clearVolatile`), so a later boundary can only confirm an earlier one.
   * Reading every boundary is what stops a probe asserting the state is still there when it looks. */
  const seen = { p1: [], p2: [] };
  const r = G.playGame(a, b, 'directed', 'itemdisp/' + arm.id, { script,
    onBoundary: (snap, turnIdx, S, battle) => {
      /* A BENCH ARM READS THE BODY BY NAME, WHEREVER IT IS STANDING. `S.actB`/`S.benchB` and the
       * authority's `side.pokemon` are asked for the SAME named body, so the arm keeps measuring the
       * one body it is about after the switch rather than whoever replaced it. Without this an
       * eat-then-switch arm silently starts reporting the REPLACEMENT's empty fields as a match. */
      const byName = (list, get) => (arm.bench ? (list || []).find(x => x && N.id(get(x)) === arm.bench) : (list || [])[0]);
      const mA = (S.actA || [])[0], sA = battle.sides[0].active[0];
      const mB = arm.bench ? byName([...(S.actB || []), ...(S.benchB || [])], x => x.name)
                           : (S.actB || [])[0];
      const sB = arm.bench ? byName(battle.sides[1].pokemon, x => x.species && x.species.id)
                           : battle.sides[1].active[0];
      if (mA && sA) seen.p1.push({ b: turnIdx, medi: mediPair(mA), sd: sdPair(sA) });
      if (mB && sB) seen.p2.push({ b: turnIdx, medi: mediPair(mB), sd: sdPair(sB) });
      else if (arm.bench) seen.p2.push({ b: turnIdx, medi: { lastItem: 'BODY-NOT-FOUND', ateBerry: false },
                                         sd: { lastItem: 'BODY-NOT-FOUND', ateBerry: false } });
    } });
  /* THE LAST BOUNDARY IS THE SETTLED STATE and the full per-boundary list is kept in the row so a
   * reader can tell "written and then cleared" from "never written" — two different facts. */
  const row = { id: arm.id, kind: arm.kind, why: arm.why, expect: arm.expect, err: r.err, bodies: {} };
  for (const side of ['p1', 'p2']) {
    const last = seen[side][seen[side].length - 1];
    if (!last) continue;
    const same = last.medi.lastItem === last.sd.lastItem && last.medi.ateBerry === last.sd.ateBerry;
    row.bodies[side] = { medi: last.medi, sd: last.sd, match: same, boundaries: seen[side] };
    if (!same) { parted++; if (arm.kind === 'REMOVAL') removalParted++; }
    console.log('  ' + arm.id.padEnd(14) + arm.kind.padEnd(13) + side.padEnd(10)
      + fmt(last.medi).padEnd(22) + fmt(last.sd).padEnd(22) + (same ? 'MATCH' : 'PARTS'));
  }
  if (r.err) console.log('      [game threw: ' + r.err + ']');
  rows.push(row);
}

console.log('\n  WHAT EACH ARM WAS FOR');
for (const arm of ARMS) console.log('    ' + arm.id.padEnd(14) + arm.expect);

console.log('\n  THE FALSIFICATION');
if (removalParted) {
  console.log('    REFUSED — ' + removalParted + ' body/bodies PART on a REMOVAL arm. A removal path in one');
  console.log('    engine writes a field the other does not, so the leaf would manufacture divergences.');
} else {
  console.log('    SURVIVED — every REMOVAL arm reads identically on both engines. No removal path in');
  console.log('    either engine writes `lastItem` or `ateBerry`.');
}
const consParted = parted - removalParted;
console.log('    CONSUMPTION arms parting: ' + consParted + (consParted
  ? '   <- an ENGINE state disagreement the leaf would reveal, not a reason to refuse it'
  : ''));

const fs = require('fs');
fs.writeFileSync(D('data', 'verification', 'probe-item-disposition.json'), JSON.stringify({
  generated: new Date().toISOString(),
  what: 'the wrong_if falsification for the item-disposition leaf — raw `lastItem`/`ateBerry` from both engines',
  removal_arms_parting: removalParted,
  consumption_arms_parting: consParted,
  verdict: removalParted ? 'REFUSED — a removal path writes the field' : 'SURVIVED — no removal path writes the field',
  arms: rows,
}, null, 1) + '\n');
console.log('\n  wrote data/verification/probe-item-disposition.json\n');
process.exit(removalParted ? 1 : 0);
