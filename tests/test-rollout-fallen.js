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
 *   §4  AT THE SEED, BEFORE ANY TURN — `battleInit` hardcodes `sfA:{fainted:0}`. A candidate click
 *       being ranked by `rolloutAfterActions` resolves on THAT turn, so this is the decision-
 *       relevant one, and it cannot be closed from `rollout_leaf.js` without writing a second copy
 *       of `fallenCount` into the seed. §4 is a HAND-BACK TO ENGINE and is reported, not asserted —
 *       see docs/SEARCH.md and docs/ENGINE.md.
 *
 *   node tests/test-rollout-fallen.js
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
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
const POOL = Object.keys(globalThis.MC.mons).slice(0, 12);
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
  const { S } = seed(3);
  const atSeed = impliedBP(S.sfA);
  note(`ROADMAP #244b (ENGINE): at t=0 Last Respects prices at ${atSeed} where the position says ${bpFor(3)}`,
    `battleInit stamps fainted:0; the recount is at turn end`);
  note('   the roster is now correct, so the ENGINE fix is one line and needs nothing further from SEARCH');
}

/* ---------------------------------------------------------------------------------------------
 * 5. #245, RECORDED WHERE IT WILL BE READ. `MEDFAILS.fallenNoRoster` was built for exactly this bug
 *    and fires only on an ABSENT roster. Here the roster is PRESENT and was pre-filtered, so the
 *    counter reads 0 while the count is wrong — a capability counter reporting success while the
 *    capability is absent. Asserted as 0 because that is the truth about the counter, and the note
 *    is what stops the 0 being read as "the mechanic is fine".
 * ------------------------------------------------------------------------------------------ */
{
  const before = MEDI.MEDFAILS.fallenNoRoster;
  const { S } = seed(2);
  MEDI.battleTurn(S, () => 0.5, null, null);
  ok(MEDI.MEDFAILS.fallenNoRoster === before,
    'fallenNoRoster does not fire on a pre-filtered roster — which is ROADMAP #245, not a pass',
    `${MEDI.MEDFAILS.fallenNoRoster}`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
