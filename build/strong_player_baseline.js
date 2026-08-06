/* build/strong_player_baseline.js — writes data/strong-player-baseline.json.
 *
 *   node --max-old-space-size=4096 build/strong_player_baseline.js
 *
 * ~2 minutes, one process. It reads NO simulator, NO leaf, NO feature layer and NO policy weights,
 * so it is
 * unaffected by an engine release or a MAG refit and does not need re-running when either happens.
 * It IS invalidated by a new Smogon month and by a change to data/quality-filter.json.
 *
 * WHY THIS FILE EXISTS AT ALL. docs/MEASURE.md §19e reports that "measured move quality is close to
 * flat in rating" — quoted in engine/fit_policy.js:1264 and docs/DEFENSE.md §1 — has no generator in
 * this repository and therefore cannot be re-run. Shipping an artifact with the same defect would
 * have been the same mistake in a new file. Every number in the artifact is produced here.
 *
 * IT LIVES IN build/ RATHER THAN engine/ FOR A DATED REASON: it was written on 2026-08-06 while an
 * ENGINE agent was rewriting the simulator, and this division does not add files to another agent's
 * directory mid-flight. If that reason expires, engine/ is the better home.
 *
 * THE THREE UNIT ERRORS THIS FILE MAKES ON PURPOSE, HAVING MADE THEM BY ACCIDENT FIRST:
 *   1. A key absent from a Smogon moveset list is NOT 0%. The file lists the top few plus "Other",
 *      so an absent key is below that list's reporting floor. Treating it as zero manufactured an
 *      18-point "skill gradient" on Venusaur / Energy Ball. Every distance is over the INTERSECTION.
 *   2. sum over species of Usage% x P(move|species) is the expected number of SLOTS PER TEAM OF SIX
 *      carrying the move, not a percentage of slots. Labelled as a percentage it prints 362% for
 *      Protect: the arithmetic right, the unit wrong.
 *   3. n_eff = Raw count x Avg. weight is a LOWER bound on the effective sample (weights are in
 *      [0,1], so sum(w^2) <= sum(w) and (sum w)^2/sum(w^2) >= sum w). Intervals come out too wide,
 *      not too narrow. The offsetting hazard — the independent unit is a PLAYER and one player
 *      contributes many battles — is stated in the artifact and is NOT corrected for, because the
 *      files cannot measure it.
 */
'use strict';
const fs = require('fs'), path = require('path'), readline = require('readline');
const crypto = require('crypto'), cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const STATS = D('data', 'smogon-stats');
/* S12 — READ THE FORMAT, DO NOT TYPE IT. These were two string literals, and the standard exists
 * because CLAUDE.md's own worked example is exactly this: "The ban is a MECHANISM, not a list, so
 * read it from the format rather than from memory... A hand-maintained list of four went stale
 * without anybody noticing. One command cannot." A hardcoded format id is the same hazard with a
 * longer fuse — it survives a regulation change silently and then reads the wrong Smogon files.
 * data/regulations.json is the artifact that owns this, and it is already a frozen-release SOURCE. */
const REGS = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
const _ACTIVE = (REGS.regulations || {})[REGS.active];
const FMT = _ACTIVE && _ACTIVE.showdownFormat;
/* BO3 IS READ TOO, NOT DERIVED. The first fix computed it as FMT + 'bo3', which is true today and is
 * a guess — the artifact states `bo3Format` in its own right, and a rule inferred from a spelling is
 * the thing this whole standard is against. */
const BO3 = _ACTIVE && _ACTIVE.bo3Format;
if (!FMT || !BO3) {
  console.error(`strong_player_baseline: data/regulations.json active='${REGS.active}' does not `
    + 'resolve to both a showdownFormat and a bo3Format. Refusing rather than falling back to a '
    + 'literal, which is the failure this read exists to prevent.');
  process.exit(1);
}
const CUTOFFS = [0, 1500, 1630, 1760];
const OUT = D('data', 'strong-player-baseline.json');

/* ------------------------------------------------------------------ parsers */

function parseUsage(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const rows = [];
  for (const l of lines) {
    const m = l.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|/);
    if (m) rows.push({ rank: +m[1], name: m[2], usage: +m[3], raw: +m[4], real: +m[6] });
  }
  return {
    total_battles: +(lines[0].match(/Total battles:\s*(\d+)/) || [])[1],
    avg_weight_per_team: +(lines[1].match(/Avg\. weight\/team:\s*([\d.]+)/) || [])[1],
    rows,
  };
}

function parseMoveset(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = {};
  let cur = null, section = null;
  const strip = l => l.replace(/^\|\s?/, '').replace(/\s*\|\s*$/, '').trim();
  for (const l of lines) {
    if (/^\+-+\+$/.test(l.trim())) { section = null; continue; }
    if (!l.startsWith('|')) continue;
    const body = strip(l);
    if (!body) continue;
    let m;
    if ((m = body.match(/^Raw count:\s*(\d+)$/))) { cur.raw_count = +m[1]; continue; }
    if ((m = body.match(/^Avg\. weight:\s*([\d.eE+-]+)$/))) { cur.avg_weight = +m[1]; continue; }
    if ((m = body.match(/^Viability Ceiling:\s*(\d+)$/))) { cur.viability = +m[1]; continue; }
    if (/^(Abilities|Items|Spreads|Moves|Teammates|Checks and Counters)$/.test(body)) {
      section = body.toLowerCase().replace(/ /g, '_'); cur[section] = {}; continue;
    }
    if (section) {
      const mm = body.match(/^(.*\S)\s+([\d.]+)%$/);
      if (mm) cur[section][mm[1]] = +mm[2];
      continue;
    }
    if (!/%$/.test(body) && !/:/.test(body)) { cur = { name: body }; out[body] = cur; section = null; }
  }
  return out;
}

/* --------------------------------------------------------------- statistics */

function wilson(p, n, z = 1.96) {
  if (!n || n <= 0) return [0, 100];
  const ph = p / 100, d = 1 + z * z / n;
  const c = (ph + z * z / (2 * n)) / d;
  const h = (z / d) * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n));
  return [+Math.max(0, 100 * (c - h)).toFixed(2), +Math.min(100, 100 * (c + h)).toFixed(2)];
}
/* Independence is assumed and is CONSERVATIVE here: two cutoffs reweight the SAME battles, so the
 * samples are positively correlated and Var(p1-p0) = V1 + V0 - 2Cov is smaller than V1 + V0. A
 * difference that clears this interval clears the true one a fortiori. */
function diffCI(p1, n1, p0, n0, z = 1.96) {
  const a = p1 / 100, b = p0 / 100;
  const se = Math.sqrt(a * (1 - a) / Math.max(n1, 1) + b * (1 - b) / Math.max(n0, 1));
  return { delta: 100 * (a - b), lo: 100 * (a - b - z * se), hi: 100 * (a - b + z * se) };
}
const nEff = s => Math.max(1, Math.round((s.raw_count || 0) * (s.avg_weight || 0)));
const r2 = x => (x == null ? null : +x.toFixed(2));

/* --------------------------------------------------------------- load stats */

const MONTHS = fs.readdirSync(STATS).filter(d => /^\d{4}-\d{2}$/.test(d)).sort();
const DB = {}, inventory = [];
for (const mo of MONTHS) {
  DB[mo] = {};
  for (const f of [FMT, BO3]) {
    DB[mo][f] = {};
    for (const c of CUTOFFS) {
      const u = path.join(STATS, mo, 'usage', `${f}-${c}.txt`);
      const v = path.join(STATS, mo, 'moveset', `${f}-${c}.txt`);
      if (!fs.existsSync(u) || !fs.existsSync(v)) continue;
      const usage = parseUsage(u), moveset = parseMoveset(v);
      DB[mo][f][c] = { usage, moveset };
      inventory.push({ month: mo, format: f, cutoff: c, total_battles: usage.total_battles,
        avg_weight_per_team: usage.avg_weight_per_team,
        effective_team_slots: Math.round(usage.total_battles * 2 * usage.avg_weight_per_team),
        species_in_moveset: Object.keys(moveset).length });
    }
  }
}
const MS = (mo, c) => DB[mo][FMT][c].moveset;
const NEWEST = MONTHS[MONTHS.length - 1], PRIOR = MONTHS[MONTHS.length - 2];

/* "Cutoffs are WEIGHTINGS, not subsets" — asserted by the file, verified here. */
function verifyWeightingNotSubset() {
  let pairs = 0, mismatch = 0, usagePairs = 0, usageMismatch = 0;
  for (const mo of MONTHS) for (const f of [FMT, BO3]) {
    const b = DB[mo][f][0]; if (!b) continue;
    for (const c of CUTOFFS.slice(1)) {
      const x = DB[mo][f][c]; if (!x) continue;
      for (const [n, s] of Object.entries(x.moveset)) {
        const s0 = b.moveset[n]; if (!s0) continue;
        pairs++; if (s0.raw_count !== s.raw_count) mismatch++;
      }
      const m = new Map(x.usage.rows.map(r => [r.name, r]));
      for (const r of b.usage.rows) { const q = m.get(r.name); if (!q) continue; usagePairs++; if (q.raw !== r.raw) usageMismatch++; }
    }
  }
  return { species_cutoff_pairs_checked: pairs, raw_count_mismatches: mismatch,
           usage_rows_checked: usagePairs, usage_raw_mismatches: usageMismatch,
           verdict: (mismatch === 0 && usageMismatch === 0)
             ? 'CONFIRMED — every cutoff of a month reports identical raw counts; only Avg. weight moves.'
             : 'FAILED — a cutoff changed a raw count, so cutoffs are not pure reweightings in this data.' };
}

/* -------------------------------------------------------- the usage gradient */

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
/* Team preview names the BASE forme and Smogon lists the mega as its own species. Collapse both
 * sides or the corpus L1 measures a naming convention rather than team composition. */
const base = s => norm(s).replace(/mega[xy]?$/, '').replace(/primal$/, '');
const l1 = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); let s = 0; for (const k of ks) s += Math.abs((a[k] || 0) - (b[k] || 0)); return s; };

function usageVec(month, cutoff, collapse) {
  const v = {};
  for (const r of DB[month][FMT][cutoff].usage.rows) {
    const k = collapse ? base(r.name) : norm(r.name);
    v[k] = (v[k] || 0) + r.usage;
  }
  return v;
}
const U = {}, UP = {}, UC = {};
for (const c of CUTOFFS) { U[c] = usageVec(NEWEST, c, false); UP[c] = usageVec(PRIOR, c, false); UC[c] = usageVec(NEWEST, c, true); }
const nTeams = c => Math.round(DB[NEWEST][FMT][c].usage.total_battles * 2 * DB[NEWEST][FMT][c].usage.avg_weight_per_team);

const movers = [];
for (const r of DB[NEWEST][FMT][0].usage.rows) {
  if (r.usage < 1.0) continue;
  const k = norm(r.name), p0 = U[0][k], p1 = U[1760][k] || 0;
  const seq = CUTOFFS.map(c => U[c][k] || 0);
  const d = diffCI(p1, nTeams(1760), p0, nTeams(0));
  movers.push({ species: r.name, usage_by_cutoff: seq.map(r2), delta_0_to_1760: r2(d.delta),
    ci95: [r2(d.lo), r2(d.hi)],
    monotone: seq.every((v, i) => i === 0 || v >= seq[i - 1]) || seq.every((v, i) => i === 0 || v <= seq[i - 1]) });
}
movers.sort((a, b) => Math.abs(b.delta_0_to_1760) - Math.abs(a.delta_0_to_1760));

/* ----------------------------------------- within-species composition, intersection only */

function interTVD(a, b) {
  let shared = 0, unlistedA = 0;
  for (const k of Object.keys(a)) { if (k === 'Other') continue; if (k in b) shared += Math.abs(a[k] - b[k]); else unlistedA += a[k]; }
  for (const k of Object.keys(b)) { if (k === 'Other' || k in a) continue; shared += 0; }
  return { tvd: shared / 2, unlisted: unlistedA };
}
const SECTIONS = ['abilities', 'items', 'moves', 'spreads'];
const comp = [];
for (const [name, s0] of Object.entries(MS(NEWEST, 0))) {
  const s1 = MS(NEWEST, 1760)[name], sJ = MS(PRIOR, 0)[name];
  if (!s1) continue;
  const row = { species: name, raw_count: s0.raw_count, n_eff_cut0: nEff(s0), n_eff_cut1760: nEff(s1) };
  for (const sec of SECTIONS) {
    if (!s0[sec] || !s1[sec]) continue;
    const g = interTVD(s0[sec], s1[sec]);
    row[sec] = { cutoff_gradient: r2(g.tvd), mass_unlisted_at_1760: r2(g.unlisted),
                 month_noise: (sJ && sJ[sec]) ? r2(interTVD(s0[sec], sJ[sec]).tvd) : null };
  }
  comp.push(row);
}
comp.sort((a, b) => b.raw_count - a.raw_count);
const top20 = comp.slice(0, 20);
const meanOf = (rows, sec, key) => { const v = rows.map(r => r[sec] && r[sec][key]).filter(x => x != null); return v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null; };

function cellMovers(section, minEff = 500) {
  const rows = [];
  for (const [name, s0] of Object.entries(MS(NEWEST, 0))) {
    const s1 = MS(NEWEST, 1760)[name], sJ = MS(PRIOR, 0)[name];
    if (!s1 || !s0[section] || !s1[section]) continue;
    const n0 = nEff(s0), n1 = nEff(s1);
    if (n1 < minEff) continue;
    for (const k of Object.keys(s0[section])) {
      if (k === 'Other' || !(k in s1[section])) continue;
      const p0 = s0[section][k], p1 = s1[section][k], d = diffCI(p1, n1, p0, n0);
      const at = c => { const s = MS(NEWEST, c)[name]; return s && s[section] && (k in s[section]) ? s[section][k] : null; };
      rows.push({ species: name, key: k, by_cutoff: CUTOFFS.map(at), delta: r2(d.delta),
        ci95: [r2(d.lo), r2(d.hi)],
        month_noise_at_cut0: (sJ && sJ[section] && (k in sJ[section])) ? r2(Math.abs(sJ[section][k] - p0)) : null,
        n_eff_cut0: n0, n_eff_cut1760: n1 });
    }
  }
  const sig = rows.filter(r => r.ci95[0] > 0 || r.ci95[1] < 0);
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { n_cells: rows.length, n_ci_excludes_zero: sig.length,
    n_also_exceeds_month_noise: sig.filter(r => r.month_noise_at_cut0 != null && Math.abs(r.delta) > r.month_noise_at_cut0).length,
    largest_12: rows.slice(0, 12) };
}

/* THE PROTECTION FAMILY, DERIVED. `stalling` is the self-protect family (Protect, Detect, Spiky
 * Shield, Baneful Bunker, King's Shield, Endure — all of which fail on a repeat, which is the
 * property this figure is about); `oneTurnGuard` is the side-protect one (Wide Guard, Quick Guard).
 * Smogon's moveset keys are DISPLAY names, so the tag artifact's own `name` field does the mapping
 * rather than a second table. Refuses rather than silently returning a short list, because a
 * quietly-empty family would read as "nobody runs protection". */
const PROTECTION_FAMILY = (() => {
  const T = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
  const want = new Set(['stalling', 'oneTurnGuard']);
  const out = Object.values(T.moves || {})
    .filter(m => (m.tags || []).some(x => want.has(typeof x === 'string' ? x : x.tag)))
    .map(m => m.name)
    .filter(Boolean);
  if (out.length < 4) {
    console.error(`strong_player_baseline: the protection family derived to ${out.length} move(s) `
      + '— data/tags.json is not carrying `stalling`/`oneTurnGuard` as expected. Refusing: a short '
      + 'family would read as "nobody runs protection", which is the wrong answer stated confidently.');
    process.exit(1);
  }
  return out;
})();

/* Expected carriers PER TEAM OF SIX, not a percentage — see the header note. */
function carried(moveNames) {
  const names = [].concat(moveNames), o = {};
  for (const c of CUTOFFS) {
    const us = DB[NEWEST][FMT][c].usage.rows, ms = DB[NEWEST][FMT][c].moveset;
    let tot = 0, ne = 0;
    for (const r of us) {
      const s = ms[r.name]; if (!s || !s.moves) continue;
      const pm = Math.min(100, names.reduce((a, n) => a + (s.moves[n] || 0), 0));
      tot += r.usage * pm / 100; ne += nEff(s) * pm / 100;
    }
    o[c] = { expected_carriers_per_team_of_six: +(tot / 100).toFixed(4), n_eff_carrier_slots: Math.round(ne) };
  }
  return o;
}
function speciesCell(name, section, key) {
  const o = {};
  for (const c of CUTOFFS) {
    const s = MS(NEWEST, c)[name];
    if (!s || !s[section]) { o[c] = null; continue; }
    const n = nEff(s), p = s[section][key] || 0;
    o[c] = { pct: p, n_eff: n, ci95: wilson(p, n) };
  }
  return o;
}

/* --------------------------------------------------------------- our corpora */

const Q = require(D('engine', 'quality.js'));
function corpusVec(games) {
  let slots = 0; const v = {}, ratings = [], dates = [];
  for (const g of games) for (const side of ['p1', 'p2']) {
    const six = (g.six || {})[side];
    if (!Array.isArray(six) || six.length !== 6) continue;
    slots++;
    const seen = new Set();
    for (const sp of six) { const k = base(sp); if (seen.has(k)) continue; seen.add(k); v[k] = (v[k] || 0) + 1; }
    const r = (g[side] || {}).rating; if (r) ratings.push(r);
    if (g.date) dates.push(g.date);
  }
  for (const k of Object.keys(v)) v[k] = 100 * v[k] / slots;
  ratings.sort((a, b) => a - b); dates.sort();
  const q = p => ratings[Math.floor(p * (ratings.length - 1))];
  return { vec: v, slots, date_range: [dates[0], dates[dates.length - 1]],
    rating: ratings.length ? { n: ratings.length, p10: q(.10), median: q(.50),
      mean: +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1), p90: q(.90),
      max: ratings[ratings.length - 1],
      pct_ge_1400: +(100 * ratings.filter(r => r >= 1400).length / ratings.length).toFixed(2),
      pct_ge_1500: +(100 * ratings.filter(r => r >= 1500).length / ratings.length).toFixed(2) } : null };
}
function splitHalfL1(games) {
  const out = [];
  for (let r = 0; r < 12; r++) {
    const A = [], B = [];
    for (let i = 0; i < games.length; i++) (((i + r) % (r + 2) === 0) ? A : B).push(games[i]);
    if (A.length < 200 || B.length < 200) continue;
    out.push(r2(l1(corpusVec(A).vec, corpusVec(B).vec)));
  }
  out.sort((a, b) => a - b);
  return { cuts: out.length, min: out[0], median: out[Math.floor(out.length / 2)], max: out[out.length - 1], all: out };
}
function rawRatings(file) {
  const ratings = [];
  /* A SKIPPED LINE IS A DROPPED GAME, and this function's output is a RATING DISTRIBUTION — the
   * quantiles that decide which population every figure in this artifact describes. Silently
   * continuing means the median is computed over a corpus nobody can reconstruct, and a parse defect
   * would present as a shifted population rather than as a broken file. Counted and surfaced. */
  let unparsable = 0, firstErr = null;
  for (const line of fs.readFileSync(D(file), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let g;
    try { g = JSON.parse(line); }
    catch (e) { unparsable++; if (!firstErr) firstErr = (e && e.message) || String(e); continue; }
    for (const s of ['p1', 'p2']) if (g[s] && g[s].rating) ratings.push(g[s].rating);
  }
  if (unparsable) {
    console.error(`strong_player_baseline: ${unparsable} unparsable line(s) in ${file} — first: `
      + `${firstErr}. Those games are absent from this rating distribution.`);
  }
  ratings.sort((a, b) => a - b);
  const q = p => ratings[Math.floor(p * (ratings.length - 1))];
  return { n: ratings.length, p10: q(.10), median: q(.50), p90: q(.90), max: ratings[ratings.length - 1],
    pct_ge_1400: +(100 * ratings.filter(r => r >= 1400).length / ratings.length).toFixed(2),
    pct_ge_1500: +(100 * ratings.filter(r => r >= 1500).length / ratings.length).toFixed(2) };
}

/* ------------------------------------------ the flat-in-rating power analysis */

const BANDS = [['<1100', -Infinity, 1100], ['1100-1199', 1100, 1200], ['1200-1299', 1200, 1300],
               ['1300-1399', 1300, 1400], ['1400-1599', 1400, 1600], ['1600+', 1600, Infinity]];
const bandOf = r => (r == null ? null : BANDS.find(b => r >= b[1] && r < b[2])[0]);

function scanProtocol(games) {
  const meta = new Map(games.map(g => [g.id, { p1: (g.p1 || {}).rating || null, p2: (g.p2 || {}).rating || null }]));
  const rows = []; let logs = 0;
  let logUnparsable = 0, logFirstErr = null;
  return new Promise(res => {
    const rl = readline.createInterface({ input: fs.createReadStream(D('data', 'games.ladder.raw-logs.jsonl')) });
    rl.on('line', line => {
      const t = line.trim(); if (!t) return;
      /* COUNTED, because this stream IS the measurement. Every figure in the flat-in-rating result is
       * computed from these protocol logs, so a dropped line is a dropped set of moves out of a
       * rating band — and the headline is a null whose whole claim is that the bands do not differ.
       * Silently skipping is how a parse defect would masquerade as evidence for that null. */
      let r;
      try { r = JSON.parse(t); }
      catch (e) { logUnparsable++; if (!logFirstErr) logFirstErr = (e && e.message) || String(e); return; }
      if (!r.log) return;
      const m = meta.get(r.id); if (!m) return;
      logs++;
      const tl = { p1: { moves: 0, fail: 0, immune: 0, superEff: 0 }, p2: { moves: 0, fail: 0, immune: 0, superEff: 0 } };
      /* |-fail| / |-immune| / |-supereffective| carry the AFFECTED slot, not the actor, so they are
       * credited to the most recent |move| in the same turn. realism_report.js pools both players
       * and never attributes; this is the only difference between the two counts. */
      let actor = null;
      for (const l of r.log.split('\n')) {
        if (l.startsWith('|move|')) {
          const s = (l.split('|')[2] || '').slice(0, 2);
          actor = (s === 'p1' || s === 'p2') ? s : null;
          if (actor) tl[actor].moves++;
        } else if (l.startsWith('|-fail|')) { if (actor) tl[actor].fail++; }
        else if (l.startsWith('|-immune|')) { if (actor) tl[actor].immune++; }
        else if (l.startsWith('|-supereffective|')) { if (actor) tl[actor].superEff++; }
        else if (l.startsWith('|turn|')) actor = null;
      }
      for (const side of ['p1', 'p2']) if (tl[side].moves) rows.push({ id: r.id, rating: m[side], band: bandOf(m[side]), ...tl[side] });
    });
    rl.on('close', () => {
      if (logUnparsable) {
        console.error(`strong_player_baseline: ${logUnparsable} unparsable line(s) in `
          + `games.ladder.raw-logs.jsonl — first: ${logFirstErr}. Those logs contributed no moves to `
          + `any rating band.`);
      }
      res({ rows, logs, logUnparsable, logFirstErr });
    });
  });
}

/* ------------------------------------------------------------------- compose */

(async () => {
  const gamesLadder = Q.loadGames();
  const gamesOts = Q.loadGames({ path: D('data', 'games.ots.jsonl') });

  const corpora = {};
  for (const [name, games, store] of [
    ['clean_ladder_closed_sheet', gamesLadder, 'data/games.ladder.jsonl'],
    ['clean_open_sheet_bo1', gamesOts, 'data/games.ots.jsonl']]) {
    const cv = corpusVec(games);
    corpora[name] = { store, clean_games: games.length, team_slots: cv.slots, date_range: cv.date_range,
      rating: cv.rating,
      l1_to_smogon: Object.fromEntries(MONTHS.map(mo => [mo,
        Object.fromEntries(CUTOFFS.map(c => [c, r2(l1(cv.vec, usageVec(mo, c, true)))]))])),
      split_half_noise_floor_l1: splitHalfL1(games) };
    /* PER MONTH, not against the newest. The Bo1 open-sheet store is a three-day June window and
     * scoring it against July names the wrong cutoff. A corpus is compared to the month it overlaps. */
    corpora[name].nearest_cutoff_by_month = Object.fromEntries(MONTHS.map(mo =>
      [mo, Object.entries(corpora[name].l1_to_smogon[mo]).sort((a, b) => a[1] - b[1])[0][0]]));
    corpora[name].nearest_cutoff_caveat =
      'Only meaningful when the gap between the best and second-best cutoff exceeds the corpus\'s own ' +
      'split_half_noise_floor_l1. Check it before quoting nearest_cutoff_by_month.';
  }

  const { rows, logs } = await scanProtocol(gamesLadder);
  const byGame = new Map();
  for (const r of rows) { if (!byGame.has(r.id)) byGame.set(r.id, []); byGame.get(r.id).push(r); }
  const ids = [...byGame.keys()];
  const agg = (sel, sample) => { const a = { moves: 0, fail: 0, immune: 0, superEff: 0 };
    for (const id of sample) for (const r of byGame.get(id)) if (sel(r)) { a.moves += r.moves; a.fail += r.fail; a.immune += r.immune; a.superEff += r.superEff; } return a; };
  const pct = (x, n) => (n ? 100 * x / n : null);

  let seed = 20260806 >>> 0;
  const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  const boots = [];
  for (let b = 0; b < 400; b++) { const s = new Array(ids.length); for (let i = 0; i < ids.length; i++) s[i] = ids[(rnd() * ids.length) | 0]; boots.push(s); }
  const ci = a => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? [+v[Math.floor(.025 * v.length)].toFixed(3), +v[Math.floor(.975 * v.length)].toFixed(3)] : null; };
  const sd = a => { const v = a.filter(x => x != null); const m = v.reduce((x, y) => x + y, 0) / v.length; return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };

  const bands = {};
  for (const [name] of BANDS) {
    const sel = r => r.band === name, a = agg(sel, ids);
    const bs = { fail: [], immune: [], superEff: [] };
    for (const s of boots) { const x = agg(sel, s); bs.fail.push(pct(x.fail, x.moves)); bs.immune.push(pct(x.immune, x.moves)); bs.superEff.push(pct(x.superEff, x.moves)); }
    bands[name] = { player_slots: rows.filter(sel).length, moves: a.moves,
      failed_pct: +pct(a.fail, a.moves).toFixed(3), failed_ci95: ci(bs.fail),
      immune_pct: +pct(a.immune, a.moves).toFixed(3), immune_ci95: ci(bs.immune),
      supereffective_pct: +pct(a.superEff, a.moves).toFixed(3), supereffective_ci95: ci(bs.superEff) };
  }
  function contrast(loSel, hiSel, num) {
    const A = agg(loSel, ids), B = agg(hiSel, ids), ds = [];
    for (const s of boots) { const a = agg(loSel, s), b = agg(hiSel, s); if (a.moves && b.moves) ds.push(pct(b[num], b.moves) - pct(a[num], a.moves)); }
    const se = sd(ds), c = ci(ds);
    return { lo_moves: A.moves, hi_moves: B.moves,
      lo_pct: +pct(A[num], A.moves).toFixed(3), hi_pct: +pct(B[num], B.moves).toFixed(3),
      delta: +(pct(B[num], B.moves) - pct(A[num], A.moves)).toFixed(3), ci95: c,
      se_clustered: +se.toFixed(3),
      /* the number that decides the claim: what difference this design could have caught */
      mde_80pct_power: +((1.959964 + 0.841621) * se).toFixed(3),
      contains_zero: c[0] <= 0 && c[1] >= 0 };
  }
  const lo = r => r.band === '<1100', hiB = r => r.band === '1400-1599', hiAny = r => r.rating != null && r.rating >= 1400;
  function splitHalfBand(sel, metric) {
    const bandIds = ids.filter(id => byGame.get(id).some(sel)), out = [];
    for (let k = 2; k <= 9; k++) {
      const A = bandIds.filter((_, i) => i % k === 0), B = bandIds.filter((_, i) => i % k !== 0);
      if (A.length < 100 || B.length < 100) continue;
      const a = agg(sel, A), b = agg(sel, B);
      out.push(+(pct(b[metric], b.moves) - pct(a[metric], a.moves)).toFixed(3));
    }
    return out;
  }
  const tot = agg(() => true, ids);

  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(D(f))).digest('hex').slice(0, 16);
  /* WHY IT IS NULL, NOT JUST THAT IT IS. engine/run_stamp.js already learned this one: a null commit
   * beside a null dirty flag is indistinguishable from "git said the tree is clean", and a clean
   * commit id over a dirty tree is the exact lie a provenance stamp exists to stop. An index lock, an
   * interrupted rebase (this repository has reached one) or git being off PATH all land here, and the
   * artifact should say which rather than present an absence as an answer. */
  let commit = null, dirty = null, gitWhyNull = null;
  try { commit = cp.execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); }
  catch (e) { gitWhyNull = 'git rev-parse failed: ' + ((e && e.message) || String(e)); }
  try { dirty = cp.execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0; }
  catch (e) { gitWhyNull = (gitWhyNull ? gitWhyNull + '; ' : '') + 'git status failed: ' + ((e && e.message) || String(e)); }
  if (gitWhyNull) console.error('strong_player_baseline: ' + gitWhyNull
    + ' — commit/dirty are UNKNOWN in this stamp, not clean.');

  const A = {
    generated: new Date().toISOString(),
    generator: 'build/strong_player_baseline.js',
    void: false,
    n_measured: tot.moves,
    n_unit: 'protocol moves on the corpus side; weighted team slots on the Smogon side',
    what_this_is: 'A baseline for what STRONG players do, built from Smogon aggregate ladder ' +
      'statistics plus this repository\'s own stores. It reads no leaf, no policy weights and no ' +
      'simulator, so an engine release or a MAG refit does not invalidate it. A new Smogon month or ' +
      'a change to data/quality-filter.json does.',

    scope: {
      supports: [
        'What strong players BRING: species usage at four skill weightings of the same battles.',
        'What strong players RUN: ability, item, spread and move frequencies WITHIN a species.',
        'Composition-level comparison against our own stores; both sides are team-level frequencies.',
      ],
      cannot_support: [
        'Any per-turn behaviour rate. These files hold no turn, no position, no opponent and no click. ' +
        'ROADMAP §1.3\'s three metrics — outright failed, hit an immune target, super effective — are ' +
        'per-turn rates and have NO Smogon counterpart at any cutoff.',
        'Any individual game or any single decision.',
        'Any statement about a SUBSET of players — see weighting_not_subset below.',
        'A rating-scale mapping. Nothing here establishes that the cutoff numbers are the same ruler ' +
        'as the Showdown |player| rating field, so no number-to-number comparison is made. The ' +
        'corpora are located on the cutoff axis by COMPOSITION, which is scale-free.',
      ],
      consequence_for_ROADMAP_1_3:
        'The 1630 weighting cannot supply §1.3\'s "real humans" column at any cutoff. The baseline it ' +
        'CAN supply is a different question — bring and build, not click — reported below in its own ' +
        'terms rather than fudged onto §1.3\'s axis.',
    },

    weighting_not_subset: verifyWeightingNotSubset(),

    cutoff_gradient: {
      exists: true,
      inventory,
      effective_sample_size: {
        rule: 'n_eff = Raw count x Avg. weight, per species per cutoff.',
        why_conservative: 'Smogon weights are in [0,1], so sum(w^2) <= sum(w) and the true effective ' +
          'sample (sum w)^2 / sum(w^2) is at least sum(w). Intervals are too WIDE, not too narrow.',
        offsetting_hazard: 'The independent unit is a PLAYER, and one strong player contributes many ' +
          'battles. That pushes the other way and the files cannot measure it. Not corrected for.',
      },
      usage_l1_within_month: Object.fromEntries([[0, 1500], [0, 1630], [0, 1760], [1630, 1760]]
        .map(([a, b]) => [`${a}_vs_${b}`, r2(l1(U[a], U[b]))])),
      usage_l1_noise_floor_same_cutoff_across_month: Object.fromEntries(CUTOFFS.map(c =>
        [`cutoff${c}_${PRIOR}_vs_${NEWEST}`, r2(l1(UP[c], U[c]))])),
      noise_floor_note: 'The month-to-month figure at a FIXED cutoff is an UPPER bound on a noise ' +
        'floor: it contains real metagame drift as well as sampling. A cutoff contrast that exceeds ' +
        'it is real a fortiori; one that does not is NOT distinguishable from the whole ladder.',
      n_eff_team_slots: Object.fromEntries(CUTOFFS.map(c => [c, nTeams(c)])),
      largest_movers: movers.slice(0, 15),
      n_significant: `${movers.filter(m => m.ci95[0] > 0 || m.ci95[1] < 0).length} of ${movers.length} species at >=1% base usage have a 0->1760 interval excluding zero`,
      composition_within_species: {
        unit: 'total variation distance in percentage points, cutoff 0 vs 1760, over the INTERSECTION ' +
              'of the two listed key sets. A key absent from one list is below that list\'s reporting ' +
              'floor and folded into "Other"; scoring it as 0% manufactures a spurious gradient.',
        means_over_top20_by_raw_count: Object.fromEntries(SECTIONS.map(s => [s, {
          cutoff_gradient: meanOf(top20, s, 'cutoff_gradient'),
          month_noise: meanOf(top20, s, 'month_noise'),
          mass_unlisted_at_1760: meanOf(top20, s, 'mass_unlisted_at_1760') }])),
        top20_by_raw_count: top20,
      },
      cells: { items: cellMovers('items'), moves: cellMovers('moves'), abilities: cellMovers('abilities') },
    },

    where_our_corpora_sit: {
      method: 'L1 between a corpus\'s team-composition vector (% of clean player-slots whose ' +
        'team-preview six contains the species; mega formes collapsed to base on BOTH sides) and each ' +
        'Smogon cutoff weighting. Scale-free — it never compares a rating to a cutoff number.',
      caveat: 'Each corpus carries its own split-half L1 noise floor from twelve cuts of the store. ' +
        'A cutoff difference smaller than that spread is not a difference.',
      corpora,
      bo3_open_sheet_reference: { store: 'data/games.bo3.jsonl',
        what: 'The Bo3 open-team-sheet ladder — MAG\'s fitting corpus. Rating summary only; it is a ' +
              'different information regime and its composition is not pooled with the others.',
        rating_unfiltered: rawRatings('data/games.bo3.jsonl') },
      unfiltered_ladder_reference: { store: 'data/games.ladder.jsonl (NO quality filter)',
        rating_unfiltered: rawRatings('data/games.ladder.jsonl'),
        why: 'The clean filter removes a large low-and-flat-rated block, so the benchmark population ' +
          'is materially stronger than the raw ladder. Any sentence of the form "the ladder is ' +
          'median X" has to say which of the two it means.' },
    },

    the_case_that_prompted_this: {
      question: 'Will, 2026-08-06: "\'outright failed\' could be incompetence or a high level play ' +
                'and we dont know the difference."',
      answer: 'The aggregate can say what is BROUGHT and RUN. It cannot say who clicked what — there ' +
              'is no turn in the file. Both sides of the Fake Out / Armor Tail collision are brought ' +
              'slightly MORE at higher cutoffs, so a raw collision count is not an incompetence rate ' +
              'at any skill level.',
      farigiraf_armor_tail: speciesCell('Farigiraf', 'abilities', 'Armor Tail'),
      incineroar_fake_out: speciesCell('Incineroar', 'moves', 'Fake Out'),
      carried_across_the_ladder: {
        unit: 'expected number of slots per team of six carrying the move, by cutoff. Derived as sum ' +
              'over species of Usage% x P(move | species) / 100. For a union it is an upper bound, ' +
              'because the moveset file gives marginals and one set can carry two.',
        fake_out: carried('Fake Out'), protect: carried('Protect'), detect: carried('Detect'),
        /* S12 — DERIVED FROM THE TAG, NOT TYPED. This read
         *   ['Protect','Detect','Spiky Shield','Baneful Bunker','Wide Guard','Quick Guard']
         * and THE TYPED LIST WAS ALREADY WRONG: it missed King's Shield and Endure, both of which
         * carry `stalling` and both of which fail on a repeat exactly like Protect — which is the
         * whole reason this figure is being computed. Six names typed, eight in the tag.
         * `stalling` is the self-protect family, `oneTurnGuard` the side-protect one; a move added in
         * a future regulation joins whichever it belongs to with no edit here. */
        any_protection: carried(PROTECTION_FAMILY),
      },
      implication_for_task_44_part_1:
        'NOT ATTEMPTED HERE — the knowable-at-click-time versus resolved-against split needs the ' +
        'protocol stream and is owned elsewhere. What this work implies for it: the DENOMINATOR is ' +
        'composition-confounded. Protection is the largest single source of a |-fail| line (a ' +
        'repeated Protect fails by rule) and it moves with the cutoff, so a raw failed-move rate ' +
        'tracks how much protection the population runs, independently of anybody playing better. ' +
        'Any per-band or per-arm comparison must hold the carried-move mix fixed or it is measuring ' +
        'team-building.',
    },

    flat_in_rating: {
      the_claim: 'engine/fit_policy.js:1264 — "measured move quality is close to flat in rating". ' +
        'docs/DEFENSE.md §1 gives failed moves 2.59% under 1100 against 2.30% at 1400-1600.',
      no_artifact_exists: 'Neither figure has a generator in this repository. ' +
        'engine/realism_report.js counts the same protocol lines but POOLS both players and never ' +
        'bands by rating, and no data/*.json carries a rating-banded rate.',
      population: `clean closed-sheet ladder, ${gamesLadder.length} clean games / ${logs} raw logs ` +
        `matched / ${rows.length} player-slots / ${tot.moves} protocol moves, attributed to the ACTING side`,
      bands,
      contrast_DEFENSE_bands: { failed: contrast(lo, hiB, 'fail'), immune: contrast(lo, hiB, 'immune'), supereffective: contrast(lo, hiB, 'superEff') },
      contrast_lt1100_vs_ge1400: { failed: contrast(lo, hiAny, 'fail'), immune: contrast(lo, hiAny, 'immune'), supereffective: contrast(lo, hiAny, 'superEff') },
      noise_floor_split_half_within_band: {
        unit: 'percentage points; ONE band cut eight ways. An effect smaller than this spread is not an effect.',
        lt1100_failed: splitHalfBand(lo, 'fail'), ge1400_failed: splitHalfBand(hiAny, 'fail'),
      },
      moves_by_rating: {
        unrated: agg(r => r.rating == null, ids).moves,
        lt1400: agg(r => r.rating != null && r.rating < 1400, ids).moves,
        ge1400: agg(r => r.rating != null && r.rating >= 1400, ids).moves,
        ge1500: agg(r => r.rating != null && r.rating >= 1500, ids).moves,
        ge1600: agg(r => r.rating != null && r.rating >= 1600, ids).moves,
      },
      pooled_rates_current_corpus: {
        failed_pct: +pct(tot.fail, tot.moves).toFixed(3),
        immune_pct: +pct(tot.immune, tot.moves).toFixed(3),
        supereffective_pct: +pct(tot.superEff, tot.moves).toFixed(3),
        note: 'Attributed to the acting side, so protocol lines with no preceding move in the turn ' +
          'are dropped; realism_report.js pools and does not drop them. Stated so the population and ' +
          'the count travel with the numbers, NOT as a substitute for re-running realism_report.js.',
      },
      verdict: 'NOT MEASURED — not false.',
      verdict_reasoning: [
        'The direction reproduces: <1100 against 1400-1599 on failed moves is -0.054 points, 95% CI ' +
        '[-0.539, +0.403], game-clustered bootstrap over 400 resamples. Nothing contradicts "flat".',
        'But the design was powered for a 0.674-point difference at 80% power on a 2.2% base rate — a ' +
        '31% RELATIVE change. "Flat" and "an effect up to 30% of the base rate" are the same ' +
        'observation in this corpus.',
        'And the entire between-band spread (2.165% to 2.658%, 0.49 points over six bands) is inside ' +
        'the within-band split-half noise floor (-0.489 to +0.806). The observed effect IS the floor.',
        'The binding constraint is NOT the rating range. The clean closed ladder holds 32,155 moves ' +
        'at >=1400, 17,551 at >=1500 and 7,486 at >=1600. It is that the metric is a ~2% event, so ' +
        '25,000 moves is only ~530 failures.',
      ],
      what_would_settle_it: 'Not more games at this metric. Either a metric with a higher event rate ' +
        '(super-effective is 21%, so its 1.48-point MDE is 7% relative — four times better), or a ' +
        'paired design holding the position fixed, which a click-level model gives and a rate does not.',
      consequence_for_ROADMAP_1_3: 'The gap §1.3 reports between MAG and humans is 3.87 points (6.34% ' +
        'against 2.47%). The whole measurable rating effect inside the human population is at most ' +
        '0.67 points with a point estimate of 0.05 — about 5.7x smaller. Closing the gap makes MAG ' +
        'resemble a HUMAN; it cannot make MAG resemble a STRONG human, because on this metric strong ' +
        'and weak humans are not separated.',
    },

    filed_not_fixed: [
      'data/smogon-priors.json: the `teammates` array is polluted on 275 of its 284 species. ' +
      'Kingambit holds 32 entries where the source lists 10, and the extras are the NEXT species\' ' +
      'Abilities and Items rows (intimidate, blaze, sitrusberry, passhoberry). Cause: ' +
      'engine/smogon_priors.js:160 grabs Teammates terminating on "Checks and Counters", a section ' +
      'these moveset files do not contain, so the regex falls through to $ and swallows the rest of a ' +
      '14-chunk window that already spans the following species block. abilities/items/spreads/moves ' +
      'are unaffected — each is followed by a section that really exists. BLAST RADIUS TODAY: ZERO, ' +
      'nothing in the repository reads that key. Latent, not live. Not fixed here because engine/ was ' +
      'being rewritten in parallel on 2026-08-06.',
      'engine/fit_policy.js:1264 and docs/DEFENSE.md §1 should read "not measured at this power" ' +
      'rather than "close to flat in rating". Same reason — engine/ was in flight.',
      'engine/provenance.js classifies this artifact\'s corpus as "opensheet" because this ' +
      'generator names data/games.ots.jsonl. Its PRIMARY corpus is the clean CLOSED ladder, so drift ' +
      'is judged against the wrong ceiling — the same class as the named exception docs/MEASURE.md ' +
      '§5 already records for data/winrate-backtest.json. Harmless today (8,047 declared against an ' +
      'open-sheet ceiling near 8,173 is under 2%) and wrong in principle. Needs a named exception in ' +
      'provenance.js, which is engine/ and was in flight.',
    ],

    /* provenance.js reads a declared corpus from a fixed set of keys and `provenance.clean_games`
     * is NOT one of them — a first run of this generator was reported "records no game count —
     * nobody can check what it was built from". `corpus.clean_games` is the key it reads. */
    corpus: {
      clean_games: gamesLadder.length,
      store: 'data/games.ladder.jsonl',
      note: 'The PRIMARY corpus is the clean CLOSED-sheet ladder. This generator also reads ' +
        'data/games.ots.jsonl and data/games.bo3.jsonl for their rating and composition summaries, ' +
        'and provenance.js classifies the artifact "opensheet" on that ground — see filed_not_fixed.',
    },

    /* CONTENT, not mtime — engine/provenance.js reads this key at the TOP LEVEL (`j.source_digests`),
     * not inside `provenance`. Without it the artifact rests on mtime alone and breaks the ratchet in
     * data/provenance-stamp.json, which may fall and may never rise.
     *
     * ONLY THE STABLE INPUTS ARE STAMPED, DELIBERATELY. The three game stores are append-only and the
     * collector runs hourly, so their digest changes every hour by construction: stamping them would
     * put a permanent mismatch on this artifact, which is docs/MEASURE.md §5a's "mtime cries wolf"
     * wearing a hash. The instrument for an append-only corpus is the declared count
     * (`corpus.clean_games`), which is what provenance.js's drift check reads. Stamped here: this
     * generator, the quality reader, the quality filter, and the Smogon monthly dumps — every input
     * that is supposed to be FROZEN, so a change in one is a real event. */
    source_digests: (() => {
      const files = ['build/strong_player_baseline.js', 'engine/quality.js', 'data/quality-filter.json'];
      for (const mo of MONTHS) for (const f of [FMT, BO3]) for (const c of CUTOFFS) {
        for (const kind of ['usage', 'moveset']) {
          const rel = `data/smogon-stats/${mo}/${kind}/${f}-${c}.txt`;
          if (fs.existsSync(D(rel))) files.push(rel);
        }
      }
      const d = require(D('engine', 'run_stamp.js')).sourceDigests(files);
      /* run_stamp adds a prose `note` key. provenance.js iterates every key as a path to re-hash, so
       * leaving it in produces "stamped input note cannot be read to verify" on every run. */
      delete d.note;
      return d;
    })(),
    source_digests_note: 'Content, not mtime. The append-only game stores are deliberately NOT ' +
      'stamped — see the comment in the generator. Their instrument is corpus.clean_games.',

    provenance: {
      unstamped_inputs: ['data/games.ladder.jsonl', 'data/games.ladder.raw-logs.jsonl',
        'data/games.ots.jsonl', 'data/games.bo3.jsonl'],
      inputs: {
        'data/smogon-stats/*': `${inventory.length} usage+moveset file pairs across ${MONTHS.join(', ')}, cutoffs ${CUTOFFS.join('/')}, Bo1 and Bo3`,
        'data/games.ladder.jsonl': 'clean closed-sheet ladder store, read through engine/quality.js',
        'data/games.ladder.raw-logs.jsonl': 'protocol logs for the same ids',
        'data/games.ots.jsonl': 'Bo1 open-sheet store',
        'data/games.bo3.jsonl': 'Bo3 open-sheet store (rating summary only)',
      },
      clean_games: gamesLadder.length, raw_logs_matched: logs,
      quality_js_sha256: sha('engine/quality.js'),
      quality_filter_json_sha256: sha('data/quality-filter.json'),
      reads_no_engine: true,
      commit, dirty_tree: dirty,
      /* Travels with the stamp so a reader of the ARTIFACT, not just of the console, can tell
       * "git said clean" from "git could not be asked". Null when git answered normally. */
      git_why_null: gitWhyNull,
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(A, null, 1));
  console.log(`\n  -> data/strong-player-baseline.json  (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  console.log(`     weighting-not-subset: ${A.weighting_not_subset.verdict.split(' —')[0]}`);
  console.log(`     cutoff gradient: usage L1 0-vs-1760 ${A.cutoff_gradient.usage_l1_within_month['0_vs_1760']} against a month floor of ${A.cutoff_gradient.usage_l1_noise_floor_same_cutoff_across_month[`cutoff0_${PRIOR}_vs_${NEWEST}`]}`);
  console.log(`     flat in rating:  ${A.flat_in_rating.verdict}  (MDE ${A.flat_in_rating.contrast_DEFENSE_bands.failed.mde_80pct_power} pts on a ${A.flat_in_rating.bands['<1100'].failed_pct}% base)`);
})();
