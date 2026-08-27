/* probe_protect_stage_order.js — THE SHIELD IS STEP 1 AND SEMI-INVULNERABILITY IS STEP 0.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_protect_stage_order.js
 *   SHOWDOWN_PATH=... node tests/probe_protect_stage_order.js --release <id>
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * `data/divergence-turns.json` on release 6272fa445b73, config `pair-protect-bust`, turn 10 — one
 * Earthquake into a Protecting Milotic, a Houndstone mid-Phantom Force and a Levitating ally:
 *
 *     SHOWDOWN   |-miss|p1b: Garchomp|p2b: Houndstone
 *                |-activate|p2a: Milotic|move: Protect
 *                |-immune|p1a: Rotom|[from] ability: Levitate
 *     MEDICHAM   |-activate|p2a: Milotic|move: Protect
 *                |-miss|p1b: Garchomp|p2b: Houndstone
 *                |-immune|p1a: Rotom|[from] ability: levitate
 *
 * SAME THREE EVENTS, TWO OF THEM IN THE WRONG ORDER. `BattleActions#trySpreadMoveHit`
 * (sim/battle-actions.ts:553-577) names the order in its own comments:
 *
 *     0  hitStepInvulnerabilityEvent      <- the `-miss` of a semi-invulnerable body
 *     1  hitStepTryHitEvent               <- Protect, Wide Guard, the absorbing abilities
 *     2  hitStepTypeImmunity              <- the `-immune`
 *
 * and the driver runs STEP OUTSIDE, TARGET INSIDE — so every target's step-0 answer precedes every
 * target's step-1 answer. This engine's `_STEPS` array is already exactly that list; the SHIELD is
 * the one member that is not in it. It was hoisted above the driver by ROADMAP #81 WIRE 1 to get it
 * above the ACCURACY roll, which was right, and it went one stage too far — above step 0 as well.
 *
 * IT HAS RESISTED TWO PASSES AIMED AT TARGET ORDERING, AND TARGET ORDERING IS NOT WHAT IS WRONG.
 * The two lines belong to two DIFFERENT targets and two DIFFERENT stages; re-ordering the target
 * walk cannot move them past each other, because within one stage each target is answered once.
 *
 * ================= WHAT THIS IS ==================================================================
 *
 * A PROBE, not a gate. Narration: it moves the whole-game clause and must NOT move board-material,
 * because neither engine writes a board leaf differently — the same body is shielded, the same body
 * is missed. Every arm is judged by two protocol streams with no typed expectation.
 *
 * `MEDI_INVULN_BELOW_SHIELD=1` restores the pre-fix stage order. The probe re-runs ITSELF as a child
 * under that knob and FAILS if the child passes.
 *
 * FOUR ARMS. Each control removes exactly one of the two lines, so an arm that agrees for a second
 * reason cannot hide inside arm A.
 *
 *   A  TEST      a spread move into a PROTECTING foe and a SEMI-INVULNERABLE foe   -> AGREES
 *                                                                                     (knob: PARTS)
 *   B  CONTROL   the same board with nobody charging — only the shield answers     -> AGREES in BOTH
 *   C  CONTROL   the same board with nobody protecting — only step 0 answers       -> AGREES in BOTH
 *   D  POSITIVE  the SAME two foes, hit by a SINGLE-TARGET move aimed at the
 *                charging one: step 0 fires alone against a board that also holds
 *                a live shield, so a red in A cannot be "this fixture is broken"   -> AGREES in BOTH
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PRELOADED = Object.keys(require.cache).some(k => k.endsWith('_live_release.js'));
if (!arg('--release', null) && !PRELOADED) {
  console.log('REFUSED — pass --release <id>, or preload -r ./tests/_live_release.js to play the LIVE');
  console.log('tree. Requiring engine/game_differential.js with neither CUTS A RELEASE into the real store.');
  process.exit(2);
}
const DUMP = arg('--dump', null);
const KNOB = process.env.MEDI_INVULN_BELOW_SHIELD === '1';
const IS_CHILD = process.env.PROBE_PROTECT_STAGE_CHILD === '1';

const GD = require(D('engine', 'game_differential.js'));
const { buildPair, playGame, REL } = GD;
const M = REL.require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));
const buildable = sp => sp && sp.exists && legal(sp) && !sp.battleOnly && !sp.requiredItem
  && !sp.isMega && !sp.forme;
/* A LEARNSET WALK THAT THREW IS NOT A MOVE NOBODY LEARNS — see the note in
 * tests/probe_sound_lock_restart.js. It speaks rather than answering `[]` in silence. */
let CARRIER_THREW = 0;
const carriersOf = mv => {
  try { return CS.moveCarriers(mv) || []; }
  catch (e) { CARRIER_THREW++;
    console.log('  moveCarriers THREW for ' + mv + ' — treated as NO CARRIER and COUNTED: '
      + String((e && e.message) || e).split(String.fromCharCode(10))[0]);
    return []; }
};

/* ---- THE FIXTURE, DERIVED ---------------------------------------------------------------------
 * NOTHING IS TYPED. The charge move is a legal `semiInvulnerable` carrier; the spread move is a legal
 * `allAdjacent` move that the charge move's OWN pierce list does not name — Dig lets Earthquake and
 * Magnitude through, so pairing those two would stage no miss at all and the arm would be green for
 * the wrong reason. */
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
const chargeMoves = Object.keys(TAGS.moves || {})
  .filter(m => (TAGS.moves[m].params || {}).semiInvulnerable);
console.log('  moves tagged semiInvulnerable : ' + (chargeMoves.join(', ') || '(none)'));
const spreadMoves = DEX.moves.all().filter(legal)
  .filter(mv => mv.target === 'allAdjacent' && mv.category !== 'Status').map(mv => mv.id);
console.log('  allAdjacent damaging moves    : ' + spreadMoves.length);
if (!chargeMoves.length || !spreadMoves.length) {
  console.log('  COULD-NOT-STAGE — this regulation has no charge move or no spread move. A claim about'
    + ' the FORMAT, stated rather than passed over.');
  process.exit(0);
}

/* ONE TURN, AND THE CHARGER IS THE FASTER BODY. The fixture went through two wrong shapes before this
 * one, and both are worth recording because each was a green arm that had staged nothing:
 *   - a charge on t1 and the spread on t2 needs the charging slot to answer a request on t2, and its
 *     locked request carries NO `target` field, so `scripted` falls back to the dex target and
 *     Showdown rejects the choice outright — *"You can't choose a target for Bounce"*;
 *   - and the shield body cannot raise a shield on BOTH turns, because the second Protect fails to
 *     the stall counter, so `shields` read 0 on the measured turn.
 * A FASTER charger removes the second turn entirely: it goes up, the slower attacker's spread is
 * thrown into the same turn, and the whole fixture is one turn long. */
let PICK = null;
for (const sm of spreadMoves) {
  for (const cm of chargeMoves) {
    const pierces = (TAGS.moves[cm].params.semiInvulnerable.pierces) || [];
    if (pierces.includes(sm)) continue;                    /* the charge would not dodge it */
    let atk = null;
    for (const n of carriersOf(sm)) { const sp = DEX.species.get(n);
      if (!buildable(sp) || !CS.canLearn(sp.name, 'Protect')) continue;
      if (!atk || sp.baseStats.spe < atk.spe) atk = { id: sp.id, spe: sp.baseStats.spe, ability: Object.values(sp.abilities)[0] }; }
    let chg = null;
    for (const n of carriersOf(cm)) { const sp = DEX.species.get(n);
      if (!buildable(sp) || !atk || sp.baseStats.spe <= atk.spe) continue;
      if (!CS.canLearn(sp.name, 'Protect')) continue;
      if (!chg || sp.baseStats.spe > chg.spe) chg = { id: sp.id, spe: sp.baseStats.spe, ability: Object.values(sp.abilities)[0] }; }
    if (atk && chg) { PICK = { spread: sm, charge: cm, atk, chg }; break; }
  }
  if (PICK) break;
}
if (!PICK) { console.log('  COULD-NOT-STAGE — no (spread move, charge move) pair with legal carriers.'); process.exit(0); }

/* The SHIELDED body: any buildable body that learns Protect AND the inert move, distinct from the
 * other two. It needs the inert click for arm C, where it must NOT raise a shield — a `pass` is not a
 * legal answer to a request for a live slot and the first run of this probe was rejected for it. */
let SHIELD = null;
for (const sp of DEX.species.all().filter(buildable)) {
  if (sp.id === PICK.atk.id || sp.id === PICK.chg.id) continue;
  if (!CS.canLearn(sp.name, 'Protect') || !CS.canLearn(sp.name, CS.INERT_MOVE)) continue;
  const bulk = sp.baseStats.hp * (sp.baseStats.def + sp.baseStats.spd);
  if (SHIELD && bulk <= SHIELD.bulk) continue;
  SHIELD = { id: sp.id, bulk, ability: Object.values(sp.abilities)[0] };
}
/* THE ATTACKER'S OWN ALLY IS A TARGET OF AN `allAdjacent` MOVE, so it raises a shield too — the
 * first run of arm C had p1b protecting and read `shields=1` with nobody on the FOE side shielding,
 * which is a control that was not controlling anything. It needs the inert click as well. */
let ALLY = null;
for (const sp of DEX.species.all().filter(buildable)) {
  if ([PICK.atk.id, PICK.chg.id, SHIELD && SHIELD.id].includes(sp.id)) continue;
  if (!CS.canLearn(sp.name, 'Protect') || !CS.canLearn(sp.name, CS.INERT_MOVE)) continue;
  const bulk = sp.baseStats.hp * (sp.baseStats.def + sp.baseStats.spd);
  if (ALLY && bulk <= ALLY.bulk) continue;
  ALLY = { id: sp.id, bulk, ability: Object.values(sp.abilities)[0] };
}
console.log('  spread move   : ' + PICK.spread + '  by ' + PICK.atk.id + ' (spe ' + PICK.atk.spe + ')');
console.log('  charge move   : ' + PICK.charge + '  by ' + PICK.chg.id + ' (spe ' + PICK.chg.spe + ')'
  + '   pierces=' + JSON.stringify(TAGS.moves[PICK.charge].params.semiInvulnerable.pierces || []));
console.log('  shielded body : ' + (SHIELD ? SHIELD.id : 'NONE') + '   ally: ' + (ALLY ? ALLY.id : 'NONE'));
if (!SHIELD || !ALLY) { console.log('  COULD-NOT-STAGE — need two more Protect-capable bodies.'); process.exit(0); }

const mon = (species, item, ability, moves) => ({ species, item, ability, moves });
const SPREADNAME = DEX.moves.get(PICK.spread).name, CHARGENAME = DEX.moves.get(PICK.charge).name;
const HPX = 6;   /* nothing may faint mid-fixture; mirrored onto the authority's body too */

const COUNTERS = ['invulnDecidedAboveShield', 'invulnRowDropped', 'protectPierced', 'guaranteedThroughInvuln'];

function play(name, p1, p2, script) {
  const a = buildPair(p1, { hpBoost: HPX }), b = buildPair(p2, { hpBoost: HPX });
  if (!a || !b) return { name, staged: false };
  const before = {}; for (const k of COUNTERS) before[k] = M.seen[k] || 0;
  const r = playGame(a, b, 'directed', 'protect-stage/' + name, { script });
  const d = {}; for (const k of COUNTERS) d[k] = (M.seen[k] || 0) - before[k];
  const lines = r.mediTrace || [];
  if (DUMP === name || DUMP === 'all') {
    console.log('  --- DUMP ' + name + ' (medicham stream) ---');
    for (const l of lines) console.log('      ' + l);
    if (r.div) { console.log('  --- showdown around the divergence ---');
      for (const l of (r.div.sdBeforeRaw || [])) console.log('      sd  ' + l);
      console.log('      sd >' + r.div.sdRaw); console.log('      me >' + r.div.meRaw);
      for (const l of (r.div.sdAfterRaw || [])) console.log('      sd  ' + l); }
  }
  return { name, staged: true, err: r.err || null, turns: r.turns,
           diverged: !!r.div, at: r.div ? r.div.index : null,
           sd: r.div ? r.div.sdRaw : null, me: r.div ? r.div.meRaw : null,
           misses: lines.filter(l => l.startsWith('|-miss|')).length,
           shields: lines.filter(l => /^\|-activate\|.*move: Protect/.test(l)).length, d };
}

/* p1 attacks; p2 holds the shield (slot a) and the charger (slot b). The attacker is p1a and its ally
 * p1b Protects every turn, so the spread move's third target contributes nothing. */
const P1 = [ mon(PICK.atk.id, '', PICK.atk.ability, [SPREADNAME, 'Protect']),
             mon(ALLY.id, '', ALLY.ability, ['Protect', CS.INERT_MOVE]),
             mon(SHIELD.id, '', SHIELD.ability, ['Protect']),
             mon(PICK.chg.id, '', PICK.chg.ability, ['Protect']) ];
const P2 = [ mon(SHIELD.id, '', SHIELD.ability, ['Protect', CS.INERT_MOVE]),
             mon(PICK.chg.id, '', PICK.chg.ability, [CHARGENAME, 'Protect']),
             mon(ALLY.id, '', ALLY.ability, ['Protect']),
             mon(PICK.atk.id, '', PICK.atk.ability, [SPREADNAME, 'Protect']) ];
/* Species Clause holds: the four ids are distinct by construction and the two sides may share. */

const spread = { m: PICK.spread };
const single = { m: PICK.spread };          /* replaced below when a single-target arm is possible */
const chargeAt = { m: PICK.charge, t: 0 };  /* p2b charges at p1a */
const prot = { m: 'protect' };
const idle = { m: idOf(CS.INERT_MOVE) };    /* the shield body's non-shielding click, for arm C */

/* t1  p2b charges (it is FASTER, so the charge is up before the spread lands on t2 as well)
 * t2  p1a fires the spread; p2a raises its shield; p2b is mid-charge and invulnerable. */
/* ONE TURN. Protect is +4 and resolves first; the charger is next and goes semi-invulnerable; the
 * slower attacker throws the spread last, into a board holding one shield and one airborne body. */
const ARMS = {
  A: [ { p1: [spread, prot], p2: [prot, chargeAt] } ],
  /* B: nobody is charging — p2b protects instead, so only the shield answers. */
  B: [ { p1: [spread, prot], p2: [prot, prot] } ],
  /* C: nobody is shielding — p2a clicks the inert move, so only step 0 answers. */
  C: [ { p1: [spread, idle], p2: [idle, chargeAt] } ],
  /* D: the same board, but the click is aimed at the CHARGING body alone. Step 0 fires on its own
   *    while a live shield stands in the other slot. */
  D: [ { p1: [single, prot], p2: [prot, chargeAt] } ],
};
/* Arm D wants a SINGLE-target move. Derived from the attacker's own list rather than assumed. */
let SINGLE = null;
for (const mv of DEX.moves.all().filter(legal)) {
  if (mv.target !== 'normal' || mv.category === 'Status') continue;
  if (!CS.canLearn(DEX.species.get(PICK.atk.id).name, mv.name)) continue;
  SINGLE = mv.id; break;
}
console.log('  single move (D): ' + (SINGLE || 'NONE — arm D will be skipped'));
if (SINGLE) {
  P1[0].moves = [SPREADNAME, DEX.moves.get(SINGLE).name, 'Protect'];
  ARMS.D[0].p1[0] = { m: SINGLE, t: 1 };     /* aimed at p2b, the charging body */
} else { delete ARMS.D; }

const results = {};
for (const k of Object.keys(ARMS)) results[k] = play(k, P1, P2, ARMS[k]);

console.log('\n  === ARMS (' + (KNOB ? 'MEDI_INVULN_BELOW_SHIELD=1 — the PRE-FIX stage order' : 'shipped default') + ') ===');
for (const k of Object.keys(results)) {
  const r = results[k];
  if (!r.staged) { console.log('  ' + k + '  COULD-NOT-STAGE'); continue; }
  console.log('  ' + k + '  ' + (r.diverged ? 'PARTS at line ' + r.at : 'AGREES') + '  turns=' + r.turns
    + '  misses=' + r.misses + ' shields=' + r.shields + '  ' + JSON.stringify(r.d) + (r.err ? '  err=' + r.err : ''));
  if (r.diverged) { console.log('        showdown  ' + r.sd); console.log('        medicham  ' + r.me); }
}

const bad = [];
if (CARRIER_THREW) bad.push('the learnset walk THREW ' + CARRIER_THREW + ' time(s) — every fixture '
  + 'choice below rests on it, so a COULD-NOT-STAGE or a control here would be a claim about the '
  + 'FORMAT taken off a broken instrument');

const expectAgree = (r, why) => { if (!r || !r.staged) { bad.push((r ? r.name : '?') + ' NOT STAGED'); return; }
  if (r.diverged) bad.push(r.name + ' PARTS and must not (' + why + ')'); };
expectAgree(results.A, 'the -miss is step 0 and the shield is step 1');
expectAgree(results.B, 'no charge: only the shield answers');
expectAgree(results.C, 'no shield: only step 0 answers');
if (results.D) expectAgree(results.D, 'a single-target click at the charging body');

/* THE ARMS MUST HAVE STAGED WHAT THEY CLAIM. An arm that agrees because neither line was ever
 * emitted is a green row that proves nothing — the two line counts are what separate them. */
if (results.A.staged && !(results.A.misses >= 1 && results.A.shields >= 1))
  bad.push('A staged nothing: misses=' + results.A.misses + ' shields=' + results.A.shields
    + ' — both lines must be present for their ORDER to mean anything');
if (results.B.staged && results.B.misses !== 0)
  bad.push('B emitted a -miss with nobody charging — the control is not clean');
if (results.B.staged && results.B.shields < 1) bad.push('B staged no shield at all');
if (results.C.staged && results.C.shields !== 0)
  bad.push('C emitted a Protect -activate with nobody shielding — the control is not clean');
if (results.C.staged && results.C.misses < 1) bad.push('C staged no -miss at all');
if (!KNOB && results.A.staged && !(results.A.d.invulnDecidedAboveShield > 0))
  bad.push('A agreed with invulnDecidedAboveShield=0 — the new pre-pass was never REACHED');
if (!KNOB && results.A.staged && !(results.A.d.invulnRowDropped > 0))
  bad.push('A agreed with invulnRowDropped=0 — the row was never dropped by step 0');

console.log('');
if (bad.length) for (const b of bad) console.log('  FAIL — ' + b);
else console.log('  OK — every arm behaved as declared.');

if (!IS_CHILD && !KNOB) {
  const { spawnSync } = require('child_process');
  console.log('\n  === CHILD: MEDI_INVULN_BELOW_SHIELD=1 (arm A MUST part) ===');
  const childArgv = (PRELOADED ? ['-r', require.resolve('./_live_release.js')] : []).concat(process.argv.slice(1));
  const r = spawnSync(process.execPath, childArgv, {
    env: Object.assign({}, process.env, { MEDI_INVULN_BELOW_SHIELD: '1', PROBE_PROTECT_STAGE_CHILD: '1' }),
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  if (!/^  [A-D]  /m.test(out)) { console.log('   | THE CHILD PRINTED NO ARM ROWS. Its whole output:');
    for (const l of out.split(String.fromCharCode(10))) console.log('   | ' + l); }
  for (const l of out.split(String.fromCharCode(10))) if (/^  [A-D]  /.test(l) || /FAIL|OK —|COULD-NOT/.test(l)) console.log('   | ' + l.trim());
  if (!/^  A  PARTS/m.test(out)) bad.push('the CHILD did not part on arm A — the knob is not wired to the fix');
  else console.log('   | the knob moved arm A, so the parent\'s green is attributable to this fix.');
  if (!(/^  B  AGREES/m.test(out) && /^  C  AGREES/m.test(out) && (!results.D || /^  D  AGREES/m.test(out))))
    bad.push('the CHILD parted on a CONTROL arm — the knob is wider than the fix');
}

if (bad.length) { console.log('\n  RED — ' + bad.length + ' failure(s):'); for (const b of bad) console.log('    ' + b); process.exit(1); }
console.log('\n  GREEN');
