/* probe_endturn_clock_order.js — A PER-BODY DURATION CLOCK IS A STEP IN THE RESIDUAL WALK, AND THIS
 * ENGINE SPENT SEVEN OF THEM IN A BLOCK UNDERNEATH IT. 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_endturn_clock_order.js
 *   SHOWDOWN_PATH=... node tests/probe_endturn_clock_order.js --only disable-vs-perish
 *
 * ABRA-HEAP: 4096
 *
 * ================= THE CARD ======================================================================
 *
 * `data/game-differential.json`, release e5957689f94f, the one remaining actionable first-divergence
 * with cause `ordering`:
 *
 *     showdown   |-end|p1a: Archaludon|Disable
 *     medicham2  |-start|p1b: Staraptor|perish1
 *
 * A Disable expiring against a Perish Song counting down, at the end of the same turn, on two
 * different bodies of the same side.
 *
 * ================= WHAT THE AUTHORITY ACTUALLY DOES, READ RATHER THAN REASONED ===================
 *
 * `Battle#fieldEvent` (sim/battle.ts:484-566) collects the residual on TWO keys: a handler, OR a live
 * `duration` with no handler at all (`getKey = 'duration'`, :487-489, and every collector admits on
 * `callback !== undefined || state[getKey]`, :1097-1128). `resolvePriority` (:950) then fills
 * `handler.order` from `effect['onResidualOrder']` WHETHER OR NOT the callback exists, and
 * `speedSort`/`comparePriority` (:404-411) sorts ORDER first, speed third.
 *
 * So a bare duration is an ordinary step of the walk at a published position:
 *
 *     data/moves.ts:3649  disable.condition     onResidualOrder: 17,  onEnd -> `-end|…|Disable`
 *     data/moves.ts:13236 perishsong.condition  onResidualOrder: 24,  onResidual -> `-start|…|perishN`
 *
 * Champions overrides NEITHER — `data/mods/champions/moves.ts` carries no `disable` and no
 * `perishsong` row, and `data/mods/champions/conditions.ts` names neither. 17 < 24, so the authority
 * writes the Disable end first. That is the card, and it is not about Disable: it is about the whole
 * `expiry:` family, all seven members of which this engine ticked in a block BELOW the walk.
 *
 * ================= THE SIX CLOCKS AND THIS SINGLETON ARE ONE ROOT ================================
 *
 * `residualExpiryDeferred()` in engine/medicham2-browser.js names them off the artifact rather than
 * from a list: taunt@15, disable@17, magnetrise@18, healblock@20, throatchop@22, yawn@23. Every one
 * is `site: 'volatile'`, every one is `route: 'duration'`, and every one ticked in the same
 * foot-of-turn block as Perish Song's clock — so the singleton above is one visible instance of a
 * defect the census already knew about and could not see. Encore@16 is the seventh: it is a
 * `condition:` row rather than an `expiry:` one (it owns an `onResidual`), so `residualExpiryDeferred`
 * cannot name it, and it ticked in the very same loop.
 *
 * ================= WHAT IS FIXED HERE AND WHAT IS NOT ============================================
 *
 * FIXED: the seven per-body clocks above move INTO the walk, each at the order the artifact publishes
 * for it, dispatched by `RESIDUAL_CLOCKS_AT`. Orders 15-23 are all above the walk's own 25 (roost),
 * 28 (Speed Boost, Moody, Harvest) and 29 (White Herb, Zen Mode) groups, so this moves them above
 * those too — which is where the authority puts them and where this engine did not.
 *
 * NOT FIXED, DECLARED, AND MEASURED BY THE `known-open` ARM BELOW: perishsong@24, uproar@28 and
 * `lockedmove` still tick at the foot. They own `onResidual` handlers and a faint queue whose drain
 * position is Will's card 8 (see `RESIDUAL_AFTER_PERISH`), so moving them is a second change with a
 * second set of consequences and it is not this one. `perish-vs-speedboost` stages exactly that gap
 * and reports it every run rather than leaving it as a sentence.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the identical script under the differential's
 * own pin and the two protocol streams are compared line for line; the pass is that they do not part.
 * Every fixture is checked against `Dex.forFormat` for species, item, ability and learnset before a
 * single game is played, and an illegal one is `NOT RUN` rather than a skip.
 *
 * ================= EVERY RED ARM IS SHOWN RED, AND EVERY CONTROL IS SHOWN NOT TO MOVE ============
 *
 * Each arm is played TWICE: once against the engine as it stands, and once in the same process
 * against a FRESH LOAD of the same bytes under `MEDI_ENDTURN_CLOCKS_AT_FOOT=1`, which puts the seven
 * clocks back in the foot-of-turn block and takes their steps out of the walk. That knob is the
 * POSITION and nothing else — the same decrements happen, the same volatiles end, the same lines are
 * written; only where. It stamps `MEDFAILS.endturnClocksAtFoot`, so a run under it can never be
 * mistaken for a clean one.
 *
 *   a RED arm       must AGREE clean and must PART under the knob.
 *   a CONTROL arm   must AGREE clean and must ALSO AGREE under the knob.
 *
 * The second row is the load-bearing one. An arm that agrees under both is an arm the change
 * provably did not touch, so a red arm's parting is ATTRIBUTED by delta rather than inferred.
 */

'use strict';
const path = require('path');
const NL = '\n';
const D = (...p) => path.join(__dirname, '..', ...p);
const MEDI_PATH = D('engine', 'medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

const argv = process.argv.slice(2);
const ONLY = (() => { const i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1] : null; })();

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is not set. This probe compares two engines and cannot run on one.');
  process.exit(2);
}

/* ---- THE HARNESS. ONE PROCESS, TWO LOADS, AND THE KNOB IS READ AT MODULE LOAD -------------------
 * `RESIDUAL_CLOCK_ORDER` and `RESIDUAL_CLOCKS_AT` are module-level constants built when the engine is
 * first required, so the knob has to be set BEFORE the require and the module cache dropped between
 * the two loads. The driver holds a direct reference to the engine, so it is re-required too —
 * pairing a fresh engine with a cached driver would measure the OLD bytes and read green.
 *
 * THE CACHE KEY IS NOT `engine/medicham2-browser.js` AND ASSUMING IT WAS COST THIS FILE A PASS.
 * `game_differential.js` with no `--release` CUTS a release from the live tree and then loads the
 * engine out of the SNAPSHOT — `data/releases/<id>/engine/medicham2-browser.js`. Deleting the live
 * path's cache entry therefore deleted nothing that was in use: the second load reused the cached
 * snapshot, the knob never reached a module, and all seven arms read `residualClockInWalk` identical
 * across the knob — which is CLAUDE.md's "an unwired knob gives identical output" arriving exactly on
 * cue. So every cached module whose filename is this engine is dropped, whatever directory it was
 * loaded from, and `knobArmed` below asserts the reload actually happened. */
let _cur = null, _G = null;
function dropEngine() {
  for (const k of Object.keys(require.cache)) {
    if (k.endsWith('medicham2-browser.js')) delete require.cache[k];
  }
  delete require.cache[require.resolve(GD_PATH)];
}
function harness(atFoot) {
  const key = atFoot ? 'foot' : 'walk';
  if (_G && _cur === key) return _G;
  if (atFoot) process.env.MEDI_ENDTURN_CLOCKS_AT_FOOT = '1';
  else delete process.env.MEDI_ENDTURN_CLOCKS_AT_FOOT;
  dropEngine();
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- SCENARIO SUGAR ---------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const P4 = [PROT, PROT];

/* The two back bodies never enter; they exist because a pair is four. */
const BENCH_A = [['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']]];
const BENCH_A2 = [['milotic', '', 'Marvel Scale', ['Protect']], ['spiritomb', '', 'Infiltrator', ['Protect']]];
const BENCH_B = [['toxapex', '', 'Regenerator', ['Protect']], ['garchomp', '', 'Rough Skin', ['Protect']]];

/* Side A leads: the clock's owner or the clock's applier. Side B leads: the follower under test. */
const CASES = [

  /* ========================= YAWN@23 ABOVE SPEED BOOST@28 ======================================= */
  { id: 'yawn-vs-speedboost', kind: 'red',
    what: 'Slowking YAWNS the Sharpedo. `yawn.condition` is `duration: 2, onResidualOrder: 23` with '
        + 'NO `onResidual` — a bare duration, collected on `getKey` alone — and its `onEnd` is what '
        + 'puts the body to sleep. Speed Boost is `onResidualOrder: 28`. So on turn 2 the authority '
        + 'writes the Yawn end and the sleep BEFORE the Speed boost, and this engine wrote the boost '
        + 'first because the clock lived below the whole walk. Two turns, no damage anywhere.',
    A: [['slowking', '', 'Oblivious', ['Yawn', 'Protect']], ['snorlax', '', 'Thick Fat', ['Protect']], ...BENCH_A],
    B: [['sharpedo', '', 'Speed Boost', ['Aqua Jet', 'Protect']], ['archaludon', '', 'Stamina', ['Protect']], ...BENCH_B],
    script: [T([{ m: 'yawn', t: 0 }, PROT], [{ m: 'aquajet', t: 1 }, PROT]),
             T(P4, P4)] },

  /* ========================= TAUNT@15 ABOVE SPEED BOOST@28 ====================================== */
  { id: 'taunt-vs-speedboost', kind: 'red',
    what: 'Alakazam TAUNTS the Sharpedo. `taunt.condition` carries `onResidualOrder: 15` — the '
        + 'topmost member of the family — against the same order-28 follower as the Yawn arm, eight '
        + 'orders further up, so the two together say the fix is the FAMILY and not one volatile. '
        + 'The script runs to turn 4 because that is where BOTH engines end the clock; its LENGTH is '
        + 'not asserted anywhere here and is not what this arm is about — `test-volatile-duration.js` '
        + 'owns that, and a turn count typed into this file would be exactly the kind of number '
        + 'CLAUDE.md forbids. Sharpedo clicks Aqua Jet and never Protect, because a taunted body may '
        + 'not click a status move at all.',
    A: [['alakazam', '', 'Synchronize', ['Taunt', 'Protect']], ['snorlax', '', 'Thick Fat', ['Protect']], ...BENCH_A],
    B: [['sharpedo', '', 'Speed Boost', ['Aqua Jet', 'Protect']], ['archaludon', '', 'Stamina', ['Protect']], ...BENCH_B],
    script: [T([{ m: 'taunt', t: 0 }, PROT], [{ m: 'aquajet', t: 1 }, PROT]),
             T(P4, [{ m: 'aquajet', t: 1 }, PROT]),
             T(P4, [{ m: 'aquajet', t: 1 }, PROT]),
             T(P4, [{ m: 'aquajet', t: 1 }, PROT])] },

  /* ========================= DISABLE@17 ABOVE SPEED BOOST@28 ==================================== */
  { id: 'disable-vs-speedboost', kind: 'red',
    what: 'THE CARD\'S OWN VOLATILE, against the follower that needs the fewest turns to stage. '
        + 'Snorlax curls on turn 1 so that it has the `lastMove` `disable.onTryHit` requires; '
        + 'Alakazam disables it on turn 2, moving first and therefore spending one of the five '
        + 'residuals at application, so the clock ends at the residual of TURN 5 while Sharpedo is '
        + 'still taking a Speed boost every turn. Snorlax then clicks AMNESIA rather than Protect '
        + 'for the rest of the script, and that is not decoration: Protect is priority +4, so a '
        + 'protecting target is already behind its shield when a priority-0 Disable arrives and the '
        + 'move is simply blocked — the first draft of this arm staged nothing for exactly that '
        + 'reason. Nothing on this board takes a point of damage.',
    A: [['alakazam', '', 'Synchronize', ['Disable', 'Protect']], ['clefable', '', 'Unaware', ['Protect']], ...BENCH_A2],
    B: [['sharpedo', '', 'Speed Boost', ['Protect']], ['snorlax', '', 'Thick Fat', ['Amnesia', 'Double Team']], ...BENCH_B],
    script: [T(P4, [PROT, { m: 'amnesia' }]),
             T([{ m: 'disable', t: 1 }, PROT], [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }])] },

  /* ========================= DISABLE@17 ABOVE PERISH SONG@24 — THE CARD ========================= */
  { id: 'disable-vs-perish', kind: 'red',
    what: 'THE FIRST-DIVERGENCE CARD REBUILT. Alakazam disables the Snorlax on turn 2 (the clock ends '
        + 'at the turn-5 residual) and Primarina sings on turn 3, so the perish counter reads '
        + '`perish1` at that same residual. `disable` is order 17 and `perishsong` is order 24, so '
        + 'the authority writes the Disable end FIRST and this engine wrote it last — both clocks '
        + 'ticked in the same foot-of-turn block and the perish one ticked earlier in it. NO SPEED '
        + 'BOOST ON THIS BOARD, deliberately: perishsong@24 is still ticked at the foot after this '
        + 'fix, so a Speed Boost body here would keep the arm red for a reason this fix does not '
        + 'claim.',
    A: [['alakazam', '', 'Synchronize', ['Disable', 'Protect']], ['primarina', '', 'Torrent', ['Perish Song', 'Protect']],
        ...BENCH_A2],
    B: [['archaludon', '', 'Stamina', ['Protect']], ['snorlax', '', 'Thick Fat', ['Amnesia', 'Double Team']], ...BENCH_B],
    script: [T(P4, [PROT, { m: 'amnesia' }]),
             T([{ m: 'disable', t: 1 }, PROT], [PROT, { m: 'doubleteam' }]),
             T([PROT, { m: 'perishsong' }], [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }])] },

  /* ========================= THE CONTROLS ====================================================== */
  { id: 'speedboost-alone', kind: 'control',
    what: 'THE SAME BOARD AND THE SAME FIVE TURNS AS `disable-vs-speedboost` WITH THE DISABLE CLICK '
        + 'REPLACED BY A PROTECT. No clock of the family is anywhere on the field, so moving the '
        + 'family must not move a line. Without this arm, "the streams agree" would be '
        + 'indistinguishable from a knob that never reached the engine.',
    A: [['alakazam', '', 'Synchronize', ['Disable', 'Protect']], ['clefable', '', 'Unaware', ['Protect']], ...BENCH_A2],
    B: [['sharpedo', '', 'Speed Boost', ['Protect']], ['snorlax', '', 'Thick Fat', ['Amnesia', 'Double Team']], ...BENCH_B],
    script: [T(P4, [PROT, { m: 'amnesia' }]),
             T(P4, [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }]),
             T(P4, [PROT, { m: 'doubleteam' }])] },

  { id: 'leechseed-vs-speedboost', kind: 'control',
    what: 'LEECH SEED IS `onResidualOrder: 8` — a member of the walk this engine ALREADY placed '
        + 'correctly, eight orders above the family being moved and twenty above the follower. Its '
        + 'two HP lines must land in exactly the same place clean and under the knob. This is the '
        + 'arm that says the change is a MOVE of seven steps and not a re-ordering of the walk.',
    A: [['venusaur', '', 'Overgrow', ['Leech Seed', 'Protect']], ['snorlax', '', 'Thick Fat', ['Protect']], ...BENCH_A],
    B: [['sharpedo', '', 'Speed Boost', ['Aqua Jet', 'Protect']], ['archaludon', '', 'Stamina', ['Protect']], ...BENCH_B],
    script: [T([{ m: 'leechseed', t: 0 }, PROT], [{ m: 'aquajet', t: 1 }, PROT]),
             T(P4, P4)] },

  /* ========================= THE HALF THAT IS NOT FIXED ========================================= */
  { id: 'perish-vs-speedboost', kind: 'known-open',
    what: 'A DECLARED, MEASURED, UNFIXED ROW — not a failure and not a pass. `perishsong.condition` '
        + 'is order 24 and Speed Boost is 28, so the authority writes `perishN` above the boost; this '
        + 'engine ticks the perish clock in the foot-of-turn block, BELOW the whole walk, so it '
        + 'writes the boost first. The clock is not moved here because it owns an `onResidual`, a '
        + 'faint at zero and a drain position that is Will\'s card 8 (`RESIDUAL_AFTER_PERISH`). '
        + 'Staged so the claim carries a running measurement instead of a sentence.',
    A: [['primarina', '', 'Torrent', ['Perish Song', 'Protect']], ['snorlax', '', 'Thick Fat', ['Protect']], ...BENCH_A],
    B: [['sharpedo', '', 'Speed Boost', ['Aqua Jet', 'Protect']], ['archaludon', '', 'Stamina', ['Protect']], ...BENCH_B],
    script: [T([{ m: 'perishsong' }, PROT], [{ m: 'aquajet', t: 1 }, PROT]),
             T(P4, P4)] },
];

/* ---- LEGALITY, DERIVED. Nothing above is trusted from memory or from a list. --------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp);
  const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const c of CASES) {
  for (const row of c.A.concat(c.B)) {
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
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE ORDERS ARE PRINTED, NEVER TYPED --------------------------------------------------------
 * Every claim this file makes about "17 is above 24" is a claim about data/residual-order.json, which
 * derives from `Battle#resolvePriority` in the format. Printing them is what stops this header from
 * becoming the fourteen stale handoffs in a smaller costume. */
{
  const rows = require(D('data', 'residual-order.json')).rows;
  const want = [['expiry', 'taunt'], ['condition', 'encore'], ['expiry', 'disable'], ['expiry', 'magnetrise'],
                ['expiry', 'healblock'], ['expiry', 'throatchop'], ['expiry', 'yawn'],
                ['condition', 'perishsong'], ['condition', 'leechseed'], ['ability', 'speedboost'],
                ['expiry', 'roost'], ['item', 'whiteherb']];
  console.log('THE POSITIONS THIS PROBE RESTS ON, read out of data/residual-order.json:');
  for (const [ns, id] of want) {
    const r = rows.find(x => x.ns === ns && x.id === id);
    console.log('  ' + (ns + ':' + id).padEnd(24) + (r ? 'order ' + r.order + '  subOrder ' + r.subOrder
      + '  route ' + r.route : 'ABSENT FROM THE ARTIFACT'));
  }
}

/* ---- THE RUN ------------------------------------------------------------------------------------
 * The counters come off `globalThis.MEDSEEN`, which is the object the bytes that actually ran
 * increment, read as a DELTA around each game. */
const ARM_ID = 'bottom-tie-first';
function play(G, c) {
  const arm = G.ARM_BY_ID.get(ARM_ID);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + ARM_ID); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_endturn_clock_order :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(), fails: Object.assign({}, globalThis.MEDFAILS || {}) };
}

let bad = 0, ran = 0, knownOpen = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  ran++;

  /* SHORT IS NOT A PASS: in protocol mode a game stops AT the divergence, so a game that played
   * fewer turns than its script without one stopped testing. */
  const short = clean.r.turns < c.script.length && !clean.r.div;
  /* A CLICK THE AUTHORITY'S REQUEST DID NOT OFFER becomes a silent `pass` on BOTH engines. */
  const refused = clean.sc.moveNotOnRequest;

  const knob = play(harness(true), c);
  harness(false);

  /* THE KNOB MUST HAVE REACHED THE ENGINE. Without this an unwired env var reads as a held control
   * on every single arm, which is exactly the shape of a test that asks nothing. */
  const knobArmed = knob.fails && knob.fails.endturnClocksAtFoot === 1;
  const cleanUnarmed = !(clean.fails && clean.fails.endturnClocksAtFoot);

  results.push({ c, clean, knob, short, refused, knobArmed, cleanUnarmed });

  if (!knobArmed || !cleanUnarmed) { bad++; continue; }
  if (c.kind === 'known-open') { knownOpen++; continue; }
  if (short || refused) { bad++; continue; }
  if (clean.r.div) bad++;                                   // every arm must agree clean
  if (c.kind === 'red' && !knob.r.div) bad++;               // a red arm must PART under the knob
  if (c.kind === 'control' && knob.r.div) bad++;            // a control must NOT
}

/* ---- THE REPORT --------------------------------------------------------------------------------- */
for (const { c, clean, knob, short, refused, knobArmed, cleanUnarmed } of results) {
  const verdict = !knobArmed ? 'KNOB UNWIRED' : !cleanUnarmed ? 'KNOB STUCK ON'
    : c.kind === 'known-open' ? (clean.r.div ? 'KNOWN-OPEN  ' : 'KNOWN-OPEN? ')
    : clean.r.div ? 'PARTS CLEAN ' : short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
    : c.kind === 'red' ? (knob.r.div ? 'RED PROVEN  ' : 'KNOB SILENT ')
                       : (knob.r.div ? 'OVER-FIRES  ' : 'CONTROL HELD');
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  if (clean.r.div) {
    console.log('    CLEAN PARTED at reduced line ' + clean.r.div.index);
    console.log('      showdown  ' + clean.r.div.sdRaw);
    console.log('      medicham  ' + clean.r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(clean.r.div.sdAfterRaw.slice(0, 4)));
    console.log('      medicham next  ' + JSON.stringify(clean.r.div.meAfterRaw.slice(0, 4)));
  }
  if (knob.r && knob.r.div) {
    console.log('    UNDER MEDI_ENDTURN_CLOCKS_AT_FOOT=1 the streams part at reduced line ' + knob.r.div.index);
    console.log('      showdown  ' + knob.r.div.sdRaw);
    console.log('      medicham  ' + knob.r.div.meRaw);
  } else if (knob.r) {
    console.log('    UNDER MEDI_ENDTURN_CLOCKS_AT_FOOT=1 the streams still agree over all '
      + knob.r.turns + ' turns');
  }
  console.log('    clocks ticked in the walk: ' + (clean.delta.residualClockInWalk)
    + '   under the knob: ' + (knob.delta.residualClockInWalk)
    + '   |   volDurationTicked ' + clean.delta.volDurationTicked + ' / ' + knob.delta.volDurationTicked);
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + knownOpen + ' of them KNOWN-OPEN (declared, not counted), '
  + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — every per-body duration clock in the family runs at the order the '
  + 'authority publishes for it, each is shown red under the position knob, and both controls hold '
  + 'under that same knob');
process.exit(bad ? 1 : 0);
