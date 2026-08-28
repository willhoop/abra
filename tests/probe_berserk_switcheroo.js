/* probe_berserk_switcheroo.js — TWO ORDERING/NAMING CLAIMS, EACH ASKED ON A STAGED BOARD.
 *
 *   SHOWDOWN_PATH=... node tests/probe_berserk_switcheroo.js
 *
 * DIAGNOSTIC ONLY. Nothing under engine/ is edited by this file and nothing here proposes a fix; it
 * exists to settle two questions the 2026-08-27 census/mechanics artifacts left open.
 *
 * ---- A. IS BERSERK'S LEAF COMPARABLE AT ALL? ------------------------------------------------------
 *
 * `data/all-mechanics-fire.json`'s `ability/berserk` row reports
 *     divergence  ordering :: |-hitcount|p1a|2 <> |-boost|p1a|spa|1
 *     board       ANNOUNCEMENT-ONLY, boundaries 4, boundaries_agreed 4, boards_after_the_parting 3
 *     end_reason  THREW          <- on the arm AND on the control arm
 * and a scout read the THREW as "the comparison produced nothing". THAT IS THE QUESTION THIS ANSWERS,
 * and it is answered the only way it can be: a RED PLANT. `board_state.js` is shown catching a
 * deliberate corruption of the exact leaf the mechanic writes — the carrier's `boosts.sa` — planted
 * into the LIVE medicham state at the boundary AFTER the streams part. A comparator that has never
 * been shown catching that leaf cannot be quoted as agreeing on it (docs/LESSONS.md §1: a leaf you
 * cannot compare reads as agreement).
 *
 * THE AUTHORITY'S ORDER, READ RATHER THAN RECALLED. Champions overrides `hitStepMoveHitLoop`
 * (data/mods/champions/scripts.ts:428) and inside it:
 *     this.battle.faintMessages(false, false, !pokemon.hp);                 scripts.ts:547
 *     if (move.multihit && ...) this.battle.add('-hitcount', targets[0], hit - 1);   :550
 *     if (move.totalDamage) this.applyRecoilDamage(...);                    :554
 *     this.battle.eachEvent('Update');                                      :575
 *     this.afterMoveSecondaryEvent(targetsCopy.filter(...), pokemon, move); :577
 * Berserk's boost is `onAfterMoveSecondary` (data/abilities.ts:420-428; Champions overrides ONLY the
 * `onDamage` bookkeeping line, data/mods/champions/abilities.ts:8-13, and inherits the rest), so the
 * authority's `-hitcount` is ABOVE the boost by two statements.
 *
 * ---- B. WHAT DOES SWITCHEROO'S ACTIVATE LINE SAY? -------------------------------------------------
 *
 * data/moves.ts:18666, inside switcheroo's own onHit:
 *     this.add('-activate', source, 'move: Trick', `[of] ${target}`);
 * Switcheroo NAMES TRICK. Champions does not override either move (no `switcheroo:`/`trick:` key in
 * data/mods/champions/moves.ts). Trick's handler is the same statement at data/moves.ts:19887. Both
 * also write a `[silent]` `-enditem` for the side that handed over nothing.
 *
 * BOTH MOVES ARE EMITTED BY ONE BLOCK HERE (the `_ti.swaps` arm of `kind:'trickitem'`), so this probe
 * stages BOTH and prints both streams — the point being whether they are one fix or two.
 *
 * FIXTURE DISCIPLINE. Every fixture is derived from the format and the tag artifact; no species,
 * item, move or ability is typed. The Berserk board is SELECTED ON THE AUTHORITY'S STREAM ALONE and
 * is refused unless the two streams are a PERMUTATION of one another — i.e. the pair parts for
 * exactly one reason. A board that parts for two reasons proves nothing about either.
 *
 * IT IS A DIAGNOSTIC AND EXITS 0 WHEN IT COULD ASK ITS QUESTIONS, 1 WHEN THE HARNESS FAILED, 2 WHEN
 * THE FORMAT COULD NOT SUPPLY A FIXTURE. It asserts nothing about what the engine SHOULD do.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
require(D('tests', '_live_release.js'));

process.argv.push('--state', '--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const BS = require(D('engine', 'board_state.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const mon = (sp, mvs, item, ab) => ({ species: sp, item: item || '', ability: ab || '', moves: mvs });
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NO SUCH ARM — a claim about the driver.'); process.exit(1); }

let RC = 0;

/* Fold a protocol line onto slot identity so the two engines' spellings cannot make a difference
 * where there is none (`p1a: Drampa` vs `p1a: drampa`). */
const fold = l => String(l).toLowerCase().replace(/\|(p[12][ab]?):\s*[^|]*/g, '|$1');
const bag = ls => { const m = new Map(); for (const l of ls) m.set(l, (m.get(l) || 0) + 1); return m; };
function multisetDiff(a, b) {
  const A = bag(a), B = bag(b), only = { a: [], b: [] };
  for (const [k, n] of A) { const d = n - (B.get(k) || 0); for (let i = 0; i < d; i++) only.a.push(k); }
  for (const [k, n] of B) { const d = n - (A.get(k) || 0); for (let i = 0; i < d; i++) only.b.push(k); }
  return only;
}

/* ================================================================================================
 * A — BERSERK
 * ============================================================================================== */
console.log('\n================ A — BERSERK ================\n');
console.log('  === THE FIXTURE, DERIVED THIS RUN ===');

const HPT = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('boostsAtHPThreshold'))
  .map(([k, v]) => ({ id: k, uses: v.uses, p: v.params.boostsAtHPThreshold }));
console.log('  abilities tagged boostsAtHPThreshold:');
for (const a of HPT) console.log('      ' + a.id.padEnd(14) + JSON.stringify(a.p) + '  (' + a.uses + ' sheets)');
const AB = HPT.filter(a => dex.abilities.get(a.id).exists && !dex.abilities.get(a.id).isNonstandard)
  .sort((a, b) => b.uses - a.uses)[0];
if (!AB) { console.log('  NO LEGAL boostsAtHPThreshold ABILITY — a claim about the format.'); process.exit(2); }

const CARRIERS = POOL.filter(s => Object.values(s.abilities).some(x => norm(x) === AB.id));
console.log('  legal carriers of ' + AB.id + '        : ' + CARRIERS.length + '   '
  + CARRIERS.map(s => s.name).join(', '));
if (!CARRIERS.length) { console.log('  NO LEGAL CARRIER — a claim about the format.'); process.exit(2); }

const MULTI = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.multihit);
const hits = m => (Array.isArray(m.multihit) ? m.multihit[1] : m.multihit);
const USABLE = MULTI.filter(m => (m.accuracy === true || m.accuracy === 100) && !m.smartTarget && hits(m) >= 2);
console.log('  usable multi-hit moves             : ' + USABLE.map(m => m.id + '(' + JSON.stringify(m.multihit) + ')').join(', '));
if (!USABLE.length) { console.log('  NO USABLE MULTI-HIT MOVE — a claim about the format.'); process.exit(2); }

const SELF_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.flags.charge && !m.stallingMove && !m.selfSwitch
  && !(TAGS.moves[m.id] && (TAGS.moves[m.id].tags || []).includes('userFaints'))).map(m => m.id);
const abTags = s => { const t = TAGS.abilities[norm(Object.values(s.abilities)[0])]; return (t && t.tags) || []; };
const NO_FIELD_AB = s => !abTags(s).some(t => /weather|terrain/i.test(t));
const FILL = POOL.filter(s => LEARNS(s, 'protect') && NO_FIELD_AB(s));

const SKIP = { noFiller: 0, noHold: 0, buildThrew: 0, gameThrew: 0 };
function playBerserk(MV, AT, T, hb) {
  const HOLD = SELF_MOVES.find(m => LEARNS(T, m));
  if (!HOLD) { SKIP.noHold++; return null; }
  const f = FILL.filter(s => s.name !== AT.name && s.name !== T.name).slice(0, 6);
  if (f.length < 6) { SKIP.noFiller++; return null; }
  /* THE CARRIER IS ON p1 AND MOVES SECOND, so its own click cannot reorder the volley's lines. */
  const A = [mon(T.name, [HOLD, 'Protect'], '', AB.id),
    mon(f[0].name, ['Protect']), mon(f[1].name, ['Protect']), mon(f[2].name, ['Protect'])];
  const B = [mon(AT.name, [MV.name, 'Protect'], '', Object.values(AT.abilities)[0]),
    mon(f[3].name, ['Protect']), mon(f[4].name, ['Protect']), mon(f[5].name, ['Protect'])];
  const script = [{ p1: [{ m: HOLD }, { m: 'protect' }], p2: [{ m: norm(MV.id), t: 0 }, { m: 'protect' }] }];
  let a, b;
  try { a = G.buildPair(A, { hpBoost: hb }); b = G.buildPair(B); }
  catch (e) { SKIP.buildThrew++; return null; }
  if (!a || !b) { SKIP.buildThrew++; return null; }
  const boards = [];
  const onBoundary = (snap, turnIdx) => boards.push({ turn: turnIdx, identical: snap.identical,
    leaves: snap.leaves_compared, diffs: snap.identical ? [] : snap.diffs.map(d => BS.locate(d, snap)) });
  G.resetScriptCounters();
  let g;
  try { g = G.playGame(a, b, 'directed', 'bsk/' + norm(AT.name) + '/' + norm(T.name) + '/' + hb,
    { arm: ARM, script, onBoundary }); }
  catch (e) { SKIP.gameThrew++; return null; }
  if (g.err) { SKIP.gameThrew++; return null; }
  const sd = G.sdStream(G.lastSdLog()).map(fold);
  const me = (g.mediTrace || []).map(fold);
  return { MV, AT, T, hb, HOLD, A, B, script, g, sd, me, boards };
}

/* SELECTED ON THE AUTHORITY'S STREAM ALONE: the volley must land 2+ arrivals, the carrier must
 * SURVIVE, and the authority must print BOTH `-hitcount` and the ability's boost. medicham2's stream
 * is never consulted while choosing. */
const idxOf = (ls, re) => ls.findIndex(l => re.test(l));
const RE_HC = /^\|-hitcount\|p1a\|/, RE_ABI = new RegExp('^\\|-ability\\|p1a\\|' + AB.id + '\\|boost'),
      RE_BST = /^\|-boost\|p1a\|/, RE_FNT = /^\|faint\|p1a/;
let F = null; const tried = [];
outer:
for (const MV of USABLE.sort((a, b) => hits(b) - hits(a) || b.basePower - a.basePower)) {
  const ATS = POOL.filter(s => LEARNS(s, MV.id) && LEARNS(s, 'protect') && NO_FIELD_AB(s))
    .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk : b.baseStats.spa - a.baseStats.spa));
  for (const AT of ATS.slice(0, 6)) {
    for (const T of CARRIERS) {
      if (!dex.getImmunity(MV.type, T)) continue;
      for (const hb of [1, 2, 3, 4]) {
        const r = playBerserk(MV, AT, T, hb);
        if (!r) continue;
        const hc = idxOf(r.sd, RE_HC), ab = idxOf(r.sd, RE_ABI), fnt = idxOf(r.sd, RE_FNT);
        tried.push(MV.id + ' ' + AT.name + ' -> ' + T.name + ' x' + hb
          + '  sd hitcount@' + hc + ' ability@' + ab + ' fainted=' + (fnt >= 0));
        if (hc >= 0 && ab >= 0 && fnt < 0) { F = r; break outer; }
      }
    }
  }
}
console.log('  candidate boards played            : ' + tried.length + '   skipped ' + JSON.stringify(SKIP));
for (const t of tried.slice(-8)) console.log('      ' + t);
if (!F) { console.log('\n  NO BOARD PUTS BOTH LINES ON THE AUTHORITY WITH THE CARRIER ALIVE — a claim about '
  + 'the fixture, not the engine. Nothing was staged.'); process.exit(2); }
console.log('  CHOSEN (on the SHOWDOWN stream alone): ' + F.AT.name + ' clicks ' + F.MV.name + ' into a '
  + AB.id + ' ' + F.T.name + ', hpBoost x' + F.hb + '   [carrier holds with ' + F.HOLD + ']');
const SC = G.scriptCounters();
if (SC.moveNotOnRequest) { console.log('  RED — ' + SC.moveNotOnRequest + ' scripted click(s) were not on the request ('
  + SC.firstMissing + '). The arm did not run.'); process.exit(1); }

/* ---- THE TWO STREAMS ---------------------------------------------------------------------------- */
const KEEP = /^\|(-damage|-hitcount|-ability|-boost|-unboost|faint|-heal|-enditem|-item|-crit|-supereffective|-resisted|-activate|-start|-end|-status|-immune|-fail|move)\|/;
const sdE = F.sd.filter(l => KEEP.test(l)), meE = F.me.filter(l => KEEP.test(l));
console.log('\n  === THE TWO STREAMS, TURN 1, FOLDED ONTO SLOTS ===');
console.log('  --- showdown ---');   for (const l of sdE) console.log('      ' + l);
console.log('  --- medicham2 ---');  for (const l of meE) console.log('      ' + l);

/* ---- HOW MANY REASONS DOES THIS BOARD PART FOR? -------------------------------------------------- */
/* THE DRIVER'S OWN REDUCED STREAMS, NOT A SECOND COPY OF ITS RULES. `div.sdAfter` / `div.meAfter` are
 * the streams AFTER `reduce()` has applied every declared EQUIV rule (engine/game_differential.js:1989
 * — `ability-announcement` drops `|-ability|`, `move-target-field` truncates a `|move|` line to four
 * fields, `source-tag` drops `[of] pXy`). A multiset diff over those is the comparator's own answer to
 * "does this pair part for more than one reason", asked in the comparator's vocabulary. */
console.log('\n  === HOW MANY REASONS THIS BOARD PARTS FOR (the driver\'s own reduced streams) ===');
if (!F.g.div) { console.log('  THE DRIVER RECORDED NO DIVERGENCE — nothing to attribute.'); RC = 1; }
else {
  const C = G.classify(F.g.div);
  console.log('  the driver\'s first divergence      : ' + C.cls + ' — ' + C.detail);
  console.log('  cause                              : ' + C.cause);
  console.log('  showdown, reduced, from the split  :'); for (const l of F.g.div.sdAfter) console.log('      ' + l);
  console.log('  medicham2, reduced, from the split :'); for (const l of F.g.div.meAfter) console.log('      ' + l);
  /* THE TWO WINDOWS ARE NOT THE SAME LENGTH AND THE FIRST CUT OF THIS CHECK DID NOT NOTICE.
   * `sdAfter`/`meAfter` are `slice(i, i+10)` of two streams the driver STOPS at the first divergent
   * board, so medicham2's is one line shorter and showdown's carries a trailing `|turn|2` with no
   * counterpart. Diffing the two raw windows reported `only in showdown: |turn|2` and printed
   * "MORE THAN ONE REASON" — which was the WINDOW, not the game. Compared over the common prefix. */
  const n = Math.min(F.g.div.sdAfter.length, F.g.div.meAfter.length);
  const only = multisetDiff(F.g.div.sdAfter.slice(0, n).map(fold), F.g.div.meAfter.slice(0, n).map(fold));
  console.log('  common window                      : ' + n + ' lines (sd ' + F.g.div.sdAfter.length
    + ', medi ' + F.g.div.meAfter.length + ' — the driver stops our stream at the divergent board)');
  console.log('  only in showdown                   : ' + (only.a.length ? only.a.join(' ; ') : 'NONE'));
  console.log('  only in medicham2                  : ' + (only.b.length ? only.b.join(' ; ') : 'NONE'));
  const PERM = only.a.length === 0 && only.b.length === 0;
  console.log('  the window is a PERMUTATION        : ' + PERM
    + (PERM ? '   -> exactly one reason: ORDER' : '   -> a second reason may be present; see the residual above'));
  if (!PERM) { console.log('  REFUSED — this fixture qualifies for more than one reason.'); RC = 1; }
}
const onlyRaw = multisetDiff(sdE, meE);
console.log('  (raw, unreduced residual — expect the declared EQUIV drops here and nothing else)');
console.log('      only in showdown : ' + (onlyRaw.a.length ? onlyRaw.a.join(' ; ') : 'NONE'));
console.log('      only in medicham2: ' + (onlyRaw.b.length ? onlyRaw.b.join(' ; ') : 'NONE'));

const sHC = idxOf(sdE, RE_HC), sAB = idxOf(sdE, RE_ABI), sBS = idxOf(sdE, RE_BST);
const mHC = idxOf(meE, RE_HC), mAB = idxOf(meE, RE_ABI), mBS = idxOf(meE, RE_BST);
console.log('\n  === THE ORDER, BOTH ENGINES ===');
console.log('  showdown   -hitcount@' + sHC + '  -ability@' + sAB + '  -boost@' + sBS
  + '   -> ' + (sHC >= 0 && sBS >= 0 ? (sHC < sBS ? 'HITCOUNT FIRST' : 'BOOST FIRST') : 'a line is missing'));
console.log('  medicham2  -hitcount@' + mHC + '  -ability@' + mAB + '  -boost@' + mBS
  + '   -> ' + (mHC >= 0 && mBS >= 0 ? (mHC < mBS ? 'HITCOUNT FIRST' : 'BOOST FIRST') : 'a line is missing'));

/* ---- IS THE LEAF COMPARABLE? THE RED PLANT ------------------------------------------------------- */
console.log('\n  === IS THE CARRIER\'S SpA LEAF COMPARABLE? ===');
console.log('  boundaries taken                   : ' + F.boards.length
  + '   agreed ' + F.boards.filter(b => b.identical).length
  + '   leaves ' + (F.boards.length ? Math.min(...F.boards.map(b => b.leaves)) + '..' + Math.max(...F.boards.map(b => b.leaves)) : '-'));
console.log('  end reason                         : ' + (F.g.endReason || 'none recorded'));
console.log('  protocol parted on turn            : ' + F.g.divTurn);
console.log('  boards at or after the parting     : ' + (F.g.divTurn == null ? 'n/a' : F.boards.filter(b => b.turn >= F.g.divTurn).length));

/* THE PLANT. The carrier's `boosts.sa` is corrupted on the LIVE medicham state at boundary 1 — the
 * first boundary at or after the parting — and the run FAILS if `board_state.js` does not report it.
 * A `sa` that was never read would make an ANNOUNCEMENT-ONLY verdict on this row worthless. */
{
  const PLANT_AT = F.g.divTurn == null ? 1 : F.g.divTurn;
  const a2 = G.buildPair(F.A, { hpBoost: F.hb }), b2 = G.buildPair(F.B);
  let planted = false, before = null, after = null, plantErr = null;
  const boards2 = [];
  try {
    G.playGame(a2, b2, 'directed', 'bsk-plant', { arm: ARM, script: F.script,
      onBoundary: (snap, t) => boards2.push({ turn: t, identical: snap.identical,
        diffs: snap.identical ? [] : snap.diffs.map(d => BS.locate(d, snap)) }),
      statePlant: (S2, _b, turnIdx) => {
        if (planted || turnIdx !== PLANT_AT) return;
        const body = (S2.actA || []).find(x => x && x.boosts && x.boosts.sa != null);
        if (!body) return;
        before = body.boosts.sa | 0;
        body.boosts.sa = before + 3;
        after = body.boosts.sa;
        planted = true;
      } });
  } catch (e) { plantErr = String((e && e.message) || e); }
  const bad2 = boards2.filter(b => !b.identical);
  const caught = bad2.some(b => b.diffs.some(d => /boosts\.spa/.test(JSON.stringify(d))));
  console.log('  RED PLANT: the carrier\'s live medicham `boosts.sa` +3 at boundary ' + PLANT_AT
    + ' (the first at or after the parting)');
  console.log('      plant applied                  : ' + planted
    + (planted ? '   (' + before + ' -> ' + after + ')' : '') + (plantErr ? '   THREW: ' + plantErr : ''));
  console.log('      board_state CAUGHT it          : ' + caught
    + (caught ? '   -> THE SpA LEAF IS COMPARED' : '   -> THE SpA LEAF IS NOT COMPARED; no ANNOUNCEMENT-ONLY verdict on this row means anything'));
  if (bad2.length) console.log('      the diff it reported           : ' + JSON.stringify(bad2[0].diffs.slice(0, 3)));
  if (!planted || !caught) { console.log('  RED — the plant did not demonstrate the leaf.'); RC = 1; }
}


/* ---- THE #511 CORNER: DOES THE DROPPED `-hitcount` MEET THE ORDERING? ---------------------------
 *
 * `_stepApply` bumps `MEDFAILS.hitCountDroppedOnCollapse` and writes NO `-hitcount` when a volley was
 * priced at 2+ packets and the total was rewritten under it -- a Focus Sash, an Endure or a busted
 * Disguise (that block's own declared remainder). A Sash-saved body sits at 1 HP, which is BELOW half,
 * so the crossing test is satisfied and Berserk fires too. The two defects therefore meet on one
 * board, and this stages it rather than reasoning about it. The item is derived off its own tag. */
console.log('\n  === THE FOCUS-SASH CORNER (does the dropped -hitcount meet the ordering?) ===');
{
  const SASHES = Object.entries(TAGS.items || {})
    .filter(([, v]) => (v.tags || []).some(t => /survive|endure|sash/i.test(t)))
    .map(([k, v]) => ({ id: k, uses: v.uses, tags: v.tags }));
  console.log('      items whose tags name surviving a lethal hit:');
  for (const s of SASHES) console.log('          ' + s.id.padEnd(14) + JSON.stringify(s.tags) + '  (' + s.uses + ' sheets)');
  const SASH = SASHES.map(s => dex.items.get(s.id)).find(i => i && i.exists && !i.isNonstandard);
  if (!SASH) { console.log('      NO SUCH ITEM IN THIS FORMAT -- the corner cannot be staged here.'); }
  else {
    const HOLD2 = SELF_MOVES.find(m => LEARNS(F.T, m));
    const f2 = FILL.filter(s => s.name !== F.AT.name && s.name !== F.T.name).slice(0, 6);
    const A2 = [mon(F.T.name, [HOLD2, 'Protect'], SASH.name, AB.id),
      mon(f2[0].name, ['Protect']), mon(f2[1].name, ['Protect']), mon(f2[2].name, ['Protect'])];
    const B2 = [mon(F.AT.name, [F.MV.name, 'Protect'], '', Object.values(F.AT.abilities)[0]),
      mon(f2[3].name, ['Protect']), mon(f2[4].name, ['Protect']), mon(f2[5].name, ['Protect'])];
    /* WHY THESE CATCHES SPEAK. A throw here and a fixture that simply does not qualify both end at
     * the same `COULD NOT STAGE`, and "COULD NOT STAGE" is a claim about the FIXTURE. A swallowed
     * throw would dress a broken harness up as a fact about the format — the exact substitution
     * docs/LESSONS.md warns about. Every skip is recorded with its reason and printed below. */
    let staged = null; const sashSkips = [];
    for (const hb of [1, 2]) {
      let a3, b3, g3;
      try { a3 = G.buildPair(A2, { hpBoost: hb }); b3 = G.buildPair(B2); }
      catch (e) { sashSkips.push('x' + hb + ' buildPair THREW: ' + ((e && e.message) || e)); continue; }
      if (!a3 || !b3) { sashSkips.push('x' + hb + ' buildPair returned null'); continue; }
      try { g3 = G.playGame(a3, b3, 'directed', 'bsk-sash/' + hb, { arm: ARM, script: F.script }); }
      catch (e) { sashSkips.push('x' + hb + ' playGame THREW: ' + ((e && e.message) || e)); continue; }
      if (g3.err) { sashSkips.push('x' + hb + ' the game reported err: ' + g3.err); continue; }
      const sd3 = G.sdStream(G.lastSdLog()).map(fold), me3 = (g3.mediTrace || []).map(fold);
      const usedSash = sd3.some(l => /^\|-enditem\|p1a\|/.test(l));
      staged = { hb, sd3, me3, g3, usedSash };
      if (usedSash) break;
    }
    if (sashSkips.length) { console.log('      skipped hpBoost values, with reasons:');
      for (const s of sashSkips) console.log('          ' + s); }
    if (!staged) console.log('      COULD NOT STAGE -- ' + (sashSkips.some(s => /THREW/.test(s))
      ? 'AND THE HARNESS THREW (see above). This is NOT a claim about the fixture.'
      : 'a claim about the fixture.'));
    else {
      console.log('      hpBoost x' + staged.hb + '   the authority spent the item: ' + staged.usedSash);
      const K = /^\|(-damage|-hitcount|-ability|-boost|-enditem|-activate|faint)\|/;
      console.log('      showdown :'); for (const l of staged.sd3.filter(x => K.test(x))) console.log('          ' + l);
      console.log('      medicham2:'); for (const l of staged.me3.filter(x => K.test(x))) console.log('          ' + l);
      const hcSd = staged.sd3.some(l => /^\|-hitcount\|/.test(l));
      const hcMe = staged.me3.some(l => /^\|-hitcount\|/.test(l));
      const bsSd = staged.sd3.some(l => /^\|-boost\|p1a\|spa\|/.test(l));
      const bsMe = staged.me3.some(l => /^\|-boost\|p1a\|spa\|/.test(l));
      console.log('      -hitcount present            : showdown ' + hcSd + '   medicham2 ' + hcMe);
      console.log('      berserk -boost present       : showdown ' + bsSd + '   medicham2 ' + bsMe);
      console.log('      VERDICT: ' + (hcSd && !hcMe && bsSd && bsMe
        ? 'THE TWO DEFECTS MEET -- the line is MISSING here rather than out of order, so a Sash board '
          + 'confounds them and must not be used as an ordering fixture'
        : 'they do not co-occur on this board'));
      if (staged.g3.div) { const C3 = G.classify(staged.g3.div);
        console.log('      driver first divergence      : ' + C3.cls + ' -- ' + C3.detail);
        console.log('      cause                        : ' + C3.cause); }
      else console.log('      driver first divergence      : NONE');
    }
  }
}


/* ---- THE OTHER COLLAPSE ROUTE, AND IT IS THE ONLY ONE THAT CAN CO-OCCUR --------------------------
 *
 * The Sash arm above shows the corner is UNREACHABLE that way: a Focus Sash needs `target.hp ===
 * target.maxhp`, and hit 1 of a volley takes the body off full, so the item never fires against a
 * multi-hit at all. `hitCountDroppedOnCollapse` names three producers -- Sash, ENDURE and a busted
 * Disguise -- and of the three only Endure can be held by a `boostsAtHPThreshold` carrier (Disguise
 * belongs to a different species entirely; the carrier list is printed above). So Endure is the one
 * board on which "the count is dropped" and "the boost is out of order" can meet, and it is staged
 * rather than argued. The move is found by its own dex fields (self-target, stalling), not named. */
console.log('\n  === THE ENDURE ROUTE (the only collapse a boostsAtHPThreshold carrier can hold) ===');
{
  const END = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
    && m.target === 'self' && m.stallingMove && m.volatileStatus && !/protect|bunker|shield/i.test(m.id));
  console.log('      self-target stalling moves that are not a shield: ' + (END.length ? END.map(m => m.id).join(', ') : 'NONE'));
  const E = END.find(m => LEARNS(F.T, m.id));
  if (!E) console.log('      the carrier does not learn one -- the corner is unreachable in this format.');
  else {
    console.log('      the carrier holds with          : ' + E.name);
    const f4 = FILL.filter(s => s.name !== F.AT.name && s.name !== F.T.name).slice(0, 6);
    const A4 = [mon(F.T.name, [E.name, 'Protect'], '', AB.id),
      mon(f4[0].name, ['Protect']), mon(f4[1].name, ['Protect']), mon(f4[2].name, ['Protect'])];
    const B4 = [mon(F.AT.name, [F.MV.name, 'Protect'], '', Object.values(F.AT.abilities)[0]),
      mon(f4[3].name, ['Protect']), mon(f4[4].name, ['Protect']), mon(f4[5].name, ['Protect'])];
    const sc4 = [{ p1: [{ m: E.id }, { m: 'protect' }], p2: [{ m: norm(F.MV.id), t: 0 }, { m: 'protect' }] }];
    /* Same rule as the Sash arm above: a throw may not be laundered into `COULD NOT STAGE`. */
    let done = null; const endSkips = [];
    for (const hb of [1, 2]) {
      let a4, b4, g4;
      try { a4 = G.buildPair(A4, { hpBoost: hb }); b4 = G.buildPair(B4); }
      catch (e) { endSkips.push('x' + hb + ' buildPair THREW: ' + ((e && e.message) || e)); continue; }
      if (!a4 || !b4) { endSkips.push('x' + hb + ' buildPair returned null'); continue; }
      try { g4 = G.playGame(a4, b4, 'directed', 'bsk-endure/' + hb, { arm: ARM, script: sc4 }); }
      catch (e) { endSkips.push('x' + hb + ' playGame THREW: ' + ((e && e.message) || e)); continue; }
      if (g4.err) { endSkips.push('x' + hb + ' the game reported err: ' + g4.err); continue; }
      const sd4 = G.sdStream(G.lastSdLog()).map(fold), me4 = (g4.mediTrace || []).map(fold);
      const survived = !sd4.some(l => /^\|faint\|p1a/.test(l));
      done = { hb, sd4, me4, g4, survived };
      if (survived) break;
    }
    if (endSkips.length) { console.log('      skipped hpBoost values, with reasons:');
      for (const s of endSkips) console.log('          ' + s); }
    if (!done) console.log('      COULD NOT STAGE -- ' + (endSkips.some(s => /THREW/.test(s))
      ? 'AND THE HARNESS THREW (see above). This is NOT a claim about the fixture.'
      : 'a claim about the fixture.'));
    else {
      const K = /^\|(-damage|-hitcount|-ability|-boost|-activate|faint)\|/;
      console.log('      hpBoost x' + done.hb + '   the carrier survived: ' + done.survived);
      console.log('      showdown :'); for (const l of done.sd4.filter(x => K.test(x))) console.log('          ' + l);
      console.log('      medicham2:'); for (const l of done.me4.filter(x => K.test(x))) console.log('          ' + l);
      const hcSd = done.sd4.some(l => /^\|-hitcount\|/.test(l)), hcMe = done.me4.some(l => /^\|-hitcount\|/.test(l));
      const bsSd = done.sd4.some(l => /^\|-boost\|p1a\|spa\|/.test(l)), bsMe = done.me4.some(l => /^\|-boost\|p1a\|spa\|/.test(l));
      console.log('      -hitcount present            : showdown ' + hcSd + '   medicham2 ' + hcMe);
      console.log('      berserk -boost present       : showdown ' + bsSd + '   medicham2 ' + bsMe);
      console.log('      VERDICT: ' + (bsSd && bsMe && hcSd && !hcMe
        ? 'THE TWO DEFECTS MEET -- our line is MISSING here, not merely out of order. An ordering fix '
          + 'alone leaves this board diverging, and this board must not be used as an ordering fixture.'
        : (bsSd && bsMe && hcSd && hcMe ? 'both lines present on both sides -- only the ORDER parts here'
                                        : 'they do not co-occur on this board')));
      if (done.g4.div) { const C4 = G.classify(done.g4.div);
        console.log('      driver first divergence      : ' + C4.cls + ' -- ' + C4.detail);
        console.log('      cause                        : ' + C4.cause); }
      else console.log('      driver first divergence      : NONE');
    }
  }
}

/* ================================================================================================
 * B — SWITCHEROO (and TRICK, which shares the emitter)
 * ============================================================================================== */
console.log('\n\n================ B — SWITCHEROO ================\n');
const SWAPS = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('takesTargetItem') && v.params.takesTargetItem.swaps)
  .map(([k, v]) => ({ id: k, uses: v.uses, cat: (dex.moves.get(k) || {}).category }));
console.log('  moves tagged takesTargetItem{swaps}:');
for (const s of SWAPS) console.log('      ' + s.id.padEnd(14) + s.cat + '  (' + s.uses + ' sheets)');
const STATUS_SWAPS = SWAPS.filter(s => s.cat === 'Status');
console.log('  ...of which STATUS (the only ones `playerAction` routes to `trickitem`): '
  + STATUS_SWAPS.map(s => s.id).join(', '));

/* An item that is legal here and is NOT a mega stone (the emitter refuses those by tag). */
const legalItem = i => i.exists && !i.isNonstandard && !(TAGS.items[i.id] && (TAGS.items[i.id].tags || []).includes('megaStone'));
const ITEMS = dex.items.all().filter(legalItem).sort((a, b) => a.name.localeCompare(b.name));
const pickItem = re => ITEMS.find(i => re.test(i.id));
const I1 = pickItem(/^choicescarf$/), I2 = pickItem(/^leftovers$/);
console.log('  items used (both legal, non-mega)  : ' + (I1 && I1.name) + ' / ' + (I2 && I2.name));
if (!I1 || !I2) { console.log('  THE FORMAT DOES NOT CARRY BOTH ITEMS.'); process.exit(2); }

function playSwap(mvId, tgtItem) {
  const MVX = dex.moves.get(mvId);
  const users = POOL.filter(s => LEARNS(s, mvId) && LEARNS(s, 'protect') && NO_FIELD_AB(s));
  if (!users.length) return { why: 'no legal user of ' + mvId };
  const U = users[0];
  const tgts = POOL.filter(s => s.name !== U.name && LEARNS(s, 'protect') && NO_FIELD_AB(s)
    && !abTags(s).some(t => /item|sticky|hold/i.test(t)));
  if (tgts.length < 2) return { why: 'no legal target' };
  /* THE TARGET MUST NOT SHIELD. The first cut of this probe scripted the receiver onto Protect and
   * both engines printed one line — `|-activate|p2a|move: protect` — and agreed. That is not the
   * mechanic; it is the shield refusing it. The receiver holds with a self-targeting status move
   * derived from the format, exactly as the Berserk carrier does above. */
  const T = tgts.find(s => SELF_MOVES.some(m => LEARNS(s, m)));
  if (!T) return { why: 'no legal target that also holds with a self status move' };
  const HOLD = SELF_MOVES.find(m => LEARNS(T, m));
  const f = FILL.filter(s => s.name !== U.name && s.name !== T.name).slice(0, 6);
  if (f.length < 6) return { why: 'no fillers' };
  const A = [mon(U.name, [MVX.name, 'Protect'], I1.name, Object.values(U.abilities)[0]),
    mon(f[0].name, ['Protect']), mon(f[1].name, ['Protect']), mon(f[2].name, ['Protect'])];
  const B = [mon(T.name, [HOLD, 'Protect'], tgtItem, Object.values(T.abilities)[0]),
    mon(f[3].name, ['Protect']), mon(f[4].name, ['Protect']), mon(f[5].name, ['Protect'])];
  const script = [{ p1: [{ m: mvId, t: 0 }, { m: 'protect' }], p2: [{ m: HOLD }, { m: 'protect' }] }];
  let a, b; try { a = G.buildPair(A); b = G.buildPair(B); } catch (e) { return { why: 'buildPair threw: ' + e.message }; }
  if (!a || !b) return { why: 'buildPair returned null' };
  let g; try { g = G.playGame(a, b, 'directed', 'swap/' + mvId + (tgtItem ? '' : '/bare'), { arm: ARM, script }); }
  catch (e) { return { why: 'the game threw: ' + e.message }; }
  if (g.err) return { why: 'the game threw: ' + g.err };
  const RE = /^\|(-activate|-item|-enditem|-fail|-immune)\|/;
  return { U, T, g, sd: G.sdStream(G.lastSdLog()).map(fold).filter(l => RE.test(l)),
           me: (g.mediTrace || []).map(fold).filter(l => RE.test(l)) };
}

/* TWO ARMS PER MOVE, and the second is the half the engine's own comment calls the "missing
 * `-enditem` message defect". The authority's handler writes a `[silent]` `-enditem` for whichever
 * side handed over nothing, and the driver's `display-flags` rule drops the FLAG rather than the
 * LINE -- so a missing `-enditem` IS a compared divergence while a missing `[of]` is NOT
 * (`source-tag`, engine/game_differential.js:2007). Arm 2 gives the receiver no item at all. */
for (const s of STATUS_SWAPS) {
  for (const arm of [{ item: I2.name, what: 'both hold an item' },
                     { item: '', what: 'the RECEIVER holds nothing' }]) {
    console.log('\n  --- ' + s.id + ' (' + s.uses + ' sheets) -- ' + arm.what + ' ---');
    const r = playSwap(s.id, arm.item);
    if (r.why) { console.log('      COULD NOT STAGE: ' + r.why + '   (a claim about the fixture, not the engine)'); RC = Math.max(RC, 2); continue; }
    console.log('      ' + r.U.name + ' (' + I1.name + ') clicks ' + s.id + ' at ' + r.T.name
      + ' (' + (arm.item || 'no item') + ')');
    console.log('      showdown :'); for (const l of r.sd) console.log('          ' + l);
    console.log('      medicham2:'); for (const l of r.me) console.log('          ' + l);
    const o = multisetDiff(r.sd, r.me);
    console.log('      only in showdown : ' + (o.a.length ? o.a.join(' ; ') : 'NONE'));
    console.log('      only in medicham2: ' + (o.b.length ? o.b.join(' ; ') : 'NONE'));
    if (!r.g.div) console.log('      the driver found NO DIVERGENCE in this whole game');
    else { const C = G.classify(r.g.div);
      console.log('      driver first divergence: ' + C.cls + ' -- ' + C.detail);
      console.log('      cause                  : ' + C.cause);
      console.log('      showdown, reduced :'); for (const l of r.g.div.sdAfter.slice(0, 5)) console.log('          ' + l);
      console.log('      medicham2, reduced:'); for (const l of r.g.div.meAfter.slice(0, 5)) console.log('          ' + l); }
  }
}

console.log('\n  (diagnostic only — nothing was fixed and nothing under engine/ was edited)');
process.exit(RC);
