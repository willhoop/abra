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
/* WHICH GAMES COUNT AS "REAL" — AND THIS FILE USED TO GET IT BADLY WRONG.
 *
 * gather() read the ladder store line by line and treated every record as a real human game. The
 * store is not that. Of 14,453 records, 1,838 are clean — 13%. The rest are 9,103 bot games, 4,593
 * partial brings, 3,430 forfeits, 1,950 behavioural bots and 1,177 games too short to mean anything.
 *
 * So every "real" baseline this tool printed was 87% contaminated, and contaminated in the direction
 * that matters most: bot games are exactly the thing self-play is supposed to be BETTER than, so
 * comparing our bots against a pile of other people's bots and calling the gap "realism" is
 * circular. engine/quality.js already decides this correctly and every other consumer uses it; this
 * file simply never called it.
 *
 * THE FILTER IS APPLIED TO BOTH SIDES. That is not symmetry for its own sake — the recurring bug in
 * this project is a rule applied to one corpus and not the other (the diversity metric, the
 * switch-rate denominator). Filtering only the real side would swap one mismatch for another: real
 * games would be required to have a full bring and a minimum length while ours were not. */
function cleanIds() {
  try {
    const Q = require('./quality.js');
    const ids = new Set();
    for (const g of Q.loadGames()) if (g.id) ids.add(g.id);
    return ids;
  } catch (e) { return null; }
}

/* Self-play records carry no account names or bot flags, so the bot rules cannot fire on them; the
 * structural rules (forfeit, short, partial bring) can and should. */
function cleanSelf(g, Q, cfg) {
  try { return Q.reasons(g, cfg, null).length === 0; } catch (e) { return true; }
}

function gather(store, logs, limit, keep) {
  const R = {
    games: 0, rejected: 0, species: {}, items: {}, setKeys: {},
    turnsTotal: 0, turnsGames: 0,
    moves: 0, immune: 0, resisted: 0, superEff: 0, failed: 0, crit: 0,
    megaGames: 0, switches: 0, protects: 0, logGames: 0, faints: 0,
    volSwitches: 0, forcedSwitches: 0, logTurns: 0,
  };
  const seen = new Set();
  eachLine(store, (line) => {
    const t = line.trim(); if (!t) return;
    let g; try { g = JSON.parse(t); } catch { return; }
    if (keep && !keep(g)) { R.rejected++; return; }
    if (g.id) seen.add(g.id);
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
    /* The logs must be filtered by the SAME set of games, or the per-move rates come from a
     * different population than the per-game ones and nothing in the table is comparable. */
    if (keep && !(r.id && seen.has(r.id))) return;
    R.logGames++;
    if (/^\|-mega\|/m.test(r.log)) R.megaGames++;
    /* SWITCHES PER GAME WAS ONE NUMBER COVERING THREE DIFFERENT EVENTS, and pooling them hid a
     * lever that was simply off. The line below used to count every |switch| and |drag| together:
     * the four opening send-outs, the replacements a faint forces, and the voluntary switches that
     * are the only ones a POLICY chooses. Read that way, every self-play corpus on disk looked
     * merely low on switching — a modest gap, the sort of thing you file under "the policy is
     * weaker than a human".
     *
     * Measured apart on 2026-08-02, the truth was not a gap at all. Voluntary switches in
     * games.selfplay, games.selfplay-sampling and games.h2h-greedy-vs-sample: 11,604, 4,696 and
     * 2,400 — which are EXACTLY 4 x games in all three, i.e. the opening send-outs and nothing
     * else. Zero, to the individual count, because every one of those corpora was generated with
     * `switching: false` and the bot's candidate list contained no switches to pick. Humans, on the
     * same measure: 39,481 genuine voluntary switches, 216.7 per 1,000 turns.
     *
     * A voluntary switch resolves at +6 priority, so it is any |switch| BEFORE the turn's first
     * |move|. Send-outs print before |turn|1 and are excluded by requiring a turn to have started —
     * which is what makes the three counts land on exactly 4 x games rather than near it. */
    let started = false, seenMove = false;
    for (const l of r.log.split('\n')) {
      /* Turns counted from the LOG, not from the store's turn array, so the numerator and the
       * denominator of this rate come from the same pass over the same games. */
      if (l.startsWith('|turn|')) { started = true; seenMove = false; R.logTurns++; }
      else if (l.startsWith('|move|')) seenMove = true;
      else if (started && (l.startsWith('|switch|') || l.startsWith('|drag|'))) {
        if (seenMove) R.forcedSwitches++; else R.volSwitches++;
      }
    }
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
  const Q = (() => { try { return require('./quality.js'); } catch (e) { return null; } })();
  const cfg = Q ? Q.config() : null;
  const ids = cleanIds();
  if (!ids) {
    console.error('cannot load engine/quality.js — refusing to report against an unfiltered store.');
    process.exit(1);
  }
  const self = gather(SELF_STORE, SELF_LOGS, LIMIT, g => cleanSelf(g, Q, cfg));
  const real = gather(LAD_STORE, LAD_LOGS, 0, g => g.id && ids.has(g.id));
  if (!self.games) { console.error('no generated games found at ' + SELF_STORE); process.exit(1); }
  console.log(`  generated: ${self.games.toLocaleString()} games (${self.logGames.toLocaleString()} logs)` +
    (self.rejected ? `  — ${self.rejected.toLocaleString()} rejected as unusable` : ''));
  console.log(`  real      : ${real.games.toLocaleString()} CLEAN games (${real.logGames.toLocaleString()} logs)` +
    `  — ${real.rejected.toLocaleString()} rejected (bots, forfeits, partial brings, too short)`);
  console.log('  both sides pass engine/quality.js. Bot games are NOT a realism baseline.\n');

  /* WHAT THE CORPUS WAS ACTUALLY GENERATED WITH, read off its own stamp.
   *
   * A metric is only evidence about the policy if the policy was ALLOWED to affect it. Every
   * self-play corpus on disk was made with `switching: false`, so "switches per game" was never
   * measuring reluctance — the bot had no switch to choose. The gap read as behavioural for as long
   * as nobody printed the lever beside the number.
   *
   * Derived, not listed: each entry names the stamp fields that GOVERN a metric, so a corpus made
   * with the lever on prints nothing and this stays quiet when it has nothing to say. */
  const GOVERNS = [
    { levers: ['switching', 'switching2'], metric: 'VOLUNTARY switches',
      says: 'the bot had no switch in its candidate list, so a voluntary switch was not merely rare — it was impossible' },
    { levers: ['forcedSwitch', 'forcedSwitch2'], metric: 'post-KO replacement choice',
      says: 'replacements were picked by the engine default, not by the policy' },
    { levers: ['joint', 'joint2'], metric: 'anything about slot coordination',
      says: 'the pair terms were not applied, so the two slots were decided independently' },
  ];
  let stamp = null, badStampLines = 0;
  eachLine(SELF_STORE, (line) => {
    const t = line.trim(); if (!t) return;
    /* Counted, not swallowed: a shard truncated mid-write would otherwise read as a corpus
     * that simply carries no stamp, which is a different and much more comfortable conclusion. */
    try { const g = JSON.parse(t); if (g.selfplay) { stamp = g.selfplay; return false; } }
    catch (e) { badStampLines++; }
  });
  if (!stamp) {
    console.log('  NOTE: this corpus carries no `selfplay` stamp, so which levers were on cannot be');
    console.log('  established. Treat every behavioural row below as uninterpretable until it can.\n');
  } else {
    const off = GOVERNS.filter(g => g.levers.every(k => stamp[k] === false));
    console.log('  generated with: ' + ['greedy', 'greedy2', 'switching', 'switching2', 'joint', 'joint2']
      .filter(k => k in stamp).map(k => k + '=' + stamp[k]).join('  '));
    for (const g of off) {
      console.log(`  LEVER OFF — "${g.metric}" is NOT a measurement of the policy here:`);
      console.log(`    ${g.levers.join('/')} were both false, so ${g.says}.`);
    }
    console.log();
  }

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
  /* Per 1,000 TURNS, because this is a per-decision rate and games differ in length between the two
   * corpora — the same denominator mistake the switch line already carries a comment about. */
  const per1kT = (n, R) => (R.logTurns ? 1000 * n / R.logTurns : 0);
  add('VOLUNTARY switches /1k turns', per1kT(self.volSwitches, self), per1kT(real.volSwitches, real), '');
  add('forced switches /1k turns', per1kT(self.forcedSwitches, self), per1kT(real.forcedSwitches, real), '');
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
