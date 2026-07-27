/* build_mew_bundle.js — a small browser bundle of self-play games for the MEW booth.
 *
 * The full self-play store is unbounded by design, so the site must never load it. This takes a
 * handful of games, strips them to what the viewer draws, and writes data/mew.js.
 *
 * GENERATED FILE. Do not hand-edit data/mew.js.
 *   node build/build_mew_bundle.js [count]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const N = parseInt(process.argv[2] || '50', 10);
/* --src <file>  bundle from ANY run, not only the self-play store.
 *
 * The booth could only ever show games from data/games.selfplay.jsonl, so every head-to-head this
 * project runs -- MAG against its predecessor, MAG against a random bot -- was unwatchable. A seed
 * could be quoted and not played, which made "here are some seeds to review" useless advice. Any
 * store written by engine/mew.js has the same shape and a raw-logs file beside it, so there was
 * never a reason to hardcode one. */
const srcArg = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? process.argv[i + 1] : null; })();
const SRC = srcArg ? path.resolve(srcArg) : D('data', 'games.selfplay.jsonl');
const RAW = SRC.replace(/\.jsonl$/, '.raw-logs.jsonl');
if (!fs.existsSync(SRC)) { console.error(`no store at ${SRC}; run engine/mew.js first`); process.exit(1); }

/* STREAM. The store is ~1GB at 200,004 games and V8 caps a single string near 512MB, so
 * readFileSync(...).split('\n') threw ERR_STRING_TOO_LONG the moment the corpus got real.
 *
 * Only N games are ever shown, so the whole store is never held: a bounded "longest so far" list is
 * kept and everything else is dropped as it streams past. Memory is O(N), not O(store). */
/* SAMPLE ACROSS THE LENGTH DISTRIBUTION, NOT THE TOP OF IT.
 *
 * This used to keep the N LONGEST games. On a real corpus that is badly misleading: self-play games
 * run to a median of about 10 turns, and the longest-first rule filled the viewer with 75-82 turn
 * marathons -- every one of the 12 shipped battles. Those are the freak tail, and they are the tail
 * where the policy looks worst, because two bots that do not understand that repeat Protect fails
 * will stall each other for eighty turns. A viewer showing only those misrepresents both the corpus
 * and the model.
 *
 * Reservoir sampling keeps a uniform random sample of the whole corpus in one pass and constant
 * memory, then a few of the longest are added back deliberately so the tail is still visible. Seeded
 * so the same store always produces the same bundle. */
let total = 0;
const RESERVOIR = Math.max(1, N - 2);   // leave room for 2 deliberately-long games
const pool = [];
const longest = [];
let rng = 20260725;                     // fixed seed: the bundle must be reproducible
/* This was `(rng * 1103515245 + 12345) & 0x7fffffff`, the same overflowing LCG that invalidated every
 * confidence interval in engine/chomp_ev.js. In JavaScript a mid-range state times 1103515245 is about
 * 1.4e18, past Number.MAX_SAFE_INTEGER, so the low bits — the ones a reservoir sample depends on — are
 * float rounding noise. Measured: mean 0.4954, chi-square 159.5 on 9 df (5% critical value 16.9), and
 * only 16,403 distinct values in 200,000 draws.
 *
 * The stakes here are lower than in chomp_ev.js: this file samples which games go into a viewer bundle,
 * so a biased draw makes the bundle unrepresentative rather than publishing a wrong interval. It is
 * fixed anyway, because "the sample is biased in a way nobody characterised" is not a property worth
 * keeping, and because tests/test-prng.js now refuses the constant outright.
 *
 * mulberry32: all arithmetic via Math.imul and >>>, so the state never leaves 32-bit integer range.
 * Still deterministic from the seed above, so the bundle stays reproducible. */
const rand = () => {
  rng = (rng + 0x6D2B79F5) | 0;
  let t = rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function consider(g) {
  const len = (g.turns || []).length;
  if (len < 4) return;                  // a 3-turn game shows nothing about what MEW does
  // uniform reservoir over everything
  if (pool.length < RESERVOIR) {
    pool.push(g);
  } else {
    const j = Math.floor(rand() * total);
    if (j < RESERVOIR) pool[j] = g;
  }
  // keep the two longest as well, so the tail is represented rather than hidden
  if (longest.length < 2) {
    longest.push(g);
    longest.sort((a, b) => (a.turns || []).length - (b.turns || []).length);
  } else if (len > (longest[0].turns || []).length) {
    longest[0] = g;
    longest.sort((a, b) => (a.turns || []).length - (b.turns || []).length);
  }
}
{
  const fd = fs.openSync(SRC, 'r');
  const buf = Buffer.alloc(1 << 20);
  let carry = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      const lines = (carry + buf.toString('utf8', 0, n)).split('\n');
      carry = lines.pop();
      for (const line of lines) {
        const t = line.trim(); if (!t) continue;
        let g; try { g = JSON.parse(t); } catch { continue; }
        total++; consider(g);
      }
    }
    if (carry.trim()) { try { const g = JSON.parse(carry.trim()); total++; consider(g); } catch (e) {} }
  } finally { fs.closeSync(fd); }
}
if (!total) { console.error('self-play store is empty'); process.exit(1); }

/* Merge the uniform sample with the two long ones, dedupe by id, and order shortest-first so the
 * viewer opens on something typical rather than on an eighty-turn stall. */
const seenIds = new Set();
const picked = [];
for (const g of pool.concat(longest)) {
  if (g && !seenIds.has(g.id)) { seenIds.add(g.id); picked.push(g); }
}
picked.sort((a, b) => (a.turns || []).length - (b.turns || []).length);

/* ---- SHIP THE RAW PROTOCOL LOG, NOT A PRE-CHEWED SUMMARY --------------------------------------
 * This used to emit a custom {turns:[{n,ev:[...]}]} structure that only our hand-written viewer
 * could read. That was the wrong call: MEW records the EXACT Pokemon Showdown protocol, so the
 * official Showdown replay player — the one every player already knows, with animations, a running
 * log, ability triggers, weather and status icons — reads our games with no conversion at all.
 * Verified 2026-07-25 against play.pokemonshowdown.com/js/replay-embed.js: it rendered a Champions
 * battle correctly, resolved Sinistcha-Masterpiece, and reported "[Mawile's Intimidate]".
 *
 * A raw log averages ~7KB, so 50 battles is ~0.35MB — smaller per unit of usefulness than the
 * summary it replaces, and it can never drift from what the simulator actually emitted.
 */
const wantIds = new Set(picked.map(g => g.id));
const logById = new Map();
{
  const fd = fs.openSync(RAW, 'r');
  const buf = Buffer.alloc(1 << 20);
  let carry = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      const lines = (carry + buf.toString('utf8', 0, n)).split('\n');
      carry = lines.pop();
      for (const line of lines) {
        const t = line.trim(); if (!t) continue;
        let r; try { r = JSON.parse(t); } catch { continue; }
        if (wantIds.has(r.id) && r.log) logById.set(r.id, r.log);
      }
      if (logById.size === wantIds.size) break;
    }
    if (carry.trim()) { try { const r = JSON.parse(carry.trim()); if (wantIds.has(r.id) && r.log) logById.set(r.id, r.log); } catch (e) {} }
  } finally { fs.closeSync(fd); }
}

const slim = picked.filter(g => logById.has(g.id)).map(g => ({
  id: g.id,
  winner: g.winner,
  policy: (g.selfplay || {}).policy || 'unknown',
  seed: (g.selfplay || {}).seed,
  turns: (g.turns || []).length,
  log: logById.get(g.id),
}));
if (!slim.length) {
  console.error('no raw logs matched the sampled games — is ' + path.basename(RAW) + ' present?');
  process.exit(1);
}

const meta = {
  generated: new Date().toISOString().slice(0, 10),
  engine_commit: (picked[0].selfplay || {}).engine_commit || null,
  format: (picked[0].selfplay || {}).format || null,
  total_selfplay_games: total,
  shown: slim.length,
};

const out =
  `/* data/mew.js — GENERATED by build/build_mew_bundle.js. Do not hand-edit.\n` +
  ` * A small sample of MEW self-play games for the browser viewer. The full self-play store is\n` +
  ` * unbounded and must never be loaded by the site. */\n` +
  `window.MEW = ${JSON.stringify({ meta, games: slim })};\n`;

fs.writeFileSync(D('data', 'mew.js'), out);
console.log(`wrote data/mew.js — ${slim.length} of ${total.toLocaleString()} games, ${(out.length / 1024).toFixed(0)} KB`);
