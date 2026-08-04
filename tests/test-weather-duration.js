/* test-weather-duration.js — the sky lasts the same number of turns however it arrived.
 *
 * WHY THIS EXISTS. Weather is set FOUR ways in this format and each has its own branch:
 *
 *   1. an ability on switch-in   Drought 899 uses, Drizzle 3,075, Sand Stream 1,716, Snow Warning 1,561
 *   2. a MOVE                    Sunny Day 588, Rain Dance 919, Sandstorm 10, Snowscape 11
 *   3. MEGA evolution            Charizard-Y arriving with its stone
 *   4. a punish ability          the Sand Spit class, set by being hit
 *
 * WIRE 70 taught branch 2 to read `extendsDuration` off the rock. Branches 1, 3 and 4 kept writing
 * a literal 5. So a Torkoal holding a Heat Rock set FIVE turns of sun by switching in and EIGHT by
 * clicking Sunny Day — same held item, same sky, two answers.
 *
 * That is FACTS ARE GLOBAL broken in its ordinary form: not a missing mechanic but a correct one
 * three callers short, and invisible because every branch worked. 14 of 496 declared setters in the
 * store carry the matching rock — Damp Rock on a Drizzle mon is the common one at 6.2% — and three
 * extra turns of rain is most of a game.
 *
 * WHAT THIS ASSERTS is the INVARIANT, not four separate numbers: for a given sky and a given item,
 * every route agrees. A fifth route added tomorrow that hardcodes 5 fails here without anyone
 * remembering to extend a list of four.
 */
'use strict';
const path = require('path');
/* engine-data FIRST: medicham2 reads the global `MC` at call time, so `buildMon` throws without it
 * and the behavioural half below cannot run at all. */
require(path.join(__dirname, '..', 'data', 'engine-data.js'));
const MEDI = require(path.join(__dirname, '..', 'engine', 'medicham2-browser.js'));
const TAGS = require(path.join(__dirname, '..', 'engine', 'tags.js'));
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

ok(typeof MEDI.weatherTurns === 'function',
   'medicham2 exports weatherTurns — the one place the duration rule lives');
if (typeof MEDI.weatherTurns !== 'function') { console.log('\nWEATHER DURATION: cannot run'); process.exit(1); }

/* The rock and the setter speak DIFFERENT vocabularies on purpose: `extendsDuration.extends` holds
 * MOVE ids (`sunnyday`), because the rock's rulebook text names the move; `weatherSetter.weather`
 * holds ENGINE words (`sun`). Both must resolve, or the comparison silently never matches — which is
 * exactly how a duration bug hides. */
const CASES = [
  { eng: 'sun',  move: 'sunnyday',  rock: 'Heat Rock',   ability: 'Drought' },
  { eng: 'rain', move: 'raindance', rock: 'Damp Rock',   ability: 'Drizzle' },
  { eng: 'sand', move: 'sandstorm', rock: 'Smooth Rock', ability: 'Sand Stream' },
  { eng: 'snow', move: 'snowscape', rock: 'Icy Rock',    ability: 'Snow Warning' },
];

for (const c of CASES) {
  /* BOTH SPELLINGS, ONE ANSWER. If either vocabulary failed to resolve the rock would look inert
   * and this test would pass by agreeing on the wrong number, so the value is pinned too. */
  const byEng = MEDI.weatherTurns(c.eng, c.rock);
  const byMove = MEDI.weatherTurns(c.move, c.rock);
  ok(byEng === 8, `${c.rock} extends ${c.eng} to 8 turns (got ${byEng})`);
  ok(byMove === byEng, `${c.rock}: the engine word and the move id agree (${byMove} vs ${byEng})`);

  /* NO ROCK IS THE BASELINE, and it has to be 5 rather than merely "not 8" — a function that
   * returned 0 for an unheld item would pass a not-8 check and end the weather immediately. */
  ok(MEDI.weatherTurns(c.eng, null) === 5, `${c.eng} with no item lasts 5 turns`);
  ok(MEDI.weatherTurns(c.eng, 'Leftovers') === 5, `${c.eng} with an unrelated item lasts 5 turns`);

  /* THE WRONG ROCK MUST NOT EXTEND. Heat Rock on a rain setter is the case that catches a check
   * written as "does the holder have any extendsDuration item". */
  const wrong = CASES.find(x => x.eng !== c.eng).rock;
  ok(MEDI.weatherTurns(c.eng, wrong) === 5, `${wrong} does NOT extend ${c.eng}`);

  /* LIGHT CLAY IS THE SCREEN ROCK and shares the tag shape exactly — `extends` names Reflect and
   * Light Screen. A consumer that read `toTurns` without checking `extends` would give it sun. */
  ok(MEDI.weatherTurns(c.eng, 'Light Clay') === 5, `Light Clay does NOT extend ${c.eng}`);

  /* THE SETTER'S OWN PARAM must reach the same answer. This is the link that was broken: the
   * ability branch never consulted the item at all. */
  const p = TAGS.param('ability', c.ability, 'weatherSetter');
  ok(p && p.weather, `${c.ability} carries a weatherSetter param`);
  if (p && p.weather) {
    ok(MEDI.weatherTurns(p.weather, c.rock) === 8,
       `${c.ability} + ${c.rock} → 8 turns (the switch-in branch's own path)`);
  }
}

/* A weather this engine does not model must not silently become five turns of nothing. `deltastream`
 * is the real value with no mapping — primal weather is out of this format. */
ok(MEDI.weatherTurns('deltastream', 'Heat Rock') === 0, 'an unmodelled weather yields 0 turns, not 5');
ok(MEDI.weatherTurns('', 'Heat Rock') === 0, 'no weather yields 0 turns');

/* ── THE BRANCHES MUST CALL IT ─────────────────────────────────────────────────────────────────
 *
 * Everything above tests the FUNCTION. The bug was never in a function — it was four branches, three
 * of which never asked. A unit test on `weatherTurns` passes identically whether the switch-in path
 * calls it or writes a literal 5, which is precisely why this half exists: run the real entry path
 * on a real mon and read the real field.
 *
 * This is the rule from CLAUDE.md that the 2026-07-28 failures were all shaped by — a capability
 * that cannot prove it RAN is assumed broken. "Is the code there" was true every time. */
const SETTERS = [
  { species: 'torkoal',   ability: 'Drought',      rock: 'Heat Rock',   eng: 'sun'  },
  { species: 'pelipper',  ability: 'Drizzle',      rock: 'Damp Rock',   eng: 'rain' },
  { species: 'tyranitar', ability: 'Sand Stream',  rock: 'Smooth Rock', eng: 'sand' },
  { species: 'ninetales-alola', ability: 'Snow Warning', rock: 'Icy Rock', eng: 'snow' },
];

let ran = 0;
for (const s of SETTERS) {
  for (const [item, want] of [[s.rock, 8], ['Leftovers', 5]]) {
    /* buildMon's override bag is keyed by SPECIES, not by field — `{torkoal: 'Heat Rock'}` — because
     * its caller passes one map covering a whole team. Passing `{item: …}` is silently ignored and
     * the mon keeps the dataset's default (Charcoal on Torkoal), which is a probe that measures the
     * wrong item and reports a pass. The ability is set after the build for the same reason. */
    const m = MEDI.buildMon(s.species, { [s.species]: item });
    if (!m) { ok(false, `${s.species} is not a buildable mon — the probe cannot see the branch`); continue; }
    m.ability = s.ability;
    ok(m.item === item, `${s.species} was actually built holding ${item} (got ${m.item})`);
    const field = { weather: null, weatherT: 0, terrain: '', terrainT: 0 };
    MEDI.applyEntryEffects(m, field, null);
    ran++;
    ok(field.weather === s.eng,
       `${s.species} switching in sets ${s.eng} (got ${field.weather})`);
    ok(field.weatherT === want,
       `${s.species} + ${item} → ${want} turns through the REAL entry path (got ${field.weatherT})`);
  }
}
/* A zero here means every mon above failed to build and the eight assertions never touched the
 * engine. Reporting "0 failed" on a probe that never ran is the failure this line prevents. */
ok(ran === SETTERS.length * 2, `the entry probe actually ran ${SETTERS.length * 2} times (ran ${ran})`);

console.log(`\nWEATHER DURATION TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
