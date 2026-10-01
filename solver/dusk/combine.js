/* solver/dusk/combine.js — fold DUSK's measurements into one small tracked summary, and ask the one comparison that
 * needs both halves: do OUR endgames convert as often as humans' endgames from the same material and HP?
 *
 *   node solver/dusk/combine.js [--dir solver/out/dusk] [--out solver/dusk/endgames-summary.json]
 *
 * Reads (all gitignored, written by measure_endgames.js and measure_ladder.js):
 *   endgames-bo3.json, endgames-bo1.json            the headline (every quality reasons() code charged)
 *   endgames-bo3-allshape.json, -bo1-allshape.json   the sensitivity arm (game-shape codes recorded, not charged)
 *   positions-bo3.jsonl.gz                          each human bo3 game's E2 entry position (for the HP table)
 *   ladder.json                                      medicham32's games
 * Writes one compact JSON (tracked; a few tens of KB). Every number in solver/dusk/DESIGN.md and the report is read
 * from it.
 *
 * THE EXPECTED-CONVERSION TEST. For each of our games that reached E2, the human bo3 win rate from the same material
 * and the same summed-HP lead bucket (the side's own perspective) is its expectation; actual − expected over our games,
 * with a game bootstrap, says whether we under-convert endgames relative to the population we play. Humans are pooled
 * over every band (our opponents' ratings are not in the logs read here); a rated-only (>= 1100 on both sides) table is
 * given beside it.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPO = path.join(__dirname, '..', '..');
const DIR = path.resolve(REPO, arg('--dir', 'solver/out/dusk'));
const OUT = path.resolve(REPO, arg('--out', 'solver/dusk/endgames-summary.json'));
const rd = f => { const p = path.join(DIR, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const HPB = d => d <= -100 ? '<=-100' : d <= -50 ? '-99..-50' : d <= -25 ? '-49..-25' : d < 0 ? '-24..-1' : d === 0 ? '0' : d < 25 ? '1..24' : d < 50 ? '25..49' : d < 100 ? '50..99' : '>=100';
function humanTable(minRating) {
  const p = path.join(DIR, 'positions-bo3.jsonl.gz');
  const T = {};
  const txt = zlib.gunzipSync(fs.readFileSync(p)).toString('utf8');
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.z == null || r.z === 0.5) continue;
    if (minRating != null && !(r.rating && r.rating.p1 >= minRating && r.rating.p2 >= minRating)) continue;
    for (const me of ['p1', 'p2']) {
      const op = me === 'p1' ? 'p2' : 'p1', S = r.x.sides;
      const alive = s => (S[s].teamsize || 4) - S[s].mons.filter(m => m.fnt).length;
      const hp = s => { const ts = S[s].teamsize || 4, seen = S[s].mons.filter(m => m.brought === true); return seen.reduce((a, m) => a + (m.fnt ? 0 : (typeof m.hp === 'number' ? m.hp : 100)), 0) + 100 * Math.max(0, ts - seen.length); };
      const k = alive(me) + 'v' + alive(op) + '|' + HPB(hp(me) - hp(op));
      const won = (r.z === 1) === (me === 'p1') ? 1 : 0;
      (T[k] = T[k] || { n: 0, w: 0 }); T[k].n++; T[k].w += won;
    }
  }
  return T;
}
function expected(games, T) {
  const rows = games.filter(g => g.e2 && g.won !== 0.5).map(g => {
    const k = g.e2.ours + 'v' + g.e2.theirs + '|' + HPB(g.e2.hp_ours - g.e2.hp_theirs);
    const t = T[k];
    return { k, e: t && t.n >= 30 ? t.w / t.n : null, z: g.won };
  }).filter(r => r.e != null);
  const diff = a => a.reduce((s, r) => s + (r.z - r.e), 0);
  const d = diff(rows);
  // game bootstrap (seeded LCG, 4000 resamples)
  let st = 12345; const rnd = () => (st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296;
  const B = []; for (let b = 0; b < 4000; b++) { let s = 0; for (let i = 0; i < rows.length; i++) { const r = rows[Math.floor(rnd() * rows.length)]; s += r.z - r.e; } B.push(s); }
  B.sort((x, y) => x - y);
  return { games: rows.length, actual_wins: rows.reduce((s, r) => s + r.z, 0), expected_wins: +rows.reduce((s, r) => s + r.e, 0).toFixed(2),
    actual_minus_expected: +d.toFixed(2), ci95: [+B[Math.floor(0.025 * B.length)].toFixed(2), +B[Math.floor(0.975 * B.length)].toFixed(2)],
    per_game: +(d / (rows.length || 1)).toFixed(4) };
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o && k in o).map(k => [k, o[k]]));
function slim(m) {
  if (!m) return null;
  const reach = {}; for (const d of ['E2', 'E4', 'E1']) { const r = m.reach[d]; reach[d] = { ...pick(r, ['k', 'n', 'p', 'lo', 'hi']), among_normal_ends: r.among_normal_ends,
    by_band: Object.fromEntries(Object.entries(r.by_band).map(([b, v]) => [b, v && { k: v.k, n: v.n, p: v.p }])), entry_turn: r.entry_turn, decisions_left_normal_end: r.decisions_left_normal_end,
    decisions_left_hist_normal_end: r.decisions_left_hist_normal_end, end_after_entry: r.end_after_entry }; }
  const st = d => { const s = m.state[d]; return { ...pick(s, ['endgames', 'members', 'hp_tenths', 'hp_mean', 'hp_full_share', 'status', 'members_with_any_stage', 'stages', 'volatiles', 'mega_still_available', 'field']),
    species_top15_endgames_containing: s.species_top30_endgames_containing.slice(0, 15), matchups_top10: s.matchups_top25.slice(0, 10) }; };
  return { generated: m.generated, fmt: m.fmt, game_shape_codes: m.game_shape_codes, funnel: m.funnel, games: m.games, games_by_band: m.games_by_band, reach,
    outcome: m.outcome, state: { E2: st('E2'), E4: st('E4') }, distinct: m.distinct, table_hit_rate: m.table_hit_rate, actions: m.actions,
    code: m.code, inputs: (m.inputs || []).filter(i => i.role === 'parsed_store') };
}
function main() {
  const bo3 = rd('endgames-bo3.json'), bo1 = rd('endgames-bo1.json'), bo3a = rd('endgames-bo3-allshape.json'), bo1a = rd('endgames-bo1-allshape.json'), lad = rd('ladder.json');
  const Tall = humanTable(null), T1100 = humanTable(1100);
  const lg = lad ? lad.games : [];
  const isSearch = g => /miltank/.test(g.policy || '');
  const conv = {};
  for (const [nm, T] of [['humans_all_bands', Tall], ['humans_both_rated_ge1100', T1100]]) conv[nm] = { all: expected(lg, T), search_arm: expected(lg.filter(isSearch), T), prior_arm: expected(lg.filter(g => !isSearch(g)), T) };
  const hp2v2 = {}; for (const [k, v] of Object.entries(Tall)) if (k.startsWith('2v2|')) hp2v2[k.slice(4)] = { n: v.n, win: +(v.w / v.n).toFixed(4) };
  // the search's own value at E2 entry, for games it lost from even or ahead
  const valueAtEntry = lg.filter(g => isSearch(g) && g.e2 && g.e2.lead >= 0 && g.won === 0).map(g => g.e2.entry_value);
  const out = {
    what: 'DUSK measurements, combined (solver/dusk/combine.js). Store-only meta + read-only ladder; no game played.',
    generated: new Date().toISOString(),
    sources: ['endgames-bo3.json', 'endgames-bo1.json', 'endgames-bo3-allshape.json', 'endgames-bo1-allshape.json', 'positions-bo3.jsonl.gz', 'ladder.json']
      .map(f => path.join(DIR, f)).filter(fs.existsSync).map(p => ({ file: path.relative(REPO, p).replace(/\\/g, '/'), sha256: sha(p) })),
    meta: { bo3: slim(bo3), bo1: slim(bo1), bo3_allshape: bo3a && { funnel: bo3a.funnel, games: bo3a.games, reach: slim(bo3a).reach, outcome_E2: bo3a.outcome.E2 },
      bo1_allshape: bo1a && { funnel: bo1a.funnel, games: bo1a.games, reach: slim(bo1a).reach, outcome_E2: bo1a.outcome.E2 } },
    human_bo3_win_rate_2v2_by_hp_lead_at_entry: hp2v2,
    ladder: lad && { generated: lad.generated, runs: lad.runs, skipped: lad.skipped, summary: lad.summary,
      losses_from_ahead_or_even_e2: lad.losses_from_ahead_or_even_e2.map(g => ({ run: g.run, replay: g.replay, policy: g.policy, entry: { n: g.entry.n, ours: g.entry.ours, theirs: g.entry.theirs, hp_ours: g.entry.hp_ours, hp_theirs: g.entry.hp_theirs },
        end_turn: g.end_turn, values: g.decisions.map(d => d.value), searched: g.decisions.map(d => d.mxn), covered: g.decisions.map(d => d.covered) })),
      search_arm_value_at_e2_entry_in_losses_from_even_or_ahead: valueAtEntry },
    conversion_vs_humans: conv,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('wrote ' + OUT + ' (' + fs.statSync(OUT).size + ' bytes)');
}
main();
