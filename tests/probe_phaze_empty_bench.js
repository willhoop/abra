/* probe_phaze_empty_bench.js — WHAT HAPPENS WHEN A PHAZE MOVE LANDS AND THE BACK IS EMPTY?
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_phaze_empty_bench.js
 *
 * ================= THE QUESTION =================================================================
 *
 * Roar / Whirlwind (status) and Dragon Tail / Circle Throw (damaging) are ONE tag here
 * (`move/forcesSwitch`) and TWO doors in the authority:
 *
 *   sim/battle-actions.ts:1104   step 6 of spreadMoveHit -> forceSwitch()  (BOTH halves)
 *   sim/battle-actions.ts:1260   runMoveEffects, the `moveData.forceSwitch` clause (BOTH halves,
 *                                but only the STATUS one can reach the `-fail` below)
 *   sim/battle-actions.ts:1353   forceSwitch() -> runEvent('DragOut', ...)
 *
 * and the empty-bench check is NOT at the DragOut site. It is `this.battle.canSwitch(target.side)`,
 * asked in BOTH places:
 *
 *   :1353  `if (target && target.hp > 0 && source.hp > 0 && this.battle.canSwitch(target.side))`
 *          -- an empty bench means the whole body of forceSwitch is skipped: no DragOut event, no
 *          flag, and NO `-fail`, because the `-fail` there lives on the `hitResult === false` arm
 *          which is never reached.
 *   :1260  `hitResult = !!this.battle.canSwitch(target.side); didSomething = combineResults(...)`
 *          -- and THIS is where the two doors part, because `didAnything` is seeded from the damage
 *          array (`damage.reduce(this.combineResults)`, :1190):
 *
 *            STATUS phaze:    getDamage returns undefined for a Status move, so didAnything starts
 *                             undefined; combineResults(undefined,false) === false; the tail at
 *                             :1303-1309 fires -> `add('-fail', source)` + `attrLastMove('[still]')`.
 *            DAMAGING phaze:  damage[i] is a NUMBER, and combineResults returns the left operand
 *                             when `typeof left === 'number'` outranks a boolean (:1198 priority
 *                             list) -- so didAnything stays a number and NOTHING is announced.
 *
 * So the authority's own answer is asymmetric, and the asymmetry is the finding this probe exists
 * to check us against. `possibleSwitches` (sim/battle.ts:1571) is the bench only -- it walks
 * `side.pokemon` from `side.active.length` upward -- so "nothing in the back" in a DOUBLES format
 * means BOTH benched slots fainted while two bodies are still standing.
 *
 * ================= THE FIXTURE IS CONSTRUCTED, NOT FOUND ========================================
 *
 * A bench cannot be attacked, so the empty bench is reached the way a real game reaches it: the two
 * front bodies KILL THEMSELVES on turn 1 (Memento, `selfdestruct: 'ifHit'`, data/moves.ts), the two
 * benched bodies are pulled up as their replacements, and the back is then empty with two bodies
 * alive. Three arms, differing in ONE CLICK on turn 1, so the knob is the bench depth and nothing
 * else:
 *
 *   BENCH 2   nobody Mementos          -- the CONTROL. The drag must happen in both engines.
 *   BENCH 1   p2a Mementos             -- the near miss: exactly one legal body in the back.
 *   BENCH 0   p2a and p2b Memento      -- the SUBJECT.
 *
 * and every arm is played twice, once through each door (Roar, then Dragon Tail).
 *
 * NOTHING IS TYPED AS AN EXPECTED VALUE for the subject. Showdown is the expectation, exactly as
 * tests/staged_board.js argues. What IS asserted is that the fixture did what it claims: the bench
 * depth must actually differ across the three arms IN THE AUTHORITY'S OWN COUNT, or the knob is
 * unwired and every "agreement" below is agreement about nothing.
 *
 * ================= WHICH SCOREBOARD THIS SHOULD MOVE ============================================
 *
 * The LAB. A phaze into an empty bench needs three of a side's four bodies dead with two standing;
 * the pinned pool is not expected to move and a claim that it did would need deriving, not
 * asserting.
 *
 * IT WRITES NOTHING. No artifact is touched.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.argv.includes('--state')) process.argv.push('--state');

const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));

const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE CAST, DERIVED ------------------------------------------------------------------------
 * Every carriage claim is TeamValidator's (`champions_sim.canLearn`) and is printed. Abilities are
 * chosen to keep the board quiet and each choice has a reason:
 *   Tyranitar  UNNERVE, not Sand Stream -- sandstorm would chip every body every turn.
 *   Garchomp   SAND VEIL, not Rough Skin -- Rough Skin answers Dragon Tail's contact and would put
 *              damage on the phazer that the other door does not have.
 *   Weavile    PICKPOCKET, not Pressure -- Pressure takes TWO PP off a move aimed at it, and PP is
 *              a compared board leaf, so it would part the boards for a reason that is not this one.
 *   Clefable   MAGIC GUARD, not Cute Charm -- Cute Charm is gender-gated and the rig is genderless.
 *
 * THE FRONT PAIR IS NOT FAIRY, AND THAT IS LOAD-BEARING. The first run of this probe used Whimsicott
 * (Grass/FAIRY) and Gardevoir (Psychic/FAIRY), so the DRAGON-type door was refused by the type chart
 * in every arm and measured nothing about the bench at all. Ninetales is pure Fire and Spiritomb is
 * Ghost/Dark; the two bench bodies are Dark/Ice and Dragon/Ground. None of the four is immune to
 * Dragon, checked against the dex rather than recalled.
 */
const PHAZER = 'tyranitar';
const DOORS = [{ key: 'roar', move: 'roar', kind: 'STATUS phaze' },
               { key: 'dragontail', move: 'dragontail', kind: 'DAMAGING phaze' }];
const SUICIDE = 'memento', IDLE = 'sunnyday', IDLE2 = 'nastyplot', P1_IDLE = 'irondefense',
      P1B_IDLE = 'calmmind';
const FRONT = [['ninetales', 'Flash Fire'], ['spiritomb', 'Infiltrator']];
const BACK = [['weavile', 'Pickpocket'], ['garchomp', 'Sand Veil']];
const P1_REST = [['clefable', 'Magic Guard'], ['toxapex', ''], ['milotic', '']];
/* THE IMMUNE ARM'S TARGET -- a FAIRY, so a Dragon-type phaze is refused by the type chart before
 * anything else can happen. Derived from the dex, not named from memory: Clefable is pure Fairy. */
const IMMUNE_BODY = 'clefable', IMMUNE_ABIL = 'Magic Guard';

{
  let bad = 0;
  const claims = [[PHAZER, 'roar'], [PHAZER, 'dragontail'], [PHAZER, P1_IDLE],
                  [P1_REST[0][0], P1B_IDLE], [IMMUNE_BODY, P1B_IDLE]];
  for (const [sp] of FRONT) claims.push([sp, SUICIDE], [sp, IDLE], [sp, IDLE2], [sp, 'protect']);
  for (const [sp] of BACK) claims.push([sp, IDLE], [sp, 'protect']);
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const TEAM_P1 = [mon(PHAZER, 'Unnerve', ['Roar', 'Dragon Tail', P1_IDLE, 'Protect']),
                 mon(P1_REST[0][0], P1_REST[0][1], [P1B_IDLE, 'Protect']),
                 ...P1_REST.slice(1).map(([s2, a]) => mon(s2, a, ['Protect']))];
const TEAM_P2 = [mon(FRONT[0][0], FRONT[0][1], [SUICIDE, IDLE, IDLE2, 'Protect']),
                 mon(FRONT[1][0], FRONT[1][1], [SUICIDE, IDLE, IDLE2, 'Protect']),
                 mon(BACK[0][0], BACK[0][1], [IDLE, 'Protect']),
                 mon(BACK[1][0], BACK[1][1], [IDLE, 'Protect'])];
/* THE IMMUNE ARM's p2: a Fairy in slot 0 with a FULL bench, so nothing but the type chart can stop
 * the drag. Found by accident on this probe's first run and kept as an arm of its own. */
const TEAM_P2_IMMUNE = [mon(IMMUNE_BODY, IMMUNE_ABIL, [P1B_IDLE, 'Protect']),
                        mon(FRONT[1][0], FRONT[1][1], [IDLE2, 'Protect']),
                        mon(BACK[0][0], BACK[0][1], [IDLE, 'Protect']),
                        mon(BACK[1][0], BACK[1][1], [IDLE, 'Protect'])];

/* TURN 1 -- THE ONE VARIED CLICK. p1 must NOT Protect: Memento carries `protect: 1`, so a shield
 * refuses it and the fixture's own self-KO never fires. The first run of this probe did exactly
 * that and reported the knob dead -- a claim about the FIXTURE, never about the mechanic. */
const P1_T1 = [{ m: P1_IDLE }, { m: P1B_IDLE }];
const T1 = {
  2: { p1: P1_T1, p2: [{ m: IDLE2 }, { m: IDLE2 }] },
  1: { p1: P1_T1, p2: [{ m: SUICIDE, t: 0 }, { m: IDLE2 }] },
  0: { p1: P1_T1, p2: [{ m: SUICIDE, t: 0 }, { m: SUICIDE, t: 0 }] },
};
/* TURN 2 -- the phaze, aimed at p2 slot 0. p2 slot 0 clicks the inert idle (it must NOT Protect:
 * Dragon Tail carries `protect: 1` and a shield would refuse the whole move, which is the fixture
 * trap tests/probe_drag_body.js already paid for once). p2 slot 1 Protects and is not aimed at; it
 * Protects on turn 2 ONLY, so the consecutive-Protect stall ladder never rolls a die. */
const T2 = door => ({ p1: [{ m: door, t: 0 }, { m: P1B_IDLE }],
                      p2: [{ m: IDLE }, { m: 'protect' }] });

const sdEligible = side => {          // sim/battle.ts:1571 possibleSwitches, quoted
  const out = [];
  for (let i = side.active.length; i < side.pokemon.length; i++) {
    const p = side.pokemon[i];
    if (!p.fainted) out.push(id(p.species.id));
  }
  return out;
};
const medEligible = bench => bench.filter(m => m && !m.fainted && m.curHP > 0).map(m => id(m.name));

const LINES = /^\|(drag|switch|-fail|-activate|-damage|faint|move|-immune|-miss)\|/;
const turnSlice = (lines, n) => {
  const s = lines.map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  return i < 0 ? [] : s.slice(i + 1).filter(l => LINES.test(l));
};
/* Showdown's log carries the SECRET and the SHARED form of the same event (the `|split|` pair), so
 * an arrival appears twice with different HP. Compared on the EVENT and the BODY only. */
const narr = lines => {
  const out = []; const seen = new Set();
  for (const l of lines) {
    const p = l.split('|');
    const k = p[1] + '|' + String(p[2] || '').split(':').pop().trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out;
};

function run(door, depth) {
  const a = G.buildPair(TEAM_P1), b = G.buildPair(TEAM_P2);
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', `phaze-empty:${door}:${depth}`, {
    script: [T1[depth], T2(door)],
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({
        turn: turnIdx,
        identical: !!snap.identical,
        diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 12).map(d => {
          try { const L = require(D('engine', 'board_state.js')).locate(d, snap);
                return typeof L === 'string' ? L : JSON.stringify(L); }
          catch (e) { return JSON.stringify(d); }
        }),
        sd_active: battle.p2.active.map(p => p && id(p.species.id) + '@' + p.hp),
        me_active: S.actB.map(m => m && id(m.name) + '@' + m.curHP),
        sd_elig: sdEligible(battle.p2),
        me_elig: medEligible(S.benchB),
        sd_left: battle.p2.pokemonLeft,
      });
      /* Neutralised AFTER copying, so a red turn 1 does not hide turn 2 — the driver's own stop
       * rule ends a state-mode game at the first divergent board. Touches only the snapshot. */
      snap.identical = true; snap.diffs = [];
    },
  });
  const sdLog = G.lastSdLog ? G.lastSdLog() : [];
  const meLog = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           script: G.scriptCounters ? G.scriptCounters() : null,
           sdT2: turnSlice(sdLog, 2), meT2: turnSlice(meLog, 2) };
}

/* ---- THE IMMUNE ARM, ONE TURN, FULL BENCH ------------------------------------------------------
 * A DIFFERENT question from the empty bench, and it is here because this probe's own first run
 * tripped over it (the first cast's front pair were both FAIRY, so the Dragon door measured nothing).
 * The authority zeroes an immune target INSIDE spreadMoveHit long before step 6:
 *   getSpreadDamage -> getDamage returns false for a type immunity -> `damage[i] = false`
 *   :1080  `for (const i of targets.keys()) if (damage[i] === false) targets[i] = false;`
 *   :1353  forceSwitch walks `targets.entries()` and `if (target && ...)` skips a `false` entry.
 * So an immune body is never dragged. THE CONTROL IS THE SAME CLICK ON THE SAME BOARD WITH A
 * NON-IMMUNE TARGET, so "nobody moved" cannot be the fixture failing to click. */
function runImmune(door, team, p2aIdle) {
  const a = G.buildPair(TEAM_P1), b = G.buildPair(team);
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'phaze-immune:' + door, {
    script: [{ p1: [{ m: door, t: 0 }, { m: P1B_IDLE }], p2: [{ m: p2aIdle }, { m: 'protect' }] }],
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
        diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)),
        sd_active: battle.p2.active.map(p => p && id(p.species.id) + '@' + p.hp),
        me_active: S.actB.map(m => m && id(m.name) + '@' + m.curHP),
        sd_elig: sdEligible(battle.p2) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sdLog = G.lastSdLog ? G.lastSdLog() : [];
  const meLog = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, seen,
           sdT: turnSlice(sdLog, 1), meT: turnSlice(meLog, 1) };
}

console.log('\nPHAZE INTO AN EMPTY BENCH — both doors, three bench depths, one varied click\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id));

const R = {};
for (const d of DOORS) for (const depth of [2, 1, 0]) R[d.key + ':' + depth] = run(d.move, depth);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const d of DOORS) {
  console.log('\n' + '='.repeat(98));
  console.log(`  ${d.move.toUpperCase()}  (${d.kind})`);
  console.log('='.repeat(98));
  for (const depth of [2, 1, 0]) {
    const x = R[d.key + ':' + depth];
    console.log(`\n  -- BENCH ${depth} --   ${x.verdict}${x.why ? ' — ' + x.why : ''}`
      + (x.script ? `   clicks NOT on the request: ${x.script.moveNotOnRequest}` : ''));
    if (x.verdict !== 'RAN') continue;
    for (const b of x.seen) {
      console.log(`     after turn ${b.turn}: p2 active  sd [${b.sd_active.join(', ')}]`
        + `   me [${b.me_active.join(', ')}]`);
      console.log(`                    p2 bench   sd [${b.sd_elig.join(', ')}]`
        + `   me [${b.me_elig.join(', ')}]   sd pokemonLeft ${b.sd_left}`);
      console.log(`                    BOARD identical: ${b.identical ? 'YES' : 'NO'}`
        + (b.identical ? '' : '\n                      ' + b.diffs.join('\n                      ')));
    }
    console.log('     turn-2 narration  showdown  ' + (x.sdT2.length ? x.sdT2.join('  ') : '(none)'));
    console.log('     turn-2 narration  medicham  ' + (x.meT2.length ? x.meT2.join('  ') : '(none)'));
    const ns = narr(x.sdT2).join(' '), nm = narr(x.meT2).join(' ');
    x.narrAgree = ns === nm;
    x.sdDragged = x.sdT2.some(l => /^\|drag\|/.test(l));
    x.meDragged = x.meT2.some(l => /^\|drag\|/.test(l));
    x.sdFail = x.sdT2.some(l => /^\|-fail\|/.test(l));
    x.meFail = x.meT2.some(l => /^\|-fail\|/.test(l));
    console.log(`     dragged?  sd=${x.sdDragged} me=${x.meDragged}    `
      + `-fail?  sd=${x.sdFail} me=${x.meFail}    narration equal: ${x.narrAgree ? 'YES' : 'NO'}`);
  }
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the fixture first, then BOARD, then NARRATION (reported separately)');
console.log('='.repeat(98));

/* ---- 1. THE FIXTURE. An unwired knob gives identical output, which is not agreement. ------------ */
for (const d of DOORS) {
  const depths = [2, 1, 0].map(k => R[d.key + ':' + k]);
  ok(depths.every(x => x.verdict === 'RAN'), `${d.move}: all three arms RAN`,
    depths.map((x, i) => `bench ${[2, 1, 0][i]} -> ${x.verdict}${x.why ? ' (' + x.why + ')' : ''}`).join('; '));
  if (!depths.every(x => x.verdict === 'RAN')) continue;
  const back = x => { const b = x.seen[x.seen.length - 2] || x.seen[0]; return b ? b.sd_elig.length : -1; };
  const got = depths.map(back);
  ok(got.join(',') === '2,1,0',
    `${d.move}: THE KNOB MOVED — the AUTHORITY's own bench count before the phaze is 2 / 1 / 0`,
    got.join(',') === '2,1,0' ? '' : `it is [${got.join(', ')}] — identical or wrong output across a `
      + 'varied knob means the fixture is unwired, not that the depth does not matter');
}

/* ---- 2. THE BOARD. The bar. -------------------------------------------------------------------- */
for (const d of DOORS) for (const depth of [2, 1, 0]) {
  const x = R[d.key + ':' + depth];
  if (x.verdict !== 'RAN') continue;
  const bad = x.seen.filter(b => !b.identical);
  ok(!bad.length, `BOARD  ${d.move} / bench ${depth}: every boundary identical`,
    bad.length ? bad.map(b => `turn ${b.turn}: ` + b.diffs.join(' | ')).join('  ||  ') : '');
}
/* The control must actually drag, or "the boards agree" is agreement about a move that never fired. */
for (const d of DOORS) {
  const c = R[d.key + ':2'];
  if (c.verdict !== 'RAN') continue;
  ok(c.sdDragged && c.meDragged, `BOARD  ${d.move} / bench 2: the CONTROL staged a real drag in both engines`,
    c.sdDragged && c.meDragged ? '' : `sd=${c.sdDragged} me=${c.meDragged} — COULD-NOT-STAGE is a claim `
      + 'about the fixture, never about the mechanic');
  const z = R[d.key + ':0'];
  if (z.verdict !== 'RAN') continue;
  ok(z.sdDragged === z.meDragged, `BOARD  ${d.move} / bench 0: the two engines agree on WHETHER a drag happened`,
    z.sdDragged === z.meDragged ? '' : `showdown dragged=${z.sdDragged}, medicham dragged=${z.meDragged}`);
}

/* ---- 3. THE NARRATION. A separate, lower-priority gate — never pooled with the board. ----------- */
for (const d of DOORS) for (const depth of [2, 1, 0]) {
  const x = R[d.key + ':' + depth];
  if (x.verdict !== 'RAN') continue;
  const good = x.narrAgree;
  console.log(`  ${good ? 'ok  ' : 'NARR'}  NARRATION  ${d.move} / bench ${depth}: turn-2 event stream equal`
    + (good ? '' : `\n          showdown [${narr(x.sdT2).join(' ')}]\n          medicham [${narr(x.meT2).join(' ')}]`));
}

/* ---- 4. THE IMMUNE ARM, REPORTED SEPARATELY --------------------------------------------------- */
console.log('\n' + '='.repeat(98));
console.log('  A DRAGON-TYPE PHAZE INTO A FAIRY — the type chart, not the bench (a SECOND finding)');
console.log('='.repeat(98));
const IM = runImmune('dragontail', TEAM_P2_IMMUNE, P1B_IDLE);
/* THE CONTROL CLICKS THE MOVE ITS OWN BODY HAS. The first cut handed Ninetales `calmmind`,
 * which it does not carry, and the driver REJECTED the choice -- the control THREW and the
 * immune arm went unjudged. A control that cannot run is not a control. */
const IC = runImmune('dragontail', TEAM_P2, IDLE2);
for (const [nm, x] of [['IMMUNE  target ' + IMMUNE_BODY + ' (Fairy)', IM],
                       ['CONTROL target ' + FRONT[0][0] + ' (not immune)', IC]]) {
  console.log(`\n  ${nm}   ${x.verdict}${x.why ? ' — ' + x.why : ''}`);
  if (x.verdict !== 'RAN') continue;
  for (const b of x.seen) console.log(`     after turn ${b.turn}: sd [${b.sd_active.join(', ')}]  `
    + `me [${b.me_active.join(', ')}]   bench sd [${b.sd_elig.join(', ')}]   board identical: `
    + (b.identical ? 'YES' : 'NO\n                      ' + b.diffs.join('\n                      ')));
  console.log('     showdown  ' + (x.sdT.join('  ') || '(none)'));
  console.log('     medicham  ' + (x.meT.join('  ') || '(none)'));
  x.sdDragged = x.sdT.some(l => /^\|drag\|/.test(l));
  x.meDragged = x.meT.some(l => /^\|drag\|/.test(l));
  console.log(`     dragged?  sd=${x.sdDragged} me=${x.meDragged}`);
}
if (IM.verdict === 'RAN' && IC.verdict === 'RAN') {
  ok(IC.sdDragged && IC.meDragged, 'BOARD  immune-arm CONTROL: a non-immune target IS dragged by both engines',
    IC.sdDragged && IC.meDragged ? '' : `sd=${IC.sdDragged} me=${IC.meDragged} — the fixture did not click`);
  ok(IM.sdDragged === IM.meDragged, 'BOARD  a Dragon-type phaze into a FAIRY: the two engines agree on the drag',
    IM.sdDragged === IM.meDragged ? '' : `showdown dragged=${IM.sdDragged}, medicham dragged=${IM.meDragged}`);
  const badIm = IM.seen.filter(b => !b.identical);
  ok(!badIm.length, 'BOARD  immune arm: every boundary identical',
    badIm.length ? badIm.map(b => 'turn ' + b.turn + ': ' + b.diffs.join(' | ')).join('  ||  ') : '');
}

/* ---- 5. SUCTION CUPS WITH AN EMPTY BENCH — the item docs/ENGINE.md's hand list already names ----
 *
 * *"the Suction Cups refusal announces itself with an EMPTY bench, in BOTH doors"* has sat on the
 * hand list since 2026-08-22 as a MEASURED-BUT-NOT-FIXED note. It is the same branch as everything
 * above and it is the ORDER that is wrong, not the refusal: the authority asks `canSwitch` FIRST
 * (both at :1260 and inside forceSwitch at :1353) and never reaches `runEvent('DragOut')` when the
 * back is empty, so Suction Cups' own `-activate` cannot fire. This engine asks the ability first.
 *
 * THE CONTROL IS THE SAME BOARD WITH THE BENCH STILL OCCUPIED, where the refusal is CORRECT and both
 * engines announce it (ROADMAP #341, closed). So a divergence here is about the bench and not about
 * the ability. */
const SUCTION = 'malamar', SUCTION_ABIL = 'Suction Cups';
const TEAM_P2_SUCTION = [mon(FRONT[0][0], FRONT[0][1], [SUICIDE, IDLE, IDLE2, 'Protect']),
                         mon(FRONT[1][0], FRONT[1][1], [SUICIDE, IDLE, IDLE2, 'Protect']),
                         mon(SUCTION, SUCTION_ABIL, [IDLE, 'Protect']),
                         mon(BACK[1][0], BACK[1][1], [IDLE, 'Protect'])];
function runSuction(door, depth) {
  const a = G.buildPair(TEAM_P1), b = G.buildPair(TEAM_P2_SUCTION);
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'phaze-suction:' + door + ':' + depth, {
    script: [T1[depth], T2(door)],
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
        diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)),
        sd_active: battle.p2.active.map(p => p && id(p.species.id)),
        sd_elig: sdEligible(battle.p2) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sdLog = G.lastSdLog ? G.lastSdLog() : [];
  const meLog = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, seen,
           sdT: turnSlice(sdLog, 2), meT: turnSlice(meLog, 2) };
}
console.log('\n' + '='.repeat(98));
console.log('  SUCTION CUPS WITH AN EMPTY BENCH — both doors (a THIRD finding, already on the hand list)');
console.log('='.repeat(98));
if (!CS.canLearn(SUCTION, IDLE) || !CS.canLearn(SUCTION, 'protect')) {
  console.log('  NOT RUN — ' + SUCTION + ' cannot carry the idle clicks this fixture needs.');
} else for (const d of DOORS) for (const depth of [1, 0]) {
  const x = runSuction(d.move, depth);
  const who = x.seen.length >= 2 ? x.seen[x.seen.length - 2].sd_active[0] : '?';
  console.log(`\n  ${d.move} / bench ${depth}   ${x.verdict}${x.why ? ' — ' + x.why : ''}`
    + `   (p2 slot 0 before the phaze: ${who})`);
  if (x.verdict !== 'RAN') continue;
  console.log('     showdown  ' + (x.sdT.join('  ') || '(none)'));
  console.log('     medicham  ' + (x.meT.join('  ') || '(none)'));
  const bad = x.seen.filter(b => !b.identical);
  ok(!bad.length, `BOARD  suction / ${d.move} / bench ${depth}: every boundary identical`,
    bad.length ? bad.map(b => 'turn ' + b.turn + ': ' + b.diffs.join(' | ')).join('  ||  ') : '');
  ok(who === SUCTION, `FIXTURE  suction / ${d.move} / bench ${depth}: ${SUCTION} IS the phazed body`,
    who === SUCTION ? '' : `slot 0 holds ${who} — the arm measures nothing about Suction Cups`);
  const ns = narr(x.sdT).join(' '), nm = narr(x.meT).join(' ');
  console.log(`  ${ns === nm ? 'ok  ' : 'NARR'}  NARRATION  suction / ${d.move} / bench ${depth}`
    + (ns === nm ? '' : `\n          showdown [${ns}]\n          medicham [${nm}]`));
}

console.log('\n  BOARD clauses failing: ' + fails);
console.log('  (narration is printed above and is NOT counted in the exit code — separate gate.)');
process.exit(fails ? 1 : 0);
