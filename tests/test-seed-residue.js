/* test-seed-residue.js — THE ITEM IS ASKED FOR, NOT REMEMBERED (ROADMAP #271).
 *
 *   node tests/test-seed-residue.js
 *
 * Sibling of tests/test-rollout-seed.js, and it exists for the same stated reason. Will, 2026-08-13:
 * *"miltanks rollout needs to just play the game out on medicham and have it match showdown perfectly
 * thats the whole point. miltanks just chooses the actions."* That makes the SEED the only place a
 * correct simulator can still produce a wrong game, so every approximation on it is a defect rather
 * than a tradeoff. Four were closed on 2026-08-13; the sweep that followed found five more, and this
 * file is the gate for the one of them that was fixed on 2026-08-14.
 *
 * ROADMAP #271, THE DEFECT, IN THE SHAPE IT WAS MEASURED IN:
 *
 *     declare Life Orb -> noteItem('p1','garchomp','') ->
 *        board.sheetItem  = ''          (correct)
 *        slot.item        = 'lifeorb'   (stale)
 *        dmgMon(...).item = 'lifeorb'   <- what MAG scores with AND what every playout gets
 *
 * `board.switchIn` COPIED the sheet's item onto the slot object at switch-in; `board.noteItem` — the
 * one thing `|-item|`/`|-enditem|` reaches — wrote only `itemNow`; and `sheetItem()` was the sole
 * reader of `itemNow`. So a Life Orb, a Choice Scarf, an eaten Sitrus Berry and a spent Focus Sash
 * all kept applying, in the damage AND the speed numbers MAG scores with and in every seeded playout.
 * This is CLAUDE.md's own **PREFER OBSERVED OVER DECLARED** broken in the place that lesson was
 * written about.
 *
 * FIVE READERS WERE FOUND BY THE SWEEP AND ALL FIVE ARE ARMED HERE, because finding a reader after
 * the fix means measuring twice:
 *
 *   1  the SLOT object itself                       board.switchIn's copy
 *   2  dmgMon                                       every damage feature MAG scores with
 *   3  monSpeedMult                                 the Choice Scarf x1.5 — CLAUDE.md's own example
 *   4  rollout_leaf.sideTeam / sideFallen           the BENCHED body the playout synthesises
 *   5  board.js benchRisk's foe-bench bodies        built straight off `board.sheet`
 *
 * NOTHING HERE IS TYPED FROM MEMORY. The damage-changing item is found by PROBING the regulation's
 * own item list through the engine's `dmgRange` until one moves the number; the speed-changing item
 * is found the same way through `Dex`'s own `onModifySpe` handler. A test that named Life Orb or
 * Choice Scarf would still pass if the engine stopped reading either.
 *
 * RED PROOF, taken before a byte of the fix existed: **12 passed, 9 failed** — every failure one of
 * the five readers holding an item the game removed, and EVERY CONTROL GREEN in the same run, which
 * is what says the file cannot pass by simply emptying every item.
 *
 * THE OTHER FOUR ROWS OF THE SWEEP ARE **REPORTED, NOT ASSERTED** — see section 2. #267, #268, #269
 * and #270 are open and were deliberately not taken in the same pass as #271, so that #271's result
 * is attributable on its own. A red row nobody is fixing in this pass is the "KNOWN FAILURE" shape
 * this repository bans by name, so they are `note` lines rather than `ok` lines.
 */
'use strict';
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
const CS = require(D('engine', 'champions_sim.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));   // the ONE door into MC.mons — see that file
/* MC.mons does not cover the whole format, so a body with no row is a real answer, not an error. */
const NO_ROW = { mayMiss: 'MC.mons does not cover the whole format; a species with no row has no dataset four' };
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); }
};
const note = (msg, extra) => console.log('  note ' + msg + (extra ? '   ' + extra : ''));

console.log('\ntest-seed-residue — a knocked-off item is gone from every reader (ROADMAP #271)\n');

/* ---------------------------------------------------------------------------------------------
 * THE POPULATION, DERIVED — the same construction tests/test-rollout-seed.js uses.
 * ------------------------------------------------------------------------------------------ */
const nrm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* EVERY PROBE THAT THREW IS RECORDED, NOT DISCARDED. This file DERIVES its fixture -- the species
 * pool, the damage-changing item, the speed-changing item, the responsive attacker/defender pair --
 * by probing the regulation, and a probe that throws is a legitimate skip. It is also exactly the
 * shape tests/test-no-silent-failure.js exists to stop: a swallowed reason and a plausible default.
 * So each one names what it was probing and why it failed, and the tail of the run prints the list. */
const probeSkips = [];
const why = e => (e && e.message) || String(e);
const legalSpecies = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const legalItem = x => x && x.exists && !x.isNonstandard;
const BUILDABLE = (mcKey.keys(NO_ROW) || [])
  .filter(id => legalSpecies(dex.species.get(id)))
  .filter(id => { try { return !!MEDI.buildMon(id); } catch (e) { probeSkips.push('buildMon ' + id + ': ' + why(e)); return false; } });
ok(BUILDABLE.length >= 12, 'the fixture pool is buildable AND legal in this regulation',
  `${BUILDABLE.length} species`);

const FIELD = { weather: null, weatherT: 0, terrain: '', terrainT: 0, twA: 0, twB: 0, tr: 0,
                gravity: 0, sgA: {}, sgB: {} };
const zero = () => ({ fainted: 0, unbuildable: 0, threw: 0 });
const MINE = BUILDABLE.slice(0, 6), THEIRS = BUILDABLE.slice(6, 12);

function baseBoard() {
  const bd = new B.Board();
  bd.setParty('p1', MINE); bd.setParty('p2', THEIRS);
  return bd;
}
const sheetOf = (item, moves) => ({ nature: 'Serious', item: item || '', ability: '', moves: moves || [] });

/* ---------------------------------------------------------------------------------------------
 * 1. THE FIVE READERS.
 * ------------------------------------------------------------------------------------------ */
const ATT = MINE[0], DEF = THEIRS[0];
const HITMV = ((mcKey.row(ATT, NO_ROW) || {}).mv || []).map(nrm)
  .find(id => globalThis.MC.moves[id] && (globalThis.MC.moves[id].bp | 0) > 0);
ok(!!HITMV, 'the attacker has a damaging move in its own dataset row', String(HITMV));

/* DERIVED, NOT NAMED: the first legal item whose presence changes this attacker's damage. */
const dmgWith = item => {
  const a = MEDI.buildMon(ATT, {}); a.item = item; a._sf = { fainted: 0, side: 'A', sc: {} };
  const d = MEDI.buildMon(DEF, {}); d._sf = { fainted: 0, side: 'B', sc: {} };
  return MEDI.dmgRange(a, d, globalThis.MC.moves[HITMV], FIELD, false).max;
};
const BASE_DMG = dmgWith('');
const ALL_ITEMS = dex.items.all().filter(legalItem).map(i => i.id).sort();
const DMG_ITEM = ALL_ITEMS.find(id => {
  try { return dmgWith(id) !== BASE_DMG; } catch (e) { probeSkips.push('dmgRange with ' + id + ': ' + why(e)); return false; }
});
ok(!!DMG_ITEM, 'a damage-changing item is DERIVED by probing the regulation through dmgRange',
  `${DMG_ITEM} -> ${DMG_ITEM ? dmgWith(DMG_ITEM) : '-'} vs bare ${BASE_DMG}`);

/* AND A SPEED-CHANGING ONE, because CLAUDE.md's own sentence names the SPEED calculation beside the
 * damage one: *"the damage and speed calculations keep applying an Assault Vest, Choice Scarf or Life
 * Orb that is gone"*. Derived from the dex's own onModifySpe handler, never named. */
const SPE_ITEM = ALL_ITEMS.find(id => {
  const it = dex.items.get(id);
  if (!it || typeof it.onModifySpe !== 'function') return false;
  try {
    const got = it.onModifySpe.call({ chainModify: v => 100 * (Array.isArray(v) ? v[0] / v[1] : v) },
      100, { hasItem: () => false, getItem: () => ({}), hasAbility: () => false, volatiles: {},
             side: {}, status: '', species: { name: ATT }, effectiveWeather: () => '' });
    return typeof got === 'number' && got > 0 && got !== 100;
  } catch (e) { probeSkips.push('onModifySpe ' + id + ': ' + why(e)); return false; }
});
ok(!!SPE_ITEM, 'a speed-changing item is DERIVED from the dex\'s own onModifySpe handler',
  String(SPE_ITEM));

{
  const board = baseBoard();
  board.setSheet('p1', ATT, sheetOf(DMG_ITEM, [HITMV]));
  board.switchIn('p1', 'a', ATT); board.switchIn('p1', 'b', MINE[1]);
  board.switchIn('p2', 'a', DEF); board.switchIn('p2', 'b', THEIRS[1]);

  const slot = board.slot('p1', 'a');
  ok(nrm(slot.item) === nrm(DMG_ITEM),
    'CONTROL — with no item event the slot still holds what the sheet declared',
    `slot.item '${slot.item}'`);
  const beforeBody = B.dmgMon(slot, MEDI, dex);
  ok(!!beforeBody && nrm(beforeBody.item) === nrm(DMG_ITEM),
    'CONTROL — and dmgMon builds it with that item, so this fix cannot invent a change',
    beforeBody ? `'${beforeBody.item}'` : '-');

  /* THE KNOCK OFF. One call — the same one `|-enditem|` makes. */
  board.noteItem('p1', ATT, '');
  ok(board.sheetItem('p1', ATT) === '', 'the board already knew: sheetItem says the item is gone',
    `'${board.sheetItem('p1', ATT)}'`);

  /* READER 1 — the slot object. */
  ok(nrm(board.slot('p1', 'a').item) === '',
    'READER 1 (#271) — the SLOT no longer holds an item the game removed',
    `slot.item '${board.slot('p1', 'a').item}'`);

  /* READER 2 — dmgMon, which is what MAG scores with and what every playout body is built by. */
  const afterBody = B.dmgMon(board.slot('p1', 'a'), MEDI, dex);
  ok(!!afterBody && nrm(afterBody.item) === '',
    'READER 2 (#271) — dmgMon builds the body WITHOUT the item',
    afterBody ? `'${afterBody.item}'` : '-');

  const d = MEDI.buildMon(DEF, {}); d._sf = { fainted: 0, side: 'B', sc: {} };
  if (afterBody) afterBody._sf = { fainted: 0, side: 'A', sc: {} };
  const dmgAfter = afterBody ? MEDI.dmgRange(afterBody, d, globalThis.MC.moves[HITMV], FIELD, false).max : -1;
  ok(dmgAfter === BASE_DMG,
    'READER 2 (#271) — and the DAMAGE is the bare-handed damage, not the item\'s',
    `${dmgAfter} vs bare ${BASE_DMG} vs held ${dmgWith(DMG_ITEM)}`);

  /* THE SEED. The playout body gets the same answer. */
  const A = RL.buildSide(board, 'p1', dex, zero());
  const seeded = A.find(m => m && nrm(m.name) === nrm(ATT));
  ok(!!seeded && nrm(seeded.item) === '',
    'READER 2 (#271) — and the seeded playout body is holding nothing either',
    seeded ? `'${seeded.item}'` : '-');

  /* READER 4 — the BENCH. `sideTeam` passed the SHEET's item straight through. */
  const BEN = MINE[2];
  board.setSheet('p1', BEN, sheetOf(DMG_ITEM, []));
  board.noteItem('p1', BEN, '');
  const row = RL.sideTeam(board, 'p1', dex).find(m => nrm(m.species) === nrm(BEN));
  ok(!!row && nrm(row.item || '') === '',
    'READER 4 (#271) — a BENCHED body whose item was removed is synthesised without it',
    row ? `'${row.item}'` : 'ABSENT');

  /* AND THE CONTROL FROM THE OTHER DIRECTION: an untouched benched body keeps its declared item, so
   * the fix cannot pass by simply emptying every item. */
  board.setSheet('p1', MINE[3], sheetOf(DMG_ITEM, []));
  const keptRow = RL.sideTeam(board, 'p1', dex).find(m => nrm(m.species) === nrm(MINE[3]));
  ok(!!keptRow && nrm(keptRow.item || '') === nrm(DMG_ITEM),
    'CONTROL — a benched body with no item event still carries its declared item',
    keptRow ? `'${keptRow.item}'` : 'ABSENT');

  /* AND A CLOSED SHEET STAYS CLOSED. `undefined` means "no sheet", and dmgMon keeps buildMon's
   * dataset guess for it — collapsing that into '' would silently strip the item off every
   * closed-sheet body, which is a NEW bug wearing the shape of this fix. */
  const noSheet = RL.sideTeam(board, 'p2', dex).find(m => nrm(m.species) === nrm(THEIRS[2]));
  ok(!!noSheet && noSheet.item === undefined,
    'CONTROL — a body with NO sheet still passes `undefined`, not \'\', so the dataset guess stands',
    noSheet ? String(noSheet.item) : 'ABSENT');
}

/* THE TRICK DIRECTION: an item GAINED mid-battle must reach the same readers. Its own board. */
{
  const tb = baseBoard();
  tb.setSheet('p1', ATT, sheetOf('', [HITMV]));
  tb.switchIn('p1', 'a', ATT); tb.switchIn('p1', 'b', MINE[1]);
  tb.switchIn('p2', 'a', DEF); tb.switchIn('p2', 'b', THEIRS[1]);
  ok(nrm(tb.slot('p1', 'a').item) === '',
    'CONTROL — a body the sheet declares itemless starts with nothing', `'${tb.slot('p1', 'a').item}'`);
  tb.noteItem('p1', ATT, DMG_ITEM);
  ok(nrm(tb.slot('p1', 'a').item) === nrm(DMG_ITEM),
    'READER 1 (#271) — an item GAINED mid-battle (Trick, Symbiosis) reaches the same readers',
    `slot.item '${tb.slot('p1', 'a').item}'`);
  const trickBody = B.dmgMon(tb.slot('p1', 'a'), MEDI, dex);
  ok(!!trickBody && nrm(trickBody.item) === nrm(DMG_ITEM),
    'READER 2 (#271) — and dmgMon prices the body with the item it is now holding',
    trickBody ? `'${trickBody.item}'` : '-');
}

/* READER 3 — THE SPEED. CLAUDE.md names the speed calculation beside the damage one, and it is a
 * genuinely different code path: `monSpeedMult` reads `mon.item` and asks the DEX's own
 * `onModifySpe`. The observable is the whole feature vector through `featuresFor`, so nothing
 * internal is poked and a `movesFirst` that flips shows up as a real scoring difference.
 *
 * THE FIXTURE IS SEARCHED FOR, NOT NAMED. A Choice Scarf only moves `movesFirst` when it actually
 * flips the order, so the first attacker/defender pair whose vector responds to the item is found by
 * probing — the same construction the DERIVED item above uses, one level up. A hardcoded pair would
 * go silently inert the day the dataset's speeds moved. */
{
  const speVec = (att, def, item, knock) => {
    const bd = new B.Board();
    bd.setParty('p1', [att, MINE[1], MINE[2]]); bd.setParty('p2', [def, THEIRS[1], THEIRS[2]]);
    const mv = ((mcKey.row(att, NO_ROW) || {}).mv || []).map(nrm)
      .find(id => globalThis.MC.moves[id] && (globalThis.MC.moves[id].bp | 0) > 0);
    if (!mv) return null;
    bd.setSheet('p1', att, sheetOf(item, [mv]));
    bd.switchIn('p1', 'a', att); bd.switchIn('p1', 'b', MINE[1]);
    bd.switchIn('p2', 'a', def); bd.switchIn('p2', 'b', THEIRS[1]);
    if (knock) bd.noteItem('p1', att, '');
    const u = bd.slot('p1', 'a');
    const cs = B.candidates(u.moves, u, bd, 'p1', dex) || [];
    const c = cs.find(x => x.move && nrm(x.move.id) === nrm(mv) && x.targetMon);
    if (!c) return null;
    return B.featuresFor(c, u, bd, 'p1', dex, B.PRIOR_FLOOR);
  };
  const differs = (a, b) => a && b && a.some((v, i) => v !== b[i]);
  let SA = null, SD = null, moved = null;
  const POOL = BUILDABLE.filter(sp => !MINE.includes(sp) && !THEIRS.includes(sp));
  search:
  for (let i = 0; i < 80 && i < POOL.length; i++) {
    for (let j = 0; j < 80 && j < POOL.length; j++) {
      if (i === j) continue;
      let v0, v1;
      try { v0 = speVec(POOL[i], POOL[j], '', false); v1 = speVec(POOL[i], POOL[j], SPE_ITEM, false); }
      catch (e) { probeSkips.push('speed pair ' + POOL[i] + '/' + POOL[j] + ': ' + why(e)); continue; }
      if (differs(v0, v1)) {
        SA = POOL[i]; SD = POOL[j];
        moved = v0.map((v, k) => v !== v1[k] ? B.FEATURES[k] : null).filter(Boolean);
        break search;
      }
    }
  }
  ok(!!SA, 'CONTROL — a pair whose SCORING responds to the speed item is found by probing',
    SA ? `${SA} vs ${SD}: ${moved.join(',')}` : 'none in the searched pool');
  if (SA) {
    const bare = speVec(SA, SD, '', false);
    const held = speVec(SA, SD, SPE_ITEM, false);
    const knocked = speVec(SA, SD, SPE_ITEM, true);
    ok(differs(bare, held), 'CONTROL — holding the speed item scores differently from holding nothing',
      moved.join(','));
    ok(!differs(bare, knocked),
      'READER 3 (#271) — a body whose SPEED item was knocked off scores exactly as bare-handed',
      differs(bare, knocked) ? 'STILL DIFFERS — monSpeedMult is holding the item' : 'identical to bare');
  }
}

/* READER 5 — benchRisk's foe-bench bodies were built straight off `board.sheet`, bypassing the
 * observed item entirely, so a benched foe whose Sash was knocked off was still priced as holding it.
 *
 * THE ITEM IS DERIVED CHEAPLY: `clickFragility` is a survival question, so the shortlist is the items
 * that change how much of THIS attack THAT bench body survives, probed through `dmgRange` rather than
 * through the whole feature vector. If none of them moves the feature on this fixture there is nothing
 * to assert and that is REPORTED, not passed silently. */
{
  const BEN = THEIRS[2];
  const survWith = item => {
    const a = MEDI.buildMon(ATT, {}); a._sf = { fainted: 0, side: 'A', sc: {} };
    const b = MEDI.buildMon(BEN, {}); b.item = item; b._sf = { fainted: 0, side: 'B', sc: {} };
    return MEDI.dmgRange(a, b, globalThis.MC.moves[HITMV], FIELD, false).max;
  };
  const SURV_BASE = survWith('');
  const SHORTLIST = ALL_ITEMS.filter(id => {
    try { return survWith(id) !== SURV_BASE; } catch (e) { probeSkips.push('bench survival ' + id + ': ' + why(e)); return false; }
  });
  const mk = (foeBenchItem, knockedOff) => {
    const bd = baseBoard();
    bd.setSheet('p1', ATT, sheetOf('', [HITMV]));
    bd.setSheet('p2', BEN, sheetOf(foeBenchItem, []));
    bd.switchIn('p1', 'a', ATT); bd.switchIn('p1', 'b', MINE[1]);
    bd.switchIn('p2', 'a', DEF); bd.switchIn('p2', 'b', THEIRS[1]);
    if (knockedOff) bd.noteItem('p2', BEN, '');
    const u = bd.slot('p1', 'a');
    const cs = B.candidates(u.moves, u, bd, 'p1', dex) || [];
    const c = cs.find(x => x.move && nrm(x.move.id) === nrm(HITMV) && x.targetMon);
    if (!c) return null;
    return B.featuresFor(c, u, bd, 'p1', dex, B.PRIOR_FLOOR)[B.FEATURE_INDEX.benchRisk];
  };
  const bare = mk('', false);
  const MOVER = (bare == null) ? null
    : SHORTLIST.find(id => {
      try { return mk(id, false) !== bare; } catch (e) { probeSkips.push('benchRisk ' + id + ': ' + why(e)); return false; }
    });
  if (MOVER == null) {
    note('READER 5 (#271) — NO ASSERTION on this fixture: none of the ' + SHORTLIST.length +
      ' survival-changing items moves benchRisk here, so there is no observable to assert. The ' +
      'foe-bench body is routed through the same sheetItem() call by construction; that is stated in ' +
      'docs/SEARCH.md as a construction rather than claimed as tested.', `benchRisk bare ${bare}`);
  } else {
    ok(mk(MOVER, false) !== bare, 'CONTROL — a foe BENCH item moves benchRisk at all',
      `${MOVER}: ${mk(MOVER, false)} vs bare ${bare}`);
    ok(mk(MOVER, true) === bare,
      'READER 5 (#271) — a foe BENCH body whose item was knocked off prices as bare-handed',
      `knocked ${mk(MOVER, true)} vs bare ${bare}`);
  }
}

/* ---------------------------------------------------------------------------------------------
 * 2. WHAT IS STILL WRONG, REPORTED RATHER THAN ASSERTED — the same convention section 6 of
 * tests/test-rollout-seed.js uses. #267/#268/#269/#270 were deliberately NOT taken in this pass so
 * that #271's result is attributable on its own, and a red row nobody is fixing is the "KNOWN
 * FAILURE" shape this repository bans by name.
 * ------------------------------------------------------------------------------------------ */
{
  note('CLOSED 2026-08-14 — #267, #268, #269 and #270 were the other four rows of this sweep:',
    'the gate for all four is tests/test-seed-clock.js and the prevalence is ' +
    'data/rollout-clock-prevalence.json, over the same 14,288 games / 192,912 decision points as ' +
    'the item scan beside it. #269 is closed in PART — Taunt, Encore and Disable are seeded; the ' +
    'choice lock, Substitute, Leech Seed and the perish count are declared unseeded with a reason');
  note('OPEN — the OFFLINE board never sees an item event at all (PRIORITIES 13e):',
    '`noteItem` has exactly one caller, engine/magnemite.js, so in the FIT a declared item stands ' +
    'for the whole game. #271 fixes the READER; the missing offline EVENT is MEASURE\'s row');
  note('OPEN — the store records no item CONSUMPTION:',
    'a spent Focus Sash and an eaten berry emit |-enditem| live and nothing offline, so every ' +
    'store-derived prevalence for #271 is a FLOOR');
}

/* THE PROBES SPEAK. A run in which the whole regulation threw would otherwise look identical to a
 * run in which every probe succeeded, and it is the derivation that makes this file's fixtures
 * honest -- so the skips are printed rather than merely counted. */
if (probeSkips.length) {
  console.log(`\n  ${probeSkips.length} derivation probe(s) threw and were skipped:`);
  for (const m of probeSkips.slice(0, 8)) console.log('    - ' + m);
  if (probeSkips.length > 8) console.log(`    ... and ${probeSkips.length - 8} more`);
} else {
  console.log('\n  no derivation probe threw');
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
