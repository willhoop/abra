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
 *   1  the draws ONLY THE AUTHORITY makes — the categories medicham2 never draws in, derived per run,
 *      plus anything still blank — by call site off the real stack, and how many share a base
 *      (2026-09-18: this was the blank bucket alone, which is now empty; see below)
 *   2  the `nth` the authority's runMove target draw actually carries
 *   3  BLANKED AT nth=0 (the proposal, exactly as it would be implemented) — does it recover the
 *      authority's pick, judged against the 1/candidates floor a coin would score
 *   4  NEGATIVE CONTROL — the same draw addressed to the WRONG TURN. It must sit on that floor, or
 *      this file cannot see a miss and clause 3 means nothing.
 *   5  how far `nth` actually moves the value, CLASSIFIED from a sweep (TRANSLATES / MIXES), because
 *      that is what clause 3's rate rests on
 *   6  the target draw on BOTH engines — shared, authority-only and ours-only addresses
 *      (2026-09-18: this was our blank bucket, the landing site of a proposal that was never used)
 *   7  the draws the proposal would STILL get wrong, named
 *   8  `--focus <substring of a pair tag>`: one named game, so "would this reach board-material zero"
 *      is answered against the game `data/game-differential.json` records
 *
 * CLAUSE 4 WAS WRONG BEFORE THE ENGINE WAS. Its first form re-hashed `base + '|' + nth`, which IS the
 * authority's own address string — 100% by construction, incapable of being wrong, and read as "the
 * arithmetic checks out". A control that cannot fail is not a control.
 *
 * IT IS A MEASUREMENT, NOT A GATE. It exits 0 whatever RATE it finds and prints the numbers — but since
 * 2026-09-18 (#533) it exits 1 when it measured NO runMove target draw at all, because a rate over zero
 * draws is not a finding — and since the same day it also exits 1 when clause 1 or clause 6 measured
 * nothing, after every clause has printed. `--selftest` drives the draw selector, the clause 1 and 6
 * populations and the clause 5 classifier on synthetic logs, and plays nothing.
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

/* ==================================================================================================
 * ROADMAP #533 — CLAUSES 2-4 MEASURED AN EMPTY BUCKET AND PRINTED `0 of 0` AS AN ANSWER. 2026-09-18.
 *
 * They found the runMove target draw by first requiring the authority's BLANK address
 * (`any|-|-`) and only then matching the call site. ROADMAP #478's engine half then moved that draw
 * OUT of the blank bucket — `game_differential.js`'s `midAddrCat` now files an in-runMove target draw
 * under `tgt`, with the move and the attacker in the address — so the conjunction matched nothing, and
 * the file went on exiting 0 over zero draws.
 *
 * TWO CHANGES, AND THE SECOND IS THE ONE THAT MATTERS.
 *   1. The draw is selected by its CALL SITE ALONE (`RUNMOVE_TARGET`, read off the real stack), never
 *      by a category spelled here. Whatever category the driver files it under is RECORDED and printed
 *      (`targetCats`), so a future move of the draw shows up as a new category, not as an empty clause.
 *   2. A MEASUREMENT OF NOTHING IS REFUSED. If no runMove target draw was measured, the file prints
 *      `MEASURED NOTHING` and exits 1. It no longer exits 0 whatever it finds when what it found is
 *      nothing.
 *
 * `selectTargetDraws` is PURE — addresses, sites, sizes and a value function in, tallies out — so
 * `--selftest` drives the SHIPPING selector on synthetic address logs without loading the driver,
 * playing a game or cutting a release. It shows: the old blank-only filter reads 0 of a log whose
 * target draw is filed under `tgt`; the site-only selector reads it; and an empty log is REFUSED. */
const RUNMOVE_TARGET = /Side\.randomFoe.*BattleActions\.runMove/;
function selectTargetDraws(sd, sites, sizes, V, opts) {
  const blankOnly = !!(opts && opts.blankOnly);       /* the pre-2026-09-18 conjunction, kept for the selftest */
  const out = { blank: 0, blankSites: new Map(), blankBases: [], targetCats: new Map(), rows: [] };
  for (let i = 0; i < sd.length; i++) {
    const p = String(sd[i]).split('|');
    const isBlank = p[2] === 'any' && p[3] === '-' && p[4] === '-';
    if (isBlank) {
      out.blank++;
      out.blankBases.push({ base: p.slice(0, 5).join('|'), site: sites[i] });
      out.blankSites.set(sites[i], (out.blankSites.get(sites[i]) || 0) + 1);
    }
    if (blankOnly && !isBlank) continue;
    if (!RUNMOVE_TARGET.test(String(sites[i] || ''))) continue;
    out.targetCats.set(p[2], (out.targetCats.get(p[2]) || 0) + 1);
    const nth = +p[5], cand = sizes[i], base = p.slice(0, 5).join('|');
    const row = { addr: sd[i], nth, cand, base, measured: false };
    if (cand > 0) {
      row.measured = true;
      row.pickAuth = Math.floor(V(sd[i]) * cand);
      row.pickZero = Math.floor(V(base + '|0') * cand);
      const wrongTurn = [p[0], (+p[1]) + 1, p[2], p[3], p[4]].join('|');
      row.pickWrong = Math.floor(V(wrongTurn + '|' + nth) * cand);
    }
    out.rows.push(row);
  }
  return out;
}
const EMPTY_WHY = (n) => 'MEASURED NOTHING — ' + n + ' runMove random-target draw(s) with a candidate count were '
  + 'seen, so clauses 2-4 have no sample. This is NOT an answer (ROADMAP #533): the old version of this file '
  + 'printed `0 of 0` here and exited 0.';

/* ==================================================================================================
 * CLAUSES 1, 5 AND 6 — REPAIRED 2026-09-18 BY MEASURE, THE SAME DAY AS #533 AND FOR THE SAME REASON.
 *
 * CLAUSE 1 asked "how crowded is the authority's BLANK bucket (`any|-|-`)". On today's driver almost
 * nothing is filed there: #478 moved the lookahead target resolutions (`getActionSpeed`, `resolveAction`,
 * `beforeTurnMove`) into `tgtla`, and #551 addresses a draw with a move in scope by that move. Measured on
 * three games of release bc8d7cf849dd: 0 blank draws of 162; `tgtla` 36, all at `Side.randomFoe`. So the
 * clause read an empty bucket and printed `base addresses 0` as though it were a finding.
 * It now reads THE AUTHORITY-ONLY BUCKETS — every category the authority draws in and medicham2 NEVER
 * does, DERIVED per run from the two address logs rather than typed — plus whatever is still blank.
 * Those are the draws that used to share the blank bucket, wherever they live now, and a collision in
 * them is still what the clause is about. An empty population is REFUSED.
 *
 * CLAUSE 6 asked "where would OUR blanked draw land". The proposal it priced was never landed: #478
 * addressed the target draw under its own category, on both engines. So the live question is whether
 * the two engines address that draw IDENTICALLY, and the clause now answers it — shared, authority-only
 * and ours-only target addresses, per game, in the category the authority's draws were actually filed
 * under (clauses 2-4's `targetCats`). No target draw on our side is REFUSED.
 *
 * CLAUSE 5 printed a conclusion typed on 2026-08-27 — "the trailing index only TRANSLATES the value, it
 * does not mix" — beside a sweep that on today's hash reads a one-digit step of 0.5000. The driver's
 * `midHash` gained a finaliser (engine/game_differential.js, the comment above `midHash`), so the index
 * now re-draws. The clause now CLASSIFIES what its sweep measured and prints the reading that follows
 * from that class, never a sentence fixed in advance. Independent uniforms on a circle sit a mean
 * circular distance of 0.25 apart; a translating hash sits near 0. */
function formerBlankPopulation(sdAll, meAll) {
  const meCats = new Set(meAll.map(r => String(r.addr).split('|')[2]));
  const sdCats = new Set(sdAll.map(r => String(r.addr).split('|')[2]));
  const authorityOnly = [...sdCats].filter(c => !meCats.has(c)).sort();
  const perCat = new Map();
  let rows = 0, blank = 0;
  for (const r of sdAll) {
    const p = String(r.addr).split('|');
    const isBlank = p[2] === 'any' && p[3] === '-' && p[4] === '-';
    if (!isBlank && !authorityOnly.includes(p[2])) continue;
    rows++; if (isBlank) blank++;
    const cat = isBlank ? 'any|-|- (blank)' : p[2];
    if (!perCat.has(cat)) perCat.set(cat, { n: 0, bases: new Map(), sites: new Map() });
    const pc = perCat.get(cat); pc.n++;
    const k = r.g + '#' + p.slice(0, 5).join('|');
    pc.bases.set(k, (pc.bases.get(k) || 0) + 1);
    pc.sites.set(r.site, (pc.sites.get(r.site) || 0) + 1);
  }
  for (const pc of perCat.values()) {
    pc.baseCount = pc.bases.size; pc.multi = 0; pc.deepest = 0;
    for (const c of pc.bases.values()) { if (c > 1) pc.multi++; if (c > pc.deepest) pc.deepest = c; }
  }
  return { authorityOnly, rows, blank, perCat };
}
function targetAddressMatch(sdAll, meAll, cats) {
  const want = new Set(cats);
  const key = r => r.g + '#' + r.addr;
  const S = new Set(sdAll.filter(r => want.has(String(r.addr).split('|')[2])).map(key));
  const M = new Set(meAll.filter(r => want.has(String(r.addr).split('|')[2])).map(key));
  const shared = [...S].filter(k => M.has(k)), sdOnly = [...S].filter(k => !M.has(k)), meOnly = [...M].filter(k => !S.has(k));
  return { sd: S.size, me: M.size, shared: shared.length, sdOnly, meOnly };
}
function classifyNthStep(steps) {
  if (!steps.length) return { cls: 'NO SAMPLE', max: 0, mean: 0 };
  const max = Math.max.apply(null, steps), mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  const cls = max < 0.05 ? 'TRANSLATES' : (mean >= 0.2 && mean <= 0.3 ? 'MIXES' : 'UNCLASSIFIED');
  return { cls, max, mean };
}
const NOTHING_WHY = (clause, what) => 'MEASURED NOTHING (clause ' + clause + ') — ' + what + '. This is NOT an answer; '
  + 'before 2026-09-18 this clause printed zeros here and the file exited 0.';
if (process.argv.includes('--selftest')) {
  let bad = 0, ran = 0;
  const ok = (what, c, got) => { ran++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (c ? '' : '   got ' + JSON.stringify(got))); if (!c) bad++; };
  /* a stub value: deterministic, spread over [0,1), no engine needed */
  const V = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h / 4294967296; };
  const T = 'x < Side.randomFoe@side.js < BattleActions.runMove@battle-actions.js';
  const OTHER = 'Battle.getActionSpeed@battle.js < Battle.runAction@battle.js';
  /* today's shape: the target draw is filed under `tgt` with move and attacker; blank draws are other sites */
  const NOW = { sd: ['20260813|2|any|-|-|0', '20260813|2|any|-|-|1', '20260813|2|tgt|outrage|p20|0', '20260813|3|tgt|thrash|p21|0'],
                sites: [OTHER, OTHER, T, T], sizes: [null, null, 2, 2] };
  /* the 2026-08-27 shape the file was written against: the target draw in the blank bucket */
  const OLD = { sd: ['20260813|2|any|-|-|0', '20260813|2|any|-|-|1'], sites: [OTHER, T], sizes: [null, 2] };
  const EMPTY = { sd: ['20260813|2|any|-|-|0', '20260813|2|acc|protect|p20|0'], sites: [OTHER, OTHER], sizes: [null, null] };
  const sel = (L, o) => selectTargetDraws(L.sd, L.sites, L.sizes, V, o).rows.filter(r => r.measured).length;
  ok('RED — THE DEFECT: the pre-fix blank-only filter measures ZERO draws on today\'s address shape', sel(NOW, { blankOnly: true }) === 0, sel(NOW, { blankOnly: true }));
  ok('the site-only selector measures both target draws on today\'s shape', sel(NOW) === 2, sel(NOW));
  ok('...and the category they carry is RECORDED, not assumed (`tgt` x2)',
     JSON.stringify([...selectTargetDraws(NOW.sd, NOW.sites, NOW.sizes, V).targetCats]) === JSON.stringify([['tgt', 2]]));
  ok('the site-only selector still reads the OLD blank-bucket shape (the change narrows nothing)', sel(OLD) === 1 && sel(OLD, { blankOnly: true }) === 1);
  ok('a log with no target draw measures zero — which main() now REFUSES', sel(EMPTY) === 0);
  ok('the refusal text names the count and says it is not an answer', /MEASURED NOTHING — 0 /.test(EMPTY_WHY(0)) && /NOT an answer/.test(EMPTY_WHY(0)));
  /* ---- clause 1: the former blank bucket, wherever it lives now ---- */
  const SD1 = [{ g: 0, addr: 'S|2|acc|tackle|p20|0', site: OTHER }, { g: 0, addr: 'S|2|tgtla|outrage|p20|0', site: T },
               { g: 0, addr: 'S|2|tgtla|outrage|p20|1', site: T }, { g: 0, addr: 'S|3|any|-|-|0', site: OTHER }];
  const ME1 = [{ g: 0, addr: 'S|2|acc|tackle|p20|0' }, { g: 0, addr: 'S|2|any|tackle|p20|0' }];   /* ours draws in `any` WITH a move in scope, as on today's engine */
  const P1 = formerBlankPopulation(SD1, ME1);
  ok('clause 1 DERIVES the authority-only bucket from the two logs (`tgtla`, never typed)', JSON.stringify(P1.authorityOnly) === JSON.stringify(['tgtla']), P1.authorityOnly);
  ok('...reads the blank draw and the authority-only draws (3), and leaves the shared `acc` draw out', P1.rows === 3 && P1.blank === 1, P1);
  ok('...and counts a base drawn twice as a collision (`tgtla` multi 1, deepest 2)',
     P1.perCat.get('tgtla').multi === 1 && P1.perCat.get('tgtla').deepest === 2);
  ok('RED — the pre-fix clause 1 population (blank only) is 1 here and 0 on a log with no blank draw, which it printed as a finding',
     formerBlankPopulation(SD1.slice(0, 3), ME1).blank === 0);
  ok('a log where every category is shared gives an EMPTY population — which main() now REFUSES',
     formerBlankPopulation([{ g: 0, addr: 'S|2|acc|tackle|p20|0', site: OTHER }], ME1).rows === 0);
  /* ---- clause 6: do the two engines address the target draw identically ---- */
  const M6 = targetAddressMatch([{ g: 0, addr: 'S|2|tgt|outrage|p20|0' }, { g: 0, addr: 'S|3|tgt|outrage|p20|0' }],
                                [{ g: 0, addr: 'S|2|tgt|outrage|p20|0' }, { g: 0, addr: 'S|3|tgt|outrage|p21|0' }], ['tgt']);
  ok('clause 6 splits shared, authority-only and ours-only target addresses (1 / 1 / 1)',
     M6.shared === 1 && M6.sdOnly.length === 1 && M6.meOnly.length === 1, M6);
  ok('...and an ours-side log with no target draw reads me=0 — which main() now REFUSES',
     targetAddressMatch([{ g: 0, addr: 'S|2|tgt|outrage|p20|0' }], [], ['tgt']).me === 0);
  /* ---- clause 5: classify the sweep, never print a fixed sentence ---- */
  const circ = (x, y) => { const d = Math.abs(x - y); return Math.min(d, 1 - d); };
  const translate = [], mix = [];
  for (let k = 0; k < 400; k++) {
    const b = 'S|' + k + '|any|-|-|', v0 = V(b + 'x');
    for (let i = 1; i <= 9; i++) { translate.push(circ((v0 + i * 0.0035) % 1, v0)); mix.push(circ(V(b + i + 'salt'), v0)); }
  }
  ok('clause 5 classifies a translating hash as TRANSLATES', classifyNthStep(translate).cls === 'TRANSLATES', classifyNthStep(translate));
  ok('clause 5 classifies a mixing hash as MIXES (mean circular step near 0.25)', classifyNthStep(mix).cls === 'MIXES', classifyNthStep(mix));
  ok('clause 5 with no sample says so rather than classifying', classifyNthStep([]).cls === 'NO SAMPLE');
  console.log('RANDOM-TARGET SELFTEST: ' + (ran - bad) + ' passed, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
}
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

/* the one site the proposal is about: runMove -> getTarget -> getRandomTarget -> randomFoe -> sample.
 * `RUNMOVE_TARGET` and `selectTargetDraws` are defined above, before the driver loads (#533). */
const SD_ALL = [], ME_ALL = [];   // clauses 1 and 6 (2026-09-18)
const TARGET_CATS = new Map();      // the category the target draw is actually filed under, counted

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
    /* ONE SELECTOR, SHARED WITH --selftest (#533). Clause 1 still reads the blank bucket; clauses 2-4
     * read the runMove target draw WHEREVER it is filed. */
    const S = selectTargetDraws(sd, SITES, SIZES, (a) => M.midEventValue(a));
    blank += S.blank;
    for (const { base, site } of S.blankBases) {
      const key = games + '#' + base;
      if (!byBase.has(key)) byBase.set(key, []);
      byBase.get(key).push(site);
    }
    for (const [s, c] of S.blankSites) perSite.set(s, (perSite.get(s) || 0) + c);
    for (const [c, n] of S.targetCats) TARGET_CATS.set(c, (TARGET_CATS.get(c) || 0) + n);
    /* EVERY ADDRESS, BOTH ENGINES, KEPT FOR CLAUSES 1 AND 6 — which derive their populations only after
     * the whole run, because "a category medicham2 never draws in" is a property of the RUN, not of a game. */
    for (let i = 0; i < sd.length; i++) SD_ALL.push({ g: games, addr: sd[i], site: SITES[i] });
    for (const a of M.midEventLog()) ME_ALL.push({ g: games, addr: a });
    for (const row of S.rows) {
      /* THE DRAW THE PROPOSAL IS ABOUT. */
      const nth = row.nth, cand = row.cand, base = row.base;
      nthHist.set(nth, (nthHist.get(nth) || 0) + 1);
      if (!row.measured) continue;
      candHist.set(cand, (candHist.get(cand) || 0) + 1);
      /* THE NEGATIVE CONTROL (`pickWrong`) is the same draw addressed to a DIFFERENT TURN, so it must sit
       * on the coin floor. Its first form re-hashed `base + '|' + nth`, which IS the authority's address
       * — a clause that was 100% by construction and could never have been wrong. */
      const pickAuth = row.pickAuth, pickZero = row.pickZero, pickWrong = row.pickWrong;
      cl3n++;
      if (pickZero === pickAuth) cl3ok++;
      else FLIPS.push({ tag: PR_TAG, cfg: PR_CFG, addr: row.addr, cand, auth: pickAuth, zero: pickZero });
      if (FOCUS && PR_TAG.indexOf(FOCUS) >= 0)
        FOCUS_ROWS.push({ tag: PR_TAG, addr: row.addr, cand, auth: pickAuth, zero: pickZero,
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
      { const d = Math.abs(M.midEventValue(row.addr) - M.midEventValue(base + '|0'));
        NTH_DELTA.push(Math.min(d, 1 - d)); }
      if (cand > 1) {
        const v = M.midEventValue(row.addr);
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
console.log('  the runMove random-target draw, by the category it is actually filed under: '
  + ([...TARGET_CATS].map(([c, n]) => c + ' x' + n).join('  ') || 'NONE'));
/* ROADMAP #533 — AN EMPTY SAMPLE IS REFUSED, BEFORE ANY CLAUSE PRINTS A RATE OVER IT. */
if (cl3n === 0) { console.log('\n  ' + EMPTY_WHY(cl3n)); process.exit(1); }

/* THE REFUSALS OF THIS RUN, COLLECTED SO EVERY CLAUSE STILL PRINTS WHAT IT HAS, THEN THE FILE EXITS 1. */
const REFUSED = [];

/* ---- 1. THE FORMER BLANK BUCKET, WHEREVER ITS DRAWS LIVE NOW (2026-09-18, see formerBlankPopulation) */
const P1 = formerBlankPopulation(SD_ALL, ME_ALL);
console.log('\n1. THE DRAWS ONLY THE AUTHORITY MAKES — the former blank bucket, wherever they are filed now');
console.log('   authority-only categories, DERIVED from the two logs: ' + (P1.authorityOnly.join(', ') || 'none')
  + ';  still blank (`any|-|-`): ' + P1.blank + ';  population ' + P1.rows + ' of ' + SD_ALL.length + ' authority draws');
for (const [cat, pc1] of [...P1.perCat].sort((a, b) => b[1].n - a[1].n)) {
  console.log('   ' + cat.padEnd(18) + String(pc1.n).padStart(6) + ' draws   base addresses ' + pc1.baseCount
    + ',  drawn MORE THAN ONCE ' + pc1.multi + ' (' + pc(pc1.multi, pc1.baseCount) + '),  deepest ' + pc1.deepest);
  for (const [st, c] of [...pc1.sites].sort((a, b) => b[1] - a[1]).slice(0, 6))
    console.log('        ' + String(c).padStart(6) + '  ' + st);
}
console.log('   a base drawn more than once is a COLLISION: `nth` is a counter, so the ORDER of the preceding');
console.log('   draws decides which value each event gets. In an authority-only bucket nothing on our side reads');
console.log('   those values, so a collision there shifts only the authority\'s own later draws in that bucket.');
if (!P1.rows) { const w = NOTHING_WHY(1, 'no authority draw is blank and no category is authority-only in '
  + games + ' game(s)'); console.log('   ' + w); REFUSED.push(w); }

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

/* ---- 5. HOW MUCH `nth` MOVES THE VALUE — CLASSIFIED FROM THE SWEEP, NOT ASSERTED IN ADVANCE --------
 * Until 2026-09-18 this clause printed "FNV-1a ... only TRANSLATES the value modulo 1 — it does not mix"
 * as a fixed sentence. The driver's `midHash` has since gained a finaliser (see the comment above
 * `midHash` in engine/game_differential.js) and the same sweep read a one-digit step of 0.5000. So the
 * sweep now decides the sentence: `classifyNthStep` calls it TRANSLATES (max step under 0.05), MIXES
 * (mean circular step in [0.20, 0.30], i.e. independent uniforms, whose mean circular distance is 0.25)
 * or UNCLASSIFIED, and only the reading that follows from that class is printed. */
console.log('\n5. HOW MUCH `nth` ACTUALLY MOVES THE VALUE — the reason clause 3 reads as it does');
{
  const mx = NTH_DELTA.length ? Math.max.apply(null, NTH_DELTA) : 0;
  const mn = NTH_MARGIN.length ? Math.min.apply(null, NTH_MARGIN) : 1;
  console.log('   on the ' + NTH_DELTA.length + ' real draws, the CIRCULAR step from nth=0 to the '
    + 'authority\'s nth is at most ' + mx.toFixed(4));
  console.log('   the CLOSEST any of those ' + NTH_MARGIN.length
    + ' multi-candidate values came to a boundary was ' + mn.toFixed(4));
  console.log('   draws where that step moved the PICK across a boundary: ' + (cl3n - cl3ok) + ' of ' + cl3n);
  const circ = (x, y) => { const d = Math.abs(x - y); return Math.min(d, 1 - d); };
  const one = [], two = [];
  for (let k = 0; k < 2000; k++) {
    const b = '20260813|' + k + '|any|-|-|', v0 = M.midEventValue(b + '0');
    for (let i = 1; i <= 9; i++) one.push(circ(M.midEventValue(b + i), v0));
    for (let i = 10; i < 16; i++) two.push(circ(M.midEventValue(b + i), v0));
  }
  const c1 = classifyNthStep(one), c2 = classifyNthStep(two);
  console.log('   SWEPT over 2,000 bases, the step from nth=0: one-digit index  max ' + c1.max.toFixed(4)
    + '  mean ' + c1.mean.toFixed(4) + '  -> ' + c1.cls + ';   two-digit  max ' + c2.max.toFixed(4)
    + '  mean ' + c2.mean.toFixed(4) + '  -> ' + c2.cls);
  if (c1.cls === 'MIXES') {
    console.log('   THE INDEX MIXES: a draw at nth>0 is an independent value, not a nudge of the nth=0 one. So');
    console.log('   clause 3 recovers the authority\'s pick only where the authority itself drew at nth=0 ('
      + (nthHist.get(0) || 0) + ' of ' + tot2 + ' target draws here); everywhere else it is a coin.');
  } else if (c1.cls === 'TRANSLATES') {
    console.log('   THE INDEX ONLY TRANSLATES the value (the 2026-08-27 hash): clause 3\'s agreement at nth>0 is');
    console.log('   the translation being small, and a collision in clause 1 is masked by it, not absent.');
  } else {
    console.log('   UNCLASSIFIED: the sweep is neither a translation nor independent draws — read the hash before');
    console.log('   reading clause 3.');
  }
}

/* ---- 6. DO THE TWO ENGINES ADDRESS THE TARGET DRAW IDENTICALLY (2026-09-18, see targetAddressMatch) */
console.log('\n6. THE TARGET DRAW ON BOTH ENGINES — same address, or not');
{
  const cats6 = [...TARGET_CATS.keys()];
  const T6 = targetAddressMatch(SD_ALL, ME_ALL, cats6);
  let meBlankNow = 0; for (const r of ME_ALL) { const q = String(r.addr).split('|'); if (q[2] === 'any' && q[3] === '-' && q[4] === '-') meBlankNow++; }
  console.log('   in the category the authority files it under (' + (cats6.join(', ') || 'none') + '):  authority '
    + T6.sd + ',  medicham2 ' + T6.me + ',  SHARED ' + T6.shared + ',  authority-only ' + T6.sdOnly.length
    + ',  ours-only ' + T6.meOnly.length);
  for (const k of T6.sdOnly.slice(0, 5)) console.log('     authority-only  ' + k);
  for (const k of T6.meOnly.slice(0, 5)) console.log('     ours-only       ' + k);
  console.log('   medicham2 draws ' + ME_ALL.length + ',  of them in the blank `any|-|-` bucket ' + meBlankNow
    + ' — the landing site the 2026-08-27 proposal priced, which was never used.');
  console.log('   A shared address is a shared die. An unmatched one is a draw one engine made and the other did not');
  console.log('   make at that address — the same die read two ways — and each is named above.');
  if (!T6.me) { const w = NOTHING_WHY(6, 'medicham2 made no draw in ' + (cats6.join(', ') || 'any target category')
    + ' in ' + games + ' game(s)'); console.log('   ' + w); REFUSED.push(w); }
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
/* ROADMAP #533 FOLLOW-UP — A CLAUSE THAT MEASURED NOTHING FAILS THE RUN, AFTER EVERY CLAUSE HAS PRINTED. */
if (REFUSED.length) { console.log('REFUSED — ' + REFUSED.length + ' clause(s) measured nothing:'); for (const w of REFUSED) console.log('  ' + w); process.exit(1); }
