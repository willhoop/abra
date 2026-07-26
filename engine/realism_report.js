/* realism_report.js — compare generated games against real ones on every axis we can measure.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every realism defect in this project was found the same way: someone looked at a battle and said
 * "that seems wrong". That found the Tackle sets, the flat spreads, the missing megas, the identical
 * Incineroar, the Protect spam, the immune moves. It is a real method and it does not scale, because
 * it only finds the defect you happen to be looking at, and only after the games are already made.
 *
 * Every one of those would have been visible in a table comparing generated games to real ones. So
 * this builds that table, on every axis that is cheap to count, and prints the divergences sorted by
 * size. It answers "what is most unlike a real game" instead of "is the thing I suspect wrong".
 *
 * IT IS DESCRIPTIVE, NOT A GATE. validate_selfplay.js decides pass/fail on a handful of hard
 * invariants. This one reports and ranks, because most divergences are expected — the policy IS
 * weaker than a human — and the useful question is which are big enough to be structural.
 *
 * Run it on a SMALL batch before committing to a big one. Fifteen minutes of generation and one
 * table beats seventy minutes and a discovery a day later.
 *
 *   node engine/realism_report.js                          # default paths
 *   node engine/realism_report.js --self data/x.jsonl --limit 20000
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
}
/* Absolute paths must survive: D() would prefix them with the repo root. */
const _self = arg('self', 'data/games.selfplay.jsonl');
const SELF_STORE = path.isAbsolute(_self) ? _self : D(_self);
const SELF_LOGS = SELF_STORE.replace(/\.jsonl$/, '') + '.raw-logs.jsonl';
const LAD_STORE = D('data', 'games.ladder.jsonl');
const LAD_LOGS = D('data', 'games.ladder.raw-logs.jsonl');
const LIMIT = parseInt(arg('limit', '25000'), 10);

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

/* ---- gather ------------------------------------------------------------------------------------
 * Two passes per corpus: the STORE gives team composition and revealed sets, the LOGS give what
 * actually happened. Both are needed — a defect can live in either. */
function gather(store, logs, limit) {
  const R = {
    games: 0, species: {}, items: {}, setKeys: {},
    turnsTotal: 0, turnsGames: 0,
    moves: 0, immune: 0, resisted: 0, superEff: 0, failed: 0, crit: 0,
    megaGames: 0, switches: 0, protects: 0, logGames: 0, faints: 0,
  };
  eachLine(store, (line) => {
    const t = line.trim(); if (!t) return;
    let g; try { g = JSON.parse(t); } catch { return; }
    R.games++;
    const all = new Set();
    for (const s of ['p1', 'p2']) ((g.six || {})[s] || []).forEach(x => all.add(norm(x)));
    all.forEach(x => { R.species[x] = (R.species[x] || 0) + 1; });
    for (const [sp0, s] of Object.entries(g.sets || {})) {
      const sp = norm(sp0);
      if (s && s.item) R.items[norm(s.item)] = (R.items[norm(s.item)] || 0) + 1;
      /* SET DIVERSITY. The identical-Incineroar bug would have shown here as one key per species.
       * Only revealed data is available, so this UNDERSTATES diversity equally for both corpora —
       * which is fine, because the comparison is what matters, not the level. */
      const key = sp + '::' + (s.moves || []).map(norm).sort().join(',') + '::' + norm((s || {}).item || '');
      /* KEPT AS A LIST, NOT A SET, so diversity can be compared at MATCHED SAMPLE SIZE.
       * Storing a Set here made the metric uncomparable: --limit caps the generated corpus while the
       * real one is read in full, and distinct-counts grow with n no matter what, so the line
       * reported 5.7 against 52.0 on 292 games against 13,249 and flagged itself "large" every single
       * run. A diagnostic that always fires is one people learn to scroll past. */
      (R.setKeys[sp] = R.setKeys[sp] || []).push(key);
    }
    if (Array.isArray(g.turns)) { R.turnsTotal += g.turns.length; R.turnsGames++; }
    if (limit && R.games >= limit) return false;
  });
  eachLine(logs, (line) => {
    const t = line.trim(); if (!t) return;
    let r; try { r = JSON.parse(t); } catch { return; }
    if (!r.log) return;
    R.logGames++;
    if (/^\|-mega\|/m.test(r.log)) R.megaGames++;
    for (const l of r.log.split('\n')) {
      if (l.startsWith('|move|')) { R.moves++; if (/\|(Protect|Detect|Spiky Shield|Baneful Bunker)\b/.test(l)) R.protects++; }
      else if (l.startsWith('|-immune|')) R.immune++;
      else if (l.startsWith('|-resisted|')) R.resisted++;
      else if (l.startsWith('|-supereffective|')) R.superEff++;
      else if (l.startsWith('|-fail|')) R.failed++;
      else if (l.startsWith('|-crit|')) R.crit++;
      else if (l.startsWith('|switch|') || l.startsWith('|drag|')) R.switches++;
      else if (l.startsWith('|faint|')) R.faints++;
    }
    if (limit && R.logGames >= limit) return false;
  });
  return R;
}

const pct = (a, b) => (b ? 100 * a / b : 0);
const fmt = (x, d = 2) => x.toFixed(d);

function main() {
  console.log('REALISM REPORT — generated games vs real ladder games\n');
  const self = gather(SELF_STORE, SELF_LOGS, LIMIT);
  const real = gather(LAD_STORE, LAD_LOGS, 0);
  if (!self.games) { console.error('no generated games found at ' + SELF_STORE); process.exit(1); }
  console.log(`  generated: ${self.games.toLocaleString()} games (${self.logGames.toLocaleString()} logs)`);
  console.log(`  real      : ${real.games.toLocaleString()} games (${real.logGames.toLocaleString()} logs)\n`);

  const rows = [];
  const add = (name, s, r, unit = '%') => rows.push({ name, s, r, unit, gap: Math.abs(s - r) });

  add('games containing a mega', pct(self.megaGames, self.logGames), pct(real.megaGames, real.logGames));
  add('moves that hit an immune target', pct(self.immune, self.moves), pct(real.immune, real.moves));
  add('moves that were super effective', pct(self.superEff, self.moves), pct(real.superEff, real.moves));
  add('moves resisted', pct(self.resisted, self.moves), pct(real.resisted, real.moves));
  add('moves that outright failed', pct(self.failed, self.moves), pct(real.failed, real.moves));
  add('moves that were Protect-type', pct(self.protects, self.moves), pct(real.protects, real.moves));
  add('critical hits', pct(self.crit, self.moves), pct(real.crit, real.moves));
  /* PER GAME, NOT PER MOVE. Normalising by moves made switching look half the human rate (23.3 vs
   * 46.7 per 100 moves) purely because our games run longer — 10 turns against 6.3. Per game the
   * real figures are 4.3 against 5.7, a modest gap rather than a missing behaviour. A denominator
   * that differs between the two corpora will invent a defect every time. */
  add('switches per game', self.switches / Math.max(1, self.logGames), real.switches / Math.max(1, real.logGames), '');
  add('faints per game', self.faints / Math.max(1, self.logGames), real.faints / Math.max(1, real.logGames), '');
  add('turns per game', self.turnsGames ? self.turnsTotal / self.turnsGames : 0,
      real.turnsGames ? real.turnsTotal / real.turnsGames : 0, ' turns');

  /* SET DIVERSITY — READ THIS WITH CARE, IT IS EASY TO MISREAD.
   *
   * This counts distinct combinations of REVEALED moves, and revelation depth differs between the
   * two corpora: real games show 1.40 of 4 moves on average, ours 1.83. So the same underlying set
   * appears as MORE distinct partial views in real games, and the real side is inflated. Sample size
   * inflates it further, since distinct-counts grow with n.
   *
   * Reported anyway, because it is the axis that would have caught the identical-Incineroar bug
   * instantly (one key per species). But a gap here is a prompt to check properly — fully-revealed
   * sets only, at equal sample size — not a defect on its own. Done that way the gap is 9.8 against
   * 13.0 rather than the 23 against 51 this line shows. */
  /* Compare only species present in BOTH, and only over the first min(n) observations of each, so
   * the two sides face the same opportunity to be varied. Measured this way the gap was 9.8 against
   * 13.0 where the naive count said 23 against 51. */
  const divPair = () => {
    const shared = Object.keys(self.setKeys).filter(k => (real.setKeys[k] || []).length);
    let a = 0, b = 0, used = 0;
    for (const k of shared) {
      const n = Math.min(self.setKeys[k].length, real.setKeys[k].length);
      if (n < 10) continue;                    /* too few to say anything about variety */
      a += new Set(self.setKeys[k].slice(0, n)).size;
      b += new Set(real.setKeys[k].slice(0, n)).size;
      used++;
    }
    return used ? [a / used, b / used, used] : [0, 0, 0];
  };
  const [dSelf, dReal, dN] = divPair();
  add(`distinct sets per species (matched n, ${dN} spp)`, dSelf, dReal, '');

  console.log('  metric                                 generated      real        gap');
  console.log('  ' + '-'.repeat(72));
  rows.sort((a, b) => b.gap - a.gap);
  for (const r of rows) {
    const flag = r.gap > Math.max(2, Math.abs(r.r) * 0.5) ? '  <-- large' : '';
    console.log('  ' + r.name.padEnd(38) +
      (fmt(r.s) + r.unit).padStart(11) + (fmt(r.r) + r.unit).padStart(12) +
      (fmt(r.gap)).padStart(10) + flag);
  }

  /* ---- species frequency: is the generated metagame the same SHAPE as the real one? -------------
   * Sampling teams uniformly over DISTINCT teams flattens this: a team played 200 times counts once,
   * so common Pokemon appear far less than they should. That is invisible in any per-move statistic
   * and shows up immediately here. */
  console.log('\n  species appearance rate (top 12 by real usage)');
  console.log('  ' + '-'.repeat(72));
  const top = Object.entries(real.species).sort((a, b) => b[1] - a[1]).slice(0, 12);
  let sumGap = 0;
  for (const [sp, n] of top) {
    const rp = pct(n, real.games), sp2 = pct(self.species[sp] || 0, self.games);
    sumGap += Math.abs(sp2 - rp);
    console.log('  ' + sp.padEnd(38) + (fmt(sp2, 1) + '%').padStart(11) + (fmt(rp, 1) + '%').padStart(12) +
      (fmt(Math.abs(sp2 - rp), 1)).padStart(10) + (Math.abs(sp2 - rp) > 8 ? '  <-- large' : ''));
  }
  console.log('  ' + '-'.repeat(72));
  console.log('  mean absolute gap over the top 12: ' + fmt(sumGap / top.length, 1) + ' points');

  /* WHICH GAPS ACTUALLY MATTER, because they are not the same kind of thing.
   *
   * These games exist to give a value function positions to learn from. So a divergence matters when
   * it means we are simulating a DIFFERENT GAME, and does not when it only means we are simulating
   * the same game with a different mix of teams. Reporting them in one undifferentiated list invites
   * chasing the wrong ones — and did: popularity-weighting the team draw was half-built before it
   * was clear that a flatter draw is BETTER for position coverage. */
  console.log('\n  HOW TO READ THIS');
  console.log('  ' + '-'.repeat(72));
  console.log('  MECHANICS — a gap here means we are not simulating this game. Fix these.');
  console.log('    megas, immune moves, failed moves, set diversity, legality');
  console.log('  DISTRIBUTION — a gap here only means a different mix of teams. Usually fine, and a');
  console.log('  flatter mix covers MORE of the position space, which is what a scorer wants.');
  console.log('    species appearance rates, turns per game');
  console.log('  Where the real distribution is genuinely needed, take it from the ladder store or');
  console.log('  Smogon, which measure it directly. Self-play is the wrong instrument for it.');
}

main();
