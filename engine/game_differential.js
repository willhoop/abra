/* game_differential.js — THE COMPARISON DRIVER. ROADMAP #68 step two, docs/GAME-DIFFERENTIAL-DESIGN.md.
 *
 *   SHOWDOWN_PATH=... node engine/game_differential.js                    a small run, printed
 *   SHOWDOWN_PATH=... node engine/game_differential.js --games 90         that many games
 *   SHOWDOWN_PATH=... node engine/game_differential.js --write            + data/game-differential.json
 *   SHOWDOWN_PATH=... node engine/game_differential.js --config baseline  one configuration only
 *   SHOWDOWN_PATH=... node engine/game_differential.js --proof            ONLY the planted-divergence proof
 *
 * ONE RUN = one team pair + one seed + one configuration, played through BOTH engines, the two
 * protocol streams aligned, the FIRST divergence recorded. Nothing here scores a game; these games
 * exist to make two engines disagree.
 *
 * MODE A ONLY. Every die is pinned identically on both sides, so the two engines are deterministic
 * functions of the same input and ANY difference is a bug — tolerance zero, no statistics. Mode B
 * (rolled, distribution comparison) is a different instrument and is not here.
 *
 * ================= TWO THINGS MOVED ON 2026-08-07 AND BOTH RESET THE BASELINE =====================
 *
 * ROADMAP #88 — ONE PIN IS ONE CORNER. There are now FOUR pinned arms, not one, and each is reported
 * SEPARATELY. See "THE PIN, AND WHY THERE ARE FOUR OF THEM" below for the shape and for why there are
 * four rather than six. Every figure this file produced before today describes `top-tie-in-order`.
 *
 * ROADMAP #91 — A CLICK IS NOT A TEST. Coverage used to be credited when an entity was CLICKED or was
 * merely ON THE FIELD. Primarina clicking Haze into a board with no boosts on it marked Haze
 * exercised, and because the census STEERS the sample, a falsely credited row then steered every
 * later run AWAY from ever testing it. Credit now requires an OBSERVED EFFECT. See "WHAT COUNTS AS
 * EXERCISING A MECHANIC" below. THE COVERAGE NUMBER FELL, and the old one was wrong.
 *
 * ANY RUN AFTER THIS IS NOT COMPARABLE WITH ANY RUN BEFORE IT. Both changes alter which games get
 * played and how a die falls. The 75.5% turn-1 figure and `data/state-ladder.json` describe the old
 * instrument; `pins.digest` and `steering` are in the artifact so a reader can tell rather than guess,
 * and `mode` carries the pin digest so `engine/arms_comparable.js` refuses a mismatched pair.
 *
 * ================= WHAT IS DROPPED FROM THE SHOWDOWN STREAM, AND WHY IT IS NOT A CHOICE ==========
 *
 * `data/protocol-events.json` is DERIVED from Showdown's own `add()` call sites (36 emitted here, 58
 * declared-not-emitted WITH A WRITTEN REASON, 10 partial shapes). The declared list IS the skip list:
 * an event medicham2 has said it does not produce must be removed from the Showdown side before
 * alignment, or every game "diverges" on a line we already said we would not emit.
 *
 * AND A DROP THAT IS NOT DECLARED IS COUNTED AND PRINTED. If Showdown emits something that is
 * neither in TRACE_EVENTS nor in the declared not-emitted list, dropping it silently would be a
 * fallback that looks like a working feature. `undeclared_drops` in the artifact must read 0.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

/* ---- ARGUMENTS ---------------------------------------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = (n, dflt) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : dflt; };
const has = n => argv.includes(n);
const GAMES = +flag('--games', 45);
const MAXTURNS = +flag('--turns', 12);
const ONLY = flag('--config', null);
const WRITE = has('--write');
const VERBOSE = has('--verbose');
/* ROADMAP #81 WIRE 5 — THE SELECTION POLICY IS AN ARGUMENT NOW.
 *   --census <file>     steer from THESE bytes rather than the live census, so two arms of a
 *                       before/after are handed the same sample-selector.
 *   --baseline <file>   a previous artifact this run is meant to be COMPARED WITH. The run REFUSES
 *                       to start if the two steerings differ — an incomparable pair costs a whole
 *                       run either way, and finding out afterwards costs the conclusion too. */
const CENSUS_PIN = flag('--census', null);
const BASELINE = flag('--baseline', null);
/* `--state` — THE STATE DIFFERENTIAL (Will, 2026-08-07). Compare the BOARD at every turn boundary, not
 * the narration. See engine/board_state.js for what is read and why the boundary is where it is.
 *
 * IT ALSO CHANGES WHEN A GAME STOPS, and that is the point rather than a side effect. Without it a game
 * ends at its FIRST PROTOCOL DIVERGENCE, and the median game in this swarm parts inside turn one — so
 * there is no second boundary to compare a board at, and the question "do the two engines reach the
 * same board anyway" cannot even be asked. With it a game runs to `--turns` or to its first BOARD
 * divergence, whichever comes first; the first protocol divergence is still recorded at exactly the
 * line it was found, so the protocol numbers are the same measurement they always were. */
/* `--end-state` — THE THIRD STOP RULE (Will, 2026-08-12: *"how much is just medicham being
 * semantic"*). Of the games whose PROTOCOL parted, how many end with the two engines holding the SAME
 * board? Neither existing stop rule can answer it: protocol mode stops at the first mismatched LINE
 * and `--state` stops at the first mismatched BOARD, so the END of a diverged game was never reached.
 *
 *   protocol      stop at the first divergent LINE
 *   --state       stop at the first divergent BOARD
 *   --end-state   DO NOT STOP. Play to the turn cap or to the end of the battle whatever either
 *                 comparator has already found, and compare the LAST board both engines produced.
 *
 * IT IS AN END-STATE COMPARISON AND NOT A CLAIM THAT EVERY LINE AFTER THE MISMATCH AGREED. Once two
 * battles part they may take entirely different actions; what is measured is where they arrive.
 *
 * IT IMPLIES `--state`, because the board comparison is the measurement. Said out loud rather than
 * silently defaulted, and asserted by tests/test-end-state.js.
 *
 * A RUN WITH IT IS NOT THE SAME SAMPLE AS A RUN WITHOUT IT. Games last longer, so the coverage credit
 * that STEERS the driver accumulates differently and later clicks differ. Its protocol counts are its
 * own bar and must not be read against a protocol-mode run's. */
const END_STATE = has('--end-state');
const STATE = has('--state') || END_STATE;
/* ---- `--until-covered` — THE STOPPING RULE (Will, 2026-08-12) ------------------------------------
 *
 * He asked how the game count was chosen. THE HONEST ANSWER WAS THAT IT WAS PICKED ARBITRARILY — 45,
 * then 90, then 1,200, then 983 — while `tests/rate_runner.js` next door derives its trials from
 * statistical power. His instruction: *"run until each mechanic has been exercised."*
 *
 * So: play in batches, keep going while new census rows are still being CREDITED, and stop after K
 * consecutive batches credit nothing new. The stall is the answer; a game budget and an exhausted team
 * pool are TRUNCATIONS and are reported as such, loudly, because a truncated sweep that reads as a
 * complete one is the failure this sprint keeps correcting.
 *
 *   --until-covered            the batched loop instead of a fixed count
 *   --batch <n>     (100)      games per batch, primary arm
 *   --stall <k>     (3)        consecutive batches crediting nothing new before stopping
 *   --max-games <n> (4000)     the backstop. Hitting it is NOT a coverage answer.
 *
 * THE ORDER IS ROUND-ROBIN ACROSS CONFIGURATIONS in this mode, not config-major. A batch has to sample
 * the whole swarm or the stall detector would measure "the baseline configuration ran out of new rows"
 * and stop before `pair-speedctrl` had played a game. The fixed-count path is untouched and still
 * config-major, so no existing run changes by a byte.
 *
 * THE OTHER ARMS REPLAY EXACTLY THE GAMES THE PRIMARY ARM PLAYED. Coverage growth is measured on one
 * arm; letting each arm stop at its own batch would leave the arms with different denominators, and
 * two arms that played different numbers of games cannot be read against each other. */
const UNTIL_COVERED = has('--until-covered');
const BATCH = Math.max(1, +flag('--batch', 100));
const STALL_K = Math.max(1, +flag('--stall', 3));
const MAX_GAMES = Math.max(1, +flag('--max-games', 4000));
/* `--team-store <dir>` PINS THE OTHER HALF OF THE SAMPLE. The census is pinnable (WIRE 5); the team
 * store was not, and `engine/diff_swarm.js` reads it LIVE from a file OPS appends to. See that file's
 * `loadTeams` header for what it cost. Absent, the live store is read exactly as before. */
const TEAM_STORE = flag('--team-store', null);
/* HOW MANY DIVERGING GAMES TO WRITE OUT IN FULL, with the lines either side of the split.
 *
 * Will, 2026-08-12: *"can you show me the turns where they differed? and dont do it with a bunch of
 * illegible text like you did before"*. `alignAndCheck` has ALWAYS captured the context — four lines
 * before and six after on each side, raw and reduced — and `first_divergences` threw all of it away,
 * keeping only the two mismatched lines. So the artifact could tell you WHAT differed and never what
 * was happening around it, which is the difference between a cause list and something a person can
 * read. This writes the context to its own file rather than growing the main artifact, because it is
 * a debugging view and not a measurement. */
const DUMP_GAMES = +flag('--dump-games', 0);
const DUMP_OUT = flag('--dump-out', 'data/divergence-turns.json');
/* `--out <file>` writes the artifact somewhere other than data/game-differential.json. It exists so
 * the steering test can take two arms WITHOUT clobbering the published artifact — a test that
 * overwrites the run everybody quotes is a worse bug than the one it checks. */
const OUT = flag('--out', null);
/* ---- `--nature` — THE THIRD RUN PARAMETER (2026-08-08) -------------------------------------------
 *
 * `real` (the default) carries the SHEET'S OWN nature to both engines. `serious` flattens every body,
 * which is exactly what every run before 2026-08-08 did, and is kept so the before-arm of this change
 * is REACHABLE WITHOUT SWAPPING A FILE — the same argument as `--release`, and the reason the two arms
 * of the measurement differ in ONE run parameter and in no bytes at all.
 *
 * Declared here, up with the other arguments, because `MODE` is built long before buildPair and a
 * `const` further down the file is in its temporal dead zone when MODE reads it. */
/* `--mid-unbound` — THE BEFORE-ARM OF ROADMAP #220, REACHABLE WITHOUT SWAPPING A FILE.
 *
 * The fix was one line: `MID_BATTLE = battle` beside the prng install in `playGame`, so that an
 * authority draw made outside `hitStepAccuracy`/`secondaries`/`getDamage` is addressed with a real
 * turn, move and target instead of `<seed>|0|any|-|-|<nth>`. It moved `diverged` and it may also have
 * moved VOID, and those two must be read off the SAME pins or the pair says nothing — the same
 * argument as `--nature serious` above. This flag restores the pre-fix binding and NOTHING else.
 *
 * It is LOUD: the run prints the arm it is in, and `mid_battle_bound` goes into the artifact, so a
 * before-arm can never be mistaken for a current measurement. */
const MID_UNBOUND = has('--mid-unbound');
const NATURE_MODE = (() => {
  const v = String(flag('--nature', 'real')).toLowerCase();
  if (v !== 'real' && v !== 'serious') {
    console.error('--nature takes `real` (the sheet\'s own) or `serious` (the pre-2026-08-08 flat build); got "' + v + '"');
    process.exit(2);
  }
  return v;
})();

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}

/* ---- THE PHOTOGRAPH ----------------------------------------------------------------------------
 * CLAUDE.md: a measurement reads a FROZEN RELEASE, not the live tree. Cut one over the current bytes
 * (a re-cut of an identical tree appends and returns the same id) and load medicham2 out of the
 * snapshot, so another division may keep editing while this runs. */
/* `--release <id>` RUNS THE BEFORE-ARM WITHOUT TOUCHING THE TREE. ROADMAP #81 WIRE 4.
 *
 * WIREs 1-3 each measured before/after by hand-cutting a release, landing the change, and cutting
 * again -- which works, and which also means the before-arm can only ever be run BEFORE the change.
 * Once the edit is in the working copy the earlier arm is unreachable except by swapping the file
 * back, and a file swap under a measurement is the exact hazard `engine_release.js` exists to
 * remove. Naming an EXISTING release reads the frozen bytes it already holds: the two arms then
 * differ in one file and in nothing else, and neither arm reads the live engine.
 *
 * IT DOES NOT CUT. A named release is a photograph somebody already took; re-cutting under it would
 * append a cut event describing a tree this run never used. */
const ER = require('./engine_release.js');
const REL_ID = flag('--release', null);
if (!REL_ID) ER.cut('game differential mode A — the comparison driver, ROADMAP #68 step two');
const REL = ER.open(REL_ID);
REL.require('data/engine-data.js');
/* WHAT THIS DRIVER NEEDS THE FROZEN ENGINE TO EXPORT — declared, so an old release is refused BY NAME
 * at second zero instead of dying 1,150 lines further down.
 *
 * MEASURED 2026-08-09 (ROADMAP #109): of 65 frozen releases, 56 do not export `natureL50` and this
 * file died on them with `TypeError: M.natureL50 is not a function` at flatL50 — a message that names
 * neither the release, nor the symbol, nor the fact that the snapshot is INTACT and merely predates
 * the export. The engine is frozen and this driver is not, deliberately (see `steering.js` and
 * `board_state.js` above: freezing the INSTRUMENT would score every ladder rung by its own
 * contemporaneous reader). The missing piece was a contract across that boundary, not a bigger
 * photograph. `node engine/engine_release.js compat engine/medicham2-browser.js natureL50` lists which
 * releases a run can still use.
 *
 * `MEDI_SPREAD` IS DECLARED OPTIONAL BECAUSE NOTHING HAS EVER PROVIDED IT, INCLUDING THE LIVE ENGINE.
 * medicham2 assigns it to `root` and not to `module.exports`, so `M.MEDI_SPREAD ? ... : false` in
 * `mediSpan` has taken the false branch on every run this file has ever done — every spread move's
 * staged damage span was computed as a single-target hit. That is a real defect and it is NOT fixed
 * here: the fix belongs in medicham2's export list, which ENGINE does not hold this session. Listing
 * it under `want` makes the release loader shout about it every run instead of it staying invisible. */
/* `rngStreams` AND `spreadL50` BELONG IN `need`, AND LEAVING THEM OUT COST AN HOUR — 2026-08-12.
 *
 * Both are checked, correctly, deep inside the run: one at the stall-counter setup (#222, "the stall
 * counter would silently re-couple to the accuracy pin") and one at body construction ("every body
 * would be built blank while this file believes it filled a spread"). Neither may be softened — both
 * are exactly the silent-default failure this repo is built around.
 *
 * BUT THEY FIRE ONE AT A TIME. Re-pinning `tests/staged_status_counters.js` went: pin a release, run,
 * throw on `rngStreams`; scan 196 snapshots for it, re-pin, run, throw on `spreadL50`; scan again.
 * Each refusal names only the NEXT missing symbol, so recovering a baseline is a sequence of full runs
 * rather than one lookup. `need` already exists to answer this at load, in one message, before any
 * work is done — these two simply were not in it.
 *
 * THE COST IS NOT ONLY TIME. A layered refusal makes an aged-out baseline look like an engine failure:
 * that file reported ALL ELEVEN scenarios as `release THREW`, which reads as eleven broken mechanics
 * and was one unopenable snapshot. 168 of the 196 frozen engines on disk cannot satisfy this list, and
 * nothing said so until something tried to open one.
 *
 * The deep checks STAY. They document WHY each symbol matters, which a name in a list cannot, and they
 * are the backstop if a caller ever bypasses this loader. */
const M = REL.require('engine/medicham2-browser.js', {
  need: ['natureL50', 'battleInit', 'battleTurn', 'battleOver', 'playerAction', 'buildMon',
         'dmgRange', 'traceCanon', 'TRACE_EVENTS', 'weatherId', 'terrainId', 'fails',
         'rngStreams', 'spreadL50'],
  want: ['MEDI_SPREAD'],
});
const CS = require('./champions_sim.js');
/* ---- THESE FOUR ARE DECLARED ABOVE THE INSTALL SITE BECAUSE THE INSTALL SITE READS THEM ------
 * `midWrapShowdown` runs on the next screen, and a `let`/`const` below it is in the TEMPORAL DEAD
 * ZONE at that moment. `MID_WRAP_ERROR` sat 560 lines further down and its own catch block would
 * therefore have thrown a ReferenceError instead of recording the failure -- latent, because the
 * catch has never fired. */
let MID_WRAP_ERROR = null;
/* the class the wrapper was installed on, so a later load can ask whose holder it feeds */
let MID_WRAP_CLASS = null;
/* ---- THE WRAPPER OUTLIVES THIS MODULE, SO ITS STATE MAY NOT LIVE IN THIS MODULE ----------------
 *
 * `midWrapShowdown` patches `BattleActions.prototype`, and that class comes out of SHOWDOWN'S require
 * cache. This file comes out of OURS — and `tests/staged_board.js`'s `harness()` deletes it every time
 * it swaps the simulator source: once per row in `tests/test-assert-mode.js`, once per arm in
 * `tests/test-resolution-order.js`, on every `--reds` pass, and in `tests/probe_selfdestruct_winner.js`.
 *
 * These three were `let` bindings of THIS module. On the second load `__midWrapped` was already true,
 * so the wrapper was not reinstalled, and the one still standing went on writing the category into the
 * DEAD module instance. The live instance read `'any'` for the rest of the process. Nothing threw and
 * nothing was counted — the install site one screen up says in as many words that a wrapper which fails
 * to attach "would leave every roll in the 'any' bucket and the arm would quietly stop being what it
 * says it is", and that is precisely what happened, through a door its guard does not cover.
 *
 * TWO THINGS WENT, AND THE SECOND IS DAMAGE. The addresses stopped matching medicham2's, so the shared
 * die stopped being shared; and `pinRandom`'s damage-index inversion is gated on `cat === 'dmg'`, so
 * Showdown's `random(16)` was read as `floor(u*16)` — the ANTI-CORRELATED read this file's own pin
 * header warns is worse than an independent one. It surfaced as a Levitate row where the attacker's
 * ALLY parted, `earthquake` 86 vs 73 and `bulldoze` 119 vs 115, WE DEAL LESS — the exact direction and
 * shape of a spread reduction applied where the authority applies none, and none of that.
 *
 * SO THE STATE LIVES ON `globalThis`, WHICH IS THE ONE THING THAT OUTLIVES A RELOAD THE WAY THE
 * WRAPPER DOES. Every load adopts the same holder, so whichever instance installed the wrapper, the
 * instance doing the drawing reads what it wrote. `MEDI_MID_CAT_UNSHARED=1` restores the per-module
 * binding for `tests/probe_mid_cat_reload.js`'s red arm. */
const MID_UNSHARED = !!process.env.MEDI_MID_CAT_UNSHARED;
const MIDW = (() => {
  const K = '__abra_mid_wrapper_state__';
  const fresh = () => ({ cat: 'any', att: '-', battle: null, adopted: 0, enters: 0 });
  if (MID_UNSHARED) return fresh();
  if (!globalThis[K]) globalThis[K] = fresh(); else globalThis[K].adopted++;
  return globalThis[K];
})();
/* WRAPPING HAPPENS ONCE, AT LOAD, AND ONLY MATTERS FOR THE MIDDLE ARM — the wrapper merely records
 * which method is executing and is inert for every other arm, so arming it unconditionally keeps one
 * code path rather than two that could disagree about when it is on. It THROWS if a method it names
 * has moved, because a wrapper that silently fails to attach would leave every roll in the 'any'
 * bucket and the arm would quietly stop being what it says it is. */
try {
  const BA = require(process.env.SHOWDOWN_PATH
    ? process.env.SHOWDOWN_PATH + '/dist/sim/battle-actions'
    : 'C:/Users/willj/Projects/Pokemon/pokemon-showdown/dist/sim/battle-actions');
  midWrapShowdown(BA.BattleActions || BA.default || BA);
} catch (e) {
  MID_WRAP_ERROR = e.message;
}
const { Dex, Teams, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require('./names.js');
const SWARM = require('./diff_swarm.js');
/* NOT loaded from the release, deliberately. This decides what the run MEASURES WITH, not what it
 * measures — it is part of the instrument, like the pin and the equivalence rules, and freezing it
 * would mean an old release could never be re-run under the corrected steering discipline. */
const STEERING = require('./steering.js');
/* NOT loaded from the release either, and for the same reason as `steering.js`: this is the
 * INSTRUMENT. It reads state out of whatever medicham2 the release froze, and it has to know both of
 * that engine's side-condition shapes (see board_state.js's screens block) precisely so an old release
 * can be measured under the current comparator. Freezing it would mean each rung was scored by its own
 * contemporaneous reader, which is the one thing a ladder must not do. */
const BS = require('./board_state.js');
/* THE SHAPE OF A DIVERGENCE — ONE IMPLEMENTATION, AND IT IS NOT HERE. `engine/divergence_report.js`
 * clusters causes by what the two protocol lines disagree ABOUT; the end-state cross-tab needs the
 * same rule per game. Two copies would have agreed the day they were written. Part of the INSTRUMENT,
 * so it is not loaded from the release, for the same reason `steering.js` and `board_state.js` are not. */
const SHAPE = require('./divergence_shape.js');
/* WHICH TABLE A PROTOCOL TOKEN BELONGS TO — the condition/move name collision, one implementation and
 * not here. Same reason as `divergence_shape.js`: it is part of the INSTRUMENT (it decides what the
 * run SAYS an entity is, not what the engines did), and a rule that can only be exercised by a
 * four-minute run against the official simulator is a rule nobody will test. See effect_kind.js. */
const EK = require('./effect_kind.js');
/* HOW BAD, NOT HOW MANY — the end-state severity ladder. Part of the INSTRUMENT for the same reason
 * `board_state.js` and `divergence_shape.js` are: it decides what the run SAYS about a board, not what
 * the board is, so freezing it would score every rung of the release ladder by its own contemporaneous
 * reader. It is a separate file rather than another 200 lines here because every one of its branches
 * has to be exercisable on a fabricated board — see tests/test-end-state-severity.js. */
const ESS = require('./end_state_severity.js');
const id = N.id;
/* THE READER'S CONTEXT. `weatherId`/`terrainId` are THE ENGINE'S OWN exported translators, taken from
 * the frozen release rather than restated here — a second copy of "sandstorm means sand" is exactly the
 * two-implementations-of-one-fact CLAUDE.md forbids. `fails` is a live counter: a translation that
 * could not be made produces `UNTRANSLATABLE:<name>` rather than an empty string, because empty reads
 * as clear skies and would agree with a Showdown that also had none. */
const STATE_FAILS = {};
/* The hit-collector's own swallowed failures. `splits_seen` at zero would mean the `|split|` handling
 * never fired — either the authority stopped emitting them or the parse is wrong — and either way
 * every damage figure below would be counted twice. A receipt, not silence. */
const HIT_FAILS = {};
/* `ppSpent` IS TAKEN FROM THE RELEASE THE SAME WAY, and its ABSENCE is meaningful rather than an
 * error: a release cut before ROADMAP #144 has no PP at all, so it cannot answer and `board_state.js`
 * skips the leaf and says so on every snapshot (`pp_comparable`). Reconstructing it here from the tag
 * artifact would hand an old engine a capability it never had and make the ladder measure the reader.
 * The absence is counted so a run cannot quietly compare nothing. */
if (!M.ppSpentMap) STATE_FAILS.pp_not_expressible_by_this_engine = 1;
/* 2026-08-25 -- `stallBoardCounter` IS TAKEN FROM THE RELEASE ON THE SAME RULE AND FOR THE SAME
 * REASON. board_state.js compares the stall counter behind consecutive Protect, and the two engines
 * hold it in different shapes: a count UP here, a denominator there. The translation must be the
 * ENGINE'S, because it is the engine that decides whether a shield holds -- a copy in the comparator
 * would eventually disagree with the simulator while both kept working, which is the
 * two-implementations-of-one-fact breach CLAUDE.md names. A release cut before this date does not
 * export it; the leaf is then skipped and COUNTED (`stall_not_expressible_skipped`), never quietly
 * reconstructed from the tag artifact, which would hand an old engine a rule it never had. */
if (!M.stallBoardCounter) STATE_FAILS.stall_not_expressible_by_this_engine = 1;
const BS_CTX = { id, weatherId: M.weatherId, terrainId: M.terrainId, fails: STATE_FAILS,
                 ppSpent: M.ppSpentMap || null,
                 stallCounter: M.stallBoardCounter || null };
/* THE AUTHORITY'S OWN DISPLAY NAME FOR AN ID, so the plain-English report says "Sitrus Berry" and not
 * `sitrusberry`. It is passed INTO board_state.js rather than duplicated there — one naming table,
 * and it is the dex's. A name the dex does not know falls back to the id, LOUDLY (counted), because a
 * silent fallback to a raw id is how a report starts looking like protocol again. */
let PRETTY_MISSES = 0;
const pretty = (x) => {
  const s = String(x || '');
  if (!s) return s;
  for (const t of [dex.species, dex.items, dex.moves, dex.abilities]) {
    const e = t.get(s); if (e && e.exists) return e.name;
  }
  PRETTY_MISSES++;
  return s;
};
/* HOW MANY TURN BOUNDARIES ARE KEPT IN FULL. Will, 2026-08-07: *"I ONLY CARE ABOUT TURN 1 TO START"* —
 * so boundary 1 is the headline and 2 and 3 are kept beside it to show the decay. Boundary 0 is the
 * leads, before any choice, and is kept because a game that has already parted there never had a
 * turn 1 and must not be counted as one that agreed. */
const EARLY_BOUNDARIES = 3;

/* tags.json is IN the release, so the coverage sets and the swarm's feature sets are the same bytes
 * the engine was frozen with. Asserted rather than assumed — if a tag file moved under the run the
 * coverage report would be describing a different corpus from the engine. */
const TAGS_LIVE = fs.readFileSync(D('data', 'tags.json'), 'utf8');
const TAGS_REL = REL.read('data/tags.json');
const TAGS_MATCH = TAGS_LIVE === TAGS_REL;

/* ---- FORMAT STANDING, ATTACHED TO EVERY CAUSE ---------------------------------------------------
 *
 * WHY THIS EXISTS. Three times on 2026-08-06/07 a WIRE was argued from a mechanic that CANNOT OCCUR in
 * Champions. Blunder Policy justified the miss-vs-fail wire: `isNonstandard: 'Past'`, 0 of 410,780
 * observed sets. Okidogi justified a Guard Dog wire: `tier: Illegal`, and NO legal body in this format
 * carries Guard Dog at all. Each time, the rule "check isNonstandard before citing anything" was
 * already written down. Each time it was read past, by a different reader.
 *
 * A RULE YOU HAVE TO REMEMBER IS A PREFERENCE. So the standing travels WITH the cause: whoever reads a
 * cause sees `uses: 0, legal: false` in the same object, at the moment they read it, rather than three
 * steps later when somebody thinks to check. Same move the project already made for the ban list
 * (ask the format, never a hand-maintained list) and for store counts in prose (reference the
 * artifact, never retype the number).
 *
 * USES COMES FROM tags.json, WHICH IS IN THE RELEASE, so the number is the frozen one and cannot drift
 * under the run. Entities tags.json does not carry report `uses: null` -- UNKNOWN, not zero. Those are
 * different claims and collapsing them is how a real mechanic gets dismissed as unused. */
/* THE FOUR FORMAT-STANDING LOOKUPS COUNT THEIR OWN FAILURES (ROADMAP #81 WIRE 4). Each of them hands
 * a plausible value downstream on a throw — an empty tag table, an empty carrier map, a null dex row
 * — and every one of those reads EXACTLY like a legitimate "this entity is not in that section". The
 * standing block's whole purpose is the difference between `uses: 0` and `uses: null`, and that
 * distinction is worthless if the reason something is UNKNOWN was discarded. Flagged by
 * tests/test-no-silent-failure.js; printed with the run so a zero is a receipt rather than silence. */
const STANDING_FAILS = { tagsParse: 0, carrierMap: 0, dexLookup: 0, speciesLookup: 0 };
const TAGS_OBJ = (() => {
  try { return JSON.parse(TAGS_REL || TAGS_LIVE); }
  catch (e) {
    STANDING_FAILS.tagsParse++;
    console.error('  standing: tags.json did not parse — every uses figure below is UNKNOWN: ' + e.message);
    return {};
  }
})();
const STANDING_KINDS = [['moves', 'moves'], ['abilities', 'abilities'], ['items', 'items']];

/* LEGAL IS NOT THE SAME AS REACHABLE, AND THE DIFFERENCE IS EXACTLY THE CASE WILL CAUGHT.
 * Guard Dog is `isNonstandard: null` — perfectly legal in Champions — and NO legal species in this
 * format carries it, so a wire against it changes nothing a real game can reach. A legality test alone
 * scores it `legal: true` and waves it through, which is what happened. Counted once, lazily. */
const ABILITY_CARRIERS = (() => {
  const m = new Map();
  try {
    for (const sp of dex.species.all()) {
      if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') continue;
      for (const a of Object.values(sp.abilities || {})) {
        const k = N.id(a); m.set(k, (m.get(k) || 0) + 1);
      }
    }
  } catch (e) { /* the map stays empty and carriers reads null — UNKNOWN, never a false zero */
    STANDING_FAILS.carrierMap++;
    console.error('  standing: the ability-carrier map could not be built — every carriers figure is UNKNOWN: ' + e.message);
  }
  return m;
})();

function entityStanding(id) {
  for (const [sec, dexKind] of STANDING_KINDS) {
    const row = TAGS_OBJ[sec] && TAGS_OBJ[sec][id];
    let d = null;
    try { d = dex[dexKind].get(id); } catch (e) { d = null; STANDING_FAILS.dexLookup++; }
    if (row || (d && d.exists)) {
      const legal = !!(d && d.exists && !d.isNonstandard);
      /* An ability nothing legal can carry is unreachable even though it is legal. `null` when the
       * map could not be built, so UNKNOWN never reads as zero. */
      const carriers = sec === 'abilities'
        ? (ABILITY_CARRIERS.size ? (ABILITY_CARRIERS.get(id) || 0) : null) : null;
      return { kind: sec, id, legal, carriers,
               reachable: legal && carriers !== 0,
               nonstandard: (d && d.isNonstandard) || null,
               uses: row && typeof row.uses === 'number' ? row.uses : null };
    }
  }
  const sp = (() => { try { return dex.species.get(id); } catch (e) { STANDING_FAILS.speciesLookup++; return null; } })();
  if (sp && sp.exists) {
    const legal = !sp.isNonstandard && sp.tier !== 'Illegal';
    return { kind: 'species', id, legal, carriers: null, reachable: legal,
             nonstandard: sp.isNonstandard || (sp.tier === 'Illegal' ? 'Illegal' : null), uses: null };
  }
  return null;
}

/* ---- HOW MUCH REAL PLAY A BODY TOUCHES ---------------------------------------------------------
 *
 * `tags.json` carries `uses` for moves, abilities and items and NOTHING for a species — `entityStanding`
 * returns `uses: null` on every one of them. The end-state severity ladder ranks by BODY (a wrong
 * outcome on Incineroar is not a wrong outcome on a body nobody brings), so it needs the one thing the
 * release cannot supply.
 *
 * `data/meta-usage.json` is the corpus model OPS writes off the store. It is UPSTREAM of the simulator
 * and is not quarantined; it is also NOT in the frozen release, so it is read live and its own
 * `generated` stamp travels into the artifact. A reader can then tell whether the ranking and the
 * engine were photographed at the same moment, which is the whole reason the release exists.
 *
 * `n` — the number of stored teams containing the species — is the field, and it is NOT recomputed
 * here. ABSENT MEANS UNKNOWN AND IS PRINTED AS SUCH: a species the corpus has never seen and a
 * corpus that failed to load must not both read as zero usage, which is the `uses: 0` versus
 * `uses: null` distinction the standing block one screen up exists to keep. */
const SPECIES_USES = (() => {
  const out = { by: new Map(), generated: null, teams: null, error: null };
  try {
    const mu = JSON.parse(fs.readFileSync(D('data', 'meta-usage.json'), 'utf8'));
    for (const t of mu.threats || []) if (t && t.sp) out.by.set(N.id(t.sp), t.n);
    out.generated = mu.generated || null;
    out.teams = (mu.provenance && mu.provenance.teams) || mu.sampledTeams || null;
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 120);
    console.error('  species usage: data/meta-usage.json could not be read — every body below ranks '
                + 'as UNKNOWN usage rather than as zero: ' + out.error);
  }
  return out;
})();
/* A MEGA FORME IS THE SAME BODY ON THE SAME TEAM, AND IT HAS NO ROW OF ITS OWN. `meta-usage.json`
 * counts `charizard`; the board that killed something says `charizardmegay`, because both engines
 * rename on evolution. Ranked without a fallback, every mega read `usage UNKNOWN` and sorted BELOW a
 * body with a measured zero — in a format whose mega usage is ~26%.
 *
 * THE FALLBACK IS THE DEX'S OWN `baseSpecies`, NOT A STRING RULE. Stripping a `mega` suffix by regex
 * would be a second implementation of "which body is this really", and it gets Meowstic, Urshifu and
 * every hyphenated forme wrong. `via` rides on the answer so a ranking can say it used a base forme
 * rather than the body that was actually on the field. */
function speciesUses(sp) {
  const k = N.id(sp);
  const direct = SPECIES_USES.by.get(k);
  if (typeof direct === 'number') return direct;
  let base = null;
  try { const d = dex.species.get(k); base = d && d.exists ? N.id(d.baseSpecies) : null; } catch (e) { base = null; }
  if (base && base !== k) {
    const v = SPECIES_USES.by.get(base);
    if (typeof v === 'number') { SPECIES_USES.base_forme_fallbacks = (SPECIES_USES.base_forme_fallbacks || 0) + 1; return v; }
  }
  return null;
}

/* A cause is a protocol fragment, so the entity names in it are already normalised ids sitting between
 * pipes, colons and spaces. Split on everything that is not a letter or digit and test each token --
 * cheap, and it cannot miss one by guessing the wrong field position. */
/* AND THE TOKEN HAS TO BE ASKED OF THE RIGHT TABLE. A CONDITION AND A MOVE MAY SHARE A NAME, and
 * `entityStanding` walks moves FIRST, so `|-start|p2a|confusion|[fatigue]` — the volatile a locking
 * move leaves behind, which Outrage, Petal Dance, Raging Fury and Thrash all cause and all of which
 * are legal here — was published as `moves/confusion, legal: false, nonstandard: 'Past'`. A live
 * mechanic, labelled as one this format cannot contain. The rule and its argument are in
 * `engine/effect_kind.js`; the standalone condition table is the format's own, read once. */
const CONDITION_TABLE = (() => {
  try { return dex.data.Conditions || {}; }
  catch (e) { STANDING_FAILS.dexLookup++; return {}; }
})();
const IS_CONDITION = (id) => Object.prototype.hasOwnProperty.call(CONDITION_TABLE, id);
let CONDITION_SLOT_HITS = 0, CONDITION_SLOT_RESCUED = 0;

function annotateCause(cause) {
  const seen = new Set(), out = [];
  /* Computed ONCE per cause, because it is a property of the whole pair: `|move|pXy|<name>` is the
   * one position that names a move as a move, and a token there stays a move wherever else it appears. */
  const condSlots = EK.conditionSlotTokens(cause, IS_CONDITION);
  for (const tok of String(cause).split(/[^a-z0-9]+/i)) {
    const id = N.id(tok);
    if (!id || id.length < 4 || seen.has(id)) continue;
    seen.add(id);
    if (condSlots.has(id)) {
      CONDITION_SLOT_HITS++;
      out.push(EK.conditionStanding(id));
      /* A LEGAL move of the same name is kept BESIDE the condition, never instead of it: Showdown
       * names a volatile after the move that sets it, so that move is a genuine setter and its corpus
       * usage is real signal. An ILLEGAL one cannot be the setter — nothing here can click it — so the
       * match is a coincidence of spelling. Dropping it is the whole fix, and it is counted so a run
       * that rescues nothing cannot pass as a run that had nothing to rescue. */
      const mv = entityStanding(id);
      if (mv && mv.legal) out.push(mv); else if (mv) CONDITION_SLOT_RESCUED++;
      continue;
    }
    const st = entityStanding(id);
    if (st) out.push(st);
  }
  if (!out.length) return { mentions: [] };
  const known = out.filter(m => typeof m.uses === 'number');
  return {
    mentions: out,
    /* THE HEADLINE FIELD. If every entity a cause names is illegal in this format, fixing it changes
     * nothing a real game can reach -- and that must be visible without a second query. */
    cannot_occur_in_format: out.every(m => m.reachable === false),
    max_uses: known.length ? Math.max(...known.map(m => m.uses)) : null,
  };
}

/* ---- THE PIN, AND WHY THERE ARE FOUR OF THEM (ROADMAP #88) --------------------------------------
 *
 * ONE PIN IS ONE CORNER. Until 2026-08-07 this file held exactly one, and every number it has ever
 * produced describes that corner alone:
 *
 *   - `random(m, n)` was pinned to `m`, which makes `PRNG.shuffle` the identity — and shuffle is
 *     Showdown's SPEED-TIE RESOLVER. Tied bodies therefore kept input order in BOTH engines BY
 *     CONSTRUCTION. In a real game a tie is a coin flip and the branch where we lose it had never run.
 *   - accuracy was pinned so every sub-100 move MISSED ON BOTH SIDES. Rock Slide has never connected
 *     here, and four of six staged demonstrations on 2026-08-07 silently staged nothing because
 *     Will-O-Wisp, Toxic, Rock Slide and High Horsepower all missed while reporting "identical".
 *   - the damage roll was pinned to index 0 = MAX, leaving 15 of 16 rolls untested. That is not
 *     hypothetical: the crit's position in the battle loop disagrees on 6 of 16 rolls and ROLL 0 IS
 *     ONE OF THE TEN THAT AGREE, so the pin hid a real defect for the life of the project.
 *
 * ================= WHY FOUR AND NOT SIX, AND THIS IS THE PART TO READ =============================
 *
 * medicham2 HAS EXACTLY ONE SCALAR DIE. `battleTurn(S, rng, ...)` is handed a single `rng()` and every
 * question in the engine reads it: accuracy (`rng()*100 > acc`), the crit (`rng() < rate`), every
 * secondary (`rng()*100 >= chance`), the stall counter, the paralysis check, AND the damage roll
 * (`min + floor(rng() * span)`). So medicham2 cannot be asked for "hits, but MAX damage": a scalar near
 * 1 means miss + no crit + no secondary + MAX damage, and a scalar near 0 means hit + crit + every
 * secondary + MIN damage. THERE ARE TWO CORNERS AND NOT FOUR, and an arm that pinned Showdown's
 * accuracy and damage independently would be comparing a board medicham2 cannot reach.
 *
 * `mediSpan` already records this trap: sweeping the scalar to read a damage span silently crit every
 * low roll. The same hazard, one level up.
 *
 * So the arms are the 2x2 of the two things that ARE independent:
 *
 *     corner            speed tie          what the arm tests
 *     top    (r -> 1)   first body         today's instrument, unchanged
 *     top    (r -> 1)   SECOND body        the tie branch we lose half the time and had never run
 *     bottom (r -> 0)   first body         every sub-100 move HITS, every crit lands, MIN damage
 *     bottom (r -> 0)   SECOND body        both at once
 *
 * ================= THE TIE, AND THE FINDING THAT CAME OUT OF BUILDING IT ==========================
 *
 * THE PLAN WAS TO FLIP THE TIE BY PINNING `random(m, n)` TO THE TOP. Two things were wrong with it.
 *
 * FIRST, `random(m, n)` IS NOT THE SPEED-TIE RESOLVER. This file's own header said its "most
 * consequential caller is PRNG.shuffle". It has four other callers in the pinned checkout and they are
 * not cosmetic:
 *
 *     data/conditions.ts         slp `this.random(2, 5)`      THE SLEEP DURATION
 *     sim/battle-actions.ts:878  `random(h[0], h[1]+1)`       a non-2-5 multi-hit count
 *     sim/battle-actions.ts:881  `5 - random(2)`, `random(7)` Loaded Dice
 *     sim/battle-queue.ts:395    `random(firstIndex, last+1)` WHERE a mid-turn action is inserted
 *
 * Pinning it to the top would have made every sleep four turns long and moved inserted actions, so the
 * "tie" arm would have differed from the baseline in four ways and been attributable to none of them.
 * `random(m, n)` therefore stays pinned to `m` in EVERY arm, and `shuffle` is pinned as its own
 * function — the identity, which is exactly what `random(m,n) -> m` produced through Fisher-Yates.
 *
 * SECOND, AND THIS IS A FINDING RATHER THAN A DESIGN NOTE: PINNING `shuffle` DOES NOT MOVE SHOWDOWN'S
 * TURN ORDER AT ALL, AND THE TWO ENGINES ALREADY DISAGREE ON EVERY SPEED TIE.
 *
 * Measured on a staged pure tie (Volcarona 100 base Speed against Charizard 100, both built
 * Serious / 0 EV / 31 IV, so 120 exactly on both sides), under all four combinations of the two levers:
 *
 *     showdown shuffle   medicham2 rng     who moves first          streams
 *     identity           constant          SD p2a, MEDI p1a         DIVERGE, class `ordering`
 *     REVERSED           constant          SD p2a, MEDI p1a         DIVERGE, class `ordering`
 *     identity           increasing        SD p2a, MEDI p2a         AGREE
 *     REVERSED           increasing        SD p2a, MEDI p2a         AGREE
 *
 * Showdown's answer does not move when the shuffle is reversed, in either team orientation, and the
 * same result holds when BOTH tied bodies are on ONE side (Showdown takes the second-listed body,
 * medicham2 the first). So:
 *
 *   - SHOWDOWN RESOLVES A SPEED TIE TO THE LATER BODY IN INPUT ORDER under this pin, and PRNG.shuffle
 *     is not what decides it;
 *   - MEDICHAM2 RESOLVES IT TO THE EARLIER BODY, because `sortTurnOrder` draws one tie value per
 *     action from a CONSTANT scalar, every value is equal, and its sort is stable;
 *   - so the header's claim that the pin made the two agree "by construction" was FALSE, and this
 *     instrument has been manufacturing a turn-order divergence on every speed tie for its whole life.
 *     91.4% of species share a base Speed and every body here is built with no spread, so a large
 *     share of the `ordering` class has been this.
 *
 * THE ARM IS THEREFORE ON THE MEDICHAM SIDE, WHICH IS THE ONLY LEVER THAT MOVES A TIE. `tie-first`
 * gives the tie to the earlier body (what the engine does today, and what disagrees with the
 * authority); `tie-second` gives it to the later body by making the scalar STRICTLY INCREASING by
 * 1e-15 a draw, so a later-drawn action outranks an earlier one — measured on a 4-way tie as an exact
 * reversal, `p1a p1b p2a p2b` becoming `p2b p2a p1b p1a`. The step is behaviour-neutral by
 * construction and it is ASSERTED below rather than argued: every value gives the SAME answer as the
 * constant corner at every threshold a battle asks — the damage index, accuracy, the crit rate, a
 * secondary's chance, the stall denominator.
 *
 * SHOWDOWN'S SHUFFLE IS PINNED TO THE IDENTITY IN ALL FOUR ARMS. Reversing it is implemented and
 * asserted, and it is NOT USED: it is a change to one engine with no counterpart in the other, which
 * is precisely the mispinned-die failure of CHANGELOG 3.45.0. `speed_ties` in the artifact records how
 * many groups it was asked to resolve, so "the tie arm never met a tie" cannot pass as agreement.
 *
 * ================= AND IT HAS TO MEAN THE SAME THING ON BOTH SIDES ================================
 *
 * CHANGELOG 3.45.0 records what a mispinned die costs: `random` was pinned to the median and
 * `randomChance` to `num >= den`, a DIFFERENT die, so every sub-100 move missed in one engine and
 * connected in the other. The two pins are still ONE FUNCTION BY CONSTRUCTION — `PIN_CHANCE(num, den)`
 * is literally `pinRandom(den) < num`, which IS `PRNG.randomChance` (sim/prng.ts:115).
 *
 * THE TIE PIN NEEDED THE SAME ARGUMENT AND IT IS NOT OBVIOUS. medicham2 resolves a tie by a value
 * drawn ONCE PER ACTION from the same scalar and stored (`sortTurnOrder`'s `_tie`, sorted DESCENDING).
 * Under a constant rng every tie is equal, the sort is stable, and the group keeps input order — which
 * is what the identity shuffle does. To reverse it the medicham scalar is made STRICTLY INCREASING by
 * 1e-15 a draw, so a later-drawn action outranks an earlier one and the group comes out reversed.
 * MEASURED, not assumed: a 4-way tie reads `p1a p1b p2a p2b` constant and `p2b p2a p1b p1a` increasing
 * — an exact reversal, which is what `shuffle`-reversed does to Showdown's group.
 *
 * The step is behaviour-neutral by construction and it is ASSERTED below rather than argued: every
 * value in the sequence gives the SAME answer as the constant corner at every threshold a battle asks
 * — the damage index, accuracy, the crit rate, a secondary's chance, the stall denominator.
 *
 * ================= THE ACCURACY-HIT ARM, EVENT FOR EVENT ==========================================
 *
 * medicham2 SKIPS the accuracy check entirely at acc >= 100; Showdown always calls
 * `randomChance(accuracy, 100)`. Under the bottom corner Showdown's `random(100)` is 0, so 0 < acc
 * HITS for every accuracy from 1 to 100 and NO `-miss` is emitted on either side — the two engines
 * agree event for event, not merely "both hit". The extra draw Showdown consumes cannot matter,
 * because the die is a CONSTANT and nothing downstream depends on stream position.
 *
 * THE DAMAGE ROLL IS THE ONLY SPECIAL CASE AND IT IS NAMED. `sim/battle.ts:2390` is the ONLY
 * `random(16)` in `sim/`, and there is no `randomChance(x, 16)` anywhere, so keying on the argument
 * cannot catch anything else. The index is INVERTED: 0 is MAXIMUM damage and 15 is MINIMUM, which is
 * why the bottom corner pins it to 15 and the top corner to 0. Both are endpoints, which is the only
 * place 16 separately-floored indices and 11 uniformly-sampled integers can agree at all. */
const crypto = require('crypto');
const DAMAGE_ROLL_SIDES = 16;
/* THE ONE PLACE THAT KNOWS HOW medicham2'S ROLL POSITION MAPS ONTO SHOWDOWN'S ROLL INDEX. Exported
 * so `tests/test-middle-damage-roll.js` can check it against the PINNED ARMS' OWN DECLARATIONS
 * rather than against a number somebody typed here: `damageIndex: 0` sits beside `CORNER_TOP` and
 * `damageIndex: 15` beside `CORNER_BOTTOM`, and those two pairs fix the mapping completely. */
const midDamageIndex = (u) => DAMAGE_ROLL_SIDES - 1 - Math.floor(u * DAMAGE_ROLL_SIDES);
/* how many draws took the inversion — a fix that stops firing looks exactly like one that works */
let MID_DAMAGE_INDEX_FLIPS = 0;

/* ==================================================================================================
 * MIDDLE ARM — REAL DICE THAT BOTH ENGINES AGREE ON, ADDRESSED BY CATEGORY (ROADMAP #262)
 * ==================================================================================================
 *
 * Will, 2026-08-13: *"is it possible at all for us to run a middle bound? where things can miss, and
 * secondary chances have a chance to proc? ... otherwise paralysis ends the mons usefulness ... thats
 * why games take years."*
 *
 * He is right about the cost of the corners. The bottom arm pins every `randomChance` TRUE, so the
 * full-paralysis roll fires every turn and a paralysed body never moves again; the top arm pins them
 * all FALSE, so nothing ever connects. Neither is a game anybody plays, and the median synthetic game
 * runs to the 12-turn cap where a real open-sheet game ends at SEVEN.
 *
 * ---- WHY A SHARED SEEDED STREAM IS NOT ENOUGH ON ITS OWN -----------------------------------------
 *
 * The arms are pinned for SYNCHRONISATION, not for caution. Two engines that draw a different NUMBER
 * of values, or draw them in a different ORDER, walk off a shared sequence immediately — and then
 * every subsequent roll disagrees and the run reports catastrophic divergence that is entirely the
 * instrument. A constant is the only mapping that is immune to order, which is why the corners exist.
 *
 * ---- WHAT MAKES IT TRACTABLE, AND BOTH HALVES WERE ALREADY HERE ----------------------------------
 *
 * (a) ROADMAP #222 ALREADY SPLIT THE DIE BY CATEGORY. `medicham2.rngStreams` turns one seed into five
 *     independent LCGs — `acc`, `crit`, `sec`, `dmg`, `stall` — and this engine already routes each
 *     kind of roll to its own. Per-category streams desynchronise far less readily than one global
 *     sequence, because within a category the draws are tied to game events the two engines agree
 *     about for as long as they agree at all.
 *
 * (b) THE DIFFERENTIAL REPORTS THE **FIRST** DIVERGENCE PER GAME AND DISCARDS EVERYTHING AFTER IT. So
 *     a stream that parts company AFTER a divergence costs nothing. Desync only matters inside the
 *     window where the engines still agree — and inside that window they are, by construction, playing
 *     the same game.
 *
 * ---- THE RESIDUAL RISK, AND THE INSTRUMENT MUST BE ABLE TO NAME ITS OWN FAILURE ------------------
 *
 * Two engines can agree on every emitted line while making a DIFFERENT NUMBER of internal draws — one
 * checks a roll the other skips. That desynchronises silently, and the next visible divergence is then
 * MANUFACTURED BY THE INSTRUMENT. An instrument that invents defects is worse than no instrument.
 *
 * So every draw is COUNTED, per category, per side, per game, and a game whose counts do not match is
 * **VOID rather than diverging**. That is the whole reason this is safe to run: it can tell its own
 * failure apart from the engine's, and it says which it saw.
 *
 * ---- ONE CONSTRUCTION, NOT TWO ------------------------------------------------------------------
 *
 * Both sides' streams come from `medicham2.rngStreams({seed})` — the SAME function, so the two cannot
 * drift apart in how a seed becomes a sequence. Re-implementing the LCG here would be a second source
 * for a fact the engine already owns, which is the rule this repository breaks most expensively. */
const MID_CATS = ['acc', 'crit', 'sec', 'dmg', 'stall'];

/* ==================================================================================================
 * EVENT-ADDRESSED DICE — WHY THE SEQUENCES HAD TO GO
 * ==================================================================================================
 *
 * The first middle arm shared five SEQUENCES, one per category, and it failed twice in a row for the
 * same underlying reason. Both failures were measured rather than argued, and both are worth keeping
 * because the second one is invisible to the check that caught the first.
 *
 *   1. COARSE. Draw COUNTS differed — `acc sd=11 me=2`, `sec sd=12 me=0` — because medicham2
 *      short-circuits rolls whose outcome is determined and the authority rolls anyway. 131 of 171
 *      games void. The count check caught this.
 *
 *   2. FINE, AND THE COUNT CHECK IS BLIND TO IT. With counts matching, **29 of 40** surviving games
 *      diverged on `-damage field 3` — a damage NUMBER — while `test-engine-diff --n 6000` reports
 *      **0 disagreements** on damage in both corners. The engines agree about damage. What differed
 *      was the ROLL, because our driver evaluates candidate moves before choosing one and every one of
 *      those speculative damage calls consumes from the `dmg` sequence. Showdown never speculates, so
 *      it makes no matching draw — and two sequences can hold the same COUNT while sitting at
 *      different OFFSETS.
 *
 * A sequence is the wrong object. The die must be a pure function of WHAT IS BEING ROLLED FOR, so that
 * a speculative evaluation and a real one are simply different questions with different answers, and
 * neither consumes anything the other needed.
 *
 *   value = hash(turn, category, move id, attacker slot, target slot, nth) -> [0,1)
 *
 * THE `nth` IS NOT OPTIONAL. Measured on the authority over three messy turns: **6 of 20 draws shared
 * an otherwise-identical context**, worst case 2. A multi-hit move rolls accuracy per hit; a move with
 * two secondaries rolls twice. Without an index every repeat returns the same value, which is a
 * different wrong answer rather than a right one. Both engines must count repeats the same way, and
 * that is the sharpest remaining risk in this design — it is asserted, not assumed. */
const MID_SEED = 20260813;
/* FNV-1a. Chosen because it is short enough to reimplement identically on the other side without a
 * shared module, which matters: medicham2 must not require this file. */
function midHash(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; }
  return h >>> 0;
}
function midValue(ctx) { return midHash(ctx) / 4294967296; }
/* the repeat index, reset whenever the context changes shape */
const MID_NTH = new Map();
function midCtx(parts) {
  const base = parts.join('|');
  const n = (MID_NTH.get(base) || 0);
  MID_NTH.set(base, n + 1);
  return base + '|' + n;
}
const midClearNth = () => MID_NTH.clear();
const MID_DRAWS = { sd: {}, me: {} }; /* per-category draw counts, per side, for the void check */
/* THE CONTEXTS THEMSELVES, NOT JUST THE COUNTS. Under hashing a count mismatch is EXPECTED and
 * harmless — that is the whole point — so the void check changes question: of the events BOTH engines
 * asked about, did they compute the same identity? Anything only one side asked is fine. */
const MID_CTX_SEEN = { sd: [], me: [] };
/* ---- ROADMAP #220 -- THE AUTHORITY'S ADDRESSES, KEPT ACROSS THE GAME BOUNDARY -------------------
 *
 * `MID_CTX_SEEN.sd` is emptied by `midGameVoid` after every game, which is right for the void check
 * and useless to anything that wants to LOOK at an address. A test that needs to compare the two
 * sides' strings for one staged turn had nowhere to read them from, so the only evidence available
 * about the arm's wiring was a percentage. `midAddresses()` hands both logs out; the cap keeps a
 * 1,200-game run from carrying a list nobody reads. */
const MID_CTX_ALL = { sd: [], me: [] };
const MID_CTX_ALL_CAP = 20000;
/* HOW MANY DRAWS WERE ADDRESSED WITH NO BATTLE IN SCOPE. Such a draw gets `turn 0`, `move -` and
 * `target -`, so it is not an address at all -- it is a global sequence wearing one. Counted and
 * published, because a silent fallback here looks exactly like a synchronised arm. */
let MID_NO_BATTLE_DRAWS = 0;
const midReset = () => { for (const k of ['sd', 'me']) { MID_DRAWS[k] = {}; for (const c of MID_CATS.concat('any')) MID_DRAWS[k][c] = 0; } };
midReset();
let MID_VOID_GAMES = 0, MID_VOID_DETAIL = [], MID_SAMPLE = [];
/* ---- WHY A GAME WAS VOIDED, BY CAUSE AND BY CATEGORY -------------------------------------------
 *
 * Half a run being unreadable was published as ONE number for as long as this check has existed, and
 * a population of 495 games with no cause breakdown cannot be attacked — it can only be quoted. The
 * check already knows the category and both sides' addresses at the moment it decides; it simply
 * threw them away. These three maps keep them:
 *
 *   MID_VOID_BY_REASON   how many games each verdict claimed
 *   MID_VOID_BY_CAT      for a low-identity game, which outcome category the unshared addresses were
 *                        in, counted per GAME (a game that parts on `acc` and `dmg` counts in both)
 *   MID_VOID_SHAPES      the address shapes present on ONE side only, `cat move side-only`, so the
 *                        population can be read as mechanics rather than as a percentage
 */
/* `--void-empty-is-void` KEEPS THE PRE-2026-08-18 VERDICT ON A GAME WITH NO ADDRESSES ON A SIDE, so
 * the arm that was measured at 13:16 stays reachable and the change to the rule can be shown as a
 * paired delta rather than asserted. Default is the corrected rule. */
const VOID_EMPTY_IS_VOID = has('--void-empty-is-void');
/* `--void-debug` prints one line per game: the two address-log sizes, the turns, the verdict. */
const VOID_DEBUG = has('--void-debug');
/* `--mid-carry-nth` RESTORES THE LEAK, so the fix above can be shown RED rather than asserted. It
 * makes the authority's repeat index and address log survive from one game into the next exactly as
 * they did before 2026-08-18. `tests/test-middle-draw-scope.js` runs both arms and fails if the
 * broken one does NOT break — a control that cannot fail proves nothing. */
const MID_CARRY = has('--mid-carry-nth');
/* `--mid-damage-uninverted` RESTORES THE BACKWARDS DAMAGE INDEX, so the mapping fix can be shown RED
 * instead of asserted. `tests/test-middle-damage-roll.js` runs both arms. */
const MID_NO_INVERT = has('--mid-damage-uninverted');
const MID_VOID_BY_REASON = new Map();
const MID_VOID_BY_CAT = new Map();
const MID_VOID_SHAPES = new Map();
/* which FIELD of `seed|turn|cat|move|target|nth` the two engines disagreed about */
const MID_VOID_FIELDS = new Map();
/* the addresses of a game where ONE engine drew and the other did not draw at all */
const MID_ONE_SIDED_SHAPES = new Map();
const vbump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

/* THE VOID CHECK. Called after each game in the middle arm: if the two engines drew a different
 * number of values from any category while they were still agreeing, the streams have parted and any
 * divergence this game reports is the instrument's, not the engine's. */
/* THE VOID CHECK ASKS A DIFFERENT QUESTION UNDER HASHING, AND LEAVING IT ON COUNTS VOIDED HALF
 * THE RUN FOR A CONDITION THAT HAD STOPPED BEING A DEFECT.
 *
 * With sequences, a count mismatch meant the two streams had walked out of step and everything after
 * was noise. With event-addressed dice, differing counts are EXPECTED and harmless -- medicham2
 * short-circuits rolls whose outcome is determined and the authority rolls anyway, and neither draw
 * consumes anything the other needed. Keeping the old test voided 126 of 258 games on a run where the
 * measured identity was 98-99%.
 *
 * SHARED-EVENT IDENTITY is the question that survives the change: of the addresses BOTH engines
 * computed, how many agree? An address only one side asked about is fine. A game where the overlap is
 * thin has nothing to compare and is voided; a game where the two engines named the same moments
 * differently is voided LOUDLY, because that is the instrument failing and not the engine. */
const MID_OVERLAP_FLOOR = 0.90;
/* THE VERDICT OF THE LAST GAME, VOID OR NOT. The reason a game was READABLE is as much a part of the
 * population as the reason one was not, and without it the cross-tab below cannot be built. */
let MID_LAST_WHY = null;
/* authority addresses discarded because they belong to the control game or to the startup claims */
let MID_SD_LOG_DROPPED = 0;
/* RETURNS THE REASON, NOT A BOOLEAN. Every caller only ever asked `!!`, and the cost of that was
 * that the whole population arrived as one integer. A string is truthy in exactly the same places. */
function midGameVoid() {
  const sd = MID_CTX_SEEN.sd, me = (typeof M.midEventLog === 'function') ? M.midEventLog() : [];
  /* A GAME WITH NO ADDRESSES ON A SIDE IS NOT A DESYNC, AND CALLING IT ONE IS A LEFTOVER FROM THE
   * COUNT-BASED CHECK. Under counts, an empty side meant the streams had parted. Under shared-address
   * identity the question is "of the addresses BOTH engines computed, did they agree", and a game
   * with none has nothing to disagree about — its divergence was reached without either engine
   * drawing a die, which makes it the most trustworthy evidence in the run rather than the least.
   * The rule two clauses below already says exactly this for the OUTCOME log (`!sdO.length` returns
   * NOT VOID); this clause contradicted it for the full log. Measured before it moved. */
  if (!sd.length || !me.length) {
    const why = 'no-addresses:' + (sd.length ? 'me-empty' : me.length ? 'sd-empty' : 'neither-drew');
    vbump(MID_VOID_BY_REASON, why);
    /* AND IT LEAKED. The old early return did not clear `MID_CTX_SEEN.sd`, so a game where the
     * authority drew and medicham2 did not carried the authority's addresses into the NEXT game's
     * check. Both other exits clear; this one did not. */
    MID_CTX_SEEN.sd = [];
    if (MID_VOID_DETAIL.length < 40)
      MID_VOID_DETAIL.push('no addresses on one side: sd=' + sd.length + ' me=' + me.length);
    /* ---- A DRAW ONLY ONE ENGINE TAKES IS A MECHANIC ONLY ONE ENGINE HAS ------------------------
     * These games are not void — there is no shared address to disagree about — but they are not
     * nothing either. One engine rolled dice all game and the other rolled none, which means one of
     * them treats an event as chance and the other as determined. The shapes are collected so the
     * population arrives as a list of moves rather than as a count. */
    for (const a of (sd.length ? sd : me)) {
      const p2 = String(a).split('|');
      vbump(MID_ONE_SIDED_SHAPES, p2[2] + ' ' + p2[3] + '  [' + (sd.length ? 'authority' : 'medicham2') + ' only, the other drew nothing]');
    }
    MID_LAST_WHY = why;
    if (VOID_EMPTY_IS_VOID) { MID_VOID_GAMES++; return why; }
    return null;
  }
  /* OUTCOME CATEGORIES ONLY, AND THE ENGINE AGENT SAID SO BEFORE I IGNORED IT. The address is
   * `seed|turn|cat|move|target|nth`, and the `any` bucket is every draw with no move in scope --
   * target selection, sleep timers, multihit counts. It was measured at 95.2% on one sample and
   * 37.0% on another FROM THE SAME ENGINE and was explicitly refused a floor for that reason.
   * Pooling it dragged a 98-99% identity down to 70-78% and voided three quarters of the run. The
   * four categories that decide a game are the ones that have to agree. */
  const OUT = new Set(['acc', 'crit', 'sec', 'dmg', 'stall']);
  const cat = a => String(a).split('|')[2];
  const sdO = sd.filter(a => OUT.has(cat(a))), meO = me.filter(a => OUT.has(cat(a)));
  if (!sdO.length || !meO.length) {
    MID_LAST_WHY = 'no-outcome-addresses:' + (sdO.length ? 'me-empty' : meO.length ? 'sd-empty' : 'neither-drew');
    vbump(MID_VOID_BY_REASON, MID_LAST_WHY);
    MID_CTX_SEEN.sd = []; return null;
  }
  const S = new Set(sdO), shared = meO.filter(x => S.has(x));
  /* the overlap is over the SMALLER side: one engine asking more questions is not a disagreement */
  const denom = Math.min(sdO.length, meO.length);
  const rate = denom ? shared.length / denom : 0;
  MID_CTX_SEEN.sd = [];
  /* WHEN IT FAILS, SHOW THE ADDRESSES, NOT THE RATE. A percentage says the two sides disagree and
   * nothing about WHY; three examples of each say which field is wrong in one glance. Reading the two
   * constructions side by side found nothing -- same seed, same hash, same five fields. */
  if (rate < MID_OVERLAP_FLOOR && MID_SAMPLE.length < 3) {
    MID_SAMPLE.push({ sd: sdO.slice(0, 4), me: meO.slice(0, 4) });
  }
  if (rate < MID_OVERLAP_FLOOR) { MID_VOID_GAMES++; if (MID_VOID_DETAIL.length < 40)
    MID_VOID_DETAIL.push('outcome-address identity ' + (100*rate).toFixed(1) + '% (sd ' + sdO.length + ', me ' + meO.length + ')');
    /* ---- WHICH CATEGORY, AND ON WHICH MOVE. The rate said a game was unreadable and nothing said
     * what made it unreadable. An address present on ONE side only is the whole content of the
     * failure, so it is attributed here: per game, which outcome categories carried an unshared
     * address, and per address, the `cat move side` shape. Counted per game for the category (a game
     * that parts on `acc` and on `dmg` belongs to both populations) and per address for the shape. */
    vbump(MID_VOID_BY_REASON, 'low-identity');
    const M2 = new Set(meO);
    const cats = new Set();
    const shape = a => { const p = String(a).split('|'); return p[2] + ' ' + p[3]; };
    const sdOnly = sdO.filter(a => !M2.has(a)), meOnly = meO.filter(a => !S.has(a));
    for (const a of sdOnly) { cats.add(cat(a)); vbump(MID_VOID_SHAPES, shape(a) + '  [sd only]'); }
    for (const a of meOnly) { cats.add(cat(a)); vbump(MID_VOID_SHAPES, shape(a) + '  [me only]'); }
    for (const c of cats) vbump(MID_VOID_BY_CAT, c);
    /* ---- WHICH FIELD OF THE ADDRESS DISAGREES, WHICH IS THE ONLY QUESTION WORTH ASKING -----------
     *
     * `cat move [side]` came out symmetric on the first run that could print it — 59 `acc psychicfangs
     * [me only]` beside 58 `acc psychicfangs [sd only]` — which says both engines rolled accuracy for
     * the same move and named the moment differently. The address is `seed|turn|cat|move|target|nth`,
     * so the disagreement is in TURN, TARGET or NTH and nothing else. Each unshared address is matched
     * against the other side's unshared addresses of the same category and move, and the differing
     * fields are counted. An address with no counterpart at all is a draw only one engine takes, which
     * is a different finding and is counted as `no-counterpart`. */
    const FI = { turn: 1, target: 4, nth: 5 };
    const key = a => { const p = String(a).split('|'); return p[2] + '|' + p[3]; };
    const idx = new Map();
    for (const b of meOnly) { const k = key(b); if (!idx.has(k)) idx.set(k, []); idx.get(k).push(String(b).split('|')); }
    for (const a of sdOnly) {
      const pa = String(a).split('|'), cands = idx.get(key(a)) || [];
      if (!cands.length) { vbump(MID_VOID_FIELDS, 'no-counterpart on the authority side  (' + key(a) + ')'); continue; }
      let best = null, bestN = 99;
      for (const pb of cands) {
        const d = Object.keys(FI).filter(f => pa[FI[f]] !== pb[FI[f]]);
        if (d.length < bestN) { bestN = d.length; best = d; }
      }
      vbump(MID_VOID_FIELDS, (best.length ? best.join('+') : 'identical?') + ' differs  (' + key(a) + ')');
    }
    MID_LAST_WHY = 'low-identity';
    return 'low-identity'; }
  MID_LAST_WHY = 'shared-addresses-agree';
  vbump(MID_VOID_BY_REASON, MID_LAST_WHY);
  return null;
}

/* THE CATEGORY IS DERIVED FROM WHICH METHOD IS EXECUTING, NOT FROM THE ARGUMENTS — because the
 * arguments cannot tell them apart. Accuracy and a secondary are BOTH `randomChance(n, 100)`, and
 * `random(16)` is a damage roll or a 1-in-16 chance with no way to know which (no legal move has one
 * today; that is luck, not design — see ROADMAP #260). Wrapping the four owning methods is exact. */
function midWrapShowdown(BattleActions) {
  if (!BattleActions) return;
  /* CAPTURED BEFORE THE EARLY RETURN, because a RELOAD is exactly the case the claim has to be able
   * to judge: the wrapper is already installed, this call does nothing, and the only question left is
   * whose holder the standing closure feeds. Capturing it after the guard would leave `MID_WRAP_CLASS`
   * null on every load after the first and the claim would refuse the very case it exists for. */
  MID_WRAP_CLASS = BattleActions;
  if (BattleActions.__midWrapped) return;
  const around = (name, cat, attIdx) => {
    const fn = BattleActions.prototype[name];
    if (typeof fn !== 'function') throw new Error('MIDDLE ARM: BattleActions#' + name + ' is not a function — '
      + 'the authority moved and this wrapper is guessing. Fix the name rather than falling back.');
    BattleActions.prototype[name] = function (...a) {
      const prev = MIDW.cat, prevB = MIDW.battle;
      MIDW.cat = cat; MIDW.enters++;
      /* THE BATTLE HAS TO BE CAPTURED HERE, AND ASSUMING OTHERWISE COST THE WHOLE FEATURE.
       * The address builder is installed as `battle.prng.random`, and `Battle#random` is
       * `return this.prng.random(m, n)` -- so inside it `this` is the PRNG, not the battle. Every
       * address computed there read `undefined|-|-` and the arm measured 0.0% identity while
       * looking like it worked. `BattleActions` carries `.battle`, and this wrapper is the one
       * place that genuinely runs as a method on it. */
      MIDW.battle = this.battle || null;
      /* THE ATTACKER, WHICH THE ADDRESS DID NOT CARRY AND NEEDED — see the midCtx note.
       * The position differs per method and is read from the signature rather than assumed:
       * getDamage(source, target, move), hitStepAccuracy(targets, pokemon, move),
       * secondaries(targets, source, move, ...). A draw with no attacker in scope keeps '-'. */
      const prevA = MIDW.att;
      const _att = (attIdx != null) ? a[attIdx] : null;
      MIDW.att = (_att && _att.side && _att.position != null) ? (_att.side.id + _att.position) : '-';
      try { return fn.apply(this, a); } finally { MIDW.cat = prev; MIDW.battle = prevB; MIDW.att = prevA; }
    };
  };
  /* THE BATTLE IS THE CONTEXT AND IT COSTS NOTHING TO READ. The override runs as a method, so the
   * turn, the active move and the active target are already in scope — the authority needs no call
   * site changed. Measured on three messy turns: 19 of 20 draws had a move in scope; the one that did
   * not had no event id either, so it is a single unnameable draw rather than a class of them. */
  around('hitStepAccuracy', 'acc', 1);
  around('secondaries', 'sec', 1);
  around('getDamage', 'dmg', 0);      /* the crit roll lives in here too and is split out below */
  BattleActions.__midWrapped = true;
  /* WHICH HOLDER THE INSTALLED WRAPPER ACTUALLY WRITES TO. The closure above captured `MIDW` of
   * whichever module load got here first, and every later load has to be able to ask whether that is
   * still the object it is reading. `MID_WRAP_ERROR === null` cannot answer it -- the wrapper attached
   * perfectly and wrote its answers into a dead module -- so the pin claim compares identities. */
  BattleActions.__midHolder = MIDW;
}

/* THE TWO CORNERS OF MEDICHAM2'S SINGLE SCALAR. */
const CORNER_TOP = 1 - 1e-9;
const CORNER_BOTTOM = 0;
/* THE TIE SEQUENCE. 1e-15 is ~4.5 ulp near 1.0, so each draw is strictly greater than the last and
 * every one of them is behaviourally identical to the corner (asserted in PIN_CLAIMS). Capped so the
 * sequence can never reach 1.0 — an rng returning exactly 1 would make `floor(rng()*span)` index one
 * past the end of the damage span. A run that hits the cap is COUNTED and printed, never silent. */
const TIE_STEP = 1e-15, TIE_CAP = 900000;
let TIE_SATURATED = 0;
/* `random()` with no arguments is not called anywhere in the pinned checkout's battle path. If that
 * ever changes the arms would silently disagree about what "no argument" means, so it is counted. */
let BARE_FLOAT_DRAWS = 0;
/* Every `shuffle` this run performed, and the sizes of the groups it was asked to resolve. A tie arm
 * that never saw a group larger than 1 tested nothing, and would look exactly like one that did. */
let SHUFFLE_CALLS = 0, SHUFFLE_TIE_GROUPS = 0;
const SHUFFLE_GROUP_SIZES = new Map();

function makeArm(spec) {
  const top = spec.corner === CORNER_TOP;
  /* ---- THE MIDDLE ARM'S DICE. Both sides are built from ONE call into the engine's own stream
   * factory, so "what does seed N mean" has a single implementation. `sd` and `me` are separate
   * INSTANCES of the same construction: identical sequences, independently consumed. */
  const midSd = spec.middle ? M.rngStreams({ seed: spec.middleSeed }) : null;
  /* MEDICHAM GETS THE EVENT DICE, NOT A SEQUENCE -- AND FOR TWO HOURS IT DID NOT.
   * The engine half of ROADMAP #262 was built, probed at 98-99% identity, and never wired: this line
   * still handed it `rngStreams`, so the authority drew from hashes while medicham2 drew from a
   * sequence and 49% of games voided. A capability that exists and is not called reports exactly the
   * same thing as a capability that is missing, which is this project.s founding lesson arriving in
   * my own file. Built per GAME by `mediRng`, and `midEventDice` clears its own repeat map on each
   * call, so the reset lands on the game boundary without a second mechanism to keep in step. */
  const midMe = null;
  /* `battle` is `this` at the override's call site. It is optional so a draw made outside a battle
   * (there is one per game) still gets a stable answer rather than throwing. */
  const midDraw = (cat, battle) => {
    MID_DRAWS.sd[cat] = (MID_DRAWS.sd[cat] || 0) + 1;
    const b = battle && battle.activeMove !== undefined ? battle : MIDW.battle;
    const mv = b && b.activeMove, tg = b && b.activeTarget;
    if (!b) MID_NO_BATTLE_DRAWS++;
    const ctx = midCtx([MID_SEED, b ? b.turn : 0, cat,
                        mv ? mv.id : '-', tg ? (tg.side.id + tg.position) : '-']);
    MID_CTX_SEEN.sd.push(ctx);
    if (MID_CTX_ALL.sd.length < MID_CTX_ALL_CAP) MID_CTX_ALL.sd.push(ctx);
    return midValue(ctx);
  };
  const random = function pinRandom(m, n) {
    /* THE MIDDLE ARM SHORT-CIRCUITS THE CORNER LOGIC ENTIRELY. Inside `getDamage` the one-argument
     * form with m === 16 is the damage roll and the two-argument form is the crit — the only place a
     * denominator IS a reliable discriminator, because the wrapper has already narrowed the caller. */
    if (spec.middle) {
      const cat = (MIDW.cat === 'dmg' && n !== undefined) ? 'crit' : MIDW.cat;
      const u = midDraw(cat === 'any' ? 'any' : cat, this);
      if (n === undefined) {
        if (m === undefined) return u;                       // random() -> float in [0,1)
        /* ---- THE DAMAGE ROLL IS INVERTED BETWEEN THE TWO ENGINES, AND THE PINNED ARMS SAY SO -----
         *
         * Showdown's `random(16)` is an INDEX i, and `randomizer` is `tr(tr(d*(100-i))/100)` — so
         * i=0 is MAXIMUM damage and i=15 is MINIMUM. medicham2 draws a POSITION in its own span:
         * `dmg = d.min + floor(u * (d.max - d.min + 1))` (medicham2-browser.js:18336), which is
         * INCREASING in u. The two conventions run opposite ways.
         *
         * THE PINNED ARMS ALREADY ENCODE THAT AND THIS BRANCH DID NOT. `top-tie-first` is
         * `corner: CORNER_TOP` (medicham2's u ~ 1, its MAXIMUM) paired with `damageIndex: 0`
         * (Showdown's MAXIMUM); `bottom-tie-first` is `CORNER_BOTTOM` paired with `damageIndex: 15`.
         * The middle arm handed Showdown `floor(u*16)` — which at u~1 is index 15, the MINIMUM, while
         * medicham2 took its maximum from the same draw. **A shared die that is read backwards on one
         * side is an ANTI-CORRELATED die**, and it is worse than an independent one.
         *
         * MEASURED, and it is the largest class in the whole-game differential: `-damage field 3` is
         * 226 of 491 diverging games in the MIDDLE arm, 2 of 155 in `top-tie-first` and 0 of 183 in
         * `bottom-tie-first` — a damage defect in the engine cannot hide from both corners. The
         * sampled HP deltas run both signs to +/-18 with a median of 5, which is the span, not a
         * rounding step.
         *
         * NARROWED TO `getDamage`, WHERE THE WRAPPER HAS ALREADY ANSWERED WHO IS ASKING. `random(16)`
         * elsewhere is a 1-in-16 chance and would be inverted wrongly by a bare denominator test —
         * the same argument the header makes about `random(16)` being undiscriminable from its
         * arguments alone (ROADMAP #260). `MID_CAT === 'dmg'` is set by `midWrapShowdown` around
         * `getDamage` and nowhere else. */
        if (MIDW.cat === 'dmg' && m === DAMAGE_ROLL_SIDES && !MID_NO_INVERT) {
          MID_DAMAGE_INDEX_FLIPS++;
          return midDamageIndex(u);
        }
        return Math.floor(u * m);                            // random(m) -> 0..m-1
      }
      return m + Math.floor(u * (n - m));                    // random(m, n) -> m..n-1
    }
    if (n === undefined) {
      if (m === undefined) { BARE_FLOAT_DRAWS++; return spec.corner; }   // random() -> a float in [0,1)
      if (m === DAMAGE_ROLL_SIDES) return spec.damageIndex;              // 0 = MAX damage, 15 = MIN
      return top ? m - 1 : 0;                                           // top / bottom of the range
    }
    /* THE RANGE FORM IS PINNED TO THE BOTTOM IN EVERY ARM — see the header. It is the sleep duration,
     * a multi-hit count and a queue insertion index, and it is NOT the speed-tie resolver. */
    return m;
  };
  /* `chance` MUST NOT go through the range form in the middle arm: `random(den) < num` re-derives a
   * uniform from a floor and loses resolution at small denominators. It draws the float directly. */
  const chance = (num, den) => {
    if (spec.middle) {
      const cat = (MIDW.cat === 'dmg') ? 'crit' : MIDW.cat;
      return midDraw(cat === 'any' ? 'any' : cat, this) < (num / den);
    }
    return random(den) < num;
  };
  /* THE SPEED-TIE RESOLVER, replaced as the function it actually is rather than steered through the
   * range form. `spec.sdShuffleReverses` is FALSE in every shipped arm — see the header: reversing it
   * was measured not to move Showdown's turn order at all, and a lever that changes one engine and not
   * the other is the mispinned die of CHANGELOG 3.45.0. It stays implemented and asserted so the
   * measurement can be repeated rather than remembered. */
  const shuffle = function pinShuffle(items, start, end) {
    if (start === undefined) start = 0;
    if (end === undefined) end = items.length;
    SHUFFLE_CALLS++;
    if (end - start > 1) {
      SHUFFLE_TIE_GROUPS++;
      SHUFFLE_GROUP_SIZES.set(end - start, (SHUFFLE_GROUP_SIZES.get(end - start) || 0) + 1);
    }
    if (!spec.sdShuffleReverses) return;
    for (let i = start, j = end - 1; i < j; i++, j--) { const t = items[i]; items[i] = items[j]; items[j] = t; }
  };
  /* A FRESH SEQUENCE PER GAME. The counter is per-closure so one game's draws cannot shift the next
   * game's tie order — which would make the instrument non-deterministic across a reordered run. */
  const mediRng = () => {
    const scalar = (() => {
      if (!spec.tieToSecondBody) return () => spec.corner;
      let i = 0;
      return () => {
        if (i >= TIE_CAP) { TIE_SATURATED++; return spec.corner + TIE_CAP * TIE_STEP; }
        return spec.corner + (i++) * TIE_STEP;
      };
    })();
    /* ---- ROADMAP #222 -- THE STALL COUNTER GETS ITS OWN DIE --------------------------------------
     *
     * The header two hundred lines up says medicham2 "HAS EXACTLY ONE SCALAR DIE" and lists what reads
     * it: accuracy, the crit, every secondary, the stall counter AND the damage roll. Four of those
     * five ARE this arm's claim — "every sub-100 move misses, no crit, no secondary, MAX damage" — and
     * the fifth never was. The stall counter was COLLATERAL: pinning the scalar high forced every
     * consecutive Protect to fail, which is not a state the authority can reach, and it produced 41
     * games of apparent Protect defect that were entirely this instrument.
     *
     * SO ONLY THE FIFTH MOVES. `acc`, `crit`, `sec` and `dmg` stay on the corner exactly as before, so
     * every pin claim this file asserts is untouched and every other arm behaviour is bit-identical.
     * `any` also stays on the corner — the paralysis check, the sleep timers and target selection read
     * it, and freeing those would change which games get played, which is a different experiment.
     *
     * DETERMINISTIC, AND PER ARM. The seed is fixed and mixed with the arm id, so a re-run replays
     * exactly and two arms do not share a Protect sequence. A run that cannot be replayed cannot be
     * bisected. */
    /* A RELEASE FROZEN BEFORE #222 HAS NO `rngStreams`, AND THAT MUST BE LOUD. Falling back to the
     * scalar silently would reproduce the exact coupling this change exists to remove, and the run
     * would look clean while measuring the old thing — the silent-default failure this repo is built
     * around. It throws instead, naming the release. */
    if (typeof M.rngStreams !== 'function') {
      throw new Error('ROADMAP #222: the frozen engine in release ' + REL.id + ' predates split RNG '
        + 'streams (no rngStreams export), so the stall counter would silently re-couple to the '
        + 'accuracy pin. Cut a release from a tree that has it, or run with an older game_differential.');
    }
    const streams = M.rngStreams({ seed: STALL_SEED ^ hashArmId(spec.id) });
    /* ---- MEASURED, AND THE HYPOTHESIS WAS WRONG -- ROADMAP #222 ----------------------------------
     *
     * Freeing the stall counter here made the instrument WORSE: 408/982 (41.5%) -> 460/982 (46.8%).
     * The pin arithmetic says why, and it is four lines up in this same file:
     *
     *     chance(num, den) = random(den) < num          and     random(den) = top ? den - 1 : 0
     *
     * So under the TOP corner Showdown's own `randomChance(1, counter)` reads `counter - 1 < 1`, which
     * is FALSE for any counter above 1 — **Showdown's consecutive Protect fails under this pin too.**
     * Both engines were already agreeing by being pinned the same way. Giving ours a FREE die replaced
     * a synchronised refusal with an unsynchronised coin, and two independent streams disagree on a
     * 1/3 roll about two thirds of the time.
     *
     * THE COUPLING WAS REAL AND IT WAS NOT THE EXPLANATION. medicham2 genuinely welded five mechanics
     * onto one scalar, and the ENGINE-side split (five named streams, back-compatible, deterministic)
     * is kept because it is correct and every other instrument benefits. What is retracted is the idea
     * that it was behind the Protect divergences here.
     *
     * SO THIS ARM PINS ALL FIVE TO THE CORNER, exactly as it did before — which is what makes its
     * runs comparable with every run since 2026-08-07 and leaves PIN_DIGEST unmoved. The freed stream
     * is built and deliberately unused, so the next person can see what was tried. */
    void streams;
    /* ---- THE MIDDLE ARM HANDS MEDICHAM ITS OWN COPY OF THE SAME STREAMS ------------------------
     * Same factory, same seed, a SEPARATE instance — so the two engines read identical sequences and
     * consume them independently. Every draw is counted so a desync can be DETECTED rather than
     * assumed absent; see the header. Counting wrappers only — the values are the engine's own. */
    if (spec.middle) {
      const d = M.midEventDice({ seed: spec.middleSeed });
      const wrap = (cat) => { const f = d[cat] || d.any;
        return () => { MID_DRAWS.me[cat] = (MID_DRAWS.me[cat] || 0) + 1; return f(); }; };
      const o = { split: true, seed: spec.middleSeed, any: wrap('any') };
      for (const c of MID_CATS) o[c] = wrap(c);
      /* ---- THE SPEED-TIE COIN IS NEUTRALISED HERE, BECAUSE IT IS NEUTRALISED ON THE OTHER SIDE ----
       * ROADMAP #290. `pinShuffle` above is a NO-OP in every shipped arm — `sdShuffleReverses` is
       * false — so the authority NEVER re-orders a tied group and always keeps whatever permutation
       * its selection sort produced. medicham2 drew its tied-group key from the generic stream, and
       * in THIS arm the generic stream is a live address-keyed die: it flipped a coin for a group
       * the authority had already frozen. Two engines that cannot agree on a tie by construction,
       * and `tests/test-speed-tie.js` was red on 3 of its 5 arrangements because of it.
       *
       * A CONSTANT IS THE HONEST MIRROR OF A NO-OP SHUFFLE, and it is what the scalar arms have
       * always supplied — see the `tie: scalar` line below, and medicham2's own `sortTurnOrder`
       * comment, which says in as many words that the design is "the identity under a constant
       * pinned die". The middle arm simply never supplied one.
       *
       * IT DOES NOT HARDCODE THE ANSWER. The engine still resolves the group by its own selection
       * sort, exactly as the authority does; what is removed is a die the authority does not roll.
       * Under real dice `rngStreams` gives `tie` its own sequence and a tie is a coin flip again. */
      o.tie = () => 0;
      return o;
    }
    return Object.assign({}, streams, {
      any: scalar, acc: scalar, crit: scalar, sec: scalar, dmg: scalar, stall: scalar, split: false,
      /* ROADMAP #290 — NAMED EXPLICITLY RATHER THAN INHERITED. `streams` now carries a `tie` LCG,
       * and letting it through would give the scalar arms a live tie coin that they have never had:
       * every run since 2026-08-07 resolved a tied group by the selection sort alone, because the
       * generic scalar returned the corner constantly. This line keeps those runs bit-identical. */
      tie: scalar,
    });
  };
  return Object.assign({ sdShuffleReverses: false }, spec, { top, random, chance, shuffle, mediRng });
}
/* ROADMAP #222 -- one fixed seed for the freed stream, and a stable per-arm mix so two arms cannot
 * share a Protect sequence. Changing this number changes which games diverge, so it is a pinned
 * constant and it rides in PIN_DIGEST below. */
const STALL_SEED = 20260811;
function hashArmId(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(id).length; i++) h = Math.imul(h ^ String(id).charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
/* The reversing shuffle, built once so the PIN_CLAIMS can assert it and a future pass can use it
 * without re-deriving the sub-range rule. Not installed on any battle. */
const REVERSING_SHUFFLE = makeArm({ id: '(unused) reversing shuffle', corner: CORNER_TOP,
  damageIndex: 0, tieToSecondBody: false, sdShuffleReverses: true, what: 'not installed' }).shuffle;

const ARMS = [
  /* THE MIDDLE ARM IS OPT-IN AND IS NOT PART OF THE DEFAULT SET. It answers a different question from
   * the two corners — "what happens in a game somebody could actually play" rather than "do the two
   * rulebooks agree at the extremes" — and mixing it into the default run would move the headline
   * every published number is measured against. Select it with `--arm middle`.
   *
   * IT IS ALSO THE ONLY ARM THAT CAN VOID A GAME. Every other arm's dice are a constant and cannot
   * desynchronise; this one's can, so a game whose per-category draw counts disagree between the two
   * engines is discarded as an INSTRUMENT failure rather than counted as a divergence. */
  makeArm({ id: 'middle', corner: CORNER_BOTTOM, damageIndex: 8, tieToSecondBody: false,
    middle: true, middleSeed: 20260813,
    what: 'REAL dice, seeded and shared by CATEGORY (acc / crit / sec / dmg / stall) so both engines '
        + 'draw the same values for the same kind of roll. Moves miss at their printed accuracy, '
        + 'secondaries fire at their printed chance, paralysis does NOT end a body, and games END. '
        + 'A game whose draw counts diverge is VOID, not a divergence.' }),
  makeArm({ id: 'top-tie-first', corner: CORNER_TOP, damageIndex: 0, tieToSecondBody: false,
    what: 'every sub-100-accuracy move MISSES, no crit, no secondary fires, MAX damage; medicham2 '
        + 'gives a speed tie to the EARLIER body. THIS IS THE ONLY ARM THAT EXISTED BEFORE 2026-08-07, '
        + 'and it is the one in which the two engines DISAGREE about every speed tie.' }),
  /* THE TWO `tie-second` ARMS ARE RETIRED, AND THE REASON IS THAT THEY BECAME A DESYNCHRONISER.
   *
   * They were built in 3.73.0, when medicham2 gave every speed tie to the EARLIER body and the
   * authority did not. `tieToSecondBody` swapped medicham2's per-action key from a constant to an
   * increasing sequence, which forced it onto the branch where it AGREED with Showdown. Under that
   * engine the arm was honest: it played the half of every tied matchup we had never played.
   *
   * 3.74.0 FIXED THE TIE AT THE ROOT. medicham2 now runs Showdown's own selection sort and resolves
   * the residual group with the key it already drew, so the two agree under identical pinned dice. The
   * lever therefore no longer corrects a wrong default — IT BREAKS A CORRECT ONE, and it does so on one
   * side only: `sdShuffleReverses` is false on every arm, so Showdown's tie resolution is identical in
   * all of them. The arm handed medicham2 a different rule than the authority and then measured the
   * disagreement.
   *
   * MEASURED, and it is the whole of the arm spread: isolating the two levers on 1,530 games at
   * release 288aee2e3501, flipping the DAMAGE corner moved `ordering` by +19 and +10 games, while
   * flipping the TIE moved it by +471 and +462. The harsh corner — every sub-100 move hitting, every
   * crit landing, every secondary firing, minimum rolls — costs about fifteen games. The rest was the
   * instrument disagreeing with itself.
   *
   * AND THERE IS NO HONEST REPLACEMENT, which is why these are deleted rather than repaired. The pin
   * agent measured that reversing `PRNG.shuffle` does NOT move Showdown's turn order, so the
   * authority's coin cannot be flipped from here. "The branch where we lose the tie" is not
   * expressible against a pinned authority; it is a property of real dice. `REVERSING_SHUFFLE` above
   * stays built and asserted for whoever finds the lever that does move it.
   *
   * WHAT IS LOST BY REMOVING THEM: nothing that was true. What WOULD have been lost by keeping them is
   * the headline — 92.3% against 95.0%, with the gap owed entirely to an instrument fighting a fix
   * that had landed hours earlier. */
  makeArm({ id: 'bottom-tie-first', corner: CORNER_BOTTOM, damageIndex: 15, tieToSecondBody: false,
    what: 'every sub-100-accuracy move HITS, every crit lands, every secondary fires, MIN damage; the '
        + 'tie goes to the earlier body. The hit path of a sub-100 move runs here for the first time.' }),
];
const ARM_BY_ID = new Map(ARMS.map(a => [a.id, a]));
const PRIMARY_ARM = ARMS[0];
/* Kept at module scope and bound to the PRIMARY arm, because the staged measurements below (the Knock
 * Off halves, the damage interior) are calibrated against the max-damage endpoint and are NOT swept
 * across arms. Exported under their old names so nothing downstream has to know about arms. */
const pinRandom = PRIMARY_ARM.random;
const PIN_CHANCE = PRIMARY_ARM.chance;
const mediRng = PRIMARY_ARM.mediRng();

/* THE PIN IS ASSERTED ON ITS BEHAVIOUR, not on its arithmetic. Every row is a claim about what a
 * BATTLE does, and every row carries the medicham2 counterpart beside it — because the failure this
 * guards against is not "the arithmetic is wrong", it is "the two engines were pinned to different
 * dice and both kept working". Every arm generates its own rows; a new pin with no new rows is a pin
 * nobody has checked. */
function armClaims(a) {
  const C = [];
  /* THE GROUP IS THE SUB-RANGE [start, start+n), because `speedSort` calls
   * `shuffle(list, sorted, sorted + n)` — a rule that only worked from index 0 would be wrong on every
   * tie after the first, and the leading elements must come back UNTOUCHED. */
  const shuf = (n, start) => { const xs = []; for (let i = 0; i < n + start; i++) xs.push(i);
                               a.shuffle(xs, start, n + start);
                               return xs.slice(0, start).join(',') + '|' + xs.slice(start).join(','); };
  const head = start => { const xs = []; for (let i = 0; i < start; i++) xs.push(i); return xs.join(','); };
  const inOrder = (n, start) => { const xs = []; for (let i = start; i < start + n; i++) xs.push(i);
                                  return head(start) + '|' + xs.join(','); };
  const reversed = (n, start) => { const xs = []; for (let i = start + n - 1; i >= start; i--) xs.push(i);
                                   return head(start) + '|' + xs.join(','); };
  const P = (w, f) => C.push([a.id + ': ' + w, f]);
  /* ---- THE MIDDLE ARM ASSERTS DIFFERENT THINGS, AND NOT ASSERTING THEM WAS THE FIRST BUG ---------
   *
   * Registering it without its own claims made it inherit the corner's, and the pin guard refused the
   * run — correctly, and loudly, listing eight claims that are false of it. That is this file working
   * exactly as its header says: THE PIN IS ASSERTED ON ITS BEHAVIOUR, so a new arm owes a statement of
   * what its behaviour IS.
   *
   * A corner's claims are deterministic ("a 90-accuracy move misses"). This arm's cannot be — the
   * whole point is that sometimes it hits. So the claims are about the PROPERTIES that make the arm
   * trustworthy rather than about any single outcome:
   *
   *   1. the two engines draw the SAME sequence — if this fails nothing else means anything;
   *   2. a certainty is still a certainty — 100 accuracy never misses, 0 never hits;
   *   3. the die is actually varying, and inside [0,1);
   *   4. the rate is near the printed one over many draws.
   *
   * (4) is a sample and is stated as one: a fixed seed makes it deterministic, so it is a regression
   * check on THIS seed rather than a claim about randomness in general. A tolerance wide enough never
   * to flake is a tolerance too wide to catch a broken stream, so it is +/- 5 points on 4,000 draws,
   * which a correct LCG clears by a wide margin and a constant fails immediately. */
  if (a.middle) {
    /* THESE CLAIMS TEST THE HASH, NOT THE SEQUENCES. The arm stopped using rngStreams when the
     * sequence design was refuted; claims that went on testing rngStreams would pass while asserting
     * nothing about what the arm actually does -- a green check on a component nobody calls. */
    P("SAME CONTEXT, SAME VALUE -- the claim every other one rests on",
      () => { midClearNth(); const x = midValue("a|b|c|0"); return midValue("a|b|c|0") === x; });
    P("a different context gives a different value",
      () => midValue("turn1|acc|tackle|0") !== midValue("turn2|acc|tackle|0"));
    P("the nth index separates repeats -- 6 of 20 authority draws share a context without it",
      () => { midClearNth();
              const a1 = midCtx([1, "acc", "rockslide"]), a2 = midCtx([1, "acc", "rockslide"]);
              return a1 !== a2 && midValue(a1) !== midValue(a2); });
    P("every value lands inside [0,1)",
      () => { for (let i = 0; i < 2000; i++) { const v = midValue("x" + i); if (!(v >= 0 && v < 1)) return false; } return true; });
    P("the hash is UNIFORM enough to price a 90-accuracy move  [2,000 contexts, +/- 5 points]",
      () => { let hit = 0; for (let i = 0; i < 2000; i++) if (midValue("acc|" + i) < 0.9) hit++;
              return Math.abs(hit / 2000 - 0.9) < 0.05; });
    P("and to price a 30% secondary  [2,000 contexts, +/- 5 points]",
      () => { let n = 0; for (let i = 0; i < 2000; i++) if (midValue("sec|" + i) < 0.3) n++;
              return Math.abs(n / 2000 - 0.3) < 0.05; });
    P('a certainty is still a certainty: 100 accuracy always hits, 0 never does',
      () => { for (let i = 0; i < 500; i++) { if (a.chance(100, 100) !== true) return false;
                                             if (a.chance(0, 100) !== false) return false; } return true; });
    P('the category wrapper ATTACHED — an unattached one silently buckets every roll as ANY',
      () => MID_WRAP_ERROR === null);
    /* AND IT WRITES INTO **THIS** MODULE'S HOLDER. The claim above was true for eleven days while the
     * arm was mis-addressing every authority draw: `harness()` re-requires this file, the wrapper is
     * already on `BattleActions.prototype`, and the still-installed closure kept writing the category
     * into the module instance that had been evicted. Attachment and liveness are two questions and
     * only one of them was being asked. */
    P('...and the installed wrapper writes into THIS module load’s holder',
      () => MID_WRAP_ERROR === null && !!MID_WRAP_CLASS && MID_WRAP_CLASS.__midHolder === MIDW);
    return C;
  }
  if (a.top) {
    P('a 100-accuracy move HITS  [medicham2 skips the check at acc >= 100]',
      () => a.chance(100, 100) === true);
    P('a 90-accuracy move MISSES  [medicham2: 99.99 > 90 -> miss]',
      () => a.chance(90, 100) === false);
    P('a 1-in-24 crit does NOT happen  [medicham2: 0.9999 < 1/24 is false]',
      () => a.chance(1, 24) === false);
    P('a 30% secondary does NOT fire  [medicham2: 99.99 >= 30 -> skipped]',
      () => a.chance(30, 100) === false);
    P('a second consecutive Protect FAILS  [medicham2: 0.9999 < 1/3 is false]',
      () => a.chance(1, 3) === false);
    P('the damage roll is index 0 = MAX  [medicham2: min + floor(0.9999*span) = max]',
      () => a.random(16) === 0);
    P('the medicham2 scalar picks the TOP integer of any span',
      () => [1, 2, 11, 16, 32].every(s => Math.floor(a.corner * s) === s - 1));
  } else {
    P('a 90-accuracy move HITS  [medicham2: 0*100 > 90 is false -> hit]',
      () => a.chance(90, 100) === true);
    P('a 100-accuracy move HITS and neither engine emits a -miss  [medicham2 skips the check]',
      () => a.chance(100, 100) === true && a.chance(1, 100) === true);
    P('a 1-in-24 crit ALWAYS happens  [medicham2: 0 < 1/24 is true]',
      () => a.chance(1, 24) === true);
    P('a 30% secondary ALWAYS fires  [medicham2: 0 >= 30 is false -> it runs]',
      () => a.chance(30, 100) === true);
    P('a second consecutive Protect SUCCEEDS  [medicham2: 0 < 1/3 is true]',
      () => a.chance(1, 3) === true);
    P('the damage roll is index 15 = MIN  [medicham2: min + floor(0*span) = min]',
      () => a.random(16) === 15);
    P('the medicham2 scalar picks the BOTTOM integer of any span',
      () => [1, 2, 11, 16, 32].every(s => Math.floor(a.corner * s) === 0));
  }
  P('randomChance IS random(den) < num, the same die  [sim/prng.ts:115]',
    () => [[100, 100], [95, 100], [90, 100], [30, 100], [1, 24], [1, 8], [1, 3], [1, 2]]
            .every(([x, y]) => a.chance(x, y) === (a.random(y) < x)));
  /* SHOWDOWN'S SHUFFLE IS THE IDENTITY IN EVERY ARM, asserted at a NON-ZERO START too — `speedSort`
   * calls `shuffle(list, sorted, sorted + n)`, so a rule that only held from index 0 would be wrong on
   * every tie after the first. The reversing version is asserted beside it and is NOT installed; see
   * the header for the measurement that took it out of the arms. */
  P('Showdown\'s speed-tie shuffle is the IDENTITY on a group of 2..6, at start 0 and at start 3 — '
    + 'exactly what `random(m,n) -> m` produced through Fisher-Yates',
    () => [2, 3, 4, 5, 6].every(n => shuf(n, 0) === inOrder(n, 0) && shuf(n, 3) === inOrder(n, 3)));
  P('the reversing shuffle, which is implemented and DELIBERATELY NOT INSTALLED, does reverse a group '
    + 'of 2..6 at start 0 and at start 3 — so "it is unused" is a choice and not a broken function',
    () => [2, 3, 4, 5, 6].every(n => {
      const go = (start) => { const xs = []; for (let i = 0; i < n + start; i++) xs.push(i);
                              REVERSING_SHUFFLE(xs, start, n + start);
                              return xs.slice(0, start).join(',') + '|' + xs.slice(start).join(','); };
      return go(0) === reversed(n, 0) && go(3) === reversed(n, 3); }));
  if (a.tieToSecondBody) {
    P('the medicham2 tie sequence is STRICTLY INCREASING, so a later-drawn action outranks an earlier '
      + 'one and the tie goes to the LATER body  [sortTurnOrder sorts tie DESCENDING]',
      () => { const r = a.mediRng().acc; let prev = -1;   // ROADMAP #222 -- the scalar lives on acc
              for (let i = 0; i < 500; i++) { const v = r(); if (!(v > prev)) return false; prev = v; }
              return true; });
    P('every value in that sequence is BEHAVIOURALLY IDENTICAL to the constant corner — same damage '
      + 'index, same accuracy verdict, same crit, same secondary, same stall, and never 1.0',
      () => { const r = a.mediRng().acc; const c = a.corner;   // ROADMAP #222
              for (let i = 0; i < 2000; i++) { const v = r();
                if (v >= 1 || v < 0) return false;
                if (Math.floor(v * 16) !== Math.floor(c * 16)) return false;
                if (Math.floor(v * 11) !== Math.floor(c * 11)) return false;
                if ((v * 100 > 90) !== (c * 100 > 90)) return false;
                if ((v < 1 / 24) !== (c < 1 / 24)) return false;
                if ((v * 100 >= 30) !== (c * 100 >= 30)) return false;
                if ((v < 1 / 3) !== (c < 1 / 3)) return false;
                if ((v < 0.125) !== (c < 0.125)) return false; }
              return true; });
  } else {
    P('the medicham2 scalar is CONSTANT, so every tie is equal, the sort is stable and the tie goes '
      + 'to the EARLIER body',
      () => { const r = a.mediRng().acc; const v = r(); return r() === v && r() === v && v === a.corner; });
  }
  /* ---- ROADMAP #222 -- THE TWO CLAIMS THE SPLIT ITSELF HAS TO MAKE -------------------------------
   *
   * The first says the four streams this arm's `what` actually describes are still welded to the
   * corner, so nothing about the published pin changed. The second says the fifth is NOT — and it is
   * the claim that would have caught the Protect artefact had it existed a week ago. */
  P('accuracy, crit, secondary and damage are ALL still the corner — the pin this arm claims is intact',
    () => { const R = a.mediRng();
            return ['acc', 'crit', 'sec', 'dmg'].every(k => {
              const f = R[k]; const v = f();
              return v === a.corner || (a.tieToSecondBody && Math.floor(v * 16) === Math.floor(a.corner * 16));
            }); });
  /* ROADMAP #222 — AND THE STALL COUNTER IS ON THE CORNER TOO, WHICH IS THE POINT OF THE MEASUREMENT.
   * Showdown's `randomChance(1, counter)` is `random(counter) < 1` and `random(den)` is pinned to
   * `den - 1` at this corner, so the authority's consecutive Protect fails here as well. The two
   * engines agree BECAUSE both are pinned; a free die on our side disagreed with a pinned one on
   * theirs and cost 52 games. */
  P('the STALL counter is on the corner as well, so both engines refuse a consecutive Protect under '
    + 'this pin and neither is guessing  [ROADMAP #222 — measured, the free-die variant was worse]',
    () => { const R = a.mediRng(); const v = R.stall(); return v === R.stall() && v === a.corner; });
  /* THE ARMS MUST DIFFER IN ONE THING. `random(2,5)` is the sleep duration and it is the same in
   * every arm, so a difference between two arms is the tie or the corner and never the sleep. */
  P('the RANGE form is untouched by the tie pin: random(2,5) — THE SLEEP DURATION — is 2',
    () => a.random(2, 5) === 2 && a.random(0, 2) === 0 && a.random(1, 4) === 1);
  return C;
}
const PIN_CLAIMS_BY_ARM = new Map(ARMS.map(a => [a.id, armClaims(a)]));
/* Exported flat, so `for (const [what, f] of G.PIN_CLAIMS)` checks EVERY arm rather than one. */
const PIN_CLAIMS = [].concat(...ARMS.map(a => PIN_CLAIMS_BY_ARM.get(a.id)));
const PIN_BAD = PIN_CLAIMS.filter(([, f]) => !f()).map(([w]) => w);
if (PIN_BAD.length) {
  console.error('THE PIN IS WRONG — these claims are false: ' + PIN_BAD.join('; '));
  process.exit(1);
}

/* ---- THE PIN SET IS A RUN PARAMETER, AND IT IS DIGESTED -----------------------------------------
 * Two arms of a before/after that were pinned differently are not a before/after, exactly as two arms
 * steered by different censuses are not. The digest covers WHICH arms ran and every behavioural claim
 * each one makes, so a silent change to a pin forks it even when the arm list does not move. It is
 * carried in `mode`, which `engine/arms_comparable.js` already compares as a run parameter — "Mode A
 * and Mode B are different instruments" is exactly the claim, one level finer. */
const ARM_IDS = (() => {
  const want = flag('--arm', null);
  if (!want) return ARMS.map(a => a.id);
  const ids = want.split(',').map(s => s.trim()).filter(Boolean);
  const bad = ids.filter(x => !ARM_BY_ID.has(x));
  if (bad.length) {
    console.error('--arm names an arm that does not exist: ' + bad.join(', ')
      + '\n  arms are: ' + ARMS.map(a => a.id).join(', '));
    process.exit(2);
  }
  return ids;
})();
const ARMS_RUN = ARM_IDS.map(id => ARM_BY_ID.get(id));
/* ROADMAP #222 -- THE DICE MODEL IS PART OF THE PIN AND MUST MOVE THE DIGEST.
 *
 * This file's own header records the 2026-08-07 reset: "ANY RUN AFTER THIS IS NOT COMPARABLE WITH ANY
 * RUN BEFORE IT." Splitting the stall counter off the scalar is exactly that kind of change — it
 * alters which games diverge — so `dice` and `stall_seed` are folded into the digest and
 * `engine/arms_comparable.js` will now REFUSE a pre-split run against a post-split one rather than
 * silently tabling them together. A number that quietly spans the reset is worse than no number. */
const DICE_MODEL = 'split/v1: acc+crit+sec+dmg on the corner, stall on its own seeded stream';
const PIN_DIGEST = crypto.createHash('sha256').update(JSON.stringify(ARMS_RUN.map(a => ({
  id: a.id, corner: a.corner, damageIndex: a.damageIndex, tieToSecondBody: a.tieToSecondBody,
  sdShuffleReverses: a.sdShuffleReverses,
  /* `dice` is DELIBERATELY NOT IN THE DIGEST. The split was measured, made the instrument worse, and
   * was reverted to the corner — so this arm's behaviour is bit-identical to every run since
   * 2026-08-07 and those runs stay comparable. Had the split been kept, this line would have to
   * include it: see DICE_MODEL. */
  claims: PIN_CLAIMS_BY_ARM.get(a.id).map(([w]) => w),
})))).digest('hex').slice(0, 12);
const PINS = {
  why: 'ONE PIN IS ONE CORNER. Every published number before 2026-08-07 describes `top-tie-in-order` '
     + 'and nothing else: max damage, every sub-100 move missing, and every speed tie resolving to '
     + 'input order in both engines BY CONSTRUCTION.',
  arms_run: ARM_IDS, primary: PRIMARY_ARM.id, digest: PIN_DIGEST,
  arms: ARMS_RUN.map(a => ({ id: a.id, what: a.what, corner: a.corner === CORNER_TOP ? 'top' : 'bottom',
                             damage_roll_index: a.damageIndex,
                             damage_roll_means: a.damageIndex === 0 ? 'MAXIMUM' : 'MINIMUM',
                             speed_tie: a.tieToSecondBody ? 'to the LATER body' : 'to the EARLIER body',
                             showdown_shuffle: 'identity in every arm — see the header',
                             claims: PIN_CLAIMS_BY_ARM.get(a.id).map(([w]) => w) })),
  medicham2_has_one_scalar_die: 'RETRACTED 2026-08-11 (ROADMAP #222) and kept because it is what the '
     + 'sentence cost. It read: "accuracy, the crit, every secondary, the stall counter and the damage '
     + 'roll all read the same rng(), so there are TWO corners and not four independent knobs." True '
     + 'when written, and it described a COUPLING THE AUTHORITY DOES NOT HAVE -- Showdown draws each '
     + 'separately. Pinning the scalar high therefore did not mean "every sub-100 move misses", it '
     + 'meant that AND no secondary AND no crit AND max damage AND every consecutive Protect fails, '
     + 'welded into one event the real game cannot reach. It cost 41 games of apparent Protect defect '
     + 'that were zero. medicham2 now takes five named streams; this arm frees the stall counter and '
     + 'holds the other four on the corner, which is what its claims actually assert.',
  dice_model: DICE_MODEL,
};
/* THE CREDIT RULE IS PART OF THE SELECTION POLICY TOO (ROADMAP #91). `engine/steering.js` owns
 * `policy` and this file does not, so the version rides in `mode` beside the pin digest — which is
 * what `arms_comparable.js` compares. A run under click-credit and a run under effect-credit played
 * different games and must not be tabled together. */
const CREDIT_POLICY = 'observed-effect/v1';
/* THE NATURE IS THE THIRD RUN PARAMETER IN `mode` (2026-08-08). Carrying the sheet's real nature
 * changes the stat line, which changes turn order, which changes which games get played — the same
 * class of change as the pin and the credit rule, so it rides in the same place and
 * `arms_comparable.js` refuses a pair that spans it. `NATURE_MODE` is declared beside buildPair. */
const MODE = 'A/' + PRIMARY_ARM.id + '/pins:' + PIN_DIGEST + '/credit:' + CREDIT_POLICY
           + '/nature:' + NATURE_MODE;

/* ---- THE SKIP LIST, READ FROM THE DERIVATION ---------------------------------------------------- */
const PROTO = JSON.parse(fs.readFileSync(D('data', 'protocol-events.json'), 'utf8'));
const CLAIMED = new Set(M.TRACE_EVENTS);
const DECLARED_NOT_EMITTED = new Set((PROTO.notEmitted || []).map(e => e.event));
/* TRANSPORT, NOT PROTOCOL. These four are not in `data/protocol-events.json` at all — they are not
 * rule events and `engine/derive_protocol_events.js` does not scan the paths that emit them, so they
 * are neither claimed nor declared and would count as undeclared drops forever. Each is written out
 * rather than pattern-matched, because "drop anything I do not recognise" is the silent default this
 * counter exists to prevent. */
const TRANSPORT = {
  't:': 'a unix timestamp the client uses to place a message in time; carries no rule',
  'uhtml': 'client-side HTML the simulator sends for display (the Champions mod uses it for a banner)',
  'uhtmlchange': 'the update half of `uhtml`',
  '': 'a blank line — Showdown\'s own message separator inside a chunk',
};
let UNDECLARED_DROPS = 0;
const UNDECLARED_SEEN = new Set();
/* Showdown's log carries `|split|SIDE` followed by the omniscient line and then the spectator line;
 * the omniscient one is what medicham2 emits, so the other is dropped. */
function sdStream(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i] === '|split|p1' || log[i] === '|split|p2') { out.push(log[i + 1]); i += 2; continue; }
    out.push(log[i]);
  }
  return out.filter(l => {
    const k = String(l).split('|')[1];
    if (CLAIMED.has(k)) return true;
    if (!DECLARED_NOT_EMITTED.has(k) && !(k in TRANSPORT)) {
      /* LOUD. A silent drop here is a fallback that looks like agreement. */
      if (!UNDECLARED_SEEN.has(k)) { UNDECLARED_SEEN.add(k); UNDECLARED_DROPS++; }
    }
    return false;
  });
}

/* ================= THE SEMANTIC NORMALISER, AND IT IS THE DANGEROUS PART ==========================
 *
 * `M.traceCanon` is the SYNTACTIC normaliser: case, whitespace, the punctuation that lives inside a
 * name. It is symmetric and it is the engine's. What it cannot do is decide that two DIFFERENT
 * PROTOCOL FORMS mean the same thing, and run one of this driver said they did not:
 *
 *     showdown  |-ability|p1a: Sharpedo|Speed Boost|boost        <- announce, then boost
 *     medicham  |-boost|p1a: sharpedo|spe|1|[from] ability: speedboost   <- boost, attributed
 *
 * Same mechanic, same state change, two spellings. Run one reported 160/160 games diverging with a
 * median of ONE completed turn, and the largest class (44 games) was the TARGET FIELD of a spread
 * move, where Showdown names one victim plus `[spread]` and this engine names its own user. That is
 * display convention. §2.2 of the design — the Csmith lesson — says exactly what happens next: where
 * the thing compared is not semantically meaningful the ORACLE COLLAPSES, and the real bugs (Mirror
 * Armor not bouncing, Inner Focus not refusing Intimidate, recoil off by one HP) drown in it.
 *
 * ================= TWO RULES ON THIS LAYER, BECAUSE IT CAN LIE FOR US ============================
 *
 * 1. AN EQUIVALENCE MUST NOT BE ABLE TO NORMALISE A REAL BUG AWAY. Every rule below is a CLAIM that
 *    two forms mean the same thing, and every claim carries a RED DEMONSTRATION: a pair that must
 *    compare EQUAL (the form it collapses) and a pair that must still compare UNEQUAL (the meaning it
 *    must not). `EQUIV_PROOF` runs both directions before any game does, and a rule whose `distinct`
 *    pair compares equal is a SILENCER, not a normaliser. An equivalence with no red demonstration
 *    does not go in this list.
 * 2. WHAT IT COLLAPSED IS COUNTED AND PUBLISHED, PER RULE. A normaliser whose effect is invisible is
 *    how a 100% divergence rate becomes 2% with nobody able to say whether the engine improved or the
 *    comparator got quieter. `normalisation` in the artifact carries a row per rule.
 *
 * THE GENERAL ARGUMENT THAT MAKES THESE SAFE is one sentence: EVERY RULE DROPS AN ANNOUNCEMENT OR AN
 * ATTRIBUTION AND NEVER A STATE CHANGE. Showdown's `-ability` says an ability is about to do
 * something; the something is a separate line and is kept. `[from] ability: speedboost` says which
 * ability moved the stat; the stat, the direction and the amount are kept. The `|move|` line's target
 * field says who it was aimed at; who was actually HIT is carried by the `-damage`, `-status`,
 * `-unboost` and `-enditem` lines that follow, and those are kept and compared. So a mechanic that
 * did not fire, fired on the wrong body, or fired by the wrong amount is still a divergence — which
 * is what the `distinct` half of each rule proves rather than asserts. */
const NORM_COUNTS = new Map();          // rule id -> lines it changed or dropped
const bumpNorm = (id) => NORM_COUNTS.set(id, (NORM_COUNTS.get(id) || 0) + 1);

/* Each rule takes the CANONICAL line's field array and returns a new array, or null to drop the line.
 * `equal` is the form it collapses; `distinct` is the meaning it must never collapse. */
const EQUIV = [
  { id: 'ability-announcement',
    why: 'Showdown\'s `|-ability|` is a COSMETIC announcement that an ability activated (SIM-PROTOCOL). '
       + 'Every consequence of it is a separate line and is kept, so dropping the announcement cannot '
       + 'hide an ability that did not fire — its effect would still be missing.',
    fn: f => (f[1] === '-ability' ? null : f),
    equal: ['|-ability|p1a: Sharpedo|Speed Boost|boost', ''],
    distinct: ['|-boost|p1a: Sharpedo|spe|1', '|-boost|p1a: Sharpedo|atk|1'] },

  { id: 'stat-attribution',
    why: 'a stat line\'s meaning is (body, stat, direction, amount). `[from] ability: X` and `[of] Y` '
       + 'say WHICH effect moved it, which the two engines tag inconsistently; the four fields that '
       + 'decide the board are kept.',
    fn: f => (f[1] === '-boost' || f[1] === '-unboost'
              ? f.filter((x, i) => i < 5 || !/^\[(from|of)\]/.test(x)) : f),
    equal: ['|-boost|p1a: Sharpedo|spe|1|[from] ability: Speed Boost', '|-boost|p1a: Sharpedo|spe|1'],
    distinct: ['|-unboost|p2a: X|atk|1', '|-unboost|p2b: X|atk|1'] },

  { id: 'source-tag',
    why: '`[of] pXy` names the BODY behind an effect whose name is already carried by `[from]`. The '
       + 'two engines tag it inconsistently on -heal, -activate and -damage.',
    fn: f => f.filter(x => !/^\[of\]/.test(x)),
    equal: ['|-heal|p1a: X|100/100|[from] drain|[of] p2a', '|-heal|p1a: X|100/100|[from] drain'],
    distinct: ['|-heal|p1a: X|100/100|[from] drain', '|-heal|p1a: X|100/100|[from] item: Leftovers'] },

  { id: 'effect-namespace',
    why: 'Showdown writes an effect sometimes bare and sometimes namespaced — `|-sidestart|p1: A|Reflect` '
       + 'against this engine\'s `move: reflect`. The NAME is kept; only the namespace goes.',
    fn: f => f.map((x, i) => (i < 2 ? x : x.replace(/^(move|ability|item):/, '')
                                          .replace(/^(\[from\])(move|ability|item):/, '$1'))),
    equal: ['|-sidestart|p1: A|Reflect', '|-sidestart|p1: |move: Reflect'],
    distinct: ['|-sidestart|p1: A|Reflect', '|-sidestart|p1: A|Light Screen'] },

  { id: 'display-flags',
    why: '`[silent]`, `[still]`, `[miss]` and `[spread]` are rendering hints. The state each one '
       + 'decorates is a separate event — `-miss` for a miss, `-prepare` for a charge, one `-damage` '
       + 'per body actually hit for a spread — and all of those are kept.',
    fn: f => f.filter(x => !/^\[(silent|still|miss|spread|anim)\]/.test(x)),
    equal: ['|-start|p1a: X|perish3|[silent]', '|-start|p1a: X|perish3'],
    distinct: ['|-start|p1a: X|perish3', '|-start|p1a: X|perish2'] },

  { id: 'move-target-field',
    why: 'THE BIGGEST ONE, AND THE ONE THAT NEEDS THE ARGUMENT. A `|move|` line means "this body used '
       + 'this move". Showdown additionally names ONE nominal target plus `[spread]`; this engine '
       + 'names its own user on a spread move. WHO WAS ACTUALLY HIT is not in this field on either '
       + 'side — it is in the `-damage` / `-status` / `-unboost` / `-enditem` lines that follow, which '
       + 'are kept and compared body by body. A redirection bug is therefore caught one line later '
       + 'rather than not at all, and the `distinct` pair below is exactly that case.',
    fn: f => (f[1] === 'move' ? f.slice(0, 4) : f),
    equal: ['|move|p2b: Garchomp|Rock Slide|p1b: Kingambit|[spread] p1a,p1b', '|move|p2b: Garchomp|Rock Slide|p2b: Garchomp'],
    distinct: ['|-damage|p1a: Kingambit|100/175', '|-damage|p1b: Kingambit|100/175'] },

  { id: 'switch-cause',
    why: 'a pivot switch is tagged `[from] U-turn` by Showdown; the pivot itself is the `|move|` line '
       + 'immediately before it, which is kept. The species and the HP on the switch line are kept.',
    fn: f => (f[1] === 'switch' || f[1] === 'drag' ? f.filter(x => !/^\[from\]/.test(x)) : f),
    equal: ['|switch|p1b: Grimmsnarl|Grimmsnarl, L50|100/100|[from] U-turn', '|switch|p1b: Grimmsnarl|Grimmsnarl, L50|100/100'],
    distinct: ['|switch|p1a: Simisage|Simisage, L50|100/100', '|switch|p1a: Zoroark|Zoroark, L50|100/100'] },
];

/* ONE LINE THROUGH THE WHOLE PIPELINE: the engine's symmetric canonicaliser, then the equivalences.
 * Returns null when the line carries no state at all. */
function semantic(line) {
  let f = M.traceCanon(line).split('|');
  for (const r of EQUIV) {
    const before = f.join('|');
    const out = r.fn(f);
    if (out === null) { bumpNorm(r.id); return null; }
    if (out.join('|') !== before) bumpNorm(r.id);
    f = out;
  }
  return f.join('|');
}
/* A stream reduced to comparable lines, keeping the map back to the RAW line so a divergence still
 * prints what the engine actually emitted rather than what the comparator made of it. */
function reduce(stream) {
  const lines = [], rawIdx = [];
  for (let i = 0; i < stream.length; i++) {
    const s = semantic(stream[i]);
    if (s === null) continue;
    lines.push(s); rawIdx.push(i);
  }
  return { lines, rawIdx };
}

/* THE RED DEMONSTRATION FOR EVERY RULE, run before a game does. Both directions, per rule. */
function equivProof() {
  return EQUIV.map(r => {
    const eq = r.equal.map(x => (x === '' ? null : semantic(x)));
    const di = r.distinct.map(semantic);
    return { id: r.id, why: r.why,
             collapses: eq[0] === eq[1],
             keeps_meaning: di[0] !== di[1],
             equal_becomes: eq[0], distinct_becomes: di };
  });
}

/* ---- THE CENSUS, AS A COVERAGE TARGET ------------------------------------------------------------
 * §5.3: "a run that never triggered Illusion has not tested Illusion and must say so". The 235-row
 * census IS the list — nobody hand-writes which mechanics matter.
 *
 * 192 of the 235 rows name a tag that exists in data/tags.json and therefore have an ENTITY SET this
 * instrument can watch for. The other 43 are composite probe names (`intimidateRetaliationNet`,
 * `drainThenPunishOrder`) that describe an INTERACTION rather than a taggable entity. Those are
 * reported as UNMEASURABLE BY THIS INSTRUMENT and never as uncovered — a zero on them would read as
 * a failure of the run rather than a limit of the measurement. */
/* THE CENSUS IS THIS RUN'S SELECTION POLICY AND IS READ THROUGH `engine/steering.js`, WHICH DIGESTS
 * IT (ROADMAP #81 WIRE 5). It is NOT a passive coverage report: `covWant` below scores every legal
 * action by the least-exercised census row it can reach, so THE CENSUS DECIDES WHICH GAMES THIS RUN
 * PLAYS. Landing one probe in tests/test-mechanics.js therefore changes the sample — which is how a
 * before-arm read 51 games / 50 causes and a re-run of the identical frozen release over a
 * byte-identical store read 46 / 45. See engine/steering.js's header for why the fix is a DECLARED,
 * PINNABLE, DIGESTED policy rather than another entry in the release manifest. */
const STEER = STEERING.resolve({ censusPath: CENSUS_PIN });
const CENSUS = STEER.census;
const SECTION = { item: 'items', move: 'moves', ability: 'abilities' };
const COV_TARGETS = [];      // { key, kind, tag, label, entities:Set }
const COV_UNMEASURABLE = []; // { key, kind, tag, label }
for (const r of CENSUS.results) {
  const sec = SECTION[r.kind];
  const key = r.kind + ':' + r.tag;
  let set = null, why = null;
  /* THE THROW IS THE ANSWER, NOT AN ERROR. `names.byTag` throws on a tag name data/tags.json does not
   * carry, and for a census row like `intimidateRetaliationNet` that is the correct answer: the row
   * names an INTERACTION and there is no entity set to watch. The reason is KEPT and reported —
   * swallowing it would turn "this instrument cannot measure that" into a bare absence. */
  if (!sec) why = 'the census kind "' + r.kind + '" has no section in data/tags.json';
  else { try { set = N.byTag(sec, r.tag); } catch (e) { why = String((e && e.message) || e).split('.')[0]; } }
  if (set && set.size) COV_TARGETS.push({ key, kind: r.kind, tag: r.tag, label: r.label, sec, entities: set });
  else COV_UNMEASURABLE.push({ key, kind: r.kind, tag: r.tag, label: r.label,
                               why: why || 'the tag exists but no ' + sec + ' row carries it' });
}
/* ---- WHAT COUNTS AS EXERCISING A MECHANIC (ROADMAP #91) -----------------------------------------
 *
 * A CLICK IS NOT A TEST. Until 2026-08-07 a census row was credited the moment an entity carrying its
 * tag was CLICKED — nothing asked whether the move did anything. CAUGHT LIVE: Primarina clicked Haze
 * on turn 1 into a board with zero boosts on it. Haze is a no-op there. The row was marked exercised
 * and the driver moved on, and Haze has been "covered" ever since without ever having been tested.
 *
 * IT COMPOUNDS, WHICH IS THE PART THAT MATTERS. The census SELECTS THE SAMPLE (see the steering block
 * above): `covWant` prefers the least-exercised row, so a falsely credited row steers every LATER run
 * AWAY from the mechanic it was supposed to test. That is why Fairy Aura sat dead on the format's
 * most-used mega while the coverage number looked healthy — it did not need to be REACHED, it needed
 * to be reached WITH A FAIRY MOVE ON THE FIELD.
 *
 * SO CREDIT MOVES FROM THE CLICK TO THE OBSERVED EFFECT. `engine/board_state.js` already reads the
 * whole board out of both engines at every turn boundary; the evidence was in hand and the CREDITING
 * was wrong. A row is credited for a turn when
 *
 *   effect    an entity of the row was in play AND a board leaf in a family THE TAG'S OWN PARAMS
 *             NAME changed across that turn, in either engine;
 *   negative  a blocking tag's carrier was on the field, a connected move that moves that family was
 *             aimed at it, and the family DID NOT move on the carrier — the declared negative case
 *             reached and correctly not firing;
 *   click     ONLY for a tag that names no board leaf at all (contact, sound, priority, moveClass, a
 *             damage multiplier). A connected click is the strongest evidence available for those,
 *             and it is COUNTED APART and never added into the headline.
 *
 * A click with no witness counts for NOTHING but an ATTEMPT.
 *
 * THE FAMILIES ARE DERIVED, NOT HAND-WRITTEN PER MECHANIC. Two passes, both over vocabulary rather
 * than over mechanics: STRUCTURAL reads the tag's param KEYS and VALUES (a `boosts` key names stat
 * stages, a `weather` key names the sky, a `hazard` key names a hazard) and NAME reads the tag's own
 * name against the same closed list of board nouns. Writing a scenario per mechanic would rebuild the
 * hand-maintained list CLAUDE.md opens with; a table of ~20 board nouns is a derivation rule.
 *
 * AND IT IS PRINTED BEFORE IT IS WIRED, per the standing rule — a derived set that over-matches is
 * invisible until somebody looks at what it matched. `--witness` prints every row.
 *
 * THE ATTRIBUTION LIMIT, STATED RATHER THAN HIDDEN: credit is at TURN granularity, scoped to the
 * user's slot, the target's slot, the field and both sides. Two mechanics acting on the same body in
 * the same turn can both be credited. That is weaker than a per-effect trace and STRICTLY TIGHTER
 * than the click it replaces, which is the whole claim. */
const SHOW_WITNESS = has('--witness');
/* The board vocabulary — one regex per family of leaves `engine/board_state.js` actually compares.
 * Keyed on the FAMILY string that BS.family() produces, never on a raw path. */
const BOARD_FAMILY = {
  hp:         /(^|\.)hp$|(^|\.)maxhp$/,
  fainted:    /fainted$|MISSING-OR-EXTRA/,
  status:     /\.status$|status_counter$/,
  boosts:     /boosts\./,
  item:       /\.item$/,
  species:    /species$/,
  weather:    /^field\.weather/,
  terrain:    /^field\.terrain/,
  trickroom:  /^field\.trickroom/,
  tailwind:   /^tailwind$/,
  screens:    /^screens\./,
  hazards:    /^hazards\./,
  substitute: /vol\.substitute$/,
  taunt:      /vol\.taunt$/,
  encore:     /vol\.encore$/,
  disable:    /vol\.disable$/,
  leechseed:  /vol\.leechseed$/,
  confusion:  /vol\.confusion$/,
  perish:     /vol\.perish$/,
  trap:       /vol\.trapped_by_move$/,
};
/* PASS 1 — STRUCTURAL. A param KEY that is a board noun, or a param VALUE that names one. */
const PARAM_KEY_FAMILY = [
  [/^boosts$|^statChange$|^lowersSpeed$|^lowersAttack$|^raisesSpeed$|^alsoLowers$|^alsoRaises$|^stages$/, ['boosts']],
  /* `weathers` and `inWeather` are CONDITIONS a tag reads, not skies it sets, and they are left out
   * for the same reason `weatherScaled` is declared leafless above. */
  [/^weather$|^actsAsWeather$/, ['weather']],
  [/^terrain$/, ['terrain']],
  [/^pseudoWeather$/, ['trickroom']],
  [/^hazard$/, ['hazards']],
  [/^sideCondition$/, ['screens', 'tailwind', 'hazards']],
  [/^status$|^statuses$|^cures$|^inflicts$|^oneOf$/, ['status']],
  [/^heal$|^drain$|^recoil$|^costsFraction$|^chipPerTurn$|^leavesHP$|^buffer$/, ['hp']],
  [/^into$|^becomes$/, ['species']],
  [/^speedMult$/, []],                 // a multiplier moves no leaf — see the no-board-leaf class
];
/* PASS 0 — A TAG THAT MOVES NO BOARD LEAF AT ALL, DECLARED RATHER THAN DISCOVERED.
 *
 * A damage multiplier, a crit ratio, an accuracy modifier, a priority shift and a move CLASSIFICATION
 * change a number inside a calculation or say what kind of move this is. None of them writes a leaf
 * `board_state.js` compares, so no board evidence can exist for them and a connected click is the
 * strongest thing this instrument can produce.
 *
 * IT IS A LIST BECAUSE THE FIRST VERSION WAS NOT, AND THAT VERSION OVER-MATCHED — printed before it
 * was wired, exactly as the standing rule says. `damageBoost` and `stabBoost` picked up the `boost`
 * noun and would have been credited on any stat change; `weightBased` picked up `weight` and would
 * have been credited on any damage; `convertsMoveType`'s `into: "Dragon"` is a TYPE and was read as a
 * SPECIES; `terrainScaled`'s `terrain` key is the terrain it READS, not one it sets; and
 * `statusCategory` means "this move is in the Status category", which was being read as "a status
 * appeared". Every one of those would have been a false credit of exactly the shape #91 exists to
 * remove.
 *
 * WHAT IS DELIBERATELY NOT IN HERE: `ohko`, `fixedDamage`, `multiHit` and `noRecoil` all reach HP, and
 * `amplifiesBoosts` (Simple) doubles a stage the board can see. */
const NO_BOARD_LEAF_TAGS = new RegExp('^(' + [
  'statusCategory', 'moveClass', 'contact', 'sound', 'powder', 'spreadFoes', 'spreadAll',
  'neverMisses', 'neverMissesAttack', 'multiAccuracy', 'priority', 'priorityMod',
  'fractionalPriority', 'accuracyMod', 'writesAccuracy', 'critRatioUp', 'critDamageUp', 'alwaysCrit',
  'preventsCrit', 'damageBoost', 'damageReduce', 'damageMultAll', 'damageMultType',
  'boostsMoveClass', 'boostsSuperEffective', 'stabBoost', 'conditionalPower', 'variablePower',
  'powerFromFallen', 'weightBased', 'terrainScaled', 'convertsMoveType', 'speedMult', 'speedCond',
  'ignoresBoosts', 'ignoresStatStages', 'ignoresDefenderAbility', 'ignoresScreensAndSubs',
  'ignoresTypeImmunity', 'removesOwnSecondaries', 'halvesTypeDamage', 'halvesDamage',
  'reducesAllyDamage', 'auraBoost', 'auraBreak', 'hitsTwice', 'overridesEffectiveness',
  'condStatMult', 'untagged', 'statSwap', 'swapsStat', 'blocksHealing',
  /* THESE FOUR READ A CONDITION, THEY DO NOT SET ONE. `weatherScaled`, `chargeSkippedByWeather`,
   * `failsWithoutWeather` and `failsWithoutTerrain` all ASK what the sky is; crediting them when the
   * sky changed would credit the mechanic that set it. */
  'chargeSkippedByWeather', 'failsWithoutWeather', 'failsWithoutTerrain', 'weatherSuppression',
].join('|') + ')$');
/* PASS 2 — NAME. The tag's own name against the same closed list of board nouns. Every entry is a
 * NOUN, not a mechanic: `boost` matches boostsUser, boostsTarget, invertsBoosts, amplifiesBoosts and
 * anything added later that moves a stat stage. */
const NAME_WORD_FAMILY = [
  [/boost|unboost|lowers|statchange|stat.?swap|restoresstats|switchindrop/i, ['boosts']],
  [/heal|drain|recoil|perturnhp|costsuserhp|leaveshp|crash|survivesfrom/i, ['hp']],
  [/faint|ohko/i, ['hp', 'fainted']],
  [/burn|poison|toxic|paraly|sleep|freeze|thaw|statusinflict|curesstatus|statusimmune|proceduralstatus/i, ['status']],
  [/confusion/i, ['confusion']],
  [/item|berry|megastone|unburden/i, ['item']],
  [/weathersetter|setsweather|privateweather/i, ['weather']],
  [/chipimmune/i, ['hp']],
  [/setsterrain|terrainsetter/i, ['terrain']],
  [/room|reversesspeed/i, ['trickroom']],
  [/hazard/i, ['hazards']],
  [/screen/i, ['screens']],
  [/tailwind|doublessidespeed/i, ['tailwind']],
  [/substitute/i, ['substitute']],
  [/taunt|forbidsstatusmoves/i, ['taunt']],
  [/encore|locksTarget|sealsMoves/i, ['encore', 'disable']],
  [/perish/i, ['perish']],
  [/partialtrap|preventsswitch/i, ['trap']],
  [/forme|formechange|switchinforme|megarow|megasheet/i, ['species']],
  [/leechseed|perturn/i, ['leechseed']],
  [/sidebuff/i, ['screens', 'tailwind', 'hazards']],
];
/* A BLOCKING TAG. Its declared case is the effect NOT happening, and a bare "it did not happen" is
 * true on almost every turn — so a negative credit additionally requires the precondition: a
 * connected move that moves the same family, aimed at the carrier. */
const BLOCKING = /^(blocks|immune|prevents|refuses|reflects|suppress|ignores|noRecoil|halves|damageReduce|removesOwnSecondaries|weatherChipImmune|typeImmunity|statusImmune|preventsCrit|preventsStatDrop|blocksMove|blocksBerries|blocksExplosion|blocksHealing|blocksSoundMoves|immuneToMoveClass|oneTurnGuard|auraBreak|weatherSuppression|ignoresScreensAndSubs|ignoresStatStages)/i;

function witnessFor(sec, tag, entities) {
  const fams = new Set(), why = [];
  if (NO_BOARD_LEAF_TAGS.test(tag))
    return { families: [], why: ['DECLARED: this tag changes a number inside a calculation or says '
      + 'what KIND of move this is. It writes no leaf the board comparator reads.'],
      blocking: false, kind: 'no-board-leaf' };
  const add = (list, reason) => { for (const f of list) { if (BOARD_FAMILY[f]) { fams.add(f); } }
                                  if (list.length) why.push(reason); };
  /* the params carried by EVERY entity of this row, unioned — the tag is one mechanic and the params
   * differ only in their values. */
  const keys = new Set(), vals = [];
  for (const e of entities) {
    const row = (TAGS_OBJ[sec] || {})[e];
    const p = row && row.params && row.params[tag];
    if (!p || typeof p !== 'object') continue;
    const walk = (o) => { for (const [k, v] of Object.entries(o)) {
      keys.add(k);
      if (typeof v === 'string') vals.push(v);
      else if (v && typeof v === 'object') walk(v); } };
    walk(p);
  }
  for (const k of keys) for (const [re, f] of PARAM_KEY_FAMILY)
    if (re.test(k)) add(f, 'param key `' + k + '`');
  for (const [re, f] of NAME_WORD_FAMILY) if (re.test(tag)) add(f, 'the tag name matches ' + re.source.slice(0, 28));
  const blocking = BLOCKING.test(tag);
  return { families: [...fams], why, blocking,
           kind: fams.size ? (blocking ? 'negative-or-effect' : 'effect') : 'no-board-leaf' };
}
for (const t of COV_TARGETS) t.witness = witnessFor(t.sec, t.tag, t.entities);

/* PRINTED BEFORE IT IS WIRED. A derived set that over-matches is invisible until somebody looks at
 * what it matched; the counts are always printed and `--witness` prints every row. */
{
  const byKind = new Map();
  for (const t of COV_TARGETS) byKind.set(t.witness.kind, (byKind.get(t.witness.kind) || 0) + 1);
  console.log('\n  WHAT COUNTS AS EXERCISING A ROW — derived from each tag\'s own params, per ROADMAP #91:');
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1]))
    console.log('    ' + String(n).padStart(4) + '  ' + k
      + (k === 'no-board-leaf' ? '   (a connected click is the only evidence available; counted APART)' : ''));
  if (SHOW_WITNESS) for (const t of COV_TARGETS)
    console.log('      ' + t.key.padEnd(34) + (t.witness.families.join(',') || '-').padEnd(34)
      + t.witness.why.slice(0, 2).join('; '));
}

/* THE STEERING BLOCK THAT GOES IN THE ARTIFACT. The census OBJECT is dropped — the digest is the
 * claim, and 250 rows of it in every artifact would bury the numbers. */
const { census: _c, ...STEER_STAMP } = STEER;
STEER_STAMP.selects_from = COV_TARGETS.length;
STEER_STAMP.unmeasurable = COV_UNMEASURABLE.length;
STEER_STAMP.credit = 'observed-effect/v1 — a row is exercised when a board leaf in a family the tag\'s '
  + 'own params name changed across the turn, or when a declared negative case was reached and did not '
  + 'fire. A click alone counts for nothing. ROADMAP #91.';

/* SAID OUT LOUD, BEFORE A GAME RUNS. A selection policy nobody can see is indistinguishable from no
 * selection policy, which is how four before/after pairs came to rest on a moving sample. */
console.log('\n  THE SELECTION POLICY — what decides which games this run plays:');
console.log('    ' + STEER_STAMP.policy + '   ' + (STEER_STAMP.pinned ? 'PINNED to ' + STEER_STAMP.input_read_from : 'live ' + STEER_STAMP.input));
console.log('    digest ' + STEER_STAMP.input_digest + '  ' + STEER_STAMP.input_rows + ' rows, generated ' + STEER_STAMP.input_generated);
console.log('    ' + (STEER_STAMP.matches_live === null ? 'UNKNOWN whether it matches the live census'
  : STEER_STAMP.matches_live ? 'identical to the live census' : 'DIFFERENT from the live census (' + STEER_STAMP.input_live_digest + ')'));
console.log('    it steers ' + COV_TARGETS.length + ' entity sets; ' + COV_UNMEASURABLE.length + ' census rows steer nothing');

/* THE `--baseline` GUARD RUNS LATER — see `baselineGuard()` below the swarm build. It cannot run here
 * because the SECOND steering input (which teams the swarm picked) is not known yet, and a guard that
 * clears a pair on half its inputs is worse than no guard. */
let BASELINE_CHECK = null;
function baselineGuard() {
  if (!BASELINE) return;
  let prev;
  try { prev = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (e) { console.error('--baseline ' + BASELINE + ' cannot be read: ' + e.message); process.exit(3); }
  const cmp = STEERING.comparable(prev.steering, STEER_STAMP);
  /* THE PIN SET IS THE OTHER HALF OF THE SELECTION, AND IT IS CHECKED HERE TOO (ROADMAP #88). Two arms
   * pinned to different corners of the die did not play the same games, exactly as two arms steered by
   * different censuses did not. FAILS CLOSED on an artifact that declares no pin set: every artifact
   * written before 2026-08-07 has none, and the honest verdict for those is "nothing recorded which
   * corner it measured", never "it measured this one". */
  if (!prev.pins || !prev.pins.digest) {
    cmp.ok = false;
    cmp.reasons = (cmp.reasons || []).concat(['the baseline declares no `pins` block — it predates '
      + 'ROADMAP #88, so nothing recorded which corner of the die it measured. Every pre-2026-08-07 '
      + 'run is `top-tie-in-order` by construction, but it never said so and this guard will not '
      + 'assume it.']);
  } else if (prev.pins.digest !== PIN_DIGEST) {
    cmp.ok = false;
    cmp.reasons = (cmp.reasons || []).concat(['the PIN SET differs: ' + prev.pins.digest + ' ('
      + (prev.pins.arms_run || []).join(', ') + ') vs ' + PIN_DIGEST + ' (' + ARM_IDS.join(', ')
      + '). A different pin is a different instrument — a die pinned to max damage and a die pinned '
      + 'to min damage answer different questions.']);
  }
  BASELINE_CHECK = { artifact: BASELINE, baseline_release: prev.engine_release || null,
                     baseline_steering: prev.steering || null,
                     baseline_pins: (prev.pins && prev.pins.digest) || null, pins: PIN_DIGEST,
                     ok: cmp.ok, reasons: cmp.reasons };
  console.log('\n  BASELINE COMPARABILITY vs ' + BASELINE + '  (release ' + (prev.engine_release || 'UNSTAMPED') + ')');
  if (cmp.ok) {
    console.log('    COMPARABLE — same selection policy, census ' + STEER_STAMP.input_digest
      + ', team pool ' + STEER_STAMP.team_pool_digest);
  } else {
    console.error('    NOT COMPARABLE — this run would not be a controlled before/after:');
    for (const r of cmp.reasons) console.error('      - ' + r);
    console.error('    REFUSING TO RUN. Pin both arms to the same census with --census <file>, and take'
      + '\n    both arms without the ingest appending to the game store in between.');
    process.exit(3);
  }
}

/* ---- COVERAGE BOOKKEEPING -----------------------------------------------------------------------
 * OBSERVED, NEVER DECLARED. §3.1: the coverage report must count the ability a body ACTUALLY HAD
 * when it acted, not the one its sheet declared, or a body that megaed into Trace and used it reads
 * as "Trace exercised: 0". Every entity here is read off a live battle body or off the emitted
 * stream, never off the team sheet. */
const OBSERVED = { moves: new Map(), abilities: new Map(), items: new Map(), species: new Map() };
const bump = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
/* A MOVE THAT MISSED EXERCISED THE MISS PATH AND NOTHING ELSE. Counted separately so the report can
 * say which moves were clicked and never connected — under the Mode A pin that is every move with
 * printed accuracy below 100, and calling those "covered" would be a lie the size of the format. */
const CLICKED_BUT_MISSED = new Map();

/* Read the entities out of ONE medicham2 trace stream plus the live bodies that produced it. */
function harvest(stream, S) {
  for (let i = 0; i < stream.length; i++) {
    const p = String(stream[i]).split('|');
    if (p[1] !== 'move') continue;
    const mv = id(p[3]);
    /* the `-miss` for this click, if any, is the next line or the one after (a `-crit`/`-activate`
     * can sit between). Bounded at 3 rather than scanned to the next `|move|`, so a later miss by a
     * different body is never attributed here. */
    let missed = false;
    for (let j = i + 1; j < Math.min(i + 4, stream.length); j++) {
      const q = String(stream[j]).split('|');
      if (q[1] === 'move') break;
      if (q[1] === '-miss' && q[2] === p[2]) { missed = true; break; }
    }
    if (missed) bump(CLICKED_BUT_MISSED, mv); else bump(OBSERVED.moves, mv);
  }
  /* Bodies: whatever was on the field or on the bench when the game stopped, plus every body that
   * ever occupied an active slot (recorded per turn by the caller). */
  for (const m of [...S.actA, ...S.actB, ...S.benchA, ...S.benchB]) {
    if (!m) continue;
    bump(OBSERVED.species, id(m.name));
    bump(OBSERVED.abilities, id(m.ability));
    if (m.item) bump(OBSERVED.items, id(m.item));
  }
}

/* ---- TEAM BUILDING ------------------------------------------------------------------------------
 * The sheet is what the player DECLARED, six deep. Four are brought, and both engines are handed the
 * same four.
 *
 * MEGA STONES ARE NO LONGER STRIPPED (ROADMAP #31, 2026-08-07). They were, and the reason was a real
 * modelling difference rather than laziness: medicham2 built a stone-holder AS THE MEGA before the
 * battle started and Showdown evolves on a CHOICE, mid-turn, so a stone parted the streams on line
 * one of every game carrying one. 460 sets were stripped and the first run tested ZERO mega bodies in
 * a format whose mega usage is ~26%. `megaEvolveNow` closed that, so the stone stays on, the driver
 * issues the SAME choice to both engines, and the run is paired: every team pair is played TWICE,
 * once with the stones removed and once with them kept, so what megas cost is a MEASUREMENT and not a
 * difference between two runs of different things.
 *
 * THE STAT BLOCKS ARE NOT ALIGNED ANY MORE — THEY AGREE, AND THAT IS A STRICTLY STRONGER POSITION.
 * This used to build each body from data/engine-data.js (which bakes the dataset's average spread and
 * nature into `st`) and then COPY those numbers onto the Showdown body, which papered over any
 * disagreement rather than removing it. It also could not survive a mega: `formeChange` calls
 * `setSpecies`, which RECOMPUTES `storedStats` from the new base stats and the SET — so the moment a
 * body evolved, Showdown went back to the set's own numbers mid-turn, with no seam for a harness to
 * re-align in (`battle.choose` runs the whole turn), and `updateMaxHp` emitted a silent `-heal` on top.
 *
 * So both bodies are now the SAME Pokemon by construction: 0 EVs, 31 IVs and THE SHEET'S OWN NATURE on
 * the Showdown side, and a level-50 stat line computed from the row's own base stats under THE SAME
 * NATURE on the medicham side. Those two formulas are identical arithmetic —
 *     showdown  statModify: trunc((2b + 31 + max(2e-1,0)) * 50/100) + 5, then the nature multiply
 *     medicham  l50:        floor((2b + 31) * 50/100) + 5 + sp, then the SAME multiply   [sp = 0]
 * — and `alignStats` below is kept only to assert that, plus to carry the staged hpBoost arms.
 *
 * THE NATURE IS REAL AS OF 2026-08-08, AND THE SPREADS NEVER WILL BE. Will: "lets add the sp spreads
 * and rerun", then, correctly, "we wont have evs from team sheets" and "just nature". A Showdown OPEN
 * TEAM SHEET reveals species, item, ability, moves, NATURE, gender and level; it does NOT reveal the
 * spread. Every stored sheet reads `"evs": null` — 173,784 of 173,784 bodies in the frozen store — and
 * that is what the game shows, not a gap in the ingest. So THIS NARROWS ROADMAP #68's DECLARED GAP AND
 * DOES NOT CLOSE IT: the ladder's spreads remain untested and always will be.
 *
 * WHAT THE NATURE BUYS IS NOT 10% ON A STAT — IT IS THE SPEED AXIS. With every body flat AND Serious,
 * 91.4% of legal species share a base Speed with some other species, so THE RIG MANUFACTURED SPEED TIES
 * and almost never exercised a real speed differential (ROADMAP #86). The instrument was testing turn
 * order in the one configuration where turn order is hardest to get wrong. EXPECT THE TURN-1 NUMBER TO
 * FALL when this is switched on; that is the instrument getting honest, not a regression.
 *
 * AND THE NATURE IS NOT COPIED ONTO ANYTHING. Both engines are TOLD the nature and each computes; the
 * multiplier chart and the fixed-point multiply are `M.natureL50`, out of the frozen release, because
 * they are FACTS and a second copy here is the two-files-one-fact breach CLAUDE.md names. `ALIGN_MOVED`
 * still has to read 0, and now it is asserting something much harder. */
let STONES_STRIPPED = 0, STONES_KEPT = 0, TEAMS_UNBUILDABLE = 0, MONS_UNBUILDABLE = 0;
let MCKEY_MISSED = 0;
/* A declared switch that one engine could not resolve. MUST read 0/0: a miss means that side PASSED
 * while the other switched, which is a different board and was previously invisible. */
const SWITCH_LOOKUP_MISS = { medi: 0, sd: 0, names: Object.create(null), where: [] };   /* species mc_key had no row for; the raw id is tried and the body is usually skipped */
/* 2026-08-25, MEASURE — AND IT NAMES THE BODY. `medicham 3` is unactionable; `palafinhero 3` is a
 * one-line fix. A count with no handle on it is the same failure as a silent default. */
/* 2026-08-25, MEASURE — DOES `switch N` NAME THE BODY THIS HARNESS MEANT, AFTER THE PARTY HAS MOVED?
 *
 * `sim/battle-actions.ts:118-132` — a switch SWAPS PARTY INDICES. `side.pokemon` is the index space
 * `switch N` addresses (`Side.chooseSwitch`: `const targetPokemon = this.pokemon[slot]`), and every
 * switch already performed in that game has permuted it. An index captured before a switch does not
 * name the same body afterwards, so a harness that CACHED one would accuse the engine of a missing
 * switch that the harness itself misaddressed. ENGINE named this as the live suspect behind the two
 * remaining "a chosen switch the authority performs and medicham2 does not" games.
 *
 * IT IS NOT A GUESS EITHER WAY NOW. `str()` reads the index back off the authority's own array on
 * every switch it sends and checks three things against `chooseSwitch`'s own rule: the slot holds the
 * intended species, it is a BENCH slot (`slot >= active.length`, which is the line Showdown refuses
 * on), and the party is recorded as PERMUTED-or-not so the denominator is visible. `misaddressed`
 * must read 0; `after_permutation` must be LARGE, or the run never met the hazard and proves nothing.
 *
 * MEDI_SWITCH_BY_INITIAL_INDEX=1 IS THE POSITIVE CONTROL. It resolves the index against the party
 * order snapshotted at the first choice of the game — exactly the cached-index bug hypothesised —
 * so the counter can be shown RED. A probe that has never been red is a probe with no evidence. */
const SWITCH_BY_INITIAL_INDEX = process.env.MEDI_SWITCH_BY_INITIAL_INDEX === '1';
const SWITCH_ADDRESSING = { sent: 0, after_permutation: 0, misaddressed: 0, first_bad: null };

/* ================== WHICH BODY OF THE ROSTER IS THIS — ONE DOOR, BOTH ENGINES ==================
 *
 *   rosterKey(x)   -> 'morpeko'  for a medicham2 body OR a showdown Pokemon, renamed or not
 *
 * THE QUESTION IS "WHICH OF THE FOUR BODIES THIS SIDE BROUGHT", AND IT IS NOT "WHAT IS THIS CALLED".
 * The two agree for an ordinary body and stop agreeing the moment something renames one, which in
 * this format is seven abilities: Disguise, Forecast, Hunger Switch, Illusion, Imposter, Stance
 * Change and Zero to Hero. `tests/test-roster-identity.js` derives that membership from
 * data/tags.json and prints it, so an eighth arrives as a new arm rather than as silence.
 *
 * THIS IS THE FIFTH INSTANCE OF ONE CLASS. `engine/mc_key.js`'s header lists the other four — a
 * builder keying `venusaurmega` against `venusaur-mega`, `MC.mons[norm(x)]` in four files,
 * `buildMon(s.toLowerCase())` in tests/test-engine-diff.js, a bare `globalThis.` prefix in eight
 * more. Every previous fix was A LIST OF WRONG SPELLINGS and two of the four walked past a list that
 * was already written, so this is not another entry on that list: it is the one accessor, and the
 * probe RENAMES A BODY AND ASKS FOR THE ANSWER instead of matching text.
 *
 * WHAT EACH SIDE'S STABLE IDENTITY ACTUALLY IS — MEASURED, NOT READ, AND THE FIRST ANSWER WAS WRONG:
 *   showdown   `Pokemon#set.species` — THE PACKED SET, which nothing in the simulator rewrites.
 *   medicham2  `_switchKey`, stamped by `buildPair` from `id(sp.id)` and by nothing else;
 *              `name` is display state that `formeSwap` and the Hunger Switch rename rewrite.
 *
 * `baseSpecies` WAS THE FIRST ANSWER AND IT IS NOT STABLE. `Pokemon#formeChange(species, effect,
 * isPermanent)` writes `this.baseSpecies = rawSpecies` when `isPermanent` — and MEGA EVOLUTION IS
 * PERMANENT. Measured directly rather than argued:
 *
 *     before mega   set.species Tyranitar   baseSpecies tyranitar       species tyranitar
 *     after  mega   set.species Tyranitar   baseSpecies tyranitarMEGA   species tyranitarmega
 *
 * The old code read `id(q.species.id)` on this side and `id(x.name)` on medicham's, and those two
 * AGREE through a mega because both engines rename together — which is why megas were never the
 * visible half of this bug. Keying showdown on `baseSpecies` broke exactly that agreement: the
 * pinned 961-game run went from 22 parted games to 227 and from 3 unmirrorable switches to 70, with
 * `slot 1 holds tyranitar, which showdown does not have under that name` as its first witness. The
 * run is the only reason this is not in the tree. `tests/test-roster-identity.js` now carries a
 * `mega` arm that fails on it in one second.
 *
 * A FALLBACK IS LOUD, NEVER SILENT. Reaching display state means one of the two stamps is missing,
 * which is precisely how this was invisible before (MEASURE, 2026-08-25: `_switchKey` read
 * `undefined` on all eight bodies of every game this instrument had ever played, and the lookup fell
 * through to `id(x.name)` without a word). The counters are printed on every run and asserted at 0.
 *
 * WHAT WALKS PAST THIS: a THIRD kind of object. The two branches are told apart by which stamp they
 * carry, so anything with neither returns null and is counted as `neither`, which is a refusal
 * rather than a guess. */
const ROSTER_KEY_FALLBACK = { sd_species: 0, medi_name: 0, neither: 0, first: null };
function rosterKey(x) {
  if (!x) return null;
  /* showdown first: a Pokemon also carries `.name` (its nickname), so testing the medicham branch
   * first would read a nickname for every authority body. */
  if (x.set && (x.set.species || x.set.name)) return id(x.set.species || x.set.name);
  if (x._switchKey) return id(x._switchKey);
  if (x.baseSpecies && x.baseSpecies.id) {
    ROSTER_KEY_FALLBACK.sd_species++;
    if (!ROSTER_KEY_FALLBACK.first) ROSTER_KEY_FALLBACK.first = 'showdown body with no set: ' + id(x.baseSpecies.id);
    return id(x.baseSpecies.id);
  }
  if (x.species && x.species.id) {
    ROSTER_KEY_FALLBACK.sd_species++;
    if (!ROSTER_KEY_FALLBACK.first) ROSTER_KEY_FALLBACK.first = 'showdown body with no set: ' + id(x.species.id);
    return id(x.species.id);
  }
  if (x.name) {
    ROSTER_KEY_FALLBACK.medi_name++;
    if (!ROSTER_KEY_FALLBACK.first) ROSTER_KEY_FALLBACK.first = 'medicham body with no _switchKey: ' + id(x.name);
    return id(x.name);
  }
  ROSTER_KEY_FALLBACK.neither++;
  return null;
}
const INITIAL_PARTY = new WeakMap();
let ALIGN_MOVED = 0;   // a stat the alignment had to CHANGE — must be 0 outside the hpBoost arms
const ALIGN_MOVED_WHO = new Map();   // ...and WHICH body, because a bare 21 cannot be acted on
/* ROADMAP #31 — THE EVOLUTION COUNTERS, PRINTED EVERY RUN AND A ZERO CALLED OUT LOUDLY. Mega has
 * already passed an at-least-one check in this project while firing on 56% of the sides it should
 * have, so a bare count is not enough and a RATE with a real denominator is reported beside it. Both
 * engines are counted SEPARATELY off their own streams: if the driver's choice reached one engine and
 * not the other, one number would be zero while the other was not, and a single merged counter could
 * not say which. */
let MEGA_CHOICES = 0, MEGA_SIDES_CAPABLE = 0, MEGA_SIDES_EVOLVED = 0;
let MEGA_MEDI = 0, MEGA_SD = 0, MEGA_SLOT_A = 0, MEGA_SLOT_B = 0;
let MEGA_PREFER_B = false;   // alternates, so the driver does not mega out of the left slot every time
/* DERIVED ONCE, AND ALLOWED TO THROW. A `catch { return false }` here would keep every mega stone on
 * every team and part the streams on line one of a quarter of the games, while the report cheerfully
 * said `mega stones stripped: 0` — the exact shape names.js was written to remove. */
const STONES = N.byTag('items', 'megaStone');
const isStone = it => STONES.has(id(it));

/* THE SPECIES KEY COMES FROM THE PROJECT'S OWN RESOLVER, and it used to be `id(p.species)` — which
 * strips hyphens, so `Floette-Eternal` became `floetteeternal` and data/engine-data.js keys it
 * `floette-eternal`. Every such body counted as UNBUILDABLE and left the run silently. That mattered
 * most for exactly the bodies this pass is about: Floette-Eternal is ~10.5% of ladder sides and megas
 * 96.1% of the time. `mcKey` is the one thing allowed to know how that table is keyed
 * (tests/test-mc-key.js), and it is read out of the RELEASE so the photograph rule holds. */
const { mcKey } = REL.require('engine/mc_key.js');
/* A SHEET WITH NO NATURE FALLS BACK TO SERIOUS AND IS COUNTED. Older store rows and any set inferred
 * from a closed-sheet replay carry none, and a silent fallback would leave the instrument HALF
 * NATURED with nobody able to say which half. Printed beside the other declared gaps every run. */
const NATURE_COUNT = { declared: 0, fallback: 0, forced_flat: 0 };
/* AND THE FALLBACKS ARE NAMED, not just counted. The first run of this reported 96 of 4,544 bodies
 * falling back and the frozen store carries a dex-valid nature on 173,784 of 173,784 — so the 96 came
 * from somewhere else, and an unexplained fallback is a silent default wearing a number. They are the
 * HARNESS'S OWN hand-written fixtures (the directed scenarios, the planted proofs, the Knock Off
 * arms), which declare species/item/ability/moves and no nature. Naming them is what makes that a
 * receipt instead of a guess. */
const NATURE_FELL_BACK = new Map();
function natureFor(p) {
  if (NATURE_MODE === 'serious') { NATURE_COUNT.forced_flat++; return 'Serious'; }
  const n = p && p.nature ? String(p.nature) : '';
  /* THE AUTHORITY DECIDES WHETHER A STRING IS A NATURE, not a shape test and not this file's own list.
   * `natureShift` answers {plus:null,minus:null} for a NEUTRAL nature and for a typo alike, so asking
   * it would count "Modset" as declared and flatten the body in silence. */
  const known = n && dex.natures.get(n);
  if (known && known.exists) { NATURE_COUNT.declared++; return known.name; }
  NATURE_COUNT.fallback++;
  const who = id((p && p.species) || '?') + (n ? ' (nature "' + n + '" is not one the dex knows)' : ' (no nature declared)');
  NATURE_FELL_BACK.set(who, (NATURE_FELL_BACK.get(who) || 0) + 1);
  return 'Serious';
}
/* The level-50 line under a named nature, no SP — see the block header for why both engines must
 * compute the same one INDEPENDENTLY. The arithmetic is the ENGINE'S (`M.natureL50`, read out of the
 * frozen release) rather than a second copy written here: the chart and the fixed-point multiply are
 * FACTS, and this file having its own would be the exact defect CLAUDE.md names. What is NOT shared is
 * Showdown's side, which computes from the SET and knows nothing about this line — that is the
 * disagreement `alignStats` exists to catch, and it is why ALIGN_MOVED must still read 0. */
function flatL50(bs, nature) { return M.natureL50(bs, nature || 'Serious'); }
/* THE SAME LINE WITH THE SPREAD ON IT, out of the FROZEN release and never re-typed here. This file
 * used to carry its own copy of the stat formula and its buildPair header records having stopped;
 * a second copy is the two-files-one-fact breach CLAUDE.md names. */
function spreadL50(bs, sp, nature) { return M.spreadL50(bs, sp || null, nature || 'Serious'); }
/* A RELEASE FROZEN BEFORE THE SPREAD WORK HAS NO `spreadL50`, AND IT MUST FAIL BY NAME.
 *
 * Without this the run dies with a bare `TypeError: M.spreadL50 is not a function` four frames deep
 * inside `freshBodies` — which sends the next reader into the ENGINE looking for a missing function,
 * when the actual answer is that they named an older release id. That cost a pass. Same treatment as
 * the `rngStreams` guard above and for the same reason: the failure should say what to do.
 *
 * NOT a silent fallback to `natureL50`. That would run every body blank again while the artifact
 * claimed a spread, which is the exact silent-default failure this file is built around. */
if (typeof M.spreadL50 !== 'function') {
  throw new Error('The frozen engine in release ' + REL.id + ' predates the SP spread work (no '
    + 'spreadL50 export), so every body would be built blank while this file believes it filled a '
    + 'spread. Cut a release from a tree that has it — `node engine/engine_release.js cut "why"` — '
    + 'and pass that id to --release.');
}

/* HOW MANY BODIES A PAIR BRINGS. Named because the CLOSET declaration has to cite it: a carrier
 * sitting past this index is on the sheet and never enters the battle, and a reader cannot judge the
 * exclusion without knowing where the battle stops. One constant, two readers. */
const PAIR_BODIES = 4;
function buildPair(sheet, opts) {
  const hpx = (opts && opts.hpBoost) || 1;
  const strip = !!(opts && opts.stripStones);
  /* HOW MANY BODIES THE PAIR KEEPS. FOUR is the number every caller before 2026-08-10 wanted and it
   * stays the default, so nothing that reads this function changes. `max: 6` exists for ROADMAP #143,
   * where Showdown's own `TeamValidator` is the acceptance authority and it refuses a four-body team
   * outright — *"You must bring at least 6 Pokemon (your team has 4)"* — so a team that is only ever
   * four bodies long cannot be validated at all, whatever is on it. The battle still brings four
   * (`team 1234`); the other two sit on the sheet so the AUTHORITY can pass judgement on it. */
  const cap = (opts && opts.max) || PAIR_BODIES;
  const picked = [];
  for (const p of sheet) {
    if (picked.length >= cap) break;
    if (!p || !p.species) continue;
    /* ONE UNRESOLVABLE SPECIES OUT OF 7,635 TEAMS KILLED THE WHOLE RUN, and the bug is that this line
     * assumed a return where the contract is a THROW. `mcKey` is deliberately strict — engine/mc_key.js
     * says "A MISS MUST BE DECLARED", because a lookup that quietly answers something plausible is the
     * shape of every expensive bug this project has had — and a caller that genuinely expects misses
     * passes `{ mayMiss: '<why>' }`. The `|| id(p.species)` fallback below was written as if a miss
     * returned null, so it never ran: `mcKey` threw first and the process died on
     * `LookupMiss: MC.mons: no entry for "florgesblue"`, taking an 80-game re-measure with it.
     *
     * DECLARING THE MISS IS THE FIX, NOT LOOSENING mcKey. The strictness is right and stays. What this
     * caller actually wants is "skip a body I cannot build", which the three guards immediately below
     * already express — `buildMon` returning null, the dex not knowing the species, and no legal move
     * surviving all funnel into MONS_UNBUILDABLE. A species mc_key cannot resolve reaches them and is
     * counted there, exactly like every other unbuildable body.
     *
     * COUNTED SEPARATELY ANYWAY, because "mc_key had no key and the raw id happened to work" and "the
     * key resolved cleanly" are different facts and the artifact should not blur them. A cosmetic
     * forme is the expected member here — Florges' colours, Sinistcha's masterpiece — and if this
     * counter starts climbing on ORDINARY species that is a broken alias table, not a rare team. */
    let key = mcKey(p.species, { mayMiss: 'a pool team may carry a forme MC.mons has no row for; the '
                                        + 'body is skipped and counted, never silently substituted' });
    if (!key) { MCKEY_MISSED++; key = id(p.species); }
    const b = M.buildMon(key, {});
    if (!b) { MONS_UNBUILDABLE++; continue; }
    const sp = dex.species.get(key);
    if (!sp || !sp.exists) { MONS_UNBUILDABLE++; continue; }
    let item = id(p.item || '');
    if (item && isStone(item)) { if (strip) { STONES_STRIPPED++; item = ''; } else STONES_KEPT++; }
    if (item && !dex.items.get(item).exists) item = '';
    const moves = [];
    for (const mv of (p.moves || [])) {
      const dm = dex.moves.get(id(mv));
      if (!dm || !dm.exists) continue;
      if (moves.some(x => x.id === dm.id)) continue;
      moves.push(dm);
    }
    if (!moves.length) { MONS_UNBUILDABLE++; continue; }
    let ability = id(p.ability || '');
    const legal = Object.values(sp.abilities || {}).map(id);
    if (!ability || !legal.includes(ability)) ability = legal[0] || '';
    b.moves = moves.map(m2 => m2.id);
    b.item = item;
    b.ability = ability;
    b._ident = sp.baseSpecies || sp.name;
    /* THE SWITCH KEY IS STAMPED AT BUILD TIME AND NEVER CHANGES, and that is the whole point.
     *
     * The driver picks a bench member as `switchTo: id(q.species.id)` — Showdown's species id. The
     * Showdown side then finds it with `id(q.species.id)` and the medicham side found it with
     * `id(x.name)`. Those agree for an ordinary body and STOP AGREEING THE MOMENT A BODY IS RENAMED,
     * which this engine started doing on 2026-08-07: Disguise renames a busted Mimikyu, Zero to Hero
     * renames Palafin, and Hunger Switch is about to flip Morpeko every turn. After the rename
     * `id(x.name)` is `mimikyubusted` while `switchTo` still says `mimikyu`, so THAT BODY CAN NEVER BE
     * SWITCHED TO AGAIN.
     *
     * AND BOTH SIDES FAIL SILENTLY AND INDEPENDENTLY. The medicham branch answers `pass` when `find`
     * returns undefined; the Showdown branch answers `pass` when `findIndex` returns -1. Nothing was
     * counted, so one engine switching while the other passed produced a different board and no
     * evidence — this project's signature failure, in the instrument rather than the engine.
     *
     * `_switchKey` is set from the SAME expression the driver uses to name the candidate, so the two
     * sides ask one question. It is deliberately NOT `b.name`, which is display state and mutable. */
    b._switchKey = id(sp.id || sp.name);
    /* THE SHEET'S OWN NATURE, resolved ONCE and handed to BOTH sides — never resolved twice, because
     * two resolutions of "what nature is this" is how one side ends up Serious and the other Modest
     * while every counter reads healthy. */
    const nature = natureFor(p);
    /* THE SPREAD IS RESOLVED ONCE AND CARRIED TO BOTH SIDES, exactly as the nature is and for the
     * identical reason: two resolutions of "what spread is this" is how one engine ends up with a
     * different Pokemon from the other while every counter reads healthy. `evs` below and `spTeam`
     * on the medicham spec are the SAME OBJECT'S numbers, mapped once here — the key-name translation
     * lives at this one site because a translation table in two files is the same breach one level
     * down. */
    const evs = spreadFor(picked.length, sp);
    const spTeam = { at: evs.atk, df: evs.def, sa: evs.spa, sd: evs.spd, sp: evs.spe };
    picked.push({ medi: b, spec: { key, moves: b.moves.slice(), item, ability, hpx, bs: sp.baseStats,
                                   nature, sp: spTeam, ident: sp.baseSpecies || sp.name,
                                   /* 2026-08-25, MEASURE — CARRIED ON THE SPEC, BECAUSE THE BODY IT WAS
                                    * STAMPED ON IS NOT THE BODY THAT PLAYS. `playGame` rebuilds every
                                    * side through `freshBodies`, which reads THIS OBJECT and never saw
                                    * `b._switchKey` — so the key above was undefined on all eight
                                    * bodies of every game ever played by this instrument and the
                                    * medicham lookup has always fallen through to `id(x.name)`, the
                                    * mutable display state the comment above says it must not use.
                                    * Named in CLAUDE.md as the cause of Morpeko's divergences and
                                    * still live tonight, measured: `freshBodies(...).map(b=>b._switchKey)`
                                    * reads `[undefined x4]`. One source, two readers. */
                                   switchKey: id(sp.id || sp.name) }, sd: {
      name: sp.name, species: sp.name,
      /* GENDER IS 'N' ON BOTH SIDES. Showdown writes the gender into the `|switch|` details field
       * (`Incineroar, L50, F`) and medicham2 has no gender at all, so a declared gender would part
       * the streams on line one of every game. It is a CONTROL, and its cost is that Attract,
       * Rivalry and Cute Charm are not exercised — stated, not hidden. */
      gender: 'N', level: 50, item: item ? dex.items.get(item).name : '',
      ability: ability ? dex.abilities.get(ability).name : '',
      moves: moves.map(m2 => m2.name), nature,
      evs,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    } });
  }
  if (picked.length < cap) { TEAMS_UNBUILDABLE++; return null; }
  return picked;
}

/* ---- THE SPREAD — WILL, 2026-08-12 -------------------------------------------------------------
 *
 * *"i thought the whole point was we invent teams that we know every stat of so nothing can drift"*,
 * then *"we can yoink moves, we just need to give them our stat spreads"*.
 *
 * THIS FILE RAN EVERY BODY AT `evs: {0,0,0,0,0,0}` — not a guessed spread, NO spread. An open team
 * sheet reveals species, item, ability, moves, nature, gender and level and NOT the spread; every
 * stored sheet reads `evs: null`, 173,784 of 173,784 bodies. So the field was filled with zeros and
 * the declared gap said it always would be.
 *
 * THAT DOES NOT CAUSE A SINGLE DIVERGENCE — both engines get the same zeros — IT HIDES THEM. The
 * comment above this function has said so since 2026-08-08 and nobody acted on it: *"with every body
 * flat AND Serious, 91.4% of legal species share a base Speed with some other species, so THE RIG
 * MANUFACTURED SPEED TIES and almost never exercised a real speed differential. The instrument was
 * testing turn order in the one configuration where turn order is hardest to get wrong."*
 *
 * Will's fix keeps everything the sheet actually declares and supplies only the field it does not.
 *
 * THE ARITHMETIC IS THE AUTHORITY'S AND IT WAS DERIVED RATHER THAN TAKEN FROM OUR OWN DOCS.
 * Champions overrides `statModify` (`data/mods/champions/scripts.ts:10`) with two branches, and
 * `getRuleTable('gen9championsvgc2026regmb').has('levelclausemod')` is FALSE — the format carries
 * `adjustlevel` — so Reg M-B takes the else branch: `hp -> stat + evs + 75`, everything else
 * `stat + evs + 20`, with the nature multiply applied AFTERWARDS. That is flat stat points, which is
 * exactly medicham2's SP model, so one spread means the same thing to both engines and
 * `align_had_to_move_a_stat` must stay 0.
 *
 * ASSERTED, NOT ASSUMED — `assertSpreadSemantics()` below. The mainline branch is live code one rule
 * away, and a regulation that adds `levelclausemod` would silently reinterpret every spread as
 * mainline EVs: same field, different arithmetic, no error anywhere. That is the shape this project
 * keeps paying for, so it fails loudly instead.
 *
 * DETERMINISTIC FROM THE BODY'S INDEX, so the same pool replays to the same stats. Not random, not
 * per-species — the index is what makes it reproducible AND what spaces the Speeds apart. */
const SP_BUDGET = 66, SP_CAP = 32;
/* Four descending Speed investments, one per slot on a side. The gaps are wide because the point is
 * to break ties: two bodies sharing a base Speed now differ by at least 10 stat points, which no
 * in-battle multiplier can close back to exactly equal. The remainder goes to the offensive stat the
 * body is actually built around, so the spread is not merely legal but plausible. */
const SPE_LADDER = [SP_CAP, 22, 11, 0];
function spreadFor(index, sp) {
  const spe = SPE_LADDER[index % SPE_LADDER.length];
  const left = SP_BUDGET - spe;
  const bs = sp.baseStats || {};
  /* The higher attacking stat takes the rest, capped; anything over the cap falls to bulk. A body
   * with no meaningful attack still spends its points, because an unspent budget is a third silent
   * assumption and this change exists to remove those. */
  const physical = (bs.atk || 0) >= (bs.spa || 0);
  const main = Math.min(SP_CAP, left);
  const rest = left - main;
  /* NOTHING GOES INTO HP, AND THAT IS MEASURED RATHER THAN STYLISTIC. Champions' else-branch is
   * `if (statName === 'hp') return stat + evs + 75`, so Showdown DOES add HP investment — while
   * medicham2's level-50 line has no HP term at all: `hp: floor((2*bs.hp+31)*50/100) + 50 + 10`.
   * Staged both ways before this line was written: a Garchomp given 34 HP points reads 217 on the
   * authority and 183 here, a silent 34-point divergence on every body, on the one stat that decides
   * whether anything dies. Every OTHER stat agrees to the digit — Adamant + 32 Atk reads +35 on both,
   * which is also the proof the nature multiply lands AFTER the addition. So the budget goes to Sp.
   * Def instead, and the day medicham2's line grows an HP term this comment is the reason to revisit. */
  const e = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe };
  e[physical ? 'atk' : 'spa'] = main;
  /* EVERY STAT IS CAPPED, AND `rest` INTO ONE STAT WAS AN ILLEGAL BUILD ON EVERY FOURTH BODY.
   *
   * This read `e.spd = rest` — uncapped. At `index % 4 === 3` the ladder gives 0 Speed, so `left` is
   * the whole 66-point budget, `main` takes 32, and the remaining **34 landed in Special Defence
   * against a 32 cap**. Showdown's own TeamValidator refuses it by name: *"Weavile has more than 32
   * Stat Points in Special Defense"*. One body in four, on BOTH sides, in every staged fixture and
   * every game of the whole-game differential.
   *
   * It is mine, from the spread work earlier tonight, and it is exactly the failure that work was
   * meant to end: the rig was testing a board the game cannot produce. The blank-spread version was
   * legal and unrealistic; this was realistic and ILLEGAL, which is worse, because a validator would
   * reject the team while the differential happily compared two engines on it.
   *
   * Spilling to Defence rather than growing the ladder keeps every existing arm byte-identical for
   * indices 0-2, so only the broken slot moves. */
  let spill = rest;
  for (const stat of ['spd', 'def']) {
    const take = Math.min(SP_CAP, spill);
    e[stat] = take;
    spill -= take;
  }
  /* A SPREAD THAT CANNOT BE BUILT MUST NOT REACH A GAME. Cheap, once per body, and it fails loudly
   * rather than letting the authority reject the team 1,200 lines later where it reads as a harness
   * fault. `spill` non-zero means the budget outgrew what this shape can place. */
  const total = e.hp + e.atk + e.def + e.spa + e.spd + e.spe;
  const over = Object.entries(e).filter(([, v]) => v > SP_CAP);
  if (spill || over.length || total !== SP_BUDGET) {
    throw new Error('spreadFor(' + index + ') built an ILLEGAL spread: ' + JSON.stringify(e)
      + '  total=' + total + '/' + SP_BUDGET
      + (over.length ? '  over the ' + SP_CAP + ' cap: ' + over.map(([k, v]) => k + '=' + v).join(',') : '')
      + (spill ? '  unplaced=' + spill : '')
      + '. Champions allows ' + SP_BUDGET + ' points with a ' + SP_CAP + ' cap per stat.');
  }
  return e;
}
/* THE BRANCH GUARD. Called once at startup; a format that changes underneath this stops the run
 * rather than producing two engines' worth of nearly-right stats. */
function assertSpreadSemantics() {
  let rt = null;
  try { rt = dex.formats.getRuleTable(dex.formats.get(CS.FORMAT)); } catch (e) { rt = null; }
  if (!rt) {
    console.error('CANNOT VERIFY THE SPREAD SEMANTICS — the rule table for ' + CS.FORMAT
      + ' could not be read. A spread whose arithmetic cannot be checked is not a spread.');
    process.exit(2);
  }
  if (rt.has('levelclausemod')) {
    console.error('THE FORMAT NOW CARRIES `levelclausemod`, so Champions\' statModify takes the '
      + 'MAINLINE branch and `evs` mean EV points rather than flat stat points. Every spread this '
      + 'file writes would be reinterpreted silently. Fix spreadFor() against the new branch before '
      + 'running — do not delete this check.');
    process.exit(2);
  }
}
assertSpreadSemantics();

/* ONE PLACE THAT TURNS A PAIR SPEC BACK INTO LIVE MEDICHAM BODIES. `battleInit` takes the team BY
 * REFERENCE and the battle then damages it, boosts it, eats its item and reverts its mega, so every
 * arm that plays or measures must start from a fresh build rather than from the previous arm's
 * wreckage. Written once because two copies of "how do I get a body" would drift. */
function freshBodies(pair) {
  return pair.map(x => {
    const b = M.buildMon(x.spec.key, {});
    if (!b) return null;
    b.moves = x.spec.moves.slice(); b.item = x.spec.item; b.ability = x.spec.ability;
    /* THE LEVEL-50 LINE UNDER THE SHEET'S NATURE, so the two engines are the same Pokemon rather than
     * one being copied onto the other — see the buildPair header. `sp.baseStats` is the DEX's, and it
     * was MEASURED to equal data/engine-data.js's `bs` on all 318 rows before this was wired, which is
     * what makes medicham2's own mega stat swap (megaEvolveNow computes `megaL50 + (st - baseL50)`)
     * come out at a delta of exactly zero and land on Showdown's recomputed numbers.
     *
     * `_nature` IS STAMPED ON THE BODY AND THAT IS NOT COSMETIC. The mega swap recomputes BOTH of its
     * anchors from base stats, so it has to apply the same shift; without this the mega lands short by
     * (mul - 1) x (mega - base) on exactly the stat the nature moved, mid-turn, with no seam left to
     * re-align in. tests/test-nature-differential.js PART 4 is that case, staged. */
    if (x.spec.bs) { b._nature = x.spec.nature || 'Serious'; b.st = spreadL50(x.spec.bs, x.spec.sp || null, b._nature); b.curHP = b.st.hp; }
    /* THE PROTOCOL IDENTIFIER IS SHOWDOWN'S NICKNAME, AND SHOWDOWN DEFAULTS IT TO `baseSpecies`.
     *
     * A set whose name equals its species is renamed to the BASE species when the battle loads it, so
     * a Floette-Eternal is `|switch|p1a: Floette|Floette-Eternal, L50|` — the identifier is the base,
     * the DETAILS field is the forme. medicham2 has no nicknames and keyed the identifier off the
     * body's own name, so every non-base forme parted the streams on its own switch line.
     *
     * IT WAS INVISIBLE UNTIL THIS PASS and that is worth recording: `id(p.species)` strips hyphens, so
     * `Floette-Eternal` looked up as `floetteeternal`, data/engine-data.js keys it `floette-eternal`,
     * and every forme in the format counted as UNBUILDABLE and left the run. Fixing the key surfaced
     * the naming difference on 35 games in one run — a class that had been there all along behind a
     * silent drop.
     *
     * STAMPED BY THE HARNESS AND NOT BY THE ENGINE, deliberately: this file AUTHORS both sides' team
     * representations, and `baseSpecies` is the dex's own field rather than string arithmetic on a
     * forme name. medicham2 keeps its own convention when nobody stamps one. */
    if (x.spec.ident) b._ident = x.spec.ident;
    /* 2026-08-25 — AND THE SWITCH KEY, which buildPair stamps and this used to drop. See the spec. */
    if (x.spec.switchKey) b._switchKey = x.spec.switchKey;
    /* HP BOOST — opt-in, staged measurements only, and it exists for one reason: A DAMAGE RATIO
     * CANNOT BE READ OFF A BODY THAT DIED. Showdown clamps the recorded HP loss at the target's max,
     * so the first run of the Knock Off arms read 135 / 135 / 135 — three different multipliers all
     * reported as the same number, which is the interaction matrix's `saturated` bucket arriving in a
     * new instrument. Inflating the pool changes no multiplier and no rule; alignStats copies these
     * values onto the Showdown bodies so both engines get the same pool. Same fix, same reason, as
     * tests/test-game-diff.js's opts.hpBoost. */
    if (x.spec.hpx && x.spec.hpx !== 1) { b.st.hp = Math.round(b.st.hp * x.spec.hpx); b.curHP = b.st.hp; }
    return b;
  });
}

/* ---- THE DRIVER: COVERAGE-SEEKING, NOT SKILFUL ---------------------------------------------------
 * §3.3: at each decision prefer the legal action exercising the census mechanic furthest below its
 * floor; break ties toward the least-exercised entity. It will click Quash into an empty slot and
 * Trick Room on turn six, and that is correct — nobody is scoring these games.
 *
 * LEGALITY COMES FROM SHOWDOWN'S OWN REQUEST, not from a rule reimplemented here. `activeRequest`
 * already knows about Choice locks, Encore, Taunt, Disable, Torment, recharge and trapping, and it is
 * the authority by ADR-002. A driver that guessed legality would test positions the game cannot
 * reach, and a divergence in one of those means nothing.
 *
 * FEATURE OMISSION IS THE DRIVER'S JOB AND IS SCOPED PER CONFIGURATION. `omit-protect` forbids the
 * CLICK; `pair-protect-bust` requires it and then aims the buster into it. Both run in one swarm. A
 * global ban would silently destroy every pairing configuration while looking like it worked — and
 * it has to be the click rather than the team, because only 84 of 7,256 real teams carry no Protect. */
const FEATS = SWARM.featureSets();
/* Printed before it is used, per the standing rule: a derived set that over-matches is invisible
 * until somebody looks at what it matched. */
const DRIVER_AXES = {
  'omit-protect':      { ban: FEATS.protect },
  'omit-priority':     { ban: FEATS.priority },
  'omit-weather':      { ban: FEATS.weather },
  'omit-spread':       { ban: FEATS.spread },
  'pair-protect-bust': { prefer: new Set([...FEATS.protect, ...FEATS.protectBust]) },
  'pair-redirect-priority': { prefer: new Set([...FEATS.redirect, ...FEATS.priority]) },
  'pair-speedctrl':    { prefer: FEATS.speedCtrl },
};
let BAN_FALLBACKS = 0;   // a config banned everything this body could click — LOUD, never silent
/* ROADMAP #81 WIRE 7 — A REQUEST THIS DRIVER CANNOT BUILD A CANDIDATE FOR. Showdown's request for a
 * RECHARGING body carries one pseudo-move, `recharge`, which is not a dex entry — `dex.moves.get`
 * says it does not exist, every candidate was dropped, and `trapped: true` left no switch either. The
 * driver then answered `pass`, Showdown rejected the whole choice (`Can't pass: Your Raichu must make
 * a move`) and the game THREW. It cost the WIRE 7 arm of the release ladder, which refuses to publish
 * when the verbose stream and the artifact disagree about how many games ran — the guard working.
 * The fallback is `move 1`, which is what Showdown expects for a locked or recharging body, and it is
 * COUNTED because a silent one looks exactly like a working feature. */
let FORCED_FIRST_SLOT = 0;
/* ---- THE AUTHORITY REFUSED WHAT THE HARNESS SAID, AND NOBODY HEARD IT ---------------------------
 *
 * THE NOUN IS A `battle.choose()` CALL THAT SHOWDOWN RETURNED FALSE FOR. Not a game, not a turn, not
 * a slot — one call to the authority that the authority would not take. It is counted at EVERY
 * choose() in the play loop, so "0 refusals" is a claim about the whole run and not about the one
 * path somebody remembered to instrument.
 *
 * WHY IT HAD TO EXIST. `playGame` threw on a rejected MOVE and DISCARDED the return value on the
 * forced-switch path, so a replacement Showdown would not accept was swallowed whole: no protocol
 * line (a refused choice emits none), no exception, `requestState` stuck on `switch`, and the next
 * turn's guard reporting "showdown stopped asking for a move" — this instrument MANUFACTURING a
 * divergence and filing it against the engine. That is the repo's signature failure exactly: a
 * capability absent while everything reports success.
 *
 * IT BOTH COUNTS AND THROWS, and the two are not redundant. The THROW is what stops the game: past a
 * refusal the two engines are on different boards and every later line is the harness talking to
 * itself, so continuing would publish fiction — and `playGame`'s catch already turns a throw into a
 * THREW verdict, which is counted, printed and never dropped. The COUNT is what survives the throw:
 * module-level, so the run summary and the artifact can both assert 0 across a whole corpus rather
 * than trusting that nobody swallowed the exception. */
const CHOICE_REFUSED = { n: 0, first: '' };
function refusedChoice(sd, input, err) {
  CHOICE_REFUSED.n++;
  const what = sd + ' "' + input + '": ' + (err || '?');
  if (!CHOICE_REFUSED.first) CHOICE_REFUSED.first = what;
  return what;
}
/* THE NOUN HERE IS A FORCED-SWITCH SLOT — one entry of Showdown's `forceSwitch` array, on one side,
 * on one turn. Not a choice and not a game. `switched` is a slot filled by mirroring medicham2's
 * occupant; `passed` is a slot medicham2 ALSO could not fill (its body there is absent or fainted),
 * answered `pass`. `passed` is expected to be non-zero and is not a defect: Showdown's own
 * `clearChoice` allows exactly `canSwitchOut - min(canSwitchOut, canSwitchIn)` passes, which is the
 * double-KO-on-the-last-body case. A slot where medicham2 has a LIVE body and Showdown's bench holds
 * no unclaimed match is NOT counted here — it is a lookup miss and goes to SWITCH_LOOKUP_MISS.sd,
 * whose printed caption ("that side PASSED while the other switched") already says what it means. */
const FORCED_SWITCH_MIRROR = { switched: 0, passed: 0 };
/* THE THIRD ANSWER, AND IT IS NOT A DEFECT IN EITHER ENGINE OR IN THIS HARNESS.
 *
 * THE NOUN IS A FORCED SWITCH THAT COULD NOT BE EXPRESSED TO SHOWDOWN AT ALL, because the two engines
 * no longer agree about which of that side's bodies are alive. It was found by measurement and not by
 * argument: with the `claimed` set in place, 43 games produced one `p1 "pass, pass"` that Showdown
 * refused with *"You need to switch in a Pokémon to replace Liepard"* — and Liepard was FAINTED in
 * Showdown and at 139 HP in medicham2 ON TURN 1. The boards had already parted; no answer to that
 * request reproduces medicham2's placement, because medicham2's placement does not exist on
 * Showdown's board.
 *
 * WHY IT MUST NOT THROW. `playGame`'s catch turns a throw into the verdict THREW, which this file
 * defines as *"a fact about the instrument"*. Labelling a real engine divergence as an instrument
 * failure is a misattribution, and a worse one than the bug being fixed here — it would move genuine
 * findings into the harness's error column. The game is STOPPED with a named end reason instead, and
 * the comparator then reports the EARLIER, real divergence that caused the parting, exactly as it
 * would have if the forced switch had never come up.
 *
 * WHY IT MUST NOT BE FOLDED INTO CHOICE_REFUSED EITHER. That counter has to be assertable at exactly
 * 0 to be worth anything. A counter that is allowed to be non-zero for a good reason is a counter
 * nobody can gate on — which is how "one of the two known failures" happened. Two nouns, two
 * counters, and only one of them is a defect. */
const MIRROR_IMPOSSIBLE = { n: 0, first: '' };
/* ROADMAP #290 — WHEN A SPEED READING THREW, AND WHY IT IS NOT A CATCH-AND-CONTINUE. A probe whose
 * reader throws reports "no disagreement", which is the answer an instrument must never manufacture.
 * Module-level so the summary can print it once for the whole run. */
const SPEED_THREW = { n: 0, first: '' };
function failedSpeedRead(what, e) {
  SPEED_THREW.n++;
  if (!SPEED_THREW.first) SPEED_THREW.first = what + ': ' + String((e && e.message) || e).slice(0, 120);
}

/* ---- WHO THE CLICK NAMED — ONE TRANSLATION, EVERY DIRECTION (2026-08-10) -------------------------
 *
 * THIS IS THE THIRD INSTANCE OF ONE ROOT CAUSE AND IT IS THE INSTRUMENT'S, NOT THE ENGINE'S.
 * Both choosers below turned a Showdown target type into TWO things: `target`, the number that goes
 * into the choice string, and `foeSlot`, the index the medicham side was handed. `foeSlot` was
 * derived as `target > 0 ? target - 1 : null` — so every NEGATIVE target, which is Showdown's own
 * numbering for a body on your OWN side, arrived at `M.playerAction(mon, id, null, field)` as NO
 * TARGET AT ALL. The choice string was perfect and the game played correctly on the authority's side;
 * only our half was blind, which is why it looked like an engine defect for as long as it did.
 *
 * MEASURED, on `move/heals-a-body-that-was-damaged-first`: Heal Pulse (`target: 'any'`, aimed at the
 * partner with `t = -2`) read DID-NOT-FIRE — Showdown put Torterra back to 123 and we left it at 38 —
 * while LIFE DEW, the same rule, the same fixture, the same turn, read FIRED-AND-BOARDS-MATCH,
 * because `target: 'allies'` hits the whole side and needs no aim. A probe handing Heal Pulse the
 * ally BODY healed 92 correctly, so the engine was never the fault.
 *
 * THE FIX IS NOT A SPECIAL CASE FOR `any`. The same translation could not aim `scripted` (Counter,
 * Comeuppance, Metal Burst) or `randomNormal` (the lock-in five) either, and both were diagnosed as
 * this driver's fault earlier in this sprint. So the click now carries an AIM — a relationship and a
 * slot — and each engine resolves it against its OWN arrays. `aimOf` reads the number the AUTHORITY
 * would receive, so it cannot disagree with the choice string by construction; there is no second
 * table of target types to keep in step.
 *
 *   target  >  0   the foe in slot target-1                 rel 'foe'
 *   target  <  0   the body in the USER'S OWN slot -target-1 — rel 'ally', or rel 'self' when that
 *                  slot is the clicker's own (`adjacentAllyOrSelf` aims at -(i+1))
 *   target === null  NOBODY WAS NAMED, and it stays nobody.
 *
 * THE LAST LINE IS LOAD-BEARING. `self`, the spread family, `randomNormal` and `scripted` all name no
 * target in the choice string, and the engine resolves each of them from the body and the board — a
 * targetless `self` heal to its user (WIRE 153, deliberately restricted to `target === 'self'`), a
 * targetless `randomNormal` to the hardest-hit foe (WIRE 144). A DAMAGING click that genuinely has
 * nobody must still fail into `MEDFAILS.damagingClickWithoutTarget`, which 126 moves legitimately
 * reach. Turning "no target" into "aim at something" here would delete that signal. */
const AIM = { foe: 0, ally: 0, self: 0, none: 0, miss: 0 };
function aimOf(target, i) {
  if (target == null) return null;
  if (target > 0) return { rel: 'foe', slot: target - 1 };
  const s = -target - 1;
  return s === i ? { rel: 'self', slot: s } : { rel: 'ally', slot: s };
}
/* THE BODY, out of whichever engine's own arrays the caller is holding — medicham2's `S.actA/actB` or
 * Showdown's `side.active`. The two are index-parallel by the same assumption `foeSlot` already made.
 * Pure: the counters are bumped at the ONE call site that dispatches a click, so a described turn and
 * a credit scope cannot inflate them. */
function aimBody(aim, own, foes, i) {
  if (!aim) return null;
  const b = aim.rel === 'foe' ? foes[aim.slot] : aim.rel === 'self' ? own[i] : own[aim.slot];
  return b || null;
}

/* ---- THE STEERING COUNTER, WHICH IS NOW TWO COUNTERS (ROADMAP #91) -------------------------------
 *
 * `COV_HITS` used to be "times an entity of this row was clicked" and it decided BOTH the coverage
 * number and the steering. A click is not a test, so it is split:
 *
 *   COV_CREDIT   times the row was OBSERVED TO ACT (or correctly not to, in its declared negative
 *                case). This is the coverage number and the primary steering key.
 *   COV_ATTEMPT  times an entity of the row was clicked or stood on the field. This is only a
 *                TIE-BREAK, and it exists so a row that cannot be witnessed does not pin the driver
 *                to it forever: without it, an uncreditable row scores 0 for ever, is always the most
 *                wanted action, and the swarm stops exploring. That would be a new silent failure
 *                introduced by the fix.
 *
 * The key is lexicographic — credit first, attempts second — so a row that has never been seen to do
 * anything always outranks one that has, which is exactly the steering the old counter destroyed the
 * moment a no-op click landed. */
const COV_CREDIT = new Map();    // census key -> times an observed effect (or a declared non-effect)
const COV_ATTEMPT = new Map();   // census key -> times an entity of it was clicked / stood
const CREDIT_KIND = new Map();   // census key -> { effect, negative, click }
/* ---- WHEN A MECHANIC IS FIRST SEEN TO ACT (2026-08-25) -------------------------------------------
 * The turn cap was 12 and nothing anywhere recorded WHICH TURN a census row was first credited on, so
 * "is 12 deep enough" could only be answered by guessing or by running longer and comparing totals.
 * Will's rule for choosing the cap is coverage, not game length — *"50 turn games where sides spam
 * protect and encores does not help us"* — and the number that decides it is the curve below: the
 * EARLIEST turn each row was ever observed to do something. If no row's earliest is past the cap, a
 * deeper cap buys repetition and nothing else.
 *
 * Purely observational: it reads the same credit events the steering already computes and changes no
 * die, no click and no board. It rides in the driver snapshot with the other credit maps, because a
 * map that did not freeze with them would carry the control arm's replays into the primary arm's
 * profile — the same silent-unfreeze bug driverSnap exists to prevent. */
const COV_FIRST_TURN = new Map();     // census key -> the EARLIEST turn index it was ever credited on
const CREDIT_BY_TURN = new Map();     // turn index -> how many credit events landed on that turn
let CREDIT_TURN_UNKNOWN = 0;          // credits that arrived without a turn index. MUST read 0.
const ATTEMPT_CAP = 1e6 - 1;
const covWant = (sec, key) => {
  let worst = Infinity;
  for (const t of COV_TARGETS) if (t.sec === sec && t.entities.has(key)) {
    const n = (COV_CREDIT.get(t.key) || 0) * 1e6
            + Math.min(ATTEMPT_CAP, COV_ATTEMPT.get(t.key) || 0);
    if (n < worst) worst = n;
  }
  return worst;
};
const bumpCredit = (key, kind, turn) => {
  COV_CREDIT.set(key, (COV_CREDIT.get(key) || 0) + 1);
  const k = CREDIT_KIND.get(key) || { effect: 0, negative: 0, click: 0 };
  k[kind]++; CREDIT_KIND.set(key, k);
  /* LOUD, NOT DEFAULTED. Every credit comes from creditTurn and creditTurn always has the turn index;
   * a missing one would quietly file real credits under turn -1 and flatten the curve toward "12 is
   * plenty", which is the comfortable answer and therefore the one to refuse to reach by accident. */
  const tn = (typeof turn === 'number' && turn > 0) ? turn : -1;
  if (tn < 0) CREDIT_TURN_UNKNOWN++;
  else {
    const prev = COV_FIRST_TURN.get(key);
    if (prev === undefined || tn < prev) COV_FIRST_TURN.set(key, tn);
    CREDIT_BY_TURN.set(tn, (CREDIT_BY_TURN.get(tn) || 0) + 1);
  }
};
const CLICKS = new Map();
/* Kept so the artifact can report how far the number moved when credit tightened. A row is "clicked
 * or present" exactly as the old counter meant it. */
const COV_TOUCHED = new Set();

/* ---- CREDITING ONE TURN ------------------------------------------------------------------------
 * Called at each turn boundary with the two boards that bracket the turn and what was in play during
 * it. Nothing here reads the protocol: the change is read off the BOARDS, in both engines, and the
 * union is used — a leaf that moved in either engine means the mechanic was in play, and a leaf that
 * moved in only one is itself the strongest possible evidence that the turn exercised something. */
const famRe = (f) => BOARD_FAMILY[f];
const LOC = /^(p[12])\.active\[(\d+)\]\./;
function changedFamilies(prev, cur) {
  const out = [];
  const push = (rows) => { for (const d of rows) {
    const m = LOC.exec(d.path);
    out.push({ path: d.path, family: BS.family(d.path),
               side: m ? m[1] : (/^p[12]\./.test(d.path) ? d.path.slice(0, 2) : null),
               slot: m ? +m[2] : null });
  } };
  push(BS.compare(prev.medi, cur.medi, null));
  push(BS.compare(prev.sd, cur.sd, null));
  return out;
}
/* Is this changed leaf inside the scope of an entity that was in play? Field-level and side-level
 * leaves are always in scope; an ACTIVE leaf must be the user's slot, the target's slot, or any slot
 * when the move hits more than one body. Abilities and items are scoped to every active slot, because
 * Intimidate moves the FOE's Attack and a carrier-only scope would never credit it. */
function inScope(chg, sc) {
  if (chg.slot == null) return true;
  if (sc.anySlot) return true;
  return sc.slots.some(s => s.side === chg.side && s.slot === chg.slot);
}
let CREDIT_TURNS = 0;
function creditTurn(play, prev, cur, turnIdx) {
  if (!prev || !cur) return;
  CREDIT_TURNS++;
  const chgs = changedFamilies(prev, cur);
  /* which families a CONNECTED move moved this turn, and where — the precondition a negative case
   * needs. Built once per turn rather than per target. */
  const connectedFams = new Map();     // family -> [{side, slot}] of the bodies aimed at
  for (const mv of play.moves) {
    if (!mv.connected) continue;
    for (const t of COV_TARGETS) {
      if (t.sec !== 'moves' || !t.entities.has(mv.id)) continue;
      for (const f of t.witness.families) {
        if (!connectedFams.has(f)) connectedFams.set(f, []);
        for (const s of mv.scope.slots) connectedFams.get(f).push(s);
      }
    }
  }
  for (const t of COV_TARGETS) {
    const w = t.witness;
    /* who put this row in play this turn, and what board scope that gives it */
    let scope = null, connectedClick = false;
    const carriers = [];
    if (t.sec === 'moves') {
      for (const mv of play.moves) if (t.entities.has(mv.id)) {
        scope = scope ? { anySlot: scope.anySlot || mv.scope.anySlot,
                          slots: scope.slots.concat(mv.scope.slots) } : mv.scope;
        if (mv.connected) connectedClick = true;
      }
    } else {
      for (const b of play.bodies) if (t.entities.has(t.sec === 'items' ? b.item : b.ability)) carriers.push(b);
      if (carriers.length) scope = { anySlot: true, slots: carriers };
    }
    if (!scope) continue;
    /* THE ATTEMPT IS RECORDED HERE AND NOWHERE ELSE. It used to be bumped inside `chooseAction`,
     * which the SCRIPTED scenarios never call — so a staged game recorded a credit of 0 AND an
     * attempt of 0, and "clicked and did nothing" was indistinguishable from "never in play". That
     * distinction is the whole content of this rule, and the red demonstration caught it. */
    COV_TOUCHED.add(t.key);
    COV_ATTEMPT.set(t.key, (COV_ATTEMPT.get(t.key) || 0) + 1);
    if (w.kind === 'no-board-leaf') {
      /* THE WEAK CLASS, AND IT IS COUNTED APART. `contact`, `sound`, `priority`, `moveClass`, a damage
       * multiplier — none of them moves a board leaf, so a connected click is the strongest evidence
       * this instrument can produce and pretending otherwise would be the opposite over-claim. */
      if (t.sec === 'moves' ? connectedClick : play.moves.some(m => m.connected))
        bumpCredit(t.key, 'click', turnIdx);
      continue;
    }
    const hit = chgs.some(c => w.families.some(f => famRe(f).test(c.family)) && inScope(c, scope));
    if (hit) { bumpCredit(t.key, 'effect', turnIdx); continue; }
    /* THE DECLARED NEGATIVE CASE. A blocking tag whose carrier stood there while a connected move
     * that moves exactly this family was aimed at it, and the family did not move on that body. */
    if (w.blocking && t.sec !== 'moves' && carriers.length) {
      const reached = w.families.some(f => {
        const aimed = connectedFams.get(f);
        if (!aimed || !aimed.length) return false;
        return carriers.some(b => aimed.some(s => s.side === b.side && s.slot === b.slot));
      });
      if (reached) bumpCredit(t.key, 'negative', turnIdx);
    }
  }
}

/* ---- ONE GAME ------------------------------------------------------------------------------------ */
const SLOTCH = ['a', 'b'];

function playGame(pairA, pairB, cfgId, seedTag, opts) {
  opts = opts || {};
  /* THE ARM IS A PARAMETER OF THE GAME, NOT OF THE MODULE (ROADMAP #88). Defaulted to the primary so
   * every existing caller — the planted proofs, the directed scenarios, the Knock Off halves — keeps
   * running under exactly the pin it was written against. */
  const ARM = opts.arm || PRIMARY_ARM;
  const armRng = ARM.mediRng();          // a FRESH sequence per game; see makeArm
  /* ---- THE AUTHORITY'S HALF OF THE MIDDLE ARM IS RESET HERE, BESIDE MEDICHAM2'S ------------------
   *
   * `ARM.mediRng()` above calls `M.midEventDice`, which clears medicham2's repeat map AND its address
   * log — once per GAME. The authority's two equivalents were cleared by the void check instead, which
   * runs once per PAIR, after both the stones-removed CONTROL game and the measured one. So:
   *
   *   - `MID_CTX_SEEN.sd` carried the control game's addresses (and, on the first game of a run, the
   *     2,000 startup uniformity contexts) into the measured game's identity check. Measured on game
   *     one as `sd=1075 me=11`. It made the check TOO LENIENT — `shared` is `meO.filter(a =>
   *     sdSet.has(a))`, so an address the authority only asked in the CONTROL game counted as
   *     agreement. Clearing it alone took low-identity voids from 11 to 210 in 797 games.
   *
   *   - `MID_NTH` is worse, because `nth` is a FIELD OF THE ADDRESS AND THEREFORE AN INPUT TO THE
   *     HASH. Every address the control game touched was left at nth=1,2,3..., the measured game's
   *     authority draws continued from there, and medicham2 started every address at 0 — so the two
   *     engines drew DIFFERENT VALUES for the same event, all game, in every game that had a control.
   *     846 of 878 unshared addresses in a 260-game run differed in `nth` and nothing else. Clearing
   *     it took void 147 -> 17 and `shared-addresses-agree` 4 -> 134 on that same sample.
   *
   * PUT AT THE TOP OF `playGame` RATHER THAN BESIDE THE MEASURED CALL, because "which of the games in
   * this pair gets a clean map" is not a question that should have an answer: the control game, the
   * planted-divergence proof and the directed scenarios are all games too, and all of them were
   * playing with an inherited index. */
  if (ARM.middle && !MID_CARRY) { MID_SD_LOG_DROPPED += MID_CTX_SEEN.sd.length; MID_CTX_SEEN.sd = []; midClearNth(); }
  const axis = DRIVER_AXES[cfgId] || {};
  const trace = [];
  /* FRESH BODIES EVERY GAME. `battleInit` takes the team BY REFERENCE and the battle then damages it,
   * boosts it, eats its item and reverts its mega. Handing the same objects to a second game starts
   * that game from the wreckage of the first — and the way it showed up is worth recording, because it
   * is this project's signature shape: the PLANTED-DIVERGENCE PROOF reported all three plants "caught
   * at line 0", which reads as a healthy comparator and was the second game's leads announcing
   * already-damaged HP against a freshly built Showdown side. A proof that passes for the wrong reason
   * is worse than one that fails. */
  const A = freshBodies(pairA), B = freshBodies(pairB);
  /* ---- THE STAT LINE AS BUILT, SNAPSHOT BEFORE `battleInit` TOUCHES ANYTHING (2026-08-08) --------
   *
   * FOUND BY `ALIGN_MOVED`, WHICH IS EXACTLY WHAT IT IS FOR, and found only at 1,998 games because the
   * body is rare: it read 0 at 267 and at 1,530 games and 21 at 1,998, IN BOTH NATURES, so it is not
   * the nature. The witness names it — 21 of 21 are DITTO:
   *
   *     Ditto  showdown 123/68/68/68/68/68     medicham 123/75/110/150/101/106   (and five more lines)
   *
   * `battleInit` applies ENTRY effects, and since 3.76.0 that includes IMPOSTER — so by the time the
   * alignment reads `A[k].st`, the medicham Ditto has already transformed and is carrying the stat line
   * of whatever it copied. Showdown's Ditto has NOT entered yet (this runs before `team 1234`), so it
   * still reads its own 68s. The alignment then wrote medicham's COPIED line onto Showdown's
   * `storedStats` AND `baseStoredStats` — the field a transform reverts to — so Showdown's Ditto was
   * permanently rebased onto another Pokemon's stats before the game began.
   *
   * THAT IS THE PAPERING-OVER THE BUILDPAIR HEADER FORBIDS, arriving by a new road. "Do the two engines'
   * Imposters copy the same thing" is a REAL QUESTION and the harness was answering it in medicham's
   * favour, silently, on every Ditto in the pool. Comparing the line AS BUILT restores the question. */
  const stAtBuild = [A, B].map(arr => arr.map(m => (m && m.st) ? Object.assign({}, m.st) : null));
  /* ROADMAP #31 — `autoMega: false`. medicham2's own policy would evolve at the first opportunity,
   * which is right for a rollout and wrong here: this driver has to issue the SAME choice to both
   * engines, so the choice is the driver's and the engine is told. An engine deciding for itself
   * beside a Showdown that was told is two different games. */
  /* ROADMAP #310 — THE LEAD-IN NEEDS THE ARM'S DICE, AND UNTIL NOW IT NEVER GOT THEM. Every other
   * draw in the game arrives through `battleTurn(S, armRng, …)` below; the entry abilities resolve
   * INSIDE `battleInit`, before that call exists. Trace samples uniformly among its eligible foes at
   * exactly that moment, so on a lead the engine had no die to read and took slot 0 while the
   * authority read the pin. `medicham2.battleInit` assigns null when this is absent, so every other
   * caller is unchanged and the fallback is counted (`MEDSEEN.traceChoiceNoDie`) rather than silent. */
  const S = M.battleInit(A, B, { trace, autoMega: false, rng: armRng });
  /* ---- MEDICHAM2 HAS ITS OWN 20-TURN HORIZON, AND ABOVE IT THE END-STATE COMPARISON IS NONSENSE ---
   *
   * `battleOver` is `S.turn >= (S.maxTurns || 20) || …`, and this driver had never set `maxTurns`. So
   * a run asked for more than 20 turns gets a medicham2 that declares the battle finished at turn 20
   * while Showdown plays on — which the end-state verdict correctly, and uselessly, calls ENDED-APART.
   *
   * MEASURED 2026-08-12 at `--turns 40`, 983 games: **943 ENDED-APART, 937 of them "ONLY medicham2
   * ended the battle"**. 96% of the run was one hard-coded default, and every one of those games had
   * no comparable final board at all. It reads exactly like a catastrophic engine disagreement and is
   * entirely the harness.
   *
   * THE FLOOR IS 20 SO NO EXISTING RUN MOVES BY A BYTE. Every published run of this file uses a cap of
   * 12, where `max(13, 20)` is the old default — so the 12-turn figures are the same measurement they
   * always were, and only the runs that were already broken change. Setting it to MAXTURNS flat would
   * have made medicham2 stop at turn 12 while Showdown continued, turning every 12-turn game into an
   * ENDED-APART: the same bug pointed the other way. */
  S.maxTurns = Math.max(MAXTURNS + 1, 20);

  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(pairA.map(x => x.sd)) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(pairB.map(x => x.sd)) });
  /* ALIGN BEFORE THE LEADS ARE ANNOUNCED. The `|switch|` line carries the body's max HP, so aligning
   * after the team-preview choice would part the two streams on the very first line.
   *
   * AND THIS IS NOW AN ASSERTION AS MUCH AS AN ACTION. Since ROADMAP #31 both engines compute the
   * same flat level-50 line (see the buildPair header), so outside the staged hpBoost arms every
   * write below must be a no-op — and a write that MOVES something is counted and printed, because a
   * silent copy is exactly how the old alignment hid a real disagreement. It has to stay for the
   * hpBoost arms, which deliberately inflate the pool so a damage ratio can be read off a body that
   * would otherwise have died. */
  for (const [side, pair, built] of [[battle.p1, pairA, stAtBuild[0]], [battle.p2, pairB, stAtBuild[1]]]) {
    for (const p of side.pokemon) {
      const k = pair.findIndex(x => id(x.sd.species) === id(p.species.id));
      if (k < 0 || !built[k]) continue;
      /* THE LINE AS BUILT — never the live body's, which `battleInit`'s entry effects have already
       * rewritten for a Ditto. See the snapshot above for what that cost. */
      const st = built[k];
      if (!(pair[k].spec.hpx > 1)) {
        if (p.storedStats.atk !== st.at || p.storedStats.def !== st.df || p.storedStats.spa !== st.sa
            || p.storedStats.spd !== st.sd || p.storedStats.spe !== st.sp || p.maxhp !== st.hp) {
          ALIGN_MOVED++;
          /* A COUNT WITH NO NAME ON IT CANNOT BE ACTED ON. `ALIGN_MOVED = 21` was published for the
           * first time on 2026-08-08 (it read 0 at 267 and at 1,530 games and 21 at 1,998, in BOTH
           * natures, so it is not the nature) and there was no way to tell WHICH body, WHICH stat, or
           * whether it was one team hit twenty-one times. The counter now carries its own witness. */
          const w = pair[k].sd.species + ' (' + pair[k].sd.nature + ')  sd '
            + [p.maxhp, p.storedStats.atk, p.storedStats.def, p.storedStats.spa, p.storedStats.spd, p.storedStats.spe].join('/')
            + '  medi ' + [st.hp, st.at, st.df, st.sa, st.sd, st.sp].join('/');
          ALIGN_MOVED_WHO.set(w, (ALIGN_MOVED_WHO.get(w) || 0) + 1);
        }
      }
      p.storedStats.atk = st.at; p.storedStats.def = st.df; p.storedStats.spa = st.sa;
      p.storedStats.spd = st.sd; p.storedStats.spe = st.sp;
      p.baseStoredStats.atk = st.at; p.baseStoredStats.def = st.df; p.baseStoredStats.spa = st.sa;
      p.baseStoredStats.spd = st.sd; p.baseStoredStats.spe = st.sp;
      const full = p.hp === p.maxhp; p.maxhp = st.hp; p.baseMaxhp = st.hp; if (full) p.hp = st.hp;
    }
  }
  battle.prng.random = ARM.random;
  battle.prng.randomChance = ARM.chance;
  /* ---- ROADMAP #220 — THE BATTLE IS BOUND HERE, NOT ONLY INSIDE THREE `BattleActions` METHODS -----
   *
   * The address builder reads its five fields off `MID_BATTLE`, and `midWrapShowdown` set that inside
   * `hitStepAccuracy`, `secondaries` and `getDamage` and NOWHERE ELSE. Every authority draw made
   * outside those three therefore had no battle in scope and was addressed `<seed>|0|any|-|-|<nth>` —
   * turn 0, no move, no target, and only the repeat index moving. That is a GLOBAL SEQUENCE wearing an
   * address, and it is the exact object ROADMAP #262 replaced the sequence design to get rid of.
   *
   * WHAT IT COST, MEASURED. `protect.onPrepareHit` is `!!willAct() && runEvent('StallMove')`, and the
   * roll behind it runs in `useMoveInner`, above all three wrapped methods. So the consecutive-Protect
   * die was two INDEPENDENT coins: medicham2 drawing `<seed>|<turn>|any|protect|<slot>|0` and the
   * authority drawing entry n of one sequence. Two independent coins on a 1/3 event disagree 4/9 of the
   * time, and because our side is a pure hash our answer at a (turn, slot) is the same in EVERY game —
   * turn 2 reads 0.3033 at p1a and 0.3099 at p2b (we always succeed) against 0.8716 at p1b and 0.3782
   * at p2a (we always fail). The `-fail` vs `-singleturn|protect` family split 129 p1a / 92 p2b in the
   * we-allow direction and 4 p1b / 4 p2a in the we-refuse direction. The fingerprint is the mechanism.
   *
   * AND IT IS NOT A MECHANIC DEFECT, WHICH IS WHY NO AMOUNT OF WORK ON THE SHIELD FOUND IT. The family
   * is 240 of 703 diverging games in the `middle` arm and **ZERO in both pinned arms over their
   * complete populations** (185/185 and 203/203) — a pin does not change `willAct()`, so a disagreement
   * that exists only where the die is a real draw is a disagreement about the DIE.
   *
   * BOUND AT INSTALL RATHER THAN AT EACH CALL SITE: this is the one line that already knows which
   * battle these dice belong to, and the wrapper above saves and restores `MID_BATTLE` around itself,
   * so binding here is what its `prevB` restores to instead of `null`. */
  MIDW.battle = MID_UNBOUND ? null : battle;
  /* THE SPEED-TIE RESOLVER IS REPLACED AS A FUNCTION, not steered through `random(m,n)` — that form is
   * also the sleep duration, a multi-hit count and a queue insertion index, and moving it would have
   * made the tie arm differ from the baseline in four ways at once. See the pin header. */
  battle.prng.shuffle = ARM.shuffle;
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }

  const bodiesSeen = [];
  let firstDiv = null, turns = 0, err = null, megaChoices = 0;
  /* WHICH TURN the protocol first parted in — 0 is the leads, before a choice was made. Recorded so
   * the state side can answer "did the parted narration still reach the same board", which needs the
   * two events located on the SAME clock. */
  let divTurn = null;

  /* ---- THE STATE COMPARISON, AT THE TURN BOUNDARY -----------------------------------------------
   * Taken at exactly the same instants as `alignAndCheck` — before turn 1, and after each turn once
   * medicham2's `battleTurn` has run its residuals and its `refill` AND Showdown has answered every
   * forced switch. That is the board the next decision is made from; see board_state.js.
   *
   * `boundaries` counts every comparison actually taken, `agreed` those where every compared leaf was
   * equal. `firstStateDiv` is the FIRST boundary that parted, kept and never overwritten — the same
   * discipline the protocol side uses, because "parted at turn 1" and "parted at turn 9" are different
   * events and a last-write-wins field would erase the distinction. */
  let boundaries = 0, boundariesAgreed = 0, firstStateDiv = null, stateShape = null;
  /* ---- THE END STATE (2026-08-12) ---------------------------------------------------------------
   * `lastBoard` is the last comparison this game took — see stateCheck. `endReason` is WHY the loop
   * stopped, recorded at the exit itself rather than inferred afterwards, because "ran out of turns"
   * and "one engine ended the battle" are different facts and an inferred one would be a guess. */
  let lastBoard = null, endReason = null;
  /* THE EARLY BOARDS, KEPT IN FULL AND NOT ONLY AS A FLAG. The whole-game rate answers "did these two
   * engines ever part"; the turn-1 rate answers "is the board the search plans from correct", and only
   * the second one is bounded, has a target of 100%, and cannot be blinded by a bimodal distribution
   * the way a median is. Each record carries the LOCATED diffs — slot, body, field, both values and a
   * magnitude bucket — because "the boards differ" is the boolean this pass exists to replace. */
  const earlyBoards = [];
  /* THE BOARD THAT BRACKETS THE TURN, KEPT WHETHER OR NOT `--state` WAS ASKED FOR (ROADMAP #91). The
   * credit rule needs the two boards either side of a turn to say whether a mechanic did anything, and
   * the census steers EVERY run, not only the state ones — so a run without `--state` must credit the
   * same way or the two would select different samples while claiming one policy. */
  let prevSnap = null;
  const stateCheck = (turnIdx, play) => {
    /* `opts.statePlant` corrupts the MEDICHAM board and only the medicham board, at one named
     * boundary. It is undefined on every real run and exists for the red demonstration: a comparator
     * that has never been shown catching a planted STATE bug is not a comparator. It is applied to the
     * LIVE ENGINE STATE rather than to the snapshot, so the plant travels through the reader — a plant
     * applied to the output would prove only that `compare` can subtract. */
    if (STATE && opts.statePlant) opts.statePlant(S, battle, turnIdx);
    /* `opts.ppHold` IS A CALLER'S DECLARATION, NOT A DEFAULT. This driver always compares PP; the one
     * caller that asks for it to be held is tests/roster.js, and it says why on its own call. */
    const snap = BS.snapshot(S, battle, opts.ppHold ? { ...BS_CTX, ppHold: true } : BS_CTX);
    if (play) creditTurn(play, prevSnap, snap, turnIdx);
    prevSnap = snap;
    if (!STATE) return null;
    /* A TEST HOOK, and the only one. `tests/test-state-differential.js` has to observe boundaries the
     * driver does not keep — every board, not just the first divergent one — and the alternative was a
     * second copy of the build/init/choose harness inside the test, which is how two files come to
     * disagree about what a boundary is. Undefined on every real run. */
    if (opts.onBoundary) opts.onBoundary(snap, turnIdx, S, battle);
    boundaries++;
    if (!stateShape) stateShape = { screens_shape_medicham: snap.screens_shape_medicham,
                                    screens_named_comparable: snap.screens_named_comparable };
    if (turnIdx <= EARLY_BOUNDARIES && !earlyBoards[turnIdx]) {
      /* THE ACTIVE SPECIES PER SIDE, taken from BOTH engines, so the report can tell a party row that
       * is a second view of a standing body from one about a body on the bench. The union is
       * deliberate — on a species divergence the two engines disagree about who is standing. */
      const act = {};
      for (const s of ['p1', 'p2']) act[s] = [...new Set([...snap.medi.sides[s].active, ...snap.sd.sides[s].active]
        .filter(Boolean).map(x => x.species))];
      earlyBoards[turnIdx] = { turn: turnIdx, identical: snap.identical,
                               leaves_compared: snap.leaves_compared, active_species: act,
                               diffs: snap.identical ? [] : snap.diffs.map(d => BS.locate(d, snap)) };
    }
    /* ---- THE LAST BOARD, OVERWRITTEN EVERY BOUNDARY -----------------------------------------------
     * The FIRST divergent board is kept and never overwritten because "parted at turn 1" and "parted
     * at turn 9" are different events. THE END STATE IS THE OPPOSITE QUESTION and needs the opposite
     * discipline: the last board this game ever produced, whatever happened before it. Kept in the
     * SAME located form as the early boards — the same `BS.locate` machinery, not a second reader —
     * so the end-state families can be aggregated exactly as the turn-1 ones are.
     *
     * KEPT AT EVERY BOUNDARY AND NOT ONLY AT THE END, because there is no single place the game stops:
     * it can run out of turns, end in either engine, stop being asked for a move, or throw. Recording
     * it here means the last board is whatever the last comparison actually was, rather than a board
     * some exit path forgot to take. */
    lastBoard = { turn: turnIdx, identical: snap.identical, leaves_compared: snap.leaves_compared,
                  diffs: snap.identical ? [] : snap.diffs.map(d => BS.locate(d, snap)),
                  /* BOTH PARTIES, FROM BOTH ENGINES, WHETHER OR NOT ANYTHING DIFFERS. The severity
                   * ladder's top two rungs are claims about WHO IS ALIVE, and the diff list cannot
                   * carry them: a party keyed by species reports a mega evolution that fired in one
                   * engine as a missing member, which reads exactly like a death. Kept even on an
                   * identical board so the winner arm has a denominator. */
                  parties: ESS.endBoard(snap).parties };
    if (snap.identical) { boundariesAgreed++; return null; }
    if (!firstStateDiv) firstStateDiv = { turn: turnIdx, diffs: snap.diffs };
    return firstStateDiv;
  };
  /* WHAT WAS CLICKED, kept for the early turns only. Will: *"SAY WHAT WAS CLICKED. A board difference
   * without the two clicks that produced it cannot be judged."* Read off the choice that was actually
   * issued to BOTH engines — `chosen` is the single decision both of them received, so this cannot
   * describe a turn only one of them played. */
  const earlyClicks = [];
  const describeClicks = (sd, acts) => {
    const side = sd === 'p1' ? battle.p1 : battle.p2;
    const foes = (side.foe && side.foe.active) || [];
    return side.active.map((p, i) => {
      const a = acts[i], who = p ? pretty(p.species.id) : '(empty)';
      if (!p || p.fainted) return { body: who, did: 'is not on the field' };
      if (!a || a.pass) return { body: who, did: 'does nothing' };
      if (a.switchTo != null) return { body: who, did: 'switches out to ' + pretty(a.switchTo) };
      const mv = pretty(a.move);
      /* THE AIM, NOT A FOE INDEX. A click on an ally used to read `clicks Heal Pulse` with no target
       * named at all, which is the same blindness the dispatch had one level down. */
      const tb = aimBody(a.aim, side.active, foes, i);
      const rel = a.aim ? a.aim.rel : null;
      const tgt = tb ? (rel === 'self' ? ' at itself'
                      : (rel === 'ally' ? ' at its ally ' : ' at ') + pretty(tb.species.id)) : '';
      return { body: who, did: 'clicks ' + mv + tgt + (a.mega ? ', and mega evolves' : '') };
    });
  };

  let comparedWalked = 0;
  /* `final` IS THE FIX FOR THE ONE PLANT THIS COMPARATOR COULD NOT CATCH — 2026-08-12.
   *
   * The MISSING-event plant deletes the LAST agreeing line and was reported `applied: 1, caught:
   * false`: placed, and genuinely not detected. The loop below stops at the SHORTER of the two
   * streams, so a medicham2 stream that is a strict PREFIX of Showdown's agrees all the way to its
   * own end. **Our engine going quiet is indistinguishable from our engine being right.**
   *
   * That is not a corner case. `event missing from medicham2` is the largest class in BOTH arms (96
   * and 88 games), and the end-state work hit the same wall from the other side — at a 40-turn cap,
   * 937 games came back "ONLY medicham2 ended the battle". The instrument was blind to precisely its
   * own biggest category, and it said so in `planted_divergence_proof_ok: false` while the divergence
   * counts beside it were quoted all evening. Including by me.
   *
   * WHY A FLAG RATHER THAN ALWAYS. `alignAndCheck` is called after every turn, and mid-game one
   * stream is legitimately ahead of the other — a length difference there is pacing, not disagreement.
   * It only becomes a divergence once nothing more is coming. So the length test runs once, after the
   * loop. `reduce()` has already dropped the lines we declare we do not emit, so what is left is a
   * line the authority produced and we never did. */
  /* ---- THE ORDERING DISCRIMINATOR -------------------------------------------------------------
   * ROADMAP #290. `ordering` is the shape "same event, different slot", and the biggest member of it
   * is two `|move|` lines naming the same move in different slots. THAT LOOKS EXACTLY LIKE THE PINNED
   * SPEED TIE and this file's own header documents the history, so it has been read as an artefact.
   *
   * IT CANNOT BE ONE ANY MORE. CHANGELOG 3.74.0 (2026-08-07) fixed the tie AT THE ROOT — the selection
   * sort is reproduced line for line and the residual tie is resolved by the per-action uniform key,
   * which is the identity under a constant pinned die — and both arms of the current pin declare
   * `speed_tie: "to the EARLIER body"`. So an ordering pair is either a real turn-order defect or the
   * two bodies were genuinely tied and something else broke the agreement.
   *
   * SO ASK. The two bodies are named on the RAW lines; their speeds are read out of the AUTHORITY's
   * own `getActionSpeed()`, and the priority of what each clicked out of the format's own move data.
   * A pair whose bodies are NOT tied and whose priorities MATCH is a real turn-order disagreement and
   * belongs above everything else on the worklist.
   *
   * IT IS READ AT THE TURN BOUNDARY, WHICH IS NOT THE MOMENT THE ACTIONS WERE ORDERED. Tailwind can
   * have ended and a boost can have landed in between, so an EQUAL reading is weak evidence and an
   * UNEQUAL one is strong: two bodies 40 points apart at the boundary were not tied when the queue was
   * built. `speed_source` says so on every row rather than leaving the caveat in a comment here. */
  const _bodyByName = (nm) => {
    const t = String(nm || '').replace(/^p[12][ab]:\s*/, '').trim();
    if (!t) return null;
    for (const side of [battle.p1, battle.p2]) for (const q of side.pokemon)
      if (q.name === t || q.species.name === t) return q;
    return null;
  };
  const orderProbe = (sdRed, meRed, sdRawL, meRawL) => {
    if (!/^\|move\|/.test(String(sdRed)) || !/^\|move\|/.test(String(meRed))) return null;
    const A2 = String(sdRawL || '').split('|'), B2 = String(meRawL || '').split('|');
    const pa = _bodyByName(A2[2]), pb = _bodyByName(B2[2]);
    if (!pa || !pb) return null;
    /* SAME RULE AS `speedAgree`: a reader that throws must not be able to look like a reading that
     * agreed. The row it feeds carries `speed: null`, and the count says so out loud. */
    const spd = (q) => { try { return q.getActionSpeed(); } catch (e) { failedSpeedRead('orderProbe getActionSpeed', e); return null; } };
    const mvid = (l) => String(l[3] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const pri = (mid) => { const mv = battle.dex.moves.get(mid); return (mv && mv.exists) ? mv.priority : null; };
    const ma = mvid(A2), mb = mvid(B2);
    const sa = spd(pa), sb = spd(pb);
    return {
      showdown_first: { slot: String(sdRed).split('|')[2], body: pa.species.name, speed: sa,
                        move: ma, priority: pri(ma) },
      medicham_first: { slot: String(meRed).split('|')[2], body: pb.species.name, speed: sb,
                        move: mb, priority: pri(mb) },
      same_move: ma === mb,
      same_priority: pri(ma) === pri(mb),
      speed_tied: sa != null && sb != null && sa === sb,
      speed_gap: (sa != null && sb != null) ? Math.abs(sa - sb) : null,
      speed_source: 'battle.getActionSpeed() at the TURN BOUNDARY, not at queue-build time',
    };
  };
  /* ---- DO THE TWO ENGINES AGREE ABOUT HOW FAST A BODY IS? ---------------------------------------
   * ROADMAP #290. `orderProbe` above answers "who acted first" and cannot say WHY, and the two
   * candidate whys need completely different fixes: the SORT is wrong, or the two engines disagree
   * about the SPEED they sorted on. `|switch| <> |switch|` is three quarters of the current
   * `ordering` class and `orderProbe` does not cover it at all — a `|switch|` line names the body
   * ARRIVING and the queue was ordered on the body LEAVING, so nothing readable off the line pair
   * can answer it.
   *
   * SO ASK THE ENGINES DIRECTLY, at the turn boundary, about every body on the field:
   *   the authority   `pokemon.getActionSpeed()`  (sim/pokemon.ts) — the exact number
   *                   `Battle#getActionSpeed` writes into `action.speed`
   *   this engine     `M.effSpeed(mon, field, side)` — the exact number `turnOrderKey` puts in `spe`
   * These are the two halves of ONE FACT in CLAUDE.md's sense, so a difference here is a defect
   * whatever the sort does with it, and it is attributable to a body rather than to a turn.
   *
   * IT IS INDEX-PARALLEL, on the same assumption `aimBody` already makes, and it CHECKS that rather
   * than trusting it: a row whose two engines name different species is reported as `desync` and
   * never as a speed disagreement, because a mismatched pairing would manufacture differences. */
  const speedRows = [];
  let speedDesync = 0;
  /* EVERY READING, NOT JUST THE DISAGREEING ONES, AND ONLY WHEN A CALLER ASKS. A staged arm that
   * finds no disagreement has proved nothing until it can show the truncation had something to bite
   * on: x1.5 of an EVEN stat is exact, so an arm whose Choice Scarf happens to sit on an even-Speed
   * body is green under the deliberate break too. Two of the three arms in tests/probe_turn_order.js
   * were exactly that when they were first written. Off by default because a 972-game run would pay
   * for an array nothing reads. */
  const speedCensus = [];
  const lastMoveRows = [];
  const speedAgree = (when) => {
    if (typeof M.effSpeed !== 'function') return;      // an old release; loud, not silent
    for (const [sd, acts, tag] of [[battle.p1, S.actA, 'A'], [battle.p2, S.actB, 'B']]) {
      for (let i = 0; i < Math.max(sd.active.length, acts.length); i++) {
        const q = sd.active[i], m = acts[i];
        if (!q || !m) continue;
        if (rosterKey(q) !== rosterKey(m)) { speedDesync++; continue; }
        /* ---- ROADMAP #241(3) — DO THE TWO ENGINES AGREE ABOUT `lastMove`? ------------------------
         * The retraction inside medicham2's own affect branch names this as the lead it did not
         * follow: the Encore announcement was pulled because it manufactured 4 and 6 games, and the
         * note says *"the likely place to look is `_lastMove` being null here where Showdown's
         * `lastMove` is set"*. Encore's `condition.onStart` opens `let move = target.lastMove; if
         * (!move) return false`, so `lastMove` IS the gate — an engine that disagrees about it
         * refuses Encores the authority applies and applies Encores the authority refuses, and
         * announcing the refusal only makes the disagreement audible. Asked here rather than
         * reasoned about. */
        {
          const sdLast = (q.lastMove && id(q.lastMove.id)) || '';
          const meLast = id(m._lastMove || '');
          if (sdLast !== meLast) {
            lastMoveRows.push({ when, slot: 'p' + (tag === 'A' ? 1 : 2) + (i ? 'b' : 'a'),
                                body: id(m.name), showdown: sdLast || '(none)', medicham: meLast || '(none)' });
          }
        }
        /* A THROW HERE IS NOT A "NO READING". `tests/test-no-silent-failure.js` is right about this
         * shape: a swallowed reason hands a made-up answer downstream, and the answer this probe
         * hands downstream is "the two engines agree", which is the worst possible default for an
         * instrument whose whole job is to find disagreement. Counted and NAMED, and the run prints
         * it beside the verdict. */
        let a = null, b = null;
        try { a = q.getActionSpeed(); } catch (e) { failedSpeedRead('showdown getActionSpeed', e); }
        try { b = M.effSpeed(m, S.field, tag); } catch (e) { failedSpeedRead('medicham effSpeed', e); }
        if (a == null || b == null) continue;
        if (opts.speedCensus) {
          let stored = null;
          try { stored = q.storedStats && q.storedStats.spe; }
          catch (e) { failedSpeedRead('showdown storedStats.spe', e); }
          speedCensus.push({ when, slot: 'p' + (tag === 'A' ? 1 : 2) + (i ? 'b' : 'a'),
                             body: id(m.name), item: id(m.item || ''), showdown: a, stored });
        }
        /* TRICK ROOM IS AN INVERSION IN ONE ENGINE AND A COMPARATOR FLIP IN THE OTHER, so the two
         * numbers are not on the same scale under it. Undone here rather than declared a divergence:
         * this probe is about the STAT.
         *
         * AND THE INVERSION IS `-speed`, NOT `10000 - speed`. THIS PROBE HAD MAINLINE'S RULE AND
         * MANUFACTURED A WHOLE FAMILY OF PHANTOM ENGINE DEFECTS BEFORE IT WAS READ: every Trick Room
         * row printed `showdown 10091 / medicham 91` and looked like a missing inversion. Champions
         * overrides `getActionSpeed` in data/mods/champions/scripts.ts:46, comment *"Remove Trick
         * Room underflow"*, and the whole body is
         *     let speed = this.getStat('spe', false, false);
         *     if (trickRoomCheck) speed = -speed;
         *     return speed;
         * so it is a NEGATION, and there is NO `trunc` on the way out either. Reading sim/pokemon.ts
         * for this is reading MAINLINE, which is the failure CLAUDE.md names by name. */
        const sdRaw = a, sdStat = (() => {
          try { return q.getStat('spe', false, false); }
          catch (e) { failedSpeedRead('showdown getStat spe', e); return null; } })();
        if ((S.field.tr || 0) > 0) a = -a;
        /* THE AUTHORITY'S NUMBER IS STILL AN INTEGER, and the reason is `getStat` rather than
         * `getActionSpeed`: every `ModifySpe` handler is a `chainModify`, and `Battle#modify`
         * applies the accumulated chain in 4096ths with a `trunc`. `effSpeed`'s x1.5 / x0.5 / x2 is
         * plain floating point and keeps the fraction. A fractional difference IS reportable — it
         * turns a genuine speed TIE into a deterministic win — so it is kept and FLAGGED rather than
         * rounded away, and `same_when_floored` says which kind of difference this row is. */
        if (a === b) continue;
        speedRows.push({ when, slot: 'p' + (tag === 'A' ? 1 : 2) + (i ? 'b' : 'a'),
                         body: id(m.name), showdown: a, medicham: b, gap: a - b,
                         same_when_floored: Math.floor(a) === Math.floor(b),
                         sd_raw: sdRaw, sd_stat: sdStat,
                         ability: id(m.ability || ''), sd_ability: id(q.ability || ''),
                         item: id(m.item || ''), sd_item: id(q.item || ''),
                         status: id(m.status || ''), sd_status: id(q.status || ''),
                         boost_spe_me: (m.boosts && m.boosts.sp) || 0,
                         boost_spe_sd: (q.boosts && q.boosts.spe) || 0,
                         /* `weatherId` takes the WEATHER, not the field. Passing `S.field` returned ''
                          * on every row and printed "medicham has no weather" beside a Showdown that
                          * did — a probe defect that read exactly like an engine one. */
                         weather: String(M.weatherId ? M.weatherId(S.field.weather) : ''),
                         sd_weather: id(battle.field.weather || ''),
                         tailwind_me: tag === 'A' ? (S.field.twA || 0) : (S.field.twB || 0),
                         trickroom: S.field.tr || 0,
                         sd_trickroom: battle.field.getPseudoWeather('trickroom') ? 1 : 0 });
      }
    }
  };
  const alignAndCheck = (final, oneEngineEnded) => {
    /* `opts.plant` corrupts the MEDICHAM side and only the medicham side. It exists for the
     * planted-divergence proof and is undefined on every real run — a comparator that finds nothing
     * must first prove it can find something, and a plant applied to a shared normaliser would land
     * on both streams and cancel out, which is the failure it is trying to detect. */
    const sdRawAll = sdStream(battle.log);
    const raw = opts.plant ? opts.plant(trace.slice()) : trace;
    const A = reduce(sdRawAll), B = reduce(raw);
    /* `let`, not `const`: the final pass trims both streams to the last turn they share. */
    let a = A.lines, b = B.lines;
    /* HOW FAR THE TWO STREAMS WERE ACTUALLY WALKED, kept because a game that never parts has no
     * `div.index` and the planted-divergence proof needs somewhere INSIDE THE COMPARED REGION to
     * plant. See plantedProof: it used `trace.length`, which is the RAW medicham line count, and the
     * compared region is shorter at both ends -- `reduce` drops lines, and the loop below stops at
     * the SHORTER of the two reduced streams. */
    comparedWalked = Math.min(a.length, b.length);
    for (let i = 0; i < comparedWalked; i++) {
      if (a[i] !== b[i]) {
        return { index: i, sd: a[i], me: b[i],
                 /* ROADMAP #290 — null unless BOTH lines are `|move|`; see orderProbe above. */
                 orderProbe: orderProbe(a[i], b[i], sdRawAll[A.rawIdx[i]], raw[B.rawIdx[i]]),
                 /* THE RAW LINES, so a report shows what the engines EMITTED and not what the
                  * comparator reduced them to. The reduced form is what decided; the raw form is
                  * what a person has to go and fix. */
                 sdRaw: sdRawAll[A.rawIdx[i]], meRaw: raw[B.rawIdx[i]],
                 meRawIndex: B.rawIdx[i],
                 /* FOUR LINES BEFORE IS NOT A TURN — WILL, 2026-08-13: *"can you make it clear like
                  * you did for the last one with the moves and megas"*. A split shown with four lines
                  * of lead-in loses the `|move|` that caused it and every `|-mega|` earlier in the
                  * turn, so a reader sees a consequence with its cause cropped off. Widened to reach
                  * back past the turn boundary in a doubles game: four bodies acting, each with a
                  * move line plus its damage, resisted, crit and secondary lines. */
                 before: b.slice(Math.max(0, i - 16), i),
                 sdAfter: a.slice(i, i + 10), meAfter: b.slice(i, i + 10),
                 sdAfterRaw: A.rawIdx.slice(i, i + 10).map(j => sdRawAll[j]),
                 /* ROADMAP #241(3) — THE AUTHORITY'S OWN LEAD-IN, WHICH IS THE ONLY PLACE THE MOVE
                  * IS NAMED. A generic failure is `add('-fail', pokemon)` plus
                  * `attrLastMove('[still]')`, so the `-fail` line carries the MOVER and never the
                  * move; the artifact recorded twenty-one of them and could not say what any of
                  * them clicked, which sent a fixture hunt at the CAST instead — six staged field
                  * moves, five of which already agreed. The `|move|` line two lines up names it. */
                 sdBeforeRaw: A.rawIdx.slice(Math.max(0, i - 6), i).map(j => sdRawAll[j]),
                 meAfterRaw: B.rawIdx.slice(i, i + 10).map(j => raw[j]),
                 /* the RAW lead-in too: `before` is the reduced form, and the reduced form is where a
                  * `|-mega|` can have been normalised away before a person ever sees it. */
                 beforeRaw: B.rawIdx.slice(Math.max(0, i - 16), i).map(j => raw[j]),
                 agreedLines: i };
      }
    }
    /* THE TRUNCATION TEST. Everything walked agreed; if one stream still has lines, the other stopped
     * talking, and that is a divergence at the first line it failed to produce. Reported with the same
     * shape as any other divergence so the classifier, the report and the cards all read it without a
     * special case — the absent side is named rather than left undefined, because a blank there would
     * render as an empty card and look like nothing happened, which is the bug one level up. */
    /* MEASURED BEFORE IT WAS BELIEVED, AND THE FIRST VERSION OF THIS TEST WAS WRONG.
     *
     * Without the trim below it fired on 9 of 9 games, and the unmatched line was `|turn|13` — the
     * authority announcing a turn the HARNESS stopped before playing. That is the turn cap, not a
     * defect, and shipping it would have made every capped game a divergence: an instrument that
     * reports its own stop rule as an engine bug, which is worse than the blindness it replaced.
     *
     * So the streams are trimmed to the last turn BOTH engines actually started, and only then
     * compared for length. Complete turns against complete turns.
     *
     * THE ONE CASE THAT IS NOT TRIMMED is a battle one engine ended and the other did not. There the
     * extra turns are the disagreement rather than an artefact of where we cut, and folding them away
     * would re-hide exactly what this fix exists to expose. `endReason` already distinguishes it. */
    const lastTurnNo = s => { for (let i = s.length - 1; i >= 0; i--) {
                                const m = /^\|turn\|(\d+)/.exec(String(s[i])); if (m) return +m[1]; }
                              return null; };
    const cutAfterTurn = (s, n) => { if (n == null) return s;
                                     const i = s.findIndex(l => { const m = /^\|turn\|(\d+)/.exec(String(l));
                                                                  return m && +m[1] > n; });
                                     return i < 0 ? s : s.slice(0, i); };
    if (final && !oneEngineEnded) {
      const ta = lastTurnNo(a), tb = lastTurnNo(b);
      if (ta != null && tb != null && ta !== tb) {
        const keep = Math.min(ta, tb);
        a = cutAfterTurn(a, keep); b = cutAfterTurn(b, keep);
        comparedWalked = Math.min(a.length, b.length);
      }
    }
    if (final && a.length !== b.length) {
      const i = comparedWalked;
      const sdLonger = a.length > b.length;
      const GONE = sdLonger ? '(medicham2 emitted nothing further)' : '(showdown emitted nothing further)';
      return { index: i,
               sd: sdLonger ? a[i] : GONE,
               me: sdLonger ? GONE : b[i],
               sdRaw: sdLonger ? sdRawAll[A.rawIdx[i]] : GONE,
               meRaw: sdLonger ? GONE : raw[B.rawIdx[i]],
               meRawIndex: sdLonger ? null : B.rawIdx[i],
               before: b.slice(Math.max(0, i - 4), i),
               sdAfter: a.slice(i, i + 6), meAfter: b.slice(i, i + 6),
               sdAfterRaw: A.rawIdx.slice(i, i + 6).map(j => sdRawAll[j]),
               meAfterRaw: B.rawIdx.slice(i, i + 6).map(j => raw[j]),
               agreedLines: i,
               /* named so a reader can tell "we said something different" from "we stopped", which
                * are the same index and completely different bugs */
               truncated: sdLonger ? 'medicham2' : 'showdown',
               lengths: { showdown: a.length, medicham: b.length } };
    }
    return null;
  };
  /* the reduced -> raw map of the medicham stream as it stands, so a plant can be aimed at the raw
   * line that produced a given REDUCED index. */
  playGame._mediRawIdx = () => reduce(trace).rawIdx;

  try {
    speedAgree(0);                  // before a single choice — the leads as they stand
    firstDiv = alignAndCheck();     // the leads, entry abilities and entry weather, before turn 1
    if (firstDiv) divTurn = 0;
    stateCheck(0);                  // the board as the leads stand, before a choice is made
    /* THE STOP RULE, WRITTEN OUT BECAUSE IT DECIDES WHAT IS MEASURED.
     *   protocol mode  stop at the first divergent LINE  — the game after that point is two engines
     *                  telling different stories and every later line is downstream of the first.
     *   state mode     stop at the first divergent BOARD — same argument one level up, and NOT at the
     *                  first divergent line, because whether a parted narration reaches the same board
     *                  is the whole question.
     *   end-state mode DO NOT STOP AT EITHER. The question is where the two engines ARRIVE, and a run
     *                  that halts at the first disagreement can only ever report that they disagreed.
     *                  See the `--end-state` header. */
    for (let t = 0; t < MAXTURNS && (END_STATE ? true : (STATE ? !firstStateDiv : !firstDiv)); t++) {
      /* WHICH ENGINE ENDED IS RECORDED SEPARATELY, and that is the whole point of splitting this
       * condition in two. `battle.ended || M.battleOver(S)` stopped the loop either way and threw the
       * distinction away; "both engines agree the battle is over" and "ONE of them thinks it is" are
       * a cosmetic non-event and a serious disagreement respectively. */
      if (battle.ended || M.battleOver(S)) {
        endReason = battle.ended && M.battleOver(S) ? 'both engines ended the battle'
                  : (battle.ended ? 'ONLY showdown ended the battle' : 'ONLY medicham2 ended the battle');
        break;
      }
      if (battle.requestState !== 'move') { endReason = 'showdown stopped asking for a move'; break; }
      /* ROADMAP #290 — READ THE SPEEDS AT THE TOP OF THE TURN, WHICH IS WHEN THE QUEUE IS ORDERED,
       * AND ONLY WHILE THE TWO ENGINES STILL AGREE. Reading at turn END records the boundary the
       * divergence was found at, and at that boundary the boards may legitimately differ — so a
       * disagreement there is downstream of something else and cannot be attributed to speed. The
       * loop's own stop rule guarantees every reading below is taken on an undiverged game. */
      speedAgree(t + 1);
      /* ROADMAP #81 WIRE 7 — A DIRECTED SCENARIO ENDS WHEN ITS SCRIPT DOES.
       *
       * Every entry in DIRECTED carries a ONE-turn script, and the loop only ever ran one turn because
       * every one of them diverged on turn 1. When WIRE 7 made two of them AGREE the loop ran on,
       * `scripted()` returned `{pass:true}` for a slot that had no step, and Showdown rejected the
       * whole choice — `Can't pass: Your Incineroar must make a move (or switch)`. The scenario then
       * reported as THREW, which reads exactly like a broken harness and was in fact a FIXED ENGINE.
       * A scripted game is over when the script is over; that is not a failure and it is not a pass. */
      if (opts.script && !opts.script[t]) { endReason = 'the script ran out'; break; }
      const chosen = { p1: [], p2: [] };
      for (const sd of ['p1', 'p2']) {
        const side = sd === 'p1' ? battle.p1 : battle.p2;
        const req = side.activeRequest;
        if (!req || !req.active) { chosen[sd] = null; continue; }
        /* TWO SLOTS ON ONE SIDE MAY NOT SWITCH TO THE SAME BODY. `chooseAction` scores each slot
         * independently and the least-clicked bench member is the least-clicked one for BOTH of them,
         * so it produced `switch 4, switch 4` — which Showdown rejects outright ("The Pokémon in slot
         * 4 can only switch in once") and the whole game was thrown away.
         *
         * IT IS NOT A NEW BUG AND THE ARMS ARE WHAT MADE IT VISIBLE. It threw 1 game in 51 under the
         * old single pin and 19 in 51 under `bottom-tie-in-order`, because that arm's games last
         * longer and reach more forced switches — a defect the old instrument was too short-lived to
         * meet. Fixed here rather than filed, because this file owns the driver. */
        const claimed = new Set();
        req.active.forEach((act, i) => {
          const p = side.active[i];
          if (!p || p.fainted || !act) { chosen[sd].push({ pass: true }); return; }
          /* A DIRECTED SCENARIO OVERRIDES THE COVERAGE RULE, and only there. §3.2: the swarm alone
           * never reaches the fringe, and the two findings this harness was built to reproduce
           * (order within a hit; the damage interior) are staged rather than stumbled into. */
          if (opts.script) { chosen[sd].push(scripted(opts.script, t, sd, i, act, side)); return; }
          const a = chooseAction(battle, side, i, act, axis, claimed);
          if (a && a.switchTo != null) claimed.add(a.switchTo);
          chosen[sd].push(a);
        });
      }
      if (!chosen.p1 || !chosen.p2) { endReason = 'neither side was asked for an action'; break; }

      /* ROADMAP #31 — THE MEGA CHOICE, MADE ONCE AND ISSUED TO BOTH ENGINES.
       *
       * LEGALITY COMES FROM SHOWDOWN'S OWN REQUEST, exactly as the move legality above does:
       * `activeRequest.active[i].canMegaEvo` already knows about the stone, the species and whether
       * this side has spent its mega. A driver that decided for itself would be a second copy of the
       * rule, and this instrument would then be comparing its own belief against the authority.
       *
       * THE POLICY IS AT THE FIRST OPPORTUNITY, and it is a COVERAGE policy rather than a good one —
       * §3.3. The point is to get mega bodies onto the field and acting, not to mega well. One per
       * side per turn, because Showdown rejects a second (`Can't mega evolve: You can only
       * mega-evolve once per battle`) and a rejected choice is a thrown game. */
      for (const sd of ['p1', 'p2']) {
        const side = sd === 'p1' ? battle.p1 : battle.p2;
        const req = side.activeRequest;
        if (!req || !req.active || opts.script) continue;
        /* WHICH SLOT, WHEN BOTH COULD: alternate. Taking the first offer every time would mega out of
         * the LEFT slot on almost every side, and "the base class could only mega from the LEFT slot"
         * is the historical defect this instrument is supposed to be able to see. Alternating is the
         * coverage-seeking rule of §3.3 applied to a second axis. */
        const order = MEGA_PREFER_B ? [1, 0] : [0, 1];
        for (const i of order) {
          const a = chosen[sd][i];
          if (!a || a.pass || a.switchTo != null) continue;
          if (!req.active[i] || !req.active[i].canMegaEvo) continue;
          a.mega = true; megaChoices++; MEGA_PREFER_B = !MEGA_PREFER_B; break;
        }
      }

      /* RECORDED BEFORE EITHER ENGINE RESOLVES THE TURN, so the bodies named are the ones that were
       * standing when the choice was made rather than whatever survived it. */
      if (STATE && t < EARLY_BOUNDARIES) earlyClicks[t + 1] = { p1: describeClicks('p1', chosen.p1),
                                                                p2: describeClicks('p2', chosen.p2) };

      /* WHAT IS IN PLAY THIS TURN, RECORDED BEFORE EITHER ENGINE RESOLVES IT (ROADMAP #91). The bodies
       * are the ones STANDING when the choice was made, and the abilities and items are the ones they
       * ACTUALLY HELD — read off the live medicham bodies, never off the sheet, per §3.1. */
      const playMark = trace.length;
      const play = { moves: [], bodies: [] };
      for (const [sdk, acts, own] of [['p1', chosen.p1, S.actA], ['p2', chosen.p2, S.actB]]) {
        const foeSide = sdk === 'p1' ? 'p2' : 'p1';
        own.forEach((mon, i) => {
          if (!mon) return;
          play.bodies.push({ side: sdk, slot: i, ability: id(mon.ability || ''), item: id(mon.item || '') });
          const a = acts && acts[i];
          if (!a || a.pass || a.switchTo != null || !a.move) return;
          /* THE SCOPE A CREDIT IS ALLOWED TO LOOK IN: the user's slot and the target's slot, plus every
           * field- and side-level leaf. A move that hits more than one body is widened to every slot,
           * read from its own tags rather than from a list of move names. */
          const tg = (TAGS_OBJ.moves && TAGS_OBJ.moves[id(a.move)] && TAGS_OBJ.moves[id(a.move)].tags) || [];
          const anySlot = tg.indexOf('spreadAll') >= 0 || tg.indexOf('spreadFoes') >= 0
                       || tg.indexOf('clearsBoosts') >= 0 || tg.indexOf('perishClock') >= 0;
          const slots = [{ side: sdk, slot: i }];
          /* THE SLOT THE CLICK NAMED, WHICHEVER SIDE OF THE FIELD IT IS ON. An ally-aimed move used to
           * put only the USER's slot in scope, so the effect it landed on the partner sat outside the
           * window the credit is read from — an entity could not be credited for the one thing it
           * does. `self` is already the user's slot and is not pushed twice. */
          if (a.aim) {
            const ts = a.aim.rel === 'foe' ? foeSide : sdk;
            const tk = a.aim.rel === 'self' ? i : a.aim.slot;
            if (!(ts === sdk && tk === i)) slots.push({ side: ts, slot: tk });
          }
          play.moves.push({ id: id(a.move), side: sdk, slot: i, connected: false,
                            scope: { anySlot, slots } });
        });
      }

      /* --- medicham2 --- */
      const mk = (own, foes, bench, acts) => {
        const map = new Map();
        own.forEach((mon, i) => {
          if (!mon) return;
          const a = acts[i];
          if (!a || a.pass || a.forced) { map.set(mon, { kind: 'pass' }); return; }
          if (a.switchTo != null) {
            /* `_switchKey`, stamped at build time — see buildPair. NOT `x.name`, which a forme
             * rename mutates. A miss is COUNTED, never a silent pass: one engine switching while the
             * other passes is a different board with no evidence attached. */
            const want = bench.find(x => x && !x.fainted && rosterKey(x) === a.switchTo);
            if (want) { map.set(mon, { kind: 'switch', to: want }); return; }
            SWITCH_LOOKUP_MISS.medi++;
            SWITCH_LOOKUP_MISS.names[a.switchTo] = (SWITCH_LOOKUP_MISS.names[a.switchTo] || 0) + 1;
            /* AND WHERE. A miss makes THIS engine pass while the authority switches, so it is a
             * MANUFACTURED divergence — a count of 3 that cannot be told apart from 3 real engine
             * defects is exactly the ruler-versus-engine confusion this counter exists to settle. */
            SWITCH_LOOKUP_MISS.where.push(cfgId + ' t' + (t + 1) + ' ' + seedTag + ' wanted ' + a.switchTo
              + ' bench[' + bench.filter(Boolean).map(x => (rosterKey(x) || '?') + '/' + id(x.name)).join(' ') + ']');
            map.set(mon, { kind: 'pass' }); return;
          }
          /* THE ONE DISPATCH, AND THE ONE PLACE THE AIM IS COUNTED. `own` is this side's actives, so
           * an ally aim resolves inside it — the ask that could not be expressed before. A NAMED slot
           * holding no body is a MISS and is counted: it is exactly the shape of the defect this
           * replaces (a click that quietly became targetless), and a silent one reads as a working
           * omission. `none` is the legitimate targetless click and stays targetless. */
          const tgt = aimBody(a.aim, own, foes, i);
          if (!a.aim) AIM.none++; else if (!tgt) AIM.miss++; else AIM[a.aim.rel]++;
          const pa = M.playerAction(mon, a.move, tgt, S.field);
          /* the SAME flag Showdown gets as ` mega` on the choice string below — one decision, two
           * spellings, never two decisions */
          if (a.mega && pa) pa.mega = true;
          map.set(mon, pa);
        });
        return map;
      };
      M.battleTurn(S, armRng, mk(S.actA, S.actB, S.benchA, chosen.p1), mk(S.actB, S.actA, S.benchB, chosen.p2));

      /* --- showdown --- */
      const str = (sd, acts) => {
        const side = sd === 'p1' ? battle.p1 : battle.p2;
        return side.active.map((p, i) => {
          const a = acts[i];
          if (!p || p.fainted || !a || a.pass) return 'pass';
          if (a.switchTo != null) {
            /* SNAPSHOTTED ON FIRST USE, WHICH IS TURN 1 — before Showdown has resolved anything, so
             * this is the party as built. Per SIDE, because a side's array is permuted only by that
             * side's own switches. */
            if (!INITIAL_PARTY.has(side)) INITIAL_PARTY.set(side, side.pokemon.slice());
            const init = INITIAL_PARTY.get(side);
            const permuted = side.pokemon.some((q, n) => q !== init[n]);
            const live = q => !q.isActive && !q.fainted && rosterKey(q) === a.switchTo;
            /* THE LIVE ARRAY IS THE ONE SHOWDOWN INDEXES. `init` is the control's stale one. */
            const j = (SWITCH_BY_INITIAL_INDEX ? init : side.pokemon).findIndex(live);
            if (j < 0) SWITCH_LOOKUP_MISS.sd++;
            else {
              SWITCH_ADDRESSING.sent++;
              if (permuted) SWITCH_ADDRESSING.after_permutation++;
              const named = side.pokemon[j];
              if (!named || rosterKey(named) !== a.switchTo || j < side.active.length) {
                SWITCH_ADDRESSING.misaddressed++;
                if (!SWITCH_ADDRESSING.first_bad) SWITCH_ADDRESSING.first_bad =
                  'asked for ' + a.switchTo + ', `switch ' + (j + 1) + '` names '
                  + (named ? rosterKey(named) + (j < side.active.length ? ' (an ACTIVE slot)' : '') : 'nothing')
                  + (permuted ? ' — party permuted' : ' — party NOT permuted');
              }
            }
            return j >= 0 ? 'switch ' + (j + 1) : 'pass';
          }
          return 'move ' + a.slot + (a.target != null ? ' ' + a.target : '') + (a.mega ? ' mega' : '');
        }).join(', ');
      };
      const c1 = str('p1', chosen.p1), c2 = str('p2', chosen.p2);
      /* COUNTED AND THEN THROWN — see CHOICE_REFUSED. These two already threw; they did not COUNT,
       * so a run could not state how often the authority refused this harness. */
      if (!battle.choose('p1', c1)) throw new Error('p1 choice rejected ' + refusedChoice('p1', c1, battle.p1.choice.error));
      if (!battle.choose('p2', c2)) throw new Error('p2 choice rejected ' + refusedChoice('p2', c2, battle.p2.choice.error));

      /* A FORCED SWITCH IS MIRRORED FROM MEDICHAM2, never chosen independently. medicham2 refills a
       * dead slot itself; if Showdown picked its own replacement the two engines would be playing
       * different games from the next line on and every later divergence would be the harness. */
      let guard = 0, mirrorImpossible = null;
      while (battle.requestState === 'switch' && guard++ < 8 && !mirrorImpossible) {
        for (const sd of ['p1', 'p2']) {
          const side = sd === 'p1' ? battle.p1 : battle.p2;
          if (!side.activeRequest || !side.activeRequest.forceSwitch) continue;
          const mine = sd === 'p1' ? S.actA : S.actB;
          /* THE DECISION IS `mirrorForcedSwitch`, ONE LEVEL UP AND EXPORTED. It is not inline here for
           * one reason: the shape that broke it — a DOUBLE KO on a side down to its last usable body —
           * is reached by roughly one game in a hundred and cannot be summoned on demand, so an inline
           * decision could only ever be tested by hunting the corpus for a game that happens to reach
           * it. Corpus games move; a constructed one does not. tests/test-forced-switch-mirror.js hands
           * it the exact shape as data. */
          const mr = mirrorForcedSwitch(side.activeRequest.forceSwitch, mine, side.pokemon);
          FORCED_SWITCH_MIRROR.switched += mr.switched;
          FORCED_SWITCH_MIRROR.passed += mr.passed;
          SWITCH_LOOKUP_MISS.sd += mr.lookupMiss;
          if (mr.cannot) { mirrorImpossible = sd + ': ' + mr.cannot; break; }
          const cs = mr.picks.join(', ');
          if (!battle.choose(sd, cs)) {
            const why = (side.choice && side.choice.error) || '?';
            /* SHOWDOWN REFUSED A CHOICE EVERY SLOT OF WHICH MIRRORED CLEANLY. There are two ways that
             * can happen and they are told apart by evidence rather than by assumption:
             *   - the two engines still agree about which of this side's bodies are alive -> the
             *     harness said something illegal, which is a DEFECT IN THIS FILE. Counted and thrown.
             *   - they do not agree -> medicham2 is out of bodies and Showdown is not (or the reverse),
             *     so the number of replacements the request wants is not the number medicham2 made.
             *     Parted board again, reached from the other side. Stopped, not thrown.
             * The alive-set comparison is not a second copy of a Showdown rule; it is the one question
             * this whole instrument exists to ask, asked about a roster instead of a protocol line. */
            const aliveSd = new Set(side.pokemon.filter(q => !q.fainted).map(q => rosterKey(q)));
            const aliveMe = new Set([...(sd === 'p1' ? S.actA : S.actB), ...(sd === 'p1' ? S.benchA : S.benchB)]
              .filter(m => m && !m.fainted).map(m => rosterKey(m)));
            const agree = aliveSd.size === aliveMe.size && [...aliveSd].every(x => aliveMe.has(x));
            if (agree) throw new Error('forced-switch choice rejected ' + refusedChoice(sd, cs, why));
            mirrorImpossible = sd + ' "' + cs + '" refused (' + why + '); alive showdown ['
                             + [...aliveSd].join(' ') + '] vs medicham2 [' + [...aliveMe].join(' ') + ']';
            break;
          }
        }
      }
      if (mirrorImpossible) {
        MIRROR_IMPOSSIBLE.n++;
        if (!MIRROR_IMPOSSIBLE.first) MIRROR_IMPOSSIBLE.first = mirrorImpossible;
      }
      turns++;
      for (const m of [...S.actA, ...S.actB]) if (m) bodiesSeen.push(m);
      /* THE PROTOCOL DIVERGENCE IS RECORDED ONCE AND NEVER OVERWRITTEN. In state mode the loop runs on
       * past it, and `alignAndCheck` compares the two streams FROM THE START every time — so it would
       * keep returning the same first divergence and re-assigning it is harmless, but a later call
       * finding an EARLIER one is impossible and a later call finding a LATER one would be wrong.
       * Guarded rather than argued. */
      const pd = alignAndCheck();
      if (!firstDiv && pd) { firstDiv = pd; divTurn = t + 1; }
      /* DID THE CLICK CONNECT? Read off the stream this turn produced, the same `-miss` lookahead
       * `harvest` uses. A move that missed exercised the MISS PATH and nothing else, and crediting it
       * for its effect would be the click-credit bug wearing a different hat. */
      {
        const seg = trace.slice(playMark);
        for (let k = 0; k < seg.length; k++) {
          const p = String(seg[k]).split('|');
          if (p[1] !== 'move') continue;
          let missed = false;
          for (let j = k + 1; j < Math.min(k + 4, seg.length); j++) {
            const q = String(seg[j]).split('|');
            if (q[1] === 'move') break;
            if (q[1] === '-miss' && q[2] === p[2]) { missed = true; break; }
          }
          if (missed) continue;
          const who = String(p[2] || '').slice(0, 3);   // `p1a` / `p2b`
          const mv = play.moves.find(x => x.id === id(p[3]) && x.side === who.slice(0, 2)
                                          && x.slot === (who[2] === 'b' ? 1 : 0));
          if (mv) mv.connected = true;
        }
      }
      stateCheck(t + 1, play);
      /* STOPPED HERE AND NOT AT THE CHOOSE(), so that this turn's bookkeeping still happens: the
       * comparator call four statements up is what RECORDS the earlier, real divergence that parted
       * the boards in the first place. Breaking out at the choose() would throw that away and the game
       * would report a stop with no divergence attached — the instrument losing the finding it just
       * proved it had. */
      if (mirrorImpossible) {
        endReason = 'the boards parted — medicham2\'s placement cannot be expressed to showdown ('
                  + mirrorImpossible + ')';
        break;
      }
    }
    /* THE LOOP RAN OUT RATHER THAN BREAKING. In end-state mode that is the turn cap; in the other two
     * it is whichever comparator's stop rule fired, and saying which one is not optional — "the boards
     * agreed at the end" means something entirely different when the end was the first mismatch. */
    /* THE FINAL PASS — the only place the length test is allowed to fire. Guarded on `!firstDiv`
     * because a game that already parted has a first divergence and this must never overwrite it with
     * a later one; the whole instrument is FIRST-divergence. */
    if (!firstDiv) { const tail = alignAndCheck(true, /^ONLY /.test(endReason || ''));
                     if (tail) { firstDiv = tail; divTurn = turns; } }
    if (!endReason) endReason = END_STATE ? 'the turn cap (' + MAXTURNS + ')'
                              : (STATE ? (firstStateDiv ? 'the first divergent BOARD' : 'the turn cap (' + MAXTURNS + ')')
                                       : (firstDiv ? 'the first divergent LINE' : 'the turn cap (' + MAXTURNS + ')'));
  } catch (e) { err = String((e && e.message) || e).slice(0, 160); if (!endReason) endReason = 'THREW'; }
  /* ASKED OF BOTH ENGINES AFTER THE FACT, not remembered from the exit test, because a game can also
   * leave the loop by throwing or by running out of turns and the two flags still have to be right.
   * `endedMedi !== endedSd` is the THIRD ANSWER the end-state measurement must never fold into an
   * agreement: one engine has stopped the battle and the other has not. */
  const endedSd = !!battle.ended;
  let endedMedi = false;
  try { endedMedi = !!M.battleOver(S); } catch (e) { endedMedi = false; STATE_FAILS.battle_over_threw = (STATE_FAILS.battle_over_threw || 0) + 1; }

  /* ---- THE ROSTER BOTH ENGINES ARE HOLDING WHEN THE GAME STOPS (2026-08-13) ---------------------
   * A DEBUGGING FIELD, carried into the dump only. The `showdown stopped emitting while medicham2
   * continued` class is unreadable without it: the card shows us switching a body in and shows the
   * authority silent, and there is no way to tell from the two streams whether the authority thinks
   * that body is dead, absent, or on a side it has already declared beaten. Both engines are asked
   * the SAME question — every body, is it fainted, at what hp — and Showdown is additionally asked
   * `pokemonLeft`, which is the number `checkWin` actually reads (sim/battle.js:2133). */
  const rosterSnapshot = () => {
    const mediSide = (acts, bench) => [...acts, ...bench].filter(Boolean).map(m =>
      ({ name: id(m.name), key: m._switchKey || null, hp: m.curHP, fainted: !!m.fainted,
         /* WIRE 160 — the ORDER, not just the fact. medicham2 stamps a monotone sequence at every
          * faint site because sim/battle.ts:2603 decides a mutual wipe by which body fainted LAST.
          * `null` on a live body is expected; `null` on a DEAD one means the stamp never ran. */
         faintSeq: (m._faintSeq == null ? null : m._faintSeq),
         where: acts.indexOf(m) >= 0 ? 'active' : 'bench' }));
    const sdSide = side => ({ pokemonLeft: side.pokemonLeft, teamSize: side.pokemon.length,
      mons: side.pokemon.map(p => ({ name: id(p.species.id), hp: p.hp, fainted: !!p.fainted,
                                     where: p.isActive ? 'active' : 'bench' })) });
    try {
      /* WIRE 160 — `battleResult` ITSELF, asked here rather than re-derived by the reader. Every
       * rollout and every H2H reads that one function, so a probe that recomputed "who won" off the
       * roster would be scoring a rule the engine does not actually use — which is exactly how a
       * mutual wipe scoring 0.5 stayed invisible. 1 = A, 0 = B, 0.5 = neither. */
      let mediResult = null;
      /* A THROW HERE IS NOT "NEITHER SIDE WON". `null` is a real verdict this field carries, so a
       * swallowed throw is indistinguishable from a game the engine genuinely could not call — and
       * `final_roster` is the debugging field the unreadable classes are read out of. Counted on the
       * same shelf as `battle_over_threw` one block up, which is where a reader already looks. */
      try { mediResult = M.battleResult(S); }
      catch (e) {
        mediResult = null;
        STATE_FAILS.battle_result_threw = (STATE_FAILS.battle_result_threw || 0) + 1;
        if (!STATE_FAILS.battle_result_threw_why)
          STATE_FAILS.battle_result_threw_why = String((e && e.message) || e).slice(0, 160);
      }
      return { mediResult,
               medicham: { p1: mediSide(S.actA, S.benchA), p2: mediSide(S.actB, S.benchB) },
               showdown: { p1: sdSide(battle.p1), p2: sdSide(battle.p2),
                           winner: battle.winner == null ? null : String(battle.winner) } };
    } catch (e) { return { failed: String((e && e.message) || e).slice(0, 120) }; }
  };
  const finalRoster = rosterSnapshot();

  _lastSdLog = battle.log.slice();
  /* THE RULER FOR BAND 3, GATHERED FROM THE AUTHORITY'S OWN NARRATION OF THIS GAME. Collected only in
   * end-state mode, because it is only that mode's threshold and a protocol-mode run would pay for an
   * array it never reads. It is deliberately taken from `battle.log` and not from medicham2's trace:
   * a threshold made out of our own damage figures would move whenever the thing being measured moved,
   * which is a ruler made of the object. */
  const sdHitFracs = [], sdHitFails = {};
  if (END_STATE) { ESS.collectHits(battle.log, sdHitFracs, sdHitFails);
                   for (const [k, v] of Object.entries(sdHitFails)) HIT_FAILS[k] = (HIT_FAILS[k] || 0) + v; }
  harvest(trace, S);
  for (const m of bodiesSeen) { bump(OBSERVED.species, id(m.name)); bump(OBSERVED.abilities, id(m.ability)); if (m.item) bump(OBSERVED.items, id(m.item)); }
  /* ROADMAP #31 — READ OFF THE TWO STREAMS, not off a counter kept beside them, for the same reason
   * traceCounts parses rather than tallies: a counter maintained next to the thing it counts is a
   * second implementation of "what happened" and will eventually disagree with it. Both engines are
   * counted so a choice that reached one and not the other is visible as an ASYMMETRY rather than as
   * a divergence somewhere downstream. */
  const megaMedi = trace.filter(l => /^\|-mega\|/.test(String(l)));
  const megaSd = battle.log.filter(l => /^\|-mega\|/.test(String(l)));
  const capable = [pairA, pairB].filter(p => p.some(x => isStone(x.spec.item))).length;
  return { config: cfgId, seed: seedTag, arm: ARM.id, turns, lines: trace.length, err, div: firstDiv, mediTrace: trace,
           /* ROADMAP #290 — see `speedAgree`. `speedDesync` is NOT a finding about speed; it is the
            * index-parallel assumption failing, and it is reported apart so it cannot be read as one. */
           speedRows, speedDesync, speedCensus, lastMoveRows,
           /* the number of REDUCED line pairs the aligner actually walked. `lines` above is the RAW
            * medicham count and is not a substitute: see plantedProof. */
           comparedWalked,
           /* THE STATE RESULT, beside the protocol one so the two can be read against each other on the
            * same game rather than across two runs. `stateDiv === null` with `boundaries > 1` is a game
            * whose boards never parted. */
           boundaries, boundariesAgreed, stateDiv: firstStateDiv, stateShape, divTurn,
           earlyBoards, earlyClicks,
           /* THE END STATE (2026-08-12). `finalBoard` is the LAST board compared — null when no
            * boundary was ever taken, which is a third answer and not a zero. `endedMedi`/`endedSd`
            * are each engine's own verdict on whether the battle is over, kept apart on purpose. */
           finalBoard: lastBoard, endReason, endedMedi, endedSd, finalRoster, sdHitFracs, sdHitFails,
           megaMedi: megaMedi.length, megaSd: megaSd.length, megaCapableSides: capable, megaChoices,
           megaSlotA: megaMedi.filter(l => /\|p[12]a:/.test(l)).length,
           megaSlotB: megaMedi.filter(l => /\|p[12]b:/.test(l)).length,
           megaSidesEvolved: new Set(megaMedi.map(l => String(l).split('|')[2].slice(0, 2))).size };
}

/* A scripted click, resolved against Showdown's own request so an illegal one is impossible. `null`
 * in a slot means "do nothing this turn", which is `pass` on both sides. */
function scripted(script, turn, sd, i, act, side) {
  const step = script[turn];
  const want = step && step[sd] && step[sd][i];
  if (!want) return { pass: true };
  /* A SCRIPT MAY NOW SWITCH: `{ sw: 'espathra' }`. Until 2026-08-08 it could not — every step that was
   * not a move fell through to `pass` — and that single gap blocked THREE separate things at once, all
   * of them about a MOMENT rather than an effect:
   *
   *   - Speed Boost's `activeTurns` gate, which only exists for a body that JUST switched in. The
   *     roster's residual rule claimed to stage it and did not: a LEAD is not newly switched, so the
   *     break aimed at that gate applied cleanly and moved no board. `--reds` caught the prose.
   *   - Hunger Switch's flip, Zero to Hero's switch-OUT transform, and Disguise not getting a second
   *     one on re-entry — every "does it happen at the right moment" question needs an entrant.
   *   - the whole across-a-switch arm: does an item reset, does an ability re-fire, does Intimidate
   *     trigger again on re-entry (it does).
   *
   * FOUR OF THE SIX ENGINE BUGS FOUND ON 2026-08-07 WERE ABOUT A MOMENT AND NOT AN EFFECT, and a
   * single-turn scenario with no entrant cannot express one.
   *
   * THE KEY IS THE SAME ONE THE CHOOSER USES — `id(species.id)`, which `buildPair` also stamps as
   * `_switchKey` on the medicham body, so both engines resolve the ask identically. That mattered
   * enough to be its own fix in 3.75.1, where the two sides were matching on different keys and both
   * failing SILENTLY. Legality is still Showdown's to judge: an ask naming a body that is fainted,
   * already active or absent resolves to `pass` at the two call sites below AND IS COUNTED THERE. */
  if (want.sw) return { switchTo: id(want.sw) };
  /* ROADMAP #174 -- THIS FALLBACK WAS SILENT, AND IT COST TWELVE GREEN ROWS THAT PROVED NOTHING.
   *
   * A scripted click that is not on Showdown's request -- the body never learned the move, or the
   * request disabled it -- fell through to `pass`. BOTH engines then pass, the boards agree, and the
   * scenario reports IDENTICAL while testing nothing whatsoever. That is how `tests/test-assert-mode.js`
   * could stay green with Good as Gold and Levitate DELETED from the engine: six of its twelve moves
   * were never on the clicker's request at all, so no turn ever aimed anything at the ability.
   *
   * THE `pass` STAYS -- refusing here would throw mid-game and a scenario author cannot always know
   * what a request will offer -- but it is COUNTED and NAMED now, on the same pattern as
   * `scriptMegaRefused` directly below, so a caller can assert its own script actually ran. A silent
   * default looks exactly like a working feature (CLAUDE.md); this is the loud version. */
  const k = (act.moves || []).findIndex(mv => id(mv.id) === id(want.m));
  if (k < 0) {
    scriptMoveNotOnRequest++;
    if (!scriptMoveFirstMissing) scriptMoveFirstMissing = String(want.m) + ' (offered: '
      + (act.moves || []).map(mv => mv.id).join(',') + ')';
    return { pass: true };
  }
  const dm = dex.moves.get(id(want.m));
  let target = null;
  const tt = (act.moves[k] && 'target' in act.moves[k]) ? act.moves[k].target : dm.target;
  if (tt === 'normal' || tt === 'any' || tt === 'adjacentFoe') target = (want.t == null ? 0 : want.t) + 1;
  else if (tt === 'adjacentAlly') target = -((i === 0 ? 1 : 0) + 1);
  else if (tt === 'adjacentAllyOrSelf') target = -(i + 1);
  /* A SCRIPT MAY ASK TO MEGA EVOLVE, and until 2026-08-07 it could not — the auto-mega block below
   * skipped every scripted game wholesale, so eleven mega rows of the census were unreachable by any
   * staged scenario and Fairy Aura had to be found in random play instead.
   *
   * THE SKIP ITSELF WAS RIGHT and is kept: a staged scenario is a controlled experiment, and a driver
   * that spontaneously megas would move the board out from under the author. What was missing is the
   * OPT-IN. `{ m: 'moonblast', t: 0, mega: true }` now asks, and the request answers.
   *
   * LEGALITY STILL COMES FROM SHOWDOWN'S OWN REQUEST — `act.canMegaEvo`, the same field the auto
   * policy reads — because a driver that decided for itself would be a second copy of the rule. And a
   * REFUSED ask is COUNTED rather than dropped: silently ignoring `mega: true` would hand back a green
   * scenario that never tested the thing it was written for, which is this project's signature
   * failure. The counter is asserted by the scenario file, not merely printed. */
  let mega = false;
  if (want.mega) {
    if (act.canMegaEvo) mega = true;
    else scriptMegaRefused++;
  }
  /* `target` IS UNCHANGED AND IS STILL WHAT SHOWDOWN RECEIVES. The authority already accepted `-1`
   * and played the turn correctly; the bug was entirely in what OUR side was handed. See `aimOf`. */
  return { move: dm.id, slot: k + 1, target, mega, aim: aimOf(target, i) };
}
/* Asks to mega that Showdown's request refused. MUST read 0 in any run whose scenarios ask for one. */
let scriptMegaRefused = 0;
/* ROADMAP #174 -- scripted clicks that were not on the request and became a `pass`. MUST read 0 in
 * any run whose scenarios claim to have clicked something; a non-zero says the script did not run,
 * whatever the verdicts say. The FIRST one is kept with the list it was offered instead, because a
 * bare count sends the reader back to guess which row it was. */
let scriptMoveNotOnRequest = 0, scriptMoveFirstMissing = '';

/* Pick ONE action for one active slot. Legal actions come from Showdown's request; the choice among
 * them is the coverage rule. */
/* ---- MIRRORING A FORCED SWITCH ------------------------------------------------------------------
 *
 * ANSWER SHOWDOWN'S REPLACEMENT REQUEST WITH WHAT MEDICHAM2 ACTUALLY DID, or say it cannot be done.
 * `forceSwitch` is Showdown's own array (one entry per active slot); `mine` is medicham2's actives
 * for that side AFTER `battleTurn` has refilled what it could; `roster` is `side.pokemon`.
 *
 * TWO EMPTY SLOTS MAY NOT BE FILLED FROM ONE BODY, and until 2026-08-22 this had no memory of what
 * the other slot had just taken. `chooseAction` carries a `claimed` set for exactly this reason; this
 * did not — so on a DOUBLE KO against a side down to its last usable body both slots resolved to the
 * same bench index and the harness said "switch 4, switch 4". Showdown refuses that outright ("The
 * Pokémon in slot 4 can only switch in once"), eight times, once per the caller's `guard++ < 8`, and
 * every refusal was discarded. `requestState` stayed `switch` and the next turn reported *"showdown
 * stopped asking for a move"* — an instrument manufacturing a divergence and filing it against the
 * engine. One reproduced game, `2654714554 vs 2654812667` / baseline / middle, was published as a
 * 128-line divergence on exactly that; answered `pass, switch 4` the two engines agree on all 136
 * lines and both end the battle.
 *
 * CLAIMED BY BENCH INDEX, not by species id as `chooseAction` claims. Same shape, stricter key: the
 * constraint is SHOWDOWN'S and Showdown states it about a SLOT. Species-keying would be sound only
 * for as long as Species Clause holds, which is a fact about the format taken from memory rather than
 * from the request in hand.
 *
 * THERE IS NO BLIND FALLBACK, and its removal is the substance of the fix rather than tidying. The
 * old `roster.findIndex(q => !q.isActive && !q.fainted)` is SHOWDOWN PICKING ITS OWN REPLACEMENT —
 * the one thing the caller's header says must never happen — and it manufactured a divergence in both
 * directions: a duplicate when the two slots collided, and a body medicham2 never brought in when
 * they did not.
 *
 * THE THREE ANSWERS FOR A SLOT, and they are counted apart because they mean different things:
 *   `switch n`  medicham2 put a live body there and Showdown can put it there too.
 *   `pass`      medicham2 could not fill it either — its slot is empty, or holds a corpse. Showdown
 *               budgets exactly this many passes (`clearChoice`: canSwitchOut - min(out, in)), so it
 *               is legal precisely when it is true.
 *   cannot      medicham2 has a LIVE body there that Showdown will not put on the field. Either the
 *               species is not on Showdown's side at all (the two engines disagree about the body's
 *               NAME — the alias failure `lookupMiss` counts, and it must read 0), or it is there and
 *               fainted/active (they disagree about what is ALIVE — the boards have parted). Neither
 *               has an answer that reproduces our placement, so the caller stops the game. */
function mirrorForcedSwitch(forceSwitch, mine, roster) {
  const claimed = new Set();
  const out = { picks: [], switched: 0, passed: 0, lookupMiss: 0, cannot: null };
  (forceSwitch || []).forEach((need, i) => {
    if (!need) { out.picks.push('pass'); return; }
    const body = mine && mine[i];
    const live = !!(body && !body.fainted);
    /* `rosterKey`, NOT `body.name`. The name is display state and seven abilities in this format
     * rewrite it mid-game; a renamed body used to be a body NOTHING COULD ASK FOR, so the mirror
     * reported `cannot`, the driver stopped the game, and three staged scenarios came back SHORT.
     * See the rosterKey header and tests/test-roster-identity.js. */
    const want = live ? rosterKey(body) : null;
    const j = want == null ? -1
      : roster.findIndex((q, n) => !claimed.has(n) && !q.isActive && !q.fainted
                                   && rosterKey(q) === want);
    if (j >= 0) { claimed.add(j); out.switched++; out.picks.push('switch ' + (j + 1)); return; }
    if (!live) { out.passed++; out.picks.push('pass'); return; }
    const named = roster.some(q => rosterKey(q) === want);
    if (!named) out.lookupMiss++;
    if (!out.cannot) {
      out.cannot = 'slot ' + (i + 1) + ' holds ' + want + ', which showdown '
                 + (named ? 'has but cannot switch in (fainted/active)' : 'does not have under that name');
    }
    out.picks.push('pass');
  });
  return out;
}

function chooseAction(battle, side, i, act, axis, claimed) {
  claimed = claimed || new Set();
  const p = side.active[i];
  const foes = (side.foe && side.foe.active) || [];
  const cands = [];
  (act.moves || []).forEach((mv, k) => {
    if (mv.disabled) return;
    const dm = dex.moves.get(mv.id);
    if (!dm || !dm.exists) return;
    const banned = axis.ban ? axis.ban.has(dm.id) : false;
    /* WHICH SLOT THE CLICK NEEDS COMES FROM THE REQUEST, NOT FROM THE DEX ROW. Curse is `normal` on
     * a Ghost and `self` on everything else, and the dex row cannot know which body is holding it —
     * `Can't move: You can't choose a target for Curse` was a rejected choice and a thrown game, i.e.
     * the harness testing a position the game cannot reach. `activeRequest` already resolved it. */
    let target = null;
    /* AND AN ABSENT `target` ON THE REQUEST ENTRY MEANS "DO NOT NAME ONE". Showdown omits the field
     * entirely for a LOCKED move — the second turn of Solar Beam or Phantom Force — because the target
     * was chosen when the move was started. Falling back to the dex row there supplied a target and
     * Showdown rejected the choice: `Can't move: You can't choose a target for Solar Beam`, four
     * thrown games. `'target' in mv` is the authority answering; `mv.target || dm.target` was a guess. */
    const tt = ('target' in mv) ? mv.target : null;
    if (tt === null) { /* locked: no target field at all */ }
    else
    if (tt === 'normal' || tt === 'any' || tt === 'adjacentFoe') {
      const j = foes.findIndex(q => q && !q.fainted);
      if (j < 0) return;                       // no legal target: not a legal action
      target = j + 1;
    } else if (tt === 'adjacentAlly') {
      const j = side.active.findIndex((q, n) => q && !q.fainted && n !== i);
      if (j < 0) return;
      target = -(j + 1);
    } else if (tt === 'adjacentAllyOrSelf') {
      target = -(i + 1);
    }
    const want = covWant('moves', dm.id);
    /* THE SAME TRANSLATION THE SCRIPT USES. This chooser has its own `adjacentAlly` and
     * `adjacentAllyOrSelf` branches and had the identical hole: it built a legal `move n -1` for
     * Showdown and handed medicham2 nothing. One `aimOf` for both, because two implementations of
     * "who did this click name" is what produced the disagreement in the first place. */
    cands.push({ move: dm.id, slot: k + 1, target, banned, aim: aimOf(target, i),
                 want: want === Infinity ? 1e6 : want,
                 prefer: axis.prefer && axis.prefer.has(dm.id) ? 1 : 0,
                 clicks: CLICKS.get(dm.id) || 0 });
  });
  /* switching is a legal action too, and it is the largest single source of NEW entities.
   * `maybeTrapped` counts as trapped: Showdown sets it when the switch MIGHT be refused, and offering
   * one it then rejects throws the whole game away — a position the game cannot reach, which is the
   * same argument the move-legality block above makes. `claimed` holds what this side's OTHER slot has
   * already taken; nobody may switch in twice. */
  if (!act.trapped && !act.maybeTrapped) {
    side.pokemon.forEach(q => {
      if (q.isActive || q.fainted) return;
      /* MINTED THROUGH THE ONE DOOR. `switchTo` is the ask BOTH engines then resolve, so if it
       * were minted from display state the two sides would be asking different questions again —
       * which is the whole defect, one level up. */
      const qk = rosterKey(q);
      if (claimed.has(qk)) return;
      /* ---- THE STEERING COUNTER IS NOT AN IDENTITY, AND IT DELIBERATELY DID NOT MOVE ----------
       * `clicks` is a BANDIT COUNTER the coverage steering reads to prefer the least-clicked body.
       * It is not asked "which of the four is this"; it is asked "how bored am I of this key". So it
       * keeps the expression it has always had — showdown's CURRENT species, which for a mega'd body
       * is `tyranitarmega` and not `tyranitar`.
       *
       * MEASURED, BECAUSE THE ALTERNATIVE LOOKED LIKE A REGRESSION. Re-keying this counter onto the
       * roster identity merges a mega'd body's history with its base's, which changes WHICH ACTION
       * the driver prefers, which changes which games part: the pinned 961-game run went 22 -> 27
       * parted with 8 newly-parting games and 3 that stopped parting, and NOT ONE of the seven new
       * causes was a switch line. Holding this one expression put it back to 22 parted, 63258 switch
       * indices and 3 unmirrorable — byte-for-byte the before leg. So the fix above moves the pool by
       * EXACTLY ZERO, and the +5 was the ruler, not the engine.
       *
       * RE-KEYING IT IS A CHANGE TO THE SAMPLE, WHICH IS MEASURE'S TO MAKE, NOT A MECHANICS BATCH'S. */
      const steerKeyNotAnIdentity = id(q.species.id);
      cands.push({ switchTo: qk, want: 1e6, prefer: 0, banned: false,
                   steer: steerKeyNotAnIdentity,
                   clicks: (CLICKS.get('switch:' + steerKeyNotAnIdentity) || 0) * 6 });
    });
  }
  if (!cands.length) {
    /* ROADMAP #81 WIRE 7 — see FORCED_FIRST_SLOT. `pass` is not a legal answer to a request that
     * offers a move, and answering it throws the game away. `move 1` is. The medicham side is given a
     * bare `{kind:'pass'}` for the same decision: its own recharge gate refuses the turn before any
     * action is dispatched, so there is one decision here and two spellings of it, exactly as the mega
     * choice is one decision and two spellings. */
    if (act.moves && act.moves.length) {
      FORCED_FIRST_SLOT++;
      return { move: id(act.moves[0].id), slot: 1, target: null, aim: null, forced: true };
    }
    return { pass: true };
  }
  const allowed = cands.filter(c => !c.banned);
  let pool = allowed;
  if (!pool.length) {
    /* THE CONFIG BANNED EVERY LEGAL CLICK. Counted and reported rather than quietly falling through —
     * a silent default here looks exactly like a working omission. */
    BAN_FALLBACKS++;
    pool = cands;
  }
  pool.sort((a, b) => (b.prefer - a.prefer) || (a.want - b.want) || (a.clicks - b.clicks)
                   || String(a.move || a.switchTo).localeCompare(String(b.move || b.switchTo)));
  const pick = pool[0];
  /* THE CENSUS ROW IS NOT TOUCHED HERE ANY MORE (ROADMAP #91). This used to call `creditClick`, which
   * marked the row exercised on the strength of the click alone. Both the credit AND the attempt are
   * now recorded at the turn boundary by `creditTurn`, where the board is — and where a SCRIPTED game,
   * which never reaches this function, is counted too. */
  if (pick.move) CLICKS.set(pick.move, (CLICKS.get(pick.move) || 0) + 1);
  /* `pick.steer` — the bandit counter's key, NOT the roster identity. See the cands.push above for
   * why the two are deliberately different and what re-keying it cost when it was tried. */
  else { const _sk = pick.steer || pick.switchTo;
         CLICKS.set('switch:' + _sk, (CLICKS.get('switch:' + _sk) || 0) + 1); }
  return pick;
}

/* ---- CLASSIFICATION ------------------------------------------------------------------------------
 * §5: the report must read `turn order — 12 games, 3 distinct causes`, because twelve instances of
 * one turn-order bug is ONE WIRE and not twelve findings.
 *
 * THE CLASS IS DERIVED FROM THE TWO STREAMS, NOT FROM A TABLE OF EVENT NAMES. A hand-written map
 * would have to be extended for every event and would silently mis-file the one it had not seen. The
 * rule is a LOOKAHEAD: if each side's line reappears shortly on the other side, the two engines
 * emitted the same events IN A DIFFERENT ORDER; if only one reappears, one engine emitted an extra
 * line or omitted one; if neither does and the event names match, a FIELD is wrong. */
const LOOKAHEAD = 10;
function classify(d) {
  const sdAt = d.sdAfter, meAt = d.meAfter;
  /* A TRUNCATION HAS NO SECOND LINE TO COMPARE, AND IT IS ITS OWN CLASS.
   *
   * One side stopped emitting. There is no pair of heads to diff, so every test below would throw on
   * an empty slice — and folding it into `event missing from medicham2` would be wrong anyway: that
   * class means we skipped a line and carried on, this one means we stopped. Same index, different
   * bug, and the second is worse, because everything the authority did afterwards is unmeasured
   * rather than merely different. Named separately so it cannot hide inside the largest class. */
  if (d.truncated) {
    const alive = d.truncated === 'medicham2' ? sdAt[0] : meAt[0];
    const ev = String(alive || '').split('|')[1] || '?';
    const cls = d.truncated === 'medicham2'
      ? 'medicham2 stopped emitting while showdown continued'
      : 'showdown stopped emitting while medicham2 continued';
    return { cls, detail: 'first unmatched: ' + ev + '   lengths sd=' + d.lengths.showdown
                        + ' medi=' + d.lengths.medicham,
             cause: cls + ' :: ' + String(alive || '').replace(/(p[12][ab]):[^|]*/g, '$1').replace(/\d+\/\d+/g, 'H/H') };
  }
  const sdHead = sdAt[0], meHead = meAt[0];
  const sdEv = sdHead.split('|')[1], meEv = meHead.split('|')[1];
  const sdLater = meAt.indexOf(sdHead) > 0;    // showdown's line turns up later on our side
  const meLater = sdAt.indexOf(meHead) > 0;    // our line turns up later on showdown's side
  let cls, detail;
  if (sdLater && meLater) { cls = 'ordering'; detail = meEv + ' before ' + sdEv; }
  else if (sdLater)       { cls = 'extra event emitted by medicham2'; detail = meEv; }
  else if (meLater)       { cls = 'event missing from medicham2'; detail = sdEv; }
  else if (sdEv === meEv) {
    const a = sdHead.split('|'), b = meHead.split('|');
    let f = -1;
    for (let k = 2; k < Math.max(a.length, b.length); k++) if (a[k] !== b[k]) { f = k; break; }
    /* FIELD 2 IS THE ACTING BODY, and when the event is `move` that is not "a field differs", it is
     * §5's own example: *an out-of-order `|move|` pair is turn order*. Naming it `move field 2` would
     * file the single most consequential class in the format under a field index. */
    if (f === 2 && sdEv === 'move') { cls = 'turn order'; detail = a[2] + ' moved first, we moved ' + b[2]; }
    else if (f === 2) { cls = sdEv + ': a different body'; detail = a[2] + ' vs ' + b[2]; }
    else { cls = sdEv + ' field ' + f; detail = sdEv + '[' + f + '] ' + a[f] + ' vs ' + b[f]; }
  } else { cls = 'unrelated event mismatch'; detail = sdEv + ' vs ' + meEv; }
  /* THE CAUSE is the class made specific but SPECIES-BLIND, so twelve games hitting one wire through
   * twelve different Pokemon collapse to one cause instead of twelve.
   *
   * AND IT MUST NOT GENERALISE AWAY THE THING THAT DIFFERED. The first version replaced every `n/m`
   * with `H/H`, which made a damage-amount divergence print as `|-damage|p2a|H/H <> |-damage|p2a|H/H`
   * — two identical strings offered as the explanation of a difference. When the generalisation
   * collapses the two lines onto each other, the raw values are appended. */
  const gen = s => String(s).replace(/(p[12][ab]):[^|]*/g, '$1').replace(/\d+\/\d+/g, 'H/H');
  const ga = gen(sdHead), gb = gen(meHead);
  const raw = ga === gb ? '  [values differ: ' + sdHead + ' vs ' + meHead + ']' : '';
  return { cls, detail, cause: cls + ' :: ' + ga + ' <> ' + gb + raw };
}

/* ---- THE PLANTED-DIVERGENCE PROOF ----------------------------------------------------------------
 * tests/test-game-diff.js's trap 4, one instrument over. A comparator that finds nothing must first
 * prove it can find something: a silent zero is a broken comparator, not a clean engine, and that is
 * this project's signature failure. Two plants, because the aligner has two distinct failure modes —
 * a WRONG FIELD it could miss by comparing loosely, and a MISSING EVENT it could miss by resyncing. */
/* THE PLANT MUST LAND INSIDE THE AGREEING PREFIX, and the first version did not — which is why this
 * comment exists rather than a shorter one.
 *
 * The first version planted on CONTENT ("corrupt the first `-damage` on p2a"). Every real game in this
 * swarm already diverges, most of them inside ten lines, so a content plant usually landed AFTER the
 * game had already parted and the proof reported CAUGHT for a divergence it had not caused. Combined
 * with the body-reuse bug above it printed "caught at line 0" three times and looked healthy.
 *
 * So the plants are INDEXED off the clean run's own divergence: whatever the game is, the last line
 * before it parts is a line both engines produced identically, and mutating THAT must be caught
 * STRICTLY EARLIER than the clean divergence. That property is what makes the catch attributable, and
 * it holds for any game rather than for the one the plant was written against. */
/* EVERY PLANT IS A NO-OP UNTIL THE STREAM IS LONG ENOUGH, and that guard is not defensive coding.
 * `alignAndCheck` runs once per turn AND once before turn 1, when the trace holds only the four
 * `|switch|` lines. Unguarded, the FIELD plant indexed past the end and threw (reported as NOT
 * CAUGHT), and the SWAP plant wrote `undefined` into the stream and was "caught" at the line it had
 * corrupted by accident rather than at the line it meant to swap — a proof passing for the wrong
 * reason, on the same run as one failing for the wrong reason. */
/* THE PLANT IS AIMED IN REDUCED SPACE AND APPLIED IN RAW SPACE. `k` is an index into the COMPARED
 * stream, and the plant mutates the stream the engine emitted, so it maps through `reduce`'s own
 * index table rather than assuming the two are the same array — which they stopped being the moment
 * the semantic layer landed. It mutates FIELD 2, the body identifier, because no equivalence rule
 * drops that field: a plant a normaliser can erase proves the opposite of what it is for. */
/* THE BEND IS CHECKED AGAINST THE NORMALISER, NOT ASSUMED TO SURVIVE IT. 2026-08-12, and the comment
 * directly above already said why: *"a plant a normaliser can erase proves the opposite of what it is
 * for"*. It bent field 2 by APPENDING, and field 2 is a body identifier whose canonical form is the
 * SLOT -- `p1a: Snorlax` reduces to `p1a` -- so `p1a: SnorlaxXX` reduces to `p1a` too on every line
 * whose identifier carries a name. MEASURED: on the proof pair this run picked, the FIELD plant
 * reported `applied: 1, caught: false` -- placed, then erased, and described in words that read exactly
 * like a comparator that cannot see a divergence.
 *
 * THE APPEND IS STILL TRIED FIRST, so every pair on which this proof already passed is byte-identical.
 * A line NO candidate can bend past the normaliser returns null: `|upkeep` has no field 2 at all, and
 * it is a very common last-agreeing line. `bendableBefore` below is what handles that, rather than a
 * plant that pretends. */
function bendField2(line) {
  const base = semantic(line);
  const alt = (f) => { const p = String(line).split('|'); if (p.length <= 2) return null; p[2] = f(p[2]); return p.join('|'); };
  for (const c of [alt(x => x + 'XX'), alt(x => 'XX' + x), alt(() => 'p9z: PLANTED')]) {
    if (c === null) continue;
    const t = semantic(c);
    if (t !== null && t !== base) return c;
  }
  return null;
}
/* THE LAST AGREEING LINE AT OR BEFORE `k-1` THAT A FIELD PLANT CAN ACTUALLY LAND ON, walked backwards
 * over the CLEAN stream. `|upkeep` carries no body identifier, so "bend a field on the last agreeing
 * line" is not always a sentence that can be obeyed; obeying it as far as it goes and REPORTING THE
 * INDEX USED is honest, while aiming at a line that cannot carry the plant reports a working
 * comparator as a broken one. Returns -1 when no line in the prefix can carry it. */
function bendableBefore(rawStream, k) {
  const m = reduce(rawStream).rawIdx;
  for (let j = Math.min(k - 1, m.length - 1); j >= 0; j--) if (bendField2(rawStream[m[j]]) !== null) return j;
  return -1;
}
function plantsFor(k, fieldK) {
  /* AN OUT-OF-RANGE AIM IS NORMAL AND MUST STAY A NO-OP, AND A PLANT THAT NEVER LANDED AT ALL IS A
   * BROKEN INSTRUMENT. 2026-08-12, and the two were indistinguishable until today.
   *
   * `alignAndCheck` runs at EVERY turn boundary and the plant is applied on each call, so on the first
   * call -- the leads, before turn 1 -- the stream is about five lines long and an aim at line 92
   * cannot be placed. That is not a fault: the plant simply lands later, once the stream has grown.
   * Making it throw looked like a tightening and broke all three plants outright, which is how this
   * comment came to be written.
   *
   * SO IT IS COUNTED INSTEAD. `applied` is bumped every time a plant actually mutates the stream, and
   * a plant that finishes the game with `applied === 0` reports THAT as its cause rather than arriving
   * as a bare NOT CAUGHT. "The plant was never placed" and "the comparator cannot see a planted
   * divergence" are the same row otherwise, and only the second condemns the run. */
  const at = (s, j) => { const m = reduce(s).rawIdx; return j >= 0 && j < m.length ? m[j] : -1; };
  /* THE BEND IS CHECKED AGAINST THE NORMALISER, NOT ASSUMED TO SURVIVE IT. 2026-08-12, and this file's
   * own comment eight lines up already said why: *"a plant a normaliser can erase proves the opposite
   * of what it is for"*. It bent field 2 by APPENDING, and field 2 is a body identifier whose canonical
   * form is the slot -- `p1a: Snorlax` reduces to `p1a` -- so `p1a: SnorlaxXX` reduces to `p1a` TOO on
   * every line whose identifier carries a name. MEASURED: on the proof pair this run picked, the FIELD
   * plant reported `applied: 1, caught: false` -- placed, then erased, and reported in words that read
   * exactly like a comparator that cannot see a divergence.
   *
   * THE APPEND IS STILL TRIED FIRST so every pair on which the proof already passed is byte-identical.
   * A line no candidate can bend past the normaliser returns null, and the plant then reports NOT
   * PLACED rather than pretending. */
  const st = [{ applied: 0 }, { applied: 0 }, { applied: 0 }];
  return [
    ['a wrong FIELD on the last agreeing line', fieldK,
      s => { const i = at(s, fieldK); if (i < 0) return s;
             const bent = bendField2(s[i]); if (bent === null) return s; st[0].applied++;
             const t = s.slice(); t[i] = bent; return t; }, st[0]],
    ['a MISSING event — the last agreeing line deleted', k - 1,
      s => { const i = at(s, k - 1); if (i < 0) return s; st[1].applied++;
             const t = s.slice(); t.splice(i, 1); return t; }, st[1]],
    ['two agreeing events SWAPPED — the ordering class must fire', k - 2,
      s => { const i = at(s, k - 1), j = at(s, k - 2); if (i < 0 || j < 0) return s; st[2].applied++;
             const t = s.slice(); const x = t[j]; t[j] = t[i]; t[i] = x; return t; }, st[2]],
  ];
}
/* THE FOUR ARMS OF THE PROOF MUST BE THE SAME GAME, and they were not. The driver is COVERAGE-SEEKING
 * and therefore STATEFUL: `CLICKS` and `COV_HITS` carry across games on purpose, so the second run of
 * one team pair deliberately clicks something else. That is right for the swarm and fatal for a
 * proof — the FIELD plant reported NOT CAUGHT because the planted arm was a different game that
 * happened not to part where the clean one did. Frozen and restored around each arm. */
/* THE DRIVER'S WHOLE STATE, IN ONE PLACE. It grew a second map when credit split from attempts
 * (ROADMAP #91), and a snapshot that restored one and not the other would silently unfreeze the
 * steering — which is the exact bug this function exists to prevent, one layer down. */
function driverSnap() { return { c: new Map(CLICKS), cr: new Map(COV_CREDIT), at: new Map(COV_ATTEMPT),
                                 kd: new Map(CREDIT_KIND), tc: new Set(COV_TOUCHED),
                                 ft: new Map(COV_FIRST_TURN), bt: new Map(CREDIT_BY_TURN) }; }
function driverRestore(s) {
  const put = (m, v) => { m.clear(); for (const [k, x] of v) m.set(k, x); };
  put(CLICKS, s.c); put(COV_CREDIT, s.cr); put(COV_ATTEMPT, s.at); put(CREDIT_KIND, s.kd);
  put(COV_FIRST_TURN, s.ft || new Map()); put(CREDIT_BY_TURN, s.bt || new Map());
  COV_TOUCHED.clear(); for (const k of s.tc) COV_TOUCHED.add(k);
}
function driverReset() { driverRestore({ c: new Map(), cr: new Map(), at: new Map(),
                                         kd: new Map(), tc: new Set(),
                                         ft: new Map(), bt: new Map() }); }
function withFrozenDriver(fn) {
  const s = driverSnap();
  try { return fn(); }
  finally { driverRestore(s); }
}
function plantedProof(pairA, pairB) {
  const clean = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'proof/clean'));
  /* THE NO-DIVERGENCE BRANCH READ `clean.lines` AND THAT IS THE WRONG UNIT. 2026-08-12. `k` is an
   * index into the REDUCED stream -- `plantsFor`'s `at()` maps it through `reduce().rawIdx` -- and
   * `lines` is `trace.length`, the RAW medicham count. The compared region is shorter at both ends:
   * `reduce` drops declared-not-emitted lines, and the aligner stops at the SHORTER of the two
   * reduced streams. So on a pair whose clean arm agrees all the way, `k-1` landed PAST the last line
   * the two engines ever compared, the FIELD and MISSING plants bent a line nobody looked at, and both
   * reported NOT CAUGHT -- an instrument declaring itself broken because its aim was out of range.
   *
   * THIS WAS NOT AN ENGINE REGRESSION AND WAS CHECKED RATHER THAN ASSUMED: the identical three rows
   * come out of `--release a81663f17c0c`, the frozen pre-change engine, on the same pair. The branch
   * had simply never been reached before -- every earlier proof pair's clean arm diverged, so `k` came
   * from `div.index`, which has always been in the right unit. That path is untouched here. */
  const k = clean.div ? clean.div.index : clean.comparedWalked;
  const cleanRow = { what: 'the CLEAN arm of the same game', caught: !!clean.div,
                     at: clean.div ? clean.div.index : null, agreeing_prefix: k,
                     cls: clean.div ? classify(clean.div).cls : null };
  if (k < 3) return [{ what: 'CANNOT PLANT — the clean game parts after only ' + k + ' lines, so there '
                             + 'is no agreeing prefix to plant inside', caught: false, at: null }, cleanRow];
  /* The FIELD plant gets its OWN aim, because not every line can carry it. See bendableBefore. */
  const fieldK = bendableBefore(clean.mediTrace, k);
  return plantsFor(k, fieldK).map(([what, expectAt, plant, st]) => {
    const r = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'proof/' + what.slice(0, 12), { plant }));
    return { what, caught: !!r.div, at: r.div ? r.div.index : null, expected_at: expectAt,
             earlier_than_clean: !!r.div && r.div.index < k,
             /* CARRIED ONTO THE ROW so a plant that was never placed names itself instead of arriving
              * as a bare NOT CAUGHT, and so a plant that was placed but not seen cannot hide behind
              * the same words. See plantsFor. */
             applied: st.applied,
             err: r.err || null,
             cls: r.div ? classify(r.div).cls : null };
  }).concat([cleanRow]);
}

/* ---- THE PLANTED *STATE* DIVERGENCE PROOF ---------------------------------------------------------
 *
 * The plants above corrupt the PROTOCOL STREAM. They say nothing about whether the board comparator
 * works, and the whole reason this pass exists is that an instrument nobody had shown catching the
 * thing it claims to catch was steering ten wires. 168 red demonstrations exist in this project, 0 have
 * failed, and FIVE probes this week were found resting on the defect they were meant to watch.
 *
 * So: ONE PLANT PER COMPARED FIELD FAMILY, applied to the LIVE MEDICHAM BOARD at a boundary the clean
 * arm AGREED at, and each must be
 *   - CAUGHT, at
 *   - EXACTLY that boundary (or the catch might be the game's own divergence), and
 *   - LOCALISED to the field that was planted (a comparator that detects without localising is a
 *     scoreboard, which is what §5 of the design rejects for the protocol side too).
 *
 * THE PLANT GOES THROUGH THE READER. It writes `S.actA[0].curHP`, not a snapshot field, so the whole
 * path — engine body, reader, mapping, comparator — is what gets proved. A plant applied to the
 * comparator's output would prove only that subtraction works.
 *
 * EVERY PLANT IS UNCONDITIONAL. A plant that needed a Substitute to already be up would silently not
 * run in most games and report "caught 0 times" as a pass; each one below SETS the state it is testing.
 */
/* EVERY MUTATION RETURNS WHETHER IT WAS APPLIED, and an unapplied plant FAILS the proof rather than
 * quietly not counting. "The body it wanted was not on the field" reads exactly like "the comparator
 * found nothing", and treating the two the same is the silent-default shape this whole file is
 * defensive about. */
const bumpVol = (m, k, v) => { if (!m) return false; (m._vol = m._vol || {})[k] = v; return true; };
const volOf = (m, k) => ((m && m._vol && m._vol[k]) || 0);
/* A PLANT MUST NOT BE ABLE TO BE INVISIBLE, and three of them were.
 *
 * `board_state.js` reads a dead body's status as `fnt` WHATEVER its status field says — that is the
 * `fainted-is-not-a-status` mapping, and it is right. So writing `brn` onto a corpse changes no
 * compared leaf, the plant is applied, nothing is caught at that boundary, and the proof reports
 * "caught at boundary 7, planted at 6" — which reads as a comparator that cannot localise and was a
 * plant aimed at a body that could not show it. The same is true of HP: `Math.max(0, curHP - 1)` on a
 * body already at 0 is a no-op.
 *
 * `living` picks a body that can actually carry the plant and returns null when there is none, so the
 * plant reports NOT APPLIED — loudly failing — rather than silently landing on a corpse. Found by
 * tests/test-state-differential.js going red on 2026-08-07 after the sample moved under it. */
const living = (list, from) => {
  for (let i = from || 0; i < list.length; i++) if (list[i] && !list[i].fainted && list[i].curHP > 0) return list[i];
  for (let i = 0; i < (from || 0); i++) if (list[i] && !list[i].fainted && list[i].curHP > 0) return list[i];
  return null;
};
/* EITHER SIDE, PREFERRING THE FOE'S — 2026-08-18, AND IT WAS FOUR RED CLAUSES.
 *
 * Four plants read `living(S.actB)` and the plant boundary is the LAST AGREEING one, which on a game
 * that ends in a sweep is a board where SIDE B HAS NO LIVING ACTIVE BODY AT ALL. All four reported
 * NOT APPLIED — status, the toxic stage, the sleep counter and the untouched-PP blind spot — so four
 * compared field families had NO live demonstration behind them, which `tests/test-state-differential.js`
 * correctly refuses to score as a pass.
 *
 * THE SIDE WAS NEVER THE CLAIM. Each of those plants asserts that the COMPARATOR catches a difference
 * in one leaf; `p2` was variety, not meaning. Falling back to `p1` keeps the demonstration and changes
 * nothing about what is being demonstrated. It is a FALLBACK, so it is loud rather than silent: the
 * side actually used is reported per plant (`planted_on`), and a plant that can find no living body on
 * EITHER side still returns false and still fails the proof. */
const livingEither = (S) => {
  const b = living(S.actB || []);
  if (b) return b;
  PLANT_FELL_BACK_TO_P1++;
  return living(S.actA || []);
};
let PLANT_FELL_BACK_TO_P1 = 0;
/* A body on the BENCH that has NOT fainted, which is the population the widened party map compares.
 * `board_state.js` holds the post-faint leaves where either engine calls the body down (the authority
 * clears boosts, volatiles and status on a faint and medicham2 does not), so a plant onto a corpse
 * would be correctly IGNORED and would read as a broken comparator. */
const benchedLiving = (S, side) => {
  const sf = side === 'B' ? S.sfB : S.sfA, act = (side === 'B' ? S.actB : S.actA) || [];
  for (const m of ((sf && sf.team) || [])) {
    if (act.indexOf(m) >= 0) continue;
    if (m.fainted || !(m.curHP > 0)) continue;
    return m;
  }
  return null;
};
/* AND IT HAS TO BE ABLE TO CROSS SIDES, FOR THE REASON `livingEither` DOES — MEASURED, NOT ASSUMED.
 *
 * The plant boundary is the LAST AGREEING board, which is late in the game by construction. Staged on
 * the proof pair and printed rather than guessed at: at boundary 4 side A's bench is
 * `primarina[FNT]  froslassmega[FNT]` and side B's is `sableye hp125  gholdengo hp162`. So the three
 * plants aimed at side A reported NOT APPLIED and the two aimed at side B applied — a split that
 * reads like a broken comparator and is a fact about the FIXTURE. (Will has taught this twice: a
 * COULD-NOT-STAGE verdict is a claim about the fixture, never about the mechanic.)
 *
 * THE SIDE IS NOT THE CLAIM. Each plant asserts the comparator catches a difference in ONE LEAF on a
 * BENCHED, LIVING body; which side that body sits on carries no meaning. A dead bench cannot serve,
 * because `board_state.js` deliberately holds the post-faint leaves — so a plant onto a corpse would
 * be correctly IGNORED and would read as a comparator that failed.
 *
 * LOUD, NOT SILENT: the flip is recorded per plant and published as `fell_back_to_the_other_side`, and
 * a plant that finds no living benched body on EITHER side still returns false and still fails the
 * proof. */
let PLANT_SIDE_FLIP = false;
const benchedLivingEither = (S, side) => {
  const first = benchedLiving(S, side);
  if (first) return first;
  const other = benchedLiving(S, side === 'B' ? 'A' : 'B');
  if (other) PLANT_SIDE_FLIP = true;
  return other;
};
/* AN ACTIVE SLOT THAT IS ACTUALLY STANDING, AND THE SLOT INDEX IT ENDED UP IN — 2026-08-25, MEASURE.
 *
 * THE SEVEN VOLATILE PLANTS OF THE 2026-08-12 SWEEP WROTE STRAIGHT INTO `S.actB[0]` / `S.actB[1]`
 * WITHOUT ASKING WHETHER ANYBODY WAS STANDING THERE, and `board_state.js` holds the whole post-faint
 * group — `item, status_counter, boosts, ability, vol, stall` — on a body both engines call dead. So
 * the plant landed on a corpse, moved no compared leaf, and reported NOT CAUGHT. That reads as seven
 * blind spots in the comparator and was seven plants aimed at bodies that could not carry them: on the
 * proof pair of the committed artifact, side B's board at the plant boundary is
 * `tyranitar-mega hp0 [FNT]  milotic hp0 [FNT]` and every benched body on both sides is a corpse too.
 * MEASURED, not argued: handing the SAME seven mutate functions a living body catches all seven,
 * localised, at the same boundary (docs/_reports/2026-08-25-planted-state-proof.md).
 *
 * This is the same correction `livingEither` made for four other plants on 2026-08-18, one slot over,
 * and it is not a loosening: the plant returns the slot it actually used, so the localisation assertion
 * is exactly as tight as `active[0].vol.taunt` was — it just names the slot the body is in rather than
 * the slot the table hoped for. THE SIDE AND THE SLOT WERE NEVER THE CLAIM; the LEAF is. */
const livingSlot = (S, side, from) => {
  const pick = (list) => {
    const m = living(list || [], from);
    return m ? { m, i: (list || []).indexOf(m) } : null;
  };
  const first = pick(side === 'B' ? S.actB : S.actA);
  if (first) return first;
  const other = pick(side === 'B' ? S.actA : S.actB);
  if (other) PLANT_SIDE_FLIP = true;
  return other;
};
/* THE PLANT WRITES THROUGH THE CANONICAL `bumpVol` AND NAMES ITS OWN PATH. One helper rather than
 * seven copies of the same four lines — a second copy of a fact is what this repo has a rule about. */
const volPlant = (S, side, from, key, value) => {
  const r = livingSlot(S, side, from);
  if (!r) return false;
  return bumpVol(r.m, key, value(r.m)) && 'active[' + r.i + '].vol.' + key;
};
const STATE_PLANTS = [
  ['HP off by one on an active body', 'active',
   S => { const m = living(S.actA); return !!m && ((m.curHP = Math.max(0, m.curHP - 1)), true); }],
  ['a stat stage off by one', 'boosts.atk',
   S => !!S.actA[0] && ((S.actA[0].boosts.at += 1), true)],
  ['a status that is not there', 'status',
   S => { const m = livingEither(S); return !!m && ((m.status = m.status === 'brn' ? 'par' : 'brn'), true); }],
  ['the TOXIC stage off by one', 'status_counter',
   S => { const m = livingEither(S); return !!m && ((m.status = 'tox'), (m.toxTurns = (m.toxTurns || 0) + 3), true); }],
  ['the SLEEP counter off by one', 'status_counter',
   S => { const m = living(S.actB, 1) || livingEither(S); return !!m && ((m.status = 'slp'), (m.slpTurns = (m.slpTurns || 0) + 2), true); }],
  ['an item that is not held', 'active[1].item',
   S => !!S.actA[1] && ((S.actA[1].item = S.actA[1].item ? '' : 'leftovers'), true)],
  ['a body marked fainted that is not', 'active[1].fainted',
   S => !!S.actB[1] && ((S.actB[1].fainted = !S.actB[1].fainted), true)],
  ['a different species on the field', 'active[0].species',
   S => !!S.actA[0] && ((S.actA[0].name = S.actA[0].name === 'ditto' ? 'smeargle' : 'ditto'), true)],
  ['the WEATHER counter off by one', 'field.weather_turns',
   S => ((S.field.weatherT = (S.field.weatherT || 0) + 1), true)],
  ['a weather that is not there', 'field.weather',
   S => ((S.field.weather = S.field.weather === 'sand' ? 'rain' : 'sand'), true)],
  ['the TERRAIN counter off by one', 'field.terrain_turns',
   S => ((S.field.terrainT = (S.field.terrainT || 0) + 1), true)],
  ['the TRICK ROOM counter off by one', 'field.trickroom_turns',
   S => ((S.field.tr = (S.field.tr || 0) + 1), true)],
  ['the TAILWIND counter off by one', 'p1.tailwind',
   S => ((S.field.twA = (S.field.twA || 0) + 1), true)],
  /* WRITTEN INTO WHICHEVER SHAPE THE FROZEN ENGINE HAS. Pre-WIRE-8 releases hold two category
   * counters and later ones hold named conditions; a plant that only knew one shape would be a
   * no-op on five of the thirteen releases and would report as caught-by-the-game. */
  /* THE EXPECTED FIELD IS `screens.` AND NOT `screens.physical`, and that is a correction rather than
   * a loosening. `physical` is the MAX over the physical-side screens, so with an Aurora Veil already
   * up at 5 turns a Reflect moved from 0 to 1 leaves the projection at 5 and moves only
   * `screens.named.reflect` — which board_state.js documents as the one lossy place in the projection
   * and is exactly why the named block is compared as well. Localising to `screens.named.reflect` is
   * the comparator working; demanding `screens.physical` was the assertion assuming the lossy half. */
  ['a SCREEN counter off by one', 'screens.',
   S => { if (S.sfA.sc) S.sfA.sc.reflect = (S.sfA.sc.reflect || 0) + 1;
          else S.sfA.scrP = (S.sfA.scrP || 0) + 1; return true; }],
  ['a HAZARD layer off by one', 'hazards.spikes',
   S => { S.sfA.hz = S.sfA.hz || {}; S.sfA.hz.spikes = (S.sfA.hz.spikes || 0) + 1; return true; }],
  ['a Substitute that is not there', 'active[0].vol.substitute',
   S => !!S.actA[0] && ((S.actA[0]._sub = (S.actA[0]._sub || 0) + 42), true)],
  /* THESE TWO, AND THE FIVE BELOW, GO THROUGH `volPlant` — see its header. They used to write into a
   * fixed `S.actB[n]` and the slot is a corpse at a late plant boundary more often than not. */
  ['a Taunt counter off by one', 'active[0].vol.taunt',
   S => volPlant(S, 'B', 0, 'taunt', m => volOf(m, 'taunt') + 3)],
  ['an Encore counter off by one', 'active[0].vol.encore',
   S => volPlant(S, 'B', 0, 'encore', m => volOf(m, 'encore') + 3)],
  ['a Disable counter off by one', 'active[1].vol.disable',
   S => bumpVol(S.actA[1], 'disable', volOf(S.actA[1], 'disable') + 4)],
  ['a Leech Seed that is not there', 'active[1].vol.leechseed',
   S => !!S.actA[1] && ((S.actA[1]._seededBy = S.actA[1]._seededBy ? null : { by: S.actB[0], per: 8 }), true)],
  ['a confusion counter off by one', 'active[0].vol.confusion',
   S => bumpVol(S.actA[0], 'confusion', volOf(S.actA[0], 'confusion') + 2)],
  /* PERISH IS ITS OWN FIELD AND NOT `_vol`, so it writes the field the reader actually reads — but it
   * still has to find a body that is STANDING, for the reason in `livingSlot`'s header. */
  ['a Perish count off by one', 'active[1].vol.perish',
   S => { const r = livingSlot(S, 'B', 1); if (!r) return false;
          r.m._perish = (r.m._perish == null ? 0 : r.m._perish) + 2;
          return 'active[' + r.i + '].vol.perish'; }],
  /* ---- THE 2026-08-12 SWEEP: ONE PLANT PER LEAF ADDED, OR THE LEAF IS UNPROVEN ------------------
   * Nine volatiles joined the compared set on this pass. A leaf with no plant behind it is a leaf
   * nobody has ever seen catch anything, which is the whole reason this proof exists — so each one
   * gets its own, written into the LIVE medicham board and expected to be localised to its own path.
   * They flip rather than set, so a body that already carries one is still moved. */
  ['an AQUA RING that is not there', 'vol.aquaring',
   S => bumpVol(S.actA[0], 'aquaring', volOf(S.actA[0], 'aquaring') ? 0 : 1)],
  ['an INGRAIN that is not there', 'vol.ingrain',
   S => bumpVol(S.actA[1], 'ingrain', volOf(S.actA[1], 'ingrain') ? 0 : 1)],
  ['a MAGNET RISE that is not there', 'vol.magnetrise',
   S => volPlant(S, 'B', 0, 'magnetrise', m => volOf(m, 'magnetrise') ? 0 : 1)],
  ['a FOCUS ENERGY that is not there', 'vol.focusenergy',
   S => volPlant(S, 'B', 1, 'focusenergy', m => volOf(m, 'focusenergy') ? 0 : 1)],
  ['a TORMENT that is not there', 'vol.torment',
   S => bumpVol(S.actA[0], 'torment', volOf(S.actA[0], 'torment') ? 0 : 1)],
  ['an IMPRISON that is not there', 'vol.imprison',
   S => bumpVol(S.actA[1], 'imprison', volOf(S.actA[1], 'imprison') ? 0 : 1)],
  ['a SALT CURE that is not there', 'vol.saltcure',
   S => volPlant(S, 'B', 0, 'saltcure', m => volOf(m, 'saltcure') ? 0 : 1)],
  ['a SYRUP BOMB that is not there', 'vol.syrupbomb',
   S => volPlant(S, 'B', 1, 'syrupbomb', m => volOf(m, 'syrupbomb') ? 0 : 1)],
  /* THE CHARGE LOCK IS NOT IN `_vol` — it is its own field, so the plant writes the field the reader
   * actually reads. A plant aimed at the wrong storage would report NOT CAUGHT and read as a broken
   * comparator when it was a broken plant. */
  /* 2026-08-26 -- AND THERE ARE TWO FIELDS NOW, SO THE PLANT WRITES BOTH. medicham2 splits the
   * authority's pair: `_charging` is the sub-volatile (gone at execution) and `_ttmWrap` is the
   * `twoturnmove` wrapper (gone at the residual), and `board_state.js` reads the leaf off the
   * wrapper with `_charging` as an old-release fallback. A plant that flipped only `_charging` would
   * be UNDETECTABLE on any body actually mid-charge -- the wrapper would hold the leaf at 1 -- and
   * would read as a broken comparator when it was a broken plant. That is the same sentence the
   * comment above already had to write once. */
  ['a TWO-TURN CHARGE LOCK that is not there', 'vol.charging',
   S => { const m = living(S.actA); if (!m) return false;
          const on = !!(m._ttmWrap || m._charging);
          m._charging = on ? null : 'solarbeam';
          m._ttmWrap = on ? null : { move: 'solarbeam', dur: 2 };
          return true; }],
  ['a MOVE TRAP counter off by one', 'active[0].vol.trapped_by_move',
   S => !!S.actA[0] && ((S.actA[0]._trap = { turns: ((S.actA[0]._trap && S.actA[0]._trap.turns) || 0) + 3,
                                             frac: 1 / 8, by: S.actB[0] }), true)],
  /* ---- THE PP PLANTS, AND THERE ARE TWO BECAUSE THERE ARE TWO WAYS TO BE WRONG ------------------
   *
   * PP was in `board_state.js`'s NOT_COMPARED until this pass, on a reason that had gone stale: "the
   * engine does not track PP at all" stopped being true at ROADMAP #144 and the declaration outlived
   * it. So PP could have been wrong in every game in every run and no instrument would have said so.
   *
   * THE FIRST PLANT IS THE ORDINARY DIRECTION — a slot the engine has already touched, moved by one.
   * THE SECOND IS THE ONE THE LAZY TABLE MAKES POSSIBLE AND IS WHY IT IS NOT ENOUGH ON ITS OWN: it
   * writes a slot that was NEVER TOUCHED. Our map is lazy, so an untouched move is absent and reads
   * as 0 spent; a comparator that treated absence as "nothing to compare" rather than as 0 would be
   * blind to exactly this, and would look identical to one that worked. Both must be CAUGHT.
   *
   * WRITTEN THROUGH `_pp`, WHICH IS THE ENGINE'S OWN TABLE, so the whole path is proved: engine body,
   * `ppSpentMap`, the mapping, the comparator. `ppMax` is asked for the maximum rather than a number
   * being typed here — a plant carrying its own idea of Protect's PP would be a second copy of a fact.
   * A plant that cannot find a body reports NOT APPLIED and fails the proof, per the rule above. */
  /* THE EXPECTED PATH IS `pp[`, WHICH IS THE SLOT, and it was `pp.` on the first run — both plants
   * came back "caught, NOT LOCALISED" reporting `p1.pp[0].blizzard`. That is the ASSERTION being
   * wrong rather than the comparator, and it is written down because it is the failure this division
   * is warned about: the probe wrong before the engine is. */
  ['PP SPENT off by one on a slot the body has already used', 'pp[',
   S => { const m = living(S.actA); if (!m) return false;
          const k = String((m.moves || [])[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!k || !M.ppMax) return false;
          const mx = M.ppMax(k); if (mx == null) return false;
          m._pp = m._pp || {}; m._pp[k] = Math.max(0, (k in m._pp ? m._pp[k] : mx) - 1); return true; }],
  ['PP SPENT on a slot NOTHING has touched — the lazy-table blind spot', 'pp[',
   S => { const m = livingEither(S); if (!m) return false;
          const mv = (m.moves || []);
          if (!M.ppMax) return false;
          for (let i = mv.length - 1; i >= 0; i--) {
            const k = String(mv[i] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!k || (m._pp && (k in m._pp))) continue;      // must be UNTOUCHED to be the blind spot
            const mx = M.ppMax(k); if (mx == null) continue;
            m._pp = m._pp || {}; m._pp[k] = Math.max(0, mx - 2); return true;
          }
          return false; }],
  ['a BENCHED party member\'s HP off by one', 'party.',
   S => { const t = S.sfA.team || []; const m = t[t.length - 1]; if (!m) return false;
          m.curHP = Math.max(0, m.curHP - 1); return true; }],
  ['a BENCHED party member marked fainted', 'party.',
   S => { const t = S.sfB.team || []; const m = t[t.length - 1]; if (!m) return false;
          m.fainted = !m.fainted; return true; }],
  /* ---- THE BENCH SWEEP OF 2026-08-18: ONE PLANT PER LEAF ADDED, OR THE LEAF IS UNPROVEN ---------
   *
   * `board_state.js`'s party map held `{hp, maxhp, fainted}` and nothing else, so a benched body's
   * item, status, typing and boosts were compared by NOTHING and a difference in one read as
   * agreement — `tests/test-end-state.js` PART 3 had to reject three of five candidate pairs because
   * *"a planted item difference on a body that has walked to the bench is not compared by anything in
   * this repository"*. The map is now wider (the leaves were printed by `tests/probe_bench_leaves.js`
   * over 2,029 benched bodies before any of them was wired), and a leaf with no plant behind it is a
   * leaf nobody has ever seen catch anything — the same rule the volatile sweep above was held to.
   *
   * EACH RETURNS ITS OWN PATH. The party is keyed by SPECIES, so the path is
   * `p1.party.<species>.item` and the species is not knowable when this table is written. A static
   * `party.` would be satisfied by ANY party difference, including the HP one two rows up, and the
   * plant would prove nothing about the leaf it aimed at.
   *
   * EVERY ONE OF THESE IS SILENT IN THE PROTOCOL. Nothing on a bench emits a line; that is exactly
   * why the gap existed and exactly what a STATE comparison is for. */
  ['an ITEM on a BENCHED body that is not held', 'party.',
   S => { const m = benchedLivingEither(S, 'A'); if (!m) return false;
          m.item = m.item ? '' : 'leftovers';
          return 'party.' + id(m.name) + '.item'; }],
  ['a STATUS on a BENCHED body that is not there', 'party.',
   S => { const m = benchedLivingEither(S, 'B'); if (!m) return false;
          m.status = m.status === 'brn' ? 'par' : 'brn';
          return 'party.' + id(m.name) + '.status'; }],
  ['the TOXIC stage off by one on a BENCHED body', 'party.',
   S => { const m = benchedLivingEither(S, 'A'); if (!m) return false;
          m.status = 'tox'; m.toxTurns = (m.toxTurns || 0) + 3;
          return 'party.' + id(m.name) + '.status_counter'; }],
  /* THE TYPING PLANT WRITES A TYPE THE BODY DOES NOT HAVE, chosen from the two it cannot both be, so
   * a body that is already one of them still moves. This is the leaf ROADMAP #225 records as having
   * made the comparison unable to see the worst defect in the register — on the field. On the bench it
   * was uncompared until this pass. */
  ['a TYPING on a BENCHED body that is not its own', 'party.',
   S => { const m = benchedLivingEither(S, 'B'); if (!m) return false;
          const has = (m.types || []).map(t => id(t));
          m.types = has.indexOf('ghost') >= 0 ? ['Normal'] : ['Ghost'];
          return 'party.' + id(m.name) + '.types'; }],
  ['a STAT STAGE off by one on a BENCHED body', 'party.',
   S => { const m = benchedLivingEither(S, 'A'); if (!m) return false;
          m.boosts = m.boosts || {}; m.boosts.at = (m.boosts.at || 0) + 1;
          return 'party.' + id(m.name) + '.boosts.atk'; }],
  /* ROADMAP #307 -- THE SIXTH BENCH LEAF, wired the day the defect under it was fixed rather than the
   * day it was found. `board_state.js` refused this one on purpose while medicham2 kept a traced
   * ability across a switch; with the restore in, the leaf reads 0 of 3,280 benched comparisons and
   * carries its own plant like the other five. The plant writes an ability the body cannot have, so a
   * body that already holds one of the two still moves. */
  ['an ABILITY on a BENCHED body that is not its own', 'party.',
   S => { const m = benchedLivingEither(S, 'B'); if (!m) return false;
          m.ability = id(m.ability) === 'levitate' ? 'sturdy' : 'levitate';
          return 'party.' + id(m.name) + '.ability'; }],
];

function plantedStateProof(pairA, pairB) {
  /* THE CLEAN ARM FIRST, and every plant is judged against it. Its LAST AGREEING boundary is where the
   * plants go: a board both engines produced identically, so a difference there is the plant and
   * nothing else. Same construction as the protocol proof's agreeing prefix, one dimension over. */
  const clean = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'stateproof/clean'));
  const lastAgreeing = clean.stateDiv ? clean.stateDiv.turn - 1 : clean.boundaries - 1;
  const cleanRow = { what: 'the CLEAN arm of the same game', boundaries: clean.boundaries,
                     boundaries_agreed: clean.boundariesAgreed,
                     first_state_divergence_at_turn: clean.stateDiv ? clean.stateDiv.turn : null,
                     planted_at_boundary: lastAgreeing };
  if (lastAgreeing < 0) {
    return { plants: [{ what: 'CANNOT PLANT — the clean game\'s very first board already differs, so '
                            + 'there is no agreeing board to plant into', caught: false }],
             clean: cleanRow, all_ok: false };
  }
  const plants = STATE_PLANTS.map(([what, wantPath, mutate]) => {
    /* ---- `applied` MEANS THE BOARD MOVED WHERE THE COMPARATOR LOOKS — 2026-08-25, ROADMAP #314 ----
     *
     * It used to mean "the mutate callback returned truthy", and those are not the same sentence. The
     * bench-HP plant takes the last party slot and runs `Math.max(0, curHP - 1)`; on a corpse that is
     * a no-op that returns `true`. Seven volatile plants wrote onto whichever body sat in `S.actB[n]`,
     * and `board_state.js` HOLDS the post-faint group on a body both engines call dead. Both reported
     * APPLIED, neither could ever be caught, and the proof read as a comparator with holes in it.
     *
     * A PLANT THAT CANNOT MOVE THE BOARD IS A TEST THAT CANNOT FAIL. So the plant reads medicham's own
     * board either side of the mutation and asks `BS.compare` — the SAME comparator, stamped as the
     * other engine so the real cross-engine rule applies — whether anything it compares moved. This is
     * strictly stronger than the old receipt: nothing that used to be provable stops being provable,
     * and a mutation that changes nothing visible can no longer report itself as a demonstration. */
    let path = wantPath, applied = false, truthy = false, moved = false, flipped = false;
    let r = null, boundary = lastAgreeing;
    const tried = [];
    /* ---- AND IF IT CANNOT LAND AT THE LAST AGREEING BOUNDARY, WALK BACK THROUGH THE OTHERS --------
     *
     * The plant boundary is the LAST board the two engines agreed on, which on a pair whose game ends
     * in a sweep is a board where one side is two corpses and every bench body is dead. On the proof
     * pair of the 2026-08-25 artifact that is exactly the position, and all six BENCH plants reported
     * NOT APPLIED — six compared leaves with no live demonstration behind them, on a fixture fact
     * rather than on anything about the comparator.
     *
     * EVERY BOUNDARY AT OR BELOW `lastAgreeing` IS A BOARD BOTH ENGINES PRODUCED IDENTICALLY, so the
     * defining property of the plant site is unchanged and so is every assertion: caught, AT the
     * boundary planted, and LOCALISED to the planted leaf. THE RETRY IS ON `applied` ONLY. Retrying a
     * plant that landed and was NOT caught would be the one change that could not be made here — it
     * would hide the exact failure this proof exists to expose — and it is not made: the loop stops
     * the moment the board moves, whatever the comparator then does about it. */
    for (let b = lastAgreeing; b >= 0; b--) {
      /* A PLANT MAY NAME ITS OWN PATH, and the party plants have to. `mutate` returning `true` keeps
       * the static `wantPath` — which is every plant written before 2026-08-18 — while a returned
       * STRING replaces it. The party map is keyed by SPECIES, so `p1.party.<species>.item` is not
       * knowable when the table is written, and a static `party.` prefix would be satisfied by ANY
       * party difference: the plant would report LOCALISED while proving nothing about its own leaf. */
      path = wantPath; truthy = false; moved = false;
      PLANT_SIDE_FLIP = false;
      r = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'stateproof/' + what.slice(0, 14), {
        statePlant: (S2, b2, turnIdx) => { if (turnIdx !== b) return;
          const before = BS.readMedi(S2, BS_CTX);
          const res = mutate(S2); truthy = !!res;
          if (typeof res === 'string') path = res;
          if (!truthy) return;
          const after = BS.readMedi(S2, BS_CTX);
          moved = BS.compare(before, Object.assign({}, after, { engine: 'showdown' }), null).length > 0;
        } }));
      flipped = PLANT_SIDE_FLIP; boundary = b; tried.push(b);
      applied = truthy && moved;
      if (applied) break;
    }
    const at = r.stateDiv ? r.stateDiv.turn : null;
    const paths = r.stateDiv ? r.stateDiv.diffs.map(d => d.path) : [];
    const wantPath2 = path;
    return { what, planted_field: wantPath2, applied, caught: !!r.stateDiv, at, expected_at: boundary,
             /* THE FIXTURE RECEIPTS, PRINTED RATHER THAN ABSORBED. `fell_back_to_the_other_side`: the
              * requested side had no body that could carry the plant at this boundary. `planted_at`
              * and `boundaries_tried`: how far back from the last agreeing board this one had to go
              * to find a position that could demonstrate its leaf at all. `callback_returned_truthy`
              * with `applied: false` is the no-op case ROADMAP #314 filed — the plant ran and the
              * board did not move. All three are facts about THIS PAIR, not about the comparator. */
             fell_back_to_the_other_side: flipped,
             callback_returned_truthy: truthy, moved_a_compared_leaf: moved,
             planted_at: boundary, boundaries_tried: tried.length,
             at_the_planted_boundary: at === boundary,
             localised: paths.some(p => p.indexOf(wantPath2) >= 0),
             /* WHAT IT ACTUALLY REPORTED, kept so a "localised: false" can be read rather than
              * guessed at. Capped: one plant on an active body legitimately moves the party row too,
              * because they are the same object. */
             paths: paths.slice(0, 6) };
  });
  return { plants, clean: cleanRow,
           all_ok: plants.every(p => p.applied && p.caught && p.at_the_planted_boundary && p.localised) };
}

/* ---- DIRECTED SCENARIOS — §3.2, and the two findings this harness was built to reproduce ---------
 *
 * The swarm alone never reaches the fringe: Upper Hand is 76 uses and a uniform 1,000-game sample
 * gets it 1.6 times. These are staged on purpose, driven through the SAME aligner as every swarm
 * game, so a finding here is the same kind of object as a finding there.
 *
 * TWO OF THEM ARE PREDICTIONS RATHER THAN DISCOVERIES. docs/GAME-DIFFERENTIAL-DESIGN.md §5a filed
 * both from a hand-run on the night the stream was built, and a harness that cannot reproduce a
 * finding somebody already made by hand is not aligned. */
/* THE DECLARED EXCEPTION, per conformance S12b. The scenarios below name real species, real moves,
 * real items and real abilities, and that is not a hardcode — it is a FIXTURE. A staged two-line
 * scenario cannot be derived from a tag: "an Intimidated attacker landing a guaranteed crit" is a
 * specific board, and docs/GAME-DIFFERENTIAL-DESIGN.md §6 writes it out by name for the same reason.
 * Every probe in tests/test-mechanics.js does likewise.
 *
 * NOTHING HERE DECIDES ANYTHING. The names appear only inside `DIRECTED`, which is a table of staged
 * boards; no membership test, no lookup and no branch in this file reads a name. The swarm's feature
 * sets come from `engine/diff_swarm.js`, which derives them through `names.byTag` and throws on a tag
 * that does not exist. If a name below stopped existing the scenario would fail to build and say so —
 * which is exactly the failure mode S12b exists to prevent, arriving loudly rather than as a silent
 * zero. */
const GAME_RULES = {
  'move:protect': 'fixture only — the partner slot in a staged scenario must click something legal',
  'move:agility': 'fixture only — the body TAKING the staged hit must click something that is not a shield and cannot change the damage',
  'ability:intimidate': 'fixture only — §6\'s acceptance case IS "an Intimidated attacker landing a crit"',
};
void GAME_RULES;
const stage = (rows) => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
/* THE BODY TAKING THE HIT MUST STILL CLICK SOMETHING. Showdown refuses `pass` for a healthy active
 * Pokemon, and it is right to — a position that cannot be reached is a position whose divergence
 * means nothing. It must not be Protect either: Protect is +4 and would block the very hit being
 * staged, which is tests/test-game-diff.js's `fillerFor` lesson (30 pairs where the interaction under
 * test could not happen).
 *
 * AND IT MUST NOT BE IRON DEFENSE EITHER, WHICH IS THE VERSION THIS WAS FIRST WRITTEN AS. The comment
 * said "resolves at priority 0 AFTER the hit, so its boost cannot change the damage" — which is true
 * only when the ATTACKER IS FASTER. Garchomp is 102 base Speed against Incineroar's 60, so in the
 * contact-punish scenario the defender moved first, took Close Combat at +2 Defence, and the interior
 * measurement read `showdown 37..44  medicham 73..86` — a clean factor of two that looked exactly
 * like an engine bug and was the harness boosting the target it was measuring.
 * Agility is the same shape with the stat swapped for one no damage formula here reads. */
const TAKE_IT = 'Agility';
const BENCH = (...names) => names.map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }));
/* ROADMAP #81 WIRE 7 — EACH SCENARIO NOW SAYS WHETHER IT IS STILL EXPECTED TO PART.
 *
 * `predicts` names the CLASS a divergence should land in. It could not say whether there should be a
 * divergence at all, and until tonight there always was — so `tests/test-game-differential.js` read
 * "no longer diverges" as a failure for every one of them. WIRE 7 closed two of the three §5a
 * predictions, and a fixed engine reported as a broken instrument is the worst reading available.
 * `expect: 'agree'` is a CLAIM, not a mute: the test fails just as loudly if one of these parts
 * again. */
const DIRECTED = [
  { name: 'knock-off order — the item leaves before the HP is subtracted (§5a)',
    predicts: 'ordering', expect: 'agree',
    closed_by: 'ROADMAP #81 WIRE 7 — the strip moved below `tg.curHP -= dmg`, which is where '
             + 'Showdown\'s onAfterHit runs it',
    A: stage([['incineroar', '', 'Blaze', ['Knock Off', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'garchomp')),
    B: stage([['snorlax', 'Leftovers', 'Thick Fat', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'weavile')),
    script: [{ p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  /* CLOSED 2026-08-18 (ROADMAP #304), AND THE WAY IT WAS BEING KEPT OPEN IS THE FINDING.
   *
   * This scenario declares `predicts: 'ordering'`. It has never once diverged on an ORDERING cause.
   * Every artifact that recorded it — `data/_r220-gd-pre.json`, `_r220-gd-post.json`,
   * `game-differential-PRE.json` — has it diverging in class **`-damage field 3`**, a NUMBER, at a
   * line before the ordering question is even reached. So `expect: 'diverge'` was being satisfied by
   * the damage-roll defect, and the clause would have gone red the moment that defect was fixed while
   * saying nothing at all about Rough Skin's position in the hit.
   *
   * With #304 landed the whole scripted turn agrees, which is the FIRST time this scenario has been
   * able to answer the question it was staged to ask. The aligner is demonstrably still live on it:
   * PART 2 of tests/test-game-differential.js plants a wrong field, a deleted event and a swapped
   * pair into this same driver and catches all three at the exact planted line. */
  { name: 'contact punish — Rough Skin resolves against the attacker (§5a)',
    predicts: 'ordering', expect: 'agree',
    closed_by: 'ROADMAP #304 — the damage divergence that was standing in for this scenario\'s '
             + 'prediction is gone (the loop selects the authority\'s roll index instead of '
             + 'interpolating a position in the span), and with it out of the way the contact punish '
             + 'resolves at the same point in the hit on both engines',
    A: stage([['incineroar', '', 'Blaze', ['Close Combat', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['garchomp', '', 'Rough Skin', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  { name: 'resist berry — the berry is spent against the hit it resists (§5a)',
    predicts: 'ordering', expect: 'agree',
    closed_by: 'ROADMAP #81 WIRE 7 — the berry is consumed above the strip and writes Showdown\'s '
             + 'own two lines, `[eat]` then `[weaken]`',
    A: stage([['garchomp', '', 'Sand Veil', ['Stomping Tantrum', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['incineroar', 'Shuca Berry', 'Blaze', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'stompingtantrum', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  /* THE REPLACEMENT ORDERING CASE, staged because the acceptance test below needs TWO and WIRE 7
   * closed one of the original two. It is NOT invented for the purpose: `|-prepare|electroshot <>
   * |-boost|spa|1` is the largest surviving ordering cause in data/wire-ladder.json's own
   * `what_remains_at_the_top_rung` (2,579 corpus uses), and Archaludon is its only carrier in this
   * format. Showdown announces the charge and only then the +1 Special Attack; this engine does it
   * the other way round. Lowering the requirement to one instead would have been weakening the
   * acceptance test to fit the news. */
  { name: 'Electro Shot — the charge is announced before the boost it grants',
    predicts: 'ordering', expect: 'agree',
    closed_by: 'ROADMAP #81 WIRE 8 — `|-prepare|` is written FIRST and unconditionally, above the '
             + 'boost and above the weather test, which is the order data/moves.ts:4640 uses',
    A: stage([['archaludon', '', 'Stamina', ['Electro Shot', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['snorlax', '', 'Thick Fat', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'garchomp')),
    script: [{ p1: [{ m: 'electroshot', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
  /* THE SECOND ORDERING CASE, RESTAGED FOR THE SECOND TIME AND FOR THE SAME REASON. The acceptance
   * test below needs TWO scenarios that classify as `ordering`; WIRE 7 closed one of the original two
   * and staged Electro Shot as its replacement, and WIRE 8 closed that one. The bar is not lowered.
   *
   * Like its predecessor this is NOT invented for the purpose: `|-damage|p1b|[from]sandstorm <>
   * |-damage|p1a|[from]sandstorm` is the largest surviving cause in the `ordering` class of
   * data/wire-ladder.json's own top rung, at 10 games. Showdown's residual is SPEED-SORTED across
   * every body on the field (battle.ts residualEvent -> speedSort), so the faster Whimsicott takes
   * its sand chip before the slower Incineroar; medicham2 walks its own slots in order. Tyranitar
   * and Garchomp are Rock and Ground, so only the two bodies whose speeds differ are chipped, and
   * every click is a Protect — nothing here rolls a die. */
  /* CLOSED 2026-08-18, AND IT HAD BEEN CLOSED FOR SOME TIME WITH NOBODY UPDATING THE ROW. `diverged`
   * reads FALSE in every artifact on disk that carries a directed block, including
   * `data/_r220-gd-pre.json`. ROADMAP #218 is what closed it: Showdown resolves BOTH end-of-turn
   * passes in speed order (`sandstorm.onFieldResidual -> eachEvent('Weather')` speed-sorts
   * `getAllActive()`, battle.ts:465) and this engine had speed-sorted the CLOCK pass only, walking
   * `[...actA, ...actB]` in the WEATHER pass. Both loops now ask one function.
   *
   * THE STAGING STILL SEPARATES SLOT ORDER FROM SPEED ORDER — Whimsicott sits in slot B behind a
   * slower Incineroar — so a regression to a slot walk re-opens this row rather than hiding in it. */
  { name: 'the sandstorm residual is speed-sorted, not slot-ordered',
    predicts: 'ordering', expect: 'agree',
    closed_by: 'ROADMAP #218 — the weather residual is speed-sorted through the same function as the '
             + 'clock residual, so the faster body takes its sand chip first on both engines',
    A: stage([['incineroar', '', 'Blaze', ['Protect', 'Knock Off']],
              ['whimsicott', '', 'Chlorophyll', ['Protect', 'Dazzling Gleam']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['tyranitar', '', 'Sand Stream', ['Protect', 'Rock Slide']],
              ['garchomp', '', 'Rough Skin', ['Protect', 'Earthquake']]]).concat(BENCH('corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }] },
  /* CLOSED, NOT DELETED. Will named this on 2026-08-06 ("crit also ignores attackers attack drops")
   * and it was documented-and-unfixed for a day; 3.68.0 wired it. Measured at the fix: an Intimidated
   * Meowscarada landing Flower Trick read 76 and now reads 113, equal to the un-Intimidated 113.
   * The scenario stays in the file with `expect: 'agree'` so it fails LOUDLY if the wire ever regresses
   * — a scenario deleted on the day it passes is a regression nobody will catch. */
  { name: 'Intimidate x guaranteed crit — the crit ignores the attacker\'s -1 (§6)',
    predicts: '-damage field', expect: 'agree',
    closed_by: 'ROADMAP #81 / CHANGELOG 3.68.0 — a crit now ignores the attacker\'s NEGATIVE offensive '
             + 'stages, the defender\'s POSITIVE defensive stages and screens. It still does NOT ignore '
             + 'burn, which is a multiplier rather than a stage and is probed separately.',
    A: stage([['meowscarada', '', 'Overgrow', ['Flower Trick', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile')),
    B: stage([['incineroar', '', 'Intimidate', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax')),
    script: [{ p1: [{ m: 'flowertrick', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }] },
];

function runDirected() {
  return DIRECTED.map(sc => {
    const a = buildPair(sc.A), b = buildPair(sc.B);
    if (!a || !b) return { name: sc.name, predicts: sc.predicts, staged: false };
    const r = playGame(a, b, 'directed', sc.name, { script: sc.script });
    return { name: sc.name, predicts: sc.predicts, expect: sc.expect || 'diverge',
             closed_by: sc.closed_by || null, staged: true, turns: r.turns, err: r.err,
             diverged: !!r.div, at: r.div ? r.div.index : null, agreed: r.div ? r.div.agreedLines : null,
             cls: r.div ? classify(r.div).cls : null,
             showdown: r.div ? r.div.sdRaw : null, medicham: r.div ? r.div.meRaw : null,
             sdAfter: r.div ? r.div.sdAfterRaw.slice(0, 4) : null, meAfter: r.div ? r.div.meAfterRaw.slice(0, 4) : null };
  });
}

/* ---- ROADMAP #80 — THE KNOCK OFF ORDERING IS A DAMAGE BUG, AND IT HAS TWO HALVES ----------------
 *
 * The directed knock-off scenario above shows the ORDER: Showdown subtracts the HP and only then
 * takes the item, medicham2 takes the item first. Will identified the consequence and it was checked
 * against the pinned checkout rather than recalled:
 *
 *     data/moves.ts:9962   onBasePower  -> getItem(); if (item.id) chainModify(1.5)   BEFORE damage
 *                          onAfterHit   -> takeItem(); add('-enditem', ...)           AFTER  damage
 *
 * TWO BERRIES SIT ON OPPOSITE SIDES OF THAT LINE AND GIVE OPPOSITE ANSWERS:
 *
 *   COLBUR BERRY (items.ts:1133) is `onSourceModifyDamage` — INSIDE the damage calculation. It eats
 *   itself and halves a super-effective Dark move. So Showdown takes Knock Off's 1.5x, halves the
 *   result while the berry consumes itself, and `onAfterHit`'s takeItem() then finds NOTHING and
 *   emits NO `-enditem` at all. Net 0.75x. Because medicham2 strips the item first, COLBUR CAN NEVER
 *   FIRE FOR IT — full super-effective damage where Showdown deals half.
 *   SITRUS BERRY (items.ts:5740) is `onUpdate` — it tests hp <= maxhp/2 AFTER the hit, by which time
 *   takeItem() has run, so Showdown DOES strip it before it can proc. Opposite result, same move,
 *   same turn. A probe that tests one of these proves nothing about the other.
 *
 * SO THE TWO HALVES ARE ASSERTED SEPARATELY AND NEVER ON THE FINAL HP. If the 1.5x is also evaluated
 * after removal, the lost boost and the lost halving PARTIALLY CANCEL, and the net error ends up small
 * enough that nothing flags it — the worst outcome, because it looks like agreement.
 *
 *   arm 0   target holds NOTHING          D0
 *   arm 1   target holds an inert item    D1     BOOST HALF     D1 / D0 must be 1.5
 *   arm 2   target holds Colbur Berry     D2     REDUCTION HALF D2 / D1 must be 0.5
 */
const KO_TARGET_ITEMS = [['', 'no item at all — the baseline the 1.5x is measured against'],
                         ['Leftovers', 'an inert held item — Knock Off\'s onBasePower sees it, nothing else does'],
                         ['Colbur Berry', 'onSourceModifyDamage — it fires INSIDE the damage calculation']];
function knockOffArms() {
  const out = [];
  for (const [item, why] of KO_TARGET_ITEMS) {
    /* Gengar is Ghost/Poison, so Knock Off is super-effective and Colbur is in scope. */
    const A = stage([['incineroar', '', 'Blaze', ['Knock Off', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile'));
    const B = stage([['gengar', item, 'Cursed Body', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax'));
    const script = [{ p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }];
    const a = buildPair(A, { hpBoost: 8 }), b = buildPair(B, { hpBoost: 8 });
    if (!a || !b) { out.push({ item, why, staged: false }); continue; }
    const sd = oneHitDamage(a, b, script, { sdRoll: 0 });
    const me = mediSpan(a, b, script);
    /* did Knock Off announce taking the item, in each engine? */
    const g = playGame(a, b, 'directed', 'ko/' + (item || 'none'), { script });
    const sdLines = sdStream(gLogOf(g));
    /* WHICH `-enditem` — the berry eating ITSELF or Knock Off taking it — is the whole question, so
     * the two are kept apart. A bare "was there an -enditem" answers yes in both engines for
     * opposite reasons, which is a check that cannot fail. */
    const tag = (lines) => lines.filter(l => /\|-enditem\|/.test(l));
    out.push({ item, why, staged: true, showdown: sd, medicham: me ? me.max : null,
               showdown_enditem: tag(sdLines), medicham_enditem: tag(g.mediTrace),
               showdown_stream: sdLines, medicham_stream: g.mediTrace });
  }
  /* THE SITRUS HALF, WHICH IS THE OPPOSITE CASE AND NEEDS ITS OWN HP POOL. Sitrus is `onUpdate` and
   * tests hp <= maxhp/2 AFTER the hit, by which time Showdown's takeItem() has run — so Showdown
   * strips it and it never procs. It needs a pool the Knock Off drops BELOW half without killing, so
   * it cannot ride on the ratio arms above (which are inflated x8 precisely so nothing dies). */
  const sitrus = (() => {
    const A = stage([['incineroar', '', 'Blaze', ['Knock Off', 'Protect']]]).concat(BENCH('clefable', 'milotic', 'weavile'));
    const B = stage([['gengar', 'Sitrus Berry', 'Cursed Body', [TAKE_IT, 'Protect']]]).concat(BENCH('toxapex', 'corviknight', 'snorlax'));
    const script = [{ p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }];
    const a = buildPair(A, { hpBoost: 3 }), b = buildPair(B, { hpBoost: 3 });
    if (!a || !b) return { staged: false };
    const g = playGame(a, b, 'directed', 'ko/sitrus', { script });
    const sd = sdStream(gLogOf(g));
    const heal = (lines) => lines.filter(l => /\|-heal\|.*sitrus/i.test(l));
    const end = (lines) => lines.filter(l => /\|-enditem\|/.test(l));
    return { staged: true,
      what: 'Knock Off takes Sitrus BEFORE its onUpdate can see the HP, so it must NOT heal',
      showdown_healed: heal(sd).length > 0, medicham_healed: heal(g.mediTrace).length > 0,
      showdown_enditem: end(sd), medicham_enditem: end(g.mediTrace) };
  })();
  const num = (i, j) => (out[i].showdown && out[j].showdown ? +(out[i].showdown / out[j].showdown).toFixed(3) : null);
  const mnum = (i, j) => (out[i].medicham && out[j].medicham ? +(out[i].medicham / out[j].medicham).toFixed(3) : null);
  return { arms: out, sitrus_half: sitrus,
    boost_half:     { what: 'Knock Off x1.5 when the target HOLDS an item — measured against the no-item arm',
                      showdown: num(1, 0), medicham: mnum(1, 0), expected: 1.5 },
    reduction_half: { what: 'Colbur Berry x0.5 against a super-effective Dark move — measured against the inert-item arm',
                      showdown: num(2, 1), medicham: mnum(2, 1), expected: 0.5 },
    net:            { what: 'the two multiplied — 0.75. Quoted LAST, because asserting only this is how '
                          + 'a lost boost and a lost halving cancel into something nobody flags',
                      showdown: num(2, 0), medicham: mnum(2, 0), expected: 0.75 } };
}
/* the Showdown log of a played game, kept off `playGame`'s return shape so nothing else grows a
 * dependency on it. */
let _lastSdLog = [];
const gLogOf = () => _lastSdLog;

/* ---- THE DAMAGE INTERIOR, MEASURED RATHER THAN ASSERTED ------------------------------------------
 * The second filed prediction: `tests/test-engine-diff.js` compares `roll=0` against MEDICHAM's min
 * and `roll=15` against its max, so 149/150 is compatible with every one of the fourteen middle
 * rolls being off, AND with every roll's probability being wrong. Mode A had to confront this to
 * choose a pin at all (see the header), so the honest thing is to MEASURE the interior rather than
 * quote the header.
 *
 * For one staged hit: enumerate all 16 Showdown rolls by pinning `random(16)` to each index in turn,
 * and all of medicham2's values by pinning its rng to each of its own integers. Then compare the two
 * as MULTISETS — the design's claim is about multiplicities, not about the span. */
/* ONE STREAM SWEEPS, THE OTHER FOUR ARE HELD WHERE THEY CANNOT FIRE — ROADMAP #304.
 * `rngStreams` takes a struct, so this is the honest way to move one die: `acc` is compared `< chance`
 * so 0 always hits, `crit` is compared `< critChance` so 0.999 never crits (no rolled crit rate in
 * this format is above 1/2), `sec` likewise, `stall` decides a shield nobody raises in these scripts.
 * The alternative — one scalar for everything — is what this file's own header records as having
 * silently critted the bottom of a damage sweep. */
function inertExcept(which, u) {
  const S = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
              dmg: () => 0.5, stall: () => 0.999, split: true, seed: null };
  S[which] = () => u;
  return S;
}
function damageInterior(sc) {
  const a = buildPair(sc.A), b = buildPair(sc.B);
  if (!a || !b) return null;
  const sdVals = [];
  for (let roll = 0; roll < 16; roll++) {
    const v = oneHitDamage(a, b, sc.script, { sdRoll: roll });
    if (v != null) sdVals.push(v);
  }
  /* MEDICHAM'S SIDE IS THE BATTLE LOOP, SWEPT BY DIE POSITION — ROADMAP #304, AND IT USED TO BE THE
   * SPAN, WHICH IS NOW THE WRONG QUESTION.
   *
   * It read `dmgRange`'s min..max and enumerated every integer between them with the comment
   * "sampled UNIFORMLY by the engine". That WAS true and it is not any more: the loop selects
   * `rolls[damageRollIndex(u)]`, one of the authority's sixteen, so the RANGE is still min..max while
   * the reachable set is the band inside it. Left as it was, this block would have gone on publishing
   * "6 values only medicham can roll" for ever — a defect report that outlived the defect, which is
   * exactly the shape CLAUDE.md keeps recording. It is now what the LOOP emits.
   *
   * THE SCALAR SWEEP THIS FUNCTION ABANDONED IS NOT BEING REINTRODUCED. The old comment is right that
   * one scalar drives the crit roll too, so its bottom silently critted. The streams are held APART
   * instead: `dmg` sweeps, `crit`/`acc`/`sec`/`stall` sit where they cannot fire. That is a
   * measurement of the thing it names.
   *
   * THIS IS A SUMMARY, NOT THE GATE. tests/test-damage-roll-support.js is the outcome-level probe for
   * #304 — nine staged hits, both categories, a resist, a 4x, an item after the die, a spread — and
   * it stages its own Showdown side. This block exists so the ARTIFACT carries the same claim. */
  const meVals = [];
  for (let i = 0; i < 16; i++) {
    const u = (16 - 1 - i + 0.5) / 16;                     // the position that selects index i
    const v = oneHitDamage(a, b, sc.script, { mediStreams: inertExcept('dmg', u) });
    if (v == null) return null;
    meVals.push(v);
  }
  const uniq = arr => [...new Set(arr)].sort((x, y) => x - y);
  const sdSet = uniq(sdVals), meSet = uniq(meVals);
  const count = arr => { const m2 = new Map(); for (const v of arr) m2.set(v, (m2.get(v) || 0) + 1); return m2; };
  const sdC = count(sdVals), meC = count(meVals);
  /* BOTH SIDES ARE NOW SIXTEEN DRAWS, so the probability of a value is its multiplicity over 16 in
   * each engine and the comparison is between two distributions of the same shape. Reported as the
   * largest absolute difference over the union of the two supports. */
  let worstP = 0, worstAt = null;
  for (const v of uniq([...sdSet, ...meSet])) {
    const p1 = (sdC.get(v) || 0) / sdVals.length, p2 = (meC.get(v) || 0) / meVals.length;
    if (Math.abs(p1 - p2) > worstP) { worstP = Math.abs(p1 - p2); worstAt = v; }
  }
  return { name: sc.name, sd_span: [sdSet[0], sdSet[sdSet.length - 1]], me_span: [meSet[0], meSet[meSet.length - 1]],
           sd_distinct: sdSet.length, me_distinct: meSet.length,
           endpoints_agree: sdSet[0] === meSet[0] && sdSet[sdSet.length - 1] === meSet[meSet.length - 1],
           values_showdown_can_produce_that_medicham_cannot: sdSet.filter(v => !meSet.includes(v)),
           values_medicham_can_produce_that_showdown_cannot: meSet.filter(v => !sdSet.includes(v)),
           worst_probability_gap: +worstP.toFixed(4), worst_at: worstAt };
}
/* medicham2's own damage span for the staged hit, read from the engine's own `dmgRange` after
 * `battleInit` has applied the entry abilities — so an Intimidate on the field is priced in. */
function mediSpan(pairA, pairB, script) {
  const A = freshBodies(pairA), B = freshBodies(pairB);
  if (A.some(x => !x) || B.some(x => !x)) return null;
  const S = M.battleInit(A, B, {});
  const w = script[0].p1[0]; if (!w) return null;
  const mv = (globalThis.MC && globalThis.MC.moves) ? globalThis.MC.moves[id(w.m)] : null;
  if (!mv) return null;
  const spread = M.MEDI_SPREAD ? M.MEDI_SPREAD.has(id(w.m)) : false;
  const d = M.dmgRange(S.actA[0], S.actB[0], mv, S.field, spread);
  return d && d.max >= d.min ? { min: d.min, max: d.max } : null;
}

/* One staged turn, one engine, one roll. Returns the HP the defender lost. */
function oneHitDamage(pairA, pairB, script, opt) {
  if (opt.sdRoll != null) {
    const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
    battle.setPlayer('p1', { name: 'A', team: Teams.pack(pairA.map(x => x.sd)) });
    battle.setPlayer('p2', { name: 'B', team: Teams.pack(pairB.map(x => x.sd)) });
    const bA = freshBodies(pairA), bB = freshBodies(pairB);
    for (const [side, pair, built] of [[battle.p1, pairA, bA], [battle.p2, pairB, bB]]) for (const p of side.pokemon) {
      const k = pair.findIndex(x => id(x.sd.species) === id(p.species.id)); if (k < 0) continue;
      const st = built[k].st;
      p.storedStats.atk = st.at; p.storedStats.def = st.df; p.storedStats.spa = st.sa;
      p.storedStats.spd = st.sd; p.storedStats.spe = st.sp;
      p.baseStoredStats.atk = st.at; p.baseStoredStats.def = st.df; p.baseStoredStats.spa = st.sa;
      p.baseStoredStats.spd = st.sd; p.baseStoredStats.spe = st.sp;
      const full = p.hp === p.maxhp; p.maxhp = st.hp; p.baseMaxhp = st.hp; if (full) p.hp = st.hp;
    }
    battle.prng.random = (m2, n2) => (n2 === undefined && m2 === 16 ? opt.sdRoll : pinRandom(m2, n2));
    battle.prng.randomChance = (num, den) => (den === 16 ? opt.sdRoll < num : PIN_CHANCE(num, den));
    if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
    const before = battle.p2.active[0].hp;
    const step = script[0];
    const mk = (side, acts) => side.active.map((p, i) => {
      const w = acts[i]; if (!p || !w) return 'pass';
      const k = p.set.moves.findIndex(mv => id(mv) === id(w.m)); if (k < 0) return 'pass';
      const dm = dex.moves.get(id(w.m));
      const needs = ['normal', 'any', 'adjacentFoe'].includes(dm.target);
      return 'move ' + (k + 1) + (needs ? ' ' + ((w.t == null ? 0 : w.t) + 1) : '');
    }).join(', ');
    battle.choose('p1', mk(battle.p1, step.p1)); battle.choose('p2', mk(battle.p2, step.p2));
    return before - battle.p2.active[0].hp;
  }
  const A = freshBodies(pairA), B = freshBodies(pairB);
  const S = M.battleInit(A, B, {});
  const before = S.actB[0].curHP;
  const step = script[0];
  const mk = (own, foes, acts) => { const map = new Map();
    own.forEach((mon, i) => { const w = acts[i]; if (!mon) return;
      if (!w) { map.set(mon, { kind: 'pass' }); return; }
      map.set(mon, M.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
    return map; };
  /* `mediStreams` (ROADMAP #304) hands over a per-category struct instead of one scalar, so a caller
   * can move ONE die and leave the other four inert. `mediRoll` still works and still means "every
   * stream is this number", which is what every caller before #304 asked for. */
  M.battleTurn(S, opt.mediStreams || (() => opt.mediRoll), mk(S.actA, S.actB, step.p1), mk(S.actB, S.actA, step.p2));
  return before - S.actB[0].curHP;
}

/* ---- RUN ----------------------------------------------------------------------------------------- */
/* THE POOL IS SIZED BY THE BUDGET, NOT BY THE STOPPING RULE. A coverage run cannot know in advance how
 * many games it will want, so it asks for its BACKSTOP up front; running out of pool before the stall
 * fires is a truncation and is reported as one. Sizing the pool from `--games` in this mode would cap
 * the sweep at the arbitrary number the whole rule exists to replace. */
/* THE CLOSET IS OURS AND IT WAS NEVER APPLIED TO THE SAMPLE — WILL, 2026-08-13: *"we are still having
 * zoroarks thats banned remember"*. He is right, and the ban is not the format's: Showdown says
 * `zoroark isNonstandard: null, tier: UU`, so it is perfectly legal to bring. **WE** shelved it —
 * ROADMAP #160, Illusion in the closet, and Will earlier the same night: *"we banned zoroark remember
 * for 5. its too confusing for our simple engine"*.
 *
 * The decision was recorded and never enforced. The dump taken minutes before this line carries **42
 * Zoroark appearances**, and every divergence they cause is a body pretending to be another body —
 * unreadable as a rule defect, which is the entire reason it was shelved.
 *
 * DERIVED FROM THE ABILITY, NOT FROM A NAME. `illusion` is the mechanic; Zoroark and Zoroark-Hisui are
 * merely who carries it today. A name list would miss a carrier added next regulation, which is the
 * hand-maintained-list failure this repo has a standing rule about.
 *
 * IT IS A DECLARED GAP, NOT A SILENT ONE. The count is stamped into the artifact so a reader can see
 * the sample was narrowed and by how much — an exclusion nobody can see is indistinguishable from a
 * mechanic that never came up. */
const CLOSET_ABILITY = 'illusion';
const CLOSET_SPECIES = (() => {
  const legal = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
  const out = new Set();
  for (const s of dex.species.all()) {
    if (!legal(s)) continue;
    if (Object.values(s.abilities).some(a => dex.toID(a) === CLOSET_ABILITY)) out.add(dex.toID(s.name));
  }
  return out;
})();
/* WHAT THE SHELF REMOVED, RECORDED PER CONFIGURATION AND *SET*, NEVER ADDED TO.
 *
 * This was `let CLOSET_DROPPED = 0`, incremented inside `pairsFor` — and `pairsFor('baseline')` runs
 * TWICE on every run, once for the planted-divergence proof and again through the scheduler's pair
 * cache, so the baseline configuration's drops were counted a second time. The dump published
 * `teams_dropped: 51` for a pool that rejects 43 teams. A count of CALLS wearing the name of a count
 * of TEAMS is exactly the shape this instrument exists to catch, and it was in the instrument.
 *
 * Keyed by configuration and overwritten on each call, so the number is a property of the POOL and
 * cannot depend on how many times anything asked for it. `tests/test-closet-scope.js` pairs
 * `baseline` twice and asserts the declared count does not move. */
const CLOSET_DROPS = new Map();          /* cfgId -> [{ team, carriers:[{species,slot}], sheet_length }] */
function closetHits(team) {
  const out = [];
  (team || []).forEach((m, i) => {
    const sid = dex.toID((m && (m.spec ? m.spec.species || m.spec.name : m.species || m.name)) || '');
    if (CLOSET_SPECIES.has(sid)) out.push({ species: sid, slot: i });
  });
  return out;
}
function closetRejects(team) { return closetHits(team).length > 0; }

/* THE ONE DECLARATION. The measurement artifact, the debugging dump and the console all render THIS
 * object; three renderings of one fact cannot disagree, three hand-written blocks eventually do.
 *
 * `says` is the printed sentence AND IT IS NEVER BLANK. A closet that shelved nothing reads exactly
 * like a closet with no members unless it says so out loud — the roster's shelf was fixed to that bar
 * on 2026-08-25 and this is the same bar one instrument over. */
function closetDeclaration() {
  const rows = [];
  for (const [config, ds] of CLOSET_DROPS) for (const d of ds) rows.push(Object.assign({ config }, d));
  const byConfig = {};
  for (const r of rows) byConfig[r.config] = (byConfig[r.config] || 0) + 1;
  /* WHERE ON THE SHEET THE CARRIER SAT, because that is the fact that says whether the exclusion is
   * the right SIZE. A pair brings the first PAIR_BODIES buildable bodies; a carrier at a later slot
   * is dropped for a body that never enters either engine's battle. Published as the raw histogram
   * rather than as a verdict — the count of teams that would survive a narrower rule is measured by
   * building them, which this function must not do (buildPair moves five other declared counters). */
  const slots = {};
  for (const r of rows) for (const h of r.carriers) slots[h.slot] = (slots[h.slot] || 0) + 1;
  const past = rows.filter(r => r.carriers.every(h => h.slot >= PAIR_BODIES)).length;
  const says = rows.length
    ? rows.length + ' team(s) dropped from the pool before pairing for carrying ' + CLOSET_ABILITY
        + ' (' + [...CLOSET_SPECIES].sort().join(', ') + ')'
    : 'none in this run — the shelf is live, derived from the ability `' + CLOSET_ABILITY
        + '` (' + [...CLOSET_SPECIES].sort().join(', ') + '), and matched no team in this pool';
  return {
    ability: CLOSET_ABILITY,
    species: [...CLOSET_SPECIES].sort(),
    teams_dropped: rows.length,
    teams_dropped_by_config: byConfig,
    carrier_sheet_slot: slots,
    bodies_a_pair_brings: PAIR_BODIES,
    teams_whose_only_carrier_sits_past_the_bodies_brought: past,
    dropped: rows.map(r => ({ config: r.config, team: r.team, sheet_length: r.sheet_length,
                              carriers: r.carriers })),
    by: 'Will', on: '2026-08-11', authority: 'ROADMAP #160',
    why: 'OUR shelf, not the format\'s: zoroark is isNonstandard:null and legal to bring. '
       + 'ROADMAP #160 — Illusion is in the closet because a body pretending to be another body '
       + 'makes every divergence it causes unreadable as a rule defect. Derived from the ABILITY '
       + 'so a carrier added next regulation is covered without an edit. THE RULE IS APPLIED TO THE '
       + 'SHEET AND THE BATTLE BRINGS ONLY THE FIRST ' + PAIR_BODIES + ' BUILDABLE BODIES, so a team '
       + 'whose carrier sits past that index is dropped for a body that never enters either engine '
       + '(see carrier_sheet_slot). Narrowing the rule would CHANGE THE SAMPLE and therefore the '
       + 'headline rate, so it is declared here and owed, not done quietly.',
    says,
  };
}

const SW = SWARM.buildSwarm(Math.max((UNTIL_COVERED ? MAX_GAMES : GAMES) * 2, 18),
                            TEAM_STORE ? { storeDir: TEAM_STORE } : null);

/* THE SECOND STEERING INPUT, AND IT IS NOT FROZEN EITHER (ROADMAP #81 WIRE 5).
 *
 * `buildSwarm` reads data/games.bo3.jsonl and data/games.ots.jsonl LIVE, dedupes to distinct teams and
 * picks by a STRIDE over the matching set — so ONE appended game shifts the stride and changes which
 * teams get played. OPS appends to that store continuously (both files moved during this wire's own
 * test runs). WIRE 4 controlled it by asserting size and mtime by hand before, between and after both
 * arms; this asserts the thing that actually matters instead — the TEAM KEYS actually picked.
 *
 * THE KEY, NOT THE GAME ID. `diff_swarm`'s own dedupe key is (species + sorted moves) per side, so two
 * ladder games with the same team collapse to one entry; digesting ids would report a difference where
 * the sample is identical. Digesting the keys per configuration says exactly what was played. */
{
  const crypto = require('crypto');
  const pool = SW.out.map(c => c.config + '\t' + ((c.picked_teams || []).map(p => p.key).join('\t'))).join('\n');
  STEER_STAMP.team_pool_digest = crypto.createHash('sha256').update(pool).digest('hex').slice(0, 12);
  STEER_STAMP.team_pool_teams = SW.teams.length;
  STEER_STAMP.team_pool_picked = SW.out.reduce((a, c) => a + c.picked, 0);
  /* SAID OUT LOUD EITHER WAY. "Read live" is a real hazard and the reader must see which of the two
   * this run did — an unpinned run that looks like a pinned one is the whole problem. */
  STEER_STAMP.team_store_pinned_to = TEAM_STORE || null;
  console.log('  the OTHER half of the sample: team pool ' + STEER_STAMP.team_pool_digest + '  ('
    + STEER_STAMP.team_pool_picked + ' teams picked from a corpus of ' + STEER_STAMP.team_pool_teams
    + (TEAM_STORE ? ' — PINNED to ' + TEAM_STORE + ')'
                  : ' — read LIVE from the game store, which OPS appends to)'));
}
baselineGuard();

/* ROADMAP #31 — EVERY PAIR IS BUILT TWICE, AND THE TWO BUILDS DIFFER ONLY IN THE STONES.
 *
 * `stones` is the measured arm; `nostones` is the paired control and is exactly what this instrument
 * measured on 2026-08-06, when 460 stone sets were stripped and it tested zero mega bodies. Reporting
 * one rate over a mixed population would let the two absorb each other, and the whole point is to see
 * WHAT MEGAS COST — so the same teams, the same seeds and the same driver state are played both ways
 * and the two rates are published apart. A pair carrying no stone at all produces two IDENTICAL games,
 * which is a free consistency check and is asserted rather than assumed. */
function pairsFor(cfgId) {
  const cfg = SW.out.find(c => c.config === cfgId);
  const out = [];
  /* DROP THE CLOSET BEFORE PAIRING, NOT AFTER. Filtering pairs would silently halve the sample every
   * time one shelved body met a clean one; filtering TEAMS keeps the pairing dense and makes the cost
   * exactly the number of teams removed. */
  const rawPool = (cfg && cfg.picked_teams) || [];
  const drops = [];
  const pool = rawPool.filter(t => {
    const hits = closetHits(t.team);
    if (!hits.length) return true;
    drops.push({ team: t.id || t.key || null, carriers: hits, sheet_length: (t.team || []).length });
    return false;
  });
  CLOSET_DROPS.set(cfgId, drops);
  for (let i = 0; i + 1 < pool.length; i += 2) {
    const a = buildPair(pool[i].team), b = buildPair(pool[i + 1].team);
    if (!a || !b) continue;
    const aN = buildPair(pool[i].team, { stripStones: true });
    const bN = buildPair(pool[i + 1].team, { stripStones: true });
    if (!aN || !bN) continue;
    out.push({ a, b, aN, bN, tag: pool[i].id + ' vs ' + pool[i + 1].id,
               stones: [...a, ...b].filter(x => isStone(x.spec.item)).length });
  }
  return out;
}

/* ---- THE END-STATE VERDICT (2026-08-12) ----------------------------------------------------------
 *
 * Will: *"how much is just medicham being semantic"*. One game in, one of five words out. It is a pure
 * function of the record `playGame` returns so `tests/test-end-state.js` can exercise every branch on
 * fabricated rows — including the two branches a real run may never happen to produce, which is
 * exactly where a classifier rots.
 *
 * THREE OF THE FIVE ARE NOT "AGREED" AND MUST NEVER BE FOLDED INTO IT:
 *
 *   THREW                 the harness could not finish the game. It is a fact about the instrument and
 *                         belongs in neither column; counting it either way would be a fallback that
 *                         looks like a measurement.
 *   ENDED-APART           one engine says the battle is over and the other does not. The boards may
 *                         even read identical at that instant — that is not agreement, it is the most
 *                         serious kind of disagreement wearing an identical face, which is why the
 *                         board check is not consulted at all in this branch.
 *   NO-COMPARABLE-BOARD   no boundary was ever compared (the run was not in state mode, or the game
 *                         ended before the leads were read). "No answer" is a third answer.
 *
 * AND THE TWO THAT ARE THE MEASUREMENT:
 *
 *   SAME-END-STATE        the last board both engines produced is identical on every compared leaf.
 *                         If the protocol also parted, that divergence was WORDING.
 *   DIFFERENT-END-STATE   they arrived somewhere else. The divergence was REAL.
 *
 * "SAME-END-STATE" IS A CLAIM ABOUT WHERE THE TWO ENGINES ARRIVED AND ABOUT NOTHING ELSE. It does not
 * say the turns in between agreed; once two battles part they may take entirely different actions. It
 * is also only as strong as what `board_state.js` compares — a leaf that file does not read cannot
 * make a board differ here, which is why its NOT_COMPARED list is published with every run. */
/* ---- THE STOPPING DECISION (2026-08-12) ----------------------------------------------------------
 *
 * One batch history in, one decision out. Pure, so `tests/test-coverage-stop.js` can exercise every
 * branch — including the two a real run may not happen to hit — and so the rule is readable in one
 * screen rather than tangled through the scheduler.
 *
 * THREE WAYS TO STOP AND ONLY ONE OF THEM IS AN ANSWER:
 *   coverage-stalled       K consecutive batches credited nothing new. THIS is "run until each
 *                          mechanic has been exercised" reaching its end.
 *   game-budget            `--max-games` was spent. A TRUNCATION.
 *   team-pool-exhausted    the swarm ran out of distinct team pairs. Also a TRUNCATION.
 *
 * THE TRUNCATIONS WIN WHEN THEY COINCIDE WITH A STALL, and that ordering is the whole point. A run
 * that both stalled and ran out of games could be reported either way; reporting the flattering half
 * would turn "we stopped looking" into "there was nothing left to find". */
function coverageStop(x) {
  const poolLeft = x.poolLeft == null ? Infinity : x.poolLeft;
  if (x.games >= x.maxGames) return { stop: true, reason: 'game-budget', on_budget: true };
  if (poolLeft <= 0) return { stop: true, reason: 'team-pool-exhausted', on_budget: true };
  if (x.quietBatches >= x.stallK) return { stop: true, reason: 'coverage-stalled', on_budget: false };
  return { stop: false, reason: null, on_budget: false };
}

const END_STATE_VERDICTS = ['SAME-END-STATE', 'DIFFERENT-END-STATE', 'ENDED-APART',
                            'NO-COMPARABLE-BOARD', 'THREW'];
function endStateVerdict(r) {
  if (!r) return 'NO-COMPARABLE-BOARD';
  if (r.err) return 'THREW';
  if (!!r.endedMedi !== !!r.endedSd) return 'ENDED-APART';
  if (!r.finalBoard) return 'NO-COMPARABLE-BOARD';
  return r.finalBoard.identical ? 'SAME-END-STATE' : 'DIFFERENT-END-STATE';
}

module.exports = { playGame, buildPair, freshBodies, classify, pinRandom, PIN_CHANCE, sdStream, chooseAction,
                   /* 2026-08-25 — THE ONE DOOR onto "which body of the roster is this", exported so a
                    * probe drives THE resolver rather than a second copy of it. `rosterKeyFallbacks`
                    * is the loud half: any read that had to fall back on display state is counted
                    * here and must be 0. */
                   rosterKey, rosterKeyFallbacks: () => ({ ...ROSTER_KEY_FALLBACK }),
                   /* 2026-08-12 — the end-state measurement. `endStateVerdict` is the classifier,
                    * `shapeOfCause` is THE SHAPE MODULE'S function re-exported rather than a second
                    * copy, and the two flags let a test assert the driver actually read the argument
                    * it is being measured under. */
                   endStateVerdict, END_STATE_VERDICTS, shapeOfCause: SHAPE.shapeOf,
                   END_STATE, STATE_ON: STATE,
                   /* 2026-08-12 — the severity ladder, re-exported from engine/end_state_severity.js
                    * rather than reimplemented, on the same rule as `shapeOfCause` directly above: a
                    * test that drove a second copy would prove the copy works. `speciesUses` is the
                    * ranking's second key and is exported so a test can prove the driver read the
                    * corpus at all rather than ranking everything as UNKNOWN. */
                   severity: ESS.severity, SEVERITY_BANDS: ESS.BANDS, endBoard: ESS.endBoard,
                   typicalHit: ESS.typicalHit, collectHits: ESS.collectHits, speciesUses,
                   /* 2026-08-12 — the stopping rule, exported as a pure decision so its branches can
                    * be tested without playing 4,000 games to reach one of them. */
                   coverageStop,
                   /* 2026-08-08 — the nature. `flatL50` and `freshBodies` are exported so
                    * tests/test-nature-differential.js can check the MEDICHAM line against the
                    * authority directly instead of inferring it from a game that agreed; the counters
                    * are exported so the same file can prove the fallback is counted rather than
                    * silent, and that it stays still on a fully-declared sheet. */
                   flatL50, NATURE_MODE, natureCounters: () => Object.assign({}, NATURE_COUNT),
                   /* 2026-08-10 — the aim translation and its counters, exported for the same reason
                    * the nature counters are: a caller proving the ally path RAN must read this
                    * driver's own answer, never a second copy of the arithmetic. */
                   aimOf, aimBody, aimCounters: () => Object.assign({}, AIM),
                   /* ROADMAP #174 -- the scripted-click counters, exported for exactly the reason the
                    * nature ones are: a caller proving its SCRIPT ran must read this driver's own
                    * answer rather than assume it. `reset` exists because a scenario file runs many
                    * games in one process and needs a per-scenario reading. */
                   scriptCounters: () => ({ moveNotOnRequest: scriptMoveNotOnRequest,
                                            firstMissing: scriptMoveFirstMissing,
                                            megaRefused: scriptMegaRefused }),
                   resetScriptCounters: () => { scriptMoveNotOnRequest = 0; scriptMoveFirstMissing = ''; },
                   /* 2026-08-22 — THE REFUSAL COUNTERS, exported for exactly the reason the nature and
                    * aim counters are: a caller proving "the authority took everything this harness
                    * said" must read THIS DRIVER'S OWN answer. A test that wrapped
                    * `Battle.prototype.choose` itself would be a second implementation of the count and
                    * would keep passing after this one was removed. `reset` exists because a test file
                    * plays several games in one process and needs a per-case reading.
                    *
                    * NAME THE NOUN: `refused` is `battle.choose()` calls returning false, and it must
                    * be asserted EXACTLY 0 — never `>= 1`, which is the shape that let three counters
                    * in this repo be blind by construction. `switched`/`passed` are forced-switch
                    * SLOTS; `passed` is legitimately non-zero and must NOT be asserted at 0. */
                   /* the mirror decision itself, so a test can hand it the exact shape that broke it
                    * (a double KO on a side down to one usable body) as DATA rather than hunting a
                    * corpus game that happens to reach it. */
                   mirrorForcedSwitch,
                   choiceCounters: () => ({ refused: CHOICE_REFUSED.n, first: CHOICE_REFUSED.first,
                                            switched: FORCED_SWITCH_MIRROR.switched,
                                            passed: FORCED_SWITCH_MIRROR.passed,
                                            unmirrorable: MIRROR_IMPOSSIBLE.n,
                                            unmirrorableFirst: MIRROR_IMPOSSIBLE.first }),
                   resetChoiceCounters: () => { CHOICE_REFUSED.n = 0; CHOICE_REFUSED.first = '';
                                                FORCED_SWITCH_MIRROR.switched = 0; FORCED_SWITCH_MIRROR.passed = 0;
                                                MIRROR_IMPOSSIBLE.n = 0; MIRROR_IMPOSSIBLE.first = ''; },
                   /* ROADMAP #291 -- THE ILLUSION CLOSET (ROADMAP #160), EXPORTED SO THE SECOND
                    * INSTRUMENT READS IT RATHER THAN RE-DERIVING IT. `engine/all_mechanics_fire.js`
                    * was staging Bitter Malice on Zoroark-Hisui and Night Daze on Zoroark -- the only
                    * two rows in its whole population whose carrier holds Illusion -- and BOTH diverge
                    * with `switch: a different body`, which is the ability renaming the body and not a
                    * defect in either move. Derived from the ABILITY, so a carrier added next
                    * regulation is covered without an edit; a name list is the failure this repo has a
                    * standing rule about. */
                   CLOSET_ABILITY, CLOSET_SPECIES, closetHits, closetDeclaration,
                   plantedProof, pairsFor, COV_TARGETS, COV_UNMEASURABLE, PIN_CLAIMS, REL, SW,
                   runDirected, damageInterior, DIRECTED, EQUIV, equivProof, semantic, reduce, NORM_COUNTS,
                   knockOffArms, KO_TARGET_ITEMS,
                   plantedStateProof, STATE_PLANTS, BS_CTX, BS,
                   /* ROADMAP #88 — the arms, so a test can play the SAME game under two pins and
                    * compare, rather than assert that the pin table looks right. */
                   ARMS, ARM_BY_ID, PRIMARY_ARM, PIN_CLAIMS_BY_ARM, PINS, PIN_DIGEST, MODE,
                   /* ROADMAP #91 — the credit layer, so a test can stage Haze into an empty board and
                    * into a boosted one and read the two credits. */
                   witnessFor, creditTurn, COV_CREDIT, COV_ATTEMPT, CREDIT_KIND, COV_TOUCHED,
                   driverSnap, driverRestore, driverReset, covWant, CREDIT_POLICY,
                   BOARD_FAMILY, changedFamilies,
                   /* 2026-08-10, ROADMAP #143 — THE AUTHORITY'S OWN LOG OF THE GAME JUST PLAYED.
                    * `playGame` already returns `mediTrace`; the Showdown half was kept module-local
                    * behind `gLogOf` because only `knockOffArms` needed it. `all_mechanics_fire.js`
                    * decides whether a MOVE RESOLVED, and that verdict has to be read off the
                    * AUTHORITY's stream — a resolution judged from medicham2's own narration would
                    * be the engine grading its own homework. Returned as a COPY so a caller cannot
                    * mutate the buffer the next game overwrites. */
                   lastSdLog: () => _lastSdLog.slice(),
                   /* ROADMAP #220 -- THE MIDDLE ARM'S ADDRESSES, BOTH SIDES, SO A TEST CAN READ THE
                    * STRINGS RATHER THAN A RATE. `sd` is this file's own log kept across the game
                    * boundary; `me` is the engine's, taken live because `midEventDice` clears it per
                    * game. `no_battle` is the count of draws made with no battle in scope -- every one
                    * of those is addressed `<seed>|0|any|-|-|<nth>`, which is a sequence and not an
                    * address, and it is the difference between an arm that is synchronised and one
                    * that only looks it. */
                   midAddresses: () => ({ sd: MID_CTX_ALL.sd.slice(),
                                          me: (typeof M.midEventLog === 'function') ? M.midEventLog() : [],
                                          no_battle: MID_NO_BATTLE_DRAWS }),
                   midResetAddresses: () => { MID_CTX_ALL.sd.length = 0; MID_NO_BATTLE_DRAWS = 0; },
                   /* the damage-roll mapping and the arms it is derived from, for tests/test-middle-damage-roll.js */
                   midDamageIndex, DAMAGE_ROLL_SIDES, CORNER_TOP, CORNER_BOTTOM,
                   midDamageFlips: () => MID_DAMAGE_INDEX_FLIPS,
                   /* THE WRAPPER'S OWN RECEIPT. `adopted` is how many times this file was RELOADED
                    * into a process that had already installed the `BattleActions` patch; `enters` is
                    * how many times the patch has since told THIS holder which category is running. A
                    * reload with `adopted > 0` and `enters === 0` is the defect
                    * `tests/probe_mid_cat_reload.js` exists for, and it is readable rather than
                    * inferred from a percentage. */
                   midWrapState: () => ({ adopted: MIDW.adopted, enters: MIDW.enters,
                                          shared: !MID_UNSHARED, installed: !MID_WRAP_ERROR }) };

if (require.main !== module) return;

/* TRAP 4 FIRST, ALWAYS — the comparator proves it can find a planted divergence before any result
 * below is worth reading. */
/* THE EQUIVALENCE LAYER PROVES ITSELF FIRST, BOTH DIRECTIONS, BEFORE IT IS ALLOWED TO QUIETEN
 * ANYTHING. A rule that does not collapse the form it claims to is dead weight; a rule that collapses
 * the MEANING is a silencer, and the second is the one that would make every number below a lie. */
const EQP = equivProof();
const EQ_BAD = EQP.filter(r => !r.collapses || !r.keeps_meaning);
console.log('\n  THE SEMANTIC NORMALISER — every equivalence, both directions, before any game:');
for (const r of EQP) console.log('    ' + (r.collapses ? 'collapses' : 'DOES NOT COLLAPSE') + ' / '
  + (r.keeps_meaning ? 'keeps meaning' : 'SILENCER — it collapses the DISTINCT pair too') + '   ' + r.id);
if (EQ_BAD.length) {
  console.log('    A RULE FAILED ITS OWN RED DEMONSTRATION. Every rate below would be the comparator, not the engine.');
  process.exitCode = 1;
}

const proofPairs = pairsFor('baseline');
const PROOF = proofPairs.length ? plantedProof(proofPairs[0].a, proofPairs[0].b) : [];
/* CAUGHT IS NOT ENOUGH. It must be caught EARLIER than the clean arm's own divergence (or the catch
 * might be that divergence) and at EXACTLY the line it was planted at (or the aligner is detecting
 * without localising, which is the scoreboard §5 exists to reject). */
const PROOF_OK = PROOF.filter(p => p.what !== 'the CLEAN arm of the same game')
  .every(p => p.caught && p.earlier_than_clean && p.at === p.expected_at);
console.log('\n  PLANTED-DIVERGENCE PROOF (a silent zero is a broken comparator, not a clean engine):');
for (const p of PROOF) console.log('    ' + (p.what === 'the CLEAN arm of the same game'
  ? (p.caught ? 'the CLEAN arm itself diverges at line ' + p.at + ' (' + p.cls + ') — the plants are judged against that'
              : 'the CLEAN arm agrees, so every catch below is the plant')
  : (p.caught && p.at === p.expected_at && p.earlier_than_clean
       ? 'CAUGHT at line ' + String(p.at).padEnd(5) + 'exactly where planted: ' + p.what
       : (p.caught ? 'CAUGHT at ' + p.at + ' but PLANTED at ' + p.expected_at + ' — ' + p.what
                   : 'NOT CAUGHT — ' + p.what
                     + (p.applied === 0 ? '   [THE PLANT WAS NEVER PLACED — aimed at reduced line '
                                          + p.expected_at + ', which no call could reach]' : '')
                     + (p.err ? '   [' + p.err + ']' : '')))));
if (!PROOF_OK) console.log('    THE COMPARATOR FAILED ITS OWN PROOF — everything below is worthless.');

/* ---- THE STATE COMPARATOR PROVES ITSELF, BEFORE ANY BOARD IS SCORED ----------------------------- */
let MAPPING_PROOF = null, MAPPING_OK = true, STATE_PROOF = null;
if (STATE) {
  MAPPING_PROOF = BS.mappingProof(N, M);
  const bad = MAPPING_PROOF.filter(r => !r.collapses || !r.keeps_meaning);
  MAPPING_OK = !bad.length;
  console.log('\n  THE STATE READER\'S REPRESENTATION MAPPINGS — both directions, before any board:');
  for (const r of MAPPING_PROOF) console.log('    ' + (r.collapses ? 'collapses' : 'DOES NOT COLLAPSE')
    + ' / ' + (r.keeps_meaning ? 'keeps meaning' : 'SILENCER — it collapses the DISTINCT pair too')
    + '   ' + r.id);
  if (!MAPPING_OK) { console.log('    A MAPPING FAILED ITS OWN RED DEMONSTRATION.'); process.exitCode = 1; }

  STATE_PROOF = proofPairs.length ? plantedStateProof(proofPairs[0].a, proofPairs[0].b) : null;
  console.log('\n  PLANTED *STATE* DIVERGENCE PROOF — one plant per compared field family, written into');
  console.log('  the LIVE medicham board at a boundary the clean arm agreed at. Caught is not enough:');
  console.log('  it must be caught AT that boundary and LOCALISED to the field that was planted.');
  if (!STATE_PROOF) console.log('    NOT RUN — no proof pair could be built.');
  else {
    console.log('    clean arm: ' + STATE_PROOF.clean.boundaries_agreed + '/' + STATE_PROOF.clean.boundaries
      + ' boundaries agreed, plants go at boundary ' + STATE_PROOF.clean.planted_at_boundary);
    for (const p of STATE_PROOF.plants) console.log('    '
      + (!p.applied ? (p.callback_returned_truthy ? 'NO-OP, NOT APPLIED' : 'NOT APPLIED     ')
        : p.caught && p.at_the_planted_boundary && p.localised ? 'CAUGHT+LOCALISED'
        : p.caught && p.at_the_planted_boundary ? 'caught, NOT LOCALISED'
        : p.caught ? 'caught at ' + p.at + ', PLANTED AT ' + p.expected_at : 'NOT CAUGHT      ')
      + '  ' + String(p.planted_field).padEnd(28) + p.what
      /* THE FIXTURE RECEIPT, IN THE PRINTED OUTPUT AND NOT ONLY IN THE ARTIFACT: a plant that had to
       * walk back from the last agreeing board says so, because "boundary 6 had nobody standing" is
       * a fact about this pair that a reader should not have to open a JSON file to learn. */
      + (p.planted_at !== STATE_PROOF.clean.planted_at_boundary
          ? '   [planted at boundary ' + p.planted_at + ', ' + p.boundaries_tried + ' tried]' : '')
      + (p.fell_back_to_the_other_side ? '   [the other side]' : '')
      + (p.caught && !p.localised ? '   reported: ' + p.paths.slice(0, 3).join(', ') : ''));
    if (!STATE_PROOF.all_ok) { console.log('    THE STATE COMPARATOR FAILED ITS OWN PROOF — every state '
      + 'number below is worthless.'); process.exitCode = 1; }
  }
}

let results = [];        // the MEASURED arm of the PRIMARY pin — stones kept
let control = [];        // the PAIRED CONTROL — the same pair with the stones removed
/* A pair carrying no stone produces two identical games; when it does not, the harness is not paired
 * and the two rates below are not comparable. Counted, printed, must read 0. */
let PAIRING_BROKEN = 0;
/* ROADMAP #88 — ONE ENTRY PER PINNED ARM, AND THEY ARE NEVER POOLED. "The boards agree at max damage"
 * and "the boards agree at min damage" are different claims about different games; adding them up
 * would produce a number that describes neither. */
const ARM_RUNS = [];
const t0 = Date.now();
/* ---- THE COVERAGE STOPPING RULE'S BOOKKEEPING (2026-08-12) ---------------------------------------
 * Filled by the batched scheduler and published as `coverage_stop`. `null` on a fixed-count run,
 * which is a different claim from "coverage was reached". */
let COVERAGE_STOP = null;
if (!has('--proof')) {
  const live = SW.out.filter(c => !ONLY || c.config === ONLY);
  const perConfig = Math.max(1, Math.floor(GAMES / live.length));
  /* BUILT ONCE PER CONFIGURATION AND REUSED BY EVERY ARM. `pairsFor` calls `buildPair` four times per
   * pair and the batched scheduler asks for the same list repeatedly; rebuilding it per arm was
   * affordable at 133 pairs and is not at a few thousand. The list is deterministic, so the cache
   * cannot change what gets played. */
  const PAIR_CACHE = new Map();
  const pairsCached = (c) => { if (!PAIR_CACHE.has(c)) PAIR_CACHE.set(c, pairsFor(c)); return PAIR_CACHE.get(c); };
  /* ONE GAME, PLAYED THE SAME WAY BY BOTH SCHEDULERS. Extracted rather than duplicated: the fixed-count
   * path and the coverage path must differ ONLY in which pairs they hand over and when they stop, or
   * the stopping rule would be a second instrument wearing the same name. */
  const playOne = (arm, cfgId, pr, isPrimary, armResults, armControl) => {
    /* THE STONE CONTROL RUNS UNDER THE PRIMARY PIN ONLY. It is a paired measurement that DOUBLES
     * the games, and four arms times two would be eight runs of the swarm to answer a question
     * that is about stones and not about dice. Declared rather than quietly dropped. */
    let c = null;
    if (isPrimary) {
      const s0 = driverSnap();
      c = playGame(pr.aN, pr.bN, cfgId, pr.tag + ' [stones removed]', { arm });
      driverRestore(s0);
    }
    const r = playGame(pr.a, pr.b, cfgId, pr.tag, { arm });
    r.stones = pr.stones;
    if (c) {
      c.stones = 0;
      if (!pr.stones) {
        const same = (!!r.div === !!c.div) && (!r.div || r.div.index === c.div.index) && r.turns === c.turns;
        if (!same) PAIRING_BROKEN++;
      }
      armControl.push(c);
    }
    /* ---- THE VOID CHECK RUNS HERE OR IT DOES NOT RUN AT ALL -------------------------------------
     * Built and not wired, the first middle-arm run reported 137 divergences in 171 games at a median
     * of TWO turns -- which is the desync signature, not an engine that is 80% wrong. A game whose
     * per-category draw counts differ between the engines is the INSTRUMENT failing, and it is marked
     * rather than counted. The counts are reset per game, so this is a statement about THIS game. */
    /* `midReset()` clears COUNTS. The nth map is a separate thing and must clear too: `turn` is
     * in the address, so without this turn 1 of game 2 keeps counting from game 1 and every
     * address after the first game is unreachable by the other engine. */
    if (arm.middle) {
      const _sdN = MID_CTX_SEEN.sd.length, _meN = (typeof M.midEventLog === 'function') ? M.midEventLog().length : -1;
      MID_LAST_WHY = null; r._mid_void = midGameVoid(); r._mid_why = MID_LAST_WHY; midReset(); midClearNth();
      if (VOID_DEBUG) console.log('   VOIDDBG cfg=' + cfgId + ' tag=' + String(pr.tag).slice(0, 28)
        + ' turns=' + r.turns + ' div=' + (r.div ? 'Y' : 'n') + ' err=' + (r.err ? String(r.err).slice(0, 30) : '-')
        + ' sd=' + _sdN + ' me=' + _meN + ' why=' + r._mid_why);
    }
    armResults.push(r);
    /* SUMMED OVER THE PRIMARY MEASURED ARM ONLY, and that is not fussiness. `playGame` is also
     * called by the planted-divergence proof (four extra games on the baseline pair) and by the
     * directed scenarios, so a module-level counter incremented inside it would count offers from
     * games whose EVOLUTIONS are not in `results` — and the report would then show 44 choices
     * against 40 evolutions and look like a lost choice. It did, on the first run of this. */
    if (isPrimary) {
      MEGA_CHOICES += r.megaChoices;
      MEGA_MEDI += r.megaMedi; MEGA_SD += r.megaSd;
      MEGA_SIDES_CAPABLE += r.megaCapableSides; MEGA_SIDES_EVOLVED += r.megaSidesEvolved;
      MEGA_SLOT_A += r.megaSlotA; MEGA_SLOT_B += r.megaSlotB;
    }
    if (VERBOSE) console.log('   ' + arm.id.padEnd(22) + String(cfgId).padEnd(24) + (r.err ? 'THREW ' + r.err
      : r.div ? 'DIVERGES at line ' + r.div.index + '  ' + classify(r.div).cls : 'agrees, ' + r.turns + ' turns'));
    return r;
  };
  /* WHICH CENSUS ROWS HAVE ANY CREDIT AT ALL, right now. ANY credit, not only an observed effect: a row
   * whose tag names no board leaf can never earn one, and requiring an effect from it would make the
   * stall detector wait for evidence that cannot exist. Stopping LATER is the safe direction. */
  const creditedNow = () => { const s = new Set(); for (const [k, v] of COV_CREDIT) if (v > 0) s.add(k); return s; };

  /* ================= THE COVERAGE-STEERED SCHEDULER =============================================== */
  if (UNTIL_COVERED) {
    /* ROUND-ROBIN, so every batch samples every configuration. See the `--until-covered` header. */
    const WORK = [];
    for (let k = 0; ; k++) {
      let any = false;
      for (const cfg of live) {
        const q = pairsCached(cfg.config);
        if (q[k]) { WORK.push({ cfg: cfg.config, pr: q[k] }); any = true; }
      }
      if (!any) break;
    }
    console.log('');
    console.log('  THE STOPPING RULE — "run until each mechanic has been exercised" (Will, 2026-08-12).');
    console.log('    batches of ' + BATCH + ' games, stop after ' + STALL_K + ' consecutive batches that');
    console.log('    credit no new census row. Backstop ' + MAX_GAMES + ' games; the team pool holds '
      + WORK.length + ' distinct pairs.');
    if (WORK.length < MAX_GAMES) console.log('    THE POOL IS SMALLER THAN THE BACKSTOP — this run can be '
      + 'truncated by the corpus before its budget, and either way that is a truncation and not an answer.');
    const batches = [];
    let played = 0, quiet = 0, stop = { stop: false, reason: null, on_budget: false };
    const primaryResults = [], primaryControl = [];
    driverReset();
    let seen = creditedNow();
    while (!stop.stop) {
      const from = played, to = Math.min(WORK.length, played + BATCH, MAX_GAMES);
      if (to <= from) {
        stop = coverageStop({ quietBatches: quiet, stallK: STALL_K, games: played,
                              maxGames: MAX_GAMES, poolLeft: WORK.length - played });
        break;
      }
      for (let i = from; i < to; i++) playOne(PRIMARY_ARM, WORK[i].cfg, WORK[i].pr, true, primaryResults, primaryControl);
      played = to;
      const now = creditedNow();
      const fresh = [...now].filter(k => !seen.has(k));
      seen = now;
      quiet = fresh.length ? 0 : quiet + 1;
      batches.push({ batch: batches.length + 1, games_after: played, newly_credited: fresh.length,
                     newly_credited_rows: fresh, quiet_batches_in_a_row: quiet,
                     rows_with_any_credit: now.size });
      console.log('    batch ' + String(batches.length).padStart(3) + '  games ' + String(played).padStart(5)
        + '  new rows ' + String(fresh.length).padStart(3) + '  total credited ' + String(now.size).padStart(4)
        + (fresh.length ? '   ' + fresh.slice(0, 4).join(', ') + (fresh.length > 4 ? ' ...' : '')
                        : '   (nothing new - quiet ' + quiet + '/' + STALL_K + ')'));
      stop = coverageStop({ quietBatches: quiet, stallK: STALL_K, games: played,
                            maxGames: MAX_GAMES, poolLeft: WORK.length - played });
    }
    COVERAGE_STOP = { policy: 'play while new census rows are still credited; stop after K consecutive '
                        + 'batches credit nothing new. A game budget or an exhausted team pool is a '
                        + 'TRUNCATION, never a coverage answer.',
                      batch_size: BATCH, stall_k: STALL_K, max_games: MAX_GAMES,
                      pool_pairs_available: WORK.length,
                      games_played: played, batches,
                      stopped_because: stop.reason, stopped_on_budget: !!stop.on_budget };
    ARM_RUNS.push({ arm: PRIMARY_ARM, results: primaryResults, control: primaryControl,
                    credit: new Map(COV_CREDIT), kinds: new Map(CREDIT_KIND), touched: new Set(COV_TOUCHED),
                    firstTurn: new Map(COV_FIRST_TURN), byTurn: new Map(CREDIT_BY_TURN) });
    results = primaryResults; control = primaryControl;
    /* EVERY OTHER ARM REPLAYS EXACTLY THE SAME GAMES. Same pairs, same order, same starting driver
     * state — so the arms share a denominator and a difference between two rows is the DIE. */
    for (const arm of ARMS_RUN) {
      if (arm.id === PRIMARY_ARM.id) continue;
      driverReset();
      const armResults = [], armControl = [];
      for (let i = 0; i < played; i++) playOne(arm, WORK[i].cfg, WORK[i].pr, false, armResults, armControl);
      ARM_RUNS.push({ arm, results: armResults, control: armControl,
                      credit: new Map(COV_CREDIT), kinds: new Map(CREDIT_KIND), touched: new Set(COV_TOUCHED),
                      firstTurn: new Map(COV_FIRST_TURN), byTurn: new Map(CREDIT_BY_TURN) });
    }
  } else
  for (const arm of ARMS_RUN) {
    /* EVERY ARM STARTS FROM THE SAME DRIVER STATE, or it is not the same experiment. The driver is
     * stateful on purpose (`CLICKS`, the credit maps) so the swarm keeps reaching new mechanics; left
     * to carry over, arm 2 would deliberately click something else and the four arms would be four
     * different runs rather than one run under four pins. */
    driverReset();
    const armResults = [], armControl = [];
    const isPrimary = arm.id === PRIMARY_ARM.id;
    for (const cfg of live) {
      let made = 0;
      for (const pr of pairsCached(cfg.config)) {
        if (made >= perConfig) break;
        playOne(arm, cfg.config, pr, isPrimary, armResults, armControl);
        made++;
      }
    }
    ARM_RUNS.push({ arm, results: armResults, control: armControl,
                    credit: new Map(COV_CREDIT), kinds: new Map(CREDIT_KIND),
                    touched: new Set(COV_TOUCHED),
                    firstTurn: new Map(COV_FIRST_TURN), byTurn: new Map(CREDIT_BY_TURN) });
    if (isPrimary) { results = armResults; control = armControl; }
  }
  /* THE CREDIT MAPS AFTER THE LAST ARM ARE THAT ARM'S, NOT THE RUN'S. The coverage report is a claim
   * about what the WHOLE run exercised, so the union is rebuilt here rather than read off whichever
   * arm happened to finish last — which would have been a silent, plausible, wrong number. */
  driverReset();
  for (const a of ARM_RUNS) {
    /* THE EARLIEST TURN IS A MINIMUM ACROSS ARMS, NOT A SUM. Every other map here adds up because it
     * counts events; "the first turn this was ever seen to act" is the smallest one any arm saw. */
    for (const [k, t] of (a.firstTurn || new Map())) {
      const prev = COV_FIRST_TURN.get(k);
      if (prev === undefined || t < prev) COV_FIRST_TURN.set(k, t);
    }
    for (const [t, n] of (a.byTurn || new Map())) CREDIT_BY_TURN.set(t, (CREDIT_BY_TURN.get(t) || 0) + n);
    for (const [k, v] of a.credit) COV_CREDIT.set(k, (COV_CREDIT.get(k) || 0) + v);
    for (const [k, v] of a.kinds) { const e = CREDIT_KIND.get(k) || { effect: 0, negative: 0, click: 0 };
      e.effect += v.effect; e.negative += v.negative; e.click += v.click; CREDIT_KIND.set(k, e); }
    for (const k of a.touched) COV_TOUCHED.add(k);
  }
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const DIR = runDirected();
const KO = knockOffArms();
/* THE INTERIOR IS MEASURED ONLY WHERE THE ENDPOINTS ARE THE QUESTION. The Intimidate-crit scenario is
 * excluded on purpose: `dmgRange` does not carry the crit multiplier and the Intimidate case's whole
 * point is that the two engines price the ATTACK differently, so its span gap would be that bug
 * rather than the roll granularity — two findings sharing one number is how a tolerance gets set. */
const INTERIOR = DIRECTED.filter(s => /knock-off|contact/.test(s.name)).map(damageInterior).filter(Boolean);

/* ---- REPORT --------------------------------------------------------------------------------------- */
const diverged = results.filter(r => r.div);
const threw = results.filter(r => r.err);
const classes = new Map();
for (const r of diverged) {
  const c = classify(r.div);
  if (!classes.has(c.cls)) classes.set(c.cls, { games: 0, causes: new Map() });
  const e = classes.get(c.cls);
  e.games++;
  e.causes.set(c.cause, (e.causes.get(c.cause) || 0) + 1);
  r._cls = c;
}

/* TWO STRENGTHS OF COVERAGE, AND THEY MUST NOT BE ADDED UP INTO ONE NUMBER.
 *
 * A move that CONNECTED did something: the engine ran its handler and the stream carries the result.
 * An ability or an item that was merely ON THE FIELD did not necessarily do anything at all — and in
 * this run that distinction is not academic, because the median game parts after SEVEN protocol
 * lines, which is inside turn one. Reporting "Unnerve: covered" because a body holding Unnerve stood
 * in a slot for one turn is the same over-claim as the damage differential's 12% tolerance.
 *
 * So: MOVES are exercised, ABILITIES and ITEMS are present, and the report says which is which. */
const reach = t => {
  const src = t.sec === 'moves' ? OBSERVED.moves : t.sec === 'abilities' ? OBSERVED.abilities : OBSERVED.items;
  for (const e of t.entities) if (src.has(e)) return true;
  return false;
};
const covStrong = COV_TARGETS.filter(t => t.sec === 'moves' && reach(t));
const covWeak = COV_TARGETS.filter(t => t.sec !== 'moves' && reach(t));
const covered = COV_TARGETS.filter(reach);
const uncovered = COV_TARGETS.filter(t => !reach(t));
/* ---- THE COVERAGE NUMBER AFTER CREDIT TIGHTENED (ROADMAP #91) -----------------------------------
 * `covered` above is the OLD number, kept and printed: "an entity of this row connected, or stood on
 * the field". It is the number that said Haze was covered because Primarina clicked it into a board
 * with no boosts on it. Below it is the new one — the row was seen to DO something — and it is
 * SMALLER. The old number was wrong; the drop is the fix working. */
const kindOf = k => CREDIT_KIND.get(k) || { effect: 0, negative: 0, click: 0 };
const credited = COV_TARGETS.filter(t => (COV_CREDIT.get(t.key) || 0) > 0);
const creditedByEffect = COV_TARGETS.filter(t => kindOf(t.key).effect > 0 || kindOf(t.key).negative > 0);
const creditedByClickOnly = COV_TARGETS.filter(t => kindOf(t.key).click > 0
  && !(kindOf(t.key).effect > 0 || kindOf(t.key).negative > 0));
const witnessable = COV_TARGETS.filter(t => t.witness.kind !== 'no-board-leaf');
const noBoardLeaf = COV_TARGETS.filter(t => t.witness.kind === 'no-board-leaf');
const touchedNotCredited = COV_TARGETS.filter(t => COV_TOUCHED.has(t.key) && !(COV_CREDIT.get(t.key) > 0));
/* ---- THE ROWS THIS RUN DID NOT EXERCISE, BY NAME (2026-08-12) ------------------------------------
 * Will's instruction was "run until each mechanic has been exercised", and the honest end of that
 * sentence is the list of the ones that were not. A COUNT is not a worklist: 30 uncovered rows and a
 * number tells nobody which mechanic to go and stage. Split by what evidence was even available —
 * a row whose tag names a board leaf could have been witnessed and was not, and a row that names none
 * could only ever have been credited by a connected click. */
const neverCredited = COV_TARGETS.filter(t => !(COV_CREDIT.get(t.key) > 0));
const neverWitnessed = neverCredited.filter(t => t.witness.kind !== 'no-board-leaf');
const neverClicked = neverCredited.filter(t => t.witness.kind === 'no-board-leaf');
const TURNS = results.map(r => r.turns).sort((a, b) => a - b);
const medianTurns = TURNS.length ? TURNS[Math.floor(TURNS.length / 2)] : 0;

/* ---- THE END-STATE MEASUREMENT (2026-08-12) ------------------------------------------------------
 *
 * Will: *"how much is just medicham being semantic"*. Of the games whose PROTOCOL parted, how many end
 * with the two engines holding the same board (the mismatch was WORDING) and how many genuinely played
 * a different battle (it was REAL)?
 *
 * COMPUTED PER ARM AND NEVER POOLED, exactly as every other rate in this file is: the arms differ in
 * which body wins a speed tie and where the damage roll sits, so "how much is cosmetic" has a
 * different answer in each and an average would describe neither.
 *
 * CROSSED WITH THE SHAPE, because "EMISSION is mostly cosmetic" has been said to Will without evidence
 * and has already been wrong once — the `??:` family was filed as an emission problem and was the most
 * serious defect of the sprint, while Regenerator looked serious and was pure wording. The shape comes
 * out of `engine/divergence_shape.js`, which `divergence_report.js` also reads; there is one rule.
 *
 * AND IT ONLY MEANS ANYTHING IN `--end-state` MODE. Under the other two stop rules the game halts at
 * the first disagreement, so "the final board" is the board at the moment we stopped looking. `null`
 * rather than a flattering number. */
function endStateSummary(rows, opts) {
  if (!END_STATE) return null;
  const V = new Map(END_STATE_VERDICTS.map(v => [v, 0]));
  const rowsWith = rows.map(r => ({ r, v: endStateVerdict(r),
                                    cls: r.div ? classify(r.div) : null }));
  for (const x of rowsWith) V.set(x.v, V.get(x.v) + 1);
  const parted = rowsWith.filter(x => x.r.divTurn != null);
  const agreedAllAlong = rowsWith.filter(x => x.r.divTurn == null);
  const tally = (list) => Object.fromEntries(END_STATE_VERDICTS.map(v => [v, list.filter(x => x.v === v).length]));
  /* THE CROSS-TAB. One row per shape, one column per verdict, over the games whose protocol parted. */
  const byShape = new Map();
  for (const x of parted) {
    const s = SHAPE.shapeOf(x.cls.cause);
    const e = byShape.get(s.shape) || { shape: s.shape, games: 0, verdicts: Object.fromEntries(END_STATE_VERDICTS.map(v => [v, 0])) };
    e.games++; e.verdicts[x.v]++;
    byShape.set(s.shape, e);
  }
  /* WHAT ACTUALLY DIFFERS AT THE END — the families of the last board, for the games that really did
   * play a different battle. This is the worklist the whole measurement is for: a defect that survives
   * to the end of the game is one that changes what a search would plan from. */
  const fam = new Map();
  for (const x of rowsWith) {
    if (x.v !== 'DIFFERENT-END-STATE') continue;
    for (const f of new Set((x.r.finalBoard.diffs || []).map(d => BS.family(d.path)))) fam.set(f, (fam.get(f) || 0) + 1);
  }
  /* ---- BOARD-MATERIALITY PER CAUSE (2026-08-23, ENGINE) -----------------------------------------
   *
   * THE CROSS-TAB ABOVE IS PER SHAPE AND THE SHAPES ARE FIVE. The question Will's quarantine bar is
   * defined on — "how many divergences change a BOARD" — is asked of a MECHANISM, and the 82 whole-game
   * divergences of 2026-08-23 collapsed to 31 of them. Five buckets cannot carry 31 answers, so
   * `docs/_reports/2026-08-23-wholegame-77-grouped.md` had to mark 20 of 31 UNKNOWN: the artifact
   * simply had no place where a CAUSE and a BOARD VERDICT sat on the same row.
   *
   * THE VERDICT IS THE BOARD COMPARATOR'S, NEVER A JUDGEMENT ABOUT THE LINE. Three columns, and the
   * middle one is the load-bearing one:
   *
   *   board_parted            r.stateDiv !== null — a leaf board_state.js compares differed at some
   *                           turn boundary. BOARD-MATERIAL, measured.
   *   board_never_parted      + SAME-END-STATE: every compared boundary agreed AND the last boards
   *                           agree. NARRATION-ONLY, measured — and bounded by BS.NOT_COMPARED, which
   *                           ships with this artifact, and by the turn cap.
   *   anything else           ENDED-APART / NO-COMPARABLE-BOARD / THREW: no comparison was made.
   *                           UNKNOWN, and it must stay UNKNOWN rather than fall into either half.
   *
   * IT IS NOT A NEW MEASUREMENT. Both fields already existed on the row (`stateDiv` from the state
   * differential, the verdict from `endStateVerdict`); this only puts them next to the cause string so
   * the join stops being a hand-classification. `by_cause_reconciles` asserts the tally covers exactly
   * the parted population — a grouping that silently drops rows is how a cause list flatters itself. */
  const byCause = new Map();
  for (const x of parted) {
    const cause = x.cls ? x.cls.cause : '(unclassified)';
    const e = byCause.get(cause) || { cause, games: 0,
      board_parted: 0, board_never_parted: 0,
      verdicts: Object.fromEntries(END_STATE_VERDICTS.map(v => [v, 0])),
      narration_games: 0, unknown_games: 0,
      /* HOW TIGHT THE ATTRIBUTION IS, AND IT IS NOT THE SAME CLAIM IN EACH COLUMN. This table joins a
       * CAUSE to a BOARD at GAME level: it says the game whose narration first parted here also parted
       * on a board. Same turn is the tight case. LATER is weaker — after two battles part they take
       * different actions, so a board that moves five turns on is not proven to be this cause's doing.
       * EARLIER means the board was already wrong before the narration said anything, so the named
       * cause is a symptom and not the earliest evidence. Printed per cause rather than pooled,
       * because a reader deciding what to fix needs to know which of the three he is looking at. */
      board_parted_same_turn: 0, board_parted_later: 0, board_parted_earlier: 0,
      materiality: null, first_board_divergence_turns: [] };
    e.games++;
    e.verdicts[x.v]++;
    if (x.r.stateDiv) { e.board_parted++; e.first_board_divergence_turns.push(x.r.stateDiv.turn);
      const dt = x.r.divTurn;
      if (dt == null || x.r.stateDiv.turn === dt) e.board_parted_same_turn++;
      else if (x.r.stateDiv.turn > dt) e.board_parted_later++;
      else e.board_parted_earlier++; }
    else {
      e.board_never_parted++;
      /* THE PER-GAME LABEL, DECIDED ON THE GAME AND NOT ON THE ROW'S TOTALS. A cause whose games split
       * three ways cannot be labelled by arithmetic over aggregates — that was this block's first
       * version and it would have called a mixed row narration whenever the counts happened to line
       * up. Every board boundary agreed AND the two last boards agree, or it is UNKNOWN. */
      if (x.v === 'SAME-END-STATE') e.narration_games++; else e.unknown_games++;
    }
    byCause.set(cause, e);
  }
  for (const e of byCause.values()) {
    /* A CAUSE IS ONE ROW AND ITS GAMES NEED NOT AGREE. The label is the STRONGEST thing measured on
     * it: one board-material game makes the cause board-material, because the mechanic demonstrably
     * can move a board. NARRATION-ONLY needs every game to have been compared and to have agreed. */
    e.materiality = e.board_parted ? 'BOARD-MATERIAL'
      : (e.narration_games === e.games ? 'NARRATION-ONLY' : 'UNKNOWN');
    e.first_board_divergence_turns = e.first_board_divergence_turns.sort((a, b) => a - b).slice(0, 6);
  }
  const byCauseRows = [...byCause.values()].sort((a, b) => b.games - a.games);
  const endReasons = new Map();
  for (const x of rowsWith) endReasons.set(x.r.endReason || '(none)', (endReasons.get(x.r.endReason || '(none)') || 0) + 1);
  const pctOf = (n, d) => (d ? +(n / d).toFixed(4) : null);
  const comparable = parted.filter(x => x.v === 'SAME-END-STATE' || x.v === 'DIFFERENT-END-STATE');

  /* ---- THE SEVERITY LADDER (2026-08-12, MEASURE) -----------------------------------------------
   *
   * `end_state_families` above is the leaf worklist and it is not a severity: `active[].hp` 179 games
   * counts a body killed by a move it cannot be hit by and a three-HP rounding residue in the same
   * row. Will read twenty-five battles by hand and found three WRONG OUTCOMES that this instrument
   * could not have surfaced, because a count has no order on it. The ladder is in
   * `engine/end_state_severity.js`; the rungs and the one place they depart from the brief are
   * documented there rather than restated here.
   *
   * IT IS COMPUTED OVER `DIFFERENT-END-STATE` GAMES ONLY, and that is a narrowing said out loud. A
   * game ONE engine ended (ENDED-APART) has no comparable final board at all and is a THIRD answer;
   * banding it would be inventing a severity for a comparison that was never made. It is carried
   * beside the ladder, never inside it. */
  const THRESH = { hpThresholdFrac: (opts && opts.hpThresholdFrac) || null };
  const banded = [];
  if (THRESH.hpThresholdFrac) {
    for (const x of rowsWith) {
      if (x.v !== 'DIFFERENT-END-STATE') continue;
      const s = ESS.severity(x.r.finalBoard, THRESH);
      const bodies = s.bodies.length ? s.bodies : [];
      const usesOf = bodies.map(b => speciesUses(b)).filter(u => u != null);
      banded.push({ ...s,
        /* NAMED SO THE BAND CAN BE OPENED AND READ. One team pair, one seed, one configuration and one
         * arm is exactly what `playGame` takes, so these four fields re-play the game. */
        game: { config: x.r.config, seed: x.r.seed, arm: x.r.arm, turns: x.r.turns,
                end_reason: x.r.endReason, board_turn: x.r.finalBoard.turn,
                leaves_compared: x.r.finalBoard.leaves_compared,
                differing_leaves: (x.r.finalBoard.diffs || []).length },
        shape: x.cls ? SHAPE.shapeOf(x.cls.cause).shape : 'PROTOCOL-NEVER-PARTED',
        protocol_parted: x.r.divTurn != null,
        /* RANK 2 IS CORPUS USAGE, exactly as divergence_report.js ranks its causes: the swarm's game
         * counts describe what the sampler chose to stage, and only the corpus describes what people
         * actually bring. `null` where no body in the evidence is in the corpus model — UNKNOWN, and
         * it sorts below a measured zero rather than above it. */
        max_body_uses: usesOf.length ? Math.max(...usesOf) : null,
      });
    }
  }
  banded.sort((a, b) => (a.band - b.band)
    || ((b.max_body_uses == null ? -1 : b.max_body_uses) - (a.max_body_uses == null ? -1 : a.max_body_uses)));
  const bandRows = ESS.BANDS.map(B => {
    const inB = banded.filter(x => x.band === B.rank);
    const bodies = new Map();
    for (const x of inB) for (const b of new Set(x.bodies)) {
      const e = bodies.get(b) || { body: b, games: 0, corpus_teams: speciesUses(b) };
      e.games++; bodies.set(b, e);
    }
    return { band: B.rank, band_id: B.id, what: B.what, games: inB.length,
             bodies: [...bodies.values()].sort((a, b) =>
               ((b.corpus_teams == null ? -1 : b.corpus_teams) - (a.corpus_teams == null ? -1 : a.corpus_teams))
               || (b.games - a.games)),
             /* THE GAMES THEMSELVES, capped. A band nobody can open is a count wearing a longer name;
              * the cap exists so the artifact stays readable and is stated rather than silent. */
             examples: inB.slice(0, 25),
             examples_capped_at: 25, examples_total: inB.length };
  });
  /* THE CROSS-TAB THE BRIEF ASKED FOR, AND THE PRIOR IT IS MEANT TO TEST: ordering-shaped divergences
   * should land in the harmless bands and rule-shaped ones in the severe bands. It is printed whether
   * or not it holds — a confirmed prior is worth less than a refuted one here, because an ORDERING
   * difference that changes who is alive would mean the scheduler decides games. */
  const shapeBand = new Map();
  for (const x of banded) {
    const e = shapeBand.get(x.shape) || { shape: x.shape, games: 0,
      by_band: Object.fromEntries(ESS.BANDS.map(B => [B.rank, 0])) };
    e.games++; e.by_band[x.band]++; shapeBand.set(x.shape, e);
  }
  /* THE QUARTER-HIT MASS, PUBLISHED RATHER THAN BURIED. A missing damage multiplier is a fraction of a
   * hit and therefore lands in the bottom band; the histogram is the only place a reader can see it. */
  const hitBuckets = [0.25, 0.5, 1, 2, 4];
  const hist = Object.fromEntries(hitBuckets.map(b => ['<=' + b + ' typical hits', 0]));
  hist['> 4 typical hits'] = 0; hist['no HP leaf differs'] = 0;
  if (THRESH.hpThresholdFrac) for (const x of rowsWith) {
    if (x.v !== 'DIFFERENT-END-STATE') continue;
    const g = ESS.hpGaps(x.r.finalBoard.diffs || [], x.r.finalBoard.parties || { medi: {}, sd: {} })
      .filter(y => y.frac != null);
    if (!g.length) { hist['no HP leaf differs']++; continue; }
    const n = Math.max(...g.map(y => y.frac)) / THRESH.hpThresholdFrac;
    const b = hitBuckets.find(k => n <= k);
    hist[b ? '<=' + b + ' typical hits' : '> 4 typical hits']++;
  }

  return {
    games: rows.length,
    verdicts: Object.fromEntries(V),
    protocol_parted: parted.length,
    protocol_never_parted: agreedAllAlong.length,
    of_the_games_whose_protocol_parted: tally(parted),
    of_the_games_whose_protocol_never_parted: tally(agreedAllAlong),
    /* TWO DENOMINATORS, THE SAME DISCIPLINE `identicalAtEndOfTurn` USES AND FOR THE SAME REASON.
     * `rate_of_all_parted_games` counts a thrown game and a battle only one engine ended AGAINST the
     * cosmetic claim — that is the honest headline. The conditional one is strictly larger and is the
     * rate among games where a final board could actually be compared. Printing one silently is how a
     * rate flatters itself. */
    wording_rate_of_all_parted_games: pctOf(tally(parted)['SAME-END-STATE'], parted.length),
    wording_rate_of_parted_games_with_a_comparable_end: pctOf(tally(parted)['SAME-END-STATE'], comparable.length),
    parted_games_with_a_comparable_end: comparable.length,
    by_shape: [...byShape.values()].sort((a, b) => b.games - a.games),
    /* ---- THE BOARD-MATERIALITY TABLE, PER CAUSE. See the block that builds it. ------------------ */
    by_cause: byCauseRows,
    by_cause_totals: {
      causes: byCauseRows.length,
      games: byCauseRows.reduce((a, e) => a + e.games, 0),
      BOARD_MATERIAL: byCauseRows.filter(e => e.materiality === 'BOARD-MATERIAL').length,
      NARRATION_ONLY: byCauseRows.filter(e => e.materiality === 'NARRATION-ONLY').length,
      UNKNOWN: byCauseRows.filter(e => e.materiality === 'UNKNOWN').length,
      games_board_material: byCauseRows.reduce((a, e) => a + e.board_parted, 0),
      games_board_material_same_turn: byCauseRows.reduce((a, e) => a + e.board_parted_same_turn, 0),
      games_board_material_board_parted_later: byCauseRows.reduce((a, e) => a + e.board_parted_later, 0),
      games_board_material_board_parted_earlier: byCauseRows.reduce((a, e) => a + e.board_parted_earlier, 0),
      games_narration_only: byCauseRows.reduce((a, e) => a + e.narration_games, 0),
      games_unknown: byCauseRows.reduce((a, e) => a + e.unknown_games, 0),
      /* THE RECEIPT. The three game columns must add to the parted population exactly; a grouping
       * that drops a row is a cause list flattering itself, and it would do it silently. */
      by_cause_reconciles: byCauseRows.reduce((a, e) => a + e.games, 0) === parted.length
        && byCauseRows.reduce((a, e) => a + e.board_parted + e.narration_games + e.unknown_games, 0) === parted.length,
      bounded_by: 'NARRATION-ONLY is bounded by board_state.js NOT_COMPARED (published in this '
                + 'artifact as end_state_not_compared) and by the turn cap: a board that would part '
                + 'after the cap reads as narration here.',
    },
    end_state_families: [...fam.entries()].sort((a, b) => b[1] - a[1]).map(([family, games]) => ({ family, games })),
    end_reasons: [...endReasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, games]) => ({ reason, games })),
    /* ---- THE SEVERITY LADDER, over the DIFFERENT-END-STATE games only ---------------------------- */
    severity: !THRESH.hpThresholdFrac ? null : {
      what: 'HOW BAD each DIFFERENT-END-STATE game is, ordered by what it means for the game rather '
          + 'than by how many leaves parted. Rungs and their definitions: engine/end_state_severity.js.',
      scope: 'DIFFERENT-END-STATE games only. ENDED-APART has no comparable final board and is a THIRD '
           + 'answer — it is counted beside this ladder and never inside it.',
      games_banded: banded.length,
      hp_threshold_fraction_of_max_hp: THRESH.hpThresholdFrac,
      bands: bandRows,
      /* THE CONTAINMENT THE SWAP MAKES VISIBLE. Every different-winner game also has a different set
       * of bodies alive; this says how many, so the swap hides nothing. */
      different_winner_also_different_bodies_alive:
        banded.filter(x => x.band === 1 && x.also_different_bodies_alive).length,
      by_shape_and_band: [...shapeBand.values()].sort((a, b) => b.games - a.games),
      hp_gap_in_typical_hits: hist,
      hp_gap_note: 'A MISSING DAMAGE MULTIPLIER IS A FRACTION OF A HIT. A lost x1.33 on a hit worth 40% '
                 + 'of a health bar is about a quarter of a hit, so it lands in the bottom band unless '
                 + 'it flips a knockout — in which case it is band 2. This histogram is where that mass '
                 + 'is visible; "small" in band 6 does not mean harmless.',
    },
    caveat: 'SAME-END-STATE says the two engines ARRIVED at the same board on every leaf '
          + 'board_state.js compares. It does NOT say the turns in between agreed, and it is bounded '
          + 'by that file\'s NOT_COMPARED list, published with this artifact.',
  };
}
/* THE RULER IS CUT PER ARM AND NEVER POOLED, on the same rule as every other rate in this file. The
 * arms sit at opposite corners of the damage roll, so "a typical hit" is genuinely a different quantity
 * in each; one pooled median would describe neither and would band the two arms against a threshold
 * belonging to the average of two things nobody played.
 *
 * AN ARM THAT NARRATED NO HITS GETS NO LADDER, not a default threshold. `severity` throws rather than
 * accepting a missing one, so the failure is a refusal at the top rather than a band computed against
 * a number nobody measured. */
const END_STATE_BY_ARM = ARM_RUNS.map(a => {
  if (!END_STATE) return { arm: a.arm.id, summary: null };
  /* THE COUNTERS ARE RE-DERIVED PER ARM RATHER THAN READ OFF `HIT_FAILS`, which is module-level and
   * therefore accumulates across both arms AND the control games. The first version published the
   * same 14,614 excluded residuals against BOTH arms while their hit counts differed (1,612 and
   * 1,321) — a receipt that describes a different population from the figure beside it is worse than
   * no receipt, because it reads as though it had been measured. */
  const fr = [], fails = {};
  for (const r of a.results) {
    if (!r.sdHitFracs) continue;
    for (const f of r.sdHitFracs) fr.push(f);
    for (const [k, v] of Object.entries(r.sdHitFails || {})) fails[k] = (fails[k] || 0) + v;
  }
  const ruler = ESS.typicalHit(fr, fails);
  const s = endStateSummary(a.results, { hpThresholdFrac: ruler.median_fraction_of_max_hp });
  if (s) s.severity_ruler = ruler;
  return { arm: a.arm.id, summary: s, ruler };
});

console.log('\nWHOLE-GAME DIFFERENTIAL — MODE A (pinned, tolerance zero)   ' + REL.id);
console.log('  ' + results.length + ' games in the primary arm, ' + ARM_RUNS.length + ' arm(s), '
  + elapsed + 's, showdown ' + (CS.actualCommit() || 'UNKNOWN').slice(0, 12));
console.log('  tags.json in the release matches the live tree: ' + (TAGS_MATCH ? 'yes' : 'NO — the coverage sets and the engine were frozen from different bytes'));
console.log('');
console.log('  *** THE BASELINE RESET ON 2026-08-07 AND NOTHING BEFORE IT IS COMPARABLE WITH THIS RUN.');
console.log('  *** ROADMAP #88 gave this instrument FOUR pinned arms where it had one, and #91 moved');
console.log('  *** coverage credit from the CLICK to the OBSERVED EFFECT. Both change which games get');
console.log('  *** played. The 75.5% turn-1 figure and data/state-ladder.json describe the OLD');
console.log('  *** instrument. mode = ' + MODE);
console.log('');
console.log('  THE PIN — every claim below was asserted before a game ran, PER ARM:');
for (const a of ARMS_RUN) {
  console.log('    ' + a.id + '   ' + a.what);
  for (const [w] of PIN_CLAIMS_BY_ARM.get(a.id)) console.log('      ok  ' + w.slice(a.id.length + 2));
}
console.log('');
/* ---- PER ARM, NEVER POOLED --------------------------------------------------------------------- */
console.log('  THE ARMS. Four pins, the same teams, the same driver state at the start of each — so a');
console.log('  difference between two rows is the DIE and nothing else. These are NOT averaged: "the');
console.log('  boards agree at max damage" and "the boards agree at min damage" are different claims.');
console.log('     games  diverged  threw   median turns   turn-1 board   arm');
for (const a of ARM_RUNS) {
  const dv = a.results.filter(r => r.div).length, th = a.results.filter(r => r.err).length;
  const tt = a.results.map(r => r.turns).sort((x, y) => x - y);
  /* THE TURN-1 BOARD PER ARM, because that is the headline number and pooling it across four
   * differently-pinned samples would describe none of them. `--` when the run was not asked for
   * `--state`, which is a different claim from 0. */
  const t1r = a.results.filter(r => (r.earlyBoards || [])[1]);
  const t1ok = t1r.filter(r => r.earlyBoards[1].identical).length;
  console.log('    ' + String(a.results.length).padStart(5) + '  ' + String(dv).padStart(8) + '  '
    + String(th).padStart(5) + '   ' + String(tt.length ? tt[Math.floor(tt.length / 2)] : 0).padStart(12)
    + '   ' + (STATE ? (t1ok + '/' + t1r.length).padStart(12) : '          --')
    + '   ' + a.arm.id);
}
console.log('    THE SPEED TIE COST, read straight off the first two rows: they differ only in which');
console.log('    body medicham2 gives a tie to. ' + SHUFFLE_TIE_GROUPS + ' tied groups were resolved in '
  + 'this run (sizes ' + [...SHUFFLE_GROUP_SIZES].sort((a, b) => a[0] - b[0]).map(([n, c]) => n + 'x' + c).join(', ') + ').');
if (!SHUFFLE_TIE_GROUPS) console.log('    ZERO TIED GROUPS — the tie arms tested NOTHING and would look exactly like arms that did.');
console.log('');
console.log('  DIVERGED (primary arm ' + PRIMARY_ARM.id + '): ' + diverged.length + ' of ' + results.length + ' games'
  + (threw.length ? '   (' + threw.length + ' threw)' : ''));

/* ---- ROADMAP #241(3) — WHAT DID THE BODY CLICK WHEN THE AUTHORITY FAILED IT? --------------------
 * `engine/gate_fail_and_silent.js` COUNTS this class and, by construction, cannot say what is in it:
 * a generic failure is `add('-fail', pokemon)` with `attrLastMove('[still]')`, so the line names the
 * MOVER and never the move. Twenty-one causes were recorded that way and the first fixture hunt went
 * at the CAST instead — six staged field moves, five of which already agreed. The authority's own
 * `|move|` line, two lines up, is where the move is named, so it is printed here beside the count. */
{
  const rows = [];
  for (const r of diverged) {
    if (!r.div || !/^\|-fail\|/.test(String(r.div.sdRaw || ''))) continue;
    if (r._cls.cls !== 'event missing from medicham2') continue;
    const lead = (r.div.sdBeforeRaw || []).filter(l => /^\|move\|/.test(String(l))).pop() || '';
    const f = String(lead).split('|');
    rows.push({ move: id(f[3] || '(no |move| line in the six before it)'),
                who: String(r.div.sdRaw).split('|')[2] || '', seed: r.seed, config: r.config });
  }
  console.log('');
  const lm = [];
  for (const r of results) for (const x of (r.lastMoveRows || [])) lm.push(x);
  const lmGames = results.filter(r => (r.lastMoveRows || []).length).length;
  console.log('    lastMove DISAGREEMENTS (the gate Encore reads): ' + lm.length + ' readings in '
    + lmGames + ' of ' + results.length + ' games');
  {
    const by = {};
    for (const x of lm) (by[x.showdown + ' <> ' + x.medicham] = (by[x.showdown + ' <> ' + x.medicham] || 0) + 1);
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12))
      console.log('      ' + String(v).padStart(4) + '  showdown ' + k.split(' <> ')[0]
        + '   medicham ' + k.split(' <> ')[1]);
    for (const x of lm.slice(0, 8))
      console.log('        e.g. turn ' + x.when + '  ' + x.slot + ' ' + x.body
        + '   showdown ' + x.showdown + '   medicham ' + x.medicham);
  }
  console.log('  -fail AND SILENT (ROADMAP #241(3)): ' + rows.length
    + ' games where the authority emitted a bare `-fail` and this engine emitted nothing');
  if (!rows.length) {
    console.log('    zero in this run.');
  } else {
    const by = {};
    for (const x of rows) (by[x.move] = by[x.move] || []).push(x);
    for (const [mv, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
      console.log('    ' + String(v.length).padStart(4) + '  ' + mv
        + '   e.g. ' + v[0].who + '  [' + v[0].config + ']');
    }
  }
}

/* ---- ROADMAP #290 — DO THE TWO ENGINES AGREE ABOUT SPEED? --------------------------------------
 * See `speedAgree` in playGame. This is the FACT under the `ordering` class: if the two engines put
 * a different number in the sort key, the sort being right cannot save the order. Reported as its
 * own block rather than folded into a class, because a speed disagreement is not a narration event
 * and would otherwise be attributed to whichever line happened to move. */
{
  const rows = [];
  let desync = 0;
  for (const r of results) { for (const x of (r.speedRows || [])) rows.push(x); desync += (r.speedDesync || 0); }
  const games = results.filter(r => (r.speedRows || []).length).length;
  console.log('');
  if (SPEED_THREW.n) console.log('  SPEED READINGS THAT THREW: ' + SPEED_THREW.n
    + '   first: ' + SPEED_THREW.first + '   (these are NOT agreements)');
  console.log('  SPEED AGREEMENT (getActionSpeed vs effSpeed, every active body at every boundary): '
    + rows.length + ' disagreeing readings in ' + games + ' of ' + results.length + ' games'
    + (desync ? '   [' + desync + ' index-parallel desyncs, NOT speed findings]' : ''));
  if (!rows.length) {
    console.log('    zero — the two engines put the same number in the sort key everywhere this run looked.');
  } else {
    /* THE SPLIT FIRST, because the two halves are different defects. A ROUNDING-ONLY row is
     * `Math.floor` apart and turns a genuine speed TIE into a deterministic win; a REAL GAP is a
     * multiplier one engine applied and the other did not. */
    const ro = rows.filter(x => x.same_when_floored), rg = rows.filter(x => !x.same_when_floored);
    const gamesOf = pred => results.filter(r => (r.speedRows || []).some(pred)).length;
    console.log('    ROUNDING ONLY ' + String(ro.length).padStart(4) + ' readings in '
      + gamesOf(x => x.same_when_floored) + ' games');
    console.log('    REAL GAP      ' + String(rg.length).padStart(4) + ' readings in '
      + gamesOf(x => !x.same_when_floored) + ' games');
    const by = {};
    for (const x of rows) {
      const k = (x.same_when_floored ? 'ROUNDING ONLY  ' : 'REAL GAP       ')
        + 'ability=' + (x.ability || '-') + (x.ability === x.sd_ability ? '' : '/sd:' + x.sd_ability)
        + '  item=' + (x.item || '-') + (x.item === x.sd_item ? '' : '/sd:' + x.sd_item)
        + '  status=' + (x.status || '-') + (x.status === x.sd_status ? '' : '/sd:' + x.sd_status)
        + '  weather=' + (x.weather || '-') + '/sd:' + (x.sd_weather || '-')
        + '  tw=' + x.tailwind_me + '  boost=' + x.boost_spe_me + '/sd:' + x.boost_spe_sd
        + '  tr=' + x.trickroom + '/sd:' + x.sd_trickroom;
      (by[k] = by[k] || []).push(x);
    }
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length).slice(0, 40)) {
      const e = v[0];
      console.log('    ' + String(v.length).padStart(4) + '  ' + k);
      console.log('          e.g. ' + e.slot + ' ' + e.body + '  showdown ' + e.showdown
        + '  medicham ' + e.medicham + '  (turn ' + e.when + ')'
        + '   [getActionSpeed raw ' + e.sd_raw + ', getStat spe ' + e.sd_stat + ']');
    }
  }
}
/* THE MIDDLE ARM REPORTS ITS OWN FAILURE BESIDE ITS RESULT, NOT INSTEAD OF IT. A divergence count
 * from an arm whose streams desynchronised is not a smaller truth, it is a different number
 * entirely -- so the void games are separated and the rate is quoted over what is left. */
/* THE VOID BLOCK GOES IN THE ARTIFACT. It was printed to a console and nowhere else for as long as
 * the middle arm has existed, so `data/game-differential.json` published a `diverged` whose
 * denominator INCLUDED every game the instrument could not read, and no reader could tell. */
let MID_VOID_SUMMARY = null;
if (PRIMARY_ARM.middle) {
  const voided = results.filter(r => r._mid_void).length;
  const usable = results.filter(r => !r._mid_void);
  const divUsable = usable.filter(r => r.div).length;
  MID_VOID_SUMMARY = {
    void_games: voided, usable_games: usable.length,
    diverged_among_usable: divUsable,
    diverged_rate_over_usable: usable.length ? +(divUsable / usable.length).toFixed(4) : null,
    mid_battle_bound_at_install: !MID_UNBOUND,
    empty_address_games_counted_void: VOID_EMPTY_IS_VOID,
    overlap_floor: MID_OVERLAP_FLOOR,
    by_reason: Object.fromEntries([...MID_VOID_BY_REASON].sort((a, b) => b[1] - a[1])),
    /* THE CROSS-TAB THAT DECIDES WHETHER A VOID RULE IS THROWING AWAY EVIDENCE OR NOISE. Per verdict:
     * how many of those games DIVERGED, and how many turns they lasted. A population that is 100%
     * diverged at a median of 0 completed turns is not a desync — it is a deterministic disagreement
     * reached before either engine rolled anything, which is the strongest evidence this run holds. */
    by_reason_detail: Object.fromEntries([...MID_VOID_BY_REASON.keys()].map(k => {
      const g = results.filter(r => r._mid_why === k);
      const t = g.map(r => r.turns).sort((a, b) => a - b);
      return [k, { games: g.length, diverged: g.filter(r => r.div).length,
                   median_turns: t.length ? t[Math.floor(t.length / 2)] : null,
                   max_turns: t.length ? t[t.length - 1] : null }];
    })),
    low_identity_by_category: Object.fromEntries([...MID_VOID_BY_CAT].sort((a, b) => b[1] - a[1])),
    unshared_address_shapes: Object.fromEntries([...MID_VOID_SHAPES].sort((a, b) => b[1] - a[1]).slice(0, 40)),
    unshared_address_field: Object.fromEntries([...MID_VOID_FIELDS].sort((a, b) => b[1] - a[1]).slice(0, 40)),
    one_sided_game_shapes: Object.fromEntries([...MID_ONE_SIDED_SHAPES].sort((a, b) => b[1] - a[1]).slice(0, 40)),
    unshared_address_field_rollup: (() => { const r = {};
      for (const [k, n] of MID_VOID_FIELDS) { const f = k.split('  (')[0]; r[f] = (r[f] || 0) + n; }
      return Object.fromEntries(Object.entries(r).sort((a, b) => b[1] - a[1])); })(),
    no_battle_draws: MID_NO_BATTLE_DRAWS,
    damage_roll_index_inversions: MID_DAMAGE_INDEX_FLIPS,
    sd_addresses_dropped_as_not_this_game: MID_SD_LOG_DROPPED,
  };
  console.log('  VOID (instrument desync): ' + voided + ' of ' + results.length
    + '   -- the two engines did not name the same events; these are NOT divergences');
  console.log('  DIVERGED among the ' + usable.length + ' usable games: ' + divUsable
    + (usable.length ? '  (' + (100 * divUsable / usable.length).toFixed(1) + '%)' : ''));
  console.log('  category wrapper: ' + (MID_WRAP_ERROR ? 'NOT INSTALLED — ' + MID_WRAP_ERROR
    : MIDW.enters + ' entries into this module\'s holder, ' + MIDW.adopted + ' reload(s) adopted it, '
      + (MID_UNSHARED ? 'state PER-MODULE (--red arm)' : 'state shared'))
    + (!MID_WRAP_ERROR && !MIDW.enters ? '   <-- ZERO: every authority draw was addressed `any`' : ''));
  console.log('  MID_BATTLE bound at install: ' + (MID_UNBOUND ? 'NO — --mid-unbound, this is the '
    + 'ROADMAP #220 BEFORE-ARM and is not a current measurement' : 'yes'));
  console.log('  empty-address games counted VOID: ' + (VOID_EMPTY_IS_VOID ? 'YES — --void-empty-is-void, '
    + 'the pre-2026-08-18 rule' : 'no (they drew no dice, so there is no desync to have)'));
  /* WHY, BY CAUSE — a population of several hundred games published as one integer can be quoted and
   * cannot be attacked. Every verdict this check reached is counted, including the ones that are NOT
   * void, so the denominators are visible rather than inferred. */
  console.log('  every verdict the void check reached, by cause:');
  for (const [k, n] of [...MID_VOID_BY_REASON].sort((a, b) => b[1] - a[1]))
    console.log('      ' + String(n).padStart(5) + '  ' + k + (k === 'low-identity' || VOID_EMPTY_IS_VOID && k.startsWith('no-addresses') ? '   <-- VOID' : ''));
  if (MID_VOID_BY_CAT.size) {
    console.log('  of the low-identity games, which outcome category carried an unshared address (per game):');
    for (const [k, n] of [...MID_VOID_BY_CAT].sort((a, b) => b[1] - a[1]))
      console.log('      ' + String(n).padStart(5) + '  ' + k);
    console.log('  WHICH FIELD of `seed|turn|cat|move|target|nth` the two sides disagreed about:');
    { const r = new Map();
      for (const [k, n] of MID_VOID_FIELDS) { const f = k.split('  (')[0]; r.set(f, (r.get(f) || 0) + n); }
      for (const [k, n] of [...r].sort((a, b) => b[1] - a[1])) console.log('      ' + String(n).padStart(6) + '  ' + k); }
    console.log('  and by move, top 12:');
    for (const [k, n] of [...MID_VOID_FIELDS].sort((a, b) => b[1] - a[1]).slice(0, 12))
      console.log('      ' + String(n).padStart(6) + '  ' + k);
    console.log('  the unshared addresses themselves, `category move [side]`, top 15:');
    for (const [k, n] of [...MID_VOID_SHAPES].sort((a, b) => b[1] - a[1]).slice(0, 15))
      console.log('      ' + String(n).padStart(6) + '  ' + k);
  }
  if (MID_ONE_SIDED_SHAPES.size) {
    console.log('  games where ONE engine drew and the other drew NOTHING — not void, but not nothing either:');
    for (const [k, n] of [...MID_ONE_SIDED_SHAPES].sort((a, b) => b[1] - a[1]).slice(0, 12))
      console.log('      ' + String(n).padStart(6) + '  ' + k);
  }
  if (MID_VOID_DETAIL.length) {
    console.log('  which stream parted, first few:');
    for (const d of MID_VOID_DETAIL.slice(0, 6)) console.log('      ' + d);
    for (const x of MID_SAMPLE) {
      console.log('    -- one voided game, first addresses each side --');
      for (const a of x.sd) console.log('       SD  ' + a);
      for (const a of x.me) console.log('       ME  ' + a);
    }
  }
}
console.log('');

/* ---- THE STATE DIFFERENTIAL, REPORTED BESIDE THE PROTOCOL NUMBER --------------------------------
 * Two numbers, and they answer different questions. The protocol rate says whether the two engines
 * TELL THE SAME STORY; the state rate says whether they REACH THE SAME BOARD. Ten wires were aimed
 * with the first alone. */
const STATE_SUMMARY = (() => {
  if (!STATE) return null;
  const bTot = results.reduce((a, r) => a + (r.boundaries || 0), 0);
  const bAgr = results.reduce((a, r) => a + (r.boundariesAgreed || 0), 0);
  const gamesWithABoundary = results.filter(r => r.boundaries > 0);
  const neverParted = gamesWithABoundary.filter(r => !r.stateDiv);
  /* THE CROSS-TABLE — the question the whole pass turns on. A game whose PROTOCOL parted and whose
   * BOARD did not is a divergence the protocol instrument counted and that changes nothing a search
   * can see. `later` is the weaker version of the same claim: the narration parted first and the
   * board survived at least one more boundary. */
  const P = results.filter(r => r.divTurn != null);
  const reachedSameBoard = P.filter(r => !r.stateDiv);
  const boardHeldLonger = P.filter(r => r.stateDiv && r.stateDiv.turn > r.divTurn);
  const boardPartedFirst = results.filter(r => r.stateDiv && (r.divTurn == null || r.stateDiv.turn < r.divTurn));
  /* WHICH PART OF THE BOARD PARTED, families collapsed the way the protocol side collapses causes:
   * twelve games hitting one wire is ONE wire. Every differing leaf of the FIRST divergent board is
   * counted, not only the first, because a turn that parts on six fields at once is one event with
   * six symptoms and picking one of them arbitrarily would hide the other five. */
  const fam = new Map(), famGames = new Map();
  for (const r of results) {
    if (!r.stateDiv) continue;
    const seen = new Set();
    for (const d of r.stateDiv.diffs) {
      const f = BS.family(d.path);
      fam.set(f, (fam.get(f) || 0) + 1);
      seen.add(f);
    }
    for (const f of seen) famGames.set(f, (famGames.get(f) || 0) + 1);
  }
  const turnsOf = results.map(r => (r.stateDiv ? r.stateDiv.turn : null)).filter(x => x != null).sort((a, b) => a - b);

  /* ---- THE HEADLINE: IS THE BOARD IDENTICAL AT THE END OF TURN 1 ---------------------------------
   *
   * Will, 2026-08-07, after a more correct engine failed to predict better: *"I ONLY CARE ABOUT TURN 1
   * TO START."* One number, bounded, target 100%.
   *
   * AND IT REPLACES A STATISTIC THAT WAS STRUCTURALLY BLIND. The median first-divergence TURN read 1 at
   * all ten rungs and was reported ten times as "nothing moved", while games agreeing start to finish
   * went 7 -> 134 of 1,997 on the protocol side. The distribution is BIMODAL and a median cannot move on
   * one until half the mass crosses; 6.7% is nowhere near 50%. A turn-1 rate has no such blind spot.
   *
   * TWO DENOMINATORS, BOTH PRINTED, because they answer different questions and picking one silently is
   * how a rate flatters itself. `rate_of_all_games` counts a game that never reached a turn-1 boundary
   * (its board parted at the LEADS, or the battle was already over) AGAINST the engine — that is the
   * honest headline. `rate_of_games_that_reached_it` is the conditional one, and it is strictly larger. */
  const earlyRate = (n) => {
    const reached = results.filter(r => ((r.earlyBoards || [])[n]));
    const ident = reached.filter(r => r.earlyBoards[n].identical);
    return { turn: n, games: results.length, reached: reached.length, identical: ident.length,
             rate_of_all_games: results.length ? +(ident.length / results.length).toFixed(4) : null,
             rate_of_games_that_reached_it: reached.length ? +(ident.length / reached.length).toFixed(4) : null };
  };
  const identicalAtEndOfTurn = [1, 2, 3].map(earlyRate);

  /* ---- THE DECAY, TURN BY TURN, WITH THE DENOMINATOR STATED AT EACH ENTRY -----------------------
   *
   * `turn_boundary_agreement` POOLS every turn-ending in the run and is kept, but it is not the
   * headline and the reason is structural: TURN 1 IS THE ONLY TURN THAT BEGINS FROM A BOARD BOTH
   * ENGINES AGREE ON. Every later turn in a pooled count begins from wherever the run had already
   * drifted, so a pooled rate is contaminated by earlier error — it reads worse than the engine is on
   * turn 1 and better than it is on turn 6, and it hides which of the two moved between two arms.
   *
   * HERE THE DENOMINATOR IS STATED PER TURN: games that REACHED that turn. Under this driver's stop
   * rule — the game halts at the first divergent board — reaching turn N means the board was identical
   * through turn N-1, so `rate_given_it_reached_this_turn` is exactly the conditional question: GIVEN
   * the two engines still agree entering this turn, do they still agree after it. A game that ended
   * early is not counted as agreement anywhere.
   *
   * DERIVED FROM `boundaries` AND `stateDiv.turn`, WHICH IS A SECOND, INDEPENDENT ROUTE TO THE SAME
   * NUMBER — `identicalAtEndOfTurn` above reads the kept board records instead. They are cross-checked
   * against each other below and a disagreement is printed rather than resolved, because two
   * derivations that quietly differ is how a rate stops meaning anything. */
  const agreementByTurn = [];
  for (let n = 1; n <= MAXTURNS; n++) {
    const reached = results.filter(r => (r.boundaries || 0) >= n + 1);
    const agreed = reached.filter(r => !r.stateDiv || r.stateDiv.turn > n);
    agreementByTurn.push({ turn: n, reached: reached.length, identical: agreed.length,
      rate_given_it_reached_this_turn: reached.length ? +(agreed.length / reached.length).toFixed(4) : null,
      rate_of_all_games: results.length ? +(agreed.length / results.length).toFixed(4) : null });
  }
  const decayCrossCheck = identicalAtEndOfTurn.map((e, i) => ({
    turn: e.turn, from_kept_boards: e.identical, from_the_counters: agreementByTurn[i].identical,
    agree: e.identical === agreementByTurn[i].identical }));
  if (decayCrossCheck.some(x => !x.agree)) {
    console.log('  THE TWO DERIVATIONS OF THE TURN-1..3 RATE DISAGREE — one of them is wrong and no '
      + 'number below can be trusted: ' + JSON.stringify(decayCrossCheck));
  }

  /* ---- WHAT EXACTLY IS DIFFERENT AT THE END OF TURN 1 -------------------------------------------
   * Aggregated by FIELD and by CAUSE across every game, because Will asked for a queue chosen by what
   * changes a board rather than by which protocol line happened to be first. */
  const T1 = results.filter(r => (r.earlyBoards || [])[1]);
  const T1BAD = T1.filter(r => !r.earlyBoards[1].identical);
  /* THE ACTIVE BODY IS IN THE PARTY TOO, AND IT IS ONE FACT. `sides.p1.party.mamoswine.hp` and
   * `sides.p1.active[0].hp` read the SAME body when Mamoswine is standing, so every active-HP
   * divergence was arriving as two rows and every cause string read `active[].hp + party.hp`. Both
   * leaves are genuinely compared and stay in the leaf counts; what is suppressed here is the DUPLICATE
   * in the queue, because a wire queue that lists one defect twice is a worse queue.
   *
   * DROPPED ONLY WHEN THE BODY IS ACTIVE IN EITHER ENGINE, and COUNTED. On a species divergence the two
   * engines disagree about who is standing, and the union is the safe side of that: the active row is
   * compared regardless, so nothing can be lost by this — only de-duplicated. */
  const fieldAgg = new Map(), causeAgg = new Map();
  let PARTY_DUPES = 0;
  const isDuplicateOfActive = (d, board) => String(d.field).indexOf('party.') === 0 && d.side
    && ((board.active_species || {})[d.side] || []).indexOf(d.body) >= 0;
  for (const r of T1BAD) {
    const ds = r.earlyBoards[1].diffs.filter(d => {
      if (isDuplicateOfActive(d, r.earlyBoards[1])) { PARTY_DUPES++; return false; }
      return true;
    });
    const seenField = new Set(), tags = new Set();
    for (const d of ds) {
      const key = d.family;
      if (!fieldAgg.has(key)) fieldAgg.set(key, { field: key, games: 0, leaves: 0, buckets: new Map() });
      const e = fieldAgg.get(key);
      e.leaves++; e.buckets.set(d.bucket, (e.buckets.get(d.bucket) || 0) + 1);
      seenField.add(key);
      tags.add(key + ' (' + d.bucket + ')');
    }
    for (const f of seenField) fieldAgg.get(f).games++;
    /* THE CAUSE IS THE SET OF FIELD+MAGNITUDE PAIRS THE BOARD PARTED ON, not the first one. A turn that
     * parts on HP and on an item is ONE event with two symptoms, and picking either arbitrarily would
     * hide the other — the same rule the protocol side applies to its causes. Capped at four so a
     * cascade does not become its own unique cause and defeat the grouping. */
    const list = [...tags].sort();
    const cause = list.slice(0, 4).join(' + ') + (list.length > 4 ? ' + ' + (list.length - 4) + ' more' : '');
    if (!causeAgg.has(cause)) causeAgg.set(cause, { cause, games: 0, example: null });
    const c = causeAgg.get(cause); c.games++; if (!c.example) c.example = r;
  }
  const byField = [...fieldAgg.values()].sort((a, b) => b.games - a.games)
    .map(e => ({ field: e.field, games: e.games, differing_leaves: e.leaves,
                 buckets: Object.fromEntries([...e.buckets].sort((a, b) => b[1] - a[1])) }));
  const byCause = [...causeAgg.values()].sort((a, b) => b.games - a.games);

  /* THE PLAIN-ENGLISH CASE. Will: *"OR YOU CAN TELL ME."* — no replay file, no player, no protocol.
   * The turn, the four bodies, the four clicks, what the authority says, what we say, and the field
   * diff. It describes; it does not judge which one is right. */
  const narrate = (r) => {
    const b0 = r.earlyBoards[1], cl = r.earlyClicks[1] || { p1: [], p2: [] };
    /* THE SAME DE-DUPLICATION THE QUEUE USES. A case that listed `Mamoswine hp` and `Mamoswine
     * party.hp` as two findings would be telling a reader there are two problems. */
    const b = Object.assign({}, b0, { diffs: b0.diffs.filter(d => !isDuplicateOfActive(d, b0)) });
    const leads = s => (cl[s] || []).map(x => x.body).join(' + ');
    return {
      seed: r.seed, config: r.config,
      /* THE SEED IS ONLY REPRODUCIBLE WITH THE POOL BESIDE IT. Until ROADMAP #87 `diff_swarm` read the
       * team store LIVE and a stored seed no longer resolved to a game — the pool had moved under it.
       * Recording the digest is what makes any of these cases replayable at all. */
      engine_release: REL.stamp().engine_release, team_pool_digest: STEER_STAMP.team_pool_digest || null,
      turn: 1,
      leads: { p1: leads('p1'), p2: leads('p2') },
      clicks: ['p1', 'p2'].flatMap(s => (cl[s] || []).map(x => x.body + ' ' + x.did)),
      showdown_says: b.diffs.map(d => BS.explain(d, d.sd, pretty)),
      we_say: b.diffs.map(d => BS.explain(d, d.us, pretty)),
      field_diff: b.diffs.map(d => ({
        slot: d.slot || d.side || 'field', body: d.body ? pretty(d.body) : '',
        field: d.field, showdown: d.sd, ours: d.us, how_wrong: d.bucket })),
      fields_compared: b.leaves_compared, fields_identical: b.leaves_compared - b.diffs.length,
      protocol_diverged_at_turn: r.divTurn,
    };
  };
  const turn1Cases = byCause.slice(0, 15).map(c => ({ cause: c.cause, games: c.games, case: narrate(c.example) }));

  /* THE SEMANTICS QUESTION, SCOPED TO THE TURN WILL CARES ABOUT: of the games whose NARRATION parted
   * inside turn 1, how many reached an identical BOARD at the end of it anyway. */
  const protoT1 = results.filter(r => r.divTurn === 1 && (r.earlyBoards || [])[1]);
  const protoT1SameBoard = protoT1.filter(r => r.earlyBoards[1].identical);
  /* AND THE SAME QUESTION BY PROTOCOL CLASS — which classes are pure announcement and which move a
   * board. `_cls` is stamped on every diverged result above; it is read, never recomputed. */
  const clsTab = new Map();
  for (const r of results) {
    if (!r._cls || !(r.earlyBoards || [])[1]) continue;
    const k = r._cls.cls;
    if (!clsTab.has(k)) clsTab.set(k, { cls: k, games: 0, board_identical_at_end_of_turn1: 0 });
    const e = clsTab.get(k); e.games++; if (r.earlyBoards[1].identical) e.board_identical_at_end_of_turn1++;
  }

  return {
    /* THE HEADLINE, NAMED SO IT CANNOT BE MISTAKEN FOR THE POOLED RATE BELOW. */
    turn1_boards_identical: identicalAtEndOfTurn[0].identical,
    turn1_boards_identical_fraction: identicalAtEndOfTurn[0].rate_of_all_games,
    identical_at_end_of_turn: identicalAtEndOfTurn,
    agreement_by_turn: agreementByTurn,
    agreement_by_turn_cross_check: decayCrossCheck,
    turn1: {
      what: 'THE HEADLINE. The board at the end of turn 1, after the whole residual phase — the board '
          + 'the turn-2 decision is actually made from. Target 100%.',
      games: results.length, reached_a_turn1_boundary: T1.length,
      identical: T1.length - T1BAD.length,
      rate_of_all_games: identicalAtEndOfTurn[0].rate_of_all_games,
      rate_of_games_that_reached_it: identicalAtEndOfTurn[0].rate_of_games_that_reached_it,
      never_reached_turn1: results.length - T1.length,
      protocol_parted_during_turn1: protoT1.length,
      protocol_parted_during_turn1_board_identical_anyway: protoT1SameBoard.length,
      by_field: byField, by_cause: byCause.map(({ example, ...c }) => c),
      by_protocol_class: [...clsTab.values()].sort((a, b) => b.games - a.games),
      cases: turn1Cases,
      party_rows_suppressed_as_a_second_view_of_a_standing_body: PARTY_DUPES,
      display_name_lookups_that_missed: PRETTY_MISSES,
    },
    turn_boundaries_compared: bTot, turn_boundaries_identical: bAgr,
    turn_boundary_agreement: bTot ? +(bAgr / bTot).toFixed(4) : null,
    games: gamesWithABoundary.length, games_board_never_diverged: neverParted.length,
    game_agreement: gamesWithABoundary.length ? +(neverParted.length / gamesWithABoundary.length).toFixed(4) : null,
    median_turn_of_first_board_divergence: turnsOf.length ? turnsOf[Math.floor(turnsOf.length / 2)] : null,
    protocol_diverged_games: P.length,
    protocol_diverged_board_never_did: reachedSameBoard.length,
    protocol_diverged_board_held_longer: boardHeldLonger.length,
    board_parted_before_the_protocol_did: boardPartedFirst.length,
    families: [...fam].sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ family: f, differing_leaves: n,
      games: famGames.get(f) || 0 })),
    /* WORKED EXAMPLES, so a family is actionable rather than a score. */
    first_board_divergences: results.filter(r => r.stateDiv).slice(0, 40).map(r => ({
      config: r.config, seed: r.seed, turn: r.stateDiv.turn, protocol_diverged_at_turn: r.divTurn,
      diffs: r.stateDiv.diffs.slice(0, 8) })),
    screens_shape_medicham: (results.find(r => r.stateShape) || {}).stateShape || null,
    reader_failures: STATE_FAILS,
    not_compared: BS.NOT_COMPARED,
    mappings: MAPPING_PROOF,
    planted_state_proof: STATE_PROOF,
    planted_state_proof_ok: !!(STATE_PROOF && STATE_PROOF.all_ok),
    mappings_all_proved: MAPPING_OK,
  };
})();
if (STATE_SUMMARY) {
  const S2 = STATE_SUMMARY, pc = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
  const T1 = S2.turn1;
  /* ---- PRINTED FIRST, AND IT IS THE ONLY NUMBER ON ITS OWN LINE --------------------------------- */
  console.log('  ============================================================================');
  console.log('  THE BOARD AT THE END OF TURN 1 IS IDENTICAL IN   '
    + T1.identical + ' / ' + T1.games + '   ' + pc(T1.identical, T1.games) + '   OF GAMES');
  console.log('  ============================================================================');
  console.log('    the target is 100%. Denominator is EVERY game: ' + T1.never_reached_turn1
    + ' never reached a turn-1 boundary (the board parted at the leads, or the battle ended) and');
  console.log('    those count against. Of the ' + T1.reached_a_turn1_boundary + ' that did reach one, '
    + T1.identical + ' agreed — ' + pc(T1.identical, T1.reached_a_turn1_boundary) + '.');
  console.log('');
  console.log('    THE DECAY, TURN BY TURN. The denominator is stated at each entry: games that REACHED');
  console.log('    that turn. Under the stop rule, reaching turn N means the board was identical through');
  console.log('    N-1, so the right-hand column is "given we still agree entering this turn, do we');
  console.log('    still agree after it". A game that ended early counts as agreement nowhere.');
  console.log('      turn   identical / reached      of all games    given it reached this turn');
  for (const e of S2.agreement_by_turn) {
    if (!e.reached) continue;
    console.log('      ' + String(e.turn).padStart(4) + '   ' + String(e.identical).padStart(5) + ' / '
      + String(e.reached).padEnd(10) + '       ' + pc(e.identical, results.length).padStart(6)
      + '          ' + pc(e.identical, e.reached).padStart(6));
  }
  console.log('      (the pooled `turn_boundary_agreement` is kept below and is NOT this. It mixes every');
  console.log('       turn-ending together, and only turn 1 starts from a board both engines agree on.)');
  if (S2.agreement_by_turn_cross_check.some(x => !x.agree))
    console.log('      THE TWO DERIVATIONS OF TURNS 1-3 DISAGREE — see agreement_by_turn_cross_check.');
  else console.log('      turns 1-3 agree between two independent derivations (kept boards vs counters).');
  console.log('');
  console.log('    IS IT JUST SEMANTICS, scoped to turn 1: of the ' + T1.protocol_parted_during_turn1
    + ' games whose NARRATION parted');
  console.log('    inside turn 1, ' + T1.protocol_parted_during_turn1_board_identical_anyway
    + ' reached an IDENTICAL BOARD anyway  '
    + pc(T1.protocol_parted_during_turn1_board_identical_anyway, T1.protocol_parted_during_turn1));
  console.log('');
  console.log('    WHICH FIELD PARTED AT THE END OF TURN 1 — this is the wire queue, and it is the first');
  console.log('    one chosen by what changes a BOARD rather than by which protocol line came first:');
  console.log('      (' + T1.party_rows_suppressed_as_a_second_view_of_a_standing_body + ' party rows are '
    + 'suppressed below: an ACTIVE body is in its own party list, so its HP parted as two leaves and one fact.)');
  console.log('      games  leaves  field                          how wrong');
  for (const f of T1.by_field.slice(0, 18)) console.log('      ' + String(f.games).padStart(5) + '  '
    + String(f.differing_leaves).padStart(6) + '  ' + f.field.padEnd(30)
    + Object.entries(f.buckets).map(([k, v]) => k + ' x' + v).join(', '));
  console.log('');
  console.log('    THE TOP CAUSES AT THE END OF TURN 1, ranked by games:');
  for (const c of T1.by_cause.slice(0, 15)) console.log('      ' + String(c.games).padStart(5) + '  ' + c.cause);
  console.log('');
  console.log('    OF THE PROTOCOL CLASSES, HOW MANY STILL REACHED AN IDENTICAL TURN-1 BOARD:');
  console.log('      games  same board  class');
  for (const c of T1.by_protocol_class) console.log('      ' + String(c.games).padStart(5) + '  '
    + String(c.board_identical_at_end_of_turn1).padStart(10) + '  ' + c.cls);
  console.log('');
  /* ---- THE PLAIN-ENGLISH CASES ------------------------------------------------------------------
   * Will: *"OR YOU CAN TELL ME."* Fifteen turns written out, so a human can scan them in a couple of
   * minutes and say which are real. No protocol lines appear here by construction. */
  console.log('    THE TOP ' + T1.cases.length + ' TURNS, WRITTEN OUT. Say which of these are wrong;'
    + ' that is the next wire queue.');
  console.log('');
  let ci = 0;
  for (const k of T1.cases) {
    const c = k.case; ci++;
    console.log('    --- ' + ci + '.  ' + k.games + ' games have this shape  ---------------------------------');
    console.log('    Turn 1.  Side 1: ' + c.leads.p1 + '.   Side 2: ' + c.leads.p2 + '.');
    for (const l of c.clicks) console.log('      ' + l + '.');
    console.log('      SHOWDOWN: ' + c.showdown_says.join('; ') + '.');
    console.log('      OURS:     ' + c.we_say.join('; ') + '.');
    console.log('      Board at the end of the turn: ' + c.fields_identical + ' of '
      + c.fields_compared + ' fields identical. Differs on:');
    for (const d of c.field_diff) console.log('        ' + String(d.slot).padEnd(5)
      + String(d.body).padEnd(16) + String(d.field).padEnd(22)
      + 'SD ' + JSON.stringify(d.showdown).padEnd(14) + 'US ' + JSON.stringify(d.ours).padEnd(14) + d.how_wrong);
    console.log('      seed ' + c.seed + '   config ' + c.config
      + '   release ' + c.engine_release + '   pool ' + c.team_pool_digest);
    console.log('');
  }
  if (T1.display_name_lookups_that_missed) console.log('    NOTE: ' + T1.display_name_lookups_that_missed
    + ' id(s) had no display name in the dex and were printed raw — counted, not hidden.');
  console.log('');
  console.log('  THE STATE DIFFERENTIAL — the BOARD at the turn boundary, after the whole residual phase');
  console.log('  (Leftovers, chip, the toxic stage, Leech Seed, Perish, and every clock ticking down):');
  console.log('    TURNS whose end-of-turn board is IDENTICAL   ' + S2.turn_boundaries_identical + '/'
    + S2.turn_boundaries_compared + '   ' + pc(S2.turn_boundaries_identical, S2.turn_boundaries_compared));
  console.log('    GAMES whose board NEVER diverged             ' + S2.games_board_never_diverged + '/'
    + S2.games + '   ' + pc(S2.games_board_never_diverged, S2.games));
  console.log('    median turn of the first board divergence    ' + S2.median_turn_of_first_board_divergence);
  console.log('    for comparison, the PROTOCOL rate           ' + (results.length - diverged.length)
    + '/' + results.length + '   ' + pc(results.length - diverged.length, results.length) + ' of games agreed');
  console.log('');
  console.log('    OF THE ' + S2.protocol_diverged_games + ' GAMES WHOSE PROTOCOL PARTED:');
  console.log('      ' + S2.protocol_diverged_board_never_did + '  reached an IDENTICAL board anyway, to the horizon   '
    + pc(S2.protocol_diverged_board_never_did, S2.protocol_diverged_games));
  console.log('      ' + S2.protocol_diverged_board_held_longer + '  the board survived at least one boundary past the narration');
  console.log('      ' + S2.board_parted_before_the_protocol_did + '  games where the BOARD parted first (the protocol was late or silent)');
  console.log('');
  console.log('    WHICH PART OF THE BOARD PARTED — a family is a WIRE, an instance is not:');
  for (const f of S2.families.slice(0, 14)) console.log('      ' + String(f.games).padStart(5) + ' games  '
    + String(f.differing_leaves).padStart(6) + ' leaves  ' + f.family);
  console.log('');
  console.log('    the frozen engine holds its screens as: ' + JSON.stringify(S2.screens_shape_medicham));
  console.log('    reader failures (must be empty): ' + JSON.stringify(S2.reader_failures));
  console.log('');
}

/* ---- THE END-STATE MEASUREMENT, PER ARM ---------------------------------------------------------- */
if (END_STATE) {
  const pcs = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
  console.log('  HOW MUCH OF THE DIVERGENCE IS JUST WORDING — the END STATE, per arm, never pooled');
  console.log('  (Will: "how much is just medicham being semantic"). The game is played to the turn cap');
  console.log('  or to the end of the battle WHATEVER either comparator already found, and the LAST');
  console.log('  board both engines produced is compared. It is a claim about where they ARRIVED and');
  console.log('  not that every line after the mismatch agreed.');
  console.log('');
  for (const e of END_STATE_BY_ARM) {
    const s = e.summary; if (!s) continue;
    const p = s.of_the_games_whose_protocol_parted;
    console.log('    ARM ' + e.arm + '   ' + s.games + ' games, ' + s.protocol_parted + ' whose protocol parted');
    console.log('      of those ' + s.protocol_parted + ':');
    console.log('        ' + String(p['SAME-END-STATE']).padStart(5) + '  SAME END STATE — the mismatch was WORDING            '
      + pcs(p['SAME-END-STATE'], s.protocol_parted) + ' of all parted, '
      + pcs(p['SAME-END-STATE'], s.parted_games_with_a_comparable_end) + ' of those with a comparable end');
    console.log('        ' + String(p['DIFFERENT-END-STATE']).padStart(5) + '  DIFFERENT END STATE — they played a different battle  '
      + pcs(p['DIFFERENT-END-STATE'], s.protocol_parted));
    console.log('        ' + String(p['ENDED-APART']).padStart(5) + '  ENDED APART — ONE engine ended the battle and the other did not.');
    console.log('               THIS IS NOT COSMETIC AND IT IS NOT COUNTED EITHER WAY. A game with no');
    console.log('               comparable final board is a THIRD answer, not a rounding decision.');
    console.log('        ' + String(p['NO-COMPARABLE-BOARD']).padStart(5) + '  NO COMPARABLE BOARD — no boundary was ever taken');
    console.log('        ' + String(p['THREW']).padStart(5) + '  THREW — the harness could not finish the game');
    const np = s.of_the_games_whose_protocol_never_parted;
    console.log('      the ' + s.protocol_never_parted + ' games whose protocol NEVER parted, as a control: '
      + Object.entries(np).filter(([, n]) => n).map(([k, n]) => n + ' ' + k).join(', '));
    console.log('');
    console.log('      CROSSED WITH THE SHAPE — "EMISSION is mostly cosmetic" has been asserted without');
    console.log('      evidence and was wrong once already (the ??: family). Here it is measured:');
    console.log('        shape      games   same-end   different   ended-apart   threw');
    for (const b of s.by_shape) console.log('        ' + b.shape.padEnd(10) + String(b.games).padStart(5)
      + String(b.verdicts['SAME-END-STATE']).padStart(11) + String(b.verdicts['DIFFERENT-END-STATE']).padStart(12)
      + String(b.verdicts['ENDED-APART']).padStart(14) + String(b.verdicts['THREW']).padStart(8)
      + '   ' + pcs(b.verdicts['SAME-END-STATE'], b.games) + ' wording');
    console.log('');
    /* ---- BOARD-MATERIALITY PER CAUSE — the number the quarantine bar is defined on --------------- */
    if (s.by_cause_totals) {
      const T = s.by_cause_totals;
      console.log('      BOARD-MATERIAL OR NARRATION, PER CAUSE — the quarantine bar is board-material');
      console.log('      ZERO, so this is the table it is read off. A verdict here is the BOARD');
      console.log('      COMPARATOR\'s, never a judgement that a line looks cosmetic.');
      console.log('        BOARD-MATERIAL ' + String(T.BOARD_MATERIAL).padStart(4) + ' causes, '
        + T.games_board_material + ' games   (a compared board leaf differed at some turn boundary)');
      console.log('        NARRATION-ONLY ' + String(T.NARRATION_ONLY).padStart(4) + ' causes, '
        + T.games_narration_only + ' games   (every boundary agreed AND the last boards agree)');
      console.log('        UNKNOWN        ' + String(T.UNKNOWN).padStart(4) + ' causes, '
        + T.games_unknown + ' games   (ended apart / no comparable board / threw — NOT counted either way)');
      console.log('        reconciles with the parted population: ' + (T.by_cause_reconciles ? 'yes' : 'NO — THE TABLE DROPPED ROWS'));
      const mat = s.by_cause.filter(c => c.materiality === 'BOARD-MATERIAL');
      if (mat.length) {
        console.log('        of those games the board parted on the SAME turn as the narration in '
          + T.games_board_material_same_turn + ', LATER in ' + T.games_board_material_board_parted_later
          + ' (weaker — two parted battles take different actions), EARLIER in '
          + T.games_board_material_board_parted_earlier + ' (the named cause is a symptom, not the first evidence)');
        console.log('        every BOARD-MATERIAL cause, in full — this is the worklist:');
        for (const c of mat) console.log('          ' + String(c.games).padStart(3) + ' games  board parted at turn '
          + (c.first_board_divergence_turns.join('/') || '?') + ' [same ' + c.board_parted_same_turn
          + ' later ' + c.board_parted_later + ' earlier ' + c.board_parted_earlier + ']   ' + c.cause.slice(0, 150));
      }
      console.log('');
    }
    if (s.end_state_families.length) {
      console.log('      WHAT STILL DIFFERS AT THE END — the worklist, because a defect that survives to');
      console.log('      the last board is one a search would plan from:');
      for (const f of s.end_state_families.slice(0, 14))
        console.log('        ' + String(f.games).padStart(5) + ' games  ' + f.family);
    } else {
      console.log('      NOTHING DIFFERS AT THE END in this arm — read that against the ENDED-APART and');
      console.log('      THREW counts above before calling it agreement.');
    }
    console.log('');
    console.log('      how the games stopped: ' + s.end_reasons.map(x => x.games + ' ' + x.reason).join('; '));
    console.log('');
    /* ---- THE SEVERITY LADDER ------------------------------------------------------------------- */
    if (!s.severity) {
      console.log('      NO SEVERITY LADDER — the authority narrated no damage in this arm, so the band-3');
      console.log('      threshold could not be measured. A default threshold is refused: it would be the');
      console.log('      picked number this ladder exists not to have.');
    } else {
      const V = s.severity, R = s.severity_ruler;
      console.log('      HOW BAD, NOT HOW MANY — the ' + V.games_banded + ' DIFFERENT-END-STATE games, banded');
      console.log('      by what the difference MEANS for the game. ENDED-APART is NOT in here: it has no');
      console.log('      comparable final board and is counted above as a third answer.');
      console.log('        the band-3 threshold is MEASURED, not picked: the median single hit the');
      console.log('        AUTHORITY narrated in this arm is ' + (100 * R.median_fraction_of_max_hp).toFixed(1)
        + '% of a health bar, over ' + R.hits.toLocaleString() + ' hits');
      console.log('        (quartiles ' + (100 * R.p25).toFixed(1) + '% / ' + (100 * R.p75).toFixed(1)
        + '%, p90 ' + (100 * R.p90).toFixed(1) + '%)');
      console.log('');
      console.log('        band  games  what it means');
      for (const b of V.bands) {
        console.log('          ' + b.band + '  ' + String(b.games).padStart(5) + '  ' + b.band_id);
        console.log('                        ' + b.what);
        if (!b.games) continue;
        const top = b.bodies.slice(0, 6).map(x => x.body + ' ('
          + (x.corpus_teams == null ? 'usage UNKNOWN' : x.corpus_teams.toLocaleString() + ' teams')
          + ', ' + x.games + 'g)').join(', ');
        if (top) console.log('                        bodies, most-played first: ' + top);
      }
      console.log('');
      if (V.bands[0].games) {
        console.log('        ' + V.different_winner_also_different_bodies_alive + ' of the ' + V.bands[0].games
          + ' DIFFERENT-WINNER games also have a different set of bodies alive — which is');
        console.log('        every one of them by construction. The brief ranked bodies-alive above winner;');
        console.log('        that order leaves the winner rung permanently empty, so the two were swapped');
        console.log('        and the containment is printed here rather than hidden. See end_state_severity.js.');
      } else {
        console.log('        BAND 1 IS EMPTY IN THIS ARM. Read it against the turn cap before calling it');
        console.log('        agreement: a battle that never resolves cannot have a different winner, and');
        console.log('        this run stopped ' + (s.end_reasons[0] ? s.end_reasons[0].games + ' games at "'
          + s.end_reasons[0].reason + '"' : 'most games short of a result') + '.');
      }
      console.log('');
      console.log('        CROSSED WITH THE SHAPE. The prior is that ORDERING lands in the harmless bands');
      console.log('        and RULE in the severe ones. Printed whether or not it holds:');
      console.log('          shape                 games' + ESS.BANDS.map(b => String(b.rank).padStart(6)).join(''));
      for (const r of V.by_shape_and_band)
        console.log('          ' + r.shape.padEnd(21) + String(r.games).padStart(5)
          + ESS.BANDS.map(b => String(r.by_band[b.rank]).padStart(6)).join(''));
      console.log('');
      console.log('        WHERE THE HEALTH GAPS ACTUALLY SIT, in units of one typical hit. A missing');
      console.log('        damage multiplier is a QUARTER of a hit and lands in band 6 unless it flips a');
      console.log('        knockout; this is the only place that mass is visible:');
      for (const [k, n] of Object.entries(V.hp_gap_in_typical_hits))
        console.log('          ' + String(n).padStart(5) + '  ' + k);
      console.log('');
      const worst = V.bands.filter(b => b.band <= 2 && b.games);
      if (worst.length) {
        console.log('        THE WORST GAMES, most-played body first — each re-playable from these four fields:');
        for (const b of worst) for (const g of b.examples.slice(0, 8)) {
          console.log('          band ' + g.band + '  ' + g.game.arm + '  ' + g.game.config + '  ' + g.game.seed);
          console.log('                  ' + g.why + '   [' + g.shape + ', board at turn ' + g.game.board_turn
            + ', ' + g.game.differing_leaves + ' leaves differ]');
          for (const e of g.evidence.slice(0, 4))
            console.log('                  ' + (e.side ? e.side + ' ' : '') + (e.body ? e.body + ' ' : '')
              + e.what + (e.us !== undefined ? '  (us ' + e.us + ' / authority ' + e.sd + ')' : ''));
        }
      } else {
        console.log('        NO GAME IN THIS ARM REACHED BAND 1 OR BAND 2. Read that against the turn cap');
        console.log('        above before calling it agreement: a battle that never resolves cannot have a');
        console.log('        different winner, and a 12-turn cap resolves almost nothing.');
      }
      console.log('');
      console.log('        RANKED BY BAND FIRST AND BY CORPUS USAGE SECOND. Usage is teams containing the');
      console.log('        body in data/meta-usage.json (generated ' + (SPECIES_USES.generated || 'UNKNOWN')
        + '), which is read LIVE and is NOT in the frozen release.');
      console.log('');
    }
  }
  console.log('    BOUNDED BY WHAT board_state.js COMPARES. A leaf it does not read cannot make a board');
  console.log('    differ here, so SAME-END-STATE is exactly as strong as that file\'s comparison set;');
  console.log('    its NOT_COMPARED list is published with this artifact for that reason.');
  console.log('');
}
/* ROADMAP #31 — THE TWO RATES, PUBLISHED APART. One number over a mixed population would let the mega
 * games and the non-mega games absorb each other, and the whole reason the stones came back is to see
 * what they cost. Same teams, same seeds, same driver state; the ONLY difference is the stone. */
{
  const withStone = results.filter(r => r.stones);
  const withStoneCtl = control.filter((c, i) => results[i].stones);
  const noStone = results.filter(r => !r.stones);
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
  const dv = arr => arr.filter(r => r.div).length;
  console.log('  THE TWO RATES — the same pairs played twice, and the stone is the only difference:');
  console.log('    with megas, on the pairs that CARRY a stone     '
    + dv(withStone) + '/' + withStone.length + '  ' + pct(dv(withStone), withStone.length));
  console.log('    the SAME pairs with the stones removed          '
    + dv(withStoneCtl) + '/' + withStoneCtl.length + '  ' + pct(dv(withStoneCtl), withStoneCtl.length));
  console.log('    pairs that carry no stone at all (unaffected)   '
    + dv(noStone) + '/' + noStone.length + '  ' + pct(dv(noStone), noStone.length));
  console.log('    whole-run control arm, every stone stripped     '
    + dv(control) + '/' + control.length + '  ' + pct(dv(control), control.length)
    + '   <- this is what the 2026-08-06 run measured');
  console.log('    stoneless pairs whose two arms were NOT the same game: ' + PAIRING_BROKEN
    + (PAIRING_BROKEN ? '  <-- THE PAIRING IS BROKEN and the two rates are not comparable' : ' (must read 0)'));
  console.log('');
  /* A RATE ALREADY AT 100% CANNOT ANSWER "WHAT DID MEGAS COST", and saying it did would be the
   * 12%-tolerance mistake in a new place. So the paired arms are compared on WHERE they part and on
   * WHETHER the mega itself is what parted them — two questions a saturated rate cannot reach. */
  console.log('  WHAT THE MEGAS ACTUALLY COST, measured pairwise (the rate above is saturated and');
  console.log('  therefore says nothing on its own):');
  const at = r => (r.div ? r.div.index : Infinity);
  const paired = results.map((r, i) => ({ r, c: control[i] })).filter(x => x.r.stones);
  const earlier = paired.filter(x => at(x.r) < at(x.c)).length;
  const later = paired.filter(x => at(x.r) > at(x.c)).length;
  const same = paired.filter(x => at(x.r) === at(x.c)).length;
  /* `-mega` AND `detailschange` ARE COUNTED APART, and that is not pedantry: `detailschange` is
   * Showdown's line for ANY permanent forme change, and Zero to Hero is one. Merging them would have
   * reported this run's single hit as a mega wire when it is a Palafin. */
  const isMega = l => /^\|-mega\|/.test(String(l || ''));
  const isDetails = l => /^\|detailschange\|/.test(String(l || ''));
  const megaFirst = results.filter(r => r.div && (isMega(r.div.sdRaw) || isMega(r.div.meRaw))).length;
  const detFirst = results.filter(r => r.div && (isDetails(r.div.sdRaw) || isDetails(r.div.meRaw))).length;
  console.log('    of ' + paired.length + ' stone-carrying pairs, the mega arm parted EARLIER on '
    + earlier + ', LATER on ' + later + ', at the SAME line on ' + same);
  console.log('    games whose FIRST divergence is a |-mega| line: ' + megaFirst
    + (megaFirst ? '  <-- MEGA WIRES, listed in mega.cost_of_the_megas.on_a_mega_line'
                 : '  — nothing in this run is attributable to the evolution itself'));
  console.log('    games whose FIRST divergence is a |detailschange| line: ' + detFirst
    + '  (any permanent forme change, NOT only megas — Zero to Hero is one)');
  console.log('');
  console.log('  MEGA EVOLUTION — the counter, and a RATE beside it because non-zero is not a bar:');
  console.log('    ' + MEGA_MEDI + ' evolutions in medicham2, ' + MEGA_SD + ' in showdown'
    + (MEGA_MEDI === MEGA_SD ? '  (they agree)' : '  <-- ASYMMETRIC: the choice reached one engine and not the other'));
  /* THE FLOOR IS ON THE CHOICE, NOT ON THE SIDE, and the difference matters. Every choice this driver
   * issues came from Showdown's own `canMegaEvo`, so every one of them MUST produce exactly one
   * evolution in each engine — that is a hard 100% and a real floor. "Sides that brought a stone" is
   * reported beside it and is deliberately NOT the floor: a game stops at its FIRST divergence, the
   * median game here lasts one completed turn, and a stone-holder sitting on the bench is never
   * offered the choice at all. Making that the floor would be measuring the harness's early stop. */
  const choiceFloor = MEGA_CHOICES && MEGA_MEDI === MEGA_CHOICES && MEGA_SD === MEGA_CHOICES;
  console.log('    ' + MEGA_CHOICES + ' mega choices issued (from Showdown\'s own `canMegaEvo`) -> '
    + MEGA_MEDI + ' medicham / ' + MEGA_SD + ' showdown evolutions   '
    + (choiceFloor ? 'FLOOR MET: every choice evolved in both engines'
                   : '<-- A CHOICE DID NOT EVOLVE. The floor is 100% of issued choices.'));
  console.log('    ' + MEGA_SIDES_EVOLVED + ' of ' + MEGA_SIDES_CAPABLE + ' sides that BROUGHT a stone evolved  '
    + pct(MEGA_SIDES_EVOLVED, MEGA_SIDES_CAPABLE)
    + '   (not a floor: a game stops at its first divergence, so a benched stone-holder is never offered)');
  console.log('    from the LEFT slot ' + MEGA_SLOT_A + ', from the RIGHT slot ' + MEGA_SLOT_B
    + (MEGA_SLOT_A && MEGA_SLOT_B ? '' : '  <-- ONE SLOT ONLY, which is the literal historical defect'));
  if (!MEGA_MEDI) console.log('    ZERO EVOLUTIONS. The capability cannot prove it ran, so it is assumed broken.');
  console.log('');
}
console.log('  WHAT THE SEMANTIC NORMALISER COLLAPSED, per rule — a normaliser whose effect is invisible');
console.log('  is how a 100% divergence rate becomes 2% with nobody able to say which half moved:');
{
  const tot = [...NORM_COUNTS.values()].reduce((a, b) => a + b, 0);
  for (const r of EQUIV) console.log('    ' + String(NORM_COUNTS.get(r.id) || 0).padStart(7)
    + '  lines  ' + r.id + (NORM_COUNTS.get(r.id) ? '' : '   <-- collapsed NOTHING this run'));
  console.log('    ' + String(tot).padStart(7) + '  lines  TOTAL across ' + EQUIV.length + ' equivalence rules');
}
console.log('');
if (classes.size) {
  console.log('  CLASSES — a class is a WIRE, an instance is not:');
  for (const [cls, e] of [...classes].sort((a, b) => b[1].games - a[1].games)) {
    console.log('    ' + cls.padEnd(38) + String(e.games).padStart(4) + ' games   '
      + e.causes.size + ' distinct cause' + (e.causes.size === 1 ? '' : 's'));
    for (const [cause, n] of [...e.causes].sort((a, b) => b[1] - a[1]).slice(0, 4))
      console.log('        ' + String(n).padStart(3) + '  ' + cause.slice(cause.indexOf('::') + 3, 200));
  }
  console.log('');
  const ex = diverged[0];
  console.log('  ONE WORKED EXAMPLE (' + ex.config + '):');
  console.log('    ' + ex.div.agreedLines + ' lines agreed, then:');
  for (const l of ex.div.before) console.log('        both      ' + l);
  console.log('        showdown  ' + ex.div.sd);
  console.log('        medicham  ' + ex.div.me);
  console.log('');
}
if (threw.length) {
  console.log('  THREW — the harness could not finish these games. Counted, never dropped:');
  const byMsg = new Map();
  for (const r of threw) byMsg.set(r.err, (byMsg.get(r.err) || 0) + 1);
  for (const [m2, n] of [...byMsg].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('    ' + String(n).padStart(3) + '  ' + m2);
  console.log('');
}
console.log('  DIRECTED SCENARIOS — the fringe the swarm never reaches (§3.2), and the two findings');
console.log('  docs/GAME-DIFFERENTIAL-DESIGN.md §5a filed by hand before this driver existed:');
for (const d of DIR) {
  console.log('    ' + (d.diverged ? 'DIVERGES' : d.err ? 'THREW   ' : 'agrees  ') + '  ' + d.name);
  if (d.err) console.log('        ' + d.err);
  if (d.diverged) {
    console.log('        ' + d.agreed + ' lines agreed, class "' + d.cls + '"');
    /* THE NEXT FEW LINES OF BOTH STREAMS, because "they differ here" is a scoreboard and "they emit
     * the same three events in a different order" is the finding. */
    for (let k = 0; k < Math.max(d.sdAfter.length, d.meAfter.length); k++)
      console.log('        ' + (k ? '          ' : 'showdown  ') + String(d.sdAfter[k] || '').padEnd(58)
        + (k ? '  ' : '  medicham  ').slice(0, k ? 2 : 12) + (d.meAfter[k] || ''));
  }
}
console.log('');
console.log('  ROADMAP #80 — THE KNOCK OFF ORDERING, ASKED AS TWO INDEPENDENT HALVES:');
{
  const r = (o) => 'showdown ' + o.showdown + '   medicham ' + o.medicham + '   (expected ' + o.expected + ')';
  console.log('    boost      x1.5 for holding an item        ' + r(KO.boost_half));
  console.log('    reduction  x0.5 Colbur vs super-eff Dark   ' + r(KO.reduction_half));
  console.log('    net        the two multiplied              ' + r(KO.net));
  console.log('    ASSERTED APART ON PURPOSE: if the 1.5x were also evaluated after removal the two errors');
  console.log('    would partially cancel and the net would look fine. It does not, and they do not.');
  console.log('    THE PREDICTED DAMAGE BUG DOES NOT REPRODUCE. medicham2 prices BOTH halves correctly,');
  console.log('    because playerAction computes the damage RANGE at click time — before the item is');
  console.log('    stripped — so the ordering costs no damage here. What differs is the item\'s DISPOSITION:');
  for (const a of KO.arms) if (a.item) {
    console.log('      ' + a.item.padEnd(13) + 'showdown ' + JSON.stringify(a.showdown_enditem.map(x => x.split('|').slice(3).join('|'))));
    console.log('      ' + ''.padEnd(13) + 'medicham ' + JSON.stringify(a.medicham_enditem.map(x => x.split('|').slice(3).join('|'))));
  }
  console.log('    Showdown records Colbur as EATEN BY ITSELF ([eat] then [weaken]) so Knock Off finds nothing');
  console.log('    left to take; medicham2 records it as KNOCKED OFF. Same end state, different FACT — and');
  console.log('    "was it eaten" is what Harvest, Recycle, Belch, Cud Chew and Unburden read.');
  console.log('    SITRUS, the opposite side of the same line: ' + (KO.sitrus_half.staged
    ? 'both engines strip it and NEITHER heals — agrees exactly.' : 'COULD NOT BE STAGED.'));
}
console.log('');
console.log('  THE DAMAGE INTERIOR — measured, not quoted. medicham2 samples its span UNIFORMLY;');
console.log('  Showdown rolls 16 indices onto the same span and floors each separately:');
for (const it of INTERIOR) {
  console.log('    ' + it.name);
  console.log('      showdown ' + it.sd_span[0] + '..' + it.sd_span[1] + ' (' + it.sd_distinct + ' distinct)   '
    + 'medicham ' + it.me_span[0] + '..' + it.me_span[1] + ' (' + it.me_distinct + ' distinct)   '
    + 'endpoints ' + (it.endpoints_agree ? 'AGREE' : 'DIFFER'));
  console.log('      values only showdown can produce: [' + it.values_showdown_can_produce_that_medicham_cannot.join(',') + ']');
  console.log('      values only medicham can produce: [' + it.values_medicham_can_produce_that_showdown_cannot.join(',') + ']');
  console.log('      worst per-value probability gap: ' + (100 * it.worst_probability_gap).toFixed(2) + ' points at ' + it.worst_at);
}
console.log('');
console.log('  MECHANIC COVERAGE — AND THE NUMBER FELL ON PURPOSE (ROADMAP #91):');
console.log('    ' + creditedByEffect.length + ' / ' + witnessable.length
  + '  rows whose EFFECT WAS OBSERVED — a board leaf in a family the tag\'s own params name moved');
console.log('        across the turn, or a declared negative case was reached and correctly did not fire.');
console.log('        THIS IS THE COVERAGE NUMBER NOW. It replaces the one below, which counted a CLICK.');
console.log('    ' + noBoardLeaf.length + '      rows name NO BOARD LEAF at all (contact, sound, priority, a damage');
console.log('        multiplier). A connected click is the strongest evidence available for those; '
  + creditedByClickOnly.length + ' got it,');
console.log('        and they are counted APART and never added into the number above.');
console.log('    ' + touchedNotCredited.length + '      rows were CLICKED OR PRESENT AND DID NOTHING — the old counter called every');
console.log('        one of these covered. Haze into a board with no boosts on it is in here.');
console.log('');
console.log('  THE OLD COVERAGE NUMBER, KEPT SO THE DROP IS READABLE RATHER THAN A MYSTERY:');
console.log('    ' + covStrong.length + ' / ' + COV_TARGETS.filter(t => t.sec === 'moves').length
  + '  reached by a move that CONNECTED — the engine ran its handler and the stream carries the result');
console.log('    ' + covWeak.length + ' / ' + COV_TARGETS.filter(t => t.sec !== 'moves').length
  + '  reached only by an ability or item that was ON THE FIELD. Present is NOT exercised, and the');
console.log('        median game here parts after ' + medianTurns + ' completed turn(s), so most of these bodies');
console.log('        never acted. This half is the weaker claim and is deliberately not added to the first.');
console.log('    ' + covered.length + ' / ' + COV_TARGETS.length + ' union of the two, stated last because it is the weakest of the three');
console.log('    ' + COV_UNMEASURABLE.length + ' of the ' + CENSUS.results.length
  + ' census rows name an INTERACTION rather than a taggable entity and cannot be measured by this');
console.log('      instrument at all. They are NOT counted as uncovered — a zero on them would read as');
console.log('      a failure of the run instead of a limit of the measurement.');
/* THE TWO MISS NUMBERS, AND WHY THE FIRST ONE ALONE OVER-CLAIMED. See the artifact block: the top arm
 * misses every sub-100 move and the bottom arm hits it, and both fill the same map. */
console.log('    clicked and MISSED at least once (the top arm\'s pin misses every sub-100-accuracy move): '
  + CLICKED_BUT_MISSED.size + ' moves');
{
  const neverConn = [...CLICKED_BUT_MISSED.keys()].filter(m => !OBSERVED.moves.has(m)).sort();
  console.log('    clicked and NEVER ONCE CONNECTED, in any arm — THIS is the unexercised list: '
    + neverConn.length + ' moves');
  if (neverConn.length) console.log('      ' + neverConn.join(', '));
}
console.log('');

/* ---- HOW DEEP THE CAP HAS TO BE, MEASURED (2026-08-25) -------------------------------------------
 * Not "how long do games last" — Will's rule is that a fifty-turn Protect stall is the same turn fifty
 * times and buys nothing. The question is the turn at which the LAST NEW mechanic first acts. Rows
 * whose earliest credit is past the cap are the only thing a deeper cap can buy; if that list is
 * empty, raising it buys repetition. */
const CREDIT_TURN_PROFILE = (() => {
  const first = [...COV_FIRST_TURN.entries()];
  const hist = new Map();
  for (const [, t] of first) hist.set(t, (hist.get(t) || 0) + 1);
  const turns = [...hist.keys()].sort((a, b) => a - b);
  const rowsFrom = c => first.filter(([, t]) => t >= c).map(([k]) => k).sort();
  const cum = [];
  let acc = 0;
  for (const t of turns) { acc += hist.get(t); cum.push({ turn: t, rows_first_here: hist.get(t),
    rows_first_by_here: acc, pct_of_credited: +(100 * acc / (first.length || 1)).toFixed(2) }); }
  return { rows_with_any_credit: first.length,
           credits_with_no_turn_index: CREDIT_TURN_UNKNOWN,
           deepest_first_credit_turn: turns.length ? turns[turns.length - 1] : null,
           by_first_turn: cum,
           credit_events_by_turn: Object.fromEntries([...CREDIT_BY_TURN.entries()].sort((a, b) => a[0] - b[0])),
           rows_first_credited_at_turn_13_or_later: rowsFrom(13),
           rows_first_credited_at_turn_9_or_later: rowsFrom(9) };
})();
console.log('  WHEN A MECHANIC IS FIRST SEEN TO ACT — this is what decides the turn cap, not how long');
console.log('  games run. Turn cap this run: ' + MAXTURNS + '.');
console.log('    ' + CREDIT_TURN_PROFILE.rows_with_any_credit + ' rows were credited at least once; the '
  + 'deepest FIRST credit landed on turn ' + CREDIT_TURN_PROFILE.deepest_first_credit_turn + '.');
for (const r of CREDIT_TURN_PROFILE.by_first_turn)
  console.log('      turn ' + String(r.turn).padStart(2) + '  first-credited here ' + String(r.rows_first_here).padStart(4)
    + '   cumulative ' + String(r.rows_first_by_here).padStart(4) + '  (' + r.pct_of_credited + '% of all credited rows)');
console.log('    rows whose FIRST credit is turn 13 or later: ' + CREDIT_TURN_PROFILE.rows_first_credited_at_turn_13_or_later.length
  + (CREDIT_TURN_PROFILE.rows_first_credited_at_turn_13_or_later.length
      ? '  ' + CREDIT_TURN_PROFILE.rows_first_credited_at_turn_13_or_later.slice(0, 25).join(', ')
      : '  <-- a deeper cap buys REPETITION, not coverage'));
if (CREDIT_TURN_PROFILE.credits_with_no_turn_index)
  console.log('    *** ' + CREDIT_TURN_PROFILE.credits_with_no_turn_index + ' CREDITS ARRIVED WITH NO TURN INDEX '
    + '— the curve above is missing them and must not be read as complete.');
console.log('');

/* ---- THE STOPPING RULE, REPORTED WHERE THE COVERAGE IS ------------------------------------------- */
if (COVERAGE_STOP) {
  const C = COVERAGE_STOP;
  console.log('  HOW THIS RUN DECIDED TO STOP — the rule, not a number somebody picked:');
  console.log('    ' + C.games_played + ' games in ' + C.batches.length + ' batches of ' + C.batch_size
    + ', stall threshold ' + C.stall_k + ' quiet batches, backstop ' + C.max_games);
  console.log('    rows with any credit: ' + credited.length + ' of ' + COV_TARGETS.length
    + ' measurable   (' + creditedByEffect.length + ' of ' + witnessable.length + ' by an OBSERVED EFFECT)');
  if (C.stopped_on_budget) {
    console.log('');
    console.log('    *** THIS RUN DID NOT STOP ON COVERAGE. IT STOPPED ON A BUDGET: ' + C.stopped_because);
    console.log('    *** NEW ROWS WERE STILL ARRIVING, OR THE POOL RAN OUT BEFORE THE STALL COULD FIRE.');
    console.log('    *** THE SWEEP IS TRUNCATED. Nothing below is a claim that the census was covered;');
    console.log('    *** raise --max-games, or widen the team pool, and run it again.');
    console.log('');
  } else {
    console.log('    STOPPED ON COVERAGE: ' + C.stall_k + ' consecutive batches credited no new row.');
  }
  console.log('    ROWS STILL NOT EXERCISED, BY NAME — a count is not a worklist:');
  console.log('      ' + neverWitnessed.length + ' rows a board could have witnessed and did not:');
  for (let i = 0; i < neverWitnessed.length; i += 4)
    console.log('        ' + neverWitnessed.slice(i, i + 4).map(t => t.key).join('   '));
  console.log('      ' + neverClicked.length + ' rows that name NO board leaf, so only a connected click '
    + 'could have credited them:');
  for (let i = 0; i < neverClicked.length; i += 4)
    console.log('        ' + neverClicked.slice(i, i + 4).map(t => t.key).join('   '));
  console.log('      ' + COV_UNMEASURABLE.length + ' further census rows name an INTERACTION rather than a '
    + 'taggable entity and this instrument cannot reach them at all.');
  console.log('');
}
console.log('  THE DRIVER AND THE SWARM COVER DIFFERENT SPACES (§3.3) and are reported apart:');
console.log('    driver / mechanic space :  ' + OBSERVED.moves.size + ' distinct moves connected, '
  + OBSERVED.abilities.size + ' abilities, ' + OBSERVED.items.size + ' items, ' + OBSERVED.species.size + ' species');
console.log('    swarm  / situation space:  ' + [...new Set(results.map(r => r.config))].length + ' configurations, '
  + results.length + ' team pairs');
console.log('');
console.log('  DECLARED GAPS, printed every run so they cannot quietly grow:');
console.log('    mega stones stripped from the MEASURED arm: ' + STONES_KEPT + ' sets kept, 0 stripped'
  + '  (' + STONES_STRIPPED + ' stripped from the paired CONTROL arm, on purpose)');
console.log('    natures: ' + NATURE_MODE.toUpperCase() + '  ('
  + NATURE_COUNT.declared + ' bodies built from the sheet\'s own nature, '
  + NATURE_COUNT.fallback + ' fell back to Serious because the sheet carried none, '
  + NATURE_COUNT.forced_flat + ' forced flat by --nature serious)'
  + (NATURE_MODE === 'real' && !NATURE_COUNT.declared
      ? '  <-- NOTHING WAS NATURED. The knob is unwired, not immaterial.' : ''));
if (NATURE_COUNT.fallback) {
  const top = [...NATURE_FELL_BACK.entries()].sort((a, b) => b[1] - a[1]);
  console.log('      what fell back (' + NATURE_FELL_BACK.size + ' distinct; the pool\'s sheets carry a dex-valid');
  console.log('      nature on 100% of bodies, so anything here is a HAND-WRITTEN fixture in this file):');
  for (const [w, c] of top.slice(0, 6)) console.log('        ' + String(c).padStart(4) + '  ' + w);
  if (top.length > 6) console.log('        ... and ' + (top.length - 6) + ' more');
}
console.log('    THE SPREADS ARE STILL ABSENT AND ALWAYS WILL BE — an open team sheet does not show them');
console.log('      (`"evs": null` on every stored body), so this instrument tests RULES and NOT the stat');
console.log('      lines people actually bring. ROADMAP #68 is NARROWED by the nature, not closed.');
console.log('      the alignment had to MOVE a stat ' + ALIGN_MOVED + ' times outside the staged hpBoost arms'
  + (ALIGN_MOVED ? '  <-- the two engines are NOT the same Pokemon' : ' (must read 0)'));
for (const [w, c] of [...ALIGN_MOVED_WHO.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
  console.log('        ' + String(c).padStart(4) + '  ' + w);
{
  /* THE EXCLUSION IS PRINTED EVERY RUN, AND THE EMPTY CASE IS A SENTENCE. A shelf that shelved
   * nothing reads exactly like a shelf with no members unless it says which it was. */
  const CD = closetDeclaration();
  console.log('    THE CLOSET (' + CD.authority + ', ' + CD.by + ' ' + CD.on + '): ' + CD.says);
  if (CD.teams_dropped) {
    console.log('      per configuration: ' + Object.entries(CD.teams_dropped_by_config)
      .sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
    console.log('      where the carrier sat on the sheet: '
      + Object.entries(CD.carrier_sheet_slot).sort((a, b) => +a[0] - +b[0])
          .map(([k, v]) => 'slot ' + k + ' x' + v).join(', ')
      + '   (a pair brings the first ' + CD.bodies_a_pair_brings + ' buildable bodies)');
    console.log('      ' + CD.teams_whose_only_carrier_sits_past_the_bodies_brought + ' of '
      + CD.teams_dropped + ' were dropped for a carrier sitting PAST that index — a body neither '
      + 'engine ever brings.'
      + (CD.teams_whose_only_carrier_sits_past_the_bodies_brought
          ? '  <-- the rule is over-broad by that much. Narrowing it CHANGES THE SAMPLE, so it is '
            + 'declared and owed, never done inside a run that publishes a rate.' : ''));
  }
}
console.log('    gender is N on both sides, so Attract / Rivalry / Cute Charm are not exercised.');
console.log('    ZERO TO HERO IS SILENT — found by this run, not assumed. Showdown transforms Palafin on');
console.log('      SWITCH-OUT (`|detailschange|p1a: Palafin|Palafin-Hero, L50`) and announces');
console.log('      `|-activate|...|ability: Zero to Hero` on the way back in; medicham2 transforms on the');
console.log('      RETURN, inside bringIn(), and emits neither. Different moment AND two missing lines.');
console.log('    ' + TEAMS_UNBUILDABLE + ' teams and ' + MONS_UNBUILDABLE + ' individual sets could not be built in both engines.');
/* PRINTED BECAUSE A COUNTER NOBODY READS IS NOT A COUNTER. Expect cosmetic formes here — Florges'
 * colours, Sinistcha's masterpiece — and nothing else. If this climbs on ORDINARY species the alias
 * table is broken, not the pool, and the bodies behind it were skipped rather than measured. */
console.log('    switch lookups that MISSED: medicham ' + SWITCH_LOOKUP_MISS.medi + ', showdown ' + SWITCH_LOOKUP_MISS.sd
  + ((SWITCH_LOOKUP_MISS.medi || SWITCH_LOOKUP_MISS.sd) ? '  <-- MUST READ 0. A miss means that side PASSED while the other switched.' : '  (must read 0)')
  + (Object.keys(SWITCH_LOOKUP_MISS.names).length
      ? '\n      the bodies it could not find: ' + Object.entries(SWITCH_LOOKUP_MISS.names).map(([k, v]) => k + ' x' + v).join(', ')
        + SWITCH_LOOKUP_MISS.where.slice(0, 8).map(w => '\n        ' + w).join('')
      : ''));
/* 2026-08-25 — AND WHETHER ANY OF THEM WAS ANSWERED OUT OF DISPLAY STATE. `rosterKey` is the one
 * door onto "which body of the roster is this"; a fallback means a stamp is missing, which is how
 * the same class of bug has been invisible five times. See the rosterKey header. */
console.log('    roster identities read from DISPLAY state: showdown ' + ROSTER_KEY_FALLBACK.sd_species
  + ', medicham ' + ROSTER_KEY_FALLBACK.medi_name + ', neither-stamp ' + ROSTER_KEY_FALLBACK.neither
  + ((ROSTER_KEY_FALLBACK.sd_species || ROSTER_KEY_FALLBACK.medi_name || ROSTER_KEY_FALLBACK.neither)
      ? '  <-- MUST READ 0/0/0. ' + ROSTER_KEY_FALLBACK.first : '  (must read 0/0/0)'));
/* 2026-08-25 — AND THE INDEX THOSE SWITCHES WERE SENT AS. `after_permutation` is the denominator that
 * decides whether this run met the hazard at all; a 0 there would mean the number below proves
 * nothing. `MEDI_SWITCH_BY_INITIAL_INDEX=1` is the positive control. */
console.log('    switch indices SENT to showdown: ' + SWITCH_ADDRESSING.sent
  + ', of which ' + SWITCH_ADDRESSING.after_permutation + ' against an ALREADY-PERMUTED party'
  + ' — MISADDRESSED ' + SWITCH_ADDRESSING.misaddressed
  + (SWITCH_ADDRESSING.misaddressed ? '  <-- MUST READ 0. ' + SWITCH_ADDRESSING.first_bad : '  (must read 0)')
  + (SWITCH_BY_INITIAL_INDEX ? '   [MEDI_SWITCH_BY_INITIAL_INDEX=1 — the control, not the instrument]' : ''));
console.log('    ' + MCKEY_MISSED + ' set(s) had no MC.mons row for their species'
  + (MCKEY_MISSED ? '  <-- expected: cosmetic formes only. An ordinary species here is a broken alias table.' : ''));
/* PRINTED BECAUSE A CAPABILITY THAT CANNOT PROVE IT RAN IS ASSUMED BROKEN. `ally` reading 0 on a run
 * whose scenarios aim at a partner is the defect this replaces, back again and silent. `none` is
 * legitimate and large — `self`, every spread move, `randomNormal` and `scripted` all name nobody and
 * are resolved by the engine from the body and the board. `miss` must read 0: a NAMED slot with no
 * body in it is a click that quietly went targetless. */
console.log('    clicks by AIM: ' + AIM.foe + ' at a foe, ' + AIM.ally + ' at an ally, ' + AIM.self
  + ' at self, ' + AIM.none + ' naming nobody (self/spread/randomNormal/scripted — the engine resolves those), '
  + AIM.miss + ' named a slot with NO BODY in it' + (AIM.miss ? '  <-- MUST READ 0' : ' (must read 0)'));
console.log('    ' + BAN_FALLBACKS + ' clicks where the configuration had banned every legal action (fell through, counted).');
console.log('    ' + FORCED_FIRST_SLOT + ' requests this driver could build no candidate for (a recharge or a lock) — answered `move 1`, counted.');
/* PRINTED BECAUSE A REFUSAL EMITS NO PROTOCOL LINE. It is invisible in BOTH streams by construction,
 * so the only place it can ever be seen is a counter — and until 2026-08-22 the forced-switch path
 * discarded `battle.choose`'s return value and there was no counter either. The noun is one
 * `battle.choose()` call the authority returned false for. */
console.log('    ' + CHOICE_REFUSED.n + ' choice(s) Showdown REFUSED — one `battle.choose()` call returning false'
  + (CHOICE_REFUSED.n ? '  <-- MUST READ 0. first: ' + CHOICE_REFUSED.first
                        + '   (each one also THREW its game; see the THREW list)' : ' (must read 0)'));
/* The noun is a forced-switch SLOT, not a game and not a choice. `pass` here is CORRECT and expected:
 * it is a slot medicham2 could not fill either, which is what Showdown's own forcedPassesLeft budget
 * is for. A non-zero `pass` count is not a defect; a non-zero refusal count above is. */
console.log('    forced-switch SLOTS mirrored from medicham2: ' + FORCED_SWITCH_MIRROR.switched
  + ' filled, ' + FORCED_SWITCH_MIRROR.passed + ' answered `pass` because medicham2 had no live body there either.');
/* NOT A DEFECT AND NOT ZERO-GATED. The noun is a forced switch that could not be expressed because
 * the two engines already disagree about which bodies are alive. Printed beside the refusal count so
 * the two are never read as one number: the line above must be 0, this one need not be. */
console.log('    ' + MIRROR_IMPOSSIBLE.n + ' forced switch(es) UNMIRRORABLE — the boards had already parted, '
  + 'so the game was stopped rather than answered'
  + (MIRROR_IMPOSSIBLE.n ? '.  first: ' + MIRROR_IMPOSSIBLE.first
      + '   (each of these games keeps its own EARLIER divergence; this is not a class of its own)' : '.'));
console.log('    MEDFAILS.traceBodyOffField = ' + M.fails.traceBodyOffField
  + (M.fails.traceBodyOffField ? '  <-- a `??` identifier reached the stream, first: ' + M.fails.traceBodyOffFieldFirst
                                 + '. tests/test-protocol-trace.js PART 6 says this must read 0.' : ' (must read 0)'));
console.log('    undeclared Showdown events dropped before alignment: ' + UNDECLARED_DROPS
  + (UNDECLARED_DROPS ? '  <-- ' + [...UNDECLARED_SEEN].join(', ') : ' (must read 0)'));
/* The standing block's own swallowed failures. A zero here is the CLAIM that every `uses: null` and
 * `carriers: null` printed above means "not in that table" and not "the lookup threw". */
console.log('    format-standing lookups that threw and fell back: '
  + Object.entries(STANDING_FAILS).map(([k, v]) => k + ' ' + v).join(', ')
  + (Object.values(STANDING_FAILS).some(v => v) ? '  <-- a UNKNOWN above is a FAILURE, not an absence' : ' (must all read 0)'));
/* A CAPABILITY THAT CANNOT PROVE IT RAN IS ASSUMED BROKEN. `rescued` is the count of misattributions
 * this rule actually prevented, so "the collision no longer occurs" and "the rule never fired" cannot
 * read the same. `condition_table` guards the other half: an empty table would silence the rule
 * entirely and every count below would be a legitimate-looking zero. */
console.log('    condition/move name collision: ' + CONDITION_SLOT_HITS + ' token(s) resolved as a '
  + 'CONDITION rather than a move, ' + CONDITION_SLOT_RESCUED + ' of them rescued from a move this '
  + 'format does not contain (table: ' + Object.keys(CONDITION_TABLE).length + ' standalone conditions'
  + (Object.keys(CONDITION_TABLE).length ? '' : '  <-- EMPTY, so the rule cannot fire at all') + ')');
console.log('');

if (WRITE) {
  const artifact = Object.assign({
    generated: new Date().toISOString(), by: 'engine/game_differential.js', mode: MODE,
    /* THE HEADLINE WARNING, AT THE TOP OF THE FILE AND NOT IN A FOOTNOTE. */
    baseline_reset: 'ROADMAP #88 (four pinned arms where there was one) and ROADMAP #91 (coverage '
      + 'credit moved from the CLICK to the OBSERVED EFFECT) both changed WHICH GAMES GET PLAYED and '
      + 'how a die falls. NO NUMBER IN THIS ARTIFACT MAY BE COMPARED WITH ANY RUN TAKEN BEFORE '
      + '2026-08-07 — not the 75.5% turn-1 figure, not data/state-ladder.json, not the class counts. '
      + '`mode` carries the pin digest and the credit-rule version so engine/arms_comparable.js '
      + 'refuses the pair rather than leaving it to a reader to notice.',
    pins: PINS,
    /* ROADMAP #88 — PER ARM, NEVER POOLED. */
    arms: ARM_RUNS.map(a => {
      const dv = a.results.filter(r => r.div);
      const cl = new Map();
      for (const r of dv) { const c = classify(r.div);
        if (!cl.has(c.cls)) cl.set(c.cls, { cls: c.cls, games: 0, causes: new Set() });
        const e = cl.get(c.cls); e.games++; e.causes.add(c.cause); }
      const tt = a.results.map(r => r.turns).sort((x, y) => x - y);
      const t1 = a.results.filter(r => (r.earlyBoards || [])[1]);
      const t1ok = t1.filter(r => r.earlyBoards[1].identical);
      const kd = { effect: 0, negative: 0, click: 0 };
      for (const v of a.kinds.values()) { kd.effect += v.effect; kd.negative += v.negative; kd.click += v.click; }
      return { arm: a.arm.id, what: a.arm.what,
               corner: a.arm.corner === CORNER_TOP ? 'top' : 'bottom',
               damage_roll: a.arm.damageIndex === 0 ? 'MAXIMUM' : 'MINIMUM',
               speed_tie: a.arm.tieToSecondBody ? 'to the LATER body' : 'to the EARLIER body',
               games: a.results.length, diverged: dv.length,
               threw: a.results.filter(r => r.err).length,
               median_turns: tt.length ? tt[Math.floor(tt.length / 2)] : 0,
               /* WHY EACH GAME STOPPED, WHICH THE ARTIFACT HAS NEVER CARRIED — WILL, 2026-08-12.
                *
                * He put two hypotheses up: that games only reach the cap because the driver spams
                * Protect, and that in the TOP arm nothing can end a battle because every sub-100 move
                * misses and no secondary fires. Both are testable and neither was, because `endReason`
                * was computed per game and then dropped at aggregation — so "median 12 turns" was the
                * only evidence available and it cannot tell a stalemate from a cap.
                *
                * It matters beyond curiosity: a swarm that mostly hits the cap is measuring the first
                * twelve turns of a battle rather than a battle, and the severity ladder's top rung
                * (DIFFERENT WINNER) reads zero for exactly that reason. This is the number that says
                * whether that zero is a finding or an artefact. */
               end_reasons: (() => {
                 const m = new Map();
                 for (const r of a.results) m.set(r.endReason || 'unrecorded', (m.get(r.endReason || 'unrecorded') || 0) + 1);
                 return Object.fromEntries([...m.entries()].sort((x, y) => y[1] - x[1]));
               })(),
               /* `null` when the run was not asked for `--state`, which is a different claim from 0. */
               turn1_boards_identical: STATE ? t1ok.length : null,
               turn1_boards_reached: STATE ? t1.length : null,
               rows_credited: [...a.credit.keys()].length,
               credit_events: kd,
               classes: [...cl.values()].map(c => ({ cls: c.cls, games: c.games, distinct_causes: c.causes.size }))
                 .sort((x, y) => y.games - x.games) };
    }),
    /* WHAT THE TIE ARM ACTUALLY SAW. An arm that never met a tied group tested nothing and would look
     * exactly like one that did — this project's signature failure, so it is a receipt. */
    speed_ties: { shuffle_calls: SHUFFLE_CALLS, tied_groups_resolved: SHUFFLE_TIE_GROUPS,
                  group_sizes: Object.fromEntries([...SHUFFLE_GROUP_SIZES].sort((a, b) => a[0] - b[0])),
                  medicham_tie_sequence_saturated: TIE_SATURATED,
                  bare_float_draws: BARE_FLOAT_DRAWS },
    games: results.length, turns_cap: MAXTURNS, elapsed_s: +elapsed,
    /* 2026-08-25 — the evidence for the cap. See the console block of the same name. */
    credit_turn_profile: CREDIT_TURN_PROFILE,
    planted_divergence_proof: PROOF, planted_divergence_proof_ok: PROOF_OK,
    /* 2026-08-25 — the harness auditing its OWN switch addressing. See SWITCH_ADDRESSING. In the
     * artifact and not only on stdout, because the question it answers ("is a board-material switch
     * divergence the engine or the ruler?") is asked of RUNS THAT ARE ALREADY OVER. */
    switch_addressing: { ...SWITCH_ADDRESSING, by_initial_index_control: SWITCH_BY_INITIAL_INDEX,
                         medicham_lookup_missed: SWITCH_LOOKUP_MISS.medi,
                         showdown_lookup_missed: SWITCH_LOOKUP_MISS.sd,
                         lookup_missed_bodies: { ...SWITCH_LOOKUP_MISS.names },
                         lookup_missed_where: SWITCH_LOOKUP_MISS.where.slice(0, 20) },
    /* THE HEADLINE RATE IS NOT READABLE WITHOUT THIS. Stated at the top level, not buried in
     * declared_gaps, because a reader who takes `diverged / games` and nothing else has taken a
     * number about a population it does not know the shape of.
     *
     * IT USED TO SAY "ZERO MEGA BODIES WERE TESTED". ROADMAP #31 closed that; what remains is the
     * SPREADS, which is a smaller and differently-shaped hole and is named rather than inherited. */
    /* THE SAMPLE'S OWN EXCLUSION, IN THE ARTIFACT THE GATE READS — not only in the --dump-games
     * debugging view, which is where it lived until 2026-08-26 and which most runs never write. A
     * narrowed sample that does not say it was narrowed is indistinguishable from a mechanic that
     * never came up; `engine/quarantine.js`'s whole-game clause renders `closet.says` beside the
     * rate, so a reader of the headline cannot miss it and a change in the count is visible on the
     * gate line itself. Rendered from `closetDeclaration()`, the same object the dump renders. */
    closet: closetDeclaration(),
    rate_excludes: 'both engines are built with 0 EVs and 31 IVs and each DERIVES its own stat line '
      + '(nature mode: ' + NATURE_MODE + '), so they agree before AND after a forme change without '
      + 'either being told the other\'s answer. THE SPREADS ARE ABSENT AND ALWAYS WILL BE: an open '
      + 'team sheet does not reveal them (`"evs": null` on every stored body), so this instrument '
      + 'tests RULES and not the stat lines the ladder actually brings — the NATURE narrows that gap '
      + 'and does not close it. Mega bodies ARE tested as of ROADMAP #31 ('
      + STONES_KEPT + ' stone sets kept, 0 stripped from the measured arm).',
    /* ROADMAP #31 — THE TWO RATES, NEVER ONE. Same pairs, same seeds, same driver state; the stone is
     * the only difference between `with_megas` and `control_same_pairs_no_stones`. */
    mega: (() => {
      const withStone = results.filter(r => r.stones);
      const withStoneCtl = control.filter((c, i) => results[i].stones);
      const noStone = results.filter(r => !r.stones);
      const dv = arr => arr.filter(r => r.div).length;
      return {
        why: 'the 2026-08-06 run stripped 460 stone sets and tested ZERO mega bodies in a ~26%-mega '
           + 'format. medicham2 now evolves on a CHOICE mid-turn, so the stones stay on and every '
           + 'pair is played TWICE — the difference between the two arms IS what megas cost.',
        rates: {
          with_megas: { games: withStone.length, diverged: dv(withStone) },
          control_same_pairs_no_stones: { games: withStoneCtl.length, diverged: dv(withStoneCtl) },
          pairs_with_no_stone_at_all: { games: noStone.length, diverged: dv(noStone) },
          whole_control_arm: { games: control.length, diverged: dv(control),
                               note: 'every stone stripped — this is what the 2026-08-06 run measured' },
        },
        pairing_broken: PAIRING_BROKEN,
        /* THE RATE IS SATURATED, SO THE PAIRED COMPARISON IS THE ANSWER. Where each arm parts, and
         * whether the evolution itself is what parted it. */
        cost_of_the_megas: (() => {
          const at = r => (r.div ? r.div.index : Infinity);
          const pr = results.map((r, i) => ({ r, c: control[i] })).filter(x => x.r.stones);
          /* COUNTED APART. `detailschange` is Showdown's line for ANY permanent forme change and Zero
           * to Hero is one, so merging the two would file a Palafin as a mega wire — which is exactly
           * what the first cut of this did. */
          const isMega = l => /^\|-mega\|/.test(String(l || ''));
          const isDetails = l => /^\|detailschange\|/.test(String(l || ''));
          const row = r => ({ config: r.config, seed: r.seed, index: r.div.index,
                              showdown: r.div.sdRaw, medicham: r.div.meRaw,
                              sdAfter: r.div.sdAfterRaw.slice(0, 5), meAfter: r.div.meAfterRaw.slice(0, 5) });
          return { stone_carrying_pairs: pr.length,
                   mega_arm_parted_earlier: pr.filter(x => at(x.r) < at(x.c)).length,
                   mega_arm_parted_later: pr.filter(x => at(x.r) > at(x.c)).length,
                   parted_at_the_same_line: pr.filter(x => at(x.r) === at(x.c)).length,
                   first_divergence_is_a_mega_line:
                     results.filter(r => r.div && (isMega(r.div.sdRaw) || isMega(r.div.meRaw))).length,
                   first_divergence_is_a_detailschange_line:
                     results.filter(r => r.div && (isDetails(r.div.sdRaw) || isDetails(r.div.meRaw))).length,
                   /* LISTED IN FULL, not sampled. `first_divergences` above is capped at 60 games and
                    * the forme-change ones are the actionable output of this pass — a finding that
                    * falls off the end of a slice is a finding nobody acts on. */
                   on_a_mega_line: results.filter(r => r.div && (isMega(r.div.sdRaw) || isMega(r.div.meRaw))).map(row),
                   on_a_detailschange_line:
                     results.filter(r => r.div && (isDetails(r.div.sdRaw) || isDetails(r.div.meRaw))).map(row) };
        })(),
        evolutions_medicham: MEGA_MEDI, evolutions_showdown: MEGA_SD,
        engines_agree_on_the_count: MEGA_MEDI === MEGA_SD,
        sides_capable: MEGA_SIDES_CAPABLE, sides_evolved: MEGA_SIDES_EVOLVED,
        from_left_slot: MEGA_SLOT_A, from_right_slot: MEGA_SLOT_B,
        choices_issued: MEGA_CHOICES,
        every_issued_choice_evolved_in_both_engines:
          !!MEGA_CHOICES && MEGA_MEDI === MEGA_CHOICES && MEGA_SD === MEGA_CHOICES,
        stones_kept: STONES_KEPT, stones_stripped_from_control_arm: STONES_STRIPPED,
      };
    })(),
    normalisation: {
      why: 'every rule drops an ANNOUNCEMENT or an ATTRIBUTION and never a STATE CHANGE; each carries '
         + 'a red demonstration in both directions and they run before any game does',
      all_rules_proved: !EQ_BAD.length,
      rules: EQUIV.map(r => ({ id: r.id, why: r.why, lines_collapsed: NORM_COUNTS.get(r.id) || 0,
        collapses_the_form: (EQP.find(x => x.id === r.id) || {}).collapses,
        keeps_the_meaning: (EQP.find(x => x.id === r.id) || {}).keeps_meaning,
        equal_pair: r.equal, distinct_pair: r.distinct })),
      total_lines_collapsed: [...NORM_COUNTS.values()].reduce((a, b) => a + b, 0),
    },
    /* WHICH TABLE EACH TOKEN WAS ASKED OF. A reader of `mentions` cannot otherwise tell a cause that
     * names no condition from a run in which the condition rule never fired — and the difference is
     * exactly the `moves/confusion, nonstandard: Past` misattribution that made this rule necessary. */
    entity_annotation: {
      by: 'engine/effect_kind.js',
      rule: 'a token outside a `|move|SLOT|NAME` position that names an entry in the format\'s '
          + 'standalone condition table is a CONDITION; a LEGAL move of the same name is kept beside '
          + 'it as a setter, an ILLEGAL one is dropped because it cannot be the setter',
      standalone_conditions: Object.keys(CONDITION_TABLE).length,
      condition_slot_tokens: CONDITION_SLOT_HITS,
      rescued_from_an_illegal_move: CONDITION_SLOT_RESCUED,
    },
    directed: DIR, damage_interior: INTERIOR,
    /* ROADMAP #80. The streams are dropped from the artifact — they are debugging context, not a
     * measurement, and two full protocol logs per arm would bury the three numbers that matter. */
    knock_off_roadmap_80: { arms: KO.arms.map(({ showdown_stream, medicham_stream, ...a }) => a),
                            sitrus_half: KO.sitrus_half, boost_half: KO.boost_half,
                            reduction_half: KO.reduction_half, net: KO.net,
                            verdict: 'the predicted DAMAGE bug does not reproduce — medicham2 prices both '
                              + 'halves correctly because playerAction computes the range at CLICK time, '
                              + 'before the item is stripped. What differs is the item DISPOSITION: Showdown '
                              + 'records Colbur as EATEN BY ITSELF, medicham2 as KNOCKED OFF.' },
    diverged: diverged.length, threw: threw.length,
    /* `diverged` ABOVE IS OVER EVERY GAME PLAYED, INCLUDING THE ONES THE INSTRUMENT COULD NOT READ.
     * That is the number this file has always published and it is kept, but on its own it is a ratio
     * whose denominator contains games that were never evidence. `mid_void` carries the readable
     * population and the rate over it, plus why each unreadable game was unreadable. `null` when the
     * primary arm is a pinned one, whose constant die cannot desynchronise. */
    mid_void: MID_VOID_SUMMARY,
    /* THE STATE DIFFERENTIAL, in the same artifact as the protocol one so the two rates describe the
     * SAME games rather than two runs somebody has to hope were comparable. `null` when the run was
     * not asked for it, which is a different claim from zero. */
    state: STATE_SUMMARY,
    state_mode: STATE,
    /* THE END-STATE MEASUREMENT, PER ARM. `null` when the run was not asked for `--end-state`, which
     * is a different claim from "nothing was cosmetic": under the other stop rules the game halts at
     * the first disagreement and the last board is the board we stopped looking at. */
    end_state_mode: END_STATE,
    end_state: END_STATE ? END_STATE_BY_ARM : null,
    end_state_not_compared: END_STATE ? BS.NOT_COMPARED.map(x => x.field) : null,
    /* THE ONE INPUT TO THE SEVERITY LADDER THAT IS NOT IN THE FROZEN RELEASE. The ranking's second key
     * is corpus usage and `tags.json` carries none for a species, so `data/meta-usage.json` is read
     * LIVE. Its stamp travels with the artifact for exactly the reason the release id does: a reader
     * must be able to tell whether the engine and the ranking were photographed at the same moment.
     * `error` non-null means every body ranked as UNKNOWN usage, which is not the same as zero. */
    severity_usage_source: !END_STATE ? null : {
      file: 'data/meta-usage.json', read: 'LIVE — not in the frozen release',
      generated: SPECIES_USES.generated, species_with_a_usage_figure: SPECIES_USES.by.size,
      base_forme_fallbacks: SPECIES_USES.base_forme_fallbacks || 0,
      base_forme_note: 'A mega forme has no row of its own and falls back to the dex\'s baseSpecies, '
                     + 'counted here. Without it every mega ranked UNKNOWN in a format whose mega usage '
                     + 'is ~26%.',
      error: SPECIES_USES.error,
    },
    severity_ladder: END_STATE ? ESS.BANDS : null,
    pin: PIN_CLAIMS.map(([w]) => w),
    /* EVERY CAUSE CARRIES ITS FORMAT STANDING. See annotateCause() -- three separate times on
     * 2026-08-06/07 a WIRE was justified by a mechanic that CANNOT OCCUR in Champions (Blunder Policy,
     * `isNonstandard: 'Past'`, 0 of 410,780 sets; Okidogi, `tier: Illegal`, and no legal body in this
     * format carries Guard Dog at all). Each time the rule "check isNonstandard before citing
     * anything" was written down, and each time it was read past. A rule you have to remember is a
     * preference; the standing now travels WITH the cause, so a zero is visible at the moment the
     * cause is read rather than three steps later when somebody thinks to check. */
    classes: [...classes].map(([cls, e]) => ({
      cls, games: e.games,
      causes: [...e.causes].map(([cause, n]) => Object.assign({ cause, n }, annotateCause(cause))),
    })),
    /* ROADMAP #290 — EVERY move-vs-move ordering pair, not a sample, with the discriminator attached.
     * The question it answers is one line: were the two bodies actually speed-tied? If they were not,
     * `ordering` is a real turn-order defect and not the retired tie artefact. */
    order_probe: diverged.filter(r => r.div && r.div.orderProbe).map(r => Object.assign(
      { config: r.config, seed: r.seed, cls: r._cls.cls, cause: r._cls.cause,
        showdown: r.div.sdRaw, medicham: r.div.meRaw }, r.div.orderProbe)),
    first_divergences: diverged.slice(0, 60).map(r => ({
      config: r.config, seed: r.seed, index: r.div.index, agreed_lines: r.div.agreedLines,
      /* 2026-08-25 — WHICH TURN IT PARTED ON. `index` is a line offset and two runs at different turn
       * caps cannot be compared by it; the turn can. Without this there is no way to say which of a
       * deeper run's divergences are ones the shallower cap could never have reached. */
      turn: r.divTurn,
      cls: r._cls.cls, cause: r._cls.cause, showdown: r.div.sdRaw, medicham: r.div.meRaw,
      /* ROADMAP #241(3) — see `sdBeforeRaw` at the divergence record. A bare `-fail` names the mover
       * and never the move; this is where the move is named. */
      showdown_before: r.div.sdBeforeRaw || null })),
    errors: threw.map(r => ({ config: r.config, seed: r.seed, err: r.err })),
    /* ROADMAP #91 — THE CREDIT RULE AND WHAT IT COST, IN THE ARTIFACT SO THE DROP IS A MEASUREMENT
     * RATHER THAN A MYSTERY. `exercised` below is the OLD, click-and-presence number and is kept
     * exactly as it was; `credit.rows_with_an_observed_effect` is the number now. */
    credit: {
      policy: CREDIT_POLICY,
      rule: 'a census row is exercised when a board leaf in a family THE TAG\'S OWN PARAMS NAME changed '
          + 'across the turn, in either engine, inside the scope of an entity that was in play; or when '
          + 'a blocking tag\'s declared negative case was reached and correctly did not fire. A click '
          + 'alone counts for NOTHING but an attempt.',
      why: 'Primarina clicked Haze on turn 1 into a board with zero boosts on it. Haze is a no-op '
         + 'there, the census marked it exercised, and because the census STEERS the sample a falsely '
         + 'credited row then steered every later run AWAY from testing it.',
      rows_with_an_observed_effect: creditedByEffect.length,
      rows_that_can_be_witnessed_on_a_board: witnessable.length,
      rows_that_name_no_board_leaf: noBoardLeaf.length,
      rows_credited_by_a_connected_click_only: creditedByClickOnly.length,
      rows_clicked_or_present_that_did_nothing: touchedNotCredited.length,
      rows_clicked_or_present_that_did_nothing_list: touchedNotCredited.map(t => t.key).sort(),
      turns_credited_over: CREDIT_TURNS,
      attribution_limit: 'credit is at TURN granularity, scoped to the user\'s slot, the target\'s '
          + 'slot, the field and both sides. Two mechanics acting on one body in one turn can both be '
          + 'credited. That is weaker than a per-effect trace and strictly tighter than the click it '
          + 'replaces, which is the whole claim.',
      derivation: COV_TARGETS.map(t => ({ key: t.key, kind: t.witness.kind,
        families: t.witness.families, from: t.witness.why,
        credit: COV_CREDIT.get(t.key) || 0, of_which: kindOf(t.key),
        attempts: COV_ATTEMPT.get(t.key) || 0 })),
    },
    coverage: {
      measurable: COV_TARGETS.length, exercised: covered.length,
      exercised_note: 'THE OLD NUMBER — an entity of this row connected or stood on the field. It is '
        + 'kept so the drop to credit.rows_with_an_observed_effect is readable, and it is NOT the '
        + 'coverage claim any more.',
      exercised_by_a_connected_move: covStrong.length,
      move_targets: COV_TARGETS.filter(t => t.sec === 'moves').length,
      present_on_the_field_only: covWeak.length,
      ability_or_item_targets: COV_TARGETS.filter(t => t.sec !== 'moves').length,
      median_completed_turns_before_divergence: medianTurns,
      unmeasurable_by_this_instrument: COV_UNMEASURABLE.map(t => ({ key: t.key, why: t.why })),
      not_exercised: uncovered.map(t => t.key),
      /* ---- THE MISSES LIST DID NOT MEAN WHAT ITS NAME SAID (2026-08-12) --------------------------
       * `clicked_but_always_missed` was `[...CLICKED_BUT_MISSED.keys()]` — every move that missed AT
       * LEAST ONCE, across every arm. Under the Mode A pin the TOP arm misses every sub-100 move and
       * the BOTTOM arm hits it, and both arms fill the same module-level map, so a move that connected
       * perfectly well in the bottom arm was still published as "always missed". The name asserted the
       * intersection and the value was the union.
       *
       * BOTH ARE PUBLISHED NOW, and the old key keeps its old value so nothing downstream silently
       * changes meaning — it is the honest one that is new. `clicked_but_never_connected` is the
       * intersection the name claimed: clicked, missed, and never once connected in ANY arm. That is
       * the list of moves this run genuinely did not exercise. */
      clicked_but_always_missed: [...CLICKED_BUT_MISSED.keys()].sort(),
      clicked_but_always_missed_note: 'MISLEADING NAME, KEPT FOR CONTINUITY: this is every move that '
        + 'missed at least once in any arm, which includes moves that connected in the other arm. Read '
        + 'clicked_but_never_connected for the claim the name makes.',
      clicked_and_missed_at_least_once: [...CLICKED_BUT_MISSED.keys()].sort(),
      clicked_but_never_connected: [...CLICKED_BUT_MISSED.keys()].filter(m => !OBSERVED.moves.has(m)).sort(),
      distinct_moves_connected: OBSERVED.moves.size, distinct_abilities: OBSERVED.abilities.size,
      distinct_items: OBSERVED.items.size, distinct_species: OBSERVED.species.size,
    },
    /* ---- THE STOPPING RULE'S RECEIPT (2026-08-12) -------------------------------------------------
     * `null` on a fixed-count run. That is a DIFFERENT CLAIM from "coverage was reached", and the
     * distinction is the whole reason this block exists: every run before today stopped on a number
     * somebody picked, and nothing in the artifact said so. */
    coverage_stop: COVERAGE_STOP ? Object.assign({}, COVERAGE_STOP, {
      rows_measurable: COV_TARGETS.length,
      rows_with_any_credit: credited.length,
      rows_with_an_observed_effect: creditedByEffect.length,
      /* BY NAME, NEVER AS A COUNT. A number here is not a worklist. */
      rows_never_credited: neverCredited.map(t => t.key).sort(),
      rows_never_credited_a_board_could_have_witnessed: neverWitnessed.map(t => t.key).sort(),
      rows_never_credited_that_name_no_board_leaf: neverClicked.map(t => t.key).sort(),
      moves_clicked_but_never_connected: [...CLICKED_BUT_MISSED.keys()].filter(m => !OBSERVED.moves.has(m)).sort(),
    }) : null,
    swarm: SW.out.map(c => ({ config: c.config, available: c.available, picked: c.picked,
                              games: results.filter(r => r.config === c.config).length })),
    declared_gaps: {
      mega_stones_stripped: 0,
      mega_stones_kept: STONES_KEPT,
      control_arm_stones_stripped: STONES_STRIPPED,
      align_had_to_move_a_stat: ALIGN_MOVED,
      align_had_to_move_who: Object.fromEntries([...ALIGN_MOVED_WHO.entries()].sort((a, b) => b[1] - a[1])),
      /* 2026-08-08 — the nature. `spreads_absent` is stated as a permanent property of the DATA rather
       * than a to-do, because an open team sheet does not show a spread and no amount of ingest work
       * will change that. `nature_fallback_to_serious` must be read beside `nature_declared`: a run
       * with a large fallback count is HALF NATURED and its turn-order numbers describe two
       * populations. */
      nature_mode: NATURE_MODE,
      nature_declared: NATURE_COUNT.declared,
      nature_fallback_to_serious: NATURE_COUNT.fallback,
      nature_fallback_who: Object.fromEntries([...NATURE_FELL_BACK.entries()].sort((a, b) => b[1] - a[1])),
      nature_forced_flat: NATURE_COUNT.forced_flat,
      spreads_absent: 'permanently — a Showdown open team sheet reveals species, item, ability, moves, '
        + 'nature, gender and level, and NOT the spread. Every stored sheet reads `"evs": null`. '
        + 'ROADMAP #68 is narrowed by the nature and is not closed.',
      teams_unbuildable: TEAMS_UNBUILDABLE, sets_unbuildable: MONS_UNBUILDABLE,
      ban_fallbacks: BAN_FALLBACKS, forced_first_slot: FORCED_FIRST_SLOT,
      /* 2026-08-22 — THE HARNESS ANSWERING THE AUTHORITY. `choices_refused` counts `battle.choose()`
       * calls Showdown returned false for and MUST READ 0: a refusal emits no protocol line, so a run
       * with a non-zero here published divergences the instrument invented. `forced_switch_slots_*`
       * count SLOTS: `_passed` is a slot medicham2 could not fill either and is expected to be
       * non-zero. */
      choices_refused: CHOICE_REFUSED.n, choices_refused_first: CHOICE_REFUSED.first || null,
      forced_switch_slots_mirrored: FORCED_SWITCH_MIRROR.switched,
      forced_switch_slots_passed: FORCED_SWITCH_MIRROR.passed,
      /* NOT a defect count — see the printed caption. A game counted here stopped early ON PURPOSE
       * and carries the real, earlier divergence that parted the boards. */
      forced_switch_unmirrorable: MIRROR_IMPOSSIBLE.n,
      forced_switch_unmirrorable_first: MIRROR_IMPOSSIBLE.first || null,
      /* 2026-08-10 — the driver's ally aim. `aim_ally` at 0 on a run that staged one means the
       * translation is blind again; `aim_slot_empty` is a named slot with no body and must be 0. */
      aim_foe: AIM.foe, aim_ally: AIM.ally, aim_self: AIM.self,
      aim_none: AIM.none, aim_slot_empty: AIM.miss,
      undeclared_event_drops: UNDECLARED_DROPS,
      trace_body_off_field: M.fails.traceBodyOffField,
      trace_body_off_field_first: M.fails.traceBodyOffFieldFirst,
      undeclared_events: [...UNDECLARED_SEEN],
      gender_neutralised: true, tags_release_matches_live: TAGS_MATCH,
    },
    /* ROADMAP #81 WIRE 5 — THE STEERING INPUT'S DIGEST, so a future reader can TELL whether two arms
     * were comparable rather than having to trust that they were. `engine/arms_comparable.js` reads
     * exactly this block; an artifact without one fails that check CLOSED. */
    steering: STEER_STAMP,
    baseline_comparability: BASELINE_CHECK,
  }, REL.stamp());
  const outPath = OUT ? path.resolve(OUT) : D('data', 'game-differential.json');
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');
  console.log('  -> ' + (OUT ? outPath : 'data/game-differential.json'));
}

/* THE READABLE DUMP — the same diverging games with the lines either side of the split.
 *
 * Will, 2026-08-12: "can you show me the turns where they differed? and dont do it with a bunch of
 * illegible text like you did before". `alignAndCheck` has ALWAYS captured this context — four lines
 * before and six after on each side, raw and reduced — and `first_divergences` threw all of it away,
 * keeping only the two mismatched lines. So the artifact could say WHAT differed and never what was
 * happening around it, which is the difference between a cause list and something a person can read.
 * Its own file, because it is a DEBUGGING VIEW and not a measurement; the numbers stay in
 * data/game-differential.json.
 *
 * AND IT IS NO LONGER GATED ON `--write` (2026-08-13). It sat inside the `if (WRITE)` block, so the
 * only way to look at a diverging game was to ALSO overwrite data/game-differential.json — i.e. to
 * publish a measurement in order to debug. That is backwards, and it is why a diagnosis run had to
 * either clobber the standing artifact or go without evidence. `--dump-games` defaults to 0, so a
 * run that does not ask for the dump is unchanged. */
/* BOTH ARMS IN THE DUMP, INTERLEAVED — 2026-08-13.
 *
 * `results` holds the PRIMARY arm alone, so every dump so far has been top-tie-first: the corner where
 * every sub-100 move MISSES and no secondary fires. Will asked for the bottom arm too, for the right
 * reason — that corner is where everything LANDS, so it reaches interactions the top arm cannot
 * produce at all. Magic Bounce is the clean example: in the top arm the Hypnosis misses, so there is
 * nothing to bounce and the mechanic is untestable by construction.
 *
 * Taken ALTERNATELY rather than top-then-bottom, so a reader who stops halfway has seen both corners
 * instead of one. Each card carries its arm, because a divergence that only appears in one corner is a
 * different claim from one that appears in both. */
const DUMP_POOL = (() => {
  const byArm = (ARM_RUNS || []).map(a => ({
    arm: (a.arm && a.arm.id) || a.id || '?',
    /* A VOID GAME MUST NEVER REACH THE DUMP. Its divergence is the instrument's streams parting,
     * not the engine, and a reader cannot tell the two apart by looking - which is precisely how an
     * instrument that manufactures defects wastes a human's evening. The middle arm marks them; every
     * other arm has a constant die and cannot desynchronise, so the void mark is undefined there. */
    rows: (a.results || []).filter(r => r.div && !r._mid_void),
  })).filter(x => x.rows.length);
  if (!byArm.length) return diverged.map(r => ({ arm: (ARM && ARM.id) || 'primary', r }));
  const out = [];
  for (let i = 0; out.length < DUMP_GAMES * 2 && i < 10000; i++) {
    let any = false;
    for (const a of byArm) {
      const r = a.rows[i];
      if (!r) continue;
      /* `_cls` is stamped by the report loop above, which walks the PRIMARY arm only — the class tally
       * is a claim about the headline arm and stays that way. A non-primary row reaching the dump has
       * never been classified, so classify it HERE, through the same function, rather than letting the
       * card fall back to "unclassified" and quietly imply the classifier had no opinion. */
      if (!r._cls) r._cls = classify(r.div);
      out.push({ arm: a.arm, r });
      any = true;
    }
    if (!any) break;
  }
  return out;
})();

if (DUMP_GAMES && DUMP_POOL.length) {
  const cut = DUMP_POOL.slice(0, DUMP_GAMES).map(({ arm, r }) => ({
    arm,
    config: r.config, seed: r.seed,
    agreed_lines: r.div.agreedLines, cls: r._cls.cls, cause: r._cls.cause,
    /* WHY THE GAME STOPPED AND WHAT EACH ENGINE WAS HOLDING WHEN IT DID. Without these the
     * truncation classes are guesswork — see the rosterSnapshot header in playGame. */
    end_reason: r.endReason || null, ended_showdown: !!r.endedSd, ended_medicham: !!r.endedMedi,
    final_roster: r.finalRoster || null,
    /* BOTH FORMS. The reduced line is what DECIDED; the raw line is what the engines actually emitted
     * and is what a person has to go and fix. Keeping only one has bitten before. */
    at: { showdown_raw: r.div.sdRaw, medicham_raw: r.div.meRaw,
          showdown: r.div.sd, medicham: r.div.me },
    before: r.div.before || [],
    before_raw: r.div.beforeRaw || [],
    after: { showdown: r.div.sdAfterRaw || r.div.sdAfter || [],
             medicham: r.div.meAfterRaw || r.div.meAfter || [] },
  }));
  fs.writeFileSync(D(DUMP_OUT), JSON.stringify({
    what: 'DIVERGING GAMES WITH THE LINES EITHER SIDE OF THE SPLIT. A debugging view, not a '
        + 'measurement. Both the RAW emitted line and the REDUCED line the comparator decides on are '
        + 'kept: the reduced form is what decided, the raw form is what has to be fixed.',
    generated: new Date().toISOString(),
    engine_release: REL.id, team_store_pinned_to: TEAM_STORE || null,
    /* THE EXCLUSION IS DECLARED, NEVER SILENT. A narrowed sample that does not say it was narrowed is
     * indistinguishable from a mechanic that simply never came up — which is the failure mode this
     * whole project is organised against. */
    closet: closetDeclaration(),
    /* `of_diverged` IS THE POPULATION, NOT THE POOL. DUMP_POOL is capped at twice the dump size, so
     * reporting its length here would have the page say "80 of 160" for a run that diverged on 655 —
     * a sample announcing itself as the whole thing. */
    games: cut.length,
    of_diverged: (ARM_RUNS || []).reduce((n, a) => n + (a.results || []).filter(r => r.div).length, 0),
    pool_considered: DUMP_POOL.length,
    /* PER ARM, because "224 diverging games" from one corner and the same count from both corners are
     * different facts. A reader who cannot see the split cannot tell a mechanic that is wrong
     * everywhere from one that is only wrong where every move lands. */
    arms_in_dump: (() => {
      const c = {}; for (const x of cut) c[x.arm] = (c[x.arm] || 0) + 1;
      /* COUNTED OFF THE ARM, NOT OFF THE POOL. The pool is capped at twice the dump size, so tallying
       * it would report "available: 60" for an arm that diverged on 76 — a cap wearing the name of a
       * population, which is the same class of quiet over-claim this instrument exists to catch. */
      const t = {};
      for (const a of (ARM_RUNS || [])) {
        const id = (a.arm && a.arm.id) || a.id || '?';
        t[id] = (a.results || []).filter(r => r.div).length;
      }
      return { shown: c, diverged_in_arm: t };
    })(),
    divergences: cut,
  }, null, 2) + '\n');
  /* THE CONSOLE SAYS THE POPULATION TOO. It said "80 of 160" while the run diverged on 655 — the same
   * cap-as-population slip the artifact carried, and the console is where it gets read first. */
  const dumpPop = (ARM_RUNS || []).reduce((n, a) => n + (a.results || []).filter(r => r.div).length, 0);
  console.log('  wrote ' + DUMP_OUT + '  (' + cut.length + ' of ' + dumpPop
    + ' diverging games across ' + new Set(DUMP_POOL.map(x => x.arm)).size + ' arm(s), with context)');
}
