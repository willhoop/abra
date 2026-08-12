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
              + 'the roster says so per-entity rather than this file asserting it.' },
  { field: 'item DISPOSITION (eaten vs knocked off vs used)',
    why: 'medicham2 has no `lastItem` and no `ateBerry`: once an item is gone the body records only '
       + 'that it is gone. The current item IS compared, which is the fact that changes damage and '
       + 'speed. The disposition is already a published finding (data/game-differential.json '
       + 'knock_off_roadmap_80: Showdown records Colbur as EATEN BY ITSELF, medicham2 as KNOCKED OFF) '
       + 'and Harvest, Recycle, Belch, Cud Chew and Unburden are what read it.' },
  /* PP WAS HERE AND IS NOW COMPARED. The entry read "medicham2 does not track PP at all", which was
   * true when it was written and stopped being true at ROADMAP #144 — the engine has held a full `_pp`
   * map, `ppMax`/`ppLeft`/`ppDeduct` and four counters since. The declaration outlived what it
   * described, which is this repository's most expensive recurring failure, and while it stood PP
   * could have been wrong in every game with nothing to notice. See the `pp-is-what-has-been-spent`
   * mapping for the lazy/eager difference, which is real and is declared rather than collapsed. */
  { field: 'the stall counter behind consecutive Protect',
    why: 'medicham2 holds `tookProtectTurns` (a count UP of consecutive successful shields) and '
       + 'Showdown holds a `stall` volatile with a `counter` that is a DENOMINATOR (3, 9, 27). They '
       + 'are different quantities, not two spellings of one, and a mapping between them would be '
       + 'this file inventing a rule. The SHIELD itself is a within-turn effect and is not board '
       + 'state at the boundary.' },
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
function partyMap(rows, fails) {
  const out = {};
  for (const r of rows) {
    if (out[r.species] && fails) {
      fails.duplicate_species_in_party = (fails.duplicate_species_in_party || 0) + 1;
      fails.duplicate_species_first = fails.duplicate_species_first || r.species;
    }
    out[r.species] = { hp: r.hp, maxhp: r.maxhp, fainted: r.fainted };
  }
  return out;
}

/* ---- ONE BODY --------------------------------------------------------------------------------- */
function mediBody(m, id) {
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
    item: id(m.item || ''),
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
    },
  };
}
function sdBody(p, id) {
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
    /* ROADMAP #225 -- the authority's side of the same two leaves.  is the METHOD, not
     * the species default: it answers what the body is RIGHT NOW, after a mega, a Protean or a Soak,
     * which is exactly the question.  is the live slot, so Skill Swap and Trace show. */
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
    },
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
    party: partyMap(((sf && sf.team) || []).map(m => ({ species: id(m.name), hp: Math.max(0, num(m.curHP)),
                                                        maxhp: num(m.st && m.st.hp), fainted: !!m.fainted })),
                    ctx.fails),
    active: [0, 1].map(i => mediBody(act[i], id)),
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
             trickroom_turns: num(F.tr) },
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
    party: partyMap((sd.pokemon || []).map(p => ({ species: id(p.species && p.species.id),
                                                   hp: Math.max(0, num(p.hp)), maxhp: num(p.maxhp),
                                                   fainted: !!p.fainted })), ctx.fails),
    active: [0, 1].map(i => sdBody((sd.active || [])[i], id)),
    /* HELD ON BOTH SIDES OR NEITHER. A hold that only silenced OUR side would leave Showdown's map
     * walking against `null` and report every move as present-in-one-engine-only — a manufactured
     * divergence, which is worse than the thing being held. */
    pp: [0, 1].map(i => (!ctx.ppHold && (sd.active || [])[i] ? sdPP((sd.active || [])[i]) : null)),
  });
  return {
    engine: 'showdown',
    field: { weather: xl('weather', F.weather), weather_turns: dur(F.weatherState),
             terrain: xl('terrain', F.terrain), terrain_turns: dur(F.terrainState),
             trickroom_turns: dur((F.pseudoWeather || {}).trickroom) },
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

function compare(medi, sd, stats) {
  const out = [];
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
    walk(A.party, B.party, s + '.party', out, stats);
    walk(A.active, B.active, s + '.active', out, stats);
    /* PP, PER SLOT, ONLY WHERE BOTH ENGINES CAN EXPRESS IT — the same rule and the same reason as
     * `screens.named` two lines up. Skipped LOUDLY: `pp_comparable` rides on every snapshot, so an
     * engine that cannot answer is a receipt and never an agreement. */
    for (let i = 0; i < 2; i++) {
      const ap = (A.pp || [])[i], bp = (B.pp || [])[i];
      if (ap && bp) walk(ap, bp, s + '.pp[' + i + ']', out, stats);
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
  const stats = { compared: 0 };
  const diffs = compare(medi, sd, stats);
  return { medi, sd, diffs,
           identical: diffs.length === 0,
           leaves_compared: stats.compared,
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

module.exports = { readMedi, readShowdown, compare, snapshot, family, mappingProof, locate, bucket,
                   explain, MAPPINGS, NOT_COMPARED, PHYSICAL_SCREENS, SPECIAL_SCREENS,
                   _internals: { num, layers, dur, sleptTurns, frozenTurns, mediBoosts, sdBoosts,
                                 mediScreens, sdScreens, sdPP } };
