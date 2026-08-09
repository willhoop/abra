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
const STATE = has('--state');
/* `--team-store <dir>` PINS THE OTHER HALF OF THE SAMPLE. The census is pinnable (WIRE 5); the team
 * store was not, and `engine/diff_swarm.js` reads it LIVE from a file OPS appends to. See that file's
 * `loadTeams` header for what it cost. Absent, the live store is read exactly as before. */
const TEAM_STORE = flag('--team-store', null);
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
const M = REL.require('engine/medicham2-browser.js', {
  need: ['natureL50', 'battleInit', 'battleTurn', 'battleOver', 'playerAction', 'buildMon',
         'dmgRange', 'traceCanon', 'TRACE_EVENTS', 'weatherId', 'terrainId', 'fails'],
  want: ['MEDI_SPREAD'],
});
const CS = require('./champions_sim.js');
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
const id = N.id;
/* THE READER'S CONTEXT. `weatherId`/`terrainId` are THE ENGINE'S OWN exported translators, taken from
 * the frozen release rather than restated here — a second copy of "sandstorm means sand" is exactly the
 * two-implementations-of-one-fact CLAUDE.md forbids. `fails` is a live counter: a translation that
 * could not be made produces `UNTRANSLATABLE:<name>` rather than an empty string, because empty reads
 * as clear skies and would agree with a Showdown that also had none. */
const STATE_FAILS = {};
const BS_CTX = { id, weatherId: M.weatherId, terrainId: M.terrainId, fails: STATE_FAILS };
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

/* A cause is a protocol fragment, so the entity names in it are already normalised ids sitting between
 * pipes, colons and spaces. Split on everything that is not a letter or digit and test each token --
 * cheap, and it cannot miss one by guessing the wrong field position. */
function annotateCause(cause) {
  const seen = new Set(), out = [];
  for (const tok of String(cause).split(/[^a-z0-9]+/i)) {
    const id = N.id(tok);
    if (!id || id.length < 4 || seen.has(id)) continue;
    seen.add(id);
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
  const random = function pinRandom(m, n) {
    if (n === undefined) {
      if (m === undefined) { BARE_FLOAT_DRAWS++; return spec.corner; }   // random() -> a float in [0,1)
      if (m === DAMAGE_ROLL_SIDES) return spec.damageIndex;              // 0 = MAX damage, 15 = MIN
      return top ? m - 1 : 0;                                           // top / bottom of the range
    }
    /* THE RANGE FORM IS PINNED TO THE BOTTOM IN EVERY ARM — see the header. It is the sleep duration,
     * a multi-hit count and a queue insertion index, and it is NOT the speed-tie resolver. */
    return m;
  };
  const chance = (num, den) => random(den) < num;
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
    if (!spec.tieToSecondBody) return () => spec.corner;
    let i = 0;
    return () => {
      if (i >= TIE_CAP) { TIE_SATURATED++; return spec.corner + TIE_CAP * TIE_STEP; }
      return spec.corner + (i++) * TIE_STEP;
    };
  };
  return Object.assign({ sdShuffleReverses: false }, spec, { top, random, chance, shuffle, mediRng });
}
/* The reversing shuffle, built once so the PIN_CLAIMS can assert it and a future pass can use it
 * without re-deriving the sub-range rule. Not installed on any battle. */
const REVERSING_SHUFFLE = makeArm({ id: '(unused) reversing shuffle', corner: CORNER_TOP,
  damageIndex: 0, tieToSecondBody: false, sdShuffleReverses: true, what: 'not installed' }).shuffle;

const ARMS = [
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
      () => { const r = a.mediRng(); let prev = -1;
              for (let i = 0; i < 500; i++) { const v = r(); if (!(v > prev)) return false; prev = v; }
              return true; });
    P('every value in that sequence is BEHAVIOURALLY IDENTICAL to the constant corner — same damage '
      + 'index, same accuracy verdict, same crit, same secondary, same stall, and never 1.0',
      () => { const r = a.mediRng(); const c = a.corner;
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
      () => { const r = a.mediRng(); const v = r(); return r() === v && r() === v && v === a.corner; });
  }
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
const PIN_DIGEST = crypto.createHash('sha256').update(JSON.stringify(ARMS_RUN.map(a => ({
  id: a.id, corner: a.corner, damageIndex: a.damageIndex, tieToSecondBody: a.tieToSecondBody,
  sdShuffleReverses: a.sdShuffleReverses,
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
  medicham2_has_one_scalar_die: 'accuracy, the crit, every secondary, the stall counter and the damage '
     + 'roll all read the same `rng()`, so there are TWO corners and not four independent knobs.',
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
const SWITCH_LOOKUP_MISS = { medi: 0, sd: 0 };   /* species mc_key had no row for; the raw id is tried and the body is usually skipped */
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

function buildPair(sheet, opts) {
  const hpx = (opts && opts.hpBoost) || 1;
  const strip = !!(opts && opts.stripStones);
  const picked = [];
  for (const p of sheet) {
    if (picked.length >= 4) break;
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
    picked.push({ medi: b, spec: { key, moves: b.moves.slice(), item, ability, hpx, bs: sp.baseStats,
                                   nature, ident: sp.baseSpecies || sp.name }, sd: {
      name: sp.name, species: sp.name,
      /* GENDER IS 'N' ON BOTH SIDES. Showdown writes the gender into the `|switch|` details field
       * (`Incineroar, L50, F`) and medicham2 has no gender at all, so a declared gender would part
       * the streams on line one of every game. It is a CONTROL, and its cost is that Attract,
       * Rivalry and Cute Charm are not exercised — stated, not hidden. */
      gender: 'N', level: 50, item: item ? dex.items.get(item).name : '',
      ability: ability ? dex.abilities.get(ability).name : '',
      moves: moves.map(m2 => m2.name), nature,
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    } });
  }
  if (picked.length < 4) { TEAMS_UNBUILDABLE++; return null; }
  return picked;
}

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
    if (x.spec.bs) { b._nature = x.spec.nature || 'Serious'; b.st = flatL50(x.spec.bs, b._nature); b.curHP = b.st.hp; }
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
const bumpCredit = (key, kind) => {
  COV_CREDIT.set(key, (COV_CREDIT.get(key) || 0) + 1);
  const k = CREDIT_KIND.get(key) || { effect: 0, negative: 0, click: 0 };
  k[kind]++; CREDIT_KIND.set(key, k);
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
function creditTurn(play, prev, cur) {
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
        bumpCredit(t.key, 'click');
      continue;
    }
    const hit = chgs.some(c => w.families.some(f => famRe(f).test(c.family)) && inScope(c, scope));
    if (hit) { bumpCredit(t.key, 'effect'); continue; }
    /* THE DECLARED NEGATIVE CASE. A blocking tag whose carrier stood there while a connected move
     * that moves exactly this family was aimed at it, and the family did not move on that body. */
    if (w.blocking && t.sec !== 'moves' && carriers.length) {
      const reached = w.families.some(f => {
        const aimed = connectedFams.get(f);
        if (!aimed || !aimed.length) return false;
        return carriers.some(b => aimed.some(s => s.side === b.side && s.slot === b.slot));
      });
      if (reached) bumpCredit(t.key, 'negative');
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
  const S = M.battleInit(A, B, { trace, autoMega: false });

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
    const snap = BS.snapshot(S, battle, BS_CTX);
    if (play) creditTurn(play, prevSnap, snap);
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
      const tgt = a.foeSlot != null && foes[a.foeSlot] ? pretty(foes[a.foeSlot].species.id) : null;
      return { body: who, did: 'clicks ' + mv + (tgt ? ' at ' + tgt : '') + (a.mega ? ', and mega evolves' : '') };
    });
  };

  const alignAndCheck = () => {
    /* `opts.plant` corrupts the MEDICHAM side and only the medicham side. It exists for the
     * planted-divergence proof and is undefined on every real run — a comparator that finds nothing
     * must first prove it can find something, and a plant applied to a shared normaliser would land
     * on both streams and cancel out, which is the failure it is trying to detect. */
    const sdRawAll = sdStream(battle.log);
    const raw = opts.plant ? opts.plant(trace.slice()) : trace;
    const A = reduce(sdRawAll), B = reduce(raw);
    const a = A.lines, b = B.lines;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        return { index: i, sd: a[i], me: b[i],
                 /* THE RAW LINES, so a report shows what the engines EMITTED and not what the
                  * comparator reduced them to. The reduced form is what decided; the raw form is
                  * what a person has to go and fix. */
                 sdRaw: sdRawAll[A.rawIdx[i]], meRaw: raw[B.rawIdx[i]],
                 meRawIndex: B.rawIdx[i],
                 before: b.slice(Math.max(0, i - 4), i),
                 sdAfter: a.slice(i, i + 6), meAfter: b.slice(i, i + 6),
                 sdAfterRaw: A.rawIdx.slice(i, i + 6).map(j => sdRawAll[j]),
                 meAfterRaw: B.rawIdx.slice(i, i + 6).map(j => raw[j]),
                 agreedLines: i };
      }
    }
    return null;
  };
  /* the reduced -> raw map of the medicham stream as it stands, so a plant can be aimed at the raw
   * line that produced a given REDUCED index. */
  playGame._mediRawIdx = () => reduce(trace).rawIdx;

  try {
    firstDiv = alignAndCheck();     // the leads, entry abilities and entry weather, before turn 1
    if (firstDiv) divTurn = 0;
    stateCheck(0);                  // the board as the leads stand, before a choice is made
    /* THE STOP RULE, WRITTEN OUT BECAUSE IT DECIDES WHAT IS MEASURED.
     *   protocol mode  stop at the first divergent LINE  — the game after that point is two engines
     *                  telling different stories and every later line is downstream of the first.
     *   state mode     stop at the first divergent BOARD — same argument one level up, and NOT at the
     *                  first divergent line, because whether a parted narration reaches the same board
     *                  is the whole question. */
    for (let t = 0; t < MAXTURNS && (STATE ? !firstStateDiv : !firstDiv); t++) {
      if (battle.ended || M.battleOver(S)) break;
      if (battle.requestState !== 'move') break;
      /* ROADMAP #81 WIRE 7 — A DIRECTED SCENARIO ENDS WHEN ITS SCRIPT DOES.
       *
       * Every entry in DIRECTED carries a ONE-turn script, and the loop only ever ran one turn because
       * every one of them diverged on turn 1. When WIRE 7 made two of them AGREE the loop ran on,
       * `scripted()` returned `{pass:true}` for a slot that had no step, and Showdown rejected the
       * whole choice — `Can't pass: Your Incineroar must make a move (or switch)`. The scenario then
       * reported as THREW, which reads exactly like a broken harness and was in fact a FIXED ENGINE.
       * A scripted game is over when the script is over; that is not a failure and it is not a pass. */
      if (opts.script && !opts.script[t]) break;
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
      if (!chosen.p1 || !chosen.p2) break;

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
          if (a.foeSlot != null) slots.push({ side: foeSide, slot: a.foeSlot });
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
            const want = bench.find(x => x && !x.fainted && x._switchKey === a.switchTo)
                      || bench.find(x => x && !x.fainted && id(x.name) === a.switchTo);
            if (want) { map.set(mon, { kind: 'switch', to: want }); return; }
            SWITCH_LOOKUP_MISS.medi++;
            map.set(mon, { kind: 'pass' }); return;
          }
          const tgt = a.foeSlot != null ? foes[a.foeSlot] : null;
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
            const j = side.pokemon.findIndex(q => !q.isActive && !q.fainted && id(q.species.id) === a.switchTo);
            if (j < 0) SWITCH_LOOKUP_MISS.sd++;
            return j >= 0 ? 'switch ' + (j + 1) : 'pass';
          }
          return 'move ' + a.slot + (a.target != null ? ' ' + a.target : '') + (a.mega ? ' mega' : '');
        }).join(', ');
      };
      const c1 = str('p1', chosen.p1), c2 = str('p2', chosen.p2);
      if (!battle.choose('p1', c1)) throw new Error('p1 choice rejected "' + c1 + '": ' + (battle.p1.choice.error || '?'));
      if (!battle.choose('p2', c2)) throw new Error('p2 choice rejected "' + c2 + '": ' + (battle.p2.choice.error || '?'));

      /* A FORCED SWITCH IS MIRRORED FROM MEDICHAM2, never chosen independently. medicham2 refills a
       * dead slot itself; if Showdown picked its own replacement the two engines would be playing
       * different games from the next line on and every later divergence would be the harness. */
      let guard = 0;
      while (battle.requestState === 'switch' && guard++ < 8) {
        for (const sd of ['p1', 'p2']) {
          const side = sd === 'p1' ? battle.p1 : battle.p2;
          if (!side.activeRequest || !side.activeRequest.forceSwitch) continue;
          const mine = sd === 'p1' ? S.actA : S.actB;
          const picks = side.activeRequest.forceSwitch.map((need, i) => {
            if (!need) return 'pass';
            const want = mine[i] ? id(mine[i].name) : null;
            let j = want == null ? -1
              : side.pokemon.findIndex(q => !q.isActive && !q.fainted && id(q.species.id) === want);
            if (j < 0) j = side.pokemon.findIndex(q => !q.isActive && !q.fainted);
            return j >= 0 ? 'switch ' + (j + 1) : 'pass';
          });
          battle.choose(sd, picks.join(', '));
        }
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
    }
  } catch (e) { err = String((e && e.message) || e).slice(0, 160); }

  _lastSdLog = battle.log.slice();
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
           /* THE STATE RESULT, beside the protocol one so the two can be read against each other on the
            * same game rather than across two runs. `stateDiv === null` with `boundaries > 1` is a game
            * whose boards never parted. */
           boundaries, boundariesAgreed, stateDiv: firstStateDiv, stateShape, divTurn,
           earlyBoards, earlyClicks,
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
  const k = (act.moves || []).findIndex(mv => id(mv.id) === id(want.m));
  if (k < 0) return { pass: true };
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
  return { move: dm.id, slot: k + 1, target, mega,
           foeSlot: target != null && target > 0 ? target - 1 : null };
}
/* Asks to mega that Showdown's request refused. MUST read 0 in any run whose scenarios ask for one. */
let scriptMegaRefused = 0;

/* Pick ONE action for one active slot. Legal actions come from Showdown's request; the choice among
 * them is the coverage rule. */
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
    cands.push({ move: dm.id, slot: k + 1, target, banned,
                 foeSlot: target != null && target > 0 ? target - 1 : null,
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
      if (claimed.has(id(q.species.id))) return;
      cands.push({ switchTo: id(q.species.id), want: 1e6, prefer: 0, banned: false,
                   clicks: (CLICKS.get('switch:' + id(q.species.id)) || 0) * 6 });
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
      return { move: id(act.moves[0].id), slot: 1, target: null, foeSlot: null, forced: true };
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
  else CLICKS.set('switch:' + pick.switchTo, (CLICKS.get('switch:' + pick.switchTo) || 0) + 1);
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
function plantsFor(k) {
  const at = (s, j) => { const m = reduce(s).rawIdx; return j >= 0 && j < m.length ? m[j] : -1; };
  const bend = (line) => { const p = line.split('|'); if (p.length > 2) p[2] += 'XX'; return p.join('|'); };
  return [
    ['a wrong FIELD on the last agreeing line', k - 1,
      s => { const i = at(s, k - 1); if (i < 0) return s; const t = s.slice(); t[i] = bend(t[i]); return t; }],
    ['a MISSING event — the last agreeing line deleted', k - 1,
      s => { const i = at(s, k - 1); if (i < 0) return s; const t = s.slice(); t.splice(i, 1); return t; }],
    ['two agreeing events SWAPPED — the ordering class must fire', k - 2,
      s => { const i = at(s, k - 1), j = at(s, k - 2); if (i < 0 || j < 0) return s;
             const t = s.slice(); const x = t[j]; t[j] = t[i]; t[i] = x; return t; }],
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
                                 kd: new Map(CREDIT_KIND), tc: new Set(COV_TOUCHED) }; }
function driverRestore(s) {
  const put = (m, v) => { m.clear(); for (const [k, x] of v) m.set(k, x); };
  put(CLICKS, s.c); put(COV_CREDIT, s.cr); put(COV_ATTEMPT, s.at); put(CREDIT_KIND, s.kd);
  COV_TOUCHED.clear(); for (const k of s.tc) COV_TOUCHED.add(k);
}
function driverReset() { driverRestore({ c: new Map(), cr: new Map(), at: new Map(),
                                         kd: new Map(), tc: new Set() }); }
function withFrozenDriver(fn) {
  const s = driverSnap();
  try { return fn(); }
  finally { driverRestore(s); }
}
function plantedProof(pairA, pairB) {
  const clean = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'proof/clean'));
  const k = clean.div ? clean.div.index : clean.lines;
  const cleanRow = { what: 'the CLEAN arm of the same game', caught: !!clean.div,
                     at: clean.div ? clean.div.index : null, agreeing_prefix: k,
                     cls: clean.div ? classify(clean.div).cls : null };
  if (k < 3) return [{ what: 'CANNOT PLANT — the clean game parts after only ' + k + ' lines, so there '
                             + 'is no agreeing prefix to plant inside', caught: false, at: null }, cleanRow];
  return plantsFor(k).map(([what, expectAt, plant]) => {
    const r = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'proof/' + what.slice(0, 12), { plant }));
    return { what, caught: !!r.div, at: r.div ? r.div.index : null, expected_at: expectAt,
             earlier_than_clean: !!r.div && r.div.index < k,
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
const STATE_PLANTS = [
  ['HP off by one on an active body', 'active',
   S => { const m = living(S.actA); return !!m && ((m.curHP = Math.max(0, m.curHP - 1)), true); }],
  ['a stat stage off by one', 'boosts.atk',
   S => !!S.actA[0] && ((S.actA[0].boosts.at += 1), true)],
  ['a status that is not there', 'status',
   S => { const m = living(S.actB); return !!m && ((m.status = m.status === 'brn' ? 'par' : 'brn'), true); }],
  ['the TOXIC stage off by one', 'status_counter',
   S => { const m = living(S.actB); return !!m && ((m.status = 'tox'), (m.toxTurns = (m.toxTurns || 0) + 3), true); }],
  ['the SLEEP counter off by one', 'status_counter',
   S => { const m = living(S.actB, 1); return !!m && ((m.status = 'slp'), (m.slpTurns = (m.slpTurns || 0) + 2), true); }],
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
  ['a Taunt counter off by one', 'active[0].vol.taunt',
   S => bumpVol(S.actB[0], 'taunt', volOf(S.actB[0], 'taunt') + 3)],
  ['an Encore counter off by one', 'active[0].vol.encore',
   S => bumpVol(S.actB[0], 'encore', volOf(S.actB[0], 'encore') + 3)],
  ['a Disable counter off by one', 'active[1].vol.disable',
   S => bumpVol(S.actA[1], 'disable', volOf(S.actA[1], 'disable') + 4)],
  ['a Leech Seed that is not there', 'active[1].vol.leechseed',
   S => !!S.actA[1] && ((S.actA[1]._seededBy = S.actA[1]._seededBy ? null : { by: S.actB[0], per: 8 }), true)],
  ['a confusion counter off by one', 'active[0].vol.confusion',
   S => bumpVol(S.actA[0], 'confusion', volOf(S.actA[0], 'confusion') + 2)],
  ['a Perish count off by one', 'active[1].vol.perish',
   S => !!S.actB[1] && ((S.actB[1]._perish = (S.actB[1]._perish == null ? 0 : S.actB[1]._perish) + 2), true)],
  ['a MOVE TRAP counter off by one', 'active[0].vol.trapped_by_move',
   S => !!S.actA[0] && ((S.actA[0]._trap = { turns: ((S.actA[0]._trap && S.actA[0]._trap.turns) || 0) + 3,
                                             frac: 1 / 8, by: S.actB[0] }), true)],
  ['a BENCHED party member\'s HP off by one', 'party.',
   S => { const t = S.sfA.team || []; const m = t[t.length - 1]; if (!m) return false;
          m.curHP = Math.max(0, m.curHP - 1); return true; }],
  ['a BENCHED party member marked fainted', 'party.',
   S => { const t = S.sfB.team || []; const m = t[t.length - 1]; if (!m) return false;
          m.fainted = !m.fainted; return true; }],
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
    let applied = false;
    const r = withFrozenDriver(() => playGame(pairA, pairB, 'baseline', 'stateproof/' + what.slice(0, 14), {
      statePlant: (S2, b2, turnIdx) => { if (turnIdx === lastAgreeing) applied = !!mutate(S2); } }));
    const at = r.stateDiv ? r.stateDiv.turn : null;
    const paths = r.stateDiv ? r.stateDiv.diffs.map(d => d.path) : [];
    return { what, planted_field: wantPath, applied, caught: !!r.stateDiv, at, expected_at: lastAgreeing,
             at_the_planted_boundary: at === lastAgreeing,
             localised: paths.some(p => p.indexOf(wantPath) >= 0),
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
  { name: 'contact punish — Rough Skin resolves against the attacker (§5a)',
    predicts: 'ordering', expect: 'diverge',
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
  { name: 'the sandstorm residual is speed-sorted, not slot-ordered',
    predicts: 'ordering', expect: 'diverge',
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
function damageInterior(sc) {
  const a = buildPair(sc.A), b = buildPair(sc.B);
  if (!a || !b) return null;
  const sdVals = [];
  for (let roll = 0; roll < 16; roll++) {
    const v = oneHitDamage(a, b, sc.script, { sdRoll: roll });
    if (v != null) sdVals.push(v);
  }
  /* MEDICHAM'S SPAN IS ASKED FOR, NOT SWEPT. The first version swept its scalar `rng` across [0,1)
   * and got 37..55 where the true span is 37..44 — because the SAME scalar drives the crit roll
   * (`rng() < 1/24`), so the bottom of the damage sweep was silently critting. A sweep that has to
   * dodge the instrument's own side effects is not a measurement of the thing it names.
   * `dmgRange` IS the fact, and every rollout in this engine reads it. */
  const meSpan = mediSpan(a, b, sc.script);
  if (!meSpan) return null;
  const meVals = [];
  for (let v = meSpan.min; v <= meSpan.max; v++) meVals.push(v);   // sampled UNIFORMLY by the engine
  const uniq = arr => [...new Set(arr)].sort((x, y) => x - y);
  const sdSet = uniq(sdVals), meSet = uniq(meVals);
  const count = arr => { const m2 = new Map(); for (const v of arr) m2.set(v, (m2.get(v) || 0) + 1); return m2; };
  const sdC = count(sdVals), meC = count(meVals);
  /* medicham2 draws its span UNIFORMLY, so its probability for value v is 1/|span|; Showdown's is
   * (times v appears among 16 rolls)/16. Reported as the largest absolute difference in probability
   * over the union of the two spans. */
  let worstP = 0, worstAt = null;
  for (const v of uniq([...sdSet, ...meSet])) {
    const p1 = (sdC.get(v) || 0) / sdVals.length, p2 = (meC.get(v) || 0) / meSet.length;
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
  M.battleTurn(S, () => opt.mediRoll, mk(S.actA, S.actB, step.p1), mk(S.actB, S.actA, step.p2));
  return before - S.actB[0].curHP;
}

/* ---- RUN ----------------------------------------------------------------------------------------- */
const SW = SWARM.buildSwarm(Math.max(GAMES * 2, 18), TEAM_STORE ? { storeDir: TEAM_STORE } : null);

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
  const pool = (cfg && cfg.picked_teams) || [];
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

module.exports = { playGame, buildPair, freshBodies, classify, pinRandom, PIN_CHANCE, sdStream, chooseAction,
                   /* 2026-08-08 — the nature. `flatL50` and `freshBodies` are exported so
                    * tests/test-nature-differential.js can check the MEDICHAM line against the
                    * authority directly instead of inferring it from a game that agreed; the counters
                    * are exported so the same file can prove the fallback is counted rather than
                    * silent, and that it stays still on a fully-declared sheet. */
                   flatL50, NATURE_MODE, natureCounters: () => Object.assign({}, NATURE_COUNT),
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
                   BOARD_FAMILY, changedFamilies };

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
                   : 'NOT CAUGHT — ' + p.what))));
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
      + (!p.applied ? 'NOT APPLIED     '
        : p.caught && p.at_the_planted_boundary && p.localised ? 'CAUGHT+LOCALISED'
        : p.caught && p.at_the_planted_boundary ? 'caught, NOT LOCALISED'
        : p.caught ? 'caught at ' + p.at + ', PLANTED AT ' + p.expected_at : 'NOT CAUGHT      ')
      + '  ' + String(p.planted_field).padEnd(28) + p.what
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
if (!has('--proof')) {
  const live = SW.out.filter(c => !ONLY || c.config === ONLY);
  const perConfig = Math.max(1, Math.floor(GAMES / live.length));
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
      for (const pr of pairsFor(cfg.config)) {
        if (made >= perConfig) break;
        /* THE STONE CONTROL RUNS UNDER THE PRIMARY PIN ONLY. It is a paired measurement that DOUBLES
         * the games, and four arms times two would be eight runs of the swarm to answer a question
         * that is about stones and not about dice. Declared rather than quietly dropped. */
        let c = null;
        if (isPrimary) {
          const s0 = driverSnap();
          c = playGame(pr.aN, pr.bN, cfg.config, pr.tag + ' [stones removed]', { arm });
          driverRestore(s0);
        }
        const r = playGame(pr.a, pr.b, cfg.config, pr.tag, { arm });
        r.stones = pr.stones;
        if (c) {
          c.stones = 0;
          if (!pr.stones) {
            const same = (!!r.div === !!c.div) && (!r.div || r.div.index === c.div.index) && r.turns === c.turns;
            if (!same) PAIRING_BROKEN++;
          }
          armControl.push(c);
        }
        armResults.push(r); made++;
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
        if (VERBOSE) console.log('   ' + arm.id.padEnd(22) + cfg.config.padEnd(24) + (r.err ? 'THREW ' + r.err
          : r.div ? 'DIVERGES at line ' + r.div.index + '  ' + classify(r.div).cls : 'agrees, ' + r.turns + ' turns'));
      }
    }
    ARM_RUNS.push({ arm, results: armResults, control: armControl,
                    credit: new Map(COV_CREDIT), kinds: new Map(CREDIT_KIND),
                    touched: new Set(COV_TOUCHED) });
    if (isPrimary) { results = armResults; control = armControl; }
  }
  /* THE CREDIT MAPS AFTER THE LAST ARM ARE THAT ARM'S, NOT THE RUN'S. The coverage report is a claim
   * about what the WHOLE run exercised, so the union is rebuilt here rather than read off whichever
   * arm happened to finish last — which would have been a silent, plausible, wrong number. */
  driverReset();
  for (const a of ARM_RUNS) {
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
const TURNS = results.map(r => r.turns).sort((a, b) => a - b);
const medianTurns = TURNS.length ? TURNS[Math.floor(TURNS.length / 2)] : 0;

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
console.log('    clicked but ALWAYS MISSED (the Mode A pin misses every sub-100-accuracy move): '
  + CLICKED_BUT_MISSED.size + ' moves');
console.log('');
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
  + ((SWITCH_LOOKUP_MISS.medi || SWITCH_LOOKUP_MISS.sd) ? '  <-- MUST READ 0. A miss means that side PASSED while the other switched.' : '  (must read 0)'));
console.log('    ' + MCKEY_MISSED + ' set(s) had no MC.mons row for their species'
  + (MCKEY_MISSED ? '  <-- expected: cosmetic formes only. An ordinary species here is a broken alias table.' : ''));
console.log('    ' + BAN_FALLBACKS + ' clicks where the configuration had banned every legal action (fell through, counted).');
console.log('    ' + FORCED_FIRST_SLOT + ' requests this driver could build no candidate for (a recharge or a lock) — answered `move 1`, counted.');
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
    planted_divergence_proof: PROOF, planted_divergence_proof_ok: PROOF_OK,
    /* THE HEADLINE RATE IS NOT READABLE WITHOUT THIS. Stated at the top level, not buried in
     * declared_gaps, because a reader who takes `diverged / games` and nothing else has taken a
     * number about a population it does not know the shape of.
     *
     * IT USED TO SAY "ZERO MEGA BODIES WERE TESTED". ROADMAP #31 closed that; what remains is the
     * SPREADS, which is a smaller and differently-shaped hole and is named rather than inherited. */
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
    /* THE STATE DIFFERENTIAL, in the same artifact as the protocol one so the two rates describe the
     * SAME games rather than two runs somebody has to hope were comparable. `null` when the run was
     * not asked for it, which is a different claim from zero. */
    state: STATE_SUMMARY,
    state_mode: STATE,
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
    first_divergences: diverged.slice(0, 60).map(r => ({
      config: r.config, seed: r.seed, index: r.div.index, agreed_lines: r.div.agreedLines,
      cls: r._cls.cls, cause: r._cls.cause, showdown: r.div.sdRaw, medicham: r.div.meRaw })),
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
      clicked_but_always_missed: [...CLICKED_BUT_MISSED.keys()].sort(),
      distinct_moves_connected: OBSERVED.moves.size, distinct_abilities: OBSERVED.abilities.size,
      distinct_items: OBSERVED.items.size, distinct_species: OBSERVED.species.size,
    },
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
