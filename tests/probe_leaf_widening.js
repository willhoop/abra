/* probe_leaf_widening.js — CAN THE BOARD COMPARATOR SEE THESE LEAVES AT ALL?
 *
 *   SHOWDOWN_PATH=... node tests/probe_leaf_widening.js
 *
 * WHY THIS EXISTS (2026-09-04). `tests/probe_uncompared_leaves.js` derives that the comparator reads
 * 34 of the 80 leaves a legal mechanic in this format can write, and that 22 of the 46 it does not
 * read CAN BE STANDING when the board is sampled. A game whose only disagreement lives in one of
 * those 22 is scored as AGREEING, because nothing looked. This probe is the falsifier for three of
 * them, taken in the order of their writers' corpus uses:
 *
 *   volatile:throatchop     move:throatchop           5,577 uses
 *   volatile:unburden       ability:unburden          5,036 uses
 *   volatile:mustrecharge   6 moves, hyperbeam 4,576  4,701 uses
 *
 * TWO ARMS PER LEAF, AND NEITHER IS EVIDENCE WITHOUT THE OTHER.
 *
 *   CONTROL   a real staged game in which both engines hold the leaf with the same value. The
 *             widened comparator must report NOTHING on it. Without this arm a widened comparator
 *             has only been made noisy.
 *   RED       the identical game with the leaf CORRUPTED on medicham2's live state at the boundary,
 *             through the driver's own `statePlant` hook — the same hook `probe_red_demo.js` uses,
 *             applied to the ENGINE and not to the snapshot, so the plant travels through the reader.
 *             The comparator must report `…vol.<leaf>`. THIS ARM IS RED BEFORE THE WIRING AND GREEN
 *             AFTER IT; a comparison that has never been shown catching anything is not evidence.
 *
 * THE PLANT IS NOT A CLAIM ABOUT THE ENGINE. It is the only way to make a leaf differ on demand
 * without editing a simulator that is otherwise correct on it. What it proves is exactly the thing in
 * question: that a difference ON THIS LEAF now reaches the board comparison. Whether the two engines
 * ever DO differ here is the whole-game differential's question, not this one's.
 *
 * UNBURDEN IS AN OBSERVE ARM AND NOT A WIRING, AND THE REASON IS PRINTED RATHER THAN ASSERTED.
 * medicham2 holds NO state under that name: the doubling is recomputed inside `effSpeed` from
 * `_hadItem && !m.item` (engine/medicham2-browser.js:14770), which is TRUE FOR EVERY BODY THAT LOST
 * AN ITEM whatever its ability, where the authority's volatile is added only by Unburden's own
 * `onAfterUseItem` / `onTakeItem` (pokemon-showdown/data/abilities.ts:5229-5234). Comparing the two
 * would part every board on which anybody's Focus Sash broke. The arm prints both engines' raw state
 * so the omission is DECLARED on measured evidence instead of on an argument.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const BS = require(D('engine', 'board_state.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));

/* A LEGAL CARRIER, DERIVED FROM THE FORMAT'S OWN LEARNSETS. `.all()` is the National Dex wearing the
 * format's name (CLAUDE.md), so every walk is filtered, and a fixture built on a set the validator
 * would refuse measures nothing. */
const legalSp = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPECIES = dex.species.all().filter(legalSp).filter(s => !s.forme || !/mega/i.test(s.forme));
/* NOT SILENT. A learnset lookup that THROWS and a species with no learnset are two different facts,
 * and collapsing them into one quiet skip is how a fixture search silently narrows to nothing and
 * then reports COULD-NOT-STAGE as if it were a claim about the mechanic. Every throw is counted and
 * the totals print with the verdict, so a shrinking carrier pool shows up as a number. */
let LS_THREW = 0;
const learnsetOf = (id) => {
  try { return dex.species.getLearnsetData(id); }
  catch (e) { LS_THREW++; return null; }
};
function carrierOf(moveId, pred) {
  for (const s of SPECIES) {
    if (pred && !pred(s)) continue;
    const ls = learnsetOf(s.id);
    if (ls && ls.learnset && ls.learnset[moveId]) return s;
    let p = s.prevo, guard = 0;
    while (p && guard++ < 3) {
      const pid = N.id(p);
      const pl = learnsetOf(pid);
      if (pl && pl.learnset && pl.learnset[moveId]) return s;
      const ps = dex.species.get(pid); p = ps && ps.prevo;
    }
  }
  return null;
}
const hasAbility = id => s => Object.values(s.abilities || {}).some(a => dex.abilities.get(a).id === id);
/* n DISTINCT legal carriers of one move — the Unburden arm needs two Knock Offs in one turn and the
 * Species Clause forbids the same body twice. */
function carriersOf(moveId, n) {
  const out = [];
  for (const s of SPECIES) {
    const ls = learnsetOf(s.id);
    if (ls && ls.learnset && ls.learnset[moveId]) out.push(s);
    if (out.length >= n) break;
  }
  return out;
}
/* A SINGLE-TARGET ATTACK THIS BODY CAN ACTUALLY LEARN, DERIVED. The Unburden arm needs the carrier to
 * NOT click Protect — a shield blocks the Knock Off that is the whole fixture — and the repo's inert
 * move (Recycle) would put the item back. Charge, recharge and multi-target moves are excluded so the
 * click resolves inside one turn and hits one slot. First match in learnset order, so it is stable. */
function anyAttack(sp) {
  const ls = learnsetOf(sp.id);
  if (!ls) return null;
  for (const id of Object.keys((ls && ls.learnset) || {})) {
    const mv = dex.moves.get(id);
    if (!mv || !mv.exists || mv.isNonstandard) continue;
    if (mv.category === 'Status' || !(mv.basePower > 0)) continue;
    if (mv.flags && (mv.flags.charge || mv.flags.recharge)) continue;
    if (mv.self && mv.self.volatileStatus) continue;
    if (mv.target !== 'normal') continue;
    if (mv.accuracy !== true && mv.accuracy < 100) continue;
    return mv;
  }
  return null;
}

const FILLER = ['clefable', 'milotic', 'corviknight'];
const bench = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

/* THE RAW READ, OUT OF BOTH ENGINES, PRINTED BEFORE ANY VERDICT. `_vol` is the one table medicham2
 * keys by the authority's own spelling; everything else it keeps in a named field, so the named
 * fields are read by name and the list is printed rather than described. */
function rawMedi(S) {
  const out = [];
  for (const m of [...(S.actA || []), ...(S.actB || [])].filter(Boolean)) {
    const bits = [];
    for (const k of Object.keys(m._vol || {})) if (m._vol[k]) bits.push(k + '=' + JSON.stringify(m._vol[k]));
    for (const k of ['_noSound', '_recharge', '_hadItem', '_roomItem', 'item'])
      if (m[k] !== undefined && m[k] !== null && m[k] !== false && m[k] !== 0 && m[k] !== '')
        bits.push(k + '=' + JSON.stringify(m[k]));
    out.push(N.id(m.name) + '{' + bits.join(' ') + '}');
  }
  return out.join(' ');
}
function rawSd(battle) {
  const out = [];
  for (const side of battle.sides) for (const p of side.active) {
    if (!p) continue;
    const bits = [];
    for (const [k, v] of Object.entries(p.volatiles || {}))
      bits.push(k + (v && v.duration != null ? '(d' + v.duration + ')' : ''));
    if (p.item) bits.push('item=' + p.item);
    out.push(p.species.id + '{' + bits.join(' ') + '}');
  }
  return out.join(' ');
}

/* ---- THE THREE FIXTURES -------------------------------------------------------------------------
 * `boundary` is the index of the boundary at which the leaf is expected to be STANDING. Both leaves
 * with a clock are `duration: 2` in the authority and are decremented once by the residual of the
 * turn that applied them (sim/battle.ts:514-521), so the answer is the boundary that CLOSES the turn
 * they were applied on. The driver takes a boundary before turn 1 as well, so that is index 1 — read
 * off the printed boundary list rather than assumed, and every boundary is printed. */
const CASES = [];

{ /* THROAT CHOP — data/moves.ts:19391 `condition: { duration: 2, … }`, applied by a 100%-chance
   * secondary `onHit` (data/moves.ts:19424). Champions overrides no `throatchop` key in
   * data/mods/champions/{moves,conditions}.ts, so mainline's entry is what this format runs.
   * medicham2 holds it in `_noSound` (medicham2-browser.js:33473, ticked at :36936). */
  const sp = carrierOf('throatchop');
  CASES.push({ leaf: 'throatchop', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts:19391-19420 (condition, duration 2)',
    ours: 'engine/medicham2-browser.js:33473 `_noSound`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Throat Chop', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'throatchop', t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    /* THE PLANT CLEARS THE LOCK ON THE VICTIM — p2 slot 0, the body Throat Chop was aimed at. */
    plant: (S) => { const t = (S.actB || [])[0]; if (t) t._noSound = 0; },
    held: (S, battle) => ({ medi: ((S.actB || [])[0] || {})._noSound | 0,
                            sd: (((battle.sides[1].active[0] || {}).volatiles || {}).throatchop || {}).duration }) });
}

{ /* MUST RECHARGE — data/conditions.ts:364 `mustrecharge: { duration: 2, … }`, applied as
   * `self: { volatileStatus: 'mustrecharge' }` on each of the six recharge moves. Champions overrides
   * no `mustrecharge` key. medicham2 holds it as the boolean `_recharge` (medicham2-browser.js:34724),
   * read back on the next turn at :24494.
   *
   * THE SCRIPT IS ONE TURN LONG, AND THAT IS THE FIXTURE ADAPTING TO THE AUTHORITY RATHER THAN A
   * SHORTCUT. `onLockMove: 'recharge'` replaces the whole request on the following turn, so a scripted
   * `protect` — and a scripted `hyperbeam`, which is equally not on the request — both fall through
   * `scripted()`'s not-on-request road to `pass`, and Showdown rejects the pass outright
   * (`Can't pass: Your Venusaur must make a move`). Two earlier versions of this fixture died there.
   * The leaf stands at the boundary that CLOSES the Hyper Beam turn, which is the board this
   * comparator reads and the last one the script needs. */
  const sp = carrierOf('hyperbeam');
  CASES.push({ leaf: 'mustrecharge', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/conditions.ts:364-378 (duration 2)',
    ours: 'engine/medicham2-browser.js:34724 `_recharge`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Hyper Beam', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'hyperbeam', t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    /* THE PLANT CLEARS THE RECHARGE ON THE USER — p1 slot 0. */
    plant: (S) => { const t = (S.actA || [])[0]; if (t) t._recharge = false; },
    held: (S, battle) => ({ medi: ((S.actA || [])[0] || {})._recharge ? 1 : 0,
                            sd: (((battle.sides[0].active[0] || {}).volatiles || {}).mustrecharge || {}).duration }) });
}

{ /* UNBURDEN — OBSERVE ONLY, AND THE FIXTURE IS BUILT TO SHOW THE OVER-MATCH RATHER THAN TO ARGUE IT.
   * data/abilities.ts:5227-5249. TWO bodies lose an item to a Knock Off in the same turn: slot 0
   * CARRIES Unburden, slot 1 does not. The authority puts the volatile on one of them; medicham2's
   * stand-in (`_hadItem && !item`) is true for BOTH, because it reads the slot and not the ability.
   * A presence comparison between those two shapes parts every board on which anybody's item goes.
   *
   * NEITHER BODY MAY CLICK PROTECT — a shield blocks the Knock Off, which is what made the first
   * version of this fixture report an item still in hand at every boundary. Both click a derived
   * single-target attack instead. */
  const sp = SPECIES.find(hasAbility('unburden'));
  const plain = SPECIES.find(s => s.id !== (sp && sp.id) && !hasAbility('unburden')(s)
    && !hasAbility('stickyhold')(s) && anyAttack(s));
  const ko = carriersOf('knockoff', 2);
  const atk0 = sp && anyAttack(sp), atk1 = plain && anyAttack(plain);
  const ok = sp && plain && ko.length === 2 && atk0 && atk1;
  CASES.push({ leaf: 'unburden', carrier: sp, boundary: 1, observeOnly: true,
    authority: 'pokemon-showdown/data/abilities.ts:5227-5249 (no duration; onEnd removes it)',
    ours: 'NO NAMED STATE — recomputed in effSpeed from `_hadItem && !m.item` (:14770)',
    p1: ok && [{ species: N.id(sp.id), item: 'Sitrus Berry', ability: 'Unburden', moves: [atk0.name, 'Protect'] },
               { species: N.id(plain.id), item: 'Sitrus Berry', ability: '', moves: [atk1.name, 'Protect'] },
               ...bench(FILLER[1], FILLER[2])],
    p2: ok && [{ species: N.id(ko[0].id), item: '', ability: '', moves: ['Knock Off', 'Protect'] },
               { species: N.id(ko[1].id), item: '', ability: '', moves: ['Knock Off', 'Protect'] },
               ...bench(FILLER[1], FILLER[2])],
    script: [{ p1: [{ m: N.id(atk0 && atk0.id), t: 0 }, { m: N.id(atk1 && atk1.id), t: 1 }],
               p2: [{ m: 'knockoff', t: 0 }, { m: 'knockoff', t: 1 }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }],
    plant: null,
    held: (S, battle) => {
      const stand = m => (m && m._hadItem && !m.item) ? 1 : 0;
      const vol = p => (p && (p.volatiles || {}).unburden) ? 1 : 0;
      return { medi: '[' + stand((S.actA || [])[0]) + ',' + stand((S.actA || [])[1]) + ']',
               sd: '[' + vol(battle.sides[0].active[0]) + ',' + vol(battle.sides[0].active[1]) + ']' };
    } });
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const LEAFRE = leaf => new RegExp('\\.vol\\.' + leaf + '$');
function runArm(c, plant) {
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { err: 'COULD NOT BUILD THE PAIR' };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'leafwiden/' + c.leaf + (plant ? '/red' : '/control'), {
    script: c.script,
    statePlant: plant ? ((S, battle, turnIdx) => { if (turnIdx === c.boundary) plant(S); }) : undefined,
    onBoundary: (snap, turnIdx, S, battle) => {
      boards.push({ turnIdx, held: c.held(S, battle), raw_medi: rawMedi(S), raw_sd: rawSd(battle),
                    onLeaf: snap.diffs.filter(d => LEAFRE(c.leaf).test(d.path)),
                    nDiffs: snap.diffs.length,
                    otherPaths: snap.diffs.filter(d => !LEAFRE(c.leaf).test(d.path)).map(d => d.path) });
    } });
  return { err: r && r.err, boards };
}

console.log('\n  LEAF WIDENING — CONTROL AND RED, PER LEAF');
console.log('  compared keys today: ' + BS.SD_VOLATILE_KEYS.length + ' per-body volatiles\n');

let fail = 0, red = 0;
for (const c of CASES) {
  console.log('  ---- volatile:' + c.leaf);
  console.log('       authority  ' + c.authority);
  console.log('       ours       ' + c.ours);
  if (!c.carrier || !c.p1 || !c.p2) { console.log('       NO LEGAL CARRIER — a claim about the fixture, not the mechanic'); fail++; continue; }
  console.log('       carrier    ' + c.carrier.name);
  console.log('       in the comparator: ' + (BS.SD_VOLATILE_KEYS.includes(c.leaf) ? 'YES' : 'no')
    + '        declared in NOT_COMPARED: ' + (BS.DECLARED_LEAVES.has('volatile:' + c.leaf) ? 'YES' : 'no'));

  const ctl = runArm(c, null);
  if (ctl.err) { console.log('       CONTROL THREW: ' + ctl.err); fail++; continue; }
  for (const b of ctl.boards)
    console.log('       b' + b.turnIdx + '  medi=' + JSON.stringify(b.held.medi) + ' sd=' + JSON.stringify(b.held.sd)
      + '   diffs=' + b.nDiffs + (b.onLeaf.length ? '  ON THIS LEAF: ' + b.onLeaf.map(d => d.path).join(',') : ''));
  console.log('       raw medi   ' + (ctl.boards[c.boundary] || {}).raw_medi);
  console.log('       raw sd     ' + (ctl.boards[c.boundary] || {}).raw_sd);

  const bd = ctl.boards[c.boundary];
  if (!bd) { console.log('       NO BOUNDARY ' + c.boundary + ' — the fixture, not the mechanic'); fail++; continue; }
  if (c.observeOnly) {
    console.log('       OBSERVE ONLY — no wiring is asserted for this leaf. See the header.');
    continue;
  }
  const bothHold = bd.held.medi && bd.held.sd;
  if (!bothHold) {
    console.log('       ONE-SIDED OR ABSENT AT b' + c.boundary + ' — medi=' + JSON.stringify(bd.held.medi)
      + ' sd=' + JSON.stringify(bd.held.sd) + '  (a claim about the FIXTURE until it is fixed)');
    fail++;
  }

  /* CONTROL ARM: the widened comparator must say NOTHING about this leaf on a board where it agrees. */
  const ctlClean = ctl.boards.every(b => b.onLeaf.length === 0);
  console.log('       CONTROL  ' + (ctlClean ? 'PASS — no difference reported on this leaf' : 'FAIL — the leaf parted on an agreeing board'));
  if (!ctlClean) fail++;

  /* RED ARM: the same game with medicham2's own field corrupted at the boundary. */
  const rd = runArm(c, c.plant);
  if (rd.err) { console.log('       RED THREW: ' + rd.err); fail++; continue; }
  const caught = (rd.boards[c.boundary] || { onLeaf: [] }).onLeaf;
  console.log('       RED      ' + (caught.length
    ? 'PASS — caught ' + caught.map(d => d.path + ' ' + JSON.stringify(d.a) + '<>' + JSON.stringify(d.b)).join(', ')
    : 'RED — the plant was INVISIBLE to the comparator (' + (rd.boards[c.boundary] || {}).nDiffs + ' diffs, none on this leaf)'));
  if (!caught.length) { red++; fail++; }
}

console.log('');
if (red) console.log('  ' + red + ' leaf(s) NOT COMPARED — a planted difference on them reached the board and nothing looked.');
/* THE FIXTURE SEARCH REPORTS ITS OWN FAILURES, because a COULD-NOT-STAGE verdict is a claim about the
 * FIXTURE and never about the mechanic. A learnset lookup that threw would silently shrink the carrier
 * pool, and a pool that shrank to nothing reads exactly like a mechanic that cannot be staged. Printed
 * unconditionally rather than only when non-zero: a counter nobody reads is the defect this session
 * found 783 instances of, and a zero here is the evidence that the search was clean. */
console.log('  learnset lookups that threw during the fixture search: ' + LS_THREW
  + (LS_THREW ? '  <- the carrier pool is NARROWER than the format, so a COULD-NOT-STAGE below is'
      + ' a statement about this search and NOT about the mechanic' : ''));
console.log(fail ? '  FAIL — ' + fail + ' arm(s) did not hold.' : '  PASS — every arm held.');
process.exit(fail ? 1 : 0);
