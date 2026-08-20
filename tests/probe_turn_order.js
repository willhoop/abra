/* probe_turn_order.js — ROADMAP #290. THE `ordering` FAMILY, ASKED ON A STAGED BOARD.
 *
 *   SHOWDOWN_PATH=... node tests/probe_turn_order.js
 *
 * The differential's `order_probe` says a move-vs-move ordering pair can carry `speed_tied:false`
 * AND `same_priority:true`. That is a claim about REAL GAMES and it is read at the turn boundary,
 * which is not the moment the queue was ordered — so it can only ever be a lead. This file stages
 * the question instead: bodies at KNOWN, DIFFERENT speeds, interleaved across the two sides so slot
 * order and speed order disagree, every one of them clicking the SAME action so the bracket is
 * identical by construction.
 *
 * NOBODY TYPES THE ANSWER. Showdown plays the same script and its own `|move|`/`|switch|` order IS
 * the expectation, exactly as tests/staged_board.js argues. What is printed is the two orders side
 * by side.
 *
 * THE SWITCH ARM IS THE POINT. `|switch| <> |switch|` is 153 of the 205 games in the `ordering`
 * class of data/game-differential.json as generated 2026-08-19 — three quarters of it — and
 * `order_probe` covers move-vs-move ONLY (24 games), so the biggest member has never been asked.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }

const G = require(D('engine', 'game_differential.js'));
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...names) => names.map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }));

/* THE FIXTURES. Species are named deliberately (a staged board cannot be derived from a tag — the
 * same declared exception game_differential.js's DIRECTED table makes). Speeds are NOT typed here. */
const SCEN = [
  { name: 'four Protects — one bracket (+4), four speeds, slot order != speed order',
    A: stage([['whimsicott', '', 'Chlorophyll', ['Protect', 'Tailwind']],
              ['incineroar', '', 'Blaze', ['Protect', 'Knock Off']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', ['Protect', 'Earthquake']],
              ['corviknight', '', 'Pressure', ['Protect', 'Brave Bird']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }] },

  /* ROADMAP #290 — GALE WINGS ON A FLYING-TYPE STATUS MOVE. Tailwind is FLYING and Gale Wings tests
   * the TYPE and the HP and nothing else, so a full-HP Talonflame's Tailwind is +1 on the authority.
   * The order-probe found six of its seven remaining real disagreements on exactly this pair.
   *
   * THE FIXTURE MAKES THE BRACKET THE ONLY THING THAT CAN DECIDE IT: Talonflame is the SLOWEST body
   * on the field, so if it moves first it moved first on priority. The negative is the SAME
   * Talonflame with Flame Body, which must go last. Neither arm types an order — Showdown answers
   * both. */
  /* EVERY OTHER CLICK IS PRIORITY 0, AND THE FIRST DRAFT GOT THIS WRONG. Filling the other three
   * slots with Protect puts them all at +4, so Talonflame goes last whether or not it has the
   * bracket — both arms matched and neither tested anything. Agility is priority 0, harmless to the
   * board, and leaves the +1 as the only thing that can move the order. Talonflame also sits in the
   * SECOND slot so it is not the fastest body on the field: `spreadFor` gives slot 0 +32 Speed and
   * slot 1 +22, so Dragapult leads it. Moving first is then a bracket and cannot be speed. */
  { name: 'Gale Wings gives a FLYING-type STATUS move its bracket — Tailwind out of a full-HP Talonflame',
    A: stage([['incineroar', '', 'Blaze', ['Agility', 'Protect']],
              ['talonflame', '', 'Gale Wings', ['Tailwind', 'Protect']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['dragapult', '', 'Clear Body', ['Agility', 'Protect']],
              ['whimsicott', '', 'Chlorophyll', ['Agility', 'Protect']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'agility' }, { m: 'tailwind' }], p2: [{ m: 'agility' }, { m: 'agility' }] }] },

  { name: 'the NEGATIVE — the same Tailwind out of a Talonflame with no Gale Wings',
    A: stage([['incineroar', '', 'Blaze', ['Agility', 'Protect']],
              ['talonflame', '', 'Flame Body', ['Tailwind', 'Protect']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['dragapult', '', 'Clear Body', ['Agility', 'Protect']],
              ['whimsicott', '', 'Chlorophyll', ['Agility', 'Protect']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'agility' }, { m: 'tailwind' }], p2: [{ m: 'agility' }, { m: 'agility' }] }] },

  { name: 'four Tailwinds — one bracket (0), four speeds, and the field changes under the turn',
    A: stage([['whimsicott', '', 'Chlorophyll', ['Tailwind', 'Protect']],
              ['incineroar', '', 'Blaze', ['Tailwind', 'Protect']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', ['Tailwind', 'Protect']],
              ['corviknight', '', 'Pressure', ['Tailwind', 'Protect']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'tailwind' }, { m: 'tailwind' }], p2: [{ m: 'tailwind' }, { m: 'tailwind' }] }] },

  /* THE SWITCH ARM. Showdown gives a bare switch `order: 103` (sim/battle-queue.ts:59) and
   * `action.speed = action.pokemon.getActionSpeed()` (sim/battle.ts:2657), so two switches in one
   * turn are ordered by the OUTGOING body's speed. The second arm puts the faster outgoing body on
   * the OTHER side, so a slot walk cannot pass both. */
  { name: 'both sides switch — the faster OUTGOING body is on p1',
    A: stage([['whimsicott', '', 'Chlorophyll', ['Protect', 'Tailwind']],
              ['incineroar', '', 'Blaze', ['Protect', 'Knock Off']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', ['Protect', 'Earthquake']],
              ['corviknight', '', 'Pressure', ['Protect', 'Brave Bird']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ sw: 'milotic' }, { m: 'protect' }], p2: [{ sw: 'snorlax' }, { m: 'protect' }] }] },

  { name: 'both sides switch — the faster OUTGOING body is on p2',
    A: stage([['incineroar', '', 'Blaze', ['Protect', 'Knock Off']],
              ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['whimsicott', '', 'Chlorophyll', ['Protect', 'Tailwind']],
              ['corviknight', '', 'Pressure', ['Protect', 'Brave Bird']]]).concat(BENCH('garchomp', 'toxapex')),
    script: [{ p1: [{ sw: 'milotic' }, { m: 'protect' }], p2: [{ sw: 'garchomp' }, { m: 'protect' }] }] },

  { name: 'all four switch at once — four outgoing speeds, one bracket',
    A: stage([['whimsicott', '', 'Chlorophyll', ['Protect', 'Tailwind']],
              ['incineroar', '', 'Blaze', ['Protect', 'Knock Off']],
              ['milotic', '', 'Marvel Scale', ['Protect', 'Scald']],
              ['clefable', '', 'Unaware', ['Protect', 'Moonblast']]]),
    B: stage([['garchomp', '', 'Rough Skin', ['Protect', 'Earthquake']],
              ['corviknight', '', 'Pressure', ['Protect', 'Brave Bird']],
              ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']],
              ['toxapex', '', 'Regenerator', ['Protect', 'Liquidation']]]),
    script: [{ p1: [{ sw: 'milotic' }, { sw: 'clefable' }], p2: [{ sw: 'snorlax' }, { sw: 'toxapex' }] }] },
];

/* ---- THE SPEED ORACLE ---------------------------------------------------------------------------
 * A turn-order disagreement has two candidate causes and they need different fixes: the SORT is
 * wrong, or the two engines put a different NUMBER in the sort key. These arms ask the second
 * question on a staged board, one multiplier family at a time.
 *
 * NOTHING IS TYPED. `playGame` reads every active body's speed out of BOTH engines at the top of
 * every turn — Showdown's `pokemon.getActionSpeed()` against medicham2's `effSpeed()` — and returns
 * the disagreements as `speedRows`. An empty array is the pass. See `speedAgree` in
 * engine/game_differential.js for why the reading is taken there and not at turn end.
 *
 * WHY EVERY SPEED HERE IS ODD-BY-CONSTRUCTION RATHER THAN CHOSEN: the bodies are built by the
 * driver from the live team pool's real spreads, so the fixture does not get to pick a convenient
 * stat line. What it picks is the MULTIPLIER — a Choice Scarf is x1.5, and x1.5 of an odd number is
 * where the authority's truncation and a float multiply part company. */
const SPEED = [
  { name: 'Choice Scarf on every body — the authority truncates the modifier chain',
    A: stage([['whimsicott', 'Choice Scarf', 'Chlorophyll', ['Protect', 'Sunny Day', 'Agility', 'Tailwind']],
              ['incineroar', 'Choice Scarf', 'Blaze', ['Protect', 'Knock Off']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', 'Choice Scarf', 'Rough Skin', ['Protect', 'Thunder Wave', 'Agility']],
              ['corviknight', 'Choice Scarf', 'Pressure', ['Protect', 'Brave Bird']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }] },

  /* A CHOICE SCARF LOCKS THE MOVE, so a Scarf body clicks ONE move for the whole scenario and the
   * varying clicks belong to its partner. The first draft did not, and Showdown refused the choice
   * outright — *"Can't move: Whimsicott's Agility is disabled"* — which is a fixture failure and
   * NOT a finding, exactly as this harness's THREW verdict says. */
  /* WHICH BODY CARRIES THE SCARF IS NOT A STYLE CHOICE, AND PICKING IT BY EYE MADE BOTH ARMS BELOW
   * HOLLOW ON THE FIRST DRAFT — they passed the deliberate break. x1.5 of an EVEN stat is exact in
   * 4096ths, so the Scarf has to sit on an ODD one or there is nothing to truncate.
   *
   * The stat is DERIVED, not chosen: `spreadFor` gives the two ACTIVE slots +32 and +22 Speed off
   * `SPE_LADDER`, the scenarios declare no nature so `natureFor` returns Serious, and Champions'
   * non-level-clause branch is `stat = stat + evs + 20` (data/mods/champions/scripts.ts:24). So an
   * active body's Speed is `base + 52` or `base + 42` — odd exactly when its BASE Speed is odd.
   * Corviknight (67) and Milotic (81) are the two odd-Speed bodies in this fixture's cast, read out
   * of `Dex.forFormat('gen9championsvgc2026regmb')` rather than recalled.
   *
   * AND THE ARM CHECKS IT ANYWAY. `exercised` below re-derives the condition from the reading the
   * authority actually produced, so this paragraph being wrong shows up as NOT-EXERCISED instead of
   * as a green. */
  { name: 'Scarf x Tailwind x a stacking boost on an odd-Speed body — one chain, three multipliers',
    A: stage([['whimsicott', '', 'Chlorophyll', ['Sunny Day', 'Agility', 'Protect']],
              ['incineroar', '', 'Blaze', ['Protect', 'Agility']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', ['Tailwind', 'Protect']],
              ['corviknight', 'Choice Scarf', 'Pressure', ['Agility', 'Protect']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'sunnyday' }, { m: 'protect' }], p2: [{ m: 'tailwind' }, { m: 'agility' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] }] },

  { name: 'paralysis on a Scarf holder — the authority floors AFTER spending the whole chain',
    A: stage([['milotic', 'Choice Scarf', 'Marvel Scale', ['Agility', 'Protect']],
              ['incineroar', '', 'Blaze', ['Protect', 'Agility']]]).concat(BENCH('whimsicott', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', ['Thunder Wave', 'Protect']],
              ['corviknight', '', 'Pressure', ['Protect', 'Agility']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'agility' }, { m: 'protect' }], p2: [{ m: 'thunderwave', t: 0 }, { m: 'protect' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] }] },

  /* UNBURDEN — THE OTHER HALF OF THE SPEED DISAGREEMENT, AND IT IS NOT ARITHMETIC.
   *
   * Showdown's Unburden is a VOLATILE, not a derived read: `onAfterUseItem` and `onTakeItem` add
   * `pokemon.addVolatile('unburden')`, the condition's `onModifySpe` doubles only while that
   * volatile is present AND `!pokemon.item`, and `onEnd(pokemon) { pokemon.removeVolatile }` takes
   * it away when the ability ends — which is what a switch-out is (data/abilities.ts, inherited
   * unchanged by data/mods/champions/abilities.ts, which has no `unburden` entry at all).
   *
   * ARM A is the POSITIVE: the item is knocked off and the doubling must appear on both engines.
   * ARM B is the NEGATIVE and is the one that discriminates: the same body switches OUT and back
   * IN with the item still gone, so the authority drops the boost and an engine that reads
   * "started with an item and has none now" keeps it. A scenario with only the positive would pass
   * on an ability that fires unconditionally, which is the whole reason staged_board.js requires a
   * negative turn. */
  { exercise: 'modified',
    name: 'Unburden ARM A — the item is knocked off and the doubling appears',
    A: stage([['sneasler', 'Sitrus Berry', 'Unburden', ['Protect', 'Agility']],
              ['incineroar', '', 'Blaze', ['Protect', 'Agility']]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', ['Knock Off', 'Protect']],
              ['corviknight', '', 'Pressure', ['Protect', 'Agility']]]).concat(BENCH('snorlax', 'toxapex')),
    /* THE BODY BEING KNOCKED OFF MUST NOT CLICK PROTECT, and the first draft had it do exactly that:
     * the Knock Off was clicked, the shield ate it, Sneasler kept its berry and both engines read
     * the same unmodified Speed all game. A green that means the fixture never happened. */
    script: [{ p1: [{ m: 'agility' }, { m: 'protect' }], p2: [{ m: 'knockoff', t: 0 }, { m: 'protect' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] }] },

  { exercise: 'modified',
    name: 'Unburden ARM B — the boost does NOT survive a switch out and back',
    A: stage([['sneasler', 'Sitrus Berry', 'Unburden', ['Protect', 'Agility']],
              ['incineroar', '', 'Blaze', ['Protect', 'Agility']],
              ['milotic', '', 'Marvel Scale', ['Protect', 'Agility']],
              ['clefable', '', 'Unaware', ['Protect', 'Agility']]]),
    B: stage([['garchomp', '', 'Rough Skin', ['Knock Off', 'Protect']],
              ['corviknight', '', 'Pressure', ['Protect', 'Agility']]]).concat(BENCH('snorlax', 'toxapex')),
    script: [{ p1: [{ m: 'agility' }, { m: 'protect' }], p2: [{ m: 'knockoff', t: 0 }, { m: 'protect' }] },
             { p1: [{ sw: 'milotic' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
             { p1: [{ sw: 'sneasler' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
             { p1: [{ m: 'agility' }, { m: 'agility' }], p2: [{ m: 'protect' }, { m: 'agility' }] }] },
];

const NL = String.fromCharCode(10);
const ACT = /^\|(move|switch)\|/;
const actLines = arr => arr.map(String).filter(l => ACT.test(l))
  .map(l => { const f = l.split('|'); return f[1] + ' ' + f[2].replace(/\s+/g, ' ').toLowerCase()
    + ' :: ' + String(f[3] || '').toLowerCase().replace(/[^a-z0-9]/g, ''); });

let bad = 0, ran = 0;
for (const sc of SCEN) {
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) { console.log('NOT-STAGED  ' + sc.name); bad++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_turn_order :: ' + sc.name, { script: sc.script });
  if (r.err) { console.log('THREW       ' + sc.name + '  ' + r.err); bad++; continue; }
  ran++;
  /* `battle.log` carries each `|switch|` TWICE — once per side's `|split|` view. `sdStream` is
   * the driver's own reader for that and must be used, or every switch arm reads as a length
   * mismatch that has nothing to do with order. */
  const sd = actLines(G.sdStream(G.lastSdLog())), me = actLines(r.mediTrace);
  const agree = sd.length === me.length && sd.every((x, i) => x === me[i]);
  if (!agree) bad++;
  console.log('\n' + (agree ? 'ORDER MATCHES' : 'ORDER DIFFERS') + '   ' + sc.name);
  const n = Math.max(sd.length, me.length);
  for (let i = 0; i < n; i++) {
    const L = (sd[i] || '(none)').padEnd(40), R = (me[i] || '(none)');
    console.log('   ' + String(i).padStart(2) + '  showdown ' + L + '  medicham ' + R
      + ((sd[i] === me[i]) ? '' : '   <-- DIFFERS'));
  }
}

for (const sc of SPEED) {
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) { console.log('NOT-STAGED  ' + sc.name); bad++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_turn_order :: ' + sc.name,
                       { script: sc.script, speedCensus: true });
  if (r.err) { console.log('THREW       ' + sc.name + '  ' + r.err); bad++; continue; }
  ran++;
  const rows = r.speedRows || [];
  /* DID THIS ARM HAVE ANYTHING TO BITE ON? x1.5 of an EVEN stat is exact in 4096ths, so an arm whose
   * Choice Scarf lands on an even-Speed body agrees under the break as well as under the fix — a
   * green that proves nothing. EXERCISED means at least one reading where a multiplier was in play
   * AND the stored stat was one the x1.5 family cannot represent exactly. Shown necessary: two of
   * these three arms were NOT exercised when first written and passed the deliberate break. */
  const census = r.speedCensus || [];
  /* AN ARM DECLARES WHAT WOULD MAKE IT BITE. The default is the x1.5 truncation the first three
   * arms exist for; `exercise: 'modified'` is for an arm whose knob is a WHOLE multiplier
   * appearing or not appearing, where an even stat is no obstacle. Either way the arm has to
   * show a reading in which its own knob was actually turned. */
  const exercised = sc.exercise === 'modified'
    ? census.some(x => x.stored != null && x.showdown !== x.stored)
    : census.some(x => x.stored != null && x.showdown !== x.stored
                       && (x.stored * 1.5) !== Math.floor(x.stored * 1.5));
  /* A SCENARIO THAT NEVER REACHED A SECOND BOUNDARY TESTED ONE READING AND IS NOT A PASS. */
  const short = r.turns < sc.script.length;
  if (rows.length || short || r.speedDesync || !exercised) bad++;
  console.log(NL + (rows.length ? 'SPEED DIFFERS' : short ? 'SHORT        '
                    : !exercised ? 'NOT-EXERCISED' : 'SPEED AGREES ')
    + '   ' + sc.name + '   (' + r.turns + '/' + sc.script.length + ' turns, '
    + census.length + ' readings'
    + (r.speedDesync ? ', ' + r.speedDesync + ' DESYNC' : '') + ')');
  if (!exercised) {
    console.log('   no reading in this arm had a modified Speed on a stat x1.5 cannot represent'
      + ' exactly — this arm would be green under the deliberate break too, so it is NOT a pass.');
  }
  for (const x of rows.slice(0, 12)) {
    console.log('   turn ' + x.when + '  ' + x.slot + ' ' + x.body
      + '   showdown ' + x.showdown + '   medicham ' + x.medicham
      + '   [item ' + (x.item || '-') + ', ability ' + x.ability + ', status ' + (x.status || '-')
      + ', boost ' + x.boost_spe_me + ', tw ' + x.tailwind_me + ', weather ' + (x.weather || '-') + ']');
  }
}

console.log('\n' + ran + ' staged, ' + bad + ' not matching (or not staged)');
process.exit(bad ? 1 : 0);
