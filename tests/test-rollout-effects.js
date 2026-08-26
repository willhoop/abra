/* test-rollout-effects.js — pins the rollout engine's move-effect rules.
 *
 * These defects were live in medicham2-browser.js until 2026-07-24, and none of them crashed:
 *   1. STATUS MOVES APPLIED A RANDOM STATUS. `applyStatus(t, ['brn','par','slp'][rng()*3|0])` meant
 *      Thunder Wave burned a third of the time and Will-O-Wisp could paralyse.
 *   2. ONLY FAKE OUT COULD FLINCH. Rock Slide's 30%, Iron Head's 30% and 31 other flinch chances
 *      did nothing.
 *   3. NO TYPE IMMUNITIES. A random status ignores them, so Fire types were burned and Electric
 *      types paralysed.
 *   4. PRIORITY WAS A HAND-TYPED TABLE of 18 moves. Everything absent resolved at 0, including all
 *      14 negative-priority moves - Trick Room is -7 and was going at normal speed.
 *   5. FLINCH LEAKED ACROSS TURNS. It was cleared only when the flinched Pokemon tried to act, so a
 *      flinch applied by a slower attacker stole the target's NEXT turn.
 *
 * Expected values are derived from the game's own rules and from Showdown's published move data,
 * not captured from this engine's output.
 *
 *   node tests/test-rollout-effects.js
 */
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'data', 'engine-data.js'));      // sets globalThis.MC
/* THE ONE DOOR into the species table, engine/mc_key.js. Requiring it also installs the SEAL, so
 * a raw miss anywhere in this process throws instead of quietly reading undefined. */
const { mcKey } = require(path.join(__dirname, '..', 'engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const E = require(path.join(__dirname, '..', 'engine', 'medicham2-browser.js'));

/* THE FIXTURE IS DERIVED FROM THE FORMAT, NOT TYPED - 2026-08-26.
 *
 * Sections 1-4 and 8 used to be hand-typed tables of move -> value and a hand-typed list of
 * abilities. Every red row in this file on 2026-08-26 was the TABLE being wrong, never the engine:
 *
 *     darkvoid, lovelykiss, grasswhistle, poisongas   isNonstandard: 'Past' - NOT IN THIS FORMAT
 *     headbutt, astonish, vitalthrow, revenge, teleport      the same
 *     spore                                            legal, and NO legal species can learn it
 *     ironhead flinch 30                               the format says 20
 *     fullmetalbody, guarddog                          legal, ZERO legal carriers - cannot occur
 *
 * Eleven of those fourteen are CLAUDE.md's oldest rule broken inside a test: "NEVER NAME A POKEMON,
 * ITEM, ABILITY OR MOVE THAT IS NOT IN THE REGULATION... every example, every illustration and every
 * derived result." A fixture built on an entity that cannot occur is measuring a game we do not
 * play, and the engine was being called broken for agreeing with the format.
 *
 * So the tables are gone. The population is read out of `Dex.forFormat` on every run and filtered
 * through `engine/fixture_preflight.js` - legal AND learnable for a move, legal AND carried for an
 * ability. A regulation change is picked up with no edit here, which a typed list can never do.
 *
 * IT IS NOT CIRCULAR AND THAT IS THE POINT. The expected value comes from Showdown, which is the
 * authority; reading it out of `data/abra-tags.js` instead would compare the engine against the
 * artifact the engine already reads, and that check would pass while both were wrong together.
 *
 * IT NEEDS THE SIMULATOR. `tests/run-all.js` skips this file loudly when there is no checkout,
 * exactly as it does for `tests/test-engine-diff.js`, which is the pattern this follows. */
const PF = require(path.join(__dirname, '..', 'engine', 'fixture_preflight.js'));
const DEX = PF.dex;
/* Every move that can actually be clicked in Reg M-B. 500-odd; the old table had 30. */
const PLAYABLE = DEX.moves.all().filter(m => PF.playable('move', m.id).ok);

let P = 0, F = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? P++ : F++; };
/* A SWEEP OVER AN EMPTY POPULATION PASSES. `0 of 0 mismatched` reads exactly like a clean engine, so
 * every arm below declares how many rows it actually compared and FAILS at zero. */
const sweep = (label, rows, bad) => {
  ok(rows > 0, label + ': the derived population is ' + rows + ' - a sweep over nothing cannot pass');
  ok(bad.length === 0, label + ': ' + rows + ' compared, ' + bad.length + ' disagree'
     + (bad.length ? ': ' + bad.slice(0, 8).join(', ') : ''));
};

console.log('== 1. a status move inflicts ITS status, not a random one ==');
/* Under the old random pick each of these was 1-in-3 for the wrong status. The population is every
 * playable move the FORMAT says carries a primary status - Thunder Wave paralyses because
 * `moves.get('thunderwave').status` is 'par', not because somebody typed 'par' here. */
{
  const pop = PLAYABLE.filter(m => m.status);
  const bad = [];
  for (const m of pop) {
    const got = (E.moveFx(m.id) || {}).status;
    if (got !== m.status) bad.push(m.id + ' -> ' + got + ' (format says ' + m.status + ')');
  }
  sweep('primary status', pop.length, bad);
}
ok(!(E.moveFx('rockslide') || {}).status, 'an attacking move carries no PRIMARY status (Rock Slide)');

console.log('== 2. accuracy comes from the move, so status moves can miss ==');
/* The real values, not a flat 100. The comparison is VERBATIM against `move.accuracy`, including
 * Showdown's `true` for a move that cannot miss — 122 of the 172 playable status moves are `true`,
 * and folding that to 100 here would be this file inventing a value again, one line after deleting
 * the last one. `data/abra-tags.js` records the same convention (`consumedBy: 'accuracy === true'`),
 * so a consumer that must roll a die can still tell "never rolls" from "rolls and always wins". */
{
  const pop = PLAYABLE.filter(m => m.category === 'Status');
  const bad = [];
  for (const m of pop) {
    const want = m.accuracy;
    const got = (E.moveFx(m.id) || {}).accuracy;
    if (got !== want) bad.push(m.id + ' ' + got + '!=' + want);
  }
  sweep('status-move accuracy', pop.length, bad);
}

console.log('== 3. flinch chances exist for more than Fake Out ==');
/* Rock Slide's 30 and Iron Head's TWENTY. The hand-typed table said Iron Head was 30, which is
 * mainline recall - `dex.moves.get('ironhead').secondaries[0].chance` is 20 in this format, and the
 * engine had it right. The population is every playable move whose secondary applies `flinch`. */
{
  const flinchOf = (m) => {
    const secs = [].concat(m.secondaries || [], m.secondary ? [m.secondary] : []);
    return secs.find(x => x && x.volatileStatus === 'flinch') || null;
  };
  const pop = PLAYABLE.filter(m => flinchOf(m));
  const bad = [];
  for (const m of pop) {
    const want = flinchOf(m).chance;
    const secs = (E.moveFx(m.id) || {}).secondary || [];
    const got = (secs.find(x => x.volatile === 'flinch') || {}).chance;
    if (got !== want) bad.push(m.id + ' ' + got + '!=' + want);
  }
  sweep('flinch chance', pop.length, bad);
}

console.log('== 4. priority spans the full bracket range, not a hand-typed subset ==');
/* The old table had 18 positive entries and NOTHING negative, so every negative-priority move
 * resolved at 0 - Trick Room most damagingly, since it must always go last. It also named five moves
 * this format does not have. Showdown's own `move.priority`, over every playable move. */
{
  const bad = [];
  for (const m of PLAYABLE) {
    const got = E.movePriority(m.id, {});
    if (got !== m.priority) bad.push(m.id + ' ' + got + '!=' + m.priority);
  }
  sweep('priority', PLAYABLE.length, bad);
  /* AND THE RANGE IS ASSERTED, because a sweep in which every move is bracket 0 would also report
   * zero disagreements. The brackets have to actually span. */
  const br = [...new Set(PLAYABLE.map(m => m.priority))].sort((a, b) => a - b);
  ok(br[0] < 0 && br[br.length - 1] > 0,
     'the population spans ' + br[0] + ' to ' + br[br.length - 1]
     + ' - a sweep of all-zero brackets would prove nothing');
}
ok(E.movePriority('trickroom', {}) === DEX.moves.get('trickroom').priority
   && DEX.moves.get('trickroom').priority < 0,
   'Trick Room is negative priority and therefore resolves last');
ok(E.movePriority('nosuchmove', {}) === 0, 'an unknown move defaults to bracket 0');
// Grassy Glide is +1 ONLY in Grassy Terrain - a conditional, which is why Showdown stores no static value
ok(E.movePriority('grassyglide', { terrain: 'grassy' }) === 1, 'Grassy Glide is +1 in Grassy Terrain');
ok(E.movePriority('grassyglide', {}) === 0, 'Grassy Glide is 0 without Grassy Terrain');

console.log('== 5. status immunities are enforced ==');
const mon = (types, ability) => ({ types, ability: ability || '', status: '', fainted: false, curHP: 100 });
ok(E.canTakeStatus(mon(['Fire']), 'brn') === false,      'a Fire type cannot be burned');
ok(E.canTakeStatus(mon(['Electric']), 'par') === false,  'an Electric type cannot be paralysed');
ok(E.canTakeStatus(mon(['Ice']), 'frz') === false,       'an Ice type cannot be frozen');
ok(E.canTakeStatus(mon(['Poison']), 'psn') === false,    'a Poison type cannot be poisoned');
ok(E.canTakeStatus(mon(['Steel']), 'tox') === false,     'a Steel type cannot be badly poisoned');
ok(E.canTakeStatus(mon(['Fire']), 'par') === true,       'but a Fire type CAN be paralysed');
ok(E.canTakeStatus(mon(['Water'], 'waterveil'), 'brn') === false, 'Water Veil blocks burn');
ok(E.canTakeStatus(mon(['Normal'], 'limber'), 'par') === false,   'Limber blocks paralysis');
ok(E.canTakeStatus(mon(['Normal'], 'insomnia'), 'slp') === false, 'Insomnia blocks sleep');
/* RE-PINNED 2026-08-05, WIRE 115. This row asserted `canTakeStatus(shielddust,'brn') === false` and
 * the assertion was WRONG, not the engine — the same event as the Simple/Intimidate row: a test that
 * pinned a defect. `canTakeStatus` is the gate for EVERY status, so a false here made Shield Dust
 * refuse Will-O-Wisp, Thunder Wave, Spore, Toxic and Static, none of which it touches. The official
 * engine at the pinned commit was played on all of them before this line moved: Will-O-Wisp into
 * Shield Dust BURNS, exactly as into a Compound Eyes control. Shield Dust filters a move's
 * SECONDARIES and that now lives at the secondary loop, which is where the census probes it. */
ok(E.canTakeStatus(mon(['Bug'], 'shielddust'), 'brn') === true,
   'Shield Dust does NOT block a direct status move (it filters a move\'s secondaries; official engine burns it)');
/* WIRE 114 — the immunity that was absent from the table altogether. Garganacl is legal in Reg M-B. */
ok(E.canTakeStatus(mon(['Rock'], 'purifyingsalt'), 'brn') === false, 'Purifying Salt blocks burn');
ok(E.canTakeStatus(mon(['Rock'], 'purifyingsalt'), 'slp') === false, 'Purifying Salt blocks sleep');
ok(E.canTakeStatus(mon(['Rock'], 'purifyingsalt'), 'tox') === false, 'Purifying Salt blocks toxic');
ok(E.canTakeStatus(mon(['Rock'], 'sturdy'), 'brn') === true,         'and a Sturdy control still burns');
const already = mon(['Normal']); already.status = 'par';
ok(E.canTakeStatus(already, 'brn') === false, 'a Pokemon already statused cannot take a second');

console.log('== 6. end to end: no illegal status appears in real battles ==');
/* HONEST NOTE ON THIS CHECK. It exercises the whole turn loop, but it is a REGRESSION GUARD, not a
 * discriminating test: run against the pre-fix engine it also reported 0 illegal statuses across 240
 * survivors, because a status action only fires when a species' behaviour priors happen to contain a
 * status move and a foe is unstatused, which is rare enough that 60 battles did not surface one.
 * The discriminating tests are 1-5, which assert the rules directly. This one is kept because it is
 * the only end-to-end path and would catch a future regression in the wiring, but it should not be
 * cited as evidence that the old engine was broken - sections 1-5 are that evidence. */
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const pool = mcKey.keys(MONMISS) || [];
const typeOf = n => (mcKey.row(n, MONMISS) || {}).t || [];
const fires = pool.filter(n => typeOf(n).includes('Fire')).slice(0, 4);
const elecs = pool.filter(n => typeOf(n).includes('Electric')).slice(0, 4);
ok(fires.length > 0 && elecs.length > 0, `found test subjects: ${fires.length} Fire, ${elecs.length} Electric`);

let illegal = 0, checked = 0;
if (fires.length && elecs.length) {
  const others = pool.filter(n => !typeOf(n).includes('Fire') && !typeOf(n).includes('Electric')).slice(0, 40);
  for (let trial = 0; trial < 60; trial++) {
    const A = [fires[trial % fires.length], elecs[trial % elecs.length],
               others[trial % others.length], others[(trial + 7) % others.length]];
    const B = [others[(trial + 1) % others.length], others[(trial + 11) % others.length],
               others[(trial + 21) % others.length], others[(trial + 31) % others.length]];
    const teamA = A.map(n => E.buildMon(n)).filter(Boolean);
    const teamB = B.map(n => E.buildMon(n)).filter(Boolean);
    if (teamA.length < 4 || teamB.length < 4) continue;
    E.battle(teamA, teamB, null);
    for (const m of teamA) {
      checked++;
      if (m.status === 'brn' && (m.types || []).includes('Fire')) illegal++;
      if (m.status === 'par' && (m.types || []).includes('Electric')) illegal++;
      if (m.status === 'frz' && (m.types || []).includes('Ice')) illegal++;
    }
  }
}
ok(illegal === 0, `no immune Pokemon ended a battle with an illegal status (${illegal} bad across ${checked} survivors)`);

console.log('== 7. flinch cannot leak past the turn it was applied ==');
/* Every Pokemon must leave a battle with _flinch cleared. It used to be cleared only when the
 * flinched Pokemon tried to act, so a flinch from a slower attacker persisted into the next turn.
 *
 * SEEDED 2026-08-26, AND IT HAD TO BE BEFORE THE REMAINING LEAK COULD BE FIXED. `E.battle(a,b,null)`
 * takes its die from `Math.random`, so this arm reported `1 leaked of 320` on three runs out of six
 * and `0 leaked` on the other three - a coin-flip red that no one can reproduce and that therefore
 * cannot be attributed to anything. It is the same defect `tests/test-engine-diff.js` fixed with an
 * LCG and for the same reason: THE HEADLINE OF THIS ARM IS A COUNT, and a count nobody can re-run is
 * not a measurement. The constants are Numerical Recipes', as there.
 *
 * THE SEED IS 20260825 BECAUSE THAT ONE USED TO FAIL. Of ten bases swept, 20260825, 20260827 and
 * 123456 leaked and the other seven did not; pinning one of the clean ones would have made this arm
 * green without fixing anything, which is exactly the comfortable answer this project keeps catching
 * itself reaching for. Trial 8 of base 20260825 leaks on an Arcanine.
 *
 * WHAT THE SEEDING THEN EXPOSED: the leak is the WIPE path. The end-of-turn clear
 * (`[...actA,...actB].forEach(m => m._flinch = false)`) sits BELOW the four `break _TURN` sites, so a
 * turn that ends by wiping a side skips it and the flinched body carries the flag out of the battle.
 * Fixed at the engine by clearing on every exit of the turn block rather than on the ordinary one. */
const lcg = (seed) => { let x = (seed >>> 0) || 1;
  return () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296; }; };
let leaked = 0, seen = 0;
for (let trial = 0; trial < 40; trial++) {
  const A = pool.slice(trial * 2, trial * 2 + 4);
  const B = pool.slice(trial * 2 + 40, trial * 2 + 44);
  const teamA = A.map(n => E.buildMon(n)).filter(Boolean);
  const teamB = B.map(n => E.buildMon(n)).filter(Boolean);
  if (teamA.length < 4 || teamB.length < 4) continue;
  E.battle(teamA, teamB, null, lcg(20260825 + trial));
  for (const m of [...teamA, ...teamB]) { seen++; if (m._flinch) leaked++; }
}
ok(leaked === 0, `no Pokemon left a battle still flinching (${leaked} leaked of ${seen})`);


console.log('== 8. Intimidate is not a blanket -1 ==');
/* Intimidate was applied unconditionally to every foe. It is on Incineroar, the most-used Pokemon in
 * the format, so the error was paid in nearly every game.
 *
 * DERIVED 2026-08-26, AND THE HAND LIST WAS WRONG TWICE OVER.
 *
 * It named `fullmetalbody` and `guarddog`, which are legal in Reg M-B and have ZERO legal carriers,
 * so both rows were red for a mechanic that cannot occur. It named `simple`, also at zero carriers.
 * And it could only ever contain what somebody remembered: `ripen` is over-tagged as an
 * invertsBoosts carrier in the artifact (the WIRE 113 defect) and was in NO arm of this file.
 *
 * THE POPULATION IS STRUCTURAL, NOT A REGEX ON HANDLER TEXT. Every legal ability with at least one
 * legal carrier that declares any of the three handlers Showdown routes a boost through:
 * `onTryBoost` (refuse it), `onChangeBoost` (rewrite it), `onAfterEachBoost` (retaliate). Asking for
 * the handler by NAME cannot over-match the way a source-text match can - that is docs/LESSONS.md 4
 * and it has cost this repo three times (refusesStatusMoves caught Telepathy and Wonder Guard;
 * speedOnItemLoss caught Sticky Hold; the weather clause in fixture_preflight matched ZERO).
 *
 * THE EXPECTED VALUE IS THE AUTHORITY'S OWN CODE, RUN. Not read, not remembered: each handler is
 * CALLED with an Intimidate-shaped `{atk: -1}` and the surviving boost is whatever Showdown's own
 * function leaves behind. That is why the 2026-08-05 re-pin (the drop LANDS and THEN Defiant fires,
 * so the net is +1 and not +2) needs no comment to defend it any more - it is computed.
 *
 * The stub below is deliberately minimal and it distinguishes WHO a retaliation boosts: Mirror Armor
 * reflects the drop onto the SOURCE and must leave our body at 0, while Defiant and Competitive
 * boost the TARGET. A stub that recorded both as ours would have scored Mirror Armor as -1. */
const foe = (ability) => ({ ability, fainted: false, curHP: 100,
                            boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 } });
const intim = (ability) => { const f = foe(ability); const r = E.applyIntimidate(f); return { r, f }; };

const BOOST_HANDLERS = ['onTryBoost', 'onChangeBoost', 'onAfterEachBoost'];
/* -> {at, sa} the format itself leaves on a body with this ability after one Intimidate. */
function officialIntimidate(ab) {
  const boost = { atk: -1 };
  const gain = {};
  const target = { isAlly: () => false, boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  const source = { isAlly: () => false, boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  const eff = { id: 'intimidate', name: 'Intimidate', effectType: 'Ability' };
  const battle = {
    add() {}, hint() {}, effectState: {},
    boost(b, who) { if (who === target) Object.assign(gain, b); },
  };
  if (ab.onChangeBoost) ab.onChangeBoost.call(battle, boost, target, source, eff);
  if (ab.onTryBoost) ab.onTryBoost.call(battle, boost, target, source, eff);
  const landed = boost.atk === undefined ? 0 : boost.atk;
  if (ab.onAfterEachBoost && landed < 0) {
    ab.onAfterEachBoost.call(battle, { atk: landed }, target, source, eff);
  }
  return { at: landed + (gain.atk || 0), sa: gain.spa || 0 };
}

const plain = intim('');
ok(plain.f.boosts.at === -1, 'an ordinary Pokemon drops to -1 Attack');

{
  const pop = DEX.abilities.all().filter(a =>
    PF.playable('ability', a.id).ok && BOOST_HANDLERS.some(h => typeof a[h] === 'function'));
  const bad = [];
  const shapes = { refused: 0, flipped: 0, retaliated: 0, plain: 0 };
  for (const ab of pop) {
    const want = officialIntimidate(ab);
    const { f } = intim(ab.id);
    if (f.boosts.at !== want.at || f.boosts.sa !== want.sa) {
      bad.push(ab.id + ' at=' + f.boosts.at + '/' + want.at + ' sa=' + f.boosts.sa + '/' + want.sa);
    }
    if (want.at === 0 && want.sa === 0) shapes.refused++;
    else if (want.at > 0) shapes.flipped++;
    else if (want.sa > 0) shapes.retaliated++;
    else shapes.plain++;
  }
  sweep('Intimidate vs every legal boost-handling ability', pop.length, bad);
  /* AND THE POPULATION HAS TO CONTAIN MORE THAN ONE ANSWER. If every derived ability came out at a
   * plain -1 the sweep would be green against an engine that had never heard of Clear Body. */
  ok(shapes.refused > 0 && shapes.flipped > 0 && shapes.retaliated > 0,
     'the sweep spans all four outcomes - refused ' + shapes.refused + ', flipped ' + shapes.flipped
     + ', retaliated ' + shapes.retaliated + ', plain -1 ' + shapes.plain);
}

/* The two rows the derivation cannot state for itself: the SIZE of the Defiant swing, which is the
 * thing the sign error actually cost, and that a refusal is not merely "some ability did nothing". */
const d = intim('defiant');
ok(d.f.boosts.at - plain.f.boosts.at === 2,
   'a Defiant target is two stages better off than a plain one (' + plain.f.boosts.at + ' vs ' + d.f.boosts.at + ')');
ok(intim('clearbody').f.boosts.at === 0 && plain.f.boosts.at === -1,
   'and a refusing ability really is a refusal, against a control that drops');

console.log(`\nROLLOUT EFFECT TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
