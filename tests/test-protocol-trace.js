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
  ['entry, weather, Intimidate, Fake Out flinch, contact punish, Sitrus, Knock Off, faint, switch',
    () => [mon('incineroar', ['fakeout', 'knockoff', 'flareblitz', 'protect'], 'intimidate', 'sitrusberry'),
           mon('torkoal', ['eruption', 'protect', 'bodypress', 'yawn'], 'drought', 'charcoal'),
           mon('azumarill', ['bellydrum', 'aquajet', 'protect', 'playrough'], 'hugepower', 'sitrusberry')],
    () => [mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', 'focussash'),
           mon('tyranitar', ['rockslide', 'crunch', 'protect', 'taunt'], 'sandstream', 'leftovers'),
           mon('clefable', ['moonblast', 'protect', 'followme', 'trickroom'], 'unaware', 'leftovers')],
    [{ a: [{ m: 'fakeout', t: 0 }, { m: 'protect' }], b: [{ m: 'earthquake' }, { m: 'protect' }] },
     { a: [{ m: 'knockoff', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'protect' }, { m: 'rockslide' }] },
     { a: [{ m: 'flareblitz', t: 0 }, { m: 'bodypress', t: 1 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] },
     { a: [{ m: 'flareblitz', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  ['Trick Room, Tailwind, screens, Substitute, Taunt, Leech Seed, Haze, White Herb, Perish Song',
    () => [mon('clefable', ['trickroom', 'reflect', 'protect', 'moonblast'], 'unaware', 'whiteherb'),
           mon('whimsicott', ['tailwind', 'taunt', 'leechseed', 'moonblast'], 'prankster', 'focussash'),
           mon('slowking', ['perishsong', 'haze', 'protect', 'scald'], 'regenerator', 'leftovers')],
    () => [mon('gengar', ['substitute', 'shadowball', 'protect', 'sludgebomb'], 'cursedbody', 'leftovers'),
           mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'leftovers'),
           mon('toxapex', ['toxic', 'recover', 'protect', 'scald'], 'regenerator', 'blacksludge')],
    [{ a: [{ m: 'trickroom' }, { m: 'tailwind' }], b: [{ m: 'substitute' }, { m: 'bodyslam', t: 0 }] },
     { a: [{ m: 'reflect' }, { m: 'taunt', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
     { a: [{ m: 'moonblast', t: 0 }, { m: 'leechseed', t: 1 }], b: [{ m: 'shadowball', t: 0 }, { m: 'bodyslam', t: 0 }] },
     { a: [{ m: 'protect' }, { m: 'moonblast', t: 0 }], b: [{ m: 'sludgebomb', t: 0 }, { m: 'bodyslam', t: 1 }] },
     { a: [{ sw: 'slowking' }, { m: 'moonblast', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
     { a: [{ m: 'haze' }, { m: 'moonblast', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'yawn', t: 0 }] },
     { a: [{ m: 'perishsong' }, { m: 'moonblast', t: 0 }], b: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  ['charge turn, recharge, phaze, hazards, Trick, status, terrain, immunity, always-crit',
    () => [mon('torterra', ['solarbeam', 'stealthrock', 'earthquake', 'protect'], 'overgrow', 'leftovers'),
           mon('gengar', ['hyperbeam', 'willowisp', 'trick', 'shadowball'], 'levitate', 'lumberry'),
           mon('politoed', ['grassyterrain', 'scald', 'protect', 'icywind'], 'drizzle', 'dampro')],
    () => [mon('snorlax', ['roar', 'bodyslam', 'protect', 'yawn'], 'thickfat', 'leftovers'),
           mon('mamoswine', ['iciclecrash', 'earthquake', 'protect', 'iceshard'], 'thickfat', 'focussash'),
           mon('meowscarada', ['flowertrick', 'knockoff', 'protect', 'uturn'], 'overgrow', '')],
    [{ a: [{ m: 'solarbeam', t: 0 }, { m: 'willowisp', t: 0 }], b: [{ m: 'roar', t: 0 }, { m: 'earthquake' }] },
     { a: [{ m: 'stealthrock' }, { m: 'hyperbeam', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'iciclecrash', t: 0 }] },
     { a: [{ m: 'earthquake' }, { m: 'trick', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'earthquake' }] },
     { a: [{ m: 'earthquake' }, { m: 'shadowball', t: 0 }], b: [{ sw: 'meowscarada' }, { m: 'iceshard', t: 0 }] },
     { a: [{ m: 'earthquake' }, { m: 'shadowball', t: 0 }], b: [{ m: 'flowertrick', t: 0 }, { m: 'iciclecrash', t: 0 }] },
     { a: null, b: null }, { a: null, b: null }, { a: null, b: null }, { a: null, b: null }]],

  /* The five events the three scenarios above never reached, each one clicked ON PURPOSE. A scenario
   * written to make a game happen will not reach a Lum Berry or a White Herb, and "we played a lot of
   * games" is not coverage -- §5's own rule pointed at this file. */
  ['setup boost, Lum Berry cure, White Herb restore, Trick, Perish Song',
    () => [mon('clefable', ['willowisp', 'swordsdance', 'trick', 'protect'], 'unaware', 'leftovers'),
           mon('politoed', ['icywind', 'perishsong', 'protect', 'scald'], 'drizzle', 'damprock')],
    () => [mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', 'lumberry'),
           mon('toxapex', ['scald', 'recover', 'protect', 'toxic'], 'regenerator', 'whiteherb')],
    [{ a: [{ m: 'willowisp', t: 0 }, { m: 'icywind', t: 1 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: [{ m: 'swordsdance' }, { m: 'perishsong' }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: [{ m: 'trick', t: 1 }, { m: 'scald', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
     { a: [{ m: 'protect' }, { m: 'scald', t: 0 }], b: [{ m: 'bodyslam', t: 0 }, { m: 'recover' }] },
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
  const A = () => [mon('incineroar', ['fakeout', 'knockoff', 'flareblitz', 'protect'], 'intimidate', ''),
                   mon('snorlax', ['bodyslam', 'protect', 'yawn', 'curse'], 'thickfat', '')];
  const B = () => [mon('clefable', ['moonblast', 'protect', 'followme', 'trickroom'], 'unaware', ''),
                   mon('slowking', ['scald', 'protect', 'haze', 'perishsong'], 'regenerator', '')];
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
  const teamA = () => [mon('incineroar', ['fakeout', 'knockoff', 'flareblitz', 'protect'], 'intimidate', 'sitrusberry'),
                       mon('torkoal', ['eruption', 'protect', 'bodypress', 'yawn'], 'drought', '')];
  const teamB = () => [mon('garchomp', ['earthquake', 'protect', 'dragonclaw', 'rockslide'], 'roughskin', 'focussash'),
                       mon('tyranitar', ['rockslide', 'crunch', 'protect', 'taunt'], 'sandstream', 'leftovers')];
  const script = [{ a: [{ m: 'fakeout', t: 0 }, { m: 'eruption', t: 0 }], b: [{ m: 'earthquake' }, { m: 'rockslide' }] },
                  { a: [{ m: 'knockoff', t: 0 }, { m: 'bodypress', t: 0 }], b: [{ m: 'dragonclaw', t: 0 }, { m: 'crunch', t: 0 }] },
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

/* ================= PART 6 — NO IDENTIFIER FELL BACK ============================================= */
console.log('\nPART 6 — every identifier resolved to a real slot');
if (M.fails.traceBodyOffField)
  fail('MEDFAILS.traceBodyOffField = ' + M.fails.traceBodyOffField
    + ' (first: ' + M.fails.traceBodyOffFieldFirst + ') — a `??` identifier reached the stream');
else pass('traceBodyOffField = 0 across every game above');

/* ================= PART 5 — THE ACCEPTANCE TEST ================================================= */
/* docs/GAME-DIFFERENTIAL-DESIGN.md §6. Showdown IGNORES THE ATTACKER'S NEGATIVE OFFENSIVE STAGES ON
 * A CRIT (sim/battle-actions.ts:1683-1691, `if (isCrit) ignoreNegativeOffensive = true`) and
 * medicham2's declared limitation says it does not. An Intimidated attacker landing a GUARANTEED crit
 * -- Flower Trick, Storm Throw, Frost Breath -- is therefore a two-line scenario that separates the
 * engines exactly, and no staged pair test we own is shaped to notice, because the census asks *does
 * the mechanic fire*, not *is the number right afterwards*.
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
 * Showdown's `|-damage|` must be THE SAME in both arms -- the crit ignored the -1. medicham2's must
 * CHANGE -- it did not. If both engines move, the control is not isolating Intimidate. If neither
 * moves, the scenario never staged the crit.
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
    const s2 = [sdSet('Incineroar', ['Knock Off', 'Protect'], ability),
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
    const B = () => [mon('incineroar', ['knockoff', 'protect'], norm(ability), ''),
                     mon('clefable', ['protect', 'moonblast'], 'unaware', '')];
    return play(A, B, [{ a: [{ m: 'flowertrick', t: 0 }, { m: 'protect' }],
                         b: [{ m: 'knockoff', t: 1 }, { m: 'protect' }] }], 7).trace;
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

  if (!sdIntim || !sdCtrl || !meIntim || !meCtrl)
    fail('the scenario did not produce a |-damage| on p2a in all four cells — nothing is being tested');
  else {
    if (sdIntim !== sdCtrl)
      fail('SHOWDOWN moved between the arms (' + sdCtrl + ' -> ' + sdIntim + '). The crit is supposed '
        + 'to ignore the attacker\'s -1, so the control is not isolating Intimidate.');
    else pass('showdown: the crit ignores Intimidate — |-damage| is ' + sdIntim + ' in BOTH arms');
    if (meIntim === meCtrl)
      fail('MEDICHAM did NOT move between the arms — either the declared crit limitation is gone '
        + '(good news, and this test must then be rewritten) or the Intimidate never landed.');
    else pass('medicham2: the crit does NOT ignore Intimidate — ' + meCtrl + ' -> ' + meIntim
      + ', which is the declared limitation, made visible');
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
