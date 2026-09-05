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
 *   volatile:flashfire      ability:flashfire         1,416 uses   (added 2026-09-04)
 *
 * Every one of those counts is read out of `data/tags.json` at the entity's own row, never typed.
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
 * UNBURDEN IS AN OBSERVE ARM AND NOT A WIRING, AND WHAT IT OBSERVES IS THE ENGINE'S OWN SPEED.
 * medicham2 holds no state under that name. It applies the doubling inside `effSpeed`, gated on
 * `TAGS.param('ability', m.ability, 'speedOnItemLoss')` — a param `data/tags.json` grants to exactly
 * ONE ability (`n: 1`, `examples: ["Unburden"]`, read out of the artifact at run time and printed
 * below, never typed) — nested inside an entry guard `m._hadItem && !m.item`. So the arm ASKS THE
 * ENGINE for the number, twice per body: once as the body stands, and once on a delegating clone with
 * the item-loss input cleared. The difference between those two readings IS the doubling, computed by
 * `effSpeed` rather than restated here. The authority half is read the same way, from its own function:
 * `getStat('spe', false, false)` against `getStat('spe', false, true)`, modified against unmodified.
 *
 * WHAT THIS PARAGRAPH SAID UNTIL 2026-09-04, AND WHY IT WAS FALSE — THE ERROR IS THE THING TO KEEP.
 * It said the doubling was "TRUE FOR EVERY BODY THAT LOST AN ITEM whatever its ability", and that
 * comparing the leaf "would part every board on which anybody's Focus Sash broke". That claim was
 * published in CHANGELOG 5.245.0, in a commit message, in seven living documents, and was reported to
 * the owner as fact. It is wrong, and the mechanism was in the ROW BELOW rather than in the engine:
 * the `stand` predicate recomputed `_hadItem && !m.item` — THE ENTRY GUARD, which sits OUTSIDE the
 * gated block — and compared that against the authority's volatile. It never read `effSpeed` at all.
 * Its `[1,1]` therefore only ever said "both of these bodies have lost an item", which is true of any
 * body that lost one and says nothing whatsoever about Unburden. The `ours:` label named the entry
 * guard as if it were the doubling, which is how the reading survived being looked at.
 *
 * A PROBE MUST ASSERT ON WHAT THE ENGINE COMPUTED, NEVER ON A VALUE IT RECOMPUTES ALONGSIDE. A row
 * that declines to answer is correct; a row that answers a question it was not asked is what this cost.
 *
 * WHAT THE REPAIRED ARM STILL DOES NOT MEASURE, NAMED RATHER THAN LEFT AS AN ABSENCE. `effSpeed`
 * consults the body's ability AT READ TIME, where the authority grants a volatile AT THE MOMENT THE
 * ITEM IS LOST — so an Unburden ACQUIRED AFTER the hand empties doubles here and not there. This arm
 * measures that asymmetry on the ENGINE'S HALF ONLY, by re-asking `effSpeed` for the plain body with
 * the carrier's own ability spelling on a clone. The AUTHORITY'S half needs a body that gains the
 * ability mid-battle (Skill Swap), which this fixture does not stage, so the row prints ENGINE HALF
 * ONLY and the defect stays INSTRUMENT OWED.
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

/* ---- THE ENGINE'S OWN SPEED FUNCTION, OUT OF THE SAME FROZEN RELEASE THE GAME IS PLAYED ON -------
 *
 * `G.REL` is the release `game_differential.js` opened, so this is the SNAPSHOT'S `effSpeed` and not
 * the live file's — the value read is the value the game was played with, whatever ENGINE is doing to
 * the working tree while this runs. `need:` makes an aged-out release refuse by name at load instead
 * of throwing `M.effSpeed is not a function` deep inside a boundary callback (CLAUDE.md §releases).
 * A release that cannot serve it is a fact about the SNAPSHOT and the row below says COULD-NOT-MEASURE
 * rather than falling back on anything. */
const MEDI = G.REL.require('engine/medicham2-browser.js', { need: ['effSpeed'] });

/* THE ONE CARRIER, READ OUT OF THE ARTIFACT THAT GATES THE ENGINE. `effSpeed` doubles on
 * `TAGS.param('ability', m.ability, 'speedOnItemLoss')`; this is that param's own row, so the count
 * printed with the arm is derived from the same table the engine consults. Never typed. */
const UB_TAG = (require(D('data', 'tags.json')).tags || []).find(t => t.tag === 'speedOnItemLoss') || null;

/* A COUNTERFACTUAL IS BUILT BY CLEARING ONE INPUT, NEVER BY RESTATING A CONDITION. `Object.create(m)`
 * delegates every read to the real body — `st`, `boosts`, `item`, `ability`, `_roomItem`, `_sf` — so
 * the ONLY thing that differs between the two readings is the field named here, and neither reading
 * mutates the live board the rest of the game is played from. */
const withField = (m, k, v) => { const o = Object.create(m); o[k] = v; return o; };

/* NOT A SILENT CATCH. A throw out of either engine's speed function is COUNTED, its message is kept,
 * and the row it belongs to reports COULD-NOT-MEASURE — because a swallowed throw here would show up
 * as a body whose speed did not change, which is indistinguishable from a body the doubling did not
 * apply to. That is exactly the confusion this whole file is being repaired for. */
let SPE_THREW = 0, SPE_FIRST = '';
function speThrew(where, why) { SPE_THREW++; if (!SPE_FIRST) SPE_FIRST = where + ': ' + why; return { err: where + ' THREW: ' + why }; }
function mediSpe(m, field, side) {
  try { return { v: MEDI.effSpeed(m, field, side) }; } catch (e) { return speThrew('effSpeed', e.message); }
}
function sdSpe(p, unmodified) {
  try { return { v: p.getStat('spe', false, unmodified) }; } catch (e) { return speThrew('getStat spe', e.message); }
}
const mult = (live, cleared) => (cleared > 0 ? 'x' + (Math.round((live / cleared) * 100) / 100) : 'x?');

/* THE ENGINE'S READING FOR ONE BODY: what it says now, and what it says with the item-loss input
 * cleared. Both numbers come out of `effSpeed`. */
function mediReading(m, field, side) {
  if (!m) return { err: 'NO BODY IN THIS SLOT' };
  const a = mediSpe(m, field, side); if (a.err) return { err: a.err };
  const b = mediSpe(withField(m, '_hadItem', false), field, side); if (b.err) return { err: b.err };
  return { live: a.v, cleared: b.v, doubled: a.v !== b.v ? 1 : 0, mult: mult(a.v, b.v), ability: m.ability };
}
/* THE AUTHORITY'S READING FOR ONE BODY, FROM ITS OWN FUNCTION: `getStat('spe')` modified against
 * unmodified. `unmodified` skips the `ModifySpe` event, which is where Unburden's condition lives
 * (data/abilities.ts:5238-5244) — so the difference is every speed modifier standing on that body.
 * The fixture carries no Tailwind, no weather, no Choice Scarf and no status, and the plain slot is
 * the control that SHOWS that: if anything other than Unburden were modifying speed here, the plain
 * body would not read x1. */
function sdReading(p) {
  if (!p) return { err: 'NO BODY IN THIS SLOT' };
  const a = sdSpe(p, false); if (a.err) return { err: a.err };
  const b = sdSpe(p, true); if (b.err) return { err: b.err };
  return { live: a.v, cleared: b.v, doubled: a.v !== b.v ? 1 : 0, mult: mult(a.v, b.v) };
}

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

/* A SINGLE-TARGET FIRE ATTACK AND A LEGAL BODY THAT LEARNS IT, DERIVED — nothing here is typed. The
 * move is the first legal Fire attack in the dex's own order that resolves inside one turn, hits one
 * slot and cannot miss; the carrier is the first legal species whose learnset holds it. Flash Fire
 * bodies are excluded because the authority's `onTryHit` only absorbs when `target !== source`, and
 * the bench fillers are excluded because Species Clause forbids the same body twice on one team. */
function fireAttackAndCarrier(exclude) {
  for (const mv of dex.moves.all().filter(m => m.exists && !m.isNonstandard)) {
    if (mv.type !== 'Fire' || mv.category === 'Status' || !(mv.basePower > 0)) continue;
    if (mv.flags && (mv.flags.charge || mv.flags.recharge)) continue;
    if (mv.target !== 'normal') continue;
    if (mv.accuracy !== true && mv.accuracy < 100) continue;
    const sp = carrierOf(mv.id, s => !hasAbility('flashfire')(s) && !exclude.has(s.id));
    if (sp) return { mv, sp };
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
  /* THE FIELD AND THE SLOT RECORDS, ADDED 2026-09-05 WITH BATCH 3. The two shapes this file learned in
   * that batch live nowhere near `_vol`, and a raw dump that showed only bodies would print an
   * identical line for a Gravity that is up and one that is not — the silent agreement this whole file
   * exists to make impossible. READ, NEVER CREATED: medicham2's own `slotCondOf` INSTALLS an empty map
   * on the side object, and its comment records 51 unrelated moves "moving" the first time a reader
   * did that. `(sf && sf.slot) || {}` reads and writes nothing. */
  { const F = S.field || {};
    const fb = [];
    for (const k of ['gravity', 'magicRoom', 'wonderRoom', 'tr', 'fairylock']) if (F[k]) fb.push(k + '=' + F[k]);
    if (fb.length) out.push('field{' + fb.join(' ') + '}'); }
  for (const [nm, sf] of [['A', S.sfA], ['B', S.sfB]]) {
    const sl = (sf && sf.slot) || {};
    for (const i of Object.keys(sl)) if (sl[i])
      out.push('slot' + nm + i + '{' + sl[i].mv + ' when=' + sl[i].when + ' due=' + sl[i].due + '}');
  }
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
  { const pw = (battle.field || {}).pseudoWeather || {};
    const fb = Object.keys(pw).map(k => k + (pw[k] && pw[k].duration != null ? '(d' + pw[k].duration + ')' : ''));
    if (fb.length) out.push('field{' + fb.join(' ') + '}'); }
  for (const side of battle.sides) for (let i = 0; i < (side.slotConditions || []).length; i++)
    for (const k of Object.keys(side.slotConditions[i] || {})) out.push('slot' + side.id + i + '{' + k + '}');
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

{ /* FLASH FIRE — pokemon-showdown/data/abilities.ts:1331-1368, read whole. The ability's `onTryHit`
   * refuses a Fire move and calls `addVolatile('flashfire')`; the CONDITION declares no duration at
   * all (`noCopy: true`, `onStart`, two `onModify` hooks and an `onEnd`), so presence is the whole of
   * the leaf on the authority's side and comparing it as presence collapses nothing. Champions
   * overrides no `flashfire` key in any of the eight files under data/mods/champions/, so mainline is
   * what this format runs. medicham2 keys it in `_vol.flashfire` — the one table it spells the
   * authority's way — written by `absorbGift` (medicham2-browser.js:16158) off the tag's own
   * `typeImmunity.gain.volatile`, and removed with the ability at :19465.
   *
   * THE CARRIER MAY NOT CLICK PROTECT: a shield refuses the Fire move and there is then nothing to
   * absorb, which is the same trap the Unburden fixture fell into on its first version. It clicks a
   * derived single-target attack at the FOE'S PARTNER, which IS shielding — so the fixture cannot end
   * early on a knockout and the Fire move's user is still standing to throw it. */
  const ff = SPECIES.find(s => hasAbility('flashfire')(s) && !FILLER.includes(s.id) && anyAttack(s));
  const fire = ff && fireAttackAndCarrier(new Set([ff.id, ...FILLER]));
  const atk = ff && anyAttack(ff);
  const ok = !!(ff && fire && atk);
  const atkId = atk ? N.id(atk.id) : '', fireId = fire ? N.id(fire.mv.id) : '';
  CASES.push({ leaf: 'flashfire', carrier: ok ? ff : null, boundary: 1,
    authority: 'pokemon-showdown/data/abilities.ts:1331-1368 (condition, NO duration)',
    ours: 'engine/medicham2-browser.js:16158 `_vol.flashfire`',
    p1: ok && [{ species: N.id(ff.id), item: '', ability: 'Flash Fire', moves: [atk.name, 'Protect'] }].concat(bench(...FILLER)),
    p2: ok && [{ species: N.id(fire.sp.id), item: '', ability: '', moves: [fire.mv.name, 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: atkId, t: 1 }, { m: 'protect' }], p2: [{ m: fireId, t: 0 }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }],
    /* THE PLANT CLEARS THE ABSORBED GIFT ON THE CARRIER — p1 slot 0, the body that ate the Fire move. */
    plant: (S) => { const t = (S.actA || [])[0]; if (t && t._vol) delete t._vol.flashfire; },
    held: (S, battle) => ({ medi: (((S.actA || [])[0] || {})._vol || {}).flashfire ? 1 : 0,
                            sd: ((((battle.sides[0].active[0] || {}).volatiles) || {}).flashfire ? 1 : 0) }) });
}

{ /* UNBURDEN — OBSERVE ONLY ON THE WIRING, MEASURED ON THE MECHANIC.
   * data/abilities.ts:5227-5249. TWO bodies lose an item to a Knock Off in the same turn: slot 0
   * CARRIES Unburden, slot 1 does not. THAT IS THE TWO-ARM TEST THE OLD ROW HAD AND DID NOT USE:
   * slot 1 is a body WITHOUT the ability that loses its item, so under the old `_hadItem && !m.item`
   * predicate it read as a match, and under a reading taken from `effSpeed` it must not. Slot 0 is the
   * arm that must still register. Neither arm is evidence without the other.
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
    authority: 'pokemon-showdown/data/abilities.ts:5227-5249 (volatile granted on take/use; its'
             + ' condition onModifySpe chainModify(2))',
    /* THE LABEL NAMES WHAT IS ACTUALLY READ. It used to name `_hadItem && !m.item`, which is the ENTRY
     * GUARD and not the doubling — the gate is one line further in and reads the ability tag. Naming
     * the guard is how a reading of the guard passed for a reading of the mechanic. */
    ours: 'NO NAMED STATE — effSpeed applies TAGS.param(ability, speedOnItemLoss).speedMult inside an'
        + ' `_hadItem && !m.item` entry guard; this arm reads effSpeed itself, never the guard',
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
    /* EVERY NUMBER BELOW COMES OUT OF ONE OF THE TWO ENGINES' OWN SPEED FUNCTIONS. Nothing here
     * recomputes a condition: `mediReading` calls `effSpeed` twice and subtracts, `sdReading` calls
     * `getStat('spe')` twice and subtracts. */
    held: (S, battle) => {
      const rows = [0, 1].map(i => {
        const m = (S.actA || [])[i];
        return {
          medi: mediReading(m, S.field, 'A'),
          sd: sdReading(battle.sides[0].active[i]),
          who: N.id((m || {}).name || '?'),
          /* THE ENTRY GUARD, READ DELIBERATELY AND USED ONLY TO VALIDATE THE FIXTURE. Slot 1 is a
           * control only if it ACTUALLY lost its item; a Knock Off that failed would leave a body the
           * doubling could never reach, and its x1 below would then be true for the wrong reason. It
           * is also the RETIRED predicate, printed for contrast so the repair keeps proving itself.
           * Validating a fixture with it is legitimate; ANSWERING with it is what this cost. */
          lostItem: !!(m && m._hadItem && !m.item),
        };
      });
      /* ROADMAP #535, ENGINE HALF. Re-ask `effSpeed` for the PLAIN body — the one that has already
       * lost its item and never held Unburden — carrying the carrier's own ability spelling, taken off
       * slot 0's live body so the string is the engine's and not mine. If that clone doubles, the
       * engine's doubling is a function of the CURRENT ability rather than of a grant made when the
       * item went. The authority half is NOT staged here; see the header. */
      const ab0 = (((S.actA || [])[0]) || {}).ability;
      const m1 = (S.actA || [])[1];
      let acquired = { err: 'NOT ATTEMPTED — no carrier ability or no plain body at this boundary' };
      if (ab0 && m1) {
        const swapped = withField(m1, 'ability', ab0);
        const r = mediReading(swapped, S.field, 'A');
        acquired = r.err ? r : { ...r, ability: ab0, who: N.id(m1.name || '?') };
      }
      const show = k => '[' + rows.map(r => (r[k].err ? '?' : r[k].mult)).join(',') + ']';
      return { medi: show('medi'), sd: show('sd'), rows, acquired };
    },
    /* THE ROW'S OWN VERDICT. It is separate from the CONTROL/RED pair above because no plant is
     * possible on a leaf the comparator does not carry — but it is NOT free to pass: a disagreement
     * between the two engines' readings FAILS, and a reading either engine could not produce is
     * COULD-NOT-MEASURE and also FAILS. Green by not looking is the failure being repaired. */
    report: (bd) => {
      const L = [], rows = (bd.held && bd.held.rows) || [];
      L.push('       one carrier for this param in data/tags.json: n=' + (UB_TAG ? UB_TAG.n : '?')
        + '  ' + JSON.stringify(UB_TAG ? UB_TAG.examples : null) + '   (read from the artifact the engine gates on)');
      if (rows.length !== 2) return { lines: L.concat('       COULD-NOT-MEASURE — the fixture did not present two p1 bodies at this boundary'), fail: true };
      /* BOTH ARMS OR NEITHER. The claim needs a body WITH the ability and a body WITHOUT it that both
       * lost an item; if either Knock Off failed, this row measures nothing and must say so rather
       * than report an x1 that means "still holding". */
      if (!rows[0].lostItem || !rows[1].lostItem)
        return { lines: L.concat('       COULD-NOT-MEASURE — the fixture did not empty both hands at this'
          + ' boundary (' + rows.map(r => r.who + ' lostItem=' + (r.lostItem ? 1 : 0)).join(', ')
          + '). A claim about the FIXTURE, never about the mechanic.'), fail: true };
      L.push('       the RETIRED predicate — `_hadItem && !m.item`, the ENTRY GUARD — reads ['
        + rows.map(r => (r.lostItem ? 1 : 0)).join(',') + '] on these same two bodies: it calls the'
        + ' PLAIN body a match too. That is the reading that was published.');
      let bad = 0, unmeasured = 0;
      for (const r of rows) {
        if (r.medi.err || r.sd.err) {
          unmeasured++;
          L.push('       ' + r.who + '  COULD-NOT-MEASURE — ' + (r.medi.err || '') + ' ' + (r.sd.err || ''));
          continue;
        }
        const agree = r.medi.doubled === r.sd.doubled;
        if (!agree) bad++;
        L.push('       ' + r.who.padEnd(16)
          + ' effSpeed ' + r.medi.live + '<-' + r.medi.cleared + ' ' + r.medi.mult
          + '   getStat spe ' + r.sd.live + '<-' + r.sd.cleared + ' ' + r.sd.mult
          + '   ability=' + JSON.stringify(r.medi.ability)
          + '   ' + (agree ? 'AGREE' : 'DISAGREE'));
      }
      L.push('       ' + (unmeasured ? 'COULD-NOT-MEASURE on ' + unmeasured + ' of 2 bodies — this row makes NO claim'
        : bad ? 'MEASURED — the two engines DISAGREE on ' + bad + ' of 2 bodies'
        : 'MEASURED — the two engines agree on both bodies: the ability carrier doubles and the plain'
          + ' body that lost the same item does NOT. The old `_hadItem && !m.item` reading called both of'
          + ' these a match.'));
      /* THE RESIDUAL, PRINTED EVERY RUN. Agreement in one staged fixture is not a licence to stop
       * comparing: this leaf is still absent from the board comparator, so a divergence on it anywhere
       * else reaches the board and nothing looks. That is a statement of fact, not a failure of this
       * arm. */
      L.push('       STILL NOT COMPARED — `volatile:unburden` is not in SD_VOLATILE_KEYS, so a real'
        + ' divergence on this leaf is invisible to the board comparison wherever it happens.');
      const a = bd.held.acquired || {};
      L.push('       ROADMAP #535, ENGINE HALF ' + (a.err ? 'COULD-NOT-MEASURE — ' + a.err
        : ': ' + a.who + ' has already lost its item and never carried the ability; given ability='
          + JSON.stringify(a.ability) + ' on a clone, effSpeed reads ' + a.live + '<-' + a.cleared + ' ' + a.mult
          + ' -> the doubling follows the CURRENT ability' + (a.doubled ? '' : ' (it did NOT double — the engine half does not reproduce)')));
      L.push('       ROADMAP #535, AUTHORITY HALF NOT MEASURED — it needs a body that GAINS the ability'
        + ' after the item is gone (Skill Swap), which this fixture does not stage. The marker stays'
        + ' INSTRUMENT OWED.');
      return { lines: L, fail: !!(bad || unmeasured) };
    } });
}

/* ---- BATCH 2, 2026-09-05 — THREE MORE OF THE NINETEEN --------------------------------------------
 *
 * `tests/probe_uncompared_leaves.js` re-derived on this date: 80 leaves a legal mechanic in this
 * format can write, 37 compared, 4 declared, 39 in neither list — and of those 39 the authority ends
 * 18 in the residual (`duration: 1`) and 2 inside their own action (`fling`, `sparklingaria`), so
 * NINETEEN can be standing when this comparator reads a turn boundary. The three below are the three
 * of that nineteen this engine already keys under the authority's own spelling in `_vol` — which is
 * the cheap end, not the important end, and the header for each says what the engine actually HOLDS
 * rather than assuming the name implies a quantity. (Unburden above is the standing lesson: a leaf can
 * look wireable on every derived column and hold nothing at all.)
 *
 * CHAMPIONS OVERRIDES NONE OF THE THREE — checked, not assumed. `lockon`, `minimize` and `noretreat`
 * appear in `data/mods/champions/` ONLY in `learnsets.ts`; there is no key for any of them in
 * `moves.ts`, `conditions.ts`, `abilities.ts`, `items.ts`, `scripts.ts`, `formats-data.ts` or
 * `rulesets.ts`. So mainline `data/moves.ts` is the authority and the line numbers below are its. */

{ /* LOCK-ON — A CLOCK ON BOTH SIDES, COMPARED AS ONE.
   * data/moves.ts:10397-10426, read whole. `onTryHit` refuses a second application while one stands;
   * `onHit` does `source.addVolatile('lockon', target)` — THE USER HOLDS IT, which is the half a
   * careless fixture gets backwards — and the condition declares `noCopy: true, duration: 2`.
   * medicham2 keys it in `_vol.lockon` (medicham2-browser.js:29657 `a.kind==='lockon'`, written at the
   * `guaranteeVolatiles()` table's own volatile name) and ticks it in its own end-of-turn loop
   * (:38438). BOTH engines therefore hold 2 at application and 1 at the boundary that closes the
   * applying turn, and 0 at the next one — so the CLOCK is the comparison and nothing is collapsed.
   *
   * TURN 2 IS IN THE SCRIPT ON PURPOSE: it is the boundary where the counter runs out, and a clock
   * that only ever agrees on the turn it was written is not evidence that the two clocks run alike. */
  const sp = carrierOf('lockon');
  CASES.push({ leaf: 'lockon', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts:10397-10426 (condition, duration 2, held by the USER)',
    ours: 'engine/medicham2-browser.js:29657 `_vol.lockon`, ticked at :38438',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Lock-On', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'lockon', t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    /* THE PLANT CLEARS THE GUARANTEE ON THE USER — p1 slot 0, the body that clicked it. */
    plant: (S) => { const t = (S.actA || [])[0]; if (t && t._vol) delete t._vol.lockon; },
    held: (S, battle) => ({ medi: (((S.actA || [])[0] || {})._vol || {}).lockon | 0,
                            sd: ((((battle.sides[0].active[0] || {}).volatiles) || {}).lockon || {}).duration }) });
}

{ /* MINIMIZE — PRESENCE ON BOTH SIDES, AND NOTHING IS COLLAPSED.
   * data/moves.ts:11920-11951, read whole. The condition is `noCopy: true`, `onRestart: () => null`,
   * an `onSourceModifyDamage` and an `onAccuracy` — NO DURATION AT ALL. It is `target: 'self'` and
   * carries `boosts: { evasion: 2 }` beside the volatile, so the board's `boosts` leaf already
   * compares the other half of the move and this arm adds the half nothing looked at.
   * medicham2 reaches it through the composed-effect rider (medicham2-browser.js:26545 `_siRider`),
   * which calls `applyMoveVolatile` and lands on the generic write at :18787 — `_vol.minimize = 1`,
   * no clock, never ticked, because `minimize` is in neither `durationVolatiles()` (keyed off
   * `sealsMoves`) nor `guaranteeVolatiles()`. Presence against presence.
   *
   * THIS ENGINE DOES READ IT — :10540 and :12666, the `PUNISH_MINIMIZE_BLIND` sites that double a
   * minimize-flagged move's damage and make it never miss. So the leaf is not inert here; it is
   * simply never compared. */
  /* THE FILLERS ARE EXCLUDED FROM THE CARRIER SEARCH, and this is not tidiness. The first legal
   * `minimize` carrier in dex order IS Clefable, which is also `FILLER[0]` — so the unfiltered search
   * built a p1 of two Clefable, which Species Clause forbids. `buildPair` does not run the validator,
   * so the fixture played anyway and would have been an illegal team quietly measuring a legal claim. */
  const sp = carrierOf('minimize', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'minimize', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts:11920-11951 (condition, NO duration)',
    ours: 'engine/medicham2-browser.js:18787 `_vol.minimize` (generic write, bare 1)',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Minimize', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'minimize' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actA || [])[0]; if (t && t._vol) delete t._vol.minimize; },
    held: (S, battle) => ({ medi: (((S.actA || [])[0] || {})._vol || {}).minimize ? 1 : 0,
                            sd: ((((battle.sides[0].active[0] || {}).volatiles) || {}).minimize ? 1 : 0) }) });
}

{ /* NO RETREAT — PRESENCE ON BOTH SIDES.
   * data/moves.ts:12790-12822, read whole. `onTry` refuses a second application and DELETES the
   * volatile from the move when the user is already `trapped`; the condition declares no duration —
   * only an `onStart` line and an `onTrapPokemon` that calls `pokemon.tryTrap()`. `tryTrap` sets the
   * body's own `trapped` FLAG and adds no volatile, so the `trapped` leaf this comparator already
   * reads is untouched by this fixture and the two arms cannot be confused with each other.
   * medicham2 reaches it through the same composed rider as Minimize and lands on the same generic
   * write at :18787 — `_vol.noretreat = 1`, no clock. Presence against presence.
   *
   * medicham2-browser.js:26327 already cites this move's `onTry` refusal, so the second-click clause
   * is wired; this arm is about the LEAF being invisible to the board comparison, not about the move. */
  const sp = carrierOf('noretreat');
  CASES.push({ leaf: 'noretreat', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts:12790-12822 (condition, NO duration)',
    ours: 'engine/medicham2-browser.js:18787 `_vol.noretreat` (generic write, bare 1)',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['No Retreat', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'noretreat' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actA || [])[0]; if (t && t._vol) delete t._vol.noretreat; },
    held: (S, battle) => ({ medi: (((S.actA || [])[0] || {})._vol || {}).noretreat ? 1 : 0,
                            sd: ((((battle.sides[0].active[0] || {}).volatiles) || {}).noretreat ? 1 : 0) }) });
}

/* ---- BATCH 3, 2026-09-05 — THE WHOLE OF THE REMAINING SIXTEEN -----------------------------------
 *
 * `tests/probe_uncompared_leaves.js`, re-derived at the top of this batch: 500 legal moves, 201
 * abilities carried by a legal species, 148 legal items write EIGHTY leaves between them. FORTY are
 * read by the comparator, FOUR are declared in `NOT_COMPARED`, and of the thirty-six in neither list
 * the authority ends EIGHTEEN in the residual (`duration: 1`) and TWO inside their own action
 * (`fling`, `sparklingaria`). So SIXTEEN can be standing when the board is sampled and nothing looks
 * at them. This batch takes all sixteen.
 *
 * THEY ARE NOT ALL THE SAME SHAPE, and that is the reason this file needed a change before a single
 * fixture could be written. Nine are per-body volatiles (`.vol.<leaf>`); three are PSEUDO-WEATHERS,
 * which live on the field and which `readMedi` keeps as a `<name>_turns` clock; three are SLOT
 * CONDITIONS, which `board_state.js` did not read AT ALL — `uncomparableLeavesOf` carried the literal
 * comment *"this file reads no slot condition"* and there was no `SD_SLOT_KEYS` to read.
 *
 * WHAT THE ENGINE HOLDS WAS CHECKED FIRST, EVERY TIME, BEFORE ANY OF IT WAS WIRED. Unburden is the
 * standing lesson and it is IN this set: it passes every derived column and this engine holds NO state
 * under that name at all. Two of the sixteen come back as NOT WIREABLE and say why:
 *
 *   volatile:unburden    THE ENGINE HOLDS NOTHING. `effSpeed` recomputes the doubling from the
 *                        CURRENT ability inside a `_hadItem && !m.item` entry guard; there is no field
 *                        to read. Its arm above is OBSERVE-ONLY and measures the mechanic instead.
 *   volatile:powershift  NO LEGAL BODY CAN WRITE IT. Champions un-bans the MOVE
 *                        (data/mods/champions/moves.ts:739-742, `isNonstandard: null`) and then no
 *                        species in the regulation learns it — `powershift` appears in NEITHER
 *                        data/learnsets.ts NOR data/mods/champions/learnsets.ts, zero occurrences.
 *                        The row below DERIVES that carrier count on every run rather than asserting
 *                        it, and FAILS the moment a carrier appears, because at that point the leaf
 *                        becomes stageable and the absence of a fixture stops being a fact about the
 *                        regulation. `probe_uncompared_leaves.js` filters ABILITIES on a legal carrier
 *                        and MOVES only on `isNonstandard`, so this leaf is inside its ceiling of 56 —
 *                        the denominator is the authority's and is not adjusted here.
 *
 * CHAMPIONS OVERRIDES CHECKED PER LEAF, NOT ASSUMED. Of the sixteen, `data/mods/champions/` carries a
 * key for exactly three outside `learnsets.ts`: `dragoncheer` (moves.ts:241-244, FLAGS only — it gains
 * `sound`; the condition is mainline's), `metronome` (moves.ts:628-631, the MOVE is `isNonstandard:
 * "Past"` — the ITEM, which is what writes this leaf, carries no champions key and is legal) and
 * `powershift` (moves.ts:739-742, un-banned, no carrier). Every other line number below is mainline's
 * because mainline is what this format runs for them. */

/* A LEGAL BODY OF A GIVEN TYPE THAT CAN ATTACK, DERIVED. Smack Down's condition only applies to a
 * Flying-type or a Levitate body (data/moves.ts smackdown.condition.onStart), so its fixture needs one
 * — and a typed body cannot be named from memory here (CLAUDE.md). */
function typedAttacker(type, exclude) {
  return SPECIES.find(s => (s.types || []).includes(type) && !exclude.has(s.id) && anyAttack(s)) || null;
}
/* HOW MANY LEGAL SPECIES LEARN THIS MOVE — the same walk `carrierOf` makes, counted rather than
 * stopped at the first hit, so a row can report ZERO as a derived fact instead of as a search that
 * gave up. */
function carrierCount(moveId) {
  let n = 0;
  for (const s of SPECIES) {
    const ls = learnsetOf(s.id);
    if (ls && ls.learnset && ls.learnset[moveId]) n++;
  }
  return n;
}

{ /* THE RAMPAGE LOCK — A CLOCK ON BOTH SIDES, COMPARED AS ONE.
   * data/conditions.ts `lockedmove` declares `duration: 2` and is applied by Outrage / Petal Dance /
   * Thrash / Raging Fury as `self: { volatileStatus: 'lockedmove' }` (data/moves.ts outrage:10-12).
   * Champions overrides no `lockedmove` key anywhere outside learnsets.
   *
   * medicham2 keeps it in `_mtLock` — `{ move, left, confuse, vol }`, written at
   * medicham2-browser.js:36952 and ticked at :38462 — and NOT in `_vol`, which is why
   * `probe_uncompared_leaves.js`'s `_vol` column reads `.` for it. That column is a hint about where
   * the cheap wirings are and its own header says a MISS IS NOT EVIDENCE OF ABSENCE; this is the row
   * that proves the header right.
   *
   * `_mtLock` CARRIES TWO LOCKS AND `vol` TELLS THEM APART. Uproar rides the same field and ALREADY
   * has its own compared leaf twenty lines above in `mediBody` (`m._mtLock.vol === 'uproar'`), so this
   * leaf must EXCLUDE uproar or every Outrage would be reported twice and every Uproar would report as
   * a locked move. The discriminator is read, not assumed.
   *
   * THE AIM IS DELIBERATELY NOT SUPPLIED. Every rampage move is `target: 'randomNormal'`, which
   * `scripted()` does not aim (it aims `normal`, `any` and `adjacentFoe` only), so both engines pick
   * their own foe off the shared die.
   *
   * AND THAT IS WHY NEITHER FOE MAY CLICK PROTECT — THE FIRST VERSION OF THIS FIXTURE DID, AND IT
   * STAGED NOTHING. With the standard p2 (`Recycle` in slot 0, a bench filler clicking `Protect` in
   * slot 1) the random aim landed on the SHIELD, the move was blocked, and Showdown's `self` effects
   * never ran: `medi=0 sd=undefined` at the boundary, on BOTH engines, agreeing perfectly about a
   * volatile that was never applied. medicham2's own header records the same rule at :832 — *"above
   * step 7 never reaches `selfDrops`, so it arms no `lockedmove`"*. A COULD-NOT-STAGE is a claim about
   * the fixture and never about the mechanic (CLAUDE.md), so the fixture changed: BOTH p2 actives
   * click a derived inert move, and the second lead is a DERIVED second carrier of it rather than a
   * named body. Whichever foe the die picks, the Outrage lands. */
  const sp = carrierOf('outrage', s => !FILLER.includes(s.id));
  const inert2 = carrierOf('recycle', s => !FILLER.includes(s.id) && s.id !== 'snorlax' && s.id !== (sp && sp.id));
  CASES.push({ leaf: 'lockedmove', kind: 'vol', carrier: sp && inert2 ? sp : null, boundary: 1,
    authority: 'pokemon-showdown/data/conditions.ts lockedmove (duration 2), applied by outrage `self`',
    ours: 'engine/medicham2-browser.js:36952 `_mtLock.left`, ticked :38462 — NOT in `_vol`',
    p1: sp && inert2 && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Outrage', 'Protect'] }].concat(bench(...FILLER)),
    p2: sp && inert2 && [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] },
          { species: N.id(inert2.id), item: '', ability: '', moves: ['Recycle', 'Protect'] },
          ...bench(FILLER[0], FILLER[1])],
    script: [{ p1: [{ m: 'outrage' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'recycle' }] }],
    plant: (S) => { const t = (S.actA || [])[0]; if (t) t._mtLock = null; },
    held: (S, battle) => { const m = (S.actA || [])[0] || {};
      return { medi: (m._mtLock && m._mtLock.vol !== 'uproar') ? (m._mtLock.left | 0) : 0,
               sd: (((battle.sides[0].active[0] || {}).volatiles || {}).lockedmove || {}).duration }; } });
}

{ /* ALLY SWITCH — A CLOCK ON BOTH SIDES.
   * data/moves.ts allyswitch: the volatile comes from `onPrepareHit` (`return pokemon.addVolatile(
   * 'allyswitch')`) and its condition declares `duration: 2`, `counterMax: 729`, an `onStart` that
   * sets `counter = 3` and an `onRestart` that rolls `randomChance(1, counter)`.
   * medicham2 holds the two-turn life in `_aswDur` (written medicham2-browser.js:29272-29273, ticked
   * :38520) and the ladder in `_aswCount`. THE COUNTER IS NOT COMPARED HERE and that is a narrowing
   * said out loud: the authority keeps `counter` on the volatile's effectState and this engine keeps
   * it beside the clock, but the two are the same quantity and comparing them is a second wire, not
   * this one — the CLOCK is what decides whether the volatile is standing at all.
   *
   * THE MOVE SWAPS ITS USER INTO THE OTHER SLOT, so the body carrying the volatile at the boundary is
   * p1 slot 1, not slot 0. `held` scans both slots on both engines rather than assuming, because a
   * fixture that read slot 0 would report ABSENT on a move that worked. */
  const sp = carrierOf('allyswitch', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'allyswitch', kind: 'vol', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts allyswitch.condition (duration 2), added in onPrepareHit',
    ours: 'engine/medicham2-browser.js:29272 `_aswDur`, ticked :38520',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Ally Switch', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'allyswitch' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { for (const t of (S.actA || [])) if (t && t._aswDur) t._aswDur = 0; },
    held: (S, battle) => ({
      medi: Math.max(0, ...(S.actA || []).map(m => (m && m._aswDur) | 0)),
      sd: Math.max(0, ...(battle.sides[0].active || []).map(p => (((p || {}).volatiles || {}).allyswitch || {}).duration | 0)) }) });
}

{ /* DRAGON CHEER — PRESENCE, AND NOTHING IS COLLAPSED.
   * data/moves.ts dragoncheer: `volatileStatus: 'dragoncheer'`, `target: 'adjacentAlly'`, and the
   * condition is an `onStart` plus an `onModifyCritRatio` with NO duration. Champions overrides the
   * move's FLAGS only (data/mods/champions/moves.ts:241-244 adds `sound`), never the condition.
   * medicham2 derives the crit-stage family from the artifact — `critStageVolatile`, exactly two
   * members, `focusenergy` and `dragoncheer` (medicham2-browser.js:5523) — and writes the volatile's
   * own name into `_vol` through the crit-stage owner at :18671. `focusenergy`, the other member of
   * that derived pair, is ALREADY a compared leaf, which is the strongest available evidence that this
   * one is real state rather than a name.
   *
   * IT LANDS ON THE ALLY. `adjacentAlly` is aimed by `scripted()` with a negative target, so the
   * volatile is on p1 slot 1 (the first bench filler, standing) and not on the clicker. */
  const sp = carrierOf('dragoncheer', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'dragoncheer', kind: 'vol', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts dragoncheer.condition (NO duration); champions overrides flags only',
    ours: 'engine/medicham2-browser.js:18671 `_vol.dragoncheer` (critStageVolatile, derived: 2 members)',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Dragon Cheer', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'dragoncheer' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actA || [])[1]; if (t && t._vol) delete t._vol.dragoncheer; },
    held: (S, battle) => ({ medi: (((S.actA || [])[1] || {})._vol || {}).dragoncheer ? 1 : 0,
                            sd: ((((battle.sides[0].active[1] || {}).volatiles) || {}).dragoncheer ? 1 : 0) }) });
}

{ /* GASTRO ACID — PRESENCE.
   * data/moves.ts gastroacid: `volatileStatus: 'gastroacid'`, `target: 'normal'`; the condition is an
   * `onStart` (which suppresses the ability) plus an `onCopy`, with NO duration. Champions overrides
   * no `gastroacid` key outside learnsets.
   * medicham2 reaches it through the generic volatile write (`(who._vol = who._vol || {})[vol] = _tn`,
   * medicham2-browser.js:18820) and its own switch-out audit NAMES it: the eleven volatiles this
   * engine used to carry across a switch are listed at :21397 and `gastroacid` is one of them, so it
   * is measured state and not a name that happens to match.
   *
   * THIS LEAF IS ALREADY KNOWN TO BLOCK A ROW. `probe_uncompared_leaves.js`'s own header records the
   * narration batch failing on it — `uncomparable_leaves: ["volatile:gastroacid"]`,
   * `core_leaf_unchecked: true` — so that row was blocked on THE INSTRUMENT rather than on the game. */
  const sp = carrierOf('gastroacid', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'gastroacid', kind: 'vol', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts gastroacid.condition (NO duration)',
    ours: 'engine/medicham2-browser.js:18820 `_vol.gastroacid` (generic write); named at :21397',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Gastro Acid', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'gastroacid', t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actB || [])[0]; if (t && t._vol) delete t._vol.gastroacid; },
    held: (S, battle) => ({ medi: (((S.actB || [])[0] || {})._vol || {}).gastroacid ? 1 : 0,
                            sd: ((((battle.sides[1].active[0] || {}).volatiles) || {}).gastroacid ? 1 : 0) }) });
}

{ /* THE METRONOME ITEM — THE CONSECUTIVE-USE COUNTER, COMPARED AS A NUMBER.
   * data/items.ts metronome: `onStart(pokemon) { pokemon.addVolatile('metronome') }` — the volatile
   * exists from the moment the holder is on the field — and its condition carries NO duration and
   * TWO fields, `lastMove` and `numConsecutive`, which `onModifyDamage` reads back as a ladder index.
   * `data/mods/champions/items.ts` carries no `metronome` key; the champions override at moves.ts:628
   * bans the MOVE of the same name and says nothing about the item.
   *
   * PRESENCE WOULD BE THE WRONG COMPARISON AND WOULD PART EVERY BOARD. The authority's volatile is
   * standing on any holder from switch-in; medicham2 has no volatile at all and holds the counter in
   * `_metroN` (written medicham2-browser.js:25818-25828, cleared on switch-out at :21480, read as the
   * ladder index at :12755). So the COUNTER is the comparable quantity — `numConsecutive` against
   * `_metroN` — and it reads 0 against 0 on a body with no item at all, which is exactly right.
   *
   * THE BOUNDARY IS 2, NOT 1, AND THAT IS THE POINT. The authority's `onTryMove` takes the `else`
   * branch on a first click and sets `numConsecutive = 0`; only a REPEAT advances it. A fixture that
   * read boundary 1 would compare 0 against 0 and prove nothing — the unwired-knob shape. Both engines
   * must read 1 at the boundary that closes the SECOND identical click. */
  const sp = SPECIES.find(s => !FILLER.includes(s.id) && anyAttack(s));
  const atk = sp && anyAttack(sp);
  CASES.push({ leaf: 'metronome', kind: 'vol', carrier: sp && atk ? sp : null, boundary: 2,
    authority: 'pokemon-showdown/data/items.ts metronome.condition (numConsecutive, NO duration)',
    ours: 'engine/medicham2-browser.js:25818 `_metroN`, cleared :21480, read :12755 — no volatile at all',
    p1: sp && atk && [{ species: N.id(sp.id), item: 'Metronome', ability: '', moves: [atk.name, 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: N.id(atk && atk.id), t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] },
             { p1: [{ m: N.id(atk && atk.id), t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actA || [])[0]; if (t) t._metroN = 0; },
    held: (S, battle) => ({ medi: ((S.actA || [])[0] || {})._metroN | 0,
                            sd: (((battle.sides[0].active[0] || {}).volatiles || {}).metronome || {}).numConsecutive }) });
}

{ /* POWER TRICK — PRESENCE.
   * data/moves.ts powertrick: `volatileStatus: 'powertrick'`, `target: 'self'`; the condition is
   * `onStart` / `onCopy` / `onEnd` / `onRestart` with NO duration. Champions overrides no key outside
   * learnsets. medicham2 reaches the generic write at :18820 and names `powertrick` in its own
   * switch-out audit at :21398, so this is state the engine measurably holds. */
  const sp = carrierOf('powertrick', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'powertrick', kind: 'vol', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts powertrick.condition (NO duration)',
    ours: 'engine/medicham2-browser.js:18820 `_vol.powertrick` (generic write); named at :21398',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Power Trick', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'powertrick' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actA || [])[0]; if (t && t._vol) delete t._vol.powertrick; },
    held: (S, battle) => ({ medi: (((S.actA || [])[0] || {})._vol || {}).powertrick ? 1 : 0,
                            sd: ((((battle.sides[0].active[0] || {}).volatiles) || {}).powertrick ? 1 : 0) }) });
}

{ /* SMACK DOWN — PRESENCE, AND THE FIXTURE HAS TO EARN IT.
   * data/moves.ts smackdown.condition.onStart, READ WHOLE: `applies` starts FALSE and is set true only
   * by `hasType('Flying')` or `hasAbility(['levitate','eelevate'])`, then cleared again by an Iron
   * Ball, an Ingrain or a standing Gravity; a Fly / Bounce / Magnet Rise / Telekinesis each set it
   * true. `if (!applies) return false;` — SO THE VOLATILE DOES NOT LAND ON AN ORDINARY GROUNDED BODY
   * AT ALL. A fixture that aimed this at the Snorlax every other row uses would have measured nothing
   * and reported it as an absent leaf, which is a claim about the fixture wearing a claim about the
   * mechanic. The target is a DERIVED Flying-type. It carries no duration on either side.
   * medicham2 reaches the generic write at :18820, names `smackdown` in the switch-out audit at
   * :21398, and READS it in `isGrounded` through `GROUNDING_VOL` at :5998 — so the leaf is live here.
   *
   * THE FLYER MAY NOT CLICK PROTECT: Smack Down carries `protect: 1`, so a shield refuses it and the
   * volatile never lands. It clicks a derived single-target attack at p1 slot 1, which IS shielding. */
  const sp = carrierOf('smackdown', s => !FILLER.includes(s.id));
  const flyer = typedAttacker('Flying', new Set([sp ? sp.id : '', ...FILLER]));
  const fatk = flyer && anyAttack(flyer);
  const ok = !!(sp && flyer && fatk);
  CASES.push({ leaf: 'smackdown', kind: 'vol', carrier: ok ? sp : null, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts smackdown.condition (NO duration; applies to Flying/Levitate only)',
    ours: 'engine/medicham2-browser.js:18820 `_vol.smackdown`; read by isGrounded via GROUNDING_VOL :5998',
    p1: ok && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Smack Down', 'Protect'] }].concat(bench(...FILLER)),
    p2: ok && [{ species: N.id(flyer.id), item: '', ability: '', moves: [fatk.name, 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'smackdown', t: 0 }, { m: 'protect' }],
               p2: [{ m: N.id(fatk && fatk.id), t: 1 }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actB || [])[0]; if (t && t._vol) delete t._vol.smackdown; },
    held: (S, battle) => ({ medi: (((S.actB || [])[0] || {})._vol || {}).smackdown ? 1 : 0,
                            sd: ((((battle.sides[1].active[0] || {}).volatiles) || {}).smackdown ? 1 : 0) }) });
}

{ /* STOCKPILE — THE LAYER COUNT, AND IT IS A NUMBER ON BOTH SIDES.
   * data/moves.ts stockpile.condition: `onStart` sets `layers = 1`, `onRestart` refuses above 3 and
   * otherwise increments; NO duration. The move's own `onTry` refuses a fourth click. Champions
   * overrides no key outside learnsets — medicham2-browser.js:5675 says so for stockpile / spitup /
   * swallow specifically.
   * medicham2 holds the LAYERS in `_vol.stockpile` through `applyLayeredVolatile` (the header at
   * :5489-5500 records that this field once held a bare 1 that never rose above 1, and that Spit Up
   * and Swallow read the count off the STOCKPILE tag's own cap). So a presence comparison here would
   * throw away the whole quantity — this is compared as the layer count. */
  const sp = carrierOf('stockpile', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'stockpile', kind: 'vol', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts stockpile.condition (layers 1..3, NO duration)',
    ours: 'engine/medicham2-browser.js:5489 `_vol.stockpile` IS the layer count (applyLayeredVolatile)',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Stockpile', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'stockpile' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { const t = (S.actA || [])[0]; if (t && t._vol) delete t._vol.stockpile; },
    held: (S, battle) => ({ medi: (((S.actA || [])[0] || {})._vol || {}).stockpile | 0,
                            sd: (((battle.sides[0].active[0] || {}).volatiles || {}).stockpile || {}).layers }) });
}

/* ---- THE THREE PSEUDO-WEATHERS. A CLOCK ON BOTH SIDES, ON THE FIELD AND NOT ON A BODY ------------
 * All three declare `duration: 5` with a `durationCallback` (the Terrain Extender / room-extender
 * shape) and all three are ticked in the residual, so at the boundary that closes the applying turn
 * both engines must read 4. medicham2 keeps them on `field` and spends them through ONE function,
 * `fieldClock` (medicham2-browser.js:8977), which is also what carries Trick Room and Fairy Lock —
 * and `trickroom_turns` and `fairylock_turns` are ALREADY compared leaves read off that same field.
 * That is the strongest evidence available that these three are real state: the comparator already
 * reads two members of the identical mechanism. */
{ /* GRAVITY */
  const sp = carrierOf('gravity', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'gravity', kind: 'field', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/conditions.ts gravity (duration 5, onFieldResidual)',
    ours: 'engine/medicham2-browser.js:8983 fieldClock(\'gravity\',\'gravity\') — `field.gravity`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Gravity', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'gravity' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { if (S.field) S.field.gravity = 0; },
    held: (S, battle) => ({ medi: (S.field || {}).gravity | 0,
                            sd: (((battle.field || {}).pseudoWeather || {}).gravity || {}).duration }) });
}
{ /* MAGIC ROOM. medicham2 implements the suppression as a SWAP (`itemRoomHide` parks the item in
   * `_roomItem`), and `mediBody`'s `item` leaf already reads `m.item || m._roomItem` for exactly that
   * reason — ROADMAP #462 — so this fixture cannot part the item leaf as a side effect. */
  const sp = carrierOf('magicroom', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'magicroom', kind: 'field', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/conditions.ts magicroom (duration 5, onFieldResidual)',
    ours: 'engine/medicham2-browser.js:8988 fieldClock(\'magicroom\',\'magicRoom\') — `field.magicRoom`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Magic Room', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'magicroom' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { if (S.field) S.field.magicRoom = 0; },
    held: (S, battle) => ({ medi: (S.field || {}).magicRoom | 0,
                            sd: (((battle.field || {}).pseudoWeather || {}).magicroom || {}).duration }) });
}
{ /* WONDER ROOM. The Def/SpD swap is a DAMAGE-TIME read in both engines (medicham2-browser.js:11693)
   * and writes nothing to a body, so this fixture touches no other leaf. */
  const sp = carrierOf('wonderroom', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'wonderroom', kind: 'field', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/conditions.ts wonderroom (duration 5, onFieldResidual)',
    ours: 'engine/medicham2-browser.js:8984 fieldClock(\'wonderroom\',\'wonderRoom\') — `field.wonderRoom`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Wonder Room', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'wonderroom' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { if (S.field) S.field.wonderRoom = 0; },
    held: (S, battle) => ({ medi: (S.field || {}).wonderRoom | 0,
                            sd: (((battle.field || {}).pseudoWeather || {}).wonderroom || {}).duration }) });
}

/* ---- THE THREE SLOT CONDITIONS. A SHAPE `board_state.js` DID NOT READ AT ALL -------------------
 * `uncomparableLeavesOf` ended with the literal line *"this file reads no slot condition"* and pushed
 * every one of them into the uncomparable list unconditionally. There was no `SD_SLOT_KEYS` to ask.
 *
 * BOTH ENGINES KEEP ONE RECORD PER ACTIVE SLOT AND NEITHER EXPOSES A CLOCK ON IT. Showdown:
 * `side.slotConditions[position][id]` (sim/side.ts:197, 267-269, `addSlotCondition` at :472-489),
 * where Future Sight's countdown lives in `effectState.endingTurn` and Wish's in
 * `effectState.startingTurn` — neither is a `duration`. medicham2: `sf.slot[i] = { mv, when, due, … }`
 * (medicham2-browser.js:30130 for the heal descriptors, :27638 for the delayed hit), where the clock
 * is `due`. So these are compared as PRESENCE, and the two counters are a SEPARATE wire that is named
 * here rather than left as an absence.
 *
 * WHICH NAME A RECORD CARRIES IS READ OFF ITS `when`, WHICH IS THE ENGINE'S OWN DISCRIMINATOR —
 * medicham2-browser.js:8865 already maps `futureHit -> futuremove` and `endOfNextTurn -> wish` for its
 * residual shadow, and `data/tags.json` carries the authority's own `slotCondition` name beside each
 * `when` (`wish` -> when `endOfNextTurn`, `healingwish` -> when `onEntry`). An unmapped `when` is
 * COUNTED by the reader rather than silently reading as an empty slot. */
{ /* FUTURE SIGHT — the record lands on the TARGET'S side and slot, which is the half a careless
   * fixture gets backwards. data/moves.ts futuresight.onTry: `target.side.addSlotCondition(target,
   * 'futuremove')`, then it assigns `move`, `source` and `moveData` and returns `NOT_FAIL` — nothing
   * happens to the target now. data/conditions.ts futuremove sets `endingTurn = (turn - 1) + 2`, so at
   * the residual of the applying turn `getOverflowedTurnCount()` is 1 against an endingTurn of 2 and
   * the record STANDS; it resolves at the next turn's residual.
   * medicham2 books it at :27638 with `when: 'futureHit'` and reuses the Wish machinery deliberately
   * (its own comment: two delayed-effect queues would be the FACTS-ARE-GLOBAL violation). */
  const sp = carrierOf('futuresight', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'futuremove', kind: 'slot', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts futuresight.onTry + data/conditions.ts futuremove (endingTurn, no duration)',
    ours: 'engine/medicham2-browser.js:27638 `sf.slot[i] = { when: \'futureHit\' }`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Future Sight', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'futuresight', t: 0 }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { if (S.sfB && S.sfB.slot) delete S.sfB.slot[0]; },
    held: (S, battle) => ({ medi: (((S.sfB || {}).slot || {})[0] ? 1 : 0),
                            sd: (((battle.sides[1].slotConditions || [])[0] || {}).futuremove ? 1 : 0) }) });
}
{ /* WISH — `target: 'self'`, `slotCondition: 'Wish'`. The condition banks `source.maxhp / 2` in
   * `onStart` and `startingTurn = getOverflowedTurnCount()`; its `onResidual` returns early while the
   * turn count has not moved past that, so the record STANDS at the boundary that closes the wishing
   * turn and pays out at the next one.
   * medicham2 books it at :30130 with `when: 'endOfNextTurn'` and `due` one higher than the tag's
   * count, for the reason its own comment gives — the residual at the end of THIS turn ticks it once. */
  const sp = carrierOf('wish', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'wish', kind: 'slot', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts wish.condition (startingTurn, NO duration)',
    ours: 'engine/medicham2-browser.js:30130 `sf.slot[i] = { when: \'endOfNextTurn\' }`',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Wish', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'wish' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { if (S.sfA && S.sfA.slot) delete S.sfA.slot[0]; },
    held: (S, battle) => ({ medi: (((S.sfA || {}).slot || {})[0] ? 1 : 0),
                            sd: (((battle.sides[0].slotConditions || [])[0] || {}).wish ? 1 : 0) }) });
}
{ /* HEALING WISH — `selfdestruct: 'ifHit'`, so the user DIES and a replacement is forced in during the
   * same turn. data/moves.ts healingwish.condition.onSwap only spends the record when
   * `!target.fainted && (target.hp < target.maxhp || target.status)` — A FULL-HP, STATUSLESS
   * REPLACEMENT LEAVES IT STANDING, which is what makes this stageable at all and is exactly the
   * behaviour medicham2 records having confirmed on a staged game (:21007, "the record is only cleared
   * when it was actually SPENT"). Its reader is in `bringIn` at :21008-21027 and is deliberately a
   * READ — `slotCondOf` would install an empty map and its comment records 51 unrelated moves
   * "moving" the first time somebody let a reader write. */
  const sp = carrierOf('healingwish', s => !FILLER.includes(s.id));
  CASES.push({ leaf: 'healingwish', kind: 'slot', carrier: sp, boundary: 1,
    authority: 'pokemon-showdown/data/moves.ts healingwish.condition (onSwitchIn/onSwap, NO duration)',
    ours: 'engine/medicham2-browser.js:30130 `sf.slot[i] = { when: \'onEntry\' }`, read at :21008',
    p1: sp && [{ species: N.id(sp.id), item: '', ability: '', moves: ['Healing Wish', 'Protect'] }].concat(bench(...FILLER)),
    p2: [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER)),
    script: [{ p1: [{ m: 'healingwish' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }],
    plant: (S) => { if (S.sfA && S.sfA.slot) delete S.sfA.slot[0]; },
    held: (S, battle) => ({ medi: (((S.sfA || {}).slot || {})[0] ? 1 : 0),
                            sd: (((battle.sides[0].slotConditions || [])[0] || {}).healingwish ? 1 : 0) }) });
}

{ /* POWER SHIFT — NOT WIREABLE, AND THE REASON IS DERIVED ON EVERY RUN RATHER THAN REMEMBERED.
   * Champions un-bans the move (data/mods/champions/moves.ts:739-742, `isNonstandard: null`) and then
   * gives it to nobody: `powershift` occurs ZERO times in data/learnsets.ts and ZERO times in
   * data/mods/champions/learnsets.ts. `probe_uncompared_leaves.js` filters its ABILITY population on
   * having a legal carrier and its MOVE population only on `isNonstandard`, so this leaf sits inside
   * the ceiling of 56 — that is the authority's denominator and it is not adjusted here.
   *
   * THE ROW IS AN ASSERTION, NOT A NOTE. `carrierCount` walks the same legal species list every other
   * fixture uses; the moment one of them learns Power Shift this row FAILS, because at that point the
   * leaf is stageable and the absence of a fixture stops being a fact about the regulation. */
  CASES.push({ leaf: 'powershift', kind: 'vol', boundary: 1, noCarrierIsTheAnswer: 'powershift',
    authority: 'pokemon-showdown/data/moves.ts powershift.condition (NO duration); champions moves.ts:739 un-bans it',
    ours: 'engine/medicham2-browser.js:18820 would take the generic `_vol` write — never reached, nothing learns it',
    carrier: null, p1: null, p2: null, script: [], plant: null, held: () => ({ medi: 0, sd: 0 }) });
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
/* WHICH COMPARISON PATH THIS LEAF LANDS ON — 2026-09-05, BATCH 3. Until this batch every case was a
 * per-body volatile and the matcher was one hard-coded `.vol.<leaf>` suffix. Batch 3 adds two other
 * SHAPES of leaf, so the matcher is DERIVED from the case's `kind` rather than typed per row:
 *
 *   vol     `p1.active[0].vol.<leaf>`   a per-body volatile (the only shape before this batch)
 *   field   `field.<leaf>_turns`        a pseudo-weather, which lives on the FIELD and not on a body
 *   slot    `p1.slots[0].<leaf>`        a slot condition, which belongs to a SIDE'S SLOT
 *
 * A row may override with `pathRe`; none does today, and an override would be that row's own claim
 * about where its leaf lands rather than a derivation. */
const LEAFRE = (leaf, kind) => (kind === 'field' ? new RegExp('^field\\.' + leaf + '_turns$')
  : kind === 'slot' ? new RegExp('\\.slots\\[\\d+\\]\\.' + leaf + '$')
  : new RegExp('\\.vol\\.' + leaf + '$'));
const caseRe = c => c.pathRe || LEAFRE(c.leaf, c.kind);
function runArm(c, plant) {
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { err: 'COULD NOT BUILD THE PAIR' };
  const boards = [];
  /* THE SCRIPT'S OWN FALLBACK COUNTER, READ PER ARM — 2026-09-05. `scripted()` returns `pass` for a
   * click that is not on Showdown's request and COUNTS it; this file did not read that count, so a
   * fixture whose carrier never learned `Protect` would have both engines pass, the boards agree, and
   * the arm report a clean CONTROL while testing nothing. That is the silent default this repository
   * is named after, and the driver already exposes the answer — there is no excuse for a second guess. */
  G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'leafwiden/' + c.leaf + (plant ? '/red' : '/control'), {
    script: c.script,
    statePlant: plant ? ((S, battle, turnIdx) => { if (turnIdx === c.boundary) plant(S); }) : undefined,
    onBoundary: (snap, turnIdx, S, battle) => {
      boards.push({ turnIdx, held: c.held(S, battle), raw_medi: rawMedi(S), raw_sd: rawSd(battle),
                    onLeaf: snap.diffs.filter(d => caseRe(c).test(d.path)),
                    nDiffs: snap.diffs.length,
                    otherPaths: snap.diffs.filter(d => !caseRe(c).test(d.path)).map(d => d.path) });
    } });
  return { err: r && r.err, boards, script: G.scriptCounters() };
}

console.log('\n  LEAF WIDENING — CONTROL AND RED, PER LEAF');
console.log('  compared keys today: ' + BS.SD_VOLATILE_KEYS.length + ' per-body volatiles, '
  + BS.SD_PSEUDO_KEYS.length + ' pseudo-weathers, ' + (BS.SD_SLOT_KEYS || []).length + ' slot conditions, '
  + BS.SD_SIDE_KEYS.length + ' side conditions\n');

let fail = 0, red = 0;
for (const c of CASES) {
  /* THE CLASS IS THE ROW'S OWN, NEVER A HARD-CODED `volatile:`. Batch 3 added pseudo-weather and
   * slot-condition rows and this line labelled every one of them `volatile:` — a report whose labels
   * name the wrong class of leaf cannot be matched against the derivation it came from. */
  console.log('  ---- ' + (c.kind === 'field' ? 'pseudoWeather:' : c.kind === 'slot' ? 'slotCondition:' : 'volatile:') + c.leaf);
  console.log('       authority  ' + c.authority);
  console.log('       ours       ' + c.ours);
  /* A ROW WHOSE WHOLE FINDING IS THAT NOTHING IN THE REGULATION CAN WRITE THE LEAF — 2026-09-05.
   * It is separated from the ordinary no-carrier failure directly below because the two are different
   * sentences: "this search could not find a body" is a claim about the FIXTURE and must fail, while
   * "no body exists" is a claim about the REGULATION and is a legitimate answer. The difference is
   * only honest if it is DERIVED, so the count is walked here on every run and the row FAILS the
   * moment it is non-zero — at which point the leaf is stageable and the missing fixture is a gap. */
  if (c.noCarrierIsTheAnswer) {
    const n = carrierCount(c.noCarrierIsTheAnswer);
    console.log('       legal species in this regulation whose learnset holds `' + c.noCarrierIsTheAnswer
      + '`: ' + n + '   (walked over ' + SPECIES.length + ' legal, non-mega species)');
    if (n === 0) console.log('       NOT WIREABLE — no legal body can write this leaf. Not a fixture failure.');
    else { console.log('       FAIL — ' + n + ' carrier(s) exist, so this leaf IS stageable and has no fixture.'); fail++; }
    continue;
  }
  if (!c.carrier || !c.p1 || !c.p2) { console.log('       NO LEGAL CARRIER — a claim about the fixture, not the mechanic'); fail++; continue; }
  console.log('       carrier    ' + c.carrier.name);
  /* READ OUT OF `board_state.js`'S OWN DERIVED KEY SETS, PER SHAPE. A hand-written "yes" here would be
   * a second producer of the exact fact this file exists to measure. `SD_SLOT_KEYS` did not exist
   * before this batch — `uncomparableLeavesOf` carried the literal comment "this file reads no slot
   * condition" — so a missing export reports `no` rather than throwing. */
  const keys = (c.kind === 'field' ? BS.SD_PSEUDO_KEYS
              : c.kind === 'slot' ? (BS.SD_SLOT_KEYS || []) : BS.SD_VOLATILE_KEYS);
  const klass = (c.kind === 'field' ? 'pseudoWeather:' : c.kind === 'slot' ? 'slotCondition:' : 'volatile:');
  console.log('       in the comparator: ' + (keys.includes(c.leaf) ? 'YES' : 'no')
    + '        declared in NOT_COMPARED: ' + (BS.DECLARED_LEAVES.has(klass + c.leaf) ? 'YES' : 'no'));

  const ctl = runArm(c, null);
  if (ctl.err) { console.log('       CONTROL THREW: ' + ctl.err); fail++; continue; }
  /* PRINTED UNCONDITIONALLY, so a zero is evidence the script ran rather than an absence. A non-zero
   * here means at least one scripted click silently became a `pass`, and every board below it is a
   * board from a game that did not do what this fixture says it did. It FAILS the arm. */
  console.log('       scripted clicks that fell through to `pass`: ' + ctl.script.moveNotOnRequest
    + (ctl.script.firstMissing ? '   first: ' + ctl.script.firstMissing : ''));
  if (ctl.script.moveNotOnRequest) { console.log('       FAIL — the fixture did not run its own script.'); fail++; continue; }
  for (const b of ctl.boards)
    console.log('       b' + b.turnIdx + '  medi=' + JSON.stringify(b.held.medi) + ' sd=' + JSON.stringify(b.held.sd)
      + '   diffs=' + b.nDiffs + (b.onLeaf.length ? '  ON THIS LEAF: ' + b.onLeaf.map(d => d.path).join(',') : ''));
  console.log('       raw medi   ' + (ctl.boards[c.boundary] || {}).raw_medi);
  console.log('       raw sd     ' + (ctl.boards[c.boundary] || {}).raw_sd);

  const bd = ctl.boards[c.boundary];
  if (!bd) { console.log('       NO BOUNDARY ' + c.boundary + ' — the fixture, not the mechanic'); fail++; continue; }
  if (c.observeOnly) {
    /* OBSERVE ONLY IS ABOUT THE WIRING, NOT ABOUT THE MEASUREMENT. No plant is possible on a leaf the
     * comparator does not carry, so there is no CONTROL/RED pair — but the row still has to answer
     * for what it prints, and `report` FAILS the run on a disagreement or on a reading it could not
     * take. An observe row that can never go red is the thing this file was repaired for. */
    console.log('       OBSERVE ONLY ON THE WIRING — no comparator plant is possible. The mechanic itself'
      + ' is MEASURED below, out of both engines\' own speed functions.');
    if (!c.report) { console.log('       NO REPORT FUNCTION — the row would print nothing and pass. Counted as a failure.'); fail++; continue; }
    const rep = c.report(bd);
    for (const l of rep.lines) console.log(l);
    if (rep.fail) fail++;
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
    /* THE FIELD NAMES ARE `medicham` / `showdown`, NOT `a` / `b` — `board_state.js`'s `walk` pushes
     * `{ path, medicham, showdown }`. This line read `d.a` / `d.b` and printed `undefined<>undefined`
     * on every catch, so the arm said PASS and showed NOTHING, which is a receipt that proves nothing
     * (CLAUDE.md: a capability that cannot prove it ran is assumed broken). Corrected 2026-09-04. */
    ? 'PASS — caught ' + caught.map(d => d.path + ' medi=' + JSON.stringify(d.medicham)
        + ' sd=' + JSON.stringify(d.showdown)).join(', ')
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
/* SAME REASON, FOR THE SPEED READS. A throw out of `effSpeed` or `getStat` that were swallowed would
 * look exactly like a body whose speed did not change — which is the reading that means "the doubling
 * did not apply". Printed unconditionally so a zero is evidence rather than an absence. */
console.log('  speed reads that threw (effSpeed / getStat): ' + SPE_THREW + (SPE_FIRST ? '  first: ' + SPE_FIRST : ''));
console.log('  learnset lookups that threw during the fixture search: ' + LS_THREW
  + (LS_THREW ? '  <- the carrier pool is NARROWER than the format, so a COULD-NOT-STAGE below is'
      + ' a statement about this search and NOT about the mechanic' : ''));
console.log(fail ? '  FAIL — ' + fail + ' arm(s) did not hold.' : '  PASS — every arm held.');
process.exit(fail ? 1 : 0);
