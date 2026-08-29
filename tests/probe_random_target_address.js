#!/usr/bin/env node
/* tests/probe_random_target_address.js — ROADMAP #478
 * ==================================================================================================
 * CAN THE `randomNormal` TARGET DIE BE SHARED BY BLANKING OUR ADDRESS?
 *
 * THE PROPOSAL THIS FILE EXISTS TO TEST. Six legal moves are `randomNormal` (Outrage, Petal Dance,
 * Raging Fury, Thrash, Uproar and Struggle) and neither engine honours the caller's chosen target for
 * them: `sim/battle.ts:2484` falls through to `getRandomTarget` -> `side.randomFoe()` ->
 * `sample(this.foes())`, and `medicham2-browser.js` WIRE 144 re-rolls the same uniform. Under the
 * middle arm both draws are served by ONE hash of an ADDRESS, so if the two engines built the same
 * address they would take the same value and hit the same body. They do not:
 *
 *     authority    20260813|2|any|-|-|<nth>          <- activeMove/activeTarget are still null
 *     this engine  20260813|2|any|outrage|p20|0      <- MID_MOVE/MID_TGT written at the top of the action
 *
 * The authority resolves the target ABOVE `setActiveMove` (sim/battle-actions.ts:222 vs :245), so its
 * address carries blanks. The proposal is therefore to blank OURS at that one draw.
 *
 * WHY THAT IS NOT SAFE, AND WHY THIS IS A PROBE RATHER THAN A PATCH. Dropping fields makes an address
 * LESS specific. The authority's blank bucket is not "the random-target draw" — it is EVERY draw taken
 * with no move in scope, and the `nth` repeat counter is the only thing separating them. Two engines
 * that agree on a base and disagree on how many draws precede it read each other's dice. That is a
 * worse defect than the one being fixed and it is nearly invisible, so it is MEASURED here before
 * anything is landed.
 *
 * WHAT IT PRINTS, AND CLAUSE 4 IS THE CONTROL THAT MAKES 3 READABLE:
 *
 *   1  how many DISTINCT call sites draw in the authority's blank `any` bucket, taken from the real
 *      stack rather than reasoned about, and how many draws share a base
 *   2  the `nth` the authority's runMove target draw actually carries
 *   3  BLANKED AT nth=0 (the proposal, exactly as it would be implemented) — does it recover the
 *      authority's pick, judged against the 1/candidates floor a coin would score
 *   4  NEGATIVE CONTROL — the same draw addressed to the WRONG TURN. It must sit on that floor, or
 *      this file cannot see a miss and clause 3 means nothing.
 *   5  how far `nth` actually moves the value, because that is what clause 3's rate rests on
 *   6  our own blank bucket — the "with the change" half of the enumeration
 *   7  the draws the proposal would STILL get wrong, named
 *   8  `--focus <substring of a pair tag>`: one named game, so "would this reach board-material zero"
 *      is answered against the game `data/game-differential.json` records
 *
 * CLAUSE 4 WAS WRONG BEFORE THE ENGINE WAS. Its first form re-hashed `base + '|' + nth`, which IS the
 * authority's own address string — 100% by construction, incapable of being wrong, and read as "the
 * arithmetic checks out". A control that cannot fail is not a control.
 *
 * IT IS A MEASUREMENT, NOT A GATE. It exits 0 whatever it finds and prints the numbers.
 *
 * WHAT IT FOUND, 2026-08-27, release 7f7de860723b, 961 games, the pinned pool and census.
 * **THE COLLISION IS REAL AND IT BITES**, so the proposal was NOT landed:
 *   - 11 call sites draw in the blank bucket; the runMove target draw is 137 of 1,332 (10%) of it
 *   - 291 of 668 base addresses (43.6%) carry more than one draw, deepest 12
 *   - the authority's target draw is NEVER at nth 0 (it runs 1..11); ours would be
 *   - blanked-at-0 still picks the authority's body 136 of 137 (99.3%) against a 65.0% coin floor —
 *     but only because FNV-1a's trailing digit is worth at most 0.0352 of a [0,1) draw. The one draw
 *     where `nth` reached two digits FLIPPED. A hash that mixed `nth` would make this a coin.
 * Full account: docs/_reports/2026-08-27-random-target-address.md. Register ROADMAP #478.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
function argFlag(n) { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; }
/* READ TWICE ON PURPOSE — `game_differential.js` parses this same argv AT REQUIRE TIME and sizes its
 * steering pool from `--games`, so a default that only exists in a local here is a different default
 * downstream. Same reasoning as tests/test-middle-identity.js. */
if (!argFlag('--games')) process.argv.push('--games', '200');
if (!argFlag('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
if (!argFlag('--arm')) process.argv.push('--arm', 'middle');
const GAMES = +argFlag('--games');

const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));
/* THE ENGINE COMES OUT OF THE DIFFERENTIAL'S OWN RELEASE. Requiring medicham2 directly here would
 * load a SECOND module instance whose event fields nothing writes — the log comes back all blanks,
 * which reads exactly like the defect under test. */
const M = GD.REL.require('engine/medicham2-browser.js');
const ARM = GD.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE SITE OF EACH DRAW, READ OFF THE REAL STACK ---------------------------------------------
 * Named rather than guessed: a paraphrase of who calls `sample()` is a value typed from memory. */
const SITES = [], SIZES = [];
function site() {
  const st = new Error().stack.split('\n').slice(2, 24);
  const f = [];
  for (const l of st) {
    const m = /at ([\w.<>$ ]+?) \(/.exec(l);
    const w = /(sim[\\/][\w-]+\.js)/.exec(l);
    if (w) f.push((m ? m[1].trim() : '?') + '@' + w[1].replace(/^sim[\\/]/, ''));
    if (f.length >= 6) break;
  }
  return f.join(' < ');
}
/* ---- A DRAW IS NOT AN ADDRESS, AND THIS FILE ASSUMED IT WAS. FIXED 2026-08-29 -------------------
 *
 * `sd` below is the authority's ADDRESS LOG and `SITES` was every call to `ARM.random`/`ARM.chance`.
 * The file then asserted the two were the same length and exited 2 — "this file's bookkeeping is off
 * and nothing below is readable" — on `sd=61 sites=62`, which is where it has sat since 2026-08-27.
 *
 * THE BOOKKEEPING WAS OFF, AND THE ENGINE WAS NOT. `game_differential.js:1349` is
 *
 *     if (n !== undefined && MIDW.cat !== 'dmg' && !MID_RANGE_LIVE) { MID_RANGE_PINNED++; return m; }
 *
 * — the TWO-ARGUMENT range form outside `getDamage` is PINNED to `m` and returns before `midDraw`,
 * and its own comment says so in as many words: "it consumes NO shared address." So a range draw is a
 * call with no address by design, and one-address-per-call was never true.
 *
 * MEASURED RATHER THAN REASONED, over 40 pinned games: 7 games mismatched, and EVERY call that
 * produced no address was the two-argument form — `random(0,2)` x4, `random(1,3)` x2, `random(2,6)` x2,
 * `random(2,4)` x1. Not one scalar or `chance` call was ever missing.
 *
 * SO THE SITE IS RECORDED ONLY WHEN AN ADDRESS WAS ACTUALLY CONSUMED, and that is DERIVED from the
 * log growing rather than from a rule about which forms are pinned. `MID_RANGE_LIVE` and the `dmg`
 * exclusion have both moved once already this month; a predicate copied in here would go stale
 * silently and re-open exactly this defect, one register row later. */
const oR = ARM.random, oC = ARM.chance;
const addrLen = () => GD.midAddresses().sd.length;
ARM.random = function (m, n) {
  const before = addrLen(), s = site(), z = (n === undefined ? m : null);
  const r = oR.call(this, m, n);
  if (addrLen() > before) { SITES.push(s); SIZES.push(z); }
  return r;
};
ARM.chance = function (a, b) {
  const before = addrLen(), s = site();
  const r = oC(a, b);
  if (addrLen() > before) { SITES.push(s); SIZES.push(null); }
  return r;
};

/* the one site the proposal is about: runMove -> getTarget -> getRandomTarget -> randomFoe -> sample */
const RUNMOVE_TARGET = /Side\.randomFoe.*BattleActions\.runMove/;

const byBase = new Map();           // game#base -> [site, ...] in draw order
const perSite = new Map();
const nthHist = new Map();
const meBase = new Map();           // OUR blank bucket: game#base -> count
let games = 0, threw = 0, totalDraws = 0, blank = 0, meDraws = 0, meBlank = 0;
let PR_TAG = '', PR_CFG = '';
let cl3ok = 0, cl3n = 0, cl4ok = 0, cl4n = 0, floorSum = 0;
const NTH_DELTA = [], NTH_MARGIN = [], FLIPS = [], FOCUS_ROWS = [];
/* the ONE board-material game of the pinned 961, read out of data/game-differential.json's
 * `state.first_board_divergences` rather than typed — so the report can say whether landing the
 * proposal would actually reach board-material zero. */
const FOCUS = argFlag('--focus');
const candHist = new Map();

const CONFIGS = GD.SW.out.map(c => c.config);
outer:
for (const cfg of CONFIGS) {
  for (const pr of GD.pairsFor(cfg)) {
    GD.midResetAddresses(); SITES.length = 0; SIZES.length = 0;
    PR_TAG = pr.tag; PR_CFG = cfg;
    try { GD.playGame(pr.a, pr.b, cfg, 'randomtargetaddr', { arm: ARM }); }
    catch (e) { threw++; continue; }
    const sd = GD.midAddresses().sd;
    totalDraws += sd.length;
    /* KEPT, AND IT SHOULD NOW BE UNREACHABLE. The wrapper above records a site only when the address
     * log actually grew, so a mismatch here no longer means "a pinned range draw happened" — it means
     * a draw reached `midDraw` without going through `ARM.random`/`ARM.chance`, or the reverse, and
     * every index below would then be reading another draw's stack. That is still worth exiting on. */
    if (sd.length !== SITES.length) {
      console.log('  LENGTH MISMATCH sd=' + sd.length + ' sites=' + SITES.length
        + ' — a draw took a shared address without passing through this file\'s wrappers (or the '
        + 'reverse). Every stack below would be attributed to the wrong draw, so nothing is readable.');
      process.exit(2);
    }
    for (let i = 0; i < sd.length; i++) {
      const p = sd[i].split('|');
      if (!(p[2] === 'any' && p[3] === '-' && p[4] === '-')) continue;
      blank++;
      const base = p.slice(0, 5).join('|');
      const key = games + '#' + base;
      if (!byBase.has(key)) byBase.set(key, []);
      byBase.get(key).push(SITES[i]);
      perSite.set(SITES[i], (perSite.get(SITES[i]) || 0) + 1);
      if (!RUNMOVE_TARGET.test(SITES[i])) continue;
      /* THE DRAW THE PROPOSAL IS ABOUT. */
      const nth = +p[5], cand = SIZES[i];
      nthHist.set(nth, (nthHist.get(nth) || 0) + 1);
      if (!(cand > 0)) continue;
      candHist.set(cand, (candHist.get(cand) || 0) + 1);
      const pickAuth = Math.floor(M.midEventValue(sd[i]) * cand);
      const pickZero = Math.floor(M.midEventValue(base + '|0') * cand);
      /* THE NEGATIVE CONTROL. A DIFFERENT TURN is a genuinely different address, so this arm must sit
       * on the coin floor. Its previous form re-hashed `base + '|' + nth`, which IS `sd[i]` — a clause
       * that was 100% by construction and could never have been wrong. */
      const wrongTurn = [p[0], (+p[1]) + 1, p[2], p[3], p[4]].join('|');
      const pickWrong = Math.floor(M.midEventValue(wrongTurn + '|' + nth) * cand);
      cl3n++;
      if (pickZero === pickAuth) cl3ok++;
      else FLIPS.push({ tag: PR_TAG, cfg: PR_CFG, addr: sd[i], cand, auth: pickAuth, zero: pickZero });
      if (FOCUS && PR_TAG.indexOf(FOCUS) >= 0)
        FOCUS_ROWS.push({ tag: PR_TAG, addr: sd[i], cand, auth: pickAuth, zero: pickZero,
                          agree: pickZero === pickAuth });
      cl4n++; if (pickWrong === pickAuth) cl4ok++;
      floorSum += 1 / cand;
      /* how far the repeat index moved the VALUE on this real draw, and how close that value came to
       * a boundary between candidates — the two numbers that decide whether clause 3's agreement is
       * a shared die or a hash that ignores `nth` */
      /* THE CIRCULAR distance, not the absolute one. The two values are near-TRANSLATES modulo 1
       * (clause 5), so |0.98 - 0.04| = 0.94 is really a step of 0.06 that WRAPPED — and a wrap can
       * still cross a candidate boundary, which is why the flips below are COUNTED rather than
       * inferred from this number. */
      { const d = Math.abs(M.midEventValue(sd[i]) - M.midEventValue(base + '|0'));
        NTH_DELTA.push(Math.min(d, 1 - d)); }
      if (cand > 1) {
        const v = M.midEventValue(sd[i]);
        let near = 1; for (let q = 1; q < cand; q++) near = Math.min(near, Math.abs(v - q / cand));
        NTH_MARGIN.push(near);
      }
    }
    /* ---- OUR OWN BLANK BUCKET — the "WITH THE CHANGE" half of the enumeration -------------------
     * The proposal moves the WIRE 144 draw into `<seed>|<turn>|any|-|-|<nth>`, and OUR `nth` there is
     * whatever this engine's own blank-bucket counter has already reached. Enumerated rather than
     * assumed, because "it will be 0" is the assumption the collision hazard lives inside. */
    for (const a of M.midEventLog()) {
      meDraws++;
      const q = a.split('|');
      if (!(q[2] === 'any' && q[3] === '-' && q[4] === '-')) continue;
      meBlank++;
      const k = games + '#' + q.slice(0, 5).join('|');
      meBase.set(k, (meBase.get(k) || 0) + 1);
    }
    if (++games >= GAMES) break outer;
  }
}

const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
console.log('\n================================================================================');
console.log('  RANDOM-TARGET ADDRESS — release ' + GD.REL.id + ', arm ' + ARM.id
  + ', ' + games + ' games' + (threw ? ', ' + threw + ' threw' : ''));
console.log('  authority draws ' + totalDraws + ',  of them in the BLANK `any` bucket ' + blank);

console.log('\n1. THE BLANK BUCKET IS NOT ONE EVENT — every call site that draws in it');
for (const [s, c] of [...perSite].sort((a, b) => b[1] - a[1]))
  console.log('   ' + String(c).padStart(6) + '  ' + s);
let multi = 0, once = 0, maxRun = 0;
for (const [, ls] of byBase) { if (ls.length > 1) multi++; else once++; if (ls.length > maxRun) maxRun = ls.length; }
console.log('   base addresses ' + byBase.size + ':  drawn ONCE ' + once
  + ',  drawn MORE THAN ONCE ' + multi + ' (' + pc(multi, byBase.size) + '),  deepest ' + maxRun);
console.log('   a base drawn more than once is a COLLISION: `nth` is a counter, so the ORDER of the '
  + 'preceding\n   draws decides which value each event gets, and those preceding draws are events '
  + 'this engine\n   does not make at all.');

console.log('\n2. THE `nth` THE AUTHORITY\'S runMove TARGET DRAW ACTUALLY CARRIES');
const tot2 = [...nthHist.values()].reduce((a, b) => a + b, 0);
for (const [k, v] of [...nthHist].sort((a, b) => a[0] - b[0]))
  console.log('   nth=' + String(k).padStart(2) + '   ' + String(v).padStart(5) + '   ' + pc(v, tot2));
console.log('   candidates per draw: ' + [...candHist].sort((a, b) => a[0] - b[0]).map(([k, v]) => k + 'x' + v).join('  '));

console.log('\n3. THE PROPOSAL — our draw blanked, taken at nth=0');
console.log('   picks the authority\'s body   ' + cl3ok + ' of ' + cl3n + '   ' + pc(cl3ok, cl3n));
console.log('   a coin over the same candidates would score ' + pc(floorSum, cl3n)
  + '  <- the floor. Level with it means UNSHARED.');

console.log('\n4. NEGATIVE CONTROL — the same draw addressed to the WRONG TURN');
console.log('   picks the authority\'s body   ' + cl4ok + ' of ' + cl4n + '   ' + pc(cl4ok, cl4n)
  + '   must sit on the ' + pc(floorSum, cl4n) + ' floor. Above it, this file cannot see a miss.');

/* ---- 5. WHY CLAUSE 3 SCORES WHAT IT SCORES — the hash's sensitivity to `nth` ---------------------
 * FNV-1a's last step is `h = (h ^ c) * 0x01000193`, so two addresses differing only in the trailing
 * repeat index differ by `d * 16777619 (mod 2^32)` with d small — at most ~0.035 of the unit interval.
 * The repeat index therefore barely moves the die, which is what makes a shared-bucket collision LOOK
 * harmless here. It is measured, not argued, because it is the fact clause 3 rests on. */
console.log('\n5. HOW MUCH `nth` ACTUALLY MOVES THE VALUE — the reason clause 3 reads as it does');
{
  const mx = NTH_DELTA.length ? Math.max.apply(null, NTH_DELTA) : 0;
  const mn = NTH_MARGIN.length ? Math.min.apply(null, NTH_MARGIN) : 1;
  console.log('   on the ' + NTH_DELTA.length + ' real draws, the CIRCULAR step from nth=0 to the '
    + 'authority\'s nth is at most ' + mx.toFixed(4));
  console.log('   the CLOSEST any of those ' + NTH_MARGIN.length
    + ' multi-candidate values came to a boundary was ' + mn.toFixed(4));
  console.log('   draws where that step moved the PICK across a boundary: ' + (cl3n - cl3ok) + ' of '
    + cl3n + (cl3n > cl3ok ? '  — clause 3\'s miss,\n   and it is the collision biting.'
      : '  — none here, which is a fact\n   about this sample and not a property.'));
  /* THE MECHANISM, SWEPT OVER MANY BASES RATHER THAN DEMONSTRATED ON ONE. FNV-1a ends
   * `h = (h ^ c) * 0x01000193`, so two addresses differing only in a trailing digit differ by
   * `d * 16777619 (mod 2^32)` — a TRANSLATION modulo 1, small while the index is one character and
   * larger once it grows a second. It is a translation and not a re-hash, which is the whole point:
   * `nth` does not mix. Measured across 2,000 bases so the bound does not rest on one lucky prefix. */
  const circ = (x, y) => { const d = Math.abs(x - y); return Math.min(d, 1 - d); };
  let single = 0, twoDig = 0;
  for (let k = 0; k < 2000; k++) {
    const b = '20260813|' + k + '|any|-|-|', v0 = M.midEventValue(b + '0');
    for (let i = 1; i <= 9; i++) single = Math.max(single, circ(M.midEventValue(b + i), v0));
    for (let i = 10; i < 16; i++) twoDig = Math.max(twoDig, circ(M.midEventValue(b + i), v0));
  }
  console.log('   THE MECHANISM: FNV-1a ends `h = (h ^ c) * 0x01000193`, so the trailing index only');
  console.log('   TRANSLATES the value modulo 1 — it does not mix. Swept over 2,000 bases, a one-DIGIT');
  console.log('   index moves it by at most ' + single.toFixed(4) + ' (' + (100 * single).toFixed(1)
    + ' points of a [0,1) draw); a two-digit index reaches ' + twoDig.toFixed(4) + '.');
  console.log('   THE CLAUSE 1 COLLISION IS REAL AND THIS IS WHAT MASKS IT. That is not a safety');
  console.log('   argument: a hash that mixed `nth` properly would turn clause 3 into a coin.');
}

console.log('\n6. OUR OWN BLANK BUCKET — where the proposal would put the draw');
{
  let m1 = 0, m2 = 0, deep = 0;
  for (const [, c] of meBase) { if (c > 1) m2++; else m1++; if (c > deep) deep = c; }
  console.log('   medicham2 draws ' + meDraws + ',  of them blank-`any` ' + meBlank
    + ',  base addresses ' + meBase.size);
  console.log('   drawn ONCE ' + m1 + ',  drawn MORE THAN ONCE ' + m2 + ',  deepest ' + deep);
  const nths = [...nthHist.keys()].sort((a, b) => a - b);
  console.log('   the authority reaches its runMove target draw at nth ' + nths.join('/')
    + (nthHist.has(0) ? '' : ' — NEVER 0') + ', across ' + perSite.size + ' blank-bucket call sites.');
  console.log('   The sites ahead of it in the queue — getActionSpeed, addChoice, insertChoice and the '
    + 'residual\n   fieldEvent sample — are draws this engine does not make at all, so there is no nth '
    + 'it can pick\n   that lands on the authority\'s event. The two engines share a BASE and not an '
    + 'ADDRESS.');
}

/* ---- 7. THE DRAWS THE PROPOSAL WOULD STILL GET WRONG, AND THE GAME THAT MATTERS -----------------
 * A rate is not a decision. `--focus <substring of the pair tag>` prints every random-target draw in
 * one named game, so "would landing this reach board-material zero" is answered against the ONE game
 * `data/game-differential.json` records rather than inferred from a percentage. */
if (FLIPS.length) {
  console.log('\n7. THE DRAWS THE PROPOSAL WOULD STILL GET WRONG');
  for (const f of FLIPS) console.log('   ' + f.cfg + '   ' + f.tag + '\n     ' + f.addr
    + '   candidates ' + f.cand + '   authority picks ' + f.auth + ', blanked-at-0 picks ' + f.zero);
} else {
  console.log('\n7. THE DRAWS THE PROPOSAL WOULD STILL GET WRONG: none in this sample');
}
if (FOCUS) {
  console.log('\n8. THE FOCUSED GAME — `--focus ' + FOCUS + '`');
  if (!FOCUS_ROWS.length) console.log('   NO runMove random-target draw in it at all — whatever parts '
    + 'that board, it is not this die.');
  for (const r of FOCUS_ROWS) console.log('   ' + (r.agree ? 'AGREES ' : 'DIFFERS')
    + '  ' + r.addr + '   candidates ' + r.cand + '   authority ' + r.auth + '  blanked-at-0 ' + r.zero);
}
console.log('================================================================================\n');
