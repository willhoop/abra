/* sprt.js — stop a head-to-head the moment it is decided, instead of always running 200,000 games.
 *
 * WHY THIS EXISTS (Will, 2026-07-31: "in the future we are doing cheaper tests")
 * ----------------------------------------------------------------------------
 * Every comparison in this project runs a FIXED number of games and is read once at the end. That is
 * the most expensive possible design. Most results are obvious long before the run finishes: greedy
 * action selection came back at 79.7% of decisive pairs, which is unmistakable after a few thousand;
 * a true null is usually visibly null well before the halfway mark. Paying two hours either way is
 * what makes a null feel expensive, and an expensive null is what sends somebody hunting for a bug
 * to explain it rather than shrugging and trying the next idea.
 *
 * WALD'S SEQUENTIAL PROBABILITY RATIO TEST (Wald 1945, *Sequential Analysis*) reads the evidence as
 * it arrives and stops as soon as it crosses a decision boundary. It is what chess engine testing
 * has used for over a decade — Stockfish's fishtest gates every patch this way — for exactly this
 * reason: thousands of candidate changes, each of which must be cheap to reject.
 *
 * THE UNIT IS THE DECISIVE PAIR, not the game, and that is not a choice made here — it is the unit
 * `engine/paired_h2h.js` already established, for the reason documented there at length: in a paired
 * run a 1-1 split means the TEAM decided the game rather than the policy, so it is noise, and
 * counting it dilutes the comparison. Discarding ties and asking whether 2-0 outnumbers 0-2 is
 * McNemar's test. SPRT here is that same test, read continuously.
 *
 * THE TWO HYPOTHESES ARE AN EFFECT SIZE YOU CHOOSE, NOT A GUESS ABOUT THE TRUTH:
 *
 *   H0: p = --p0 (default 0.50)  "a decisive pair is a coin flip; this change is not worth shipping"
 *   H1: p = --p1 (default 0.55)  "a decisive pair goes the new arm's way 55% of the time"
 *
 * 0.55 is the default because it is roughly the smallest edge this project has ever cared about
 * acting on, and because the two changes that DID pay were far larger than it (greedy at 79.7%),
 * while the changes that nulled sat inside 45–57%. Both are flags; state the one you used.
 *
 * WHAT THE BOUNDS MEAN. With error rates alpha (wrongly shipping a dud) and beta (wrongly rejecting
 * a real gain), Wald's boundaries on the log-likelihood ratio are
 *
 *     upper A = ln((1 - beta) / alpha)      cross it -> accept H1, the change wins
 *     lower B = ln(beta / (1 - alpha))      cross it -> accept H0, it is a null
 *
 * and between them the run continues. These are the approximate boundaries (Wald's own), which are
 * slightly conservative: the true error rates are at most alpha and beta, never worse.
 *
 * IT IS NOT A LICENCE TO PEEK AT A FIXED-N TEST. Reading a Wilson interval repeatedly and stopping
 * when it happens to clear zero inflates the false-positive rate badly; that is the multiple-looks
 * problem the 2026-07-31 defence raised about the 56 per-feature intervals. SPRT is valid under
 * continuous monitoring BECAUSE the boundaries were derived for it. Do not mix the two: if you stop
 * a run here, report the SPRT verdict, not a p-value computed as though n had been fixed in advance.
 *
 *   node engine/sprt.js data/games.h2h-joint-trained.jsonl        analyse a finished run
 *   node engine/sprt.js --watch data/.mew-shards --n 200000       follow a run and say when to stop
 *   node engine/sprt.js <file> --p1 0.53 --alpha 0.05 --beta 0.05
 *   node engine/sprt.js <file> --verify                           cross-check against paired_h2h.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = n => argv.includes('--' + n);

const P0 = parseFloat(flag('p0', '0.50'));
const P1 = parseFloat(flag('p1', '0.55'));
const ALPHA = parseFloat(flag('alpha', '0.05'));
const BETA = parseFloat(flag('beta', '0.05'));
const MAXGAMES = parseInt(flag('n', '0'), 10) || 0;
const WATCH = has('watch');
const VERIFY = has('verify');
const TARGET = argv.find(a => !a.startsWith('--') && a !== String(MAXGAMES)) || '';

if (!TARGET) {
  console.error('usage: node engine/sprt.js <games.jsonl | --watch <shard-dir>> [--p0 0.50] [--p1 0.55]');
  process.exit(2);
}
if (!(P0 > 0 && P0 < 1 && P1 > 0 && P1 < 1)) { console.error('p0 and p1 must be strictly between 0 and 1'); process.exit(2); }
if (P1 <= P0) { console.error('p1 must exceed p0: H1 is the hypothesis that the NEW arm is better.'); process.exit(2); }

const A_BOUND = Math.log((1 - BETA) / ALPHA);
const B_BOUND = Math.log(BETA / (1 - ALPHA));
/* Per-observation log-likelihood contributions. A decisive pair is one Bernoulli trial. */
const LLR_WIN = Math.log(P1 / P0);
const LLR_LOSS = Math.log((1 - P1) / (1 - P0));

/* ---- reading the corpus ----------------------------------------------------------------------
 *
 * THE PAIRING RULES ARE paired_h2h.js's, DELIBERATELY REPEATED AND GUARDED RATHER THAN IMPORTED.
 * That file is a script: requiring it runs it and exits. Re-implementing shared logic is exactly the
 * duplication the project's single-source rule exists to prevent, so the duplication is not left on
 * trust — `--verify` runs paired_h2h.js on the same corpus and refuses to report unless the two
 * agree on both/split/neither exactly. Unify by exporting the pairing from paired_h2h.js when that
 * file is next touched; until then a divergence fails a command rather than drifting silently. */
function readRows(file) {
  const rows = [];
  let txt; try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return rows; }
  for (const line of txt.split('\n')) {
    const s = line.trim(); if (!s) continue;
    let g; try { g = JSON.parse(s); } catch (e) { continue; }
    if (g && g.selfplay) rows.push(g);
  }
  return rows;
}

function collect(target) {
  const rows = [];
  const st = (() => { try { return fs.statSync(target); } catch (e) { return null; } })();
  if (st && st.isDirectory()) {
    for (const f of fs.readdirSync(target)) {
      if (!/\.jsonl$/.test(f) || /raw-logs/.test(f)) continue;
      rows.push(...readRows(path.join(target, f)));
    }
  } else {
    rows.push(...readRows(target));
  }
  return rows;
}

/* Returns the decisive pairs IN SEED ORDER, each 1 (new arm took both) or 0 (old arm took both).
 * Seed order matters: SPRT reads evidence as it ARRIVES, so shuffling would misreport where a real
 * run would have stopped. Seeds are assigned in blocks per worker and ascend within a block. */
function decisiveSequence(rows) {
  const bySeed = new Map();
  for (const g of rows) {
    const k = String(g.selfplay.seed);
    if (!bySeed.has(k)) bySeed.set(k, []);
    bySeed.get(k).push(g);
  }
  const usesArm = rows.some(g => g.selfplay.winnerArm === 1 || g.selfplay.winnerArm === 2);
  const NEW = 'score';
  const sameName = rows.length && rows.every(g => (g.selfplay.policy2 || g.selfplay.policy) === g.selfplay.policy);
  if (sameName && !usesArm) {
    console.error('\nREFUSING TO REPORT: both arms carry the same policy name and no record carries');
    console.error('winnerArm, so a win cannot be attributed to an arm. Same refusal as paired_h2h.js.');
    process.exit(2);
  }
  const wonNew = g => (g.selfplay.winnerArm === 1 || g.selfplay.winnerArm === 2)
    ? (g.selfplay.winnerArm === 1 ? 1 : 0)
    : (g.selfplay.winnerPolicy === NEW ? 1 : 0);

  const seeds = [...bySeed.keys()].sort((a, b) => Number(a) - Number(b));
  const seq = [];
  let both = 0, split = 0, neither = 0, halves = 0, mismatched = 0;
  for (const k of seeds) {
    const gs = bySeed.get(k);
    if (gs.length !== 2) { halves += gs.length; continue; }
    const six = g => JSON.stringify((g.six && g.six.p1 || []).slice().sort()) +
                     JSON.stringify((g.six && g.six.p2 || []).slice().sort());
    if (six(gs[0]) !== six(gs[1])) { mismatched++; continue; }
    if (gs[0].selfplay.swapped === gs[1].selfplay.swapped) { mismatched++; continue; }
    const s = gs.map(wonNew).reduce((a, b) => a + b, 0);
    if (s === 2) { both++; seq.push(1); }
    else if (s === 1) { split++; }
    else { neither++; seq.push(0); }
  }
  return { seq, both, split, neither, halves, mismatched, pairs: both + split + neither };
}

/* ---- the test itself -------------------------------------------------------------------------- */
function runSprt(seq) {
  let llr = 0, wins = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i]) { llr += LLR_WIN; wins++; } else { llr += LLR_LOSS; }
    if (llr >= A_BOUND) return { verdict: 'H1', at: i + 1, llr, wins };
    if (llr <= B_BOUND) return { verdict: 'H0', at: i + 1, llr, wins };
  }
  return { verdict: 'continue', at: seq.length, llr, wins };
}

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '  -  ';

function report(c, r, gamesSeen) {
  const p = c.both + c.neither ? c.both / (c.both + c.neither) : 0;
  console.log('\nSPRT — sequential test on DECISIVE PAIRS (the unit paired_h2h.js established)\n');
  console.log(`  H0  p = ${P0.toFixed(3)}   not worth shipping`);
  console.log(`  H1  p = ${P1.toFixed(3)}   worth shipping`);
  console.log(`  alpha ${ALPHA}   beta ${BETA}   bounds  accept-H1 >= ${A_BOUND.toFixed(2)}   accept-H0 <= ${B_BOUND.toFixed(2)}\n`);
  console.log(`  games read        ${gamesSeen.toLocaleString()}`);
  console.log(`  pairs             ${c.pairs.toLocaleString()}`);
  console.log(`  2-0 to NEW        ${String(c.both).padStart(7)}   ${pct(c.both, c.pairs)}`);
  console.log(`  1-1 split         ${String(c.split).padStart(7)}   ${pct(c.split, c.pairs)}   <- the team decided it, discarded`);
  console.log(`  0-2 to OLD        ${String(c.neither).padStart(7)}   ${pct(c.neither, c.pairs)}`);
  if (c.halves) console.log(`  unpaired halves   ${String(c.halves).padStart(7)}   (a run still in flight will always have some)`);
  if (c.mismatched) console.log(`  mismatched pairs  ${String(c.mismatched).padStart(7)}   discarded`);
  console.log(`\n  decisive pairs    ${(c.both + c.neither).toLocaleString()}   NEW takes ${(100 * p).toFixed(1)}% of them`);
  console.log(`  log-likelihood    ${r.llr.toFixed(2)}`);

  if (r.verdict === 'H1') {
    console.log(`\n  ==> DECIDED after ${r.at.toLocaleString()} decisive pairs: the NEW arm is better.`);
    console.log(`      Accept H1 at alpha=${ALPHA}. Stop the run.`);
  } else if (r.verdict === 'H0') {
    console.log(`\n  ==> DECIDED after ${r.at.toLocaleString()} decisive pairs: NOT an improvement worth shipping.`);
    console.log(`      Accept H0 at beta=${BETA}. Stop the run. This is a NULL, and a null found early`);
    console.log(`      is the whole point — it costs minutes instead of hours.`);
  } else {
    const need = Math.abs(A_BOUND - r.llr) / Math.abs(LLR_WIN);
    console.log(`\n  ==> UNDECIDED. Keep going.`);
    console.log(`      Roughly ${Math.ceil(need)} more decisive pairs going NEW's way would cross the upper bound;`);
    console.log(`      the truth may also sit between H0 and H1, where SPRT is slowest by design.`);
  }
  if (MAXGAMES && r.verdict !== 'continue' && gamesSeen) {
    const saved = MAXGAMES - gamesSeen;
    if (saved > 0) console.log(`\n  would have saved ${saved.toLocaleString()} of ${MAXGAMES.toLocaleString()} games (${pct(saved, MAXGAMES)})`);
  }
}

/* ---- cross-check against the fixed-n reader --------------------------------------------------- */
function verifyAgainstPairedH2h(file, c) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine', 'paired_h2h.js'), file],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = String(r.stdout || '');
  const grab = re => { const m = out.match(re); return m ? parseInt(m[1].replace(/,/g, ''), 10) : null; };
  const theirBoth = grab(/2-0[^\n]*?([\d,]+)/);
  const theirNeither = grab(/0-2[^\n]*?([\d,]+)/);
  if (theirBoth == null || theirNeither == null) {
    console.log('\n  --verify: could not parse paired_h2h.js output; cross-check SKIPPED, not passed.');
    return;
  }
  const ok = theirBoth === c.both && theirNeither === c.neither;
  console.log(`\n  --verify vs paired_h2h.js:  2-0 ${c.both}/${theirBoth}   0-2 ${c.neither}/${theirNeither}   ${ok ? 'AGREE' : 'DISAGREE'}`);
  if (!ok) {
    console.error('\n  The two readers disagree on the pairing. One of them is wrong and no number here');
    console.error('  may be quoted until that is settled.');
    process.exit(1);
  }
}

/* ---- main ------------------------------------------------------------------------------------- */
if (!WATCH) {
  const rows = collect(TARGET);
  if (!rows.length) { console.error(`no records read from ${TARGET}`); process.exit(2); }
  const c = decisiveSequence(rows);
  const r = runSprt(c.seq);
  report(c, r, rows.length);
  if (VERIFY) verifyAgainstPairedH2h(TARGET, c);
  process.exit(r.verdict === 'continue' ? 3 : 0);
} else {
  /* WATCH: poll the shard directory of a live farm and say the moment it is decided.
   * It does NOT kill the farm. Stopping somebody else's run from a monitoring tool is the kind of
   * side effect that is impossible to debug at 2am; it prints, loudly, and the operator decides. */
  const every = parseInt(flag('every', '60'), 10) * 1000;
  console.log(`watching ${TARGET} every ${every / 1000}s — Ctrl-C to stop watching (the run is untouched)`);
  const tick = () => {
    const rows = collect(TARGET);
    const c = decisiveSequence(rows);
    const r = runSprt(c.seq);
    const stamp = new Date().toISOString().slice(11, 19);
    const p = c.both + c.neither ? (100 * c.both / (c.both + c.neither)).toFixed(1) : '  - ';
    console.log(`  ${stamp}  ${String(rows.length).padStart(7)} games  ${String(c.both + c.neither).padStart(6)} decisive  ${p}%  LLR ${r.llr.toFixed(2)}  ${r.verdict}`);
    if (r.verdict !== 'continue') {
      report(c, r, rows.length);
      console.log('\n  The run is still going. Stop it yourself if you agree with the verdict.');
      process.exit(0);
    }
  };
  tick();
  setInterval(tick, every);
}
