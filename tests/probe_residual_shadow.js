/* WHEN BOTH SIDES' TAILWIND RUNS OUT ON THE SAME TURN, WHICH `-sideend` COMES FIRST?
 *
 *   SHOWDOWN_PATH=... node tests/probe_residual_shadow.js
 *   MEDI_RESIDUAL_SHADOW_OFF=1 SHOWDOWN_PATH=... node tests/probe_residual_shadow.js   <- shows RED
 *
 * ================= WHY THIS FILE EXISTS ==========================================================
 *
 * Two rows of `data/game-differential.json` are the same shape:
 *
 *     cause: ordering :: |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind
 *
 * and docs/_reports/2026-08-24-residual-order.md left them standing on purpose, with the reason: this
 * engine's end-of-turn walk is group-major over BODIES and the authority's is one flat list of
 * HANDLERS, so a tied pair whose order depends on the swaps made while OTHER handlers were placed
 * cannot be reproduced from the body walk. `engine/medicham2-browser.js` now rebuilds that list as a
 * shadow -- see the header above `residualExpireAt` -- and this file is what says whether it works.
 *
 * ================= THE PREMISE THAT HAD TO BE REFUTED FIRST =======================================
 *
 * `Battle#speedSort` ends a tied group with `this.prng.shuffle`, so "the two Tailwinds are a coin
 * flip" is a true statement about the GAME and a false one about this measurement:
 * `game_differential.js`'s `pinShuffle` is a NO-OP in every shipped arm, so under measurement the
 * authority never re-orders a tied group and keeps whatever permutation its SELECTION SORT produced.
 * Nothing is drawn on either side here. The arms below are therefore deterministic, and the last
 * section asserts the other half -- that with a real die in scope the engine still flips a coin.
 *
 * ================= WHAT EACH ARM IS FOR, AND THE CONTROL THAT CAN FAIL ============================
 *
 * The knob is which side carries the FASTEST body and whether anything else is in the walk at all.
 * Both are properties of the BOARD, not of either engine, so the authority's own answer moves with
 * them -- which is what makes this a control rather than four copies of one case:
 *
 *   bare                 nothing else in the residual list.  Authority: p1 first.
 *   lefto-fast-p1        Leftovers on all four, fastest on p1. Authority: p1 first.
 *   nolefto-fast-p2      fastest on p2, nothing else in the list. Authority: p1 first.
 *   lefto-fast-p2        Leftovers on all four, fastest on p2.  Authority: p2 FIRST.
 *
 * THE FILE REFUSES TO PASS IF THE AUTHORITY GIVES THE SAME ANSWER ON ALL FOUR. Identical results
 * across a varied knob mean the knob is unwired, and a probe whose fixture never stages the collision
 * is exactly how `tests/probe_trace_choice.js` stayed green through a live divergence.
 *
 * IT ALSO REFUSES TO PASS IF THE TWO TAILWINDS DO NOT END ON THE SAME TURN. That is the collision;
 * without it every arm agrees for free.
 *
 * ================= AND THE LIST ITSELF IS HELD AGAINST THE AUTHORITY'S ============================
 *
 * The shadow is a REBUILD, so "the four arms agree" could be luck. Under
 * `MEDI_RESIDUAL_SHADOW_ALWAYS=1` the engine logs every list it builds, and this file dumps the
 * authority's real `fieldEvent` list beside it and compares them phase by phase: the length, and the
 * multiset of the (order, subOrder, speed) triples `comparePriority` actually reads. A missing entry
 * shifts every index after it, so this is the check that separates a derived answer from a lucky one.
 * The exact per-phase agreement rate is PRINTED rather than asserted at 100%: two approximations are
 * declared in the engine header (volatile insertion order, and Tailwind's position among the side
 * conditions) and this is the instrument that measures what they cost.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--state')) process.argv.push('--state');
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
/* The list comparison needs every phase, so this file arms the log itself rather than asking the
 * caller to remember an env var. */
process.env.MEDI_RESIDUAL_SHADOW_ALWAYS = '1';

/* ---- the authority's own residual list, captured before it is sorted and after ------------------ */
const SD = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const SDLOG = [];
let CAP = false;
const _fieldEvent = SD.Battle.prototype.fieldEvent;
SD.Battle.prototype.fieldEvent = function (eventid, targets) {
  if (eventid !== 'Residual' || !CAP) return _fieldEvent.call(this, eventid, targets);
  const orig = this.speedSort, self = this;
  this.speedSort = function (list, cmp) {
    const r = orig.call(self, list, cmp);
    SDLOG.push(list.map(h => ({
      /* exactly the four keys `comparePriority` reads that can differ here; `effectOrder` is filled
       * only for SwitchIn/RedirectTarget (sim/battle.ts:993-999) and is 0 for every residual. */
      ord: h.order || 4294967296, sub: h.subOrder | 0, spe: h.speed || 0,
      id: (h.effect && h.effect.id) || '?',
      side: (h.effectHolder && h.effectHolder.sideConditions) ? h.effectHolder.id : '',
    })));
    self.speedSort = orig;
    return r;
  };
  const out = _fieldEvent.call(this, eventid, targets);
  this.speedSort = orig;
  return out;
};

const G = require(D('engine', 'game_differential.js'));
globalThis.window = globalThis;
require(D('data', 'engine-data.js'));
/* THE ENGINE THE GAME ACTUALLY RAN, NOT THE ONE ON DISK. `game_differential` plays a FROZEN release
 * (`REL.require`), so a plain `require` here would hand back a second module instance whose counters
 * and whose shadow log are empty — which reads exactly like a feature that never fired. This was the
 * first version of this file and it reported `0 residual phases` while the arms were green. */
const M = G.REL.require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* ================= THE FIXTURE, DERIVED ==========================================================
 *
 * Nothing here is a typed species key. Two Tailwind users are taken off the format's own learnsets and
 * the two partners are the legal species with the HIGHEST and LOWEST base Speed among a filtered walk,
 * so the fastest-body knob is a fact about the dex rather than a recollection. Every pick is printed.
 */
const LS_THREW = [];
function deriveFixture() {
  const learners = [], all = [];
  for (const s of dex.species.all()) {
    if (!legal(s)) continue;
    /* `s.id` HAS NO DASH — `aerodactylmega`, not `aerodactyl-mega` — so the obvious id regex matched
     * nothing and the first run of this file put a mega FORME on the board as a team member, which is
     * not a legal entry. The forme field is the derived answer. */
    if (/^Mega/.test(s.forme || '') || s.isMega) continue;
    all.push(s);
    let ls = null;
    /* A LEARNSET THAT CANNOT BE READ IS NOT A SPECIES THAT CANNOT LEARN TAILWIND. Swallowing it would
     * shrink the derived pool silently and the fixture would still look derived, so the reason is
     * counted and printed and the file refuses to pass on a non-zero count. */
    try { ls = dex.species.getLearnsetData(s.id); }
    catch (e) { LS_THREW.push(s.id + ': ' + ((e && e.message) || e)); ls = null; }
    if (ls && ls.learnset && ls.learnset.tailwind) learners.push(s);
  }
  learners.sort((a, b) => a.baseStats.spe - b.baseStats.spe || (a.id < b.id ? -1 : 1));
  const bySpe = all.slice().sort((a, b) => b.baseStats.spe - a.baseStats.spe || (a.id < b.id ? -1 : 1));
  /* the two Tailwind carriers are taken from the MIDDLE of the learner list so neither is itself the
   * fastest or the slowest body on the board — the knob has to be the PARTNER. */
  const mid = Math.floor(learners.length / 2);
  /* the extra clocks the wider arms need, each taken off the same filtered walk rather than named:
   * a Reflect user (a SECOND tie class, at 26/1, reached through the side-condition bag rather than
   * through Tailwind's own field counter) and a Trick Room user (the ONE place the shadow list applies
   * the authority's `10000 - speed` transform). */
  const learns = (s, mv) => { let ls = null;
    try { ls = dex.species.getLearnsetData(s.id); }
    catch (e) { LS_THREW.push(s.id + ': ' + ((e && e.message) || e)); return false; }
    return !!(ls && ls.learnset && ls.learnset[mv]); };
  const refl = all.filter(s => learns(s, 'reflect')).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
  const troom = all.filter(s => learns(s, 'trickroom')).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
  return { learners, twA: learners[mid], twB: learners[mid + 1],
           fast: bySpe[0], slow: bySpe[bySpe.length - 1], nAll: all.length,
           reflA: refl[0], reflB: refl[1], troom: troom[0],
           nRefl: refl.length, nTroom: troom.length };
}
const F = deriveFixture();
let bad = 0;
console.log('RESIDUAL SHADOW — two Tailwinds ending on one turn\n');
console.log('  release ' + G.REL.id + ', arm ' + G.PRIMARY_ARM.id);
console.log('  DERIVED FIXTURE — ' + F.nAll + ' legal species walked, ' + F.learners.length
  + ' of them learn Tailwind');
if (LS_THREW.length) {
  console.log('  FIXTURE — ' + LS_THREW.length + ' learnset read(s) THREW, so the derived pool is '
    + 'smaller than the format and the picks below are not what they claim: ' + LS_THREW.slice(0, 3).join(' | '));
  bad++;
}
if (!F.twA || !F.twB || !F.fast || !F.slow) {
  console.log('  FIXTURE — the dex walk produced no usable board. This is not a pass.');
  process.exit(1);
}
console.log('    tailwind carriers  ' + F.twA.name + ' (' + F.twA.baseStats.spe + ') / '
  + F.twB.name + ' (' + F.twB.baseStats.spe + ')');
console.log('    fastest / slowest  ' + F.fast.name + ' (' + F.fast.baseStats.spe + ') / '
  + F.slow.name + ' (' + F.slow.baseStats.spe + ')');
if (!(F.fast.baseStats.spe > F.twA.baseStats.spe && F.fast.baseStats.spe > F.twB.baseStats.spe)) {
  console.log('  FIXTURE — the "fastest" partner is not faster than both carriers, so the knob does '
    + 'not move which body heads the list. This is not a pass.');
  bad++;
}

const mon = (species, item, moves) => ({ species, item: item || '', ability: '', moves });
const FILLER = () => mon(F.slow.name, '', ['Protect']);
/* PROTECT ON THE PARTNER, TAILWIND ON THE CARRIER, EVERY TURN. Re-clicking Tailwind is what the two
 * pool games do — the authority answers `|-fail|` and the side condition is untouched — so the board
 * stays still while the clock runs down, and no move in the script is below 100 accuracy (the arm's
 * pin makes anything less MISS, which stages nothing). */
const STEP = { p1: [{ m: 'tailwind' }, { m: 'protect' }], p2: [{ m: 'tailwind' }, { m: 'protect' }] };
const SCRIPT = [STEP, STEP, STEP, STEP, STEP, STEP];

function arm(id, lefto, fastSide, opt) {
  opt = opt || {};
  const it = lefto ? 'Leftovers' : '';
  const p1b = opt.p1b || mon((fastSide === 'p1' ? F.fast : F.slow).name, it, ['Protect']);
  const p2b = opt.p2b || mon((fastSide === 'p2' ? F.fast : F.slow).name, it, ['Protect']);
  const A = [mon(F.twA.name, it, ['Tailwind', 'Protect']), p1b, FILLER(), FILLER()];
  const B = [mon(F.twB.name, it, ['Tailwind', 'Protect']), p2b, FILLER(), FILLER()];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { id, err: 'buildPair returned null' };
  SDLOG.length = 0; M.residualShadowProbe.reset(); CAP = true;
  const r = G.playGame(a, b, 'directed', 'resshadow:' + id, { script: opt.script || SCRIPT });
  CAP = false;
  const sdEnd = (G.lastSdLog() || []).filter(l => /-sideend\|.*Tailwind/i.test(l))
    .map(l => (/\|p(\d)/.exec(l) || [])[1]);
  const meEnd = (r.mediTrace || []).filter(l => /-sideend\|.*tailwind/i.test(l))
    .map(l => (/\|p(\d)/.exec(l) || [])[1]);
  /* EVERY `-sideend` IN ORDER, not just Tailwind's — the screens arm ends four side conditions in one
   * game and a verdict that read only Tailwind would score half of it. Folded to `<side>:<effect>`
   * because the two engines spell the slot suffix differently and that is not what is under test. */
  const seq = (lines) => lines.filter(l => /^\|-sideend\|/.test(String(l)))
    .map(l => { const m = /^\|-sideend\|(p\d)[^|]*\|(?:move: )?(.+)$/.exec(String(l));
                return m ? m[1] + ':' + m[2].toLowerCase().replace(/[^a-z0-9]/g, '') : '?'; });
  return { id, lefto, fastSide, err: r.err, turns: r.turns, div: r.div || r.stateDiv,
           sdEnd, meEnd, sdSeq: seq(G.lastSdLog() || []), meSeq: seq(r.mediTrace || []),
           sdLists: SDLOG.map(x => x.slice()),
           meLists: M.residualShadowProbe().log };
}

/* ---- the wider arms: a SECOND tie class, and the Trick Room speed transform ---------------------
 * The four above only ever put Leftovers, Protect and `stall` in the authority's list, so they say
 * nothing about the rest of the membership table. These two put a screen on BOTH sides (26/1, reached
 * through the side-condition bag rather than through Tailwind's field counter) and stand a Trick Room
 * up over the whole walk (`Pokemon#getActionSpeed` stores `10000 - speed`, and doing that in the
 * comparator instead — the way this engine expresses Trick Room everywhere else — would put every
 * Side ABOVE every body). Both are compared list-for-list against the authority below. */
const REPEAT = (n, x) => Array.from({ length: n }, () => x);
const WIDE = [];
if (F.reflA && F.reflB) WIDE.push(arm('screens-both-sides', true, 'p2', {
  p1b: mon(F.reflA.name, 'Leftovers', ['Reflect', 'Protect']),
  p2b: mon(F.reflB.name, 'Leftovers', ['Reflect', 'Protect']),
  script: REPEAT(6, { p1: [{ m: 'tailwind' }, { m: 'reflect' }],
                      p2: [{ m: 'tailwind' }, { m: 'reflect' }] }) }));
if (F.troom) WIDE.push(arm('trick-room-up', true, 'p2', {
  p1b: mon(F.troom.name, 'Leftovers', ['Trick Room', 'Protect']),
  script: [{ p1: [{ m: 'tailwind' }, { m: 'trickroom' }], p2: [{ m: 'tailwind' }, { m: 'protect' }] }]
    .concat(REPEAT(5, { p1: [{ m: 'tailwind' }, { m: 'protect' }],
                        p2: [{ m: 'tailwind' }, { m: 'protect' }] })) }));
const ARMS = [arm('bare', false, 'p1'), arm('lefto-fast-p1', true, 'p1'),
              arm('nolefto-fast-p2', false, 'p2'), arm('lefto-fast-p2', true, 'p2')].concat(WIDE);
console.log('    reflect / trick room users derived: ' + F.nRefl + ' / ' + F.nTroom
  + (WIDE.length === 2 ? '' : '   <- one wider arm could not be staged'));
if (WIDE.length !== 2) bad++;

/* ---- 1. THE FIXTURE ACTUALLY STAGES THE COLLISION ----------------------------------------------- */
console.log('\n  THE COLLISION — both Tailwinds must end, in both engines, on ONE turn:');
for (const a of ARMS) {
  const ok = a.sdEnd.length === 2 && a.meEnd.length === 2;
  console.log('    ' + (ok ? 'STAGED    ' : 'NOT-STAGED') + ' ' + a.id.padEnd(20)
    + ' showdown ends [' + a.sdEnd.join(',') + ']  medicham [' + a.meEnd.join(',') + ']'
    + (a.err ? '  ERR ' + a.err : ''));
  if (!ok) bad++;
}

/* ---- 2. THE KNOB MOVES THE AUTHORITY ------------------------------------------------------------ */
const sdAnswers = new Set(ARMS.slice(0, 4).map(a => a.sdEnd.join(',')).filter(x => x));
console.log('\n  THE KNOB — the authority\'s own answers across the four arms: '
  + [...sdAnswers].map(x => '[' + x + ']').join(' '));
if (sdAnswers.size < 2) {
  console.log('    FAILED: the authority gives ONE answer on every arm, so this fixture cannot see '
    + 'the defect it exists for. An unwired knob and a fixed rule read the same here.');
  bad++;
}

/* ---- 3. DO THE TWO ENGINES AGREE? --------------------------------------------------------------- */
console.log('\n  THE VERDICT — Showdown is the expectation; nothing here carries a typed answer:');
for (const a of ARMS) {
  const agree = a.sdSeq.join(',') === a.meSeq.join(',');
  console.log('    ' + (agree ? 'AGREES  ' : 'DIFFERS ') + a.id.padEnd(20)
    + ' sd [' + a.sdSeq.join(' ') + ']');
  if (!agree) {
    console.log('        me [' + a.meSeq.join(' ') + ']');
    bad++; if (a.div) console.log('        ' + JSON.stringify(a.div).slice(0, 260));
  }
}

/* ---- 4. THE REBUILT LIST AGAINST THE AUTHORITY'S REAL ONE --------------------------------------- */
const key = e => e.ord + '/' + e.sub + '/' + e.spe;
let phases = 0, lenOk = 0, msOk = 0;
const shapes = new Map();
for (const a of ARMS) {
  const n = Math.min(a.sdLists.length, a.meLists.length);
  for (let i = 0; i < n; i++) {
    phases++;
    const sd = a.sdLists[i], me = a.meLists[i];
    if (sd.length === me.length) lenOk++;
    const ms = xs => xs.map(key).sort().join(' ');
    if (ms(sd) === ms(me)) msOk++;
    else {
      const only = (x, y) => { const c = y.map(key).sort(); return x.map(key).sort()
        .filter(k => { const j = c.indexOf(k); if (j >= 0) { c.splice(j, 1); return false; } return true; }); };
      const s = 'sd-only ' + JSON.stringify(only(sd, me)) + '  me-only ' + JSON.stringify(only(me, sd));
      shapes.set(s, (shapes.get(s) || 0) + 1);
    }
  }
}
console.log('\n  THE REBUILT LIST vs THE AUTHORITY\'S, ' + phases + ' residual phases:');
console.log('    same length                ' + lenOk + '/' + phases);
console.log('    same (order,subOrder,speed) multiset  ' + msOk + '/' + phases);
for (const [s, c] of [...shapes.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6))
  console.log('      x' + c + '  ' + s);
if (!phases) { console.log('    FAILED: no phase was captured on either side, so nothing was compared.'); bad++; }
const P = M.residualShadowProbe();
console.log('    artifact volatile rows with NO reader in this engine: '
  + (P.unread.length ? P.unread.join(',') : '(none)'));

/* ---- 5. AND WITH A REAL DIE IT IS STILL A COIN --------------------------------------------------- */
/* The four arms run under the harness pin, which neutralises the shuffle on BOTH sides. That proves
 * the two land together and says nothing about whether a genuine tie is a coin flip — which it is
 * (`speedSort` shuffles), and which a hardcoded "side B first" would pass every arm above while
 * getting wrong in every rollout and every live game. */
{
  const L = () => ([{ key: 'side:A:tailwind', ord: 26, sub: 5, spe: 0 },
                    { key: 'side:B:tailwind', ord: 26, sub: 5, spe: 0 }]);
  const N = 400;
  let second = 0, sorter = M.residualShadowSortForTest;
  if (typeof sorter !== 'function') {
    console.log('\n  NOT ASSERTED — the engine exports no handle on the shadow sort, so "a tie is a '
      + 'coin" was not checked. That is a gap, not a pass.');
    bad++;
  } else {
    for (let i = 0; i < N; i++) if (sorter(L(), Math.random)[0].key === 'side:B:tailwind') second++;
    const p = second / N;
    console.log('\n  UNDER REAL DICE the tied pair comes out B-first ' + second + '/' + N
      + ' (' + (p * 100).toFixed(1) + '%). A coin is the RULE; the pinned answer is not.');
    if (!(p > 0.4 && p < 0.6)) {
      console.log('    FAILED: a residual tie is not a coin flip. A hardcoded side passes every board '
        + 'arm above and is wrong in every rollout.');
      bad++;
    }
  }
}

console.log('\n  ' + (bad ? 'FAILED — ' + bad + ' problem(s)' : 'PASS'));
process.exitCode = bad ? 1 : 0;
