/* probe_sound_lock_restart.js — A SECOND THROAT CHOP INTO AN ALREADY-SILENCED BODY.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_sound_lock_restart.js
 *   SHOWDOWN_PATH=... node tests/probe_sound_lock_restart.js --release <id>
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * `data/divergence-turns.json` on release 6272fa445b73, the `baseline` config of
 * `gen9championsvgc2026regmbbo3-2656159439 vs -2656116859`:
 *
 *     t5   |-start|p1a: Mawile|Throat Chop|[silent]        (both engines)
 *     t6   |move|p2b: Incineroar|throatchop|p1a: Mawile    (both engines, no second -start)
 *     t6   SHOWDOWN  |-end|p1a: Mawile|Throat Chop|[silent]
 *          MEDICHAM  |upkeep
 *
 * `Pokemon#addVolatile` (sim/pokemon.ts:1994-1997) refuses a volatile the body already carries when
 * its condition declares no `onRestart`, and `throatchop`'s does not — the fact is already DERIVED
 * into `data/tags.json` as `volatileRestart.throatchop.restart:false, duration:2`. This engine read
 * `_n0` at the application site only to SUPPRESS the duplicate `-start` line, and then rewrote the
 * counter anyway. So the clock restarted, the `-end` never came, and the target stayed silenced for
 * a turn the authority had already freed.
 *
 * IT IS BOARD-MATERIAL, NOT NARRATION. The turn after the second chop the authority lets the sound
 * move through and this engine refuses it, so HP parts as well as the stream.
 *
 * THE GENERIC READER ALREADY EXISTED AND THROAT CHOP WALKED PAST IT. `volRefusesRestart` is consulted
 * inside `applyMoveVolatile`, which only sees state that lives in `_vol`; the sound lock lives in
 * `tg._noSound`, outside it. The fix asks the SAME derived table from the sound-lock site rather than
 * writing a second rule.
 *
 * ================= WHAT THIS IS ==================================================================
 *
 * A PROBE, not a gate. It stages the shape as data — the corpus game cannot be summoned on demand,
 * and a COULD-NOT-STAGE verdict is a claim about the fixture and never about the mechanic. Every arm
 * is judged by two protocol streams with no typed expectation.
 *
 * `MEDI_SOUND_LOCK_RESTARTS=1` restores the pre-fix rewrite. The probe re-runs ITSELF as a child
 * under that knob and FAILS if the child passes — that is what proves the arms are wired to the
 * thing being changed rather than to something that was already true.
 *
 * FIVE ARMS. A fixture that agrees for two reasons proves nothing, so each control moves exactly one
 * thing away from arm A.
 *
 *   A  TEST      chopped on t1 AND t2, then the victim clicks a sound move on t3   -> AGREES
 *                                                                                     (knob: PARTS)
 *   B  CONTROL   chopped on t1 only — one application, nothing to refuse           -> AGREES in BOTH
 *   C  CONTROL   two chops, but the SECOND lands on the other foe                  -> AGREES in BOTH
 *                (two bodies, one application each: the refusal cannot be reached)
 *   D  CONTROL   chopped on t1 and again on t3, AFTER the lock lapsed — the second
 *                application is a fresh one and must NOT be refused                -> AGREES in BOTH
 *   E  SECOND    the PARTIAL TRAP re-applied on two consecutive turns. Same rule,
 *      BRANCH    different field (`_trap`, also outside `_vol`). Measured, not
 *                assumed: this half was already guarded and is expected to agree
 *                in BOTH arms, which is what makes it a control on the knob's SCOPE.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.');
  process.exit(2);
}
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PRELOADED = Object.keys(require.cache).some(k => k.endsWith('_live_release.js'));
if (!arg('--release', null) && !PRELOADED) {
  console.log('REFUSED — pass --release <id>, or preload -r ./tests/_live_release.js to play the LIVE');
  console.log('tree. Requiring engine/game_differential.js with neither CUTS A RELEASE into the real');
  console.log('store as a side effect of loading the module.');
  process.exit(2);
}

const DUMP = arg('--dump', null);
const KNOB = process.env.MEDI_SOUND_LOCK_RESTARTS === '1';
const IS_CHILD = process.env.PROBE_SOUND_LOCK_CHILD === '1';

const GD = require(D('engine', 'game_differential.js'));
const { buildPair, playGame, REL } = GD;
const M = REL.require('engine/medicham2-browser.js');

const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

/* ---- THE FIXTURE, DERIVED --------------------------------------------------------------------
 * NOTHING HERE IS TYPED. The chopper is the legal carrier of the move whose tag says it blocks
 * sound; the victim is a legal body that learns a SOUND move, so the lock has something to refuse;
 * the trap move for arm E is the legal carrier of `partialTrap`. If the regulation stops carrying
 * any of them this says COULD-NOT-STAGE rather than quietly testing nothing. */
const soundLockMoves = Object.keys(TAGS.moves || {})
  .filter(m => (TAGS.moves[m].tags || []).includes('blocksSoundMoves'));
const restartRow = m => {
  const p = TAGS.moves[m] && TAGS.moves[m].params && TAGS.moves[m].params.volatileRestart;
  return (p && p.byVolatile) ? p.byVolatile : null;
};
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
console.log('  moves tagged blocksSoundMoves : ' + (soundLockMoves.join(', ') || '(none)'));
for (const m of soundLockMoves) console.log('    ' + m + '.volatileRestart = ' + JSON.stringify(restartRow(m)));

if (!soundLockMoves.length) {
  console.log('  COULD-NOT-STAGE — no legal move in this regulation carries `blocksSoundMoves`.');
  console.log('  That is a claim about the FORMAT and is stated rather than passed over.');
  process.exit(0);
}
const CHOP = soundLockMoves[0];

/* The SOUND moves, so the victim has something the lock can refuse. `flags.sound` is Showdown's own
 * and is read off the dex rather than listed here. Restricted to a move AIMED AT A FOE, because the
 * observable is `|move|` vs `|cant|` on the turn after the lock should have lapsed, and a self-only
 * sound move (Clangorous Soul is the one this picked first) spends a third of the user's HP and
 * moves the board for a reason that has nothing to do with the lock. */
const soundMoves = DEX.moves.all().filter(legal)
  .filter(mv => mv.flags && mv.flags.sound)
  .filter(mv => mv.target === 'normal' || mv.target === 'allAdjacentFoes' || mv.target === 'allAdjacent')
  .map(mv => mv.id);

/* A LEARNSET WALK THAT THREW IS NOT A MOVE NOBODY LEARNS. `[]` here would make the fixture say
 * COULD-NOT-STAGE, which is a claim about the FORMAT, off a validator failure — the exact shape
 * champions_sim.canLearn's own `learnCounters.validatorThrew` exists to stop. It speaks. */
let CARRIER_THREW = 0;
function carriersOf(mv) {
  try { return CS.moveCarriers(mv) || []; }
  catch (e) { CARRIER_THREW++;
    console.log('  moveCarriers THREW for ' + mv + ' — treated as NO CARRIER and COUNTED: '
      + String((e && e.message) || e).split(String.fromCharCode(10))[0]);
    return []; }
}
/* A FORME THAT ONLY EXISTS MID-BATTLE IS NOT A SHEET ENTRY. The first run of this probe picked
 * `beedrillmega` as the chopper — a body no team can declare — which is `Dex.forFormat` not being a
 * legality filter (CLAUDE.md) arriving through the learnset rather than through `.all()`. */
const buildable = sp => sp && sp.exists && legal(sp) && !sp.battleOnly && !sp.requiredItem
  && !sp.isMega && !sp.forme;

/* The CHOPPER must be fast, so the chop lands before the victim's sound move in the same turn. */
let CHOPPER = null;
for (const n of carriersOf(CHOP)) {
  const sp = DEX.species.get(n);
  if (!buildable(sp)) continue;
  if (!CHOPPER || sp.baseStats.spe > CHOPPER.spe)
    CHOPPER = { id: sp.id, name: sp.name, spe: sp.baseStats.spe, ability: Object.values(sp.abilities)[0] };
}
/* The VICTIM must be SLOWER than the chopper, must learn a sound move so the lock has something to
 * refuse, and must learn `champions_sim.INERT_MOVE` — because IT MUST NOT CLICK PROTECT. The first
 * fixture had the victim protecting on the chop turns, so the chop was BLOCKED and `-activate` was
 * the only thing that ever happened; the arms were green because nothing was staged. */
const INERT = idOf(CS.INERT_MOVE);
let VICTIM = null, VICTIM_SOUND = null;
for (const sm of soundMoves) {
  for (const n of carriersOf(sm)) {
    const sp = DEX.species.get(n);
    if (!buildable(sp)) continue;
    if (CHOPPER && sp.baseStats.spe >= CHOPPER.spe) continue;
    if (!CS.canLearn(sp.name, CS.INERT_MOVE)) continue;
    if (Object.values(sp.abilities).some(ab => idOf(ab) === 'soundproof')) continue;
    /* CHOSEN FOR BULK, NOT FOR SPEED. The first fixture picked the fastest qualifying body and the
     * chop KO'd it on turn 1 in three of the five arms — `soundLockApplied` read 0 and the arms were
     * green because nothing had been staged at all. Bulk is what keeps the victim alive for the two
     * chops and the sound click that follow them. */
    const bulk = sp.baseStats.hp * (sp.baseStats.def + sp.baseStats.spd);
    if (VICTIM && bulk <= VICTIM.bulk) continue;
    VICTIM = { id: sp.id, name: sp.name, spe: sp.baseStats.spe, bulk,
               ability: Object.values(sp.abilities)[0] };
    VICTIM_SOUND = sm;
  }
  if (VICTIM) break;
}
const trapMoves = Object.keys(TAGS.moves || {})
  .filter(m => (TAGS.moves[m].tags || []).includes('partialTrap'));
let TRAPPER = null, TRAPMOVE = null;
for (const tm of trapMoves) {
  for (const n of carriersOf(tm)) {
    const sp = DEX.species.get(n);
    if (!buildable(sp)) continue;
    if (VICTIM && sp.baseStats.spe <= VICTIM.spe) continue;
    if (!TRAPPER || sp.baseStats.spe > TRAPPER.spe) { TRAPPER = { id: sp.id, name: sp.name, spe: sp.baseStats.spe, ability: Object.values(sp.abilities)[0] }; TRAPMOVE = tm; }
  }
}
console.log('  chop move     : ' + CHOP + (CHOPPER ? '  by ' + CHOPPER.id + ' (spe ' + CHOPPER.spe + ')' : '  NO LEGAL CARRIER'));
console.log('  victim        : ' + (VICTIM ? VICTIM.id + ' (spe ' + VICTIM.spe + ', bulk ' + VICTIM.bulk + ') clicking ' + VICTIM_SOUND + ', inert ' + INERT : 'NONE'));
console.log('  trap move (E) : ' + (TRAPMOVE ? TRAPMOVE + '  by ' + TRAPPER.id + ' (spe ' + TRAPPER.spe + ')' : 'NONE'));
if (!CHOPPER || !VICTIM) {
  console.log('  COULD-NOT-STAGE — no legal chopper/victim pair. A claim about the FORMAT.');
  process.exit(0);
}

const mon = (species, item, ability, moves) => ({ species, item, ability, moves });
/* INERT BODIES. Every one of them clicks Protect and nothing else, so nothing in this fixture rolls
 * a die outside the chop itself. They are checked against the format here rather than trusted. */
const FILLERS = ['clefable', 'milotic', 'garchomp', 'corviknight', 'toxapex'];
for (const f of FILLERS) if (!buildable(DEX.species.get(f))) {
  console.log('  COULD-NOT-STAGE — filler ' + f + ' is not a legal buildable body in this regulation.');
  process.exit(0);
}

const COUNTERS = ['soundLockApplied', 'soundLockRestartRefused', 'soundBlocked'];

/* HP IS INFLATED ON BOTH SIDES, and that is not a convenience. The first fixture had the chop KO the
 * victim on turn 1, so `soundLockApplied` read 0 or 1 and four arms were green having staged nothing
 * whatsoever. `buildPair`'s `hpBoost` is mirrored onto the authority's body as well (game_differential
 * writes `p.maxhp`), so both engines see the same wall and nothing about the comparison is loosened. */
const HPX = 6;
function play(name, p1, p2, script) {
  const a = buildPair(p1, { hpBoost: HPX }), b = buildPair(p2, { hpBoost: HPX });
  if (!a || !b) return { name, staged: false };
  const before = {}; for (const k of COUNTERS) before[k] = M.seen[k] || 0;
  const r = playGame(a, b, 'directed', 'sound-lock/' + name, { script });
  const d = {}; for (const k of COUNTERS) d[k] = (M.seen[k] || 0) - before[k];
  if (DUMP === name || DUMP === 'all') {
    console.log('  --- DUMP ' + name + ' (medicham stream) ---');
    for (const l of (r.mediTrace || [])) console.log('      ' + l);
    if (r.div) { console.log('  --- showdown around the divergence ---');
      for (const l of (r.div.sdBeforeRaw || [])) console.log('      sd  ' + l);
      console.log('      sd >' + r.div.sdRaw); console.log('      me >' + r.div.meRaw);
      for (const l of (r.div.sdAfterRaw || [])) console.log('      sd  ' + l); }
  }
  return { name, staged: true, err: r.err || null, turns: r.turns,
           diverged: !!r.div, at: r.div ? r.div.index : null,
           sd: r.div ? r.div.sdRaw : null, me: r.div ? r.div.meRaw : null, d };
}

/* Species Clause: p1a and p1b cannot be the same species, so the SECOND chopper is the next legal
 * carrier rather than a copy. Derived, never typed. Arm C needs a second chop TARGET and not a
 * second victim — p2b is an ordinary filler, because what arm C varies is which BODY the second
 * chop lands on. */
let CHOP2 = null;
for (const n of carriersOf(CHOP)) {
  const sp = DEX.species.get(n);
  if (!buildable(sp) || sp.id === CHOPPER.id) continue;
  if (!carriersOf('protect').includes(sp.name)) continue;
  if (!CHOP2 || sp.baseStats.spe > CHOP2.spe)
    CHOP2 = { id: sp.id, spe: sp.baseStats.spe, ability: Object.values(sp.abilities)[0] };
}
console.log('  second chopper: ' + (CHOP2 ? CHOP2.id + ' (spe ' + CHOP2.spe + ')' : 'NONE'));
if (!CHOP2) { console.log('  COULD-NOT-STAGE — need two distinct legal choppers.'); /* A REFUSAL IS NOT A PASS — ROADMAP #524. This printed COULD-NOT-STAGE and exited 0, which engine/register_reality.js reads as VERDICT-GREEN and a CLOSED row reads as CONFIRMED: a claim about the FIXTURE published as a clean bill of health for the MECHANIC. Exit 2 with a declaration instead, the tests/probe_red_demo.js arrangement. */ console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); }

const CHOPNAME = DEX.moves.get(CHOP).name, SOUNDNAME = DEX.moves.get(VICTIM_SOUND).name;
/* p2b MUST NOT PROTECT EITHER — arm C aims the second chop at it, and a shielded body is a chop that
 * never landed. It is the bulkiest other legal body that learns the inert move. */
let VICT2 = null;
for (const sp of DEX.species.all().filter(buildable)) {
  if (sp.id === VICTIM.id || sp.id === CHOPPER.id || sp.id === CHOP2.id) continue;
  if (!CS.canLearn(sp.name, CS.INERT_MOVE)) continue;
  const bulk = sp.baseStats.hp * (sp.baseStats.def + sp.baseStats.spd);
  if (VICT2 && bulk <= VICT2.bulk) continue;
  VICT2 = { id: sp.id, bulk, ability: Object.values(sp.abilities)[0] };
}
console.log('  second victim : ' + (VICT2 ? VICT2.id + ' (bulk ' + VICT2.bulk + ')' : 'NONE'));
if (!VICT2) { console.log('  COULD-NOT-STAGE — no second body that can click the inert move.'); /* A REFUSAL IS NOT A PASS — ROADMAP #524. This printed COULD-NOT-STAGE and exited 0, which engine/register_reality.js reads as VERDICT-GREEN and a CLOSED row reads as CONFIRMED: a claim about the FIXTURE published as a clean bill of health for the MECHANIC. Exit 2 with a declaration instead, the tests/probe_red_demo.js arrangement. */ console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); }

function sides() {
  const p1 = [ mon(CHOPPER.id, '', CHOPPER.ability, [CHOPNAME, 'Protect']),
               mon(CHOP2.id, '', CHOP2.ability, [CHOPNAME, 'Protect']),
               mon(FILLERS[0], '', '', ['Protect']),
               mon(FILLERS[1], '', '', ['Protect']) ];
  const p2 = [ mon(VICTIM.id, '', VICTIM.ability, [SOUNDNAME, CS.INERT_MOVE]),
               mon(VICT2.id, '', VICT2.ability, [CS.INERT_MOVE, 'Protect']),
               mon(FILLERS[2], '', '', ['Protect']),
               mon(FILLERS[3], '', '', ['Protect']) ];
  return { p1, p2 };
}
const chopA  = { m: CHOP, t: 0 };          // p1a -> p2a
const chopB1 = { m: CHOP, t: 1 };          // p1b -> p2b
const prot = { m: 'protect' };
const sing = { m: VICTIM_SOUND };
const idle = { m: INERT };                 // Recycle with no berry eaten: it does nothing at all

const S = sides();
/* FOUR TURNS EVERYWHERE, so the arms differ only in what is clicked and never in how long they ran.
 * p2a NEVER clicks Protect, so every chop aimed at it lands. */
const ARMS = {
  /* A  the defect: chopped on t1 and again on t2 while the lock is still up.
   *    authority  t1 -start / t1 residual 2->1 / t2 chop REFUSED / t2 residual 1->0 -end / t3 free
   *    pre-fix    t2 rewrites the counter to 2, so no -end at t2 and the body is still silenced. */
  A: [ { p1: [chopA, prot], p2: [idle, idle] },
       { p1: [chopA, prot], p2: [idle, idle] },
       { p1: [prot,  prot], p2: [sing, idle] },
       { p1: [prot,  prot], p2: [idle, idle] } ],
  /* B  one application: nothing to refuse. */
  B: [ { p1: [chopA, prot], p2: [idle, idle] },
       { p1: [prot,  prot], p2: [idle, idle] },
       { p1: [prot,  prot], p2: [sing, idle] },
       { p1: [prot,  prot], p2: [idle, idle] } ],
  /* C  two chops on consecutive turns, but on TWO DIFFERENT BODIES — one application each, so a
   *    guard keyed on the MOVE rather than on the body would fire here and must not. */
  C: [ { p1: [chopA, prot],   p2: [idle, idle] },
       { p1: [prot,  chopB1], p2: [idle, idle] },
       { p1: [prot,  prot],   p2: [sing, idle] },
       { p1: [prot,  prot],   p2: [idle, idle] } ],
  /* D  chopped on t1 and again on t3, AFTER the lock has lapsed. The second application is a fresh
   *    one and must NOT be refused — a guard keyed on "this body was ever chopped" fails here. */
  D: [ { p1: [chopA, prot], p2: [idle, idle] },
       { p1: [prot,  prot], p2: [idle, idle] },
       { p1: [chopA, prot], p2: [idle, idle] },
       { p1: [prot,  prot], p2: [idle, idle] } ],
};

const results = {};
for (const k of Object.keys(ARMS)) results[k] = play(k, S.p1, S.p2, ARMS[k]);

/* ---- ARM E: THE PARTIAL TRAP, THE OTHER FIELD OUTSIDE `_vol` --------------------------------- */
let E = null;
if (TRAPMOVE && TRAPPER) {
  const TRAPNAME = DEX.moves.get(TRAPMOVE).name;
  const t2 = (() => { for (const n of carriersOf(TRAPMOVE)) { const sp = DEX.species.get(n);
      if (sp && sp.exists && legal(sp) && sp.id !== TRAPPER.id && carriersOf('protect').includes(sp.name))
        return { id: sp.id, ability: Object.values(sp.abilities)[0] }; } return null; })();
  if (t2) {
    const p1 = [ mon(TRAPPER.id, '', TRAPPER.ability, [TRAPNAME, 'Protect']),
                 mon(t2.id, '', t2.ability, [TRAPNAME, 'Protect']),
                 mon(FILLERS[0], '', '', ['Protect']), mon(FILLERS[1], '', '', ['Protect']) ];
    const p2 = [ mon(VICTIM.id, '', VICTIM.ability, [SOUNDNAME, CS.INERT_MOVE]),
                 mon(VICT2.id, '', VICT2.ability, [CS.INERT_MOVE, 'Protect']),
                 mon(FILLERS[2], '', '', ['Protect']), mon(FILLERS[3], '', '', ['Protect']) ];
    E = play('E', p1, p2, [ { p1: [{ m: TRAPMOVE, t: 0 }, prot], p2: [idle, idle] },
                            { p1: [{ m: TRAPMOVE, t: 0 }, prot], p2: [idle, idle] },
                            { p1: [prot, prot], p2: [idle, idle] },
                            { p1: [prot, prot], p2: [idle, idle] } ]);
  }
}

console.log('\n  === ARMS (' + (KNOB ? 'MEDI_SOUND_LOCK_RESTARTS=1 — the PRE-FIX rewrite' : 'shipped default') + ') ===');
const row = r => {
  if (!r) return;
  if (!r.staged) { console.log('  ' + r.name + '  COULD-NOT-STAGE'); return; }
  console.log('  ' + r.name + '  ' + (r.diverged ? 'PARTS at line ' + r.at : 'AGREES')
    + '  turns=' + r.turns + '  ' + JSON.stringify(r.d) + (r.err ? '  err=' + r.err : ''));
  if (r.diverged) { console.log('        showdown  ' + r.sd); console.log('        medicham  ' + r.me); }
};
for (const k of Object.keys(results)) row(results[k]);
row(E);

let bad = [];
if (CARRIER_THREW) bad.push('the learnset walk THREW ' + CARRIER_THREW + ' time(s) — every fixture '
  + 'choice below rests on it, so a COULD-NOT-STAGE or a control here would be a claim about the '
  + 'FORMAT taken off a broken instrument');

const expectAgree = (r, why) => { if (!r || !r.staged) { bad.push((r ? r.name : '?') + ' NOT STAGED'); return; }
  if (r.diverged) bad.push(r.name + ' PARTS and must not (' + why + ')'); };

if (!KNOB) {
  expectAgree(results.A, 'the second chop must be refused, so the -end lands on the authority\'s turn');
  /* AND THE REFUSAL MUST HAVE BEEN REACHED. An arm that agrees because the chop never landed is a
     green row that proves nothing — the counter is what separates the two. */
  if (results.A.staged && !(results.A.d.soundLockRestartRefused > 0))
    bad.push('A agreed with soundLockRestartRefused=0 — the refusal path was never REACHED');
  if (results.A.staged && !(results.A.d.soundLockApplied > 0))
    bad.push('A agreed with soundLockApplied=0 — no chop ever landed, so nothing was staged');
  if (results.B.staged && results.B.d.soundLockRestartRefused !== 0)
    bad.push('B refused a restart with only ONE application — the guard is over-matching');
  if (results.C.staged && results.C.d.soundLockRestartRefused !== 0)
    bad.push('C refused a restart across TWO DIFFERENT BODIES — the guard is keyed wrong');
  if (results.D.staged && results.D.d.soundLockRestartRefused !== 0)
    bad.push('D refused a chop landing AFTER the lock lapsed — the guard is keyed on history, not state');
  if (results.D.staged && results.D.d.soundLockApplied !== 2)
    bad.push('D applied the lock ' + results.D.d.soundLockApplied + ' times, expected 2 — the fixture did not stage');
  if (results.C.staged && results.C.d.soundLockApplied !== 2)
    bad.push('C applied the lock ' + results.C.d.soundLockApplied + ' times, expected 2 — the fixture did not stage');
  if (results.B.staged && results.B.d.soundLockApplied !== 1)
    bad.push('B applied the lock ' + results.B.d.soundLockApplied + ' times, expected 1 — the fixture did not stage');
}
expectAgree(results.B, 'one application, nothing to refuse');
expectAgree(results.C, 'two bodies, one application each');
expectAgree(results.D, 'the known-good case — the lock is genuinely up in both engines');
if (E) expectAgree(E, 'the partial trap was already guarded; the knob must not reach it');

console.log('');
if (bad.length) { for (const b of bad) console.log('  FAIL — ' + b); }
else console.log('  OK — every arm behaved as declared.');

/* ---- THE CHILD: THE SAME ARMS UNDER THE PRE-FIX KNOB ------------------------------------------ */
if (!IS_CHILD && !KNOB) {
  const { spawnSync } = require('child_process');
  console.log('\n  === CHILD: MEDI_SOUND_LOCK_RESTARTS=1 (arm A MUST part) ===');
  /* THE CHILD MUST INHERIT THE PRELOAD. Without `-r ./tests/_live_release.js` the child has neither a
   * `--release` nor a redirected store, refuses at its own guard, and prints nothing this filter
   * matches — which read as "the knob is not wired" when the knob had never been asked. */
  const childArgv = (PRELOADED ? ['-r', require.resolve('./_live_release.js')] : []).concat(process.argv.slice(1));
  const r = spawnSync(process.execPath, childArgv, {
    env: Object.assign({}, process.env, { MEDI_SOUND_LOCK_RESTARTS: '1', PROBE_SOUND_LOCK_CHILD: '1' }),
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  for (const l of out.split('\n')) if (/^  [A-E]  /.test(l) || /FAIL|OK —|COULD-NOT/.test(l)) console.log('   | ' + l.trim());
  if (!/^  [A-E]  /m.test(out)) { console.log('   | THE CHILD PRINTED NO ARM ROWS. Its whole output:');
    for (const l of out.split(String.fromCharCode(10))) console.log('   | ' + l); }
  const aParted = /^  A  PARTS/m.test(out);
  if (!aParted) bad.push('the CHILD did not part on arm A — the knob is not wired to the fix, so the '
    + 'parent\'s green says nothing');
  else console.log('   | the knob moved arm A, so the parent\'s green is attributable to this fix.');
  const bAgreed = /^  B  AGREES/m.test(out), cAgreed = /^  C  AGREES/m.test(out), dAgreed = /^  D  AGREES/m.test(out);
  if (!(bAgreed && cAgreed && dAgreed)) bad.push('the CHILD parted on a CONTROL arm (B/C/D) — the knob '
    + 'is wider than the fix and the attribution is not clean');
}

if (bad.length) { console.log('\n  RED — ' + bad.length + ' failure(s):'); for (const b of bad) console.log('    ' + b); process.exit(1); }
console.log('\n  GREEN');
