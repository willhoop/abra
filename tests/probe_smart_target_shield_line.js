/* probe_smart_target_shield_line.js — `move.smartTarget = false` IS A ONE-SHOT ON THE ACTIVE MOVE, SO
 * N PROTECTING BODIES PRODUCE N-1 `|-activate|...|move: Protect` LINES. THIS ENGINE READ IT AS A MODE
 * AND WROTE NONE AT ALL.
 *
 *   SHOWDOWN_PATH=... node tests/probe_smart_target_shield_line.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `f6f44b329132`
 * (`data/game-differential.json`, 961 games, census digest `886d47cf7fef`, pool
 * `data/team-pool-frozen`, `--steering empirical --arm middle --turns 50`). One of the thirteen
 * NARRATION-ONLY `ordering` causes:
 *
 *   config pair-redirect-priority, seed ...bo3-2657802642 vs ...bo3-2657919785
 *   ordering :: |-activate|p1a|protect <> |move|p2a|flareblitz
 *
 *     the agreed line immediately before it
 *       |move|p2b: Dragapult|Dragon Darts
 *     then    showdown   |-activate|p1a: Meganium|move: Protect
 *                        |move|p2a: Incineroar|Flare Blitz|p1a: Meganium
 *                        |-activate|p1a: Meganium|move: Protect
 *             medicham2  |move|p2a: Incineroar|Flare Blitz|p1a: Meganium
 *                        |-activate|p1a: Meganium|move: Protect
 *
 * THE CLASS NAMES THE COMPARATOR, NOT THE DEFECT. Nothing is out of order there: medicham2 is one
 * line SHORT, and the comparator reports the first pair that fails to match, which happens to be an
 * `-activate` against a `move`.
 *
 * THE RULE HAS TWO CLAUSES AND THIS ENGINE HAD NEITHER. READ OFF THE AUTHORITY.
 *
 * CLAUSE 1 -- `smartTarget` IS CLEARED AT TARGET SELECTION WHEN THE MOVE CANNOT SPLIT.
 *
 *     getSmartTargets(target, move) {
 *       const target2 = target.adjacentAllies()[0];
 *       if (!target2 || target2 === this || !target2.hp) { move.smartTarget = false; return [target]; }
 *       if (!target.hp)                                  { move.smartTarget = false; return [target2]; }
 *       return [target, target2];
 *     }                                                     sim/pokemon.ts:757-768,
 *                                             called from `getMoveTargets` at :838-840, before any step
 *
 * -- so a dart aimed into a side with ONE live body is not a smart-target move by the time a shield
 * answers, and the shield announces exactly as it would for any other move. THAT IS THE POOL'S CARD:
 * p1b was empty at turn 8. This engine read `smartTarget` off the move's TAG and could not see it.
 *
 * CLAUSE 2 -- THE SILENCE IS A ONE-SHOT. Every shield condition says it in three lines --
 *
 *     onTryHit(target, source, move) {
 *       if (this.checkMoveBypassesProtect(move, source, target)) return;
 *       if (move.smartTarget) { move.smartTarget = false; }
 *       else { this.add('-activate', target, 'move: Protect'); }
 *                                                              data/moves.ts:1008-1013 (protect),
 *                                              and the identical block in the other shield conditions
 *
 * -- and the assignment is to a field on the ACTIVE MOVE, so it is spent by the FIRST visit. All the
 * visits happen inside ONE event: `hitStepTryHitEvent` is
 * `this.battle.runEvent('TryHit', targets, pokemon, move)` (sim/battle-actions.ts:642), `runEvent`
 * with an array target collects handlers per target through `findEventHandlers`
 * (sim/battle.ts:1037-1047) and sorts them LEFT TO RIGHT (`compareLeftToRightOrder`, :421, via the
 * `'TryHit'` branch at :789). So the first shield eats the silence and every later one announces.
 *
 * WHAT THIS ENGINE DID, AND WHY IT LOOKED RIGHT. 2026-08-24 read the same three lines and landed the
 * silence as a property of the MOVE (`if (_smartTarget) ... silent`), which is correct for exactly one
 * shield and wrong for two. Champions carries ONE smart-target move, it is `multihit: 2`, and the only
 * board that can tell the two readings apart is a doubles turn with a shield up in BOTH foe slots --
 * so the single-shield case, which is what the fix was checked against, agrees under either reading.
 *
 * MEASURED IN THE AUTHORITY BEFORE A BYTE MOVED, one staged doubles turn each:
 *     smart move, BOTH foes Protect      showdown 1 line (the SECOND foe)   medicham2 0
 *     smart move, only the FAR foe       showdown 0                         medicham2 0
 *     non-smart move, both Protect       showdown 1 line (the FIRST foe)    medicham2 1
 *
 * THE ARMS:
 *   REAL      the smart move into two shields. Both engines must write exactly ONE line, on the
 *             SECOND foe.
 *   SILENT A  the same board, a NON-smart single-target move. Both engines must write exactly ONE
 *             line, on the FIRST foe. This is what proves the announcement machinery works at all, so
 *             a green REAL arm is not "nothing announces anything".
 *   SILENT B  the smart move with only the FAR foe shielded. Both engines must write ZERO, because the
 *             one refusal spends the silence. Its job is to stop the fix being read as "always
 *             announce".
 *   SOLO      CLAUSE 1's own board: the defending side is taken down to ONE live body first, so the
 *             darts cannot split, and BOTH engines must write ONE line. It is built rather than found
 *             -- three self-fainting clicks with no bench behind them -- because a COULD-NOT-STAGE
 *             verdict is a claim about the fixture and never about the mechanic.
 *   CONTROL   two knobs in two children, because the rule has a wrong answer on either side of it.
 *             `MEDI_SMART_SHIELD_ALL_SILENT=1` is the engine as it stood until today (0 lines) and
 *             `MEDI_SMART_PROTECT_LINE=1` is the engine before 2026-08-24 (N lines). BOTH must move
 *             the REAL arm and NEITHER may move SILENT A -- an identical result across a varied knob
 *             means the knob is unwired, not that the placement does not matter.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_SMART_SHIELD_ALL_SILENT === '1' || process.env.MEDI_SMART_PROTECT_LINE === '1';
require(D('tests', '_live_release.js'));

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NL = String.fromCharCode(10);
let bad = 0;

/* ================================================================================================
 * 1. THE CAST, DERIVED FROM THE FORMAT. Nothing here is a remembered Pokemon fact.
 * ============================================================================================== */
const learns = (s, mv) => {
  let cur = s;
  for (let g = 0; cur && g < 6; g++) {
    const l = dex.species.getLearnsetData(cur.id);
    if (l && l.learnset && l.learnset[mv]) return true;
    cur = cur.prevo ? dex.species.get(cur.prevo) : null;
  }
  return false;
};
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''));

console.log(NL + '  === THE CAST, DERIVED THIS RUN ===');
/* THE MOVE IS READ OFF `smartTarget`, NEVER NAMED. If the format ever gains a second one the probe
 * picks it up without an edit, and the list is PRINTED because a derived membership that over-matches
 * is this division's standing hazard. */
const SMART = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.smartTarget)
  .sort((a, b) => a.id.localeCompare(b.id));
console.log('  moves carrying `smartTarget` in this format   : '
  + (SMART.map(m => m.name + ' (multihit ' + JSON.stringify(m.multihit) + ')').join(', ') || '(none)'));
if (!SMART.length) { console.log('  NOT STAGED — the format carries no smart-target move.'); process.exit(1); }
const SM = SMART[0];

/* AND THE SHIELD IS READ OFF OUR OWN TAG, so the arm is built from the fact the engine reads. */
const TAGS = require(D('data', 'tags.json'));
const SHIELDS = Object.keys(TAGS.moves || {})
  .filter(k => ((TAGS.moves[k] || {}).tags || []).includes('shieldsUser'))
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard; });
console.log('  `shieldsUser` moves legal in this format      : ' + (SHIELDS.join(', ') || '(none)'));
if (!SHIELDS.includes('protect')) {
  console.log('  NOT STAGED — the plain shield is not in the tag set; this probe reads it by name '
    + 'nowhere else and cannot build a board without it.');
  process.exit(1);
}

const USERS = POOL.filter(s => learns(s, SM.id));
console.log('  legal bodies that learn ' + SM.name + (' ').repeat(Math.max(0, 21 - SM.name.length))
  + ': ' + (USERS.map(s => s.name).join(', ') || '(none)'));
if (!USERS.length) { console.log('  NOT STAGED — no legal carrier of the smart move.'); process.exit(1); }
const USER = USERS[0];

/* THE NON-SMART CONTROL CLICK: a boring priority-0 single-target damaging move the SAME body knows,
 * with no secondary, no recoil, no charge and no multihit, so the only thing the arm can show is
 * whether the line was written. */
const BORING = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status'
  && !m.smartTarget && m.priority === 0 && !m.secondaries && !m.secondary && !m.recoil && !m.selfSwitch
  && !(m.flags && m.flags.charge) && !m.multihit && (m.accuracy === true || m.accuracy >= 100)
  && m.target === 'normal' && (m.flags && m.flags.protect) && learns(USER, m.id))
  .sort((a, b) => a.id.localeCompare(b.id));
console.log('  non-smart control clicks the same body knows  : '
  + (BORING.slice(0, 6).map(m => m.name).join(', ') || '(none)'));
if (!BORING.length) { console.log('  NOT STAGED — the smart-move carrier knows no plain single-target move.'); process.exit(1); }
const CTRL = BORING[0];

/* THE FOES: two bodies that learn the shield, plus a self-targeting status click for SILENT B so the
 * unshielded slot cannot contribute an `-activate` of its own. */
const SHIELDERS = POOL.filter(s => s.id !== USER.id && learns(s, 'protect'));
const SELF_STATUS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.selfSwitch).sort((a, b) => a.id.localeCompare(b.id));
const FOE_A = SHIELDERS[0];
const FOE_B = SHIELDERS.find(s => s.id !== FOE_A.id && SELF_STATUS.some(m => learns(s, m.id)));
if (!FOE_A || !FOE_B) { console.log('  NOT STAGED — two shielding foes could not be picked.'); process.exit(1); }
const FOE_B_SELF = SELF_STATUS.find(m => learns(FOE_B, m.id));
const ALLY = SHIELDERS.find(s => ![FOE_A.id, FOE_B.id].includes(s.id));
const BENCH = SHIELDERS.filter(s => ![FOE_A.id, FOE_B.id, ALLY.id].includes(s.id)).map(s => s.name);
if (!ALLY || BENCH.length < 4) { console.log('  NOT STAGED — the bench could not be filled.'); process.exit(1); }
console.log('  the board                                    : ' + USER.name + ' + ' + ALLY.name
  + '   vs   ' + FOE_A.name + ' (slot 0) + ' + FOE_B.name + ' (slot 1)');
console.log('  slot-1 self-click for SILENT B               : ' + FOE_B_SELF.name);

/* ================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const bench = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const isAct = l => /^\|-activate\|/.test(l) && /move: Protect/i.test(String(l));
const bodyOf = l => String(l).split('|')[2] || '';
const slotOf = l => (/^(p[12][ab])\s*:/.exec(bodyOf(l)) || [null, null])[1];

const run = (click, foeBClick, tag) => {
  const A = stage([[USER.name, '', '', [SM.name, CTRL.name, 'Protect']],
                   [ALLY.name, '', '', ['Protect']]]).concat(bench(BENCH[0], BENCH[1]));
  const B = stage([[FOE_A.name, '', '', ['Protect']],
                   [FOE_B.name, '', '', ['Protect', FOE_B_SELF.name]]]).concat(bench(BENCH[2], BENCH[3]));
  const script = [{ p1: [{ m: norm(click), t: 0 }, { m: 'protect' }],
                    p2: [{ m: 'protect' }, { m: norm(foeBClick) }] }];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_smart_target_shield_line :: ' + tag, { script });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  return { staged: true, r,
           sd: sd.filter(isAct).map(slotOf), me: me.filter(isAct).map(slotOf),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const REAL = run(SM.id, 'protect', CHILD ? 'real-control' : 'real');
if (!REAL.staged) { console.log(NL + '  NOT STAGED (real) — ' + REAL.why); process.exit(1); }
const SILA = run(CTRL.id, 'protect', CHILD ? 'silentA-control' : 'silentA');
if (!SILA.staged) { console.log(NL + '  NOT STAGED (silent A) — ' + SILA.why); process.exit(1); }
const SILB = run(SM.id, FOE_B_SELF.id, CHILD ? 'silentB-control' : 'silentB');
if (!SILB.staged) { console.log(NL + '  NOT STAGED (silent B) — ' + SILB.why); process.exit(1); }

/* ---- THE SOLO ARM, CLAUSE 1's OWN BOARD ----------------------------------------------------------
 *
 * The pool's card is a dart aimed into a side holding ONE live body, and `buildPair` builds four, so
 * the board is CONSTRUCTED rather than looked for: the defending side's second slot is emptied by
 * three self-fainting clicks with nothing left on the bench behind them, and only then does the dart
 * go in. Every body idles on a PURE SELF-BOOST in the meantime, with no evasion and no accuracy in it,
 * because the first draft's evasion boost made the third self-faint MISS and left a body standing,
 * which reads exactly like a fixture that cannot be built. */
const SELF_FAINT = dex.moves.all().filter(m => m.exists && !m.isNonstandard
  && m.selfdestruct === 'ifHit' && m.category === 'Status' && m.target === 'normal');
const IDLE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.selfSwitch && !m.selfdestruct && !SHIELDS.includes(m.id)
  && !(m.flags && m.flags.charge) && m.boosts && Object.keys(m.boosts).length
  && Object.values(m.boosts).every(v => v > 0) && !m.boosts.evasion && !m.boosts.accuracy);
console.log(NL + '  self-fainting status clicks aimed at a foe    : '
  + (SELF_FAINT.map(m => m.name).join(', ') || '(none)'));
const idlesFor = sp => IDLE.filter(m => learns(sp, m.id)).slice(0, 3);
const soloArm = () => {
  if (!SELF_FAINT.length) return { staged: false, why: 'the format carries no self-fainting status move' };
  const SF = SELF_FAINT[0];
  const FAINTERS = POOL.filter(sp => sp.id !== USER.id && sp.id !== FOE_A.id && learns(sp, SF.id)).slice(0, 3);
  if (FAINTERS.length < 3) return { staged: false, why: 'fewer than three legal ' + SF.name + ' carriers' };
  const spare = POOL.filter(sp => ![USER.id, FOE_A.id].concat(FAINTERS.map(x => x.id)).includes(sp.id)
    && learns(sp, 'protect') && idlesFor(sp).length);
  if (spare.length < 3) return { staged: false, why: 'the attacking side could not be filled' };
  const SALLY = spare[0], SB1 = spare[1], SB2 = spare[2];
  const iU = idlesFor(USER), iA = idlesFor(SALLY), iF = idlesFor(FOE_A);
  if (!iU.length || !iA.length || !iF.length) return { staged: false, why: 'a body knows no pure self-boost' };
  const pick = (a, k) => a[k % a.length];
  const A = stage([[USER.name, '', '', [SM.name].concat(iU.map(m => m.name))],
                   [SALLY.name, '', '', ['Protect'].concat(iA.map(m => m.name))],
                   [SB1.name, '', '', ['Protect']], [SB2.name, '', '', ['Protect']]]);
  const B = stage([[FOE_A.name, '', '', ['Protect'].concat(iF.map(m => m.name))],
                   [FAINTERS[0].name, '', '', [SF.name]],
                   [FAINTERS[1].name, '', '', [SF.name]],
                   [FAINTERS[2].name, '', '', [SF.name]]]);
  const idleTurn = k => ({ p1: [{ m: norm(pick(iU, k).id) }, { m: norm(pick(iA, k).id) }],
                           p2: [{ m: norm(pick(iF, k).id) }, { m: norm(SF.id), t: 1 }] });
  const script = [idleTurn(0), idleTurn(1), idleTurn(2),
                  { p1: [{ m: norm(SM.id), t: 0 }, { m: 'protect' }], p2: [{ m: 'protect' }] }];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_smart_target_shield_line :: solo', { script });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* THE FIXTURE'S OWN CLAIM, CHECKED ON THE AUTHORITY'S STREAM: the far slot really is empty when the
   * dart goes in, i.e. three faints in that slot and nothing entering it afterwards. */
  const t4 = sd.findIndex(l => /^\|turn\|4/.test(l));
  const solo = t4 >= 0 && !sd.slice(t4).some(l => /^\|switch\|p2b/.test(l))
               && sd.slice(0, t4).filter(l => /^\|faint\|p2b/.test(l)).length === 3;
  if (!solo) return { staged: false, why: 'the defending side was not reduced to one live body by turn 4' };
  const after = arr => { const i = arr.findIndex(l => /^\|turn\|4/.test(l)); return i < 0 ? [] : arr.slice(i); };
  return { staged: true, cast: FOE_A.name + ' alone, ' + SF.name + ' x3',
           sd: after(sd).filter(isAct).map(slotOf), me: after(me).filter(isAct).map(slotOf),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};
const SOLO = soloArm();
if (!SOLO.staged) { console.log(NL + '  NOT STAGED (solo) \u2014 ' + SOLO.why); process.exit(1); }

const show = (tag, R) => {
  console.log(NL + '  === ' + tag + ' ===');
  console.log('    showdown  |-activate move: Protect x' + R.sd.length + '   ' + JSON.stringify(R.sd));
  console.log('    medicham2 |-activate move: Protect x' + R.me.length + '   ' + JSON.stringify(R.me));
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
};
show('REAL — ' + SM.name + ' into TWO shields', REAL);
show('SILENT A — ' + CTRL.name + ' (not smart) into the SAME two shields', SILA);
show('SILENT B — ' + SM.name + ' with only the FAR slot shielded', SILB);
show('SOLO — ' + SM.name + ' into a side holding ONE live body (' + SOLO.cast + ')', SOLO);

if (CHILD) {
  const which = process.env.MEDI_SMART_SHIELD_ALL_SILENT === '1' ? 'ALL_SILENT' : 'PROTECT_LINE';
  console.log(NL + '  CONTROL ARM (' + which + ') — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ which, real: REAL.me, realDiv: !!REAL.div,
    realDivLine: REAL.div && REAL.div.me, silA: SILA.me, silADiv: !!SILA.div, silB: SILB.me,
    solo: SOLO.me, soloDiv: !!SOLO.div }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

/* ================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '  === THE VERDICT ===');
const cmp = (what, ok, detail) => {
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + detail);
  if (!ok) bad++;
  return ok;
};

/* THE FIXTURE FIRST, off the AUTHORITY's own stream. A probe that asserts against medicham2 without
 * first proving the authority did the thing is measuring nothing. */
cmp('the fixture: the authority writes exactly ONE line on two shields', REAL.sd.length === 1,
    REAL.sd.length + ' line(s) ' + JSON.stringify(REAL.sd));
cmp('the fixture: and it is the SECOND foe, not the first', REAL.sd[0] === 'p2b',
    String(REAL.sd[0]) + '   [the first shield eats the silence]');
cmp('medicham2 writes the same one line', REAL.me.length === 1, REAL.me.length + ' line(s) ' + JSON.stringify(REAL.me));
cmp('...on the same body', REAL.me[0] === REAL.sd[0], 'showdown ' + REAL.sd[0] + ' vs medicham2 ' + REAL.me[0]);
cmp('the REAL arm does not part at all', REAL.div === null, REAL.div ? JSON.stringify(REAL.div) : 'none');

cmp('SILENT A: the authority announces a non-smart refusal', SILA.sd.length === 1,
    SILA.sd.length + ' line(s) ' + JSON.stringify(SILA.sd));
cmp('SILENT A: on the FIRST foe, which is the one it was aimed at', SILA.sd[0] === 'p2a', String(SILA.sd[0]));
cmp('SILENT A: medicham2 agrees, so the announcement machinery is not simply off',
    SILA.me.length === 1 && SILA.me[0] === SILA.sd[0], JSON.stringify(SILA.me));
cmp('SILENT A: and that game does not part', SILA.div === null, SILA.div ? JSON.stringify(SILA.div) : 'none');

cmp('SILENT B: one shield spends the silence, so the authority writes NOTHING', SILB.sd.length === 0,
    SILB.sd.length + ' line(s) ' + JSON.stringify(SILB.sd));
cmp('SILENT B: medicham2 writes nothing either', SILB.me.length === 0, JSON.stringify(SILB.me));
cmp('SILENT B: and that game does not part', SILB.div === null, SILB.div ? JSON.stringify(SILB.div) : 'none');

cmp('SOLO: the dart cannot split, so the authority announces normally', SOLO.sd.length === 1,
    SOLO.sd.length + ' line(s) ' + JSON.stringify(SOLO.sd));
cmp('SOLO: medicham2 announces it too', SOLO.me.length === 1 && SOLO.me[0] === SOLO.sd[0],
    JSON.stringify(SOLO.me));
cmp('SOLO: and that game does not part', SOLO.div === null, SOLO.div ? JSON.stringify(SOLO.div) : 'none');

cmp('THE TWO SMART ARMS DISAGREE, so the count is the number of shields and not the move',
    REAL.sd.length !== SILB.sd.length, 'two shields ' + REAL.sd.length + ' vs one ' + SILB.sd.length);

/* ================================================================================================
 * 4. THE KNOBS — one on each side of the rule.
 * ============================================================================================== */
{
  const { spawnSync } = require('child_process');
  for (const [knob, want] of [['MEDI_SMART_SHIELD_ALL_SILENT', 0], ['MEDI_SMART_PROTECT_LINE', 2]]) {
    console.log(NL + '  --- re-running under ' + knob + '=1 (a control), in a child ---');
    const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
      { env: { ...process.env, [knob]: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = String(c.stdout || '');
    process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
    if (c.stderr) process.stderr.write(String(c.stderr));
    const mark = /__CONTROL__(\{.*\})/.exec(out);
    if (c.status === null) { console.log(NL + '  RED — the ' + knob + ' child did not run at all.'); bad++; continue; }
    if (!mark) { console.log(NL + '  RED — the ' + knob + ' child printed no verdict line (exit ' + c.status + ').'); bad++; continue; }
    const ctl = JSON.parse(mark[1]);
    cmp(knob + ': the knob CHANGES the real arm', ctl.real.length === want,
        'default ' + REAL.me.length + ' line(s) vs control ' + ctl.real.length
        + (ctl.real.length === REAL.me.length
           ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    cmp(knob + ': the control arm parts, so the knob reached the RULE', ctl.realDiv === true,
        ctl.realDivLine ? String(ctl.realDivLine) : 'no divergence at all');
    cmp(knob + ': SILENT A does NOT move under it', ctl.silA.length === SILA.me.length,
        'default ' + SILA.me.length + ' vs control ' + ctl.silA.length);
    cmp(knob + ': ...and SILENT A still does not part', ctl.silADiv === false, String(ctl.silADiv));
    /* THE SOLO ARM IS CLAUSE 1's ONLY WITNESS, so it is asserted against the knob that removes clause
     * 1 and left alone by the one that does not. `ALL_SILENT` is the whole pre-fix engine and must
     * take the line away; `PROTECT_LINE` announces on everything and cannot. */
    if (knob === 'MEDI_SMART_SHIELD_ALL_SILENT') {
      cmp(knob + ': the knob takes the SOLO line away too, so clause 1 is wired', ctl.solo.length === 0,
          'default ' + SOLO.me.length + ' vs control ' + ctl.solo.length
          + (ctl.solo.length === SOLO.me.length
             ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
      cmp(knob + ': ...and the SOLO arm parts under it', ctl.soloDiv === true, String(ctl.soloDiv));
    } else {
      cmp(knob + ': the SOLO arm is unmoved by the announce-everything knob',
          ctl.solo.length === SOLO.me.length, 'default ' + SOLO.me.length + ' vs control ' + ctl.solo.length);
    }
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
