/* probe_substitute_status_step.js — THE DOLL'S STATUS ROAD IS `onTryPrimaryHit`, AND THIS ENGINE ASKED
 * IT SIX STEPS TOO EARLY AND ANSWERED IT WITH A LINE THE FORMAT DOES NOT HAVE. 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_substitute_status_step.js
 *   SHOWDOWN_PATH=... node tests/probe_substitute_status_step.js --only twave-miss
 *   SHOWDOWN_PATH=... node tests/probe_substitute_status_step.js --release <id>
 *
 * ================= WHERE THE AUTHORITY ASKS THE DOLL, READ OFF THE STEP LIST =====================
 *
 * `Battle.actions.trySpreadMoveHit` (sim/battle-actions.ts:550-577) declares `moveSteps` as DATA.
 * The Champions mod overrides `spreadMoveHit` (:315) and `hitStepMoveHitLoop` (:428) and NOTHING
 * above them — grepped `data/mods/champions/scripts.ts`, which has no `trySpreadMoveHit` and no
 * `moveSteps` — so gen 9 Champions keeps this order:
 *
 *     556  hitStepInvulnerabilityEvent   0
 *     559  hitStepTryHitEvent            1   Protect, Good as Gold, the absorbers
 *     562  hitStepTypeImmunity           2
 *     565  hitStepTryImmunity            3   powder, onTryImmunity, Prankster-into-Dark
 *     568  hitStepAccuracy               4   THE DIE
 *     571  hitStepBreakProtect           5
 *     574  hitStepStealBoosts            6
 *     577  hitStepMoveHitLoop            7   -> spreadMoveHit -> tryPrimaryHitEvent -> THE DOLL
 *
 * `data/mods/champions/scripts.ts:342` is the mod's own copy of that comment — `// 0. check for
 * substitute` — and it calls `tryPrimaryHitEvent` (mainline :1138), which runs the substitute
 * condition's `onTryPrimaryHit` (`data/moves.ts`, the `substitute` condition; Champions overrides
 * neither `substitute` in `moves.ts` nor anything in `conditions.ts`).
 *
 * ================= WHAT THAT HANDLER DOES TO A *STATUS* MOVE, WHICH IS NOT WHAT WE EMIT ==========
 *
 *     let damage = this.actions.getDamage(source, target, move);
 *     if (!damage && damage !== 0) { this.add('-fail', source); this.attrLastMove('[still]'); return null; }
 *
 * A Status move has `basePower: 0`, so `getDamage` returns **undefined** at
 * `sim/battle-actions.ts:1620` (`if (!basePower) return basePower === 0 ? undefined : basePower;`)
 * and the doll answers with `|-fail|<THE MOVER>` and a blanked `|move|` target carrying `[still]`.
 * It cannot answer `-immune` on the way: `hitStepTypeImmunity` sets `move.ignoreImmunity = true` for
 * every Status move (:655-657), so `runImmunity` inside `getDamage` short-circuits true.
 *
 * medicham2 wrote `|-activate|<THE TARGET>|move: Substitute|[block]`. **THAT LINE IS NOT IN GEN 9.**
 * Grepped the whole simulator: `[block]` appears twice, in `data/mods/gen1stadium/moves.ts:234` and
 * `data/mods/gen2/moves.ts:690`, and even there the shape is `'[block] ' + move.name`.
 *
 * ================= SO THERE ARE TWO HALVES AND ONE SENTENCE ======================================
 *
 * ORDER — this engine asked the doll in the TryHit group (`_asTryHit`, `_ASTEPS` index 1, and the
 * same line at the top of the `status`/`sharesHP`/`trap` branches), which is ABOVE accuracy. So a
 * Thunder Wave at a substituted body could never MISS here and always can there.
 * LINE — every one of those sites answered on the TARGET with `-activate`, where the authority
 * answers on the MOVER with `-fail`. Leech Seed's is a FIFTH site and the worst of them: a bare
 * `&& !subBlocks(...)` inside the `perTurnHP` guard, above the roll and with no line at all.
 * They are one behaviour — "the doll's status road is `onTryPrimaryHit`" — and neither can be fixed
 * without the other: move the step and the 100%-accuracy arms still part on the line; fix the line
 * and the sub-100 arms still part on the die.
 *
 * THE DAMAGING ROAD IS ALREADY CORRECT and two control arms hold it there: a Hydro Pump into the
 * doll misses under the top arm and breaks the doll under the bottom arm, in both engines, before
 * and after.
 *
 * ================= WHICH MOVES CAN SHOW THE ORDER HALF, DERIVED FROM THE FORMAT ==================
 *
 * Status, foe-targeting, no `bypasssub`, printed accuracy under 100, legal in
 * `gen9championsvgc2026regmb` — **eleven**, printed by this file on every run so the set cannot go
 * stale in prose. It is led by Thunder Wave, Toxic and Will-O-Wisp, so the defect is not exotic.
 *
 * ================= AND NOTHING IN THIS FORMAT KEYS ON "MISSED" ===================================
 *
 * The one consumer of a miss in `hitStepAccuracy` is Blunder Policy — and
 * `D.items.get('blunderpolicy').isNonstandard === 'Past'`, so it is BANNED here. What is left is the
 * DIE: the authority draws `acc` where this engine drew nothing, which is a desynchroniser under any
 * live-dice arm, and Wonder Skin's `this.random(2)` sits in the same step. Printed, not assumed.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the identical script under the differential's
 * own pin and the two protocol streams are compared; the pass is that they do not part. SHOWDOWN IS
 * THE EXPECTATION. The knob `MEDI_SUB_STATUS_AT_TRYHIT=1` puts the old site and the old line back,
 * and it must be shown to have REACHED the module the driver played — `MEDFAILS
 * .subStatusAtTryHitRestored` is asserted PRESENT on the knob load and ABSENT on the clean one,
 * because a knob that reaches nothing produces a green run that staged nothing.
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

/* ---- THE SNAPSHOT THE KNOB IS APPLIED TO MUST BE THE TREE THIS FILE IS TESTING ------------------ */
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_substitute_status_step.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_SUB_STATUS_AT_TRYHIT';

/* ---- THE HARNESS, RELOADABLE UNDER A CHANGED ENVIRONMENT ---------------------------------------
 * The knob is a module-load-time read, so flipping it means dropping the engine AND the driver out of
 * the require cache. The engine has to leave the cache under the SNAPSHOT'S OWN FILENAME — the
 * driver binds with `REL.require(...)`, which compiles the snapshot's copy under the snapshot's path,
 * and a cache drop aimed at `engine/medicham2-browser.js` would clear a module the run never used. */
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

/* ---- SCENARIO SUGAR ----------------------------------------------------------------------------
 * ONE TURN, and the doll goes up INSIDE it: Alakazam is 120 base Speed and every mover aimed at it
 * is 50 or less, so the Substitute is standing before the move under test resolves and no second
 * turn exists for anything downstream of the measured line to move in. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const SUB = { m: 'substitute' };
const CM = { m: 'calmmind' };

/* THE DOLL HOLDER. Inner Focus, NOT Synchronize (which would bounce the paralysis back and put a
 * second mechanic in the arm) and NOT Magic Guard. Psychic single type: not Ground (Thunder Wave),
 * not Electric (which cannot be paralysed at all), not Ghost (which cannot be trapped), not Dark
 * (Prankster), so every arm below has EXACTLY ZERO immunity reasons and the file asserts it. */
const ZAM = ['alakazam', '', 'Inner Focus', ['Substitute', 'Calm Mind', 'Protect']];
const WALL_A = [['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']],
  ['snorlax', '', 'Thick Fat', ['Protect']]];
const WALL_B = [['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
  ['corviknight', '', 'Pressure', ['Protect']]];

/* THE MOVERS. Oblivious rather than Own Tempo on the Swagger arm's Slowbro is irrelevant to the
 * target and is kept identical across arms so nothing but the CLICK differs between them. */
const BRO_TW = [['slowbro', '', 'Oblivious', ['Thunder Wave', 'Protect']]].concat(WALL_B);
const BRO_SW = [['slowbro', '', 'Oblivious', ['Swagger', 'Protect']]].concat(WALL_B);
const BRO_BL = [['slowbro', '', 'Oblivious', ['Block', 'Protect']]].concat(WALL_B);
const BRO_HP = [['slowbro', '', 'Oblivious', ['Hydro Pump', 'Protect']]].concat(WALL_B);
const BRO_DI = [['slowbro', '', 'Oblivious', ['Disable', 'Protect']]].concat(WALL_B);
const FOR_PS = [['forretress', '', 'Sturdy', ['Pain Split', 'Protect']]].concat(WALL_B);
const APP_LS = [['appletun', '', 'Ripen', ['Leech Seed', 'Protect']]].concat(WALL_B);

const AT = (p1a, mv) => [{ p1: [p1a, PROT], p2: [{ m: mv, t: 0 }, PROT] }];

const CASES = [
  /* ---- THE ORDER HALF: a sub-100 status move at a substituted body ---------------------------- */
  { id: 'twave-miss', kind: 'red', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: BRO_TW,
    script: AT(SUB, 'thunderwave'), mv: 'thunderwave',
    refuseClean: 0, refuseKnob: 1,
    what: 'THE REPORTED DEFECT. Thunder Wave is 90%% and the top arm MISSES every sub-100 move, so '
        + 'the authority rolls at step 4, misses, and writes `|-miss|`. This engine short-circuited '
        + 'on the doll at step 1 and never reached the die. The `status` branch (WIRE 130).' },

  { id: 'twave-hit', kind: 'red', arm: 'bottom-tie-first', A: [ZAM].concat(WALL_A), B: BRO_TW,
    script: AT(SUB, 'thunderwave'), mv: 'thunderwave',
    refuseClean: 1, refuseKnob: 1,
    what: 'THE LINE HALF, on the SAME board and the SAME click, differing only in the arm: the '
        + 'bottom arm HITS every sub-100 move, so the roll is passed and the doll really is reached. '
        + 'The authority answers `|-fail|p2a` with a blanked `|move|` target and `[still]`; this '
        + 'engine answered `|-activate|p1a|move: Substitute|[block]`, which gen 9 never emits.' },

  { id: 'swagger-miss', kind: 'red', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: BRO_SW,
    script: AT(SUB, 'swagger'), mv: 'swagger',
    refuseClean: 0, refuseKnob: 1,
    what: 'A SECOND BRANCH, not a second move. Swagger is boosts + confusion, so `playerAction` '
        + 'classifies it `affect` and it walks `_ASTEPS` — a different site with the same sentence. '
        + '85%% under the missing arm. Two branches parting on one root is what makes this a rule '
        + 'rather than a coincidence.' },

  { id: 'painsplit', kind: 'red', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: FOR_PS,
    script: AT(SUB, 'painsplit'), mv: 'painsplit',
    refuseClean: 1, refuseKnob: 1,
    what: 'A THIRD BRANCH — `sharesHP`. Pain Split is 100%%, so the ORDER cannot show here and only '
        + 'the LINE can: it is the arm that says the two halves are separable and that both are '
        + 'wrong. Forretress rather than Slowbro because Slowbro does not learn it.' },

  { id: 'block-trap', kind: 'red', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: BRO_BL,
    script: AT(SUB, 'block'), mv: 'block',
    refuseClean: 1, refuseKnob: 1,
    what: 'A FOURTH BRANCH — the trap road. Block is 100%%, so this is the LINE again at a site that '
        + 'has its own refusal chain. Alakazam is Psychic, not Ghost, so it is trappable and the '
        + 'doll is the only thing in the way.' },

  { id: 'leechseed-miss', kind: 'red', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: APP_LS,
    script: AT(SUB, 'leechseed'), mv: 'leechseed',
    refuseClean: 0, refuseKnob: 1,
    what: 'A FIFTH SITE, AND THE SILENT ONE. Leech Seed reaches the `status` branch with no major '
        + 'status, so it resolves inside the `perTurnHP` block whose guard carried a bare '
        + '`&& !subBlocks(...)` — above the roll AND with no announcement, so this engine printed '
        + 'NOTHING where the authority prints `|-miss|` at 90%. Clean it must refuse 0 times (the '
        + 'die turned it away first) and under the knob 1.' },

  { id: 'leechseed-hit', kind: 'red', arm: 'bottom-tie-first', A: [ZAM].concat(WALL_A), B: APP_LS,
    script: AT(SUB, 'leechseed'), mv: 'leechseed',
    refuseClean: 1, refuseKnob: 1,
    what: 'The same silent site on the hitting arm, where the roll is passed and the doll really is '
        + 'reached: the authority writes `|-fail|p2a` and this engine wrote nothing at all.' },

  /* ---- THE CONTROLS. Each removes exactly one thing and must hold under the knob too ----------- */
  { id: 'nodoll-miss', kind: 'control', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: BRO_TW,
    script: AT(CM, 'thunderwave'), mv: 'thunderwave',
    refuseClean: 0, refuseKnob: 0,
    what: 'THE DOLL CLEARED EXPLICITLY — the identical board, the identical Thunder Wave, the '
        + 'identical arm, with Calm Mind clicked instead of Substitute. A `|-miss|` is CORRECT here '
        + 'and both engines already write it. Without this arm, "the doll answered too early" and '
        + '"the top arm does something odd to status moves" are the same reading.' },

  { id: 'nodoll-hit', kind: 'control', arm: 'bottom-tie-first', A: [ZAM].concat(WALL_A), B: BRO_TW,
    script: AT(CM, 'thunderwave'), mv: 'thunderwave',
    refuseClean: 0, refuseKnob: 0,
    what: 'THE OTHER HALF OF THAT PAIR: no doll, hitting arm, so the paralysis really lands. It is '
        + 'the arm that would catch a fix that started failing status moves that no doll refused.' },

  { id: 'damage-doll-miss', kind: 'control', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: BRO_HP,
    script: AT(SUB, 'hydropump'), mv: 'hydropump',
    refuseClean: 0, refuseKnob: 0,
    what: 'THE DAMAGING ROAD, WHICH IS ALREADY CORRECT AND MUST STAY SO. Hydro Pump is 80%% into the '
        + 'same doll under the missing arm: `|-miss|` in both engines, before and after.' },

  { id: 'damage-doll-hit', kind: 'control', arm: 'bottom-tie-first', A: [ZAM].concat(WALL_A), B: BRO_HP,
    script: AT(SUB, 'hydropump'), mv: 'hydropump',
    refuseClean: 0, refuseKnob: 0,
    what: 'The damaging road on the hitting arm: the doll takes the hit and breaks, `|-end|`. This is '
        + 'the arm that fails if a fix reached the damage path and made it fail instead of absorb.' },

  { id: 'bypasssub', kind: 'control', arm: 'top-tie-first', A: [ZAM].concat(WALL_A), B: BRO_DI,
    script: AT(SUB, 'disable'), mv: 'disable',
    refuseClean: 0, refuseKnob: 0,
    what: 'THE BYPASS SET MUST NOT MOVE. Disable carries `bypasssub` and is in this engine\'s SUBPASS '
        + 'set, so the doll is never consulted for it and the move lands on the body behind it. A fix '
        + 'that made every status move fail at a doll would pass all five red arms and fail here.' },
];

/* ---- LEGALITY AND THE IMMUNITY-REASON COUNT, BOTH DERIVED --------------------------------------- */
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
for (const c of CASES) for (const row of c.A.concat(c.B)) {
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

/* HOW MANY REASONS IS THE TARGET REFUSED FOR, NOT COUNTING THE DOLL? A fixture blocked for two
 * reasons proves nothing about either, and this whole file is about WHICH refusal is announced. The
 * type half walks the target's types one at a time so a second refusing type is visible; the ability
 * and item halves ask the tag artifact rather than a name. Refused above ONE, printed always. */
const TAGS = require(D('data', 'tags.json'));
const REFUSE = ['absorbsType', 'immuneToMoveClass', 'immuneToType', 'refusesStatusMoves', 'levitates'];
function refusalReasons(speciesId, abilityName, itemId, moveId) {
  const sp = dex.species.get(speciesId);
  const mv = dex.moves.get(moveId);
  const out = [];
  for (const t of sp.types) if (dex.getImmunity(mv.type, [t]) === false) out.push('type:' + t);
  if (mv.status && !dex.getImmunity(mv.status, sp.types)) out.push('statusImmune:' + mv.status);
  const abRow = TAGS.abilities && TAGS.abilities[dex.abilities.get(abilityName || '').id];
  if (abRow && abRow.tags) for (const t of abRow.tags) if (REFUSE.includes(t)) out.push('ability:' + t);
  const itRow = itemId && TAGS.items && TAGS.items[String(itemId).toLowerCase().replace(/[^a-z0-9]/g, '')];
  if (itRow && itRow.tags) for (const t of itRow.tags) if (REFUSE.includes(t)) out.push('item:' + t);
  return out;
}

/* ---- THE POPULATION, DERIVED ON EVERY RUN ------------------------------------------------------ */
const SUB100 = dex.moves.all().filter(legal).filter(m =>
  m.category === 'Status' && !m.flags['bypasssub'] &&
  !['self', 'all', 'foeSide', 'allySide', 'allyTeam', 'allies', 'adjacentAlly', 'adjacentAllyOrSelf']
    .includes(m.target) && m.accuracy !== true && m.accuracy < 100);
console.log('THE ORDER HALF IS OBSERVABLE ON ' + SUB100.length + ' LEGAL MOVE(S) — status, foe-aimed, '
  + 'no bypasssub, printed accuracy under 100:');
console.log('  ' + SUB100.map(m => m.id + '@' + m.accuracy).join('  '));
const BP = dex.items.get('blunderpolicy');
console.log('THE ONE ITEM THAT KEYS ON A MISS: blunderpolicy isNonstandard=' + BP.isNonstandard
  + ' -> legal in this format? ' + legal(BP) + NL);
if (!SUB100.length) {
  console.log('THE AFFECTED SET IS EMPTY — the order half is unobservable and this file proves nothing.');
  process.exit(2);
}

/* ---- THE RUN ------------------------------------------------------------------------------------
 * The counters are read off `globalThis.MEDSEEN`/`globalThis.MEDFAILS`, which the engine writes on
 * load — that is the object the bytes the driver actually ran increment. As a per-game DELTA: a
 * whole-run total is a weaker claim than "this arm produced exactly this many". */
function play(G, c) {
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_substitute_status_step :: ' + c.id,
    { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(), restored: (globalThis.MEDFAILS || {}).subStatusAtTryHitRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  ran++;

  /* SHORT IS NOT A PASS: in protocol mode a game stops AT the divergence, so a game that played
   * fewer turns than its script WITHOUT a divergence stopped testing and would read green. */
  const short = clean.r.turns < c.script.length && !clean.r.div;
  /* A CLICK THE AUTHORITY'S REQUEST DID NOT OFFER becomes a silent `pass` on BOTH engines, so the
   * arm agrees while testing nothing. Asserted at EXACT ZERO. */
  const refused = clean.sc.moveNotOnRequest;
  const reasons = refusalReasons(c.A[0][0], c.A[0][2], c.A[0][1], c.mv);

  const brk = play(harness(true), c);
  harness(false);

  /* THE KNOB HAS TO BE SHOWN TO HAVE REACHED THE MODULE THE DRIVER PLAYED. On the clean load the
   * revert stamp must be ABSENT and every doll refusal must have taken the new road; under the knob
   * the exact mirror. A knob read by a module the driver never loaded reads identical on both. */
  const nClean = clean.delta.subStatusFailedBelowAccuracy;
  const nCleanOld = clean.delta.subStatusAtTryHitRestored;
  const nBrk = brk.delta && brk.delta.subStatusAtTryHitRestored;
  const nBrkNew = brk.delta && brk.delta.subStatusFailedBelowAccuracy;
  /* HOW MANY TIMES THE DOLL SHOULD REFUSE, DECLARED PER ARM AND PER LOAD — and the two numbers are
   * DIFFERENT on three arms, which is the finding rather than an inconvenience. Under the top arm a
   * sub-100 status move is turned away by the DIE at step 4, so the doll is never reached and the
   * clean count is 0; under the knob the doll answers first and it is 1. An arm that expected one
   * number for both loads would have to be wrong about one of them. */
  const knobOk = clean.restored === 0 && brk.restored === 1
              && nClean === c.refuseClean && nCleanOld === 0
              && nBrk === c.refuseKnob && nBrkNew === 0;

  results.push({ c, clean, brk, short, refused, reasons, nClean, nCleanOld, nBrk, nBrkNew, knobOk });

  if (short || refused) { bad++; continue; }
  if (reasons.length > 1) bad++;                      // a cell with two reasons proves nothing
  if (!knobOk) bad++;
  if (clean.r.div) bad++;                             // every arm must agree clean
  if (c.kind === 'red' && !brk.r.div) bad++;          // a red arm must PART under the knob
  if (c.kind === 'control' && brk.r.div) bad++;       // a control must NOT
}

/* ---- THE REPORT --------------------------------------------------------------------------------- */
for (const R of results) {
  const { c, clean, brk, short, refused, reasons, nClean, nCleanOld, nBrk, nBrkNew, knobOk } = R;
  const verdict = clean.r.div ? 'PARTS CLEAN ' : short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
    : c.kind === 'red' ? (brk.r.div ? 'RED PROVEN  ' : 'KNOB SILENT ')
                       : (brk.r.div ? 'OVER-FIRES  ' : 'CONTROL HELD');
  console.log(NL + verdict + '  ' + c.id + '   [' + c.arm + ']   '
    + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    refusal reasons for p1a against ' + dex.moves.get(c.mv).name + ', NOT counting the '
    + 'doll: ' + (reasons.length ? reasons.join(', ') : '(none)')
    + (reasons.length > 1 ? '   <-- FAIL, two reasons prove nothing about either' : ''));
  if (clean.r.div) {
    console.log('    CLEAN PARTED at reduced line ' + clean.r.div.index);
    console.log('      showdown  ' + clean.r.div.sdRaw);
    console.log('      medicham  ' + clean.r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(clean.r.div.sdAfterRaw.slice(0, 4)));
    console.log('      medicham next  ' + JSON.stringify(clean.r.div.meAfterRaw.slice(0, 4)));
  }
  if (brk.r && brk.r.div) {
    console.log('    UNDER THE KNOB the streams part at reduced line ' + brk.r.div.index);
    console.log('      showdown  ' + brk.r.div.sdRaw);
    console.log('      medicham  ' + brk.r.div.meRaw);
  } else if (brk.r) {
    console.log('    UNDER THE KNOB the streams still agree over all ' + brk.r.turns + ' turns');
  }
  console.log('    knob      belowAccuracy clean=' + nClean + ' knob=' + nBrkNew
    + ' | atTryHitRestored clean=' + nCleanOld + ' knob=' + nBrk
    + ' | MEDFAILS stamp clean=' + clean.restored + ' knob=' + brk.restored
    + '   (this arm should refuse ' + c.refuseClean + ' clean, ' + c.refuseKnob + ' on the knob)'
    + (knobOk ? '' : '   <-- FAIL, the knob did not reach the driver\'s module'));
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — the doll is asked at the foot of the step list and answers `-fail` '
  + 'on the mover; all five sites (status, affect, sharesHP, trap and the silent Leech Seed conjunct) '
  + 'are shown red under the revert knob, the three sub-100 arms refuse 0 times clean and 1 under the '
  + 'knob because the DIE gets there first, and the damaging road, the no-doll pair and the '
  + 'bypasssub control all hold under that same knob');
process.exit(bad ? 1 : 0);
