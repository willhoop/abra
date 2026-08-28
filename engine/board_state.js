/* board_state.js — THE BOARD, READ OUT OF BOTH ENGINES, COMPARED AT THE TURN BOUNDARY.
 *
 * WHY THIS EXISTS (Will, 2026-08-07): "I MEAN DO WE CARE ABOUT SEMANTICS? ALL WE CARE ABOUT IS HP/
 * STATUS, ITEMS, MONS ALIVE AT THE END OF THE TURN? ANNOUNCING IT DOESNT REALLY MATTER RIGHT?" —
 * then "AND STAT BOOSTS/ DROPS" and "AND FIELD CONDITIONS".
 *
 * `engine/game_differential.js` compares the PROTOCOL STREAM. It has no end-of-turn state comparison
 * in it at all: no HP, no status, no item, no boost, no alive-count, at any turn boundary. Ten wires
 * were aimed with it, and the tell is in its own data — the ten rungs moved the median first-divergence
 * LINE 13 -> 19 and never once moved the median TURN off 1, and the one rung that was purely about
 * announcement ORDER measured WORST of the last five. The instrument rewarded least the change that
 * mattered least.
 *
 * ================= THE TWO RULES THIS FILE IS BUILT ON ============================================
 *
 * 1. READ REAL STATE, NEVER NARRATION. Deriving a board from the protocol would reproduce the original
 *    bug one level down: if our stream omits an `-enditem`, a stream-derived board keeps the item and
 *    reports a divergence the ENGINES do not have. So medicham2 is read off its live bodies
 *    (`S.actA[i].curHP`, `.boosts`, `._sub`, `S.field.weatherT`, `S.sfA.sc`) and Showdown off its own
 *    (`battle.sides[i].active[j]`, `side.sideConditions`, `battle.field`). Neither engine's log is
 *    opened by this file.
 *
 * 2. WHERE THE BOUNDARY IS DECIDES WHAT IS MEASURED (Will, 2026-08-07, on Leftovers). The comparison
 *    point is AFTER THE ENTIRE RESIDUAL PHASE and before the next set of choices, because nearly
 *    everything interesting only touches the board there: Leftovers and Black Sludge, burn and poison
 *    chip and TOXIC'S ESCALATING STAGE, sand and hail, Leech Seed moving HP off two bodies at once,
 *    Aqua Ring and Grassy Terrain healing, the move-trap chip, Perish counting down, a Wish landing on
 *    a body that was not there when it was set, and EVERY screen / Tailwind / Trick Room / weather /
 *    terrain counter ticking. A boundary taken before them measures a board nobody ever plays from.
 *
 *    In medicham2 that point is the return of `battleTurn` (residuals, then `refill`). In Showdown it
 *    is after `battle.choose` for both sides AND after any forced switch has been answered. Both are
 *    the same instant: the board the next decision is made from.
 *
 * ================= COUNTERS ARE NOT OPTIONAL =====================================================
 *
 * Tailwind with 3 turns left is not Tailwind with 1, and a search that cannot tell them apart plans
 * the wrong turn. Every clock is compared as a number: weather, terrain, each screen, Tailwind, Trick
 * Room, the move-trap, Perish, Taunt, Encore, Disable, the toxic stage, the sleep counter AND THE
 * FREEZE COUNTER — the last added 2026-08-08, after Will asked whether there was one. There was not,
 * and the sentence above had named the other two for a day without anybody noticing the third was
 * missing. A field this file does not compare is a field NOTHING in the repository compares.
 *
 * ================= REPRESENTATION MAPPINGS, AND WHY EACH IS SAFE =================================
 *
 * Two engines can hold the SAME fact in different shapes, and collapsing that difference is the same
 * dangerous act as `game_differential.js`'s semantic equivalences — it can silence a real bug. So each
 * one is declared in `MAPPINGS` below with a red demonstration in both directions, run by
 * `mappingProof()` before any board is read. A mapping that collapses its `distinct` pair is a
 * SILENCER and the run says so.
 *
 * ================= WHAT IS DELIBERATELY NOT COMPARED, AND WHY ====================================
 *
 * Named here rather than left as an absence, because an absent field reads exactly like an agreeing
 * one. `NOT_COMPARED` is published with every artifact.
 */
'use strict';

const NOT_COMPARED = [
  { field: 'ability trapping (Shadow Tag / Arena Trap / Magnet Pull)',
    why: 'medicham2 STORES no trapped flag — it evaluates the tag against the foes on the field at the '
       + 'moment a switch is attempted (the `preventsSwitch` branch in battleTurn). Showdown stores '
       + '`pokemon.trapped`, computed when the request is built. A comparator would have to reimplement '
       + 'medicham2\'s rule to have anything to compare, and would then be checking its own belief '
       + 'against the authority rather than checking two engines. MOVE trapping IS compared — both '
       + 'engines hold it as state (medicham2 `_trap.turns`, Showdown `volatiles.partiallytrapped.'
       + 'duration`) — and it is the half that carries a counter and chip damage.',
    /* AND IT IS NOT UNMEASURED, WHICH IS A DIFFERENT SENTENCE AND HAD TO BE ADDED. The entry above
     * says why THIS FILE cannot compare it, and for two months that was read as "nothing compares
     * it" — the same shape as the PP entry that sat here on a reason three weeks out of date.
     *
     * `tests/roster.js` DOES compare it, and it does it the only way that is not a reimplementation:
     * IT ASKS BOTH ENGINES THE SAME QUESTION AT THE SAME MOMENT. Showdown answers by REJECTING the
     * switch choice; medicham2 answers by whether the slot changed hands. Neither engine's rule is
     * restated by the comparator. The row carries an in-game control (the identical ask one turn
     * earlier, before the mega, which must succeed in BOTH engines) and exception arms for the bodies
     * the authority lets leave, so an OVER-refusal fails exactly as an under-refusal does.
     *
     * THE POPULATION IS ONE ABILITY, DERIVED AND NOT REMEMBERED: Arena Trap and Magnet Pull have NO
     * legal carrier in this regulation, which `data/roster.abilities.json` states in their own rows.
     * Shadow Tag is the whole of ability trapping here. */
    measured_by: 'tests/roster.js (switchVerdict) — a REFUSAL comparison, not a board comparison',
    population: 'Shadow Tag only. Arena Trap and Magnet Pull have no legal carrier in this format; '
              + 'the roster says so per-entity rather than this file asserting it.',
    /* NO LEAF IN THE AUTHORITY'S VOCABULARY: Showdown holds this as `pokemon.trapped`, a boolean
     * recomputed when a request is built, and not as a volatile / side / slot / pseudo condition. */
    leaves: [] },
  /* ---- THE REASON ON THIS ROW WAS FALSE, AND IT IS CORRECTED HERE RATHER THAN DELETED (2026-08-28).
   * It read: *"medicham2 has no `lastItem` and no `ateBerry`: once an item is gone the body records
   * only that it is gone."* THE ENGINE HAS HELD BOTH SINCE ROADMAP #128. `consumeBerry` writes
   * `m._lastItem` and `m._ateBerry` on the same two lines (engine/medicham2-browser.js:8786-8787),
   * the per-turn reset deliberately does NOT clear them (:20425, "Harvest and Cud Chew are about what
   * the body spent, not about when"), and a berry-gated move's fix landed on that exact latch tonight.
   * The declaration outlived what it described, which is this repository's most expensive recurring
   * failure and the one `NOT_COMPARED` exists to prevent — so the row now says what is true today and
   * what would make the NEW reason wrong.
   *
   * A DECLARATION IS ONLY AS GOOD AS ITS MECHANISM. The mechanism is gone, so this is no longer a
   * justified omission: it is a CANDIDATE that has not been wired. It stays listed — an unlisted
   * omission reads as agreement — with the honest label. */
  { field: 'item DISPOSITION (eaten vs knocked off vs used) — `lastItem` / `ateBerry`',
    why: 'BOTH ENGINES HOLD IT AND NOTHING COMPARES IT. medicham2 writes `_lastItem` and `_ateBerry` '
       + 'in `consumeBerry` (medicham2-browser.js:8786-8787) and does not clear them at the turn reset '
       + '(:20425); Showdown writes `lastItem`/`ateBerry` in `eatItem` (sim/pokemon.ts:1805-1809) and '
       + '`lastItem` in `useItem` (:1846). THE TWO WRITE SITES LINE UP: `takeItem` (sim/pokemon.ts:'
       + '1856-1870, the Knock Off / Thief / Trick path) writes NEITHER field, which is the same '
       + 'narrowing medicham2 makes deliberately, so wiring this would NOT part every knocked-off item. '
       + 'The current item IS compared, which is the fact that changes damage and speed.',
    status: 'CANDIDATE — comparable, not compared. The reason it was left out no longer exists.',
    cost: 'it would part exactly the boards where the two engines disagree about eaten-vs-taken, which '
        + 'is a PUBLISHED finding rather than a hypothesis (data/game-differential.json '
        + 'knock_off_roadmap_80: Showdown records Colbur as EATEN BY ITSELF, medicham2 as KNOCKED OFF). '
        + 'So the expected effect is NOT zero and it must be measured before it is landed.',
    wrong_if: 'a path in either engine writes the field on a REMOVAL rather than on a consumption — '
        + 'then the two shapes diverge on bookkeeping and the leaf would manufacture divergences. '
        + 'Falsified by a staged Knock Off with both fields printed side by side.',
    read_by: 'Harvest, Recycle, Belch, Cud Chew and Unburden.',
    leaves: [] },
  /* PP WAS HERE AND IS NOW COMPARED. The entry read "medicham2 does not track PP at all", which was
   * true when it was written and stopped being true at ROADMAP #144 — the engine has held a full `_pp`
   * map, `ppMax`/`ppLeft`/`ppDeduct` and four counters since. The declaration outlived what it
   * described, which is this repository's most expensive recurring failure, and while it stood PP
   * could have been wrong in every game with nothing to notice. See the `pp-is-what-has-been-spent`
   * mapping for the lazy/eager difference, which is real and is declared rather than collapsed. */
  /* ---- THE 2026-08-12 SWEEP'S LEFTOVERS. NAMED, BECAUSE AN UNLISTED OMISSION READS AS AGREEMENT --
   * Nine per-body volatiles were added on this pass (aquaring, ingrain, magnetrise, focusenergy,
   * torment, imprison, saltcure, syrupbomb and the two-turn charge lock). These are the candidates
   * from the same sweep that were NOT wired, each with the reason it was not, because "we looked and
   * did not add it" and "we never looked" are different sentences and only one of them is honest. */
  { field: 'yawn, attract, curse (the Ghost form) and heal block',
    why: 'NOT A JUDGEMENT ABOUT THE ENGINES — a claim about the FIXTURE, which is a different thing '
       + '(Will has taught this twice). tests/probe_volatile_leaves.js staged each with a legal carrier '
       + 'and NEITHER engine produced the volatile: Yawn and Psychic Noise were aimed at a body whose '
       + 'ability or status refused them, Attract needs opposite genders that the staged pair did not '
       + 'have, and Curse writes no volatile at all on a non-Ghost user. medicham2 demonstrably HOLDS '
       + 'yawn (`_yawn`, `_vol.yawn`), attract (`_vol.attract`) and healblock (`_vol.healblock`), so '
       + 'the leaf is almost certainly comparable — it is left out because wiring a leaf whose two '
       + 'shapes have never been SEEN is how a comparator starts manufacturing divergences.',
    next: 'give probe_volatile_leaves.js a fixture that actually lands each one, then wire it',
    leaves: ['volatile:yawn', 'volatile:attract', 'volatile:curse', 'volatile:healblock'] },
  /* ROADMAP #308 -- THE SOURCE HALF OF A MOVE TRAP, and it is an omission rather than an oversight.
   * Showdown puts `trapped` on the victim AND `trapper` on whoever laid it; medicham2 keeps the
   * trapper INSIDE the victim's own `_trapHard` record and writes nothing on the source at all. The
   * VICTIM's half is compared (`vol.trapped`, wired this pass) and is the half that decides whether a
   * switch is legal. Comparing the source half would report a divergence on every trap in the game --
   * a manufactured one, off two representations of one fact. */
  { field: 'the TRAPPER mark a move trap leaves on its source (Showdown `volatiles.trapper`)',
    why: 'one fact, two shapes: medicham2 stores the trapper inside the VICTIM own `_trapHard` record '
       + 'and has no field on the source at all. The victim half (`trapped`) IS compared and is the '
       + 'half a switch decision reads.',
    leaves: ['volatile:trapper'] },
  /* ---- DESTINY BOND IS COMPARED NOW (2026-08-25), AND THE ROW BELOW IS THE RECORD OF WHY IT WAS
   * NOT. It is corrected here rather than deleted. It read:
   *
   *   *"ONE-SIDED IN THE PROBE AND THEREFORE A SUSPECT, NOT A LEAF. At the last boundary of a
   *   two-turn script medicham2 still held `_vol.destinybond = 1` after its user had moved again and
   *   Showdown held nothing ... Wiring it now would part every board carrying a Destiny Bond and
   *   present a possible ENGINE DEFECT as a comparison leaf. It is named here so it gets a probe of
   *   its own."* — `next:` *"a directed scenario: click Destiny Bond, then move again, and compare
   *   the two engines."*
   *
   * THAT WAS RIGHT ON EVERY POINT AND THE SUSPECT WAS GUILTY. The directed scenario it asked for is
   * `tests/probe_dbond_stall.js`, and it found three separate defects, not one: medicham2 never
   * removed the volatile when its user moved again, never failed a second Destiny Bond in a row, and
   * — the one that decides games — NEVER TOOK THE KILLER WITH IT. The volatile was written by the
   * generic applier and read by nothing in the file. All three are fixed in the same pass, and the
   * leaf is wired only after both engines were printed side by side and agreed. */
  /* ---- AND THE STALL COUNTER IS COMPARED NOW TOO. Its row read: *"medicham2 holds
   * `tookProtectTurns` (a count UP of consecutive successful shields) and Showdown holds a `stall`
   * volatile with a `counter` that is a DENOMINATOR (3, 9, 27). They are different quantities, not
   * two spellings of one, and a mapping between them would be this file inventing a rule. The SHIELD
   * itself is a within-turn effect and is not board state at the boundary."*
   *
   * THE FIRST SENTENCE IS TRUE AND THE CONCLUSION DOES NOT FOLLOW. The map is not invented here: it
   * is medicham2's own `stallBoardCounter`, whose constants come off `stallCounterChecks` and
   * therefore off the authority's `stall` condition. The last sentence is also true and is not an
   * argument for leaving the COUNTER out — the counter is exactly the part that survives to the
   * boundary and decides the NEXT turn's shield. See the `stall` leaf on `mediBody`. */
  { field: 'the DURATIONS on magnet rise and syrup bomb, and WHICH move a charge is committed to',
    why: 'the presence of all three IS compared. Showdown carries a clock on magnetrise and syrupbomb '
       + 'and medicham2 writes a bare 1, so comparing the numbers would part every board carrying one '
       + 'on the READER\'S representation rather than on a rule. The missing clock is a real gap in '
       + 'medicham2 and is stated here rather than absorbed into a `!!`. Likewise the two-turn lock: '
       + 'medicham2 names the move in `_charging` and Showdown in a separate volatile keyed by the '
       + 'move id, and a mismatch there would be a reader question.',
    /* THIS IS A NARROWING, NOT AN OMISSION: all three leaves ARE compared, as presence. The row
     * declares the PART of each that is not, which is why it names no leaf of its own. */
    leaves: [] },
  /* ---- THE BENCH SWEEP OF 2026-08-18. Same treatment as the volatile sweep above: the candidates
   * that were NOT wired are named with the reason, because "we looked and did not add it" and "we
   * never looked" are different sentences and only one of them is honest. */
  /* ---- THE BENCH VOLATILES ARE COMPARED NOW (2026-08-25). THE ROW BELOW IS THE RECORD OF WHY THEY
   * WERE NOT, AND IT IS CORRECTED HERE RATHER THAN DELETED. It read: *"NOT A JUDGEMENT ABOUT THE
   * ENGINES — a claim about the FIXTURE ... Over 2,029 benched bodies `tests/probe_bench_leaves.js`
   * never once saw ANY of the three non-empty in EITHER engine ... A leaf whose two shapes have never
   * been seen carrying anything is wired for free and catches nothing."*
   *
   * WILL, 2026-08-25: *"yeah the pokemon in the back need to be clean."*
   *
   * THE ARGUMENT WAS RIGHT ABOUT THE MEASUREMENT AND WRONG ABOUT WHAT TO DO WITH IT, and the
   * difference is which engine each half is a claim about. The authority's `clearVolatile`
   * (sim/pokemon.ts:1519-1566) sets `this.volatiles = {}` on the way out — EVERYTHING goes — after
   * calling `removeLinkedVolatiles` so a linked effect is unhooked from the OTHER body too. So
   * Showdown's half of this comparison is empty BY CONSTRUCTION rather than by luck, and comparing
   * against it is not "two shapes nobody has seen": it is the assertion that OUR bench is clean, with
   * the authority supplying the zero. There is no representation to get wrong.
   *
   * RE-MEASURED BEFORE WIRING, per this file's own rule and ENGINE's: `tests/probe_bench_leaves.js`
   * over 64 games / 803 boundaries / 3,211 benched bodies, every projected `vol` leaf compared and
   * printed — 0 differ, and 0 ever non-empty on either side. So this catches NOTHING TODAY and is
   * wired anyway, which is the opposite of the decision above and is said plainly: an uncompared leaf
   * is one whose regression reads as agreement, and medicham2 clears its bench FIELD BY FIELD in
   * `switchOut` rather than with one wipe — so the next volatile added to the engine is clean only if
   * somebody remembers to add a line, and this is what notices when nobody does.
   *
   * IT IS DEFENDED BY TWO PLANTS RATHER THAN BY THE ARGUMENT ABOVE — `engine/all_mechanics_fire.js
   * --red` puts a move TRAP and a SUBSTITUTE on a body that has walked to the bench and asserts both
   * are caught, on the leaf they were aimed at, with no protocol line.
   *
   * THE STANDING BODIES ARE EXCLUDED, and that is the one thing this needed care about. `sf.team` and
   * `side.pokemon` are the WHOLE party, actives included, so comparing `vol` there would report every
   * active-slot volatile difference a SECOND time under a party path — one finding read as two. A
   * party row therefore carries `vol: null` while its body is standing, and `walkBody` skips a null
   * leaf and COUNTS it (`party_vol_on_field_skipped`), so "not asked" can never read as "agreed". */
];

/* ---- THE MAPPINGS ------------------------------------------------------------------------------
 * Each is a claim that two shapes carry one fact. `equal` must collapse; `distinct` must NOT. */
const MAPPINGS = [
  { id: 'boost-key-names',
    why: 'medicham2 keys its stat stages at/df/sa/sd/sp/acc/eva and Showdown keys them '
       + 'atk/def/spa/spd/spe/accuracy/evasion. Same seven stages, same range, same meaning; only the '
       + 'spelling differs, and NO VALUE IS TOUCHED.',
    equal: [{ atk: 1 }, { atk: 1 }], distinct: [{ atk: 1 }, { atk: 2 }] },
  { id: 'species-id',
    why: 'medicham2 keys formes as data/engine-data.js does (`floette-eternal`) and Showdown as an id '
       + '(`floetteeternal`). Both are run through the project\'s own `names.id`, which strips '
       + 'non-alphanumerics and nothing else — so a DIFFERENT species can never normalise onto this one.',
    equal: ['floette-eternal', 'floetteeternal'], distinct: ['gengar', 'gengarmega'] },
  { id: 'hazard-presence-is-a-layer-count',
    why: 'Showdown holds Stealth Rock and Sticky Web as a side condition that is either there or not, '
       + 'and Spikes / Toxic Spikes as `layers`. medicham2 holds all four as an integer count in '
       + '`sf.hz`. Present is read as 1 and absent as 0, so the two are compared as NUMBERS OF LAYERS. '
       + 'This is deliberately NOT a presence test: medicham2 has a set path with no cap on it, so a '
       + 'second Stealth Rock reading 2 against Showdown\'s 1 is a divergence this instrument must '
       + 'report rather than round away.',
    equal: [1, 1], distinct: [1, 2] },
  { id: 'no-condition-is-zero',
    why: 'a clock that is not running is 0 in medicham2 (the key is deleted from `sf.sc`, or the field '
       + 'counter is 0) and is an ABSENT KEY in Showdown\'s `sideConditions` / `volatiles`. Absent is '
       + 'read as 0 on both sides. It cannot hide a running clock, because a running clock is >= 1 in '
       + 'both engines and 1 !== 0.',
    equal: [0, 0], distinct: [0, 1] },
  { id: 'weather-and-terrain-vocabulary',
    why: 'medicham2 names the sky `sun`/`rain`/`sand`/`snow` and Showdown names it after the MOVE — '
       + '`sunnyday`/`raindance`/`sandstorm`/`snowscape`. THE TRANSLATION IS NOT WRITTEN HERE. '
       + 'medicham2 already owns it (`SD2WEATHER`, `SD2TERRAIN`) and EXPORTS `weatherId` / `terrainId` '
       + 'for exactly this reason, so the instrument calls the engine\'s own function rather than '
       + 'keeping a second map that would eventually disagree with it (CLAUDE.md: facts are global). '
       + 'All 13 frozen releases export both. A translation that FAILS returns an empty string, which '
       + 'reads identically to "no weather" — so a non-empty input mapping to an empty output is '
       + 'counted and printed as `weather_untranslatable`, never swallowed.',
    equal: ['sandstorm', 'sand'], distinct: ['sandstorm', 'raindance'] },
  { id: 'fainted-is-not-a-status',
    why: 'Showdown marks a dead body by WRITING A STATUS — `pokemon.status = "fnt"` — and medicham2 '
       + 'marks it with `fainted: true` and leaves the status field alone. Same fact, two places, and '
       + 'left raw it reported `status "" vs "fnt"` on EVERY faint in the run, as a divergence on '
       + 'boards that otherwise agreed completely. So a fainted body reads `fnt` in both engines, '
       + 'derived from `fainted`, which is Showdown\'s own vocabulary. It cannot hide a body that is '
       + 'dead in one engine and alive in the other: that difference is carried by `fainted` (compared '
       + 'separately, and planted) AND by this field, because a LIVING body never reads `fnt`.',
    equal: [{ fainted: true, status: '' }, { fainted: true, status: 'fnt' }],
    distinct: [{ fainted: false, status: 'brn' }, { fainted: true, status: 'fnt' }] },
  /* WILL, 2026-08-08: *"do you have a freeze counter?"* — no, and nothing in this repository did.
   * `frz` appeared in this file exactly once, in STATUS_NAME, which is a display string. The engine
   * has held `frzTurns` since it was written (medicham2-browser.js, the `frz` gate in battleTurn) and
   * NO INSTRUMENT WOULD EVER HAVE SEEN IT DRIFT: the sleep counter was compared, the toxic stage was
   * compared, and the third counter beside them was not. Demonstrated rather than argued —
   * tests/staged_status_counters.js plants `frzTurns = 1` at the moment the status is written and,
   * before this mapping existed, the planted break was NOT CAUGHT on a board that compares 131 fields.
   *
   * AND THE QUANTITY IS FORMAT-SPECIFIC, so general Pokemon knowledge is the wrong source here.
   * `data/mods/champions/conditions.ts` OVERRIDES `frz`: `startTime = 3` at onStart and `time--` on
   * every move attempt, with an ADDITIONAL 1-in-4 thaw each attempt. Standard Gen 9 freeze has no
   * counter at all — it is a flat 1-in-5 per attempt — so a reader written from memory would have
   * compared a field the authority does not keep. TURNS ALREADY SPENT FROZEN is what both engines can
   * express: medicham2 counts UP in `frzTurns` and Showdown counts DOWN from `startTime`, exactly as
   * sleep does one row below, which is why it is the same function and not a second copy of it. */
  { id: 'freeze-counter-is-turns-frozen',
    why: 'medicham2 counts freeze UP (`frzTurns`, incremented as the body tries to move) and Showdown '
       + 'counts DOWN (`statusState.time` from a Champions-specific `startTime` of 3). TURNS ALREADY '
       + 'SPENT is the quantity both can express, so Showdown\'s is read as `startTime - time` — the '
       + 'SAME reader the sleep counter uses. It cannot hide a wrong freeze length: a body on its '
       + 'second frozen turn reads 2 in both engines whatever the timer was.',
    equal: [2, 2], distinct: [1, 2] },
  /* ---- PP: THE ONE PLACE THE TWO ENGINES HOLD THE SAME FACT IN GENUINELY DIFFERENT SHAPES --------
   *
   * OURS IS LAZY AND THEIRS IS EAGER. medicham2 derives a slot on FIRST TOUCH (`ppLeft`: `if (!(k in
   * t)) t[k] = ppMax(k)`), so a move nobody has clicked is ABSENT from `_pp`. Showdown builds every
   * `moveSlot` at construction with `pp` already equal to `maxpp`. Compared as PP REMAINING those two
   * shapes disagree on every untouched move on every body on every turn — which is not a finding, it
   * is two representations of "nothing has happened yet".
   *
   * SO THE QUANTITY IS WHAT HAS BEEN SPENT, WHICH IS 0 ON BOTH SIDES AT THE START. It is the same
   * collapse `no-condition-is-zero` makes, and it is safe for the same reason: a move that HAS been
   * spent is >= 1 in both engines and 1 !== 0. Spent is also exactly what Spite, Pressure and Leppa
   * Berry move, so the choice costs no mechanic.
   *
   * OUR SIDE IS READ THROUGH THE ENGINE'S OWN `ppSpentMap`, NOT RECONSTRUCTED HERE. The maximum is a
   * format fact (`floor(base * 0.8 + 4)`, and the mainline `pp * 8/5` rule is wrong on 415 of these
   * 500 moves), and a comparator that kept its own copy of it would eventually disagree with the
   * engine while both kept working — the two-copies-of-one-fact breach CLAUDE.md names. Nothing here
   * fills our number from Showdown's, which would be checking the authority against itself.
   *
   * KEYED BY MOVE ID AND NOT BY SLOT INDEX, for the reason `partyMap` is keyed by species: an index
   * is a position and a position is not a promise. Showdown rewrites `moveSlots` for Mimic and
   * Transform, and a move present in one engine and absent in the other must read as a DIFFERENCE
   * rather than silently line up against whatever sits at that index. */
  { id: 'pp-is-what-has-been-spent',
    why: 'medicham2\'s `_pp` is LAZY — a slot appears on first use, so an unclicked move is ABSENT — '
       + 'and Showdown\'s `moveSlots` are EAGER, so the same move is present and FULL. PP SPENT is the '
       + 'quantity both shapes can express: absent-and-untouched is 0 and full-and-untouched is 0. '
       + 'Ours is read through medicham2\'s own `ppSpentMap`, never reconstructed here and never '
       + 'filled in from Showdown\'s number. It cannot hide a real PP difference: a move that has '
       + 'been clicked once reads 1 in both engines and 1 !== 0, and a move spent by different '
       + 'amounts reads two different numbers.',
    equal: [{ tackle: 0 }, { tackle: 0 }], distinct: [{ tackle: 0 }, { tackle: 1 }] },
  /* ---- THE STALL COUNTER, 2026-08-25. TWO SHAPES OF ONE FACT, AND THE MAP IS THE AUTHORITY'S ----
   *
   * medicham2 counts consecutive successful shields UP (`tookProtectTurns`) and Showdown holds the
   * DENOMINATOR it rolls against (`volatiles.stall.counter`: 3, 9, 27 ...). The map between them is
   * not written here: it is `medicham2.stallBoardCounter`, the same function the engine uses to
   * decide whether a shield holds, whose three numbers come off `stallCounterChecks` and therefore
   * off `data/conditions.ts`'s `stall`. Calling it rather than copying it is what stops this file
   * checking its own belief about the decay against the authority.
   *
   * IT CANNOT HIDE A WRONG COUNTER, which is the only question a mapping has to answer: the map is
   * strictly increasing, so two different numbers of shields read as two different numbers on both
   * sides, and a body that has shielded once can never read the same as one that has shielded twice. */
  { id: 'stall-counter-is-the-denominator',
    why: 'medicham2 counts consecutive successful shields UP (`tookProtectTurns`) and Showdown holds '
       + 'the DENOMINATOR (`volatiles.stall.counter` — 3, 9, 27, capped at `counterMax`). The '
       + 'translation is medicham2 own `stallBoardCounter`, called through `ctx` and never copied '
       + 'here, and its three constants are read off `stallCounterChecks` which tag_dex derives from '
       + '`data/conditions.ts` `stall`. It cannot hide a real difference: the map is strictly '
       + 'increasing, so one shield reads 3 on both sides and two reads 9 on both, and 3 !== 9.',
    equal: [3, 3], distinct: [3, 9] },
  { id: 'sleep-counter-is-turns-slept',
    why: 'medicham2 counts sleep UP (`slpTurns`, incremented as the body tries to move) and Showdown '
       + 'counts DOWN (`statusState.time` from `startTime`). TURNS ALREADY SLEPT is the quantity both '
       + 'can express, so Showdown\'s is read as `startTime - time`. It cannot hide a wrong sleep '
       + 'length: a body that has slept two turns reads 2 in both engines whatever the duration was, '
       + 'and one that has slept one reads 1.',
    equal: [2, 2], distinct: [1, 2] },
];

/* THE RED DEMONSTRATION FOR EVERY MAPPING, run before any board is read. The mappings above are
 * claims about shapes rather than functions, so the proof exercises the CODE THAT APPLIES THEM —
 * `bumpBoost`, `id`, `layers`, `num`, `sleptTurns` — with the pair the mapping names. */
function mappingProof(N, M) {
  const idf = N.id;
  const out = [];
  const check = (mid, collapses, keeps) => out.push({ id: mid, collapses, keeps_meaning: keeps,
    why: (MAPPINGS.find(m => m.id === mid) || {}).why });
  /* boost keys */
  {
    const a = mediBoosts({ boosts: { at: 1, df: 0, sa: 0, sd: 0, sp: 0, acc: 0, eva: 0 } });
    const b = sdBoosts({ boosts: { atk: 1, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 } });
    const c = sdBoosts({ boosts: { atk: 2, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 } });
    check('boost-key-names', JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a) !== JSON.stringify(c));
  }
  check('species-id', idf('floette-eternal') === idf('floetteeternal'), idf('gengar') !== idf('gengarmega'));
  check('hazard-presence-is-a-layer-count', layers(true) === layers({ layers: 1 }) && layers(true) === 1,
        layers({ layers: 1 }) !== layers({ layers: 2 }));
  check('no-condition-is-zero', num(undefined) === num(0), num(undefined) !== num(1));
  /* THE ENGINE'S OWN TRANSLATION, exercised through the engine rather than restated. All four skies
   * and all four terrains, both directions, because a map with one wrong row would be invisible on a
   * one-row proof. */
  {
    const W = [['sandstorm', 'sand'], ['raindance', 'rain'], ['sunnyday', 'sun'], ['snowscape', 'snow']];
    const T = [['electricterrain', 'electric'], ['grassyterrain', 'grassy'],
               ['mistyterrain', 'misty'], ['psychicterrain', 'psychic']];
    const okW = W.every(([sd, me]) => M.weatherId(sd) === me) && T.every(([sd, me]) => M.terrainId(sd) === me);
    /* it must not COLLAPSE two skies onto one */
    const distinctW = new Set(W.map(([sd]) => M.weatherId(sd))).size === W.length
                   && new Set(T.map(([sd]) => M.terrainId(sd))).size === T.length;
    check('weather-and-terrain-vocabulary', okW, distinctW);
  }
  check('fainted-is-not-a-status', statusOf(true, '') === statusOf(true, 'fnt'),
        statusOf(false, 'brn') !== statusOf(true, 'fnt'));
  /* THE STALL MAP, EXERCISED THROUGH THE ENGINE'S OWN FUNCTION rather than through a restatement of
   * it — the same rule the weather block above follows. COLLAPSES: one successful shield reads 3 on
   * both sides, and no shield reads 0 on both. KEEPS MEANING: one shield and two shields must NOT
   * come out the same, which is the only way this map could silence a real counter difference.
   * A release that cannot express it answers `null` and the check says NOT AVAILABLE rather than
   * passing on an absence. */
  {
    const f = M.stallBoardCounter;
    if (!f) out.push({ id: 'stall-counter-is-the-denominator', collapses: null, keeps_meaning: null,
                       why: 'this engine does not export stallBoardCounter — the leaf is skipped, not compared' });
    else check('stall-counter-is-the-denominator', f(1) === 3 && f(0) === 0, f(1) !== f(2));
  }
  /* THE PP MAPPING, EXERCISED IN BOTH DIRECTIONS THROUGH THE CODE THAT APPLIES IT.
   *
   * COLLAPSES: a body that has clicked nothing. Our lazy table is EMPTY and Showdown's eager slots are
   * FULL, and the two must come out the same — that is the whole claim, and it is asked of `sdPP` and
   * of the engine's own `ppSpentMap` rather than of a restatement of them.
   *
   * KEEPS MEANING, AND IT IS ASKED TWICE BECAUSE THERE ARE TWO WAYS TO SILENCE THIS ONE. A move spent
   * once must not read the same as a move spent none (the ordinary direction), AND a move PRESENT in
   * one engine must not read the same as one absent from the other — the failure a slot-index
   * comparison would have. Both are demonstrated below; a mapping that collapsed either would be a
   * SILENCER and is the reason this file makes its proofs run before any board is read. */
  {
    /* THE MAXIMA ARE DERIVED FROM THE ENGINE, NOT TYPED — and the first version of this proof typed
     * `tackle` at 56 and went RED, correctly: Tackle has no `pp` row in this regulation at all, so our
     * map skips it and Showdown's slot carries it. The proof caught the FIXTURE, which is what it is
     * for. Two moves that really are in this format, at whatever this format says they hold. */
    const MV = ['protect', 'dragonpulse'];
    const mx = M.ppMax ? MV.map(k => M.ppMax(k)) : [null, null];
    const slots = (spend) => ({ moveSlots: MV.map((k, i) => ({ id: k, pp: mx[i] - (spend[i] || 0), maxpp: mx[i] })) });
    const ok = mx.every(v => v != null);
    /* COLLAPSES: our EMPTY lazy table against Showdown's FULL eager slots — both must read 0 spent. */
    const ourFull = (ok && M.ppSpentMap) ? M.ppSpentMap({ moves: MV.slice(), _pp: {} }) : null;
    const eq = !!ourFull && JSON.stringify(ourFull) === JSON.stringify(sdPP(slots([0, 0])));
    /* KEEPS MEANING, TWICE: one PP spent must not read as none, AND a move MISSING from one side must
     * not read as a move present at 0 — the failure a slot-index comparison would have. */
    const keeps = ok
      && JSON.stringify(sdPP(slots([0, 0]))) !== JSON.stringify(sdPP(slots([1, 0])))
      && JSON.stringify(sdPP(slots([0, 0])))
         !== JSON.stringify(sdPP({ moveSlots: [{ id: MV[0], pp: mx[0], maxpp: mx[0] }] }));
    check('pp-is-what-has-been-spent', eq, keeps);
  }
  check('sleep-counter-is-turns-slept', sleptTurns({ startTime: 3, time: 1 }) === 2,
        sleptTurns({ startTime: 3, time: 2 }) !== sleptTurns({ startTime: 3, time: 1 }));
  /* The Champions freeze timer, at its own numbers rather than sleep's: startTime is 3 by the format's
   * own override, so a body on its second frozen turn reads `3 - 1`. Exercised through the same
   * function both engines' readers call, so the proof cannot pass while the reader diverges. */
  check('freeze-counter-is-turns-frozen', frozenTurns({ startTime: 3, time: 1 }) === 2,
        frozenTurns({ startTime: 3, time: 3 }) !== frozenTurns({ startTime: 3, time: 1 }));
  return out;
}

/* ---- SMALL READERS, ONE EACH, SO A MAPPING HAS ONE IMPLEMENTATION ------------------------------ */
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
const layers = c => (!c ? 0 : (typeof c === 'object' && typeof c.layers === 'number' ? c.layers : 1));
const dur = c => (!c ? 0 : num(c.duration));
const sleptTurns = ss => (!ss ? 0 : Math.max(0, num(ss.startTime) - num(ss.time)));
/* ONE FUNCTION, TWO STATUSES, AND THE ALIAS IS FOR THE READER RATHER THAN FOR THE MACHINE. Sleep and
 * the Champions freeze are both "a startTime counted down", so a second implementation would be the
 * two-copies-of-one-fact breach CLAUDE.md names; a second NAME costs nothing and keeps `frz` from
 * reading as a sleep bug at the call site. */
const frozenTurns = sleptTurns;
/* ONE FUNCTION FOR BOTH ENGINES — see the `fainted-is-not-a-status` mapping. A dead body reads `fnt`
 * whichever engine holds it; a living one reads whatever status it actually carries. */
const statusOf = (fainted, status) => (fainted ? 'fnt' : String(status || ''));
/* SHOWDOWN'S PP, AS SPENT. `maxpp - pp` per slot, keyed by move id. A slot with no id is skipped
 * rather than keyed under the empty string, which would collapse two of them together. */
function sdPP(p) {
  const out = {};
  for (const s of ((p && p.moveSlots) || [])) {
    const k = String((s && s.id) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!k) continue;
    out[k] = Math.max(0, num(s.maxpp) - num(s.pp));
  }
  return out;
}
function mediBoosts(m) {
  const b = (m && m.boosts) || {};
  return { atk: num(b.at), def: num(b.df), spa: num(b.sa), spd: num(b.sd), spe: num(b.sp),
           accuracy: num(b.acc), evasion: num(b.eva) };
}
function sdBoosts(p) {
  const b = (p && p.boosts) || {};
  return { atk: num(b.atk), def: num(b.def), spa: num(b.spa), spd: num(b.spd), spe: num(b.spe),
           accuracy: num(b.accuracy), evasion: num(b.evasion) };
}

/* ---- THE SHAPE OF THE SCREENS, AND THE ONE PLACE THIS FILE HAS TO KNOW TWO ENGINE VERSIONS ------
 *
 * ROADMAP #81 WIRE 8 replaced medicham2's two CATEGORY counters (`sf.scrP` / `sf.scrS`, keyed by
 * damage category) with NAMED conditions (`sf.sc.reflect` etc.). The release ladder replays ten frozen
 * engines and FIVE of them predate that change, so a reader that only knew `sf.sc` would report every
 * pre-WIRE-8 screen as absent — which would look exactly like the wires fixing screens and would
 * MANUFACTURE the rising ladder this instrument exists to test for.
 *
 * So the comparison is on the PROJECTION both shapes can express: physical-side turns and
 * special-side turns. Aurora Veil counts in both, which is what it does. The projection is lossy in
 * exactly one place — Reflect + Light Screen up together is indistinguishable from Aurora Veil — so
 * the NAMED conditions are compared as well, and reported apart, whenever the engine can express
 * them. Which shape each engine had is recorded on every snapshot and printed with the run: a reader
 * that silently fell back would be the silent default this project keeps finding.
 */
/* THE DECLARED BLOCK conformance.js S12 asks for, and it is a REPRESENTATION BRIDGE rather than a
 * mechanic. Every other name in this repo should be derived from the artifact; these cannot be, and
 * the reason is specific rather than general:
 *
 * A COMPARATOR MUST NAME BOTH REPRESENTATIONS IT IS RECONCILING. medicham2 holds screens as CATEGORY
 * counters (`sf.scrP` / `sf.scrS`) before WIRE 8 and as NAMED conditions (`sf.sc.reflect`) after it;
 * Showdown holds them as named `sideConditions` always. Mapping one onto the other is exactly the
 * knowledge "which names are physical, which are special, and which is both" — so deriving the list
 * from tags would not remove the naming, it would move it somewhere the ladder cannot see it. Aurora
 * Veil being in BOTH sets is the whole content of the bridge.
 *
 * Tailwind and Trick Room are here for the same reason one level down: they are SLOTS IN THE BOARD
 * SCHEMA this file compares, read out of `sd.sideConditions` and `F.pseudoWeather` by their upstream
 * keys. The key is Showdown's spelling, not our choice, and a comparator that invented its own name
 * for it would compare nothing.
 *
 * WHAT THIS BLOCK IS NOT: a licence to decide behaviour by name. Nothing below asks whether a screen
 * HALVES anything, when it expires, or whether a move sets it — those are the engine's business and
 * the engine derives them from tags. This file only reads state and says whether two boards match. */
const GAME_RULES = {
  PHYSICAL_SCREENS: new Set(['reflect', 'auroraveil']),
  SPECIAL_SCREENS: new Set(['lightscreen', 'auroraveil']),
  /* the order the named comparison walks, and the keys both engines spell the same */
  /* ROADMAP #210 -- `safeguard` ADDED 2026-08-11, AND IT WAS A COMPARATOR DEFECT ACCUSING THE ENGINE.
   *
   * `mediScreens` walks `Object.keys(sf.sc)` -- every key our engine wrote -- and `sdScreens` walked
   * THIS FIXED LIST. So any condition our side could hold and this list did not name read as
   * `present-in-one-engine-only` whatever the authority had actually done, and the deliberate roster
   * duly reported Safeguard as an engine defect: "SHOWDOWN null / OURS 4 turns", on all four
   * boundaries. Staged directly against the official simulator, Showdown's p2 carried
   * `safeguard {duration: 4}` the whole time. The engine was right and the reader was blind.
   *
   * THE LIST IS THE KEYS `sf.sc` CAN HOLD, and that is derived rather than a preference: medicham2
   * writes this map from exactly two branches -- `kind: 'screen'`, keyed by the MOVE ID of a
   * `halvesDamage` move, and `kind: 'sidebuff'`, keyed by the tag's own `sideCondition`. Asked of the
   * format rather than remembered, ELEVEN side conditions exist across the 500 legal moves --
   * auroraveil, lightscreen, quickguard, reflect, safeguard, spikes, stealthrock, stickyweb, tailwind,
   * toxicspikes, wideguard -- and the other seven are held SOMEWHERE ELSE on our side: tailwind in
   * `field.twA/twB` (compared as SIDE_SLOTS), the two guards in `field.sgA/sgB`, the four hazards in
   * their own store. Naming one of those here would manufacture the mirror image of the bug this line
   * fixes, so the rule is "what `sf.sc` can hold", not "what Showdown can hold". */
  SCREEN_KEYS: ['reflect', 'lightscreen', 'auroraveil', 'safeguard'],
  SIDE_SLOTS: ['tailwind'],
  FIELD_SLOTS: ['trickroom'],
};
const PHYSICAL_SCREENS = GAME_RULES.PHYSICAL_SCREENS;
const SPECIAL_SCREENS = GAME_RULES.SPECIAL_SCREENS;

function mediScreens(sf) {
  if (sf && sf.sc && typeof sf.sc === 'object') {
    const named = {};
    let phys = 0, spec = 0;
    for (const k of Object.keys(sf.sc)) {
      const t = num(sf.sc[k]);
      if (t <= 0) continue;
      named[k] = t;
      if (PHYSICAL_SCREENS.has(k)) phys = Math.max(phys, t);
      if (SPECIAL_SCREENS.has(k)) spec = Math.max(spec, t);
    }
    return { shape: 'named', named, physical: phys, special: spec };
  }
  /* pre-WIRE-8: two category counters, and the NAMES are genuinely not recoverable from them */
  return { shape: 'category-counters', named: null,
           physical: num(sf && sf.scrP), special: num(sf && sf.scrS) };
}
function sdScreens(side) {
  const sc = side.sideConditions || {};
  const named = {};
  let phys = 0, spec = 0;
  for (const k of GAME_RULES.SCREEN_KEYS) {
    const t = dur(sc[k]);
    if (t <= 0) continue;
    named[k] = t;
    if (PHYSICAL_SCREENS.has(k)) phys = Math.max(phys, t);
    if (SPECIAL_SCREENS.has(k)) spec = Math.max(spec, t);
  }
  return { shape: 'named', named, physical: phys, special: spec };
}

/* ---- THE PARTY, KEYED BY SPECIES AND NOT BY INDEX ----------------------------------------------
 *
 * THE FIRST VERSION OF THIS COMPARED BY INDEX AND WAS WRONG, and it is written down because it is the
 * exact failure this division is warned about: a probe wrong before the engine is, failing toward a
 * comfortable answer. medicham2's `sf.team` is stamped once in battleInit and never reordered.
 * SHOWDOWN'S `side.pokemon` IS REORDERED ON EVERY SWITCH-IN — the entering body is swapped into the
 * active slot's position (measured: `amoonguss,torkoal,garchomp,grimmsnarl` becomes
 * `garchomp,torkoal,amoonguss,grimmsnarl` after one switch). Index-matching therefore compared two
 * DIFFERENT Pokemon's HP the moment anybody pivoted, and it reported 123 of 179 games as diverging on
 * `party.species` — a manufactured divergence larger than anything real in the run.
 *
 * Keyed by species instead. Species Clause makes that unique in this format; a team that breaks it is
 * COUNTED as a harness fault rather than silently collapsing two bodies into one row. */
/* ---- WHAT A BENCHED BODY IS COMPARED ON — WIDENED 2026-08-18, AND MEASURED FIRST ----------------
 *
 * This map held `{hp, maxhp, fainted}` and NOTHING ELSE, so a benched body's item, status, typing and
 * boosts were compared by nothing in this repository and a divergence in one of them read as
 * AGREEMENT. `tests/test-end-state.js` PART 3 had to REJECT a candidate pair whose planted body
 * walked to the bench, in its own words *"a planted item difference on a body that has walked to the
 * bench is not compared by anything in this repository"* — three of five candidates were rejected on
 * exactly that.
 *
 * THE LEAVES WERE PRINTED BEFORE THEY WERE WIRED, per ENGINE's standing rule, by
 * `tests/probe_bench_leaves.js` — and THE FIRST RUN WOULD HAVE WIRED A DISAGREEMENT. On 4 games /
 * 156 benched bodies `item` read AGREES EVERYWHERE. On 42 games / 2,029 bodies it disagrees twice.
 * The comfortable answer was the small sample's.
 *
 * Over 2,029 comparisons (1,761 of them on a body that had NOT fainted):
 *
 *     types            0 differ of 2,029, non-empty every time  -> wired unconditionally
 *     item             0 differ of 1,761 living, 2 on a fainted body
 *     status           0 differ of 1,761 living, 9 on a fainted body
 *     status_counter   0 differ of 2,029
 *     boosts           0 differ of 1,761 living, 28 on a fainted body
 *     ability          3 differ ON A LIVING BENCHED BODY   -> NOT WIRED, see NOT_COMPARED
 *     volatiles/sub/seeded   never once non-empty  -> NOT WIRED, see NOT_COMPARED
 *
 * EVERY DISAGREEMENT EXCEPT ABILITY'S IS ON A BODY THAT HAS FAINTED, AND IT IS THE AUTHORITY DOING
 * HOUSEKEEPING RATHER THAN EITHER ENGINE PLAYING A RULE. Read, not remembered:
 * `sim/battle.ts:2560` runs `pokemon.clearVolatile(false)` inside `faintMessages`, and
 * `sim/pokemon.ts:1515-1541` is what that clears — the seven boost stages and every volatile;
 * `sim/battle-actions.ts:126` then runs `if (oldActive.fainted) oldActive.status = ''` when the
 * corpse is replaced. medicham2 keeps all of it on a dead body. Comparing there would part boards on
 * the READER'S bookkeeping, which is the manufactured divergence this function's own header records
 * paying for once already (index-keying, 123 of 179 games).
 *
 * So the POST-FAINT GROUP is compared only where BOTH engines say the body is standing — the same
 * rule, and the same reason, as `screens.named` and `pp` in `compare()`. It is SKIPPED LOUDLY:
 * `party_post_faint_skipped` rides on every snapshot, so "not asked" can never be read as "agreed".
 * `status` is NOT in that group because `statusOf` already answers `fnt` for a fainted body in both
 * engines (the `fainted-is-not-a-status` mapping), which is why the probe — reading `m.status` raw —
 * saw a difference this comparator cannot. */
/* `ability` JOINED THE POST-FAINT GROUP ON 2026-08-19, WITH ROADMAP #307, and the reason is the same
 * housekeeping as the other three: `faintMessages` runs `clearVolatile(false)` (`sim/battle.ts:2560`),
 * whose `this.ability = this.baseAbility` (`sim/pokemon.ts:1528`) restores a CORPSE's ability too, and
 * `sim/battle.ts:2558` re-reads `baseAbility` off the SET first on a forme regression. medicham2 keeps
 * whatever the body was holding when it died.
 *
 * THE LEAF ITSELF WAS THE ONE THIS FILE REFUSED TO WIRE, and it is wired now because the DEFECT is
 * fixed rather than because the standard moved. Measured on 64 games / 3,280 benched comparisons, the
 * same population both ways: with medicham2's switch-out restore ABSENT the leaf differs 7 times, all
 * 7 on a LIVING body (a Gardevoir still wearing a traced Flower Veil, a Rotom-Heat still wearing a
 * Plus it had been given); with it present, 0 of 3,280, non-empty every time. */
/* ---- THE GROUP IS ONE GROUP AND IT IS HELD IN EVERY PLACE A BODY IS COMPARED (2026-08-20, MEASURE)
 *
 * IT WAS HELD ON THE BENCH AND NOT ON THE ACTIVE SLOT, AND THAT INFLATED THIS INSTRUMENT'S OWN
 * HEADLINE. `compare()` ran `walkParty` for the party and a bare `walk(A.active, …)` for the field, so
 * a corpse standing in the active slot kept its boosts, its volatiles and its spent PP on one side of
 * the comparison and lost them on the other — the authority's `clearVolatile` against medicham2
 * keeping everything. Measured on the 797-game end-state run (`data/verification/endstate-by-cause.
 * json`, release `94a84744346d`): **52 differing leaves sat on a body BOTH engines call dead, and 7 of
 * the 92 different-end-board games were nothing else** — 7.6% of the number that is now the
 * most-quoted figure in the project, contributed by the reader.
 *
 * WHICH WAY THEY AGREE, AND WHY THAT DIRECTION. Skip, both sides. A dead body's stat stages, volatiles
 * and remaining PP are not state anybody can act on — nothing will ever read them again — while the
 * authority's housekeeping on them is real and unilateral. Comparing them measures the READER, which
 * is the manufactured divergence `walkParty`'s own header records paying for once already (index
 * keying, 123 of 179 games). Unskipping the bench instead would have re-imported 28 boost differences
 * that were already measured as housekeeping.
 *
 * THE GROUP IS DERIVED FROM WHAT THE AUTHORITY REWRITES ON A FAINT, READ AND CITED, NEVER RECALLED:
 *   sim/battle.ts:2560          `faintMessages` calls `pokemon.clearVolatile(false)` on the corpse
 *   sim/pokemon.ts:1515-1523    all seven boost stages are zeroed          -> `boosts`
 *   sim/pokemon.ts:1525         `moveSlots = baseMoveSlots.slice()`        -> `pp` (we compare SPENT)
 *   sim/pokemon.ts:1528         `ability = baseAbility`                    -> `ability`
 *   sim/pokemon.ts:1540         `volatiles = {}`                           -> `vol`
 *   sim/battle-actions.ts:126   `if (oldActive.fainted) oldActive.status = ''` on replacement, which
 *                               takes `statusState` with it                -> `status_counter`
 * `item` is not on that list and is in the group anyway: it was put there by MEASUREMENT (2 of 2,029
 * benched bodies differ, both dead) rather than by derivation, and taking it out to tidy the
 * derivation would be a second change wearing this one's clothes.
 *
 * `species`, `maxhp` AND `types` ARE **NOT** IN THE GROUP AND STILL PART BOARDS ON CORPSES, which is a
 * FINDING and not an omission: `sim/battle.ts:2554-2557` and `:2568-2571` regress a fainted mega's
 * forme (`baseSpecies` off the SET, then `updateMaxHp()`), and medicham2 does not. That is 3 species,
 * 2 maxhp and 2 types of the 52 above. It is reported rather than skipped, because a body arriving as
 * a different Pokemon is the one thing on a corpse a later board can still be wrong about.
 *
 * THE NEW HOLD IS SCOPED TO A CROSS-ENGINE PAIR, AND THAT IS A DELIBERATE LIMIT RATHER THAN A HEDGE.
 * The whole justification above is that the TWO ENGINES keep house differently, so it is a claim about
 * a medicham2-vs-Showdown board. `tests/roster.js` and the differential's own turn-to-turn coverage
 * credit call `compare()` with two boards from the SAME engine, where no reader mismatch exists —
 * `changedFamilies` asks "what moved this turn" and a held leaf is signal it does not get.
 *
 * AND MOVING THEM WOULD HAVE BROKEN THE MEASUREMENT THIS CHANGE EXISTS TO CORRECT. The swarm's game
 * selection is STEERED by that credit, so a comparator that reports different leaves to it plays
 * different games — and the corrected different-board count would then be a number about another
 * sample, which is the "same predicate, different games" failure `engine/gate_fail_and_silent.js`
 * records paying for (3 causes -> 30, entirely the sample). One change at a time, attributable.
 *
 * SO THE PARTY'S EXISTING BEHAVIOUR IS UNTOUCHED FOR EVERYONE — it holds on a same-engine pair exactly
 * as it has since 2026-08-18 — and only the two paths being brought into line with it are scoped. The
 * remaining asymmetry is therefore between CALLERS and not between LEAVES, it is declared here, and it
 * is COUNTED: `post_faint_not_held_same_engine` rides on every snapshot beside the three skip counters,
 * so a same-engine caller can never read "the rule did not apply" as "there was nothing to hold".
 * Whether the party should also stop holding for those callers is a SEPARATE change with its own
 * before/after cost, and it is not smuggled in here. */
/* `stall` JOINS THE GROUP 2026-08-25 for the identical reason `vol` is in it: `faintMessages` runs
 * `clearVolatile(false)` on the corpse, which drops the `stall` volatile, and medicham2 leaves
 * `tookProtectTurns` on the body it died with. Comparing a dead body's counter measures the reader. */
const POST_FAINT = ['item', 'status_counter', 'boosts', 'ability', 'vol', 'stall'];
/* THE BENCH ROW CARRIES `vol` SINCE 2026-08-25, so the party's group uses that entry too — and it is
 * the right rule there for the same reason it is on the active slot: `faintMessages` runs
 * `clearVolatile(false)` on the corpse (sim/battle.ts:2560) and medicham2 keeps whatever the body was
 * holding when it died, so comparing a dead body's volatiles measures the reader. One list, because
 * it is one rule. */
const PARTY_POST_FAINT = POST_FAINT;
/* ================== WHICH BODY OF THE ROSTER IS THIS — ONE DOOR, BOTH ENGINES ==================
 *
 *   stableKey(x, id, note)  -> 'morpeko'  for a medicham2 body OR a showdown Pokemon, renamed or not
 *
 * MOVED HERE FROM `game_differential.js` ON 2026-08-26 AND NOT COPIED. It was `rosterKey` there and
 * that instrument still calls it under that name; this file needed the same answer to key the party
 * (ROADMAP #465), and a second implementation of "which of the four bodies is this" is the
 * two-copies-of-one-fact breach CLAUDE.md names — the more so because this exact question is the
 * FIFTH instance of the species-key class and the previous four were all one file re-deriving what
 * another file already knew.
 *
 * THE QUESTION IS "WHICH OF THE FOUR BODIES THIS SIDE BROUGHT", AND IT IS NOT "WHAT IS THIS CALLED".
 * The two agree for an ordinary body and stop agreeing the moment something renames one, which in
 * this format is seven abilities: Disguise, Forecast, Hunger Switch, Illusion, Imposter, Stance
 * Change and Zero to Hero. The full derivation — including why `baseSpecies` is NOT stable through a
 * mega, measured — is in `game_differential.js`'s `rosterKey` header, which is where the run that
 * settled it is recorded. `tests/test-roster-identity.js` drives THIS function through that name.
 *
 * `id` IS PASSED IN RATHER THAN IMPORTED, exactly as it is for `readMedi`/`readShowdown`: the name
 * normaliser is the caller's, and a copy of it here would be the same breach one level down.
 *
 * A FALLBACK IS LOUD, NEVER SILENT, AND `note` IS A CALLBACK RATHER THAN A COUNTER OBJECT. Two
 * callers keep the tally in two different places — `game_differential.js` in `ROSTER_KEY_FALLBACK`,
 * which it prints and asserts at 0, and the readers below in `ctx.fails`, which every caller already
 * publishes as `reader_failures`. Handing this function a shared object shape would have made one of
 * those two a private counter nobody reads, which is the silent-default failure wearing a receipt. */
function stableKey(x, id, note) {
  const say = (kind, detail) => { if (typeof note === 'function') note(kind, detail); };
  if (!x) return null;
  /* showdown first: a Pokemon also carries `.name` (its nickname), so testing the medicham branch
   * first would read a nickname for every authority body. */
  if (x.set && (x.set.species || x.set.name)) return id(x.set.species || x.set.name);
  if (x._switchKey) return id(x._switchKey);
  if (x.baseSpecies && x.baseSpecies.id) {
    say('sd_species', 'showdown body with no set: ' + id(x.baseSpecies.id));
    return id(x.baseSpecies.id);
  }
  if (x.species && x.species.id) {
    say('sd_species', 'showdown body with no set: ' + id(x.species.id));
    return id(x.species.id);
  }
  if (x.name) {
    say('medi_name', 'medicham body with no _switchKey: ' + id(x.name));
    return id(x.name);
  }
  say('neither', 'an object that is neither engine\'s body');
  return null;
}
/* THE READERS' OWN TALLY, written into the failure object the caller already prints. Built per read
 * rather than module-scoped so two concurrently-open readers cannot share a counter. */
const keyNote = (fails) => (kind, detail) => {
  if (!fails) return;
  const k = 'stable_key_fallback_' + kind;
  fails[k] = (fails[k] || 0) + 1;
  fails.stable_key_fallback_first = fails.stable_key_fallback_first || detail;
};

/* THE PROJECTION OF A FULL BODY ONTO A BENCH ROW. Deliberately built FROM `mediBody`/`sdBody` rather
 * than by re-reading the engines here: `statusOf`, the boost key mapping and `getTypes()` are FACTS,
 * and a second copy of any of them in this file is the two-implementations breach CLAUDE.md names. */
function benchRow(b, onField, key) {
  if (!b) return null;
  return { species: b.species,
           /* THE STABLE IDENTITY OF THE BODY, carried BESIDE the displayed species and never instead
            * of it. It is read off the raw engine object by `stableKey` (the caller has it; this
            * projection does not), it is consumed by `partyMap` alone, and `compare()` never walks it
            * because `partyMap` drops it — so it cannot become a compared leaf by accident. */
           key,
           hp: b.hp, maxhp: b.maxhp, fainted: b.fainted, status: b.status,
           types: b.types, item: b.item, status_counter: b.status_counter, boosts: b.boosts,
           ability: b.ability,
           /* THE STALL COUNTER TRAVELS TO THE BENCH TOO, and on the same rule as the bench volatiles
            * beside it: `clearVolatile` empties the whole table on the way off the field, so the
            * authority's answer there is 0 BY CONSTRUCTION, and medicham2 clears `tookProtectTurns`
            * field by field in `switchOut` -- which is clean only while somebody remembers the line.
            * A row left off here would compare `undefined` against `undefined` and read as agreement.
            *
            * AND IT IS `null` WHILE THE BODY IS STANDING, exactly as `vol` is one line down: `sf.team`
            * is the WHOLE party, actives included, so a standing body's stall counter would otherwise
            * be reported a SECOND time under a party path and one finding would read as two. */
           stall: onField ? null : b.stall,
           /* `null` means "this body is STANDING, so the active slot is the place to ask" — never
            * "it is carrying nothing". `walkBody` skips a null leaf and counts the skip. */
           vol: onField ? null : b.vol };
}
/* ---- ROADMAP #465 — THE PARTY IS KEYED ON THE BODY, NOT ON ITS NAME. LANDED 2026-08-26 ----------
 *
 * WHAT THE DISPLAY KEY COST, measured rather than argued: `duplicate_species_in_party` read 20 on
 * every pinned 961-game run and nothing acted on it. A transformed body takes the NAME of the body it
 * copied, so two rows collide and the second overwrites the first — the survivor carrying whichever
 * body `sf.team`/`side.pokemon` happened to list last. On the pinned pool that was one of the two
 * remaining board-parted games: a Ditto that had copied a Garchomp (Life Orb, maxhp 123) landed on
 * the real Garchomp's row (Choice Scarf, maxhp 183) and the two engines then reported a party leaf
 * that describes different Pokemon in each of them.
 *
 * IT WAS HELD BEHIND A KNOB FOR ONE DAY BECAUSE THE RE-KEY MOVES THE MEASUREMENT, NOT ONLY THE
 * ANSWER. `game_differential.js` credits census coverage off `BS.compare(prev, cur)` bucketed by
 * `BS.family(path)`, and the driver then steers every later click toward the least-credited row. A
 * transform reported as `party.MISSING-OR-EXTRA-MEMBER` and a transform reported as `party.species`
 * plus `party.maxhp` are different credit, so the sample moves: **109 of 961 trajectories differ**
 * across the two keyings, against a control of 0 of 961 between two identical runs. That is why
 * landing it came with a RE-BASELINE and not with a delta — `docs/ENGINE.md`, and #465's closing row.
 *
 * THE KNOB IS NOW THE POSITIVE CONTROL AND IT RESTORES THE OLD, WRONG KEYING. `MEDI_PARTY_KEY_DISPLAY=1`
 * puts the party back on the displayed species so a probe can MEASURE the collision rather than
 * assert it. It is not a fallback and nothing selects it automatically: identity is what every
 * unattended run gets. Setting the retired `MEDI_PARTY_KEY_IDENTITY` is a NO-OP and says so out loud
 * — a retired knob that silently does nothing is how a run gets attributed to an arm it never took.
 *
 * SPECIES IS A COMPARED LEAF UNDER THE IDENTITY KEY, and it must be: under the display key the
 * species IS the key, so a body whose name changed in one engine and not the other was reported as a
 * missing member. Under the identity key the row survives the rename and the rename itself is the
 * finding. */
const PARTY_KEY_IDENTITY = process.env.MEDI_PARTY_KEY_DISPLAY !== '1';
if (process.env.MEDI_PARTY_KEY_IDENTITY != null) {
  console.log('  NOTE — MEDI_PARTY_KEY_IDENTITY is RETIRED and this process ignored it. The identity '
    + 'key is the default since 2026-08-26; MEDI_PARTY_KEY_DISPLAY=1 is the control that restores the '
    + 'old display keying. This run is keyed on ' + (PARTY_KEY_IDENTITY ? 'IDENTITY' : 'DISPLAY') + '.');
}
function partyMap(rows, fails) {
  const out = {};
  for (const r of rows) {
    if (!r) continue;
    /* THE FALLBACK IS LOUD. A row with no stable key means `stableKey` refused, which is a receipt
     * that something reached this reader that is neither engine's body — never a licence to quietly
     * key on display state, which is the bug this whole block is about. */
    let k = r.species;
    if (PARTY_KEY_IDENTITY) {
      if (r.key) k = r.key;
      else if (fails) {
        fails.party_key_no_identity = (fails.party_key_no_identity || 0) + 1;
        fails.party_key_no_identity_first = fails.party_key_no_identity_first || r.species;
      }
    }
    if (out[k] && fails) {
      fails.duplicate_species_in_party = (fails.duplicate_species_in_party || 0) + 1;
      fails.duplicate_species_first = fails.duplicate_species_first || r.species;
    }
    out[k] = { /* `species` rides ONLY under the identity key — see the header. Absent under the
                * `MEDI_PARTY_KEY_DISPLAY=1` control, so that arm is byte-identical to the board this
                * comparator produced before 2026-08-26 and the control is a real control. */
               ...(PARTY_KEY_IDENTITY ? { species: r.species } : {}),
               hp: r.hp, maxhp: r.maxhp, fainted: r.fainted, status: r.status,
                       types: r.types, item: r.item, status_counter: r.status_counter,
                       /* `stall` HAS TO BE LISTED HERE TOO, and forgetting it is why this projection
                        * is worth a note. A party row is built THREE times -- `mediBody`/`sdBody`
                        * build the body, `benchRow` projects it, and this re-projects that -- and a
                        * leaf missing from any one of them arrives as `undefined` ON BOTH SIDES,
                        * which compares EQUAL and reads as agreement. Caught by planting a stall
                        * counter on a benched body and watching NOTHING be caught; the leaf was in
                        * two of the three lists. */
                       stall: r.stall,
                       boosts: r.boosts, ability: r.ability, vol: r.vol };
  }
  return out;
}

/* ---- ONE BODY --------------------------------------------------------------------------------- */
function mediBody(m, id, ctx) {
  if (!m) return null;
  const vol = m._vol || {};
  return {
    species: id(m.name),
    hp: Math.max(0, num(m.curHP)),
    maxhp: num(m.st && m.st.hp),
    fainted: !!m.fainted,
    status: statusOf(m.fainted, m.status),
    /* one field, whose meaning is decided by `status`: the toxic stage when poisoned badly, the
     * number of turns already slept when asleep, the number already spent FROZEN when frozen, 0
     * otherwise. Two engines, one quantity. The freeze arm was added 2026-08-08 — see the
     * `freeze-counter-is-turns-frozen` mapping for why its absence was invisible. */
    status_counter: m.status === 'tox' ? num(m.toxTurns)
                  : (m.status === 'slp' ? num(m.slpTurns)
                  : (m.status === 'frz' ? num(m.frzTurns) : 0)),
    /* ---- ROADMAP #462 -- THE TWO ENGINES WERE COMPARING TWO DIFFERENT QUANTITIES HERE. 2026-08-26
     *
     * `sdBody` below reads `p.item`, and Showdown's `pokemon.item` is the item ON the body: it is
     * untouched by `ignoringItem()`, so a Magic Room and a Klutz leave it exactly where it was.
     * medicham2 implements suppression as a SWAP -- `itemRoomHide` empties the slot into `_roomItem`
     * so that every effect reader in that file sees an empty hand -- so this leaf read `""` on every
     * suppressed body while the authority read the item. That is not a divergence about the GAME, it
     * is this walker asking each engine a different question, and it was the sole remaining turn-1
     * board-material game in the pinned pool: "Meowstic clicks Magic Room, and mega evolves", four
     * items reading empty on our side against White Herb, Meowsticite, Focus Sash and Twisted Spoon.
     *
     * `m.item || m._roomItem` IS THE IDENTITY READ, and it is the same expression `itemOn` uses
     * inside medicham2 -- deliberately, because this file may not require the simulator. `_roomItem`
     * is written by the ONE function that parks an item and is null whenever nothing is parked.
     *
     * THIS IS NOT A LOSS BEING HIDDEN. A real removal now goes through medicham2's `itemLose`, which
     * empties the slot AND the park, so a knocked-off item reads `""` on both sides. The two states
     * this leaf could not previously tell apart are exactly the two ROADMAP #462 is about. */
    item: id(m.item || m._roomItem || ''),
    /* ---- ROADMAP #225 -- TYPING AND ABILITY, AND THEIR ABSENCE MADE THE COMPARISON UNABLE TO SEE
     * THE WORST DEFECT WE HAVE FOUND. ------------------------------------------------------------
     *
     * Will: 'our board state analysis needs to be comprehensive'. This walker compared species, hp,
     * status, item, boosts and eight volatiles -- and NOT the type list, and NOT the ability. So a
     * Soak that changes the WRONG Pokemon's typing (ROADMAP #224, 31 of 31 landing off-target) leaves
     * every compared leaf identical, and an end-of-battle board comparison would have returned
     * 'cosmetic' for the most serious defect in the register. Same for Skill Swap, Trace, Mummy,
     * Simple Beam, Protean, and an ability overwritten by mega evolution.
     *
     * A BOARD COMPARISON IS ONLY AS GOOD AS WHAT IS IN THE BOARD. That is the whole reason 'just
     * compare the boards' was never already the answer.
     *
     * BOTH ARE NORMALISED AND SORTED. The two engines spell typing differently -- medicham2 holds
     *  as a live array it rewrites on a mega, a forme change and Protean; Showdown answers
     * . Sorting removes a pure ORDER difference, which is not a rule disagreement and
     * would otherwise part every dual-typed body on line one. */
    types: (m.types || []).map(t => id(t)).sort().join('/'),
    ability: id(m.ability || ''),
    boosts: mediBoosts(m),
    vol: {
      substitute: num(m._sub),
      taunt: num(vol.taunt),
      encore: num(vol.encore),
      disable: num(vol.disable),
      leechseed: m._seededBy ? 1 : 0,
      confusion: num(vol.confusion),
      perish: m._perish == null ? 0 : num(m._perish),
      trapped_by_move: m._trap ? num(m._trap.turns) : 0,
      /* ---- THE SWEEP OF 2026-08-12, AND EVERY ROW OF IT WAS PRINTED BEFORE IT WAS WIRED ---------
       * `tests/probe_volatile_leaves.js` stages each of these with a LEGAL carrier derived from the
       * format's own learnsets and prints what BOTH engines hold. Only the rows that came back BOTH
       * are here; the rest are declared in NOT_COMPARED with the reason and the probe named. An
       * unlisted omission reads exactly like "compared and equal", which is how typing survived
       * uncompared until ROADMAP #225.
       *
       * COMPARED AS PRESENCE, NOT AS A CLOCK, AND THAT IS A NARROWING SAID OUT LOUD. medicham2 writes
       * a bare 1 for all of these; Showdown carries a duration on `magnetrise` (5) and `syrupbomb` (3)
       * and none on the others. Comparing a 1 against a 3 would part every board carrying one and
       * would be the comparator's representation, not a rule disagreement. The MISSING CLOCK is a real
       * gap and it is named in NOT_COMPARED rather than hidden inside a `!!`. */
      aquaring: vol.aquaring ? 1 : 0,
      ingrain: vol.ingrain ? 1 : 0,
      magnetrise: vol.magnetrise ? 1 : 0,
      focusenergy: vol.focusenergy ? 1 : 0,
      torment: vol.torment ? 1 : 0,
      imprison: vol.imprison ? 1 : 0,
      saltcure: vol.saltcure ? 1 : 0,
      syrupbomb: vol.syrupbomb ? 1 : 0,
      /* THE TWO-TURN LOCK. medicham2 holds the move id in `_charging` and Showdown a `twoturnmove`
       * volatile; both answer "is this body committed to a charge". WHICH move is not compared — see
       * NOT_COMPARED — because the two engines name it in different places and a mismatch there would
       * be a reader question rather than a rule one.
       *
       * 2026-08-26 — `_ttmWrap` FIRST, AND THE `_charging` FALLBACK IS FOR OLD RELEASES ONLY.
       *
       * The authority holds TWO volatiles here with different lifetimes: `twoturnmove` (duration 2,
       * dropped at the residual) and a sub-volatile named for the move (removed at execution by the
       * move's own `onTryMove`). `v.twoturnmove` on the other side of this comparison is the WRAPPER,
       * so the wrapper is what medicham2 must be read for — and until this date it had only the one
       * field, cleared at execution, which read 0 for the rest of every release turn.
       *
       * THE `||` IS NOT A SILENT DEFAULT AND THE DISTINCTION MATTERS. On the live engine `_ttmWrap`
       * is a strict superset of `_charging` (they are written on the same line and the wrapper
       * outlives it), so the fallback can never mask a live defect — it changes nothing. It is here
       * because this file is NOT one of the frozen release SOURCES: it is the live reader pointed at
       * whatever engine a measurement opened, and a release cut before `_ttmWrap` existed would
       * otherwise report 0 on every charge turn and part on a leaf the engine of that day got right.
       * That is the manufactured divergence `partyMap` and `pp` each record paying for once already. */
      charging: (m._ttmWrap || m._charging) ? 1 : 0,
      /* ---- ROADMAP #308 -- THREE LEAVES THAT ARE THE WHOLE MECHANIC OF THE MOVE THAT WRITES THEM.
       * Each was reported ANNOUNCEMENT-ONLY by `all_mechanics_fire.js` -- identical in the fields this
       * file looked at -- and each was measured through `tests/probe_volatile_leaves.js` BEFORE being
       * wired, because a leaf one engine cannot express parts every board at once.
       *
       *   trapped   Spirit Shackle's point, and a DIFFERENT volatile from `partiallytrapped` above:
       *             no chip, no clock, ends with its source. medicham2 keeps it in `_trapHard`
       *             (which carries the trapper) rather than in `_vol`, so the two shapes are read
       *             through their own fields and compared as PRESENCE -- Showdown carries no duration
       *             on it either, so nothing is being collapsed.
       *   uproar    the three-turn lock AND the sleep prevention. medicham2 holds it in `_mtLock`,
       *             the rampage lock, alongside Outrage and Petal Dance -- so the read is gated on
       *             `vol === 'uproar'` and NOT on the presence of a lock, or every Outrage would
       *             report as an Uproar. It IS compared as a clock: measured at the turn-1 boundary
       *             the authority holds `uproar(d2)` and this engine holds `left: 2`.
       *   charge    the stored Electric boost Electromorphosis banks and the move Charge applies.
       *             Both engines hold the identical bare volatile; `probe_volatile_leaves.js` prints
       *             them side by side as `charge=1` against `charge`. */
      trapped: m._trapHard ? 1 : 0,
      uproar: (m._mtLock && m._mtLock.vol === 'uproar') ? num(m._mtLock.left) : 0,
      charge: num(vol.charge) ? 1 : 0,
      /* ---- DESTINY BOND. 2026-08-25. The row this replaces in NOT_COMPARED said it was ONE-SIDED
       * and therefore a SUSPECT rather than a leaf, and it was right at the time and for the right
       * reason: this engine held `_vol.destinybond` for ever, so wiring it would have parted every
       * board carrying one and presented an ENGINE DEFECT as a comparison leaf.
       *
       * IT WAS ONE-SIDED BECAUSE THE MECHANIC WAS NOT IMPLEMENTED, which is what the row asked
       * somebody to go and find out. medicham2 wrote the volatile and never read it, never removed it
       * and never took the killer with it. All three are fixed in the same pass, and only then is the
       * leaf wired -- measured on both engines first (tests/probe_dbond_stall.js A4 and A5, the two
       * boundaries where the two sides used to differ, now identical).
       *
       * PRESENCE, NOT A CLOCK: Showdown's condition carries no duration and neither does this. */
      destinybond: (vol.destinybond ? 1 : 0),
    },
    /* ---- THE STALL COUNTER BEHIND CONSECUTIVE PROTECT. 2026-08-25. -------------------------------
     *
     * IT SITS BESIDE THE BODY AND NOT INSIDE `vol`, for the reason `pp` does: it is a leaf an engine
     * may be UNABLE TO EXPRESS. A release cut before this date does not export `stallCounter`, and a
     * `null` nested inside `vol` would compare null-against-null and read as AGREEMENT -- silently.
     * At body level `walkBody`'s null rule fires and the skip is counted by name.
     *
     * THE ROW THIS REPLACES ARGUED THE TWO ENGINES HOLD DIFFERENT QUANTITIES: *"medicham2 holds
     * `tookProtectTurns` (a count UP of consecutive successful shields) and Showdown holds a `stall`
     * volatile with a `counter` that is a DENOMINATOR (3, 9, 27). They are different quantities, not
     * two spellings of one, and a mapping between them would be this file inventing a rule."*
     *
     * THE FIRST HALF IS TRUE AND THE CONCLUSION IS NOT, AND IT WAS MEASURED BEFORE IT WAS WIRED. The
     * map is the AUTHORITY'S OWN and the engine already computes it to decide whether a shield holds:
     * `counter = firstCounter * growsBy^(n-1)`, capped at `counterMax`, all three read off
     * `stallCounterChecks` which `tag_dex` derives from `data/conditions.ts`'s `stall`. So this is not
     * a rule invented here -- it is medicham2's own `stallCounter`, called rather than copied, which
     * is what stops the comparator checking its own belief against the authority.
     *
     * PRINTED SIDE BY SIDE OVER TWO SCRIPTS BEFORE ANY OF IT WAS WIRED (tests/probe_dbond_stall.js
     * B1/B2): five consecutive Protects and a skipped turn, every boundary, `3^n` against
     * `stall.counter` -- 0/0, 3/3, 9/9, then 0/0 on the turn the 1/9 roll was LOST, 3/3, 0/0. Twelve
     * boundaries, twelve exact matches, including both resets. There is nothing to collapse.
     *
     * `null` MEANS "THIS ENGINE CANNOT SAY", never "no shields". */
    stall: ctx && ctx.stallCounter ? ctx.stallCounter(num(m.tookProtectTurns)) : null,
  };
}
function sdBody(p, id, ctx) {
  if (!p) return null;
  const v = p.volatiles || {};
  return {
    species: id(p.species && p.species.id),
    hp: Math.max(0, num(p.hp)),
    maxhp: num(p.maxhp),
    fainted: !!p.fainted,
    status: statusOf(p.fainted, p.status),
    status_counter: p.status === 'tox' ? num(p.statusState && p.statusState.stage)
                  : (p.status === 'slp' ? sleptTurns(p.statusState)
                  : (p.status === 'frz' ? frozenTurns(p.statusState) : 0)),
    item: id(p.item || ''),
    /* ROADMAP #225 -- the authority's side of the same two leaves. `getTypes()` is the METHOD, not
     * the species default: it answers what the body is RIGHT NOW, after a mega, a Protean or a Soak,
     * which is exactly the question. `ability` is the live slot, so Skill Swap and Trace show. */
    types: (typeof p.getTypes === 'function' ? p.getTypes() : (p.types || [])).map(t => id(t)).sort().join('/'),
    ability: id((p.ability && p.ability.id) || p.ability || ''),
    boosts: sdBoosts(p),
    vol: {
      substitute: v.substitute ? num(v.substitute.hp) : 0,
      taunt: dur(v.taunt),
      encore: dur(v.encore),
      disable: dur(v.disable),
      leechseed: v.leechseed ? 1 : 0,
      confusion: v.confusion ? num(v.confusion.time) : 0,
      perish: v.perishsong ? num(v.perishsong.duration) : 0,
      trapped_by_move: dur(v.partiallytrapped),
      /* THE AUTHORITY'S SIDE OF THE 2026-08-12 SWEEP. Presence only, for the reason given on the
       * medicham side: three of these carry a duration here and none of them does there. */
      aquaring: v.aquaring ? 1 : 0,
      ingrain: v.ingrain ? 1 : 0,
      magnetrise: v.magnetrise ? 1 : 0,
      focusenergy: v.focusenergy ? 1 : 0,
      torment: v.torment ? 1 : 0,
      imprison: v.imprison ? 1 : 0,
      saltcure: v.saltcure ? 1 : 0,
      syrupbomb: v.syrupbomb ? 1 : 0,
      charging: v.twoturnmove ? 1 : 0,
      /* ROADMAP #308 -- the authority's side of the three. `trapper` sits on the SOURCE of a Spirit
       * Shackle and is deliberately NOT read: medicham2 keeps the trapper inside the victim's own
       * `_trapHard` record and has no field on the source at all, so comparing it would manufacture a
       * divergence on every trap. That omission is in NOT_COMPARED with this reason. */
      trapped: v.trapped ? 1 : 0,
      uproar: dur(v.uproar),
      charge: v.charge ? 1 : 0,
      /* THE AUTHORITY'S SIDE OF DESTINY BOND. `data/moves.ts` destinybond.condition carries no
       * duration, so presence is the whole of it and nothing is being collapsed. */
      destinybond: v.destinybond ? 1 : 0,
    },
    /* THE AUTHORITY'S SIDE OF THE STALL COUNTER: the raw denominator off its own volatile, with NO
     * volatile reading 0. Gated on the same capability as medicham2's so both sides are `null`
     * together -- a leaf one engine can express and the other cannot is not a comparison. */
    stall: ctx && ctx.stallCounter ? (v.stall ? num(v.stall.counter) : 0) : null,
  };
}

/* ---- THE WHOLE BOARD ---------------------------------------------------------------------------
 * `ctx` = { id, weatherId, terrainId, fails } — `id` is the project's own name normaliser and the two
 * translators are THE ENGINE'S OWN exported functions. `fails` is a counter object the caller keeps,
 * so a translation that could not be made is a receipt rather than a silent empty string. */
function readMedi(S, ctx) {
  const id = ctx.id;
  const F = S.field || {};
  const side = (act, sf, tw) => ({
    screens: mediScreens(sf),
    tailwind: num(tw),
    hazards: { stealthrock: num(sf && sf.hz && sf.hz.stealthrock), spikes: num(sf && sf.hz && sf.hz.spikes),
               toxicspikes: num(sf && sf.hz && sf.hz.toxicspikes), stickyweb: num(sf && sf.hz && sf.hz.stickyweb) },
    party: (() => { const on = new Set((act || []).filter(Boolean));
      return partyMap(((sf && sf.team) || []).map(
        m => benchRow(mediBody(m, id, ctx), on.has(m), stableKey(m, id, keyNote(ctx.fails)))), ctx.fails); })(),
    active: [0, 1].map(i => mediBody(act[i], id, ctx)),
    /* WHICH PARTY ROWS ARE STANDING, BY THE SAME KEY THE PARTY IS KEYED ON. `compare()` never walks
     * this — it walks a named list — so it cannot become a compared leaf. It exists because a reader
     * that de-duplicates "this party row is a second view of an active body" has to ask the question
     * in ONE currency: `game_differential.js` matched a party key against the DISPLAYED active species
     * and that stopped being the same thing the moment ROADMAP #465 keyed the party on identity. A
     * renamed body (a mega, a transform) would have had its party row counted twice. */
    active_keys: [0, 1].map(i => (act[i] ? stableKey(act[i], id, keyNote(ctx.fails)) : null)),
    /* PP SITS BESIDE THE BODY AND NOT INSIDE IT, exactly as `screens.named` does, because it is the
     * one leaf an engine may be UNABLE TO EXPRESS. A release cut before ROADMAP #144 has no `_pp` and
     * no `ppSpentMap`, and folding an inexpressible field into the body would make every board of
     * every frozen release on the ladder part on it — which is the manufactured divergence
     * `partyMap`'s comment records paying for once already. `null` here means "this engine cannot
     * say", which `compare()` skips and `snapshot()` reports; it never means "nothing spent". */
    pp: [0, 1].map(i => (!ctx.ppHold && ctx.ppSpent && act[i] ? ctx.ppSpent(act[i]) : null)),
  });
  return {
    engine: 'medicham2',
    field: { weather: String(F.weather || ''), weather_turns: num(F.weatherT),
             terrain: String(F.terrain || ''), terrain_turns: num(F.terrainT),
             trickroom_turns: num(F.tr),
             /* ROADMAP #308 -- FAIRY LOCK, a pseudo-weather nobody compared and nothing implemented.
              * The two-turn switch lock IS the move, it announces `-fieldactivate` when it starts and
              * NOTHING when it ends (`announces: false` on its own artifact row), so a clock that ran
              * on for ever would be invisible to every stream instrument. Measured on both engines
              * before it was wired: the authority holds `fairylock(d1)` at the boundary of the turn it
              * was set and this engine holds 1. */
             fairylock_turns: num(F.fairylock) },
    sides: { p1: side(S.actA || [], S.sfA, F.twA), p2: side(S.actB || [], S.sfB, F.twB) },
  };
}
function readShowdown(battle, ctx) {
  const id = ctx.id;
  const F = battle.field || {};
  /* THE ENGINE'S VOCABULARY, THROUGH THE ENGINE'S OWN FUNCTION. A non-empty Showdown name that comes
   * back empty means the translation failed, and an empty string is indistinguishable from clear
   * skies — so it is counted, and the raw name is kept so the report can say which one. */
  const xl = (kind, raw) => {
    const s = String(raw || '');
    if (!s) return '';
    const out = String((kind === 'weather' ? ctx.weatherId : ctx.terrainId)(s) || '');
    if (!out && ctx.fails) {
      ctx.fails[kind + '_untranslatable'] = (ctx.fails[kind + '_untranslatable'] || 0) + 1;
      ctx.fails[kind + '_untranslatable_first'] = ctx.fails[kind + '_untranslatable_first'] || s;
      return 'UNTRANSLATABLE:' + s;      // never silently "no weather"
    }
    return out;
  };
  const side = (sd) => ({
    screens: sdScreens(sd),
    tailwind: dur((sd.sideConditions || {}).tailwind),
    hazards: { stealthrock: layers((sd.sideConditions || {}).stealthrock),
               spikes: layers((sd.sideConditions || {}).spikes),
               toxicspikes: layers((sd.sideConditions || {}).toxicspikes),
               stickyweb: layers((sd.sideConditions || {}).stickyweb) },
    party: (() => { const on = new Set((sd.active || []).filter(Boolean));
      return partyMap((sd.pokemon || []).map(
        p => benchRow(sdBody(p, id, ctx), on.has(p), stableKey(p, id, keyNote(ctx.fails)))), ctx.fails); })(),
    active: [0, 1].map(i => sdBody((sd.active || [])[i], id, ctx)),
    /* WHICH PARTY ROWS ARE STANDING, BY THE SAME KEY THE PARTY IS KEYED ON. `compare()` never walks
     * this — it walks a named list — so it cannot become a compared leaf. It exists because a reader
     * that de-duplicates "this party row is a second view of an active body" has to ask the question
     * in ONE currency: `game_differential.js` matched a party key against the DISPLAYED active species
     * and that stopped being the same thing the moment ROADMAP #465 keyed the party on identity. A
     * renamed body (a mega, a transform) would have had its party row counted twice. */
    active_keys: [0, 1].map(i => ((sd.active || [])[i] ? stableKey((sd.active || [])[i], id, keyNote(ctx.fails)) : null)),
    /* HELD ON BOTH SIDES OR NEITHER. A hold that only silenced OUR side would leave Showdown's map
     * walking against `null` and report every move as present-in-one-engine-only — a manufactured
     * divergence, which is worse than the thing being held. */
    pp: [0, 1].map(i => (!ctx.ppHold && (sd.active || [])[i] ? sdPP((sd.active || [])[i]) : null)),
  });
  return {
    engine: 'showdown',
    field: { weather: xl('weather', F.weather), weather_turns: dur(F.weatherState),
             terrain: xl('terrain', F.terrain), terrain_turns: dur(F.terrainState),
             trickroom_turns: dur((F.pseudoWeather || {}).trickroom),
             fairylock_turns: dur((F.pseudoWeather || {}).fairylock) },
    sides: { p1: side(battle.p1), p2: side(battle.p2) },
  };
}

/* ---- THE COMPARISON ----------------------------------------------------------------------------
 * A flat walk that yields ONE ROW PER DIFFERING LEAF, each carrying the path that names it, so the
 * report can say WHICH part of the board parted rather than only that it did. The screens' `named`
 * block is compared only when BOTH engines can express it — see mediScreens. */
/* `stats.compared` COUNTS EVERY LEAF THAT WAS ACTUALLY LOOKED AT, matching ones included. Will,
 * 2026-08-07: *"PRINT ONLY WHAT DIFFERS, but COUNT what matched, so a diff of one field out of ninety
 * reads differently from one out of three."* Without it a board report is a numerator with no
 * denominator, and "the boards differ" is exactly the boolean this instrument was built to replace. */
function walk(a, b, path, out, stats) {
  if (a === undefined && b === undefined) return;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (stats) stats.compared++;
    if (a !== b) out.push({ path, medicham: a === undefined ? null : a, showdown: b === undefined ? null : b });
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const n = Math.max((a || []).length, (b || []).length);
    for (let i = 0; i < n; i++) walk(a[i], b[i], path + '[' + i + ']', out, stats);
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) walk(a[k], b[k], path ? path + '.' + k : k, out, stats);
}

/* THE PARTY AND THE ACTIVE SLOTS, WITH THE POST-FAINT GROUP HELD WHERE EITHER ENGINE SAYS THE BODY IS
 * DOWN. Written as walks of their own rather than as a `null` in the two maps, because a one-sided
 * null would REPORT as a difference on `item` the moment the two engines disagreed about `fainted` —
 * turning one finding (they disagree about who is alive, which `fainted` already carries) into four,
 * on an already-parted board. Every skip is counted, never assumed. */
/* ONE BODY, WITH THE POST-FAINT GROUP HELD WHERE EITHER ENGINE SAYS IT IS DOWN. Shared by the party
 * and by the active slot, because they are the same rule about the same group and two copies of it
 * would agree today and part the first time one was edited — which is the state this function was
 * written to end.
 *
 * `hold` DECIDES WHETHER THE GROUP IS HELD and `count` names the counter. The party passes `true`
 * always — that is its behaviour since 2026-08-18 and this change does not move it — and the active
 * slot passes the cross-engine test, for the reason written out in the POST_FAINT block. A leaf that
 * is NOT held on a corpse is counted under `post_faint_not_held_same_engine`, so the population the
 * rule deliberately does not cover is a number rather than an assumption. */
/* A LEAF EITHER PROJECTION DECLINED TO ANSWER. Today there is exactly one — a party row's `vol` on a
 * body that is STANDING, which the active-slot walk already compares — and it is a `null` rather than
 * an absent key so that both sides keep the same SHAPE: a key absent on one side only would walk as
 * `undefined` against an object and report a difference nobody has. Named per leaf, so a later
 * addition cannot hide inside a generic counter. */
const NULL_SKIP_COUNTER = { vol: 'party_vol_on_field_skipped',
  /* TWO REASONS, ONE COUNTER, AND THE PAIR IS SEPARABLE FROM THE RUN'S OWN RECEIPTS:
   *   the body is STANDING, so its party row defers to the active slot — the same rule as `vol`
   *     above, and roughly 4 per boundary on any real game;
   *   the ENGINE CANNOT SAY. A release cut before 2026-08-25 exports no `stallBoardCounter`, so both
   *     sides answer null everywhere, ACTIVE SLOTS INCLUDED. That case is separately declared by
   *     `game_differential.js` as `stall_not_expressible_by_this_engine`, so the two never have to be
   *     told apart from this number alone.
   * Counted either way, because "not asked" must never read as "agreed". */
  stall: 'stall_leaf_skipped' };
function walkBody(A, B, path, out, stats, hold, count) {
  const standing = !A.fainted && !B.fainted;
  for (const leaf of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (A[leaf] === null || B[leaf] === null) {
      if (stats) {
        const k = NULL_SKIP_COUNTER[leaf] || 'null_leaf_skipped';
        stats[k] = (stats[k] || 0) + 1;
        /* ONE SIDE STANDING AND THE OTHER BENCHED IS A REAL DISAGREEMENT, and it is already carried by
         * the active slots' own `species` walk. Counted here so the asymmetry is visible rather than
         * expanded into a second, louder copy of the same finding. */
        if ((A[leaf] === null) !== (B[leaf] === null))
          stats.null_leaf_asymmetric = (stats.null_leaf_asymmetric || 0) + 1;
      }
      continue;
    }
    if (!standing && POST_FAINT.indexOf(leaf) >= 0) {
      if (hold) {
        if (stats) stats[count] = (stats[count] || 0) + 1;
        continue;
      }
      if (stats) stats.post_faint_not_held_same_engine = (stats.post_faint_not_held_same_engine || 0) + 1;
    }
    walk(A[leaf], B[leaf], path + '.' + leaf, out, stats);
  }
}
function walkParty(a, b, path, out, stats) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const A = (a || {})[k], B = (b || {})[k];
    if (!A || !B) { walk(A, B, path + '.' + k, out, stats); continue; }   // missing member: unchanged
    walkBody(A, B, path + '.' + k, out, stats, true, 'party_post_faint_skipped');
  }
}
/* THE ACTIVE SLOTS, ON THE SAME RULE. An empty slot walks unchanged, exactly as a missing party
 * member does: `null` against a body is one finding — nobody is standing there — and expanding it
 * into a leaf-by-leaf diff would be the same over-counting `walkParty` refuses. */
function walkActive(a, b, path, out, stats, cross) {
  const n = Math.max((a || []).length, (b || []).length);
  for (let i = 0; i < n; i++) {
    const A = (a || [])[i], B = (b || [])[i];
    if (!A || !B) { walk(A, B, path + '[' + i + ']', out, stats); continue; }
    walkBody(A, B, path + '[' + i + ']', out, stats, cross, 'active_post_faint_skipped');
  }
}

function compare(medi, sd, stats) {
  const out = [];
  /* THE PAIR DECIDES WHETHER THE POST-FAINT GROUP IS HELD — see the POST_FAINT block. Two boards from
   * the SAME engine do the same housekeeping, so there is nothing to protect against and holding a
   * leaf would only throw information away; `tests/roster.js` and the differential's turn-to-turn
   * credit are both that shape. A board with no `engine` stamp is treated as CROSS, which preserves
   * the behaviour every caller had before this rule existed, and it is counted rather than assumed. */
  const nameA = (medi && medi.engine) || '', nameB = (sd && sd.engine) || '';
  const cross = !(nameA && nameB && nameA === nameB);
  if (stats && !(nameA && nameB)) stats.post_faint_engine_unstamped = 1;
  walk(medi.field, sd.field, 'field', out, stats);
  for (const s of ['p1', 'p2']) {
    const A = medi.sides[s], B = sd.sides[s];
    walk(A.screens.physical, B.screens.physical, s + '.screens.physical', out, stats);
    walk(A.screens.special, B.screens.special, s + '.screens.special', out, stats);
    /* THE STRICTLY STRONGER CHECK, AVAILABLE ONLY WHEN THE ENGINE CAN EXPRESS IT. A pre-WIRE-8
     * medicham2 holds two category counters and genuinely cannot say WHICH screen is up, so asking it
     * would be measuring the reader. Skipped LOUDLY: `screens_named_comparable` on every snapshot. */
    if (A.screens.named && B.screens.named) walk(A.screens.named, B.screens.named, s + '.screens.named', out, stats);
    walk(A.tailwind, B.tailwind, s + '.tailwind', out, stats);
    walk(A.hazards, B.hazards, s + '.hazards', out, stats);
    walkParty(A.party, B.party, s + '.party', out, stats);
    walkActive(A.active, B.active, s + '.active', out, stats, cross);
    /* PP, PER SLOT, ONLY WHERE BOTH ENGINES CAN EXPRESS IT — the same rule and the same reason as
     * `screens.named` two lines up. Skipped LOUDLY: `pp_comparable` rides on every snapshot, so an
     * engine that cannot answer is a receipt and never an agreement.
     *
     * AND ON THE POST-FAINT RULE TOO, WHICH IS WHY THE BODY IS READ HERE. PP sits BESIDE the body
     * rather than inside it (see `readMedi`), so a slot holding a corpse would otherwise escape the
     * hold that the body two lines up now gets — the identical asymmetry, one field over.
     * `clearVolatile` restores `moveSlots` from `baseMoveSlots` (`sim/pokemon.ts:1525`) and we compare
     * PP as SPENT, so every move the corpse ever used parts the board. */
    for (let i = 0; i < 2; i++) {
      const ap = (A.pp || [])[i], bp = (B.pp || [])[i];
      if (!(ap && bp)) continue;
      const ab = (A.active || [])[i], bb = (B.active || [])[i];
      const onACorpse = !!(ab && bb && (ab.fainted || bb.fainted));
      if (onACorpse) {
        const n = new Set([...Object.keys(ap), ...Object.keys(bp)]).size;
        if (cross) { if (stats) stats.pp_post_faint_skipped = (stats.pp_post_faint_skipped || 0) + n; continue; }
        if (stats) stats.post_faint_not_held_same_engine = (stats.post_faint_not_held_same_engine || 0) + n;
      }
      walk(ap, bp, s + '.pp[' + i + ']', out, stats);
    }
  }
  return out;
}

/* THE FIELD FAMILY A DIFFERENCE BELONGS TO — the state analogue of the protocol differential's
 * `classify()`. Twelve games hitting one wire is ONE wire and not twelve findings, and the same is
 * true of a board: `p1.active[0].hp` and `p2.active[1].hp` are the same defect family. Derived from
 * the path by stripping the side and the slot, never from a hand-written table. */
/* THE TWO PARTY CASES ARE EXCLUSIVE AND MUST BE WRITTEN THAT WAY. Chained `.replace()` calls were the
 * first version and they are wrong: `party.<species>.hp` collapses to `party.hp`, and the SECOND rule
 * then matched `party.hp` (because `hp` is also `[^.]+`) and relabelled every single party difference
 * as a missing member. It read as 99 games of one dramatic family and was one regex eating its own
 * output. */
function family(path) {
  const p = String(path).replace(/^p[12]\./, '').replace(/\[\d+\]/g, '[]');
  /* the party is keyed by SPECIES, so the key is the instance and not the family: nine games losing an
   * Incineroar's HP and nine losing a Rillaboom's are one defect, not eighteen */
  const m = /^party\.([^.]+)(?:\.(.+))?$/.exec(p);
  if (!m) return p;
  return m[2] ? 'party.' + m[2] : 'party.MISSING-OR-EXTRA-MEMBER';
}

/* ---- WHAT EXACTLY IS DIFFERENT — SLOT, BODY, FIELD --------------------------------------------
 *
 * Will, 2026-08-07: *"DOES OUR HARNESS IDENTIFY WHAT EXACTLY IS DIFFERENT BETWEEN BOARDS?"* Until
 * this function existed the answer was no: `compare()` returned a path string and a reader had to know
 * that `p2.active[0].boosts.spa` means *their left body is at +1 Special Attack in one world and 0 in
 * the other.* A path is a location; a finding needs the BODY standing there.
 *
 * `locate` splits one differing leaf into the four things a person needs — which side, which slot,
 * WHICH POKEMON, and which field — plus the two values, labelled SD (the authority) and US.
 *
 * THE BODY IS READ FROM WHICHEVER ENGINE HAS ONE. On a `species` divergence the two engines disagree
 * about who is standing there, so both names are carried and the caller can print both; naming only
 * medicham2's would silently pick the wrong body on exactly the rows where it matters most. */
const SLOT_LETTER = ['a', 'b'];
function locate(d, snap) {
  const p = String(d.path);
  const out = { path: p, side: '', slot: '', body: '', body_showdown: '', field: p,
                us: d.medicham, sd: d.showdown, bucket: bucket(d), family: family(p) };
  /* PP FIRST, because its path carries a SLOT and the generic `p1.<field>` fallback below would strip
   * the body off it and report a spent move with nobody standing there. */
  let m = /^(p[12])\.pp\[(\d+)\]\.(.+)$/.exec(p);
  if (m) {
    const i = +m[2];
    const mb = snap && snap.medi.sides[m[1]].active[i], sb = snap && snap.sd.sides[m[1]].active[i];
    out.side = m[1]; out.slot = m[1] + SLOT_LETTER[i]; out.field = 'pp.' + m[3];
    out.body = (mb && mb.species) || (sb && sb.species) || '';
    out.body_showdown = (sb && sb.species) || '';
    return out;
  }
  m = /^(p[12])\.active\[(\d+)\]\.(.+)$/.exec(p);
  if (m) {
    const i = +m[2];
    const mb = snap && snap.medi.sides[m[1]].active[i], sb = snap && snap.sd.sides[m[1]].active[i];
    out.side = m[1]; out.slot = m[1] + SLOT_LETTER[i]; out.field = m[3];
    out.body = (mb && mb.species) || (sb && sb.species) || '';
    out.body_showdown = (sb && sb.species) || '';
    out.maxhp = (sb && sb.maxhp) || (mb && mb.maxhp) || 0;
    return out;
  }
  m = /^(p[12])\.party\.([^.]+)(?:\.(.+))?$/.exec(p);
  if (m) { out.side = m[1]; out.body = m[2]; out.body_showdown = m[2];
           out.field = 'party.' + (m[3] || 'MISSING-OR-EXTRA-MEMBER'); return out; }
  m = /^(p[12])\.(.+)$/.exec(p);
  if (m) { out.side = m[1]; out.field = m[2]; return out; }
  return out;
}

/* ---- HOW WRONG, NOT JUST WHETHER -------------------------------------------------------------
 * Will, 2026-08-07: *"SEPARATE 'WRONG VALUE' FROM 'WRONG BY ONE'. An HP off by one is a rounding bug;
 * an HP off by 40 is a missing mechanic; a stat stage off by one is neither."*
 *
 * The one-HP bucket has a known owner: WIRE 4 found Showdown does every damage multiplier in fixed
 * point on 4096ths with a round-half-up where this engine used floats, and the residue of that class
 * of error is exactly a one-HP difference. Mixing it in with the mechanics is how `-damage field 3`
 * stayed one opaque class for ten wires. */
function bucket(d) {
  const a = d.medicham, b = d.showdown;
  const empty = v => v === null || v === undefined || v === '' || v === 0 || v === false;
  if (typeof a === 'number' && typeof b === 'number') {
    const g = Math.abs(a - b);
    if (g === 1) return 'off-by-one';
    if (g <= 3) return 'off-by-2-or-3';
    return 'off-by-4-or-more';
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return 'one-says-yes-one-says-no';
  if (empty(a) !== empty(b)) return 'present-in-one-engine-only';
  return 'different-value';
}

/* ---- THE SAME DIFFERENCE, IN ENGLISH ----------------------------------------------------------
 * Will, 2026-08-07: *"NO PROTOCOL LINES IN THE PROSE. If a reader has to parse `|-boost|p2a: Raichu|
 * spa|1` you have not done the job."*
 *
 * `pretty` is supplied by the caller and is the SHOWDOWN DEX's display name for an id. It is a
 * parameter and not a require, because this file must not grow a second naming table beside the one
 * the authority already owns.
 *
 * IT DESCRIBES, IT DOES NOT JUDGE. Will: *"DO NOT INTERPRET WHETHER IT MATTERS."* Every clause below
 * restates a value; none of them says a value is wrong. */
const BOOST_NAME = { atk: 'Attack', def: 'Defence', spa: 'Special Attack', spd: 'Special Defence',
                     spe: 'Speed', accuracy: 'accuracy', evasion: 'evasion' };
const STATUS_NAME = { '': 'no status', brn: 'burned', par: 'paralysed', psn: 'poisoned',
                      tox: 'badly poisoned', slp: 'asleep', frz: 'frozen', fnt: 'fainted' };
const stage = n => (n > 0 ? '+' + n : String(n));
function explain(loc, v, pretty) {
  const P = pretty || (x => String(x));
  const who = loc.body ? P(loc.body) : '';
  const f = loc.field;
  if (f === 'hp') return who + ' is on ' + v + (loc.maxhp ? ' of ' + loc.maxhp : '') + ' HP';
  if (f === 'maxhp') return who + ' has ' + v + ' maximum HP';
  if (f === 'fainted') return who + (v ? ' has fainted' : ' is still standing');
  if (f === 'status') return who + ' is ' + (STATUS_NAME[String(v || '')] || String(v));
  if (f === 'status_counter') return who + ' is on status counter ' + v;
  if (f === 'item') return who + (v ? ' is holding ' + P(v) : ' is holding nothing');
  if (f === 'species') return 'the body in that slot is ' + P(v);
  if (f.indexOf('boosts.') === 0) return who + ' is at ' + stage(v) + ' ' + (BOOST_NAME[f.slice(7)] || f.slice(7));
  if (f === 'vol.substitute') return who + (v ? ' has a Substitute on ' + v + ' HP' : ' has no Substitute');
  if (f === 'vol.leechseed') return who + (v ? ' is seeded' : ' is not seeded');
  if (f.indexOf('vol.') === 0) { const k = f.slice(4);
    return who + (v ? ' has ' + k + ' with ' + v + ' turn(s) left' : ' has no ' + k); }
  if (f.indexOf('pp.') === 0) { const mv = P(f.slice(3));
    return who + (v ? ' has spent ' + v + ' PP on ' + mv : ' has spent no PP on ' + mv); }
  if (f === 'party.hp') return P(loc.body) + ' on the team is on ' + v + ' HP';
  if (f === 'party.maxhp') return P(loc.body) + ' on the team has ' + v + ' maximum HP';
  if (f === 'party.fainted') return P(loc.body) + ' on the team ' + (v ? 'has fainted' : 'is still standing');
  /* THE BENCH LEAVES, 2026-08-18. Each says "on the bench" out loud, because the same difference on
   * an ACTIVE body is a different finding and the two must not read alike in a report. */
  if (f === 'party.item') return P(loc.body) + ' on the bench ' + (v ? 'is holding ' + P(v) : 'is holding nothing');
  if (f === 'party.status') return P(loc.body) + ' on the bench is ' + (STATUS_NAME[String(v || '')] || String(v));
  if (f === 'party.status_counter') return P(loc.body) + ' on the bench is on status counter ' + v;
  if (f === 'party.types') return P(loc.body) + ' on the bench is typed ' + String(v);
  if (f.indexOf('party.boosts.') === 0)
    return P(loc.body) + ' on the bench is at ' + stage(v) + ' ' + (BOOST_NAME[f.slice(13)] || f.slice(13));
  /* THE BENCH VOLATILES, 2026-08-25 — each says "on the bench" for the same reason the row above does:
   * a Substitute on a standing body is a doll, and a Substitute on a benched one is a body that did
   * not drop what leaving the field drops. */
  if (f === 'party.vol.substitute')
    return P(loc.body) + ' on the bench ' + (v ? 'still has a Substitute on ' + v + ' HP' : 'has no Substitute');
  if (f === 'party.vol.leechseed')
    return P(loc.body) + ' on the bench is ' + (v ? 'still seeded' : 'not seeded');
  if (f.indexOf('party.vol.') === 0) { const k = f.slice(10);
    return P(loc.body) + ' on the bench ' + (v ? 'still has ' + k + ' (' + v + ')' : 'has no ' + k); }
  if (f.indexOf('party.') === 0) return P(loc.body) + ' on the team: ' + f.slice(6) + ' is ' + v;
  if (f === 'tailwind') return v ? 'Tailwind has ' + v + ' turn(s) left' : 'there is no Tailwind';
  if (f.indexOf('hazards.') === 0) return v ? v + ' layer(s) of ' + f.slice(8) : 'no ' + f.slice(8);
  if (f.indexOf('screens.') === 0) return f.slice(8) + ' screen cover has ' + v + ' turn(s) left';
  if (f === 'field.weather') return v ? 'the weather is ' + v : 'the sky is clear';
  if (f === 'field.terrain') return v ? 'the terrain is ' + v : 'there is no terrain';
  if (f === 'field.weather_turns') return 'the weather has ' + v + ' turn(s) left';
  if (f === 'field.terrain_turns') return 'the terrain has ' + v + ' turn(s) left';
  if (f === 'field.trickroom_turns') return v ? 'Trick Room has ' + v + ' turn(s) left' : 'there is no Trick Room';
  return f + ' is ' + JSON.stringify(v);
}

/* ---- THE SNAPSHOT PAIR, WHICH IS WHAT A CALLER WANTS ------------------------------------------- */
function snapshot(S, battle, ctx) {
  const medi = readMedi(S, ctx), sd = readShowdown(battle, ctx);
  const stats = { compared: 0, party_post_faint_skipped: 0,
                  active_post_faint_skipped: 0, pp_post_faint_skipped: 0,
                  post_faint_not_held_same_engine: 0,
                  party_vol_on_field_skipped: 0, null_leaf_asymmetric: 0 };
  const diffs = compare(medi, sd, stats);
  return { medi, sd, diffs,
           identical: diffs.length === 0,
           leaves_compared: stats.compared,
           /* THE BENCH RECEIPT (2026-08-18). "The post-faint leaves were not asked" and "the
            * post-faint leaves agreed" are different sentences, and only one of them is honest —
            * exactly the argument `pp_comparable` two entries down was built on. */
           party_post_faint_skipped: stats.party_post_faint_skipped,
           /* THE BENCH VOLATILES' RECEIPT (2026-08-25). A party row's `vol` is `null` while the body
            * is STANDING, because the active slot already compares it; this counts those skips so a
            * run in which the bench was never asked can never be read as a run in which it agreed.
            * A ZERO HERE ON A REAL GAME IS A FAULT, not a clean bill: every game has four standing
            * bodies at every boundary, so the count is roughly 4 per boundary and nothing else. */
           party_vol_on_field_skipped: stats.party_vol_on_field_skipped,
           /* AND THE HALF THAT IS A FINDING RATHER THAN BOOKKEEPING. Non-zero means the two engines
            * disagree about WHO IS STANDING — carried by the active slots' own `species` walk, and
            * counted here so the asymmetry is visible instead of being expanded into a second copy
            * of the same finding. */
           null_leaf_asymmetric: stats.null_leaf_asymmetric,
           /* THE OTHER TWO THIRDS OF THE SAME RECEIPT (2026-08-20). The bench half rode on every
            * snapshot for a day while the active slot and the PP map were compared on corpses and
            * said nothing — so the hold was published and the ASYMMETRY was not, which is the shape
            * of an unlisted omission reading as agreement. All three are separate numbers because
            * they answer separate questions: a run whose active count is zero and whose bench count
            * is not has no bodies dying on the field, and that is worth being able to see. */
           active_post_faint_skipped: stats.active_post_faint_skipped,
           pp_post_faint_skipped: stats.pp_post_faint_skipped,
           /* AND THE POPULATION THE HOLD DELIBERATELY DOES NOT COVER. Two boards from one engine are
            * compared in full; this counts the leaves that WOULD have been held on a cross-engine
            * pair, so "the rule did not apply here" can never be read as "there was nothing to
            * hold". Non-zero on `tests/roster.js` and on the differential's turn-to-turn credit. */
           post_faint_not_held_same_engine: stats.post_faint_not_held_same_engine,
           /* AND A BOARD THAT CANNOT SAY WHICH ENGINE MADE IT. Such a pair is treated as CROSS — the
            * behaviour every caller had before the scoping existed — and says so, because a silent
            * fallback is how a rule ends up applying somewhere nobody meant it to. */
           post_faint_engine_unstamped: !!stats.post_faint_engine_unstamped,
           screens_shape_medicham: medi.sides.p1.screens.shape,
           screens_named_comparable: !!(medi.sides.p1.screens.named && sd.sides.p1.screens.named),
           /* THE PP RECEIPT. Counted over every occupied slot on both sides, so "PP agreed" and "PP
            * was never asked" can be told apart — which is the whole of `docs/LESSONS.md` §1. */
           pp_comparable: (() => {
             /* `held` IS A RECEIPT AND NOT A SETTING. A caller that asks for the hold says so in every
              * snapshot it takes, so a run in which PP was never compared can never be read as a run
              * in which PP agreed. See tests/roster.js for the only caller that asks. */
             if (ctx.ppHold) return { held_by_the_caller: true, slots_occupied: null, slots_compared: 0,
               why: 'THE CALLER ASKED FOR PP TO BE HELD. Nothing below says PP agrees; it says PP was '
                  + 'not asked. board_state.js compares it by default.' };
             let both = 0, occupied = 0;
             for (const s of ['p1', 'p2']) for (let i = 0; i < 2; i++) {
               const a = (medi.sides[s].pp || [])[i], b = (sd.sides[s].pp || [])[i];
               if (medi.sides[s].active[i] || sd.sides[s].active[i]) occupied++;
               if (a && b) both++;
             }
             return { slots_occupied: occupied, slots_compared: both };
           })() };
}

/* ---- WHICH OF THE AUTHORITY'S OWN NAMES THIS FILE READS, DERIVED FROM THE READERS THEMSELVES -----
 *
 * WHY THIS EXISTS (2026-08-19). A caller that wants to say "these boards are identical" honestly has
 * to be able to say WHICH leaves it looked at, and a caller that wants to qualify an
 * ANNOUNCEMENT-ONLY verdict has to be able to ask "is the volatile this mechanic writes even in the
 * comparison?" `NOT_COMPARED` answers that only for the omissions somebody thought to write down —
 * and the whole argument of this file is that an UNLISTED omission reads exactly like agreement.
 *
 * THE THREE THIS PARAGRAPH NAMED ARE COMPARED NOW (ROADMAP #308), and the sentence is corrected here
 * rather than deleted because it is the record of how the hole was found: it used to read *"Fairy
 * Lock's `fairylock` pseudo-weather, Uproar's `uproar` and Spirit Shackle's `trapped` are all absent
 * from the comparison AND absent from `NOT_COMPARED`"*, and each of those three rows was coming back
 * ANNOUNCEMENT-ONLY for exactly that reason. Two of them turned out to be unimplemented MECHANICS
 * rather than unread leaves, which is the thing a comparison silently agreeing cannot tell you.
 *
 * IT IS READ OUT OF THE READER'S OWN SOURCE AND NOT TYPED BESIDE IT. A hand-kept list of the keys
 * `sdBody` reads would agree with `sdBody` on the day it was written and diverge the first time
 * either moved — the ban-list-of-four failure CLAUDE.md records, and the two-copies-of-one-fact rule
 * it states. Reading `String(sdBody)` cannot drift, because there is only one thing to read.
 *
 * THE AUTHORITY'S VOCABULARY, DELIBERATELY. A caller asks this question holding a Showdown move or
 * ability entry, whose `volatileStatus` is Showdown's name; medicham2's spelling would be the wrong
 * key. */
const _srcKeys = (fn, re) => [...new Set([...String(fn).matchAll(re)].map(m => m[1]))].sort();
const SD_VOLATILE_KEYS = _srcKeys(sdBody, /\bv\.([a-z][a-z0-9]*)/g);
const SD_SIDE_KEYS = _srcKeys(readShowdown, /sideConditions\s*\|\|\s*\{\}\)\.([a-z][a-z0-9]*)/g)
  .concat(GAME_RULES.SCREEN_KEYS).sort();
const SD_PSEUDO_KEYS = _srcKeys(readShowdown, /pseudoWeather\s*\|\|\s*\{\}\)\.([a-z][a-z0-9]*)/g);
/* A DERIVATION THAT SILENTLY RETURNS NOTHING IS A SILENT DEFAULT, and this one would then tell every
 * caller that no leaf is compared — which reads as "everything is uncomparable" and is just as wrong
 * in the other direction. It is asserted at load, loudly, rather than checked by whoever remembers. */
if (!SD_VOLATILE_KEYS.length || !SD_SIDE_KEYS.length) {
  throw new Error('board_state.js: the compared-key derivation read NOTHING out of its own readers. '
    + 'Every caller asking "is this leaf compared?" would get a wrong answer. Not a pass.');
}

/* ---- WHICH LEAVES A MECHANIC WRITES, AND WHETHER THIS FILE READS THEM --------------------------
 *
 * MOVED HERE FROM `all_mechanics_fire.js` ON 2026-08-28 AND NOT COPIED. It lived beside the one
 * caller that asked, and a second caller now needs the same answer: `tests/probe_uncompared_leaves.js`
 * enumerates the WHOLE class rather than the rows one run happened to stage. Two implementations of
 * "which leaf does this mechanic write" would agree the day they were written and rot after — the
 * two-copies-of-one-fact breach CLAUDE.md names — and this file is where the answer belongs, because
 * it owns both halves of the comparison: `SD_VOLATILE_KEYS` (what is read) and `NOT_COMPARED` (what is
 * declared). The caller keeps the dex lookup; nothing here requires a simulator.
 *
 * THE ORIGINAL HEADER, WHICH IS THE RECORD OF WHY THE WALK IS SHAPED THIS WAY:
 *
 * THE RULE THIS EXISTS FOR: **a leaf you cannot compare reads as agreement.** An ANNOUNCEMENT-ONLY
 * verdict is a claim that the boards are identical IN THE FIELDS WE LOOK AT, and it is worth very
 * little without the list of fields we do not — especially when the field we do not look at IS THE
 * MECHANIC. Measured on the first run of that instrument: Fairy Lock's entire effect is a `fairylock`
 * pseudo-weather, Uproar's is an `uproar` volatile and Spirit Shackle's is a `trapped` volatile, and
 * this file read none of the three — nor did any of them appear in `NOT_COMPARED`, which only ever
 * listed the omissions somebody thought to write down.
 *
 * DERIVED FROM THE AUTHORITY'S OWN ENTRY, NEVER FROM A LIST HERE. The entry is walked recursively —
 * `volatileStatus`, `sideCondition`, `slotCondition`, `pseudoWeather` at any depth, plus every
 * function anywhere in it stringified and scanned for `addVolatile` / `addSideCondition` /
 * `addPseudoWeather`. A shallow version of this walk missed three rows outright (Spirit Shackle's
 * trap is inside `secondaries[0].onHit`; Beak Blast's and Focus Punch's own volatiles come from a
 * `priorityChargeCallback`), and a derivation that UNDER-reports blind spots is worse than none.
 *
 * AND IT OVER-MATCHED FIRST, WHICH IS WHY THE FALSY GUARD IS THERE AND SAID OUT LOUD. Every dex entry
 * carries `volatileStatus: undefined` as a real key, so the first walk reported `volatile:undefined`
 * on twelve of twenty-one rows. docs/ENGINE.md: a new derived predicate over-matches; print what it
 * matched before wiring it. */
const _lnorm = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
function writtenLeaves(entry) {
  const acc = { volatile: new Set(), side: new Set(), slot: new Set(), pseudo: new Set(), src: [] };
  const seen = new Set();
  (function walk(e, depth) {
    if (!e || depth > 4) return;
    if (typeof e === 'function') { acc.src.push(String(e)); return; }
    if (typeof e !== 'object') return;
    if (seen.has(e)) return; seen.add(e);
    for (const [k, v] of Object.entries(e)) {
      if (v === undefined || v === null || v === false || v === '') continue;   // the over-match guard
      if (k === 'volatileStatus') acc.volatile.add(_lnorm(v));
      else if (k === 'sideCondition') acc.side.add(_lnorm(v));
      else if (k === 'slotCondition') acc.slot.add(_lnorm(v));
      else if (k === 'pseudoWeather') acc.pseudo.add(_lnorm(v));
      walk(v, depth + 1);
    }
  })(entry, 0);
  const src = acc.src.join('\n');
  for (const m of src.matchAll(/addVolatile\(\s*['"]([a-z0-9]+)['"]/gi)) acc.volatile.add(_lnorm(m[1]));
  for (const m of src.matchAll(/addSideCondition\(\s*['"]([a-z0-9]+)['"]/gi)) acc.side.add(_lnorm(m[1]));
  for (const m of src.matchAll(/addSlotCondition\(\s*[^,]+,\s*['"]([a-z0-9]+)['"]/gi)) acc.slot.add(_lnorm(m[1]));
  for (const m of src.matchAll(/addPseudoWeather\(\s*['"]([a-z0-9]+)['"]/gi)) acc.pseudo.add(_lnorm(m[1]));
  return acc;
}
/* THE LEAVES THIS ENTRY WRITES THAT THIS FILE DOES NOT READ. Unchanged from the version that lived in
 * `all_mechanics_fire.js`, INCLUDING the fact that it says nothing about `NOT_COMPARED`: a declared
 * leaf is still an unread one, and a verdict that rests on it is still unasked. The two questions are
 * answered separately — `DECLARED_LEAVES` below is the second. */
function uncomparableLeavesOf(entry) {
  if (!entry || !entry.exists) return [];
  const w = writtenLeaves(entry);
  const out = [];
  const V = new Set(SD_VOLATILE_KEYS), S = new Set(SD_SIDE_KEYS), P = new Set(SD_PSEUDO_KEYS);
  for (const v of w.volatile) if (!V.has(v)) out.push('volatile:' + v);
  for (const v of w.side) if (!S.has(v)) out.push('sideCondition:' + v);
  for (const v of w.pseudo) if (!P.has(v)) out.push('pseudoWeather:' + v);
  for (const v of w.slot) out.push('slotCondition:' + v);   // this file reads no slot condition
  return out.sort();
}
/* THE DECLARED HALF, MACHINE-READABLE SINCE 2026-08-28. `NOT_COMPARED` is prose, and prose cannot be
 * checked: an enumerator asking "is this leaf declared?" had to string-match the paragraphs, which
 * credited `volatile:counter` to a row about the STATUS counter and `volatile:unburden` to a row that
 * merely names Unburden as a READER. Two false clearances out of seven. Each row now carries the
 * leaves it actually declares — `[]` where it declares none, which is itself an answer. */
const DECLARED_LEAVES = new Set(NOT_COMPARED.reduce((a, r) => a.concat(r.leaves || []), []));

module.exports = { readMedi, readShowdown, compare, snapshot, family, mappingProof, locate, bucket,
                   writtenLeaves, uncomparableLeavesOf, DECLARED_LEAVES,
                   stableKey, PARTY_KEY_IDENTITY,
                   explain, MAPPINGS, NOT_COMPARED, PHYSICAL_SCREENS, SPECIAL_SCREENS,
                   SD_VOLATILE_KEYS, SD_SIDE_KEYS, SD_PSEUDO_KEYS,
                   _internals: { num, layers, dur, sleptTurns, frozenTurns, mediBoosts, sdBoosts,
                                 mediScreens, sdScreens, sdPP, mediBody, sdBody } };
