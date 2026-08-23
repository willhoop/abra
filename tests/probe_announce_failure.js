/* probe_announce_failure.js — THE AUTHORITY ANNOUNCES A FAILURE AND THIS ENGINE SAYS NOTHING,
 * MEASURED ON THE PROTOCOL **AND** ON THE STATE THE ANNOUNCEMENT WRITES.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_announce_failure.js
 *
 * ================= WHY THIS PROBE AND NOT ANOTHER `-fail` PROBE =================================
 *
 * `tests/probe_fail_and_silent.js` already asks the protocol question and its six arms are GREEN.
 * This one asks the question that has BLOCKED the class every time it was picked up:
 *
 *     mvFail(mon) { mon._mvRes = false; TR.fail(mon); }        engine/medicham2-browser.js:8863
 *
 * ONE call, TWO writes — a protocol line and a state field — and until `engine/move_result_state.js`
 * (built alongside this probe) only the line had an instrument. Every deferral said so in its own
 * words; the newest is docs/_reports/2026-08-23-phaze-empty-bench.md §4: *"the boards agreeing does
 * not prove `_mvRes` agrees. So this was NOT fixed in this pass."*
 *
 * So every arm here reports THREE verdicts, separately and never merged:
 *
 *     BOARD        engine/board_state.js at the turn boundary — the bar quarantine is read against
 *     RESULT       engine/move_result_state.js at the same boundary — `moveLastTurnResult` against
 *                  `_mvResLast`, the field Stomping Tantrum's doubler reads NEXT turn
 *     NARRATION    the turn's `|-fail|` / `|-activate|` / `|drag|` lines, compared as a set
 *
 * A fix that moves NARRATION green and RESULT red is exactly the 2026-08-12 retraction happening
 * again, and this probe is what makes that visible instead of assumed harmless.
 *
 * ================= THE MECHANISM UNDER TEST, DERIVED FROM THE AUTHORITY =========================
 *
 * The authority writes a move-phase `|-fail|MOVER` at TWELVE sites in sim/battle-actions.ts (463,
 * 512, 595, 646, 831, 850, 1048, 1175, 1203, 1213, 1306, 1362) and EVERY ONE of them is guarded by a
 * STRICT `=== false`, never by a falsy test. `combineResults` (:1561) ranks results
 * `['undefined', 'string'(NOT_FAIL), 'object'(null), 'boolean', 'number']` and returns the
 * higher-ranked side, so:
 *
 *     A NUMBER OUTRANKS A BOOLEAN. Any damage dealt suppresses a later `false`, and the move is
 *     silent. A move that dealt nothing and got a `false` announces.
 *
 * That is the general rule of the whole announce-failure class, and it is why the two phaze doors
 * answer differently with an empty bench: Roar has `damage[i] === undefined` and announces, Dragon
 * Tail has a number and does not. The arms below hold that asymmetry on both sides of the knob, so
 * an engine that announced ALWAYS would fail here exactly as one that announces NEVER.
 *
 * ================= THE SITE, AND WHY THE FIX IS AN ORDERING AND NOT A LIST ======================
 *
 *   sim/battle-actions.ts:1353  `if (target && target.hp > 0 && source.hp > 0 &&
 *                                    this.battle.canSwitch(target.side)) {
 *                                  const hitResult = this.battle.runEvent('DragOut', ...)`
 *
 * `canSwitch` is asked ABOVE `DragOut`. An empty bench therefore skips the whole body: no DragOut
 * event, so **Suction Cups' `onDragOut` never runs and its `-activate` is never written either**.
 * This engine asked the ability first. One ordering, two symptoms — the missing `-fail` and the
 * extra `-activate` — which is why they are one fix and one probe rather than two of each.
 *
 * ================= THE FIXTURE IS CONSTRUCTED, AND ITS KNOB IS ASSERTED =========================
 *
 * Cast and construction are `tests/probe_phaze_empty_bench.js`'s, deliberately: a bench cannot be
 * attacked, so the empty bench is reached the way a real game reaches it — the front pair kill
 * themselves with Memento and their replacements leave the back empty with two bodies alive. The
 * bench depth is READ OUT OF THE AUTHORITY (`possibleSwitches`, sim/battle.ts:1571) on every arm and
 * must actually differ across the arms, or the knob is unwired and every agreement is agreement
 * about nothing.
 *
 * ================= WHAT THIS GATE CAN AND CANNOT CATCH — SAID HERE, NOT DISCOVERED =============
 *
 * CAN. The predicate is spelled WITHOUT naming a move, an ability or a failure reason: it compares
 * the two engines' `|-fail|` lines AS A MULTISET, and the whole turn's event stream as a sequence.
 * A refusal added to this engine tomorrow, under any name, that writes no line where the authority
 * writes one — or writes one where the authority writes none — trips these arms. That is the bar the
 * brief set, and it is why there is no list of known-silent moves anywhere in this file.
 *
 * CANNOT — AND THIS IS THE HONEST LIMIT. The predicate is general; THE CORPUS IS NOT. Eight staged
 * arms reach one mechanism (a phaze with an empty back, with and without an `onDragOut` refuser). A
 * silent failure in a mechanism no arm stages is invisible here, exactly as it is invisible to
 * `engine/gate_fail_and_silent.js` when the differential's sample does not reach it. The two
 * instruments have the same shape of hole in different places: this one is limited by its FIXTURES
 * and that one by its SAMPLE, and neither is limited by its predicate. Widening the corpus is the
 * only thing that widens either, and no addition here should be read as widening the class.
 *
 * ================= WHICH SCOREBOARD THIS SHOULD MOVE ===========================================
 *
 * THE LAB. An empty bench needs three of a side's four bodies dead with two standing, and Malamar is
 * the format's only Suction Cups carrier. The pinned pool is NOT expected to move and no claim that
 * it does is made here. The BOARD is expected to be identical on every arm before and after — this
 * is a narration-plus-state fix, not a board fix, and an arm whose board moves is a red flag rather
 * than a success.
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
const MRS = require(D('engine', 'move_result_state.js'));

const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE CAST ---------------------------------------------------------------------------------
 * Reasons carried over from tests/probe_phaze_empty_bench.js, where each was paid for:
 *   Tyranitar UNNERVE (not Sand Stream — sand would chip every body every turn)
 *   Weavile   PICKPOCKET (not Pressure — Pressure takes two PP and PP is a compared board leaf)
 *   Garchomp  SAND VEIL (not Rough Skin — contact damage on the phazer differs by door)
 *   the front pair are Fire and Ghost/Dark, NOT Fairy, or the Dragon door is refused by the chart
 *     before it can measure anything about the bench.
 * MALAMAR is the subject of the ability arms and is the ONLY legal Suction Cups carrier in this
 * regulation. It is placed in the BACK so that it is standing when the bench runs out; the arm
 * ASSERTS it reached slot 0 rather than assuming the replacement landed there. */
const PHAZER = 'tyranitar';
const DOORS = [{ key: 'roar', move: 'roar', kind: 'STATUS phaze  (damage undefined -> announces)' },
               { key: 'dragontail', move: 'dragontail', kind: 'DAMAGING phaze  (a number -> silent)' }];
const SUICIDE = 'memento', IDLE = 'sunnyday', IDLE2 = 'nastyplot', P1_IDLE = 'irondefense',
      P1B_IDLE = 'calmmind';
const FRONT = [['ninetales', 'Flash Fire'], ['spiritomb', 'Infiltrator']];
const BACK_PLAIN = [['weavile', 'Pickpocket'], ['garchomp', 'Sand Veil']];
const BACK_CUPS = [['malamar', 'Suction Cups'], ['garchomp', 'Sand Veil']];
const P1_REST = [['clefable', 'Magic Guard'], ['toxapex', ''], ['milotic', '']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[PHAZER, 'roar'], [PHAZER, 'dragontail'], [PHAZER, P1_IDLE],
                  [P1_REST[0][0], P1B_IDLE], ['malamar', IDLE], ['malamar', IDLE2], ['malamar', 'protect']];
  for (const [sp] of FRONT) claims.push([sp, SUICIDE], [sp, IDLE2], [sp, 'protect']);
  for (const [sp] of BACK_PLAIN.concat(BACK_CUPS)) claims.push([sp, IDLE], [sp, 'protect']);
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  const AB = require(D('engine', 'champions_sim.js'));
  void AB;
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const TEAM_P1 = [mon(PHAZER, 'Unnerve', ['Roar', 'Dragon Tail', P1_IDLE, 'Protect']),
                 mon(P1_REST[0][0], P1_REST[0][1], [P1B_IDLE, 'Protect']),
                 ...P1_REST.slice(1).map(([s2, a]) => mon(s2, a, ['Protect']))];
const p2Team = back => [mon(FRONT[0][0], FRONT[0][1], [SUICIDE, IDLE2, 'Protect']),
                        mon(FRONT[1][0], FRONT[1][1], [SUICIDE, IDLE2, 'Protect']),
                        mon(back[0][0], back[0][1], [IDLE, 'Protect']),
                        mon(back[1][0], back[1][1], [IDLE, 'Protect'])];

const P1_T1 = [{ m: P1_IDLE }, { m: P1B_IDLE }];
const T1 = {
  2: { p1: P1_T1, p2: [{ m: IDLE2 }, { m: IDLE2 }] },
  1: { p1: P1_T1, p2: [{ m: SUICIDE, t: 0 }, { m: IDLE2 }] },
  0: { p1: P1_T1, p2: [{ m: SUICIDE, t: 0 }, { m: SUICIDE, t: 0 }] },
};
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

const LINES = /^\|(drag|switch|-fail|-activate|-damage|faint|move|-immune|-miss)\|/;
const turnSlice = (lines, n) => {
  const s = lines.map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  return i < 0 ? [] : s.slice(i + 1).filter(l => LINES.test(l));
};
/* Showdown's log carries the SECRET and SHARED form of one event (the `|split|` pair), so an arrival
 * appears twice with different HP. Compared on the EVENT and the BODY only. */
const narr = lines => {
  const out = [], seen = new Set();
  for (const l of lines) {
    const p = l.split('|');
    const k = p[1] + '|' + String(p[2] || '').split(':').pop().trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out;
};

function run(door, depth, back, tag) {
  const a = G.buildPair(TEAM_P1), b = G.buildPair(p2Team(back));
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', tag, {
    script: [T1[depth], T2(door)],
    onBoundary: (snap, turnIdx, S, battle) => {
      /* THE THREE READINGS ARE TAKEN AT ONE INSTANT, so a difference cannot be a difference of
       * moment. `'both'` asks for `this` as well: a non-undefined `this` at a boundary means one
       * engine did not roll its result over, which is a DIFFERENT defect from the two disagreeing. */
      const res = MRS.at(battle, S, 'both');
      seen.push({
        turn: turnIdx,
        identical: !!snap.identical,
        boardDiffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)),
        res, sdRes: MRS.readSd(battle), meRes: MRS.readMe(S),
        sd_active: battle.p2.active.map(p => p && id(p.species.id) + '@' + p.hp),
        me_active: S.actB.map(m => m && id(m.name) + '@' + m.curHP),
        sd_elig: sdEligible(battle.p2),
        sd_left: battle.p2.pokemonLeft,
      });
      /* Neutralised AFTER copying, so a red turn 1 does not hide turn 2 — the driver's own stop rule
       * ends a state-mode game at the first divergent board. Touches only the snapshot. */
      snap.identical = true; snap.diffs = [];
    },
  });
  const sdLog = G.lastSdLog ? G.lastSdLog() : [];
  const meLog = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sdT2: turnSlice(sdLog, 2), meT2: turnSlice(meLog, 2) };
}

/* ---- the arms ---------------------------------------------------------------------------------
 * `cups` names the arms whose target carries Suction Cups. Bench 1 is the CONTROL on both families:
 * one legal body in the back, so the drag is legal and every engine must do the same thing. */
const ARMS = [];
for (const d of DOORS) for (const depth of [1, 0]) {
  ARMS.push({ key: d.key + ':plain:' + depth, door: d.move, kind: d.kind, depth, back: BACK_PLAIN,
              cups: false, label: `${d.move} / bench ${depth} / plain target` });
  ARMS.push({ key: d.key + ':cups:' + depth, door: d.move, kind: d.kind, depth, back: BACK_CUPS,
              cups: true, label: `${d.move} / bench ${depth} / SUCTION CUPS target` });
}

console.log('\nTHE ANNOUNCE-FAILURE CLASS — protocol, board AND move-result state, one instant\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id));
console.log('  restore knob MEDI_DRAG_ABILITY_FIRST=' + (process.env.MEDI_DRAG_ABILITY_FIRST || '(off)'));

const R = {};
for (const arm of ARMS) R[arm.key] = run(arm.door, arm.depth, arm.back, 'announce-failure:' + arm.key);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const arm of ARMS) {
  const x = R[arm.key];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + arm.label.toUpperCase() + '   [' + arm.kind + ']');
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  const last = x.seen[x.seen.length - 1] || null;
  x.last = last;
  if (last) {
    console.log(`  p2 active  sd [${last.sd_active.join(', ')}]   me [${last.me_active.join(', ')}]`);
    console.log(`  p2 bench   sd [${last.sd_elig.join(', ')}]   sd pokemonLeft ${last.sd_left}`);
    console.log('  BOARD identical: ' + (last.identical ? 'YES' : 'NO')
      + (last.identical ? '' : '\n    ' + last.boardDiffs.join('\n    ')));
    const rowOf = (o, s) => (o[s] ? o[s].species + ' this=' + o[s].this + ' last=' + o[s].last : '(no body)');
    console.log('  MOVE RESULT p1a (the MOVER)   sd ' + rowOf(last.sdRes, 'p1a')
      + '\n                                me ' + rowOf(last.meRes, 'p1a'));
    console.log('  MOVE RESULT p2a (the TARGET)  sd ' + rowOf(last.sdRes, 'p2a')
      + '\n                                me ' + rowOf(last.meRes, 'p2a'));
    console.log('  RESULT identical: ' + (last.res.identical ? 'YES' : 'NO')
      + (last.res.identical ? '' : '\n    ' + last.res.diffs.map(d =>
          `${d.slot} ${d.species} .${d.field}  sd=${d.sd}  me=${d.me}`).join('\n    '))
      + (last.res.misaligned.length ? '\n    INDEX-PARALLEL FAILURE: ' + JSON.stringify(last.res.misaligned) : ''));
  }
  console.log('  turn-2 narration  showdown  ' + (x.sdT2.length ? narr(x.sdT2).join('  ') : '(none)'));
  console.log('  turn-2 narration  medicham  ' + (x.meT2.length ? narr(x.meT2).join('  ') : '(none)'));
  x.narrAgree = narr(x.sdT2).join(' ') === narr(x.meT2).join(' ');
  x.sdFail = x.sdT2.some(l => /^\|-fail\|/.test(l));
  x.meFail = x.meT2.some(l => /^\|-fail\|/.test(l));
  x.sdAct = x.sdT2.some(l => /^\|-activate\|/.test(l));
  x.meAct = x.meT2.some(l => /^\|-activate\|/.test(l));
  x.sdDrag = x.sdT2.some(l => /^\|drag\|/.test(l));
  x.meDrag = x.meT2.some(l => /^\|drag\|/.test(l));
  console.log(`  -fail? sd=${x.sdFail} me=${x.meFail}   -activate? sd=${x.sdAct} me=${x.meAct}`
    + `   drag? sd=${x.sdDrag} me=${x.meDrag}   narration equal: ${x.narrAgree ? 'YES' : 'NO'}`);
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then BOARD, then RESULT, then NARRATION');
console.log('='.repeat(98));

/* -- 1. THE FIXTURE. Nothing below means anything if the knob did not move. ---------------------- */
const depthOf = k => { const s = R[k] && R[k].last; return s ? s.sd_elig.length : -1; };
for (const fam of ['plain', 'cups']) for (const d of DOORS) {
  const one = depthOf(`${d.key}:${fam}:1`), zero = depthOf(`${d.key}:${fam}:0`);
  ok(one === 1 && zero === 0,
    `the bench knob moved in the AUTHORITY's own count — ${d.key}/${fam}: bench 1 -> ${one}, bench 0 -> ${zero}`,
    one === 1 && zero === 0 ? '' : 'IDENTICAL DEPTHS MEAN THE FIXTURE IS UNWIRED, not that the depth does not matter');
}
for (const arm of ARMS.filter(a => a.cups)) {
  const s = R[arm.key] && R[arm.key].last;
  ok(!!s && /malamar/.test(s.sd_active[0] || ''),
    `the Suction Cups body actually reached the aimed slot — ${arm.key}: p2a is ${s ? s.sd_active[0] : '?'}`,
    s && /malamar/.test(s.sd_active[0] || '') ? '' : 'the replacement did not land in slot 0; this arm measures nothing');
}

/* -- 2. THE BOARD — the bar quarantine is read against. ------------------------------------------ */
for (const arm of ARMS) {
  const s = R[arm.key] && R[arm.key].last;
  ok(!!s && s.identical, 'BOARD identical — ' + arm.label,
    s && s.identical ? '' : (s ? s.boardDiffs.join(' ; ') : 'no boundary taken'));
}

/* -- 3. THE MOVE RESULT — the half that has blocked this class every time. ----------------------- */
for (const arm of ARMS) {
  const s = R[arm.key] && R[arm.key].last;
  ok(!!s && s.res.identical, 'RESULT identical (moveLastTurnResult vs _mvResLast) — ' + arm.label,
    s && s.res.identical ? '' : (s ? s.res.diffs.map(d =>
      `${d.slot} ${d.species} .${d.field} sd=${d.sd} me=${d.me}`).join(' ; ') : 'no boundary taken'));
}

/* -- 4. THE NARRATION. ------------------------------------------------------------------------- */
for (const arm of ARMS) {
  const x = R[arm.key];
  ok(!!x && x.narrAgree === true, 'NARRATION identical — ' + arm.label,
    x && x.narrAgree ? '' : 'sd [' + narr(x.sdT2 || []).join(' ') + ']  me [' + narr(x.meT2 || []).join(' ') + ']');
}

/* -- 4b. THE `-fail` MULTISET, SPELLED WITHOUT NAMING ANYTHING. ----------------------------------
 * Clause 4 compares the whole turn stream and would catch this too; this one is separate so that a
 * failure of exactly THIS class is NAMED as one rather than arriving as a generic stream difference.
 * It is the predicate `engine/gate_fail_and_silent.js` applies to the whole-game artifact, applied
 * to a staged board: how many `|-fail|` lines did each engine write, and on whom. */
const failSet = lines => (lines || []).filter(l => /^\|-fail\|/.test(l))
  .map(l => l.split('|').slice(1, 3).join('|').split(':').pop().trim().toLowerCase()).sort().join(' , ');
for (const arm of ARMS) {
  const x = R[arm.key];
  const a = failSet(x && x.sdT2), b = failSet(x && x.meT2);
  ok(a === b, 'the `-fail` MULTISET matches — ' + arm.label,
    a === b ? '' : 'authority [' + (a || '(none)') + ']  ours [' + (b || '(none)') + ']');
}

/* -- 5. THE ASYMMETRY IS THE POINT, so it is asserted on the AUTHORITY as its own control. -------
 * An engine that announced on BOTH doors, or on NEITHER, would pass a bare "narration equal" check
 * on one arm. These two lines say the knob under the announcement is the move CATEGORY. */
ok(R['roar:plain:0'] && R['roar:plain:0'].sdFail === true,
  'the AUTHORITY announces on the STATUS door with an empty bench (damage undefined -> false)');
ok(R['dragontail:plain:0'] && R['dragontail:plain:0'].sdFail === false,
  'the AUTHORITY is SILENT on the DAMAGING door with an empty bench (a number outranks the false)');
ok(R['roar:cups:0'] && R['roar:cups:0'].sdAct === false,
  'the AUTHORITY does NOT write Suction Cups\' -activate with an empty bench — canSwitch is asked '
  + 'ABOVE DragOut, so the ability never runs');
ok(R['roar:cups:1'] && R['roar:cups:1'].sdAct === true,
  'the CONTROL clears: with ONE body in the back the AUTHORITY does write it, so the arm above is '
  + 'about the bench and not about the ability being absent');

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD') + '   (' + ARMS.length + ' arms)');
process.exit(fails ? 1 : 0);
