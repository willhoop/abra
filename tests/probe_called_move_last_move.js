/* probe_called_move_last_move.js — A MOVE THAT RAN AND FAILED IS STILL `battle.lastMove`, SO IT IS
 * STILL WHAT A CALLER COPIES. THIS ENGINE SKIPPED IT AND REACHED BACK TO AN OLDER CLICK.
 *
 *   SHOWDOWN_PATH=... node tests/probe_called_move_last_move.js
 *   SHOWDOWN_PATH=... node tests/probe_called_move_last_move.js --only failed-idle-blocks-the-copy
 *   SHOWDOWN_PATH=... node tests/probe_called_move_last_move.js --release <id>
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 *     clearActiveMove(failed?: boolean) {
 *       if (this.activeMove) { if (!failed) this.lastMove = this.activeMove; ... }
 *     }                                                             sim/battle.ts:376-385
 *
 * `failed` IS AN ARGUMENT, NOT A VERDICT ON THE MOVE, and that is the whole of this defect. Grepped
 * over `sim/` it is passed `true` at exactly five sites, four of them inside `runMove` and ALL FOUR
 * BEFORE the move is announced:
 *
 *     sim/battle-actions.ts:252   the `BeforeMove` event refused (flinch, sleep, Taunt, Disable, ...)
 *     sim/battle-actions.ts:258   a commented-out sanity check — dead code
 *     sim/battle-actions.ts:273   `beforeMoveCallback` returned true (Focus Punch lost its focus)
 *     sim/battle-actions.ts:284   `cant|nopp`
 *     sim/battle.ts:2810          the `residual` action, which is not a move at all
 *
 * Every other action ends at `runAction`'s own bare `this.clearActiveMove()` (sim/battle.ts:2828).
 * So a `-fail`, an `onTry` refusal, a type immunity and a miss ALL set `battle.lastMove`. Champions
 * overrides eight files and none of them touches `clearActiveMove` or `runAction` — grepped, not
 * recalled.
 *
 * ================= WHAT THIS ENGINE DID INSTEAD =================================================
 *
 * `field._pendingLastMove` is committed at the top of the NEXT announcement, which is the right
 * instant. The gate on it was not: it refused to commit a click whose `_mvRes` was false. `_mvRes` is
 * Stomping Tantrum's question (ROADMAP #84, `moveThisTurnResult`), which is false on BOTH roads and
 * therefore cannot tell an aborted move from one that ran and failed.
 *
 * The abort road needs no test here at all: every `BeforeMove` refusal, the no-PP road and the
 * `beforeMoveCallback` road `continue` ABOVE the announcement in `medicham2-browser.js`, so `_mid` is
 * never set for them and they never reach the commit site. That is the authority's `failed: true`
 * expressed as control flow instead of as a flag.
 *
 * ================= HOW IT WAS FOUND, AND IT WAS NOT WHERE IT WAS LOOKED FOR =====================
 *
 * `tests/roster.js --stage moves --only copycat` was DEFERRED-BY-OWNER on an underlying board
 * divergence, and the brief that opened this batch carried a diagnosis of a random-TARGET die
 * address. Played out on the roster's own fixture, the target is not involved: the authority's
 * turn-2 Copycat reads `|-fail|p2a: Samurott` and calls NOTHING. The last move ANNOUNCED was
 * Torterra's idle Sleep Talk, which had failed at its own `onTry` (`source.status === 'slp'`) and
 * carries `flags: { ... failcopycat: 1 ... }` (data/moves.ts:16868) — so the authority had committed
 * a move that failed and Copycat refused it. This engine skipped that click, reached back to
 * Goodra-Hisui's Dragon Pulse, and copied THAT: 26 HP off a Corviknight the authority never touched.
 *
 * THE TARGET DRAW IS CLEARED EXPLICITLY RATHER THAN ASSUMED INNOCENT. Two control arms below play
 * the identical called-attack fixture on the two corner arms, which pin `random(m)` to `m - 1` and to
 * `0` — the authority picks p1b on one and p1a on the other, so the knob is VARIED and the instrument
 * could have seen a difference. Both engines follow it.
 *
 * ================= THE KNOB =====================================================================
 *
 * `MEDI_FAILED_MOVE_NOT_LAST=1` puts the `_mvRes` gate back and stamps
 * `MEDFAILS.failedMoveNotLastRestored` AT LOAD, asserted absent on the clean load and present under
 * the knob — a knob read by a module the driver never loaded reads identically on both.
 *
 * ================= NO EXPECTATION IS TYPED ======================================================
 *
 * Every arm plays the identical script on both engines. Showdown's stream IS the answer; this file
 * asserts only that the two agree on four counted facts, that the knob puts the red arms back apart,
 * and that the controls do NOT move under the knob.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE — the later turns are the whole diagnosis. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_called_move_last_move.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_FAILED_MOVE_NOT_LAST';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE BOARDS --------------------------------------------------------------------------------
 * SPEEDS ARE THE DRIVER'S: active slot 0 is base+52 and slot 1 is base+42 (`spreadFor`, Champions'
 * `stat + evs + 20`, no nature). Every ordering this file depends on is a strict inequality between
 * two different base speeds, so nothing here is a tie and "it moved second" is never a die. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Sleep Talk'] }));

/* THE IDLE CLICK IS SLEEP TALK ON AN AWAKE BODY, i.e. a move that RUNS and FAILS at its own `onTry`.
 * That is the shape under test, and it is also the roster's own substituted control click. */
const ST = { m: 'sleeptalk' };

/* ---- ARM 1: the roster's own fixture, rebuilt here ---------------------------------------------- */
const R_A = stage([['goodrahisui', 'leftovers', 'Shell Armor', ['Dragon Pulse', 'Sleep Talk']],
                   ['corviknight', '', 'Pressure', ['Sleep Talk']]]).concat(BENCH('milotic', 'clefable'));
const R_B = stage([['samurott', 'sitrusberry', 'Shell Armor', ['Copycat', 'Sleep Talk']],
                   ['torterra', 'leftovers', 'Shell Armor', ['Sleep Talk']]]).concat(BENCH('milotic', 'clefable'));
const DP = { m: 'dragonpulse', t: 0 }, CC = { m: 'copycat' };
/* Samurott 122 > Goodra-Hisui 112 > Corviknight 109 > Torterra 98, so the Copycat on turn 2 resolves
 * FIRST and reads a last move left over from the end of turn 1 — Torterra's failed Sleep Talk. */
const R_SCRIPT = [{ p1: [DP, ST], p2: [ST, ST] },
                  { p1: [DP, ST], p2: [CC, ST] },
                  { p1: [DP, ST], p2: [ST, ST] }];

/* ---- ARM 2: the failed click is what gets COPIED, and it is not a `failcopycat` one -------------- */
const F_A = stage([['garchomp', '', 'Sand Veil', ['Brick Break', 'Sleep Talk']],
                   ['aromatisse', '', 'Aroma Veil', ['Sleep Talk']]]).concat(BENCH('milotic', 'corviknight'));
const F_B = stage([['goodrahisui', '', 'Shell Armor', ['Dragon Claw', 'Sleep Talk']],
                   ['clefable', '', 'Magic Guard', ['Copycat', 'Sleep Talk']]]).concat(BENCH('milotic', 'corviknight'));
const BB = { m: 'brickbreak', t: 0 }, DC1 = { m: 'dragonclaw', t: 1 };
/* Garchomp 154 > Goodra-Hisui 112 > Clefable 102 > Aromatisse 71, so one turn holds the whole
 * sequence: a Brick Break that LANDS, then a Dragon Claw aimed at a pure-Fairy Aromatisse which is
 * refused by type immunity, then the Copycat. The authority's last move is the DRAGON CLAW, so the
 * copy is a Dragon Claw; an engine that skips a failed click reaches back to the Brick Break and
 * copies that. Different move, different type chart, different HP — and the direction is the opposite
 * of arm 1, so the fix cannot be "refuse more". */
const F_SCRIPT = [{ p1: [BB, ST], p2: [DC1, CC] }];

/* ---- ARM 3 / 4 / 5: the controls ---------------------------------------------------------------- */
/* Samurott 122 > Clefable 102 > Snorlax 82 > Toxapex 77 — one turn, nothing fails anywhere, and the
 * copied move is a `normal` attack whose target the authority draws at random. */
const T_A = stage([['snorlax', '', 'Thick Fat', ['Amnesia']],
                   ['toxapex', '', 'Limber', ['Iron Defense']]]).concat(BENCH('garchomp', 'incineroar'));
const T_B = stage([['samurott', '', 'Torrent', ['Sacred Sword']],
                   ['clefable', '', 'Magic Guard', ['Copycat']]]).concat(BENCH('torterra', 'medicham'));
const T_SCRIPT = [{ p1: [{ m: 'amnesia' }, { m: 'irondefense' }],
                    p2: [{ m: 'sacredsword', t: 0 }, CC] }];

const CASES = [
  { id: 'failed-idle-blocks-the-copy', kind: 'red', arm: 'top-tie-first',
    A: R_A, B: R_B, script: R_SCRIPT,
    what: 'THE ROSTER ROW, REBUILT. Everyone idles on Sleep Talk while awake, so every idle click RUNS '
        + 'and FAILS. The last announced move before the turn-2 Copycat is Torterra\'s Sleep Talk, '
        + 'which carries `failcopycat` — so the authority\'s Copycat calls nothing and writes `-fail`. '
        + 'An engine that skips a failed click reaches past it to Goodra-Hisui\'s Dragon Pulse and '
        + 'copies that instead, which is board-material HP on a body the authority never touched.' },

  { id: 'failed-click-is-what-gets-copied', kind: 'red', arm: 'bottom-tie-first',
    A: F_A, B: F_B, script: F_SCRIPT,
    what: 'THE SAME RULE WITH THE OPPOSITE OUTCOME, so the fix cannot be "refuse more". The failed '
        + 'click here is a Dragon Claw refused by TYPE IMMUNITY against a pure-Fairy Aromatisse — no '
        + '`failcopycat` flag — so the authority does not refuse the copy, it COPIES THE FAILED CLICK. '
        + 'An engine that skips it reaches back to Garchomp\'s Brick Break, which landed one action '
        + 'earlier, and copies that instead. Both halves of the rule are therefore measured, not just '
        + 'the refusal.' },

  { id: 'successful-last-move', kind: 'control', arm: 'top-tie-first',
    A: T_A, B: T_B, script: T_SCRIPT,
    what: 'THE KNOB CLEARED EXPLICITLY — nothing on this board fails, so the commit rule has nothing '
        + 'to decide and the copied move must be the same on both loads. This is the arm a fix that '
        + 'committed the WRONG move (its own announcement, say) would break.' },

  { id: 'called-attack-target-top', kind: 'control', arm: 'top-tie-first',
    A: T_A, B: T_B, script: T_SCRIPT,
    what: 'THE RANDOM-TARGET DRAW, CLEARED ON THE TOP CORNER. `getRandomTarget` falls to '
        + '`side.randomFoe()` -> `battle.sample(this.foes())` (sim/battle.ts:2487-2523, '
        + 'sim/side.ts:367-371) and `PRNG#sample` is `this.random(items.length)` (sim/prng.ts:132-142), '
        + 'which this arm pins to `m - 1`. The authority lands on p1b. This arm and the next differ in '
        + 'NOTHING but that pin, so identical answers across them would mean the draw is unwired.' },

  { id: 'called-attack-target-bottom', kind: 'control', arm: 'bottom-tie-first',
    A: T_A, B: T_B, script: T_SCRIPT,
    what: 'THE SAME BOARD ON THE BOTTOM CORNER, where the pin is `0` and the authority lands on p1a '
        + 'instead. The pair is the explicit control on the brief\'s own hypothesis: the target draw '
        + 'MOVES when the die moves, and both engines move with it.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED -------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => CS.canLearn(sp, mv);
let illegal = 0;
const seenRow = new Set();
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const key = row.species + '|' + row.item + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) {
    console.log('ILLEGAL FIXTURE  ' + row.item + ' is not in this format'); illegal++;
  }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE AUTHORITY'S OWN CLAUSES, READ AT RUN TIME rather than quoted ---------------------------
 * If Champions ever stops flagging Sleep Talk `failcopycat`, or gives Focus Energy's condition an
 * `onRestart`, the two red arms stage something else entirely and this file must not report a pass. */
const stFlags = (dex.moves.get('sleeptalk') || {}).flags || {};
const dcFlags = (dex.moves.get('dragonclaw') || {}).flags || {};
const ccFlags = (dex.moves.get('copycat') || {}).flags || {};
const dragonIntoFairy = dex.getEffectiveness('Dragon', ['Fairy']);
const dragonImmune = dex.getImmunity('Dragon', ['Fairy']) === false;
console.log(NL + '  DERIVED — Sleep Talk carries failcopycat: ' + !!stFlags.failcopycat
  + '   |   Dragon Claw carries failcopycat: ' + !!dcFlags.failcopycat
  + '   |   Copycat refuses failcopycat: ' + !!ccFlags.failcopycat
  + '   |   Fairy is immune to Dragon: ' + dragonImmune + ' (effectiveness ' + dragonIntoFairy + ')');
if (!stFlags.failcopycat || dcFlags.failcopycat || !ccFlags.failcopycat || !dragonImmune) {
  console.log(NL + 'NOT RUN — the format no longer carries the clauses these arms are built on. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}
/* AND THE SET OF LEGAL CALLERS, PRINTED rather than named, so a caller this regulation gains is
 * visible here the day it appears. The tag is the format's own `move.callsMove` set. */
const TAGS = require(D('data', 'tags.json'));
const callers = Object.keys(TAGS.moves || {}).filter(k => {
  const p = (TAGS.moves[k] || {}).params || {}; return !!p.callsAnotherMove;
});
console.log('  DERIVED — legal moves that call another move: '
  + callers.map(k => k + '(' + JSON.stringify(((TAGS.moves[k] || {}).params || {}).callsAnotherMove.source) + ')').join(', '));

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slotOf = s => { const m = /^(p[12][ab])/.exec(String(s || '').trim()); return m ? m[1] : 'none'; };
const MOVE_LINE = /^\|move\|([^|]*)\|([^|]*)\|([^|]*)/;
const DMG_LINE = /^\|-damage\|([^|]*)\|([^|]*)/;
const START_LINE = /^\|-start\|([^|]*)\|([^|]*)/;
const FAIL_LINE = /^\|(-fail|-immune)\|([^|]*)/;

/* FOUR COUNTED FACTS, taken the same way off both streams and compared TO EACH OTHER — never to a
 * number typed here. `called` is the move id AND the slot it landed on, which is the only fact both
 * halves of this batch are about; `dmg` is the slot and the HP string; `start` is the slot and the
 * volatile; `fail` is the slot. Move NAMES are normalised because the two narrators spell them
 * differently and a spelling difference is not the question. */
function facts(lines) {
  const moves = [], dmg = [], starts = [], fails = [];
  for (const raw of (lines || []).map(String)) {
    let m = MOVE_LINE.exec(raw);
    if (m) { moves.push(slotOf(m[1]) + '/' + id(m[2]) + '->' + slotOf(m[3])); continue; }
    m = DMG_LINE.exec(raw);
    if (m) { dmg.push(slotOf(m[1]) + '/' + String(m[2]).trim()); continue; }
    m = START_LINE.exec(raw);
    if (m) { starts.push(slotOf(m[1]) + '/' + id(m[2])); continue; }
    m = FAIL_LINE.exec(raw);
    if (m) { fails.push(id(m[1]) + '/' + slotOf(m[2])); }
  }
  return { moves, dmg, starts, fails };
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const agree = (x, y) => same(x.moves, y.moves) && same(x.dmg, y.dmg)
                     && same(x.starts, y.starts) && same(x.fails, y.fails);
const show = f => 'move[' + f.moves.join(' ') + ']  dmg[' + f.dmg.join(' ') + ']  start['
  + f.starts.join(' ') + ']  fail[' + f.fails.join(' ') + ']';

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_called_move_last_move :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta,
    sd: facts(G.sdStream(G.lastSdLog())),
    me: facts(r.mediTrace),
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).failedMoveNotLastRestored || 0 };
}

let bad = 0, ran = 0;
const sdByCase = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   arm ' + c.arm);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;
  sdByCase.set(c.id, clean.sd);

  console.log('    showdown  ' + show(clean.sd));
  console.log('    medicham  ' + show(clean.me));
  console.log('    medicham  ' + show(brk.me) + '   [knob]');
  console.log('    commits after a failed click   clean '
    + (clean.delta.lastMoveCommittedAfterFailure || 0)
    + '   knob ' + ((brk.delta || {}).lastMoveCommittedAfterFailure || 0));
  console.log('    MEDFAILS stamp            clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   script clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : ''));

  /* A CLICK THE REQUEST DID NOT OFFER becomes a `pass` on both engines and the arm agrees while
   * testing nothing. Asserted at EXACT zero. */
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  /* SHORT IS NOT A PASS. */
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue;
  }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED. Stamped at LOAD, so this reads the same
   * whether or not the fixture ever touches the commit site. */
  if (!(clean.restored === 0 && brk.restored > 0)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue;
  }
  /* THE FIX MUST HAVE BITTEN ON A RED ARM, AND MUST NOT ON THE CONTROLS. A red arm whose counter is
   * zero has agreed for some other reason and is not evidence. */
  const bites = clean.delta.lastMoveCommittedAfterFailure || 0;
  if (c.kind === 'red' && !bites) {
    console.log('    >> THE COMMIT SITE NEVER SAW A FAILED CLICK — this arm is not evidence.'); bad++;
  }
  if (c.kind === 'control' && bites) {
    console.log('    >> A CONTROL STAGED A FAILED CLICK — it is not a control.'); bad++;
  }

  if (!agree(clean.sd, clean.me)) { console.log('    >> DEFECT — the two engines disagree.'); bad++; }
  else console.log('    >> the two engines agree, line for line, on all four facts.');

  if (c.kind === 'red') {
    if (agree(clean.sd, brk.me)) { console.log('    >> THE KNOB DID NOT MOVE ANYTHING — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this arm a red one.');
  } else {
    if (!agree(clean.sd, brk.me)) { console.log('    >> OVER-FIRE — the control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* ---- THE TARGET PAIR MUST NOT BE THE SAME ANSWER TWICE -----------------------------------------
 * Two control arms that differ only in the pin on `random(m)` and report the SAME landing slot would
 * mean the die is unwired, and both engines would then be agreeing about nothing. Asserted on the
 * AUTHORITY'S own stream, which is the half this file is not testing. */
const top = sdByCase.get('called-attack-target-top'), bot = sdByCase.get('called-attack-target-bottom');
if (top && bot) {
  const land = f => f.moves.filter(x => /sacredsword/.test(x)).map(x => x.split('->')[1]).join(',');
  console.log(NL + '  THE TARGET KNOB IS VARIED — authority landings   top [' + land(top)
    + ']   bottom [' + land(bot) + ']');
  if (land(top) === land(bot)) {
    console.log('    >> THE TARGET DRAW DID NOT MOVE ACROSS THE TWO PINS — these controls clear nothing.');
    bad++;
  }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
