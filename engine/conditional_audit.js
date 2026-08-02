/* conditional_audit.js — how often does a move whose payoff depends on the OPPONENT'S SIMULTANEOUS
 * choice actually whiff, and does the decision rule change that?
 *
 * WHY THIS EXISTS
 * ---------------
 * "Sucker Punch fails 47.9% under greedy, 33.2% under sampling, 33.9% for humans" was measured on
 * 2026-08-02 by a script that was never committed, so the number could not be re-run, re-checked, or
 * pointed at a different corpus. Six documented claims failed measurement that same session; a figure
 * with no tool behind it is exactly the shape that fails. This is the tool.
 *
 * WHAT COUNTS AS "CONDITIONAL" IS DERIVED, NOT LISTED
 * ---------------------------------------------------
 * There is no hand-typed move list here and there must not be one. A move is conditional-on-the-
 * opponent iff its own Showdown handlers CONSULT THE TURN'S ACTION QUEUE — `queue.willMove`,
 * `queue.willAct`, `activeMoveActions`, `target.newlySwitched`. That is the mechanical definition of
 * "my payoff depends on what you chose this turn", it is read off the dex the engine actually runs,
 * and it picks up a move the day the format adds one.
 *
 * It yields three families, and they are NOT the same question, so they are reported apart:
 *
 *   willMove    Sucker Punch, Thunderclap, Upper Hand, Payback, Bolt Beak, Fishious Rend, ...
 *               "did the target still have its move to make?" — the family the greedy question is about.
 *   willAct     Protect, Detect, Spiky Shield, King's Shield, Wide Guard, ... — the block family.
 *               Its failure is CONSECUTIVE USE, and its whiff is blocking nothing at all. Both counted.
 *   selfTurn    Fake Out, First Impression, Mat Block — gated on the USER's own turn count, not on the
 *               opponent. Reported so the derivation is visible, excluded from the greedy question.
 *
 * WHAT IS MEASURED
 * ----------------
 *   used     times the move was clicked
 *   failed   `|-fail|` on the user immediately after — the move did nothing at all
 *   blocked  `|-activate| move: Protect`-family — for the block family, the times it EARNED its turn
 *
 * PER ARM, BECAUSE THE LEVERS ARE PER ARM. In an h2h corpus the two players are different builds, so
 * pooling them measures the average of the thing being compared and hides the comparison. Each record
 * stamps `selfplay.swapped`, which says which side arm 1 sat on that game, and every rate here is
 * attributed through it. A pooled number for a greedy-vs-sampling run is not a weaker measurement, it
 * is the wrong one.
 *
 *   node engine/conditional_audit.js --self data/games.h2h-greedy-vs-sample.jsonl
 *   node engine/conditional_audit.js --self data/games.selfplay.jsonl --json data/conditional-audit.json
 *
 * The human column is the CLEAN ladder store via engine/quality.js, never the raw one — 87% of the raw
 * store is bots and stubs, and a bot baseline for "is our bot human-like" is circular.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
}
const _self = arg('self', 'data/games.selfplay.jsonl');
const SELF_STORE = path.isAbsolute(_self) ? _self : D(_self);
const SELF_LOGS = SELF_STORE.replace(/\.jsonl$/, '') + '.raw-logs.jsonl';
const LAD_STORE = D('data', 'games.ladder.jsonl');
const LAD_LOGS = D('data', 'games.ladder.raw-logs.jsonl');
const JSON_OUT = arg('json', null);
const CALIBRATE = arg('calibrate', null);
const LIMIT = parseInt(arg('limit', '0'), 10);

/* ---- the derivation ---------------------------------------------------------------------------
 * Read every handler the dex carries for a move and look for a reference to the turn's action queue.
 * `toString()` on a handler is the same mechanism board.js uses to ship handlers to the browser, so
 * this is not a novel trick — it is the one the repo already trusts for 225 of 225 handlers. */
const HANDLERS = ['onTry', 'onTryHit', 'onTryMove', 'onModifyMove', 'onModifyPriority',
  'basePowerCallback', 'onBasePower', 'onPrepareHit', 'onHit', 'onHitField', 'condition'];

function handlerSource(m) {
  const out = [];
  for (const k of HANDLERS) {
    const v = m[k];
    if (typeof v === 'function') out.push(String(v));
    else if (v && typeof v === 'object') for (const kk of Object.keys(v)) {
      if (typeof v[kk] === 'function') out.push(String(v[kk]));
    }
  }
  return out.join('\n');
}

/* The three probes, each a mechanism rather than a name. Order matters: a move that consults
 * willMove/willAct is conditional on the OPPONENT even if it also reads its own turn counter
 * (Mat Block does both), and the opponent dependency is the one being studied. */
const PROBES = [
  { family: 'willMove', re: /queue\.(willMove|prioritizeAction)|newlySwitched/ },
  { family: 'willAct', re: /queue\.willAct/ },
  { family: 'selfTurn', re: /activeMoveActions/ },
];

function deriveConditional() {
  const byId = new Map();
  for (const m of dex.moves.all()) {
    const src = handlerSource(m);
    if (!src) continue;
    for (const p of PROBES) {
      if (p.re.test(src)) { byId.set(m.id, { id: m.id, name: m.name, family: p.family }); break; }
    }
  }
  return byId;
}
const COND = deriveConditional();
if (!COND.size) {
  console.error('derived ZERO conditional moves — the handler probe found nothing, which means the\n' +
    'derivation is broken, not that the format has no conditional moves. Refusing to report.');
  process.exit(1);
}

/* ---- corpus reading ---------------------------------------------------------------------------- */
function eachLine(file, fn) {
  if (!fs.existsSync(file)) return false;
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let carry = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      const lines = (carry + buf.toString('utf8', 0, n)).split('\n');
      carry = lines.pop();
      for (const l of lines) if (fn(l) === false) return true;
    }
    if (carry) fn(carry);
  } finally { fs.closeSync(fd); }
  return true;
}

/* A LINE THAT WILL NOT PARSE IS A FACT ABOUT THE CORPUS, NOT A NON-EVENT.
 *
 * Every `catch { return }` over a JSON.parse in this repo means "skip it", and skipping silently is
 * how a half-written shard reads as a smaller corpus rather than as a broken one. Counted here and
 * printed, so a truncated file shows up as a number instead of as quietly missing games. */
const BAD = { store: 0, logs: 0, stamp: 0 };

const blank = () => ({ moves: 0, per: Object.create(null) });

/* The unit of independence. Two games between the same two teams are near-replicates, so they must
 * resample together. Falls back to the game id when a record carries no sheets — that is one cluster
 * per game, which is the old behaviour, and it is COUNTED rather than assumed harmless. */
let CLUSTER_FALLBACK = 0;
function clusterKey(rec, id) {
  const s = rec && rec.sheets;
  if (!s || !s.p1 || !s.p2) { CLUSTER_FALLBACK++; return 'game:' + id; }
  const t = side => (s[side] || []).map(m => norm(m && m.species)).sort().join(',');
  const a = t('p1'), b = t('p2');
  return a < b ? a + '|' + b : b + '|' + a;      // unordered: the seat is not part of the matchup
}
function bump(acc, id, field) {
  const r = acc.per[id] || (acc.per[id] = { used: 0, failed: 0, blocked: 0 });
  r[field]++;
}

/* Which ARM was this side, this game. `swapped` is stamped per record by mew.js: false means arm 1 sat
 * on p1. A corpus with no stamp (the ladder) has no arms, and asking for one would be inventing a
 * distinction that does not exist — hence the explicit null rather than a default of 1. */
function armOf(rec, side) {
  const sp = rec && rec.selfplay;
  if (!sp || typeof sp.swapped !== 'boolean') return null;
  return (side === 'p1') === !sp.swapped ? 1 : 2;
}

/* One pass over one corpus. `armFor(id, side)` returns 1, 2 or null; null pools into a single bucket
 * labelled 'all', which is what a human corpus wants. */
function scan(store, logs, keep, armFor) {
  const buckets = new Map();          // arm label -> counters, pooled over the corpus
  const G = k => buckets.get(k) || (buckets.set(k, blank()), buckets.get(k));
  const kept = new Map();             // id -> record, for the arm lookup
  /* PER-GAME counts, kept so the interval can be a CLUSTER bootstrap. A move is not an independent
   * observation: the two clicks of Sucker Punch in one game share a team, a matchup and a seed. The
   * naive two-proportion test ignores that and it is not a small correction — run on
   * games.selfplay, whose two arms are the SAME BUILD, it reports a 9.6-point difference at z=3.09.
   * An instrument that finds a significant difference between a build and itself is measuring its own
   * assumption. Resampling GAMES instead of moves is the fix, and the identical-arm corpora are the
   * falsification test for it. */
  const perGame = [];                 // [{ armKey: { moves, per: {id:{used,failed,blocked}} } }]
  let games = 0, rejected = 0;

  eachLine(store, (line) => {
    const t = line.trim(); if (!t) return;
    let g; try { g = JSON.parse(t); } catch (e) { BAD.store++; return; }
    if (keep && !keep(g)) { rejected++; return; }
    if (g.id) kept.set(g.id, g);
    games++;
    if (LIMIT && games >= LIMIT) return false;
  });

  let logGames = 0;
  eachLine(logs, (line) => {
    const t = line.trim(); if (!t) return;
    let r; try { r = JSON.parse(t); } catch (e) { BAD.logs++; return; }
    if (!r.log || !r.id || !kept.has(r.id)) return;
    const rec = kept.get(r.id);
    logGames++;
    /* Everything below counts into THIS GAME's buckets, which are then merged into the corpus totals.
     * Same arithmetic, one extra level, and it is what makes the cluster bootstrap possible at all. */
    const gb = new Map();
    const B = k => gb.get(k) || (gb.set(k, blank()), gb.get(k));

    /* The log is walked in order because a `-fail`/`-activate` belongs to the move line ABOVE it.
     * Attributing by "the last move seen" is exactly how the protocol reads: a failure line names the
     * pokemon it happened to, and the move that caused it is the one just printed. */
    let lastId = null, lastArm = null, lastUser = null;
    /* THE BLOCK IS NOT ANNOUNCED ON THE MOVE LINE THAT CAUSED IT, and reading it as if it were is
     * how this first reported 0.0% blocks for every protect in both corpora — a rate that is flatly
     * impossible and the only reason the defect was visible at all.
     *
     *   |move|p1b: Archaludon|Dragon Pulse|p2a: Altaria      <- the ATTACKER moves
     *   |-activate|p2a: Altaria|move: Protect                <- named on the PROTECTOR, turns later
     *
     * So a block has to be attributed to whoever clicked the block move EARLIER IN THE SAME TURN,
     * not to the last mon that moved. `pending` holds that, and it is cleared on |turn| because
     * Protect's whole point is that it lasts exactly one. */
    let pending = new Map();          // 'p1a: Altaria' -> { id, key, blocked }
    const flush = () => {
      for (const v of pending.values()) if (v.blocked) bump(B(v.key), v.id, 'blocked');
      pending = new Map();
    };
    for (const l of r.log.split('\n')) {
      if (l.startsWith('|move|')) {
        const p = l.split('|');
        const user = p[2] || '', mv = norm(p[3] || '');
        const side = user.slice(0, 2);
        const arm = armFor ? armFor(rec, side) : null;
        const key = arm == null ? 'all' : 'arm' + arm;
        B(key).moves++;
        lastId = COND.has(mv) ? mv : null; lastArm = key; lastUser = user;
        if (lastId) {
          bump(B(key), lastId, 'used');
          if (COND.get(lastId).family === 'willAct') pending.set(user, { id: lastId, key, blocked: 0 });
        }
      } else if (l.startsWith('|-fail|') && lastId) {
        /* Only the user's own failure counts. A `-fail` on the TARGET is a different event (an
         * immunity, a blocked status) and counting it would inflate every attacking move. */
        if ((l.split('|')[2] || '') === lastUser) {
          bump(B(lastArm), lastId, 'failed');
          /* A Protect that FAILED never went up, so it cannot also be credited with blocking. */
          pending.delete(lastUser);
        }
      } else if (l.startsWith('|-activate|') && /\|move: /.test(l)) {
        const who = l.split('|')[2] || '';
        const p = pending.get(who);
        if (p) p.blocked++;
      } else if (l.startsWith('|turn|')) { flush(); lastId = null; lastUser = null; }
    }
    flush();
    /* Merge this game into the corpus totals, and keep it whole for the bootstrap. */
    for (const [k, acc] of gb) {
      const g2 = G(k);
      g2.moves += acc.moves;
      for (const id of Object.keys(acc.per)) {
        const src = acc.per[id];
        const dst = g2.per[id] || (g2.per[id] = { used: 0, failed: 0, blocked: 0 });
        dst.used += src.used; dst.failed += src.failed; dst.blocked += src.blocked;
      }
    }
    /* THE CLUSTER IS THE TEAM PAIR, NOT THE GAME, and the game-level version of this failed its own
     * falsification test — it called two IDENTICAL builds different at 95% on both identical-arm
     * corpora. The reason is in mew.js:270: the team pool is DEDUPLICATED and games are indexed
     * against a triangular enumeration of pairs, so one team reappears in hundreds of games. Whether
     * Sucker Punch whiffs is mostly a property of the team holding it, so games sharing a team are
     * not independent draws and resampling them as if they were understates the spread.
     *
     * Keyed off the sheets the record already carries, so nothing is typed and nothing is assumed
     * about how teams were generated. */
    gb.cluster = clusterKey(rec, r.id);
    perGame.push(gb);
    if (LIMIT && logGames >= LIMIT) return false;
  });

  return { buckets, perGame, games, rejected, logGames };
}

/* ---- the cluster bootstrap ----------------------------------------------------------------------
 * Resample GAMES with replacement, recompute the arm-1-minus-arm-2 difference in the chosen rate, and
 * read the percentiles. Deterministic: the seed is fixed so the same corpus reports the same interval,
 * because an interval that moves between two runs of the same data is not a measurement.
 *
 * Reported for the identical-arm corpora too, where it MUST straddle zero. That is not a formality —
 * it is the only evidence that the interval means anything, and the naive test fails exactly there. */
function bootstrapDiff(perGame, id, field, k1, k2, iters = 4000, seed = 20260802) {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  /* Collapse games into their clusters ONCE, then resample clusters. */
  const byCluster = new Map();
  for (const gb of perGame) {
    const c = gb.cluster || 'game:?';
    (byCluster.get(c) || byCluster.set(c, []).get(c)).push(gb);
  }
  const clusters = [...byCluster.values()];
  const n = clusters.length;
  const stat = (idxs) => {
    let u1 = 0, f1 = 0, u2 = 0, f2 = 0;
    for (const i of idxs) for (const gb of clusters[i]) {
      const a = gb.get(k1) && gb.get(k1).per[id], b = gb.get(k2) && gb.get(k2).per[id];
      if (a) { u1 += a.used; f1 += a[field]; }
      if (b) { u2 += b.used; f2 += b[field]; }
    }
    if (!u1 || !u2) return null;
    return 100 * (f1 / u1 - f2 / u2);
  };
  const point = stat(Array.from({ length: n }, (_, i) => i));
  const out = [];
  for (let it = 0; it < iters; it++) {
    const idxs = new Array(n);
    for (let i = 0; i < n; i++) idxs[i] = (rnd() * n) | 0;
    const v = stat(idxs);
    if (v != null) out.push(v);
  }
  if (out.length < iters * 0.5) return null;
  out.sort((a, b) => a - b);
  const q = p => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
  return { point, lo: q(0.025), hi: q(0.975), n: out.length, clusters: n };
}

/* ---- calibrating the interval against a KNOWN ZERO -----------------------------------------------
 *
 * An interval is only worth printing if it is right about a difference that is not there. This takes
 * ONE arm, splits its games at random into two halves, and measures the "difference" between them —
 * where the truth is exactly 0.00 by construction. The spread of that is the instrument's own noise
 * floor at this sample size, measured rather than assumed.
 *
 * It exists because the first version of the interval FAILED this test in disguise: run on
 * games.selfplay and games.selfplay-sampling, whose two arms are the same build, it reported
 * differences of +9.6 and -11.1 as significant. Measured properly, the known-zero band on
 * games.selfplay is [-10.3, +10.3] at ~397 uses per side — so those two were ordinary noise sitting
 * on the boundary, and the interval was slightly too narrow rather than broken. Both of those facts
 * are worth having, and neither was available by staring at the number.
 *
 *   node engine/conditional_audit.js --self <corpus> --calibrate suckerpunch
 */
function calibrate(perGame, id, field, armKey, iters = 2000, seed = 4242) {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const games = perGame.filter(gb => gb.get(armKey) && gb.get(armKey).per[id]);
  const out = [];
  for (let it = 0; it < iters; it++) {
    let u1 = 0, f1 = 0, u2 = 0, f2 = 0;
    for (const gb of games) {
      const r = gb.get(armKey).per[id];
      if (rnd() < 0.5) { u1 += r.used; f1 += r[field]; } else { u2 += r.used; f2 += r[field]; }
    }
    if (u1 && u2) out.push(100 * (f1 / u1 - f2 / u2));
  }
  if (!out.length) return null;
  out.sort((a, b) => a - b);
  const q = p => out[Math.min(out.length - 1, Math.floor(p * out.length))];
  const uses = games.reduce((a, gb) => a + gb.get(armKey).per[id].used, 0);
  return { lo: q(0.025), hi: q(0.975), games: games.length, uses };
}

/* ---- the two corpora --------------------------------------------------------------------------- */
function cleanIds() {
  const Q = require('./quality.js');
  const ids = new Set();
  for (const g of Q.loadGames()) if (g.id) ids.add(g.id);
  return ids;
}
function cleanSelf(g, Q, cfg) { return Q.reasons(g, cfg, null).length === 0; }

function main() {
  const Q = require('./quality.js');
  const cfg = Q.config();
  const ids = cleanIds();
  if (!ids.size) {
    console.error('engine/quality.js returned no clean games — refusing to report against an\n' +
      'unfiltered store. 87% of the raw ladder is bots and stubs.');
    process.exit(1);
  }

  const self = scan(SELF_STORE, SELF_LOGS, g => cleanSelf(g, Q, cfg), armOf);
  const real = scan(LAD_STORE, LAD_LOGS, g => g.id && ids.has(g.id), null);
  if (!self.logGames) {
    console.error('no usable generated logs at ' + SELF_LOGS);
    process.exit(1);
  }

  /* The arm labels are only meaningful if the arms actually DIFFER. Read the levers off the corpus's
   * own stamp rather than assuming, and say what each arm was — a run where both arms are identical
   * is a valid corpus and its two columns are two samples of the same build, not a comparison. */
  let stamp = null;
  eachLine(SELF_STORE, (line) => {
    const t = line.trim(); if (!t) return;
    try { const g = JSON.parse(t); if (g.selfplay) { stamp = g.selfplay; return false; } }
    catch (e) { BAD.stamp++; }
  });
  const armDesc = (n) => {
    if (!stamp) return 'arm ' + n;
    const g = n === 1 ? stamp.greedy : stamp.greedy2;
    const j = n === 1 ? stamp.joint : stamp.joint2;
    const w = (n === 1 ? stamp.weights : stamp.weights2) || '(default)';
    return `arm ${n}: ${g ? 'GREEDY' : 'sampling'}${j ? ' +joint' : ''}  ${path.basename(String(w))}`;
  };

  console.log('CONDITIONAL-MOVE AUDIT — moves whose payoff depends on the opponent\'s simultaneous choice\n');
  console.log(`  derived ${COND.size} conditional moves from the dex's own handlers (no list is typed here)`);
  for (const p of PROBES) {
    const ns = [...COND.values()].filter(c => c.family === p.family).map(c => c.name).sort();
    console.log(`    ${p.family.padEnd(9)} ${ns.length.toString().padStart(2)}  ${ns.slice(0, 8).join(', ')}${ns.length > 8 ? ', ...' : ''}`);
  }
  console.log();
  console.log(`  generated : ${self.logGames.toLocaleString()} logs of ${self.games.toLocaleString()} clean games` +
    (self.rejected ? `  (${self.rejected.toLocaleString()} rejected)` : ''));
  console.log(`  human     : ${real.logGames.toLocaleString()} logs of ${real.games.toLocaleString()} CLEAN ladder games`);
  /* Printed even when zero, so a reader knows it was checked rather than never looked at. */
  const badTotal = BAD.store + BAD.logs + BAD.stamp;
  console.log(`  unparseable lines: ${badTotal}` + (badTotal
    ? `  (store ${BAD.store}, logs ${BAD.logs}, stamp ${BAD.stamp}) — a truncated shard reads as a SMALLER corpus, not a broken one`
    : ''));
  if (CLUSTER_FALLBACK) {
    console.log(`  ${CLUSTER_FALLBACK} game(s) carried no sheets, so the bootstrap fell back to one cluster per game there`);
  }
  console.log();
  const armKeys = [...self.buckets.keys()].filter(k => k !== 'all').sort();
  for (const k of armKeys) console.log('  ' + armDesc(+k.slice(3)));
  console.log();

  const human = real.buckets.get('all') || blank();
  const cols = armKeys.length ? armKeys : ['all'];

  /* A rate over a handful of uses is noise, and printing it next to a human rate over thousands
   * invites reading the noise as a finding. The floor is stated rather than silent. */
  const MINUSE = 20;
  const rate = (r, f) => (r && r.used ? 100 * r[f] / r.used : null);
  const per1k = (acc, id) => {
    const r = acc.per[id];
    return acc.moves ? 1000 * (r ? r.used : 0) / acc.moves : 0;
  };
  const cell = v => (v == null ? '     —' : v.toFixed(1).padStart(6));

  const report = { generated: SELF_STORE, arms: {}, moves: {} };
  for (const fam of PROBES.map(p => p.family)) {
    const ids2 = [...COND.values()].filter(c => c.family === fam)
      .filter(c => cols.some(k => (self.buckets.get(k).per[c.id] || {}).used >= MINUSE)
        || (human.per[c.id] || {}).used >= MINUSE)
      .sort((a, b) => {
        const u = (c) => cols.reduce((s, k) => s + ((self.buckets.get(k).per[c.id] || {}).used || 0), 0);
        return u(b) - u(a);
      });
    if (!ids2.length) continue;
    console.log(`  ${fam.toUpperCase()} — ${fam === 'willMove' ? 'payoff depends on whether the target still had its move'
      : fam === 'willAct' ? 'the block family: failure is consecutive use, whiff is blocking nothing'
      : 'gated on the USER\'s own turn counter, not on the opponent'}`);
    const head = '  move'.padEnd(24) + cols.map(k => (k + ' /1k').padStart(12)).join('') +
      '  human /1k' + cols.map(k => (k + ' fail%').padStart(13)).join('') + '  human fail%' +
      (fam === 'willAct' ? cols.map(k => (k + ' blk%').padStart(12)).join('') + '  human blk%' : '') +
      (cols.length === 2 ? '   fail diff, 95% cluster-bootstrap' : '');
    console.log(head);
    console.log('  ' + '-'.repeat(head.length - 2));
    for (const c of ids2) {
      const line = ['  ' + c.name.padEnd(22)];
      for (const k of cols) line.push(per1k(self.buckets.get(k), c.id).toFixed(1).padStart(12));
      line.push(per1k(human, c.id).toFixed(1).padStart(11));
      for (const k of cols) line.push(cell(rate(self.buckets.get(k).per[c.id], 'failed')).padStart(13));
      line.push(cell(rate(human.per[c.id], 'failed')).padStart(12));
      if (fam === 'willAct') {
        for (const k of cols) line.push(cell(rate(self.buckets.get(k).per[c.id], 'blocked')).padStart(12));
        line.push(cell(rate(human.per[c.id], 'blocked')).padStart(11));
      }
      /* The arm-difference and what it is worth. Printed on the SAME row as the rates so a gap can
       * never be read without the interval that says whether it is a gap at all. */
      let boot = null;
      if (cols.length === 2) {
        boot = bootstrapDiff(self.perGame, c.id, 'failed', cols[0], cols[1]);
        if (boot) {
          const straddles = boot.lo <= 0 && boot.hi >= 0;
          line.push('   ' + (boot.point >= 0 ? '+' : '') + boot.point.toFixed(1) +
            ' [' + boot.lo.toFixed(1) + ', ' + boot.hi.toFixed(1) + ']' + (straddles ? '' : '  <-- real'));
        }
      }
      console.log(line.join(''));
      report.moves[c.id] = {
        name: c.name, family: c.family,
        failDiff: boot,
        human: { used: (human.per[c.id] || {}).used || 0, per1k: +per1k(human, c.id).toFixed(2),
                 failPct: rate(human.per[c.id], 'failed'), blockPct: rate(human.per[c.id], 'blocked') },
        arms: Object.fromEntries(cols.map(k => [k, {
          used: (self.buckets.get(k).per[c.id] || {}).used || 0,
          per1k: +per1k(self.buckets.get(k), c.id).toFixed(2),
          failPct: rate(self.buckets.get(k).per[c.id], 'failed'),
          blockPct: rate(self.buckets.get(k).per[c.id], 'blocked'),
        }])),
      };
    }
    console.log();
  }
  console.log(`  rates suppressed below ${MINUSE} uses in every column; "/1k" is uses per 1,000 moves BY THAT ARM.\n`);

  if (CALIBRATE) {
    const id = norm(CALIBRATE);
    if (!COND.has(id)) {
      console.error(`--calibrate ${CALIBRATE}: not one of the ${COND.size} derived conditional moves.`);
      process.exit(1);
    }
    console.log(`  CALIBRATION — ${COND.get(id).name}, one arm split at random into two halves`);
    console.log('  ' + '-'.repeat(72));
    console.log('  The true difference between two random halves of the SAME arm is 0.00. Whatever');
    console.log('  spread appears below is this tool\'s own noise at this sample size, and an');
    console.log('  effect smaller than it is not an effect.');
    for (const k of cols) {
      const c = calibrate(self.perGame, id, 'failed', k);
      if (!c) { console.log(`    ${k}: too few uses to calibrate`); continue; }
      console.log(`    ${k}  ${c.uses} uses over ${c.games} games  ->  known-zero 95% band ` +
        `[${c.lo.toFixed(1)}, ${c.hi.toFixed(1)}]  width ${(c.hi - c.lo).toFixed(1)}pt`);
    }
    console.log();
  }
  for (const k of cols) report.arms[k] = { label: armDesc(+String(k).slice(3)), moves: self.buckets.get(k).moves };
  report.human = { moves: human.moves, games: real.logGames };
  if (JSON_OUT) {
    const out = path.isAbsolute(JSON_OUT) ? JSON_OUT : D(JSON_OUT);
    fs.writeFileSync(out, JSON.stringify(report, null, 1));
    console.log('  wrote ' + path.relative(ROOT, out));
  }
}

module.exports = { deriveConditional, PROBES };
if (require.main === module) main();
