/* test-medicham-api.js -- engine/medicham_api.js, the solver-facing wrapper: T1, step purity, T2, endings.
 *
 *   node tests/test-medicham-api.js [--regulation regmc] [--team-store <dir>] [--games 12] [--no-red] [--only t1,pure,t2,end]
 *
 * Brief: docs/_reports/2026-09-23-engine-interface-brief.md §4. Account: docs/_reports/2026-09-24-solver-engine-api.md.
 * Battles are built from REAL open sheets in the selected regulation's frozen pool (tests/medicham_api_fixtures.js)
 * and driven by a seeded uniform pick over `legalActions`' joint set, so every position here is one the API itself
 * produced. Single process, a few seconds. What each clause asserts:
 *
 *   T1  CLONE ROUND TRIP. At every position of every game: C = clone(P). C and P are then played to the end on forks
 *       of the same dice with the same policy coin. The canonical digest (API.digest) and the protocol must agree at
 *       EVERY turn, P must be unchanged after C has been played to the end (the brief's M1 check), and step(P) must
 *       equal stepInPlace(clone(P)). The sample must include positions AFTER a mega evolution and positions WITH a
 *       charging body, or the clause cannot answer for them and FAILS.
 *   PURE  step() and legalActions() never mutate their input: digest and trace length of P unchanged by both.
 *   T2  NO CROSS-BATTLE LEAKAGE. N battles played (A0) each alone, (A2) round-robin one turn at a time, (A3) tree-
 *       shaped (built one at a time while the others live) must produce identical per-turn digests and protocol --
 *       once on seeded dice, once with EVERY battle on the SAME event-dice seed (the MID_NTH leak of the 2026-09-11
 *       interleave audit, which the opt-in battle scope closes). Plus the neutrality side: a LEGACY battle (plain
 *       battleInit, no scope, the differential's own dice) plays identically alone and with API battles stepped
 *       between its turns. And a terminal battle's winner reads the same after an unrelated battle is built.
 *   END  isTerminal is the wipe and nothing else: a position pushed to turn 20 is battleOver (the old function,
 *       unchanged for its callers) and NOT isTerminal; winner is null until a side is wiped.
 *
 * RED, unless --no-red: this file re-runs itself as a child under each of the API's deliberate breaks and REQUIRES
 * the named clause to fail -- MEDI_API_SHALLOW_CLONE (T1), MEDI_API_STEP_IN_PLACE (PURE), MEDI_API_SHARED_SCRATCH
 * (T2's shared-seed arm). A clause that stays green under its break is blind: exit 3.
 */
'use strict';
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ONLY = new Set(String(flag('--only', 't1,pure,t2,end')).split(','));
const GAMES = +flag('--games', 12);
const NO_RED = argv.includes('--no-red');

const A = require('../engine/medicham_api.js');
const F = require('./medicham_api_fixtures.js');
const M = A.M;

function cannot(why) { console.log('ABRA-EXIT 2 CANNOT-ANSWER'); console.log('CANNOT ANSWER: ' + why); process.exit(2); }
let store = F.teamStore(argv);
if (store && store.refused) cannot(store.refused);
const L = F.loadPairs(store, GAMES * 3);
if (L.refused) cannot(L.refused);
const teams = [];
for (const p of L.pairs) {
  if (teams.length >= GAMES) break;
  const a = F.buildTeam(M, p.p1), b = F.buildTeam(M, p.p2);
  if (a && b) teams.push({ id: p.id, p1: p.p1, p2: p.p2 });
}
if (teams.length < Math.min(4, GAMES)) cannot('fewer than 4 buildable team pairs in ' + L.file);
const fresh = (t) => [F.buildTeam(M, t.p1), F.buildTeam(M, t.p2)];

let fail = 0;
const clauseFail = {};
const ok = (clause, c, msg) => { console.log((c ? '  ok    ' : '  FAIL  ') + '[' + clause + '] ' + msg); if (!c) { fail++; clauseFail[clause] = 1; } };
console.log('test-medicham-api: ' + teams.length + ' team pairs from ' + L.file);

const CAP = 60;
/* One game's worth of positions, each a clone kept aside, with the dice handle and the turn's joint actions. */
function playGame(t, gi) {
  const [a, b] = fresh(t);
  const rng = A.makeRng(9000 + gi);
  let S = A.newBattle(a, b, { rng, trace: [] });
  const pol = F.policyRng(M, 500 + gi);
  const out = [];
  while (!A.isTerminal(S) && S.turn < CAP) {
    const jA = F.pickJoint(A, S, 'A', pol), jB = F.pickJoint(A, S, 'B', pol);
    out.push({ P: A.clone(S, { trace: [] }), rng: rng.fork(), jA, jB });
    S = A.step(S, jA, jB, rng);
  }
  return { positions: out, end: S };
}
/* Play a position to the end on its own dice and coin, recording the digest and the new protocol at each turn. */
function playOut(S, rng, coinSeed, inPlace) {
  const pol = F.policyRng(M, coinSeed);
  const rec = [];
  let mark = S._trace ? S._trace.length : 0;
  while (!A.isTerminal(S) && S.turn < CAP) {
    const jA = F.pickJoint(A, S, 'A', pol), jB = F.pickJoint(A, S, 'B', pol);
    if (inPlace) A.stepInPlace(S, jA, jB, rng); else S = A.step(S, jA, jB, rng, { trace: S._trace });
    const lines = S._trace ? S._trace.slice(mark) : [];
    mark = S._trace ? S._trace.length : 0;
    rec.push(A.digest(S) + '|' + require('crypto').createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16));
  }
  return { rec, winner: A.winner(S), S };
}

const isMega = (m) => m && /-mega(-[xyz])?$/.test(String(m.name));
if (ONLY.has('t1') || ONLY.has('pure')) {
  let positions = 0, postMega = 0, charging = 0, t1bad = 0, stepEqBad = 0, m1bad = 0, pureBad = 0, legalBad = 0;
  const firstBad = [];
  let threw = 0;
  teams.forEach((t, gi) => {
    /* A THROW IS A FAILURE OF THE CLAUSE, NOT OF THE RUN: a clone that shares state with its original can leave a
     * battle the engine cannot continue (a switch to a body the other copy already brought in). Counted, named. */
    try {
    const g = playGame(t, gi);
    for (const [k, pos] of g.positions.entries()) {
      positions++;
      const P = pos.P;
      const bodies = [].concat(P.actA, P.actB, P.benchA, P.benchB);
      if (bodies.some(isMega)) postMega++;
      if (bodies.some(m => m && m._charging)) charging++;
      if (ONLY.has('pure')) {
        const d0 = A.digest(P), n0 = P._trace.length;
        A.legalActions(P, 'A'); A.legalActions(P, 'B');
        if (A.digest(P) !== d0) { legalBad++; if (firstBad.length < 3) firstBad.push('legalActions moved game ' + gi + ' turn ' + P.turn); }
        A.step(P, pos.jA, pos.jB, pos.rng.fork());
        if (A.digest(P) !== d0 || P._trace.length !== n0) { pureBad++; if (firstBad.length < 3) firstBad.push('step moved its input, game ' + gi + ' turn ' + P.turn); }
      }
      if (ONLY.has('t1')) {
        const d0 = A.digest(P);
        const C = A.clone(P, { trace: [] });
        if (A.digest(C) !== d0) { t1bad++; if (firstBad.length < 3) firstBad.push('clone digest differs at once, game ' + gi + ' turn ' + P.turn); continue; }
        /* step(P) == stepInPlace(clone(P)) on one turn */
        const s1 = A.step(P, pos.jA, pos.jB, pos.rng.fork());
        const s2 = A.stepInPlace(A.clone(P), pos.jA, pos.jB, pos.rng.fork());
        if (A.digest(s1) !== A.digest(s2)) stepEqBad++;
        const coin = 7000 + gi * 100 + k;
        const rc = playOut(C, pos.rng.fork(), coin, true);            // the clone, played in place to the end
        if (A.digest(P) !== d0) { m1bad++; if (firstBad.length < 3) firstBad.push('playing the clone moved the original, game ' + gi + ' turn ' + P.turn); }
        const rp = playOut(P, pos.rng.fork(), coin, false);           // the original, through step()
        if (JSON.stringify(rc.rec) !== JSON.stringify(rp.rec) || rc.winner !== rp.winner) {
          t1bad++;
          if (firstBad.length < 3) {
            let i = 0; while (i < rc.rec.length && rc.rec[i] === rp.rec[i]) i++;
            firstBad.push('clone and original part at play-out turn ' + (i + 1) + ' from game ' + gi + ' turn ' + P.turn);
          }
        }
      }
    }
    } catch (e) { threw++; t1bad++; if (firstBad.length < 3) firstBad.push('game ' + gi + ' THREW: ' + String(e.message).slice(0, 120)); }
  });
  console.log('        ' + positions + ' positions, ' + postMega + ' after a mega evolution, ' + charging + ' with a charging body'
    + (firstBad.length ? '; first: ' + firstBad.join(' | ') : ''));
  if (ONLY.has('t1')) {
    ok('t1', positions > 0 && postMega > 0 && charging > 0, 'the sample reaches post-mega (' + postMega + ') and mid-charge (' + charging + ') positions');
    ok('t1', t1bad === 0, 'clone round trip: digest and protocol equal at every play-out turn, to the end, from ' + positions + ' positions (' + t1bad + ' parted, ' + threw + ' games threw)');
    ok('t1', m1bad === 0, 'the original is unchanged after its clone is played to the end (' + m1bad + ' moved)');
    ok('t1', stepEqBad === 0, 'step(P) == stepInPlace(clone(P)) (' + stepEqBad + ' differ)');
  }
  if (ONLY.has('pure')) {
    ok('pure', pureBad === 0, 'step() never mutates its input: ' + positions + ' positions, ' + pureBad + ' moved');
    ok('pure', legalBad === 0, 'legalActions() never mutates its input (' + legalBad + ' moved)');
  }
}

if (ONLY.has('t2')) {
  const N = Math.min(8, teams.length);
  /* `dice`: 'seeded' -> each battle its own makeRng; 'event' -> EVERY battle on one event-dice seed */
  const build = (i, dice) => {
    const [a, b] = fresh(teams[i]);
    const rng = dice === 'event' ? A.makeEventDice(424242) : A.makeRng(31000 + i);
    const S = A.newBattle(a, b, { rng, trace: [] });
    return { i, S, rng, pol: F.policyRng(M, 61000 + i), rec: [], mark: S._trace.length };
  };
  const stepOne = (B) => {
    if (A.isTerminal(B.S) || B.S.turn >= CAP) return false;
    const jA = F.pickJoint(A, B.S, 'A', B.pol), jB = F.pickJoint(A, B.S, 'B', B.pol);
    A.stepInPlace(B.S, jA, jB, B.rng);
    const lines = B.S._trace.slice(B.mark); B.mark = B.S._trace.length;
    B.rec.push(A.digest(B.S) + '|' + lines.join('\n'));
    return true;
  };
  for (const dice of ['seeded', 'event']) {
    const iso = []; for (let i = 0; i < N; i++) { const B = build(i, dice); while (stepOne(B)); iso.push(B); }
    const rr = []; for (let i = 0; i < N; i++) rr.push(build(i, dice));
    for (let moved = true; moved;) { moved = false; for (const B of rr) moved = stepOne(B) || moved; }
    const tree = [];
    for (let i = 0; i < N; i++) { tree.push(build(i, dice)); for (const B of tree) stepOne(B); }
    for (let moved = true; moved;) { moved = false; for (const B of tree) moved = stepOne(B) || moved; }
    let diff = 0, turns = 0; const first = [];
    for (let i = 0; i < N; i++) {
      turns += iso[i].rec.length;
      for (const [name, arm] of [['round-robin', rr], ['tree', tree]]) {
        if (JSON.stringify(iso[i].rec) !== JSON.stringify(arm[i].rec)) {
          diff++;
          if (first.length < 2) { let k = 0; while (k < iso[i].rec.length && iso[i].rec[k] === arm[i].rec[k]) k++; first.push(name + ' battle ' + i + ' parts at turn ' + (k + 1)); }
        }
      }
    }
    ok('t2', turns > 0 && diff === 0, dice + ' dice: ' + N + ' battles, ' + turns + ' turns, alone vs round-robin vs tree-shaped: '
      + diff + ' of ' + 2 * N + ' comparisons differ' + (first.length ? ' (' + first.join('; ') + ')' : ''));
  }
  /* THE NEUTRALITY SIDE: a battle nobody gave a scope -- the differential's shape: plain battleInit, the event dice
   * made with the default reset -- plays the same with API battles stepped between its turns. */
  const legacy = (withApi) => {
    const [a, b] = fresh(teams[0]);
    const dice = M.midEventDice({ seed: 555 });
    const tr = [];
    const S = M.battleInit(a, b, { trace: tr, autoMega: false, rng: dice });
    const pol = F.policyRng(M, 777);
    const others = withApi ? [build(1, 'event'), build(2, 'event')] : [];
    const rec = []; let mark = tr.length;
    while (!M.sideWiped(S) && S.turn < 20) {
      const jA = F.pickJoint(A, S, 'A', pol), jB = F.pickJoint(A, S, 'B', pol);
      A.stepInPlace(S, jA, jB, dice);
      rec.push(A.digest(S) + '|' + tr.slice(mark).join('\n')); mark = tr.length;
      for (const B of others) stepOne(B);
    }
    return rec;
  };
  const l0 = legacy(false), l1 = legacy(true);
  ok('t2', l0.length > 0 && JSON.stringify(l0) === JSON.stringify(l1), 'a legacy (unscoped) battle on the global event dice plays identically with API battles stepped between its turns ('
    + l0.length + ' turns)');
  /* a terminal battle's winner, re-read after an unrelated battle is built */
  let wOk = 0, wBad = 0;
  for (let i = 0; i < N; i++) {
    const B = build(i, 'seeded'); while (stepOne(B));
    if (!A.isTerminal(B.S)) continue;
    const w0 = A.winner(B.S);
    A.newBattle(...fresh(teams[(i + 1) % teams.length]), { rng: A.makeRng(1) });
    M.battleInit(...fresh(teams[(i + 2) % teams.length]), {});
    if (A.winner(B.S) === w0 && (w0 === 0 || w0 === 1 || w0 === 0.5)) wOk++; else wBad++;
  }
  ok('t2', wOk > 0 && wBad === 0, 'winner of a finished battle is unchanged by building others after it (' + wOk + ' read, ' + wBad + ' moved)');
}

if (ONLY.has('end')) {
  const g = playGame(teams[0], 0);
  const P = g.positions[Math.min(2, g.positions.length - 1)].P;
  const T = A.clone(P); T.turn = 20; T.maxTurns = undefined;
  ok('end', M.battleOver(T) === true && A.isTerminal(T) === false && A.atHorizon(T, 20) === true && A.winner(T) === null,
    'turn 20, both sides standing: battleOver true (unchanged for its callers), isTerminal false, atHorizon(20) true, winner null');
  ok('end', A.isTerminal(g.end) && [0, 1, 0.5].includes(A.winner(g.end)) && A.winner(g.end) === M.battleResult(g.end),
    'a finished game: isTerminal true, winner ' + A.winner(g.end) + ' == battleResult');
  let threw = null; try { A.stepInPlace(T, [], [], A.makeRng(1)); } catch (e) { threw = e.message; }
  ok('end', !!threw && /horizon/.test(threw), 'stepping a battle at its horizon THROWS rather than silently doing nothing');
}

console.log('        API counters: ' + JSON.stringify(A.COUNTERS));
if (A.COUNTERS.clones === 0 || A.COUNTERS.stepsInPlace === 0 || A.COUNTERS.legalCalls === 0) { ok('wiring', false, 'an API counter read zero'); }

if (!NO_RED && !process.env.MEDI_API_RED_CHILD) {
  console.log('  RED ARMS -- each must FAIL its clause, or that clause is blind:');
  let blind = 0;
  /* each break must fail the ASSERTION it targets, not merely some line of its clause */
  for (const [knob, clause, want] of [['MEDI_API_SHALLOW_CLONE', 't1', 'clone round trip'],
                                      ['MEDI_API_STEP_IN_PLACE', 'pure', 'step() never mutates'],
                                      ['MEDI_API_SHARED_SCRATCH', 't2', 'event dice']]) {
    const args = [__filename, '--only', clause, '--games', String(Math.min(GAMES, 8)), '--no-red'];
    if (flag('--team-store', null)) args.push('--team-store', flag('--team-store'));
    const r = cp.spawnSync(process.execPath, args, { env: Object.assign({}, process.env, { [knob]: '1', MEDI_API_RED_CHILD: '1' }), encoding: 'utf8', maxBuffer: 1 << 28 });
    const line = (r.stdout.split('\n').find(l => l.includes('FAIL  [' + clause + '] ' + want)) || '').trim();
    const red = r.status === 1 && !!line;
    console.log('    ' + knob + '=1 -> ' + (red ? 'red, as it must be: ' + line.slice(0, 160) : 'STILL GREEN (blind), exit ' + r.status));
    if (!red) blind++;
  }
  if (blind) { console.log('ABRA-EXIT 3 VERDICT-RED'); console.log('BLIND: ' + blind); process.exit(3); }
}
if (fail) { console.log('ABRA-EXIT 1 VERDICT-RED'); console.log('FAIL: ' + fail + ' (' + Object.keys(clauseFail).join(', ') + ')'); process.exit(1); }
console.log('ABRA-EXIT 0 VERDICT-GREEN');
console.log('PASS');
