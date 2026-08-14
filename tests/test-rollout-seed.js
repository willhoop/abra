/* test-rollout-seed.js — WHAT THE SEED IS STILL PRETENDING (ROADMAP #247, #248, #249, #250).
 *
 *   node tests/test-rollout-seed.js
 *
 * Will, 2026-08-13: *"miltanks rollout needs to just play the game out on medicham and have it match
 * showdown perfectly thats the whole point. miltanks just chooses the actions."*
 *
 * That sentence makes the SEED the only place a correct simulator can still produce a wrong game, so
 * every approximation on it is a defect by definition rather than a tradeoff. Four were swept out of
 * the seeding path while ROADMAP #244 was being closed, and this file is their gate. They are one
 * batch because they are one surface: fixing them piecemeal makes each result unattributable.
 *
 *   #248  a benched Pokemon entered at full HP, unstatused, AND CARRYING THE DATASET'S MOVES rather
 *         than the ones its own sheet declares — in a format where we HAVE the sheet. Same class as
 *         the mega rows shipping with `mv: []` and scoring as threatening nothing.
 *   #250  every seeded body could Fake Out, because `_mvActs` is 0 on a body that has been standing
 *         there for six turns.
 *   #249  the seed carried no hazards, no screens and no Gravity.
 *   #247  Supreme Overlord's entry snapshot was 0 on every body, because the count is frozen at
 *         ENTRY (#243) and a body placed by `battleInit` never goes through `bringIn`.
 *
 * NOTHING HERE IS TYPED FROM MEMORY. Every species, move and ability is derived at run time:
 * carriers of an ability come out of `Dex.forFormat(...)` filtered to the regulation, a move's
 * SIDE comes out of `move.target`, and the bodies come out of `MC.mons`. The two damage-based
 * observables are INVERTED out of control tables computed through the engine's own `dmgRange`, and
 * each table is asserted injective before it is used as a lookup — a test that hardcoded "150 BP"
 * would still pass if the tag moved underneath it.
 *
 * RED PROOF, taken before a byte of the fix existed: **9 passed, 14 failed**, and every failure was
 * one of the four defects reading its floor — bench moves = the dataset's four, bench HP = full,
 * `_mvActs` = 0 with the flinch landing on a body six turns out, `sfA.hz`/`sc`/`gravity` empty, and
 * `_fallenStuck` = 0 with three allies buried. The controls were green in the same run, which is what
 * says the file cannot pass by inventing state.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent, and the legality of every fixture body ' +
    'in this file is DERIVED from it. This is not a pass.');
  process.exit(2);
}
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const B = require(D('engine', 'board.js'));
const RL = require(D('engine', 'rollout_leaf.js'));
const TAGS = require(D('engine', 'tags.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); }
};
const note = (msg, extra) => console.log('  note ' + msg + (extra ? '   ' + extra : ''));

console.log('\ntest-rollout-seed — the four things the seed was still pretending ' +
  '(ROADMAP #247/#248/#249/#250)\n');

/* ---------------------------------------------------------------------------------------------
 * THE POPULATION, DERIVED.
 *
 * `MC.mons` is what the engine can build; the regulation is what may be NAMED. A body has to be in
 * both, so the pool is the intersection and nothing in this file is a species literal.
 * ------------------------------------------------------------------------------------------ */
const nrm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legalSpecies = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* A body that will not build is REPORTED rather than dropped in silence: a shrinking pool is how a
 * fixture file comes to test three species and still pass. */
const UNBUILDABLE = [];
const BUILDABLE = Object.keys(globalThis.MC.mons)
  .filter(id => legalSpecies(dex.species.get(id)))
  .filter(id => {
    try { return !!MEDI.buildMon(id); }
    catch (e) { UNBUILDABLE.push(id + ': ' + ((e && e.message) || e)); return false; }
  });
if (UNBUILDABLE.length) note(`${UNBUILDABLE.length} legal species would not build`, UNBUILDABLE[0]);
ok(BUILDABLE.length >= 12, 'the fixture pool is buildable AND legal in this regulation',
  `${BUILDABLE.length} species`);

/* A species OBSERVED clicking a move on the real ladder is a species that can legally use it —
 * `data/move-priors.json` is 128,548 recorded clicks, so this is a measurement rather than a
 * learnset claim typed here. Sorted so the fixture is reproducible. */
const PRIORS = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8')).species || {};
const observedUsersOf = mv => Object.keys(PRIORS)
  .filter(sp => (PRIORS[sp].moves || []).some(m => m && m.mv === mv && m.p > 0))
  .map(nrm).filter(sp => BUILDABLE.includes(sp)).sort();
/* What a species really clicks, most-often first — used to give a fixture body a moveset that is
 * legal by observation instead of one typed here. */
const observedMovesOf = sp => ((PRIORS[sp] || {}).moves || [])
  .filter(m => m && m.mv && m.p > 0 && globalThis.MC.moves[m.mv])
  .sort((a, b) => b.p - a.p).map(m => m.mv);

const carriersOf = ability => dex.species.all().filter(legalSpecies)
  .filter(s => Object.values(s.abilities || {}).some(a => nrm(a) === ability))
  .map(s => s.id).filter(id => globalThis.MC.mons[id]);

const FIELD = { weather: null, weatherT: 0, terrain: '', terrainT: 0, twA: 0, twB: 0, tr: 0,
                gravity: 0, sgA: {}, sgB: {} };
const zero = () => ({ fainted: 0, unbuildable: 0, threw: 0 });
const MINE = BUILDABLE.slice(0, 6), THEIRS = BUILDABLE.slice(6, 12);

function baseBoard() {
  const bd = new B.Board();
  bd.setParty('p1', MINE); bd.setParty('p2', THEIRS);
  return bd;
}

/* ---------------------------------------------------------------------------------------------
 * 1. ROADMAP #248 (a) — A BENCHED POKEMON CARRIES ITS OWN DECLARED MOVES.
 *
 * `sideTeam` synthesises a benched body from a species name, because `board.bench()` returns species
 * names and the board holds no live object for one. It passed `item`, `nature` and `pp` from the
 * sheet and NOT `moves`, so `dmgMon` left `buildMon`'s dataset-representative four in place and every
 * body coming off the bench was valued on the average build of its species.
 *
 * THE CONTROL IS THE HALF THAT MATTERS: the declared four must DIFFER from the dataset four, or a
 * green row here would prove nothing at all.
 * ------------------------------------------------------------------------------------------ */
{
  const bd = baseBoard();
  bd.switchIn('p1', 'a', MINE[0]); bd.switchIn('p1', 'b', MINE[1]);
  bd.switchIn('p2', 'a', THEIRS[0]); bd.switchIn('p2', 'b', THEIRS[1]);

  /* The benched body under test. Its declared four are ITS OWN observed clicks, rotated so they are
   * not the dataset's list in the dataset's order. */
  const SP = MINE[2];
  const datasetFour = (globalThis.MC.mons[SP].mv || []).map(nrm);
  const observed = observedMovesOf(SP);
  const declared = observed.filter(m => !datasetFour.includes(m)).slice(0, 2)
    .concat(datasetFour.slice(0, 2));
  ok(declared.length >= 3 && declared.some(m => !datasetFour.includes(m)),
    'the fixture sheet declares a moveset the dataset does NOT list, so the assertion can fail',
    `declared [${declared}] vs dataset [${datasetFour}]`);
  bd.setSheet('p1', SP, { nature: 'Serious', item: '', ability: '', moves: declared });

  const row = RL.sideTeam(bd, 'p1', null).find(m => nrm(m.species) === SP);
  ok(!!row, 'the benched species reaches sideTeam at all', row ? nrm(row.species) : 'ABSENT');
  ok(!!row && Array.isArray(row.moves) && row.moves.length > 0,
    'ROADMAP #248 — the bench synthesis carries the sheet\'s MOVES, not only item/nature/pp',
    row ? JSON.stringify(row.moves) : '-');

  const A = RL.buildSide(bd, 'p1', null, zero());
  const body = A.find(m => m && nrm(m.name) === SP);
  ok(!!body, 'the benched body is built', body ? body.name : 'ABSENT');
  const got = (body && body.moves || []).map(nrm);
  const want = declared.map(nrm).filter(id => globalThis.MC.moves[id]);
  ok(want.every(id => got.includes(id)) && got.length === want.length,
    'ROADMAP #248 — the built bench body\'s moves are its SHEET\'s, not the dataset\'s',
    `got [${got}] want [${want}]`);

  /* The control: a benched species with NO sheet keeps the dataset four. The sheet is what wins,
   * and a closed-sheet game must be unchanged by this. */
  const noSheet = A.find(m => m && nrm(m.name) === MINE[3]);
  const dsFour = (globalThis.MC.mons[MINE[3]].mv || []).map(nrm);
  ok(!!noSheet && (noSheet.moves || []).map(nrm).join(',') === dsFour.join(','),
    'CONTROL — a benched species with no sheet still gets the dataset four (closed sheets unchanged)',
    noSheet ? (noSheet.moves || []).join(',') : '-');
}

/* ---------------------------------------------------------------------------------------------
 * 2. ROADMAP #248 (b) — A BENCHED POKEMON IS NOT WHOLE AND UNSTATUSED.
 *
 * A Pokemon that pivoted out at 20% and burnt came back to the playout clean, on every sample, on
 * both sides — so a rollout could sack a body it believed was healthy and price a switch that the
 * real position cannot afford. HP and status are PUBLIC information in a real battle: the protocol
 * shows both, and the board simply threw them away when `switchIn` built a new object over the top.
 *
 * BOOSTS ARE THE OPPOSITE CASE AND ARE ASSERTED AS SUCH: Showdown clears stat stages on switch-out,
 * so a bench body must arrive at zero and a fix that "remembered" them would be wrong.
 * ------------------------------------------------------------------------------------------ */
{
  const bd = baseBoard();
  bd.switchIn('p1', 'a', MINE[0]); bd.switchIn('p1', 'b', MINE[1]);
  bd.switchIn('p2', 'a', THEIRS[0]); bd.switchIn('p2', 'b', THEIRS[1]);
  /* MINE[1] takes a beating and a burn, boosts itself, then pivots out for MINE[2]. */
  const hurt = bd.slot('p1', 'b');
  hurt.hp = 0.2; hurt.status = 'brn'; hurt.boosts = { atk: 2 };
  bd.switchIn('p1', 'b', MINE[2]);

  const row = RL.sideTeam(bd, 'p1', null).find(m => nrm(m.species) === MINE[1]);
  ok(!!row, 'the pivoted-out body is back on the bench', row ? nrm(row.species) : 'ABSENT');
  ok(!!row && Math.abs(row.hp - 0.2) < 1e-9,
    'ROADMAP #248 — a benched body carries the HP it left the field with', row ? String(row.hp) : '-');
  ok(!!row && row.status === 'brn',
    'ROADMAP #248 — a benched body carries the status it left the field with', row ? `'${row.status}'` : '-');
  ok(!!row && !Object.keys(row.boosts || {}).length,
    'CONTROL — its stat stages are NOT carried, because Showdown clears them on switch-out',
    row ? JSON.stringify(row.boosts) : '-');

  const A = RL.buildSide(bd, 'p1', null, zero());
  const body = A.find(m => m && nrm(m.name) === MINE[1]);
  ok(!!body && body.curHP > 0 && body.curHP < body.st.hp * 0.35,
    'the built bench body is seeded at its real HP rather than full',
    body ? `${body.curHP}/${body.st.hp}` : '-');
  ok(!!body && body.status === 'brn', 'the built bench body is seeded burnt',
    body ? `'${body.status}'` : '-');

  /* The control: a body that has never been on the field has no state to carry and must be whole. */
  const fresh = A.find(m => m && nrm(m.name) === MINE[3]);
  ok(!!fresh && fresh.curHP === fresh.st.hp && !fresh.status,
    'CONTROL — a species that has never appeared is still whole and unstatused',
    fresh ? `${fresh.curHP}/${fresh.st.hp} '${fresh.status}'` : '-');
}

/* ---------------------------------------------------------------------------------------------
 * 3. ROADMAP #250 — A BODY THAT HAS BEEN STANDING THERE CANNOT FAKE OUT.
 *
 * `firstTurnOnlyRefused` gates on `_mvActs`, which is Showdown's `activeMoveActions`; `buildMon` sets
 * it to 0 and `dmgMon` carried HP, status, stages, item, ability, moves and PP across and nothing
 * about how long the body had been out. Fake Out is 16,871 corpus uses.
 *
 * THE OBSERVABLE IS THE FLINCH, not a field: the turn is played and the trace is read. A body whose
 * Fake Out is refused emits `|-fail|` and the foe acts normally; one whose Fake Out lands makes the
 * foe emit `|cant|...|flinch`. Reading `_mvActs` back would only prove the seed wrote what the seed
 * wrote.
 * ------------------------------------------------------------------------------------------ */
{
  const FOUSERS = observedUsersOf('fakeout');
  ok(FOUSERS.length > 0, 'a Fake Out user is derived from observed ladder clicks, not typed',
    `${FOUSERS.length} species`);
  const FU = FOUSERS[0];

  function seedFakeOut(nActs) {
    const bd = baseBoard();
    bd.setParty('p1', [FU].concat(MINE.filter(s => s !== FU)).slice(0, 6));
    bd.setSheet('p1', FU, { nature: 'Serious', item: '', ability: '', moves: ['fakeout'] });
    bd.switchIn('p1', 'a', FU);
    bd.switchIn('p2', 'a', THEIRS[0]);
    /* The move actions are recorded the way a real game records them: through `noteMove`, the one
     * function both the live adapter and the fitter's replay call on every `|move|` line. */
    const mv = dex.moves.get('fakeout');
    for (let i = 0; i < nActs; i++) B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
    const A = RL.buildSide(bd, 'p1', null, zero());
    const Bt = RL.buildSide(bd, 'p2', null, zero());
    const trace = [];
    const S = MEDI.battleInit(A, Bt, { seeded: true, trace });
    const me = S.actA[0], foe = S.actB[0];
    const act = MEDI.playerAction(me, 'fakeout', foe, S.field);
    const f = new Map(); if (act) f.set(me, act);
    MEDI.battleTurn(S, () => 0.5, f, null);
    return { mvActs: me._mvActs | 0, flinched: trace.some(l => /\|cant\|.*flinch/.test(String(l))),
             trace };
  }

  const fresh = seedFakeOut(0);
  ok(fresh.flinched, 'CONTROL — a body that has just come out still lands Fake Out',
    `_mvActs seeded ${fresh.mvActs - 1}`);

  for (const n of [1, 6]) {
    const r = seedFakeOut(n);
    ok(!r.flinched, `ROADMAP #250 — a body ${n} move-action(s) into the game cannot Fake Out`,
      `_mvActs seeded ${r.mvActs - 1}, flinch ${r.flinched}`);
  }
}

/* ---------------------------------------------------------------------------------------------
 * 4. ROADMAP #249 — HAZARDS, SCREENS AND GRAVITY.
 *
 * `applyField` translated exactly four things — weather, terrain, Tailwind, Trick Room — and
 * `battleInit` starts `sf.hz` absent and `sf.sc` empty, so every rollout switch-in walked onto a
 * clean field and every screen the real position is under was deleted.
 *
 * *** THE SIDE IS THE TRAP, AND ROADMAP #254 CLOSED THE OTHER HALF OF IT. ***
 * Of the 11 legal side-condition moves, SEVEN are `allySide` and FOUR are `foeSide` — Stealth Rock,
 * Spikes, Sticky Web, Toxic Spikes. `board.js` now resolves that ONCE, in `sideFor`, at the moment
 * the condition is WRITTEN. So the seed must read the board's own per-side record STRAIGHT and must
 * NOT flip anything: a second answer here would re-introduce #254 one layer up, and it would look
 * exactly like a fix. This block asserts the placement end to end — laid by p1, read from BOTH
 * seats — precisely so a double flip fails rather than cancelling.
 * ------------------------------------------------------------------------------------------ */
{
  /* The population is derived, not listed: every legal move that starts a side condition. */
  const SIDE_MOVES = dex.moves.all().filter(m => m && m.exists && !m.isNonstandard && m.sideCondition);
  const FOE_SIDE = SIDE_MOVES.filter(m => m.target === 'foeSide').map(m => m.id);
  const ALLY_SIDE = SIDE_MOVES.filter(m => m.target === 'allySide').map(m => m.id);
  ok(FOE_SIDE.length > 0 && ALLY_SIDE.length > 0,
    'both side-condition classes exist in this regulation, derived from move.target',
    `${FOE_SIDE.length} foeSide, ${ALLY_SIDE.length} allySide`);

  const HZ = TAGS.withTag('move', 'hazard') || [];
  const SCREENS = TAGS.withTag('move', 'halvesDamage') || [];

  function laid(clicks, singles) {
    const bd = baseBoard();
    bd.switchIn('p1', 'a', MINE[0]); bd.switchIn('p2', 'a', THEIRS[0]);
    if (!singles) { bd.switchIn('p1', 'b', MINE[1]); bd.switchIn('p2', 'b', THEIRS[1]); }
    for (const [side, id] of clicks) {
      const m = dex.moves.get(id);
      B.noteMove(bd, side, bd.slot(side, 'a'), m, true);
    }
    return bd;
  }
  const seedFrom = (bd, side) => {
    const A = RL.buildSide(bd, side, null, zero());
    const Bt = RL.buildSide(bd, side === 'p1' ? 'p2' : 'p1', null, zero());
    const S = MEDI.battleInit(A, Bt, { seeded: true });
    RL.applyField(S, {}, side, true);
    if (typeof RL.applySideState === 'function') RL.applySideState(S, bd, side);
    return S;
  };

  /* --- hazards, laid by p1, which puts them on p2 ------------------------------------------- */
  for (const hzMove of HZ) {
    const p = TAGS.param('move', hzMove, 'hazard') || {};
    const key = nrm(p.hazard || hzMove);
    const bd = laid([['p1', hzMove]]);
    /* precondition — ROADMAP #254's half. If this is red the seed is not what is broken. */
    ok(bd.hasSide('p2', key) && !bd.hasSide('p1', key),
      `PRECONDITION (#254) — ${hzMove} laid by p1 is recorded against p2`,
      `p1 ${bd.hasSide('p1', key)} / p2 ${bd.hasSide('p2', key)}`);

    const asP1 = seedFrom(bd, 'p1');
    ok(((asP1.sfB.hz || {})[key] | 0) > 0 && !((asP1.sfA.hz || {})[key] | 0),
      `ROADMAP #249 — seeding from p1, ${key} is on the FOE's side of the playout`,
      `sfA ${JSON.stringify(asP1.sfA.hz || {})} sfB ${JSON.stringify(asP1.sfB.hz || {})}`);
    const asP2 = seedFrom(bd, 'p2');
    ok(((asP2.sfA.hz || {})[key] | 0) > 0 && !((asP2.sfB.hz || {})[key] | 0),
      `ROADMAP #249 — seeding from p2, the same ${key} is on MY side of the playout`,
      `sfA ${JSON.stringify(asP2.sfA.hz || {})} sfB ${JSON.stringify(asP2.sfB.hz || {})}`);
  }

  /* --- and it is READABLE: a body that switches in on the layered side takes the chip ------- */
  {
    const rock = HZ.find(id => nrm((TAGS.param('move', id, 'hazard') || {}).hazard) === 'stealthrock');
    ok(!!rock, 'the entry-damage hazard is identified by its tag rather than by name', String(rock));
    /* ALL FOUR SLOTS PIVOT, and that is not tidiness. The first version of this control switched one
     * slot a side, the partner that stayed attacked, and the incoming body lost HP for a reason that
     * was not the hazard — a green row for the wrong reason on one side and a red control on the
     * other, while the seed was still completely empty. With every slot switching NOBODY attacks, so
     * any HP that moves is entry damage.
     *
     * (A one-active-per-side board does not work either, and the reason is worth keeping: `battleInit`
     * takes `teamA[0]` and `teamA[1]` as the field, so the first BENCH body of a lone active is
     * promoted onto it.) */
    const bd = laid([['p1', rock]]);
    const S = seedFrom(bd, 'p1');
    const inFoe = S.benchB[0], inMine = S.benchA[0];
    const f = new Map(), g = new Map();
    S.actA.forEach((m, i) => { if (S.benchA[i]) f.set(m, { kind: 'switch', to: S.benchA[i] }); });
    S.actB.forEach((m, i) => { if (S.benchB[i]) g.set(m, { kind: 'switch', to: S.benchB[i] }); });
    MEDI.battleTurn(S, () => 0.5, f, g);
    ok(!!inFoe && inFoe.curHP < inFoe.st.hp,
      'ROADMAP #249 — the foe\'s switch-in walks into the rocks the real position has laid',
      inFoe ? `${inFoe.curHP}/${inFoe.st.hp}` : '-');
    ok(!!inMine && inMine.curHP === inMine.st.hp,
      'CONTROL — MY switch-in takes nothing, because the layer put them on the other side',
      inMine ? `${inMine.curHP}/${inMine.st.hp}` : '-');
  }

  /* --- screens, which are allySide and must NOT flip ---------------------------------------- */
  for (const sc of SCREENS) {
    const m = dex.moves.get(sc);
    if (!m || !m.exists || !m.sideCondition) continue;
    const bd = laid([['p1', sc]]);
    const S = seedFrom(bd, 'p1');
    ok(((S.sfA.sc || {})[nrm(m.sideCondition)] | 0) > 0,
      `ROADMAP #249 — ${sc} clicked by p1 is up on p1's OWN side of the playout`,
      `sfA.sc ${JSON.stringify(S.sfA.sc || {})}`);
  }

  /* --- Gravity, which is a FIELD fact and lives on `field.gravity` --------------------------- */
  {
    const GRAV = (TAGS.withTag('move', 'groundsField') || [])[0];
    ok(!!GRAV, 'the field-grounding move is identified by its tag', String(GRAV));
    const bd = laid([['p1', GRAV]]);
    const S = seedFrom(bd, 'p1');
    ok((S.field.gravity | 0) > 0, 'ROADMAP #249 — Gravity reaches the seeded playout',
      `field.gravity ${S.field.gravity}`);
  }

  /* --- the control: a clean board seeds a clean playout -------------------------------------- */
  {
    const bd = laid([]);
    const S = seedFrom(bd, 'p1');
    const any = Object.values(S.sfA.hz || {}).concat(Object.values(S.sfB.hz || {}))
      .concat(Object.values(S.sfA.sc || {})).concat(Object.values(S.sfB.sc || {}))
      .some(v => v > 0);
    ok(!any && !(S.field.gravity | 0),
      'CONTROL — a position with nothing up seeds a playout with nothing up',
      `hz ${JSON.stringify(S.sfA.hz || {})}/${JSON.stringify(S.sfB.hz || {})} gravity ${S.field.gravity}`);
  }
}

/* ---------------------------------------------------------------------------------------------
 * 5. ROADMAP #247 — SUPREME OVERLORD'S ENTRY SNAPSHOT.
 *
 * #243 records the split and it is the whole difficulty: Last Respects re-reads the side's death
 * count every time it hits, and Supreme Overlord reads it ONCE in `onStart` and freezes it. So a
 * correct `sf.fainted` at t=0 — which ROADMAP #246 landed — does not answer this one. The engine
 * stamps `_fallenStuck` in `bringIn`, and a body placed on the field by `battleInit` never goes
 * through `bringIn`.
 *
 * THE OBSERVABLE IS THE DAMAGE, inverted out of a control table over `_fallenStuck` and asserted
 * injective first, exactly as tests/test-rollout-fallen.js does for Last Respects.
 *
 * THE CONTROL IS THE MECHANIC: a body that was ALREADY STANDING THERE when its allies died gets
 * NOTHING, because the snapshot was taken on entry. A fix that read `sf.fainted` for every body
 * would pass the first row and fail this one — which is why both are here.
 * ------------------------------------------------------------------------------------------ */
{
  const CAR = carriersOf('supremeoverlord');
  ok(CAR.length === 1, 'the fallen-count ability has exactly one carrier in this regulation, derived',
    CAR.join(','));
  const K = CAR[0];
  const HIT = (globalThis.MC.mons[K].mv || []).map(nrm)
    .find(id => globalThis.MC.moves[id] && (globalThis.MC.moves[id].bp | 0) > 0);
  ok(!!HIT, 'the carrier has a damaging move in its own dataset row', String(HIT));

  const probe = fallen => {
    const a = MEDI.buildMon(K, {}); a.ability = 'supremeoverlord'; a._fallenStuck = fallen;
    a._sf = { fainted: 0, side: 'A', sc: {} };
    const d = MEDI.buildMon(THEIRS[0], {});
    return MEDI.dmgRange(a, d, globalThis.MC.moves[HIT], FIELD, false).max;
  };
  const TABLE = [0, 1, 2, 3].map(probe);
  ok(new Set(TABLE).size === TABLE.length,
    'the damage table over the entry snapshot is injective, so damage identifies the snapshot',
    TABLE.join(' / '));
  const impliedFrom = body => {
    const a = MEDI.buildMon(K, {}); a.ability = 'supremeoverlord';
    a._fallenStuck = body._fallenStuck | 0; a._sf = { fainted: 0, side: 'A', sc: {} };
    const d = MEDI.buildMon(THEIRS[0], {});
    return TABLE.indexOf(MEDI.dmgRange(a, d, globalThis.MC.moves[HIT], FIELD, false).max);
  };

  /* (a) the carrier ENTERS after N allies are already dead — the snapshot is N. */
  for (const N of [1, 2, 3]) {
    const bd = baseBoard();
    bd.setParty('p1', [K].concat(MINE.filter(s => s !== K)).slice(0, 6));
    bd.setSheet('p1', K, { nature: 'Serious', item: '', ability: 'supremeoverlord', moves: [HIT] });
    bd.switchIn('p2', 'a', THEIRS[0]);
    for (let i = 0; i < N; i++) { bd.switchIn('p1', 'a', MINE.filter(s => s !== K)[i]); bd.faint('p1', 'a'); }
    bd.switchIn('p1', 'a', K);                       /* the carrier walks in over the graves */
    const A = RL.buildSide(bd, 'p1', null, zero());
    const body = A.find(m => m && nrm(m.name) === K);
    ok(!!body && impliedFrom(body) === N,
      `ROADMAP #247 — a carrier that entered after ${N} ally death(s) carries a snapshot of ${N}`,
      body ? `_fallenStuck ${body._fallenStuck | 0}` : 'ABSENT');
  }

  /* (b) THE CONTROL AND THE MECHANIC: standing there while they die is worth nothing. */
  {
    const bd = baseBoard();
    bd.setParty('p1', [K].concat(MINE.filter(s => s !== K)).slice(0, 6));
    bd.setSheet('p1', K, { nature: 'Serious', item: '', ability: 'supremeoverlord', moves: [HIT] });
    bd.switchIn('p2', 'a', THEIRS[0]);
    bd.switchIn('p1', 'a', K);                       /* the carrier is out FIRST */
    for (let i = 0; i < 2; i++) { bd.switchIn('p1', 'b', MINE.filter(s => s !== K)[i]); bd.faint('p1', 'b'); }
    const A = RL.buildSide(bd, 'p1', null, zero());
    const body = A.find(m => m && nrm(m.name) === K && !m.fainted);
    ok(!!body && impliedFrom(body) === 0,
      'CONTROL (#243) — allies dying while the carrier stands there does NOT raise its snapshot',
      body ? `_fallenStuck ${body._fallenStuck | 0}` : 'ABSENT');
  }
}

/* ---------------------------------------------------------------------------------------------
 * 6. WHAT IS STILL WRONG, REPORTED RATHER THAN ASSERTED.
 *
 * These are printed on every run so the day they close is visible, and they are NOT red rows: each
 * is a defect in a file this division may not change, and a red row nobody here can turn green is
 * the "KNOWN FAILURE" shape this repository bans by name.
 * ------------------------------------------------------------------------------------------ */
{
  const bd = baseBoard();
  bd.switchIn('p1', 'a', MINE[0]); bd.switchIn('p2', 'a', THEIRS[0]);
  const rockId = (TAGS.withTag('move', 'hazard') || [])
    .find(id => nrm((TAGS.param('move', id, 'hazard') || {}).hazard) === 'stealthrock');
  B.noteMove(bd, 'p1', bd.slot('p1', 'a'), dex.moves.get(rockId), true);
  const upNow = bd.hasSide('p2', 'stealthrock');
  bd.endTurn();
  const upNext = bd.hasSide('p2', 'stealthrock');
  /* CLOSED 2026-08-14 (#268) — kept as a live PRINT rather than deleted, because this is the fixture
   * that measured the defect and it is the one that will notice if it comes back. */
  ok(upNow && upNext, 'ROADMAP #268 (CLOSED) — a permanent hazard is still up a turn later',
    `laid ${upNow}, one turn later ${upNext}`);
  note('CLOSED #268 — hazard LAYERS are counted now:',
    'tests/test-seed-clock.js asserts all of them, from both seats, with the tag\'s own ceiling');
  note('CLOSED #269 (in part) — Taunt, Encore and Disable are seeded now:',
    'still unseeded from the same hole: choice lock, Substitute, Leech Seed, the perish count, and ' +
    'the foe\'s protectTurns — see rollout_leaf.unseededVolatiles() for each one\'s reason');
  note('OPEN — a Regenerator body is remembered at its PRE-heal HP and a Natural Cure body at its ' +
    'pre-cure status:', 'both heal silently on switch-out and the protocol shows neither');
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
