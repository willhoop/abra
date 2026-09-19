#!/usr/bin/env node
/* tests/probe_protect_stall_lifecycle.js — ROADMAP #220: THE PROTECT STALL COUNTER, BOTH ENGINES, STAGED
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_protect_stall_lifecycle.js
 *   ... --red        also plays every scenario over an in-memory engine whose `willAct()` analogue
 *                    always answers "someone acts after me" — the demonstration that this file can see
 *                    a stall-gate defect at all. Nothing on disk is patched.
 *
 * ================= WHY THIS EXISTS ===============================================================
 *
 * #220 has carried, since 2026-08-11, a family of whole-game divergences in which the authority
 * RAISES a Protect (`-singleturn … Protect`) where this engine writes `-fail`. Two staged patterns
 * (the gap turn, and the turn after a lost roll) agreed; the row named two candidates it had NOT
 * eliminated — the membership of the `willAct()` guard, and a cascade from an earlier line — and no
 * instrument ever decided them. On 2026-09-18 the family is ABSENT from all three whole-game team
 * lattices on HEAD, which is not a proof of anything. So this file constructs the fixture instead of
 * waiting for the pool to supply it.
 *
 * ================= THE AUTHORITY, READ AT THE LINE ================================================
 *
 *   data/mods/champions/moves.ts:755-758  `protect: { inherit: true, pp: 5 }` — the handler is mainline's.
 *   data/moves.ts:13975-13977             onPrepareHit(pokemon) {
 *                                            return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
 *   data/moves.ts:13978-13980             onHit(pokemon) { pokemon.addVolatile('stall'); }
 *   data/conditions.ts:439-462            `stall`: duration 2, counter 3 on start, x3 on restart (max
 *                                          729), `randomChance(1, counter)`, deleted on a lost roll.
 *                                          No Champions override (data/mods/champions/conditions.ts).
 *   sim/battle-queue.ts:310-317           willAct(): the first queued action whose choice is 'move',
 *                                          'switch', 'instaswitch' or 'shift' — anything else is not an actor.
 *
 * ================= WHAT IS STAGED, AND WHAT IS COMPARED ==========================================
 *
 * Five scenarios, every stall road the authority has: a streak of consecutive shields (so the 1/3,
 * 1/9, 1/27 rolls are drawn and some are LOST under the shared pin), a gap turn, the shield that holds
 * the LAST action of the turn (all four actives shielding — `willAct()` finds nothing after it), the
 * same with one attacker left in the queue, and a shield on the turn after a refusal.
 *
 * Nothing declares a result. For each scenario the file reads, from BOTH protocol streams, every
 * Protect click and whether it was raised (`-singleturn`) or refused (`-fail`), in order, and compares
 * the two sequences; and it compares the whole board at every turn boundary, which includes the
 * `stall` leaf. A scenario AGREES only if both do. A scenario whose script did not play in full, or in
 * which no Protect was ever refused on the authority, is reported as such rather than as agreement.
 *
 * Exit 0 only if every scenario agrees AND at least one refusal of each kind (a lost roll, a
 * last-action refusal) was actually exercised on the authority; exit 1 otherwise; exit 2 when it
 * cannot run.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
const RED = process.argv.includes('--red');
const SB = require(D('tests', 'staged_board.js'));

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const PR = { m: 'protect' };
const A = [mon('incineroar', '', 'Blaze', ['Protect', 'Swords Dance', 'Fake Out']),
           mon('clefable', '', 'Magic Guard', ['Protect', 'Moonblast']),
           mon('milotic', '', 'Marvel Scale', ['Protect']), mon('garchomp', '', 'Rough Skin', ['Protect'])];
const B = [mon('snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']),
           mon('weavile', '', 'Pressure', ['Protect', 'Night Slash']),
           mon('toxapex', '', 'Regenerator', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])];
const ATK = { p1b: { m: 'moonblast', t: 0 }, p2a: { m: 'bodyslam', t: 0 }, p2b: { m: 'nightslash', t: 0 } };
const rep = (n, t) => Array.from({ length: n }, () => t);

const SCEN = [
  { id: 'streak', what: 'Both p1 bodies shield four turns running while both foes attack — the 1/3, 1/9, 1/27 '
      + 'rolls are drawn under the shared pin and some are lost, so both a raised and a lost roll occur. (Five turns '
      + 'with a p1 attacker KOed Snorlax and the script had no click for its replacement.)',
    script: rep(4, { p1: [PR, PR], p2: [ATK.p2a, ATK.p2b] }) },
  { id: 'gap', what: 'Shield, Swords Dance, shield, shield — the counter must lapse across the gap turn.',
    script: [{ p1: [PR, ATK.p1b], p2: [ATK.p2a, ATK.p2b] },
             { p1: [{ m: 'swordsdance' }, ATK.p1b], p2: [ATK.p2a, ATK.p2b] },
             { p1: [PR, ATK.p1b], p2: [ATK.p2a, ATK.p2b] },
             { p1: [PR, ATK.p1b], p2: [ATK.p2a, ATK.p2b] }] },
  { id: 'all-four-shield', what: 'All four actives shield, three turns — the slowest holds the last action '
      + 'of the turn and willAct() finds nothing after it, so the authority refuses it without a roll.',
    script: rep(3, { p1: [PR, PR], p2: [PR, PR] }) },
  { id: 'three-shield-one-attacker', what: 'Three shields and one Night Slash — every shield has an actor '
      + 'after it, so none is refused by willAct(); only rolls decide.',
    script: rep(3, { p1: [PR, PR], p2: [PR, ATK.p2b] }) },
  { id: 'after-refusal', what: 'All four shield on turn 1 (the slowest is refused), then only the attackers '
      + 'change: turn 2 the refused body shields again with actors behind it.',
    script: [{ p1: [PR, PR], p2: [PR, PR] }, { p1: [PR, PR], p2: [ATK.p2a, ATK.p2b] },
             { p1: [PR, PR], p2: [ATK.p2a, ATK.p2b] }] },
].map(s => ({ ...s, A, B, kind: 'move', shape: 'protect stall', census: '#220', negative: 'every turn is compared' }));

/* PROTECT OUTCOMES, READ OFF A PROTOCOL STREAM. A `|move|pXY…|Protect` line is followed by the
 * `-singleturn` that raises it or the `-fail` that refuses it; anything else is recorded as `?`. */
function outcomes(lines) {
  const out = []; let turn = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = String(lines[i]);
    const t = /^\|turn\|(\d+)/.exec(l); if (t) { turn = +t[1]; continue; }
    const m = /^\|move\|(p[12][ab])[^|]*\|protect(\||$)/i.exec(l);
    if (!m) continue;
    let res = '?';
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const n = String(lines[j]);
      if (new RegExp('^\\|-singleturn\\|' + m[1] + '[^|]*\\|(move: )?protect', 'i').test(n)) { res = 'raised'; break; }
      if (new RegExp('^\\|-fail\\|' + m[1]).test(n)) { res = 'refused'; break; }
      if (/^\|move\|/.test(n)) break;
    }
    out.push('t' + turn + ':' + m[1] + ':' + res);
  }
  return out;
}

const WILL_FROM = 'for(let k=idx+1;k<acts.length;k++)if(SD_WILL_ACT.has(sdChoiceOf(acts[k].a)))return true;';
function play(sc, src) {
  const G = SB.harness(src);
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { verdict: 'NOT-STAGED' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'staged:stall:' + sc.id, { script: sc.script,
    onBoundary: (snap, turnIdx) => { boards.push({ turn: turnIdx, n: snap.leaves_compared, diffs: snap.diffs.map(d => BS.locate(d, snap)) });
      snap.identical = true; snap.diffs = []; } });
  if (r.err) return { verdict: 'THREW', why: r.err };
  const sc2 = G.scriptCounters ? G.scriptCounters() : {};
  const sd = outcomes(G.lastSdLog()), me = outcomes(r.mediTrace);
  const boardDiffs = boards.reduce((n, x) => n + x.diffs.length, 0);
  const firstBoard = boards.find(x => x.diffs.length);
  const short = r.turns !== sc.script.length || boards.some(x => !x.n);
  return { r, sd, me, boards, boardDiffs, firstBoard, short, refusedClicks: sc2.moveNotOnRequest || 0,
    same: JSON.stringify(sd) === JSON.stringify(me) };
}
const BS = require(D('engine', 'board_state.js'));

const fx = SB.fixtureAudit(SCEN);
if (fx.length) { console.log('THE FIXTURE IS WRONG — refusing to play it:'); for (const f of fx) console.log('  ' + f); process.exit(2); }

let bad = 0; const seen = { rolledLost: 0, lastActionRefused: 0 };
function report(tag, src) {
  let disagree = 0;
  for (const sc of SCEN) {
    const x = play(sc, src);
    if (x.verdict) { console.log('  ' + tag + '  ' + sc.id + '  ' + x.verdict + (x.why ? ' — ' + x.why : '')); disagree++; continue; }
    const ok = x.same && x.boardDiffs === 0 && !x.short && !x.refusedClicks;
    if (!ok) disagree++;
    console.log('  ' + tag + '  ' + (ok ? 'AGREES  ' : 'PARTS   ') + sc.id + '   ' + x.r.turns + '/' + sc.script.length + ' turns');
    console.log('      showdown  ' + x.sd.join(' '));
    console.log('      medicham  ' + x.me.join(' '));
    if (x.firstBoard) console.log('      first board parting at turn ' + x.firstBoard.turn + ': '
      + x.firstBoard.diffs.slice(0, 3).map(d => JSON.stringify(d)).join(' ; '));
    if (x.short) console.log('      SHORT — the script did not play in full or a boundary compared nothing');
    if (x.refusedClicks) console.log('      FIXTURE — ' + x.refusedClicks + ' scripted click(s) were not on the request');
    if (tag === 'CLEAN') {
      /* which refusal roads the AUTHORITY actually took — a fixture that never refuses asks nothing */
      for (const o of x.sd) if (/refused/.test(o)) {
        if (sc.id === 'all-four-shield' || (sc.id === 'after-refusal' && /^t1:/.test(o))) seen.lastActionRefused++;
        else seen.rolledLost++;
      }
    }
  }
  return disagree;
}

console.log('\ntests/probe_protect_stall_lifecycle.js — ROADMAP #220, the Protect stall counter in both engines');
console.log('\nCLEAN ENGINE');
const cleanBad = report('CLEAN', null);
bad += cleanBad;
console.log('\n  refusals exercised on the authority: lost roll ' + seen.rolledLost + ', last-action (willAct) ' + seen.lastActionRefused);
if (!seen.rolledLost) { console.log('  NOT EXERCISED — no Protect lost its roll on the authority; the roll road asked nothing'); bad++; }
if (!seen.lastActionRefused) { console.log('  NOT EXERCISED — no Protect was refused for holding the last action'); bad++; }

if (RED) {
  const p = SB.patchedSource({ break: { patch: [[WILL_FROM, 'return true;']] } });
  if (p.error) { console.log('\nRED ARM NOT BUILT — ' + p.error); bad++; }
  else {
    console.log('\nRED — the engine\'s willAct() analogue forced to "someone acts after me" (in memory)');
    const redBad = report('RED', p.src);
    console.log('  ' + (redBad ? 'RED PROVEN — ' + redBad + ' scenario(s) part under the break' : 'THE BREAK MOVED NOTHING — this file cannot see a willAct defect'));
    if (!redBad) bad++;
  }
}
console.log('\n' + (bad ? 'FAIL — ' + bad + ' problem(s)' : 'PASS — every staged stall road agrees, protocol and board'));
process.exit(bad ? 1 : 0);
