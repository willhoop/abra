/* fit_joint.js — fit the choice of a PAIR of moves, not two moves separately.
 *
 *   SHOWDOWN_PATH=... node engine/fit_joint.js      ->  data/policy-weights-joint.json
 *
 * WHY A SEPARATE FIT
 * ------------------
 * engine/fit_policy.js asks "which move did this Pokemon click", one Pokemon at a time. That is the
 * wrong question for doubles, and the evidence is measured rather than aesthetic: humans aim both
 * their attacks at the same foe 23.4% of the time, choosing independently produces about 50%, and
 * MAG sits at the 50% end. The play everyone recognises -- one Pokemon Protects to survive a kill
 * while its partner removes the thing that would have killed it -- is not something MAG scores
 * badly. It is something MAG cannot represent, because no number in a single move's vector can mean
 * "my partner is handling it".
 *
 * WHY THE SCORE IS NOT A SUM
 * --------------------------
 * Both of your Pokemon can kill the Charizard. Independently, each scores "I get a kill" -- the best
 * thing on its list. Added together that reads as two kills. What actually happens is one kill, one
 * wasted move, and a free shot from the Kingambit you ignored. So the pair carries its own small set
 * of features (board.js JOINT_FEATURES) alongside the sum, and the fit prices them.
 *
 * WHY THE CANDIDATE LIST IS CAPPED
 * --------------------------------
 * Every pair is ~10 x 10, and over 40,000 joint decisions that is millions of vectors. The cap is
 * TOP-K BY THE SINGLE-MOVE SCORE, which is not a shortcut bolted on: narrowing the branch list is
 * what MAG is FOR. The pair the human actually chose is always kept regardless of its rank, or the
 * fit would only ever see decisions the old model already agreed with -- which would manufacture
 * agreement rather than measure it. How often the chosen pair falls outside the top K is reported,
 * because that number is the honest cost of the cap.
 *
 * The weights land in their OWN file. engine/magnemite.js refuses to load a vector whose feature
 * list does not match, and overwriting the single-move weights with a longer vector would break the
 * player rather than upgrade it.
 *
 * IT NEEDS MORE HEAP THAN NODE GIVES YOU BY DEFAULT.
 * --------------------------------------------------
 * Every kept turn holds ~40 alternatives of 74 numbers until the fit is done, and on 2026-08-02 the
 * corrected matcher raised the kept count from 66,236 to 81,515 -- 23% more rows -- which walked the
 * run straight into Node's ~2GB default and killed it with "Ineffective mark-compacts near heap
 * limit". Nothing was wrong with the fit; it simply had more data than the runtime would hold.
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/fit_joint.js
 *
 * Recorded here rather than left as folklore, because the failure looks like a crash rather than
 * like a limit, and the next person to grow the corpus will hit it again.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');
/* The replay-to-pair-decisions loop lives in ONE place now; engine/collinearity_joint.js asks the
 * same question of the same rows rather than growing a second copy. See that file's header and
 * docs/ARTIFACT-ACCESS-RULES.md R1. */
const JR = require('./joint_rows.js');
const SC = require('./sheet_channels.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

const TOPK = +(process.env.TOPK || 6);
const NF = B.FEATURES.length, NJ = B.JOINT_FEATURES.length, NW = NF + NJ;
/* OUT_JOINT / RANKER_WEIGHTS let a CANDIDATE pair vector be fitted against a CANDIDATE marginal one
 * without overwriting either incumbent, so both arms of a head-to-head exist at once and each file
 * records which ranker it was built on. */
const OUT = process.env.OUT_JOINT ? path.resolve(process.env.OUT_JOINT) : D('data', 'policy-weights-joint.json');

if (!B.damageEngine()) { console.error('damage engine unavailable — refusing to fit'); process.exit(1); }

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }

const { games } = FP.loadCorpus();
console.log(`JOINT FIT — ${games.length.toLocaleString()} clean open-sheet games, top-${TOPK} per slot`);
console.log(`  ranker: ${path.relative(D('.'), JR.rankerPath())}   ->  ${path.relative(D('.'), OUT)}\n`);

const { rows, tally } = JR.build(games, dex, { topK: TOPK, w1 });


console.log(`  joint turns seen ${tally.turns.toLocaleString()} -> ${tally.kept.toLocaleString()} usable`);
console.log(`  dropped: ${tally.oneSlot.toLocaleString()} had only one slot acting, ${tally.unmatched.toLocaleString()} could not be matched, `
  + `${tally.ambiguous.toLocaleString()} target ambiguous (mirror)`);
console.log(`  the chosen pair fell outside the top ${TOPK} on at least one slot: ` +
            `${tally.chosenOutsideK.toLocaleString()} (${(100 * tally.chosenOutsideK / Math.max(1, tally.kept)).toFixed(1)}%)`);

/* THE FITTING ENVIRONMENT, PROVED. Identical guard to engine/fit_policy.js and for the identical
 * reason: until 2026-08-04 engine/joint_rows.js passed `{nature, item}` to setSheet while
 * engine/magnemite.js passed all four, so the pair layer was fitted against a board the player never
 * sees. The joint layer inherits that twice — its top-K MENU is ranked by w1 over the same feature
 * vectors, so a mis-priced feature changes which pairs are candidates at all, not merely their score.
 * A requested channel reaching zero boards is fatal here rather than reported. */
const jpc = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
console.log(`  sheet      channels ${FP.SHEET_CHANNELS.join(',')} — ` +
  `${(tally.sheetEntries || 0).toLocaleString()} entries set; of ${(tally.probedDecisions || 0).toLocaleString()} scored slots the ` +
  `user mon carried ability ${jpc(tally.liveUserAbility || 0, tally.probedDecisions || 0)}, ` +
  `moves ${jpc(tally.liveUserMoves || 0, tally.probedDecisions || 0)}; of ` +
  `${(tally.probedFoes || 0).toLocaleString()} live foe actives, ability ` +
  `${jpc(tally.liveFoeAbility || 0, tally.probedFoes || 0)}, moves ${jpc(tally.liveFoeMoves || 0, tally.probedFoes || 0)}`);
for (const [ch, n] of [['ability', tally.liveUserAbility || 0], ['moves', tally.liveUserMoves || 0]]) {
  if (FP.SHEET_CHANNELS.includes(ch) && n === 0) {
    console.error(`\nSHEET CHANNEL '${ch}' REACHED 0 OF ${(tally.probedDecisions || 0).toLocaleString()} SCORED BOARDS ` +
      `despite being set on ${(tally.sheetEntries || 0).toLocaleString()} sheet entries. Refusing to fit.`);
    process.exit(1);
  }
}

/* HELD OUT BY GAME, never by decision. Two turns of the same game share teams, players and a
 * metagame, so splitting inside a game leaks the answer across the split. */
const ids = [...new Set(rows.map(r => r.game))];
let h = 0; for (const s of ids) { let a = 0; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; h = a; }
const heldGames = new Set(ids.filter(s => { let a = 0; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; return (a % 5) === 0; }));
const train = rows.filter(r => !heldGames.has(r.game));
const held = rows.filter(r => heldGames.has(r.game));
console.log(`  split ${train.length.toLocaleString()} train / ${held.length.toLocaleString()} held out (by game)\n`);
if (!train.length) { console.error('nothing to fit'); process.exit(1); }

function logLik(w, set) {
  let ll = 0;
  for (const r of set) {
    let max = -Infinity;
    const s = r.alts.map(v => { let t = 0; for (let k = 0; k < NW; k++) t += w[k] * v[k]; if (t > max) max = t; return t; });
    let sum = 0; for (const t of s) sum += Math.exp(t - max);
    ll += s[r.chosen] - max - Math.log(sum);
  }
  return ll / Math.max(1, set.length);
}

function fit(set, lambda) {
  const w = new Array(NW).fill(0);
  const g = new Array(NW).fill(0);
  const m = new Array(NW).fill(0), v = new Array(NW).fill(0);
  const STEPS = 220, LR = 0.12;
  for (let it = 1; it <= STEPS; it++) {
    g.fill(0);
    for (const r of set) {
      let max = -Infinity;
      const s = r.alts.map(vec => { let t = 0; for (let k = 0; k < NW; k++) t += w[k] * vec[k]; if (t > max) max = t; return t; });
      let sum = 0; const e = s.map(t => { const q = Math.exp(t - max); sum += q; return q; });
      for (let i = 0; i < r.alts.length; i++) {
        const p = e[i] / sum, vec = r.alts[i], ind = (i === r.chosen) ? 1 : 0;
        for (let k = 0; k < NW; k++) g[k] += (ind - p) * vec[k];
      }
    }
    for (let k = 0; k < NW; k++) {
      let gk = g[k] / set.length - lambda * w[k];
      m[k] = 0.9 * m[k] + 0.1 * gk;
      v[k] = 0.999 * v[k] + 0.001 * gk * gk;
      w[k] += LR * (m[k] / (1 - Math.pow(0.9, it))) / (Math.sqrt(v[k] / (1 - Math.pow(0.999, it))) + 1e-8);
    }
  }
  return w;
}

let best = null;
for (const lam of [0, 1e-4, 1e-3, 1e-2]) {
  const w = fit(train, lam);
  const ll = logLik(w, held.length ? held : train);
  if (!best || ll > best.ll) best = { w, ll, lam };
}

/* THE COMPARISON THAT MATTERS. Not "is the joint model good" but "is it better than deciding the two
 * separately", which is what MAG does today. Same held-out pairs, same features, joint terms zeroed. */
const wNoJoint = best.w.slice(); for (let k = NF; k < NW; k++) wNoJoint[k] = 0;
const sumOnly = new Array(NW).fill(0); for (let k = 0; k < NF; k++) sumOnly[k] = w1[k];
const acc = (w, set) => {
  let ok = 0;
  for (const r of set) {
    let bi = 0, bs = -Infinity;
    r.alts.forEach((v, i) => { let t = 0; for (let k = 0; k < NW; k++) t += w[k] * v[k]; if (t > bs) { bs = t; bi = i; } });
    if (bi === r.chosen) ok++;
  }
  return 100 * ok / Math.max(1, set.length);
};
const H = held.length ? held : train;
console.log('HELD-OUT, PREDICTING THE PAIR (higher is better)\n');
console.log(`  two moves decided separately (what MAG does now)  logL ${logLik(sumOnly, H).toFixed(4)}   top-1 ${acc(sumOnly, H).toFixed(1)}%`);
console.log(`  refitted, but joint terms forced to zero          logL ${logLik(wNoJoint, H).toFixed(4)}   top-1 ${acc(wNoJoint, H).toFixed(1)}%`);
console.log(`  with the joint terms                             logL ${logLik(best.w, H).toFixed(4)}   top-1 ${acc(best.w, H).toFixed(1)}%`);
console.log(`\n  regularisation chosen on held-out data: lambda = ${best.lam}`);

console.log('\nWHAT THE PAIR TERMS ARE WORTH\n');
const jw = B.JOINT_FEATURES.map((f, i) => [f, best.w[NF + i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
for (const [f, v] of jw) console.log(`  ${f.padEnd(20)} ${(v >= 0 ? '+' : '') + v.toFixed(3)}`);

/* What each feature MEANT when these weights were fitted — see engine/feature_fixture.js. The
 * feature list is recorded above and checked on load, but a list check cannot see a feature quietly
 * changing meaning under an unchanged name, which is exactly what happened on 2026-08-01. */
let featureHashes = null;
try {
  featureHashes = require('./feature_fixture.js').hashes(dex);
} catch (e) {
  console.error(`\n  WARNING: could not compute feature-semantics hashes (${e.message}). These weights`);
  console.error('  will load, but nothing will detect a feature changing meaning under its own name.');
}

const payload = JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  source: 'engine/fit_joint.js',
  /* WHICH MARGINAL VECTOR RANKED THE CANDIDATES. The top-K cap is taken by the single-move score, so
   * a pair vector is only meaningful beside the marginal vector it was narrowed with. Recorded
   * rather than assumed, because two of each now exist. */
  ranker: path.relative(D('.'), JR.rankerPath()),
  features: B.FEATURES, jointFeatures: B.JOINT_FEATURES,
  weights: best.w, lambda: best.lam, topK: TOPK,
  corpus: { games: games.length, pairs: rows.length, heldOut: H.length },
  matching: { turnsSeen: tally.turns, kept: tally.kept, unmatched: tally.unmatched, ambiguous: tally.ambiguous },
  /* WHAT THE BOARD KNEW WHILE THIS WAS FITTED — see engine/fit_policy.js's block of the same name.
   * Written into the artifact so that a fit/play mismatch is readable from the file rather than only
   * from a diff of two source lines, which is how the 2026-08-04 gap survived a week. */
  fitEnvironment: {
    sheet_channels: FP.SHEET_CHANNELS.slice(),
    player_passes: SC.CHANNELS.slice(),
    matches_player: SC.isFull(FP.SHEET_CHANNELS),
    sheet_entries_set: tally.sheetEntries || 0,
    reached_board: {
      slots_probed: tally.probedDecisions || 0,
      user_ability: tally.liveUserAbility || 0,
      user_moves: tally.liveUserMoves || 0,
      foe_actives_probed: tally.probedFoes || 0,
      foe_ability: tally.liveFoeAbility || 0,
      foe_moves: tally.liveFoeMoves || 0,
    },
  },
  featureHashes,
  caveat: 'Predicts which PAIR a human clicked. Not evidence that the pair wins more games.',
}, null, 1) + '\n';

/* THE DEFAULT PATH IS WRITTEN ON ITS OWN LINE, NOT HIDDEN BEHIND A VARIABLE.
 *
 * tests/test-site-data-fresh.js decides whether an artifact can be regenerated at all by pairing its
 * filename with a write call ON ONE LINE, and a file with no discoverable generator is permanently
 * stale for everyone -- which is the worse error that guard exists to catch. Routing the write
 * through `OUT` hid this file's generator and the guard immediately reported it as a new orphan.
 *
 * It was right, and it had caught the same thing before: data/policy-weights.json has sat in
 * data/site-data-orphans.json as "no generator" ever since OUT_WEIGHTS was added to fit_policy.js
 * for exactly this reason. The line-level rule is not over-strict -- it is what stops a file that
 * merely MENTIONS an artifact being credited with producing it. So the fix is to make the default
 * visible, not to loosen the scan. */
if (process.env.OUT_JOINT) fs.writeFileSync(OUT, payload);
else fs.writeFileSync(D('data', 'policy-weights-joint.json'), payload);
console.log(`\n  -> ${path.relative(D('.'), OUT)}`);
