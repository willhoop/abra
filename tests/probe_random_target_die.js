/* probe_random_target_die.js — WHEN TWO FOES ARE ALIVE, DO THE TWO ENGINES SEND A `randomNormal`
 * MOVE AT THE SAME BODY?
 *
 *   SHOWDOWN_PATH=... node tests/probe_random_target_die.js
 *   SHOWDOWN_PATH=... node tests/probe_random_target_die.js --red     (the restore arm, run for you)
 *
 * ================= WHAT THE AUTHORITY DOES ======================================================
 *
 * `sim/battle.ts:2461`, read in full:
 *
 *     if (move.target !== 'randomNormal' && this.validTargetLoc(targetLoc, pokemon, move.target)) {
 *       ... return the selected target ...
 *     }
 *     return this.getRandomTarget(pokemon, move);
 *
 * The named-target branch is GATED OFF for `randomNormal`, so every one of those moves falls to
 * `getRandomTarget` (`:2487`) -> `Side#randomFoe` (`sim/side.ts:367`) -> `Battle#sample` ->
 * `PRNG#sample` -> `random(len)`. **Which foe an Outrage hits in a double is a DIE.** Both engines
 * roll it; the question this file asks is whether they roll the SAME one.
 *
 * ================= WHY THEY DID NOT, AND IT IS AN ADDRESS AND NOT A RULE ==========================
 *
 * The middle arm keys both engines' dice on `seed|turn|category|move|target|nth`. The authority calls
 * `getTarget` on `sim/battle-actions.ts:223` and `setActiveMove` only on `:245`, so at draw time
 * `battle.activeMove` and `battle.activeTarget` are both null and the address carries NO MOVE NAME.
 * medicham2 writes `MID_MOVE`/`MID_TGT` at the top of the action and draws ~165 lines below, so its
 * address names the move and the TARGET SLOT.
 *
 * MEASURED on one staged board before this file existed — the seven authority draws of a single
 * Outrage turn, attributed by stack, against medicham2's one:
 *
 *     authority  20260813|1|any|-|-|0   resolveAction <- addChoice        <- lookahead
 *                20260813|1|any|-|-|1   getActionSpeed <- resolveAction   <- lookahead
 *                20260813|1|any|-|-|2..5  getActionSpeed <- runAction     <- lookahead x4
 *                20260813|1|any|-|-|6   getTarget <- runMove              <- THE REAL ONE
 *     medicham2  20260813|1|any|outrage|p20|0                             <- THE REAL ONE
 *
 * Two strings, two independent hash values, two different foes. The `nth` is not fixable by blanking
 * our fields either: the real draw sat at 6 because SIX lookahead draws — a family medicham2 does not
 * make at all — had already taken 0..5 out of the shared bucket.
 *
 * ================= WHAT THIS FILE MEASURES ======================================================
 *
 * The `|move|` line's TARGET, out of BOTH protocol streams, with no typed expectation. Every cell is
 * a staged one-side-clicks-a-randomNormal-move board played for up to three turns (the move LOCKS, so
 * turns 2 and 3 re-roll the target from a fresh address). Nothing below is typed:
 *
 *   the moves        every legal `target: 'randomNormal'` move in the format except Struggle
 *   the carriers     derived from each move's learnset, filtered to the regulation
 *   the address knob the ATTACKER SLOT (p1a / p1b) and the TURN — the two fields that actually move
 *                    the address. Sweeping the ALLY or the FOE PAIR would NOT: neither is in the
 *                    address, so every such cell would draw the same value and agreeing would prove
 *                    nothing. That is the control this file could most easily have got wrong.
 *
 * REFUSALS, because a cell that qualifies for one reason proves nothing and a cell that qualifies for
 * none proves less:
 *
 *   - living foes are counted PER MOVE LINE off both streams (`|switch|p2*` in, `|faint|p2*` out) and
 *     any cell under two is REFUSED, not scored. With one legal target there is no choice to get wrong.
 *   - the AUTHORITY's own answers must VARY across the sweep. If they do not, no die was ever read
 *     and a green result is an instrument that changed nothing. Same for medicham2's.
 *
 * THE OVER-FIRE CONTROL is the same carrier clicking an ordinary single-target move at a NAMED foe.
 * Both engines must honour the name, on every cell, clean and under the knob. A fix that moved these
 * would be changing an address that was already shared.
 *
 * `MEDI_TGT_ADDR_LEGACY=1` RESTORES THE DEFECT ON BOTH SIDES — medicham2 puts the draw back on the
 * generic stream under the action's own address, and `game_differential.js` does not install the
 * `getRandomTarget` wrapper, so the authority's draws fall back into the shared `any` bucket. One
 * knob, both halves, because restoring one half only would be a THIRD behaviour and not the red.
 *
 * ================= WHAT IT STRUCTURALLY CANNOT SEE ==============================================
 *
 * Whether either engine plays the game right — it compares one target ident per move line. Whether
 * the value a shared address yields is the value the REAL game would yield: the middle arm's die is a
 * hash and there is no ground truth for which foe, only the claim that both engines read the same one.
 * And every OTHER `getRandomTarget` caller — `useMoveInner`'s three retarget sites and
 * `sim/pokemon.ts:825`'s retarget-on-faint — which the address change reaches without a staged board
 * of its own: named, counted by the driver, not covered here.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const RED_CHILD = process.argv.includes('--red');
const KNOB_ON = process.env.MEDI_TGT_ADDR_LEGACY === '1';

/* Same reason as probe_multihit_update.js: every board here is staged, so the pool is pinned and the
 * cache slot is left alone. */
process.argv.push('--state', '--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const ARM = G.ARM_BY_ID.get('middle');
const mon = (species, moves) => ({ species, item: '', ability: '', moves });

let bad = 0;
console.log(NL + '=== THE FIXTURE, DERIVED THIS RUN (knob MEDI_TGT_ADDR_LEGACY='
  + (KNOB_ON ? '1' : 'unset') + ') ===');

/* ---- THE MOVES -------------------------------------------------------------------------------- */
const RT = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.target === 'randomNormal'
                                       && m.id !== 'struggle')
  .sort((a, b) => a.id.localeCompare(b.id));
console.log('  every legal `randomNormal` move in this format (Struggle excluded — no body can be'
  + ' made to click it on a turn it also has a usable move):');
const MOVES = [];
for (const m of RT) {
  const carriers = POOL.filter(s => LS(s)[m.id]);
  console.log('      ' + m.id.padEnd(14) + 'acc=' + m.accuracy + ' bp=' + m.basePower
    + '  carriers=' + carriers.length + (carriers.length ? '  first=' + carriers[0].name : '  UNUSABLE'));
  if (carriers.length) MOVES.push({ mv: m, carrier: carriers[0] });
}
if (MOVES.length < 2) {
  console.log('  NOT-STAGED — fewer than two usable randomNormal moves. That is a claim about the'
    + ' format, and with one move the ATTACKER SLOT is the only address knob left.');
  process.exit(1);
}

/* ---- THE ORDINARY-TARGET CONTROL MOVE, per carrier -------------------------------------------- */
const NORMAL = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.target === 'normal'
                                           && (m.accuracy === true || m.accuracy === 100)
                                           && m.basePower > 0 && !m.smartTarget && !m.multihit)
  .sort((a, b) => a.id.localeCompare(b.id));
const controlFor = sp => { const ls = LS(sp); return NORMAL.find(m => ls[m.id]) || null; };

/* ---- THE BODIES. Every species on the board is DISTINCT, across both sides, so a `|move|` line's
 * ident can never be ambiguous about which slot it names. ---------------------------------------- */
const USED = new Set();
function padTeam(actives) {
  const out = actives.slice();
  for (const m of actives) USED.add(norm(m.species));
  for (const s of POOL) {
    if (out.length >= 4) break;
    if (USED.has(norm(s.name))) continue;
    USED.add(norm(s.name)); out.push(mon(s.name, ['Protect']));
  }
  return out;
}
const buildSide = a => G.buildPair(padTeam(a));

/* ---- READING THE ANSWER OUT OF A STREAM -------------------------------------------------------
 *
 * One walk per stream returns, per turn, the target ident of every `|move|` line whose move folds to
 * the id we asked about, together with the number of LIVING p2 bodies at that instant. Both are read
 * off the protocol; nothing is inferred from the fixture. */
function walk(lines, mvId) {
  let turn = 0;
  const alive = new Set();
  const out = [];
  for (const raw of lines) {
    const l = Array.isArray(raw) ? '|' + raw.join('|') : String(raw);
    const p = l.split('|');
    const tok = p[1];
    if (tok === 'turn') { turn = Number(p[2]) || turn; continue; }
    if (tok === 'switch' || tok === 'drag' || tok === 'replace') {
      const slot = String(p[2] || '').slice(0, 3);
      if (/^p2[ab]$/.test(slot)) alive.add(slot);
      continue;
    }
    if (tok === 'faint') {
      const slot = String(p[2] || '').slice(0, 3);
      if (/^p2[ab]$/.test(slot)) alive.delete(slot);
      continue;
    }
    if (tok === 'move') {
      if (norm(p[3]) !== mvId) continue;
      const src = String(p[2] || '').slice(0, 3);
      const tgt = String(p[4] || '').slice(0, 3);
      out.push({ turn, src, tgt, liveFoes: alive.size });
    }
  }
  return out;
}

/* ---- THE SWEEP -------------------------------------------------------------------------------- */
const TURNS = 3;
const rows = [], ctrlRows = [];
const notPlayed = [], threw = [], refusedFewFoes = [], noLine = [];

for (const { mv, carrier } of MOVES) {
  const ctrl = controlFor(carrier);
  for (const slot of [0, 1]) {
    const filler = POOL.find(s => !USED.has(norm(s.name)));
    const foeA = POOL.find(s => !USED.has(norm(s.name)) && norm(s.name) !== norm(filler.name));
    const foeB = POOL.find(s => !USED.has(norm(s.name)) && norm(s.name) !== norm(filler.name)
                                && norm(s.name) !== norm(foeA.name));
    if (!filler || !foeA || !foeB) { threw.push(mv.id + '/slot' + slot + ': ran out of distinct species'); continue; }
    const attMoves = [mv.name].concat(ctrl ? [ctrl.name] : []).concat(['Protect']);
    const actives = slot === 0
      ? [mon(carrier.name, attMoves), mon(filler.name, ['Protect'])]
      : [mon(filler.name, ['Protect']), mon(carrier.name, attMoves)];
    const pa = buildSide(actives);
    const pb = buildSide([mon(foeA.name, ['Protect']), mon(foeB.name, ['Protect'])]);
    if (!pa || !pb) { threw.push(mv.id + '/slot' + slot + ': unbuildable'); continue; }

    /* ---- ARM 1: the randomNormal move, three turns (the lock re-rolls on 2 and 3) -------------- */
    const step = { p1: [null, null], p2: [{ m: 'protect' }, { m: 'protect' }] };
    step.p1[slot] = { m: mv.id };
    step.p1[1 - slot] = { m: 'protect' };
    const script = Array.from({ length: TURNS }, () => JSON.parse(JSON.stringify(step)));
    let r;
    try { r = G.playGame(pa, pb, 'directed', 'probe_random_target_die/' + mv.id + '/' + slot,
                         { script, arm: ARM }); }
    catch (e) { threw.push(mv.id + '/slot' + slot + ': ' + String((e && e.message) || e).split(NL)[0]); continue; }
    if (r.err || r.turns < 1) { notPlayed.push(mv.id + '/slot' + slot + ': ' + (r.err || ('turns ' + r.turns))); continue; }
    const sd = walk(G.sdStream(G.lastSdLog()), mv.id);
    const me = walk(r.mediTrace || [], mv.id);
    if (!sd.length || !me.length) { noLine.push(mv.id + '/slot' + slot + ' [sd ' + sd.length + ' / me ' + me.length + ']'); continue; }
    const n = Math.min(sd.length, me.length);
    for (let i = 0; i < n; i++) {
      if (sd[i].turn !== me[i].turn) break;                 /* the streams parted; stop comparing */
      if (sd[i].liveFoes < 2 || me[i].liveFoes < 2) {
        refusedFewFoes.push(mv.id + '/slot' + slot + '/t' + sd[i].turn
          + ' [sd ' + sd[i].liveFoes + ' / me ' + me[i].liveFoes + ']');
        continue;
      }
      rows.push({ mv: mv.id, slot, turn: sd[i].turn, src: sd[i].src,
                  live: sd[i].liveFoes + '/' + me[i].liveFoes,
                  sd: sd[i].tgt, me: me[i].tgt, agree: sd[i].tgt === me[i].tgt });
    }

    /* ---- ARM 2: the OVER-FIRE CONTROL — an ordinary `normal` move NAMED at p2b ----------------- */
    if (!ctrl) continue;
    const cstep = { p1: [null, null], p2: [{ m: 'protect' }, { m: 'protect' }] };
    cstep.p1[slot] = { m: ctrl.id, t: 1 };
    cstep.p1[1 - slot] = { m: 'protect' };
    let cr;
    try { cr = G.playGame(pa, pb, 'directed', 'probe_random_target_die/ctrl/' + ctrl.id + '/' + slot,
                          { script: [cstep], arm: ARM }); }
    catch (e) { threw.push('ctrl ' + ctrl.id + '/slot' + slot + ': ' + String((e && e.message) || e).split(NL)[0]); continue; }
    if (cr.err || cr.turns < 1) { notPlayed.push('ctrl ' + ctrl.id + '/slot' + slot + ': ' + (cr.err || ('turns ' + cr.turns))); continue; }
    const csd = walk(G.sdStream(G.lastSdLog()), ctrl.id);
    const cme = walk(cr.mediTrace || [], ctrl.id);
    if (!csd.length || !cme.length) { noLine.push('ctrl ' + ctrl.id + '/slot' + slot + ' [sd ' + csd.length + ' / me ' + cme.length + ']'); continue; }
    if (csd[0].liveFoes < 2 || cme[0].liveFoes < 2) {
      refusedFewFoes.push('ctrl ' + ctrl.id + '/slot' + slot); continue;
    }
    ctrlRows.push({ mv: ctrl.id, slot, sd: csd[0].tgt, me: cme[0].tgt,
                    agree: csd[0].tgt === cme[0].tgt, named: 'p2b' });
  }
}

/* ---- WHAT LEFT THE SWEEP IS NAMED. A cell dropped in silence looks exactly like one that agreed. */
console.log(NL + '=== THE SWEEP — ' + rows.length + ' scored randomNormal cells, '
  + ctrlRows.length + ' control cells ===');
if (threw.length) console.log('  THREW (' + threw.length + '): ' + threw.join(' | '));
if (notPlayed.length) console.log('  NOT PLAYED (' + notPlayed.length + '): ' + notPlayed.join(' | '));
if (noLine.length) console.log('  NO MOVE LINE, nothing to compare (' + noLine.length + '): ' + noLine.join(' | '));
if (refusedFewFoes.length) console.log('  REFUSED, fewer than two living foes (' + refusedFewFoes.length
  + '): ' + refusedFewFoes.join(' | '));

for (const r of rows) {
  console.log('  RANDOM  ' + r.mv.padEnd(12) + 'attacker=' + r.src + ' t' + r.turn
    + ' liveFoes=' + r.live
    + '   showdown -> ' + r.sd + '   medicham -> ' + r.me + '   ' + (r.agree ? 'AGREE' : 'DIFFERS'));
}
for (const r of ctrlRows) {
  console.log('  CONTROL ' + r.mv.padEnd(12) + 'slot=' + r.slot + ' named=' + r.named
    + '   showdown -> ' + r.sd + '   medicham -> ' + r.me + '   ' + (r.agree ? 'AGREE' : 'DIFFERS'));
}

/* ---- CLAUSE 1 — THE FIXTURE REACHED A DIE AT ALL ---------------------------------------------- */
if (rows.length < 4) {
  console.log(NL + 'NOT-STAGED — only ' + rows.length + ' scored cells. This file cannot distinguish'
    + ' a shared die from a coincidence on that few.');
  process.exit(1);
}
const sdSet = new Set(rows.map(r => r.src + '->' + r.sd));
const meSet = new Set(rows.map(r => r.src + '->' + r.me));
const sdTargets = new Set(rows.map(r => r.sd)), meTargets = new Set(rows.map(r => r.me));
console.log(NL + 'THE DIE WAS READ — authority answered ' + [...sdTargets].sort().join('/')
  + ' across the sweep; medicham answered ' + [...meTargets].sort().join('/') + '.');
if (sdTargets.size < 2) {
  console.log('  FAIL — the AUTHORITY named the same slot on every cell, so no die moved and a green'
    + ' agreement would prove nothing about the address.');
  bad++;
}
if (meTargets.size < 2) {
  console.log('  FAIL — MEDICHAM named the same slot on every cell. Its draw is not varying, so this'
    + ' fixture is not measuring a die on our side.');
  bad++;
}
void sdSet; void meSet;

/* ---- CLAUSE 1b — THE TWO ENGINES' OWN RECEIPTS ------------------------------------------------
 *
 * The rows above are read off a PROTOCOL. These are read off the machinery, so an agreement reached
 * without the draw ever happening cannot pass — the failure shape that produced arms reporting
 * IDENTICAL with zero draws. Both sides are asserted, because either one alone can be silent. */
const M2 = G.REL.require('engine/medicham2-browser.js');
const W = G.midWrapState();
console.log(NL + 'RECEIPTS');
console.log('  authority   getRandomTarget calls=' + W.tgtEnters + '   draws inside runMove=' + W.tgtInMove
  + '   lookahead draws=' + W.tgtLookahead + '   runMove entries=' + W.runMoveEnters
  + '   unnameable moves=' + W.tgtUnnameable
  + '   legacy=' + W.tgtLegacy);
if (W.tgtUnnameable) {
  console.log('  FAIL — ' + W.tgtUnnameable + ' target draw(s) could not name their move ('
    + W.tgtUnnameableFirst + '), so their address collapsed to the shared unnameable bucket. That is'
    + ' the defect this file is about, wearing the new category.');
  bad++;
}
console.log('  medicham2   randomTargetDrawn=' + M2.MEDSEEN.randomTargetDrawn
  + '   randomTargetAmbiguous=' + M2.MEDSEEN.randomTargetAmbiguous
  + '   randomTargetRerolled=' + M2.MEDSEEN.randomTargetRerolled
  + '   MEDFAILS.tgtStreamMissing=' + M2.MEDFAILS.tgtStreamMissing
  + '   MEDFAILS.tgtAddrLegacyRestored=' + M2.MEDFAILS.tgtAddrLegacyRestored);
if (M2.MEDSEEN.randomTargetDrawn === 0) {
  console.log('  FAIL — medicham2 took NO random-target draw all run. Every row above was decided'
    + ' without the die this file is about.');
  bad++;
}
if (M2.MEDSEEN.randomTargetAmbiguous !== M2.MEDSEEN.randomTargetDrawn) {
  console.log('  REFUSED — ' + (M2.MEDSEEN.randomTargetDrawn - M2.MEDSEEN.randomTargetAmbiguous)
    + ' draw(s) had ONE living foe, so this run scored a choice that did not exist. The fixture has'
    + ' drifted; fix the fixture rather than the threshold.');
  bad++;
}
if (M2.MEDFAILS.tgtStreamMissing) {
  console.log('  FAIL — medicham2 fell back to the generic stream ' + M2.MEDFAILS.tgtStreamMissing
    + ' time(s): the `tgt` stream did not reach `battleTurn`.');
  bad++;
}
if (KNOB_ON) {
  if (!M2.MEDFAILS.tgtAddrLegacyRestored) {
    console.log('  FAIL — the knob is set and medicham2 never announced the restore. It reached no code.');
    bad++;
  }
  if (W.tgtEnters !== 0) {
    console.log('  FAIL — the knob is set and the authority wrapper still ran ' + W.tgtEnters
      + ' time(s). Only half the defect was restored, which is a THIRD behaviour and not the red.');
    bad++;
  }
} else {
  if (M2.MEDFAILS.tgtAddrLegacyRestored) {
    console.log('  FAIL — the knob is UNSET and medicham2 announced the restore anyway.');
    bad++;
  }
  if (W.tgtInMove === 0) {
    console.log('  FAIL — the authority took NO target draw inside runMove. The shared category was'
      + ' never exercised, so a green agreement says nothing.');
    bad++;
  }
  if (W.tgtLookahead === 0) {
    console.log('  FAIL — the authority took NO lookahead target draw, so nothing was removed from'
      + ' the shared `any` bucket and the half of the fix that fixes `nth` is unproven here.');
    bad++;
  }
}

/* ---- CLAUSE 2 — THE CONTROL. An ordinary named target is honoured by both, always. ------------- */
if (!ctrlRows.length) {
  console.log('  FAIL — NO control cell was staged. Without it a green result cannot be told apart'
    + ' from an engine that sends every move at p2a.');
  bad++;
}
const ctrlBad = ctrlRows.filter(r => !r.agree || r.sd !== r.named || r.me !== r.named);
if (ctrlBad.length) {
  console.log('  FAIL — ' + ctrlBad.length + ' control cell(s) did not land on the NAMED foe: '
    + ctrlBad.map(r => r.mv + '/slot' + r.slot + ' sd=' + r.sd + ' me=' + r.me).join(', '));
  bad++;
}

/* ---- CLAUSE 3 — THE ANSWER ------------------------------------------------------------------- */
const differ = rows.filter(r => !r.agree);
console.log('AGREEMENT — ' + (rows.length - differ.length) + ' of ' + rows.length + ' cells agree.');
if (KNOB_ON) {
  if (!differ.length) {
    console.log('  FAIL — the knob is set and every cell still AGREED. It restored nothing, so the'
      + ' clean run\'s green says nothing.');
    bad++;
  } else {
    console.log('  the knob parted ' + differ.length + ' cell(s), which is the defect this file was'
      + ' written against: ' + differ.map(r => r.mv + '/t' + r.turn + '/' + r.src).join(', '));
  }
} else {
  if (differ.length) {
    console.log('  FAIL — ' + differ.length + ' cell(s) sent the move at DIFFERENT bodies: '
      + differ.map(r => r.mv + '/t' + r.turn + '/' + r.src + ' sd=' + r.sd + ' me=' + r.me).join(', '));
    bad++;
  }
}

/* ---- THE RESTORE ARM, RUN FOR YOU ------------------------------------------------------------- */
if (!RED_CHILD && !KNOB_ON) {
  const { spawnSync } = require('child_process');
  console.log(NL + '=== THE RESTORE ARM — MEDI_TGT_ADDR_LEGACY=1, in a child ===');
  /* THE CHILD INHERITS THE PARENT NODE FLAGS — 2026-08-28. Without this, a parent started with
   * `-r ./tests/_live_release.js` was redirected and its child was NOT: the child re-required
   * engine/game_differential.js with no --release, which CUTS A REAL RELEASE at require time and
   * REPOINTS data/engine-release.json under whatever else is measuring. Measured, not argued: a
   * redirected cut was shown NOT to touch data/engine-release.json, so every real cut seen during
   * a preloaded run came from here. process.execArgv is node OWN record of how this process was
   * started, so this reads the fact rather than re-deriving it. tests/probe_hazard_recap_fail.js
   * already did this by hand; this is the same fix at the four sites that did not. */
  const c = spawnSync(process.execPath, [...process.execArgv, __filename, '--red'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { MEDI_TGT_ADDR_LEGACY: '1' }) });
  const out = String(c.stdout || '') + String(c.stderr || '');
  for (const l of out.split(NL)) if (/^(  (RANDOM|CONTROL|FAIL|the knob)|AGREEMENT|THE DIE)/.test(l)) console.log('  | ' + l.trim());
  if (c.status !== 0) {
    console.log('  FAIL — the restore child exited ' + c.status + '. Its job is to REPRODUCE the'
      + ' defect and report cleanly; a non-zero exit means the knob broke something else.');
    bad++;
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' clause(s) failed.' : 'GREEN — all clauses passed.'));
process.exit(bad ? 1 : 0);
