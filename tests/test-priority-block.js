/* BLOCKED PRIORITY MUST FAIL, NOT MERELY GO SECOND.
 *
 * Will: "farig and tsareena blocking prio, same with psychic terrain, is that all coded in". It was
 * not. data/tags.json has carried armortail, queenlymajesty and dazzling tagged
 * `blocksMove {what:'priority', priorityAbove:0}` since tag_dex was written, and the only thing that
 * ever read it was clickFragility's bench check. The battle loop sorted priority moves to the front
 * of the turn and let them connect, so in every rollout and every self-play game this project has
 * ever run, Sucker Punch beat a Farigiraf. Psychic Terrain's block was not modelled anywhere.
 *
 * The distinction this file pins is the one that makes it a bug rather than a rounding error: a
 * blocked priority move does not lose the speed tie, it FAILS. Treating it as "goes second" would
 * still let it hit.
 *
 * Every case is DERIVED — the blocking abilities come out of the artifact, the priority moves out of
 * the move table — so this test names no Pokemon and cannot rot when the format changes.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
/* THE ONE DOOR into the species table, engine/mc_key.js. Requiring it also installs the SEAL, so
 * a raw miss anywhere in this process throws instead of quietly reading undefined. */
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const E = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));
/* Cheap: champions_sim loads Showdown lazily, and nothing here calls sim(). */
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));

/* THE SILENCER USED TO BE 'splash', AND IT WORKED BY ACCIDENT (2026-08-09, ROADMAP #116).
 *
 * Splash is `isNonstandard: 'Past'` — it does not exist in this format — and worse, it has no row in
 * `MC.moves` at all. The three slots below were silenced because THE ENGINE DID NOT KNOW THE MOVE,
 * not because the move does nothing. Every classic no-op is gone the same way: Celebrate and Hold
 * Hands are `Past` too. `CS.INERT_MOVE` is Recycle, which is legal here, present in `MC.moves`, and
 * fails outright on a body that has consumed no item. Asserted below rather than assumed. */
const SILENT = CS.INERT_MOVE.toLowerCase().replace(/[^a-z0-9]/g, '');

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};
const NEUTRAL = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0 };

console.log('PRIORITY BLOCKING — ARMOR TAIL, QUEENLY MAJESTY, DAZZLING, PSYCHIC TERRAIN\n');

/* ---- the cast, derived ----------------------------------------------------------------------- */
const blockers = TAGS.withTag('ability', 'blocksMove')
  .filter(a => { const p = TAGS.param('ability', a, 'blocksMove'); return p && p.what === 'priority'; });
ok(blockers.length > 0, 'the artifact declares priority-blocking abilities', blockers.join(', '));

/* THE SILENCER MUST BE A MOVE THIS ENGINE ACTUALLY HAS. The predecessor was absent from MC.moves and
 * silenced its slots by being unknown, which is indistinguishable from working until it is not. */
ok(!!MC.moves[SILENT], 'the silencing move has a row in MC.moves',
   `${SILENT} — bp ${MC.moves[SILENT] ? (MC.moves[SILENT].bp || 0) : 'ABSENT'}`);
ok(!(MC.moves[SILENT] && MC.moves[SILENT].bp), 'and it cannot damage anything');

const prioMoves = Object.keys(MC.moves)
  .filter(id => { const m = MC.moves[id]; return m && m.bp && E.movePriority(id, NEUTRAL) > 0; });
ok(prioMoves.length > 0, 'the move table has damaging priority moves', `${prioMoves.length} of them`);

/* ---- 1. the shared function answers correctly ------------------------------------------------ */
const mon = (ability) => ({ ability, fainted: false });
ok(E.priorityRefusedAbove([mon('')], NEUTRAL) === Infinity,
  'a side with no blocker refuses nothing', 'Infinity');
for (const ab of blockers) {
  const bar = E.priorityRefusedAbove([mon(ab)], NEUTRAL);
  const want = TAGS.param('ability', ab, 'blocksMove').priorityAbove || 0;
  ok(bar === want, `${ab} refuses priority above ${want}`, `got ${bar}`);
}
ok(E.priorityRefusedAbove([mon('')], { terrain: 'psychicterrain' }) === 0,
  'Psychic Terrain refuses priority above 0, with no ability present');
ok(E.priorityRefusedAbove([mon('')], { terrain: 'grassyterrain' }) === Infinity,
  'Grassy Terrain refuses nothing — the control that proves it is not blocking on any terrain');
/* Partner covers partner: these abilities protect the whole side in doubles. */
ok(E.priorityRefusedAbove([mon(''), mon(blockers[0])], NEUTRAL) === 0,
  'one blocker covers its partner too', '(they protect the side, not the holder)');

/* ---- 2. THE ONE THAT MATTERS: the battle loop must drop the move ----------------------------- */
/* A real turn, run twice on the same seed and the same Pokemon, differing only in whether the
 * defender has the ability. If the block works, the defender takes damage in one and not the other. */
function damageTaken(defAbility, terrain) {
  /* THE ATTACKER IS GIVEN THE MOVE, not searched for.
   *
   * NOT ONE representative moveset in data/engine-data.js contains a damaging priority move -- all
   * 16 of them exist in the move TABLE and none in any species' assumed four. A first version of
   * this test looked for a species that already had one, found nothing, and reported "could not
   * construct a turn" instead of an answer. Real teams declare their moves on the sheet, which is
   * what this reproduces. It is also why the priority work could never have fired in play until the
   * sheet's moves were actually read (see engine/position_features.js). */
  const names = mcKey.keys(MONMISS) || [];
  const att = E.buildMon(names[0]);
  const def = E.buildMon(names[1]);
  const a2 = E.buildMon(names[3]), b2 = E.buildMon(names[4]);
  if (!att || !def || !a2 || !b2) return null;
  att.moves = [prioMoves[0]];
  def.ability = defAbility;
  def.moves = [SILENT];
  /* SILENCE EVERY OTHER SOURCE OF DAMAGE. The first working version of this measured the defender's
   * HP and got 137 in all five arms -- because the attacker's PARTNER was still swinging with its
   * own moveset, so the number being compared had nothing to do with the priority move. Only `att`
   * may damage anything here, or the test cannot attribute what it measures. */
  a2.moves = [SILENT];
  b2.moves = [SILENT];
  /* battleInit(teamA, teamB) takes no options -- the field lives on the returned state, which is
   * where terrain has to be set. */
  const S = E.battleInit([att, a2], [def, b2]);
  if (!S) return null;
  if (terrain) { S.field.terrain = terrain; S.field.terrainT = 5; }
  /* THE TARGET IS FORCED, not hoped for. Letting the engine pick meant the attacker aimed at the
   * other slot and every arm measured 0 -- the mirror of the partner problem above. battleTurn takes
   * a Map(mon -> action) per side, and playerAction builds one, so the turn under test is exactly
   * "att throws this priority move at def" and nothing else. */
  const actsA = new Map([[att, E.playerAction(att, prioMoves[0], def, S.field)],
                         [a2, { kind: 'pass' }]]);
  const actsB = new Map([[def, { kind: 'pass' }], [b2, { kind: 'pass' }]]);
  const before = def.curHP;
  try { E.battleTurn(S, () => 0.5, actsA, actsB); } catch (e) { return null; }
  return before - def.curHP;
}

const plain = damageTaken('', null);
if (plain === null) {
  ok(false, 'the battle harness produced a turn to measure', 'could not construct one — cannot test the loop');
} else {
  ok(plain > 0, 'a priority move connects when nothing blocks it', `${plain} HP taken`);
  for (const ab of blockers) {
    const got = damageTaken(ab, null);
    ok(got === 0, `${ab} makes the priority move FAIL outright`, `${got} HP taken (want 0)`);
  }
  const psy = damageTaken('', 'psychicterrain');
  ok(psy === 0, 'Psychic Terrain makes it fail outright', `${psy} HP taken (want 0)`);
  const grassy = damageTaken('', 'grassyterrain');
  ok(grassy > 0, 'Grassy Terrain does NOT block it — the control', `${grassy} HP taken`);
}

console.log(fails ? `\nPRIORITY BLOCK: ${fails} FAILED` : '\nPRIORITY BLOCK: all checks passed');
process.exit(fails ? 1 : 0);
