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
/* STREAMED, BECAUSE THE STORE IS BIGGER THAN A JAVASCRIPT STRING.
 *
 * The first version of this function did `readFileSync(file, 'utf8').split('\n')` inside a bare
 * catch that returned an empty array. On the finished 194,514-game head-to-head — 1.59 GB — V8 threw
 * ERR_STRING_TOO_LONG (the cap is 0x1fffffe8 characters, ~512 MB), the catch swallowed it, and this
 * tool reported "no records read" as though the run had produced nothing.
 *
 * That is precisely the silent-fallback habit the 2026-07-31 whole-repo review named as the single
 * highest-yield thing to fix, committed here hours after it was written up. Worse, the trap was
 * already documented in build/build_mew_bundle.js, which streams for exactly this reason and says so.
 *
 * So: read in chunks and keep the tail between them, and let a read error THROW. A tool that cannot
 * read its input must say that, not report zero. */
function lineStream(file, onRow) {
  const CHUNK = 1 << 22;                                  // 4 MB
  const buf = Buffer.allocUnsafe(CHUNK);
  let fd;
  try { fd = fs.openSync(file, 'r'); }
  catch (e) { throw new Error(`sprt: cannot open ${file} — ${e.message}`); }
  let tail = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, CHUNK, null);
      if (!n) break;
      const lines = (tail + buf.toString('utf8', 0, n)).split('\n');
      tail = lines.pop();                                 // possibly a partial line; carry it
      for (const line of lines) {
        const t = line.trim(); if (!t) continue;
        let g; try { g = JSON.parse(t); } catch (e) { continue; }   // a torn line is not a read failure
        if (g && g.selfplay) onRow(g);
      }
    }
    const t = tail.trim();
    if (t) { try { const g = JSON.parse(t); if (g && g.selfplay) onRow(g); } catch (e) { /* truncated */ } }
  } finally { try { fs.closeSync(fd); } catch (e) { /* already closed */ } }
}

function filesFor(target) {
  const st = (() => { try { return fs.statSync(target); } catch (e) { return null; } })();
  if (st && st.isDirectory()) {
    return fs.readdirSync(target)
      .filter(f => /\.jsonl$/.test(f) && !/raw-logs/.test(f))
      .map(f => path.join(target, f));
  }
  return [target];
}

/* ONE STREAMING PASS, HOLDING ONLY THE PAIRS STILL WAITING FOR THEIR SECOND HALF.
 *
 * The first version read every record into an array and then grouped. On the finished head-to-head
 * that is 194,514 full game objects and Node died with "JavaScript heap out of memory" — after the
 * previous version had already died on ERR_STRING_TOO_LONG. Both failures are the same mistake:
 * treating a 1.6 GB append-only store as something you can hold.
 *
 * A paired run writes both halves of a seed close together, so the pending map stays small; and only
 * four fields per record are kept, not the record. Memory is bounded by unmatched seeds in flight
 * rather than by corpus size, so this reads a 200,000-game store the same as a 200-game one. */
function decisiveSequence(target) {
  /* THE NAME FALLBACK WAS THE PART THAT DISAGREED WITH ITSELF, and it was hardcoded to 'score'.
   *
   * winnerPolicy holds a NAME: mew.js:830 writes POLICY when arm 1 won and POLICY2 when arm 2 did.
   * So "arm 1 won" is `winnerPolicy === policy`, read off the record. Hardcoding 'score' instead
   * meant that in the canonical `--policy prior --policy2 score` run this branch called arm 2 the new
   * arm while the arm branch above called arm 1 the new arm -- the same file answering opposite ways
   * depending on which branch a record took, with nothing comparing them.
   *
   * Only reachable for records written before mew.js stamped winnerArm, so this is a correctness fix
   * on a legacy path rather than something that moves a current number. */
  const newName = g => g.selfplay.policy;
  const pending = new Map();
  const seq = [], atRow = [];
  let both = 0, split = 0, neither = 0, halves = 0, mismatched = 0, rows = 0;
  let sawArm = false, sawDistinctNames = false, firstPolicy = null;
  const arms = { old: null, new: null };

  const sixKey = g => JSON.stringify((g.six && g.six.p1 || []).slice().sort())
                    + JSON.stringify((g.six && g.six.p2 || []).slice().sort());
  /* ARM 1 IS THE CHALLENGER. The whole project runs it that way and the labels here say so.
   *
   * mew.js:837 stamps winnerArm = 1 for the `--policy`/`--weights`/`--greedy` arm and 2 for the `2`
   * suffixed one. paired_h2h.js:183 builds its NEW label from arm 1 and prints it as NEW, and the run
   * that measured greedy at 79.7% put `--greedy` on arm 1. So NEW = arm 1, consistently, and this
   * line agrees with the file that established the unit.
   *
   * A CORRECTION, recorded because it was nearly shipped. On 2026-08-01 this was changed to read
   * `winnerArm === 2` as new, on the strength of mew.js:215 calling --weights2 "the challenger". That
   * comment is about the EXPLOITABILITY search, where WOBBUFFET hunts for a vector that beats a fixed
   * MAG, and not about the standard A/B. Making the change would have inverted sprt against
   * paired_h2h and against every run already analysed. Reverted the same day.
   *
   * WHAT IS ACTUALLY INCONSISTENT is the name-based fallback below, not the arm path -- see the note
   * on NEW_NAME. */
  const wonNew = g => (g.selfplay.winnerArm === 1 || g.selfplay.winnerArm === 2)
    ? (g.selfplay.winnerArm === 1 ? 1 : 0)
    : (g.selfplay.winnerPolicy === newName(g) ? 1 : 0);

  const onRow = (g) => {
    rows++;
    if (g.selfplay.winnerArm === 1 || g.selfplay.winnerArm === 2) sawArm = true;
    if (firstPolicy === null) firstPolicy = g.selfplay.policy;
    /* What OLD and NEW actually are, taken from the run itself so the report can name them rather
     * than leaving the reader to know which flag went where. */
    if (!arms.new) arms.new = g.selfplay.weights || g.selfplay.policy || null;
    if (!arms.old) arms.old = g.selfplay.weights2 || g.selfplay.policy2 || g.selfplay.policy || null;
    if ((g.selfplay.policy2 || g.selfplay.policy) !== g.selfplay.policy) sawDistinctNames = true;

    const k = String(g.selfplay.seed);
    const rec = { six: sixKey(g), swapped: g.selfplay.swapped, won: wonNew(g) };
    const prev = pending.get(k);
    if (!prev) { pending.set(k, rec); return; }
    pending.delete(k);
    /* Both halves must genuinely be the same matchup played from opposite sides, or the pairing is
     * a fiction — the same two checks paired_h2h.js applies. */
    if (prev.six !== rec.six || prev.swapped === rec.swapped) { mismatched++; return; }
    const sum = prev.won + rec.won;
    /* ROWS-SO-FAR IS RECORDED WITH EACH DECISIVE PAIR. Without it the saving was computed against
     * the TOTAL games read, which reported "saved 2.7%" for a run that was decided after 487 of
     * 26,405 decisive pairs — under 2% of the corpus. The whole claim of this file is how early it
     * stops, so reporting that number wrongly makes the tool look worthless when it is not. */
    if (sum === 2) { both++; seq.push(1); atRow.push(rows); }
    else if (sum === 1) { split++; }
    else { neither++; seq.push(0); atRow.push(rows); }
  };

  for (const f of filesFor(target)) lineStream(f, onRow);
  halves = pending.size;

  if (!sawDistinctNames && !sawArm && rows) {
    console.error('\nREFUSING TO REPORT: both arms carry the same policy name and no record carries');
    console.error('winnerArm, so a win cannot be attributed to an arm. Same refusal as paired_h2h.js.');
    process.exit(2);
  }
  return { seq, atRow, both, split, neither, halves, mismatched, rows, arms, pairs: both + split + neither };
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
  /* NAME THE ARMS. This report said NEW and OLD and left which-is-which to a convention the caller
   * had to know -- and the convention was wrong here for as long as winnerArm existed. Printing the
   * file each label refers to makes a swapped run visible in the output rather than plausible. */
  const short = f => (f ? String(f).split(/[\\/]/).pop() : '(the default vector)');
  const a = (c.arms || {});
  console.log(`  NEW  =  arm 1, --policy/--weights/--greedy    ${short(a.new)}`);
  console.log(`  OLD  =  arm 2, --policy2/--weights2/--greedy2 ${short(a.old)}\n`);
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
  if (r.verdict !== 'continue' && c.atRow && c.atRow[r.at - 1] != null) {
    const at = c.atRow[r.at - 1];
    const total = MAXGAMES || gamesSeen;
    const saved = total - at;
    console.log(`\n  decided ${at.toLocaleString()} games in, out of ${total.toLocaleString()}`);
    if (saved > 0) console.log(`  would have saved ${saved.toLocaleString()} games (${pct(saved, total)} of the run)`);
  }
}

/* ---- cross-check against the fixed-n reader --------------------------------------------------- */
function verifyAgainstPairedH2h(file, c) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine', 'paired_h2h.js'), file],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = String(r.stdout || '');
  const grab = re => { const m = out.match(re); return m ? parseInt(m[1].replace(/,/g, ''), 10) : null; };
  /* MATCH WHAT IT ACTUALLY PRINTS. The first version grepped for "2-0" and "0-2", which appear
   * nowhere in paired_h2h.js's output — it writes "NEW won both directions". So --verify reported
   * "could not parse, cross-check SKIPPED", which is honest and useless: the one guard against these
   * two readers diverging never actually ran. */
  const theirBoth = grab(/NEW won both directions\s+([\d,]+)/);
  const theirNeither = grab(/OLD won both directions\s+([\d,]+)/);
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
  const c = decisiveSequence(TARGET);
  if (!c.rows) { console.error(`no records read from ${TARGET}`); process.exit(2); }
  const r = runSprt(c.seq);
  report(c, r, c.rows);
  if (VERIFY) verifyAgainstPairedH2h(TARGET, c);
  process.exit(r.verdict === 'continue' ? 3 : 0);
} else {
  /* WATCH: poll the shard directory of a live farm and say the moment it is decided.
   * It does NOT kill the farm. Stopping somebody else's run from a monitoring tool is the kind of
   * side effect that is impossible to debug at 2am; it prints, loudly, and the operator decides. */
  const every = parseInt(flag('every', '60'), 10) * 1000;
  console.log(`watching ${TARGET} every ${every / 1000}s — Ctrl-C to stop watching (the run is untouched)`);
  const tick = () => {
    const c = decisiveSequence(TARGET);
    const r = runSprt(c.seq);
    const stamp = new Date().toISOString().slice(11, 19);
    const p = c.both + c.neither ? (100 * c.both / (c.both + c.neither)).toFixed(1) : '  - ';
    console.log(`  ${stamp}  ${String(c.rows).padStart(7)} games  ${String(c.both + c.neither).padStart(6)} decisive  ${p}%  LLR ${r.llr.toFixed(2)}  ${r.verdict}`);
    if (r.verdict !== 'continue') {
      report(c, r, c.rows);
      console.log('\n  The run is still going. Stop it yourself if you agree with the verdict.');
      process.exit(0);
    }
  };
  tick();
  setInterval(tick, every);
}
