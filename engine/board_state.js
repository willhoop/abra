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
 * Room, the move-trap, Perish, Taunt, Encore, Disable, the toxic stage and the sleep counter.
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
       + 'duration`) — and it is the half that carries a counter and chip damage.' },
  { field: 'item DISPOSITION (eaten vs knocked off vs used)',
    why: 'medicham2 has no `lastItem` and no `ateBerry`: once an item is gone the body records only '
       + 'that it is gone. The current item IS compared, which is the fact that changes damage and '
       + 'speed. The disposition is already a published finding (data/game-differential.json '
       + 'knock_off_roadmap_80: Showdown records Colbur as EATEN BY ITSELF, medicham2 as KNOCKED OFF) '
       + 'and Harvest, Recycle, Belch, Cud Chew and Unburden are what read it.' },
  { field: 'PP',
    why: 'medicham2 does not track PP at all. Nothing in a 12-turn horizon reaches a PP wall, and '
       + 'reporting it would put a known, permanent, whole-population divergence on top of every '
       + 'other number in the run.' },
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
  check('sleep-counter-is-turns-slept', sleptTurns({ startTime: 3, time: 1 }) === 2,
        sleptTurns({ startTime: 3, time: 2 }) !== sleptTurns({ startTime: 3, time: 1 }));
  return out;
}

/* ---- SMALL READERS, ONE EACH, SO A MAPPING HAS ONE IMPLEMENTATION ------------------------------ */
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
const layers = c => (!c ? 0 : (typeof c === 'object' && typeof c.layers === 'number' ? c.layers : 1));
const dur = c => (!c ? 0 : num(c.duration));
const sleptTurns = ss => (!ss ? 0 : Math.max(0, num(ss.startTime) - num(ss.time)));
/* ONE FUNCTION FOR BOTH ENGINES — see the `fainted-is-not-a-status` mapping. A dead body reads `fnt`
 * whichever engine holds it; a living one reads whatever status it actually carries. */
const statusOf = (fainted, status) => (fainted ? 'fnt' : String(status || ''));
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
  SCREEN_KEYS: ['reflect', 'lightscreen', 'auroraveil'],
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
     * number of turns already slept when asleep, 0 otherwise. Two engines, one quantity. */
    status_counter: m.status === 'tox' ? num(m.toxTurns) : (m.status === 'slp' ? num(m.slpTurns) : 0),
    item: id(m.item || ''),
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
                  : (p.status === 'slp' ? sleptTurns(p.statusState) : 0),
    item: id(p.item || ''),
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
  let m = /^(p[12])\.active\[(\d+)\]\.(.+)$/.exec(p);
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
           screens_named_comparable: !!(medi.sides.p1.screens.named && sd.sides.p1.screens.named) };
}

module.exports = { readMedi, readShowdown, compare, snapshot, family, mappingProof, locate, bucket,
                   explain, MAPPINGS, NOT_COMPARED, PHYSICAL_SCREENS, SPECIAL_SCREENS,
                   _internals: { num, layers, dur, sleptTurns, mediBoosts, sdBoosts, mediScreens, sdScreens } };
