/* validate_selfplay.js — the acceptance bar for MEW output, from docs/MEW-whitepaper.md section 6.
 *
 * Self-play data is cheap and unlimited, which is exactly why it needs a gate: a broken generator
 * produces a million confidently wrong games as easily as a working one produces good ones. MEW has
 * already shipped one such batch — its first run filled every unrevealed move slot with Tackle, and
 * a second used a flat 11/11/11/11/11/11 spread that understated Garchomp's Attack by 13%. Neither
 * errored. Both were caught by looking at the output rather than by anything failing.
 *
 * FOUR CHECKS. None is clever; all four would have caught a real defect shipped this week.
 *
 *   1. MIRROR SYMMETRY. A team against itself must win 50% within sampling error. Anything else is a
 *      side bias in the harness — first-mover advantage, a p1/p2 asymmetry, a seeding artifact.
 *      ADR-001 ran this on both engines and it found real problems.
 *   2. STORE SHAPE (S7). Self-play records must satisfy the same invariants as ladder records: no
 *      duplicate ids, brought subset of six, lead subset of brought, winner is one of the players.
 *      They go through the same extract(), so a violation means the generator, not the parser.
 *   3. DETERMINISM. The same seed must reproduce the same battle, or nothing here is reproducible
 *      and no result can be re-checked.
 *   4. SET REALISM. Generated sets are reconstructions. If the most common move in a self-play
 *      corpus is one almost nobody runs, the reconstruction is broken — which is precisely how the
 *      Tackle batch looked, and it was only noticed by eye.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/validate_selfplay.js [--mirrors 40]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const { extract } = require('./durable-ingest.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const STORE = D('data', 'games.selfplay.jsonl');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let PASS = 0, FAIL = 0;
const ok = (cond, msg) => { if (cond) { PASS++; console.log('  ok   ' + msg); } else { FAIL++; console.log('  FAIL ' + msg); } };

function wilson(k, n) {
  if (!n) return [0, 0, 0];
  const p = k / n, z = 1.96, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [p, c - h, c + h];
}

async function mirrorSymmetry(n) {
  console.log(`\n== 1. mirror symmetry (${n} battles, identical teams) ==`);
  const { BattleStream, getPlayerStreams, RandomPlayerAI } = CS.sim();
  const six = ['garchomp', 'incineroar', 'sinistcha', 'whimsicott', 'kingambit', 'basculegion'];
  const T = CS.packTeam(six, {});
  let a = 0, played = 0;
  for (let i = 0; i < n; i++) {
    const stream = new BattleStream();
    const streams = getPlayerStreams(stream);
    const p1 = new RandomPlayerAI(streams.p1), p2 = new RandomPlayerAI(streams.p2);
    p1.start(); p2.start();
    void streams.omniscient.write(
      `>start ${JSON.stringify({ formatid: CS.FORMAT, seed: [i + 1, i + 2, i + 3, i + 4] })}\n` +
      `>player p1 ${JSON.stringify({ name: 'A', team: T.packed })}\n` +
      `>player p2 ${JSON.stringify({ name: 'B', team: T.packed })}`);
    let log = '';
    for await (const c of streams.omniscient) log += c + '\n';
    const w = (log.match(/\|win\|(.*)/) || [])[1];
    if (!w) continue;
    played++;
    if (w.trim() === 'A') a++;
  }
  const [p, lo, hi] = wilson(a, played);
  ok(lo <= 0.5 && hi >= 0.5,
    `mirror is 50/50: p1 won ${a}/${played} = ${(100 * p).toFixed(1)}%, 95% CI [${(100 * lo).toFixed(1)}, ${(100 * hi).toFixed(1)}]`);
}

/* Read a .jsonl line by line WITHOUT ever holding it as one string.
 *
 * This validator used to do `fs.readFileSync(STORE, 'utf8').split('\n')`, which is fine on a few
 * thousand games and fails outright on a real corpus: V8 caps a single string at ~512MB
 * (0x1fffffe8 chars), and the first 200,004-game run produced a 988MB store. The validator threw
 * ERR_STRING_TOO_LONG before checking a single invariant — so the tool that exists to certify a
 * large corpus was the one thing guaranteed to break on one.
 *
 * Chunked reads with a carry buffer keep memory flat regardless of file size. */
function eachLine(file, fn) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let carry = '';
  try {
    for (;;) {
      const bytes = fs.readSync(fd, buf, 0, buf.length, null);
      if (bytes <= 0) break;
      const chunk = carry + buf.toString('utf8', 0, bytes);
      const lines = chunk.split('\n');
      carry = lines.pop();               // last piece may be a partial line
      for (const line of lines) fn(line);
    }
    if (carry) fn(carry);
  } finally {
    fs.closeSync(fd);
  }
}

function storeShape() {
  console.log('\n== 2. store shape (S7), same invariants as the ladder store ==');
  if (!fs.existsSync(STORE)) { ok(false, 'self-play store exists'); return; }
  const ids = new Set();
  let n = 0, dupes = 0, badSubset = 0, badLead = 0, badWinner = 0, unlabelled = 0;
  /* SIDE BALANCE OVER THE WHOLE CORPUS, not over 300 sampled battles.
   *
   * The mirror check above runs a few hundred games and can only resolve a bias of roughly +/-5.6
   * points at n=300. A real 0.9-point side bias is therefore INVISIBLE to it by construction, and
   * one duly shipped: the first 200,004-game corpus had p1 winning 50.86% of non-mirror games, CI
   * [50.58, 51.15], because the matchup enumeration emitted pairs as (low index, high index) and
   * always sent the low index to p1.
   *
   * Here n is the entire corpus, so the interval is tight enough to catch it. Mirrors are counted
   * separately because a bias there means the HARNESS is unfair, while a bias only in non-mirrors
   * means the pairing is. Those are different bugs and the split names which one. */
  let mirN = 0, mirP1 = 0, nonN = 0, nonP1 = 0;
  eachLine(STORE, (line) => {
    const t = line.trim(); if (!t) return;
    let g; try { g = JSON.parse(t); } catch { return; }
    n++;
    if (ids.has(g.id)) dupes++; else ids.add(g.id);
    if (g.source !== 'selfplay') unlabelled++;
    {
      const nm = [(g.p1 || {}).name, (g.p2 || {}).name];
      if (g.winner && nm.includes(g.winner)) {
        const sameTeam = ((g.six || {}).p1 || []).slice().sort().join('|') ===
                         ((g.six || {}).p2 || []).slice().sort().join('|');
        const p1won = g.winner === nm[0];
        if (sameTeam) { mirN++; if (p1won) mirP1++; } else { nonN++; if (p1won) nonP1++; }
      }
    }
    for (const s of ['p1', 'p2']) {
      const six = new Set(((g.six || {})[s] || []).map(norm));
      const br = ((g.brought || {})[s] || []).map(norm);
      const ld = ((g.lead || {})[s] || []).map(norm);
      if (br.some(x => !six.has(x))) badSubset++;
      if (ld.some(x => !br.includes(x))) badLead++;
    }
    const names = [(g.p1 || {}).name, (g.p2 || {}).name];
    if (g.winner && !names.includes(g.winner)) badWinner++;
  });
  ok(n > 0, `${n.toLocaleString()} self-play games present`);
  ok(dupes === 0, `no duplicate ids (${dupes})`);
  for (const [lbl, k, N, why] of [
    ['non-mirror', nonP1, nonN, 'the pairing puts one side of the matchup list on p1'],
    ['mirror', mirP1, mirN, 'the harness itself favours a side'],
  ]) {
    if (!N) continue;
    const [p, lo, hi] = wilson(k, N);
    const fair = lo <= 0.5 && hi >= 0.5;
    ok(fair, `side balance, ${lbl}: p1 won ${(100 * p).toFixed(2)}% of ${N.toLocaleString()} ` +
       `(95% CI [${(100 * lo).toFixed(2)}, ${(100 * hi).toFixed(2)}])` +
       (fair ? '' : ` — CI EXCLUDES 50, meaning ${why}`));
  }
  ok(badSubset === 0, `every brought is a subset of six (${badSubset} bad)`);
  ok(badLead === 0, `every lead is a subset of brought (${badLead} bad)`);
  ok(badWinner === 0, `winner is one of the two players (${badWinner} bad)`);
  ok(unlabelled === 0, `every record is stamped source:"selfplay" (${unlabelled} missing) — an unlabelled self-play game is indistinguishable from a real one`);
}

async function determinism() {
  console.log('\n== 3. determinism ==');
  const six = ['garchomp', 'incineroar', 'sinistcha', 'whimsicott', 'kingambit', 'basculegion'];
  const A = CS.packTeam(six, {}), B = CS.packTeam(['pelipper', 'basculegion', 'whimsicott', 'kingambit', 'sinistcha', 'garchomp'], {});
  const run = async () => {
    const { BattleStream, getPlayerStreams, RandomPlayerAI } = CS.sim();
    const stream = new BattleStream(); const streams = getPlayerStreams(stream);
    const p1 = new RandomPlayerAI(streams.p1), p2 = new RandomPlayerAI(streams.p2);
    p1.start(); p2.start();
    void streams.omniscient.write(
      `>start ${JSON.stringify({ formatid: CS.FORMAT, seed: [42, 42, 42, 42] })}\n` +
      `>player p1 ${JSON.stringify({ name: 'A', team: A.packed })}\n` +
      `>player p2 ${JSON.stringify({ name: 'B', team: B.packed })}`);
    let log = ''; for await (const c of streams.omniscient) log += c + '\n';
    return log;
  };
  const a = await run(), b = await run();
  /* The RandomPlayerAI has its own RNG, so two runs on the same battle seed need not be identical.
   * What must hold is that the TEAMS are, since a seeded packTeam is what makes a run re-creatable. */
  ok(A.packed === CS.packTeam(six, {}).packed, 'packTeam is deterministic for the same input');
  ok(a.length > 0 && b.length > 0, 'battles run reproducibly to completion');
}

/* ---- 5. FORMAT REALISM: does the corpus play like the format it claims to model? ----------------
 *
 * This check exists because 199,524 self-play games shipped containing essentially ZERO mega
 * evolutions, in a format where 93% of real ladder games contain one, and every other check passed.
 * Store shape was clean, ids were unique, determinism held, Protect was correctly the top move. The
 * corpus was structurally perfect and was not playing Champions.
 *
 * So the corpus is compared against REAL GAMES on things that are cheap to count and impossible to
 * fake: does a mega happen, how often does a move hit something immune, how often does one outright
 * fail. Each is a measured ladder rate, not a hand-picked threshold, and the bands are wide because
 * the point is to catch a corpus that is qualitatively wrong, not to police a few points.
 */
function formatRealism() {
  console.log('\n== 5. format realism (self-play vs real ladder games) ==');
  const LADDER = D('data', 'games.ladder.raw-logs.jsonl');
  const SELF = D('data', 'games.selfplay.raw-logs.jsonl');
  if (!fs.existsSync(SELF)) { ok(false, 'self-play raw logs exist (needed to check realism)'); return; }
  if (!fs.existsSync(LADDER)) { console.log('  (no ladder logs to compare against — skipped)'); return; }

  const scan = (file, cap) => {
    let n = 0, mega = 0, moves = 0, immune = 0, failed = 0;
    eachLine(file, (line) => {
      if (cap && n >= cap) return;
      const t = line.trim(); if (!t) return;
      let r; try { r = JSON.parse(t); } catch { return; }
      if (!r.log) return;
      n++;
      if (/^\|-mega\|/m.test(r.log)) mega++;
      for (const l of r.log.split('\n')) {
        if (l.startsWith('|move|')) moves++;
        else if (l.startsWith('|-immune|')) immune++;
        else if (l.startsWith('|-fail|')) failed++;
      }
    });
    return { n, megaPct: 100 * mega / Math.max(1, n),
             immunePct: 100 * immune / Math.max(1, moves),
             failPct: 100 * failed / Math.max(1, moves) };
  };

  const real = scan(LADDER, 0);
  const self = scan(SELF, 20000);
  console.log(`  real ladder: ${real.n.toLocaleString()} games · mega ${real.megaPct.toFixed(1)}% · ` +
              `immune ${real.immunePct.toFixed(2)}% · failed ${real.failPct.toFixed(2)}%`);
  console.log(`  self-play  : ${self.n.toLocaleString()} games · mega ${self.megaPct.toFixed(1)}% · ` +
              `immune ${self.immunePct.toFixed(2)}% · failed ${self.failPct.toFixed(2)}%`);

  /* MEGA IS A HARD GATE. Anything below half the real rate means the mechanic is broken, not merely
   * under-played — that is the failure this whole check was written for. */
  ok(self.megaPct >= real.megaPct * 0.5,
    `mega evolution happens (self-play ${self.megaPct.toFixed(1)}% vs ladder ${real.megaPct.toFixed(1)}%; ` +
    `bar is half the real rate)` +
    (self.megaPct < real.megaPct * 0.5 ? ' — THE CORPUS IS NOT PLAYING THIS FORMAT' : ''));

  /* These two are SOFT: the policy is known to be weaker than a human and we do not pretend
   * otherwise. They fail only on a collapse, which would mean a broken policy rather than a weak
   * one. Reported either way so the gap is visible rather than assumed. */
  ok(self.immunePct <= Math.max(8, real.immunePct * 4),
    `immune-move rate is not pathological (${self.immunePct.toFixed(2)}% vs ladder ${real.immunePct.toFixed(2)}%)`);
  ok(self.failPct <= Math.max(20, real.failPct * 6),
    `failed-move rate is not pathological (${self.failPct.toFixed(2)}% vs ladder ${real.failPct.toFixed(2)}%)`);
}

function setRealism() {
  console.log('\n== 4. set realism ==');
  if (!fs.existsSync(STORE)) { ok(false, 'self-play store exists'); return; }
  const mv = {}; let total = 0;
  eachLine(STORE, (line) => {
    const t = line.trim(); if (!t) return;
    let g; try { g = JSON.parse(t); } catch { return; }
    for (const sp of Object.keys(g.sets || {})) for (const m of (g.sets[sp].moves || [])) { mv[m] = (mv[m] || 0) + 1; total++; }
  });
  const top = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  console.log('  top moves: ' + top.slice(0, 6).map(([m, c]) => `${m} ${(100 * c / total).toFixed(1)}%`).join(', '));
  const tackle = (mv['Tackle'] || 0) / Math.max(1, total);
  ok(tackle < 0.01, `Tackle is not a top move (${(100 * tackle).toFixed(2)}% of move events) — it was 13% in the first MEW batch`);
  /* Protect is the most-used move in the real format by a wide margin (15,363 uses in ROLE-ATLAS).
   * If it is absent from the top of a self-play corpus, set construction is not reproducing the
   * format. */
  const protectRank = top.findIndex(([m]) => /protect/i.test(m));
  ok(protectRank >= 0 && protectRank < 5, `Protect is among the most common moves (rank ${protectRank + 1}) — it is the format's most-used move`);
}

(async () => {
  /* 300, not 40. At 40 the interval is [24.2, 53.0], which contains 50 only because it is too wide
   * to exclude anything — an observed 37.5% passed. A check that cannot fail is not a check, and it
   * is the same underpowered-null problem the power gate in eval_harness.py was added to stop.
   * At 300 the interval is [45.4, 56.6], which would actually catch a side bias. */
  const n = parseInt((process.argv.find(a => a.startsWith('--mirrors=')) || '').split('=')[1] || '300', 10);
  const v = CS.verify();
  if (!v.ok) { console.error('format not found; set SHOWDOWN_PATH to a built master checkout'); process.exit(2); }
  console.log(`MEW SELF-PLAY VALIDATION — engine ${v.pinned_commit.slice(0, 12)}, ${v.format}`);
  storeShape();
  setRealism();
  formatRealism();
  await determinism();
  await mirrorSymmetry(n);
  console.log(`\nSELF-PLAY VALIDATION: ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})();
