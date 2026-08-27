/* probe_yawn_substitute.js — THE YAWN BRANCH NEVER ASKED THE DOLL AT ALL. 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_yawn_substitute.js
 *   SHOWDOWN_PATH=... node tests/probe_yawn_substitute.js --only yawn-doll
 *   SHOWDOWN_PATH=... node tests/probe_yawn_substitute.js --release <id>
 *
 * ================= WHAT THE AUTHORITY DOES WITH A YAWN AIMED AT A DOLL ==========================
 *
 * `Battle.actions.trySpreadMoveHit` (sim/battle-actions.ts:550-577) declares `moveSteps`; the
 * Champions mod overrides `spreadMoveHit` (data/mods/champions/scripts.ts:315) and
 * `hitStepMoveHitLoop` (:428) and nothing above them, so gen 9 Champions keeps mainline's order.
 * Inside the mod's own `spreadMoveHit` the order that matters here is, verbatim:
 *
 *     :332   hitResult = this.battle.singleEvent('TryHit', moveData, {}, target, pokemon, move);
 *     :336-339   if (hitResult === false) { add('-fail', pokemon); attrLastMove('[still]'); }
 *     :343   // 0. check for substitute
 *     :346   damage = this.tryPrimaryHitEvent(damage, targets, pokemon, move, moveData, isSecondary);
 *     :373   // 3. onHit event happens here   -> runMoveEffects -> addVolatile('yawn')
 *
 * So the MOVE's own `onTryHit` is above the doll and `addVolatile` is below it. Yawn's own handler
 * (`data/moves.ts:21135-21139`; Champions does NOT override yawn — there is no `yawn` key in
 * `data/mods/champions/moves.ts`) is:
 *
 *     onTryHit(target) { if (target.status || !target.runStatusImmunity('slp')) return false; }
 *
 * and the doll it then meets is the `substitute` CONDITION's `onTryPrimaryHit` (`data/moves.ts`,
 * inside the `substitute` move entry — Champions overrides neither `substitute` in `moves.ts` nor
 * anything in `conditions.ts`, and `data/mods/champions/conditions.ts` has no `substitute` key and no
 * `onTryPrimaryHit` at all):
 *
 *     if (target === source || move.flags['bypasssub'] || move.infiltrates) return;
 *     let damage = this.actions.getDamage(source, target, move);
 *     if (!damage && damage !== 0) { this.add('-fail', source); this.attrLastMove('[still]'); return null; }
 *
 * Yawn is `basePower: 0`, so `getDamage` returns **undefined** at `sim/battle-actions.ts:1620`
 * (`if (!basePower) return basePower === 0 ? undefined : basePower;`) — it cannot answer `-immune`
 * on the way, because `hitStepTypeImmunity` sets `move.ignoreImmunity = true` for every Status move
 * (:655-657) and `runImmunity` short-circuits true.
 *
 * ===> THE LINE THE AUTHORITY PRINTS IS `|-fail|<THE MOVER>`, with the MOVER's `|move|` line target
 *      blanked and `[still]` appended. Never an `-activate`, never a line on the target, and no
 *      `|-start|<target>|move: Yawn` at all. This file types no expectation — both engines play the
 *      identical script under the differential's own pin and the two protocol streams are compared —
 *      but that is what it is, and the raw lines are printed on every run so it can be checked.
 *
 * ================= WHAT THIS ENGINE DID ========================================================
 *
 * NOTHING. `grep subBlocks engine/medicham2-browser.js` names ten sites and the `a.kind==='yawn'`
 * branch is not one of them: it walked its veil check, its `tryHitRefusal`, its shield check, its
 * already-drowsing check and its `canTakeStatus` check, and then wrote the drowse onto the body
 * BEHIND the doll. This is a MISSING check, not a misplaced one — which is why it is its own batch
 * and not part of the five-site stage-order fix that found it.
 *
 * ================= AND IT IS BOARD-MATERIAL, WHICH IS ASSERTED RATHER THAN ARGUED ===============
 *
 * The `yawn-doll-sleep` arm plays TWO turns under `--end-state` (so the loop does not stop at the
 * first divergent line) and reads the whole medicham stream: under the revert knob it contains a
 * `|-status|<target>|slp` that the authority's stream does not, because `_yawn` ticks to zero at the
 * end of turn 2 and `applyStatus(m,'slp')` fires. A body that is asleep and a body that is not are a
 * different board on every subsequent turn.
 *
 * ================= NO DIE MOVES ================================================================
 *
 * Yawn's printed accuracy is `true`, so `hitStepAccuracy` takes no draw for it on either engine, and
 * `getDamage` returns at the basePower test ABOVE the crit `randomChance`. Both are printed below.
 * So unlike the stage-order batch — where the authority drew `acc` and this engine drew nothing —
 * fixing this changes no draw and seeded runs stay comparable.
 *
 * ================= ONE REFUSAL REASON, DERIVED AND REFUSED ABOVE ONE ============================
 *
 * A body behind a doll may also be sleep-immune by type, by ability, by an existing status, by a
 * field condition or already drowsy, and a fixture blocked twice proves nothing about either. The
 * count is derived per arm from the format and from `data/tags.json` and printed; above one, the arm
 * FAILS. Alakazam is mono-Psychic with Inner Focus, statusless, on no terrain, drowsing nothing.
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

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE. `--end-state` is the driver's own flag for it
 * (game_differential.js:96, and :3465 is the loop guard that reads it), and the sleep this row is
 * about lands two turns after the line that parts. Pushed before the driver is required, because it
 * is a module-load-time read. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

/* ---- THE SNAPSHOT THE KNOB IS APPLIED TO MUST BE THE TREE THIS FILE IS TESTING ------------------ */
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_yawn_substitute.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_YAWN_IGNORES_SUB';

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

/* ---- SCENARIO SUGAR ----------------------------------------------------------------------------
 * The doll goes up INSIDE turn 1: Alakazam is 120 base Speed and the Yawn user is 30, so the
 * Substitute is standing before the Yawn resolves. Bodies and walls are the same ones
 * `probe_substitute_status_step.js` staged, for the reason it staged them. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const SUB = { m: 'substitute' };
const CM = { m: 'calmmind' };

/* THE DOLL HOLDER. Inner Focus, mono-Psychic: not Insomnia/Vital Spirit (sleep-immune), not Electric,
 * not Ghost, not Dark, no Safeguard, no terrain — so the doll is the ONLY thing in a Yawn's way. */
const ZAM = ['alakazam', '', 'Inner Focus', ['Substitute', 'Calm Mind', 'Protect']];
const WALL_A = [['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']],
  ['snorlax', '', 'Thick Fat', ['Protect']]];
const WALL_B = [['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
  ['corviknight', '', 'Pressure', ['Protect']]];

/* THE MOVERS. Slowbro learns Yawn (derived below, not recalled) and is slower than Alakazam. */
const BRO_YAWN = [['slowbro', '', 'Oblivious', ['Yawn', 'Calm Mind', 'Protect']]].concat(WALL_B);
const BRO_DI = [['slowbro', '', 'Oblivious', ['Disable', 'Protect']]].concat(WALL_B);
const BRO_HP = [['slowbro', '', 'Oblivious', ['Hydro Pump', 'Protect']]].concat(WALL_B);

const T1 = (p1a, mv) => ({ p1: [p1a, PROT], p2: [{ m: mv, t: 0 }, PROT] });
const AT = (p1a, mv) => [T1(p1a, mv)];
/* TURN 2 IS TWO CALM MINDS, not two Protects: a second consecutive Protect carries its own failure
 * chance in both engines and would put a second mechanic inside the arm that measures the sleep. */
const AT2 = (p1a, mv) => [T1(p1a, mv), { p1: [CM, PROT], p2: [CM, PROT] }];

const CASES = [
  /* ---- THE DEFECT ------------------------------------------------------------------------------ */
  { id: 'yawn-doll', kind: 'red', arm: 'middle', A: [ZAM].concat(WALL_A), B: BRO_YAWN,
    script: AT(SUB, 'yawn'), mv: 'yawn', refuseClean: 1, ignoreKnob: 1, sleepClean: 0, sleepKnob: 0,
    what: 'THE REPORTED DEFECT, at one turn. The authority answers the doll with `|-fail|p2a` and a '
        + 'blanked `|move|` target carrying `[still]`; this engine asked no doll at all and wrote '
        + '`|-start|p1a|move: Yawn`. Yawn cannot miss (accuracy `true`), so no arm and no die is in '
        + 'the way of the comparison.' },

  { id: 'yawn-doll-sleep', kind: 'red', arm: 'middle', A: [ZAM].concat(WALL_A), B: BRO_YAWN,
    script: AT2(SUB, 'yawn'), mv: 'yawn', refuseClean: 1, ignoreKnob: 1, sleepClean: 0, sleepKnob: 1,
    what: 'THE SAME DEFECT PLAYED TO ITS CONSEQUENCE. Two turns under `--end-state`, so the loop runs '
        + 'past the divergent line: the drowse ticks to zero at the end of turn 2 and this engine '
        + 'writes `|-status|p1a|slp` where the authority writes nothing. That line is the '
        + 'board-material claim, asserted (sleepKnob=1, sleepClean=0) rather than argued.' },

  /* ---- THE CONTROLS. Each clears exactly one thing, and each must hold under the knob too -------- */
  { id: 'nodoll', kind: 'control', arm: 'middle', A: [ZAM].concat(WALL_A), B: BRO_YAWN,
    script: AT(CM, 'yawn'), mv: 'yawn', refuseClean: 0, ignoreKnob: 0, sleepClean: 0, sleepKnob: 0,
    what: 'THE DOLL CLEARED EXPLICITLY — the identical board, the identical Yawn, the identical arm, '
        + 'with Calm Mind clicked instead of Substitute. The drowse is CORRECT here and both engines '
        + 'write it. Without this arm, "the doll was never asked" and "Yawn is broken" read the same.' },

  { id: 'nodoll-sleep', kind: 'control', arm: 'middle', A: [ZAM].concat(WALL_A), B: BRO_YAWN,
    script: AT2(CM, 'yawn'), mv: 'yawn', refuseClean: 0, ignoreKnob: 0, sleepClean: 1, sleepKnob: 1,
    what: 'AND THE SLEEP ITSELF STILL LANDS, in BOTH engines, on both loads. This is the arm that '
        + 'fails if the fix reached the drowse rather than the doll: sleepClean=1 says the '
        + '`|-status|slp` is present in the medicham stream and the streams still agree, which is '
        + 'only possible if the authority wrote it too.' },

  { id: 'bypasssub', kind: 'control', arm: 'middle', A: [ZAM].concat(WALL_A), B: BRO_DI,
    script: AT(SUB, 'disable'), mv: 'disable', refuseClean: 0, ignoreKnob: 0, sleepClean: 0, sleepKnob: 0,
    what: 'THE BYPASS SET MUST NOT MOVE. Disable carries `bypasssub`, so `subBlocks` returns false '
        + 'for it and the move lands on the body behind the doll. A fix that made every status move '
        + 'fail at a doll would pass both red arms and fail here.' },

  { id: 'damage-doll', kind: 'control', arm: 'middle', A: [ZAM].concat(WALL_A), B: BRO_HP,
    script: AT(SUB, 'hydropump'), mv: 'hydropump', refuseClean: 0, ignoreKnob: 0,
    sleepClean: 0, sleepKnob: 0,
    what: 'THE DAMAGING ROAD, WHICH IS ALREADY CORRECT AND MUST STAY SO — the doll takes the hit. '
        + 'This arm fails if the change reached the damage path, which is also the arm that answers '
        + '"did damage move" for this batch.' },
];

/* ---- LEGALITY AND THE REFUSAL COUNT, BOTH DERIVED ----------------------------------------------- */
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

/* HOW MANY REASONS IS THE TARGET REFUSED FOR, NOT COUNTING THE DOLL? The type half walks the target's
 * types one at a time so a second refusing type is visible; the sleep half asks `getImmunity` for the
 * status the move actually inflicts; the ability and item halves ask the tag artifact rather than a
 * name; and the sleep-blocking ability set is DERIVED from the format's own handlers rather than
 * listed here. Refused above ONE, printed always. */
const TAGS = require(D('data', 'tags.json'));
const REFUSE = ['absorbsType', 'immuneToMoveClass', 'immuneToType', 'refusesStatusMoves', 'levitates'];
/* The abilities that stop a sleep, read out of the format: anything whose `onSetStatus`/
 * `onTryAddVolatile`/`onImmunity` source text names `slp`. Derived so a member added later is caught. */
const SLEEP_BLOCKERS = dex.abilities.all().filter(legal).filter(a => {
  const src = ['onSetStatus', 'onTryAddVolatile', 'onImmunity', 'onAllySetStatus', 'onStart']
    .map(k => (a[k] ? String(a[k]) : '')).join(' ');
  return /'slp'|"slp"/.test(src);
}).map(a => a.id);
function refusalReasons(speciesId, abilityName, itemId, moveId) {
  const sp = dex.species.get(speciesId);
  const mv = dex.moves.get(moveId);
  const out = [];
  for (const t of sp.types) if (dex.getImmunity(mv.type, [t]) === false) out.push('type:' + t);
  const inflicts = mv.status || (mv.id === 'yawn' ? 'slp' : null);
  if (inflicts && !dex.getImmunity(inflicts, sp.types)) out.push('statusImmune:' + inflicts);
  const abId = dex.abilities.get(abilityName || '').id;
  if (inflicts === 'slp' && SLEEP_BLOCKERS.includes(abId)) out.push('ability:blocksSleep');
  const abRow = TAGS.abilities && TAGS.abilities[abId];
  if (abRow && abRow.tags) for (const t of abRow.tags) if (REFUSE.includes(t)) out.push('ability:' + t);
  const itRow = itemId && TAGS.items && TAGS.items[String(itemId).toLowerCase().replace(/[^a-z0-9]/g, '')];
  if (itRow && itRow.tags) for (const t of itRow.tags) if (REFUSE.includes(t)) out.push('item:' + t);
  return out;
}

/* ---- WHAT THE FORMAT SAYS ABOUT THE DIE, PRINTED RATHER THAN ASSUMED ---------------------------- */
const YW = dex.moves.get('yawn');
console.log('yawn: accuracy=' + JSON.stringify(YW.accuracy) + '  basePower=' + YW.basePower
  + '  category=' + YW.category + '  target=' + YW.target
  + '  flags=' + JSON.stringify(YW.flags) + '  isNonstandard=' + YW.isNonstandard);
console.log('  accuracy `true` means hitStepAccuracy takes NO draw, and basePower 0 means getDamage '
  + 'returns at sim/battle-actions.ts:1620 ABOVE the crit randomChance — so this fix moves no die.');
console.log('  bypasssub on yawn? ' + !!YW.flags['bypasssub']
  + '   (the doll is consulted for it)   sleep-blocking abilities derived from the format: '
  + SLEEP_BLOCKERS.length + NL);

/* ---- THE RUN ------------------------------------------------------------------------------------
 * Counters come off `globalThis.MEDSEEN`/`globalThis.MEDFAILS` — the objects the bytes the driver
 * actually ran increment — as a per-game DELTA, because a whole-run total is a weaker claim than
 * "this arm produced exactly this many". */
const SLP = /^\|-status\|[^|]*\|slp/;
function play(G, c) {
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_yawn_substitute :: ' + c.id,
    { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const slp = (r.mediTrace || []).filter(l => SLP.test(String(l))).length;
  return { r, delta, slp, sc: G.scriptCounters(),
           restored: (globalThis.MEDFAILS || {}).yawnIgnoresSubRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  ran++;

  /* SHORT IS NOT A PASS. Under `--end-state` the loop does not stop at the divergent line, so a game
   * that played fewer turns than its script stopped for some OTHER reason and tested less than it
   * claims. */
  const short = clean.r.turns < c.script.length;
  /* A CLICK THE AUTHORITY'S REQUEST DID NOT OFFER becomes a silent `pass` on BOTH engines, so the arm
   * agrees while testing nothing. Asserted at EXACT ZERO. */
  const refused = clean.sc.moveNotOnRequest;
  const reasons = refusalReasons(c.A[0][0], c.A[0][2], c.A[0][1], c.mv);

  const brk = play(harness(true), c);
  harness(false);

  /* THE KNOB HAS TO BE SHOWN TO HAVE REACHED THE MODULE THE DRIVER PLAYED: the load-time stamp ABSENT
   * on the clean load and PRESENT under the knob, and the two counters exact mirrors. A knob read by a
   * module the driver never loaded reads identically on both loads and stages nothing. */
  const nClean = clean.delta.subStatusFailedBelowAccuracy;
  const nCleanIgn = clean.delta.yawnDollIgnored;
  const nBrkIgn = brk.delta && brk.delta.yawnDollIgnored;
  const nBrk = brk.delta && brk.delta.subStatusFailedBelowAccuracy;
  const knobOk = clean.restored === 0 && brk.restored === 1
              && nClean === c.refuseClean && nCleanIgn === 0
              && nBrkIgn === c.ignoreKnob && nBrk === 0;
  /* THE BOARD-MATERIAL CLAIM, as a count of `|-status|...|slp` lines in the medicham stream. */
  const slpOk = clean.slp === c.sleepClean && brk.slp === c.sleepKnob;

  results.push({ c, clean, brk, short, refused, reasons, nClean, nCleanIgn, nBrk, nBrkIgn, knobOk, slpOk });

  if (short || refused) { bad++; continue; }
  if (reasons.length > 1) bad++;                      // a cell with two reasons proves nothing
  if (!knobOk) bad++;
  if (!slpOk) bad++;
  if (clean.r.div) bad++;                             // every arm must agree clean
  if (c.kind === 'red' && !brk.r.div) bad++;          // a red arm must PART under the knob
  if (c.kind === 'control' && brk.r.div) bad++;       // a control must NOT
}

/* ---- THE REPORT --------------------------------------------------------------------------------- */
for (const R of results) {
  const { c, clean, brk, short, refused, reasons, nClean, nCleanIgn, nBrk, nBrkIgn, knobOk, slpOk } = R;
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
  console.log('    knob      subStatusFailedBelowAccuracy clean=' + nClean + ' knob=' + nBrk
    + ' | yawnDollIgnored clean=' + nCleanIgn + ' knob=' + nBrkIgn
    + ' | MEDFAILS stamp clean=' + clean.restored + ' knob=' + brk.restored
    + '   (this arm should refuse ' + c.refuseClean + ' clean and ignore ' + c.ignoreKnob + ' on the '
    + 'knob; an arm whose doll is up must be 1 and 1, because a knob that ignored nothing reverted nothing)'
    + (knobOk ? '' : '   <-- FAIL, the knob did not reach the driver\'s module'));
  console.log('    board     `|-status|...|slp` lines in the medicham stream: clean=' + clean.slp
    + ' knob=' + brk.slp + '   (expected ' + c.sleepClean + ' / ' + c.sleepKnob + ')'
    + (slpOk ? '' : '   <-- FAIL, the board consequence is not where this arm says it is'));
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — the yawn branch asks the doll, answers `-fail` on the mover, and '
  + 'the sleep two turns later is gone with it; both red arms part under the revert knob and the '
  + 'no-doll pair, the bypasssub arm and the damaging road all hold under that same knob');
process.exit(bad ? 1 : 0);
