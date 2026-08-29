/* probe_uncompared_leaves.js — EVERY LEAF A LEGAL MECHANIC WRITES, AGAINST WHAT THE BOARD READS.
 *
 * WHY THIS EXISTS (2026-08-28). `board_state.js` already says the thing this measures: *"an unlisted
 * omission reads exactly like agreement."* Its answer to that was `NOT_COMPARED`, a hand-written list
 * of the omissions somebody thought to write down — and twice in one night a mechanic's verdict turned
 * out to be unearned because the leaf it writes was in NEITHER place, neither compared nor declared:
 *
 *   volatile:smackdown   found while diagnosing an airborne gate. The board claim had to be moved onto
 *                        a different volatile that IS compared, and any ANNOUNCEMENT-ONLY verdict on
 *                        the original was worth nothing.
 *   volatile:gastroacid  the narration batch checked and failed — `uncomparable_leaves:
 *                        ["volatile:gastroacid"]`, `core_leaf_unchecked: true`. That row is blocked on
 *                        THE INSTRUMENT, not on the engine.
 *
 * `all_mechanics_fire.js` computes exactly this per row and has since 2026-08-19 — but only for the
 * rows a run happens to STAGE, and only loudly when the row came back ANNOUNCEMENT-ONLY. So the
 * question "how many leaves are in neither list" had never been asked of the whole class. THIS ASKS
 * THE WHOLE CLASS, and it is a derivation rather than a sample: every legal move, every ability with a
 * legal carrier, every legal item.
 *
 * IT SHARES ITS DERIVATION WITH THE INSTRUMENT IT AUDITS. `writtenLeaves` / `uncomparableLeavesOf`
 * moved into `board_state.js` in the same pass and BOTH callers use them; the move was proved
 * behaviour-identical over all 964 entities (0 disagreements, 81 non-empty answers) before it landed.
 * A second copy of "which leaf does this mechanic write" is the two-copies-of-one-fact breach.
 *
 * IT IS A PROBE AND NOT A GATE, DELIBERATELY. The hole is 43 leaves wide today; a gate registered at
 * that number would be RED on the day it was written, and "KNOWN FAILURE" is a banned phrase here.
 * What it prints is the work list, ranked, with the evidence each classification rests on.
 *
 *   node tests/probe_uncompared_leaves.js            the split, and the hole
 *   node tests/probe_uncompared_leaves.js --json     the same as an object
 *   require(...).derive()                           the same numbers, for a reporter
 *
 * THE `derive()` EXPORT EXISTS SO THE GATE'S COVERAGE LINE IS NOT A SECOND COPY OF THIS (2026-08-28).
 * `engine/status.js` prints "leaves compared / leaves comparable" and it calls THIS function to get
 * it. The alternative — status.js recomputing the split from `board_state.js` directly — is exactly
 * the two-producers-of-one-fact breach that made the closed-row detector disagree with itself on 24
 * of 292 rows in both directions. The CLI below is a renderer over `derive()` and holds no arithmetic
 * of its own, so the printed split and the reported split cannot part.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
const BS = require(D('engine', 'board_state.js'));
const CS = require(D('engine', 'champions_sim.js'));

/* THE WHOLE DERIVATION, INSIDE A FUNCTION AND NOT AT LOAD. A reporter that requires this file must
 * not pay for the dex walk unless it asks, and — the reason that matters today — `medicham2-browser.js`
 * is read here while ENGINE is editing it. A read that throws must fail the CALLER'S coverage line,
 * not the require that preceded it. */
function derive() {
  const { Dex } = CS.sim();
  const dex = Dex.forFormat(CS.FORMAT);

  /* ---- THE POPULATION, FILTERED EVERY TIME ----------------------------------------------------
   * `.all()` is the National Dex wearing the format's name (CLAUDE.md). Moves and items are filtered on
   * `isNonstandard`; ABILITIES ARE FILTERED ON A CARRIER, because an ability no legal species has cannot
   * write a leaf in this format however legal the ability object looks. Unfiltered, the ability walk
   * reports 316 abilities and adds five leaves that nothing in this regulation can produce. */
  const legalSp = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const legal = x => x && x.exists && !x.isNonstandard;
  const CARRIED = new Set();
  for (const s of dex.species.all().filter(legalSp))
    for (const k of Object.keys(s.abilities || {})) CARRIED.add(dex.abilities.get(s.abilities[k]).id);
  const POP = { move: dex.moves.all().filter(legal),
                ability: dex.abilities.all().filter(x => legal(x) && CARRIED.has(x.id)),
                item: dex.items.all().filter(legal) };

  /* ---- EVERY LEAF, AND WHO WRITES IT ---------------------------------------------------------- */
  const leaves = new Map();
  for (const kind of ['move', 'ability', 'item']) for (const e of POP[kind]) {
    const w = BS.writtenLeaves(e);
    const add = (klass, set) => { for (const v of set) {
      const key = klass + ':' + v;
      if (!leaves.has(key)) leaves.set(key, { key, klass, name: v, writers: [] });
      leaves.get(key).writers.push(kind + ':' + e.id); } };
    add('volatile', w.volatile); add('sideCondition', w.side);
    add('slotCondition', w.slot); add('pseudoWeather', w.pseudo);
  }
  const COMPARED = new Set(BS.SD_VOLATILE_KEYS.map(k => 'volatile:' + k)
    .concat(BS.SD_SIDE_KEYS.map(k => 'sideCondition:' + k))
    .concat(BS.SD_PSEUDO_KEYS.map(k => 'pseudoWeather:' + k)));

  /* ---- WHAT THE AUTHORITY DECLARES ABOUT A CONDITION'S LIFETIME -------------------------------
   * `duration: 1` is decremented by `residualEvent` and ENDED there (sim/battle.ts:1097-1115, whose
   * handler carries `end: pokemon.removeVolatile`), so it cannot be standing at the boundary this
   * comparator takes — which is after the whole residual phase.
   *
   * THIS IS EVIDENCE AND NOT PROOF, AND THE DIFFERENCE IS THE POINT. A DECLARED duration is what the
   * entry says; a condition with no declared clock may still be removed inside the turn by its own move
   * (Sparkling Aria's is), and one with a clock may have it rewritten in `onStart`. The falsifier is a
   * staged boundary read of both engines, which is what `tests/probe_volatile_leaves.js` does one leaf
   * at a time. Nothing here should be wired on this column alone. */
  function lifetime(name) {
    const c = dex.conditions.getByID(name);
    const resolved = !!(c && Object.keys(c).length > 2);
    const d = c && c.duration;
    return { resolved, duration: d == null ? null : d,
             gone_at_the_boundary: d === 1,
             residual: !!(c && typeof c.onResidual === 'function') };
  }
  /* ---- AND WHETHER OUR ENGINE HOLDS ANYTHING UNDER THAT NAME ----------------------------------
   * STRUCTURAL, NOT A NAME GREP: `_vol.<name>` is the one table medicham2 keys by the authority's own
   * spelling, so a hit here means the two engines can be asked the same question. A MISS IS NOT
   * EVIDENCE OF ABSENCE — this engine keeps `partiallytrapped` in `_trap`, the hard trap in `_trapHard`
   * and the rampage lock in `_mtLock`, none of which this test can see. It is printed to rank the cheap
   * wirings first, never to conclude that a mechanic is missing. */
  const MEDI_SRC = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const MEDI_VOL = new Set([...MEDI_SRC.matchAll(/_vol\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1].toLowerCase()));

  const rows = [...leaves.values()].map(r => ({ ...r,
    compared: COMPARED.has(r.key),
    declared: BS.DECLARED_LEAVES.has(r.key),
    life: lifetime(r.name),
    ours_vol: MEDI_VOL.has(r.name) }));
  rows.sort((a, b) => (b.writers.length - a.writers.length) || a.key.localeCompare(b.key));
  const hole = rows.filter(r => !r.compared && !r.declared);

  /* A DERIVATION THAT READS NOTHING WOULD REPORT A HOLE OF ZERO — the most comfortable possible answer
   * and a completely silent one. Asserted rather than assumed, exactly as board_state.js asserts its
   * own key derivation at load. It THROWS rather than exiting, because a library that calls
   * process.exit takes its caller's report down with it. */
  if (!rows.length || !COMPARED.size) {
    const e = new Error('NOT RUN — the leaf derivation read NOTHING. A hole of 0 here would be a '
      + 'silent default, not a clean bill.');
    e.leafDerivationEmpty = true;
    throw e;
  }

  /* ---- THE CEILING, NOT THE TOTAL -------------------------------------------------------------
   * `total` is every leaf a legal mechanic can write. It is NOT the widening target, and reading it as
   * one is the mistake this block exists to stop: a reader who sees `34 of 80` assumes 80 is reachable.
   * It is not. The comparator samples at a TURN BOUNDARY only (`boundaryCallSites()` below reads that
   * off the driver rather than asserting it), and a condition the authority has already ended by then
   * can never be standing when the board is read. Two independent reasons, both derived:
   *
   *   duration 1              `residualEvent` decrements and ENDS it (sim/battle.ts:1097-1115), and
   *                           the boundary is taken AFTER the whole residual phase.
   *   self-removed in-action  no declared clock at all, and a handler on `onUpdate` / `onAfterMove`
   *                           removes the condition by its own name before the action returns.
   *
   * These are EVIDENCE, not proof, and the difference is the point — a leaf whose clock is rewritten
   * in `onStart` would be misclassified here. The falsifier is a staged boundary read of both engines
   * (`tests/probe_volatile_leaves.js`), one leaf at a time. Nothing should be WIRED on this column
   * alone; it is here so that the ceiling is stated instead of the total. */
  const holeDur1 = hole.filter(r => r.life.gone_at_the_boundary);
  const selfRemoved = [], selfRemoveGuarded = [];
  const standing = hole.filter(r => !r.life.gone_at_the_boundary).filter(r => {
    const w = selfRemovesWithinAction(dex, r.name);
    if (!w.length) return true;
    if (r.life.duration != null) { selfRemoveGuarded.push({ key: r.key, where: w, duration: r.life.duration }); return true; }
    selfRemoved.push({ key: r.key, where: w });
    return false;
  });
  const compared = rows.filter(r => r.compared).length;

  return { population: { move: POP.move.length, ability: POP.ability.length, item: POP.item.length },
           rows, hole,
           compared,
           declared: rows.filter(r => r.declared).length,
           total: rows.length,
           /* the honest widening target: the hole minus the leaves the authority ends in the
            * residual, which cannot be standing when this comparator reads a turn boundary */
           standing_at_the_boundary: standing.length,
           standing_keys: standing.map(r => r.key),
           hole_duration1: holeDur1.map(r => r.key),
           self_removed_within_action: selfRemoved,
           self_remove_guarded_by_declared_clock: selfRemoveGuarded,
           /* THE NUMBER A COVERAGE LINE MUST QUOTE. `compared` plus everything that can still be
            * standing when the comparator looks. Everything else is permanently uncomparable AT THIS
            * BOUNDARY — a statement about the sampling point, not about the mechanic. */
           ceiling: compared + standing.length,
           dead_leaves: [...COMPARED].filter(k => !leaves.has(k)).length };
}

/* ---- IS THIS LEAF REMOVED INSIDE ITS OWN ACTION? -----------------------------------------------
 * MOVED HERE FROM `tests/probe_leaf_name_map.js` ON 2026-08-29 so the rule has ONE producer. That file
 * computed it and `derive()` did not, so the two published different ceilings — 58 against 56 — which
 * is the two-producers-of-one-fact breach that made the closed-row detector disagree with itself on 24
 * of 292 rows in both directions. The name-map probe now calls this.
 *
 * Derived from the AUTHORITY's own entry, never from a list: a handler that calls `removeVolatile` /
 * `delete pokemon.volatiles[...]` on the leaf's own name, hung on a hook that runs INSIDE the action,
 * ends the condition before any boundary.
 *
 * AND IT OVER-MATCHED, SO THE GUARD IS SAID OUT LOUD. The first version caught `lockedmove` — whose
 * `onAfterMove` is `if (this.effectState.duration === 1) pokemon.removeVolatile('lockedmove')`, a
 * CONDITIONAL removal at the end of a real 2-turn clock — and would have dropped a rampage lock out of
 * the widening target on the strength of a `removeVolatile` appearing in a handler. A DECLARED CLOCK
 * WINS: the caller applies this only to a condition that declares no duration at all, and the rows the
 * guard rescued are RETURNED rather than dropped. */
const WITHIN_ACTION_HOOKS = ['onUpdate', 'onAfterMove'];
function selfRemovesWithinAction(dex, name) {
  const seen = [];
  const scan = (e, where) => {
    if (!e) return;
    for (const h of WITHIN_ACTION_HOOKS) {
      const f = e[h];
      if (typeof f !== 'function') continue;
      const s = String(f);
      if (s.includes('removeVolatile("' + name + '")') || s.includes("removeVolatile('" + name + "')")
        || s.includes('volatiles["' + name + '"]') || s.includes("volatiles['" + name + "']"))
        seen.push(where + '.' + h);
    }
  };
  const mv = dex.moves.get(name);
  if (mv && mv.exists) { scan(mv, 'move:' + name); scan(mv.condition, 'move:' + name + '.condition'); }
  const it = dex.items.get(name);
  if (it && it.exists) { scan(it, 'item:' + name); scan(it.condition, 'item:' + name + '.condition'); }
  scan(dex.conditions.getByID(name), 'condition:' + name);
  return seen;
}

/* ---- WHERE THE BOARD IS ACTUALLY SAMPLED, READ OFF THE DRIVER ----------------------------------
 * ALSO MOVED FROM `probe_leaf_name_map.js`, 2026-08-29, same reason. The ceiling above rests entirely
 * on the claim "the comparator only reads at a turn boundary", and that claim holds only while
 * `BS.snapshot` has exactly one caller. A second sampling point anywhere in the tree would make some
 * of the leaves excluded above reachable after all — so it is COUNTED on every run rather than
 * remembered, and a caller that reports the ceiling must report this beside it. */
function boundaryCallSites() {
  const gd = fs.readFileSync(D('engine', 'game_differential.js'), 'utf8');
  const snapshot_calls = [...gd.matchAll(/BS\.snapshot\(/g)].length;
  const statecheck_call_lines = [...gd.matchAll(/\bstateCheck\(/g)]
    .map(m => gd.slice(0, m.index).split('\n').length);
  const other_snapshot_callers = [];
  for (const dir of ['engine', 'tests']) for (const f of fs.readdirSync(D(dir))) {
    if (!f.endsWith('.js') || (dir === 'engine' && f === 'game_differential.js')) continue;
    const src = fs.readFileSync(D(dir, f), 'utf8');
    if (/\bBS\.snapshot\s*\(|board_state[^\n]*\)\.snapshot\s*\(/.test(src))
      other_snapshot_callers.push(dir + '/' + f);
  }
  return { snapshot_calls, statecheck_call_lines, other_snapshot_callers };
}

module.exports = { derive, selfRemovesWithinAction, boundaryCallSites };
if (require.main !== module) return;

const JSONOUT = process.argv.includes('--json');
let R;
try { R = derive(); }
catch (e) {
  if (e && e.leafDerivationEmpty) { console.error(e.message); process.exit(2); }
  throw e;
}
const { population: POPN, rows, hole } = R;

if (JSONOUT) { console.log(JSON.stringify({ population: POPN, rows }, null, 1)); process.exit(0); }

const pad = (s, n) => String(s).padEnd(n);
console.log('  POPULATION  ' + POPN.move + ' moves, ' + POPN.ability
  + ' abilities carried by a legal species, ' + POPN.item + ' items');
console.log('  LEAVES THEY WRITE   ' + R.total
  + '      COMPARED ' + R.compared
  + '   DECLARED ' + R.declared
  + '   NEITHER ' + hole.length);
console.log('');
console.log('  A LEAF IN NEITHER LIST IS A HOLE THE GATE CANNOT SEE: the board agrees on it by not');
console.log('  looking, and an ANNOUNCEMENT-ONLY verdict on a mechanic whose whole effect IS that leaf');
console.log('  is an unasked question wearing a clean row\'s clothes.');
console.log('');
const boundary = R.standing_at_the_boundary;
console.log('  Of the ' + hole.length + ', the authority declares a duration of 1 on '
  + (hole.length - boundary) + ' — those are ended in the residual (sim/battle.ts:1097-1115)');
console.log('  and cannot be standing at this comparator\'s boundary. The other ' + boundary
  + ' have no declared');
console.log('  clock or a clock of 2+ turns, so they ARE on the board when it is read.');
console.log('');
console.log('  ' + pad('LEAF', 30) + pad('W', 4) + pad('dur', 5) + pad('_vol', 6) + 'writers');
for (const r of hole) {
  console.log('  ' + pad(r.key, 30) + pad(r.writers.length, 4)
    + pad(r.life.duration == null ? '-' : r.life.duration, 5)
    + pad(r.ours_vol ? 'yes' : '.', 6)
    + r.writers.slice(0, 4).join(' ') + (r.writers.length > 4 ? '  +' + (r.writers.length - 4) : ''));
}
console.log('');
console.log('  DECLARED, with the row that declares each (board_state.js NOT_COMPARED):');
for (const r of rows.filter(x => x.declared)) console.log('    ' + r.key);
console.log('');
console.log('  Every key the comparator reads is written by at least one legal mechanic: '
  + R.dead_leaves + ' dead leaves.');
