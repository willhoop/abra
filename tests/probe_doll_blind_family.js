/* probe_doll_blind_family.js — SEVEN ACTION KINDS NEVER ASKED THE DOLL. 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_doll_blind_family.js
 *   SHOWDOWN_PATH=... node tests/probe_doll_blind_family.js --only soak@doll
 *   SHOWDOWN_PATH=... node tests/probe_doll_blind_family.js --release <id>
 *
 * ================= THE COUNT, DERIVED RATHER THAN INHERITED =====================================
 *
 * Every legal Status move that is foe-aimed and carries no `bypasssub` — 54 of them — was classified
 * through this engine's OWN `playerAction`, and each resulting action kind was asked whether
 * `subBlocks(` appears inside its `a.kind===` branch. NINE kinds do not call it:
 *
 *     typechange (4)  trickitem (3)  abilitywrite (3)  statrewire (2)
 *     boostally (1)   healdesc (1)   lockon (1)        reorder (1)      transform (1)
 *
 * NINE IS NOT THE NUMBER OF DEFECTS, AND THE STRUCTURAL SWEEP CANNOT TELL THEM APART. Two of the
 * nine were played and are NOT fixed here:
 *
 *   - `transform` consults the doll through a BARE `_tt._sub>0` rather than `subBlocks`, so the grep
 *     misses it and the engine is already right. PLAYED, both arms, and it does not part — it is
 *     carried below as a control that must stay unparted.
 *   - `trickitem` / Trick is blocked TWICE. Its no-doll control parts as well, because this engine
 *     writes `|-activate|…|move: trick` where the authority writes `|-enditem|…|[from] move: Trick`.
 *     A fixture blocked for two reasons proves nothing about either, so both its arms are carried
 *     below as `excluded`, printed and NOT scored.
 *
 * ===> SEVEN KINDS, THIRTEEN MOVES. That is what this file stages and what the fix covers.
 *
 * ================= ONE ROOT, AND IT IS THE SAME ROOT AS YAWN'S =================================
 *
 * The doll's handler does not know which move hit it. `data/moves.ts`'s `substitute` CONDITION —
 * Champions overrides neither `substitute` in `moves.ts` nor anything in `conditions.ts`, which has
 * no `substitute` key and no `onTryPrimaryHit` at all — is:
 *
 *     if (target === source || move.flags['bypasssub'] || move.infiltrates) return;
 *     let damage = this.actions.getDamage(source, target, move);
 *     if (!damage && damage !== 0) { this.add('-fail', source); this.attrLastMove('[still]'); return null; }
 *
 * All thirteen are `basePower: 0` Status moves, so `getDamage` returns **undefined** at
 * `sim/battle-actions.ts:1620` and every one of them takes the same two lines: `|-fail|` on the
 * MOVER, and `[still]` on the mover's own `|move|` line. That was CONFIRMED BY PLAYING all thirteen
 * against the authority before a byte moved — thirteen `|-fail|<mover>` lines, thirteen holding
 * no-doll controls — not inferred from the handler. The raw pairs are printed on every run.
 *
 * ================= WHERE IT GOES IN EACH BRANCH IS *NOT* THE SAME PLACE =========================
 *
 * The root is shared; the insertion point is not, and copying one placement into seven branches
 * would have been wrong in three of them. The doll sits BELOW the move's own `onTryHit` and ABOVE
 * its `onHit`, so each branch's existing guards had to be sorted into those two groups first
 * (derived by reading each move's handlers out of `Dex.forFormat`, printed below):
 *
 *     onTryHit  -> ABOVE the doll   entrainment, simplebeam, worryseed (ability guards), lockon
 *     onHit     -> BELOW the doll   all four type-writers, both stat-splits, decorate, healpulse,
 *                                   quash's `willMove` test
 *
 * Quash is the one that would have been silently wrong: its `unresolved.has(t)` check is the
 * authority's `onHit`, so a doll check placed under it never runs when the target has already moved.
 *
 * ================= NO DIE MOVES ================================================================
 *
 * Printed per move below, and the split is COUNTED at run time rather than typed here — this comment
 * had the two halves the wrong way round in its first draft and the printed line is what caught it.
 * FIVE of the thirteen have `accuracy: true` and take no draw at all; the other EIGHT print `100`, which draws in `hitStepAccuracy` on BOTH engines whether or not the doll
 * answers — the doll is consulted three steps further down, inside `hitStepMoveHitLoop`. And
 * `getDamage` returns at the `basePower` test ABOVE the crit `randomChance`. So this batch starts
 * and stops no draw, and seeded runs stay comparable.
 *
 * ================= ONE REFUSAL REASON PER CELL, DERIVED AND REFUSED ABOVE ONE ===================
 *
 * A body behind a doll may also be refused by type, by ability, by item, by the move's own powder or
 * reflect rule, or by the move's own handler guard — Trick-or-Treat refuses a Ghost, Soak refuses a
 * pure Water, Simple Beam refuses a Simple. The count is DERIVED per arm from the format, from
 * `data/tags.json` and from the engine's own action (`a.refused` / `a.becomes`), printed always, and
 * above one the arm FAILS. Trick is the live example of why: it is the only cell here with two, and
 * it is excluded for exactly that reason.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE — the thirteen red arms all part on turn 2 or 3
 * and the controls have to be read past it. Pushed before the driver is required, because
 * `game_differential.js` reads it at module-load time. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_doll_blind_family.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_DOLL_BLIND_FAMILY';

/* ---- THE HARNESS, RELOADABLE UNDER A CHANGED ENVIRONMENT ----------------------------------------
 * The knob is read at module load, so flipping it means dropping the engine AND the driver out of the
 * require cache — and the engine must leave under the SNAPSHOT'S filename, because the driver binds
 * with `REL.require(...)` and a drop aimed at `engine/medicham2-browser.js` clears a module the run
 * never used. */
let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE BOARD ---------------------------------------------------------------------------------
 * THE DOLL HOLDER IS GARCHOMP and every constraint it satisfies is one of the thirteen moves' own
 * handler guards, checked at run time rather than asserted here: Dragon/Ground is not Ghost
 * (Trick-or-Treat), not Grass (Forest's Curse), not mono-Psychic (Magic Powder), not mono-Water
 * (Soak) and not Grass-typed (the powder rule); Rough Skin is not `cantsuppress`, is not any member
 * of the three ability-writers' refused lists, and is not the mover's own ability in any arm.
 *
 * THE PARTNERS CLICK PROTECT ON TURN 1 AND CALM MIND AFTERWARDS, NOT PROTECT TWICE. A second
 * consecutive Protect rolls the stall counter, which puts a die inside every arm for no gain. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const CM = { m: 'calmmind' };
const SUB = { m: 'substitute' };
const SD = { m: 'swordsdance' };
const BU = { m: 'bulkup' };

const CHOMP = ['garchomp', '', 'Rough Skin', ['Substitute', 'Swords Dance', 'Protect']];
/* QUASH NEEDS A TARGET SLOWER THAN ITS MOVER and there is no legal Quash user faster than Garchomp
 * (derived: 8 legal learners, top base Speed 97). The authority's guard is inside Quash's `onHit`
 * — `if (!this.queue.willMove(target)) return false` — so a target that has already moved refuses it
 * for a SECOND reason and the cell would prove nothing. Skarmory is 70 against Tinkaton's 94. */
const SKARM = ['skarmory', '', 'Sturdy', ['Substitute', 'Swords Dance', 'Protect']];

const P1B = ['clefable', '', 'Unaware', ['Protect', 'Calm Mind']];
const BENCH_A = [P1B, ['milotic', '', 'Marvel Scale', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]];
const P2B = ['slowking', '', 'Oblivious', ['Protect', 'Calm Mind']];
const BENCH_B = [P2B, ['toxapex', '', 'Regenerator', ['Protect']], ['corviknight', '', 'Pressure', ['Protect']]];
/* THE HEAL PULSE PARTNER, and the only body in this file that attacks. See the `dollbroken` arm. */
const MACH = ['machamp', '', 'Steadfast', ['Seismic Toss', 'Bulk Up', 'Protect']];
const BENCH_HP = [MACH, ['toxapex', '', 'Regenerator', ['Protect']], ['corviknight', '', 'Pressure', ['Protect']]];

/* ---- THE MOVERS, one row per red arm ------------------------------------------------------------
 * Four of them are chosen so the over-fire control is the SAME SPECIES with ONE ABILITY CHANGED:
 * Malamar, Whimsicott and Dragapult each carry Infiltrator legally, which sets `move.infiltrates`
 * and is the authority's own second escape from the doll. */
const MV = {
  trickortreat: ['gourgeist', '', 'Frisk', ['Trick-or-Treat', 'Protect']],
  forestscurse: ['trevenant', '', 'Natural Cure', ["Forest's Curse", 'Protect']],
  magicpowder:  ['hatterene', '', 'Healer', ['Magic Powder', 'Protect']],
  soak:         ['pelipper', '', 'Keen Eye', ['Soak', 'Protect']],
  entrainment:  ['audino', '', 'Klutz', ['Entrainment', 'Protect']],
  simplebeam:   ['malamar', '', 'Suction Cups', ['Simple Beam', 'Protect']],
  worryseed:    ['whimsicott', '', 'Chlorophyll', ['Worry Seed', 'Protect']],
  guardsplit:   ['bastiodon', '', 'Sturdy', ['Guard Split', 'Protect']],
  powersplit:   ['malamar', '', 'Suction Cups', ['Power Split', 'Protect']],
  decorate:     ['alcremie', '', 'Sweet Veil', ['Decorate', 'Protect']],
  healpulse:    ['slowbro', '', 'Oblivious', ['Heal Pulse', 'Calm Mind', 'Protect']],
  lockon:       ['dragapult', '', 'Clear Body', ['Lock-On', 'Protect']],
  quash:        ['tinkaton', '', 'Own Tempo', ['Quash', 'Protect']],
};
const INF = {
  simplebeam: ['malamar', '', 'Infiltrator', ['Simple Beam', 'Protect']],
  powersplit: ['malamar', '', 'Infiltrator', ['Power Split', 'Protect']],
  worryseed:  ['whimsicott', '', 'Infiltrator', ['Worry Seed', 'Protect']],
  lockon:     ['dragapult', '', 'Infiltrator', ['Lock-On', 'Protect']],
};
const KIND_OF = { trickortreat: 'typechange', forestscurse: 'typechange', magicpowder: 'typechange',
  soak: 'typechange', entrainment: 'abilitywrite', simplebeam: 'abilitywrite', worryseed: 'abilitywrite',
  guardsplit: 'statrewire', powersplit: 'statrewire', decorate: 'boostally', healpulse: 'healdesc',
  lockon: 'lockon', quash: 'reorder' };

/* TURN 1 puts the doll up (or does not); TURN 2 clicks the move under test. Two turns rather than one
 * so the arm does not depend on the mover being slower than the doll holder — three of the thirteen
 * movers are faster, and a one-turn script would have measured turn order instead of the doll. */
const two = (setup, mv) => [
  { p1: [setup, PROT], p2: [PROT, PROT] },
  { p1: [SD, CM], p2: [{ m: mv, t: 0 }, CM] },
];
/* HEAL PULSE CANNOT USE THE NO-DOLL CONTROL THE OTHER TWELVE USE, and that is a fact about the move
 * rather than a convenience. Its `onHit` fails on a target at FULL HP (`-fail|<target>|heal`), and a
 * target that never raised a Substitute never paid the 25%. So the control does not remove the doll —
 * it BREAKS it, with a fixed-damage Seismic Toss from the partner, leaving the target's HP identical
 * to the red arm's and the doll gone. One variable, and it is the doll. */
const three = (setup, p2bT2, mv) => [
  { p1: [setup, PROT], p2: [PROT, PROT] },
  { p1: [SD, CM], p2: [CM, p2bT2] },
  { p1: [SD, CM], p2: [{ m: mv, t: 0 }, BU] },
];

const CASES = [];
for (const mv of Object.keys(MV)) {
  const A = [mv === 'quash' ? SKARM : CHOMP].concat(BENCH_A);
  const B = [MV[mv]].concat(mv === 'healpulse' ? BENCH_HP : BENCH_B);
  if (mv === 'healpulse') {
    CASES.push({ id: mv + '@doll', kind: 'red', mv, A, B, script: three(SUB, BU, mv),
      refuseClean: 1, ignoreKnob: 1,
      what: 'HEAL PULSE AT A SUBSTITUTED FOE. Three turns: the doll goes up on turn 1 (and takes the '
          + 'target to 75%, which is what makes the heal legal at all), the partner idles on turn 2, '
          + 'and the pulse is clicked on turn 3.' });
    CASES.push({ id: mv + '@dollbroken', kind: 'control', mv, A, B, script: three(SUB, { m: 'seismictoss', t: 0 }, mv),
      refuseClean: 0, ignoreKnob: 0,
      what: 'THE SAME BOARD WITH THE DOLL BROKEN INSTEAD OF IDLED PAST — the partner clicks Seismic '
          + 'Toss (fixed 50, no damage roll) on turn 2, which is more than the doll\'s 46 HP and does '
          + 'not spill. The target\'s own HP is IDENTICAL to the red arm\'s, so the only thing that '
          + 'differs at the moment of the pulse is whether a doll is standing. Without this arm, '
          + '"the doll refused it" and "Heal Pulse stopped working" read the same.' });
    continue;
  }
  CASES.push({ id: mv + '@doll', kind: 'red', mv, A, B, script: two(SUB, mv), refuseClean: 1, ignoreKnob: 1,
    what: 'THE REPORTED DEFECT for kind `' + KIND_OF[mv] + '`. The authority answers the doll with '
        + '`|-fail|` on the MOVER and `[still]` on its `|move|` line; this branch asked no doll at all.' });
  CASES.push({ id: mv + '@nodoll', kind: 'control', mv, A, B, script: two(SD, mv), refuseClean: 0, ignoreKnob: 0,
    what: 'THE DOLL CLEARED EXPLICITLY — the identical board, the identical click, the identical turn, '
        + 'with Swords Dance raised instead of a Substitute. The move is CORRECT here and both engines '
        + 'land it.' });
}
/* ---- THE OVER-FIRE CONTROLS: A DOLL THAT IS STANDING AND MUST BE WALKED THROUGH ANYWAY ---------- */
for (const mv of Object.keys(INF)) {
  CASES.push({ id: mv + '@doll-infiltrator', kind: 'control', mv, A: [CHOMP].concat(BENCH_A),
    B: [INF[mv]].concat(BENCH_B), script: two(SUB, mv), refuseClean: 0, ignoreKnob: 0,
    what: 'THE SAME SPECIES WITH ONE ABILITY CHANGED — Infiltrator sets `move.infiltrates`, which is '
        + 'the authority\'s own second escape from `onTryPrimaryHit`. The doll is STANDING and the '
        + 'move must land through it. A fix that made every status move fail at a doll passes all '
        + 'thirteen red arms and fails here.' });
}
/* ---- THE THREE ROADS THAT MUST NOT MOVE --------------------------------------------------------- */
CASES.push({ id: 'bypasssub', kind: 'control', mv: 'disable', A: [CHOMP].concat(BENCH_A),
  B: [['slowbro', '', 'Oblivious', ['Disable', 'Protect']]].concat(BENCH_B),
  script: two(SUB, 'disable'), refuseClean: 0, ignoreKnob: 0,
  what: 'THE BYPASS SET MUST NOT MOVE. Disable carries `bypasssub`, so `subBlocks` answers false and '
      + 'the move reaches the body behind the doll.' });
CASES.push({ id: 'damage-doll', kind: 'control', mv: 'hydropump', A: [CHOMP].concat(BENCH_A),
  B: [['slowbro', '', 'Oblivious', ['Hydro Pump', 'Protect']]].concat(BENCH_B),
  script: two(SUB, 'hydropump'), refuseClean: 0, ignoreKnob: 0,
  what: 'THE DAMAGING ROAD, ALREADY CORRECT AND UNTOUCHED — `getDamage` returns a number there, so '
      + 'the doll takes the hit and no `-fail` is written. This is also the arm that answers "did '
      + 'damage move" for this batch.' });
CASES.push({ id: 'transform@doll', kind: 'control', mv: 'transform', A: [CHOMP].concat(BENCH_A),
  B: [['ditto', '', 'Limber', ['Transform']]].concat(BENCH_B),
  script: [{ p1: [SUB, PROT], p2: [{ m: 'transform', t: 0 }, PROT] }], refuseClean: 0, ignoreKnob: 0,
  what: 'THE NINTH KIND, AND IT WAS ALREADY RIGHT. The structural sweep flags `transform` because it '
      + 'consults the doll through a BARE `_tt._sub>0` instead of `subBlocks`, which a grep cannot '
      + 'see. One turn, because Ditto learns exactly one move and is slower than the doll holder. '
      + 'It must stay unparted on BOTH loads — the knob does not reach it.' });
CASES.push({ id: 'transform@nodoll', kind: 'control', mv: 'transform', A: [CHOMP].concat(BENCH_A),
  B: [['ditto', '', 'Limber', ['Transform']]].concat(BENCH_B),
  script: [{ p1: [SD, PROT], p2: [{ m: 'transform', t: 0 }, PROT] }], refuseClean: 0, ignoreKnob: 0,
  what: 'and the copy still happens when no doll is up, in both engines.' });
/* ---- THE EXCLUDED CELL, PRINTED AND NOT SCORED --------------------------------------------------- */
for (const [id, sc] of [['trick@doll', two(SUB, 'trick')], ['trick@nodoll', two(SD, 'trick')]]) {
  CASES.push({ id, kind: 'excluded', mv: 'trick', A: [CHOMP].concat(BENCH_A),
    B: [['slowbro', 'Leftovers', 'Oblivious', ['Trick', 'Protect']]].concat(BENCH_B),
    script: sc, refuseClean: 0, ignoreKnob: 0,
    what: 'BLOCKED FOR TWO REASONS, SO IT IS EVIDENCE FOR NOTHING AND IS NOT SCORED. Trick has the '
        + 'doll hole AND a separate message defect: this engine writes `|-activate|…|move: trick` '
        + 'where the authority writes `|-enditem|…|[from] move: Trick`, so the NO-DOLL arm parts too. '
        + 'Reported, deliberately not fixed here — see the report.' });
}

/* ---- LEGALITY, DERIVED AT RUN TIME -------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
const seen = new Set();
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sig = JSON.stringify(row); if (seen.has(sig)) continue; seen.add(sig);
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) {
    console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++;
  }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- HOW MANY REASONS, NOT COUNTING THE DOLL ----------------------------------------------------
 * Six families, each read from the format or from an artifact rather than listed here:
 *   1. type immunity, walked one target type at a time so a second refusing type is visible;
 *   2. the ability and item tags that refuse a move outright;
 *   3. the move's own `reflectable` rule against a `reflectsStatusMoves` ability;
 *   4. the move's own `powder` rule, through the format's `getImmunity('powder', types)`;
 *   5. the type-writers' own handler guard, read off `changesTargetType` in data/tags.json;
 *   6. the ability-writers' own handler guard, read off THIS ENGINE'S action (`a.refused`,
 *      `a.becomes`) plus the `cantsuppress` flag on the target's ability.
 * Above ONE, the arm FAILS. Trick is the cell this exists for. */
const TAGS = require(D('data', 'tags.json'));
const REFUSE = ['absorbsType', 'immuneToMoveClass', 'immuneToType', 'refusesStatusMoves', 'levitates'];
let REASON_DERIVATION_FAILED = 0;
require(D('data', 'engine-data.js'));
const LIVE_MEDI = require(D('engine', 'medicham2-browser.js'));
function refusalReasons(row, moverRow, moveId) {
  const sp = dex.species.get(row[0]);
  const mv = dex.moves.get(moveId);
  const out = [];
  for (const t of sp.types) if (dex.getImmunity(mv.type, [t]) === false) out.push('type:' + t);
  const abId = dex.abilities.get(row[2] || '').id;
  const abRow = TAGS.abilities && TAGS.abilities[abId];
  const abTags = (abRow && abRow.tags) || [];
  for (const t of abTags) if (REFUSE.includes(t)) out.push('ability:' + t);
  const itKey = row[1] && String(row[1]).toLowerCase().replace(/[^a-z0-9]/g, '');
  const itRow = itKey && TAGS.items && TAGS.items[itKey];
  if (itRow && itRow.tags) for (const t of itRow.tags) if (REFUSE.includes(t)) out.push('item:' + t);
  if (mv.flags['reflectable'] && abTags.includes('reflectsStatusMoves')) out.push('ability:bouncesItBack');
  if (mv.flags['powder'] && !dex.getImmunity('powder', sp.types)) out.push('powderImmune');
  const ct = TAGS.moves && TAGS.moves[mv.id] && TAGS.moves[mv.id].params
    && TAGS.moves[mv.id].params.changesTargetType;
  if (ct) {
    const ty = mv.type;
    if (ct.adds && sp.types.includes(ty)) out.push('alreadyHasType:' + ty);
    if (ct.replaces && sp.types.length === 1 && sp.types[0] === ty) out.push('alreadyExactType:' + ty);
  }
  /* NOT SWALLOWED. If the engine cannot classify this move, the ability-writer half of the refusal
   * count is NOT being asked for that arm — which would let a cell blocked for two reasons print
   * `(none)` and pass. It is printed AND counted, and a non-zero count fails the run at the foot. */
  let act = null;
  /* ONLY A STATUS MOVE IS ASKED, AND THAT IS A DERIVED SCOPE RATHER THAN A DODGE. The guard this
   * derives is the ability-writers' `onTryHit`, and all three of them are Status; a damaging click
   * handed a bare `{}` for both bodies throws inside the damage road, which is the classifier being
   * used outside its contract rather than an engine defect. `damage-doll` is the only such arm. */
  if (mv.category === 'Status')
  try { act = LIVE_MEDI.playerAction({}, mv.id, {}, {}); }
  catch (e) {
    REASON_DERIVATION_FAILED++;
    console.log('  REFUSAL-REASON DERIVATION FAILED for ' + mv.id + ': ' + e.message
      + '   <-- the ability-writer guard was NOT checked for any arm using this move');
  }
  if (act && act.kind === 'abilitywrite') {
    if ((act.refused || []).includes(abId)) out.push('abilityRefusesRewrite:' + abId);
    const want = act.becomes === "the user's own ability"
      ? dex.abilities.get(moverRow[2] || '').id : dex.abilities.get(act.becomes || '').id;
    if (want && want === abId) out.push('alreadyHasAbility:' + abId);
    if (dex.abilities.get(abId).flags && dex.abilities.get(abId).flags['cantsuppress']) out.push('cantsuppress');
  }
  /* THE ONE STATE-DEPENDENT GUARD IN THE SET, and it is declared rather than derived: Heal Pulse's
   * `onHit` fails at full HP. Every Heal Pulse arm here raises a Substitute first, which spends 25%,
   * so no arm meets it — and the arm PRINTS that rather than assuming it. */
  if (mv.id === 'healpulse') out.push('(target is at 75% — the Substitute cost — so the full-HP `onHit` guard does not fire)');
  return out.filter(x => x[0] !== '(');
}

/* ---- WHAT THE FORMAT SAYS ABOUT THE DIE AND ABOUT THE HANDLERS, PRINTED RATHER THAN ASSUMED ----- */
console.log('THE THIRTEEN MOVES, READ OFF Dex.forFormat(' + CS.FORMAT + '):');
let noDraw = 0;
for (const mv of Object.keys(MV)) {
  const m = dex.moves.get(mv);
  const hs = Object.keys(m).filter(k => /^on(Try|Hit|Prepare)/.test(k));
  if (m.accuracy === true) noDraw++;
  console.log('  ' + m.name.padEnd(16) + ' kind=' + KIND_OF[mv].padEnd(13)
    + ' bp=' + m.basePower + ' acc=' + JSON.stringify(m.accuracy).padEnd(5)
    + ' target=' + String(m.target).padEnd(8) + ' bypasssub=' + !!m.flags['bypasssub']
    + '  handlers=[' + hs.join(',') + ']');
}
console.log('  ' + noDraw + ' of 13 print `accuracy: true` and take NO draw; the other '
  + (13 - noDraw) + ' draw in hitStepAccuracy on BOTH engines, three steps ABOVE the doll. '
  + 'basePower is 0 on all 13, so getDamage returns undefined at sim/battle-actions.ts:1620, which is '
  + 'ABOVE the crit randomChance. NO DIE STARTS OR STOPS IN THIS BATCH.' + NL);

/* ---- THE RUN ------------------------------------------------------------------------------------ */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_doll_blind_family :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
           restored: (globalThis.MEDFAILS || {}).dollBlindFamilyRestored || 0 };
}

/* BOTH LOADS ARE PLAYED AS WHOLE PASSES, NOT ALTERNATED PER ARM, AND THE REASON IS THE HEAP. The
 * driver plus the snapshot engine is a large module graph, and dropping and re-requiring it once per
 * arm — 37 arms, 74 loads — reaches node's default heap limit and dies with a FATAL v8 allocation
 * failure part-way through the run. Measured, not feared: the first draft of this file did exactly
 * that. Two loads total, clean first, then the knob. */
const ARMS = CASES.filter(c => !ONLY || c.id === ONLY);
const CLEAN = new Map(), BRK = new Map();
{
  const G = harness(false);
  for (const c of ARMS) CLEAN.set(c.id, play(G, c));
}
{
  const G = harness(true);
  for (const c of ARMS) BRK.set(c.id, play(G, c));
}

let bad = 0, ran = 0, excluded = 0;
const results = [];
for (const c of ARMS) {
  const clean = CLEAN.get(c.id);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = BRK.get(c.id);

  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const reasons = refusalReasons(c.A[0], c.B[0], c.mv);
  const nClean = clean.delta.subStatusFailedBelowAccuracy;
  const nCleanIgn = clean.delta.dollBlindFamilyIgnored;
  const nBrk = brk.delta && brk.delta.subStatusFailedBelowAccuracy;
  const nBrkIgn = brk.delta && brk.delta.dollBlindFamilyIgnored;
  const knobOk = clean.restored === 0 && brk.restored === 1
              && nClean === c.refuseClean && nCleanIgn === 0
              && nBrkIgn === c.ignoreKnob && nBrk === 0;
  results.push({ c, clean, brk, short, refused, reasons, nClean, nCleanIgn, nBrk, nBrkIgn, knobOk });

  if (c.kind === 'excluded') { excluded++; continue; }
  ran++;
  if (short || refused) { bad++; continue; }
  if (reasons.length > 1) bad++;
  if (!knobOk) bad++;
  if (clean.r.div) bad++;
  if (c.kind === 'red' && !brk.r.div) bad++;
  if (c.kind === 'control' && brk.r.div) bad++;
}

/* ---- THE REPORT --------------------------------------------------------------------------------- */
for (const R of results) {
  const { c, clean, brk, short, refused, reasons, nClean, nCleanIgn, nBrk, nBrkIgn, knobOk } = R;
  const verdict = c.kind === 'excluded' ? 'EXCLUDED    '
    : clean.r.div ? 'PARTS CLEAN ' : short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
    : c.kind === 'red' ? (brk.r.div ? 'RED PROVEN  ' : 'KNOB SILENT ')
                       : (brk.r.div ? 'OVER-FIRES  ' : 'CONTROL HELD');
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    refusal reasons for ' + c.A[0][0] + ' against ' + dex.moves.get(c.mv).name
    + ', NOT counting the doll: ' + (reasons.length ? reasons.join(', ') : '(none)')
    + (reasons.length > 1 ? '   <-- FAIL, two reasons prove nothing about either' : ''));
  if (clean.r.div) {
    console.log('    CLEAN PARTED at reduced line ' + clean.r.div.index);
    console.log('      showdown  ' + clean.r.div.sdRaw);
    console.log('      medicham  ' + clean.r.div.meRaw);
  }
  if (brk.r && brk.r.div) {
    console.log('    UNDER THE KNOB the streams part at reduced line ' + brk.r.div.index);
    console.log('      showdown  ' + brk.r.div.sdRaw);
    console.log('      medicham  ' + brk.r.div.meRaw);
  } else if (brk.r) {
    console.log('    UNDER THE KNOB the streams still agree over all ' + brk.r.turns + ' turns');
  }
  console.log('    knob      subStatusFailedBelowAccuracy clean=' + nClean + ' knob=' + nBrk
    + ' | dollBlindFamilyIgnored clean=' + nCleanIgn + ' knob=' + nBrkIgn
    + ' | MEDFAILS stamp clean=' + clean.restored + ' knob=' + brk.restored
    + '   (this arm should refuse ' + c.refuseClean + ' clean and ignore ' + c.ignoreKnob + ' on the '
    + 'knob; an arm whose doll is up and is not bypassed must be 1 and 1, because a knob that ignored '
    + 'nothing reverted nothing)' + (c.kind === 'excluded' ? '   [not scored]'
      : knobOk ? '' : '   <-- FAIL, the knob did not reach the driver\'s module'));
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

if (REASON_DERIVATION_FAILED) {
  bad += REASON_DERIVATION_FAILED;
  console.log(NL + 'REFUSAL-REASON DERIVATION FAILED ' + REASON_DERIVATION_FAILED + ' time(s) — an '
    + 'arm whose second reason could not be asked about is not a cleared cell.');
}
console.log(NL + ran + ' arms staged, ' + bad + ' failing, ' + excluded + ' excluded and not scored');
console.log(bad ? 'FAIL' : 'PASS — all seven doll-blind kinds ask the doll, all thirteen answer '
  + '`-fail` on the mover with `[still]`, every red arm parts under the revert knob, and the twelve '
  + 'no-doll arms, the four Infiltrator arms, the bypasssub arm, the damaging road and both transform '
  + 'arms hold under that same knob');
process.exit(bad ? 1 : 0);
