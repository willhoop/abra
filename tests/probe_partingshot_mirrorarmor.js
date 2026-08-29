/* probe_partingshot_mirrorarmor.js — WILL'S QUESTION, ANSWERED BY PLAYING IT.
 *
 *   "does parting shot into mirror armor send the target out while the user gets the drops?"
 *
 *   SHOWDOWN_PATH=... node tests/probe_partingshot_mirrorarmor.js
 *   SHOWDOWN_PATH=... node tests/probe_partingshot_mirrorarmor.js --json
 *
 * =============================================================================================
 * WHY A PROBE AND NOT A READ OF THE HANDLERS
 *
 * `data/moves.ts` partingshot carries a NAMED SPECIAL CASE for this exact interaction
 * (`if (!success && !target.hasAbility('mirrorarmor')) delete move.selfSwitch;`) and
 * `data/abilities.ts` mirrorarmor re-aims the drop at the SOURCE. Neither is overridden in
 * `/data/mods/champions/`, checked by grep on both files. That is a read, and this repo's rule is
 * that a value PLAYED beats a value read. So the turn is staged in BOTH engines and the whole board
 * plus both protocol streams are read out.
 *
 * =============================================================================================
 * THE KNOB, AND WHY IT IS THE ABILITY AND NOTHING ELSE
 *
 * Four arms. Two bodies, two abilities each, everything else byte-identical — same clicks, same
 * teams, same slot. Identical results across a varied knob is the UNWIRED signature, so the arms
 * exist to make the knob's effect attributable rather than to confirm a guess:
 *
 *   mirror    Corviknight / Mirror Armor   the case
 *   plain     Corviknight / Pressure       SAME BODY. Pressure does not touch stat drops.
 *   clearbody Garganacl   / Clear Body     the drop is REFUSED (a different mechanism to reflection)
 *   sturdy    Garganacl   / Sturdy         SAME BODY. Sturdy does not touch stat drops.
 *
 * `clearbody` vs `sturdy` is the control the question in part 5 asks for: it separates "the switch
 * is unconditional" from "the switch depends on the drop landing", WITHOUT relying on Mirror Armor.
 *
 * NOTHING IN THE FIXTURE IS IMMUNE FOR TWO REASONS. Incineroar runs BLAZE and not Intimidate — an
 * Intimidate on entry is a second stat drop into the same Mirror Armor and would contaminate every
 * boost read on the board. Parting Shot is sound + bypasssub; no arm carries Soundproof, a
 * Substitute, or a Dark immunity, and neither target ever clicks Protect on the measured turn.
 *
 * LEGALITY IS DERIVED, NOT RECALLED. Corviknight is the ONLY legal Mirror Armor carrier in
 * gen9championsvgc2026regmb and Incineroar is one of five legal Parting Shot carriers — both read
 * off `engine/champions_sim.js` (`abilityCarriers` / `moveCarriers`, the TeamValidator's own
 * verdict) at the top of the run and PRINTED, so a format change shows up as a refusal rather than
 * as a fixture that quietly stopped being about this format. The filler moves are staging fixtures
 * on the same footing as `tests/staged_board.js`'s: both engines receive the identical set.
 *
 * =============================================================================================
 * WHAT IS READ, AND WHY THE BOARD ALONE CANNOT ANSWER IT
 *
 * The user switches out on the same turn it takes the drop, and `sim/pokemon.ts` `clearVolatile`
 * resets `this.boosts` to zero on the way to the bench. So a TURN-BOUNDARY BOARD CANNOT SEE THE
 * DROP AT ALL — it would report "no boosts anywhere" and that reads exactly like a reflection that
 * never happened. This probe therefore reads three things per arm:
 *
 *   1. the BOARD at every boundary, both engines, through engine/board_state.js  (who is standing,
 *      what boosts survive, on the field and on the bench);
 *   2. the AUTHORITY'S protocol lines for the measured turn, off `battle.log`;
 *   3. THIS ENGINE's protocol lines for the same turn, off `playGame`'s `mediTrace`.
 *
 * (2) and (3) are what answer "who took the drops" and "in what order relative to the switch".
 * (1) is what answers "did they persist".
 *
 * It writes no artifact and runs one process. It reads a FROZEN RELEASE, so ENGINE may be rewriting
 * the simulator beside it.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* the driver reads its flags at module load; the state path must be armed before it is required */
if (!process.argv.includes('--state')) process.argv.push('--state');

const JSONOUT = process.argv.includes('--json');
const SB = require(D('tests', 'staged_board.js'));   // harness() binds the driver over the release
const BS = require(D('engine', 'board_state.js'));
const CS = require(D('engine', 'champions_sim.js'));

/* ---- LEGALITY, DERIVED AT RUN TIME -------------------------------------------------------------- */
const MA_CARRIERS = CS.abilityCarriers('mirrorarmor');
const PS_CARRIERS = CS.moveCarriers('partingshot');
const CB_CARRIERS = CS.abilityCarriers('clearbody');

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });

/* p1: the Parting Shot user, plus three inert bodies so there is a bench to pivot into. None of the
 * three has an entry ability that touches boosts (Marvel Scale / Unaware / Rough Skin). */
const TEAM_A = [
  mon('incineroar', '', 'Blaze', ['Parting Shot', 'Protect']),
  mon('milotic', '', 'Marvel Scale', ['Protect']),
  mon('clefable', '', 'Unaware', ['Protect']),
  mon('garchomp', '', 'Rough Skin', ['Protect']),
];

/* p2: the knob is slot 0's ability. Iron Defense is a SELF boost, so it is invisible to both
 * mirrorarmor and clearbody (`target === source` returns early in each) and cannot be a second
 * reason for anything. It exists only so the target's turn-1 click is not Protect. */
const targetTeam = (species, ability) => [
  mon(species, '', ability, ['Iron Defense', 'Protect']),
  mon('snorlax', '', 'Thick Fat', ['Protect']),
  mon('toxapex', '', 'Regenerator', ['Protect']),
  mon('weavile', '', 'Pressure', ['Protect']),
];

const SCRIPT = [
  /* turn 1 — THE MEASURED TURN. Parting Shot at foe slot 0. */
  { p1: [{ m: 'partingshot', t: 0 }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'protect' }] },
  /* turn 2 — THE NEGATIVE. Nobody clicks Parting Shot, so nothing may be reflected and nobody may
   * pivot. An engine that reflected unconditionally, or that left a switch flag armed, parts here. */
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'irondefense' }, { m: 'protect' }] },
];

const ARMS = [
  { id: 'mirror', species: 'corviknight', ability: 'Mirror Armor',
    what: 'THE CASE. Parting Shot into the only legal Mirror Armor body in this format.' },
  { id: 'plain', species: 'corviknight', ability: 'Pressure',
    what: 'THE KNOB CLEARED. Same Corviknight, an ability with no opinion about stat drops.' },
  { id: 'clearbody', species: 'garganacl', ability: 'Clear Body',
    what: 'THE DROP REFUSED WITHOUT REFLECTION — separates "unconditional switch" from '
        + '"switch depends on the drop landing".' },
  /* ---- THE DECLARATION IS GONE BECAUSE THE DEFECT IS — ROADMAP #531, LANDED 2026-08-29 ----------
   *
   * The arm above carried an `allow` for four leaves on `p1a` (`species`, `types`, `ability`,
   * `pp.partingshot`): `data/moves.ts:13180` deletes Parting Shot's own `selfSwitch` when the drop
   * landed on nobody, and this engine switched unconditionally — so the authority kept Incineroar
   * standing while we brought Clefable in.
   *
   * IT WAS REMOVED IN THE SAME PASS AS THE FIX, WHICH IS THE WHOLE POINT OF HAVING DECLARED IT
   * RATHER THAN DELETED THE ARM: a declared divergence that stops happening fails this file as
   * STALE-ALLOW instead of quietly passing, so the fix could not land without this line being dealt
   * with. The arm is now an ordinary control and must read BOARDS-IDENTICAL like the other three.
   *
   * THE CONDITION ITSELF IS PROVED ELSEWHERE AND DELIBERATELY NOT HERE. This file answers Will's
   * Mirror Armor question and its four arms are cut for that; `tests/probe_partingshot_conditional.js`
   * is the instrument for the condition, over nineteen arms across the ability door, the stat floor,
   * both over-fire axes and a knob that puts the defect back. */
  { id: 'sturdy', species: 'garganacl', ability: 'Sturdy',
    what: 'THE KNOB CLEARED for the arm above. Same Garganacl, drops land normally.' },
];

/* ---- WHAT THE LOG SAYS ABOUT ONE TURN ---------------------------------------------------------- */
const TURN_RE = /^\|turn\|/;
function turnSlice(lines, n) {              // the lines emitted for turn `n` (1-based)
  const out = []; let cur = 0;
  for (const raw of lines) {
    const l = String(raw);
    if (TURN_RE.test(l)) { cur = Number(l.split('|')[2]) || (cur + 1); continue; }
    if (cur === n) out.push(l);
  }
  return out;
}
const INTERESTING = /^\|(-unboost|-boost|-ability|switch|drag|move|-fail|-immune|-activate|-start)\|/;
const keep = ls => ls.filter(l => INTERESTING.test(l));

function partyRow(side, species) {
  for (const v of Object.values(side.party || {})) if (v && v.species === species) return v;
  return null;
}
const ab = (b) => (b ? { atk: b.boosts.atk, spa: b.boosts.spa, def: b.boosts.def } : null);

function runArm(arm) {
  const G = SB.harness(null);                      // the SHIPPED engine out of the frozen release
  const a = G.buildPair(TEAM_A), b = G.buildPair(targetTeam(arm.species, arm.ability));
  if (!a || !b) return { id: arm.id, verdict: 'NOT-STAGED', why: 'buildPair returned null' };

  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  let sdLog = null;
  const r = G.playGame(a, b, 'directed', 'psma:' + arm.id, {
    script: SCRIPT,
    onBoundary: (snap, turnIdx, S, battle) => {
      boards.push({ turn: turnIdx, compared: snap.leaves_compared,
                    diffs: snap.diffs.map(d => BS.locate(d, snap)),
                    sd: snap.sd, medi: snap.medi });
      if (battle && battle.log) sdLog = battle.log.slice();
      /* the driver stops a state game at the first divergent board; neutralise the HOOK'S COPY only,
       * after the diffs are taken, so a red turn 1 cannot hide turn 2. Neither engine is touched. */
      snap.identical = true; snap.diffs = [];
    },
  });

  if (r.err) return { id: arm.id, verdict: 'THREW', why: r.err };
  if (r.turns !== SCRIPT.length) return { id: arm.id, verdict: 'SHORT',
    why: 'the script declares ' + SCRIPT.length + ' turns and ' + r.turns + ' were played' };
  if (boards.length !== SCRIPT.length + 1) return { id: arm.id, verdict: 'SHORT',
    why: boards.length + ' boundaries taken, ' + (SCRIPT.length + 1) + ' expected' };
  if (boards.some(x => !x.compared)) return { id: arm.id, verdict: 'SHORT',
    why: 'a boundary compared ZERO leaves — the state path is not armed' };

  const sc = G.scriptCounters ? G.scriptCounters() : null;

  /* THE DECLARED DIVERGENCE, MATCHED LEAF BY LEAF — the same discipline as staged_board.js's
   * `allow`. A declared leaf that matched NOTHING is a claim that has quietly become false. */
  const A = arm.allow;
  const hits = new Map((A ? A.fields : []).map(f => [f, 0]));
  for (const bd of boards) {
    bd.allowed = []; bd.unexplained = [];
    for (const d of bd.diffs) {
      const m = A && d.side === A.side && (d.slot || '') === A.slot && hits.has(d.field);
      if (m) { hits.set(d.field, hits.get(d.field) + 1); bd.allowed.push(d); } else bd.unexplained.push(d);
    }
    bd.diffs = bd.unexplained;
  }
  const stale = [...hits].filter(([, n]) => !n).map(([f]) => f);
  const allowed = [...hits].reduce((n, [, k]) => n + k, 0);
  const unexplained = boards.reduce((n, x) => n + x.diffs.length, 0);

  /* the board AFTER the measured turn */
  const B1 = boards[1];
  const read = (side) => ({
    standing: side.active[0] ? side.active[0].species : '(empty)',
    standing_boosts: ab(side.active[0]),
  });
  const shooter = (side) => ab(partyRow(side, 'incineroar'));
  const victim = (side) => ab(partyRow(side, arm.species));

  return {
    id: arm.id, what: arm.what, species: arm.species, ability: arm.ability,
    verdict: stale.length ? 'STALE-ALLOW'
           : (unexplained ? 'BOARDS-DIFFER'
           : (allowed ? 'AS-DECLARED (#531)' : 'BOARDS-IDENTICAL')),
    stale, allowed, allow_why: A ? A.why : null,
    unexplained, compared: boards.reduce((n, x) => n + x.compared, 0),
    script: sc,
    turn1: {
      sd: { user_slot: read(B1.sd.sides.p1).standing, target_slot: read(B1.sd.sides.p2).standing,
            user_body_boosts: shooter(B1.sd.sides.p1), target_body_boosts: victim(B1.sd.sides.p2),
            target_slot_boosts: read(B1.sd.sides.p2).standing_boosts },
      me: { user_slot: read(B1.medi.sides.p1).standing, target_slot: read(B1.medi.sides.p2).standing,
            user_body_boosts: shooter(B1.medi.sides.p1), target_body_boosts: victim(B1.medi.sides.p2),
            target_slot_boosts: read(B1.medi.sides.p2).standing_boosts },
    },
    diffs: boards.map(x => ({ turn: x.turn, n: x.diffs.length,
                              rows: x.diffs.slice(0, 8).map(d => (d.slot || d.side) + ' ' + d.field
                                + ' me=' + JSON.stringify(d.us) + ' sd=' + JSON.stringify(d.sd)) })),
    sdTurn1: keep(turnSlice(sdLog || [], 1)),
    meTurn1: keep(turnSlice(r.mediTrace || [], 1)),
  };
}

/* ---- RUN ---------------------------------------------------------------------------------------- */
const results = ARMS.map(runArm);

if (JSONOUT) {
  console.log(JSON.stringify({ ma_carriers: MA_CARRIERS, ps_carriers: PS_CARRIERS, results }, null, 2));
} else {
  console.log('\nPARTING SHOT INTO MIRROR ARMOR — staged in both engines, one knob (the target\'s ability).');
  console.log('  legal Mirror Armor carriers : ' + (MA_CARRIERS.join(', ') || '(none)'));
  console.log('  legal Parting Shot carriers : ' + (PS_CARRIERS.join(', ') || '(none)'));
  console.log('  legal Clear Body carriers   : ' + (CB_CARRIERS.join(', ') || '(none)'));
  for (const r of results) {
    console.log('\n' + '='.repeat(96));
    console.log('ARM ' + r.id + '  —  ' + (r.species || '') + ' / ' + (r.ability || ''));
    if (r.what) console.log('  ' + r.what);
    if (!r.turn1) { console.log('  VERDICT ' + r.verdict + ' — ' + r.why); continue; }
    console.log('  script: ' + JSON.stringify(r.script));
    console.log('  --- AFTER THE MEASURED TURN -------------------------------------------------');
    for (const [who, v] of [['AUTHORITY', r.turn1.sd], ['medicham2', r.turn1.me]]) {
      console.log('   ' + who.padEnd(10) + ' user slot p1a = ' + String(v.user_slot).padEnd(14)
        + ' target slot p2a = ' + v.target_slot);
      console.log('   '.padEnd(13) + ' incineroar body boosts = ' + JSON.stringify(v.user_body_boosts)
        + '   target body boosts = ' + JSON.stringify(v.target_body_boosts));
    }
    console.log('  --- TURN 1, THE AUTHORITY\'S OWN LINES ---------------------------------------');
    for (const l of r.sdTurn1) console.log('      SD  ' + l);
    console.log('  --- TURN 1, THIS ENGINE\'S LINES ---------------------------------------------');
    for (const l of r.meTurn1) console.log('      ME  ' + l);
    console.log('  BOARD VERDICT: ' + r.verdict + '  (' + r.compared + ' leaves compared, '
      + r.unexplained + ' unexplained, ' + r.allowed + ' declared)');
    /* THE DECLARED DIVERGENCE IS PRINTED ON EVERY RUN, never folded into a clean line — a
     * deliberate exception that fades into the background is how "known failure" gets filed. */
    if (r.allow_why) console.log('    DECLARED: ' + r.allow_why);
    if (r.stale && r.stale.length) console.log('    STALE-ALLOW — declared leaf(s) that matched '
      + 'NOTHING: ' + r.stale.join(', ') + '. Either the fix landed (update the declaration and this '
      + 'probe) or the fixture stopped staging the mechanic. This is not a pass.');
    for (const d of r.diffs) if (d.n) { console.log('    turn ' + d.turn + ': ' + d.n + ' UNDECLARED diff(s)');
      for (const row of d.rows) console.log('      ' + row); }
  }
  console.log('\n' + '='.repeat(96));
  console.log('SUMMARY');
  for (const r of results) console.log('  ' + r.id.padEnd(11) + ' ' + r.verdict
    + (r.turn1 ? '   sd:p1a=' + r.turn1.sd.user_slot + '  me:p1a=' + r.turn1.me.user_slot : ''));
}

/* AS-DECLARED IS A PASS AND STALE-ALLOW IS NOT. A divergence that is filed with a register row and
 * printed on every run is a receipt; a declared divergence that has stopped happening is a claim
 * that has become false, and it fails here exactly as an undeclared one does. */
const bad = results.filter(r => r.verdict !== 'BOARDS-IDENTICAL' && r.verdict !== 'AS-DECLARED (#531)');
console.log(bad.length
  ? '\nFAIL — ' + bad.map(r => r.id + ' ' + r.verdict).join(', ')
  : '\nPASS — all 4 arms board-identical, and the declaration ROADMAP #531 used to need is gone '
    + 'because the condition is implemented.');
process.exit(bad.length ? 1 : 0);
