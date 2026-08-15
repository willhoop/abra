/* test-protocol-trace.js — MEDICHAM EMITS A SHOWDOWN-SHAPED PROTOCOL TRACE, AND IT PROVES IT RAN.
 *
 *   node tests/test-protocol-trace.js                              parts 1-4 and 6
 *   SHOWDOWN_PATH=... node tests/test-protocol-trace.js            + part 5, the acceptance test
 *
 * ROADMAP #68, step one. docs/GAME-DIFFERENTIAL-DESIGN.md §5 wants the two engines diffed by EVENT
 * STREAM rather than by end-of-turn state, because Showdown's protocol log is already a step-level
 * trace labelled with the mechanism that made each decision. Showdown emits one; medicham2 emitted
 * nothing; this file is the guard on the half that was missing.
 *
 * WHY A COUNTER IS NOT ENOUGH AND WHY THIS FILE PLAYS REAL GAMES
 * --------------------------------------------------------------
 * CLAUDE.md: *"A capability that cannot prove it ran is assumed broken."* A trace facility fails in
 * exactly the shape this repository keeps paying for -- it is wired, it is exported, it allocates its
 * array, and it emits nothing, and every downstream instrument reads the silence as agreement. So:
 *
 *   PART 1  every event in medicham2's own TRACE_EVENTS must FIRE in a real game. A claimed event
 *           that never appears is a dead arm, and the test names it.
 *   PART 2  the RATE FLOORS, because non-zero is not always a strong enough bar (CLAUDE.md, the mega
 *           lesson: 56% of sides passed "at least one happened" against a correct 85%). Every game
 *           emits `|move|`. A game in which HP moved emits `|-damage|`. A game whose lead has
 *           Intimidate emits `|-ability|` AND `|-unboost|`, in that order.
 *   PART 3  OFF BY DEFAULT, and the control is explicit: the same game played without a trace must
 *           leave the module-level sink null and produce a byte-identical final state.
 *   PART 4  the counts are PARSED out of the stream, never kept beside it.
 *   PART 5  THE ACCEPTANCE TEST -- see its own header.
 *   PART 6  MEDFAILS.traceBodyOffField must be 0: every emitted identifier resolved to a real slot.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
/* Resolves SHOWDOWN_PATH from the sibling checkout, exactly as every other engine test does — see
 * that file's header for why a guard that opts itself out of its own authority is not a guard. */
require(D('engine', 'showdown_path.js'));
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL  ' + msg); };
const pass = (msg) => console.log('  ok    ' + msg);

const mon = (key, moves, ability, item) => {
  const b = M.buildMon(key, {});
  if (!b) throw new Error('no MC row for ' + key);
  b.moves = moves.slice();
  if (ability) b.ability = ability;
  b.item = item || '';
  return b;
};
/* A reproducible stream. Math.random would make a red run unrepeatable, which is the one thing a
 * failing test must not be. */
const mkRng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };

/* Drive both sides from a fixed script, exactly as tests/test-game-diff.js does: nothing is chosen
 * by a policy, so a run is a function of its seed. `null` in a slot means "let the engine choose",
 * which is what fills the long games in part 1. */
function play(teamA, teamB, script, seed) {
  const A = teamA(), B = teamB();
  const trace = [];
  const S = M.battleInit(A, B, { trace });
  const rng = mkRng(seed == null ? 7 : seed);
  for (let t = 0; t < script.length; t++) {
    const step = script[t];
    const mk = (own, foes, acts) => {
      if (!acts) return undefined;
      const map = new Map();
      own.forEach((mm, i) => {
        if (!mm || mm.fainted) return;
        const act = acts[i];
        if (act === undefined || act === null) return;      // engine chooses for this slot
        if (act.sw) {
          const bench = own === S.actA ? S.benchA : S.benchB;
          const want = bench.find(x => x && x.name === act.sw && !x.fainted);
          if (want) map.set(mm, { kind: 'switch', to: want });
          return;
        }
        /* ROADMAP #31 — `mega: true` on a scripted click is Showdown's `move N mega`. The engine's
         * own auto-mega policy is left ON in this file (battleInit's default), so a scenario can
         * reach the events either way; the flag exists so the EXPLICIT path is exercised too and a
         * dead explicit door cannot hide behind a live automatic one. */
        const _a = M.playerAction(mm, act.m, act.t != null ? foes[act.t] : null, S.field);
        if (act.mega && _a) _a.mega = true;
        map.set(mm, _a);
      });
      return map;
    };
    M.battleTurn(S, rng, mk(S.actA, S.actB, step.a), mk(S.actB, S.actA, step.b));
    if (M.battleOver(S)) break;
  }
  return { S, trace };
}

/* ================= PART 1 — EVERY CLAIMED EVENT FIRES IN A REAL GAME ============================
 * The scenarios are chosen to REACH mechanics, not to play well -- §3.3's coverage-seeking driver in
 * miniature. Each one names what it is here to make happen. */
console.log('\nPART 1 — every event in TRACE_EVENTS fires');

const SCENARIOS = [
  /* THIEF, NOT KNOCK OFF, AND INCINEROAR HOLDS NOTHING — REPAIRED 2026-08-14 (ROADMAP #266).
   * TeamValidator: "Incineroar can't learn Knock Off." Derived rather than recalled: Incineroar's
   * legal item-removal click in this regulation is THIEF (checkCanLearn, Champions Reg M-B), which is
   * also Dark, physical and contact, so the Rough Skin punish this scenario is named for is unchanged.
   * THE ITEM HAD TO GO WITH IT: `data/moves.ts:19305` — `if (source.item || source.volatiles['gem'])
   * return;` — so a Thief thrown by a body already holding something takes nothing, and the removal
   * event would have vanished silently. The Sitrus Berry event is NOT lost: Azumarill in this same
   * scenario holds one and Belly Drums to half HP, which is what actually eats it. COST, named: the
   * Focus Sash now MOVES to Incineroar instead of being destroyed, and Incineroar no longer has a
   * berry of its own to eat. */
  ['entry, weather, Intimidate, Fake Out flinch, contact punish, Sitrus, Thief, faint, switch',
    () => [mon('incineroar', ['fakeout', 'thief', 'flareblitz', 'protect'], 'intimidate', ''),
           mon('torkoal', ['eruption', 'protect', 'bodypress', 'yawn'], 'drought', 'charcoal'),
           mon('azumarill', ['bellydrum', 'aquajet', 'protect', 'playrough'], 'hugepower', 'sitrusberry')],
    () => [mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', 'focussash'),
           mon('tyranitar', ['rockslide', 'crunch', 'protect', 'taunt'], 'sandstream', 'leftovers'),
           /* HELPING HAND, NOT TRICK ROOM — REPAIRED 2026-08-14 (#266). "Clefable can't learn Trick
            * Room." This body sits on the bench for the whole scripted game and the slot is never
            * clicked, so the move is decoration; Helping Hand is derived legal for Clefable and is
            * the quietest of the five it can learn. The Trick Room EVENT is staged deliberately in
            * the next scenario, on a body that can legally set it. */
           mon('clefable', ['moonblast', 'protect', 'followme', 'helpinghand'], 'unaware', 'leftovers')],
    [{ a: [{ m: 'fakeout', t: 0 }, { m: 'protect' }], b: [{ m: 'earthquake' }, { m: 'protect' }] },
     { a: [{ m: 'thief', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'protect' }, { m: 'rockslide' }] },
     { a: [{ m: 'flareblitz', t: 0 }, { m: 'bodypress', t: 1 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] },
     { a: [{ m: 'flareblitz', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  /* TWO BODIES RE-AIMED 2026-08-14 (ROADMAP #266), both because the click was illegal rather than
   * because anything about the scenario was wrong.
   *
   * AROMATISSE SETS THE TRICK ROOM. "Clefable can't learn Trick Room." Derived, not chosen: exactly
   * THREE declarable bodies in this regulation learn Trick Room, Reflect, Protect and Moonblast
   * together, and Aromatisse is the only one that is FAIRY — so Moonblast keeps its STAB and the
   * Gengar's Shadow Ball stays neutral into this slot instead of doubling, which a Psychic body would
   * have changed. COST, named: 29 base Speed against Clefable's 60, so under its own Trick Room this
   * slot now moves FIRST on its side rather than in the middle; and Aroma Veil in place of Unaware,
   * which could never have fired here because nothing in this scenario boosts.
   *
   * PRIMARINA SINGS THE PERISH SONG. "Slowking can't learn Perish Song" and "can't learn Haze" — two
   * verdicts on one bench body. Exactly four declarable bodies learn Perish Song, Haze and Protect
   * together; Primarina is the bulky special Water of them, which is the role Slowking held, and its
   * fourth click is WATER PULSE because it cannot learn Scald either. COST, named: 60 base Speed
   * against Slowking's 30, which removes a speed TIE with the Snorlax under Trick Room — no body in
   * this regulation carries that move pair at 30 Speed, so the tie cannot be preserved. */
  ['Trick Room, Tailwind, screens, Substitute, Taunt, Leech Seed, Haze, White Herb, Perish Song',
    () => [mon('aromatisse', ['trickroom', 'reflect', 'protect', 'moonblast'], 'aromaveil', 'whiteherb'),
           mon('whimsicott', ['tailwind', 'taunt', 'leechseed', 'moonblast'], 'prankster', 'focussash'),
           mon('primarina', ['perishsong', 'haze', 'protect', 'waterpulse'], 'torrent', 'leftovers')],
    () => [mon('gengar', ['substitute', 'shadowball', 'protect', 'sludgebomb'], 'cursedbody', 'leftovers'),
           mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'leftovers'),
           /* LEFTOVERS, NOT BLACK SLUDGE -- 2026-08-14. TeamValidator: "Toxapex's item Black Sludge
            * does not exist in Gen 9." An EXISTENCE verdict is always wrong -- it is not a pairing an
            * isolation probe could be staging on purpose -- and Leftovers is the legal item with the
            * same job. This body is on the bench for the whole scenario and is never sent in, so the
            * repair moves no board. WATER PULSE, NOT SCALD -- 2026-08-14 (#266): "Toxapex can't learn
            * Scald" either, and Water Pulse is the 100-accurate single-target Water move it CAN learn
            * (checkCanLearn). The slot is never clicked in this scenario. */
           mon('toxapex', ['toxic', 'recover', 'protect', 'waterpulse'], 'regenerator', 'leftovers')],
    [{ a: [{ m: 'trickroom' }, { m: 'tailwind' }], b: [{ m: 'substitute' }, { m: 'bodyslam', t: 0 }] },
     { a: [{ m: 'reflect' }, { m: 'taunt', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
     { a: [{ m: 'moonblast', t: 0 }, { m: 'leechseed', t: 1 }], b: [{ m: 'shadowball', t: 0 }, { m: 'bodyslam', t: 0 }] },
     { a: [{ m: 'protect' }, { m: 'moonblast', t: 0 }], b: [{ m: 'sludgebomb', t: 0 }, { m: 'bodyslam', t: 1 }] },
     { a: [{ sw: 'slowking' }, { m: 'moonblast', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
     { a: [{ m: 'haze' }, { m: 'moonblast', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'yawn', t: 0 }] },
     { a: [{ m: 'perishsong' }, { m: 'moonblast', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  ['charge turn, recharge, phaze, hazards, Trick, status, terrain, immunity, always-crit',
    /* FOUR ILLEGAL DECLARATIONS IN ONE SCENARIO, REPAIRED TOGETHER 2026-08-14 (#266), because they
     * were load-bearing for four different events and could not be taken one at a time.
     *
     * ROTOM CARRIES THE LEVITATE. **Gengar has exactly ONE ability in Champions Reg M-B and it is
     * CURSED BODY** — `dex.species.get('gengar').abilities` is `{"0":"Cursed Body"}` — so the
     * `|-immune|` this scenario stages, the partner shrugging off the Torterra's Earthquake, was
     * staged on an ability that body cannot have. Derived: ELEVEN legal bodies carry Levitate here and
     * only Rotom and its formes also learn Will-O-Wisp, Trick and Shadow Ball; base Rotom is the one
     * with an engine-data row. It cannot learn Hyper Beam, so the RECHARGE moves — see below.
     *
     * MAMOSWINE PHAZES. "Snorlax can't learn Roar", and Snorlax learns no phazing move at all in this
     * regulation (Roar, Whirlwind, Dragon Tail and Circle Throw all read `no`). Its partner Mamoswine
     * does, and Mamoswine's fourth slot was a Protect it never clicked.
     *
     * MEGANIUM SETS THE TERRAIN AND THROWS THE HYPER BEAM. Politoed can learn neither Grassy Terrain
     * nor Scald here — no terrain move at all — and it is the body this scenario DRAGS IN, so from the
     * phaze onwards it is the one receiving the slot-0 script. Meganium is derived from the
     * intersection of the Grassy Terrain carriers with the Hyper Beam carriers, and holds both events
     * on the one body that is actually on the field when the script asks for them. COST, named: the
     * scenario no longer carries a rain setter or a Damp Rock, neither of which it ever used — the
     * weather events in this file come from the Torkoal and the Tyranitar in scenario 1. */
    () => [mon('torterra', ['solarbeam', 'stealthrock', 'earthquake', 'protect'], 'overgrow', 'leftovers'),
           mon('rotom', ['shadowball', 'willowisp', 'trick', 'protect'], 'levitate', 'lumberry'),
           /* 'dampro' NAMED NOTHING AT ALL AND THE FIXTURE REPORTED SUCCESS -- fixed 2026-08-14.
            * This is not an illegal pairing, which is why no validator verdict could ever have caught
            * it: `dex.items.get('dampro')` returns a row that does not exist, whose `.name` is the
            * empty string, and an empty item is a LEGAL item -- so this Politoed was built HOLDING
            * NOTHING and every check went green. It is the shape CLAUDE.md calls "a capability was
            * absent and everything reported success", sitting inside a test. The intended item is
            * DAMP ROCK, which this same file already spells correctly at the Perish Song scenario
            * below. `engine/fixture_legality.js` reports stray literals separately from illegal sets
            * for exactly this reason. */
           mon('meganium', ['grassyterrain', 'hyperbeam', 'protect', 'bodyslam'], 'overgrow', 'leftovers')],
    () => [mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'leftovers'),
           mon('mamoswine', ['iciclecrash', 'earthquake', 'roar', 'iceshard'], 'thickfat', 'focussash'),
           mon('meowscarada', ['flowertrick', 'knockoff', 'protect', 'uturn'], 'overgrow', '')],
    /* THE PHAZE MOVED FROM TURN 1 TO TURN 2, AND THAT IS A REPAIR RATHER THAN A PREFERENCE. Roar is
     * priority -6, so a turn-1 Roar aimed at slot 0 dragged the Torterra out at the END of its own
     * CHARGING turn: the Solar Beam never released, and every slot-0 click from turn 2 on belonged to
     * whoever had been dragged in rather than to the Torterra the script names. One turn later the
     * beam fires first and the drag still happens with a full bench behind it — measured, not
     * assumed: at turn 4 the drag produced nothing at all in any of the four seeds, because by then
     * the Torterra had usually fainted and there was no body left to drag in. */
    [{ a: [{ m: 'solarbeam', t: 0 }, { m: 'willowisp', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'earthquake' }] },
     { a: [{ m: 'stealthrock' }, { m: 'shadowball', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'roar', t: 0 }] },
     { a: [{ m: 'hyperbeam', t: 0 }, { m: 'trick', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'earthquake' }] },
     { a: [{ m: 'protect' }, { m: 'shadowball', t: 0 }], b: [{ sw: 'meowscarada' }, { m: 'iceshard', t: 0 }] },
     { a: [{ m: 'grassyterrain' }, { m: 'shadowball', t: 0 }], b: [{ m: 'flowertrick', t: 0 }, { m: 'iciclecrash', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  /* The five events the three scenarios above never reached, each one clicked ON PURPOSE. A scenario
   * written to make a game happen will not reach a Lum Berry or a White Herb, and "we played a lot of
   * games" is not coverage -- §5's own rule pointed at this file. */
  /* GALLADE BURNS AND BOOSTS — REPAIRED 2026-08-14 (#266). TWO verdicts sat on the Clefable here, and
   * only one of them was visible: TeamValidator stops at the first illegal move in a set, so it
   * reported "Clefable can't learn Will-O-Wisp" and never got as far as Swords Dance, which Clefable
   * cannot learn either. Derived: exactly four declarable bodies learn Will-O-Wisp, Swords Dance,
   * Trick and Protect together, and Gallade is the only one that is not part Ghost — the other three
   * would be IMMUNE to the Snorlax's Body Slam and would take no damage at all for the whole game.
   * COST, named: 80 base Speed against Clefable's 60, so this slot now outruns its own Politoed
   * partner; and Steadfast in place of Unaware, neither of which can fire here. */
  ['setup boost, Lum Berry cure, White Herb restore, Trick, Perish Song',
    () => [mon('gallade', ['willowisp', 'swordsdance', 'trick', 'protect'], 'steadfast', 'leftovers'),
           /* WATER PULSE, NOT SCALD, HERE AND ON THE TOXAPEX BELOW — 2026-08-14 (#266). Neither body
            * can learn Scald in this regulation. Water Pulse is 100-accurate and single-target like
            * Scald; COST: its secondary is a 20% confusion rather than a 30% burn, and the burn this
            * scenario needs is the Will-O-Wisp above, which is what the Lum Berry is here to cure. */
           mon('politoed', ['icywind', 'perishsong', 'protect', 'waterpulse'], 'drizzle', 'damprock')],
    () => [mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'lumberry'),
           mon('toxapex', ['waterpulse', 'recover', 'protect', 'toxic'], 'regenerator', 'whiteherb')],
    [{ a: [{ m: 'willowisp', t: 0 }, { m: 'icywind', t: 1 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: [{ m: 'swordsdance' }, { m: 'perishsong' }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: [{ m: 'trick', t: 1 }, { m: 'waterpulse', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: [{ m: 'protect' }, { m: 'waterpulse', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: null, b: null }, { a: null, b: null }]],

  /* ROADMAP #31 — MEGA EVOLUTION, BOTH DOORS. `|detailschange|` and `|-mega|` were declared
   * not-emitted until 2026-08-07 with the reason "mega evolution happens in buildMon BEFORE
   * battleInit"; the evolution is a mid-turn choice now, so the claim moved into TRACE_EVENTS and
   * part 1 above is what holds it to it.
   *
   * TWO SIDES, TWO DOORS, ON PURPOSE. Side A is told explicitly (`mega: true`, Showdown's
   * `move N mega`); side B holds a stone and says nothing, so the engine's own policy has to reach
   * it. A single-sided scenario would let a dead door hide behind a live one — which is exactly how
   * the joint layer silently disabled mega evolution in this project on 2026-08-01.
   *
   * AND THE RIGHT-HAND SLOT MEGAS, not the left, because "the base class could only mega from the
   * LEFT slot" is the defect this file's rate floors exist for. */
  ['mega evolution: an explicit choice on one side, the engine\'s own policy on the other',
    () => [mon('clefable', ['moonblast', 'protect', 'followme', 'helpinghand'], 'unaware', ''),
           mon('tyranitar', ['rockslide', 'crunch', 'protect', 'lowkick'], 'sandstream', 'tyranitarite'),
           mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', '')],
    () => [mon('manectric', ['thunderbolt', 'protect', 'snarl', 'voltswitch'], 'lightningrod', 'manectite'),
           mon('milotic', ['scald', 'protect', 'icywind', 'haze'], 'marvelscale', ''),
           mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', '')],
    [{ a: [{ m: 'moonblast', t: 0 }, { m: 'rockslide', mega: true }], b: [{ m: 'thunderbolt', t: 0 }, { m: 'scald', t: 0 }] },
     { a: [{ m: 'moonblast', t: 0 }, { m: 'crunch', t: 0 }], b: [{ m: 'thunderbolt', t: 0 }, { m: 'scald', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  /* ROADMAP #151 — THE MULTI-HIT VOLLEY, CLICKED ON PURPOSE, and it is the same reason the Lum Berry
   * scenario three blocks up exists: none of the twenty games above clicks a move that hits more than
   * once, so `|-hitcount|` — claimed in TRACE_EVENTS the moment the volley became a sequence of real
   * arrivals — could not fire, and part 1 of this file caught exactly that on its first run.
   *
   * THREE PLAN SHAPES IN ONE GAME, so a `-hitcount` that only works for one of them cannot pass:
   * Bullet Seed is the 2-5 family (a drawn count off the authority's twenty-element table), Triple
   * Axel is a fixed count with a per-hit accuracy re-roll, and Beat Up has no `multiHit` row at all —
   * its count is the eligible PARTY, which is `move.multihit = move.allies.length` in the authority.
   * Nobody Protects on the turns the volleys are thrown, because a blocked volley emits nothing. */
  ['multi-hit: a 2-5 volley, a per-hit-accuracy volley, and Beat Up\'s ally plan',
    () => [mon('abomasnow', ['bulletseed', 'protect', 'icebeam', 'energyball'], 'snowwarning', ''),
           mon('empoleon', ['tripleaxel', 'protect', 'surf', 'flashcannon'], 'torrent', ''),
           mon('annihilape', ['beatup', 'protect', 'drainpunch', 'shadowclaw'], 'defiant', '')],
    () => [mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'leftovers'),
           mon('milotic', ['scald', 'protect', 'icywind', 'haze'], 'marvelscale', ''),
           mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', '')],
    [{ a: [{ m: 'bulletseed', t: 0 }, { m: 'tripleaxel', t: 1 }], b: [{ m: 'yawn', t: 0 }, { m: 'icywind' }] },
     { a: [{ m: 'bulletseed', t: 1 }, { m: 'protect' }], b: [{ m: 'bodyslam', t: 0 }, { m: 'scald', t: 0 }] },
     { a: [{ sw: 'annihilape' }, { m: 'tripleaxel', t: 0 }], b: [{ m: 'bodyslam', t: 1 }, { m: 'scald', t: 1 }] },
     { a: [{ m: 'beatup', t: 0 }, { m: 'tripleaxel', t: 1 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'scald', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }]],

  /* ROADMAP #151 — STANCE CHANGE, for the same reason the volley above is here: `|-formechange|` is
   * the NON-PERMANENT forme line, it had no carrier in this engine at all until Stance Change was
   * wired, and no scenario above brings an Aegislash. The four clicks are in the order the mechanic
   * needs — an attack draws the sword, a Status move that is not King's Shield leaves it drawn, and
   * King's Shield alone puts it back — so a line emitted on the wrong trigger cannot pass by firing
   * at all. Nothing on side B Protects while the Aegislash is attacking. */
  ['stance change: the forme follows the click, and a Status move is a no-op rather than a revert',
    () => [mon('aegislash', ['ironhead', 'kingsshield', 'swordsdance', 'shadowball'], 'stancechange', ''),
           mon('clefable', ['moonblast', 'protect', 'followme', 'helpinghand'], 'unaware', ''),
           mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'leftovers')],
    () => [mon('milotic', ['scald', 'protect', 'icywind', 'haze'], 'marvelscale', ''),
           mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', ''),
           /* WATER PULSE, NOT SCALD — 2026-08-14 (#266). Toxapex cannot learn Scald in this
            * regulation; this body is benched for the whole scenario and never clicks. */
           mon('toxapex', ['waterpulse', 'recover', 'protect', 'toxic'], 'regenerator', '')],
    [{ a: [{ m: 'ironhead', t: 0 }, { m: 'moonblast', t: 0 }], b: [{ m: 'icywind' }, { m: 'dragonclaw', t: 0 }] },
     { a: [{ m: 'swordsdance' }, { m: 'moonblast', t: 0 }], b: [{ m: 'scald', t: 0 }, { m: 'dragonclaw', t: 0 }] },
     { a: [{ m: 'kingsshield' }, { m: 'moonblast', t: 0 }], b: [{ m: 'scald', t: 0 }, { m: 'dragonclaw', t: 0 }] },
     { a: [{ m: 'ironhead', t: 1 }, { m: 'moonblast', t: 0 }], b: [{ m: 'scald', t: 0 }, { m: 'dragonclaw', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }]],

  /* ROADMAP #223 — HAZE, CLICKED ON PURPOSE, for the same reason the Lum Berry and the multi-hit
   * volley two blocks up are here. `|-clearallboost|` was CLAIMED in TRACE_EVENTS and fired in none of
   * the 28 games above, and this file was reporting that as a failure: scenario 2 does hold a Haze,
   * but it belongs to a Slowking on the BENCH, and by the turn the script clicks it the body standing
   * in that slot has changed — so the click never reached the branch. The mechanic itself was never
   * broken, which is exactly why a coverage gap must be closed with a scenario and not with a claim
   * removed from TRACE_EVENTS.
   *
   * BOTH FOES BOOST ON TURN 1, so the line cannot be produced by a click that fizzled: the stages are
   * visibly up in the stream and visibly gone after. THE FOES THEN PROTECT ON THE HAZE TURN, and that
   * is measured rather than tidy — the first version of this scenario had them attack and the +2
   * Earthquake KILLED THE MILOTIC BEFORE IT MOVED, so the Haze never happened and the event still did
   * not fire. Haze is not refused by a Protect (it clears the field, it does not target a body), so
   * the shield costs the scenario nothing. */
  ['Haze: both foes boost, then the whole field is cleared',
    () => [mon('milotic', ['haze', 'scald', 'icywind', 'protect'], 'marvelscale', ''),
           mon('clefable', ['moonblast', 'protect', 'followme', 'helpinghand'], 'unaware', ''),
           mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', '')],
    () => [mon('snorlax', ['curse', 'bodyslam', 'protect', 'yawn'], 'thickfat', ''),
           mon('garchomp', ['swordsdance', 'earthquake', 'protect', 'rockslide'], 'roughskin', ''),
           /* WATER PULSE, NOT SCALD — 2026-08-14 (#266), benched body, never clicked. */
           mon('toxapex', ['waterpulse', 'recover', 'protect', 'toxic'], 'regenerator', '')],
    [{ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'curse' }, { m: 'swordsdance' }] },
     { a: [{ m: 'haze' }, { m: 'moonblast', t: 0 }], b: [{ m: 'protect' }, { m: 'protect' }] },
     { a: null, b: null }, { a: null, b: null }]],

  /* 2026-08-12 — PAIN SPLIT, CLICKED ON PURPOSE, and it is here for exactly the reason the Haze
   * scenario one block up is: `|-sethp|` moved into TRACE_EVENTS today and no scenario in this file
   * produces it. `-sethp` has ONE producer in the whole authority (`painsplit.onHit`, two `add` calls,
   * one of them `[silent]`), so a claim with no scenario behind it can only ever read zero.
   *
   * THE USER IS DAMAGED FIRST, ON PURPOSE. Pain Split on two full-health bodies is a no-op that still
   * emits its two lines, which would satisfy this file and prove nothing — so the user takes a Dragon
   * Claw and a Water Pulse on turn 1 and splits on turn 2, where the levelling is visible in the HP the
   * two `-sethp` lines carry. THE FOE DOES NOT PROTECT: Pain Split IS refused by a shield, and a
   * scenario whose click is blocked is the coverage gap wearing the fix's clothes.
   *
   * REUNICLUS SPLITS, NOT SNORLAX — REPAIRED 2026-08-14 (#266). "Snorlax can't learn Pain Split," and
   * this scenario is the ONLY producer of `-sethp` in the file, so the one claim it exists to hold was
   * being staged on a click that cannot be made in this regulation. Derived: of the declarable bodies
   * that learn Pain Split and Protect, Reuniclus is the second-bulkiest and — the reason it wins — it
   * has EXACTLY Snorlax's 30 base Speed, so the whole turn order is unchanged. Its ability is set to
   * OVERCOAT and not Magic Guard for the obvious reason: this scenario's entire premise is that the
   * user gets hurt first. COST, named: 110 HP against Snorlax's 160 and 85 SpD against 110, so the
   * body arrives at the split further down than it used to — which makes the levelling larger, not
   * smaller. WATER PULSE for the Toxapex's Scald, which it cannot learn either. */
  ['Pain Split: the user is hurt first, then the two bodies are levelled',
    () => [mon('reuniclus', ['painsplit', 'bodyslam', 'protect', 'psychic'], 'overcoat', ''),
           mon('clefable', ['moonblast', 'protect', 'followme', 'helpinghand'], 'unaware', ''),
           mon('milotic', ['scald', 'recover', 'protect', 'icywind'], 'marvelscale', '')],
    () => [mon('garchomp', ['earthquake', 'dragonclaw', 'protect', 'rockslide'], 'roughskin', ''),
           mon('toxapex', ['waterpulse', 'recover', 'protect', 'toxic'], 'regenerator', ''),
           mon('milotic', ['scald', 'recover', 'protect', 'icywind'], 'marvelscale', '')],
    [{ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'waterpulse', t: 0 }] },
     { a: [{ m: 'painsplit', t: 0 }, { m: 'helpinghand' }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'waterpulse', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }]],
];

const seen = {};
const perGame = [];
for (const [label, tA, tB, script] of SCENARIOS) {
  /* Several seeds per scenario, because a flinch, a miss and a secondary are dice and one seed can
   * miss all three. The seeds are fixed, so a red run reproduces. */
  for (const seed of [7, 101, 20260806, 555]) {
    const { S, trace } = play(tA, tB, script, seed);
    const c = M.traceCounts(trace);
    for (const k in c) seen[k] = (seen[k] || 0) + c[k];
    perGame.push({ label, seed, trace, counts: c, S });
  }
}
const missing = M.TRACE_EVENTS.filter(e => !seen[e]);
console.log('  ' + perGame.length + ' games, ' + perGame.reduce((n, g) => n + g.trace.length, 0)
  + ' trace lines, ' + Object.keys(seen).length + '/' + M.TRACE_EVENTS.length + ' claimed events fired');
for (const e of M.TRACE_EVENTS.slice().sort()) {
  const n = seen[e] || 0;
  if (!n) fail('|' + e + '| is CLAIMED in TRACE_EVENTS and NEVER FIRED in ' + perGame.length + ' games');
}
if (!missing.length) pass('every one of the ' + M.TRACE_EVENTS.length + ' claimed events fired at least once');
console.log('  counts: ' + Object.keys(seen).sort().map(k => k + ' ' + seen[k]).join(', '));

/* An event the engine emits that it does NOT claim is the same defect with the sign flipped -- the
 * derivation in engine/derive_protocol_events.js has never seen it and cannot have declared it. */
const unclaimed = Object.keys(seen).filter(k => !M.TRACE_EVENTS.includes(k));
if (unclaimed.length) fail('emitted but NOT in TRACE_EVENTS (the derivation cannot have checked these): '
  + unclaimed.join(', '));
else pass('nothing was emitted that TRACE_EVENTS does not claim');

/* ================= PART 2 — THE RATE FLOORS ===================================================== */
console.log('\nPART 2 — rate floors, because non-zero is not always a strong enough bar');

let noMove = 0, hurtNoDamage = 0;
for (const g of perGame) {
  if (!g.counts['move']) noMove++;
  const anyHurt = [...g.S.actA, ...g.S.actB, ...g.S.benchA, ...g.S.benchB]
    .some(x => x && (x.fainted || x.curHP < x.st.hp));
  if (anyHurt && !g.counts['-damage']) hurtNoDamage++;
}
if (noMove) fail(noMove + '/' + perGame.length + ' games emitted NO |move| — every game has moves in it');
else pass('every one of the ' + perGame.length + ' games emitted |move| (floor: 100%)');
if (hurtNoDamage) fail(hurtNoDamage + ' games ended with a hurt body and emitted no |-damage|');
else pass('every game that ended with a hurt body emitted |-damage| (floor: 100%)');

/* ROADMAP #31 — THE MEGA FLOOR, AND IT IS A RATE AND NOT A COUNT.
 *
 * Will's standing rule: "IT SHOULD BE TRULY RARE TO SEE A GAME THAT DIDN'T HAVE A MEGA IN THIS
 * FORMAT." Mega has already passed an at-least-one check in this project while firing on 56% of the
 * sides it should have, because the base class could only evolve from the LEFT slot. So the
 * denominator here is SIDES THAT COULD HAVE MEGAED, not games, and the floor is 100% of them:
 * `megaTargetFor` answers on a body that is still capable, so a side whose stone-holder never
 * evolved still reads as capable at the end of the game and is counted as a miss.
 *
 * BOTH SLOTS ARE ASSERTED SEPARATELY, for the same reason. */
{
  let capable = 0, evolved = 0, fromLeft = 0, fromRight = 0;
  for (const g of perGame) {
    /* THE DENOMINATOR IS THE ROSTER, NOT THE FIELD, and the first version of this got it wrong in a
     * way worth recording: it scanned `actA + benchA`, and WIRE 125 already documents that a fainted
     * body is OVERWRITTEN in its active slot by bringIn() and ends up in neither array. So a side
     * whose mega evolved and then died read as "never had a stone" and left the denominator — the
     * floor quietly measured 4 sides instead of 8 and still printed 100%. `sf.team` is stamped by
     * battleInit with the whole side and is never spliced. */
    for (const sf of [g.S.sfA, g.S.sfB]) {
      const roster = (sf.team || []).filter(Boolean);
      const didMega = roster.some(x => /-mega(-[xyz])?$/.test(String(x.name)));
      const stillCould = roster.some(x => M.megaTargetFor(x));
      if (!didMega && !stillCould) continue;               // no stone on this side at all
      capable++;
      if (didMega) evolved++;
    }
    /* WHICH SLOT is read off the STREAM rather than off the end state, for the same reason: the
     * `|-mega|` line names the slot the evolution happened in, and it survives the body dying. */
    for (const l of g.trace) {
      const m = /^\|-mega\|p[12]([ab]):/.exec(l);
      if (m) (m[1] === 'a' ? fromLeft++ : fromRight++);
    }
  }
  console.log('  mega: ' + evolved + '/' + capable + ' capable sides evolved   '
    + 'left slot ' + fromLeft + ', right slot ' + fromRight);
  if (!capable) fail('NO side in any scenario could mega — the floor below is vacuous, which is worse '
    + 'than a red one. A scenario carrying a mega stone must exist.');
  else if (evolved < capable) fail(evolved + '/' + capable + ' capable sides megaed — the floor is 100%, '
    + 'and 56%-of-sides is the exact shape this project has already shipped once');
  else pass('every side that could mega DID (' + evolved + '/' + capable + ')');
  if (!fromRight || !fromLeft) fail('mega fired from only one slot (' + fromLeft + ' left, ' + fromRight
    + ' right) — "the base class could only mega from the LEFT slot" is the literal historical defect');
  else pass('mega fired from BOTH slots (' + fromLeft + ' left, ' + fromRight + ' right)');
}

/* The Intimidate floor is the sharpest of the three because the ORDER is part of the claim: Showdown
 * emits `|-ability|X|Intimidate|boost` and then one `|-unboost|` per live foe, and a trace that got
 * the pair but not the order would still read as a pass on a count. */
{
  /* Four illegal declarations repaired 2026-08-14 (#266) — Incineroar/Knock Off, Clefable/Trick Room,
   * and BOTH of Slowking's Haze and Perish Song, which it cannot learn here. Every slot in this block
   * clicks Protect for its one turn, so nothing but the Intimidate itself is exercised and the
   * replacements are all derived legal clicks for the same bodies. */
  const A = () => [mon('incineroar', ['fakeout', 'thief', 'flareblitz', 'protect'], 'intimidate', ''),
                   mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', '')];
  const B = () => [mon('clefable', ['moonblast', 'protect', 'followme', 'helpinghand'], 'unaware', ''),
                   mon('slowking', ['scald', 'protect', 'surf', 'icywind'], 'regenerator', '')];
  const { trace } = play(A, B, [{ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] }], 7);
  const iAb = trace.findIndex(l => /^\|-ability\|p1a: incineroar\|intimidate\|boost$/.test(l));
  const drops = trace.map((l, i) => [l, i]).filter(([l]) => /^\|-unboost\|p2[ab]: \S+\|atk\|1$/.test(l));
  if (iAb < 0) fail('an Intimidate lead emitted no |-ability|...|boost| line');
  else if (drops.length !== 2) fail('an Intimidate lead against two live foes emitted ' + drops.length
    + ' |-unboost| lines, not 2');
  else if (!(drops[0][1] > iAb && drops[1][1] > iAb))
    fail('|-unboost| was emitted BEFORE |-ability| — Showdown announces the ability first');
  else pass('an Intimidate lead emits |-ability| then exactly 2 |-unboost|, in that order');
}

/* ================= PART 3 — OFF BY DEFAULT, AND THE CONTROL IS EXPLICIT ========================= */
console.log('\nPART 3 — off by default');
{
  /* THIEF, NOT KNOCK OFF — 2026-08-14 (#266). Incineroar cannot learn Knock Off in this regulation.
   * The control here compares a traced game against an untraced one, so what matters is only that the
   * click is the same in both arms; it is the same body, the same slot and the same Dark contact move. */
  const teamA = () => [mon('incineroar', ['fakeout', 'thief', 'flareblitz', 'protect'], 'intimidate', 'sitrusberry'),
                       mon('torkoal', ['eruption', 'protect', 'bodypress', 'yawn'], 'drought', '')];
  const teamB = () => [mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', 'focussash'),
                       mon('tyranitar', ['rockslide', 'crunch', 'protect', 'taunt'], 'sandstream', 'leftovers')];
  const script = [{ a: [{ m: 'fakeout', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'earthquake' }, { m: 'rockslide' }] },
                  { a: [{ m: 'thief', t: 0 }, { m: 'bodypress', t: 0 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] },
                  { a: [{ m: 'flareblitz', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] }];
  const shot = (S) => JSON.stringify([...S.actA, ...S.actB, ...S.benchA, ...S.benchB]
    .map(x => x && [x.name, x.curHP, x.status || '', x.item || '', JSON.stringify(x.boosts)]));

  const withT = play(teamA, teamB, script, 7);
  /* the SAME game with no `trace` key at all */
  const A2 = teamA(), B2 = teamB();
  const S2 = M.battleInit(A2, B2, {});
  const rng2 = mkRng(7);
  for (const step of script) {
    const mk = (own, foes, acts) => {
      const map = new Map();
      own.forEach((mm, i) => { if (!mm || mm.fainted || !acts[i]) return;
        map.set(mm, M.playerAction(mm, acts[i].m, acts[i].t != null ? foes[acts[i].t] : null, S2.field)); });
      return map;
    };
    M.battleTurn(S2, rng2, mk(S2.actA, S2.actB, step.a), mk(S2.actB, S2.actA, step.b));
  }
  if (!withT.trace.length) fail('the traced arm emitted nothing — the control below proves nothing');
  else if (shot(withT.S) !== shot(S2))
    fail('TRACING CHANGED THE GAME. The two arms ended in different states:\n      traced   '
      + shot(withT.S) + '\n      untraced ' + shot(S2));
  else pass('the same game with and without a trace ends in an identical state ('
    + withT.trace.length + ' lines vs 0)');

  /* And the untraced arm must not have written into anything. `S._trace` absent is the whole
   * mechanism, so it is asserted rather than assumed. */
  if (S2._trace !== undefined) fail('battleInit set S._trace when no trace was asked for');
  else pass('an untraced battle carries no sink at all (S._trace is undefined)');
}

/* ================= PART 4 — THE COUNTS ARE PARSED OUT OF THE STREAM ============================= */
console.log('\nPART 4 — counts are derived from the stream, not kept beside it');
{
  const g = perGame[0];
  const byHand = {};
  for (const l of g.trace) { const k = l.split('|')[1]; byHand[k] = (byHand[k] || 0) + 1; }
  if (JSON.stringify(byHand) !== JSON.stringify(g.counts))
    fail('traceCounts disagrees with a hand count of the same lines');
  else pass('traceCounts(lines) equals a hand count of those lines');
  /* Every line must be a well-formed protocol line: leading `|`, a known event, no embedded newline. */
  let bad = 0;
  for (const gg of perGame) for (const l of gg.trace) {
    if (l[0] !== '|' || /\n/.test(l) || !M.TRACE_EVENTS.includes(l.split('|')[1])) { bad++; if (bad === 1) console.log('      first: ' + JSON.stringify(l)); }
  }
  if (bad) fail(bad + ' emitted lines are not well-formed protocol lines');
  else pass('all ' + perGame.reduce((n, gg) => n + gg.trace.length, 0) + ' lines are well-formed');
  /* traceCanon must be idempotent and must not eat the field separators. */
  const probe = '|-damage|p2a: Garchomp|154/175 brn|[from] item: Life Orb';
  const c1 = M.traceCanon(probe);
  if (c1 !== '|-damage|p2a:garchomp|154/175brn|[from]item:lifeorb')
    fail('traceCanon produced ' + c1);
  else if (M.traceCanon(c1) !== c1) fail('traceCanon is not idempotent');
  else pass('traceCanon canonicalises per field and is idempotent');
}

/* ================= PART 6 — NO IDENTIFIER FELL BACK =============================================
 *
 * ROADMAP #223 — THIS ASSERTION WAS REAL AND VACUOUS, WHICH IS WORSE THAN ABSENT.
 *
 * The line below has always been a `fail()`. It read 0 for months and proved nothing, because the
 * eight scenarios in PART 1 above are SCRIPTED games in which exactly three switches occur. The
 * defect it exists to catch — an effect bound to a Pokemon OBJECT rather than to the slot it was
 * aimed at — is reachable only when the aimed slot CHANGES HANDS between the choice and the effect,
 * and that is a switch. Measured while this block was being written:
 *     400 games of pure clicking, no switches at all ............... 0
 *     400 with a bench and faints but no deliberate switches ....... 0
 *     600 with a real bench and a 25% per-body switch rate ........ 907
 * So the counter is now read AFTER a run built to reach it, and the two halves are asserted apart:
 * the run must be shown to have SWITCHED (or it is the 400-game arm again, reporting a pass it has
 * not earned), and it must then be shown to have placed every identifier.
 *
 * FOUR BODIES A SIDE, AND THAT IS A CORRECTNESS CONDITION RATHER THAN A GENEROSITY. `battleInit`
 * does `teamA.slice(2)`, so a two-body or three-body team has a bench of at most one and a scripted
 * switch is frequently a silent no-op. A harness built that way reports zero switches, zero orphans
 * and a green PART 6 — which is the exact shape of a capability that cannot prove it ran.
 *
 * IT DOES NOT FIX `ident()`. Making the emitter resolve a label for whatever body it is handed would
 * delete every `??` and leave every wrong-target effect in place, silently. The placeholder is the
 * detector; what is asserted is that nothing is ever handed an off-field body. */
console.log('\nPART 6 — every identifier resolved to a real slot');
{
  const POOL = [
  /* FIVE OF THESE TWELVE ROWS WERE ILLEGAL AND NO GATE COULD SEE THEM — REPAIRED 2026-08-14 (#266).
   *
   * `engine/fixture_legality.js` finds a declared set two ways: a helper CALL carrying string literals,
   * or an object literal keyed `species:`/`moves:`. This pool is neither — it is a POSITIONAL ARRAY,
   * `[species, [moves], ability, item]` — so all twelve rows sat outside the swept population while the
   * gate reported the tree clean, and they drive the 200 games below. Put through TeamValidator by hand
   * on 2026-08-14 it rejected five: Clefable/Soak, Sableye/Entrainment, Grimmsnarl/Thunder Wave,
   * Incineroar/Knock Off, and a Toxapex holding BLACK SLUDGE — an item that "does not exist in Gen 9",
   * which is the EXISTENCE class and is never something a probe stages on purpose.
   *
   * Each replacement is derived from the format (checkCanLearn) and keeps the row's JOB, which in this
   * pool is to stress body identity with target-swapping and ability-swapping clicks: Skill Swap for
   * Soak and for Entrainment, Taunt for Thunder Wave, Thief for Knock Off, Water Pulse for Scald. */
    ['slowking',   ['skillswap', 'yawn', 'scald', 'trickroom'],           'regenerator', 'leftovers'],
    ['clefable',   ['skillswap', 'healpulse', 'followme', 'moonblast'],   'unaware',     'leftovers'],
    ['oranguru',   ['instruct', 'afteryou', 'psychic', 'trickroom'],      'telepathy',   'sitrusberry'],
    ['whimsicott', ['leechseed', 'worryseed', 'taunt', 'moonblast'],      'prankster',   'focussash'],
    ['sableye',    ['skillswap', 'quash', 'knockoff', 'willowisp'],       'prankster',   'leftovers'],
    ['grimmsnarl', ['lightscreen', 'spiritbreak', 'trick', 'taunt'],      'prankster',   'lightclay'],
    ['farigiraf',  ['guardswap', 'powerswap', 'psychic', 'trickroom'],    'armortail',   'leftovers'],
    ['milotic',    ['scald', 'icywind', 'haze', 'protect'],               'marvelscale', ''],
    ['snorlax',    ['bodyslam', 'yawn', 'curse', 'protect'],              'thickfat',    'lumberry'],
    ['garchomp',   ['earthquake', 'dragonclaw', 'rockslide', 'protect'],  'roughskin',   'focussash'],
    ['incineroar', ['fakeout', 'thief', 'flareblitz', 'protect'],         'intimidate',  'sitrusberry'],
    ['toxapex',    ['toxic', 'recover', 'waterpulse', 'protect'],         'regenerator', 'leftovers'],
  ];
  const N = 200, SWRATE = 0.25;
  const before = M.fails.traceBodyOffField;
  let switches = 0, lines = 0, benchEmpty = 0;
  const orphans = [];
  for (let g = 0; g < N; g++) {
    const rng = mkRng(1000 + g * 7919);
    const pick = () => { const out = [], used = new Set();
      while (out.length < 4) { const i = Math.floor(rng() * POOL.length); if (used.has(i)) continue; used.add(i);
        const r = POOL[i], b = M.buildMon(r[0], {});
        if (!b) throw new Error('no MC row for ' + r[0]);
        b.moves = r[1].slice(); b.ability = r[2]; b.item = r[3] || ''; out.push(b); }
      return out; };
    const trace = [];
    const S = M.battleInit(pick(), pick(), { trace });
    if (!S.benchA.length || !S.benchB.length) benchEmpty++;
    for (let t = 0; t < 20 && !M.battleOver(S); t++) {
      const mk = (own, foes, bench) => {
        const map = new Map();
        own.forEach((mm) => {
          if (!mm || mm.fainted) return;
          if (rng() < SWRATE) {
            const cand = bench.filter(x => x && !x.fainted && own.indexOf(x) < 0);
            if (cand.length) { map.set(mm, { kind: 'switch', to: cand[Math.floor(rng() * cand.length)] }); switches++; return; }
          }
          const mv = mm.moves[Math.floor(rng() * mm.moves.length)];
          const liveFoes = foes.filter(x => x && !x.fainted);
          map.set(mm, M.playerAction(mm, mv, liveFoes.length ? liveFoes[Math.floor(rng() * liveFoes.length)] : null, S.field));
        });
        return map;
      };
      M.battleTurn(S, rng, mk(S.actA, S.actB, S.benchA), mk(S.actB, S.actA, S.benchB));
    }
    lines += trace.length;
    for (const l of trace) if (l.indexOf('??:') >= 0 && orphans.length < 8) orphans.push(l);
  }
  const grew = M.fails.traceBodyOffField - before;
  console.log('  ' + N + ' constructed games, 4 bodies a side, ' + SWRATE * 100 + '% per-body switch rate: '
    + switches + ' switches, ' + lines + ' trace lines');
  /* THE FLOOR ON THE HARNESS ITSELF, and it is the half that stops this from going quietly vacuous
   * again. A run with no switches in it cannot have exercised the rule whatever the counter says. */
  if (benchEmpty) fail(benchEmpty + '/' + N + ' games were staged with an EMPTY bench — battleInit '
    + 'slices at index 2, so a switch in those games is a silent no-op and PART 6 is testing nothing');
  else if (switches < N) fail('only ' + switches + ' switches across ' + N + ' games — the reproduction '
    + 'needs switching to reach the defect at all, and a low-switch run reports a pass it has not earned');
  else pass(switches + ' switches actually happened, across ' + N + ' games with a real bench on both sides');
  if (grew) fail('MEDFAILS.traceBodyOffField grew by ' + grew + ' over the reproduction (first: '
    + M.fails.traceBodyOffFieldFirst + ') — an effect was bound to a Pokemon OBJECT and the body had '
    + 'left the field by the time it landed. First ' + orphans.length + ':\n      ' + orphans.join('\n      '));
  else pass('traceBodyOffField stayed 0 across the reproduction: every effect resolved to a live slot');
}
if (M.fails.traceBodyOffField)
  fail('MEDFAILS.traceBodyOffField = ' + M.fails.traceBodyOffField
    + ' (first: ' + M.fails.traceBodyOffFieldFirst + ') — a `??` identifier reached the stream');
else pass('traceBodyOffField = 0 across every game in this file');

/* ================= PART 5 — THE ACCEPTANCE TEST ================================================= */
/* ROADMAP #81 WIRE 11, 2026-08-07 -- THIS TEST HAS BEEN REWRITTEN, AND IT TOLD US TO. Its medicham
 * assertion was `meIntim !== meCtrl` with the failure message *"either the declared crit limitation
 * is gone (good news, and this test must then be rewritten) or the Intimidate never landed."* The
 * limitation is gone: `dmgRange` takes a crit flag now and `_critIgnA` refuses the attacker's
 * negative offensive stage exactly as Showdown does. So the assertion is INVERTED -- medicham must
 * now hold still across the arms, like the authority -- and the escape hatch in that old message is
 * closed by a CONTROL, because "the two arms agree" is satisfied just as well by a scenario that
 * never staged the Intimidate at all. The control is the `|-unboost|` line itself: it must be present
 * in the Intimidate arm and absent from the Blaze arm, on medicham's own stream.
 *
 * WHAT IS STILL NOT ASSERTED, and deliberately: that the two engines' NUMBERS agree. See below --
 * the dice have different multiplicities and every damage line differs by one or two whatever the
 * rules do. medicham reads 111/170 in both arms against Showdown's 112/170 in both arms; the CLAIM
 * is the invariance, not the integer.
 *
 * docs/GAME-DIFFERENTIAL-DESIGN.md §6. Showdown IGNORES THE ATTACKER'S NEGATIVE OFFENSIVE STAGES ON
 * A CRIT (sim/battle-actions.ts:1683-1691, `if (isCrit) ignoreNegativeOffensive = true`). An
 * Intimidated attacker landing a GUARANTEED crit -- Flower Trick, Storm Throw, Frost Breath -- is
 * therefore a two-line scenario that separates a wired engine from an unwired one exactly, and no
 * staged pair test we own is shaped to notice, because the census asks *does the mechanic fire*, not
 * *is the number right afterwards*.
 *
 * THE CLAIM IS NOT "THE TWO ENGINES DISAGREE ON A NUMBER", AND THAT MATTERS.
 * Measured while this test was being written: medicham2's damage RANGE for Knock Off Incineroar ->
 * Snorlax is 57..67, ELEVEN integers, and it samples them uniformly; Showdown rolls SIXTEEN indices
 * onto the same span with unequal multiplicities. So a "median" roll is not the same die on the two
 * sides and every damage line differs by one or two even where the rules agree. A test that asserted
 * "the numbers match" would be asserting something false for a reason that has nothing to do with
 * crits -- and a test that asserted "the numbers differ" would pass on that same noise.
 *
 * SO EACH ENGINE IS COMPARED AGAINST ITSELF ACROSS THE CONTROL, WHICH IS THE ACTUAL RULE:
 *   arm A   the attacker is Intimidated
 *   arm B   the identical scenario with the ability swapped for an inert one
 * BOTH ENGINES' `|-damage|` must be THE SAME in both arms -- the crit ignored the -1. An engine that
 * MOVES between the arms is pricing the crit at -1 Attack, which is what medicham2 did until WIRE 11.
 * And because "the same in both arms" is also what a scenario that never staged the drop produces,
 * the `|-unboost|` line is asserted present in one arm and absent in the other, on each engine's own
 * stream.
 *
 * AND THE TRACE MUST LOCALISE IT: every canonical line BEFORE the `|-damage|` must be identical
 * between the two engines, so the first differing line names the wired-wrong thing directly. That is
 * the property that makes the trace worth building, and it is asserted rather than eyeballed. */
if (!process.env.SHOWDOWN_PATH) {
  /* Exit 2, the repo's SKIP code, which tests/run-all.js reports as NOT RUN rather than as a pass.
   * showdown_path.js already resolved the sibling checkout at the top of this file, so reaching here
   * means the official simulator is genuinely absent and parts 5 and 7 cannot be answered either
   * way. It is reported as NOT RUN in as many words, never as a pass. */
  console.log('\nPARTS 5 and 7 — NOT RUN: the official simulator is absent. This is not a pass.');
  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'parts 1-4 and 6 passed; 5 and 7 NOT RUN'));
  process.exit(failures ? 1 : 2);
} else {
  console.log('\nPART 5 — the Intimidate x guaranteed-crit acceptance case');
  const CS = require(D('engine', 'champions_sim.js'));
  const { Dex, Teams, Battle } = CS.sim();
  const dex = Dex.forFormat(CS.FORMAT);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  /* The two pinned dice, and they are ONE die -- PRNG.randomChance(n,d) IS random(d) < n
   * (sim/prng.ts:115). tests/test-engine-diff.js records what it cost to get this wrong. */
  const PIN_RANDOM = (m, n) => (n === undefined ? (m === undefined ? 0.5 : Math.floor(m / 2)) : m + Math.floor((n - m) / 2));
  const PIN_CHANCE = (num, den) => Math.floor(den / 2) < num;

  const sdSet = (species, moves, ability) => ({
    name: species, species, gender: 'N', level: 50, item: '',
    ability: ability || dex.species.get(species).abilities[0], moves: moves.slice(), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  });
  const CLAIM = new Set(M.TRACE_EVENTS);
  /* `|split|SIDE` is followed by the omniscient line and then the spectator line; the omniscient one
   * is what medicham2 emits, so the other is dropped. Everything outside TRACE_EVENTS is dropped in
   * BOTH directions -- the events medicham2 has declared it cannot produce are invisible on the
   * Showdown side too, which is what data/protocol-events.json's notEmitted[] is for. */
  const sdStream = (log) => {
    const out = [];
    for (let i = 0; i < log.length; i++) {
      if (log[i] === '|split|p1' || log[i] === '|split|p2') { out.push(log[i + 1]); i += 2; continue; }
      out.push(log[i]);
    }
    return out.filter(l => CLAIM.has(String(l).split('|')[1]));
  };

  function showdownArm(ability) {
    const s1 = [sdSet('Meowscarada', ['Flower Trick', 'Protect'], 'Overgrow'),
                sdSet('Snorlax', ['Protect', 'Body Slam'], 'Thick Fat')];
    /* THIEF, NOT KNOCK OFF — 2026-08-14 (#266), and this was the sharpest instance in the file.
     * `new Battle()` VALIDATES NOTHING (ROADMAP #116), so the ONE acceptance case that adjudicates
     * medicham2 against the authority was staging a click Incineroar cannot make in Champions Reg M-B
     * — on BOTH sides, since the medicham2 arm below mirrors this set. The measurement is a ratio
     * between an Intimidate arm and a control arm using the SAME move, so the base power is irrelevant
     * and only the Atk drop is being read; Thief is the legal Dark physical click for this body. */
    const s2 = [sdSet('Incineroar', ['Thief', 'Protect'], ability),
                sdSet('Clefable', ['Protect', 'Moonblast'], 'Unaware')];
    const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
    b.setPlayer('p1', { name: 'A', team: Teams.pack(s1) });
    b.setPlayer('p2', { name: 'B', team: Teams.pack(s2) });
    if (b.requestState === 'teampreview') { b.choose('p1', 'team 12'); b.choose('p2', 'team 12'); }
    /* CONTROL: align the stat blocks. medicham2 builds a Champions SP body and a Showdown set here is
     * 0-EV neutral; unaligned, the two engines disagree about speed order and about who survives, and
     * both read as rule divergences. Same fix tests/test-game-diff.js makes. */
    for (const side of [b.p1, b.p2]) for (const p of side.pokemon) {
      const mm = M.buildMon(norm(p.species.id), {}); if (!mm) continue;
      p.storedStats.atk = mm.st.at; p.storedStats.def = mm.st.df; p.storedStats.spa = mm.st.sa;
      p.storedStats.spd = mm.st.sd; p.storedStats.spe = mm.st.sp;
      p.baseStoredStats.atk = mm.st.at; p.baseStoredStats.def = mm.st.df; p.baseStoredStats.spa = mm.st.sa;
      p.baseStoredStats.spd = mm.st.sd; p.baseStoredStats.spe = mm.st.sp;
      const full = p.hp === p.maxhp; p.maxhp = mm.st.hp; p.baseMaxhp = mm.st.hp; if (full) p.hp = mm.st.hp;
    }
    b.prng.random = PIN_RANDOM; b.prng.randomChance = PIN_CHANCE;
    if (!b.choose('p1', 'move 1 1, move 1')) throw new Error('p1 choice rejected: ' + (b.p1.choice.error || ''));
    if (!b.choose('p2', 'move 1 2, move 1')) throw new Error('p2 choice rejected: ' + (b.p2.choice.error || ''));
    return sdStream(b.log);
  }
  function mediArm(ability) {
    const A = () => [mon('meowscarada', ['flowertrick', 'protect'], 'overgrow', ''),
                     mon('snorlax', ['protect', 'bodyslam'], 'thickfat', '')];
    const B = () => [mon('incineroar', ['thief', 'protect'], norm(ability), ''),
                     mon('clefable', ['protect', 'moonblast'], 'unaware', '')];
    return play(A, B, [{ a: [{ m: 'flowertrick', t: 0 }, { m: 'protect' }],
                         b: [{ m: 'thief', t: 1 }, { m: 'protect' }] }], 7).trace;
  }
  const dmgOn = (stream, who) => {
    const l = stream.map(M.traceCanon).find(x => x.startsWith('|-damage|' + who + '|'));
    return l ? l.split('|')[3] : null;
  };
  const arms = {};
  for (const [k, ab] of [['intim', 'Intimidate'], ['control', 'Blaze']])
    arms[k] = { sd: showdownArm(ab), me: mediArm(ab) };

  const sdIntim = dmgOn(arms.intim.sd, 'p2a:incineroar');
  const sdCtrl = dmgOn(arms.control.sd, 'p2a:incineroar');
  const meIntim = dmgOn(arms.intim.me, 'p2a:incineroar');
  const meCtrl = dmgOn(arms.control.me, 'p2a:incineroar');
  console.log('    showdown   Intimidate ' + sdIntim + '   control ' + sdCtrl);
  console.log('    medicham2  Intimidate ' + meIntim + '   control ' + meCtrl);

  /* THE CONTROL, WITHOUT WHICH "BOTH ARMS AGREE" IS VACUOUS. The drop has to have LANDED on the
   * attacker in the Intimidate arm and NOT in the Blaze arm, and it is read off each engine's own
   * canonical stream so neither can borrow the other's evidence. */
  const dropped = (stream) => stream.map(M.traceCanon)
    .some(l => /^\|-unboost\|p1a:[^|]*\|atk\|/.test(l));
  const sdDrop = [dropped(arms.intim.sd), dropped(arms.control.sd)];
  const meDrop = [dropped(arms.intim.me), dropped(arms.control.me)];
  console.log('    the -1 Attack landed?  showdown [intim ' + sdDrop[0] + ', control ' + sdDrop[1]
    + ']   medicham2 [intim ' + meDrop[0] + ', control ' + meDrop[1] + ']');
  if (!sdIntim || !sdCtrl || !meIntim || !meCtrl)
    fail('the scenario did not produce a |-damage| on p2a in all four cells — nothing is being tested');
  else if (!(sdDrop[0] && !sdDrop[1]))
    fail('SHOWDOWN did not stage the Intimidate exactly once — the |-unboost| is ' + JSON.stringify(sdDrop)
      + ' across [intimidate, control]. Nothing below this line means anything.');
  else if (!(meDrop[0] && !meDrop[1]))
    fail('MEDICHAM did not stage the Intimidate exactly once — the |-unboost| is ' + JSON.stringify(meDrop)
      + ' across [intimidate, control]. "Both arms agree" would then be vacuous.');
  else {
    pass('the -1 Attack landed in the Intimidate arm and in neither control, on BOTH engines');
    if (sdIntim !== sdCtrl)
      fail('SHOWDOWN moved between the arms (' + sdCtrl + ' -> ' + sdIntim + '). The crit is supposed '
        + 'to ignore the attacker\'s -1, so the control is not isolating Intimidate.');
    else pass('showdown: the crit ignores Intimidate — |-damage| is ' + sdIntim + ' in BOTH arms');
    /* ROADMAP #81 WIRE 11 -- INVERTED. This asserted `meIntim !== meCtrl` and pinned the old
     * limitation; the limitation is wired away, so it now asserts the authority's own invariance. */
    if (meIntim !== meCtrl)
      fail('MEDICHAM moved between the arms (' + meCtrl + ' -> ' + meIntim + '). A crit ignores the '
        + 'attacker\'s NEGATIVE offensive stage (battle-actions.ts:1683-1691) and this build is '
        + 'pricing it at -1 — ROADMAP #81 WIRE 11 regressed.');
    else pass('medicham2: the crit ignores Intimidate too — |-damage| is ' + meIntim + ' in BOTH arms '
      + '(the integer still differs from Showdown\'s ' + sdIntim + '; the die does, see the header)');
  }

  /* AND IT IS LOCALISED. Walk the two canonical streams together; the FIRST index at which they part
   * must be the `|-damage|` line, and everything before it must be identical. A trace that only says
   * THAT they differ is a scoreboard; §5 asks for an instrument. */
  const A = arms.intim.sd.map(M.traceCanon), B = arms.intim.me.map(M.traceCanon);
  let first = -1;
  for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) { first = i; break; }
  if (first < 0) fail('the two streams never part in the Intimidate arm — the case did not stage');
  else if (!A[first].startsWith('|-damage|'))
    fail('the FIRST divergence is not the damage line, it is:\n        showdown  ' + arms.intim.sd[first]
      + '\n        medicham  ' + arms.intim.me[first] + '\n      the trace is not aligned; fix that before trusting the number above');
  else {
    pass('the two streams agree on all ' + first + ' lines before the divergence');
    pass('the FIRST differing line is the |-damage| itself:\n          showdown  ' + arms.intim.sd[first]
      + '\n          medicham  ' + arms.intim.me[first]);
  }
}

/* ================= PART 7 — THE DERIVATION'S OWN TWO GATES RUN HERE =============================
 * `engine/derive_protocol_events.js` checks (a) that nothing in TRACE_EVENTS is an event Showdown
 * never emits, and (b) that every Showdown event this engine does not emit has a WRITTEN REASON in
 * data/protocol-events.json. It lives in engine/ because it is a generator, and `tests/run-all.js`
 * discovers gates by globbing `tests/test-*.js` -- so a gate left in engine/ and not on run-all's
 * hand list is a check nobody runs, which CLAUDE.md rates worse than no check. Spawned from here
 * instead of hand-registered, so it cannot fall off a list. */
console.log('\nPART 7 — the derivation gates (invented events, undeclared events)');
if (!process.env.SHOWDOWN_PATH) {
  console.log('  SKIPPED with PART 5 — set SHOWDOWN_PATH');
} else {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [D('engine', 'derive_protocol_events.js')],
    { encoding: 'utf8', env: process.env });
  const tail = String(r.stdout || '').trim().split('\n').slice(-6).join('\n      ');
  if (r.status !== 0) fail('engine/derive_protocol_events.js exited ' + r.status + ':\n      ' + tail);
  else pass('both derivation gates pass:\n      ' + tail);
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASSED'));
process.exit(failures ? 1 : 0);
