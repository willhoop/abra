/* probe_drag_body.js — WHO ARRIVES WHEN A ROAR LANDS, AND WHY THE TWO ENGINES DISAGREE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_drag_body.js --release 6a05dd9ad60d --state
 *
 * ================= THE QUESTION ==================================================================
 *
 * `drag: a different body` is the third largest class in the whole-game differential (24 of 133 at
 * release 6a05dd9ad60d) and it is unambiguously a BOARD divergence: a different Pokemon is standing
 * in the slot from that turn on.
 *
 * The offered hypothesis was that the choice is a DIE on the authority and a fixed index here — the
 * Trace shape, `this.sample(...)` against `eligible[0]`. IT IS NOT. Both engines roll:
 *
 *   AUTHORITY  sim/battle-actions.ts:163   dragIn -> `this.battle.getRandomSwitchable(side)`
 *              sim/battle.ts:1567          `const canSwitchIn = this.possibleSwitches(side);
 *                                           return canSwitchIn.length ? this.sample(canSwitchIn) : null;`
 *              sim/prng.ts:132             `sample` -> `const index = this.random(items.length);`
 *   MEDICHAM2  medicham2-browser.js:16422  `_lb.length ? _lb[Math.floor(rng()*_lb.length)] : null`
 *              medicham2-browser.js:21795  the same line again for the damaging half
 *
 * So the hypothesis under test here is the NEXT one down: the two engines sample the same SET in a
 * DIFFERENT ORDER, because they maintain the party differently across a switch.
 *
 *   AUTHORITY  sim/battle-actions.ts:125-132  switchIn SWAPS: the outgoing body takes the incoming
 *                                             body's party index.
 *              sim/battle.ts:1572-1581        possibleSwitches walks `side.pokemon` from index
 *                                             `active.length` upward, skipping only the fainted.
 *   MEDICHAM2  medicham2-browser.js:12488     bringIn  `bench.splice(bench.indexOf(nx),1)`
 *              medicham2-browser.js:13077     switchOut `bench.push(out)`   <- APPENDS to the END
 *
 * Remove-and-append against swap-in-place. Same members, different order, from the first switch on.
 *
 * ================= WHY THIS IS NOT VISIBLE ANYWHERE ELSE ========================================
 *
 * `engine/board_state.js:600 partyMap` keys the party BY SPECIES. The state comparator is therefore
 * order-blind on the bench by construction, and it is right to be — a party keyed by index would
 * manufacture a divergence on every switch. The order only becomes observable when something INDEXES
 * into it, and the drag die is the one thing that does.
 *
 * ================= THE CONTROL IS THE WHOLE PROBE ================================================
 *
 * Two scenarios, identical in every respect except ONE CLICK on turn 1:
 *
 *   CONTROL   turn 1 both sides Protect. Nobody switches, so the two bench arrays are still in their
 *             build order and MUST agree member-for-member. The turn-2 Roar then isolates the DIE.
 *   SUBJECT   turn 1 p2a clicks U-turn. The pivot's replacement is MIRRORED from medicham2 by the
 *             driver (game_differential.js:3398), so both engines put the SAME body on the field —
 *             and then the two bench arrays hold the same two members in opposite order.
 *
 * If the control agrees and the subject differs, the die is fine and the ORDER is the defect. If the
 * control differs too, the die is wrong as well and this probe says so rather than reporting one
 * cause. A REFUTED HYPOTHESIS IS A RESULT; nothing here decides in advance which way it goes.
 *
 * NOTHING IS TYPED AS AN EXPECTED VALUE. The probe prints both engines' eligible lists, both dice,
 * both indices and both `|drag|` lines, and the verdict is whether the two agree.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* `--state` must be in argv BEFORE the driver is required: STATE is read at module load and it is
 * what arms the `onBoundary` hook this probe reads the two parties through. `--release` must be
 * there too or requiring the driver CUTS a release into the real store (game_differential.js:196). */
if (!process.argv.includes('--state')) process.argv.push('--state');
if (!process.argv.includes('--release')) {
  console.log('REFUSING TO RUN — pass --release <id>.');
  console.log('  Requiring engine/game_differential.js without it CUTS A RELEASE INTO THE REAL STORE');
  console.log('  at require time (game_differential.js:196). Six junk releases were cut that way.');
  process.exit(2);
}

const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));

const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE CAST IS DERIVED, NOT NAMED FROM MEMORY -------------------------------------------------
 * Every carriage claim below is TeamValidator's own (`champions_sim.canLearn`), and every body has a
 * row in the engine's table or `buildPair` returns null and the probe reports NOT-STAGED. */
const PHAZER = 'arcanine', PHAZE = 'roar';
const PIVOT = 'corviknight', PIVOTMOVE = 'uturn';
const B_PARTNER = 'milotic', B_BENCH = ['snorlax', 'weavile'];
const A_REST = ['clefable', 'garchomp', 'toxapex'];
{
  let bad = 0;
  for (const [sp, mv] of [[PHAZER, PHAZE], [PIVOT, PIVOTMOVE], [PHAZER, 'agility'], ['clefable', 'calmmind']]) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* P1 MUST NOT CLICK PROTECT ON TURN 1, AND THE FIRST RUN OF THIS PROBE FAILED BECAUSE IT DID.
 * U-turn is a contact damaging move, so a Protecting target stops it outright and `selfSwitch` never
 * fires — the pivot did not happen, both engines kept Corviknight on the field, and the probe
 * reported `the knob did not move`. That reading was correct and it was about the FIXTURE. Both p1
 * clicks are now self-targeting status moves, derived legal by TeamValidator below, that cannot
 * interfere with the pivot. */
const A_IDLE = 'agility', B_IDLE = 'calmmind';
const TEAM_A = [mon(PHAZER, 'Intimidate', [PHAZE, A_IDLE, 'Protect']),
                mon(A_REST[0], '', [B_IDLE, 'Protect']),
                mon(A_REST[1], '', ['Protect']),
                mon(A_REST[2], '', ['Protect'])];
const TEAM_B = [mon(PIVOT, 'Pressure', [PIVOTMOVE, 'Protect']),
                mon(B_PARTNER, 'Marvel Scale', ['Protect']),
                mon(B_BENCH[0], 'Thick Fat', ['Protect']),
                mon(B_BENCH[1], 'Pressure', ['Protect'])];

/* THE TWO SCRIPTS DIFFER IN EXACTLY ONE CLICK. */
const P1_T1 = [{ m: A_IDLE }, { m: B_IDLE }];
const PROTECT_T1 = { p1: P1_T1, p2: [{ m: 'protect' }, { m: 'protect' }] };
const PIVOT_T1 = { p1: P1_T1, p2: [{ m: PIVOTMOVE, t: 0 }, { m: 'protect' }] };
const ROAR_T2 = { p1: [{ m: PHAZE, t: 0 }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };

/* ---- READING THE TWO ELIGIBLE LISTS, EACH THROUGH ITS OWN ENGINE'S OWN RULE --------------------
 * Not a re-implementation of either: `possibleSwitches` is quoted from sim/battle.ts:1572 and the
 * medicham2 side is its `bench` array filtered by `_live`'s own predicate (medicham2:11593). Two
 * different rules would be the fact-living-in-two-places failure this repo has a standing rule about. */
const sdEligible = side => {
  const out = [];
  for (let i = side.active.length; i < side.pokemon.length; i++) {
    const p = side.pokemon[i];
    if (!p.fainted) out.push(id(p.species.id));
  }
  return out;
};
const medEligible = bench => bench.filter(m => m && !m.fainted && m.curHP > 0).map(m => id(m.name));

function run(label, t1) {
  const a = G.buildPair(TEAM_A), b = G.buildPair(TEAM_B);
  if (!a || !b) return { label, verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'probe-drag:' + label, {
    script: [t1, ROAR_T2],
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({
        turn: turnIdx,
        sd_active: battle.p2.active.map(p => p && id(p.species.id)),
        me_active: S.actB.map(m => m && id(m.name)),
        sd_party: battle.p2.pokemon.map(p => id(p.species.id)),
        sd_elig: sdEligible(battle.p2),
        me_bench: S.benchB.map(m => m && id(m.name)),
        me_elig: medEligible(S.benchB),
      });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sdLog = G.lastSdLog ? G.lastSdLog() : [];
  const meLog = (r && r.mediTrace) || [];
  /* Showdown's `battle.log` carries the SECRET and the SHARED form of a `|drag|` (the `|split|`
   * pair), so the same arrival appears twice with different HP. De-duplicated on the body. */
  const dragOf = lines => {
    const out = [], seenB = new Set();
    for (const l of lines) {
      const m = /^\|drag\|([^|]*)\|/.exec(String(l));
      if (!m) continue;
      if (seenB.has(m[1])) continue;
      seenB.add(m[1]); out.push(String(l));
    }
    return out;
  };
  return { label, verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           script: G.scriptCounters ? G.scriptCounters() : null,
           sdDrag: dragOf(sdLog), meDrag: dragOf(meLog),
           addr: G.midAddresses ? G.midAddresses() : null };
}

const pad = (s, n) => String(s == null ? '' : s).padEnd(n);
function show(x) {
  console.log('\n' + '='.repeat(96));
  console.log('  ' + x.label);
  console.log('='.repeat(96));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); return; }
  console.log(`  turns played: ${x.turns}   scripted clicks NOT on the request: `
    + `${x.script ? x.script.moveNotOnRequest : '?'}${x.script && x.script.firstMissing ? ' (' + x.script.firstMissing + ')' : ''}`);
  for (const b of x.seen) {
    console.log(`\n  -- boundary after turn ${b.turn} --`);
    console.log(`     p2 active     showdown ${pad(b.sd_active.join(','), 26)} medicham ${b.me_active.join(',')}`);
    console.log(`     p2 party      showdown ${b.sd_party.join(',')}`);
    console.log(`     ELIGIBLE      showdown [${b.sd_elig.join(', ')}]`);
    console.log(`                   medicham [${b.me_elig.join(', ')}]`);
    const same = b.sd_elig.length === b.me_elig.length && b.sd_elig.every((v, i) => v === b.me_elig[i]);
    const sameSet = [...b.sd_elig].sort().join() === [...b.me_elig].sort().join();
    console.log(`                   -> same members: ${sameSet ? 'YES' : 'NO'}   same ORDER: ${same ? 'YES' : 'NO'}`);
  }
  console.log('\n     |drag| showdown: ' + (x.sdDrag.length ? x.sdDrag.join(' | ') : '(none)'));
  console.log('     |drag| medicham: ' + (x.meDrag.length ? x.meDrag.join(' | ') : '(none)'));
  const sdBody = (x.sdDrag[0] || '').split('|')[2] || '';
  const meBody = (x.meDrag[0] || '').split('|')[2] || '';
  x.sdBody = id(sdBody.split(':').pop()); x.meBody = id(meBody.split(':').pop());
  x.agree = !!x.sdBody && x.sdBody === x.meBody;
  console.log(`     DRAGGED BODY  showdown=${x.sdBody || '-'}  medicham=${x.meBody || '-'}  -> `
    + (x.sdDrag.length && x.meDrag.length ? (x.agree ? 'AGREE' : 'DIFFERENT BODY') : 'NO DRAG ON ONE SIDE'));
  if (x.addr) {
    const anyOf = arr => arr.filter(s => String(s).split('|')[2] === 'any');
    const sd = anyOf(x.addr.sd), me = anyOf(x.addr.me);
    console.log(`\n     the \`any\` addresses (the bucket the drag die falls in — the void check`);
    console.log(`     deliberately does NOT require these to agree, game_differential.js:872):`);
    console.log('       showdown  ' + (sd.slice(-4).join('  ') || '(none)'));
    console.log('       medicham  ' + (me.slice(-4).join('  ') || '(none)'));
    const S = new Set(sd), shared = me.filter(v => S.has(v));
    console.log(`       shared ${shared.length} of sd ${sd.length} / me ${me.length}`);
  }
}

console.log('\nWHO ARRIVES WHEN A ROAR LANDS — the drag body, both engines, one varied click\n');
console.log('  mode ' + G.MODE);
console.log('  release ' + (G.REL && G.REL.id));

/* ---- THE SECOND QUESTION THE BRIEF ASKED: ARE THE REFUSALS HONOURED, AND BY BOTH BRANCHES? -------
 *
 * `onDragOut` returning null is the authority's refusal and there are three members:
 *   data/abilities.ts:4685  suctioncups   -activate | ability: Suction Cups
 *   data/abilities.ts:1718  guarddog      -activate | ability: Guard Dog   -- ZERO legal carriers in
 *                                          this regulation (derived below), so it can never fire here
 *   data/moves.ts:9634      ingrain       -activate | move: Ingrain
 *
 * `data/tags.json` carries `refusesForcedSwitch` on `suctioncups` and on NOTHING ELSE, and medicham2
 * reads it in the PHAZE branch (:16406) and not in the DAMAGING one (:21786-21798). So this stages
 * the same refusal through both doors: Roar (status, the phaze branch) and Dragon Tail (damaging).
 * Malamar is the only legal Suction Cups body in this format and it is brought 1,340 times in the two
 * human stores, so this is live traffic and not a curiosity. */
const SUCTION = 'malamar', TAILER = 'tyranitar', S_IDLE = 'nastyplot';
const TEAM_S = [mon(SUCTION, 'Suction Cups', [S_IDLE, 'Protect']),
                mon(B_PARTNER, 'Marvel Scale', ['Protect']),
                mon(B_BENCH[0], 'Thick Fat', ['Protect']),
                mon(B_BENCH[1], 'Pressure', ['Protect'])];
const TEAM_T = [mon(TAILER, 'Sand Stream', ['Dragon Tail', PHAZE, 'Protect']),
                mon(A_REST[0], '', [B_IDLE, 'Protect']),
                mon(A_REST[1], '', ['Protect']),
                mon(A_REST[2], '', ['Protect'])];
function runRefusal(label, move) {
  const a = G.buildPair(TEAM_T), b = G.buildPair(TEAM_S);
  if (!a || !b) return { label, verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  const r = G.playGame(a, b, 'directed', 'probe-refusal:' + label, {
    /* MALAMAR MUST NOT CLICK PROTECT. The first run of this arm had it Protecting and Protect
     * stops Dragon Tail outright (contact, damaging), so the refusal was never reached and the
     * arm was INERT while reporting AGREE — the same fixture trap as the pivot above. */
    script: [{ p1: [{ m: move, t: 0 }, { m: 'protect' }], p2: [{ m: S_IDLE }, { m: 'protect' }] }],
    onBoundary: (snap) => { snap.identical = true; snap.diffs = []; },
  });
  const sdLog = (G.lastSdLog ? G.lastSdLog() : []).map(String);
  const meLog = ((r && r.mediTrace) || []).map(String);
  const pick = ls => ls.filter(l => /^\|(drag|-activate|-fail)\|/.test(l));
  return { label, verdict: r.err ? 'THREW' : 'RAN', why: r.err,
           sd: pick(sdLog), me: pick(meLog),
           sdDragged: sdLog.some(l => /^\|drag\|/.test(l)),
           meDragged: meLog.some(l => /^\|drag\|/.test(l)) };
}

const control = run('CONTROL — nobody switches on turn 1, so the two benches are still in build order', PROTECT_T1);
const subject = run('SUBJECT — p2a pivots on turn 1 (the arriving body is MIRRORED), then is Roared', PIVOT_T1);
show(control);
show(subject);

console.log('\n' + '='.repeat(96));
console.log('  VERDICT');
console.log('='.repeat(96));
let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};
const bothDragged = x => x.verdict === 'RAN' && x.sdDrag.length && x.meDrag.length;
ok(bothDragged(control), 'the CONTROL staged a drag in both engines',
  bothDragged(control) ? '' : 'the fixture failed — COULD-NOT-STAGE is a claim about the fixture, never about the mechanic');
ok(bothDragged(subject), 'the SUBJECT staged a drag in both engines',
  bothDragged(subject) ? '' : 'the fixture failed — COULD-NOT-STAGE is a claim about the fixture, never about the mechanic');
if (bothDragged(control) && bothDragged(subject)) {
  const cLast = control.seen[control.seen.length - 2] || control.seen[0];
  const sLast = subject.seen[subject.seen.length - 2] || subject.seen[0];
  const ordSame = e => e.sd_elig.length === e.me_elig.length && e.sd_elig.every((v, i) => v === e.me_elig[i]);
  ok(ordSame(cLast), 'CONTROL: the two eligible lists are in the SAME order (the knob is at rest)');
  ok(!ordSame(sLast), 'SUBJECT: one pivot puts the two eligible lists in a DIFFERENT order',
    ordSame(sLast) ? 'the knob did not move — identical output across a varied knob means the knob is unwired' : '');
  ok(control.agree, 'CONTROL: both engines drag the SAME body (so the DIE agrees)',
    control.agree ? '' : 'the die ALSO disagrees — the order is not the only cause');
  ok(!subject.agree, 'SUBJECT: the two engines drag a DIFFERENT body',
    subject.agree ? 'the order differs and the outcome does not — this hypothesis is REFUTED' : '');
}

/* ---- THE REFUSAL ARMS, PRINTED AS A SEPARATE FINDING --------------------------------------------- */
const rRoar = runRefusal('roar', PHAZE === 'roar' ? 'roar' : PHAZE);
const rTail = runRefusal('dragontail', 'dragontail');
console.log('\n' + '='.repeat(96));
console.log('  SUCTION CUPS THROUGH BOTH DOORS — Malamar (1,340 brought), the only legal carrier');
console.log('='.repeat(96));
for (const x of [rRoar, rTail]) {
  console.log(`\n  ${x.label}   (${x.verdict}${x.why ? ' — ' + x.why : ''})`);
  console.log('    showdown  ' + (x.sd.length ? x.sd.join(' | ') : '(no drag / activate / fail line)'));
  console.log('    medicham  ' + (x.me.length ? x.me.join(' | ') : '(no drag / activate / fail line)'));
  console.log(`    dragged?  showdown=${x.sdDragged}  medicham=${x.meDragged}  -> `
    + (x.sdDragged === x.meDragged ? 'AGREE' : 'DISAGREE'));
  if (x.sdDragged !== x.meDragged) fails++;
}

console.log('\n  ' + (fails ? fails + ' clause(s) did not hold' : 'every clause held'));
process.exit(fails ? 1 : 0);
