/* all_mechanics_fire.js — ROADMAP #143. BUILD THE GAMES FROM THE MECHANIC LIST, NOT FROM REALISTIC
 * SETS, SO EVERY MOVE ACTUALLY FIRES INSIDE A REAL SHOWDOWN GAME, AND COMPARE TURN BY TURN.
 *
 *   SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --release 7bf3a1e19ce5
 *   ... --kind moves|abilities|items|all      which population (default moves)
 *   ... --limit 40                            first N of the population, for a smoke run
 *   ... --only thunderbolt,willowisp          named rows only
 *   ... --red                                 THE RED DEMONSTRATION, and nothing else
 *   ... --write                               + data/all-mechanics-fire.json
 *
 * WILL, 2026-08-10:  "WE HAVE TO CREATE THE GAMES OURSELVES AND TEST IT ON SHOWDOWN"
 *                    "SET UP SCENARIOS WHERE ALL MOVES CAN BE USED SUCCESSFULLY"
 *                    "I DONT CARE IF THEY ARE GOOD PLAYS, JUST HAVE THE MOVES SUCEED"
 *
 * The last line is the design constraint and it is what makes this instrument possible at all: the
 * teams do not have to be SENSIBLE. They have to be LEGAL — judged by Showdown's own `TeamValidator`,
 * never by ours — and they have to make the mechanic RESOLVE.
 *
 * ================= WHY THIS AND NOT THE REPLAY DIFFERENTIAL =======================================
 *
 * Replay testing is capped BY CONSTRUCTION. Champions open sheets declare item, ability, moves and
 * nature and do NOT declare SP, and the legal-SP envelope is wider than the whole 16-roll damage band
 * — 0 of 22,313 turn-1 damage comparisons across 12,071 stored games resolve to an exact roll. No
 * quantity of sheet data fixes that. `game_differential.js` has no such ceiling because it BUILDS both
 * teams; its one real limit is COVERAGE, because it plays teams a bot would bring and therefore
 * exercises only moves a bot clicks. This closes that hole from the other end: the TEAM IS DERIVED
 * FROM THE MECHANIC, so the rare rows get tested the strong way — inside a real game against the
 * official engine — rather than on a staged board.
 *
 * ================= WHAT "RESOLVED" MEANS, AND WHY A CLICK IS NOT ONE ==============================
 *
 * ROADMAP #91's founding lesson, one instrument over: Primarina clicking Haze into a board with no
 * boosts on it is not a test of Haze. So a row is credited only when the AUTHORITY'S OWN STREAM shows
 * the move executing AND producing a consequence:
 *
 *   ATTEMPTED   a `|move|` line naming the actor and the move, in Showdown's log
 *   BLOCKED     that segment carries a refusal — `-fail`, `-miss`, `-immune`, `-notarget`, `|cant|`,
 *               or a guard `-activate` (Protect and its family). The move was clicked and did nothing.
 *   RESOLVED    attempted, not blocked, and the segment carries at least one CONSEQUENCE line
 *
 * The verdict is read off SHOWDOWN and never off medicham2, because a resolution judged from
 * medicham2's own narration would be the engine grading its own homework. Whether medicham2 agrees is
 * the SEPARATE question this file also asks, in `game_differential`'s existing divergence vocabulary.
 *
 * ================= A MECHANIC WITH NO NARRATION: THE A/B ARM ======================================
 *
 * A move announces itself. AN ABILITY OFTEN DOES NOT — Blaze under a third, Sheer Force, Thick Fat and
 * Analytic emit no protocol line at all, so "did it fire" cannot be read from a stream the way a move
 * can. Hand-listing a trigger per ability is the thing docs/TAGS.md forbids, because it rots the first
 * time an ability is added.
 *
 * So the ability and item verdicts are DIFFERENTIAL: play the SAME game twice under the same pinned
 * dice, once with the mechanic and once with a CONTROL (another of that species' own legal abilities;
 * for an item, no item), and ask whether the two games differ.
 *
 *   FIRED          removing it changed the game — in Showdown AND in medicham2
 *   SHOWDOWN-ONLY  the authority's game changed and ours did not. THAT IS AN ENGINE BUG.
 *   MEDICHAM-ONLY  ours changed and the authority's did not. ALSO AN ENGINE BUG.
 *   DID-NOT-FIRE   neither game changed. The scenario did not reach the trigger — a gap in THIS
 *                  instrument, reported as such and never as a pass.
 *
 * That definition is derived rather than listed, and it is the same question the MEDICHAM gate's
 * deliberate roster asks on a STAGED single turn (`FIRED-AND-BOARDS-DIFFER` / `DID-NOT-FIRE`) — asked
 * here inside a real game instead. Where the two instruments disagree about one mechanic, that
 * disagreement is itself the finding.
 *
 * ================= THE RED DEMONSTRATION ==========================================================
 *
 * `--red` breaks the comparison ON PURPOSE and asserts it is caught. An instrument that has never
 * failed is not evidence. Three plants, each aimed at a different claim this file makes:
 *   1. a move that CANNOT resolve (clicked into a type immunity) must be reported BLOCKED, not resolved
 *   2. a mechanic swapped for its own control must be reported DID-NOT-FIRE by the A/B arm
 *   3. a corrupted medicham stream must be reported as a DIVERGENCE at the line it was corrupted
 */
'use strict';
require('./showdown_path.js');
/* GAME_RULES -- conformance S12b, 2026-09-10. The names this instrument carries are
 * FIXTURE CHOICES, not facts about the game: PAD_MOVE (every staged pad clicks it, and it is the fallback
 * click), FILLERS (learnable fillers so no staged set is empty), GUARD_LINE (a shield `-activate`, so a
 * blocked click is not credited, ROADMAP #91; its alternation is unchanged), RED_DEMO_ITEM / RED_DEMO_SIDE
 * (the red demonstration item row and its unannounced side-clock plant).
 * Every value is byte-identical to the literal it replaced; nothing here changes behaviour. */
const GAME_RULES = Object.freeze({ PAD_MOVE: 'protect', FILLERS: ['protect', 'rest', 'facade', 'round', 'tackle', 'takedown', 'sleeptalk', 'swagger'], GUARD_LINE: /move:\s*(protect|detect|spiky ?shield|baneful ?bunker|wide ?guard|quick ?guard|crafty ?shield|mat ?block|max ?guard|obstruct|silk ?trap|burning ?bulwark|king'?s ?shield)/i,
  RED_DEMO_ITEM: 'sitrusberry', RED_DEMO_SIDE: 'tailwind' });
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);
/* ROADMAP #425 (2026-09-11) -- THE DEFAULT IS `all`. engine/quarantine.js needs rows for moves, abilities
 * AND items and falls back to counting every divergence UNFILTERED when any population is missing, so a bare
 * `--write` that published `moves` alone silently disabled its own consumer's filter. A caller that wants one
 * population says so. `ABRA_AMF_DEFAULT_MOVES=1` restores the old default (tests/probe_amf_default_populations.js
 * goes red under it). */
const KIND = String(flag('--kind', process.env.ABRA_AMF_DEFAULT_MOVES === '1' ? 'moves' : 'all')).toLowerCase();
const LIMIT = +flag('--limit', 0) || 0;
const ONLY = flag('--only', null);
const WRITE = has('--write');
const RED = has('--red');
const VERBOSE = has('--verbose');
const DUMPLOG = has('--dumplog');
const OUT = flag('--out', null);
/* ---- `--trailing N` — KEEP PLAYING AFTER THE CLICK (2026-08-19) ---------------------------------
 *
 * A MOVE ROW'S SCRIPT ENDS ON THE CLICK TURN, so the board comparison gets exactly ONE boundary after
 * the mechanic resolves. That is enough for a mechanic that acts immediately and NOT ENOUGH for one
 * whose consequence lands later — a lock that blocks the NEXT turn's switch, a multi-turn shout, a
 * counter that ticks. On such a row "the boards agreed" would be true and would mean nothing, because
 * the game ended before the state could exist. It is the same failure `su.trailing` was already added
 * for on the heal family, generalised so it can be asked of any row.
 *
 * IT IS A DIFFERENT SAMPLE AND IS NEVER POOLED WITH A RUN WITHOUT IT. A longer game has more chances
 * to part for reasons that have nothing to do with the row, so the artifact records the number and the
 * report says so. Default 0 — the fixture is unchanged unless a caller asks. */
const TRAILING = +flag('--trailing', 0) || 0;
if (TRAILING) console.log('  --trailing ' + TRAILING + ': every MOVE row plays ' + TRAILING + ' extra turn(s) '
  + 'after its click, so a mechanic whose consequence lands later has a board taken after it. THIS IS A '
  + 'DIFFERENT SAMPLE from a run without it and its rows must not be pooled with one.');

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}
/* THE PHOTOGRAPH. `game_differential.js` reads `--release` off the same argv, so naming one here pins
 * BOTH the driver's frozen engine and this file's. Absent, the driver cuts a release over the live
 * tree and says so; that is fine for a smoke run and is NOT a measurement. */
if (!flag('--release', null)) {
  console.log('  NO --release GIVEN. The driver will cut one over the LIVE tree; another division may be');
  console.log('  editing it. This is a smoke run, not a measurement.');
}

/* ---- THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE, AND THAT IS NOT A PREFERENCE ------------
 *
 * `game_differential`'s default stop rule ends a game at its FIRST PROTOCOL DIVERGENCE, which is right
 * for the swarm — every line after that point is downstream of the first. It is FATAL here, because a
 * scenario's precondition turns come BEFORE the click: a heal needs a prior turn of damage, Spit Up
 * needs a prior Stockpile, a charge move needs a first turn to charge. MEASURED: 12 of the 500 move
 * rows had their click turn eaten by a divergence on the SETUP turn, and every one of them was
 * reported as "the move was never issued" — an instrument limitation wearing the costume of a finding.
 *
 * `--state` is the driver's own switch for exactly this: the game runs to `--turns` or to its first
 * BOARD divergence, and THE FIRST PROTOCOL DIVERGENCE IS STILL RECORDED AT EXACTLY THE LINE IT WAS
 * FOUND. So nothing about the protocol measurement changes; the game simply keeps playing.
 *
 * IT IS PUSHED ONTO argv RATHER THAN DOCUMENTED AS A FLAG THE CALLER SHOULD REMEMBER. A caller who
 * forgot it would get a quieter, smaller, wronger answer that looks exactly like a real one — the
 * silent default this project has been bitten by repeatedly. It is announced on every run. */
if (!has('--state')) { process.argv.push('--state'); argv.push('--state'); }
console.log('  --state is ON (forced): a game runs past its first divergent LINE so a scenario\'s setup '
          + 'turns cannot eat its click turn. The first protocol divergence is still recorded where it was found.');

const GD = require('./game_differential.js');
/* THE BOARD READER, LOADED LIVE AND NOT FROM THE RELEASE — the same decision game_differential.js
 * makes about it one file over, and for the same reason: freezing the INSTRUMENT would score every
 * ladder rung by its own contemporary comparator instead of by one comparator. The ENGINE is what the
 * release pins. */
const BS = require('./board_state.js');
const CS = require('./champions_sim.js');
const { Dex, TeamValidator } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require('./names.js');
const id = N.id;
const VALIDATOR = new TeamValidator(CS.FORMAT);
const TAGS = JSON.parse(GD.REL.read('data/tags.json') || fs.readFileSync(D('data', 'tags.json'), 'utf8'));

/* ================= THE PREFLIGHT — "DID NOT FIRE" WAS TWO DIFFERENT FINDINGS =======================
 *
 * `data/all-mechanics-fire.json` of 2026-08-11 reports 98 abilities and 61 items as DID-NOT-FIRE, and
 * that bucket conflates the only two things a reader could want to tell apart:
 *
 *   THE ENGINE IS BROKEN          the fixture asked the question and medicham2 gave the wrong answer
 *   THE FIXTURE NEVER ASKED IT    the board was structurally incapable of firing the trigger, so both
 *                                 arms were identical for a reason that has nothing to do with the engine
 *
 * One is an ENGINE defect and the other is a HARNESS defect, and they are fixed by different people in
 * different files. Merged, the bucket is unusable: every row in it looks like an engine gap, so the
 * fix list is 159 long and mostly wrong.
 *
 * `engine/fixture_preflight.js` answers exactly the second question — CAN THE TRIGGER FIRE ON THIS
 * BOARD — from the mechanic's OWN handler source rather than from a list. Its measured precedent is
 * Cute Charm, which read 0 of 4,166 as ABSENT until the fixtures carried genders and then read 30.92%.
 * This file did not require it; `million_run.js`, `tests/roster.js` and `tests/test-mechanics.js` did.
 *
 * WHAT IT ACTUALLY MATCHES HERE WAS PRINTED BEFORE IT WAS WIRED, because a new derived predicate
 * over-matches (docs/ENGINE.md: `refusesStatusMoves` caught Telepathy and Wonder Guard). Over the 187
 * legal abilities that have a carrier in this format:
 *      2 BLOCKING   cutecharm, rivalry — the two known gender-gated ones, and nothing else
 *     16 advisory   status-reading: guts healer hydration immunity insomnia leafguard limber …
 *     16 advisory   weather-gated: chlorophyll solarpower swiftswim sandrush icebody dryskin forecast …
 *      5 advisory   weather SETTERS, which must NOT be handed a sky — see the clause
 * and over the 73 in-scope items: 6, all status-curing berries. Over the 496 moves with a carrier: 0,
 * which is honest — the trigger clauses are handler-shaped and a move row's handlers are not read.
 *
 * A BLOCKING CLAUSE AND AN UNMET ADVISORY ONE ARE BOTH REPORTED, AND THEY ARE NOT THE SAME CLAIM. A
 * blocking clause says the board cannot show anything at all. An advisory clause says a precondition
 * the handler reads was never put on the board — which explains a DID-NOT-FIRE and nothing else, so it
 * is only applied to a row that did not fire.
 *
 * NOTHING IS RENAMED OR REMOVED. `verdict`, `fired`, `did_not_fire` and every other field keep their
 * meaning for whatever already reads them; `verdict_refined`, `cannot_fire`, `cannot_fire_clause` and
 * `preflight` are added beside them. */
const PRE = require('./fixture_preflight.js');
/* SCOPE IS ASKED OF engine/legal_scope.js, THE ONE IMPLEMENTATION — 2026-09-11
 * (docs/_reports/2026-09-11-scope-unified.md). This file decided it itself in five places — a move with
 * no learner in `CARRIERS`, an ability with no carrier in `AB_CARRIERS`, a stone with no legal pair, the
 * z-crystal / Poke Ball excuse, and a relabel keyed on the validator's "does not exist in Gen 9" — and
 * it disagreed with the verdict on two rows: it marked Simple (CONFERRED through Simple Beam) unreachable
 * and it staged Gluttony (NO-LEGAL-READER). `LEGAL_SPECIES` below stays: it is the list of sheet BODIES to
 * stage on, which is this file's question. Whether a mechanic EXISTS is the verdict's. */
const SCOPE = require('./legal_scope.js').derive();
/* THE RED SWITCH. `--break-preflight` replaces the preflight with a stub that clears everything,
 * exactly as an unwired preflight would, so the demonstration that the wiring is load-bearing can be
 * run rather than asserted. It is announced on every run that uses it. */
const BREAK_PREFLIGHT = has('--break-preflight');
if (BREAK_PREFLIGHT) console.log('  --break-preflight IS ON. The preflight is stubbed to clear everything. '
  + 'Every CANNOT-FIRE row will collapse back into DID-NOT-FIRE. THIS IS THE RED DEMONSTRATION, NOT A RUN.');
const BREAK_TRIGGERS = has('--break-triggers');
if (BREAK_TRIGGERS) console.log('  --break-triggers IS ON. The handler-derived move needs are suppressed and '
  + 'every ability falls back to the shared four-move gauntlet — the state this file was in before '
  + '2026-08-12. THIS IS THE RED DEMONSTRATION, NOT A RUN.');
/* THE MEGA RED SWITCH (2026-09-11, harness batches HB-2 and HB-4). `--break-mega` stops every staged
 * script ASKING to mega evolve. Every stone row and every mega-carrier ability row must then lose its
 * `|-mega|` receipt, lose its board, and the run must exit non-zero — which is the proof that a stone
 * row's board is a board taken AFTER an evolution rather than a board of a body holding a rock. */
const BREAK_MEGA = has('--break-mega');
if (BREAK_MEGA) console.log('  --break-mega IS ON. No staged script asks to mega evolve. Every stone row and every '
  + 'mega-carrier ability row must lose its |-mega| receipt and its board. THIS IS THE RED DEMONSTRATION, NOT A RUN.');
const PREFLIGHT = {
  checked: 0,          /* every call, including the red plants */
  rows_checked: 0,     /* calls made ON A POPULATION ROW — a zero here means the wiring is a no-op */
  refused: 0,          /* calls carrying at least one BLOCKING clause */
  rows_labelled: 0,    /* rows that came out CANNOT-FIRE-IN-THIS-FIXTURE */
  over_matched: [],    /* a row the preflight BLOCKED that fired anyway — the clause is wrong */
  by_clause: {},
  repaired_weather: 0, weather_unrepairable: 0,
  faces_weather_noop: 0, faces_status_noop: 0,
  repairs: [],
  /* THE DERIVED TRIGGER, COUNTED, because a capability that cannot prove it ran is assumed broken.
   * `trigger_rows` zero over the abilities means the derivation is unwired; `trigger_unstaged` is the
   * honest residue — a need this fixture's fixed bodies cannot supply — and every one of those rows
   * carries the clause that names it. */
  trigger_rows: 0, trigger_needs: 0, trigger_staged: 0, trigger_unstaged: 0, trigger_examples: [],
};
function preflight(sc) {
  if (BREAK_PREFLIGHT) return { ok: true, why: [], note: [], clauses: [], stubbed: true };
  PREFLIGHT.checked++;
  const r = PRE.check(sc);
  if (!r.ok) PREFLIGHT.refused++;
  for (const c of (r.clauses || [])) {
    const k = c.clause + (c.blocking ? ' (blocking)' : '');
    PREFLIGHT.by_clause[k] = (PREFLIGHT.by_clause[k] || 0) + 1;
  }
  return r;
}
/* THE LABEL. `fired` here means "this row moved a game / resolved a move", which is the only thing that
 * can falsify a refusal — so a BLOCKED row that fired anyway is recorded as an OVER-MATCH and printed,
 * never quietly dropped. That is the one direction in which this predicate can be wrong and hide it. */
function labelRow(row, pre, fired) {
  if (!row) return row;
  PREFLIGHT.rows_checked++;
  row.preflight = { ok: pre.ok, why: pre.why, note: pre.note, clauses: pre.clauses,
                    stubbed: !!pre.stubbed };
  const blocking = (pre.clauses || []).filter(c => c.blocking);
  const advisory = (pre.clauses || []).filter(c => !c.blocking && c.clause !== 'weather-setter');
  if (blocking.length && fired) {
    /* TWO INSTRUMENTS DISAGREEING IS A FINDING, AND WHICH ONE IS WRONG IS NOT DECIDED HERE.
     * MEASURED on the first run that had this wiring: `rivalry` came back FIRED on a genderless board,
     * which its own guard (`attacker.gender && defender.gender`) makes impossible. The clause is not
     * over-matching — its CONTROL is Intimidate, and Intimidate moved the game. That is the
     * CONTROL-NOT-QUIET hazard this file already names, arriving through a new door. The two cases are
     * separated at report time (an unquiet control explains it; nothing else does) rather than by
     * asserting one of them here. */
    row.preflight_over_matched = true;
    row.preflight_over_match_note = 'the preflight BLOCKED this board on ' + blocking.map(c => c.clause).join(',')
      + ' and the A/B still moved. Either the clause over-matches, or the CONTROL arm is what moved the '
      + 'game and the FIRED verdict belongs to it — see `control_not_quiet`.';
    PREFLIGHT.over_matched.push({ id: row.id, kind: row.kind, clauses: blocking.map(c => c.clause) });
  }
  /* A BLOCKING clause condemns the board outright. An ADVISORY one only explains a row that did not
   * fire — applying it to a row that fired would be the instrument arguing with its own result.
   *
   * AND A ROW THAT NEVER PRODUCED A VERDICT IS NOT RELABELLED AT ALL. `could not stage`, `no control`
   * and `the carrier body could not be built` are the harness failing before the question was asked;
   * calling those CANNOT-FIRE would hide a staging bug behind a fixture explanation, which is the same
   * conflation this label exists to undo, one level down. */
  const gotAVerdict = !!row.verdict || row.kind === 'move';
  const unmet = (fired || !gotAVerdict) ? [] : (blocking.length ? blocking : advisory);
  if (unmet.length) {
    row.cannot_fire = true;
    row.cannot_fire_clause = unmet.map(c => c.clause).join('+');
    row.cannot_fire_blocking = blocking.length > 0;
    row.cannot_fire_why = (blocking.length ? pre.why : pre.note).slice();
    row.cannot_fire_need = unmet.map(c => c.need || null);
    row.verdict_refined = 'CANNOT-FIRE-IN-THIS-FIXTURE';
    PREFLIGHT.rows_labelled++;
  } else if (row.verdict) row.verdict_refined = row.verdict;
  else if (row.kind === 'move') row.verdict_refined = row.resolved ? 'RESOLVED' : 'NOT-RESOLVED';
  return row;
}
/* move id -> the weather it sets, and the same map keyed by the AUTHORITY'S weather id. Both are
 * inverted from `SETS_WEATHER` below, and the second one exists because of a measured miss:
 *
 * `data/tags.json` CASES ITS WEATHER VALUES INCONSISTENTLY — `sandstorm -> "Sandstorm"`,
 * `raindance -> "RainDance"`, `snowscape -> "snowscape"`, `sunnyday -> "sunnyday"` — while the
 * preflight reads its weather ids off the compiled handler, where they are always lower-case. The
 * repair below matched sun and snow and silently missed sand and rain, so Sand Rush and Swift Swim
 * came out `weather_unrepairable` while their carriers (Excadrill, Basculegion) can learn the setter
 * perfectly well. A silent default looks exactly like a working feature; this one looked like a
 * carrier limitation. `SETS_WEATHER` itself is NOT re-keyed — `setupFor` matches it against
 * `failsWithoutWeather.weather` out of the same artifact and is self-consistent. */
const WEATHER_OF_MOVE = new Map();
const SETS_WEATHER_ID = new Map();

/* THE ARM. `bottom-tie-first` and not the primary, and this is not a preference — under the primary
 * arm EVERY SUB-100-ACCURACY MOVE MISSES, and a missed move has not resolved. Focus Blast, Hydro Pump,
 * Thunder, Fissure, Hypnosis and 140 others could not be credited under any scenario whatsoever. The
 * bottom corner is the arm in which every accuracy check HITS, every crit lands and every secondary
 * fires; it is a shipped arm of the differential, not one invented here, and the two engines agree
 * event-for-event under it (see game_differential's pin header). */
const ARM = GD.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.error('the `bottom-tie-first` arm is gone from game_differential — refusing to guess'); process.exit(2); }
/* ---- WHICH OF THIS ARM'S DICE ARE CONSTANTS, MEASURED OFF THE ARM ITSELF ------------------------
 *
 * A pinned corner replaces `random(m)` with a constant, and two whole families of mechanic become
 * unobservable when it does: an ACCURACY multiplier cannot change `random(100) < accuracy` when the
 * left side never moves, and a CRIT-RATIO change cannot change `randomChance(1, ratio)` when the same
 * is true of the denominator. Brightpowder, Wide Lens, Zoom Lens and Scope Lens are four of the 55
 * unexplained item rows and this is the whole of their explanation.
 *
 * IT IS MEASURED, NOT ASSERTED FROM THE ARM'S NAME. The claim "every accuracy check has the same
 * answer" is exactly the claim `ARM.random` can be asked, so it is asked: the roll is forced only if
 * the comparison comes out the same at both ends of the accuracy range. Under the TOP corner it does
 * NOT (`99 < 1` is false and `99 < 100` is true), so a name-based test would have been wrong for one
 * of the two shipped corners. */
const ARM_FORCES = (() => {
  const r = ARM.random(100);
  const accuracy = typeof r === 'number' && ((r < 1) === (r < 100));
  const crit = ARM.chance(1, 24) === ARM.chance(1, 8) && ARM.chance(1, 24) === ARM.chance(1, 2);
  return { accuracy, crit, sample: r };
})();
console.log('  ARM ' + ARM.id + ': accuracy roll ' + (ARM_FORCES.accuracy ? 'is a CONSTANT' : 'varies')
  + ', crit roll ' + (ARM_FORCES.crit ? 'is a CONSTANT' : 'varies') + ' (measured, random(100)='
  + ARM_FORCES.sample + ') — a mechanic whose only effect is one of those two cannot be seen here.');

/* ================= THE POPULATION ================================================================
 * Every entity the FORMAT admits, asked of the format rather than of a list (CLAUDE.md: the ban is a
 * MECHANISM). `isNonstandard` is the authority's own marker for "does not exist in Gen 9". */
const LEGAL_SPECIES = dex.species.all().filter(s =>
  s.exists && !s.isNonstandard && s.tier !== 'Illegal' && !s.isMega && !s.battleOnly && s.num > 0);

/* THE MOVE POOL PER SPECIES, ASKED OF THE AUTHORITY. `getMovePool` is the same function
 * `TeamValidator` reasons from, so a carrier chosen here is one the validator will accept — and the
 * validator is still run afterwards, because "the same function" is a belief and the verdict is a
 * fact. A species whose pool cannot be built is COUNTED, never skipped silently. */
const POOL_FAILS = [];
const POOL = new Map();
for (const s of LEGAL_SPECIES) {
  try { POOL.set(s.id, dex.species.getMovePool(s.id)); }
  catch (e) { POOL_FAILS.push(s.id + ': ' + e.message); }
}
/* move id -> every legal species that can learn it */
const CARRIERS = new Map();
for (const [sid, pool] of POOL) for (const mv of pool) {
  if (!CARRIERS.has(mv)) CARRIERS.set(mv, []);
  CARRIERS.get(mv).push(sid);
}
for (const v of CARRIERS.values()) v.sort();

const LEGAL_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard).map(m => m.id).sort();
const LEGAL_ABILITIES = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.id).sort();
const LEGAL_ITEMS = dex.items.all().filter(i => i.exists && !i.isNonstandard).map(i => i.id).sort();
/* ability id -> every legal species that has it in its OWN ability slots. An ability no legal body
 * carries is UNREACHABLE in this format and is reported as that rather than as a failure — the Guard
 * Dog lesson from game_differential's standing block. */
const AB_CARRIERS = new Map();
for (const s of LEGAL_SPECIES) for (const a of Object.values(s.abilities || {})) {
  const k = id(a); if (!AB_CARRIERS.has(k)) AB_CARRIERS.set(k, []);
  AB_CARRIERS.get(k).push(s.id);
}
for (const v of AB_CARRIERS.values()) v.sort();

/* ================= THE MEGA STONES, AND THE ABILITIES ONLY A MEGA CARRIES (2026-09-11) =============
 *
 * `LEGAL_SPECIES` drops `isMega` — correctly, because a mega forme cannot be written on a sheet — and
 * everything built from it inherited the omission. Two populations fell through it:
 *
 *   THE 75 STONES  `runItems` excused every one of them as "the mechanism is the MEGA", pointing at
 *                  the deliberate roster (a single staged turn). No instrument had ever compared the
 *                  ACT of evolving inside a real game: the forme, its stat line, its typing and its
 *                  ability, in both engines, at every boundary after it.
 *   14 ABILITIES   whose only legal carrier is a mega forme — Fairy Aura, Shadow Tag, Aerilate,
 *                  Dragonize, Filter … — were reported "NO LEGAL CARRIER" because `AB_CARRIERS` is
 *                  walked over the same list.
 *
 * THE MAP IS DERIVED FROM THE AUTHORITY'S OWN `megaStone` FIELD, never from a name list: item -> {base
 * forme -> mega forme}. A pair is kept only when BOTH formes are legal by the regulation filter
 * (CLAUDE.md: `exists && !isNonstandard && tier !== 'Illegal'`) and the base forme has a move pool —
 * the sheet names the BASE, and the validator judges it. A stone with two bases (one item, two formes)
 * keeps every pair; the row stages the first and records the rest as not staged, by name. */
const LEGAL_FORME = (s) => !!(s && s.exists && !s.isNonstandard && s.tier !== 'Illegal');
const STONE_OF = new Map();
const STONE_DROPPED = [];
for (const it of dex.items.all()) {
  if (!it || !it.exists || it.isNonstandard || !it.megaStone) continue;
  const pairs = typeof it.megaStone === 'string' ? [[it.megaEvolves, it.megaStone]] : Object.entries(it.megaStone);
  const ok = [];
  for (const [b, m] of pairs) {
    const bs = dex.species.get(b), ms = dex.species.get(m);
    if (!LEGAL_FORME(bs) || !LEGAL_FORME(ms) || !POOL.has(bs.id)) { STONE_DROPPED.push(it.id + ':' + b + '->' + m); continue; }
    ok.push({ base: bs.id, mega: ms.id, megaName: ms.name, megaAbilities: Object.values(ms.abilities || {}).map(id) });
  }
  if (!ok.length) continue;
  STONE_OF.set(it.id, { stone: it.id, stoneName: it.name, base: ok[0].base, mega: ok[0].mega,
                        megaName: ok[0].megaName, megaAbility: ok[0].megaAbilities[0] || null,
                        megaAbilityCount: ok[0].megaAbilities.length,
                        otherPairs: ok.slice(1).map(p => p.base + '->' + p.mega) });
}
/* ability id -> the mega carriers that hold it, for an ability NO ordinary legal body carries. Keyed
 * only where `AB_CARRIERS` is empty: an ability a base forme also carries keeps its ordinary A/B row
 * and is not re-staged here (Levitate's Chimecho-Mega, Intimidate's Manectric-Mega, …). */
const MEGA_AB_CARRIERS = new Map();
for (const e of STONE_OF.values()) {
  if (!e.megaAbility || (AB_CARRIERS.get(e.megaAbility) || []).length) continue;
  if (!MEGA_AB_CARRIERS.has(e.megaAbility)) MEGA_AB_CARRIERS.set(e.megaAbility, []);
  MEGA_AB_CARRIERS.get(e.megaAbility).push(e);
}
/* PRINTED BEFORE IT IS WIRED (docs/LESSONS.md §4 — every derivation over-matches on the first try). */
console.log('  MEGA STONES: ' + STONE_OF.size + ' legal stone(s) with a legal base and mega forme'
  + (STONE_DROPPED.length ? '; ' + STONE_DROPPED.length + ' pair(s) dropped as not legal: ' + STONE_DROPPED.join(' ') : '')
  + '; two-base stones: ' + ([...STONE_OF.values()].filter(e => e.otherPairs.length)
    .map(e => e.stone + ' [' + e.base + ' staged; ' + e.otherPairs.join(',') + ' NOT staged]').join(' ') || 'none')
  + '; mega formes with more than one ability: ' + [...STONE_OF.values()].filter(e => e.megaAbilityCount > 1).length);
console.log('  MEGA-ONLY ABILITIES (no ordinary legal carrier): ' + MEGA_AB_CARRIERS.size + ' — '
  + [...MEGA_AB_CARRIERS.entries()].map(([a, es]) => a + '<-' + es.map(e => e.mega).join('/')).join(' '));

/* ================= THE FIXTURES ==================================================================
 *
 * THE RECEIVER IS IMMUNE TO NOTHING, AND THAT IS COMPUTED RATHER THAN CHOSEN. A move that hits a type
 * immunity has not resolved, so a receiver carrying ANY immunity silently deletes a whole type from
 * the measurement. Seven types confer one: Normal (vs Ghost), Ghost (vs Normal and Fighting), Flying
 * (vs Ground), Ground (vs Electric), Steel (vs Poison), Dark (vs Psychic), Fairy (vs Dragon). Grass is
 * excluded on top of those because it is immune to the seven `powder` moves and to Leech Seed.
 *
 * ITS ABILITY MUST ALSO BE INERT — an absorbing or bouncing ability is a second immunity wearing a
 * different hat, and the receiver's whole job is to be hittable. `Torrent` fires only for the
 * HOLDER'S OWN Water attacks below a third HP; the receiver attacks with nothing Water and never gets
 * low (see the HP pool below), so it is inert BY THE SCENARIO rather than by hope. */
const RECEIVER = { species: 'feraligatr', ability: 'Torrent', item: '',
  why: 'pure Water — no type immunity at all; Torrent cannot fire for a body that never clicks a Water move at full HP' };
/* WHAT THE RECEIVER CLICKS, AND WHY IT IS NOT PROTECT. Protect is +4 and would block the very move
 * being staged — `tests/test-game-diff.js`'s `fillerFor` lesson, 30 pairs where the interaction under
 * test could not happen. Agility is priority 0 and raises a stat no damage formula reads.
 * The two ATTACKS are there for the moves that fail — or lose their whole point — unless the target is
 * attacking: Counter, Mirror Coat, Metal Burst, Comeuppance, Sucker Punch, Payback, Avalanche,
 * Assurance. One physical and one special, because those split on the category. */
/* NOT WATERFALL AND NOT WATER PULSE, AND THIS WAS MEASURED RATHER THAN CHOSEN. Both carry a SECONDARY
 * — Waterfall flinches 20% of the time, Water Pulse confuses 20% — and under the `bottom-tie-first`
 * arm EVERY SECONDARY FIRES. The receiver's "just hit it" click therefore flinched the actor on every
 * single turn, and six moves (Counter, Mirror Coat, Metal Burst, Payback, Assurance, Avalanche) were
 * reported as "the move was never issued" when what had happened is that the harness stunned its own
 * actor. Facade and Round carry no secondary at all. */
/* TWO ATTACKING TYPES, NOT ONE, AND THAT WAS A MEASURED DEFECT TOO. Facade and Round are both NORMAL,
 * so against a GHOST actor — Annihilape holding Counter — the receiver's hit was `-immune` and Counter
 * correctly failed for want of a hit to counter. Aqua Tail and Hydro Pump are Water, which nothing in
 * this format is immune to by type; `hittingMove` below picks whichever of the pair can actually reach
 * the body in front of it. */
const RECEIVER_MOVES = ['Agility', 'Facade', 'Aqua Tail', 'Hydro Pump'];
/* THE PADS ARE GENERATED, NOT LISTED. A fixed list of four ran out the moment a scenario's own actor
 * or receiver was already on it — the sheet came back five bodies long and `TeamValidator` refused it
 * for a reason that had nothing to do with the mechanic under test. The pool is every legal species
 * that can click Protect, in the authority's own order, and a scenario takes the first ones it has
 * not already used. It cannot run out and it cannot collide. */
const PAD_POOL = LEGAL_SPECIES.filter(s => (POOL.get(s.id) || new Set()).has(GAME_RULES.PAD_MOVE)).map(s => s.id);
const PAD_MOVES = ['Protect', 'Endure', 'Rest'];
/* THE HP POOL, x6 ON BOTH SIDES. Nothing may faint: a faint forces a switch, and medicham2 refills a
 * dead slot from its own bench while Showdown is told to mirror it — a legitimate mechanism that
 * would nonetheless be THIS HARNESS producing the divergence rather than the engine. The multiplier
 * is applied identically to both engines by the driver (`spec.hpx`), so every FRACTIONAL mechanic —
 * Sitrus at a half, Blaze at a third, Leftovers at a sixteenth — is unchanged. */
const HP_BOOST = 6;
/* A NEUTRAL NATURE THAT IS NOT `Serious`. The validator objects to a 0-SP body under `Serious`
 * specifically — *"did you forget to invest it? change your Nature to a different neutral Nature"* —
 * so the sheet says `Hardy`, which is neutral, declares the zero was deliberate, and moves no stat. */
const NATURE = 'Hardy';

/* ================= BUILDING A SHEET =============================================================== */
const spName = s => { const x = dex.species.get(s); return x && x.exists ? x.name : null; };
const mvName = m => { const x = dex.moves.get(m); return x && x.exists ? x.name : null; };

/* A body's four moves, filtered to what it can actually learn, with a learnable filler appended so no
 * set is empty. A set that survives with zero moves is DROPPED and counted — never given a guessed
 * move, which is how a scenario comes to test something nobody asked for. */
const FILLERS = GAME_RULES.FILLERS;
const BODY_FALLBACK = new Set();
function bodyOf(species, ability, item, wantMoves) {
  const sp = dex.species.get(species);
  if (!sp || !sp.exists) return null;
  const pool = POOL.get(sp.id);
  if (!pool) return null;
  const moves = [];
  for (const w of (wantMoves || [])) {
    const k = id(w); if (!k || moves.includes(k)) continue;
    if (!pool.has(k)) continue;
    const dm = dex.moves.get(k); if (!dm || !dm.exists || dm.isNonstandard) continue;
    moves.push(k);
    if (moves.length >= 4) break;
  }
  if (!moves.length) for (const f of FILLERS) { if (pool.has(f) && !dex.moves.get(f).isNonstandard) { moves.push(f); break; } }
  /* HB-3 (2026-09-11) — THE BODY'S OWN POOL, LAST. A species whose whole legal pool holds no wanted
   * move and no filler was returned as null, which is why Imposter and Limber read "the carrier body
   * could not be built": Ditto's pool is one move. The fallback takes the first legal move the body
   * CAN learn, and every species it fires for is recorded in `BODY_FALLBACK` and printed, because a
   * fallback that fires silently looks exactly like a working body. */
  if (!moves.length) {
    const own = [...pool].filter(k => { const dm = dex.moves.get(k); return dm && dm.exists && !dm.isNonstandard; }).sort();
    if (own.length) { moves.push(own[0]); BODY_FALLBACK.add(sp.id); }
  }
  if (!moves.length) return null;
  const legalAb = Object.values(sp.abilities || {});
  let ab = legalAb.find(a => id(a) === id(ability)) || legalAb[0] || '';
  return { species: sp.name, item: item || '', ability: ab, moves: moves.map(mvName) };
}

/* THE SHEET THE AUTHORITY JUDGES IS SIX BODIES; THE GAME BRINGS FOUR. Showdown's `TeamValidator`
 * refuses a four-body team outright — *"You must bring at least 6 Pokemon"* — so a team that is only
 * ever four long cannot be judged at all, whatever is on it. The first four are the ones that play
 * (`team 1234`); the last two are fixed legal pads. THE PLAYED BODIES ARE THEREFORE ALL VALIDATED,
 * and the reason the battle is not six-long is not convenience: medicham2 would carry a four-body
 * bench against Showdown's two, and Beat Up and Revival Blessing read the PARTY SIZE — the harness
 * would manufacture a divergence out of its own padding. */
let SHEET_FAILS = 0;
function sheetOf(bodies) {
  const out = bodies.slice(0, 4).filter(Boolean);
  if (out.length !== bodies.slice(0, 4).length) { SHEET_FAILS++; return null; }
  for (const pid of PAD_POOL) {
    if (out.length >= 6) break;
    if (out.some(b => id(b.species) === pid)) continue;
    const p = bodyOf(pid, '', '', PAD_MOVES);
    if (p) out.push(p);
  }
  if (out.length !== 6) { SHEET_FAILS++; return null; }
  return out;
}

/* THE AUTHORITY'S VERDICT ON A SHEET, and its REASONS. A refusal is reported with what the validator
 * said and is never quietly dropped: "a set it refuses is not a test", and a refusal nobody reads is
 * a row that silently left the population. */
const VAL_CACHE = new Map();
function validate(sheet) {
  const sets = sheet.map(b => ({
    name: b.species, species: b.species, gender: 'N', level: 50, item: b.item,
    ability: b.ability, moves: b.moves.slice(), nature: NATURE,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  }));
  const key = JSON.stringify(sets);
  if (VAL_CACHE.has(key)) return VAL_CACHE.get(key);
  let errs = null;
  try { errs = VALIDATOR.validateTeam(sets); }
  catch (e) { errs = ['validator threw: ' + e.message]; }
  const r = { ok: !errs, errors: errs || [] };
  VAL_CACHE.set(key, r);
  return r;
}
/* A PLANNED SHEET, VALIDATED AS WRITTEN — its own gender, spread and nature (2026-09-11). A deep copy is
 * handed over because `validateTeam` normalises the sets it is given. */
function validateAsWritten(team) {
  const key = 'as-written:' + JSON.stringify(team);
  if (VAL_CACHE.has(key)) return VAL_CACHE.get(key);
  let errs = null;
  try { errs = VALIDATOR.validateTeam(JSON.parse(JSON.stringify(team))); }
  catch (e) { errs = ['validator threw: ' + e.message]; }
  const r = { ok: !errs, errors: errs || [] };
  VAL_CACHE.set(key, r);
  return r;
}

/* ================= READING THE AUTHORITY'S STREAM =================================================
 *
 * The verdict vocabulary of the header, implemented once. A `|move|` line opens a SEGMENT that runs
 * to the next `|move|`, `|turn|`, `|upkeep|` or the end of the log; everything the move did is in it.
 *
 * WHAT COUNTS AS A REFUSAL is the authority's own words, not a guess: `-fail` (the move did nothing),
 * `-miss` (accuracy), `-immune` (type or ability), `-notarget` (nobody there), `|cant|` (the move
 * could not be used at all), and a guard `-activate` — Protect, Detect, Spiky Shield, Baneful Bunker,
 * Wide Guard, Quick Guard, Crafty Shield, Mat Block, Max Guard. A move blocked by a shield was clicked
 * and did nothing, which is exactly the case ROADMAP #91 exists to stop crediting. */
const REFUSAL = new Set(['-fail', '-miss', '-immune', '-notarget', '-block', 'cant']);
const GUARDS = GAME_RULES.GUARD_LINE;
/* LINES THAT ARE NEITHER A CONSEQUENCE NOR A REFUSAL. `-anim` is the client's animation hint and is
 * emitted for a move that then fails; `-hitcount` and `-waiting` are bookkeeping. Counting any of them
 * as a consequence would credit a move for having been drawn on a screen. */
const NOT_A_CONSEQUENCE = new Set(['-anim', '-hitcount', '-waiting', '-center', '-notarget', '-message',
                                   '-hint', '-ohko', '-combine', '-nothing']);
/* ---- `-singleturn` IS DELIBERATELY NOT IN THAT SET, AND THE REASON IS WRITTEN DOWN EITHER WAY -----
 *
 * ASKED AND DECIDED 2026-08-29, because a declaration with no stated mechanism is how four exemptions
 * in three days turned out to be wrong. `-singleturn` is what Showdown prints when Protect, Endure,
 * Quick Guard, Focus Punch and their family come up, and counting it as a consequence is what makes
 * those rows read RESOLVED with nothing having attacked into them. The obvious repair is to demote it
 * here. IT IS THE WRONG REPAIR, for two measured reasons:
 *
 *   1. IT IS NOT BOOKKEEPING. Everything else in this set is the client being told how to draw a
 *      frame — `-anim`, `-hitcount`, `-waiting`. `-singleturn` is the authority announcing that a
 *      STATE WAS CREATED, and for a move whose entire function is to create a state, creating one IS
 *      resolving. Demoting it makes Protect report *"the move executed and produced no consequence
 *      line at all"*, which is a false accusation against a correct engine — the exact shape that
 *      made 162 of 169 roster accusations turn out to be the ruler.
 *   2. IT WOULD SINGLE OUT ONE SPELLING OF ARRIVAL. `-start`, `-sidestart`, `-fieldstart` and
 *      `-singlemove` say the same thing for a leaf that lasts longer, and they are legitimate
 *      consequences for Tailwind, Substitute, Trick Room and Encore. A set that holds `-singleturn`
 *      and not those four is inconsistent by construction, and one that holds all five stops
 *      crediting every state-setting move in the format.
 *
 * THE GAP IS NOT THAT THE ANNOUNCEMENT IS COUNTED. It is that nothing separately asked whether the
 * leaf's EFFECT ever ran. That is a SECOND field, `leaf_effect` below — not a redefinition of the
 * first — and it is what a reader needs to tell "the shield went up" from "the shield blocked". */
/* CONSEQUENCES THAT ARE NOT `-` EVENTS, and every one of them cost a false negative before it was
 * written down. Showdown announces the biggest things a move can do WITHOUT a leading dash:
 *   `faint`         the target died — Explosion, an OHKO move
 *   `drag`          Roar and Whirlwind dragged something out. This USED to end the segment, so Roar
 *                   and Whirlwind were filed as "produced no consequence line at all"
 *   `switch`        the user left — U-turn, Volt Switch, Teleport, Baton Pass, Parting Shot
 *   `swap`          Ally Switch moved two bodies
 *   `detailschange` / `formechange` / `replace`   Aura Wheel's Morpeko, Illusion breaking
 *   `move …[from]`  Copycat, Metronome, Sleep Talk, Instruct — the move it CALLED is a nested `|move|`,
 *                   which used to open a new segment and leave the caller looking inert
 * They still CLOSE the segment (everything after is that new event's business), but they are counted
 * on the way out. */
const NONDASH_CONSEQUENCE = new Set(['faint', 'drag', 'switch', 'swap', 'detailschange', 'formechange', 'replace']);
function segments(log) {
  const segs = [];
  let cur = null;
  for (const raw of log) {
    const p = String(raw).split('|');
    const ev = p[1];
    if (ev === 'move') {
      /* A NESTED CALL — `|move|p1a: X|Thunderbolt|p2a: Y|[from]Copycat` — is the CALLER'S consequence
       * and then a segment of its own. Both, in that order. */
      if (cur && /\[from\]/.test(raw)) cur.lines.push(raw);
      if (cur) segs.push(cur);
      cur = { who: p[2], move: id(p[3]), still: raw.indexOf('[still]') >= 0,
              /* THE AUTHORITY'S OWN MARKER THAT THE CLICK REACHED MORE THAN ONE BODY —
               * `|move|p1a: Audino|Life Dew||[still]|[spread] p1a,p1b`. Read here rather than
               * re-derived from `move.target`, because it is the log that says what actually
               * happened; see the `-fail` split in `verdictFor`. */
              spread: raw.indexOf('[spread]') >= 0, lines: [] };
      continue;
    }
    if (ev === 'cant') { if (cur) { segs.push(cur); cur = null; } segs.push({ who: p[2], move: id(p[4] || ''), cant: p[3], lines: [] }); continue; }
    if (NONDASH_CONSEQUENCE.has(ev)) { if (cur) { cur.lines.push(raw); segs.push(cur); cur = null; } continue; }
    if (ev === 'turn' || ev === 'upkeep') { if (cur) segs.push(cur); cur = null; continue; }
    if (cur) cur.lines.push(raw);
  }
  if (cur) segs.push(cur);
  return segs;
}
/* Did THIS actor's click of THIS move resolve? Returns the verdict and, when it did not, the
 * authority's own reason — because "0" is not a finding and "-immune" is. */
/* ---- A DIVERGENCE ON ANOTHER SLOT IS NOT THIS ROW'S DEFECT ---------------------------------------
 *
 * MEASURED 2026-08-10, and it produced three false findings. `afteryou`, `sleeptalk` and `snore`
 * (442 clicks between them) were each filed as the SUBJECT emitting a spurious `-fail`. The line is
 * `|-fail|p1b: Venusaur` — the PARTNER slot — while every subject in this harness is staged at `p1a`.
 * The harness recorded the game's first protocol divergence and attributed it to whatever row the
 * game was staged for, so one bug in the partner slot was charged to three unrelated moves.
 *
 * Will spotted it from the mechanics without seeing the code: "7 YOU GOTTA BE ASLEEP FOR SLEEP TALK
 * AND SNORE" — true, and precisely why the SUBJECT failing made no sense.
 *
 * THE ROW IS STILL RECORDED. Suppressing it would trade three false findings for one invisible real
 * one, which is this project's signature failure. It is recorded with `attributed: false` and the
 * slot it actually belongs to, and the cause report counts the two kinds separately — so a partner
 * bug reads as ONE bug in the partner slot instead of N bugs in N subjects.
 *
 * THE SLOT NAMED ON THE LINE IS THE WRONG TEST, and it was written first and caught by its own
 * fixture. `|-damage|p2a: Feraligatr|915/960` names the OPPONENT'S slot and is the subject's move
 * LANDING — the whole Aegislash class looks like that. A slot rule would have exonerated every real
 * finding in this run while fixing three false ones. That is "correct the diagnosis, not just the
 * bug" — a fix aimed at the wrong mechanism is still a bug.
 *
 * THE RIGHT ANCHOR IS THE MOVE SEGMENT, which this file already computes. `segments()` opens a
 * segment on each `|move|` line and files every consequence under it, so a `-damage` on the target
 * belongs to the ATTACKER'S segment. Walk the authority's log to the divergent index and ask whose
 * segment is open there. If it is the subject's own click, the divergence is this row's. If a
 * partner or the opponent was mid-move, it is theirs. */
function ownerAt(log, idx) {
  /* Mirrors segments()' state machine, stopping at `idx`. Deliberately a separate walk rather than a
   * second return value from segments(): that function is the verdict reader and is called on both
   * engines' logs, and threading indices through it to serve one caller would put two jobs in one
   * function. */
  let who = null, move = null;
  for (let i = 0; i <= idx && i < log.length; i++) {
    const p = String(log[i]).split('|');
    const ev = p[1];
    if (ev === 'move') { who = p[2]; move = id(p[3]); continue; }
    if (ev === 'cant') { who = p[2]; move = id(p[4] || ''); continue; }
    if (ev === 'turn' || ev === 'upkeep') { who = null; move = null; continue; }
    if (NONDASH_CONSEQUENCE.has(ev)) { who = null; move = null; continue; }
  }
  return { who, move };
}
/* AND THE THIRD REWRITE ENDED IN A FLAG, NOT A VERDICT — deliberately, and this is the honest answer.
 *
 * Attempt 2 was "attribute by the MOVE'S TARGET": After You reaches its partner, so a partner-slot
 * divergence is genuinely its bug, while Sleep Talk (`self`) and Snore cannot touch a partner.
 * WILL, 2026-08-10: "AFTER YOU IS USED BY A FAST POKEMON LIKE LOPUNNY TO MAKE THEIR SLOW PARTNER MOVE
 * FIRST LIKE TORKOAL" — which is exactly right, and measuring it killed the rule: in this format After
 * You's target is `normal`, and `normal` in doubles INCLUDES the ally. So does Snore's. The dex does
 * not separate these three rows, and a rule built on it would have looked principled and decided
 * nothing.
 *
 * THREE ATTEMPTS, THREE DIFFERENT WRONG ANSWERS, AND THE PATTERN IS THE POINT. Each version traded a
 * false positive for a false negative — and in this repository a false negative is strictly worse: a
 * defect wrongly kept gets investigated and dropped, a defect wrongly disowned is invisible, which is
 * the failure mode CLAUDE.md opens with. So NOTHING IS DISOWNED HERE.
 *
 * What is recorded is the fact, not a judgement: which slot's move segment the divergent line fell
 * inside. When it is not the subject's, the row carries `shared_suspect` and the reporter groups those
 * rows together, so a single partner-slot bug reads as ONE suspect shared by N rows rather than N
 * independent findings. The count is no longer inflated and no finding is thrown away. Deciding which
 * of the two it actually is needs a human reading one full log, and that is ROADMAP work, not a
 * predicate. */
function divOf(div, who, sdLog, moveId) {
  if (!div) return null;
  const subject = (String(who || '').match(/^(p[12][abc])/) || [])[1] || 'p1a';
  const own = ownerAt(sdLog || [], div.index);
  const ownSlot = own.who ? (String(own.who).match(/^(p[12][abc])/) || [])[1] : null;
  /* NO OPEN SEGMENT — a residual, an end-of-turn line, a switch — belongs to the game rather than to
   * any one click, so it is not a shared suspect either. */
  const shared = !!(ownSlot && ownSlot !== subject);
  return Object.assign({ at: div.index }, GD.classify(div), {
    showdown: div.sdRaw, medicham: div.meRaw,
    subject_slot: subject,
    segment_owner: ownSlot,
    segment_move: own.move || null,
    shared_suspect: shared,
    /* Kept true for every row on purpose. A consumer that filters on it must not start hiding rows
     * because this predicate could not be decided; `shared_suspect` is the field to group on. */
    attributed: true,
    attribution_note: !shared ? null
      : 'the divergent line falls inside ' + own.who + '\'s ' + (own.move || 'move') + ', not the'
        + ' subject\'s' + (moveId ? ' ' + moveId : '') + ' at ' + subject + '. This row may share ONE'
        + ' defect in that slot with every other row whose game contained it — it is NOT dismissed.',
  });
}

function verdictFor(log, who, moveId) {
  const segs = segments(log).filter(s => s.move === moveId && (!who || s.who === who));
  if (!segs.length) return { attempted: false, resolved: false, why: 'the move was never issued — Showdown emitted no |move| line for it' };
  /* A DELAYED EFFECT LANDS OUTSIDE ITS OWN SEGMENT, and the authority says so itself. Wish heals at the
   * end of the FOLLOWING turn and emits nothing at all on the turn it is used, so a segment read alone
   * calls it inert. Showdown attributes every deferred effect with `[from] move: <Name>` — one derived
   * rule, no list of delayed moves, and it is checked only when the segment itself was empty so it can
   * never launder a move that plainly failed. */
  const NAME = (dex.moves.get(moveId) || {}).name || moveId;
  const attributedLater = log.some(l => String(l).indexOf('[from] move: ' + NAME) >= 0
                                     || String(l).indexOf('[from]move: ' + NAME) >= 0);
  let best = null;
  for (const s of segs) {
    if (s.cant) { best = best || { attempted: true, resolved: false, why: 'cant: ' + s.cant }; continue; }
    /* HARD vs PER-TARGET, and the distinction cost three false negatives before it was written down.
     *   HARD      `-fail` and `|cant|` NAME THE USER. The click itself did nothing, whatever else is
     *             in the segment.
     *   PER-TARGET `-miss`, `-immune`, `-notarget` and a guard `-activate` name ONE BODY. A spread move
     *             whose partner-side target is behind a Protect still resolved against the other one,
     *             and reading `-activate|p2b|move: Protect` as a refusal marked Earthquake, Rock Slide
     *             and Dazzling Gleam unresolved when the authority's own log showed them connecting.
     * So a per-target refusal counts only when the segment produced NO consequence at all. */
    let hard = null, soft = null, consequence = 0;
    for (const raw of s.lines) {
      const p = String(raw).split('|');
      const ev = p[1];
      /* ---- A `-fail` ON ONE BODY OF A SPREAD MOVE IS PER-TARGET, AND THIS WAS A FALSE NEGATIVE ----
       * The block above says `-fail` NAMES THE USER, and for a single-target move it does. LIFE DEW
       * heals the user AND the ally, and Showdown's log for it reads:
       *     |move|p1a: Audino|Life Dew||[still]|[spread] p1a,p1b
       *     |-heal|p1a: Audino|1068/1068          <- it worked
       *     |-fail|p1b: Venusaur|heal             <- the ALLY was already full
       * The row was filed as `-fail heal` — the move plainly resolved and the instrument said it did
       * not. Same shape as the `-activate|p2b|move: Protect` false negative the block above already
       * records for spread attacks, arriving through the one refusal that was still unconditional.
       * HARD when it names the USER or when the move reached one body; PER-TARGET otherwise, which
       * means it counts only if the segment produced no consequence at all. */
      if (ev === '-fail') {
        const namesUser = !p[2] || p[2] === s.who;
        if (namesUser || !s.spread) hard = hard || ('-fail' + (p[3] ? ' ' + p[3] : ''));
        else soft = soft || ('-fail on ' + p[2] + (p[3] ? ' ' + p[3] : '') + ' — one body of a spread move');
        continue;
      }
      if (REFUSAL.has(ev)) { soft = soft || (ev + (p[3] ? ' ' + p[3] : '')); continue; }
      if (ev === '-activate' && GUARDS.test(raw)) { soft = soft || 'blocked by a guard: ' + raw; continue; }
      if (NOT_A_CONSEQUENCE.has(ev)) continue;
      if (NONDASH_CONSEQUENCE.has(ev) || ev === 'move' || (ev && ev[0] === '-')) consequence++;
    }
    if (s.still && !consequence) soft = soft || 'the move was announced [still] and did nothing';
    if (!hard && !consequence && attributedLater) {
      return { attempted: true, resolved: true, why: null, consequences: 0,
               note: 'the effect landed OUTSIDE the move\'s own segment — Showdown attributed a later '
                   + 'line to it with [from] move: ' + NAME };
    }
    if (!hard && consequence) return { attempted: true, resolved: true, why: null, consequences: consequence };
    best = best || { attempted: true, resolved: false,
                     why: hard || soft || 'the move executed and produced no consequence line at all' };
  }
  return best;
}

/* ================= DID THE LEAF DO ANYTHING, OR WAS IT ONLY ANNOUNCED? ============================
 *
 * MEASURE, 2026-08-29. `verdictFor` above answers *did the CLICK produce a line*. It cannot answer
 * *did the STATE the click created ever run*, and for a whole family of moves those are different
 * questions with different answers. Protect's row has read RESOLVED on the bare rung since the arm was
 * written, on a turn where nothing attacked into it; so have Detect, Spiky Shield, King's Shield,
 * Baneful Bunker, Quick Guard, Wide Guard and Endure. The board comparator cannot rescue any of them
 * — every one is a declared `duration: 1` leaf, so `residualEvent` has ended it before the boundary
 * where the board is sampled, and `boardVerdict` marks them `uncomparable_leaves` for exactly that.
 *
 * ---- THE DERIVATION, AND WHAT IT LOOKED LIKE BEFORE IT WAS NARROWED ------------------------------
 *
 * Printed before it was wired, as docs/ENGINE.md requires. THE FIRST RULE — *any protocol event a
 * non-arrival handler emits* — matched 60 of the 500 legal moves and most of it was noise: `-end`,
 * `-sideend` and `-fieldend` off `onEnd`/`onSideEnd`/`onFieldEnd` are the leaf EXPIRING rather than
 * the leaf WORKING (Tailwind, Encore, Taunt, Torment, Trick Room), and a one-turn script can never see
 * one, so 41 of the 60 markers would have gone red for the fixture's length. Substitute and Shed Tail
 * contributed `-fail`/`-ohko` off their own already-have-one refusal path.
 *
 * THE NARROWED RULE has no semantics in it. An INTERCEPTION handler is one that can only run because
 * an incoming MOVE reached the leaf — the `onTryHit` / `onHit` / `onDamage` / `onTryPrimaryHit` family,
 * identifiable by NAME. Anything such a handler prints is an EFFECT MARKER, and a leaf that declares
 * one and whose log shows none was never attacked into. Over the 500 legal moves that matches 11:
 * the eight shields above, plus Substitute, Shed Tail and Psychic Terrain. Nothing else moves.
 *
 * ---- WHAT IT DELIBERATELY DOES NOT CATCH, STATED SO A ZERO IS READABLE ---------------------------
 *
 * A SILENT EFFECT HAS NO MARKER AND CANNOT HAVE ONE. Three of the eleven leaves the leaf-coverage
 * audit named are dropped by this rule and they are dropped correctly:
 *   Focus Punch  its cancel prints `|cant|` from `beforeMoveCallback` on the MOVE, not from a handler
 *                on the condition, so the marker is not on the leaf
 *   Beak Blast   its burn is `source.trySetStatus('brn')` — a state change with no `this.add` of its
 *                own in the handler
 *   Electrify    `onModifyType` prints nothing at all; it calls `this.debug`
 * For those three the question *did it fire* is a COUNTER question, not a protocol one — which is the
 * same argument `MEDSEEN.flinch`'s header already makes. They are counted here as
 * `declares_no_marker` rather than passed silently, because a leaf with no observable effect and a
 * leaf whose effect was never staged must not read alike.
 *
 * ---- THE ANCHOR, BECAUSE THE FIXTURE ITSELF CLICKS PROTECT ---------------------------------------
 *
 * The two ally pads click Protect every turn (`scriptFor`, and the comment there says why Endure was
 * withdrawn). So a search for a bare `-activate` anywhere in the log would credit EVERY move row with
 * a shield block that belonged to a pad. The marker line must therefore carry the leaf's own display
 * name AND land where the leaf is: the SUBJECT'S SLOT for a leaf on the user, the subject's SIDE for a
 * side condition, anywhere for a field one. */
const INTERCEPTION_HANDLER = /^on(Any|Foe|Ally|Source)?(TryHit|TryHitSide|TryPrimaryHit|Hit|DamagingHit|Damage|TryMove|Immunity|MoveAborted)/;
const ARRIVAL_HANDLER = /^on(Start|SideStart|SlotStart|FieldStart|Restart|SideRestart|FieldRestart)$/;
/* THE EVENT AND THE LABEL THE AUTHORITY PRINTS WITH IT. The label is the third argument of
 * `this.add`, and reading it rather than guessing the leaf's display name is a correction this
 * instrument earned the hard way — see `leafEffectSeen`. */
const addsEmittedBy = (fn) => {
  const out = [];
  if (typeof fn !== 'function') return out;
  const re = /this\.add\(\s*['"]([^'"]+)['"]\s*(?:,\s*([^,)]*?)\s*(?:,\s*['"]([^'"]+)['"])?)?\s*[,)]/g;
  let m;
  const s = String(fn);
  while ((m = re.exec(s))) out.push({ ev: m[1], label: m[3] || null });
  return out;
};
/* WHICH LEAF A MOVE WRITES, and where it lives. `move.condition` first because a move that carries its
 * own is the authority's own answer; the named-status fields are the fallback for a move that borrows
 * one (Detect writes `protect`, Shed Tail writes `substitute`). */
function leafOfMove(mv) {
  if (!mv || !mv.exists) return null;
  if (mv.condition && Object.keys(mv.condition).some(k => /^on/.test(k)))
    return { cond: mv.condition, id: mv.id, display: mv.name, scope: 'slot', where: 'move.condition' };
  for (const [k, scope] of [['volatileStatus', 'slot'], ['sideCondition', 'side'],
                            ['slotCondition', 'side'], ['pseudoWeather', 'field']]) {
    if (!mv[k]) continue;
    const c = dex.conditions.getByID(mv[k]);
    if (c && Object.keys(c).some(x => /^on/.test(x)))
      return { cond: c, id: mv[k], display: c.name || mv.name, scope, where: k + ':' + mv[k] };
  }
  return null;
}
const LEAF_MARKER_CACHE = new Map();
function leafEffectMarkers(moveId) {
  if (LEAF_MARKER_CACHE.has(moveId)) return LEAF_MARKER_CACHE.get(moveId);
  const L = leafOfMove(dex.moves.get(moveId));
  let out = null;
  if (L) {
    const arrival = new Set(), eff = [], from = [];
    for (const [k, v] of Object.entries(L.cond)) {
      if (typeof v !== 'function' || !/^on/.test(k)) continue;
      const adds = addsEmittedBy(v);
      if (ARRIVAL_HANDLER.test(k)) { for (const a of adds) arrival.add(a.ev); continue; }
      if (!INTERCEPTION_HANDLER.test(k)) continue;
      if (adds.length) { for (const a of adds) eff.push(a); from.push(k); }
    }
    /* ---- ONLY A LABELLED MARKER COUNTS, AND THAT DROPS TWO ROWS ON PURPOSE ------------------------
     * Substitute's and Shed Tail's interception handler also prints a bare `-fail` and `-ohko` with no
     * literal beside them — those are the already-have-one and the OHKO-move refusal paths, not the
     * substitute absorbing a hit. Without a label there is nothing to anchor on and the check would be
     * a search for `-fail` anywhere on the subject's slot, which every blocked move in the fixture
     * would satisfy. An unanchored marker is worse than no marker: it turns green on the wrong line. */
    const seen = new Set();
    const markers = eff.filter(a => a.label && !arrival.has(a.ev)
                                 && !seen.has(a.ev + '|' + a.label) && seen.add(a.ev + '|' + a.label));
    if (markers.length) out = { leaf: L.id, display: L.display, scope: L.scope, where: L.where,
                                arrival: [...arrival], markers, from,
                                unlabelled: eff.filter(a => !a.label && !arrival.has(a.ev)).map(a => a.ev) };
  }
  LEAF_MARKER_CACHE.set(moveId, out);
  return out;
}
/* Did one of those markers actually appear, on the leaf, on the subject's own slot or side? Returns
 * the matching lines as well as the boolean — a bare `false` is not a finding and the line is.
 *
 * ---- THE ANCHOR IS THE AUTHORITY'S OWN LABEL, AND THE FIRST VERSION WAS THE MOVE'S NAME -----------
 *
 * MEASURED AND CORRECTED IN THE SAME PASS, 2026-08-29, and it is the standing rule here: suspect the
 * instrument before the engine. The first anchor asked for the LEAF'S DISPLAY NAME on the line, which
 * is what a reader would assume the authority prints. It does not. Showdown announces the WHOLE shield
 * family under the generic label:
 *
 *     |move|p1a: Toxapex|Baneful Bunker|p1a: Toxapex
 *     |-singleturn|p1a: Toxapex|move: Protect          <- not "move: Baneful Bunker"
 *     |move|p2a: Feraligatr|Aerial Ace|p1a: Toxapex
 *     |-activate|p1a: Toxapex|move: Protect            <- the block, also under Protect's name
 *     |-status|p2a: Feraligatr|psn                     <- the Bunker's own punish
 *
 * So Spiky Shield, King's Shield and Baneful Bunker were reported ANNOUNCEMENT-ONLY on a turn where
 * the block had plainly happened and the poison was on the board. THREE OF THE SEVEN REDS IN THE FIRST
 * RUN WERE THE RULER. The label is not guessed now: it is the literal third argument of the handler's
 * own `this.add`, read out of the authority's source in `leafEffectMarkers`, so a leaf that changes
 * how it announces itself is followed rather than missed.
 *
 * THE SLOT ANCHOR IS STILL NEEDED AND IS NOT REDUNDANT. Both ally pads click Protect every single turn
 * — `scriptFor` says why — so `-activate … move: Protect` appears in this fixture for reasons that
 * have nothing to do with the subject. Label AND slot, never one of them. */
function leafEffectSeen(log, spec, subjectSlot) {
  if (!spec) return { asked: false, seen: null, lines: [] };
  const slot = (String(subjectSlot || '').match(/^(p[12][abc])/) || [])[1] || 'p1a';
  const side = slot.slice(0, 2);
  const lines = [];
  for (const raw of (log || [])) {
    const p = String(raw).split('|');
    /* The label is its own `|`-delimited field, so it is compared as a FIELD and never with a
     * substring test — `move: Protect` must not be satisfied by `move: Protect Pad` or by a label
     * that merely contains it. */
    if (!spec.markers.some(m => m.ev === p[1] && p.indexOf(m.label) >= 2)) continue;
    if (spec.scope === 'slot' && String(p[2] || '').indexOf(slot) !== 0) continue;
    if (spec.scope === 'side' && String(p[2] || '').indexOf(side) !== 0) continue;
    lines.push(raw);
  }
  return { asked: true, seen: lines.length > 0, lines: lines.slice(0, 4) };
}

/* WHAT A BUILT BODY WILL ACTUALLY CLICK. `scripted()` looks the ask up in Showdown's own request and
 * answers `pass` when it is not there — and Showdown REFUSES a pass from a healthy active body, which
 * throws the whole game. So every click in every script is read back off the body that has to make it,
 * never assumed from the species. This is the single most common way a staged scenario silently stops
 * testing what it was written for. */
function clickOf(body, prefs) {
  const have = (body.moves || []).map(id);
  for (const p of (prefs || [])) if (have.includes(id(p))) return id(p);
  return have[0] || GAME_RULES.PAD_MOVE;
}

/* ================= THE SCENARIO ===================================================================
 *
 * ONE actor in p1a, the receiver in p2a, a pad beside each. The script is a list of turns; the actor
 * clicks the mechanic under test on the LAST one, so anything that happens afterwards (a faint, a
 * forced switch) is outside the window the verdict is read from.
 *
 * A SETUP TURN IS DERIVED FROM THE MECHANIC'S OWN TAGS, never from a list of move names — docs/TAGS.md,
 * and the reason is that a hand list is wrong the day a move is added. What each rule reads is named
 * beside it. */
/* AN ABILITY THAT MOVES THE BOARD BEFORE THE SCENARIO DOES. Derived from the ability's own tags, so
 * an ability added later is caught without editing this file. `switchInForme`, `transformsOnEntry` and
 * the two setters are the ones that have actually bitten: see the carrier block in `runMoves`. */
const AB_TAGS = a => ((TAGS.abilities && TAGS.abilities[a] && TAGS.abilities[a].tags) || []);
const DISRUPTIVE = ['weatherSetter', 'terrainSetter', 'privateWeather', 'switchInForme', 'formeChange',
                    'transformsOnEntry', 'onSwitchInDrop', 'clearsAllyBoostsOnEntry', 'auraBoost',
                    'auraBreak', 'weatherSuppression', 'neutralizinggas'];
const DISRUPTIVE_ABILITY = (a) => AB_TAGS(a).some(t => DISRUPTIVE.indexOf(t) >= 0)
  /* Illusion carries no tag of its own and it renames the body the verdict is read from, which is the
   * one failure mode a stream-reading verdict cannot survive. Named, and named LOUDLY, because it is
   * the single exception to "derive it from the tag". */
  || a === 'illusion';
const MOVE_TAGS = m => ((TAGS.moves && TAGS.moves[m] && TAGS.moves[m].tags) || []);
const MOVE_PARAMS = m => ((TAGS.moves && TAGS.moves[m] && TAGS.moves[m].params) || {});
/* The adversary and consequence tables live in their own module — see engine/faces.js. They are
 * required rather than defined here because THIS FILE RUNS ON REQUIRE: a probe that merely wanted to
 * read the table kicked off a whole sweep the first time I tried it. A table is data and must be
 * importable without starting an instrument.
 *
 * IT IS REQUIRED HERE, ABOVE `setupFor`, AND NOT BESIDE `runAbilities` WHERE IT USED TO BE. The move
 * arm is now a second caller of `thenWhatFor` and it is defined 700 lines earlier. */
const { FACES, facesFor, thenWhatFor } = require('./faces.js');
/* volatile -> a move that grants it TO THE USER, inverted out of `statusInflict` rather than listed.
 * Spit Up and Swallow declare `spendsVolatile {volatile:'stockpile', requires:true}`; this is how the
 * scenario finds Stockpile without anybody writing "Stockpile" down. */
const GRANTS_VOLATILE = new Map();
for (const [mid, row] of Object.entries(TAGS.moves || {})) {
  const eff = (row.params && row.params.statusInflict && row.params.statusInflict.effects) || [];
  for (const e of eff) if (e.volatile && e.to === 'user') {
    if (!GRANTS_VOLATILE.has(e.volatile)) GRANTS_VOLATILE.set(e.volatile, []);
    GRANTS_VOLATILE.get(e.volatile).push(mid);
  }
}
/* weather id -> a move that sets it, inverted out of `setsWeather`. Same rule, same reason. */
const SETS_WEATHER = new Map();
for (const [mid, row] of Object.entries(TAGS.moves || {})) {
  const w = row.params && row.params.setsWeather && row.params.setsWeather.weather;
  if (w && !SETS_WEATHER.has(w)) SETS_WEATHER.set(w, mid);
}
for (const [w, m] of SETS_WEATHER) {
  if (!WEATHER_OF_MOVE.has(m)) WEATHER_OF_MOVE.set(m, id(w));
  if (!SETS_WEATHER_ID.has(id(w))) SETS_WEATHER_ID.set(id(w), m);
}
const SETS_TERRAIN = new Map();
for (const [mid, row] of Object.entries(TAGS.moves || {})) {
  const t = row.params && row.params.setsTerrain && row.params.setsTerrain.terrain;
  if (t && !SETS_TERRAIN.has(t)) SETS_TERRAIN.set(t, mid);
}

/* ================= WHAT THE MOVE'S OWN ENTRY REQUIRES (2026-08-19) ================================
 *
 * TEN MOVE ROWS WERE FILED AS "THE AUTHORITY REFUSED IT" AND EVERY ONE OF THEM IS A FIXTURE BUG. Will
 * has taught this twice and `memory/construct-the-fixture-dont-find-it` records it: *a COULD-NOT-STAGE
 * verdict is a claim about the FIXTURE, never about the mechanic.* The scenario was built so the move
 * could not work, Showdown said so in its own words, and the words were recorded as the finding.
 *
 * `setupFor` already derives from `data/tags.json`. THIS READS THE AUTHORITY'S ENTRY DIRECTLY, and it
 * has to, for two reasons the rows themselves supplied:
 *
 *   THE TAG CAN BE THE WRONG WAY ROUND. `focuspunch` carries `needsTargetToAttack`, so the fixture
 *     dutifully made the receiver ATTACK — and Focus Punch is the one move in the format that FAILS
 *     when it is hit (`beforeMoveCallback` -> `add("cant")`). The harness was building the exact board
 *     the move cannot survive. The polarity is legible in the guard: Focus Punch cancels on a POSITIVE
 *     read of its own volatile (`volatiles["focuspunch"]?.lostFocus`), Shell Trap on a NEGATED one
 *     (`!pokemon.volatiles["shelltrap"]?.gotHit`). Same helper idea as `fixture_preflight.polarity`.
 *   THE TAG CAN BE SILENT. `soak` says `refuseIfExactType` and does not say WHICH type; the entry says
 *     `target.setType("Water")` — and this harness's receiver is a PURE WATER Feraligatr, so the one
 *     move that changes a type was clicked at the one body it cannot change.
 *
 * NOTHING HERE IS A MOVE NAME. Each field is a regex over the entry's own compiled source, and a move
 * added next regulation is picked up without editing this file. */
/* HANDLER NAME -> ITS SOURCE, kept as a MAP rather than one blob, because two of the tests below are
 * about WHICH handler a guard sits in — a `cant` in `beforeMoveCallback` refuses the click, the same
 * word in a residual does not — and splitting one concatenated string back apart is how a scan comes
 * to read the wrong function's body. */
function moveEntry(dm) {
  const out = {};
  for (const [k, v] of Object.entries(dm || {})) if (typeof v === 'function') out[k] = String(v);
  const cond = (dm && dm.condition) || {};
  for (const [k, v] of Object.entries(cond)) if (typeof v === 'function') out['cond.' + k] = String(v);
  return out;
}
function moveEntryNeeds(dm) {
  const H = moveEntry(dm);
  const src = Object.values(H).join(' ');
  const out = {};
  /* THE CANCEL GUARD. Only a handler that can refuse the click outright is read — `beforeMoveCallback`
   * and `onTryMove` — because those are the two the simulator consults before the move runs. */
  const cancel = (H.beforeMoveCallback || '') + ' ' + (H.onTryMove || '');
  /* AND THE GUARD MUST BE READING THE MOVE'S **OWN** MARK. The first print of this caught POLLEN PUFF
   * beside Focus Punch: its `onTryMove` cancels on `source.volatiles["healblock"]`, which is somebody
   * else's condition and says nothing about being attacked. Requiring the volatile id to be the MOVE
   * ID leaves exactly the two moves whose whole mechanism is a pre-turn mark — the narrowest test that
   * still keeps Shell Trap, and a move added later with the same shape is caught without a list. */
  const ownVolSrc = 'volatiles\\[\\s*["\\\']' + id((dm && dm.id) || 'zzz') + '["\\\']';
  const ownVol = new RegExp(ownVolSrc);
  if (/["\']cant["\']/.test(cancel) && ownVol.test(cancel)) {
    const neg = new RegExp('!\\s*\\w+\\.' + ownVolSrc).test(cancel);
    if (neg) out.receiverMustAttack = true;        /* Shell Trap: cancelled unless it was hit */
    else out.receiverMustNotAttack = true;         /* Focus Punch: cancelled BECAUSE it was hit */
  }
  const st = /setType\(\s*["']([A-Za-z]+)["']\s*\)/.exec(src);
  if (st && /getTypes\(\)\.join\(\)\s*===|-fail/.test(src)) out.setsType = st[1];
  /* THE TARGET MUST STILL BE ABOUT TO MOVE. `this.queue.willMove(target)` returns null once it has
   * acted, so the subject has to be FASTER — Quash's whole failure, and Upper Hand's too. */
  if (/queue\.willMove\(\s*target\s*\)/.test(src)) {
    out.actorMustMoveFirst = true;
    /* …AND WITH A PRIORITY ATTACK QUEUED, when the guard reads the queued move's own priority. */
    if (/move\.priority\s*<=?/.test(src) && /move\.category\s*===\s*["']Status["']/.test(src))
      out.receiverPriorityAttack = true;
  }
  /* AN ABILITY LIST READ **OFF THE ALLIES**, not off whatever body is in front. SMACKDOWN also names
   * two abilities (`levitate`, `eelevate`) and reads them on its TARGET — building the partner with
   * one of them would stage nothing and change a row that already works. `side.allies()` in the same
   * handler is the whole distinction, and it is Magnetic Flux's own first line. */
  for (const [hk, hv] of Object.entries(H)) {
    if (!/allies\(\)/.test(hv)) continue;
    const ab = /hasAbility\(\s*\[([^\]]*)\]\s*\)/.exec(hv);
    if (!ab) continue;
    const list = [...ab[1].matchAll(/["']([a-z]+)["']/g)].map(m => m[1]);
    if (list.length) { out.allyAbilities = list; out.allyAbilityHandler = hk; }
    break;
  }
  if (/moveSlot\.used|moveSlots\b[\s\S]{0,120}\.used/.test(src)) out.otherMovesUsed = true;
  if (/cureStatus|clearStatus/.test(src)) out.curesStatus = true;
  /* A GENDER GATE IS NOT REPAIRABLE HERE AND IS REPORTED AS SUCH — every body this harness builds is
   * `gender:'N'` because medicham2 has no gender at all. Read one hop down, exactly as
   * `fixture_preflight`'s gender clause does: Attract's own entry never mentions gender, the ATTRACT
   * CONDITION it applies does. */
  let reach = src;
  for (const m of src.matchAll(/(?:addVolatile|volatileStatus["']?\s*[:=]\s*)["']([a-z]+)["']/g)) {
    const c = dex.conditions.get(m[1]);
    if (c && c.exists) reach += ' ' + Object.entries(c).filter(([k, v]) => /^on/.test(k) && typeof v === 'function')
      .map(([, v]) => String(v)).join(' ');
  }
  if (dm && dm.volatileStatus) {
    const c = dex.conditions.get(dm.volatileStatus);
    if (c && c.exists) reach += ' ' + Object.entries(c).filter(([k, v]) => /^on/.test(k) && typeof v === 'function')
      .map(([, v]) => String(v)).join(' ');
  }
  if (/\.gender\b/.test(reach)) out.genderGated = true;
  return out;
}

/* PRINT WHAT IT MATCHED BEFORE WIRING IT — docs/ENGINE.md, and this file has paid for it twice
 * (`refusesStatusMoves` caught Telepathy and Wonder Guard; `speedOnItemLoss` caught Sticky Hold). Run
 * `--print-move-needs` and the whole match set over the 500 legal moves is on one screen, per field,
 * so an over-match is visible before a single game is played. */
if (has('--print-move-needs')) {
  const tally = {};
  for (const m of LEGAL_MOVES) {
    const n = moveEntryNeeds(dex.moves.get(m));
    for (const [k, v] of Object.entries(n))
      (tally[k] = tally[k] || []).push(m + (v === true ? '' : '=' + [].concat(v).join('|')));
  }
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1].length - a[1].length))
    console.log('  ' + String(v.length).padStart(4) + '  ' + k + '   ' + v.join(' '));
  return;
}

/* THE MOVE ARM'S HALF OF ROADMAP #158, COUNTED FOR THE SAME REASON THE ABILITY ARM'S IS: a capability
 * that cannot prove it ran is assumed broken. `verbsUnknown` is the LOUD column — a verb the shared
 * table names that this arm cannot execute must never stage nothing and look like a consequence that
 * did not help, which is exactly what `VOLATILE_THEN_WHAT` did in silence until 2026-08-29. */
const MOVE_THEN_WHAT_SEEN = { rows: 0, sameTurnAsked: 0, sameTurnStaged: 0, sameTurnDenied: 0,
                              unstageable: 0, verbsUnknown: 0,
                              verbsUnknownSeen: {}, shapeUnbuildable: {},
                              leafDeclaresMarker: 0, leafEffectSeen: 0, announcementOnly: 0,
                              leafEffectSplit: {}, leafDeclaresNoMarker: 0 };
/* WEAKEST TO STRONGEST. A shield that reads contact is also refusing an ordinary physical hit, so the
 * contact board satisfies both keys; `lethal` and `guardShape` are narrower still and satisfy nothing
 * else, so they sort last and win outright. Used only to make the merge deterministic. */
const SAME_TURN_RANK = [null, 'physical', 'contact', 'guardShape', 'lethal'];

/* The SETUP a move needs before it can resolve, derived. Each entry returns extra moves the actor (or
 * its ally) must carry and extra script turns to play first. */
function setupFor(moveId, pool) {
  const tags = MOVE_TAGS(moveId), pars = MOVE_PARAMS(moveId);
  const pre = [];            // [{ actor: <moveid> }] — one script turn each, clicked by p1a
  const extra = [];          // moves the actor must also carry
  let receiverAttacks = null;  // 'physical' | 'special' — what p2a clicks on the CLICK turn
  let selfDamage = false;      // the receiver hits p1a first, so a heal has something to heal
  /* A DECLARED PRECONDITION THIS CARRIER CANNOT SUPPLY. `pre` being empty is ambiguous — it means
   * both "nothing was needed" and "something was needed and no setter is in this pool" — and the
   * carrier loop below could only see the first reading. STEEL ROLLER needs a terrain and Aggron, the
   * alphabetically first carrier, can set none: `pre` came back empty, the carrier passed the "can it
   * hold the setup" test on a technicality, and Showdown answered `-fail` for a board that was never
   * built. Flagged so the carrier choice can prefer a body that CAN. */
  let needsSetter = false;

  /* A MOVE THAT SPENDS A VOLATILE CANNOT RESOLVE WITHOUT IT. `requires: true` is the artifact's own
   * word for the precondition; the granting move is found by inverting `statusInflict`. */
  const sv = pars.spendsVolatile;
  if (sv && sv.requires && GRANTS_VOLATILE.has(sv.volatile)) {
    const g = GRANTS_VOLATILE.get(sv.volatile).find(x => pool.has(x));
    if (g) { extra.push(g); pre.push({ actor: g }); }
  }
  /* A MOVE THAT FAILS WITHOUT ITS SKY. `failsWithoutWeather` names the weather; the setter is found by
   * inverting `setsWeather`. If the actor cannot learn the setter the row is still attempted and the
   * failure is reported with Showdown's reason, which is the honest outcome. */
  const fw = pars.failsWithoutWeather;
  if (fw && (fw.weather || fw.needsWeather)) {
    /* `failsWithoutWeather` DOES NOT ALWAYS NAME A WEATHER. Aurora Veil's params read
     * `{needsWeather: true}` with no `weather` field, so a rule that keys on the name alone staged
     * nothing at all — and the row passed anyway for a WORSE reason: the alphabetically first carrier
     * was Abomasnow, whose Snow Warning had already put snow up. Fixing the carrier's ability exposed
     * the missing setup, which is the honest order for those two to be found in. Unnamed means ANY:
     * the first weather setter the carrier can learn. */
    const g = fw.weather && SETS_WEATHER.has(fw.weather) ? SETS_WEATHER.get(fw.weather)
            : [...SETS_WEATHER.values()].find(x => pool.has(x));
    if (g && pool.has(g)) { extra.push(g); pre.push({ actor: g }); }
    else needsSetter = true;
  }
  /* `failsWithoutTerrain` DOES NOT ALWAYS NAME A TERRAIN EITHER, AND THAT COST A ROW. Steel Roller's
   * params read `{needsTerrain: true, clears: true}` with no `terrain` field — its own guard is
   * `onTry() { return !this.field.isTerrain(""); }`, i.e. ANY terrain — so a rule keyed on the name
   * staged nothing and Showdown answered `-fail`, which was filed as the move being refused. This is
   * the identical hole the weather branch four lines up already documents for Aurora Veil, in the
   * clause beside it; unnamed means ANY, and the setter is the first one the carrier can learn. */
  const ft = pars.failsWithoutTerrain;
  if (ft && (ft.terrain || ft.needsTerrain)) {
    const g = ft.terrain && SETS_TERRAIN.has(ft.terrain) ? SETS_TERRAIN.get(ft.terrain)
            : [...SETS_TERRAIN.values()].find(x => pool.has(x));
    if (g && pool.has(g)) { extra.push(g); pre.push({ actor: g }); }
    else needsSetter = true;
  }
  /* A MOVE THAT FAILS UNLESS THE TARGET IS ATTACKING. Sucker Punch, Counter, Mirror Coat, Metal Burst,
   * Comeuppance. `failsIfTargetNotAttacking` is the tag; the CATEGORY it must be hit by is the move's
   * own — a physical counter needs a physical hit. */
  /* `fixedDamage.retaliates` IS THE SAME PRECONDITION UNDER ANOTHER NAME, and Comeuppance carries only
   * that one — no `needsTargetToAttack` tag at all. Reading the params rather than the tag list catches
   * it, and `fixedDamage.category` says which half of the split it retaliates against (null = either). */
  const fd = pars.fixedDamage;
  if (tags.indexOf('failsIfTargetNotAttacking') >= 0 || tags.indexOf('needsTargetToAttack') >= 0
      || (fd && fd.retaliates)) {
    const cat = (fd && fd.category) ? (fd.category === 'special' ? 'Special' : 'Physical')
                                    : (dex.moves.get(moveId) || {}).category;
    receiverAttacks = cat === 'Special' ? 'special' : 'physical';
    /* Counter and Mirror Coat resolve only if the hit ALREADY LANDED this turn, so the actor must be
     * slower — it is, against an Agility-free receiver only by luck, so the receiver attacks on the
     * SAME turn and the pin resolves the order. Reported rather than assumed: if it does not resolve,
     * the reason line says so. */
  }
  /* A HEAL AT FULL HP FAILS. `healsSelf` / `healDescriptor` / `drain` all want a hole to fill; the
   * receiver punches one on a prior turn. */
  if (tags.indexOf('healsSelf') >= 0 || tags.indexOf('healDescriptor') >= 0) selfDamage = true;
  /* A HEAL THAT LANDS LATER NEEDS THE GAME TO STILL BE RUNNING WHEN IT DOES. `healDescriptor.when`
   * is the artifact's own word for it — Wish reads `endOfNextTurn` — and without a trailing turn the
   * script ends before the heal and the move looks inert. */
  const hd = pars.healDescriptor;
  const trailing = !!(hd && hd.when && hd.when !== 'immediate') ? 1 : 0;
  /* A CHARGE MOVE NEEDS TWO TURNS AND THE SECOND ONE IS THE RESOLUTION. `chargeTurn` is the tag; the
   * second turn's click is LOCKED by Showdown and carries no target field, which `scripted()` already
   * handles. */
  const charge = tags.indexOf('chargeTurn') >= 0 || tags.indexOf('semiInvulnerable') >= 0;
  const recharge = tags.indexOf('recharge') >= 0;
  /* ---- AND WHAT THE MOVE'S OWN ENTRY SAYS, WHICH IS NOT ALWAYS WHAT THE TAG SAYS ------------------
   * `moveEntryNeeds` is read AFTER the tag block and overrides it where the two disagree, because one
   * of them is a derived summary and the other is the authority's source. The measured disagreement is
   * FOCUS PUNCH: its tag is `needsTargetToAttack`, so the block above set `receiverAttacks` and the
   * fixture built the one board on which the move CANNOT resolve — it is cancelled by being hit. */
  const me = moveEntryNeeds(dex.moves.get(moveId));
  if (me.receiverMustNotAttack) receiverAttacks = null;
  if (me.receiverMustAttack && !receiverAttacks) receiverAttacks = 'physical';
  /* ---- AND WHAT MUST HAPPEN TO THE STATE THE MOVE CREATES (MEASURE, 2026-08-29) -------------------
   *
   * `thenWhatFor` is the SAME producer the ability ladder calls, and until today the move ladder did
   * not call it at all. That was not a small omission: all seven keys of `VOLATILE_THEN_WHAT` are
   * volatiles written by MOVES, so the table reached ZERO rows in the one arm that read it (measured
   * against data/tags.json — abilities 0, items 0, moves 7). An unwired knob gives identical output,
   * and this one gave it for as long as the table has existed.
   *
   * IT IS ADDITIVE. `su` fields are only written where the table names a verb this arm can execute,
   * so a row with no consequence key plays exactly the board it played before — measured at 42 of the
   * 500 move rows carrying any consequence at all, 10 of them carrying the same-turn verb below.
   * The verbs this arm CANNOT execute are counted rather than dropped: `attacksAfter` and its family
   * add turns AFTER the click, which is the ability gauntlet's shape and not this one's. */
  const tw = thenWhatFor(tags, pars);
  let sameTurn = null;
  if (tw) {
    MOVE_THEN_WHAT_SEEN.rows++;
    for (const s of (tw.stages || [])) {
      if (!s) { MOVE_THEN_WHAT_SEEN.unstageable++; continue; }
      for (const k of Object.keys(s)) {
        if (k !== 'attackedOnTheSameTurn') {
          MOVE_THEN_WHAT_SEEN.verbsUnknown++;
          MOVE_THEN_WHAT_SEEN.verbsUnknownSeen[k] = (MOVE_THEN_WHAT_SEEN.verbsUnknownSeen[k] || 0) + 1;
          continue;
        }
        /* THE STRONGEST SHAPE WINS, NOT THE FIRST ONE READ. Spiky Shield carries `punishesContact`
         * AND `shieldsUser`, so it asks for both `contact` and `physical`; taking whichever the tag
         * list happened to name first would make the fixture depend on the artifact's key order. */
        sameTurn = SAME_TURN_RANK.indexOf(s[k]) > SAME_TURN_RANK.indexOf(sameTurn) ? s[k] : sameTurn;
      }
    }
  }
  return { pre, extra, receiverAttacks, selfDamage, charge, recharge, trailing, needsSetter,
           attackedOnTheSameTurn: sameTurn,
           thenWhatWhy: tw ? tw.why : null, thenWhatAfter: tw ? tw.after : null,
           receiverIdle: !!me.receiverMustNotAttack,
           receiverPriority: !!me.receiverPriorityAttack,
           setsType: me.setsType || null,
           allyAbilities: me.allyAbilities || null,
           otherMovesUsed: !!me.otherMovesUsed,
           curesStatus: !!me.curesStatus,
           actorMustMoveFirst: !!me.actorMustMoveFirst,
           genderGated: !!me.genderGated };
}

/* ================= PLAYING ONE ROW ================================================================ */
let GAMES = 0, THREW = 0;

/* Build the two sheets and play. `spec` names the actor body, the receiver body, the script and the
 * move whose verdict is wanted. Returns the authority's verdict, medicham2's, and the divergence. */
/* THE FOUR BODIES ON THE FIELD, with distinct species so no sheet has a duplicate and no `switch`
 * ask is ambiguous. The two allies are pads and are chosen from the generated pool. */
/* `allyOverride` RE-CASTS THE PARTNER, and it exists because a mechanic can be gated on WHO stands
 * beside the subject rather than on what anybody clicks. Magnetic Flux boosts only allies that hold
 * Plus or Minus and returns false with none; the pads are chosen for being able to click Protect and
 * hold neither. It is the SAME body on every rung of a row, so nothing about a comparison changes. */
function stageBodies(actor, receiver, allyOverride) {
  const used = new Set([id(actor.species), id(receiver.species)]);
  const pads = [];
  if (allyOverride && !used.has(id(allyOverride.species))) { pads.push(allyOverride); used.add(id(allyOverride.species)); }
  for (const pid of PAD_POOL) {
    if (pads.length >= 2) break;
    if (used.has(pid)) continue;
    const b = bodyOf(pid, '', '', PAD_MOVES);
    if (b) { pads.push(b); used.add(pid); }
  }
  /* WHICH BODY A SWITCH ASK MAY NAME. `sheetOf` fills p1's sheet with [actor, ally] and then pads from
   * `PAD_POOL` skipping what is already there, so slot 3 is the first pad that is neither — and slot 3
   * is on the bench of the four that play. Derived by the same rule the sheet uses rather than
   * guessed, because a `sw` ask naming a body that is not there resolves to `pass` on both sides and
   * Showdown then throws the game. */
  const benchKey = PAD_POOL.find(p => p !== id(actor.species) && (!pads[0] || p !== id(pads[0].species)));
  return { actor, ally: pads[0], receiver, foeAlly: pads[1], benchKey };
}

function playScenario(spec) {
  /* A PLANNED FIXTURE BRINGS ITS OWN TWO SHEETS (2026-09-11), six bodies each, already validated by the
   * planner — and they are validated AGAIN here, AS WRITTEN (their own gender, spread and nature),
   * because `validate()` below rebuilds every set with gender 'N' and a zero spread and would judge a
   * different team from the one the game plays. */
  const aSheet = spec.teams ? spec.teams.p1 : sheetOf([spec.actor, spec.ally]);
  const bSheet = spec.teams ? spec.teams.p2 : sheetOf([spec.receiver, spec.foeAlly]);
  if (!aSheet || !bSheet) return { staged: false, why: 'a sheet could not be assembled' };
  const vA = spec.teams ? validateAsWritten(aSheet) : validate(aSheet);
  const vB = spec.teams ? validateAsWritten(bSheet) : validate(bSheet);
  if (!vA.ok || !vB.ok) return { staged: false, why: 'TeamValidator refused the team',
                                 validator: vA.errors.concat(vB.errors) };
  /* THE POOL IS A SCENARIO PARAMETER. x6 keeps everything alive so no forced switch can manufacture a
   * divergence; x1 is the REAL pool, which is the only board on which a FRACTIONAL threshold — Sitrus
   * at a half, Focus Sash from full, Blaze at a third, Berserk at a half — can actually be crossed.
   * Both are used, in that order, and the row records which one it took. */
  const hpx = spec.hpBoost || HP_BOOST;
  /* `declared` — a PLANNED sheet is played as the validator approved it: its own spread (the planner
   * judged its speed windows on it) and its own genders. Both seams are opt-in in the driver, so every
   * hand-built scenario above is byte-identical to before. */
  const seam = { hpBoost: hpx, max: 6, declaredSpread: !!spec.declared, declaredGender: !!spec.declared };
  const a6 = GD.buildPair(aSheet, seam);
  const b6 = GD.buildPair(bSheet, seam);
  if (!a6 || !b6) return { staged: false, why: 'buildPair could not build the validated sheet' };
  const a = a6.slice(0, 4), b = b6.slice(0, 4);
  let g;
  GAMES++;
  /* ---- THE BOARD, COLLECTED AT EVERY BOUNDARY THIS GAME TAKES (2026-08-19) ---------------------
   *
   * `--state` HAS BEEN FORCED ON SINCE THIS FILE WAS WRITTEN (see the block at the top), so the
   * driver has been taking a full `board_state.js` snapshot at every turn boundary of every gauntlet
   * game all along AND THROWING IT AWAY: `playScenario` returned only `sdLog`, `mediTrace` and `div`.
   * That is why thirty rows could sit in the artifact classed `event missing from medicham2` or
   * `ordering` with nobody able to say whether they moved a board — the answer was being computed and
   * discarded on every run.
   *
   * `onBoundary` IS THE DRIVER'S OWN HOOK and it is read-only. It is used rather than a second
   * build/init/choose harness here for the reason its own comment gives: a second copy is how two
   * files come to disagree about what a boundary is. Nothing about the game changes by observing it.
   *
   * THE RECEIPTS TRAVEL WITH THE BOARD AND ARE NOT OPTIONAL. `pp_comparable`,
   * `party_post_faint_skipped` and `screens_named_comparable` are the three places `board_state.js`
   * can be UNABLE to answer, and an unanswered leaf reads exactly like an agreeing one — the failure
   * docs/LESSONS.md §1 is about. They are carried per boundary so a verdict can never be quoted
   * without them.
   *
   * THE DIFFS ARE KEPT ONLY WHERE A BOARD PARTED, which is bounded: the driver stops the game at the
   * FIRST divergent board, so at most one boundary in a state-mode game carries any. */
  const boards = [];
  /* ---- THE STAT LINE, FOR A ROW THAT CHANGES ONE (2026-09-11) --------------------------------------
   *
   * `board_state.js` compares species, typing, ability and max HP, and NOT the five other stats — so a
   * mega evolution that landed on the wrong Attack is invisible to every board this file takes until a
   * damage roll happens to show it. A row whose MECHANISM is a new stat line (a mega stone, a mega
   * carrier) asks for it by naming the subject's stable key in `spec.statLine`; every other row is
   * untouched, so no existing verdict can move because this was added.
   *
   * READ OFF THE LIVE ENGINES THROUGH THE DRIVER'S OWN HOOK — `onBoundary(snap, turnIdx, S, battle)` —
   * and matched by `BS.stableKey`, the one door onto "which body is this" (a mega renames the body, so
   * the display name cannot be the key). medicham2 holds `st.{at,df,sa,sd,sp}`; the authority
   * `storedStats.{atk,def,spa,spd,spe}`, which `setSpecies` rewrites on a forme change
   * (sim/pokemon.ts:1393,1404). A body either side cannot find is COUNTED, never compared as equal. */
  const STAT_PAIRS = [['at', 'atk'], ['df', 'def'], ['sa', 'spa'], ['sd', 'spd'], ['sp', 'spe']];
  const statLine = spec.statLine ? { key: spec.statLine, compared: 0, unreadable: 0, parted: 0 } : null;
  const statDiffs = (S, battle) => {
    if (!statLine) return [];
    const k = statLine.key;
    const me = ((S && S.sfA && S.sfA.team) || []).find(m => m && BS.stableKey(m, id) === k);
    const sd = ((battle && battle.sides && battle.sides[0] && battle.sides[0].pokemon) || [])
      .find(p => p && BS.stableKey(p, id) === k);
    if (!me || !me.st || !sd || !sd.storedStats) { statLine.unreadable++; return []; }
    statLine.compared++;
    const out = [];
    for (const [mk, sk] of STAT_PAIRS) {
      if (me.st[mk] !== sd.storedStats[sk])
        out.push({ side: 'p1', body: k, field: 'stats.' + sk, sd: sd.storedStats[sk], us: me.st[mk], bucket: 'stat-line' });
    }
    if (out.length) statLine.parted++;
    return out;
  };
  const onBoundary = (snap, turnIdx, S, battle) => {
    /* A READ-ONLY LOOK AT BOTH LIVE ENGINES FOR A ROW THAT MUST MEASURE ITS OWN FIXTURE (the Struggle
     * row reads the dry slot's max PP off the authority rather than typing the PP-boost rule). */
    if (spec.onBattle) spec.onBattle(S, battle, turnIdx);
    const sl = statDiffs(S, battle);
    boards.push({ turn: turnIdx, identical: snap.identical && !sl.length, leaves_compared: snap.leaves_compared,
                  party_post_faint_skipped: snap.party_post_faint_skipped,
                  /* 2026-08-25 — the BENCH VOLATILE receipt. A benched body's volatiles became a
                   * compared leaf this pass, and a party row answers `null` while its body is
                   * STANDING (the active slot already compares it). This counts those skips, so
                   * "the bench was never asked" and "the bench agreed" stay different sentences —
                   * the same rule the three receipts above are here for. */
                  party_vol_on_field_skipped: snap.party_vol_on_field_skipped,
                  pp_comparable: snap.pp_comparable,
                  screens_named_comparable: snap.screens_named_comparable,
                  diffs: (snap.identical ? [] : snap.diffs.map(d => BS.locate(d, snap))).concat(sl) });
  };
  try { g = GD.playGame(a, b, 'all-mechanics-fire', spec.tag,
                        { script: spec.script, arm: spec.arm || ARM, onBoundary,
                          /* undefined on every real run; the board red demonstration is its only caller */
                          statePlant: spec.statePlant }); }
  catch (e) { THREW++; return { staged: false, why: 'the game threw: ' + String(e.message || e).slice(0, 120) }; }
  const sdLog = GD.lastSdLog();
  return { staged: true, sdLog, mediTrace: g.mediTrace, div: g.div, turns: g.turns, err: g.err,
           validator_ok: true, statLine,
           boards, boundaries: g.boundaries, boundariesAgreed: g.boundariesAgreed,
           stateDiv: g.stateDiv, divTurn: g.divTurn, endReason: g.endReason };
}

/* ---- WHAT A ROW'S BOARDS SAY, AS A VERDICT ------------------------------------------------------
 *
 * WILL'S STANDARD, 2026-08-18: *"it looks at the game. the commentary can be different but it needs
 * to lead to identical outcomes in all scenarios"*, and the method: *"play those games out that differ
 * from commentary, and see if it leads to identical board states."*
 *
 * FOUR VERDICTS, AND THE TWO THAT ARE NOT ANSWERS ARE NAMED RATHER THAN FOLDED INTO ONE OF THE TWO
 * THAT ARE. A row whose game never reached a boundary AFTER the line parted has not been asked the
 * question at all, and reporting it as ANNOUNCEMENT-ONLY would be exactly the silent default this
 * repository keeps paying for.
 *
 *   STATE             a board parted. The turn is recorded and the row STOPS THERE — the driver's own
 *                     stop rule — because past that point the two games have branched and every later
 *                     difference is a consequence of this one rather than a finding of its own.
 *   ANNOUNCEMENT-ONLY the protocol parted, at least one board was taken at or after the turn it parted
 *                     on, and every compared leaf of every board agreed.
 *   NOT-ASKED         no board was taken at or after the diverging turn (the game ended first, or
 *                     threw). NOT a pass.
 *   NO-DIVERGENCE     this row's streams did not part in this run, so there is nothing to explain.
 *
 * `boards_after_the_parting` IS THE LOAD-BEARING NUMBER. Boundary indices are turn numbers — index 0
 * is the leads, index t is the board after turn t — and `divTurn` is the turn the protocol parted on,
 * both assigned by the same driver. So the first board that could carry the consequence is index
 * `divTurn`, and a verdict rests on there being at least one. */
/* ---- WHICH LEAVES THIS ROW COULD WRITE THAT THE BOARD DOES NOT READ (2026-08-19) ----------------
 *
 * THE WALK MOVED TO `board_state.js` ON 2026-08-28 AND IS CALLED, NOT COPIED. It answers a question
 * about the COMPARATOR — which leaves does the board read — so it belongs beside `SD_VOLATILE_KEYS`
 * and `NOT_COMPARED`, and a second caller now asks it (`tests/probe_uncompared_leaves.js`, which
 * enumerates the WHOLE class rather than the rows one run happened to stage). The header that records
 * why the walk is shaped as it is moved with it. Only the DEX LOOKUP stays here, because only this
 * file holds a dex.
 *
 * THE RULE IT EXISTS FOR IS UNCHANGED: **a leaf you cannot compare reads as agreement.** */
function uncomparableLeaves(kind, key) {
  const e = kind === 'move' ? dex.moves.get(key) : (kind === 'ability' ? dex.abilities.get(key) : dex.items.get(key));
  return BS.uncomparableLeavesOf(e);
}

function boardVerdict(r, kind, key) {
  if (!r || !r.staged) return { verdict: 'NOT-STAGED', boundaries: 0,
                                uncomparable_leaves: kind ? uncomparableLeaves(kind, key) : [] };
  const boards = r.boards || [];
  const last = boards.length ? boards[boards.length - 1].turn : null;
  const dt = r.divTurn;
  const after = dt == null ? null : boards.filter(b => b.turn >= dt).length;
  const parted = boards.find(b => !b.identical) || null;
  /* THE RECEIPTS, POOLED OVER THE BOUNDARIES THIS ROW ACTUALLY TOOK. A leaf held on ANY boundary
   * qualifies the whole row's verdict, so these are maxima and minima rather than averages. */
  const receipts = {
    leaves_compared_min: boards.length ? Math.min(...boards.map(b => b.leaves_compared)) : 0,
    leaves_compared_max: boards.length ? Math.max(...boards.map(b => b.leaves_compared)) : 0,
    party_post_faint_skipped: boards.reduce((s, b) => s + (b.party_post_faint_skipped || 0), 0),
    /* A ZERO HERE IS A FAULT AND NOT A CLEAN BILL: every boundary has four standing bodies, so this
     * counts roughly 4 per boundary whatever the game did. Zero means the bench leaf is unwired. */
    party_vol_on_field_skipped: boards.reduce((s, b) => s + (b.party_vol_on_field_skipped || 0), 0),
    pp_slots_occupied: boards.reduce((s, b) => s + ((b.pp_comparable || {}).slots_occupied || 0), 0),
    pp_slots_compared: boards.reduce((s, b) => s + ((b.pp_comparable || {}).slots_compared || 0), 0),
    screens_named_comparable: boards.every(b => b.screens_named_comparable),
  };
  /* THE BOARD IS ASKED FIRST AND THE PROTOCOL SECOND, AND THE ORDER IS NOT COSMETIC. A board can part
   * with the two streams in perfect agreement — that is a SILENT state defect and the most dangerous
   * thing this instrument can find — and an earlier draft of this function tested `divTurn == null`
   * first and reported exactly that case as NO-DIVERGENCE. It was caught by the board red plants,
   * which are precisely a state difference with no line difference. */
  let verdict;
  if (parted) verdict = 'STATE';
  else if (dt == null) verdict = 'NO-DIVERGENCE';
  else if (after > 0) verdict = 'ANNOUNCEMENT-ONLY';
  else verdict = 'NOT-ASKED';
  const uncomparable = kind ? uncomparableLeaves(kind, key) : [];
  return { verdict, state_parted_without_a_line: !!parted && dt == null,
           uncomparable_leaves: uncomparable,
           /* THE QUALIFIER ON AN ANNOUNCEMENT-ONLY VERDICT, AND IT IS SET RATHER THAN LEFT TO A
            * READER. "The boards agreed" plus "the leaf this mechanic writes is not in the board" is
            * not a clean row; it is an UNASKED question wearing a clean row's clothes. */
           core_leaf_unchecked: verdict === 'ANNOUNCEMENT-ONLY' && uncomparable.length > 0,
           boundaries: boards.length, boundaries_agreed: boards.filter(b => b.identical).length,
           last_boundary_turn: last, protocol_parted_on_turn: dt,
           boards_after_the_parting: after,
           state_parted_on_turn: parted ? parted.turn : null,
           diffs: parted ? parted.diffs : [],
           end_reason: r.endReason || null,
           receipts };
}

/* The script: `pre` turns then the click turn. EVERY SLOT GETS A STEP EVERY TURN, because Showdown
 * refuses `pass` for a healthy active body and a rejected choice throws the whole game away. Every one
 * of those steps is read back off the BUILT body via `clickOf`, so a script can never ask for a move
 * the body does not hold. */
function scriptFor(su, clickMove, bodies) {
  const { actor, ally, receiver, foeAlly } = bodies;
  /* THE TWO ALLIES CLICK PROTECT, AND THE ALTERNATIVE WAS TRIED FIRST AND WITHDRAWN — which is worth
   * recording, because withdrawing it is what turned it into a finding.
   *
   * Protect is a GUARD, so a spread move that reaches the ally slot writes `-activate|p1b|move: Protect`
   * into the very segment the verdict is read from. The obvious answer is Endure: priority +4, blocks
   * nothing, changes no damage figure, learnable by 263 of the 264 species this format admits. IT WAS
   * INSTALLED AND IT PARTED EVERY SINGLE GAME AT LINE 6:
   *
   *     showdown  |-singleturn|p2b: Charizard|move: Endure
   *     medicham  |-start|p2b: Charizard|move: endure
   *
   * That is a real medicham2 defect (Showdown's Endure condition is `onStart -> add('-singleturn', ...)`)
   * and it is REPORTED rather than worked around — but with it in every ally slot the comparison stops
   * at line 6 of every game and can see nothing else. The fixture goes back to Protect, and the
   * spread-move problem it causes is solved where it belongs instead: a guard refuses a move only when
   * the segment produced NO consequence at all (see `verdictFor`). */
  const allyClick = clickOf(ally, ['Protect', 'Endure']);
  const foeAllyClick = clickOf(foeAlly, ['Protect', 'Endure']);
  const inert = clickOf(receiver, ['Agility', 'Iron Defense', 'Endure', 'Rest', 'Protect']);
  /* THE HIT MUST ACTUALLY LAND ON THE ACTOR. A move the actor is IMMUNE to is not a hit, and a
   * scenario built on "the target attacked me" then measures nothing. The authority's own type chart
   * decides, per body. */
  const canReach = (mvid) => { const d = dex.moves.get(mvid); const sp = dex.species.get(id(actor.species));
    return !d || !sp ? true : dex.getImmunity(d.type, sp.types); };
  const pickHit = (prefs) => { const have = (receiver.moves || []).map(id);
    for (const pfx of prefs) { const k = id(pfx); if (have.includes(k) && canReach(k)) return k; }
    for (const k of have) { const d = dex.moves.get(k); if (d && d.category !== 'Status' && canReach(k)) return k; }
    return clickOf(receiver, prefs); };
  const phys = pickHit(['Facade', 'Aqua Tail', 'Body Slam']);
  const spec = pickHit(['Hydro Pump', 'Round']);
  const actorHit = clickOf(actor, ['Facade', 'Body Slam', 'Round', 'Endure']);
  const allyHit = clickOf(foeAlly, ['Facade', 'Body Slam', 'Protect']);
  const turns = [];
  const T = (p1a, p2a, p1b, p2b) => turns.push({
    p1: [p1a, p1b || { m: allyClick }], p2: [p2a, p2b || { m: foeAllyClick }] });
  /* RUNG 2 — A WARM-UP TURN. Disable, Encore and Spite all FAIL against a body that has not used a
   * move yet, and on a bare board the actor may act first, so the target's last move does not exist
   * when the click lands. One turn in which both sides simply act gives every body a history. */
  if (su.warmup) T({ m: actorHit, t: 0 }, { m: inert });
  /* RUNG 3 — EVERYBODY HAS TAKEN DAMAGE. A heal aimed at a full-HP body fails, and which body needs
   * the hole depends on the move (self, ally, or an arbitrary target). Rather than deriving three
   * separate rules, one turn puts a hole in all four. */
  /* `hurtTurns` REPEATS IT. One hit on a x6 HP pool is a scratch; a THRESHOLD — a Sitrus Berry at a
   * half, which is the only board on which Belch and Recycle can resolve — needs the bar to actually
   * travel, and that takes the real pool AND repetition. Same argument `AB_RUNGS`' `real-pool` makes
   * for the ability arm, which the move ladder never had. */
  for (let k = 0; k < Math.max(su.everyoneHurt ? 1 : 0, su.hurtTurns || 0); k++)
    T({ m: actorHit, t: 0 }, { m: phys, t: 0 }, { m: clickOf(ally, ['Rest', 'Protect']) },
      { m: allyHit, t: 1 });
  /* A BODY ON THE ACTOR'S OWN SIDE CARRIES A STATUS. Heal Bell cures the whole party and FAILS when
   * nobody is statused — and no receiver in this fixture can inflict one (Feraligatr's legal pool has
   * no status move at all, which `PREFLIGHT.faces_status_noop` already counts one arm over). The ALLY
   * can do it to itself: it is a pad holding Rest, `everyoneHurt` has already put the hole in it that
   * Rest needs, and a sleeping partner is a status on the actor's side. */
  if (su.allyStatused) { const r = clickOf(ally, ['Rest']);
    if (r === 'rest') {
      /* THE HOLE IN THE ALLY IS PUNCHED BY THE RECEIVER, and the first build had the FOE'S PAD do it —
       * which never happened, because a pad is built from Protect/Endure/Rest and `clickOf` fell
       * through to Protect. Rest at full HP fails, so the partner never slept and Heal Bell still had
       * nothing to cure. The receiver is the only body on the far side that can actually attack. */
      /* AND THE PARTNER MAY NOT PROTECT ON THAT TURN — the default ally click is Protect and it blocked
       * the very hit meant to make the hole. It clicks REST both turns instead: at full HP that fails
       * harmlessly and leaves it hittable, and once the hit has landed the same click puts it to
       * sleep. One move, two turns, no guard anywhere near the staging. */
      T({ m: actorHit, t: 0 }, { m: phys, t: 1 }, { m: r });
      T({ m: actorHit, t: 0 }, { m: inert }, { m: r });
    } }
  /* EVERY OTHER MOVE THE ACTOR KNOWS HAS BEEN USED. Last Resort's `onTry` walks its own `moveSlots`
   * and refuses while any of them is unused; nothing else in this fixture makes that true. The turns
   * are the actor's OWN moves, read off the built body, so the rung cannot ask for a move it lacks. */
  if (su.otherMovesFirst) for (const m of ((actor || {}).moves || []).map(id))
    if (m !== id(clickMove)) T({ m, t: 0 }, { m: inert });
  for (const p of su.pre) T({ m: p.actor, t: 0 }, { m: inert });
  /* A HEAL AT FULL HP FAILS, so the receiver punches the hole one turn early. THE ACTOR SPENDS THAT
   * TURN ATTACKING, not on a filler, and that is the third fixture choice this file has had to make
   * for the same reason: Protect would block the very hit that makes the hole, Rest would heal the
   * hole shut and put the actor to sleep, and Endure parts the two streams at line 6. An ordinary
   * attack does none of the three. */
  if (su.selfDamage) T({ m: actorHit, t: 0 }, { m: phys, t: 0 });
  /* RUNG 5 — THE ACTOR IS ASLEEP. Sleep Talk and Snore are the only two moves in the format that
   * REQUIRE their user to be asleep, and there is no legal way to reach that state on a bare board
   * with a receiver that carries no sleep move. Rest does it to the actor itself, and Rest needs a
   * hole first — which `everyoneHurt` has already made. A body that cannot learn Rest SKIPS the turn
   * rather than clicking whatever came back instead: `clickOf` falls back to slot 1, which is the
   * move under test, and spending it on a setup turn would measure the wrong turn. */
  if (su.asleep) { const rest = clickOf(actor, ['Rest']); if (rest === 'rest') T({ m: rest }, { m: inert }); }
  /* UPPER HAND'S GUARD READS THE MOVE THE TARGET HAS QUEUED — `move.priority <= 0.1 ||
   * move.category === "Status"` — so the receiver has to be about to throw a PRIORITY ATTACK, and the
   * bare fixture's Agility satisfies neither half. Picked out of the receiver's own built moves, so a
   * body that cannot supply one degrades to the ordinary click and the row reports why. */
  const prio = ((receiver || {}).moves || []).map(id)
    .find(m => { const d = dex.moves.get(m); return d && d.exists && (d.priority || 0) > 0 && d.category !== 'Status'; });
  /* ---- THE HIT THAT GOES INTO A ONE-TURN SHIELD, ON THE TURN THE SHIELD GOES UP -------------------
   *
   * MEASURE, 2026-08-29. Every other consequence in `engine/faces.js` is a LATER turn; a `duration: 1`
   * leaf has none. `residualEvent` ends Protect, Endure, Quick Guard and their family before the next
   * turn starts, so a shield that is not attacked into on its own click turn is never attacked into at
   * all — and the row still reads RESOLVED, because `-singleturn` is a consequence and rightly so (see
   * the block at `NOT_A_CONSEQUENCE`).
   *
   * THE SHAPE IS DERIVED FROM THE LEAF'S OWN GUARD, NEVER FROM THE MOVE'S NAME. Quick Guard's
   * `onTryHit` opens `if (move.priority <= 0.1) return` and Wide Guard's tests `move.target`; those
   * two source facts are what pick a priority attack or a spread attack, and the target names come out
   * of the guard's own text rather than out of a set typed here. A shape the receiver cannot supply is
   * COUNTED and the row keeps the board it had — a fixture that quietly substitutes the wrong hit is
   * worse than one that says it could not build the right one.
   *
   * `lethal` IS THE ONE SHAPE THIS FIXTURE CANNOT BUILD, and that is a property of the HP pool rather
   * than of the move: every body here is at x6 HP so nothing anybody clicks is lethal, which is the
   * whole reason nothing faints and no forced switch can manufacture a divergence. Endure therefore
   * stays uncovered and is counted as `shapeUnbuildable.lethal` instead of being given a survivable
   * hit and passing on it. */
  const recvIds = ((receiver || {}).moves || []).map(id);
  const attackable = (k) => { const d = dex.moves.get(k);
    return d && d.exists && d.category !== 'Status' && canReach(k) ? d : null; };
  const guardSrc = String((((dex.moves.get(clickMove) || {}).condition) || {}).onTryHit || '');
  const guardTargets = new Set([...guardSrc.matchAll(/move\??\.target\s*!==\s*["']([a-zA-Z]+)["']/g)].map(x => x[1]));
  const byShape = (want) => {
    if (want === 'contact')
      return recvIds.find(k => { const d = attackable(k); return d && d.flags && d.flags.contact; }) || null;
    if (want === 'guardShape') {
      if (/move\.priority/.test(guardSrc))
        return recvIds.find(k => { const d = attackable(k); return d && (d.priority || 0) > 0.1; }) || null;
      if (guardTargets.size)
        return recvIds.find(k => { const d = attackable(k); return d && guardTargets.has(d.target); }) || null;
      return null;
    }
    if (want === 'lethal') return null;
    return recvIds.find(k => attackable(k)) || null;
  };
  /* ---- THE ONE CASE WHERE THE CONSEQUENCE AND THE RESOLUTION CANNOT BOTH BE HAD -------------------
   *
   * FOCUS PUNCH. `moveEntryNeeds.receiverMustNotAttack` already exists and the block that set it says
   * why: the tag `needsTargetToAttack` had built *"the one board on which the move CANNOT resolve — it
   * is cancelled by being hit"*. Its leaf's whole function is that cancellation, so the board that
   * exercises the leaf is exactly the board on which the move is refused. Staging the hit anyway would
   * turn a correct RESOLVED row into `cant: Focus Punch` and read as an engine defect.
   *
   * So `receiverIdle` WINS and the conflict is recorded rather than resolved. It needs two rows on two
   * boards, which is a fixture this arm does not have; a claim that Focus Punch's cancel is covered
   * would be false either way, and this is the version that says so. Beak Blast is NOT in this case —
   * a contact hit burns the attacker and the blast still fires — and is staged normally. */
  const sameTurnDenied = !!(su.attackedOnTheSameTurn && su.receiverIdle);
  su.sameTurnDenied = sameTurnDenied ? su.attackedOnTheSameTurn : null;
  const sameTurnHit = su.attackedOnTheSameTurn && !sameTurnDenied ? byShape(su.attackedOnTheSameTurn) : null;
  /* Stashed on the caller's own per-rung copy of `su` rather than counted here, because `scriptFor`
   * runs once per RUNG and a counter incremented here would report one row several times. */
  su.sameTurnStagedAs = sameTurnHit ? { shape: su.attackedOnTheSameTurn, move: sameTurnHit } : null;
  su.sameTurnUnbuildable = su.attackedOnTheSameTurn && !sameTurnHit && !sameTurnDenied
                         ? su.attackedOnTheSameTurn : null;
  const foe = sameTurnHit ? sameTurnHit
            : su.receiverPriority && prio ? prio
            : su.receiverIdle ? inert
            : su.receiverAttacks === 'physical' ? phys : su.receiverAttacks === 'special' ? spec : inert;
  const click = { m: clickMove, t: 0 };
  T(click, { m: foe, t: 0 });
  /* A CHARGE MOVE SPENDS TURN ONE CHARGING; the RESOLUTION is on turn two, and Showdown LOCKS the
   * second click (no target field at all), which `scripted()` already handles. */
  if (su.charge) T(click, { m: foe, t: 0 });
  /* THE TAG-DERIVED TRAILING TURNS AND THE CALLER'S ARE THE SAME TURNS, so the larger of the two wins
   * rather than the two being added — otherwise a Wish row asked for one extra turn would silently get
   * two and be a different fixture from every other row in the same run. */
  for (let k = 0; k < Math.max(su.trailing || 0, TRAILING); k++) T({ m: actorHit, t: 0 }, { m: inert });
  return turns;
}

/* ================= MOVES ==========================================================================
 *
 * THE ESCALATION LADDER. Rung 0 is the tag-derived scenario. A move that does not resolve there is
 * retried on progressively richer boards, and the row records WHICH RUNG caught it — so "it resolved"
 * always comes with what it took.
 *
 * EVERY RUNG IS GENERIC. None of them names a move, a species or an item, which is the whole point:
 * the alternative is a hand-written precondition table, and docs/TAGS.md says why that rots. A rung
 * describes a SHAPE OF BOARD ("everyone has taken damage", "both sides hold something") and any move
 * that needs that shape finds it. The cost is that a rung can be reached for the wrong reason, which
 * is why the rung is recorded rather than hidden. */
const RUNGS = [
  { id: 'bare', what: 'the tag-derived scenario and nothing else' },
  { id: 'items', what: 'both sides hold a berry — reaches every move that reads, takes, flings or '
                     + 'eats an item, none of which can resolve on an empty-handed board',
    apply: (su) => { su.actorItem = 'Sitrus Berry'; su.receiverItem = 'Sitrus Berry'; } },
  { id: 'warm-up', what: 'one turn in which both sides simply act, so every body has a last move — '
                       + 'Disable, Encore and Spite all fail without one',
    apply: (su) => { su.warmup = true; } },
  { id: 'everyone-hurt', what: 'one turn in which all four bodies take damage — a heal aimed at a '
                             + 'full-HP body fails, whichever body the move aims at',
    apply: (su) => { su.everyoneHurt = true; su.warmup = true; } },
  { id: 'hurt+items', what: 'both at once — the berry is then EATEN, which is the only board on which '
                          + 'Belch and Recycle can resolve',
    apply: (su) => { su.everyoneHurt = true; su.actorItem = 'Sitrus Berry'; su.receiverItem = 'Sitrus Berry'; } },
  { id: 'asleep', what: 'the actor Rests itself to sleep first — Sleep Talk and Snore require it and '
                      + 'no receiver in this fixture carries a sleep move',
    apply: (su) => { su.everyoneHurt = true; su.asleep = true; } },
  /* ---- THE FOUR RUNGS THE REFUSED MOVE ROWS NEEDED (2026-08-19) ---------------------------------
   *
   * Each carries a `when`, so it is built ONLY for a row whose own entry asks for it — a rung that
   * ran for every move would add turns to 500 rows to serve one, and a longer game has more chances
   * to part for reasons that are not the row's. They are LAST, so a move that already resolves on an
   * earlier rung never reaches them and cannot regress into one. */
  { id: 'real-pool', what: 'the REAL HP pool and three damage turns — the only board on which a '
                         + 'held berry is actually EATEN, which is what Belch and Recycle read',
    /* x2 AND NOT x1, AND THE DIFFERENCE WAS MEASURED. At the true pool three crit turns KILLED the
     * actor before its own click turn and the row read "the move was never issued" — an instrument
     * limit wearing a finding's clothes, which is exactly what this rung set out to remove. x2 still
     * crosses the HALF that a Sitrus Berry reads and leaves the body standing to click afterwards. */
    apply: (su) => { su.everyoneHurt = true; su.hurtTurns = 3; su.hpBoost = 2;
                     su.actorItem = 'Sitrus Berry'; su.receiverItem = 'Sitrus Berry'; } },
  { id: 'ally-statused', when: (su) => su.curesStatus,
    what: 'the PARTNER Rests itself asleep — a status-curing move fails with nothing to cure, and '
        + 'no receiver in this fixture can inflict one',
    apply: (su) => { su.everyoneHurt = true; su.allyStatused = true; } },
  { id: 'moves-used', when: (su) => su.otherMovesUsed,
    what: 'the actor first clicks every OTHER move it knows — Last Resort refuses while any slot of '
        + 'its own is unused',
    apply: (su) => { su.otherMovesFirst = true; } },
  { id: 'fast-carrier', when: (su) => su.actorMustMoveFirst, fasterCarrier: true,
    what: 'the carrier is re-picked FASTER than the receiver — a move reading '
        + '`queue.willMove(target)` gets null once the target has already acted' },
];

function runMoves(list) {
  const rows = [];
  for (const mv of list) {
    const dm = dex.moves.get(mv);
    const carriers = CARRIERS.get(mv) || [];
    /* HB-5 (2026-09-11) — THE OUT-OF-PP FALLBACK IS NOT LEARNED, IT IS WHAT EVERY BODY IS LEFT WITH.
     * The authority hard-codes it: `Pokemon#getMoves` returns `{move: 'Struggle', id: 'struggle'}` when
     * no slot is usable (sim/pokemon.ts). So "nothing learns it" is not "no legal carrier" — see
     * `runStruggle`. */
    const sv = SCOPE.verdict('move', mv);
    if (!sv.inScope) {
      rows.push({ kind: 'move', id: mv, name: dm.name, resolved: false, attempted: false,
                  why: sv.code + ' — ' + sv.why, scope_code: sv.code, unreachable: true });
      continue;
    }
    if (sv.code === 'INJECTED') { rows.push(runStruggle(dm)); continue; }
    if (!carriers.length) {
      /* IN SCOPE AND NO BODY HERE: a staging gap of this file's species list, never a scope claim. */
      rows.push({ kind: 'move', id: mv, name: dm.name, resolved: false, attempted: false, staging_gap: true,
                  why: 'IN SCOPE (' + sv.code + ') and this harness\'s species list offers no carrier — a staging gap, not a claim about the format' });
      continue;
    }
    /* THE CARRIER IS THE FIRST LEGAL ONE THAT CAN ALSO CARRY THE SETUP. Deterministic, so a re-run
     * plays the same game; a carrier that cannot hold the precondition is skipped rather than played
     * into a failure this file already knows about. */
    let chosen = null, su = null;
    for (const c of carriers) {
      const pool = POOL.get(c);
      const s = setupFor(mv, pool);
      if (s.pre.length && !s.pre.every(p => pool.has(p.actor))) continue;
      /* AND IT MUST BE ABLE TO SUPPLY WHAT THE MOVE DECLARES IT NEEDS — see `needsSetter`. */
      if (s.needsSetter) continue;
      chosen = c; su = s; break;
    }
    if (!chosen) { chosen = carriers[0]; su = setupFor(mv, POOL.get(carriers[0])); }
    /* THE CARRIER'S OWN ABILITY MUST NOT SABOTAGE THE TEST, and two rows proved it does. Abomasnow is
     * the alphabetically first legal Snowscape carrier and it has SNOW WARNING, so snow is already up
     * when the click lands and Showdown answers `-fail` — a correct engine reported as an unresolved
     * move. Zoroark-Hisui is the first Bitter Malice carrier and it has ILLUSION, so the body standing
     * in p1a is not the one the verdict is looking for.
     *
     * The disqualifying set is READ OFF THE ABILITY TAGS, never listed here: an ability that sets
     * weather or terrain, changes forme on entry, or transforms is one that moves the board before the
     * scenario does. A carrier with no clean ability is used anyway and the ability is RECORDED, so a
     * reader can tell an engine result from a fixture artefact. */
    const cleanAb = (sid) => {
      const abs = Object.values(dex.species.get(sid).abilities || {});
      return abs.find(a => !DISRUPTIVE_ABILITY(id(a))) || null;
    };
    const better = carriers.find(c => cleanAb(c) && (!su.pre.length || su.pre.every(p => POOL.get(c).has(p.actor))));
    if (better && !cleanAb(chosen)) { chosen = better; su = setupFor(mv, POOL.get(better)); }
    const useAbility = cleanAb(chosen) || Object.values(dex.species.get(chosen).abilities)[0];
    /* WHAT ELSE THE ACTOR CARRIES: the move under test, whatever the tag-derived setup needs, and then
     * the two fixture clicks the ladder's richer rungs use — an ordinary attack and Rest. Four slots,
     * so the setup always wins the ties. */
    const wants = [mv].concat(su.extra, ['facade', 'rest', GAME_RULES.PAD_MOVE]);
    const actor = bodyOf(chosen, useAbility, '', wants);
    if (!actor || !actor.moves.some(x => id(x) === mv)) {
      rows.push({ kind: 'move', id: mv, name: dm.name, resolved: false, attempted: false,
                  carrier: chosen, why: 'the carrier body could not be built holding the move' });
      continue;
    }
    const who = 'p1a: ' + (dex.species.get(chosen).baseSpecies || dex.species.get(chosen).name);
    /* THE MOVE ROW'S PREFLIGHT, AND WHAT IT DELIBERATELY DOES NOT DECLARE. The CARRIER'S ABILITY is
     * not passed, and that was measured rather than assumed: with it, four move rows — followme,
     * meteormash, moonlight, teeterdance — came back REFUSED on the gender clause, because the first
     * legal carrier happens to hold Cute Charm. The row under test is the MOVE; refusing it for a
     * property of the body's unrelated ability is precisely the over-match docs/ENGINE.md warns about,
     * and it was visible only because the match was printed before it was wired.
     *
     * What is left is the legality half — the species can learn it, something in the format can, the
     * target is not immune by type or by status. Over 496 move rows that refuses ZERO, which is the
     * honest answer: this harness already builds its carriers out of the authority's own move pool, so
     * the preflight is a RECEIPT here rather than a filter. It is still run, and still counted, because
     * a clause that starts biting must be visible the day it does. */
    const preMove = preflight({ species: dex.species.get(chosen).name, move: dm.name,
                                target: dex.species.get(RECEIVER.species).name, teamSize: 4 });
    /* ---- WHO STANDS OPPOSITE, AND WHO STANDS BESIDE (2026-08-19) --------------------------------
     *
     * BOTH ARE PROPERTIES OF THE MOVE, AND BOTH WERE FIXED FOR ALL 500 ROWS. Two refused rows were
     * refused by the fixture's own casting:
     *
     *   SOAK sets the target's type to Water, and its `onHit` opens with
     *     `if (target.getTypes().join() === "Water" ...) { this.add("-fail", target); return null; }`
     *     — and the receiver this harness has always used is a PURE WATER Feraligatr. The one move in
     *     the format that rewrites a typing was clicked at the one body it cannot rewrite. The swap is
     *     made ONLY when the default receiver already IS that exact type, so `magicpowder` (Psychic,
     *     into a Water body) keeps the board it already resolves on.
     *   MAGNETIC FLUX boosts `side.allies().filter(ally => ally.hasAbility(["plus","minus"]))` and
     *     returns false with none — and the partner is a Protect pad chosen for being able to Protect.
     *     The ally is re-cast as a legal body that HAS the ability the handler reads.
     *
     * Both are derived from the move's own entry (`moveEntryNeeds`) and neither names a species. */
    let recvSp = id(RECEIVER.species), recvAb = RECEIVER.ability;
    if (su.setsType && ((dex.species.get(recvSp) || {}).types || []).join() === su.setsType) {
      const alt = ALT_RECEIVERS.concat(LEGAL_SPECIES.map(s => s.id))
        .find(x => ((dex.species.get(x) || {}).types || []).join() !== su.setsType && x !== id(chosen));
      if (alt) { recvSp = alt; recvAb = ''; }
    }
    /* A +PRIORITY ATTACK ON THE RECEIVER, when the move's guard reads the target's queued priority.
     * Added to the FRONT of the want list so `bodyOf` keeps it, and only for a row that asks. */
    /* ---- AND A HIT OF THE SHAPE THE LEAF'S OWN GUARD READS (MEASURE, 2026-08-29) -----------------
     *
     * `scriptFor` picks the same-turn hit off the receiver's BUILT moves, so a shape that is not in
     * the want list cannot be picked however well the pool supports it. Quick Guard needs a priority
     * attack and Wide Guard a spread one; the default four (Agility, Facade, Aqua Tail, Hydro Pump)
     * hold neither, so both guards would have been staged against the exact move each one is written
     * to ignore. The predicate comes out of the guard's OWN `onTryHit` source — `move.priority` or
     * the target names it tests — and never out of the move's name. Added to the FRONT so `bodyOf`
     * keeps it, and only for a row that asks. */
    const guardSrcW = String((((dex.moves.get(mv) || {}).condition) || {}).onTryHit || '');
    const guardTargetsW = new Set([...guardSrcW.matchAll(/move\??\.target\s*!==\s*["']([a-zA-Z]+)["']/g)].map(x => x[1]));
    const shapePred = su.attackedOnTheSameTurn === 'contact'
        ? (m) => m.category !== 'Status' && m.flags && m.flags.contact && hitsFoe(m)
      : su.attackedOnTheSameTurn === 'guardShape' && /move\.priority/.test(guardSrcW)
        ? (m) => (m.priority || 0) > 0.1 && m.category !== 'Status' && hitsFoe(m)
      : su.attackedOnTheSameTurn === 'guardShape' && guardTargetsW.size
        ? (m) => m.category !== 'Status' && guardTargetsW.has(m.target)
      : null;
    const shapeWants = shapePred
      ? [mvName(pickMove(POOL.get(recvSp) || new Set(), shapePred))].filter(Boolean) : [];
    const recvWants = shapeWants.concat(su.receiverPriority
      ? [mvName(pickMove(POOL.get(recvSp) || new Set(),
          (m) => (m.priority || 0) > 0 && m.category !== 'Status' && hitsFoe(m))) ].filter(Boolean)
      : []).concat(RECEIVER_MOVES);
    const allyBody = su.allyAbilities ? (() => {
      const sp = LEGAL_SPECIES.find(s => Object.values(s.abilities || {})
        .some(a => su.allyAbilities.includes(id(a))) && s.id !== id(chosen) && s.id !== recvSp);
      if (!sp) return null;
      const ab = Object.values(sp.abilities).find(a => su.allyAbilities.includes(id(a)));
      return bodyOf(sp.id, ab, '', PAD_MOVES);
    })() : null;
    /* WHAT THE LEAF THIS MOVE WRITES PRINTS WHEN IT ACTUALLY FIRES — derived once per row, off the
     * authority's own condition source. `null` for 489 of the 500 and the row then behaves exactly as
     * it did before. */
    const EFF = leafEffectMarkers(mv);
    if (su.attackedOnTheSameTurn) MOVE_THEN_WHAT_SEEN.sameTurnAsked++;
    let best = null;
    /* `scriptFor` stashes its same-turn decision on the PER-RUNG copy of `su`, not on `su` itself, so
     * it is lifted out here — a counter read off `su` after the loop would always be empty. */
    let sameTurnDenied = null, sameTurnUnbuildable = null;
    const attempts = [];
    for (const rung of RUNGS) {
      if (rung.when && !rung.when(su)) continue;
      const s = Object.assign({}, su, { pre: su.pre.slice() });
      if (rung.apply) rung.apply(s);
      /* THE FASTER CARRIER IS A RUNG, NOT A GLOBAL. Ten moves read `queue.willMove(target)` and eight
       * of them already resolve on the bare board; re-picking every one of their carriers to serve the
       * two that do not is exactly the swap-instead-of-add mistake the ability arm paid for twice. */
      let carrier = chosen, ab2 = useAbility;
      if (rung.fasterCarrier) {
        const theirs = (dex.species.get(recvSp) || {}).baseStats.spe;
        const faster = carriers.find(c => dex.species.get(c).baseStats.spe > theirs
          && cleanAb(c) && (!su.pre.length || su.pre.every(p => POOL.get(c).has(p.actor))));
        if (!faster) continue;
        carrier = faster; ab2 = cleanAb(faster) || Object.values(dex.species.get(faster).abilities)[0];
      }
      const actor2 = bodyOf(carrier, ab2, s.actorItem || '', wants);
      const receiver = bodyOf(recvSp, recvAb, s.receiverItem || RECEIVER.item, recvWants);
      if (!actor2 || !receiver) break;
      const bodies = stageBodies(actor2, receiver, allyBody);
      const script = scriptFor(s, mv, bodies);
      sameTurnDenied = sameTurnDenied || s.sameTurnDenied || null;
      sameTurnUnbuildable = sameTurnUnbuildable || s.sameTurnUnbuildable || null;
      const r = playScenario(Object.assign({ script, hpBoost: s.hpBoost,
                                             tag: 'move/' + mv + '/' + rung.id }, bodies));
      if (!r.staged) { best = best || { kind: 'move', id: mv, name: dm.name, carrier: chosen, resolved: false,
                                        attempted: false, rung: rung.id, why: r.why, validator: r.validator }; continue; }
      /* THE SUBJECT'S SLOT NAME FOLLOWS THE RUNG'S CARRIER, not the row's default one — the
       * `fast-carrier` rung stands a different body in p1a and a verdict read against the old name
       * would report "the move was never issued" on the one rung built to make it issue. */
      const who2 = 'p1a: ' + (dex.species.get(carrier).baseSpecies || dex.species.get(carrier).name);
      const sd = verdictFor(r.sdLog, who2, mv);
      const me = verdictFor(r.mediTrace, who2, mv);
      const row = { kind: 'move', id: mv, name: dm.name, carrier, rung: rung.id,
                    setup: s.pre.map(p => p.actor), turns: script.length,
                    attempted: sd.attempted, resolved: sd.resolved, why: sd.why,
                    medicham_attempted: me.attempted, medicham_resolved: me.resolved, medicham_why: me.why,
                    diverged: !!r.div, divergence: divOf(r.div, who2, r.sdLog, mv),
                    err: r.err,
                    /* THE BOARD ANSWER, BESIDE THE PROTOCOL ONE AND NEVER INSTEAD OF IT. Whether the
                     * streams parted and whether the BOARDS parted are two different findings and the
                     * artifact carries both, on the same game. */
                    board: boardVerdict(r, 'move', mv) };
      /* ---- AND THE SECOND QUESTION: DID THE LEAF THIS MOVE WRITES ACTUALLY DO ANYTHING -------------
       *
       * MEASURE, 2026-08-29. Read on BOTH streams, because a leaf that fires for the authority and not
       * for us is the finding this whole file exists for, and the two are separate booleans for the
       * same reason `resolved` and `medicham_resolved` are. `announcement_only` is the qualifier that
       * was missing: RESOLVED plus a declared effect marker that never appeared means the row was
       * credited for the leaf being ANNOUNCED. It is set from SHOWDOWN'S stream, so it is a statement
       * about what the fixture staged rather than about our engine. */
      if (EFF) {
        const sdE = leafEffectSeen(r.sdLog, EFF, who2);
        const meE = leafEffectSeen(r.mediTrace, EFF, who2);
        row.leaf_effect = {
          leaf: EFF.leaf, display: EFF.display, scope: EFF.scope, where: EFF.where,
          markers: EFF.markers, arrival: EFF.arrival, from: EFF.from,
          staged_as: s.sameTurnStagedAs || null,
          not_staged_because: s.sameTurnDenied
            ? 'the move\'s own entry declares the target MUST NOT attack — the board that exercises '
              + 'this leaf is the board on which the move is refused, and it needs two rows'
            : s.sameTurnUnbuildable
            ? 'no move on the receiver\'s built set has the shape this guard reads ('
              + s.sameTurnUnbuildable + ')'
            : su.attackedOnTheSameTurn ? null
            : 'the consequence table names no same-turn adversary for this leaf',
          showdown_seen: sdE.seen, showdown_lines: sdE.lines,
          medicham_seen: meE.seen, medicham_lines: meE.lines,
        };
        row.announcement_only = !!(sd.resolved && !sdE.seen);
        row.leaf_effect_split = sdE.seen !== meE.seen
          ? (sdE.seen ? 'SHOWDOWN-ONLY' : 'MEDICHAM-ONLY') : null;
      } else if (leafOfMove(dm)) {
        /* A LEAF WITH NO INTERCEPTION MARKER AT ALL. Focus Punch's cancel prints from the MOVE, Beak
         * Blast's burn and Electrify's retype print nothing of their own. A zero here is not a pass
         * and it is not a gap in the fixture — it is a mechanic no protocol comparison can settle, and
         * it belongs to a COUNTER. Recorded so the two cannot be read alike. */
        row.leaf_effect = { leaf: (leafOfMove(dm) || {}).id, declares_no_marker: true,
          why: 'the leaf\'s own handlers print nothing in response to an incoming move, so whether it '
             + 'fired is a counter question and not a protocol one' };
      }
      if (DUMPLOG) {
        console.log('  ---- ' + mv + ' [' + rung.id + ']  carrier ' + chosen + '  script ' + JSON.stringify(script));
        console.log('  SHOWDOWN:'); for (const l of r.sdLog) console.log('    ' + l);
        console.log('  MEDICHAM:'); for (const l of r.mediTrace) console.log('    ' + l);
      }
      /* THE FIRST RUNG THAT RESOLVES WINS AND THE LADDER STOPS. A row that never resolves keeps the
       * FIRST rung's reason, because the bare board's reason is the one that describes the move — the
       * richer boards' reasons describe the fixture.
       *
       * AND FOR A ROW WHOSE LEAF DECLARES AN EFFECT, RESOLVING IS NOT ENOUGH TO STOP (2026-08-29). A
       * shield resolves on the bare board by announcing itself; if the ladder stops there, the richer
       * boards that might have attacked into it are never played and the row is credited for the
       * announcement. So the stop condition is *resolved AND the declared effect was seen*. It changes
       * nothing for the 489 rows that declare no marker — measured, 11 of 500 do — and it can only
       * ever make a row play MORE boards, never fewer, so no row that resolves today can stop
       * resolving because of it. */
      attempts.push({ rung: rung.id, resolved: !!sd.resolved, why: sd.why || null,
                      leaf_effect_seen: row.leaf_effect && 'showdown_seen' in row.leaf_effect
                                      ? row.leaf_effect.showdown_seen : null });
      const effectSettled = !EFF || !!(row.leaf_effect && row.leaf_effect.showdown_seen);
      if (!best || (sd.resolved && !best.resolved)) best = row;
      if (sd.resolved && effectSettled) { best = row; break; }
    }
    /* WHAT EVERY RUNG SAID, NOT JUST THE FIRST. `best` deliberately keeps the BARE board's reason
     * because that is the one describing the move — but a reader trying to repair the fixture needs to
     * know what the richer boards said, and until now the artifact threw it away. A row that failed on
     * six different boards for six different reasons looked identical to one that failed once. */
    if (best) best.rung_attempts = attempts;
    /* THE CONSEQUENCE ARM'S RECEIPT, TAKEN OFF THE ROW THAT WAS KEPT. A capability that cannot prove
     * it ran is assumed broken, and this one ran for eleven years' worth of nothing before today. */
    const LE = best && best.leaf_effect;
    if (LE && LE.declares_no_marker) MOVE_THEN_WHAT_SEEN.leafDeclaresNoMarker++;
    else if (LE) {
      MOVE_THEN_WHAT_SEEN.leafDeclaresMarker++;
      if (LE.staged_as) MOVE_THEN_WHAT_SEEN.sameTurnStaged++;
      if (LE.showdown_seen) MOVE_THEN_WHAT_SEEN.leafEffectSeen++;
      if (best.announcement_only) MOVE_THEN_WHAT_SEEN.announcementOnly++;
      if (best.leaf_effect_split)
        (MOVE_THEN_WHAT_SEEN.leafEffectSplit[best.leaf_effect_split] =
          (MOVE_THEN_WHAT_SEEN.leafEffectSplit[best.leaf_effect_split] || 0) + 1);
    }
    if (sameTurnDenied) MOVE_THEN_WHAT_SEEN.sameTurnDenied++;
    if (sameTurnUnbuildable)
      MOVE_THEN_WHAT_SEEN.shapeUnbuildable[sameTurnUnbuildable] =
        (MOVE_THEN_WHAT_SEEN.shapeUnbuildable[sameTurnUnbuildable] || 0) + 1;
    /* ---- THE ONE REFUSED MOVE ROW THAT IS NOT A FIXTURE BUG, AND IT NOW SAYS SO ------------------
     *
     * ATTRACT reads `.gender` one hop down, in the ATTRACT CONDITION rather than in its own entry —
     * the exact shape `fixture_preflight`'s gender clause documents for Cute Charm. Every body this
     * harness builds is `gender: 'N'`, because `buildPair` writes it and says why: medicham2 has no
     * gender at all, so a declared one parts the two streams on line one. So the authority's `-immune`
     * is CORRECT and unrepairable here, and it belongs in the explained column beside the 9 item rows
     * rather than in the unexplained one.
     *
     * `PRE.check` READS ABILITIES AND ITEMS, NOT MOVES, so the clause is raised here from the same
     * derivation (`moveEntryNeeds.genderGated`) rather than by widening that function's `src` to
     * include every move handler — which would let its weather, status and trigger clauses loose on
     * 500 rows they were never printed against. MEASURED over the 500 legal moves: it matches ONE. */
    if (best) labelRow(best, preMove, !!best.resolved);
    if (best && !best.resolved && su.genderGated) {
      best.cannot_fire = true;
      best.cannot_fire_clause = 'gender';
      best.cannot_fire_blocking = true;
      best.cannot_fire_why = ['"' + dm.name + '" reads `.gender` (one hop down, in the volatile it '
        + 'applies) and every body this fixture builds is declared genderless — `buildPair` writes '
        + 'gender N on both sides because medicham2 has no gender at all. The authority is right to '
        + 'refuse it; this board cannot ask the question.'];
      best.verdict_refined = 'CANNOT-FIRE-IN-THIS-FIXTURE';
    }
    if (best) rows.push(best);
    if (VERBOSE && best) console.log('    ' + mv + '  ' + (best.resolved ? 'RESOLVED [' + best.rung + ']' : 'NOT: ' + best.why));
  }
  return rows;
}

/* ================= ABILITIES AND ITEMS — THE A/B ARM ============================================== */
/* THE SAME GAME TWICE, THE MECHANIC AND ITS CONTROL. See the header for why this is a differential
 * rather than a stream read: an ability that emits no protocol line still changes the game, and
 * "changed the game" is the only definition of FIRED that does not need a hand-written trigger list. */
function abControlFor(species, ability) {
  const abs = Object.values(dex.species.get(species).abilities || {});
  const other = abs.find(a => id(a) !== id(ability));
  return other || null;
}
/* THE GAUNTLET. Four turns that between them reach a large share of ability and item triggers WITHOUT
 * NAMING ANY OF THEM — which is the docs/TAGS.md rule: match on shape, never on a name, so a mechanic
 * added later is reached without editing this file.
 *
 *   the leads          an ENTRY — Intimidate, Drought, Download, Trace, Imposter, Air Balloon
 *   the actor attacks  a CONTACT PHYSICAL click — Tough Claws, Sheer Force, Life Orb, Rocky-Helmet-shaped
 *                      punishers on the far side, Poison Touch, contact-KO abilities
 *   it is hit, twice   once PHYSICAL and once SPECIAL — Weak Armor, Justified, Rattled, Static,
 *                      Rough Skin, resist berries, Focus Sash, Air Balloon popping, damage-reducers
 *   it switches out    a SWITCH-OUT trigger — Regenerator, Natural Cure, Zero to Hero, Emergency Exit
 *
 * Everything a tag names is reached by one of these or is reported DID-NOT-FIRE, and DID-NOT-FIRE is a
 * gap in THIS instrument rather than a pass. Every click is read off the built body by `clickOf`. */
const GAUNTLET_ACTOR_MOVES = ['Facade', 'Endure', 'Rest', 'Substitute'];

/* ---- THE MOVE THAT SUPPLIES A DERIVED NEED, CHOSEN OUT OF THE AUTHORITY'S OWN POOL ----------------
 *
 * `fixture_preflight.moveNeeds` says WHAT the handler is gated on and WHICH SIDE has to throw it. This
 * turns that into a legal click: the first move in the given body's real move pool that satisfies the
 * need, ranked so the choice does not break the fixture around it.
 *
 * THE EXCLUSIONS ARE ABOUT THE HARNESS, NOT ABOUT THE MECHANIC, and each one is a way a staged turn
 * stops being the turn that was staged. A self-destructing move kills the body the verdict is read
 * from; a `selfSwitch` or `forceSwitch` move rewrites who is standing there; a two-turn charge or a
 * recharge move eats the NEXT scripted turn, so every later turn in the script lands on the wrong
 * board. They are lifted when the need itself asks for one (a recoil need must be allowed a recoil
 * move), because refusing then would report "unsatisfiable" for a move that exists.
 *
 * DETERMINISTIC. The tiebreak is the move id, so a re-run stages the same game — the same requirement
 * `runMoves` states for its carrier choice, and the reason the A/B verdict can be compared across runs
 * at all (see the `|t:|` non-determinism plant in `red()`). */
function pickForNeed(need, pool, ctx) {
  const harnessBreaking = (m) => !!(m.selfdestruct || m.selfSwitch || m.forceSwitch || m.ohko
    || (m.flags || {}).charge || (m.flags || {}).recharge || m.isZ || m.isMax);
  const exempt = need.kind === 'recoil' || need.kind === 'multihit';
  const cands = [];
  for (const mid of pool) {
    const mv = dex.moves.get(mid);
    if (!mv || !mv.exists || mv.isNonstandard) continue;
    if (!exempt && harnessBreaking(mv)) continue;
    if (!PRE.satisfiesNeed(mid, need, ctx)) continue;
    cands.push(mv);
  }
  if (!cands.length) return null;
  /* A stat need is legitimately a Status move; everything else prefers an ATTACK, because an attack is
   * what carries a type, a flag, a secondary and a damage number the comparator can see. */
  const wantDamage = need.kind !== 'statDrop' && need.kind !== 'statRaise';
  const score = (m) => (wantDamage && m.category === 'Status' ? 1 : 0)
    + (need.kind === 'subaccuracy' ? 0 : (m.accuracy === true || +m.accuracy >= 100 ? 0 : 1))
    + (m.recoil && need.kind !== 'recoil' ? 1 : 0)
    /* A FLINCH ONLY LANDS IF THE FLINCHER MOVES FIRST — engine/faces.js states it for the move arm
     * (`MOVE_FACES.flinches: {movesFirst: true}`) and the ability arm never had the equivalent. This
     * fixture cannot reorder the bracket after the fact, so the PRIORITY move wins the rank and the
     * order is bought rather than hoped for. Same rule as `faces.movesLast`, from the other end. */
    + (need.kind === 'flinch' && (m.priority || 0) <= 0 ? 2 : 0)
    /* AND A `secondary` NEED PREFERS A SECONDARY THAT IS NOT A FLINCH, for the same reason from the
     * other side: a paralysis, a burn or a stat drop is on the board whoever moved first, a flinch is
     * only on it if the thrower was faster. Shield Dust's need is `secondary` and the pool's first
     * answer was Bite — a flinch — which made an order problem look like an engine gap. */
    + (need.kind === 'secondary' && [].concat(m.secondaries || [], m.secondary ? [m.secondary] : [])
        .every(s => !s || s.volatileStatus === 'flinch' || !!s.self) ? 2 : 0)
    /* A move the far body is IMMUNE to has not been thrown — `fixture_preflight` clause 5, one level
     * down. Ranked rather than refused, so a need with only immune answers still stages something and
     * the row reports what happened instead of nothing. */
    + (ctx.targetTypes && m.category !== 'Status' && !dex.getImmunity(m.type, ctx.targetTypes) ? 4 : 0)
    /* A FIXED-DAMAGE MOVE CANNOT SHOW A DAMAGE-PATH MULTIPLIER. Twisted Spoon's need is "a Psychic
     * move thrown by the holder" and the pool's first Psychic answer was MIRROR COAT — base power 0,
     * damage from a `damageCallback`, so `getDamage` returns before `onBasePower` modifies anything.
     * The trigger was staged, the row read DID-NOT-FIRE, and nothing on it said why. Ranked rather
     * than refused, so a need whose only answers are fixed-damage still stages something. */
    + (need.damagingOnly && !m.basePower ? 3 : 0);
  cands.sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
  return cands[0].id;
}

/* The adversary table is required ONCE, above `setupFor`, which is now a second caller — see the
 * block there. It used to be required here, beside its first caller. */

/* ROADMAP #158 -- `thenWhat`, AND IT IS COUNTED BECAUSE A CAPABILITY THAT CANNOT PROVE IT RAN IS
 * ASSUMED BROKEN. `THEN_WHAT_SEEN` counts the rows that were handed a CONSEQUENCE and the turns those
 * consequences actually added; a zero on either after a run over the abilities means the whole table
 * is unread and the rows are inert for the reason they were already inert for.
 *
 * `unstageable` is the honest third column: `announcesOnEntry` declares `stage: null` on purpose --
 * Anticipation, Forewarn and Frisk emit a MESSAGE and move no state, so no turn can make them visible
 * to a board comparator. That is a DECLARED gap, which is a different thing from a gap. */
const THEN_WHAT_SEEN = { rows: 0, turnsAdded: 0, unstageable: 0, verbsUnknown: 0, verbsUnknownFirst: '' };

function gauntletScript(bodies, beats, faces, thenWhat) {
  const { actor, ally, receiver, foeAlly } = bodies;
  const F_ = faces || {};
  /* THE CONSEQUENCE'S EXECUTABLE HALF. `thenWhatFor` returns prose for a human AND a `stage` verb per
   * key for a harness; the prose is what makes an inert row readable, the verbs are what make it stop
   * being inert. They are merged into ONE object here, so a subject carrying several consequence keys
   * gets all of their turns rather than the first one that matched. */
  const TW = {};
  if (thenWhat) {
    THEN_WHAT_SEEN.rows++;
    for (const s of (thenWhat.stages || [])) {
      if (!s) { THEN_WHAT_SEEN.unstageable++; continue; }
      for (const k of Object.keys(s)) {
        if (!KNOWN_STAGE_VERBS.has(k)) {
          /* LOUD. A verb the table names and this file cannot execute would otherwise stage nothing
           * and look exactly like a consequence that did not help. */
          THEN_WHAT_SEEN.verbsUnknown++;
          if (!THEN_WHAT_SEEN.verbsUnknownFirst) THEN_WHAT_SEEN.verbsUnknownFirst = k;
          continue;
        }
        if (TW[k] === undefined) TW[k] = s[k];
      }
    }
  }
  /* THE ADVERSARY'S CLICKS COME FIRST IN THE PREFERENCE LIST, NOT INSTEAD OF THE OLD ONES.
   * `clickOf` walks the list and takes the first move the body actually has, so a stated adversary is
   * used WHEN THE CARRIER CAN LEARN IT and the bare gauntlet is the fallback otherwise. That matters:
   * a receiver that cannot learn Earthquake must still produce a runnable game rather than throwing,
   * and the row then reports inert for a reason we can see instead of dying. */
  const want = F_.recv || [];
  const hit = clickOf(actor, [].concat(F_.actor || [], ['Facade', 'Body Slam', 'Round', 'Protect']));
  /* ---- THE DERIVED TRIGGER TURN. IT IS ADDED, NOT SUBSTITUTED, AND TWO EARLIER SHAPES PROVED WHY ----
   *
   * FIRST ATTEMPT — put the derived move at the front of the actor's click list. It DISPLACED the
   * gauntlet's ordinary attack and cost two rows that already worked:
   *
   *   HUSTLE        was FIRED off Facade — physical, so the Atk multiplier showed up as damage. Its
   *                 handler is `onSourceModifyAccuracy`, so the derivation handed it Air Slash: a
   *                 SPECIAL sub-100 move, on which Hustle does nothing at all. The new trigger was
   *                 staged and the old one thrown away in the same edit. FIRED -> DID-NOT-FIRE.
   *   LIGHTNING ROD `onAnyRedirectTarget` is an `either` need, so Discharge went on the ACTOR — the one
   *                 body whose Electric move its own redirect ignores.
   *
   * SECOND ATTEMPT — alternate: derived click on the first turn of a beat, bare attack on the second.
   * That recovered Hustle and lost TORRENT, which needs its Water click repeated while the HP bar
   * travels. Trading one row for another is not a fix, it is a different fixture.
   *
   * SO THE TURN IS ADDED. The two beat turns are byte-identical to what they were, and the derived
   * click is a THIRD turn in front of them — which is the only version in which no row can regress by
   * construction rather than by measurement. A need is a REQUIREMENT ADDED TO THE BOARD, never a swap. */
  const dA = ((F_.actorDerived || []).length) ? clickOf(actor, F_.actorDerived) : null;
  const dR = ((F_.recvDerived || []).length) ? clickOf(receiver, F_.recvDerived) : null;
  const A = { m: clickOf(ally, ['Protect', 'Endure']) };
  const F = { m: clickOf(foeAlly, ['Protect', 'Endure']) };
  /* ---- THE BEATING HAS TO ACTUALLY LAND, AND FOR SEVEN CARRIERS IT NEVER HAS (2026-08-19) --------
   *
   * `scriptFor` has had a `canReach` test since the move arm was written — *"A move the actor is
   * IMMUNE to is not a hit, and a scenario built on 'the target attacked me' then measures nothing"* —
   * and the ABILITY gauntlet, one function away, has never had one. Its `phys` is Facade, which is
   * NORMAL, and this format admits Ghost-type carriers: Chandelure, Banette, Trevenant, Sinistcha,
   * Golurk, Decidueye-Hisui and Basculegion all stood through the whole gauntlet reading `-immune`.
   * FLAME BODY's entire mechanism is `onDamagingHit` with a contact flag, and it has never once been
   * touched by anything on any board this repository has built — it sat in `did_not_fire_unexplained`,
   * which is the bucket that reads as an engine gap.
   *
   * The authority's own type chart decides, per body, exactly as it does in the move arm; a receiver
   * with no reaching move at all keeps its old click and the row reports what happened. */
  const canReach = (mvid) => { const d = dex.moves.get(mvid); const sp = dex.species.get(id(actor.species));
    return !d || !sp || d.category === 'Status' ? true : dex.getImmunity(d.type, sp.types); };
  const pickHit = (prefs) => { const have = ((receiver || {}).moves || []).map(id);
    for (const p of prefs) { const k = id(p); if (have.includes(k) && canReach(k)) return k; }
    for (const k of have) { const d = dex.moves.get(k); if (d && d.category !== 'Status' && canReach(k)) return k; }
    return clickOf(receiver, prefs); };
  const phys = pickHit([].concat(want, ['Facade', 'Aqua Tail']));
  const spec = pickHit([].concat(want, ['Hydro Pump', 'Round']));
  const inert = clickOf(receiver, ['Agility', 'Endure']);
  const turns = [];
  /* ---- SETUP TURNS THE TRIGGER NEEDS BEFORE THE BEATING STARTS -------------------------------------
   * Each is a PRECONDITION on the subject or the field rather than an adversary's attack, so it goes
   * ahead of the loop and is not repeated. A precondition that fails leaves the row inert for a
   * visible reason, which is strictly better than the silent identical board it produced before. */
  if (F_.setsWeather) {
    /* Cloud Nine suppresses weather and Mega Sol holds its own against another — with no weather up,
     * both suppress and hold nothing, and the two boards agree. */
    turns.push({ p1: [{ m: clickOf(actor, [F_.setsWeather, 'Sunny Day', 'Rain Dance']), t: 0 }, A],
                 p2: [{ m: inert }, F] });
  } else if (F_.setsWeatherByFoe) {
    /* THE SKY IS A FIELD CONDITION, SO IT DOES NOT MATTER WHO PUTS IT UP. Set by the preflight repair
     * when the subject's own carrier cannot learn a setter for the weather its ability reads but the
     * receiver can. The subject spends the turn on a filler, exactly as the receiver does in the arm
     * above, and both A/B arms get the identical turn. */
    turns.push({ p1: [{ m: clickOf(actor, ['Protect', 'Endure']) }, A],
                 p2: [{ m: clickOf(receiver, [F_.setsWeatherByFoe, 'Rain Dance']), t: 0 }, F] });
  }
  if (F_.statusFirst) {
    /* Quick Feet keys on the HOLDER being statused and Natural Cure on curing one at switch-out. The
     * gauntlet switches out with nothing to cure, so the cure is unobservable. */
    turns.push({ p1: [{ m: clickOf(actor, ['Rest', 'Protect']), t: 0 }, A],
                 p2: [{ m: clickOf(receiver, [F_.statusFirst, 'Thunder Wave']), t: 0 }, F] });
  }
  if (F_.movesLast) {
    /* Analytic multiplies ONLY when the holder moves last. The actor cannot be made slower mid-script,
     * so the adversary is given a +priority click and the actor an ordinary one — the bracket, not the
     * stat, decides the order. This is Will's constructed-pair rule: build the condition, do not wait
     * for a board where it happens to hold. */
    turns.push({ p1: [{ m: hit, t: 0 }, A],
                 p2: [{ m: clickOf(receiver, ['Aqua Jet', 'Quick Attack', 'Sucker Punch']), t: 0 }, F] });
  }
  /* HOW MANY TIMES THE ACTOR IS HIT. One physical and one special reaches an on-hit trigger; a
   * THRESHOLD trigger — Sitrus at a half, Focus Sash, Blaze, Berserk, Emergency Exit — needs the HP
   * bar to actually travel, which takes repetition and a real HP pool. */
  for (let k = 0; k < (beats || 1); k++) {
    /* THE TRIGGER TURN — see the block above. Only pushed when something was actually derived, so a row
     * with no handler-derived need plays exactly the board it played before. */
    if (dA || dR) turns.push({ p1: [{ m: dA || hit, t: 0 }, A], p2: [{ m: dR || phys, t: 0 }, F] });
    /* PIERCING DRILL AND UNSEEN FIST ARE ONLY OBSERVABLE AGAINST A PROTECT, and the gauntlet
     * deliberately never clicks one — `fillerFor`'s lesson was that a Protect blocks the very move
     * being staged. Here the Protect IS the thing being faced, so the actor's click is the subject
     * and the receiver's Protect is the adversary. */
    if (F_.recvProtects) {
      turns.push({ p1: [{ m: hit, t: 0 }, A], p2: [{ m: clickOf(receiver, ['Protect', 'Detect']) }, F] });
      continue;
    }
    turns.push({ p1: [{ m: hit, t: 0 }, A], p2: [{ m: phys, t: 0 }, F] });
    turns.push({ p1: [{ m: hit, t: 0 }, A], p2: [{ m: spec, t: 0 }, F] });
  }
  /* THE SWITCH IS THE LAST TURN AND IT IS AN ASK, not a hope: `{sw}` names the bench body by the
   * same `_switchKey` both engines stamp, so a switch-out trigger has an actual switch to fire on. */
  turns.push({ p1: [{ sw: id(bodies.benchKey) }, A], p2: [{ m: inert }, F] });
  /* ---- ROADMAP #158 -- THE CONSEQUENCE TURNS, AFTER THE GAUNTLET RATHER THAN INSIDE IT ------------
   *
   * A `faces` entry changes what happens ON the beating turns; a `thenWhat` entry adds turns AFTER
   * the state has been set, and that ordering is the whole distinction between the two tables. They
   * are appended here, past the switch, because the switch is itself one of the states a consequence
   * may need to read (Fairy Lock refuses the NEXT one) and because a consequence inserted earlier
   * would change the board every existing row is measured on.
   *
   * EVERY VERB IS EXECUTED THROUGH `clickOf`, so a body that cannot learn the named move degrades to
   * the bare click instead of throwing — the same rule the adversary table already follows. */
  const before = turns.length;
  if (TW.boostFirst) {
    /* Haze resets stat stages. On a board where nothing boosted it resets nothing, which is a fixture
     * measuring its own emptiness. The boost goes FIRST, so it is on the board when the click lands. */
    turns.unshift({ p1: [{ m: clickOf(actor, ['Swords Dance', 'Nasty Plot', 'Agility']), t: 0 }, A],
                    p2: [{ m: inert }, F] });
  }
  if (TW.screensFirst) {
    for (const sc of TW.screensFirst)
      turns.unshift({ p1: [{ m: clickOf(actor, [sc, 'Protect']) }, A], p2: [{ m: inert }, F] });
  }
  if (TW.warmup) turns.unshift({ p1: [{ m: hit, t: 0 }, A], p2: [{ m: phys, t: 0 }, F] });
  if (TW.foeClicksAfter)
    turns.push({ p1: [{ m: clickOf(actor, ['Protect', 'Endure']) }, A],
                 p2: [{ m: clickOf(receiver, [].concat(TW.foeClicksAfter, ['Aqua Tail'])), t: 0 }, F] });
  if (TW.subjectClicksAfter)
    turns.push({ p1: [{ m: clickOf(actor, [].concat(TW.subjectClicksAfter, ['Facade'])), t: 0 }, A],
                 p2: [{ m: inert }, F] });
  if (TW.attacksAfter === 'both' || TW.attacksAfter === 'subject')
    turns.push({ p1: [{ m: hit, t: 0 }, A],
                 p2: [{ m: TW.attacksAfter === 'both' ? phys : inert, t: 0 }, F] });
  if (TW.bothCategories)
    /* Wonder Room exchanges Defence and Sp. Def, so ONE category cannot tell a swap from a flat drop:
     * the two must move in OPPOSITE directions and both have to be thrown. */
    turns.push({ p1: [{ m: clickOf(actor, ['Round', 'Hydro Pump', 'Facade']), t: 0 }, A],
                 p2: [{ m: spec, t: 0 }, F] });
  if (TW.allyAttacksAfter)
    /* Helping Hand multiplies a move that has not been clicked yet — 5,014 uses, the most-clicked
     * move anywhere in this table, and a no-op on its own turn. */
    turns.push({ p1: [{ m: clickOf(actor, ['Protect', 'Endure']) },
                      { m: clickOf(ally, ['Facade', 'Body Slam', 'Round']), t: 0 }],
                 p2: [{ m: inert }, F] });
  if (TW.switchAfter)
    turns.push({ p1: [{ sw: id(bodies.benchKey) }, A], p2: [{ m: inert }, F] });
  for (let k = 0; k < (+TW.extraTurns || 0); k++)
    turns.push({ p1: [{ m: clickOf(actor, ['Protect', 'Endure']) }, A], p2: [{ m: inert }, F] });
  THEN_WHAT_SEEN.turnsAdded += turns.length - before;
  return turns;
}
/* THE VERBS THIS FILE CAN EXECUTE. Anything the table names that is not here is COUNTED rather than
 * ignored — see `THEN_WHAT_SEEN.verbsUnknown`. `itemsOnBoth` and `allyAbility` are deliberately in
 * the set and handled OUTSIDE this function, because they are properties of how a body was BUILT
 * rather than turns to play; `runAbilities` reads them off the same object when it builds the pair. */
const KNOWN_STAGE_VERBS = new Set(['boostFirst', 'screensFirst', 'warmup', 'foeClicksAfter',
  'subjectClicksAfter', 'attacksAfter', 'bothCategories', 'allyAttacksAfter', 'switchAfter',
  'extraTurns', 'itemsOnBoth', 'allyAbility', 'asleep', 'countsPP', 'koTheHolder', 'alliesFaint']);
/* THE TWO RUNGS EVERY ABILITY AND ITEM ROW IS TRIED ON. Rung 1 is the safe board — nothing faints, so
 * no forced switch can manufacture a divergence. Rung 2 is the REAL pool and a longer beating, which
 * is the only board a fractional threshold can be crossed on; it can end in a faint, and that is the
 * price of reaching Sitrus, Focus Sash and Blaze at all. */
const AB_RUNGS = [
  { id: 'safe-pool', hpBoost: HP_BOOST, beats: 1 },
  { id: 'real-pool', hpBoost: 1, beats: 3 },
];
/* `extra` IS APPENDED, NEVER SUBSTITUTED — a row that fires on `safe-pool` or `real-pool` stops before
 * it is reached, so nothing already working can regress into it. Each extra rung carries its own
 * bodies AND its own script, because a board-state rung may need a different holder and a different
 * body opposite it (an OHKO thrower, a Spite thrower) than the two standard rungs do. */
function abLadder(kind, key, name, carrier, control, mkOn, mkOff, receiver, faces, thenWhat, extra, onRung) {
  return abLadderOver(AB_RUNGS.concat(extra || []), kind, key, name, carrier, control, mkOn, mkOff,
                      receiver, faces, thenWhat, onRung);
}
/* THE SAME LADDER OVER A CALLER'S OWN RUNGS (2026-09-11). `abLadder` above is exactly this over
 * `AB_RUNGS` plus the extras, byte-for-byte the loop it always ran; a stone row supplies rungs whose
 * script asks for the mega, because the two standard rungs never ask and a stone that is never
 * evolved is a rock. `rung.statLine` names the body whose stat line the board must also compare. */
function abLadderOver(rungList, kind, key, name, carrier, control, mkOn, mkOff, receiver, faces, thenWhat, onRung) {
  let best = null;
  for (const rung of rungList) {
    const rOn = rung.mkOn || mkOn, rOff = rung.mkOff || mkOff, rRecv = rung.receiver || receiver;
    const bOn = rOn(), bOff = rOff();
    if (!bOn || !bOff || !rRecv) continue;
    const onB = stageBodies(bOn, rRecv), offB = stageBodies(bOff, rRecv);
    const mk = (b) => rung.script ? rung.script(b) : gauntletScript(b, rung.beats, faces, thenWhat);
    const on = playScenario(Object.assign({ script: mk(onB), hpBoost: rung.hpBoost, statLine: rung.statLine,
                                            tag: kind + '/' + key + '/on/' + rung.id }, onB));
    const off = playScenario(Object.assign({ script: mk(offB), hpBoost: rung.hpBoost, statLine: rung.statLine,
                                             tag: kind + '/' + key + '/off/' + rung.id }, offB));
    /* `--dumplog` REACHES THE A/B LADDER (2026-09-11). It printed only the item board-state rung, so the
     * never-fired plan's three `--dumplog` confirmations (Slush Rush, Magma Armor, Light Clay) printed
     * nothing for the games they asked about — a flag that runs and shows nothing looks like a clean log. */
    if (DUMPLOG && on.staged && off.staged) {
      console.log('  ---- ' + kind + ' ' + key + ' [' + rung.id + '] ON script ' + JSON.stringify(mk(onB)));
      for (const l of on.sdLog) console.log('    ON  ' + l);
      for (const l of off.sdLog) console.log('    OFF ' + l);
    }
    const row = abRow(kind, key, name, carrier, control, on, off);
    row.rung = rung.id;
    if (rung.carrier) row.carrier = rung.carrier;
    if (onRung) onRung(rung, on, off, row);
    best = best || row;
    if (row.verdict && row.verdict !== 'DID-NOT-FIRE') { best = row; break; }
  }
  return best;
}

/* ================= THE BOARD-ONLY ARM (harness batches HB-1 and HB-2, 2026-09-11) =================
 *
 * An ability with NO CONTROL — its every legal carrier has it as the only ability, and every mega forme
 * has exactly one — cannot be A/B'd, and until today such a row was not played at all. Twenty-eight
 * mechanics, among them Levitate, Good as Gold and Fairy Aura, had no board anywhere in this file.
 *
 * WHAT THIS ARM CAN AND CANNOT CLAIM. It plays the ON game only. The BOARD is still a real comparison
 * of both engines, boundary by boundary; what it has lost is the A/B's proof that the ability is what
 * moved the game. So the proof comes from the AUTHORITY'S OWN LOG instead: the row is credited
 * (`FIRED-UNCONTROLLED`, `proven: true`, a `board` key) only when Showdown writes a line naming the
 * ability acting for the subject — `ability: <Name>` on a line that names `p1a` (`-ability`,
 * `-activate`, `-immune|…|[from] ability: …`, a field start `[of] p1a`) — or, for an ability tagged as a
 * forme changer, a `-formechange`/`detailschange` for the subject that is not the mega's own. Anything
 * else is `UNPROVEN-UNCONTROLLED` with its board kept under `board_unproven`, so the board count cannot
 * rise on a silent row. A mega carrier additionally needs the authority's `|-mega|`.
 *
 * `fired` STAYS FALSE ON EVERY ROW HERE. `summary.abilities.fired` is the A/B's number and an
 * uncontrolled credit is a weaker claim; it is counted beside it (`board_only_proven`), never inside. */
const CARRIER_PICK_MOVED = [];
const BOARD_ONLY = { rows: 0, staged: 0, proven: 0, unproven: [], state_unproven: [], mega_refused: 0,
                     mega_not_seen: [], alt_receiver: [], item_conflict: [], game_errors: [], receipts: {},
                     tag_triggers: [] };
const MEGA_AB_RUNGS = [
  /* x1 ONLY, for the reason `runStone` measured: the authority's forme change drops the fixture's x6. */
  { id: 'mega-real-pool', hpBoost: 1, beats: 1 },
  { id: 'mega-real-pool-3', hpBoost: 1, beats: 3 },
];
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FORME_AB = (ab) => AB_TAGS(ab).some(t => /^forme/.test(t) || t === 'switchInForme');
function abilityActedOn(log, name, ab, megaE) {
  const nameRe = new RegExp('ability: ' + reEsc(name) + '(\\||$)');
  /* EVERY FORME TAG, NOT TWO OF THEM. Printed before it was wired (2026-09-11): `^forme|switchInForme`
   * over data/tags.json matches exactly seven — disguise forecast hungerswitch illusion imposter
   * stancechange zerotohero — where the first draft's two names missed Stance Change
   * (`formeOnMoveCategory`), Hunger Switch (`formeCycleResidual`) and Forecast (`formeFollowsWeather`). */
  const formeTagged = FORME_AB(ab);
  const hitsTwice = AB_TAGS(ab).includes('hitsTwice');
  const out = [];
  let lastMover = null, lastMove = null;
  for (const l0 of (log || [])) {
    const l = String(l0);
    const mv = /^\|move\|(p[12][ab]): [^|]*\|([^|]*)/.exec(l);
    if (mv) { lastMover = mv[1]; lastMove = id(mv[2]); }
    /* A SKILL-SWAP-SHAPED ACTIVATION names the ability as a bare FIELD, not as `ability: <Name>` —
     * measured: `|-activate|p2a: Feraligatr|Skill Swap|Wandering Spirit|Torrent|[of] p1a: Runerigus`.
     * Only `-activate` lines, and only a WHOLE field, so a name inside a longer string cannot match. */
    if (/^\|-activate\|/.test(l) && /(\||\[of\] )p1a: /.test(l) && l.split('|').includes(name)) { out.push(l); continue; }
    /* `hitsTwice` (Parental Bond, the only member — printed 2026-09-11) is SILENT except for the hit
     * count: a `-hitcount` on a foe right after a p1a move that is not itself multi-hit in the dex. */
    if (hitsTwice && /^\|-hitcount\|p2[ab]: /.test(l) && lastMover === 'p1a' && lastMove
        && !(dex.moves.get(lastMove) || {}).multihit) { out.push(l + '   [after p1a ' + lastMove + ']'); continue; }
    /* `[of] p1a:` as well as `|p1a:` — a field start names its source only in the `[of]` slot
     * (`|-fieldstart|move: Electric Terrain|[from] ability: Electric Surge|[of] p1a: Raichu`), and the
     * first HB-2 run left Electric Surge unproven for exactly that. */
    if (/(\||\[of\] )p1a: /.test(l) && nameRe.test(l)) { out.push(l); continue; }
    if (/^\|-ability\|p1a: [^|]*\|/.test(l) && l.split('|')[3] === name) { out.push(l); continue; }
    if (formeTagged && /^\|(-formechange|detailschange)\|p1a: /.test(l)
        && !(megaE && l.indexOf(megaE.megaName) >= 0)) out.push(l);
  }
  return out;
}
function boardOnlyLadder(ab, name, carrier, mkOn, receiver, faces, thenWhat, megaE) {
  BOARD_ONLY.rows++;
  let best = null;
  /* A FORME-CHANGE ROW PLAYS x1, FOR THE REASON THE STONES DO. Measured on the first HB-1 run: Disguise
   * and Zero to Hero read STATE with medicham2 at exactly six times the authority's max HP (780/130,
   * 1050/175) — a PERMANENT forme change makes the authority recompute the line and drop the fixture's
   * boost. Forecast, a non-permanent change, did not part. Every forme-tagged row takes the x1 rungs. */
  const formeAb = FORME_AB(ab);
  for (const rung of ((megaE || formeAb) ? MEGA_AB_RUNGS : AB_RUNGS)) {
    const bOn = mkOn();
    if (!bOn || !receiver) continue;
    const b = stageBodies(bOn, receiver);
    const script = megaE ? megaScript(b, rung.beats, faces, thenWhat) : gauntletScript(b, rung.beats, faces, thenWhat);
    const r0 = GD.scriptCounters().megaRefused;
    /* THE STAT LINE rides on every row whose mechanism is a new forme — a mega carrier, or an ability
     * tagged as a forme changer (Stance Change's Blade forme is a different Attack and Defence). */
    const formeRow = megaE || FORME_AB(ab);
    const on = playScenario(Object.assign({ script, hpBoost: rung.hpBoost,
                                            statLine: megaE ? megaE.base : (formeRow ? id(carrier) : undefined),
                                            tag: 'ability/' + ab + '/on/' + rung.id }, b));
    const refused = GD.scriptCounters().megaRefused - r0;
    BOARD_ONLY.mega_refused += refused;
    if (DUMPLOG && on.staged) {
      console.log('  ---- ' + ab + ' [board-only ' + rung.id + '] script ' + JSON.stringify(script));
      for (const l of on.sdLog) console.log('    ' + l);
    }
    let row;
    if (!on.staged) {
      row = { kind: 'ability', id: ab, name, carrier, control: null, board_only: true, fired: false,
              why: 'could not stage: ' + on.why, validator: on.validator };
    } else {
      const receipt = abilityActedOn(on.sdLog, name, ab, megaE);
      const sdMega = megaE ? megaSeen(on.sdLog) : null;
      const proven = receipt.length > 0 && (!megaE || sdMega);
      const bv = boardVerdict(on, 'ability', ab);
      row = { kind: 'ability', id: ab, name, carrier, control: null, board_only: true,
              verdict: proven ? 'FIRED-UNCONTROLLED' : 'UNPROVEN-UNCONTROLLED', fired: false, proven,
              authority_receipt: receipt.slice(0, 4),
              why: proven ? null : 'no control exists, and the authority\'s log never shows ' + name
                 + ' acting for the subject' + (megaE && !sdMega ? ' (and the authority never evolved it)' : '')
                 + ' — the board below is a real comparison of a game nobody has shown this ability moved',
              diverged: !!on.div, divergence: divOf(on.div, 'p1a', on.sdLog, null),
              game_error: on.err || null, stat_line: on.statLine ? Object.assign({}, on.statLine) : null };
      if (megaE) row.mega = { stone: megaE.stone, base: megaE.base, mega: megaE.mega, asked: !BREAK_MEGA,
                              seen_showdown: sdMega, seen_medicham: megaSeen(on.mediTrace), refused };
      if (proven) row.board = bv; else row.board_unproven = bv;
    }
    row.rung = rung.id;
    best = best || row;
    if (row.proven) { best = row; break; }
  }
  if (best) {
    if (best.verdict) BOARD_ONLY.staged++;
    if (best.proven) { BOARD_ONLY.proven++; BOARD_ONLY.receipts[ab] = best.authority_receipt[0]; }
    else BOARD_ONLY.unproven.push(ab);
    if (best.board_unproven && best.board_unproven.verdict === 'STATE') BOARD_ONLY.state_unproven.push(ab);
    if (best.mega && !best.mega.seen_showdown) BOARD_ONLY.mega_not_seen.push(ab);
    if (best.game_error) BOARD_ONLY.game_errors.push(ab + ': ' + best.game_error);
  }
  return best;
}

function runAbilities(list) {
  const rows = [];
  for (const ab of list) {
    const da = dex.abilities.get(ab);
    const carriers = (AB_CARRIERS.get(ab) || []);
    /* HB-2 (2026-09-11) — A MEGA-ONLY ABILITY IS CARRIED BY THE BASE FORME HOLDING THE STONE, and the
     * row asks for the mega on turn 1. Before this it read "NO LEGAL CARRIER" for fourteen abilities
     * whose carrier is perfectly legal — `LEGAL_SPECIES` drops mega formes because a sheet cannot name
     * one, and `AB_CARRIERS` inherited that. */
    const megaE = carriers.length ? null : ((MEGA_AB_CARRIERS.get(ab) || [])[0] || null);
    const sv = SCOPE.verdict('ability', ab);
    if (!sv.inScope) {
      rows.push({ kind: 'ability', id: ab, name: da.name, fired: false, unreachable: true,
                  scope_code: sv.code, why: sv.code + ' — ' + sv.why });
      continue;
    }
    if (!carriers.length && !megaE) {
      /* IN SCOPE (a CONFERRED ability — Simple through Simple Beam) with no body in this ladder: the
       * staging planner's conferral fixture stages it; this ladder has no rung for it. Not unreachable. */
      rows.push({ kind: 'ability', id: ab, name: da.name, fired: false, staging_gap: true,
                  why: 'IN SCOPE (' + sv.code + ') and the legacy ladder has no carrier body for it — a staging gap, not a claim about the format' });
      continue;
    }
    /* HB-3 (2026-09-11) — THE CARRIER IS THE FIRST ONE THAT HAS A CONTROL AND BUILDS WITHOUT THE
     * OWN-POOL FALLBACK. The old pick (`find(control) || carriers[0]`) took Ditto for Limber because
     * Ditto sorts first and has a control (Imposter) — and Ditto could not be built, so a mechanic with
     * five other legal carriers read "could not be built". A carrier that needs the fallback is only
     * taken when nothing else can carry the row (Imposter). Which rows this pick MOVED is printed. */
    const buildsPlain = (s) => { const p = POOL.get(s); return !!p && (GAUNTLET_ACTOR_MOVES.some(m => p.has(id(m))) || FILLERS.some(f => p.has(f))); };
    const c = megaE ? megaE.base
      : (carriers.find(s => abControlFor(s, ab) && buildsPlain(s)) || carriers.find(s => abControlFor(s, ab))
         || carriers.find(buildsPlain) || carriers[0]);
    if (!megaE) { const old = carriers.find(s => abControlFor(s, ab)) || carriers[0];
                  if (old !== c) CARRIER_PICK_MOVED.push(ab + ': ' + old + ' -> ' + c); }
    const ctrl = megaE ? null : abControlFor(c, ab);
    /* HB-1 (2026-09-11) — NO CONTROL IS NO LONGER NO ROW. A carrier whose only ability is this one (and
     * every mega forme, which has one) cannot be A/B'd, so the row plays the ON game only and is
     * credited only where the AUTHORITY'S OWN LOG shows the ability acting — see `boardOnlyLadder`. */
    const boardOnly = !ctrl;
    /* THE RECEIVER IS BUILT TO CARRY WHAT THIS ABILITY MUST FACE (engine/faces.js). Feraligatr
     * remains the body — it has no immunity and so blocks nothing by accident — but its MOVES are
     * chosen for the tag under test. A fixed four-move set is why 63 abilities produced a board
     * identical to not having them: Levitate never saw Ground, Shield Dust never saw a secondary. */
    const faces = facesFor((TAGS.abilities[ab] || {}).tags || []);
    /* ROADMAP #158 -- AND WHAT MUST HAPPEN AFTERWARDS. Read off the SAME tag record as the adversary,
     * so an ability needing both gets both. `thenWhatFor` also resolves the VOLATILE keys out of the
     * entity's own `statusInflict` params, which is how rows whose only tag is `statusInflict` get a
     * consequence without anybody writing a move name down. */
    const _ar = TAGS.abilities[ab] || {};
    const tw = thenWhatFor(_ar.tags || [], _ar.params || {});
    /* `itemsOnBoth` IS A PROPERTY OF THE BUILD, NOT A TURN, so it is applied where the bodies are made
     * rather than in the script. Klutz, Magician, Pickpocket and Symbiosis are inert on an
     * empty-handed board and no number of turns fixes that. */
    const twItem = (tw && (tw.stages || []).map(x => x && x.itemsOnBoth).find(Boolean)) || '';
    let recvWants = [].concat((faces && faces.recv) || [], RECEIVER_MOVES);
    let receiver = bodyOf(RECEIVER.species, RECEIVER.ability, twItem || RECEIVER.item, recvWants);
    /* ---- THE PREFLIGHT RUNS BEFORE THE GAME IS PLAYED, AND IT IS DECLARED WHAT THE FIXTURE PROVABLY
     * STAGES — NOT WHAT IT INTENDS TO. That distinction is the whole value of asking: an intent that
     * silently fails to reach the board is exactly the state that produced this instrument's 98
     * DID-NOT-FIRE abilities. Two of the harness's own intents are measured here and BOTH were no-ops:
     *
     *   `faces.setsWeather`  the gauntlet clicks `clickOf(actor, [F_.setsWeather, …])`, and `clickOf`
     *                        falls back to the body's FIRST MOVE when it does not hold the ask.
     *                        `GAUNTLET_ACTOR_MOVES` is Facade/Endure/Rest/Substitute — no weather move
     *                        has ever been on an actor, so no `setsWeather` entry in engine/faces.js
     *                        has ever put weather up. Counted as `faces_weather_noop` and REPAIRED.
     *   `faces.statusFirst`  same shape, on the receiver: Feraligatr's legal pool contains no
     *                        status-only move at all, so `clickOf(receiver, ['Thunder Wave', …])` has
     *                        always fallen through. Counted as `faces_status_noop` and NOT repaired —
     *                        see the note where it is counted. */
    const actorPool = POOL.get(c) || new Set();
    let actorWants = GAUNTLET_ACTOR_MOVES.slice();
    let facesUsed = faces;
    let weatherStaged = null;
    /* ---- THE TRIGGER THE ABILITY'S OWN HANDLER ASKS FOR ---------------------------------------------
     *
     * WILL, 2026-08-12: "but we are staging it so a dark move hits a justified mon right? thats the
     * whole point". IT WAS NOT. `GAUNTLET_ACTOR_MOVES` is four moves — Facade, Endure, Rest, Substitute
     * — and `RECEIVER_MOVES` is four more, and every one of the 316 abilities got the same eight. None
     * of them is Dark, so `justified.onDamagingHit`'s `move.type === "Dark"` could not be reached on any
     * board this repository has ever built. The MOVES arm derives a team per move; the ABILITIES arm was
     * a shared gauntlet. Two standards in one runner.
     *
     * `engine/faces.js` is the tag-keyed half of the answer and it stays — it says what an ability must
     * be UP AGAINST when the tag knows. This is the other half: the ability's OWN handler already states
     * its requirement and which side has to supply it, so it is READ rather than tabulated, and an
     * ability added tomorrow is staged without editing either file.
     *
     * THE ORDER MATTERS AND IS NOT A PREFERENCE. The derived move goes at the FRONT of the want list, so
     * `bodyOf` keeps it when the list overflows four slots and `clickOf` picks it over the fallbacks.
     * `faces` entries stay behind it, because a `faces` row is a tag-level guess about a family and the
     * handler is the row's own text. */
    /* THE RED SWITCH FOR THIS DERIVATION. `--break-preflight` stubs the CLAUSES and does not reach the
     * staging, so it could not have demonstrated that the staging is load-bearing. `--break-triggers`
     * returns no needs at all — exactly the state this file was in before today — and every row falls
     * back to the shared Facade/Endure/Rest/Substitute gauntlet. The counter then reads ZERO and the
     * run exits non-zero, which is the proof that a green here is worth something. */
    const NEEDS = BREAK_TRIGGERS ? { needs: [], undetermined: [] } : PRE.moveNeeds(da);
    const derivedActor = [], derivedRecv = [], unmetNeeds = [];
    if (NEEDS.needs.length) {
      PREFLIGHT.trigger_rows++;
      /* a mega carrier's need is derived against the forme that HOLDS the ability, not its base */
      const aTypes = (dex.species.get(megaE ? megaE.mega : c).types) || [];
      const rTypes = (dex.species.get(RECEIVER.species).types) || [];
      const recvPoolN = POOL.get(id(RECEIVER.species)) || new Set();
      for (const n of NEEDS.needs) {
        PREFLIGHT.trigger_needs++;
        /* `either` is the LOUD fallback for an event this derivation cannot place (`onAny…`): the move
         * is offered to BOTH sides rather than a side being guessed. `ally` cannot be staged at all —
         * both allies click Protect by construction — and says so. */
        const sides = n.by === 'either' ? ['actor', 'receiver'] : [n.by];
        let staged = null;
        for (const side of sides) {
          const pool = side === 'actor' ? actorPool : recvPoolN;
          const ctx = side === 'actor' ? { userTypes: aTypes, targetTypes: rTypes }
                                       : { userTypes: rTypes, targetTypes: aTypes };
          const m = pickForNeed(n, pool, ctx);
          if (!m) continue;
          /* A FLINCH THE THROWER CANNOT DELIVER IS NOT A STAGED TRIGGER. engine/faces.js states the
           * rule for the move arm — `MOVE_FACES.flinches: {movesFirst: true}`, "moving second makes it
           * a silent no-op" — and the ability arm had no equivalent, so Steadfast read DID-NOT-FIRE
           * off a board where the flinch was thrown by the SLOWER body and could never land. Both
           * bodies are built at 0 SP under a neutral nature (see `NATURE`), so base Speed is the whole
           * order. Refused HERE rather than staged-and-hoped, which is the difference between a named
           * fixture limit and an unexplained inert row. */
          if (n.kind === 'flinch' && (dex.moves.get(m).priority || 0) <= 0) {
            const mine = dex.species.get(side === 'actor' ? c : id(RECEIVER.species)).baseStats.spe;
            const theirs = dex.species.get(side === 'actor' ? id(RECEIVER.species) : c).baseStats.spe;
            if (mine <= theirs) continue;
          }
          (side === 'actor' ? derivedActor : derivedRecv).push(m);
          staged = side + ':' + m;
          break;
        }
        if (staged) { PREFLIGHT.trigger_staged++;
          if (PREFLIGHT.trigger_examples.length < 40)
            PREFLIGHT.trigger_examples.push(ab + ' ' + n.kind + (n.values.length ? '=' + n.values.join('|') : '') + ' -> ' + staged);
        } else { PREFLIGHT.trigger_unstaged++;
          unmetNeeds.push(n.by + ':' + n.kind + (n.values.length ? '=' + n.values.join('|') : '')); }
      }
      if (derivedRecv.length) {
        recvWants = derivedRecv.map(mvName).concat(recvWants);
        receiver = bodyOf(RECEIVER.species, RECEIVER.ability, twItem || RECEIVER.item, recvWants);
      }
      if (derivedActor.length) actorWants = derivedActor.map(mvName).concat(actorWants);
      /* THE DERIVED MOVES TRAVEL IN THEIR OWN KEYS, NOT IN `recv`/`actor`. Those two are what the
       * gauntlet's existing beat turns click, and writing into them is exactly the substitution that
       * cost Hustle and Torrent — see the block in `gauntletScript`. `actorDerived`/`recvDerived` are
       * read only by the added trigger turn, so every row's original board survives untouched. */
      if (derivedActor.length || derivedRecv.length)
        facesUsed = Object.assign({ recv: [], why: [] }, facesUsed || {}, {
          actorDerived: derivedActor.map(mvName),
          recvDerived: derivedRecv.map(mvName),
          why: ((facesUsed && facesUsed.why) || []).concat(
            NEEDS.needs.map(n => 'handler ' + n.handler + ': the ' + n.by + ' must supply '
              + n.kind + (n.values.length ? ' (' + n.values.join(' or ') + ')' : ''))),
        });
    }
    /* ---- HB-1 (2026-09-11): A BOARD-ONLY ROW'S TRIGGER, READ OFF ITS TAG'S PARAMS ------------------
     * Measured on the first board-only run: Levitate's receiver threw Low Kick (the `faces` list puts
     * Earthquake fifth and `pickHit` takes the first reachable), and Good as Gold was never aimed at —
     * Feraligatr learns none of the three status moves `faces` names. Neither ability has a handler the
     * need derivation can read (`typeImmunity.via: "not derivable -- no handler"`), so the trigger is read
     * off the TAG instead: `typeImmunity.type` -> a damaging move of that type aimed at a foe;
     * `refusesStatusMoves` -> a status move aimed at a foe. Chosen from the receiver's OWN legal pool,
     * sorted, first — never named. BOARD-ONLY ROWS ONLY: an A/B row's fixture does not move in this pass.
     * Membership printed before wiring: typeImmunity with a type over the board-only rows is levitate and
     * eelevate; refusesStatusMoves is goodasgold alone. */
    /* `--break-triggers` suppresses this exactly as it suppresses the handler-derived needs — measured:
     * without the guard the switch left Levitate and Good as Gold proven, so it could not show the
     * trigger was load-bearing for either. */
    if (boardOnly && !BREAK_TRIGGERS) {
      const P = (TAGS.abilities[ab] || {}).params || {};
      const rPool = [...(POOL.get(id(RECEIVER.species)) || new Set())].sort().map(k => dex.moves.get(k))
        .filter(mv => mv && mv.exists && !mv.isNonstandard && FOE_TARGETS.has(mv.target));
      let trig = null, tag = null;
      if (P.typeImmunity && P.typeImmunity.type) {
        trig = rPool.find(mv => mv.type === P.typeImmunity.type && mv.category !== 'Status'); tag = 'typeImmunity=' + P.typeImmunity.type;
      } else if (P.refusesStatusMoves) {
        trig = rPool.find(mv => mv.category === 'Status' && !mv.stallingMove && !mv.forceSwitch); tag = 'refusesStatusMoves';
      }
      if (tag) BOARD_ONLY.tag_triggers.push(ab + ' ' + tag + ' -> ' + (trig ? trig.id : 'NONE IN THE RECEIVER\'S POOL'));
      if (trig) {
        recvWants = [trig.name].concat(recvWants);
        receiver = bodyOf(RECEIVER.species, RECEIVER.ability, twItem || RECEIVER.item, recvWants);
        facesUsed = Object.assign({ recv: [], why: [] }, facesUsed || {}, {
          actorDerived: (facesUsed && facesUsed.actorDerived) || [],
          recvDerived: [trig.name].concat((facesUsed && facesUsed.recvDerived) || []),
          why: ((facesUsed && facesUsed.why) || []).concat('tag ' + tag + ': the receiver must throw ' + trig.name) });
      }
    }
    if (facesUsed && facesUsed.setsWeather) {
      const wm = id(facesUsed.setsWeather);
      if (actorPool.has(wm)) { actorWants = [mvName(wm)].concat(actorWants); weatherStaged = WEATHER_OF_MOVE.get(wm) || null; }
      else PREFLIGHT.faces_weather_noop++;
    }
    /* WHICH STATUS THE BOARD ACTUALLY LANDS. Only the two clicks the gauntlet really makes are
     * considered — `clickOf` resolves them exactly as `gauntletScript` does — and a status is credited
     * only if the preflight itself says it can land on this carrier. Under `bottom-tie-first` EVERY
     * SECONDARY FIRES, so a secondary status here is a certainty rather than a 30% hope. */
    const _want = (facesUsed && facesUsed.recv) || [];
    const statusStaged = !receiver ? null : (() => {
      for (const cand of [clickOf(receiver, [].concat(_want, ['Facade', 'Aqua Tail'])),
                          clickOf(receiver, [].concat(_want, ['Hydro Pump', 'Round']))]) {
        const dm = dex.moves.get(cand); if (!dm || !dm.exists) continue;
        const st = PRE.statusOf(dm); if (!st) continue;
        if (preflight({ species: RECEIVER.species, move: dm.name, target: dex.species.get(c).name }).ok) return st;
      }
      return null;
    })();
    if (facesUsed && facesUsed.statusFirst && !statusStaged) PREFLIGHT.faces_status_noop++;
    const scOf = (wx, st) => {
      /* A MEGA CARRIER IS JUDGED AS THE MEGA FORME. Measured on the first HB-2 run: naming the base
       * here made the preflight's `ability-on-species` clause BLOCK Fairy Aura (Floette-Eternal does not
       * carry it) on a board where the authority then announced it — the fixture misdescribing itself. */
      const sc = { species: dex.species.get(megaE ? megaE.mega : c).name, ability: ab, target: dex.species.get(RECEIVER.species).name,
                   /* the sheet is six long and the BATTLE brings four — two active, two on the bench —
                    * so the switch the gauntlet's last turn asks for has somewhere to go */
                   teamSize: 4, switchesOut: true,
                   /* `buildPair` writes `gender: 'N'` on every body of both sides and says why:
                    * medicham2 has no gender at all, so a declared one parts the streams on line one. */
                   gender: 'N', targetGender: 'N',
                   /* THE TWO ROLLS THIS ARM TURNS INTO CONSTANTS, and the BOARD STATES the gauntlet
                    * provably reaches. Both were missing here for the same reason `stagedMoves` was
                    * missing from `runItems`: the clause existed and nobody fed it. `itemConsumed` is
                    * true exactly when a `thenWhat` row put an item on both bodies — anything else
                    * would be the fixture asserting a state it does not build. */
                   armForcesAccuracy: ARM_FORCES.accuracy, armForcesCrit: ARM_FORCES.crit,
                   /* WHO WINS A SPEED TIE, read off the arm's own field rather than from its name.
                    * `bottom-tie-first` declares `tieToSecondBody: false` and every subject this
                    * harness stages is p1a, the earlier body — so a tie is already a win and a Speed
                    * multiplier over it changes nothing. Undeclared, the clause read a tie as a
                    * crossing and Swift Swim came out unexplained. */
                   armTieFirst: ARM.tieToSecondBody === false,
                   boardState: { itemConsumed: !!twItem, allyIsLive: false } };
      if (twItem) sc.item = twItem;
      if (wx) sc.weather = wx;
      /* undefined, NOT null — the preflight's status clause tests `=== undefined`, so a null would
       * silently suppress the very clause this row needs. */
      if (st) sc.status = st;
      /* WHAT THE FIXTURE PROVABLY CLICKS, READ BACK OFF THE BUILT BODIES — not off the want lists.
       * `bodyOf` silently drops a move the species cannot learn and `clickOf` falls back to slot 1, so
       * an intent is not a click; declaring the WANT here would let the trigger clause clear a board
       * that never held the move. This is the same distinction the `faces.setsWeather` no-op counter
       * exists to make, asked one layer earlier. */
      const built = bodyOf(c, da.name, twItem || '', actorWants);
      sc.stagedMoves = { actor: ((built || {}).moves || []).map(id),
                         receiver: ((receiver || {}).moves || []).map(id) };
      return sc;
    };
    let pre = preflight(scOf(weatherStaged, statusStaged));
    /* ---- REPAIR WHERE THE CLAUSE SAYS WHAT IS MISSING, LABEL WHERE IT DOES NOT ---------------------
     * The weather clause returns the weather ids the handler reads, `SETS_WEATHER` already inverts
     * "which move sets that weather" out of the tag artifact, and the gauntlet already has a
     * weather turn. So the repair is: hand the actor a setter it can legally learn and declare the sky.
     * Identical in both arms, so the A/B still differs in the ability and in nothing else.
     *
     * `weather-setter` rows are NOT repaired and the clause says why: Drought under sun sets nothing,
     * emits nothing, and reads DID-NOT-FIRE — the Abomasnow bug in the carrier block above. */
    const recvPool = POOL.get(id(RECEIVER.species)) || new Set();
    for (const cl of (pre.clauses || [])) {
      if (cl.clause !== 'weather' || weatherStaged) continue;
      const want = (cl.need && cl.need.weather) || [];
      /* THE ACTOR FIRST, THE RECEIVER SECOND, AND THE SECOND IS NOT A CONSOLATION PRIZE. Weather is a
       * FIELD condition: whichever body clicks Rain Dance, the rain is up for everyone, and the
       * subject's ability reads it identically. Excadrill can learn Sandstorm and Basculegion Rain
       * Dance, so this arm is rarely needed — but the receiver holds Rain Dance too, and a fixture
       * that could have set the sky and did not is exactly the defect this whole wiring is about. */
      let w = want.find(x => SETS_WEATHER_ID.has(x) && actorPool.has(SETS_WEATHER_ID.get(x)));
      let byFoe = false;
      if (!w) { w = want.find(x => SETS_WEATHER_ID.has(x) && recvPool.has(SETS_WEATHER_ID.get(x))); byFoe = !!w; }
      if (!w) { PREFLIGHT.weather_unrepairable++; continue; }
      const setter = SETS_WEATHER_ID.get(w);
      if (byFoe) { recvWants = [mvName(setter)].concat(recvWants); receiver = bodyOf(RECEIVER.species, RECEIVER.ability, twItem || RECEIVER.item, recvWants); }
      else actorWants = [mvName(setter)].concat(actorWants);
      weatherStaged = w;
      facesUsed = Object.assign({ recv: [], why: [] }, facesUsed || {},
                                byFoe ? { setsWeatherByFoe: mvName(setter) } : { setsWeather: mvName(setter) });
      PREFLIGHT.repaired_weather++;
      if (PREFLIGHT.repairs.length < 40) PREFLIGHT.repairs.push(ab + ' -> ' + w + ' via ' + setter + (byFoe ? ' (clicked by the receiver)' : ''));
      pre = preflight(scOf(weatherStaged, statusStaged));   /* the row records the REPAIRED board */
      break;
    }
    /* A MEGA CARRIER HOLDS ITS STONE, ALWAYS. If the consequence table also wanted an item on the
     * body, the stone wins and the conflict is recorded on the row — a mega carrier without its stone
     * is a base forme that does not have the ability at all. */
    const stoneItem = megaE ? dex.items.get(megaE.stone).name : '';
    const mkActor = (which) => bodyOf(c, which, stoneItem, actorWants);
    /* ROADMAP #158 -- the same body WITH the consequence's required item. The item is IDENTICAL in
     * both arms, so the A/B still differs in the ability and in nothing else. */
    const mkActorI = (which, item) => bodyOf(c, which, stoneItem || item || '', actorWants);
    const a1 = mkActor(da.name), a2 = mkActor(ctrl);
    if (!a1 || !a2 || !receiver) {
      rows.push({ kind: 'ability', id: ab, name: da.name, carrier: c, fired: false,
                  why: 'the carrier body could not be built' });
      continue;
    }
    /* THE CARRIER MUST NOT BE THE RECEIVER. Feraligatr holds Torrent and Sheer Force, so those two
     * rows put the same species on both sides — the sheets then collide, `stageBodies` is handed a
     * null, and the whole run died at ability 250 of 316. */
    /* A MEGA CARRIER WHOSE BASE IS THE RECEIVER (Feraligite -> Dragonize) takes the stone arm's
     * alternate receiver, the same derived `ALT_RECEIVERS` body `stoneReceiverFor` picks. */
    if (megaE && id(a1.species) === id(receiver.species)) {
      const alt = stoneReceiverFor(c);
      const altB = alt && bodyOf(alt, '', twItem || RECEIVER.item, recvWants);
      if (altB) { receiver = altB; BOARD_ONLY.alt_receiver.push(ab + '->' + alt); }
    }
    if (id(a1.species) === id(receiver.species)) {
      rows.push({ kind: 'ability', id: ab, name: da.name, carrier: c, fired: false,
                  why: 'the only legal carrier IS the receiver fixture — this instrument cannot put '
                     + 'the same species on both sides of the field' });
      continue;
    }
    if (megaE && twItem) BOARD_ONLY.item_conflict.push(ab + ': the consequence wanted ' + twItem + ', the stone was kept');
    const row = boardOnly
      ? boardOnlyLadder(ab, da.name, c, () => mkActorI(da.name, twItem), receiver, facesUsed, tw, megaE)
      : abLadder('ability', ab, da.name, c, ctrl,
                 () => mkActorI(da.name, twItem), () => mkActorI(ctrl, twItem), receiver, facesUsed, tw);
    /* THE PREFLIGHT'S VERDICT IS ATTACHED AFTER THE GAME, AND FALSIFIED BY IT. `fired` is the only
     * thing that can prove a refusal wrong, so it is passed in rather than assumed. */
    /* HB-5's validator relabel ("does not exist in Gen 9" -> unreachable) was REMOVED 2026-09-11: scope is
     * asked of engine/legal_scope.js above the staging, which puts every legal carrier to the
     * TeamValidator, so a row like Battle Bond (VALIDATOR-REFUSED) is out before a game is built. */
    /* A board-only row has no A/B, so "fired" is the authority's receipt (`proven`), never its verdict
     * string — `UNPROVEN-UNCONTROLLED` is not DID-NOT-FIRE and must not read as a firing either. */
    labelRow(row, pre, boardOnly ? !!(row && row.proven) : !!(row && row.verdict && row.verdict !== 'DID-NOT-FIRE'));
    /* ---- TWO EXPLANATIONS THAT ALREADY EXISTED AS PROSE AND NOT AS A FIELD (2026-08-19) ------------
     *
     * `engine/faces.js` has said, in a `why` sentence, WHY several of these rows are inert since the
     * table was written — and a `why` sentence is not readable by the report that partitions
     * `did_not_fire`, so the rows it covers sat in `did_not_fire_unexplained` beside genuine engine
     * gaps. Two of its statements are structural rather than rhetorical and are hoisted here:
     *
     *   DECLARED UNOBSERVABLE  `announcesOnEntry` sets `unobservable: true` on purpose — Anticipation
     *     and Frisk emit a MESSAGE and move no state, so NO turn can make them visible to a board
     *     comparator. That is a declared gap, which is a different thing from an unexplained one.
     *   THE ADVERSARY NEVER REACHED THE BOARD  a `faces` entry names what the subject must be up
     *     against, and `clickOf` falls back to the body's first move when it does not hold the ask —
     *     the identical silent fallback `PREFLIGHT.faces_status_noop` already counts in aggregate.
     *     SYNCHRONIZE must be STATUSED by the adversary and the receiver fixture (Feraligatr) has no
     *     status move in its whole legal pool, so the intent has never once reached a board. Judged on
     *     the BUILT receiver, never on the want list — the distinction `scOf` makes one block up.
     *
     * BOTH ARE APPLIED ONLY TO A ROW THAT DID NOT FIRE, exactly as an advisory preflight clause is: a
     * subject that fired for some other reason is never argued with. */
    if (row && row.verdict === 'DID-NOT-FIRE' && !row.cannot_fire) {
      const held = new Set((((receiver || {}).moves) || []).map(id));
      const wanted = ((facesUsed && facesUsed.recv) || []).map(id);
      let clause = null, why = null;
      if (tw && tw.unobservable) {
        clause = 'announces-only';
        why = '"' + da.name + '" is DECLARED unobservable by engine/faces.js (`' + tw.unobservable
            + '`): it emits a MESSAGE and moves no state, so no number of turns can make it visible to '
            + 'a board comparator. A declared gap, not an unexplained one.';
      } else if (wanted.length && !wanted.some(m => held.has(m))) {
        clause = 'adversary-unstaged';
        why = '"' + da.name + '" must be up against ' + wanted.join('/') + ' (engine/faces.js) and the '
            + 'BUILT receiver holds none of them — ' + dex.species.get(RECEIVER.species).name
            + '\'s legal pool cannot supply it, so `clickOf` fell back to its first move and the intent '
            + 'reached no board. A fixture limit with a name on it, not an engine gap.';
      }
      if (clause) {
        row.cannot_fire = true;
        row.cannot_fire_clause = clause;
        row.cannot_fire_blocking = false;
        row.cannot_fire_why = [why];
        row.cannot_fire_need = [clause === 'announces-only' ? { observable: false }
                                                           : { adversary: wanted }];
        row.verdict_refined = 'CANNOT-FIRE-IN-THIS-FIXTURE';
      }
    }
    if (row) { row.fixture_weather = weatherStaged; row.fixture_status = statusStaged;
               row.fixture_weather_repaired = !!(weatherStaged && (!faces || id(faces.setsWeather || '') !== id((facesUsed && facesUsed.setsWeather) || ''))); }
    /* WHAT THE HANDLER ASKED FOR AND WHAT THE BOARD SUPPLIED, ON THE ROW. An inert verdict is only
     * readable if the reader can see what the trigger needed — and a row whose need went UNSTAGED is a
     * fixture limit rather than an engine gap, which is the whole distinction the preflight exists to
     * draw. It is also the only field that can falsify this derivation: a row with a staged need that
     * still reads DID-NOT-FIRE is either an engine defect or a wrong need, and both are findings. */
    if (row && NEEDS.needs.length) {
      row.trigger_needs = NEEDS.needs.map(n => ({ by: n.by, kind: n.kind, values: n.values, handler: n.handler }));
      row.trigger_staged = { actor: derivedActor, receiver: derivedRecv };
      row.trigger_unstaged = unmetNeeds.length ? unmetNeeds : null;
    }
    if (row && NEEDS.undetermined.length) row.trigger_cues_undetermined = NEEDS.undetermined;
    /* WHAT THE ROW WAS MADE TO FACE IS RECORDED ON IT. An inert verdict is only readable if the
     * reader can see what the subject was up against — otherwise 'nothing happened' cannot be told
     * apart from 'nothing was tried'. */
    if (row && facesUsed) { row.faced = facesUsed.recv; row.faced_why = facesUsed.why; }
    /* WHAT THE ROW WAS MADE TO DO NEXT, recorded beside what it was made to face, for the same
     * reason: an inert verdict is only readable if the reader can see what was tried. */
    if (row && tw) { row.then_what = tw.why; row.then_what_needs = tw.needs;
                     row.then_what_after = tw.after; row.then_what_item = twItem || null; }
    rows.push(row);
  }
  /* THE CONTROL ARM IS ITSELF AN ABILITY, AND WHEN IT IS A LIVE ONE THE PAIR CANNOT SAY WHICH OF THE
   * TWO MOVED THE GAME. The deliberate roster hit this first and named it `CONTROL-NOT-QUIET` on 15 of
   * its own rows; the same hazard is here and it is annotated rather than hidden, because a row that
   * says FIRED for its neighbour's reason is worse than one that says it does not know.
   *
   * DETECTED FROM THIS RUN'S OWN RESULTS: an ability used as a control is "not quiet" if its own row
   * moved a game. That is a derived test, not a list, and it needs no extra games. DISAMBIGUATING it
   * needs a THIRD arm against a control proven inert, which this pass did NOT run — so the ambiguity
   * is reported, not resolved. */
  const live = new Set(rows.filter(r => r.showdown_moved || r.medicham_moved).map(r => r.id));
  for (const r of rows) {
    if (!r.control || !live.has(id(r.control))) continue;
    r.control_not_quiet = true;
    r.control_note = 'the CONTROL ability (' + r.control + ') is itself live in this run, so the pair '
                   + 'cannot say which of the two moved the game. A third arm would settle it; this pass did not run one.';
  }
  return rows;
}

/* THE ITEM HOLDER. It must be able to click a contact physical attack (so an offensive item has
 * something to modify) and must not be the receiver. Chosen once and named, so every item row is the
 * same game with one field changed. */
const ITEM_HOLDER = 'corviknight';
/* ---- WHO HOLDS IT, AND WHY THAT IS NOT ALLOWED TO BE ONE SPECIES FOR ALL 73 ----------------------
 *
 * The comment above used to end "so it is FIXED, and fixing it is what makes the A/B honest". The
 * second half of that is right and the first half does not follow: what the A/B needs is that the two
 * arms differ in the ITEM and in nothing else, which is a statement about ONE ROW. A holder chosen per
 * row is just as honest and it is the difference between a fixture and a wall.
 *
 * MEASURED at release bb59e9a263c5: 12 of the 73 in-scope items fire, and every one of the twelve is
 * an item that needs NO constructed condition — Leftovers, Life Orb, Choice Scarf, Muscle Band, Silk
 * Scarf, Shell Bell, Quick Claw, Focus Band, Metronome, Chilan/Oran/Sitrus Berry. Everything that
 * needs a fixture built for it failed, and the largest two families failed for a reason that is one
 * sentence long:
 *
 *   SEVENTEEN RESIST BERRIES need a SUPER-EFFECTIVE hit of their own type. Corviknight is Flying/Steel,
 *     so Chople (Fighting) and Occa (Fire) could have worked and Rindo (Grass, 0.25x into that body)
 *     could not — on the same board, for the same reason, with no way to tell which from the artifact.
 *   EIGHTEEN TYPE-BOOST ITEMS need a move of their own type thrown BY the holder, and Corviknight can
 *     learn a Psychic, Fairy, Grass, Electric or Fire attack for none of them.
 *
 * So the holder is DERIVED FROM THE ITEM'S OWN NEED, by the same `moveNeeds` the abilities arm has used
 * since 2026-08-12, and the default is tried first so a row that already worked keeps the board it
 * worked on. A row whose need no legal body can supply keeps its `trigger-move` clause and says so.
 *
 * THE SEARCH IS OVER THE FORMAT AND NOT OVER A SHORTLIST. `LEGAL_SPECIES` is already filtered by the
 * authority's own `isNonstandard`/`tier` (CLAUDE.md: `.all()` is the National Dex), and the chosen body
 * still goes to `TeamValidator` inside `playScenario` like every other. */
/* ---- AND WHEN THE ADVERSARY IS THE ONE WHO CANNOT THROW IT -------------------------------------
 *
 * MEASURED after the holder became derived: five resist berries still could not be staged, and not one
 * of them was about the holder. **Feraligatr has no Poison, Fire, Fairy, Bug or Electric attacking
 * move in its entire legal pool** — so Kebia, Occa, Roseli, Tanga and Wacan had no thrower, whatever
 * body held them.
 *
 * The receiver is fixed for a stated reason — it must be immune to NOTHING, or a whole type silently
 * vanishes from the measurement — and that reason is a property of its TYPING, not of Feraligatr. So
 * the fallback is any legal body carrying no type immunity at all, computed against the authority's own
 * chart rather than from the seven types listed in the RECEIVER comment. Grass is excluded on top,
 * exactly as the fixed receiver's comment excludes it, because Grass refuses the powder moves.
 *
 * ITS ABILITY CANNOT MANUFACTURE A FALSE FIRED and that is why this is safe: both arms of the A/B get
 * the identical body and differ in the ITEM alone, so anything the receiver's ability does cancels. The
 * one thing it could do is BLOCK the trigger, so a body whose ability confers an immunity is skipped. */
const ALT_RECEIVERS = LEGAL_SPECIES.filter(s => {
  if ((s.types || []).includes('Grass')) return false;
  for (const t of dex.types.names()) if (!dex.getImmunity(t, s.types)) return false;
  const ab = dex.abilities.get(Object.values(s.abilities || {})[0] || '');
  const src = ab && ab.exists ? Object.entries(ab).filter(([k, v]) => /^on/.test(k) && typeof v === 'function')
    .map(([, v]) => String(v)).join(' ') : '';
  return !/getImmunity|isImmune|return null|return false/.test(src);
}).map(s => s.id);
function holderFor(needs, receiverSp) {
  /* The default receiver first, always. A row that already staged keeps the board it staged on. */
  for (const rs of [id(receiverSp)].concat(ALT_RECEIVERS.filter(x => x !== id(receiverSp)))) {
    const r = holderForReceiver(needs, rs);
    if (r) return r;
  }
  return null;
}
function holderForReceiver(needs, receiverSp) {
  const rTypes = (dex.species.get(receiverSp) || {}).types || [];
  const recvPool = POOL.get(id(receiverSp)) || new Set();
  const tryHolder = (h) => {
    if (id(h) === id(receiverSp)) return null;
    const sp = dex.species.get(h);
    if (!sp || !sp.exists) return null;
    const pool = POOL.get(sp.id);
    if (!pool) return null;
    const aTypes = sp.types || [];
    const A = [], R = [];
    /* ---- TWO NEEDS FROM ONE HANDLER ARE ONE MOVE, AND THE FIRST BUILD OF THIS GOT IT WRONG ---------
     *
     * A resist berry's guard is a CONJUNCTION:
     *
     *     if (move.type === "Fighting" && target.getMoveHitData(move).typeMod > 0)
     *
     * `moveNeeds` returns that as two needs, and satisfying them SEPARATELY stages a Fighting move and
     * some other super-effective move — neither of which is a super-effective Fighting move. MEASURED:
     * nine of the sixteen resist berries came back with a staged trigger and DID-NOT-FIRE, which is the
     * worst label in this instrument (it reads as an engine gap). Chople was handed Brick Break into a
     * Venusaur, and Fighting into Grass/Poison is NEUTRAL.
     *
     * The grouping key is the HANDLER, because a handler body is one boolean and needs from different
     * handlers are genuinely independent. It is read off the need rather than assumed. */
    const groups = new Map();
    for (const n of needs) {
      const k = n.by + '|' + n.handler;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(n);
    }
    const pickForGroup = (g, mpool, ctx) => {
      const ok = [];
      for (const mid of mpool) if (g.every(n => PRE.satisfiesNeed(mid, n, ctx))) ok.push(mid);
      /* ranked by `pickForNeed`, over the restricted pool, so the harness-breaking filter and the
       * scoring stay in ONE place rather than being reimplemented here */
      return ok.length ? pickForNeed(g[0], new Set(ok), ctx) : null;
    };
    for (const g of groups.values()) {
      const sides = g[0].by === 'either' ? ['actor', 'receiver'] : [g[0].by];
      let got = null;
      for (const side of sides) {
        const ctx = side === 'actor' ? { userTypes: aTypes, targetTypes: rTypes }
                                     : { userTypes: rTypes, targetTypes: aTypes };
        const m = pickForGroup(g, side === 'actor' ? pool : recvPool, ctx);
        if (!m) continue;
        (side === 'actor' ? A : R).push(m);
        got = side;
        break;
      }
      if (!got) return null;              /* this body cannot supply every need */
    }
    return { carrier: sp.id, actor: A, receiver: R, receiverSpecies: id(receiverSp) };
  };
  return tryHolder(ITEM_HOLDER) || LEGAL_SPECIES.map(s => s.id).reduce(
    (acc, s) => acc || tryHolder(s), null);
}

/* ================= THE BOARD-STATE RUNG (2026-08-19) ==============================================
 *
 * `fixture_preflight` clause 6 has been able to SAY what a row needed since it was written — "Focus
 * Sash needs a full-HP body taking a lethal hit, Shed Shell a trapped one, Mental Herb a volatile
 * already present" — and its own comment says the quiet part: *"This one cannot be satisfied by
 * anything anybody clicks."* That sentence was true of the two rungs that existed and it is not true
 * of the game. **Every one of those states is reachable; no rung built one.**
 *
 * MEASURED at release 926e810dd8a0: 50 of the 73 in-scope items fire and 23 do not, and every one of
 * the 23 is EXPLAINED and untested. FOCUS SASH is 81.8% of 2,126 Arcanine-Hisui sheets and 72.5% of
 * 7,717 Whimsicott sheets in the live store — one of the most-held items in the format, and this
 * harness had never once made it do anything. An explained row is not a tested row, and a row nothing
 * tests is not evidence that the engine is right about it.
 *
 * ---- THE RULE THIS FOLLOWS, AND THE ONE IT REFUSES ------------------------------------------------
 *
 * DERIVED FROM THE MECHANIC'S OWN NEED, NEVER FROM ITS NAME. `PRE.boardNeeds` already reads the state
 * out of the handler; this turns each state into a CLICK, by asking the authority's own move data
 * which move produces it. Nothing below names an item, and the only move names are read off `dex`:
 *
 *   ko-hit            a move with `ohko` — `getDamage` returns `target.maxhp` for it, so `damage >=
 *                     target.hp` holds AT FULL HP with no damage arithmetic anywhere in this file.
 *                     Reimplementing the damage formula to find "a hit that is lethal from full"
 *                     would be a second copy of a FACT, which CLAUDE.md names as how two files come
 *                     to disagree invisibly.
 *   own-stat-dropped  the existing `statDrop` need predicate, thrown by the receiver
 *   volatile-present  a move whose `volatileStatus` (or a non-self secondary's) is one the handler reads
 *   status-present    a move whose `status` (or a non-self secondary's) is the one the handler reads —
 *                     `PRE.statusesRead` says WHICH, off the same source the clause reads
 *   heal-effect       `move.drain` for the `drain` sub-effect; the other four values ARE move ids
 *   trapped           `volatileStatus: 'partiallytrapped'`, or a move whose own source sets `.trapped`
 *   pp-exhausted      a move whose source calls `deductPP`, thrown twice at a 5-PP move
 *
 * THE DECLARATION IS A RECEIPT, NOT AN INTENTION. `boardState` is handed to the preflight only for a
 * need whose staging move RESOLVED in SHOWDOWN'S OWN LOG — read by `verdictFor`, the same reader the
 * move arm's verdict comes from. A fixture that declares a state it failed to build would clear the
 * clause and leave the row in `did_not_fire_unexplained`, which is the one bucket this whole mechanism
 * exists to empty; declaring from the authority's log is the only version that cannot do that.
 *
 * IT IS A THIRD RUNG, ADDED AFTER THE OTHER TWO AND NEVER INSTEAD OF THEM. That is the rule the
 * abilities arm had to learn twice (Hustle and Torrent both regressed when a trigger was a SWAP): a
 * row that already fires on `safe-pool` or `real-pool` never reaches this code, so no row can regress
 * by construction rather than by measurement. */
const _SRC_SEEN = new WeakSet();
function entrySrc(e) {
  const parts = [];
  (function walk(x, d) {
    if (!x || d > 3) return;
    if (typeof x === 'function') { parts.push(String(x)); return; }
    if (typeof x !== 'object') return;
    if (_SRC_SEEN.has(x)) { /* a shared sub-object is still walked once per entry */ }
    for (const v of Object.values(x)) walk(v, d + 1);
  })(e, 0);
  return parts.join('\n');
}
/* A move that would rewrite the board the rung is standing on. Same list as `pickForNeed`'s, minus
 * `ohko` — an OHKO move is not harness-breaking here, it is the entire `ko-hit` staging — and PLUS
 * `stallingMove`, which cost the headline row on the first run of this rung.
 *
 * MEASURED: Focus Sash's board staged perfectly (Pinsir's Guillotine landed on a full-HP Corviknight)
 * and the row still read DID-NOT-FIRE, because the HOLDER'S filler click was ENDURE — which survives a
 * lethal hit at 1 HP in BOTH arms and is therefore Focus Sash's own effect, granted to the control.
 * Leppa Berry failed the other way round on the same flag: the filler was PROTECT, which blocked the
 * very Spite that was supposed to drain its PP. `stallingMove` is the authority's own flag on Protect,
 * Detect, Endure and their family, so both are refused by one derived test rather than two names. */
const stateBreaking = (m) => !!(m.selfdestruct || m.selfSwitch || m.forceSwitch || m.stallingMove
  || (m.flags || {}).charge || (m.flags || {}).recharge || m.isZ || m.isMax);
const FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe', 'allAdjacentFoes', 'allAdjacent',
                             'randomNormal', 'scripted']);
const hitsFoe = (m) => FOE_TARGETS.has(m.target);
const secOf = (m) => [].concat(m.secondaries || [], m.secondary ? [m.secondary] : []).filter(Boolean);
function pickMove(pool, pred) {
  const out = [];
  for (const mid of pool) {
    const mv = dex.moves.get(mid);
    if (!mv || !mv.exists || mv.isNonstandard) continue;
    if (stateBreaking(mv)) continue;
    if (!pred(mv)) continue;
    out.push(mv.id);
  }
  return out.sort()[0] || null;   /* deterministic: a re-run stages the same game */
}
/* ONE NEED -> THE CLICKS THAT PUT IT ON THE BOARD. `H` and `R` are {sp, types, pool}. Returns null when
 * this pair cannot supply it, which is what makes the pair search below meaningful. */
function stageStateNeed(n, H, R) {
  const reachesH = (m) => dex.getImmunity(m.type, H.types);
  const reachesR = (m) => dex.getImmunity(m.type, R.types);
  const one = (recvMoves, steps, extra) => Object.assign(
    { actorMoves: [], recvMoves, steps, hpBoost: null, declares: {} }, extra || {});
  switch (n.kind) {
    case 'ko-hit': {
      /* THE HOLDER'S OWN ABILITY MUST NOT ALREADY DO THIS. Sturdy reads the identical guard, so a
       * Sturdy holder survives in BOTH arms and Focus Sash reads DID-NOT-FIRE off a board where it was
       * simply pre-empted. Derived by asking the ability the same question, never by naming Sturdy. */
      const abs = Object.values(dex.species.get(H.sp).abilities || {});
      const slot0 = dex.abilities.get(abs[0] || '');
      if (slot0 && slot0.exists && PRE.boardNeeds(slot0).some(x => x.kind === 'ko-hit')) return null;
      const m = pickMove(R.pool, (mv) => mv.ohko && reachesH(mv));
      if (!m) return null;
      return one([m], [{ r: m, rT: 0 }],
                 { hpBoost: 1, declares: { koHit: true },
                   receipt: { kind: 'ko-hit', by: 'receiver', move: m } });
    }
    case 'own-stat-dropped': {
      const m = pickForNeed({ kind: 'statDrop', values: n.values || [], by: 'receiver' }, R.pool,
                            { userTypes: R.types, targetTypes: H.types });
      if (!m) return null;
      return one([m], [{ r: m, rT: 0 }],
                 { declares: { ownStatDropped: true },
                   receipt: { kind: 'own-stat-dropped', by: 'receiver', move: m } });
    }
    case 'volatile-present': {
      /* `attract` IS DELIBERATELY NOT STAGED AND SAYS SO. Every body this harness builds is `gender:'N'`
       * — `buildPair` writes it because medicham2 has no gender at all and a declared one parts the
       * streams on line one — and attract's own condition refuses a genderless pair. Staging it would
       * produce a move that resolves into nothing, which is worse than not staging it. */
      const want = (n.values || []).filter(v => v !== 'attract');
      for (const v of want) {
        const m = pickMove(R.pool, (mv) => reachesH(mv) && hitsFoe(mv)
          && (mv.volatileStatus === v || secOf(mv).some(s => s.volatileStatus === v && !s.self)));
        /* A WARM-UP TURN IN FRONT, AND IT WAS MEASURED RATHER THAN ADDED FOR SAFETY. Mental Herb's
         * plan staged ENCORE, and Encore fails against a body that has not used a move yet — so the
         * only receiver-side staging in this rung that needed a history did not have one, and the row
         * came back with an unmet receipt on the first run that could report one. Same rung the move
         * arm already calls `warm-up`, for the same three moves (Disable, Encore, Spite). Harmless
         * where it is not needed: the holder simply throws its filler a turn early. */
        if (m) return one([m], [{}, { r: m, rT: 0 }],
                          { declares: { volatiles: [v] },
                            receipt: { kind: 'volatile-present', by: 'receiver', move: m } });
      }
      return null;
    }
    case 'heal-effect': {
      const vals = (n.values || []).map(id);
      /* `drain` is the SUB-EFFECT the simulator passes when a drain move heals (battle-actions.ts —
       * `this.battle.heal(…, 'drain')`), so any `move.drain` supplies it. The other four values are
       * MOVE IDS and are looked up as such. */
      let m = vals.includes('drain')
        ? pickMove(H.pool, (mv) => mv.drain && reachesR(mv) && hitsFoe(mv)) : null;
      let self = false;
      if (!m) { m = vals.find(v => v !== 'drain' && H.pool.has(v)) || null; self = true; }
      if (!m) return null;
      /* A HEAL AT FULL HP HEALS NOTHING, so the receiver punches the hole one turn early. Same rule
       * `scriptFor`'s `selfDamage` follows, one arm over. */
      const hit = pickMove(R.pool, (mv) => mv.category !== 'Status' && reachesH(mv) && hitsFoe(mv));
      if (!hit) return null;
      return one([hit], [{ r: hit, rT: 0 }, { a: m, aT: 0 }],
                 { actorMoves: [m], declares: { healEffects: [vals.includes('drain') && !self ? 'drain' : id(m)] },
                   receipt: { kind: 'heal-effect', by: 'actor', move: m } });
    }
    case 'trapped': {
      const m = pickMove(R.pool, (mv) => reachesH(mv) && hitsFoe(mv)
        && (mv.volatileStatus === 'partiallytrapped' || /\.trapped\s*=\s*true/.test(entrySrc(mv))));
      if (!m) return null;
      /* AND THEN THE HOLDER TRIES TO LEAVE, because the trap is only observable in the attempt.
       * WITHOUT the item Showdown REFUSES that choice and `playGame` throws — which `playScenario`
       * catches and reports as `could not stage`, so the row keeps its earlier CANNOT-FIRE verdict
       * rather than turning into a crash. That is the intended failure mode and it is why this rung is
       * last: a throw here can never take a verdict away from a row that already had one. */
      return one([m], [{ r: m, rT: 0 }, { sw: true }],
                 { declares: { trapped: true },
                   receipt: { kind: 'trapped', by: 'receiver', move: m } });
    }
    case 'pp-exhausted': {
      const spite = pickMove(R.pool, (mv) => hitsFoe(mv) && /deductPP/.test(entrySrc(mv)));
      /* THE SLOT THAT RUNS DRY. 5 base PP is 8 at full, and two `deductPP(…, 4)` plus the holder's own
       * clicks take it to zero inside four turns. Read off `mv.pp`, never a move name. */
      const low = pickMove(H.pool, (mv) => mv.pp === 5 && !mv.ohko);
      if (!spite || !low) return null;
      return one([spite], [{ a: low, aT: 0 }, { a: low, aT: 0, r: spite, rT: 0 },
                           { a: low, aT: 0, r: spite, rT: 0 }, { a: low, aT: 0 }],
                 { actorMoves: [low], declares: { ppExhausted: true },
                   receipt: { kind: 'pp-exhausted', by: 'receiver', move: spite, watch: low } });
    }
    default: return null;
  }
}
/* THE STATUS CLAUSE IS NOT A `boardNeeds` ROW — it is clause 3 — so it is turned into a need-shaped
 * object here and staged by the same machinery. Its VALUES come from `PRE.statusesRead`, off the same
 * handler text the clause reads, so the two can never disagree about which status is wanted. */
function stageStatusNeed(values, H, R) {
  const any = !values.length || values.includes('any');
  const want = any ? ['par', 'brn', 'psn', 'slp', 'frz', 'tox'] : values;
  for (const s of want) {
    const m = pickMove(R.pool, (mv) => hitsFoe(mv) && dex.getImmunity(mv.type, H.types)
      && ((mv.status === s) || secOf(mv).some(x => x.status === s && !x.self)));
    if (!m) continue;
    /* THE STATUS MUST BE ABLE TO LAND ON THIS BODY, and the authority already answers that: an Electric
     * type refuses paralysis, a Fire type a burn, a Steel or Poison type poison. Asked through the
     * preflight's own legality clauses rather than re-derived here. */
    /* `PRE.check` DIRECTLY AND NOT THIS FILE'S `preflight()` WRAPPER: this is the plan SEARCH, which
     * asks hundreds of candidate boards per row, and routing them through the counted wrapper would
     * bury the run's real clause tally under the search's own rejects (measured: 133 spurious
     * `target-status-immune` on a 14-row probe). The wrapper counts what was ASKED OF A ROW. */
    if (!PRE.check({ species: dex.species.get(R.sp).name, move: dex.moves.get(m).name,
                     target: dex.species.get(H.sp).name }).ok) continue;
    return { actorMoves: [], recvMoves: [m], steps: [{ r: m, rT: 0 }], hpBoost: null,
             declares: { status: s }, receipt: { kind: 'status-present', by: 'receiver', move: m } };
  }
  return null;
}
/* THE ORDER THE STATES ARE PUT ON THE BOARD IN, and only one of them is load-bearing: `ko-hit` reads
 * `target.hp === target.maxhp`, so its turn has to be the FIRST one or the fixture has already spent
 * the precondition it is staging. */
const STATE_ORDER = ['ko-hit', 'status-present', 'own-stat-dropped', 'volatile-present',
                     'heal-effect', 'trapped', 'pp-exhausted'];
const STATE_STAGEABLE = new Set(STATE_ORDER);
const STATE_PLAN = { rows: 0, planned: 0, unplanned: 0, declared: 0, receipts_failed: 0,
                     by_kind: {}, unplanned_kinds: {}, examples: [], pairs_searched: 0 };
/* WHO MAY STAND OPPOSITE. The default receiver first — a row that already staged keeps the board it
 * staged on — then the immunity-free alternates the item arm already computes, then the whole legal
 * roster, because a state need is a claim about ONE move being throwable and nothing else. */
let STATE_RECEIVER_ORDER = null;
function stateReceivers() {
  if (!STATE_RECEIVER_ORDER) {
    const seen = new Set();
    STATE_RECEIVER_ORDER = [id(RECEIVER.species), ...ALT_RECEIVERS, ...LEGAL_SPECIES.map(s => s.id)]
      .filter(x => (seen.has(x) ? false : (seen.add(x), true)));
  }
  return STATE_RECEIVER_ORDER;
}
const bodyCtx = (sid) => ({ sp: id(sid), types: (dex.species.get(sid) || {}).types || [],
                            pool: POOL.get(id(sid)) || new Set() });
/** boardPlanFor(entity, preferredHolder) -> a plan, or null when nothing here is stageable.
 *  `needs` are `PRE.boardNeeds` filtered to the kinds this file can build, plus the status clause. */
function boardPlanFor(entity, preferredHolder) {
  const bn = PRE.boardNeeds(entity) || [];
  const wanted = bn.filter(n => STATE_STAGEABLE.has(n.kind));
  const statusVals = PRE.statusesRead(entity);
  const speciesGate = bn.find(n => n.kind === 'species-gated');
  if (!wanted.length && !statusVals.length && !speciesGate) return null;
  STATE_PLAN.rows++;
  /* A SPECIES GATE IS NOT A TURN, IT IS A CASTING DECISION — the one board need the preflight calls
   * BLOCKING, because no click can make one body another. It is answered by holding the item on the
   * species the handler names, when this format admits it. */
  const gateSp = speciesGate ? (dex.species.all().find(s => PRE.legal(s)
    && id(s.baseSpecies || s.name) === id(speciesGate.values[0])) || null) : null;
  const holders = [];
  if (gateSp) holders.push(gateSp.id);
  else { if (preferredHolder) holders.push(id(preferredHolder)); holders.push(ITEM_HOLDER); }
  const order = [].concat(
    statusVals.length ? [{ kind: 'status-present', values: statusVals }] : [],
    wanted).sort((a, b) => STATE_ORDER.indexOf(a.kind) - STATE_ORDER.indexOf(b.kind));
  const holderList = gateSp ? [gateSp.id] : holders.concat(LEGAL_SPECIES.map(s => s.id));
  /* THE HOLDER IS THE OUTER LOOP AND THE PREFERRED ONE IS FIRST, so the common case — a receiver-side
   * need that the default pair already supplies — costs one pass and the search never runs wide. The
   * cap is a stated bound rather than a hope: a row that exhausts it is COUNTED and reported, because
   * a search that quietly gave up looks exactly like a state that cannot be built. */
  const CAP = 4000;
  let searched = 0;
  for (const hs of holderList) {
    const H = bodyCtx(hs);
    for (const rs of stateReceivers()) {
      const R = bodyCtx(rs);
      if (id(hs) === R.sp) continue;
      if (++searched > CAP) { STATE_PLAN.capped = (STATE_PLAN.capped || 0) + 1; break; }
      STATE_PLAN.pairs_searched++;
      const parts = [];
      let ok = true;
      for (const n of order) {
        const p = n.kind === 'status-present' ? stageStatusNeed(n.values, H, R) : stageStateNeed(n, H, R);
        if (!p) { ok = false; break; }
        parts.push(Object.assign({ need: n }, p));
      }
      if (!ok || (!parts.length && !gateSp)) continue;
      const plan = { holder: H.sp, receiverSpecies: R.sp,
                     actorMoves: [], recvMoves: [], steps: [], declares: {}, receipts: [],
                     hpBoost: null, kinds: order.map(n => n.kind), species_gated: !!gateSp };
      for (const p of parts) {
        for (const m of p.actorMoves) if (!plan.actorMoves.includes(m)) plan.actorMoves.push(m);
        for (const m of p.recvMoves) if (!plan.recvMoves.includes(m)) plan.recvMoves.push(m);
        plan.steps = plan.steps.concat(p.steps);
        if (p.hpBoost) plan.hpBoost = p.hpBoost;
        if (p.receipt) plan.receipts.push(Object.assign({ declares: p.declares }, p.receipt));
        else Object.assign(plan.declares, p.declares);   /* a gate has nothing to read back */
      }
      /* A SETTLE TURN, so an `onUpdate`/`onResidual` consequence has a boundary to land on — EXCEPT
       * after a `ko-hit`, where the control arm's holder is dead and a further turn would be the
       * harness choosing a replacement rather than the mechanic showing itself. */
      if (!plan.receipts.some(r => r.kind === 'ko-hit')) plan.steps.push({ settle: true });
      STATE_PLAN.planned++;
      for (const k of plan.kinds) STATE_PLAN.by_kind[k] = (STATE_PLAN.by_kind[k] || 0) + 1;
      if (STATE_PLAN.examples.length < 40)
        STATE_PLAN.examples.push((entity.id || entity.name) + ' [' + plan.kinds.join('+') + '] '
          + plan.holder + ' vs ' + plan.receiverSpecies + '  a:[' + plan.actorMoves.join(',')
          + '] r:[' + plan.recvMoves.join(',') + ']');
      return plan;
    }
    if (searched > CAP) break;
  }
  STATE_PLAN.unplanned++;
  for (const n of order) STATE_PLAN.unplanned_kinds[n.kind] = (STATE_PLAN.unplanned_kinds[n.kind] || 0) + 1;
  return null;
}
/* THE PLAN AS A SCRIPT. Both allies click Protect exactly as the gauntlet's do, so the only thing that
 * differs between the two arms is the mechanic under test. */
function statePlanScript(bodies, plan) {
  const { actor, ally, receiver, foeAlly } = bodies;
  const A = { m: clickOf(ally, ['Protect', 'Endure']) };
  const F = { m: clickOf(foeAlly, ['Protect', 'Endure']) };
  /* THE HOLDER'S FILLER MAY NOT BE A GUARD — see `stateBreaking`. An ordinary attack is preferred
   * because it is the one filler that cannot survive, block or heal anything the rung is staging, and
   * the last resort is any non-stalling move the body actually holds. IDENTICAL IN BOTH ARMS, so the
   * A/B still differs in the item and in nothing else. */
  const aIdle = (() => {
    const have = ((actor || {}).moves || []).map(id);
    const ok = (k) => { const m = dex.moves.get(k); return m && m.exists && !m.stallingMove; };
    for (const p of ['Facade', 'Body Slam', 'Round', 'Rest']) if (have.includes(id(p)) && ok(id(p))) return id(p);
    return have.find(ok) || have[0] || GAME_RULES.PAD_MOVE;
  })();
  const rIdle = clickOf(receiver, ['Agility', 'Endure', 'Protect']);
  const turns = [];
  for (const s of plan.steps) {
    if (s.sw) { turns.push({ p1: [{ sw: id(bodies.benchKey) }, A], p2: [{ m: rIdle }, F] }); continue; }
    if (s.settle) { turns.push({ p1: [{ m: aIdle }, A], p2: [{ m: rIdle }, F] }); continue; }
    turns.push({ p1: [s.a ? { m: s.a, t: s.aT == null ? 0 : s.aT } : { m: aIdle }, A],
                 p2: [s.r ? { m: s.r, t: s.rT == null ? 0 : s.rT } : { m: rIdle }, F] });
  }
  return turns;
}
/* DID THE FIXTURE ACTUALLY BUILD THE STATE? Read off SHOWDOWN'S OWN LOG with `verdictFor`, the same
 * reader the whole move arm's verdict comes from — never off medicham2, and never off the intention.
 * The two arms are both consulted because a `ko-hit` shows in the CONTROL arm (the holder dies) and a
 * cure shows in the LIVE one. */
function stateReceipts(plan, on, off, who) {
  const out = { declared: {}, met: [], unmet: [] };
  if (!plan) return out;
  Object.assign(out.declared, plan.declares);
  const logs = [on && on.staged ? on.sdLog : null, off && off.staged ? off.sdLog : null].filter(Boolean);
  for (const r of plan.receipts) {
    const thrower = r.by === 'receiver' ? 'p2a: ' + (dex.species.get(plan.receiverSpecies).baseSpecies
                                                  || dex.species.get(plan.receiverSpecies).name)
                                        : who;
    const landed = logs.some(l => (verdictFor(l, thrower, r.move) || {}).resolved);
    if (landed) { Object.assign(out.declared, r.declares); out.met.push(r.kind + ':' + r.move); }
    else { out.unmet.push(r.kind + ':' + r.move); STATE_PLAN.receipts_failed++; }
  }
  if (out.met.length) STATE_PLAN.declared++;
  return out;
}

/* ================= THE STRUGGLE ROW (harness batch HB-5, 2026-09-11) ==============================
 *
 * The carrier is DERIVED: the first legal species (sorted) other than the receiver, with a clean
 * ability, whose pool holds a 5-PP damaging single-target move with no secondary, no charge, no
 * recharge, no self-KO and no hit count — so the dry slot's own clicks change nothing but HP and PP.
 * The body holds THAT MOVE ALONE, so when its slot runs dry Struggle is all the request offers.
 *
 * THE NUMBER OF DRY CLICKS IS READ OFF THE AUTHORITY, NOT TYPED: a one-turn measuring game reads
 * `moveSlots[0].maxpp` on Showdown's body and `pp`/`maxpp` on medicham2's through the read-only
 * `onBattle` hook, and the two must agree before the row is played. The fixture is then proven off the
 * authority's own log (`|move|p1a: …|Struggle`), never assumed from the arithmetic. */
const STRUGGLE_ID = 'struggle';
const STRUGGLE_SUMMARY = { carrier: null, dry_move: null, maxpp_showdown: null, maxpp_medicham: null, why: null };
/* ONE FIXTURE, TWO CALLERS: the row below and red plant 9. Memoised so the measuring game is played
 * once per process. Returns null with a reason on `STRUGGLE_SUMMARY.why` when nothing can be staged. */
let _struggleFx;
function struggleFixture() {
  if (_struggleFx !== undefined) return _struggleFx;
  const clean = (m) => m && m.exists && !m.isNonstandard && m.pp === 5 && m.category !== 'Status'
    && m.target === 'normal' && !m.flags.charge && !m.flags.recharge && !m.selfdestruct && !m.ohko
    && !m.multihit && !m.self && !m.secondary && !(m.secondaries && m.secondaries.length) && !m.noPPBoosts;
  let carrier = null, dry = null;
  for (const s of LEGAL_SPECIES.map(x => x.id).sort()) {
    if (s === id(RECEIVER.species)) continue;
    if (!Object.values(dex.species.get(s).abilities || {}).some(a => !DISRUPTIVE_ABILITY(id(a)))) continue;
    const m = [...(POOL.get(s) || [])].sort().map(k => dex.moves.get(k)).find(clean);
    if (m) { carrier = s; dry = m; break; }
  }
  const fail = (why) => { STRUGGLE_SUMMARY.why = why; _struggleFx = null; return null; };
  if (!carrier) return fail('no legal body holds a clean 5-PP move to run dry');
  const ab = Object.values(dex.species.get(carrier).abilities).find(a => !DISRUPTIVE_ABILITY(id(a)));
  const actor = bodyOf(carrier, ab, '', [dry.name]);
  const receiver = bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES);
  if (!actor || !receiver || actor.moves.length !== 1) return fail('the one-move body could not be built');
  Object.assign(STRUGGLE_SUMMARY, { carrier, dry_move: dry.id });
  const who = 'p1a: ' + (dex.species.get(carrier).baseSpecies || dex.species.get(carrier).name);
  /* THE PADS CYCLE THEIR THREE MOVES. Measured on the first HB-5 run: a pad clicking Protect on every
   * one of ten turns ran it dry and the authority refused the turn ("Venusaur's Protect is disabled"),
   * so the game threw before Struggle was reached. Cycling spreads the PP across the pad's own set. */
  const script = (n) => { const b = stageBodies(actor, receiver);
    const padAt = (body, k) => ({ m: clickOf(body, [PAD_MOVES[k % PAD_MOVES.length]].concat(PAD_MOVES)) });
    const inert = clickOf(receiver, ['Agility', 'Endure']);
    const t = [];
    for (let k = 0; k < n + (n ? 2 : 0); k++)
      t.push({ p1: [{ m: k < n ? dry.id : STRUGGLE_ID, t: 0 }, padAt(b.ally, k)], p2: [{ m: inert }, padAt(b.foeAlly, k)] });
    return { b, t }; };
  /* THE MEASURING GAME — one click, both engines' max PP read at boundary 0. */
  { const { b } = script(0);
    const one = { p1: [{ m: dry.id, t: 0 }, { m: clickOf(b.ally, ['Protect', 'Endure']) }],
                  p2: [{ m: clickOf(receiver, ['Agility', 'Endure']) }, { m: clickOf(b.foeAlly, ['Protect', 'Endure']) }] };
    playScenario(Object.assign({ script: [one], tag: 'move/struggle/measure', onBattle: (S, battle, t) => {
      if (t !== 0) return;
      const sdb = battle.sides[0].active[0], meb = (S.actA || [])[0];
      const slot = sdb && (sdb.moveSlots || []).find(x => id(x.id) === dry.id);
      STRUGGLE_SUMMARY.maxpp_showdown = slot ? slot.maxpp : null;
      /* medicham2's `_pp` is LAZY (board_state.js:351) — an unclicked slot is absent — so its side of
       * the PP question is answered where it is already asked: `board_state.js` compares SPENT PP per
       * slot at every boundary (`pp_comparable`), and the row's board carries that receipt. */
      STRUGGLE_SUMMARY.maxpp_medicham = meb ? 'compared as spent PP by board_state.js at every boundary' : null;
    } }, b)); }
  const n = STRUGGLE_SUMMARY.maxpp_showdown;
  if (!n) return fail('the authority\'s max PP for ' + dry.id + ' could not be read');
  _struggleFx = { carrier, dry, who, n, receiver, script,
                  play: (tag, plant) => { const { b, t } = script(n);
                    return { t, r: playScenario(Object.assign({ script: t, tag, statePlant: plant }, b)) }; } };
  return _struggleFx;
}
function runStruggle(dm) {
  const fx = struggleFixture();
  if (!fx) return { kind: 'move', id: dm.id, name: dm.name, resolved: false, attempted: false,
                    carrier: STRUGGLE_SUMMARY.carrier, why: STRUGGLE_SUMMARY.why };
  const { carrier, dry, who, n, receiver } = fx;
  const { t, r } = fx.play('move/struggle/dry-' + n);
  if (!r.staged) return { kind: 'move', id: dm.id, name: dm.name, resolved: false, attempted: false, carrier,
                          why: 'could not stage: ' + r.why };
  const sd = verdictFor(r.sdLog, who, STRUGGLE_ID), me = verdictFor(r.mediTrace, who, STRUGGLE_ID);
  const receipt = (r.sdLog || []).find(l => new RegExp('^\\|move\\|' + reEsc(who) + '\\|Struggle').test(String(l))) || null;
  const row = { kind: 'move', id: dm.id, name: dm.name, carrier, rung: 'out-of-pp', setup: [dry.id + ' x' + n],
                turns: t.length, attempted: sd.attempted, resolved: sd.resolved, why: sd.why,
                medicham_attempted: me.attempted, medicham_resolved: me.resolved, medicham_why: me.why,
                diverged: !!r.div, divergence: divOf(r.div, who, r.sdLog, STRUGGLE_ID), err: r.err,
                fixture: { dry_move: dry.id, dry_clicks: n, maxpp_showdown: n,
                           maxpp_medicham: STRUGGLE_SUMMARY.maxpp_medicham, authority_receipt: receipt } };
  /* NO RECEIPT, NO BOARD — the same rule the stone and board-only arms keep. */
  if (receipt) row.board = boardVerdict(r, 'move', STRUGGLE_ID);
  else { row.board_unproven = boardVerdict(r, 'move', STRUGGLE_ID);
         row.why = (row.why ? row.why + ' — ' : '') + 'the authority never struggled; the dry-slot fixture did not land'; }
  /* THE SAME PREFLIGHT EVERY MOVE ROW GETS — measured: without it a one-row run tripped "THE PREFLIGHT
   * NEVER RAN ON A SINGLE ROW", and the row was the only move row without `preflight`. The MOVE is not
   * declared to it, and that was measured too: declared, the `move-on-species` clause BLOCKED the row
   * (no species learns Struggle, which is the point) and then saw it resolve — "THE CLAUSE IS WRONG".
   * Learnability is the one question that does not apply to the fallback every body is left with. */
  labelRow(row, preflight({ species: dex.species.get(carrier).name,
                            target: dex.species.get(id(receiver.species)).name }), !!row.resolved);
  return row;
}

/* ================= THE MEGA STONE ROW (harness batch HB-4, 2026-09-11) ============================
 *
 * UNTIL TODAY EVERY STONE WAS EXCUSED HERE, and the excuse pointed at the deliberate roster — a SINGLE
 * staged turn. Nothing in this repository had compared the ACT OF EVOLVING inside a real game: the
 * damage differential compares mega FORMES (a body built already evolved), `probe_mega_spread_stat.js`
 * compares a stat line inside medicham2 against the authority's formula, and neither plays the turn
 * the stone is used and then the turns after it. 58,785 pinned-pool sheets carry a stone.
 *
 * THE ROW. ON = the stone's base forme HOLDING the stone, asking to mega on turn 1 (`megaScript`).
 * OFF = the same body holding nothing — the item arm's own A/B, "swapping it for (no item)". The board
 * is read off ON and carries the STAT LINE as well (see `playScenario`), because a mega is a new stat
 * line and `board_state.js` does not compare one.
 *
 * THE FIXTURE IS READ OFF THE AUTHORITY, NEVER ASSUMED. A row counts only if Showdown's own log shows
 * `|-mega|p1a: …` in the ON game. A refused ask is counted off the driver (`scriptMegaRefused`), and a
 * row whose authority never evolved loses its board: a board of a body holding a rock is not a board
 * of a mega evolution, and it must not add to the count. */
const STONE_SUMMARY = { rows: 0, staged: 0, fired: 0, mega_seen_showdown: 0, mega_seen_medicham: 0,
                        mega_refused: 0, not_seen: [], stat_line_compared: 0, stat_line_unreadable: 0,
                        stat_line_parted: [], alt_receiver: [] };
const megaSeen = (log) => (log || []).some(l => /^\|-mega\|p1a: /.test(String(l)));
/* THE GAUNTLET, WITH THE ASK. Turn 1's actor click carries `mega: true` whenever the actor HOLDS an
 * item, so the OFF arm (no item) never asks and cannot inflate `scriptMegaRefused`. */
function megaScript(b, beats, faces, thenWhat) {
  const t = gauntletScript(b, beats, faces, thenWhat);
  if (b.actor && b.actor.item && !BREAK_MEGA && t[0] && t[0].p1 && t[0].p1[0] && t[0].p1[0].m)
    t[0].p1[0] = Object.assign({}, t[0].p1[0], { mega: true });
  return t;
}
/* THE RECEIVER, UNLESS THE STONE'S OWN BASE IS THE RECEIVER. Feraligite evolves Feraligatr, and a sheet
 * cannot carry one species on both sides — the fallback is the item arm's derived `ALT_RECEIVERS`
 * (legal, immune to nothing by the authority's chart, no immunity-conferring ability). */
function stoneReceiverFor(base) {
  if (id(base) !== id(RECEIVER.species)) return RECEIVER.species;
  return ALT_RECEIVERS.find(x => x !== id(base)) || null;
}
function stoneGame(e, item, tag, plant) {
  const recvSp = stoneReceiverFor(e.base);
  const rb = recvSp && bodyOf(recvSp, id(recvSp) === id(RECEIVER.species) ? RECEIVER.ability : '', RECEIVER.item, RECEIVER_MOVES);
  const ab = bodyOf(e.base, '', item, GAUNTLET_ACTOR_MOVES);
  if (!rb || !ab) return { staged: false, why: 'a stone body could not be built' };
  const b = stageBodies(ab, rb);
  /* x1 pool — see `runStone`: the authority's forme change drops the fixture's x6 HP boost. */
  return playScenario(Object.assign({ script: megaScript(b, 1), tag, hpBoost: 1, statLine: e.base, statePlant: plant }, b));
}
function runStone(di) {
  const e = STONE_OF.get(di.id);
  const sv = SCOPE.verdict('item', di.id);
  if (!sv.inScope) return { kind: 'item', id: di.id, name: di.name, fired: false, unreachable: true,
                            scope_code: sv.code, why: sv.code + ' — ' + sv.why };
  if (!e) return { kind: 'item', id: di.id, name: di.name, fired: false, staging_gap: true,
                   why: 'IN SCOPE (' + sv.code + ') and this harness paired no legal base with its mega — a staging gap, not a claim about the format' };
  STONE_SUMMARY.rows++;
  const recvSp = stoneReceiverFor(e.base);
  if (recvSp && id(recvSp) !== id(RECEIVER.species)) STONE_SUMMARY.alt_receiver.push(di.id + '->' + recvSp);
  const receiver = recvSp && bodyOf(recvSp, id(recvSp) === id(RECEIVER.species) ? RECEIVER.ability : '',
                                    RECEIVER.item, RECEIVER_MOVES);
  const mkOn = () => bodyOf(e.base, '', di.name, GAUNTLET_ACTOR_MOVES);
  const mkOff = () => bodyOf(e.base, '', '', GAUNTLET_ACTOR_MOVES);
  const r0 = GD.scriptCounters().megaRefused;
  const onBy = {};
  /* BOTH RUNGS ARE THE REAL POOL, AND THE x6 POOL WAS MEASURED WRONG FOR THIS ROW, NOT ASSUMED.
   * The first smoke run (5 stones, 2026-09-11) put every row at STATE on turn 1 with medicham2 holding
   * exactly six times the authority's max HP (990 against 165 on Abomasnow). `HP_BOOST` is a FIXTURE
   * device the driver writes into both engines at build time; the authority's forme change recomputes
   * the whole line from the set (`setSpecies`, sim/pokemon.ts:1393-1404) and so drops the boost, while
   * medicham2 carries the boosted body across. No real game has a boost, so the comparison would be
   * of the harness against itself. The stone rows therefore play the x1 pool, one beat, then three. */
  const rungs = [
    { id: 'mega-real-pool', hpBoost: 1, beats: 1, statLine: e.base, script: (b) => megaScript(b, 1) },
    { id: 'mega-real-pool-3', hpBoost: 1, beats: 3, statLine: e.base, script: (b) => megaScript(b, 3) },
  ];
  const row = receiver ? abLadderOver(rungs, 'item', di.id, di.name, e.base, '(no item)', mkOn, mkOff,
                                      receiver, null, null, (rung, on) => { onBy[rung.id] = on; }) : null;
  const refused = GD.scriptCounters().megaRefused - r0;
  STONE_SUMMARY.mega_refused += refused;
  if (!row) return { kind: 'item', id: di.id, name: di.name, carrier: e.base, fired: false,
                     why: 'could not stage: ' + (receiver ? 'the stone body could not be built' : 'no receiver') };
  const on = onBy[row.rung];
  const sdMega = !!(on && on.staged && megaSeen(on.sdLog));
  const meMega = !!(on && on.staged && megaSeen(on.mediTrace));
  if (on && on.staged) STONE_SUMMARY.staged++;
  if (sdMega) STONE_SUMMARY.mega_seen_showdown++;
  if (meMega) STONE_SUMMARY.mega_seen_medicham++;
  if (row.verdict === 'FIRED') STONE_SUMMARY.fired++;
  row.mega = { stone: di.id, base: e.base, mega: e.mega, mega_ability: e.megaAbility, receiver: recvSp,
               asked: !BREAK_MEGA, seen_showdown: sdMega, seen_medicham: meMega, refused,
               other_pairs_not_staged: e.otherPairs };
  row.stat_line = on && on.statLine ? Object.assign({}, on.statLine) : null;
  /* THE GAME'S OWN ERROR, KEPT. The first full stone run ended 44 of 75 ON games as `THREW` at turn 3
   * after a turn-2 faint on the x1 pool, and the row carried no trace of why. A game the harness could
   * not finish is a receipt, not a footnote. */
  row.game_error = (on && on.err) || null;
  if (row.game_error) (STONE_SUMMARY.game_errors = STONE_SUMMARY.game_errors || []).push(di.id + ': ' + row.game_error);
  if (row.stat_line) {
    STONE_SUMMARY.stat_line_compared += row.stat_line.compared;
    STONE_SUMMARY.stat_line_unreadable += row.stat_line.unreadable;
    if (row.stat_line.parted) STONE_SUMMARY.stat_line_parted.push(di.id);
  }
  if (!sdMega) {
    /* NO EVOLUTION IN THE AUTHORITY, NO BOARD. Kept under another key so the reader can still see it. */
    STONE_SUMMARY.not_seen.push(di.id);
    row.board_unproven = row.board; delete row.board; delete row.board_control_arm;
    row.why = (row.why ? row.why + ' — ' : '') + 'the authority never evolved this body (no |-mega| line), '
            + 'so the row is NOT a comparison of a mega evolution and carries no board';
  }
  const sc = { species: dex.species.get(e.base).name, item: di.name,
               target: dex.species.get(recvSp || RECEIVER.species).name,
               teamSize: 4, switchesOut: true, gender: 'N', targetGender: 'N',
               stagedMoves: { actor: ((mkOn() || {}).moves || []).map(id), receiver: ((receiver || {}).moves || []).map(id) },
               armForcesAccuracy: ARM_FORCES.accuracy, armForcesCrit: ARM_FORCES.crit,
               armTieFirst: ARM.tieToSecondBody === false, boardState: {} };
  labelRow(row, preflight(sc), row.verdict === 'FIRED');
  return row;
}

function runItems(list) {
  const rows = [];
  for (const it of list) {
    const di = dex.items.get(it);
    /* A MEGA STONE IS STAGED AS A MEGA EVOLUTION SINCE 2026-09-11 — see `runStone` above. The excuse
     * it replaced pointed at the deliberate roster's single staged turn; the act of evolving inside a
     * game had never been compared. Z-crystals and Poke Balls stay excused: not held items this format
     * uses in battle. */
    if (di.megaStone) { rows.push(runStone(di)); continue; }
    /* THE Z-CRYSTAL / POKE BALL EXCUSE WAS A SCOPE DECISION WITH 0 LEGAL ROWS (2026-09-11); the verdict
     * answers it now, for any item. */
    { const sv = SCOPE.verdict('item', it);
      if (!sv.inScope) {
        rows.push({ kind: 'item', id: it, name: di.name, fired: false, out_of_scope: true, unreachable: true,
                    scope_code: sv.code, why: sv.code + ' — ' + sv.why });
        continue;
      } }
    /* AN ITEM'S CARRIER IS FREE — any legal body may hold any legal item. It is chosen FROM THE ITEM'S
     * OWN NEED (see `holderFor`), default first, and it is the same body in both arms — which is the
     * property the A/B actually depends on. */
    const NEEDS = BREAK_TRIGGERS ? { needs: [], undetermined: [] } : PRE.moveNeeds(di);
    const chosen = NEEDS.needs.length ? holderFor(NEEDS.needs, RECEIVER.species) : null;
    if (NEEDS.needs.length) {
      PREFLIGHT.trigger_rows++;
      PREFLIGHT.trigger_needs += NEEDS.needs.length;
      if (chosen) { PREFLIGHT.trigger_staged += NEEDS.needs.length;
        if (PREFLIGHT.trigger_examples.length < 60)
          PREFLIGHT.trigger_examples.push(it + ' ' + NEEDS.needs.map(n => n.kind
            + (n.values.length ? '=' + n.values.join('|') : '')).join('+') + ' -> ' + chosen.carrier
            + ' [' + chosen.actor.join(',') + ' | ' + chosen.receiver.join(',') + ']');
      } else PREFLIGHT.trigger_unstaged += NEEDS.needs.length;
    }
    const c = (chosen && chosen.carrier) || ITEM_HOLDER;
    /* THE DERIVED MOVE GOES AT THE FRONT OF THE WANT LIST AND THE GAUNTLET'S OWN STAY BEHIND IT —
     * `bodyOf` keeps the front when the list overflows four slots. The trigger turn is ADDED by
     * `gauntletScript` rather than substituted for a beat turn, which is the rule the abilities arm
     * had to learn twice (Hustle and Torrent both regressed when it was a swap). */
    const actorWants = ((chosen && chosen.actor) || []).map(mvName).concat(GAUNTLET_ACTOR_MOVES);
    const recvWants = ((chosen && chosen.receiver) || []).map(mvName).concat(RECEIVER_MOVES);
    const mkActor = (item) => bodyOf(c, '', item, actorWants);
    const recvSp = (chosen && chosen.receiverSpecies) || RECEIVER.species;
    const receiver = bodyOf(recvSp, recvSp === RECEIVER.species ? RECEIVER.ability : '',
                            RECEIVER.item, recvWants);
    const facesUsed = (chosen && (chosen.actor.length || chosen.receiver.length))
      ? { recv: [], actorDerived: chosen.actor.map(mvName), recvDerived: chosen.receiver.map(mvName),
          why: NEEDS.needs.map(n => 'handler ' + n.handler + ': the ' + n.by + ' must supply '
            + n.kind + (n.values.length ? ' (' + n.values.join(' or ') + ')' : '')) }
      : null;
    /* THE SAME QUESTION, ASKED OF THE ITEM'S OWN HANDLERS. `fixture_preflight`'s trigger clauses read
     * only an ABILITY's handlers until 2026-08-12 — the derivation was never ability-specific, the
     * source it was pointed at was. Over the 73 in-scope items it matches 6, all of them status-curing
     * berries on a board where nothing is ever statused, which is precisely a DID-NOT-FIRE that is not
     * an engine gap.
     *
     * ---- AND FOR SIX DAYS AFTER THAT IT STILL COULD NOT EXPLAIN 55 OF THE 61 -----------------------
     *
     * MEASURED 2026-08-18 at release bb59e9a263c5: 12 items fire, 61 do not, and 55 of those 61 read
     * `did_not_fire_unexplained`. The `trigger-move` clause — the whole mechanism written in August to
     * tell a fixture gap apart from an engine gap — COULD NOT HAVE FIRED ON ONE OF THEM, because this
     * call site never passed `stagedMoves`. `runAbilities` passes it; `runItems` did not. The clause
     * was not missing, it was unfed, which reads exactly the same from the artifact.
     *
     * Everything below is DECLARED rather than intended, the same rule `scOf` states for abilities:
     * `stagedMoves` is read back off the BUILT bodies, and the arm's two constant rolls are MEASURED
     * off the arm's own functions rather than inferred from its name. */
    const _built = mkActor(di.name);
    /* HOW LONG THE LONGEST RUNG ACTUALLY RUNS, BUILT RATHER THAN COUNTED FROM THE RUNG TABLE. The
     * `duration-extension` clause compares this against a clock read out of the authority's source, so
     * an arithmetic copy of `gauntletScript`'s shape here would be a second implementation of a fact —
     * the thing CLAUDE.md names as the way two files come to disagree invisibly. `stageBodies` does no
     * validation, so this costs nothing. */
    const GAUNTLET_TURNS = (_built && receiver)
      ? Math.max(...AB_RUNGS.map(r => gauntletScript(stageBodies(_built, receiver), r.beats, facesUsed).length))
      : 0;
    /* ---- THE BOARD-STATE RUNG, BUILT FROM THE ITEM'S OWN `boardNeeds` (see the block above) --------
     * It is the LAST rung and carries its own bodies, so a row that fires on either standard rung
     * never reaches it and no row can regress into it. */
    const plan = BREAK_TRIGGERS ? null : boardPlanFor(di, c);
    let stateRungs = [], stateOn = null, stateOff = null, stateOutcome = null;
    if (plan) {
      const pActorWants = plan.actorMoves.map(mvName).concat(actorWants);
      const pRecvWants = plan.recvMoves.map(mvName).concat(recvWants);
      const pRecv = bodyOf(plan.receiverSpecies,
                           plan.receiverSpecies === id(RECEIVER.species) ? RECEIVER.ability : '',
                           RECEIVER.item, pRecvWants);
      const pOn = () => bodyOf(plan.holder, '', di.name, pActorWants);
      const pOff = () => bodyOf(plan.holder, '', '', pActorWants);
      if (pRecv && pOn() && pOff()) stateRungs = [{ id: 'board-state', hpBoost: plan.hpBoost || HP_BOOST,
        mkOn: pOn, mkOff: pOff, receiver: pRecv, carrier: plan.holder,
        script: (b) => statePlanScript(b, plan) }];
      /* THE DECLARATION IS READ BACK OFF THE BUILT BODIES, exactly as `stagedMoves` is. A plan whose
       * moves did not survive `bodyOf` is an intention, and an intention that clears a clause is the
       * silent default this whole mechanism exists to remove. */
      if (stateRungs.length) {
        const heldA = new Set((pOn().moves || []).map(id)), heldR = new Set((pRecv.moves || []).map(id));
        plan.built = { actor: [...heldA], receiver: [...heldR] };
        plan.receipts = plan.receipts.filter(r => (r.by === 'actor' ? heldA : heldR).has(id(r.move)));
      }
    }
    const row = abLadder('item', it, di.name, c, '(no item)',
                         () => mkActor(di.name), () => mkActor(''), receiver, facesUsed, null,
                         stateRungs, (rung, on, off, r) => {
                           if (rung.id !== 'board-state') return;
                           stateOn = on; stateOff = off;
                           /* THE RUNG'S OWN OUTCOME, KEPT EVEN WHEN A LATER LINE DISCARDS THE ROW. A
                            * rung that could not stage returns a verdict-less row and `abLadder`
                            * silently keeps the earlier one — which reads exactly like a rung that ran
                            * and found nothing. */
                           stateOutcome = { staged: !!(on.staged && off.staged),
                                            why: on.why || off.why || null,
                                            verdict: r.verdict || null,
                                            showdown_moved: r.showdown_moved, medicham_moved: r.medicham_moved };
                         });
    /* THE PREFLIGHT IS ASKED AFTER THE GAMES, BECAUSE THE ANSWER DEPENDS ON THEM. `boardState` is a
     * claim about what the fixture PUT ON THE BOARD, and the only honest source for that is the
     * authority's own log — so the receipts are read first and handed in here. Before this rung existed
     * the call site declared nothing at all, which is why all 23 non-firing items read `board-state`. */
    const who = 'p1a: ' + (dex.species.get((plan && plan.holder) || c).baseSpecies
                        || dex.species.get((plan && plan.holder) || c).name);
    const receipts = stateReceipts(plan, stateOn, stateOff, who);
    if (DUMPLOG && stateOn && stateOn.staged) {
      console.log('  ---- ' + it + ' [board-state] ' + JSON.stringify(plan.steps));
      console.log('  ON  (holding it):'); for (const l of stateOn.sdLog) console.log('    ' + l);
      console.log('  OFF (control):');    for (const l of stateOff.sdLog) console.log('    ' + l);
    }
    const sc = { species: dex.species.get((plan && plan.holder) || c).name, item: di.name,
                 target: dex.species.get((plan && plan.receiverSpecies) || recvSp).name,
                 teamSize: 4, switchesOut: true, gender: 'N', targetGender: 'N',
                 stagedMoves: { actor: ((_built || {}).moves || []).map(id)
                                 .concat((plan && plan.built ? plan.built.actor : [])),
                                receiver: ((receiver || {}).moves || []).map(id)
                                 .concat((plan && plan.built ? plan.built.receiver : [])) },
                 turns: GAUNTLET_TURNS,
                 armForcesAccuracy: ARM_FORCES.accuracy, armForcesCrit: ARM_FORCES.crit,
                 armTieFirst: ARM.tieToSecondBody === false,
                 boardState: receipts.declared };
    /* `undefined`, NOT `null` — clause 3 tests `=== undefined`, so a null would silently suppress the
     * very clause a row with no staged status needs. */
    if (receipts.declared.status) sc.status = receipts.declared.status;
    const pre = preflight(sc);
    labelRow(row, pre, !!(row && row.verdict && row.verdict !== 'DID-NOT-FIRE'));
    if (row && plan) {
      row.board_state_plan = { kinds: plan.kinds, holder: plan.holder, receiver: plan.receiverSpecies,
                               actor_moves: plan.actorMoves, receiver_moves: plan.recvMoves,
                               staged: stateRungs.length > 0, outcome: stateOutcome,
                               declared: receipts.declared, receipts_met: receipts.met,
                               receipts_unmet: receipts.unmet };
    }
    /* WHAT THE HANDLER ASKED FOR AND WHAT THE BOARD SUPPLIED, ON THE ROW — the same fields the ability
     * rows carry, and the only ones that can FALSIFY this derivation. A row with a staged need that
     * still reads DID-NOT-FIRE is either an engine defect or a wrong need, and both are findings. */
    if (row && NEEDS.needs.length) {
      row.trigger_needs = NEEDS.needs.map(n => ({ by: n.by, kind: n.kind, values: n.values, handler: n.handler }));
      row.trigger_staged = chosen ? { actor: chosen.actor, receiver: chosen.receiver } : null;
      row.trigger_unstaged = chosen ? null : NEEDS.needs.map(n => n.by + ':' + n.kind
        + (n.values.length ? '=' + n.values.join('|') : ''));
      row.carrier_derived = c !== ITEM_HOLDER;
    }
    if (row && NEEDS.undetermined.length) row.trigger_cues_undetermined = NEEDS.undetermined;
    if (row && facesUsed) { row.faced = facesUsed.recv; row.faced_why = facesUsed.why; }
    rows.push(row);
  }
  return rows;
}

function abRow(kind, key, name, carrier, control, on, off) {
  if (!on.staged || !off.staged) {
    return { kind, id: key, name, carrier, control, fired: false,
             why: 'could not stage: ' + (on.why || off.why), validator: on.validator || off.validator };
  }
  /* THE COMPARISON RUNS ON THE REDUCED STREAM, AND THE RAW ONE WAS A NON-DETERMINISM BUG.
   *
   * Showdown's log carries `|t:|<unix seconds>` timestamp lines. Comparing the raw logs of the two
   * arms therefore reported "the game changed" whenever the two arms happened to straddle a second
   * boundary — and two identical invocations of this file, minutes apart, returned
   * `showdown_only: 23` and `showdown_only: 16`. A non-deterministic instrument is worth nothing, and
   * this one WAS non-deterministic until it was caught by re-running it twice and comparing, which is
   * the only reason it was caught at all.
   *
   * `sdStream` is the DRIVER'S OWN reducer — the same function the differential aligns with — so what
   * counts as a meaningful line is decided in one place rather than two. */
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const sdMoved = !same(GD.sdStream(on.sdLog), GD.sdStream(off.sdLog));
  const meMoved = !same(on.mediTrace, off.mediTrace);
  let verdict;
  if (sdMoved && meMoved) verdict = 'FIRED';
  else if (sdMoved && !meMoved) verdict = 'SHOWDOWN-ONLY';
  else if (!sdMoved && meMoved) verdict = 'MEDICHAM-ONLY';
  else verdict = 'DID-NOT-FIRE';
  return { kind, id: key, name, carrier, control, verdict, fired: verdict === 'FIRED',
           showdown_moved: sdMoved, medicham_moved: meMoved,
           why: verdict === 'DID-NOT-FIRE'
             ? 'the gauntlet never reached its trigger — swapping it for ' + control + ' changed neither game'
             : null,
           diverged: !!on.div,
           /* Every subject this harness stages sits at p1a — the move path builds `who` as
            * 'p1a: <Species>' and the ability gauntlet does the same. `abRow` is not handed that
            * string, so the slot is named directly rather than reaching for a variable not in scope.
            *
            * TARGET 'all', SO AN ABILITY ROW IS NEVER DISOWNED. A move has a declared target and the
            * reach test is exact; an ABILITY has none, and its effect can legitimately land anywhere
            * on the field — Friend Guard changes the PARTNER'S damage, Intimidate the opponents', Rough
            * Skin the attacker's. Narrowing this to the holder's own slot would invent a false-negative
            * class exactly where Friend Guard lives, which is an open defect in this very run. The
            * ability arm therefore keeps its previous behaviour and attributes everything; when an
            * ability row needs finer attribution it needs a reach derived from its TAG, not a guess. */
           divergence: divOf(on.div, "p1a", on.sdLog, null),
           /* THE BOARD ANSWER IS READ OFF THE `ON` GAME, which is the same game `divergence` above is
            * read off. The `off` game is the A/B CONTROL — it is a different game with a different
            * ability on the board, so its boards answer a different question and are carried
            * separately rather than pooled. */
           board: boardVerdict(on, kind, key),
           board_control_arm: boardVerdict(off, kind, key) };
}

/* ================= THE RED DEMONSTRATION ========================================================== */
/* An instrument that has never failed is not evidence. Each plant attacks a DIFFERENT claim this file
 * makes, and each must be caught by the same code path a real run uses. */
function red() {
  const out = [];
  const receiver = bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES);
  /* THE PLANTED MOVE AND ITS CARRIER ARE DERIVED, not named, so this demonstration cannot rot into a
   * test of two species that stopped being legal. An Electric attack, its first legal carrier, and the
   * first legal species that is IMMUNE to it — asked of the authority's own type chart. */
  const PLANT_MOVE = 'thunderbolt';
  const carrier = (CARRIERS.get(PLANT_MOVE) || [])[0];
  const immuneSp = LEGAL_SPECIES.find(s => dex.getEffectiveness('Electric', s.types) === 0
    ? false : dex.getImmunity('Electric', s.types) === false);
  const actorOf = () => bodyOf(carrier, '', '', [mvName(PLANT_MOVE), 'Protect']);
  const who = 'p1a: ' + (dex.species.get(carrier).baseSpecies || dex.species.get(carrier).name);
  const one = (recv, tag) => {
    const b = stageBodies(actorOf(), recv);
    const script = scriptFor({ pre: [], extra: [], receiverAttacks: null, selfDamage: false, charge: false }, PLANT_MOVE, b);
    const r = playScenario(Object.assign({ script, tag }, b));
    return { r, v: r.staged ? verdictFor(r.sdLog, who, PLANT_MOVE) : { resolved: null, why: r.why } };
  };
  /* 1. A MOVE THAT CANNOT RESOLVE. An Electric attack into a Ground type is a type immunity; the
   *    verdict must be NOT RESOLVED, carrying the authority's own `-immune`, not a credited row. */
  {
    const ground = bodyOf(immuneSp.id, '', '', ['Agility', 'Endure', 'Protect']);
    const { r, v } = one(ground, 'red/immune');
    out.push({ plant: 'a move clicked into a TYPE IMMUNITY must not be credited (' + PLANT_MOVE
                    + ' into ' + (immuneSp && immuneSp.name) + ')',
               staged: r.staged, resolved: v.resolved, why: v.why,
               caught: r.staged && v.resolved === false });
  }
  /* 1b. THE SAME MOVE INTO A LEGAL TARGET MUST BE CREDITED. A detector that says NO to everything is
   *     not a detector; the plant above proves nothing without this control beside it. */
  {
    const { r, v } = one(receiver, 'red/control');
    out.push({ plant: 'CONTROL — the same move into a legal target MUST be credited',
               staged: r.staged, resolved: v.resolved, why: v.why,
               caught: r.staged && v.resolved === true });
  }
  /* 2. THE A/B ARM MUST SAY DID-NOT-FIRE WHEN THE TWO ARMS ARE THE SAME ABILITY. Swapping an ability
   *    for ITSELF cannot change a game, so a verdict of FIRED here would mean the comparison is
   *    reading noise — which under a pinned die it must not be. */
  {
    const mk = () => stageBodies(bodyOf(ITEM_HOLDER, '', '', GAUNTLET_ACTOR_MOVES), receiver);
    const b1 = mk(), b2 = mk();
    const on = playScenario(Object.assign({ script: gauntletScript(b1), tag: 'red/ab-on' }, b1));
    const off = playScenario(Object.assign({ script: gauntletScript(b2), tag: 'red/ab-off' }, b2));
    const row = abRow('ability', 'control', '(the same ability twice)', ITEM_HOLDER, '(itself)', on, off);
    out.push({ plant: 'a mechanic swapped for ITSELF must read DID-NOT-FIRE — a FIRED here is noise',
               staged: !!row.verdict, verdict: row.verdict, why: row.why,
               caught: row.verdict === 'DID-NOT-FIRE' });
  }
  /* 3. A CORRUPTED MEDICHAM STREAM MUST BE REPORTED AS A DIVERGENCE. `game_differential`'s own plant
   *    machinery, run through THIS file's scenario, so "the comparison is live in these games" is
   *    demonstrated here rather than inherited from another file's run. */
  {
    const b = stageBodies(actorOf(), receiver);
    const script = scriptFor({ pre: [], extra: [], receiverAttacks: null, selfDamage: false, charge: false }, PLANT_MOVE, b);
    const aS = sheetOf([b.actor, b.ally]), bS = sheetOf([b.receiver, b.foeAlly]);
    const pa = GD.buildPair(aS, { hpBoost: HP_BOOST, max: 6 }).slice(0, 4);
    const pb = GD.buildPair(bS, { hpBoost: HP_BOOST, max: 6 }).slice(0, 4);
    const clean = GD.playGame(pa, pb, 'all-mechanics-fire', 'red/clean', { script, arm: ARM });
    const bent = GD.playGame(pa, pb, 'all-mechanics-fire', 'red/bent', { script, arm: ARM,
      plant: (s) => { const t = s.slice(); for (let i = 0; i < t.length; i++) {
        if (/^\|-damage\|/.test(String(t[i]))) { const p = String(t[i]).split('|'); p[3] = '1/999'; t[i] = p.join('|'); break; } }
        return t; } });
    out.push({ plant: 'a corrupted medicham2 damage line must be caught as a divergence',
               clean_diverged: !!clean.div, bent_diverged: !!bent.div,
               bent_cause: bent.div ? GD.classify(bent.div).cls : null,
               caught: !clean.div && !!bent.div });
  }
  /* 4. THE SAME QUESTION ASKED TWICE MUST GIVE THE SAME ANSWER, and this plant exists because the
   *    instrument FAILED it. Showdown's log carries `|t:|<unix seconds>`, the A/B arm compared raw
   *    logs, and two identical runs minutes apart returned 23 and then 16 SHOWDOWN-ONLY abilities. A
   *    non-deterministic instrument produces findings that cannot be acted on and regressions that
   *    cannot be seen. Nothing in the earlier plants could catch it — they each run once. */
  /* 5. THE PREFLIGHT MUST REFUSE A BOARD WHOSE TRIGGER CANNOT FIRE, AND MUST CLEAR THE SAME BOARD THE
   *    MOMENT IT CAN. Both directions on ONE ability, because a detector that says NO to everything is
   *    not a detector — that is the same argument plant 1b makes for the move verdict.
   *
   *    IT RUNS THROUGH THIS FILE'S OWN `preflight()` WRAPPER, not through `PRE.check`, so the plant is
   *    testing THE WIRING and not the module. `--break-preflight` stubs the wrapper and this plant is
   *    the thing that goes red.
   *
   *    THE GATED ABILITY IS DERIVED FROM THE HANDLER TEXT HERE, deliberately by a DIFFERENT route than
   *    the clause uses (the clause follows `addVolatile` one hop; this reads `.gender` directly), so
   *    the plant cannot pass by sharing the clause's own mistake. */
  {
    const srcOf = (a) => Object.entries(dex.abilities.get(a) || {})
      .filter(([k, v]) => /^on/.test(k) && typeof v === 'function').map(([, v]) => String(v)).join(' ');
    const hasCarrier = (a) => (AB_CARRIERS.get(a) || []).length > 0;
    const gated = LEGAL_ABILITIES.find(a => hasCarrier(a) && /\.gender/.test(srcOf(a)));
    const plain = LEGAL_ABILITIES.find(a => hasCarrier(a) && !/\.gender|addVolatile\(\s*["']attract/.test(srcOf(a)));
    const board = (a, g) => ({ species: dex.species.get((AB_CARRIERS.get(a) || [])[0]).name, ability: a,
                               target: dex.species.get(RECEIVER.species).name,
                               teamSize: 4, switchesOut: true, gender: g, targetGender: g });
    const genderless = gated ? preflight(board(gated, 'N')) : { ok: true };
    const gendered = gated ? preflight(board(gated, 'M')) : { ok: false };
    const control = plain ? preflight(board(plain, 'N')) : { ok: false };
    out.push({ plant: 'the PREFLIGHT must REFUSE a genderless board for a gender-gated mechanic ('
                    + (gated || 'none found') + '), CLEAR the same board once genders are declared, and '
                    + 'CLEAR an ungated one (' + (plain || 'none found') + ') — a blanket NO is not a detector',
               why: (genderless.why || []).join(' ').slice(0, 90) || null,
               caught: !!gated && !!plain && genderless.ok === false && gendered.ok === true && control.ok === true });
  }
  {
    const mk = () => stageBodies(bodyOf(ITEM_HOLDER, '', 'Sitrus Berry', GAUNTLET_ACTOR_MOVES), receiver);
    const play = () => { const b = mk();
      const on = playScenario(Object.assign({ script: gauntletScript(b), tag: 'red/det-on' }, b));
      const b2 = stageBodies(bodyOf(ITEM_HOLDER, '', '', GAUNTLET_ACTOR_MOVES), receiver);
      const off = playScenario(Object.assign({ script: gauntletScript(b2), tag: 'red/det-off' }, b2));
      return abRow('item', GAME_RULES.RED_DEMO_ITEM, 'Sitrus Berry', ITEM_HOLDER, '(no item)', on, off); };
    const a = play(), b = play();
    out.push({ plant: 'THE SAME A/B ASKED TWICE MUST GIVE THE SAME VERDICT — the instrument failed this once',
               verdict: a.verdict + ' then ' + b.verdict,
               caught: a.verdict === b.verdict && a.showdown_moved === b.showdown_moved
                    && a.medicham_moved === b.medicham_moved });
  }
  /* 6. A STATE DIFFERENCE THAT PRODUCES NO LINE DIFFERENCE MUST BE CAUGHT (2026-08-19).
   *
   * THIS IS THE ONE PLANT THAT DEFENDS THE ANNOUNCEMENT-ONLY VERDICT, and without it every such
   * verdict would be worth nothing. Plants 1-5 all attack the PROTOCOL arm; every one of them would
   * still pass with the board comparison entirely unwired, because they are all read off the streams.
   * The claim "the commentary differs and the boards do not" is a claim about a comparison that has
   * never been shown catching anything, which is the exact shape docs/LESSONS.md §1 is about.
   *
   * SO THE PLANT IS APPLIED TO THE LIVE MEDICHAM STATE AT A BOUNDARY, THROUGH THE DRIVER'S OWN
   * `statePlant` HOOK — the same hook game_differential's own state plants use — so it travels through
   * `board_state.js`'s reader exactly as a real defect would. A plant applied to the snapshot would
   * prove only that `compare` can subtract.
   *
   * EVERY PLANT CARRIES A CONTROL AND THE CONTROL IS THE HALF THAT WAS NEARLY LEFT OUT. The scenario
   * is played FIRST with no plant at all, and that run must come back protocol-clean AND board-clean.
   * Without it, "the planted run parted" is compatible with "this fixture parts anyway".
   *
   * AND EACH PLANT ASSERTS THE PROTOCOL DID NOT MOVE. That is what makes it the right plant: a state
   * difference the STREAM would have caught proves nothing about a comparison built to see past the
   * stream. `no_new_line` below is checked, not assumed.
   *
   * FOUR LEAVES, CHOSEN BECAUSE THEY ARE FOUR DIFFERENT PLACES A BOARD CAN BE WRONG — an active
   * body's HP, an active body's stat stage, a FIELD/SIDE CLOCK, and A BENCHED BODY'S HP. The last one
   * is deliberate: the bench is where a planted item was laundered once before, and a comparison that
   * caught the first three and missed the fourth would read as healthy. */
  {
    const stage = (plant) => {
      const b = stageBodies(actorOf(), bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES));
      const script = scriptFor({ pre: [], extra: [], receiverAttacks: null, selfDamage: false, charge: false },
                               PLANT_MOVE, b);
      return playScenario(Object.assign({ script, tag: 'red/board', statePlant: plant }, b));
    };
    /* THE BOUNDARY THE PLANT LANDS ON. Index 0 is the leads and index 1 is the board after the click
     * turn; the plant is aimed at 1 so it lands on a board the scenario actually produced. */
    const AT = 1;
    /* A BENCHED BODY IS FOUND, NEVER ASSUMED TO BE AT AN INDEX. `S.sfA.team` is the whole party and
     * the two actives are in it; the plant needs a member that is NOT standing, and if there is none
     * the plant reports that rather than silently planting on an active body and passing. */
    const benched = (S) => {
      const act = new Set((S.actA || []).filter(Boolean));
      return ((S.sfA && S.sfA.team) || []).find(m => m && !act.has(m)) || null;
    };
    const PLANTS = [
      { what: 'an ACTIVE body loses 7 HP with no line to say so', want: 'hp',
        f: (S) => { const m = (S.actA || [])[0]; if (!m) return false; m.curHP = Math.max(1, m.curHP - 7); return true; } },
      { what: 'an ACTIVE body gains a +1 Attack stage with no line to say so', want: 'boosts.atk',
        f: (S) => { const m = (S.actA || [])[0]; if (!m || !m.boosts) return false; m.boosts.at += 1; return true; } },
      { what: 'a SIDE CLOCK is set — 3 turns of Tailwind nobody announced', want: GAME_RULES.RED_DEMO_SIDE,
        f: (S) => { if (!S.field) return false; S.field.twA = 3; return true; } },
      { what: 'a BENCHED body loses 5 HP — the half a stream can never see', want: 'party.hp',
        f: (S) => { const m = benched(S); if (!m) return false; m.curHP = Math.max(1, m.curHP - 5); return true; } },
      /* ROADMAP #308 -- ONE PLANT PER LEAF WIRED THIS PASS, because a leaf added to board_state.js
       * with nothing planting on it is a leaf that has never been shown to catch anything. Each is a
       * state difference with NO protocol line, which is exactly the class these four rows
       * (fairylock, spiritshackle, uproar, electromorphosis) came back ANNOUNCEMENT-ONLY on. */
      { what: 'FAIRY LOCK is on the field for 2 more turns and nothing announced it', want: 'fairylock_turns',
        f: (S) => { if (!S.field) return false; S.field.fairylock = 2; return true; } },
      { what: 'an ACTIVE body is TRAPPED by a move and no line says so', want: 'trapped',
        f: (S) => { const m = (S.actA || [])[0]; if (!m) return false; m._trapHard = { by: m, mv: 'spiritshackle' }; return true; } },
      { what: 'an ACTIVE body is locked into an UPROAR for 3 turns, silently', want: 'uproar',
        f: (S) => { const m = (S.actA || [])[0]; if (!m) return false;
                    m._mtLock = { move: 'uproar', left: 3, confuse: false, vol: 'uproar', blockSleep: true }; return true; } },
      { what: 'an ACTIVE body is holding a banked CHARGE nobody mentioned', want: 'charge',
        f: (S) => { const m = (S.actA || [])[0]; if (!m) return false; (m._vol = m._vol || {}).charge = 1; return true; } },
      /* ---- THE BENCH IS COMPARED ON ITS VOLATILES SINCE 2026-08-25, AND THESE TWO ARE WHAT SAYS SO.
       * Will: *"yeah the pokemon in the back need to be clean."* The authority's `clearVolatile`
       * (sim/pokemon.ts:1519-1566) empties a body's volatiles on the way off the field, so a benched
       * body carrying one is a body that did not drop what leaving drops — and until this pass no
       * instrument in this repository read it. Both plants are on a body that is NOT standing and
       * neither writes a protocol line, which is the whole point: a stream cannot see the bench.
       *
       * TWO PLANTS, TWO DIFFERENT MECHANISMS, deliberately. One catch is one catch: the trap is a
       * LINKED volatile whose owner is another body, the doll is a per-body HP pool, and a comparator
       * that saw one and missed the other would read as healthy. */
      { what: 'a BENCHED body is still TRAPPED by a move — the bench is where a leaf gets laundered',
        want: 'party.vol.trapped',
        f: (S) => { const m = benched(S); if (!m) return false;
                    m._trapHard = { by: (S.actB || [])[0] || m, mv: 'block' }; return true; } },
      { what: 'a BENCHED body is still standing behind a SUBSTITUTE with 40 HP', want: 'party.vol.substitute',
        f: (S) => { const m = benched(S); if (!m) return false; m._sub = 40; return true; } },
      /* ---- DESTINY BOND AND THE STALL COUNTER ARE COMPARED SINCE 2026-08-25, AND THESE FOUR ARE
       * WHAT SAYS SO. Both leaves were in `data/game-differential.json`'s `end_state_not_compared`
       * -- read by NOTHING in this repository -- and the Destiny Bond row was right that wiring it
       * first would have manufactured a divergence: the mechanic was not implemented at all.
       *
       * TWO PLANTS PER LEAF, AND EACH PAIR IS TWO DIFFERENT PLACES THE SAME LEAF CAN BE WRONG. One
       * catch is one catch: a comparator that saw the ACTIVE slot and missed the BENCH would read as
       * healthy, and the bench is exactly where a leaf has been laundered before.
       *
       * NONE OF THE FOUR WRITES A PROTOCOL LINE, which is the whole point. `-singlemove` is not a
       * line this engine claims, and the stall counter is never narrated by either engine at all --
       * so a stream instrument cannot see any of this, on either side, ever. */
      { what: 'an ACTIVE body is holding a DESTINY BOND nobody announced', want: 'vol.destinybond',
        f: (S) => { const m = (S.actA || [])[0]; if (!m) return false; (m._vol = m._vol || {}).destinybond = 1; return true; } },
      { what: 'a BENCHED body walked off the field still holding a DESTINY BOND', want: 'party.vol.destinybond',
        f: (S) => { const m = benched(S); if (!m) return false; (m._vol = m._vol || {}).destinybond = 1; return true; } },
      { what: 'an ACTIVE body has TWO consecutive Protects on its stall counter and no line says so',
        want: 'stall',
        f: (S) => { const m = (S.actA || [])[0]; if (!m) return false; m.tookProtectTurns = 2; return true; } },
      { what: 'a BENCHED body took its stall counter to the bench with it', want: 'party.stall',
        f: (S) => { const m = benched(S); if (!m) return false; m.tookProtectTurns = 1; return true; } },
    ];
    /* 7. THE MEGA STONE ARM MUST BE ABLE TO FAIL (2026-09-11, harness batch HB-4). Four plants on ONE
     *    derived stone — the first whose base is not the receiver and whose mega ability is not
     *    DISRUPTIVE (a weather or terrain setter would change the field under the plant):
     *      7a CONTROL   the evolution happens in BOTH engines and the board, stat line included, is clean
     *      7b SPECIES   medicham2's body is put back to its base forme after the mega; the board must
     *                   part on `species` at that boundary
     *      7c STAT LINE medicham2's evolved Attack is moved by one point; only the stat-line leaf can see
     *                   it (board_state.js does not compare Attack), so this is the proof that leaf is live
     *      7d FOREIGN   the same body holding a stone that is NOT its own asks to evolve; the authority
     *                   must refuse (a counted refusal, no |-mega| line) and the A/B must read DID-NOT-FIRE
     *    The plant is applied at boundary 1, the board after the turn the mega happened on. */
    {
      const SP = [...STONE_OF.values()].find(e => id(e.base) !== id(RECEIVER.species)
        && e.megaAbility && !DISRUPTIVE_ABILITY(e.megaAbility));
      const FOREIGN = SP && [...STONE_OF.values()].find(e => e.stone !== SP.stone && id(e.base) !== id(SP.base));
      if (!SP || !FOREIGN) {
        out.push({ plant: 'THE MEGA STONE ARM — no stone could be derived for the plants', caught: false,
                   why: 'no non-disruptive stone (or no foreign stone) in the format' });
      } else {
        const who = (S) => ((S.sfA && S.sfA.team) || []).find(m => m && BS.stableKey(m, id) === SP.base);
        const ctl = stoneGame(SP, SP.stoneName, 'red/stone-control');
        const cv = boardVerdict(ctl);
        const ctlOk = !!ctl.staged && megaSeen(ctl.sdLog) && megaSeen(ctl.mediTrace) && cv.verdict !== 'STATE'
          && !!ctl.statLine && ctl.statLine.compared > 0 && ctl.statLine.parted === 0 && ctl.statLine.unreadable === 0;
        out.push({ plant: 'MEGA STONE CONTROL (' + SP.stoneName + ' on ' + SP.base + ') — both engines evolve and '
                        + 'the board, stat line included, is clean', staged: !!ctl.staged, verdict: cv.verdict,
                   stat_line: ctl.statLine || null,
                   why: !ctl.staged ? ctl.why : (!megaSeen(ctl.sdLog) ? 'the authority never evolved' : null),
                   caught: ctlOk });
        const planted = (what, want, f) => {
          let applied = false;
          const r = stoneGame(SP, SP.stoneName, 'red/stone-' + want,
                              (S, battle, t) => { if (t === 1) { const m = who(S); if (m) { f(m); applied = true; } } });
          const v = boardVerdict(r);
          const hit = (v.diffs || []).map(d => String(d.field));
          out.push({ plant: 'A MEGA STONE BOARD MUST PART — ' + what, applied, staged: !!r.staged,
                     verdict: v.verdict, leaves: hit.slice(0, 4),
                     no_new_line: r.divTurn == null || r.divTurn > 1,
                     why: !applied ? 'THE PLANT NEVER LANDED — the evolved body was not found' : null,
                     caught: ctlOk && applied && !!r.staged && v.state_parted_on_turn === 1
                          && hit.some(f => f.indexOf(want) >= 0) });
        };
        planted('medicham2\'s evolved body is put back to its BASE forme name', 'species',
                (m) => { m.name = dex.species.get(SP.base).name; });
        planted('medicham2\'s evolved Attack is one point off — only the stat-line leaf can see this', 'stats.atk',
                (m) => { m.st.at += 1; });
        const r0 = GD.scriptCounters().megaRefused;
        const fOn = stoneGame(SP, FOREIGN.stoneName, 'red/stone-foreign-on');
        const refusedN = GD.scriptCounters().megaRefused - r0;
        const fOff = stoneGame(SP, '', 'red/stone-foreign-off');
        const fr = abRow('item', 'foreign-stone', FOREIGN.stoneName, SP.base, '(no item)', fOn, fOff);
        out.push({ plant: 'A FOREIGN STONE (' + FOREIGN.stoneName + ' on ' + SP.base + ') must be REFUSED by the '
                        + 'authority and read DID-NOT-FIRE — a mega arm that evolves anything is not a detector',
                   staged: !!fOn.staged, verdict: fr.verdict, refused: refusedN,
                   why: fOn.staged && megaSeen(fOn.sdLog) ? 'THE AUTHORITY EVOLVED ON A FOREIGN STONE' : null,
                   caught: !!fOn.staged && refusedN >= 1 && !megaSeen(fOn.sdLog) && !megaSeen(fOn.mediTrace)
                        && fr.verdict === 'DID-NOT-FIRE' });
      }
    }
    /* 8. A BOARD-ONLY GAME'S BOARD MUST BE ABLE TO PART (HB-1, 2026-09-11). The board-only arm has no
     *    A/B, so everything it claims rests on the board comparison of ONE game — and that comparison
     *    must be shown catching a planted state difference on exactly such a game, with its control.
     *    The subject is DERIVED: the first ability whose every carrier has no control and whose carrier
     *    builds. The plant is a Destiny Bond on the subject at boundary 1, which no line announces. */
    {
      /* `CLOSET` is declared after `red()` runs, so the shelf is read here directly (a TDZ otherwise),
       * and the Illusion shelf through the driver's own derived species set. */
      const _closet = require('../tests/roster.js').DEFERRED;
      const nc = [...AB_CARRIERS.entries()].find(([a, cs]) => !_closet[a]
        && !(GD.CLOSET_SPECIES && cs.some(s => GD.CLOSET_SPECIES.has(s)))
        && cs.every(s => !abControlFor(s, a)) && bodyOf(cs[0], a, '', GAUNTLET_ACTOR_MOVES));
      if (!nc) {
        out.push({ plant: 'A BOARD-ONLY GAME — no single-ability carrier could be derived', caught: false });
      } else {
        const [a, cs] = nc;
        const recv = bodyOf(RECEIVER.species, RECEIVER.ability, RECEIVER.item, RECEIVER_MOVES);
        const game = (plant) => { const b = stageBodies(bodyOf(cs[0], a, '', GAUNTLET_ACTOR_MOVES), recv);
          return playScenario(Object.assign({ script: gauntletScript(b, 1), tag: 'red/board-only', statePlant: plant }, b)); };
        const ctl = game(undefined), cv = boardVerdict(ctl);
        const ctlOk = !!ctl.staged && cv.verdict !== 'STATE';
        let applied = false;
        const r = game((S, battle, t) => { if (t === 1) { const m = (S.actA || [])[0];
          if (m) { (m._vol = m._vol || {}).destinybond = 1; applied = true; } } });
        const v = boardVerdict(r);
        const hit = (v.diffs || []).map(d => String(d.field));
        out.push({ plant: 'A BOARD-ONLY GAME (' + a + ' on ' + cs[0] + ') — its control is board-clean and a silent '
                        + 'Destiny Bond on the subject must part the board', applied, staged: !!r.staged,
                   verdict: v.verdict, control_verdict: cv.verdict, leaves: hit.slice(0, 4),
                   why: !ctlOk ? 'THE CONTROL IS NOT BOARD-CLEAN (' + cv.verdict + ')' : (!applied ? 'THE PLANT NEVER LANDED' : null),
                   caught: ctlOk && applied && !!r.staged && v.state_parted_on_turn === 1
                        && hit.some(f => f.indexOf('vol.destinybond') >= 0) });
      }
    }
    /* 9. THE STRUGGLE ROW'S BOARD MUST BE ABLE TO PART (HB-5, 2026-09-11). The control is the row's own
     *    fixture, unplanted: the authority must struggle and the board must be clean. The plant takes 7
     *    HP off the struggler in medicham2 at boundary n+1 — the board after the first Struggle turn —
     *    and the board must part on `hp` at exactly that boundary. */
    {
      const fx = struggleFixture();
      if (!fx) out.push({ plant: 'THE STRUGGLE ROW — no fixture: ' + STRUGGLE_SUMMARY.why, caught: false });
      else {
        const AT = fx.n + 1;
        const { r: ctl } = fx.play('red/struggle-control');
        const cv = boardVerdict(ctl);
        const struggled = (ctl.sdLog || []).some(l => /^\|move\|p1a: [^|]*\|Struggle/.test(String(l)));
        let applied = false;
        const { r } = fx.play('red/struggle-hp', (S, battle, t) => { if (t === AT) { const m = (S.actA || [])[0];
          if (m) { m.curHP = Math.max(1, m.curHP - 7); applied = true; } } });
        const v = boardVerdict(r);
        const hit = (v.diffs || []).map(d => String(d.field));
        out.push({ plant: 'THE STRUGGLE ROW (' + fx.carrier + ', ' + fx.dry.id + ' x' + fx.n + ') — the control struggles '
                        + 'board-clean, and 7 silent HP off the struggler after its first Struggle must part the board',
                   applied, staged: !!r.staged, verdict: v.verdict, control_verdict: cv.verdict, leaves: hit.slice(0, 4),
                   why: !struggled ? 'THE CONTROL NEVER STRUGGLED' : (!applied ? 'THE PLANT NEVER LANDED' : null),
                   caught: struggled && cv.verdict !== 'STATE' && applied && !!r.staged
                        && v.state_parted_on_turn === AT && hit.some(f => f === 'hp' || /(^|\.)hp$/.test(f)) });
      }
    }
    const control = stage(undefined);
    const cv = boardVerdict(control);
    const controlClean = control.staged && !control.div
                      && cv.boundaries > 0 && cv.boundaries_agreed === cv.boundaries;
    out.push({ plant: 'CONTROL FOR THE BOARD PLANTS — this scenario must be protocol-clean AND '
                    + 'board-clean before any plant below means anything',
               staged: !!control.staged, boundaries: cv.boundaries, agreed: cv.boundaries_agreed,
               why: control.div ? 'the control scenario ALREADY diverges on the protocol' : null,
               caught: controlClean });
    for (const p of PLANTS) {
      let applied = false;
      const r = stage((S, battle, turnIdx) => { if (turnIdx === AT) applied = p.f(S) || applied; });
      const v = boardVerdict(r);
      const hit = (v.diffs || []).map(d => d.field);
      /* THE PLANT MUST BE CAUGHT, ON THE LEAF IT WAS AIMED AT, WITH NO NEW LINE. All three, because
       * a catch on the wrong leaf is a coincidence and a catch that came with a protocol divergence
       * is the STREAM's catch rather than the BOARD's. */
      const onTarget = hit.some(f => String(f).indexOf(p.want) >= 0);
      const noNewLine = !r.div;
      out.push({ plant: 'A STATE DIFFERENCE WITH NO LINE DIFFERENCE MUST BE CAUGHT — ' + p.what,
                 applied, staged: !!r.staged, verdict: v.verdict, no_new_line: noNewLine,
                 leaves: hit.slice(0, 4),
                 why: !applied ? 'THE PLANT NEVER LANDED — the board it was aimed at was not reached'
                    : (v.verdict !== 'STATE' && v.verdict !== 'NO-DIVERGENCE' ? v.verdict : null),
                 caught: controlClean && applied && noNewLine && !!r.staged
                      && v.state_parted_on_turn === AT && onTarget });
    }
  }
  /* ---- THE PLANNED PATH'S OWN PLANTS (2026-09-11). The integration is a new way of building a game, so
   * it is shown catching something before any planned green counts: for one planned fixture per kind
   * (the first with a one-leaf control and an `hp` state plant — derived, not named),
   *   (a) its control played against ITSELF must read DID-NOT-FIRE — a verdict that fires on two identical
   *       games is the comparison broken, not the mechanic live;
   *   (b) the fixture played CLEAN must be board-clean, and the same fixture with the planner's own
   *       statePlant (C loses 7 HP silently after its read turn) must read STATE. */
  if (!NO_PLAN) {
    const plan = planOnce();
    for (const K of ['ability', 'item', 'move']) {
      const m = plan && plan.P.mechanics.find(x => x.kind === K && plannable(x) && x.fixtures[0].control
        && x.fixtures[0].variants[0] && x.fixtures[0].variants[0].control
        && (x.fixtures[0].plants || []).some(p => p.kind === 'statePlant' && p.leaf === 'hp'));
      if (!m) { out.push({ plant: 'PLANNER ' + K + ' — no fixture carries a one-leaf control and an hp state plant', caught: false }); continue; }
      const f = m.fixtures[0], v = f.variants[0];
      const sp = f.plants.find(p => p.kind === 'statePlant' && p.leaf === 'hp');
      const c1 = playPlanned(K, m.id, f, v, 'ctl', 'red/plan-ctl-a/' + m.id), c2 = playPlanned(K, m.id, f, v, 'ctl', 'red/plan-ctl-b/' + m.id);
      const ab = abRow(K, m.id, m.name, f.bodies.C.species, 'itself', c1, c2);
      out.push({ plant: 'PLANNER ' + K + ' ' + m.id + ' — its one-leaf control against ITSELF must read DID-NOT-FIRE',
                 staged: !!(c1.staged && c2.staged), verdict: ab.verdict || null, why: ab.verdict ? null : ab.why,
                 caught: !!(c1.staged && c2.staged) && ab.verdict === 'DID-NOT-FIRE' });
      const clean = playPlanned(K, m.id, f, v, 'fx', 'red/plan-clean/' + m.id);
      const cv = boardVerdict(clean, K, m.id);
      let applied = false;
      const planted = playPlanned(K, m.id, f, v, 'fx', 'red/plan-state/' + m.id, (S, battle, turnIdx) => {
        if (turnIdx !== sp.afterTurn) return;
        const mm = (S.actA || [])[0]; if (!mm) return;
        mm.curHP = Math.max(1, mm.curHP - 7); applied = true; });
      const pv = boardVerdict(planted, K, m.id);
      out.push({ plant: 'PLANNER ' + K + ' ' + m.id + ' — C loses 7 HP with no line after turn ' + sp.afterTurn
                   + '; the clean fixture must be board-clean and the planted one must read STATE',
                 applied, staged: !!(clean.staged && planted.staged), verdict: cv.verdict + ' -> ' + pv.verdict,
                 why: !applied ? 'THE PLANT NEVER LANDED — the game ended before turn ' + sp.afterTurn : null,
                 caught: !!(clean.staged && planted.staged) && applied && cv.verdict !== 'STATE' && pv.verdict === 'STATE' });
    }
  }
  return out;
}

/* ================= THE OVERLAP WITH THE DELIBERATE ROSTER ========================================= */
/* The roster stages a SINGLE TURN on a built board; this plays a REAL GAME. The interesting output is
 * not either list but the INTERSECTION and the two differences — and above all the set NEITHER
 * reaches, which is what is still untested by anything. Read out of the roster's own artifact, never
 * restated here. */
const ROSTER_FILE = { moves: 'data/roster.moves.json', abilities: 'data/roster.abilities.json',
                      items: 'data/roster.items.json' };
function rosterOverlap(kind, rows) {
  let roster;
  try { roster = JSON.parse(fs.readFileSync(D(ROSTER_FILE[kind]), 'utf8')); }
  catch (e) { return { available: false, why: 'no roster artifact for ' + kind + ': ' + e.message }; }
  /* THE ROSTER'S OWN WORD FOR "IT FIRED". `FIRED-AND-BOARDS-*` is a fired row whatever the board did;
   * `COULD-NOT-STAGE` is the roster admitting it never reached the mechanic, which is exactly the set
   * this instrument exists to attack. Read out of the artifact, never restated. */
  const staged = new Set(), notStaged = new Set();
  for (const r of roster.results || []) {
    (/^FIRED/.test(String(r.verdict)) ? staged : notStaged).add(r.id);
  }
  const mine = new Set(rows.filter(r => (kind === 'moves' ? r.resolved : r.verdict === 'FIRED')).map(r => r.id));
  const both = [...mine].filter(x => staged.has(x));
  const onlyHere = [...mine].filter(x => !staged.has(x));
  const onlyRoster = [...staged].filter(x => !mine.has(x));
  const neither = [...notStaged].filter(x => !mine.has(x));
  /* ---- THE EXEMPTION, RECONCILED AGAINST THE THING IT DEFERS TO --------------------------------
   *
   * 75 of the 148 item rows are excused here with *"a mega stone — measured by the mega counters, not
   * here"*, and until 2026-08-18 NOTHING CHECKED THAT SENTENCE against any artifact. That is the
   * `engine/artifact_audit.js` shape exactly: a deferral nobody reconciles is indistinguishable from a
   * gap. Two things came out of asking:
   *
   *   THE COVERAGE IS REAL. `data/roster.items.json` carries all 75 stones INDIVIDUALLY, every one of
   *     them `FIRED-AND-BOARDS-MATCH`.
   *   THE SENTENCE NAMED THE WRONG INSTRUMENT. The "mega counters" live in
   *     `data/game-differential.json` and are AGGREGATE — `mega.rates` over 965 games, `MEGA_CHOICES`,
   *     `MEGA_MEDI`, `MEGA_SD`, and a `coverage.distinct_items` that is a COUNT (137) with no names.
   *     Nothing in that artifact can say whether any ONE stone was ever carried.
   *
   * So the excuse now points at the roster, and the reconciliation is COMPUTED on every run rather
   * than believed: an excused row with no roster verdict is reported as UNRECONCILED. */
  const excused = rows.filter(r => r.out_of_scope).map(r => r.id);
  const byId = new Map((roster.results || []).map(r => [r.id, String(r.verdict)]));
  const unreconciled = excused.filter(x => !byId.has(x) || !/^FIRED/.test(byId.get(x) || ''));
  return { available: true, file: ROSTER_FILE[kind], roster_fired: staged.size, here_fired: mine.size,
           both: both.length, only_here: onlyHere.sort(), only_roster: onlyRoster.sort(),
           neither: neither.sort(),
           exemption: excused.length ? {
             excused: excused.length,
             covered_by: ROSTER_FILE[kind], roster_release: roster.engine_release || null,
             roster_generated: roster.generated || null,
             reconciled: excused.length - unreconciled.length, unreconciled: unreconciled.sort(),
             note: 'the deferral names the mega counters and the mega counters CANNOT answer it — they '
                 + 'are aggregate. The per-entity answer is the deliberate roster, and it is checked here.',
           } : null,
           what_neither_means: 'NEITHER the staged single-turn roster nor a real game has made this fire. '
                             + 'This is the set nothing in the project tests.' };
}

/* THE DIVERGENCES, COLLAPSED ONTO THE DRIVER'S OWN SPECIES-BLIND CAUSE, with the rows that carry each
 * one named. A bare count answers "how many games parted"; this answers "how many BUGS", which is the
 * number a fix list is made of. */
function reportCauses(rows) {
  /* ATTRIBUTED AND UNATTRIBUTED ARE COUNTED APART, and mixing them was worth three false findings.
   * A divergence on the PARTNER slot is one bug in that slot; charged to every row whose game
   * happened to contain it, it reads as N bugs in N subjects and inflates the fix list. Both are
   * printed — an unattributed cause is still a real defect, just not this row's. */
  const tally = (pred) => {
    const by = new Map();
    for (const r of rows) {
      if (!r.divergence || !pred(r.divergence)) continue;
      const k = r.divergence.cause;
      if (!by.has(k)) by.set(k, { n: 0, cls: r.divergence.cls, who: [], sd: r.divergence.showdown,
                                  me: r.divergence.medicham, slot: r.divergence.diverged_slot });
      const e = by.get(k); e.n++; if (e.who.length < 6) e.who.push(r.id);
    }
    return [...by.entries()].sort((a, b) => b[1].n - a[1].n);
  };
  const show = (label, list, cap) => {
    if (!list.length) return;
    console.log('    ' + label + ' — ' + list.length + ' distinct, across '
              + list.reduce((s, [, e]) => s + e.n, 0) + ' rows:');
    for (const [, e] of list.slice(0, cap)) {
      console.log('      ' + String(e.n).padStart(4) + '  [' + e.cls + ']' + (e.slot ? '  slot ' + e.slot : ''));
      console.log('            showdown  ' + e.sd);
      console.log('            medicham  ' + e.me);
      console.log('            e.g. ' + e.who.join(', '));
    }
  };
  const mine = tally(d => !d.shared_suspect);
  const other = tally(d => d.shared_suspect);
  show('DIVERGENCE CAUSES', mine, 25);
  if (other.length) {
    console.log('');
    console.log('    SHARED SUSPECTS — the divergent line fell inside ANOTHER slot\'s move, not the');
    console.log('    subject\'s. NOTHING HERE IS DISMISSED. Each is a real divergence; the open question');
    console.log('    is whether it is one defect in that slot shared by every row whose game contained');
    console.log('    it, or a genuine consequence of each subject. Reading one full log decides it, and');
    console.log('    three attempts to decide it by rule each produced a different wrong answer.');
    show('SHARED-SUSPECT CAUSES', other, 15);
  }
  const emit = ([cause, e]) => ({ cause, n: e.n, cls: e.cls, showdown: e.sd, medicham: e.me,
                                  rows: e.who, slot: e.slot });
  return { attributed: mine.map(emit), other_slot: other.map(emit) };
}

/* THE SPLIT, PRINTED. The number that matters is the LAST one: a row that did not fire and for which
 * the preflight can name NO unmet precondition. That is the candidate engine gap; everything above it
 * is this harness's own board being incapable of asking the question. */
function reportCannotFire(rows) {
  const cf = rows.filter(r => r.cannot_fire);
  const dn = rows.filter(r => r.verdict === 'DID-NOT-FIRE' && !r.cannot_fire);
  const by = new Map();
  for (const r of cf) {
    const k = r.cannot_fire_clause + (r.cannot_fire_blocking ? ' (BLOCKING)' : '');
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r.id);
  }
  console.log('    CANNOT-FIRE-IN-THIS-FIXTURE — ' + cf.length + ' row(s) the preflight can explain, '
            + 'against ' + dn.length + ' DID-NOT-FIRE it cannot:');
  for (const [k, v] of [...by].sort((a, b) => b[1].length - a[1].length))
    console.log('      ' + String(v.length).padStart(4) + '  ' + k + '   ' + v.slice(0, 20).join(' ')
              + (v.length > 20 ? ' …' : ''));
  if (dn.length) console.log('      ' + String(dn.length).padStart(4) + '  UNEXPLAINED — the fixture asked '
    + 'and neither game moved: ' + dn.map(r => r.id).slice(0, 20).join(' ') + (dn.length > 20 ? ' …' : ''));
}

/* ================= THE STAGING PLANNER'S FIXTURES — INTEGRATED 2026-09-11 =========================
 *
 * docs/_reports/2026-09-11-stage-planner.md §5 is the plan; docs/_reports/2026-09-11-integration.md is the
 * account. The order is inverted from the hand-built ladders above: engine/stage_planner.js reads what a
 * mechanic REQUIRES and builds a board that supplies exactly that — the fixture, a CONTROL that differs in
 * one leaf and is inert for one reason, every side and slot variant the handlers read, the arm where the
 * threshold decides, the HP pool — and every team it emits is validated.
 *
 * WHAT A PLANNED ROW IS, AND WHAT IT IS NOT:
 *   - ABILITIES AND ITEMS: the fixture game and its control are A/B'd by `abRow`, the SAME verdict the
 *     ladders use, so FIRED means exactly what it meant before this pass. A fixture with no single-leaf
 *     control is played board-only and credited only on the authority's own receipt, as HB-1.
 *   - MOVES: the consequence ladder stays the primary verdict (it owns leaf_effect and announcement_only,
 *     which engine/coverage.js reads); every move row ALSO plays its planner fixture on every variant, and
 *     a move the ladder could not resolve takes the planner's resolution.
 *   - EVERY VARIANT IS PLAYED. The verdict is the first variant's (near side, slot a); a board that parts on
 *     ANY variant marks the row STATE, because a parting anywhere is a parting.
 *   - A FALLBACK IS LOUD. A planned ability/item row that does not fire, cannot be staged, or whose script
 *     did not play as written runs the legacy ladder and keeps the planner's verdict beside the legacy one
 *     (`stage: 'legacy-fallback'`); a row the planner refuses runs the ladder with the refusal code
 *     (`stage: 'legacy'`). Both are counted and named in `planner.played`.
 *   - THE SHEET PLAYED IS THE SHEET THE VALIDATOR APPROVED: the planner's declared spread and genders,
 *     through the driver's two opt-in seams (`declaredSpread`, `declaredGender`).
 *   - A SCRIPT THAT DID NOT PLAY AS WRITTEN IS NOT A RESULT. The driver's own counters are read around
 *     every planned game; a click that was not on the request, an ally aim the authority refused, or a
 *     mega the authority refused in a FIXTURE game marks the variant `script_miss`. A stone row's control
 *     removes the stone, so its refused mega is the control working and is not a miss.
 *
 * `--no-plan` plays the pre-integration harness exactly. */
const NO_PLAN = has('--no-plan');
const PLANNED = { plan_ms: 0, rows: 0, fixtures: 0, variants: 0, games: 0, fired: 0, proven: 0,
                  fallback: [], legacy_refused: {}, script_miss: [], variant_split: [], control_parted: [],
                  board_state: [], diverged: [], move_rows: 0, move_resolved_by_planner: [],
                  move_planned_unresolved: [], move_control_resolved: [] };
const LEGACY_RAN = { abilities: 0, items: 0 };
let PLAN = null;
/* A ZERO-CHECK ON A LEGACY RECEIPT (the consequence table, the derived trigger) proves that table is read
 * only on a run where the legacy ladder played the WHOLE population. Under the planner it plays the
 * fallback rows alone, and a zero there is a fact about which rows fell back, not an unwired table. */
const FULL_LEGACY = () => NO_PLAN || !PLAN;
function planOnce() {
  if (PLAN || NO_PLAN) return PLAN;
  const SP = require('./stage_planner.js');
  /* THE PLANNER READS THE RELEASE'S OWN TAGS, so the fixtures are built on the facts the frozen engine
   * plays. A release that does not freeze them is named, and the planner reads git HEAD instead. */
  let tagsPath = null;
  try { tagsPath = GD.REL.path('data/tags.json'); }
  catch (e) { console.log('  PLANNER: release ' + GD.REL.id + ' does not freeze data/tags.json ('
    + String(e.message).split('\n')[0] + ') — the planner reads git HEAD instead, and the artifact records it'); }
  const t0 = Date.now();
  const P = SP.plan(tagsPath ? { tagsPath } : {});
  PLANNED.plan_ms = Date.now() - t0;
  PLAN = { P, byKey: new Map(P.mechanics.map(m => [m.key, m])) };
  const S = P.summary;
  console.log('  PLANNER (engine/stage_planner.js) — ' + S.withFixture + ' mechanics carry a fixture of ' + S.inScope
    + ' in scope, ' + S.variants + ' rendered variants; tags ' + P.meta.tags + '; gender seam '
    + (P.meta.genderSeam ? P.meta.genderSeam.at : 'ABSENT') + ' (' + PLANNED.plan_ms + ' ms)');
  return PLAN;
}
const plannable = (m) => !!(m && m.fixtures && m.fixtures.length && !m.refusal);
/* WHO THE SUBJECT IS AT A TURN, read off the planner's own role map — the side and slot the role stands
 * in, and the identifier the authority prints for it (the base species, as Showdown names a set). */
function subjectOf(v, turn) {
  const t = Math.max(1, turn || 1);
  const at = (((v && v.roleAt) || [])[t - 1] || ((v && v.roleAt) || [])[0] || {}).C;
  const r = ((v && v.roles) || {}).C;
  if (!at || !r) return null;
  const sp = dex.species.get(r.species);
  return { side: at.side, slot: at.slot, ident: at.side + 'ab'[at.slot] + ': ' + (sp.baseSpecies || sp.name), species: r.species };
}
const SCRIPT_KEYS = ['moveNotOnRequest', 'megaRefused', 'allyAimRefused', 'lockedNoTarget'];
function scriptDelta(a, b) { const d = {}; for (const k of SCRIPT_KEYS) { const x = (b[k] | 0) - (a[k] | 0); if (x) d[k] = x; } return d; }
/* WHICH DELTAS MEAN "THIS GAME DID NOT PLAY AS WRITTEN". `lockedNoTarget` is the authority ignoring the aim
 * of a locked move, which `scripted()` ignores exactly as the authority does — it is kept, not judged. */
function scriptMissOf(d, isControl, controlIsItem) {
  const bad = {};
  if (d.moveNotOnRequest) bad.moveNotOnRequest = d.moveNotOnRequest;
  if (d.allyAimRefused) bad.allyAimRefused = d.allyAimRefused;
  if (d.megaRefused && !(isControl && controlIsItem)) bad.megaRefused = d.megaRefused;
  return Object.keys(bad).length ? bad : null;
}
function playPlanned(kind, key, f, v, which, tag, plant) {
  const src = which === 'ctl' ? v.control : v;
  if (!src) return null;
  const arm = GD.ARM_BY_ID.get(f.arm);
  if (!arm) return { staged: false, why: 'the planner named arm ' + f.arm + ', which the driver does not define' };
  const subj = subjectOf(src, 1);
  /* THE STAT LINE rides on a row whose mechanism is a new forme (a stone, a mega carrier), exactly as the
   * ladders ask for it — and only where the subject is on p1, the side the stat reader looks at. */
  const formeRow = (f.bearer && f.bearer.via === 'mega') || (kind === 'item' && (dex.items.get(key) || {}).megaStone);
  const statLine = subj && subj.side === 'p1' && formeRow ? id(src.roles.C.species) : undefined;
  const c0 = GD.scriptCounters();
  const r = playScenario({ teams: src.teams, script: src.script, arm, declared: true, statLine,
                           hpBoost: f.hpPool === 'x1' ? 1 : HP_BOOST, tag, statePlant: plant });
  r.scriptDelta = scriptDelta(c0, GD.scriptCounters());
  r.scriptMiss = r.staged ? scriptMissOf(r.scriptDelta, which === 'ctl', !!(f.control && /^C\.item/.test(f.control.variable))) : null;
  PLANNED.games++;
  /* `--dumplog` REACHES THE PLANNED GAMES TOO — a flag that runs and prints nothing looks like a clean log. */
  if (DUMPLOG && r.staged) {
    console.log('  ---- ' + tag + ' [' + which + '] arm ' + f.arm + ' pool ' + f.hpPool + ' script ' + JSON.stringify(src.script)
      + (r.scriptMiss ? '  SCRIPT-MISS ' + JSON.stringify(r.scriptMiss) : ''));
    for (const l of r.sdLog) console.log('    SD  ' + l);
    for (const l of (r.mediTrace || [])) console.log('    ME  ' + (typeof l === 'string' ? l : JSON.stringify(l)));
    for (const b of (r.boards || []).filter(x => !x.identical)) console.log('    BOARD t' + b.turn + ' ' + JSON.stringify(b.diffs.slice(0, 4)));
  }
  return r;
}
/* A PARTING ANYWHERE IS A PARTING. Promotes the first STATE board and the first protocol divergence found
 * on any variant (or any fixture branch) onto the row, keeping what the first variant said beside it. */
function promoteParting(row, list, key) {
  for (const { where, row: z } of list) {
    if (!z) continue;
    const b = z.board || z.board_unproven;
    if (b && b.verdict === 'STATE') {
      PLANNED.board_state.push(key + ' @' + where);
      if (!(row.board && row.board.verdict === 'STATE')) {
        if (row.board) row.board_first_variant = row.board;
        row.board = b; row.board_state_from = where;
      }
    }
    if (z.diverged) {
      PLANNED.diverged.push(key + ' @' + where);
      if (!row.diverged) { row.diverged = true; row.divergence = row.divergence || z.divergence || null; row.diverged_from = where; }
    }
    const cb = z.board_control_arm;
    if (cb && cb.verdict === 'STATE') PLANNED.control_parted.push(key + ' control @' + where);
  }
}
function plannedRow(kind, key, name, m) {
  PLANNED.rows++;
  const results = [];
  for (const f of m.fixtures) {
    PLANNED.fixtures++;
    const megaE = f.bearer && f.bearer.via === 'mega' && f.bearer.stone ? (STONE_OF.get(id(f.bearer.stone)) || null) : null;
    const vres = [];
    for (const v of f.variants) {
      PLANNED.variants++;
      const tag = kind + '/' + key + '/plan/' + f.branch + '/' + v.layout;
      const on = playPlanned(kind, key, f, v, 'fx', tag + '/on');
      const off = v.control ? playPlanned(kind, key, f, v, 'ctl', tag + '/off') : null;
      const subj = subjectOf(v, 1);
      const who = subj ? subj.ident : 'p1a';
      let row;
      if (!on.staged) {
        row = { kind, id: key, name, fired: false, why: 'could not stage the planner fixture: ' + on.why, validator: on.validator };
      } else if (off) {
        /* The control is labelled with the ability it actually carries where the variable is the ability,
         * so the derived CONTROL-NOT-QUIET test below can ask whether that ability is itself live. */
        const ctlAb = f.control.variable === 'C.ability' && v.control.roles && v.control.roles.C ? v.control.roles.C.ability : null;
        row = abRow(kind, key, name, f.bodies.C.species, ctlAb || (f.control.variable + ' — ' + f.control.why), on, off);
        if (on.div) row.divergence = divOf(on.div, who, on.sdLog, null);
      } else {
        const nearA = subj && subj.side === 'p1' && subj.slot === 0;
        const receipt = kind === 'ability' && nearA ? abilityActedOn(on.sdLog, name, key, megaE) : [];
        const sdMega = megaE ? megaSeen(on.sdLog) : null;
        const proven = receipt.length > 0 && (!megaE || !!sdMega);
        const bv = boardVerdict(on, kind, key);
        row = { kind, id: key, name, carrier: f.bodies.C.species, control: null, board_only: true,
                verdict: proven ? 'FIRED-UNCONTROLLED' : 'UNPROVEN-UNCONTROLLED', fired: false, proven,
                authority_receipt: receipt.slice(0, 4), diverged: !!on.div, divergence: divOf(on.div, who, on.sdLog, null),
                why: proven ? null : 'the planner has no single-leaf control for this fixture ('
                  + ((f.controlRefusal || {}).code || '?') + ') and the authority\'s log never shows ' + name + ' acting for the subject'
                  + (nearA ? '' : ' (the receipt is read on the near-side slot-a variant only)') };
        if (proven) row.board = bv; else row.board_unproven = bv;
      }
      vres.push({ layout: v.layout, row, miss: on.staged ? on.scriptMiss : null, cmiss: off && off.staged ? off.scriptMiss : null });
    }
    results.push({ f, vres });
  }
  const clean = x => x.vres[0] && !x.vres[0].miss && !x.vres[0].cmiss;
  const pick = results.find(x => clean(x) && x.vres[0].row.verdict === 'FIRED')
            || results.find(x => clean(x) && x.vres[0].row.proven)
            || results[0];
  if (!pick || !pick.vres.length) return null;
  const f = pick.f, P0 = pick.vres[0];
  const row = Object.assign({}, P0.row);
  row.stage = 'planner';
  row.rung = 'planner:' + f.branch + '/' + P0.layout;
  row.carrier = f.bodies.C.species;
  row.planner = { branch: f.branch, arm: f.arm, hpPool: f.hpPool, readAfter: f.readAfter, observe: f.observe,
                  control: f.control, control_refusal: f.controlRefusal ? f.controlRefusal.code : null,
                  fixtures: results.length, bodies: f.bodies,
                  variants: results.flatMap(x => x.vres.map(z => ({ branch: x.f.branch, layout: z.layout,
                    verdict: z.row.verdict || null, fired: !!z.row.fired, proven: !!z.row.proven,
                    board: (z.row.board || z.row.board_unproven || {}).verdict || null,
                    control_board: (z.row.board_control_arm || {}).verdict || null,
                    diverged: !!z.row.diverged, script_miss: z.miss, control_script_miss: z.cmiss, why: z.row.why || null }))),
                  notes: f.notes, assumptions: f.assumptions };
  if (P0.miss || P0.cmiss) {
    row.planner.script_miss = P0.miss || P0.cmiss; row.fired = false;
    PLANNED.script_miss.push(kind + ':' + key + ' ' + JSON.stringify(row.planner.script_miss));
  }
  const vs = [...new Set(pick.vres.filter(z => z.row.verdict).map(z => z.row.verdict))];
  if (vs.length > 1) {
    row.planner.variant_split = pick.vres.map(z => z.layout + '=' + z.row.verdict);
    PLANNED.variant_split.push(kind + ':' + key + ' ' + row.planner.variant_split.join(' '));
  }
  promoteParting(row, results.flatMap(x => x.vres.map(z => ({ where: x.f.branch + '/' + z.layout, row: z.row }))), kind + ':' + key);
  return row;
}
function runPlanned(kind, list, legacy) {
  const K = kind === 'ability' ? 'abilities' : 'items';
  const plan = planOnce();
  if (!plan) { LEGACY_RAN[K] += list.length; return legacy(list); }
  const rows = [];
  for (const x of list) {
    const m = plan.byKey.get(kind + ':' + x);
    const sv = SCOPE.verdict(kind, x);
    const nm = (kind === 'ability' ? dex.abilities : dex.items).get(x).name;
    const pr = sv.inScope && plannable(m) ? plannedRow(kind, x, nm, m) : null;
    const ok = pr && !(pr.planner && pr.planner.script_miss) && (pr.verdict === 'FIRED' || pr.proven);
    if (ok) { if (pr.verdict === 'FIRED') PLANNED.fired++; else PLANNED.proven++; rows.push(pr); continue; }
    LEGACY_RAN[K]++;
    const leg = legacy([x])[0];
    if (!leg) continue;
    if (pr) {
      leg.stage = 'legacy-fallback';
      leg.planner = Object.assign({}, pr.planner, { verdict: pr.verdict || null, why: pr.why || null,
                                                    board: (pr.board || pr.board_unproven || {}).verdict || null });
      PLANNED.fallback.push(kind + ':' + x + '  planner ' + (pr.planner && pr.planner.script_miss
          ? 'SCRIPT-MISS ' + JSON.stringify(pr.planner.script_miss) : (pr.verdict || 'not staged: ' + String(pr.why || '').slice(0, 80)))
        + '  ->  legacy ' + (leg.verdict || (leg.unreachable ? 'unreachable' : String(leg.why || '?').slice(0, 60))));
      promoteParting(leg, [{ where: 'planner:' + pr.rung, row: pr }], kind + ':' + x);
    } else {
      leg.stage = sv.inScope ? 'legacy' : 'out-of-scope';
      if (m && m.refusal) {
        leg.planner = { refusal: m.refusal.code, reason: m.refusal.reason };
        if (sv.inScope) PLANNED.legacy_refused[m.refusal.code] = (PLANNED.legacy_refused[m.refusal.code] || 0) + 1;
      }
    }
    rows.push(leg);
  }
  /* CONTROL-NOT-QUIET, RE-DERIVED OVER THE WHOLE POPULATION. The ladder derives it over the rows of ONE
   * call, and the fallback calls it one row at a time — so the same rule is applied here over every row,
   * planned and legacy alike: a control ability whose own row moved a game cannot say which moved it. */
  if (kind === 'ability') {
    const live = new Set(rows.filter(r => r.showdown_moved || r.medicham_moved).map(r => r.id));
    for (const r of rows) {
      if (!r.control || r.control_not_quiet || !live.has(id(r.control))) continue;
      r.control_not_quiet = true;
      r.control_note = 'the CONTROL ability (' + r.control + ') is itself live in this run, so the pair '
                     + 'cannot say which of the two moved the game. A third arm would settle it; this pass did not run one.';
    }
  }
  return rows;
}
function plannedMoveStage(rows) {
  const plan = planOnce();
  if (!plan) return;
  for (const row of rows) {
    const m = plan.byKey.get('move:' + row.id);
    if (!plannable(m)) { if (m && m.refusal) row.planner = { refusal: m.refusal.code, reason: m.refusal.reason }; continue; }
    PLANNED.move_rows++;
    const list = [];
    for (const f of m.fixtures) {
      PLANNED.fixtures++;
      const click = (f.triggerClicks || []).find(c => c.role === 'C' && id(c.move) === row.id);
      for (const v of f.variants) {
        PLANNED.variants++;
        const tag = 'move/' + row.id + '/plan/' + f.branch + '/' + v.layout;
        const on = playPlanned('move', row.id, f, v, 'fx', tag + '/on');
        const off = v.control ? playPlanned('move', row.id, f, v, 'ctl', tag + '/off') : null;
        const subj = subjectOf(v, click ? click.turn : 1);
        const who = subj ? subj.ident : null;
        const where = f.branch + '/' + v.layout;
        if (!on.staged) { list.push({ where, staged: false, row: { why: 'could not stage: ' + on.why } }); continue; }
        const sd = verdictFor(on.sdLog, who, row.id), me = verdictFor(on.mediTrace, who, row.id);
        const cs = off && off.staged ? verdictFor(off.sdLog, who, row.id) : null;
        list.push({ where, staged: true, miss: on.scriptMiss, cmiss: off && off.staged ? off.scriptMiss : null,
                    row: { resolved: sd.resolved, attempted: sd.attempted, why: sd.why,
                           medicham_resolved: me.resolved, medicham_attempted: me.attempted, medicham_why: me.why,
                           control_resolved: cs ? cs.resolved : null, diverged: !!on.div,
                           divergence: divOf(on.div, who, on.sdLog, row.id), board: boardVerdict(on, 'move', row.id),
                           board_control_arm: off && off.staged ? boardVerdict(off, 'move', row.id) : null } });
      }
    }
    row.planned = list.map(x => ({ where: x.where, staged: x.staged, resolved: !!x.row.resolved,
                                   medicham_resolved: !!x.row.medicham_resolved,
                                   control_resolved: x.row.control_resolved == null ? null : !!x.row.control_resolved,
                                   board: (x.row.board || {}).verdict || null, diverged: !!x.row.diverged,
                                   script_miss: x.miss || null, control_script_miss: x.cmiss || null, why: x.row.why || null }));
    const P0 = list[0];
    if (P0 && P0.staged && !row.resolved && P0.row.resolved && !P0.miss) {
      Object.assign(row, { resolved: true, attempted: true, why: null, medicham_attempted: P0.row.medicham_attempted,
                           medicham_resolved: P0.row.medicham_resolved, medicham_why: P0.row.medicham_why,
                           stage: 'planner', rung: 'planner:' + P0.where, board_legacy: row.board || null, board: P0.row.board });
      PLANNED.move_resolved_by_planner.push(row.id);
    }
    if (P0 && P0.staged && !P0.row.resolved && row.resolved)
      PLANNED.move_planned_unresolved.push(row.id + ' (' + String(P0.row.why || '').slice(0, 70) + ')');
    if (P0 && P0.row.control_resolved) PLANNED.move_control_resolved.push(row.id);
    if (P0 && P0.miss) PLANNED.script_miss.push('move:' + row.id + ' ' + JSON.stringify(P0.miss));
    promoteParting(row, list.filter(x => x.staged).map(x => ({ where: x.where, row: x.row })), 'move:' + row.id);
  }
}

/* ================= MAIN =========================================================================== */
function pick(all) {
  let list = all;
  if (ONLY) { const want = new Set(ONLY.split(',').map(id)); list = list.filter(x => want.has(x)); }
  if (LIMIT) list = list.slice(0, LIMIT);
  return list;
}

console.log('\n  ALL MECHANICS FIRE — ROADMAP #143');
console.log('  release ' + (GD.REL.id || '(live)') + '   arm ' + ARM.id);
console.log('  the format admits ' + LEGAL_SPECIES.length + ' species, ' + LEGAL_MOVES.length + ' moves, '
          + LEGAL_ABILITIES.length + ' abilities, ' + LEGAL_ITEMS.length + ' items');
if (POOL_FAILS.length) console.log('  ' + POOL_FAILS.length + ' species move pools could not be built: ' + POOL_FAILS.slice(0, 5).join('; '));

const REDS = red();
console.log('\n  THE RED DEMONSTRATION — the comparison must be shown catching something before any green counts:');
for (const r of REDS) console.log('    ' + (r.caught ? 'CAUGHT  ' : 'NOT CAUGHT  ') + r.plant
  + (r.why ? '   [' + r.why + ']' : '') + (r.verdict ? '   [' + r.verdict + ']' : '')
  + (r.bent_cause ? '   [' + r.bent_cause + ']' : ''));
const RED_OK = REDS.every(r => r.caught);
if (!RED_OK) { console.log('    A PLANT WAS NOT CAUGHT. Every verdict below would be the instrument, not the engine.'); process.exitCode = 1; }
if (RED) { if (WRITE) fs.writeFileSync(OUT || D('data', 'all-mechanics-fire.json'), JSON.stringify({ red: REDS }, null, 1)); return; }

/* ---- THE CLOSET, READ FROM THE ONE PLACE IT IS DECLARED --------------------------------------
 * ROADMAP #291. Will shelved seven entities BY NAME, with his own quote and date in each entry, and
 * `tests/roster.js` states the contract: *"A row in here is still staged, still played against the
 * authority, and still printed on every run with its reason and its date. The only thing it stops
 * doing is holding the MEDICHAM gate shut."* `engine/quarantine.js` prints that shelf on every run
 * and the three deliberate-roster clauses respect it.
 *
 * THE MECHANICS CLAUSE DID NOT, and that was two instruments disagreeing about a decision the owner
 * had already made. Measured before this line existed: `abilities:forewarn` and `items:metronome`
 * were inside the failing count of 53 -- and metronome was the ONLY item in it, so the item clause
 * read 1 when the honest answer was 0.
 *
 * IMPORTED, NEVER RE-DECLARED. A second copy of seven names would agree on the day it was written
 * and disagree the first time either moved -- the ban-list-of-four failure this repo has already
 * paid for. `roster.js` owns the map; this reads it.
 *
 * A SHELVED ROW IS STILL STAGED, STILL PLAYED AND STILL PRINTED. It keeps its verdict, its
 * divergence and its cause in the artifact; what it loses is its vote in `summary[kind].diverged`.
 * Both numbers are published -- `diverged` (the gate's) and `diverged_including_shelved` -- so the
 * shelf is a visible subtraction rather than a silent one.
 *
 * KEYED BY BARE ID, WHICH IS THE MAP'S OWN SHAPE AND A HAZARD WORTH NAMING: `metronome` is both an
 * item and a move. In THIS regulation `D.moves.get('metronome').isNonstandard === 'Past'`, so the
 * move is not in the population at all and the collision cannot occur. If it ever returns, this
 * shelf would silently cover it too, and the fix belongs in the map rather than here. */
const CLOSET = require('../tests/roster.js').DEFERRED;
/* THE SECOND SHELF, AND IT IS A DIFFERENT ONE. `game_differential.js` shelves ILLUSION (ROADMAP #160)
 * and drops any TEAM carrying a legal Illusion body from its sample, deriving the species from the
 * ability so a carrier added next regulation is covered. That shelf never reached this file, and this
 * file stages an entity on ONE carrier — so `bittermalice` gets Zoroark-Hisui and `nightdaze` gets
 * Zoroark, the only two rows in the whole population whose carrier holds Illusion, and BOTH diverge
 * with `switch: a different body`. That IS Illusion: the body is announced under another body's name.
 * The reason the differential gives applies here word for word — *"a body pretending to be another
 * body makes every divergence it causes unreadable as a rule defect"* — so these are shelved on the
 * SAME decision rather than filed as two move defects. Imported from the differential, never
 * re-derived. */
const CLOSET_SPECIES = GD.CLOSET_SPECIES;
const ILLUSION_SHELF = { by: 'Will', on: '2026-08-13',
  why: 'ROADMAP #160 — ILLUSION IS IN THE CLOSET and the only carrier of this row holds it. Will: "we '
     + 'banned zoroark remember for 5. its too confusing for our simple engine." The divergence is '
     + '`switch: a different body`, which is Illusion announcing the body under another name, not a '
     + 'defect in the move. Same shelf engine/game_differential.js applies to whole teams; derived '
     + 'from the ABILITY (GD.CLOSET_SPECIES), not from a name list.' };
const _sid = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const shelvedRow = (r) => {
  if (!r) return null;
  if (CLOSET[r.id]) return CLOSET[r.id];
  if (CLOSET_SPECIES && CLOSET_SPECIES.has(_sid(r.carrier))) return ILLUSION_SHELF;
  return null;
};
/* Marks the rows in place and returns the count the GATE should not see. Printed by every caller. */
/* TWO COUNTS, BECAUSE THEY ANSWER TWO QUESTIONS. `shelved_by_owner` is how many rows the shelf
 * covers at all; `shelved_by_owner_diverging` is how many DIVERGING rows it removed from the gate's
 * number. Publishing only the first would make the subtraction unreadable, and publishing only the
 * second would hide the size of the shelf. */
function applyCloset(kind, rows) {
  const hit = [];
  for (const r of rows || []) {
    const d = shelvedRow(r);
    if (!d) continue;
    r.deferred = d;
    r.counts_against_the_gate = false;
    if (r.diverged) hit.push(r);
  }
  if (hit.length) {
    console.log('    THE CLOSET — ' + hit.length + ' shelved ' + kind + ' row(s) DIVERGE and are NOT '
              + 'counted. Still staged, still played, printed here with the owner reason:');
    for (const r of hit) console.log('      ' + String(r.id).padEnd(16)
      + String((r.divergence && r.divergence.cls) || r.verdict || '?').padEnd(30)
      + '[' + r.deferred.by + ' ' + r.deferred.on + '] ' + String(r.deferred.why).slice(0, 120));
  }
  return { diverging: hit.length, total: (rows || []).filter(r => r.deferred).length };
}

/* THE WHOLE STAMP, NOT A HAND-ROLLED `release` — 2026-09-04.
 *
 * `release: GD.REL.id` spelled the pin itself instead of asking the module that owns it, and it cost
 * two fields that decide what this artifact measured. `showdown_commit`: the population of this run
 * is `dex.moves.all()` / `.abilities.all()` / `.items.all()` filtered to the format, so the Showdown
 * checkout IS the denominator — 500 moves is a fact about a commit. `source_digests`: the only thing
 * provenance.js can verify by CONTENT, an id being a claim rather than a receipt.
 *
 * `release` is kept beside the stamp because readers cite it by that name; `stamp()` writes
 * `engine_release`, which is the spelling every other artifact in this repository uses and the one
 * `engine/pin_guard.js` reads. */
const report = { generated: new Date().toISOString(),
                 ...GD.REL.stamp(), release: GD.REL.id || null, arm: ARM.id,
                 format: CS.FORMAT, red: REDS, red_ok: RED_OK, trailing_turns_forced: TRAILING,
                 closet: { source: 'tests/roster.js DEFERRED', ids: Object.keys(CLOSET) },
                 rows: {}, summary: {} };

if (KIND === 'moves' || KIND === 'all') {
  const list = pick(LEGAL_MOVES);
  console.log('\n  MOVES — ' + list.length + ' of ' + LEGAL_MOVES.length + ' attempted');
  const t0 = Date.now();
  const rows = runMoves(list);
  plannedMoveStage(rows);
  report.rows.moves = rows;
  const resolved = rows.filter(r => r.resolved);
  const attempted = rows.filter(r => r.attempted);
  const divergedAll = rows.filter(r => r.diverged);
  const shelvedN = applyCloset('move', rows);
  const diverged = divergedAll.filter(r => !r.deferred);
  const disagree = rows.filter(r => r.attempted && r.resolved !== r.medicham_resolved);
  report.summary.moves = { exist: LEGAL_MOVES.length, attempted: attempted.length, tried: rows.length,
                           resolved: resolved.length, diverged: diverged.length,
                           diverged_including_shelved: divergedAll.length,
                           shelved_by_owner: shelvedN.total,
                           shelved_by_owner_diverging: shelvedN.diverging,
                           resolution_disagreements: disagree.length,
                           cannot_fire_in_this_fixture: rows.filter(r => r.cannot_fire).length,
                           /* MEASURE 2026-08-29. `resolved` counts a click that produced a LINE. This
                            * counts whether the leaf that click created ever DID anything, which for
                            * a `duration: 1` leaf no board comparison can ask. */
                           announcement_only: rows.filter(r => r.announcement_only).length,
                           leaf_effect: Object.assign({}, MOVE_THEN_WHAT_SEEN),
                           seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  console.log('    RESOLVED ' + resolved.length + ' of ' + rows.length + ' tried, of ' + LEGAL_MOVES.length + ' that exist'
            + '   (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  /* THE HEADLINE COUNT SPLITS, because a single partner-slot bug used to inflate it by one per row
   * that happened to contain it. Both numbers are printed; neither is hidden. */
  const mineN = diverged.filter(r => r.divergence && !r.divergence.shared_suspect).length;
  const otherN = diverged.length - mineN;
  console.log('    diverged from Showdown: ' + diverged.length
            + '   (' + mineN + ' inside the subject\'s own move'
            + (otherN ? ', ' + otherN + ' inside another slot\'s move — possibly ONE shared defect, '
                      + 'not ' + otherN + ' separate ones' : '') + ')');
  const byWhy = new Map();
  for (const r of rows) if (!r.resolved) { const k = String(r.why || '?').slice(0, 90); byWhy.set(k, (byWhy.get(k) || 0) + 1); }
  console.log('    WHY THE REST DID NOT RESOLVE:');
  for (const [k, v] of [...byWhy].sort((x, y) => y[1] - x[1])) console.log('      ' + String(v).padStart(4) + '  ' + k);
  /* ---- THE EFFECT CHECK'S OWN RECEIPT (MEASURE, 2026-08-29) --------------------------------------
   *
   * A capability that cannot prove it ran is assumed broken, and this one is silent by construction:
   * an effect check that reached nothing looks exactly like an effect check that passed. Every column
   * here is derived — `leafDeclaresMarker` from the authority's own condition source, the rest from
   * the games actually played — and a zero on the first means the derivation stopped matching, which
   * is a broken instrument rather than a clean engine. */
  const LEC = MOVE_THEN_WHAT_SEEN;
  console.log('    LEAF EFFECT — ' + LEC.leafDeclaresMarker + ' row(s) write a leaf that PRINTS when it '
            + 'refuses something; ' + LEC.leafEffectSeen + ' of those had the effect on the board, '
            + LEC.announcementOnly + ' resolved on the ANNOUNCEMENT alone.');
  console.log('      consequence table: ' + LEC.rows + ' move row(s) carry a key, same-turn adversary '
            + 'asked for ' + LEC.sameTurnAsked + ' and staged on ' + LEC.sameTurnStaged
            + '; ' + LEC.leafDeclaresNoMarker + ' leaf(s) print nothing when they fire and belong to a counter.');
  if (!LEC.leafDeclaresMarker && rows.length > 20) {
    console.log('      NO ROW DECLARED AN EFFECT MARKER. Over a full population that is the derivation '
              + 'having stopped matching the authority, not a clean engine. A zero here is not a pass.');
    process.exitCode = 1;
  }
  if (Object.keys(LEC.leafEffectSplit).length)
    console.log('      LEAF-EFFECT SPLIT (one engine saw it and the other did not): '
              + JSON.stringify(LEC.leafEffectSplit) + ' — each is a candidate ENGINE GAP.');
  if (LEC.verbsUnknown)
    console.log('      ' + LEC.verbsUnknown + ' consequence verb(s) the shared table names and the MOVE '
              + 'arm cannot execute: ' + JSON.stringify(LEC.verbsUnknownSeen) + '. Those rows staged '
              + 'NOTHING for that key. They belong to the ability gauntlet\'s vocabulary and are '
              + 'counted rather than dropped.');
  if (Object.keys(LEC.shapeUnbuildable).length)
    console.log('      ' + JSON.stringify(LEC.shapeUnbuildable) + ' — a hit of that SHAPE could not be '
              + 'built out of the receiver\'s legal pool, so the leaf keeps the board it had. This is '
              + 'a fixture limit and is NOT an engine finding.');
  if (LEC.sameTurnDenied)
    console.log('      ' + LEC.sameTurnDenied + ' row(s) declare BOTH a same-turn consequence and a '
              + 'target that must not attack. The board that exercises the leaf is the board on which '
              + 'the move is refused; it needs two rows and this arm has one.');
  const AO = rows.filter(r => r.announcement_only);
  if (AO.length) {
    console.log('      ANNOUNCEMENT-ONLY — resolved, and the leaf it wrote never refused anything:');
    for (const r of AO) console.log('        ' + r.id.padEnd(18) + ' rung ' + String(r.rung).padEnd(14)
      + ' markers ' + JSON.stringify(r.leaf_effect.markers)
      + '  ' + (r.leaf_effect.not_staged_because || 'the adversary was staged and the marker still never came'));
  }
  /* §5 OF THE DIFFERENTIAL DESIGN, APPLIED HERE: twelve games hitting one wire is ONE finding and not
   * twelve, so the divergences are collapsed onto the driver's own SPECIES-BLIND cause. */
  reportCauses(rows);
}

if (KIND === 'abilities' || KIND === 'all') {
  const list = pick(LEGAL_ABILITIES);
  console.log('\n  ABILITIES — ' + list.length + ' of ' + LEGAL_ABILITIES.length + ' attempted');
  const t0 = Date.now();
  const rows = runPlanned('ability', list, runAbilities);
  report.rows.abilities = rows;
  const fired = rows.filter(r => r.verdict === 'FIRED');
  const _shelvedAb = applyCloset('ability', rows);
  report.summary.abilities = { exist: LEGAL_ABILITIES.length, tried: rows.length, fired: fired.length,
    showdown_only: rows.filter(r => r.verdict === 'SHOWDOWN-ONLY').length,
    medicham_only: rows.filter(r => r.verdict === 'MEDICHAM-ONLY').length,
    did_not_fire: rows.filter(r => r.verdict === 'DID-NOT-FIRE').length,
    unreachable: rows.filter(r => r.unreachable).length,
    control_not_quiet: rows.filter(r => r.control_not_quiet).length,
    /* THE SPLIT OF `did_not_fire`, ADDED BESIDE IT AND NOT INSTEAD OF IT. `did_not_fire` keeps its old
     * meaning for whatever already reads this artifact; these two partition it. */
    cannot_fire_in_this_fixture: rows.filter(r => r.cannot_fire).length,
    did_not_fire_unexplained: rows.filter(r => r.verdict === 'DID-NOT-FIRE' && !r.cannot_fire).length,
    diverged: rows.filter(r => r.diverged && !r.deferred).length,
    diverged_including_shelved: rows.filter(r => r.diverged).length,
    shelved_by_owner: _shelvedAb.total, shelved_by_owner_diverging: _shelvedAb.diverging,
    seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  console.log('    ' + JSON.stringify(report.summary.abilities));
  reportCannotFire(rows);
  /* ROADMAP #158 -- THE CONSEQUENCE LAYER'S OWN RECEIPT. A capability that cannot prove it ran is
   * assumed broken, and this one is silent by construction: a `thenWhat` that reached nothing looks
   * exactly like the inert row it was written to fix. `rows` is how many entities were handed a
   * consequence, `turnsAdded` is how many turns those consequences actually put on the board, and a
   * ZERO on either means the table is unread. `verbsUnknown` is the loud half of the fallback.
   * `unstageable` is the DECLARED gap — `announcesOnEntry` sets `stage: null` because a message
   * cannot be made visible to a board comparator by any number of turns. */
  /* ---- THE BOARD-ONLY ARM'S RECEIPT (HB-1, HB-2) AND THE TWO HB-3 PRINTS -------------------------- */
  report.summary.abilities.board_only = Object.assign({}, BOARD_ONLY);
  report.summary.abilities.board_only_proven = BOARD_ONLY.proven;
  report.summary.abilities.carrier_pick_moved = CARRIER_PICK_MOVED.slice();
  report.summary.abilities.body_fallback = [...BODY_FALLBACK].sort();
  console.log('    BOARD-ONLY ARM — ' + BOARD_ONLY.rows + ' row(s) with no control, ' + BOARD_ONLY.staged + ' staged, '
    + BOARD_ONLY.proven + ' PROVEN off the authority\'s log (these carry a board); unproven: '
    + (BOARD_ONLY.unproven.join(' ') || 'none') + '; mega asks refused ' + BOARD_ONLY.mega_refused
    + (BOARD_ONLY.alt_receiver.length ? '; alternate receiver ' + BOARD_ONLY.alt_receiver.join(' ') : ''));
  for (const [a, l] of Object.entries(BOARD_ONLY.receipts)) console.log('      ' + a.padEnd(16) + ' ' + l);
  if (BOARD_ONLY.tag_triggers.length) console.log('      tag-keyed triggers staged: ' + BOARD_ONLY.tag_triggers.join('; '));
  if (BOARD_ONLY.game_errors.length) console.log('      ' + BOARD_ONLY.game_errors.length + ' board-only game(s) ended on a harness '
    + 'error (boards before it were compared): ' + BOARD_ONLY.game_errors.slice(0, 4).map(s => s.slice(0, 90)).join(' | '));
  if (BOARD_ONLY.state_unproven.length) console.log('      AN UNPROVEN ROW\'S BOARD PARTED: ' + BOARD_ONLY.state_unproven.join(' ')
    + ' — the game diverged on the board whether or not this ability moved it. A candidate ENGINE defect.');
  if (BOARD_ONLY.mega_not_seen.length || BOARD_ONLY.mega_refused) {
    console.log('      A MEGA CARRIER NEVER EVOLVED IN THE AUTHORITY: ' + (BOARD_ONLY.mega_not_seen.join(' ') || '(none)')
      + ', refused asks ' + BOARD_ONLY.mega_refused + '. Not a pass.');
    process.exitCode = 1;
  }
  if (BOARD_ONLY.item_conflict.length) console.log('      stone kept over a consequence item: ' + BOARD_ONLY.item_conflict.join('; '));
  console.log('    HB-3 CARRIER PICK — rows whose carrier the build-aware pick MOVED: '
    + (CARRIER_PICK_MOVED.join('; ') || 'none'));
  console.log('    HB-3 OWN-POOL FALLBACK — species built from their own pool: '
    + ([...BODY_FALLBACK].sort().join(' ') || 'none'));
  report.summary.then_what = Object.assign({}, THEN_WHAT_SEEN);
  report.summary.then_what_rows_with_a_consequence = rows.filter(r => r.then_what).length;
  console.log('    THEN-WHAT (ROADMAP #158): ' + JSON.stringify(report.summary.then_what)
            + '   rows carrying a consequence: ' + report.summary.then_what_rows_with_a_consequence);
  if (!FULL_LEGACY()) console.log('    (the consequence ladder played ' + LEGACY_RAN.abilities + ' fallback row(s), not the whole '
    + 'population, so the zero-check below applies only to a --no-plan run)');
  if (FULL_LEGACY() && (!THEN_WHAT_SEEN.rows || !THEN_WHAT_SEEN.turnsAdded)) {
    console.log('    THE CONSEQUENCE LAYER ADDED NOTHING. Either no entity in this population carries a '
              + '`thenWhat` key, or the table is not being read. A zero here is not a pass.');
    process.exitCode = 1;
  }
  if (THEN_WHAT_SEEN.verbsUnknown) {
    console.log('    ' + THEN_WHAT_SEEN.verbsUnknown + ' stage verb(s) the table names and this file '
              + 'cannot execute (first: ' + THEN_WHAT_SEEN.verbsUnknownFirst + '). Those rows staged '
              + 'NOTHING for that key, which is indistinguishable from a consequence that did not help.');
    process.exitCode = 1;
  }
  const so = rows.filter(r => r.verdict === 'SHOWDOWN-ONLY');
  console.log('    SHOWDOWN-ONLY — the authority\'s game moved and ours did not. Each is a candidate ENGINE GAP:');
  for (const r of so) console.log('      ' + r.id.padEnd(18) + ' carrier ' + String(r.carrier).padEnd(15)
    + ' control ' + String(r.control).padEnd(14) + (r.control_not_quiet ? '  [CONTROL NOT QUIET — attribution ambiguous]' : ''));
}

if (KIND === 'items' || KIND === 'all') {
  const list = pick(LEGAL_ITEMS);
  console.log('\n  ITEMS — ' + list.length + ' of ' + LEGAL_ITEMS.length + ' attempted');
  const t0 = Date.now();
  const rows = runPlanned('item', list, runItems);
  report.rows.items = rows;
  const _shelvedIt = applyCloset('item', rows);
  report.summary.items = { exist: LEGAL_ITEMS.length, tried: rows.length,
    fired: rows.filter(r => r.verdict === 'FIRED').length,
    showdown_only: rows.filter(r => r.verdict === 'SHOWDOWN-ONLY').length,
    medicham_only: rows.filter(r => r.verdict === 'MEDICHAM-ONLY').length,
    did_not_fire: rows.filter(r => r.verdict === 'DID-NOT-FIRE').length,
    out_of_scope: rows.filter(r => r.out_of_scope).length,
    cannot_fire_in_this_fixture: rows.filter(r => r.cannot_fire).length,
    did_not_fire_unexplained: rows.filter(r => r.verdict === 'DID-NOT-FIRE' && !r.cannot_fire).length,
    diverged: rows.filter(r => r.diverged && !r.deferred).length,
    diverged_including_shelved: rows.filter(r => r.diverged).length,
    shelved_by_owner: _shelvedIt.total, shelved_by_owner_diverging: _shelvedIt.diverging,
    board_state_staged: rows.filter(r => r.board_state_plan && r.board_state_plan.staged).length,
    board_state_fired: rows.filter(r => r.rung === 'board-state' && r.verdict === 'FIRED').length,
    seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  console.log('    ' + JSON.stringify(report.summary.items));
  reportCannotFire(rows);
  /* ---- THE BOARD-STATE RUNG'S OWN RECEIPT. A capability that cannot prove it ran is assumed broken,
   * and this one is silent by construction: a rung that staged nothing produces exactly the artifact a
   * rung that does not exist produces. `planned` is how many rows got a board built for them, and the
   * rows that FIRED ON IT are named, because that is the whole claim. */
  report.summary.board_state = Object.assign({}, STATE_PLAN);
  console.log('    BOARD-STATE RUNG — ' + STATE_PLAN.rows + ' item rows carry a state need, '
    + STATE_PLAN.planned + ' got a board built, ' + STATE_PLAN.unplanned + ' could not '
    + '(' + (Object.entries(STATE_PLAN.unplanned_kinds).map(([k, v]) => k + ' x' + v).join(', ') || 'none') + ')'
    + (STATE_PLAN.capped ? ', ' + STATE_PLAN.capped + ' HIT THE PAIR-SEARCH CAP' : ''));
  const bsFired = rows.filter(r => r.rung === 'board-state' && r.verdict === 'FIRED');
  console.log('      FIRED ON IT: ' + (bsFired.map(r => r.id).join(' ') || '(none)'));
  /* ONLY WHERE THE RUNG WAS ACTUALLY PLAYED. A row that fires on an earlier rung never reaches this
   * one, so its receipts are trivially unmet — reporting that would read as a staging failure on a row
   * that needed no staging at all (measured: `focusband`, which fires on `safe-pool`). */
  const bsUnmet = rows.filter(r => r.board_state_plan && r.board_state_plan.outcome
    && r.board_state_plan.receipts_unmet.length);
  if (bsUnmet.length) console.log('      RECEIPT NOT MET — the staging move did not resolve in the '
    + 'authority\'s log, so the state is NOT declared: '
    + bsUnmet.map(r => r.id + ' [' + r.board_state_plan.receipts_unmet.join(',') + ']').join(' '));
  if (STATE_PLAN.examples.length) console.log('      e.g. ' + STATE_PLAN.examples.slice(0, 12).join('; '));
  /* ---- THE STONE ARM'S OWN RECEIPT (harness batch HB-4). A capability that cannot prove it ran is
   * assumed broken: every stone row that ran must show the authority's `|-mega|`, no ask may have been
   * refused, and the stat line must have been READ on every row — an unread leaf reads as agreement. */
  report.summary.items.stones = Object.assign({}, STONE_SUMMARY);
  if (STONE_SUMMARY.rows) {
    console.log('    MEGA STONES — ' + STONE_SUMMARY.rows + ' row(s), ' + STONE_SUMMARY.staged + ' staged, '
      + STONE_SUMMARY.fired + ' FIRED; |-mega| in the authority ' + STONE_SUMMARY.mega_seen_showdown
      + ', in medicham2 ' + STONE_SUMMARY.mega_seen_medicham + '; asks refused ' + STONE_SUMMARY.mega_refused
      + '; stat line compared at ' + STONE_SUMMARY.stat_line_compared + ' boundaries, unreadable at '
      + STONE_SUMMARY.stat_line_unreadable + ', PARTED on ' + (STONE_SUMMARY.stat_line_parted.join(' ') || 'none')
      + (STONE_SUMMARY.alt_receiver.length ? '; alternate receiver: ' + STONE_SUMMARY.alt_receiver.join(' ') : ''));
    if (STONE_SUMMARY.not_seen.length) {
      console.log('      THE AUTHORITY NEVER EVOLVED ON ' + STONE_SUMMARY.not_seen.length + ' stone row(s): '
        + STONE_SUMMARY.not_seen.join(' ') + ' — those rows carry NO board. Not a pass.');
      process.exitCode = 1;
    }
    if (STONE_SUMMARY.mega_refused) {
      console.log('      ' + STONE_SUMMARY.mega_refused + ' mega ask(s) REFUSED by the authority\'s request. Not a pass.');
      process.exitCode = 1;
    }
    if (STONE_SUMMARY.staged && (!STONE_SUMMARY.stat_line_compared || STONE_SUMMARY.stat_line_unreadable)) {
      console.log('      THE STAT LINE WAS ' + (STONE_SUMMARY.stat_line_compared ? 'UNREADABLE at '
        + STONE_SUMMARY.stat_line_unreadable + ' boundaries' : 'NEVER READ') + '. An unread leaf reads as agreement. Not a pass.');
      process.exitCode = 1;
    }
  }
}

/* ---- THE PLANNED PATH'S OWN RECEIPT (2026-09-11). A capability that cannot prove it ran is assumed
 * broken: the planner's fixtures must have played games, both driver seams must have been used, and every
 * fallback, script miss, variant split and parting is named rather than totalled. */
if (PLAN) {
  const P = PLAN.P, seam = GD.seamCounters();
  report.planner = { meta: { generated: P.meta.generated, by: P.meta.by, tags: P.meta.tags, tags_digest: P.meta.tags_digest,
                             showdown: P.meta.showdown, validator: P.meta.validator, crit: P.meta.crit, arms: P.meta.arms,
                             genderPin: P.meta.genderPin, genderSeam: P.meta.genderSeam, normalised: P.meta.normalised,
                             overmatchDropped: P.meta.overmatchDropped, ms: P.meta.ms },
                     summary: P.summary, played: PLANNED, seam, legacy_ran: LEGACY_RAN };
  console.log('\n  PLANNED PATH — ' + PLANNED.rows + ' ability/item row(s) and ' + PLANNED.move_rows + ' move row(s) played their planner '
    + 'fixtures: ' + PLANNED.fixtures + ' fixture(s), ' + PLANNED.variants + ' variant(s), ' + PLANNED.games + ' game(s)');
  console.log('    FIRED on the planner ' + PLANNED.fired + ', proven board-only ' + PLANNED.proven + ', legacy FALLBACK '
    + PLANNED.fallback.length + ', planner refusals run by the ladder ' + JSON.stringify(PLANNED.legacy_refused));
  console.log('    seams: declaredSpread ' + seam.declaredSpread + ' bodies, declaredGender ' + seam.declaredGender + ' of '
    + seam.declaredGenderBodies + ' bodies carried M/F');
  for (const x of PLANNED.fallback) console.log('      FALLBACK  ' + x);
  for (const x of PLANNED.script_miss) console.log('      SCRIPT-MISS  ' + x);
  for (const x of PLANNED.variant_split) console.log('      VARIANT-SPLIT  ' + x);
  for (const x of PLANNED.board_state) console.log('      BOARD STATE  ' + x);
  for (const x of [...new Set(PLANNED.diverged)]) console.log('      DIVERGED  ' + x);
  for (const x of PLANNED.control_parted) console.log('      CONTROL-ARM BOARD PARTED  ' + x);
  if (PLANNED.move_resolved_by_planner.length) console.log('    moves resolved by the planner where the ladder did not: ' + PLANNED.move_resolved_by_planner.join(' '));
  if (PLANNED.move_planned_unresolved.length) console.log('    moves the ladder resolves and the planner fixture does not (planner gaps): '
    + PLANNED.move_planned_unresolved.length + ' — ' + PLANNED.move_planned_unresolved.slice(0, 12).join('; '));
  if (PLANNED.move_control_resolved.length) console.log('    move controls that resolved the subject move anyway: ' + PLANNED.move_control_resolved.join(' '));
  if ((PLANNED.rows + PLANNED.move_rows) && !PLANNED.games) {
    console.log('    PLANNED ROWS PLAYED NO GAME. A capability that cannot prove it ran is assumed broken. Not a pass.');
    process.exitCode = 1;
  }
  if (PLANNED.games && !seam.declaredSpread) {
    console.log('    THE DECLARED-SPREAD SEAM WAS NEVER USED — every planned game was played on the index ladder. Not a pass.');
    process.exitCode = 1;
  }
}

/* ---- THE PREFLIGHT'S OWN RECEIPT. A CAPABILITY THAT CANNOT PROVE IT RAN IS ASSUMED BROKEN, and this
 * one is silent by construction: a preflight that is never called produces exactly the artifact a
 * preflight that finds nothing produces. `rows_checked` is the counter that separates them, and a ZERO
 * is a failure rather than a clean bill of health. */
report.summary.preflight = Object.assign({}, PREFLIGHT);
console.log('\n  PREFLIGHT (engine/fixture_preflight.js) — ' + PREFLIGHT.rows_checked + ' rows checked, '
          + PREFLIGHT.checked + ' calls, ' + PREFLIGHT.rows_labelled + ' labelled CANNOT-FIRE');
console.log('    clauses matched: ' + (Object.keys(PREFLIGHT.by_clause).length
  ? Object.entries(PREFLIGHT.by_clause).map(([k, v]) => k + ' x' + v).join(', ') : '(none)'));
if (PREFLIGHT.repaired_weather || PREFLIGHT.weather_unrepairable)
  console.log('    WEATHER REPAIRED on ' + PREFLIGHT.repaired_weather + ' row(s), unrepairable on '
            + PREFLIGHT.weather_unrepairable + ' (the carrier can learn no setter for the sky it needs): '
            + PREFLIGHT.repairs.slice(0, 12).join('; '));
if (PREFLIGHT.faces_weather_noop || PREFLIGHT.faces_status_noop)
  console.log('    engine/faces.js INTENTS THAT REACHED NO BOARD: setsWeather x' + PREFLIGHT.faces_weather_noop
            + ', statusFirst x' + PREFLIGHT.faces_status_noop + ' — `clickOf` falls back to the body\'s '
            + 'first move when it does not hold the ask, so these staged nothing. The weather half is now '
            + 'repaired; the status half CANNOT be, because the receiver fixture (Feraligatr) has no '
            + 'status-only move in its legal pool at all.');
/* THE DERIVED TRIGGER, COUNTED ON EVERY RUN. A zero on `trigger_rows` over a population that contains
 * abilities means the derivation is UNWIRED — which looks exactly like "no ability needs a move", the
 * silent default this whole block exists to remove. */
if (KIND === 'abilities' || KIND === 'all') {
  console.log('    DERIVED TRIGGERS (fixture_preflight.moveNeeds) — ' + PREFLIGHT.trigger_rows
    + ' abilities carry a handler-derived move need; ' + PREFLIGHT.trigger_needs + ' needs, '
    + PREFLIGHT.trigger_staged + ' STAGED on a legal body, ' + PREFLIGHT.trigger_unstaged
    + ' UNSTAGED (the fixed bodies cannot supply it — each such row carries the `trigger-move` clause)');
  if (PREFLIGHT.trigger_examples.length)
    console.log('      e.g. ' + PREFLIGHT.trigger_examples.slice(0, 10).join('; '));
  if (!PREFLIGHT.trigger_rows && !BREAK_PREFLIGHT && FULL_LEGACY()) {
    console.log('      ZERO. The derivation reached no row at all — that is an unwired capability, not '
      + 'a population with no gated abilities. Not a pass.');
    process.exitCode = 1;
  }
  report.summary.preflight.trigger = { rows: PREFLIGHT.trigger_rows, needs: PREFLIGHT.trigger_needs,
    staged: PREFLIGHT.trigger_staged, unstaged: PREFLIGHT.trigger_unstaged,
    examples: PREFLIGHT.trigger_examples };
}
if (PREFLIGHT.over_matched.length) {
  /* A REFUSED BOARD THAT FIRED ANYWAY. The preflight and the A/B arm cannot both be right, and the
   * split is derived from this run's own rows rather than argued: if the row's CONTROL is itself live,
   * the A/B cannot say which of the two abilities moved the game and the contradiction is explained.
   * If it is not, the clause is refusing a board that demonstrably works, and that is a defect in the
   * clause — the one direction in which this predicate can be wrong and hide it. */
  const find = (o) => ((report.rows[o.kind === 'item' ? 'items' : 'abilities'] || []).find(r => r.id === o.id) || {});
  const explained = PREFLIGHT.over_matched.filter(o => find(o).control_not_quiet);
  const unexplained = PREFLIGHT.over_matched.filter(o => !find(o).control_not_quiet);
  console.log('    THE PREFLIGHT BLOCKED ' + PREFLIGHT.over_matched.length + ' row(s) that fired anyway:');
  if (explained.length) console.log('      ' + explained.length + ' explained by an UNQUIET CONTROL — the A/B '
    + 'moved for the control ability, not the subject: ' + explained.map(o => o.id + ' [' + o.clauses + ']').join(', '));
  if (unexplained.length) {
    console.log('      ' + unexplained.length + ' UNEXPLAINED — the clause refused a board that works. THE '
      + 'CLAUSE IS WRONG, not the engine: ' + unexplained.map(o => o.id + ' [' + o.clauses + ']').join(', '));
    console.log('      (a partial population can produce this too: `control_not_quiet` is derived from the '
      + 'rows in THIS run, so a control whose own row was not run cannot be seen to be live)');
    process.exitCode = 1;
  }
  report.summary.preflight.over_matched_explained = explained.map(o => o.id);
  report.summary.preflight.over_matched_unexplained = unexplained.map(o => o.id);
}
if (!PREFLIGHT.rows_checked && !BREAK_PREFLIGHT
    && !(PLAN && KIND !== 'moves' && LEGACY_RAN.abilities + LEGACY_RAN.items === 0)) {
  console.log('    THE PREFLIGHT NEVER RAN ON A SINGLE ROW. Every DID-NOT-FIRE below is unsplit — an '
            + 'engine gap and a fixture gap in one bucket. A zero here is not a pass.');
  process.exitCode = 1;
}
if (BREAK_PREFLIGHT) console.log('    (STUBBED by --break-preflight — every row above is unsplit. This is the red arm.)');

report.games_played = GAMES;
report.games_threw = THREW;
report.sheets_unassembled = SHEET_FAILS;
/* THE OVERLAP WITH THE DELIBERATE ROSTER. Printed for every population that ran, because the useful
 * output of two instruments is not either list — it is the row NEITHER of them reaches. */
report.overlap = {};
console.log('\n  OVERLAP WITH THE DELIBERATE ROSTER (staged single turn) — the interesting column is the last one:');
for (const k of Object.keys(report.rows)) {
  const o = rosterOverlap(k, report.rows[k]);
  report.overlap[k] = o;
  if (!o.available) { console.log('    ' + k + ': ' + o.why); continue; }
  console.log('    ' + k.padEnd(10) + ' roster fired ' + String(o.roster_fired).padStart(4)
            + '   here fired ' + String(o.here_fired).padStart(4)
            + '   BOTH ' + String(o.both).padStart(4)
            + '   only here ' + String(o.only_here.length).padStart(4)
            + '   only roster ' + String(o.only_roster.length).padStart(4)
            + '   NEITHER ' + String(o.neither.length).padStart(4));
  if (o.only_here.length) console.log('      only THIS instrument reaches: ' + o.only_here.slice(0, 30).join(' ')
    + (o.only_here.length > 30 ? ' …' : ''));
  if (o.neither.length) console.log('      NEITHER reaches: ' + o.neither.slice(0, 40).join(' ')
    + (o.neither.length > 40 ? ' …' : ''));
  /* AN EXEMPTION THAT IS NOT PRINTED IS AN EXEMPTION NOBODY CHECKS. */
  if (o.exemption) {
    const e = o.exemption;
    console.log('      EXEMPTION RECONCILED: ' + e.reconciled + ' of ' + e.excused
      + ' out-of-scope rows carry a FIRED verdict in ' + e.covered_by
      + (e.unreconciled.length ? '  <-- UNRECONCILED: ' + e.unreconciled.join(' ') : '')
      + '\n        that artifact was cut at release ' + e.roster_release + ' on '
      + String(e.roster_generated).slice(0, 10) + ' — the coverage is per-entity and it is NOT this run\'s release');
  }
}
/* ================= DID THE PARTED COMMENTARY REACH THE SAME BOARD? (2026-08-19) ====================
 *
 * WILL'S OWN STANDARD: *"it looks at the game. the commentary can be different but it needs to lead to
 * identical outcomes in all scenarios"* — so the protocol classes above (`event missing from
 * medicham2`, `ordering`) are the QUESTION and this block is the ANSWER.
 *
 * EVERY VERDICT HERE IS BOUNDED BY WHAT `board_state.js` COMPARES, and the bound is printed with it
 * rather than left as an absence, because an uncomparable leaf reads exactly like an agreeing one.
 * `board_state.js`'s own `NOT_COMPARED` list is republished into the artifact for the same reason. */
const BOARD_SUMMARY = {};
{
  console.log('\n  DID THE PARTED COMMENTARY REACH THE SAME BOARD?');
  console.log('    every verdict below is bounded by what engine/board_state.js compares — a leaf it does');
  console.log('    not read cannot make a board differ, and NOT_COMPARED is republished in the artifact');
  const order = ['STATE', 'NOT-ASKED', 'ANNOUNCEMENT-ONLY', 'NO-DIVERGENCE', 'NOT-STAGED'];
  for (const k of Object.keys(report.rows)) {
    const rows = (report.rows[k] || []).filter(r => r.board);
    if (!rows.length) continue;
    const tally = {};
    for (const r of rows) tally[r.board.verdict] = (tally[r.board.verdict] || 0) + 1;
    console.log('    ' + k.padEnd(10) + order.filter(v => tally[v]).map(v => v + ' ' + tally[v]).join('   '));
    BOARD_SUMMARY[k] = { tally, rows: rows.length };
    /* THE THREE THAT ARE FINDINGS, NAMED. A tally alone is the boolean this whole pass replaces. */
    const state = rows.filter(r => r.board.verdict === 'STATE');
    const silent = rows.filter(r => r.board.state_parted_without_a_line);
    const notAsked = rows.filter(r => r.board.verdict === 'NOT-ASKED');
    for (const r of state) {
      console.log('      STATE  ' + String(r.id).padEnd(18) + 'boards parted at turn ' + r.board.state_parted_on_turn
        + ' (protocol parted at turn ' + r.board.protocol_parted_on_turn + ')'
        + (r.board.state_parted_without_a_line ? '  — WITH NO LINE DIFFERENCE AT ALL' : ''));
      for (const d of (r.board.diffs || []).slice(0, 6))
        console.log('        ' + [d.side, d.slot, d.body].filter(Boolean).join(' ') + '  ' + d.field
          + '   showdown ' + JSON.stringify(d.sd) + '   we ' + JSON.stringify(d.us) + '   [' + d.bucket + ']');
    }
    for (const r of notAsked)
      console.log('      NOT-ASKED  ' + String(r.id).padEnd(18) + 'no board was taken at or after turn '
        + r.board.protocol_parted_on_turn + ' — ' + (r.board.end_reason || 'no reason recorded')
        + '. THIS IS NOT A PASS.');
    if (silent.length) console.log('      ' + silent.length + ' row(s) parted on the BOARD with the two '
      + 'streams in agreement — a silent state defect, which the protocol arm structurally cannot see.');
    /* THE QUALIFIED CLEAN ROWS. Printed BESIDE the announcement-only tally and never inside it: a row
     * whose own volatile is absent from the comparison has not been cleared, it has not been asked. */
    const qualified = rows.filter(r => r.board.core_leaf_unchecked);
    if (qualified.length) {
      console.log('      ' + qualified.length + ' of the ANNOUNCEMENT-ONLY rows WRITE A LEAF THE BOARD DOES');
      console.log('      NOT READ. Their boards agreed in the fields we look at; the field this mechanic');
      console.log('      actually writes is not one of them, so they are UNASKED rather than clean:');
      for (const r of qualified) console.log('        ' + String(r.id).padEnd(18) + r.board.uncomparable_leaves.join(', '));
    }
    BOARD_SUMMARY[k].core_leaf_unchecked_rows = qualified.map(r => ({ id: r.id, leaves: r.board.uncomparable_leaves }));
    BOARD_SUMMARY[k].state_rows = state.map(r => r.id);
    BOARD_SUMMARY[k].not_asked_rows = notAsked.map(r => r.id);
    BOARD_SUMMARY[k].silent_state_rows = silent.map(r => r.id);
    /* THE RECEIPTS, POOLED, so "identical" is never read as "identical in every field there is". */
    const held = rows.filter(r => r.board.receipts && (r.board.receipts.party_post_faint_skipped
      || r.board.receipts.pp_slots_compared < r.board.receipts.pp_slots_occupied
      || !r.board.receipts.screens_named_comparable));
    if (held.length) console.log('      ' + held.length + ' row(s) had at least one leaf HELD rather than '
      + 'compared (a fainted party member, an inexpressible PP slot, or a screen shape one engine cannot '
      + 'name). Per-row receipts are in the artifact.');
    BOARD_SUMMARY[k].rows_with_a_held_leaf = held.map(r => r.id);
  }
  BOARD_SUMMARY.not_compared = BS.NOT_COMPARED.map(x => x.field);
  console.log('    LEAVES NOTHING HERE CAN COMPARE — a verdict of ANNOUNCEMENT-ONLY means identical IN');
  console.log('    THE FIELDS WE LOOK AT, and these are the fields we do not:');
  for (const x of BS.NOT_COMPARED) console.log('      ' + x.field + (x.measured_by ? '   [measured by ' + x.measured_by + ']' : ''));
  report.summary.boards = BOARD_SUMMARY;
  report.board_not_compared = BS.NOT_COMPARED;
}

console.log('\n  ' + GAMES + ' games played, ' + THREW + ' threw, ' + SHEET_FAILS + ' sheets could not be assembled');
if (WRITE) {
  const f = OUT || D('data', 'all-mechanics-fire.json');
  fs.writeFileSync(f, JSON.stringify(report, null, 1));
  console.log('  wrote ' + f);
}
