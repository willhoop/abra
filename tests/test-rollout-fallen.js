/* test-rollout-fallen.js — THE ROLLOUT SEED MUST HAND MEDICHAM THE DEAD (ROADMAP #244).
 *
 * Will, 2026-08-13: *"miltanks rollout needs to just play the game out on medicham and have it match
 * showdown perfectly thats the whole point. miltanks just chooses the actions."*
 *
 * THE DEFECT. `rollout_leaf.buildSide` dropped every fainted body — correct in isolation, a corpse
 * cannot act — and `battleInit` derives THREE different things from the one array it is handed:
 *
 *     actA   = teamA[0..1]          the field
 *     benchA = teamA.slice(2)       who can come in
 *     sfA.team = teamA              THE ROSTER, and the denominator of fallenCount()
 *
 * So dropping the dead before `battleInit` did not merely tidy the bench, it deleted them from the
 * roster: `fallenCount` returned a confident **0** on a position where two of the side were already
 * buried. Last Respects is `50 + 50 x fallen`, so it priced at 50 where the authority says 150, and
 * Supreme Overlord's entry snapshot read 0. The deeper into a game the position is, the wronger it
 * gets — precisely the phase both mechanics exist for.
 *
 * THE OBSERVABLE IS LAST RESPECTS' BASE POWER, because it is unambiguous: `50 + 50N`, one step per
 * death, and nothing else in the format moves it. It is not typed here — `base` and `perFallen` are
 * read out of `data/tags.json` at run time, and the power itself is read back through the engine's
 * own `dmgRange` by inverting a control table computed at every k. A test that hardcoded 150 would
 * still pass if the tag changed underneath it.
 *
 * TWO CLOCKS, AND ONLY ONE OF THEM IS SEARCH'S TO FIX.
 *   §3  AFTER THE FIRST TURN — `battleTurn`'s end-of-turn block calls `fallenCount(sf,act,bench)`,
 *       which reads the roster. Fixing the seed fixes this, and this file is the proof.
 *   §4  AT THE SEED, BEFORE ANY TURN — `battleInit` hardcoded `sfA:{fainted:0}`. A candidate click
 *       being ranked by `rolloutAfterActions` resolves on THAT turn, so this was the decision-
 *       relevant one, and it could not be closed from `rollout_leaf.js` without writing a second
 *       copy of `fallenCount` into the seed. §4 was a HAND-BACK TO ENGINE.
 *
 *       **CLOSED THE SAME NIGHT — ROADMAP #246, and this comment is corrected rather than left.**
 *       ENGINE landed `fallenSettle(S)` and the seed now counts at `battleInit`, so the sentence
 *       "battleInit stamps fainted:0; the recount is at turn end" is no longer true of this engine.
 *       The NUMBERS this file asserts were correct before and remain correct; only the explanation
 *       of why §4 was out of reach had gone stale. Caught by the ENGINE agent that closed it and
 *       fixed here rather than filed — a note that outlives what it describes is the failure this
 *       repository has documented more times than any other.
 *
 *   node tests/test-rollout-fallen.js
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
/* THE ONE DOOR into the species table, engine/mc_key.js. Requiring it also installs the SEAL, so
 * a raw miss anywhere in this process throws instead of quietly reading undefined. */
const { mcKey } = require(D('engine', 'mc_key.js'));
const MONMISS = { mayMiss: 'this fixture sweeps the damage table for a body that fits; absence is an answer' };
const MEDI = require(D('engine', 'medicham2-browser.js'));
const B = require(D('engine', 'board.js'));
const RL = require(D('engine', 'rollout_leaf.js'));
const TAGS = require(D('engine', 'tags.js'));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); }
};
const note = (msg, extra) => console.log('  note ' + msg + (extra ? '   ' + extra : ''));

console.log('\ntest-rollout-fallen — the seed hands MEDICHAM the corpses (ROADMAP #244)\n');

/* ---------------------------------------------------------------------------------------------
 * 0. THE FACT IS READ, NOT TYPED. `powerFromFallen` is derived by engine/tag_dex.js from the
 *    format's own move table; if it ever stops being 50 + 50N this file follows it.
 * ------------------------------------------------------------------------------------------ */
const PF = TAGS.param('move', 'lastrespects', 'powerFromFallen');
ok(!!PF && +PF.base > 0 && +PF.perFallen > 0,
  'data/tags.json carries Last Respects powerFromFallen', PF ? `base ${PF.base} +${PF.perFallen}/fallen` : 'ABSENT');
const bpFor = k => PF.base + PF.perFallen * k;

/* ---------------------------------------------------------------------------------------------
 * THE FIXTURE. Six a side, N of mine already buried, and the graveyard is the board's own record of
 * them — `board.faint()` writes it. CONSTRUCT THE FIXTURE, DO NOT FIND IT: a corpus search for a
 * position with three dead allies AND a Last Respects carrier would return a COULD-NOT-STAGE that is
 * a claim about the corpus rather than about the mechanic.
 *
 * Species are taken from the table rather than typed, exactly as tests/test-rollout-switch.js does:
 * a name that does not resolve builds nothing and this whole file would pass having played no game.
 * ------------------------------------------------------------------------------------------ */
const POOL = (mcKey.keys(MONMISS) || []).slice(0, 12);
const MINE = POOL.slice(0, 6), THEIRS = POOL.slice(6, 12);

function makeBoard(nDead) {
  const bd = new B.Board();
  bd.setParty('p1', MINE); bd.setParty('p2', THEIRS);
  /* The attacker declares Last Respects on its sheet, which is how a real open-sheet game learns a
   * moveset: dmgMon copies `mon.moves` onto the built body, so the rollout body carries it too. */
  bd.setSheet('p1', MINE[0], { nature: 'Serious', item: '', ability: '', moves: ['lastrespects'] });
  bd.switchIn('p1', 'a', MINE[0]);
  bd.switchIn('p2', 'a', THEIRS[0]); bd.switchIn('p2', 'b', THEIRS[1]);
  /* Bury N of mine through slot b, replacing each one, so every corpse is in the GRAVEYARD and none
   * is left standing in a slot — the ordinary mid-game shape, and the one buildSide's own
   * `if (m.fainted) continue` could never have seen. */
  for (let i = 0; i < nDead; i++) { bd.switchIn('p1', 'b', MINE[1 + i]); bd.faint('p1', 'b'); }
  bd.switchIn('p1', 'b', MINE[1 + nDead]);
  return bd;
}

const zero = () => ({ fainted: 0, unbuildable: 0, threw: 0 });
function seed(nDead) {
  const bd = makeBoard(nDead);
  const A = RL.buildSide(bd, 'p1', null, zero());
  const Bt = RL.buildSide(bd, 'p2', null, zero());
  const S = MEDI.battleInit(A, Bt, { seeded: true });
  S.maxTurns = 60;
  return { bd, A, Bt, S };
}

/* THE PROBE. Two throwaway bodies and Last Respects, priced through the engine's own dmgRange, with
 * the attacker's side object swapped for the one under test. Reading the damage rather than the base
 * power is deliberate: base power is a local inside dmgRangeOneHit and is not exported, so the power
 * is INVERTED out of a control table instead of being read from a field this file would have to
 * reach into. */
const probeAtk = () => MEDI.buildMon(MINE[0], {});
const probeDef = () => MEDI.buildMon(THEIRS[0], {});
const FIELD = { weather: null, weatherT: 0, terrain: '', terrainT: 0, twA: 0, twB: 0, tr: 0, gravity: 0, sgA: {}, sgB: {} };
function dmgWith(fallen) {
  const a = probeAtk(), d = probeDef();
  a._sf = { fainted: fallen, side: 'A', sc: {} };
  const r = MEDI.dmgRange(a, d, globalThis.MC.moves['lastrespects'], FIELD, false);
  return r.max;
}
/* dmg -> implied fallen count, and it is only a valid inversion if the table is injective. */
const TABLE = [0, 1, 2, 3, 4, 5].map(dmgWith);
ok(new Set(TABLE).size === TABLE.length,
  'the damage table over fallen counts is injective, so damage identifies the base power',
  TABLE.join(' / '));
function impliedFallen(sf) {
  const a = probeAtk(), d = probeDef();
  a._sf = sf;
  const r = MEDI.dmgRange(a, d, globalThis.MC.moves['lastrespects'], FIELD, false);
  const i = TABLE.indexOf(r.max);
  return i < 0 ? null : i;
}
const impliedBP = sf => { const k = impliedFallen(sf); return k == null ? null : bpFor(k); };

/* ---------------------------------------------------------------------------------------------
 * 1. THE ROSTER. Everyone the side brought, corpses included — and the field/bench split unmoved.
 * ------------------------------------------------------------------------------------------ */
for (const N of [0, 1, 2, 3]) {
  const { S, A } = seed(N);
  const live = A.filter(x => x && !x.fainted && x.curHP > 0).length;
  const dead = A.filter(x => x && x.fainted).length;
  ok(dead === N, `buildSide keeps ${N} corpse(s) in the array it hands battleInit`, `dead ${dead}, live ${live}`);
  ok(S.sfA.team.filter(x => x && x.fainted).length === N,
    `the roster battleInit stamps holds ${N} fallen`, `sfA.team ${S.sfA.team.length}`);
  /* THE SPLIT IS THE OTHER HALF OF THE DESIGN. A corpse in actA would put a dead body on the field
   * and make the engine issue a replacement for it one turn late; a corpse in benchA is inert,
   * because every bench reader in medicham2-browser.js filters through `_live`. */
  ok(S.actA.every(m => m && !m.fainted && m.curHP > 0),
    `no corpse is standing on the field at N=${N}`, S.actA.map(m => m && m.name).join(','));
  ok(S.actA.length === 2, `both of my living actives are still on the field at N=${N}`);
}

/* ---------------------------------------------------------------------------------------------
 * 2. THE CONTROL. Nobody has died, so nothing may move. Without this the file could pass by
 *    inventing deaths.
 * ------------------------------------------------------------------------------------------ */
{
  const { S } = seed(0);
  MEDI.battleTurn(S, () => 0.5, null, null);
  ok(S.sfA.fainted === 0, 'a position with no deaths still reports none', `${S.sfA.fainted}`);
  ok(impliedBP(S.sfA) === bpFor(0), 'Last Respects prices at its floor when nobody has fallen',
    `${impliedBP(S.sfA)} BP`);
}

/* ---------------------------------------------------------------------------------------------
 * 3. THE DEFECT ITSELF. After one turn `fallenCount` reads the roster; with the roster complete it
 *    must see every death the real position has already had.
 * ------------------------------------------------------------------------------------------ */
for (const N of [1, 2, 3]) {
  const { S } = seed(N);
  MEDI.battleTurn(S, () => 0.5, null, null);
  ok(S.sfA.fainted === N, `a playout seeded from a position with ${N} dead ally/allies counts ${N}`,
    `fallenCount -> ${S.sfA.fainted}`);
  ok(impliedBP(S.sfA) === bpFor(N),
    `Last Respects prices at ${bpFor(N)} rather than ${bpFor(0)} with ${N} fallen`,
    `${impliedBP(S.sfA)} BP`);
}

/* ---------------------------------------------------------------------------------------------
 * 4. THE HALF SEARCH CANNOT CLOSE. `battleInit` stamps `fainted: 0` and the recount happens at TURN
 *    END, so the very first turn of every playout — the turn `rolloutAfterActions` forces the
 *    candidate click on — still prices Last Respects at the floor. Closing it is one line in
 *    `battleInit` (derive it with `fallenCount` instead of the literal 0) and that file belongs to
 *    ENGINE. REPORTED, NOT ASSERTED: a red row here would be a red row nobody in this division can
 *    turn green, and "KNOWN FAILURE" is a banned phrase in this repository.
 * ------------------------------------------------------------------------------------------ */
{
  /* WAS A REPORT, IS NOW AN ASSERTION — ROADMAP #246 CLOSED 2026-08-13.
   *
   * This block reported rather than asserted for a good reason: a red row nobody in this division
   * could turn green is the "KNOWN FAILURE" shape, and reporting it was correct while `battleInit`
   * hardcoded `fainted: 0`. ENGINE has since landed `fallenSettle(S)` and the seed counts.
   *
   * **A REPORT THAT SURVIVES ITS OWN FIX IS WORSE THAN NO CHECK**, because the regression it
   * describes is now unguarded and the line still prints as though the defect were live. So it
   * becomes a gate the moment there is someone to hold it. */
  const { S } = seed(3);
  const atSeed = impliedBP(S.sfA);
  ok(atSeed === bpFor(3),
    `at t=0 Last Respects prices at the position's own fallen count (ROADMAP #246, closed)`,
    `t=0 ${atSeed} BP, position says ${bpFor(3)} — the seed no longer starts every playout at zero dead`);
}

/* ---------------------------------------------------------------------------------------------
 * 5. THE GUARD THAT CAN SEE ITS OWN BUG — ROADMAP #245, CLOSED HERE.
 *
 *    `MEDFAILS.fallenNoRoster` was built for exactly #244 and fires only on an ABSENT roster. The
 *    #244 roster was PRESENT and pre-filtered, so it read 0 while the count was wrong — a capability
 *    counter reporting success while the capability is absent. Reported as a note since R13 and
 *    never enforceable, because `fallenCount(sf, act, bench)` sees three arrays and NOTHING in them
 *    distinguishes "nobody died" from "somebody pruned the corpses before I was called". No counter
 *    written inside that function can ever fire on this bug.
 *
 *    So the guard moved to the seam, where the board's own death record is also in scope, and this
 *    block is its RED DEMONSTRATION AS A STANDING ASSERTION rather than a break done once by hand:
 *    the pre-filtered roster is REBUILT here, the two guards are asked the same question, and the
 *    file fails if the engine's counter ever starts catching it (which would mean this arm is no
 *    longer testing what it says) or if the new one ever stops.
 * ------------------------------------------------------------------------------------------ */
{
  const before = MEDI.MEDFAILS.fallenNoRoster;
  const { S } = seed(2);
  MEDI.battleTurn(S, () => 0.5, null, null);
  ok(MEDI.MEDFAILS.fallenNoRoster === before,
    'fallenNoRoster does not fire on a pre-filtered roster — which is ROADMAP #245, not a pass',
    `${MEDI.MEDFAILS.fallenNoRoster}`);
}

/* 5a. THE DEFECT, REBUILT. `buildSide` pre-#244: every corpse dropped before `battleInit`. The
 *     roster is present, non-empty and short by two. */
{
  const bd = makeBoard(2);
  ok(RL.fallenTruth(bd, 'p1') === 2,
    "the board's own death record is the comparator, and it is not the array anyone filters",
    `graveyard ${RL.fallenTruth(bd, 'p1')}`);

  const prefiltered = RL.buildSide(bd, 'p1', null, zero()).filter(m => !m.fainted);
  const Bt = RL.buildSide(bd, 'p2', null, zero());
  const noRosterBefore = MEDI.MEDFAILS.fallenNoRoster;
  const g0 = { ...RL.FALLEN_GUARD };
  const S = MEDI.battleInit(prefiltered, Bt, { seeded: true });

  ok(S.sfA.team && S.sfA.team.length === 4,
    'the pre-filtered roster is PRESENT and NON-EMPTY — which is why the old guard cannot see it',
    `sfA.team ${S.sfA.team.length}`);
  ok(S.sfA.fainted === 0,
    'and the engine confidently counts ZERO fallen on a position with two in the ground',
    `sfA.fainted ${S.sfA.fainted}`);

  /* Silenced for this one call: the arm deliberately triggers the warning it is testing for, and a
   * gate that prints its own alarm reads as a broken gate. */
  RL.FALLEN_GUARD.warned = true;
  RL.checkFallenSeeded(S, bd, 'p1', 'p2');

  ok(MEDI.MEDFAILS.fallenNoRoster === noRosterBefore,
    'THE OLD GUARD IS SILENT ON THE REAL DEFECT — fallenNoRoster does not move',
    `${MEDI.MEDFAILS.fallenNoRoster}`);
  ok(RL.FALLEN_GUARD.mismatch === g0.mismatch + 1,
    'THE NEW GUARD FIRES ON THE REAL DEFECT — exactly one mismatch, on my side',
    `mismatch ${g0.mismatch} -> ${RL.FALLEN_GUARD.mismatch}`);
  ok(/says 0 of p1 have fallen/.test(RL.FALLEN_GUARD.first || ''),
    'and it says which side and both numbers, not merely that something was wrong',
    RL.FALLEN_GUARD.first || '(nothing)');
  ok(RL.FALLEN_GUARD.checked === g0.checked + 2,
    'BOTH sides are checked, so a foe whose dead were dropped is caught too',
    `checked ${g0.checked} -> ${RL.FALLEN_GUARD.checked}`);
}

/* 5b. THE CONTROL. The same guard, the same board, the CORRECT roster. It must be silent — a guard
 *     that fires on everything is a guard that gets turned off. */
{
  const bd = makeBoard(2);
  const A = RL.buildSide(bd, 'p1', null, zero());
  const Bt = RL.buildSide(bd, 'p2', null, zero());
  const g0 = { ...RL.FALLEN_GUARD };
  const S = MEDI.battleInit(A, Bt, { seeded: true });
  RL.checkFallenSeeded(S, bd, 'p1', 'p2');
  ok(RL.FALLEN_GUARD.mismatch === g0.mismatch,
    'the correct roster raises nothing — the guard does not fire on everything',
    `mismatch ${RL.FALLEN_GUARD.mismatch}`);
  ok(RL.FALLEN_GUARD.agreed === g0.agreed + 2,
    'and it AGREED twice rather than being skipped, which is the difference that matters',
    `agreed ${g0.agreed} -> ${RL.FALLEN_GUARD.agreed}`);
}

/* 5bb. IT SPEAKS, AND IT SPEAKS ONCE. A counter nobody reads is the thing ROADMAP #245 is about, so
 *      the guard also prints — and a line per rollout in a 200,000-game run is a line nobody reads,
 *      which is how the last warning of this shape died. Both halves are asserted because they fail
 *      in opposite directions: silent is the bug, and per-rollout spam is how the fix gets removed. */
{
  const bd = makeBoard(1);
  const prefiltered = RL.buildSide(bd, 'p1', null, zero()).filter(m => !m.fainted);
  const S = MEDI.battleInit(prefiltered, RL.buildSide(bd, 'p2', null, zero()), { seeded: true });
  const said = [];
  const real = console.error;
  console.error = (...a) => said.push(a.join(' '));
  RL.FALLEN_GUARD.warned = false;
  try { RL.checkFallenSeeded(S, bd, 'p1', 'p2'); RL.checkFallenSeeded(S, bd, 'p1', 'p2'); }
  finally { console.error = real; RL.FALLEN_GUARD.warned = true; }
  ok(said.length === 1, 'the guard says so out loud — once per process, not once per rollout',
    `${said.length} line(s)`);
  ok(/ROADMAP #244\/#245/.test(said[0] || ''), 'and the line names the rows, so it can be routed',
    (said[0] || '(nothing)').replace(/\n/g, ' ').trim().slice(0, 90));
}

/* 5c. AND IT IS WIRED ON THE PATHS THAT DECIDE. A guard nobody calls is the bug wearing the shape of
 *     the fix, so both real entry points are driven and the counter is asserted to have MOVED.
 *     `rolloutAfterActions` is named separately because it is the RANKING path — the one that prices
 *     the candidate click. */
for (const [name, run] of [
  ['rolloutWinProb', bd => RL.rolloutWinProb(bd, 'p1', { n: 2, seed: 7, maxTurns: 3 })],
  ['rolloutAfterActions', bd => RL.rolloutAfterActions(bd, 'p1', { n: 2, seed: 7, maxTurns: 3, myClicks: [] })],
]) {
  const bd = makeBoard(2);
  const g0 = { ...RL.FALLEN_GUARD };
  run(bd);
  ok(RL.FALLEN_GUARD.checked > g0.checked, `${name} actually calls the guard`,
    `checked ${g0.checked} -> ${RL.FALLEN_GUARD.checked}`);
  ok(RL.FALLEN_GUARD.mismatch === g0.mismatch,
    `${name} seeds a roster the board agrees with, over every playout`,
    `mismatch ${RL.FALLEN_GUARD.mismatch}`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
