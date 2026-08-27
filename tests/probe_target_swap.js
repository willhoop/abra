#!/usr/bin/env node
/* probe_target_swap.js — THE OUTRAGE THAT LANDED ON THE OTHER BODY.
 *
 * DIAGNOSTIC ONLY. It lands nothing, it edits nothing, it runs no differential and no roster.
 * Everything it needs is already in two committed artifacts and in the two hash bodies, so it is a
 * second or two of arithmetic rather than a run.
 *
 * THE QUESTION. `baseline / …bo3-2635122796 vs …bo3-2634861011` parts at turn 2: one engine damages
 * p2a and the other damages p2b. Four shapes produce that and have four different fixes — a spread
 * move mis-splitting, a redirect, a slot-index confusion, and a random-target draw. This file
 * separates them by PREDICTING both engines' chosen bodies from the address strings alone, under
 * both hash generations, and checking the prediction against what each artifact recorded.
 *
 * WHY THE PREDICTION IS NOT A FIT. Every input is read or derived before the answer is looked at:
 *   - the seed          `MEDI.MID_EVENT_SEED`, required out of the engine, never typed;
 *   - the turn          the artifact's own `turn` field;
 *   - the authority nth MEASURED by `tests/probe_random_target_address.js` and published in
 *                       ROADMAP #478 / docs/_reports/2026-08-27-random-target-address.md as
 *                       `20260813|2|any|-|-|3`. One prior number, used for four predictions;
 *   - our own address   `…|any|<move>|<slot>|0`, and it is evaluated at ALL THREE slot values it
 *                       could carry, so no slot is chosen to make the answer come out.
 * Four predictions (two engines x two hash generations) from one prior. A slot-index flip, a
 * redirect or a spread split cannot produce four hits.
 *
 * THE CONTROLS, because a probe that cannot miss says nothing:
 *   - WRONG TURN. The same addresses evaluated at turn+1 must not reproduce the artifacts.
 *   - THE KNOB. `nth` swept 0..11 must MOVE the pick under the mixed hash and must NOT move it
 *     under the bare one. Identical output across a varied knob is an unwired knob; here it is the
 *     defect the die fix removed, and it is asserted in both directions.
 *   - THE FIXTURE. A cell with fewer than two living foes has no choice to get wrong. The living
 *     count is derived per cell and any cell under two is REFUSED rather than scored.
 */
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const MEDI = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));

let RED = 0, GREEN = 0;
const ok = (name, cond, detail) => {
  if (cond) { GREEN++; console.log('  PASS  ' + name + (detail ? '   ' + detail : '')); }
  else { RED++; console.log('  FAIL  ' + name + (detail ? '   ' + detail : '')); }
};

/* ---------------------------------------------------------------- the two hash generations ------
 * THE MIXED ONE IS NOT RE-IMPLEMENTED. `midEventValue` is required out of the engine, which is the
 * facts-are-global rule: `engine/game_differential.js` carries a byte-identical body and
 * `tests/test-middle-identity.js` holds a third copy and asserts all three agree, so computing both
 * sides with the engine's copy is the correct single implementation rather than a shortcut.
 *
 * THE BARE ONE IS HISTORY AND HAS TO BE WRITTEN HERE. It is the pre-2026-08-27 body — FNV-1a with
 * nothing after the loop — cited to `docs/_reports/2026-08-27-die-mixing-fix.md`, which quotes it as
 * `h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0` with "nothing after it". It exists only so
 * the PRE-fix artifact can be predicted too; nothing in the repository runs it any more. */
const vNew = (ctx) => MEDI.midEventValue(ctx);
function vOld(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return (h >>> 0) / 4294967296;
}
/* Showdown's `sample(items)` is `items[this.random(items.length)]` and the middle arm's `random(m)`
 * is `Math.floor(u * m)` — engine/game_differential.js `pinRandom`. medicham2's WIRE 144 draw is
 * `_rlive[Math.floor(rng()*_rlive.length) % _rlive.length]`. Same map on both sides. */
const pick = (u, n) => Math.floor(u * n);

/* ---------------------------------------------------------------- artifacts, read stably ---------
 * `git show` rather than the working tree: CLAUDE.md's torn-read rule. Four other agents are live
 * and `data/game-differential.json` is rewritten by any differential run. */
function gitShow(rev, file) {
  return JSON.parse(execFileSync('git', ['-C', ROOT, 'show', rev + ':' + file], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }));
}
const PRE_REV = process.env.TS_PRE_REV || 'e3587c62';   // the last artifact stamped before the die fix
const NOW = gitShow('HEAD', 'data/game-differential.json');
const PRE = gitShow(PRE_REV, 'data/game-differential.json');

console.log('probe_target_swap — the address, not the rule');
console.log('  HEAD artifact   release ' + NOW.engine_release + '  generated ' + NOW.generated
            + '  pin ' + (NOW.pins && NOW.pins.digest));
console.log('  ' + PRE_REV + ' artifact   release ' + PRE.engine_release + '  generated ' + PRE.generated);
console.log('  MID_EVENT_SEED (from the engine, not typed): ' + MEDI.MID_EVENT_SEED);
console.log('');

/* ---------------------------------------------------------------- 1. THE FIXTURE ------------------
 * Every `-damage: a different body` first divergence in the HEAD artifact, with its move derived
 * from the protocol line, its target type derived from the format, and its living-foe count derived
 * from the board leaves. A cell with fewer than two living foes is REFUSED. */
console.log('1. THE FIXTURE — derived per cell, and refused when it is under-determined');

let Dex = null;
try {
  const SD = process.env.SHOWDOWN_PATH;
  if (SD) Dex = require(SD + '/dist/sim').Dex.forFormat('gen9championsvgc2026regmb');
} catch (e) { console.error('  DEX LOAD FAILED (the target-type clause cannot run):', e.message); Dex = null; }
if (!Dex) console.log('  (SHOWDOWN_PATH unset or unloadable — the target-type clause will be skipped, LOUDLY)');

const legal = x => x && x.exists && !x.isNonstandard;

function fixturesFrom(art) {
  const rows = [];
  for (const fd of (art.first_divergences || [])) {
    if (fd.cls !== '-damage: a different body') continue;
    const mvLine = (fd.showdown_before || []).filter(l => l.startsWith('|move|')).pop();
    const bm = mvLine && mvLine.split('|');          // ['', 'move', 'p1b: Garchomp', 'Outrage', 'p2b: …']
    const moveName = bm && bm[3];
    const sdBody = (fd.showdown || '').split('|')[2];     // 'p2a: Staraptor'
    const meBody = (fd.medicham || '').split('|')[2];
    rows.push({
      seed: fd.seed, config: fd.config, turn: fd.turn,
      attacker: bm && bm[2], moveName,
      moveId: moveName ? moveName.toLowerCase().replace(/[^a-z0-9]/g, '') : null,
      sdSlot: sdBody && sdBody.split(':')[0].trim(),
      meSlot: meBody && meBody.split(':')[0].trim(),
    });
  }
  return rows;
}

/* THE LIVING-FOE COUNT, DERIVED AND SYMMETRIC. The board row for the same game carries
 * `p2.active[i].hp` for both engines; a foe is a legal target when BOTH engines still have it
 * above zero, which is the same predicate on both sides (`!fainted && hp > 0` in medicham2's
 * `_live`, `filter(a=>a).filter(a=>!!a.hp)` in Showdown's `Side#allies`). Comparing our array
 * membership against their boolean flag is the asymmetry that produced a false row tonight; this
 * compares counts of the same predicate. */
function livingFoes(art, seed, side) {
  const bd = (art.state.first_board_divergences || []).find(d => d.seed === seed);
  if (!bd) return null;
  const slots = new Map();
  for (const d of bd.diffs) {
    const m = /^(p\d)\.active\[(\d)\]\.hp$/.exec(d.path);
    if (m && m[1] === side) slots.set(Number(m[2]), d);
  }
  if (!slots.size) return null;
  let n = 0;
  for (const [, d] of slots) if (d.medicham > 0 && d.showdown > 0) n++;
  return { seen: slots.size, alive: n };
}

const FIX = fixturesFrom(NOW);
ok('the HEAD artifact carries exactly one `-damage: a different body` first divergence',
   FIX.length === 1, '(' + FIX.length + ')');

const CELLS = [];
for (const f of FIX) {
  const side = f.sdSlot ? f.sdSlot.slice(0, 2) : null;
  const lf = livingFoes(NOW, f.seed, side);
  console.log('  cell  ' + f.seed);
  console.log('        ' + f.config + '  turn ' + f.turn + '   ' + f.attacker + ' used ' + f.moveName
              + '   showdown hit ' + f.sdSlot + ', medicham2 hit ' + f.meSlot);
  if (Dex) {
    const mv = Dex.moves.get(f.moveId);
    console.log('        target type, derived from the format: ' + (legal(mv) ? mv.target : 'NOT LEGAL IN THIS FORMAT'));
    ok('the move is legal in Champions Reg M-B and its target type is `randomNormal`',
       legal(mv) && mv.target === 'randomNormal', '(' + f.moveId + ' -> ' + (mv && mv.target) + ')');
    ok('it is NOT a spread move (a spread mis-split would show `allAdjacentFoes`)',
       legal(mv) && !['allAdjacentFoes', 'allAdjacent'].includes(mv.target));
  }
  if (!lf) { console.log('        REFUSED — no board leaves for that side, the living count is not derivable'); continue; }
  console.log('        living foes on ' + side + ' at the divergence, both engines agreeing they live: '
              + lf.alive + ' of ' + lf.seen + ' slots');
  if (lf.alive < 2) { console.log('        REFUSED — fewer than two living targets, there is no choice to get wrong'); continue; }
  CELLS.push(f);
}
ok('at least one cell survives the two-living-targets floor', CELLS.length >= 1,
   '(' + CELLS.length + ' of ' + FIX.length + ')');
console.log('');

/* ---------------------------------------------------------------- 2. OUR ENGINE TAKES A DRAW -----
 * Derived from the tag artifact, not asserted. If the move carries no `randomTarget` tag then
 * medicham2's WIRE 144 block never runs and the whole diagnosis is wrong. */
console.log('2. DOES medicham2 DRAW AT ALL — the tag, read out of data/tags.json');
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
for (const f of CELLS) {
  const t = TAGS.moves && TAGS.moves[f.moveId];
  const has = !!(t && t.tags && t.tags.includes('randomTarget'));
  console.log('  ' + f.moveId + '  tags: ' + (t ? t.tags.join(',') : 'NONE'));
  console.log('     randomTarget params: ' + JSON.stringify(t && t.params && t.params.randomTarget));
  ok('the move carries `randomTarget`, so WIRE 144 re-rolls and a draw really is taken', has);
}
console.log('');

/* ---------------------------------------------------------------- 3. THE PREDICTION --------------
 * The authority draws in the BLANK bucket because `runMove` calls `getTarget` on its line 223 and
 * `setActiveMove` only on line 244 (pokemon-showdown/sim/battle-actions.ts), so `battle.activeMove`
 * and `battle.activeTarget` are still null and `midDraw` writes `-` into both fields.
 *
 * medicham2 writes MID_MOVE / MID_TGT at the TOP of the action (medicham2-browser.js:21029-21031)
 * and the WIRE 144 draw sits ~165 lines below it, so our address carries the move id and a target
 * slot. Those are two different strings, and after the fmix32 finaliser two different strings are
 * two independent values. That is the entire defect. */
console.log('3. THE PREDICTION — both engines, both hash generations, from the addresses alone');

const AUTH_NTH = Number(process.env.TS_AUTH_NTH || 3);   // MEASURED, ROADMAP #478 / the 2026-08-27 report
const SEED = MEDI.MID_EVENT_SEED;

function slotIndex(slot) { return slot.charCodeAt(2) - 97; }   // 'p2a' -> 0, 'p2b' -> 1

for (const f of CELLS) {
  const nFoes = livingFoes(NOW, f.seed, f.sdSlot.slice(0, 2)).alive;
  const authAddr = [SEED, f.turn, 'any', '-', '-', AUTH_NTH].join('|');
  /* Every slot our address could be carrying — the named target, either foe, or the `-` a cleared
   * field leaves. No one of them is chosen; the claim is only sound if they agree. */
  const ourAddrs = ['p20', 'p21', '-'].map(tg => [SEED, f.turn, 'any', f.moveId, tg, 0].join('|'));

  const pre = (PRE.first_divergences || []).find(d => d.seed === f.seed);
  const preSd = pre && (pre.showdown || '').split('|')[2].split(':')[0].trim();
  const preMe = pre && (pre.medicham || '').split('|')[2].split(':')[0].trim();

  console.log('  ' + f.seed);
  console.log('    authority address   ' + authAddr + '     (nth MEASURED by probe_random_target_address)');
  console.log('    our address         ' + ourAddrs[0] + '   [and |p21|0, |-|0]');
  console.log('    living foes ' + nFoes + '   index 0 = ' + f.sdSlot.slice(0, 2) + 'a, index 1 = ' + f.sdSlot.slice(0, 2) + 'b');
  console.log('');
  console.log('             hash        value      pick   body      artifact says');
  const rows = [
    ['authority', 'mixed', vNew(authAddr), f.sdSlot, 'HEAD'],
    ['authority', 'bare ', vOld(authAddr), preSd, PRE_REV],
  ];
  for (const [who, gen, u, observed, which] of rows) {
    const p = pick(u, nFoes);
    const predicted = f.sdSlot.slice(0, 2) + 'ab'[p];
    console.log('    ' + who + '  ' + gen + '   ' + u.toFixed(6) + '    ' + p + '    ' + predicted
                + '      ' + observed + ' (' + which + ')');
    ok('the ' + gen.trim() + ' hash predicts the AUTHORITY body recorded in the ' + which + ' artifact',
       predicted === observed, predicted + ' vs ' + observed);
  }
  for (const [gen, vf, observed, which] of [['mixed', vNew, f.meSlot, 'HEAD'], ['bare ', vOld, preMe, PRE_REV]]) {
    const picks = ourAddrs.map(a => pick(vf(a), nFoes));
    const agreed = picks.every(p => p === picks[0]);
    const predicted = f.meSlot.slice(0, 2) + 'ab'[picks[0]];
    console.log('    medicham2  ' + gen + '   ' + ourAddrs.map(a => vf(a).toFixed(4)).join(' ')
                + '   picks ' + picks.join(',') + '   ' + predicted + '      ' + observed + ' (' + which + ')');
    ok('all three possible target-slot spellings give ONE pick, so no slot was chosen to fit', agreed);
    ok('the ' + gen.trim() + ' hash predicts the MEDICHAM2 body recorded in the ' + which + ' artifact',
       predicted === observed, predicted + ' vs ' + observed);
  }
  ok('the two engines picked DIFFERENT bodies under BOTH hash generations — the die fix flipped '
     + 'both sides and the divergence survived, which is what an unshared address looks like',
     f.sdSlot !== f.meSlot && preSd && preMe && preSd !== preMe
     && f.sdSlot !== preSd && f.meSlot !== preMe,
     'HEAD ' + f.sdSlot + '/' + f.meSlot + '   ' + PRE_REV + ' ' + preSd + '/' + preMe);
  console.log('');

  /* -------------------------------------------------------------- 4. CONTROLS ---------------- */
  console.log('4. CONTROLS');
  const wrongAuth = [SEED, f.turn + 1, 'any', '-', '-', AUTH_NTH].join('|');
  const wrongOurs = [SEED, f.turn + 1, 'any', f.moveId, 'p20', 0].join('|');
  const wa = f.sdSlot.slice(0, 2) + 'ab'[pick(vNew(wrongAuth), nFoes)];
  const wo = f.meSlot.slice(0, 2) + 'ab'[pick(vNew(wrongOurs), nFoes)];
  console.log('    WRONG TURN   ' + wrongAuth + ' -> ' + wa + '   (artifact ' + f.sdSlot + ')');
  console.log('    WRONG TURN   ' + wrongOurs + ' -> ' + wo + '   (artifact ' + f.meSlot + ')');
  ok('the wrong-turn address does NOT reproduce both artifact bodies, so the probe could have missed',
     !(wa === f.sdSlot && wo === f.meSlot));

  const sweepNew = [], sweepOld = [];
  for (let n = 0; n < 12; n++) {
    const a = [SEED, f.turn, 'any', '-', '-', n].join('|');
    sweepNew.push(pick(vNew(a), nFoes)); sweepOld.push(pick(vOld(a), nFoes));
  }
  console.log('    nth 0..11, mixed hash   picks ' + sweepNew.join('') + '   distinct '
              + new Set(sweepNew).size);
  console.log('    nth 0..11, bare  hash   picks ' + sweepOld.join('') + '   distinct '
              + new Set(sweepOld).size);
  ok('THE KNOB IS WIRED under the mixed hash — nth moves the pick', new Set(sweepNew).size > 1);
  ok('THE KNOB WAS NEARLY DEAD under the bare hash — ten consecutive nth gave one pick, which is '
     + 'the translation defect the die fix removed, shown rather than asserted',
     sweepOld.slice(0, 10).every(p => p === sweepOld[0]));
  console.log('');
}

/* ---------------------------------------------------------------- 5. THE STALE REMEDY ------------
 * ROADMAP #478's proposed fix is "blank our move and target fields so our address matches the
 * authority's base". It cannot match the authority's `nth` — the authority's blank bucket is eleven
 * call sites and its target draw sits at nth 1..11, NEVER 0 (measured, 137 draws). The proposal
 * scored 99.3% ONLY because the bare hash translated `nth` instead of mixing it. That hash is gone.
 *
 * This clause does not need a differential run: independence is a property of the hash, and the
 * candidate-count and nth distributions are READ from the published measurement. */
console.log('5. IS THE PROPOSED REMEDY STILL WORTH ANYTHING AFTER THE DIE FIX');
const NTH_HIST = { 1: 13, 2: 4, 3: 41, 4: 39, 5: 25, 6: 6, 7: 3, 8: 3, 9: 1, 10: 1, 11: 1 };  // READ: 2026-08-27 report §2
const N_ONE_CAND = 41, N_TWO_CAND = 96;                                                       // READ: same table
const N_DRAWS = N_ONE_CAND + N_TWO_CAND;
const nthList = [];
for (const k of Object.keys(NTH_HIST)) for (let i = 0; i < NTH_HIST[k]; i++) nthList.push(Number(k));

function projectedAgreement(vf) {
  /* The 41 one-candidate draws agree by construction. For the 96 two-candidate draws, sweep real
   * address shapes and count how often the blanked nth=0 value and the authority's nth value fall
   * the same side of 0.5. ASSUMPTION, STATED: nth is independent of the candidate count — the
   * published table gives the two marginals and not the joint. */
  let agree = 0;
  for (let i = 0; i < N_TWO_CAND; i++) {
    const nth = nthList[i % nthList.length];
    const base = [SEED, 2 + (i % 11), 'any', '-', '-'].join('|') + '#' + i;
    if (pick(vf(base + '|0'), 2) === pick(vf(base + '|' + nth), 2)) agree++;
  }
  return (N_ONE_CAND + agree) / N_DRAWS;
}
const projNew = projectedAgreement(vNew), projOld = projectedAgreement(vOld);
const FLOOR = (N_ONE_CAND + N_TWO_CAND / 2) / N_DRAWS;
console.log('    published, bare hash, 137 REAL draws        99.3%   (136 of 137)');
console.log('    this file, bare hash, projected             ' + (projOld * 100).toFixed(1) + '%');
console.log('    this file, MIXED hash, projected            ' + (projNew * 100).toFixed(1) + '%');
console.log('    a coin over the same candidates (floor)     ' + (FLOOR * 100).toFixed(1) + '%');
ok('the bare-hash projection reproduces the published 99.3%, so the model of the remedy is right',
   projOld > 0.95, (projOld * 100).toFixed(1) + '%');
ok('UNDER THE MIXED HASH THE REMEDY IS A COIN — ROADMAP #478\'s 99.3% was measured on a hash that '
   + 'no longer exists, and its decision is STALE',
   Math.abs(projNew - FLOOR) < 0.06, (projNew * 100).toFixed(1) + '% vs floor ' + (FLOOR * 100).toFixed(1) + '%');
console.log('');

/* ---------------------------------------------------------------- 6. THE RIVALS, FALSIFIED -------
 * The decisive argument is not the four predictions — it is what CANNOT change when a hash changes.
 * `midHash` gained a finaliser between the two artifacts. Nothing else about targeting moved: no
 * redirect handler, no slot arithmetic, no spread splitter, no `Side#allies` ordering. A redirect, a
 * slot-index confusion and a spread mis-split all resolve WITHOUT CONSUMING A DIE, so under any of
 * those three hypotheses the body Showdown hits is invariant to the hash. It is not invariant: it
 * moved p2a -> p2b. Only a die-driven target choice can do that. */
console.log('6. THE THREE RIVAL HYPOTHESES, FALSIFIED BY A THING THAT CANNOT MOVE');
for (const f of CELLS) {
  const pre = (PRE.first_divergences || []).find(d => d.seed === f.seed);
  const preSd = pre && (pre.showdown || '').split('|')[2].split(':')[0].trim();
  const preMe = pre && (pre.medicham || '').split('|')[2].split(':')[0].trim();
  console.log('    the ONLY targeting-relevant change between the two artifacts is midHash gaining');
  console.log('    fmix32 (ROADMAP #489). Showdown\'s chosen body: ' + preSd + '  ->  ' + f.sdSlot);
  ok('the AUTHORITY\'s chosen body moved across a pure hash change, so its target came from a DIE — '
     + 'a redirect, a slot-index flip and a spread mis-split are all hash-invariant and are refuted',
     preSd !== f.sdSlot, preSd + ' -> ' + f.sdSlot);
  ok('medicham2\'s chosen body moved too, so BOTH sides drew — the disagreement is two dice, not one '
     + 'engine applying a rule the other does not',
     preMe !== f.meSlot, preMe + ' -> ' + f.meSlot);
}
console.log('');

console.log(RED === 0 ? 'ALL ' + GREEN + ' CLAUSES PASS' : GREEN + ' pass, ' + RED + ' FAIL');
process.exit(RED === 0 ? 0 : 1);
