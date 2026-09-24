/* solver/rotom/build_assets.js — derive ROTOM's two small tracked inputs from the store. Nothing here is typed.
 *
 *   tools\lownode.cmd solver/rotom/build_assets.js [--human <games.jsonl>] [--meta <bo3.json>] [--teams 8]
 *
 * Writes:
 *   solver/rotom/tables.json   — the clock table E[remaining requests | turn] (SOLVER-PLAN §4: "E[…] comes from
 *                                the store and is never typed") and the bo3 carry-over rates (same four / same
 *                                lead pair, by the previous game's result) read out of GURU's bo3.json.
 *   solver/rotom/teams/regmc-pool.json — a small rotation of REAL Reg M-C open sheets (Will, 2026-09-24, Q4: "a
 *                                small rotation of real top ladder teams … randomised per series"), each with the
 *                                human's own bring and leads, packed for /utm and passed through Showdown's own
 *                                TeamValidator for the bo3 format. Open sheets carry NO Stat Points (GURU sets.json:
 *                                "the store records no Stat Points"), so every set gets one derived spread (below).
 *
 * THE SPREAD. The store has none, so one is derived per body, never typed per species: 32 HP, 32 in the attacking
 * stat its moves use more (physical vs special, read from the dex's move category), and the remaining 2 in Speed.
 * 66 total, 32 cap — the format's own limits, which the validator enforces; a set it refuses is dropped and counted.
 *
 * THE CLOCK TABLE. One side-game contributes, at each turn t it reached, the number of requests that side still had
 * to answer from turn t on: one per turn it had a live active, plus its end-of-turn replacements and its mid-turn
 * switch prompts (U-turn, Parting Shot, Eject Button …) — every prompt spends the same bank (rulesets.ts VGC Timer,
 * "Timer Add Per Turn = 0"). The mean and the 90th percentile are kept per turn up to the last turn with ≥ 200
 * side-games; later turns use that last row.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
require('../arena/env.js');
const X = require('../human/dex.js');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;
const HUMAN = flag('--human', path.join(MAIN, 'solver', 'out', 'human', 'games.jsonl'));
const META = flag('--meta', path.join(MAIN, 'solver', 'out', 'meta', 'bo3.json'));
const NTEAMS = +flag('--teams', 8);
const toID = X.toID;

function shaFile(f) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(1 << 22);
  try { for (let k; (k = fs.readSync(fd, b, 0, b.length, null)) > 0;) h.update(b.subarray(0, k)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

function spreadFor(row) {
  let phys = 0, spec = 0;
  for (const mv of row.moves || []) { const m = X.D.moves.get(toID(mv)); if (!m.exists) continue; if (m.category === 'Physical') phys++; else if (m.category === 'Special') spec++; }
  const sp = X.D.species.get(toID(row.species));
  const atkStat = phys > spec ? 'atk' : spec > phys ? 'spa' : (sp.baseStats.atk >= sp.baseStats.spa ? 'atk' : 'spa');
  const evs = { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 2 };
  evs[atkStat] = 32;
  return evs;
}
function packTeam(rows) {
  const { Teams } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  const sets = rows.map(r => ({ name: r.species, species: r.species, item: r.item || '', ability: r.ability || '',
    moves: r.moves.slice(), nature: r.nature || 'Serious', gender: r.gender && r.gender !== 'N' ? r.gender : '', evs: spreadFor(r),
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } }));
  return { sets, packed: Teams.pack(sets) };
}
function validate(sets) {
  const { TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  return TeamValidator.get(X.FORMAT).validateTeam(JSON.parse(JSON.stringify(sets))) || null;
}

async function main() {
  if (!fs.existsSync(HUMAN)) throw new Error('no human dataset at ' + HUMAN);
  const T = new Map();          // turn -> array of remaining-request counts
  const cands = [];             // team candidates
  let games = 0, sideGames = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(HUMAN), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const r = JSON.parse(line);
    const g = r.game; games++;
    if (g.custom_rules) continue;
    const turns = r.turns || [];
    for (const side of ['p1', 'p2']) {
      /* requests at each turn for this side */
      const per = turns.map(t => {
        const st = t.state && t.state.sides && t.state.sides[side];
        const hasActive = st && st.active && st.active.some(x => x != null && st.mons[x] && !st.mons[x].fnt);
        let n = hasActive ? 1 : 0;
        n += (t.replacements || []).filter(x => x.side === side).length > 0 ? 1 : 0;   // one prompt per replacement request
        n += (t.midturn_switches || []).filter(x => x.side === side).length;
        return n;
      });
      if (!per.length) continue;
      sideGames++;
      let rem = 0;
      for (let i = per.length - 1; i >= 0; i--) {
        rem += per[i];
        const n = turns[i].n || (i + 1);
        if (!T.has(n)) T.set(n, []);
        T.get(n).push(rem);
      }
      /* team candidate */
      const pl = g.players && g.players[side];
      if (g.bring_complete && g.bring_complete[side] && (g.sheets[side] || []).length === 6 && pl && pl.rating && g.leads && g.leads[side] && g.leads[side].length === 2) {
        const leads = g.leads[side];
        const bring = leads.concat((g.brought_seen[side] || []).filter(i => !leads.includes(i)));
        if (bring.length === 4) cands.push({ rating: pl.rating, player: toID(pl.name), game: g.id, date: g.date, sheet: g.sheets[side], bring });
      }
    }
  }
  /* clock table */
  const rows = [...T.keys()].sort((a, b) => a - b);
  const byTurn = {};
  let last = null;
  for (const t of rows) {
    const a = T.get(t);
    if (a.length < 200) break;
    a.sort((x, y) => x - y);
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    byTurn[t] = { n: a.length, mean: +mean.toFixed(3), p90: a[Math.min(a.length - 1, Math.floor(0.9 * a.length))] };
    last = t;
  }
  /* bo3 carry-over */
  let bo3 = null;
  if (fs.existsSync(META)) {
    const B = JSON.parse(fs.readFileSync(META, 'utf8'));
    const bp = B.summary && B.summary.by_previous_result;
    if (bp) bo3 = { same_four: { won: bp.same_four.won, lost: bp.same_four.lost }, same_lead_pair: { won: bp.same_lead_pair.won, lost: bp.same_lead_pair.lost },
                    source: { path: 'solver/out/meta/bo3.json', sha256: shaFile(META), field: 'summary.by_previous_result' } };
  }
  const tables = {
    generated: new Date().toISOString(),
    source: { path: 'solver/out/human/games.jsonl', sha256: shaFile(HUMAN), games, side_games: sideGames },
    clock: { unit: 'requests one side must still answer from turn t on (turn prompts + replacement prompts + mid-turn switch prompts)',
             min_side_games_per_row: 200, last_turn: last, byTurn },
    bo3,
  };
  fs.writeFileSync(path.join(__dirname, 'tables.json'), JSON.stringify(tables, null, 1) + '\n');
  console.log('clock table: turns 1..' + last + ', E[rem | t=1] = ' + (byTurn[1] && byTurn[1].mean) + ' ; bo3 ' + JSON.stringify(bo3 && { same_four: bo3.same_four, same_lead_pair: bo3.same_lead_pair }));

  /* team pool: the highest-rated sides, one team per player and per six */
  cands.sort((a, b) => b.rating - a.rating || (a.game < b.game ? -1 : 1));
  const seenP = new Set(), seenSig = new Set(), teams = [], refused = [];
  for (const c of cands) {
    if (teams.length >= NTEAMS) break;
    const sig = c.sheet.map(m => toID(m.species)).sort().join(',');
    if (seenP.has(c.player) || seenSig.has(sig)) continue;
    const { sets, packed } = packTeam(c.sheet);
    const problems = validate(sets);
    if (problems) { refused.push({ game: c.game, problems: problems.slice(0, 3) }); continue; }
    seenP.add(c.player); seenSig.add(sig);
    teams.push({ id: 'T' + (teams.length + 1), from_game: c.game, date: c.date, rating: c.rating,
                 species: c.sheet.map(m => m.species), bring: c.bring, packed });
  }
  const pool = { generated: new Date().toISOString(), format: X.FORMAT, source: tables.source,
                 spread_rule: '32 HP, 32 in the attack stat its moves use more (dex move category), 2 Spe; nature from the sheet',
                 validator: 'Showdown TeamValidator.get(' + X.FORMAT + ') on the Reg M-C checkout — every team below passed', refused: refused.length, teams };
  fs.mkdirSync(path.join(__dirname, 'teams'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'teams', 'regmc-pool.json'), JSON.stringify(pool, null, 1) + '\n');
  console.log('team pool: ' + teams.length + ' teams (' + refused.length + ' refused by the validator) — ratings ' + teams.map(t => t.rating).join(', '));
  if (refused.length) console.log('  first refusal: ' + JSON.stringify(refused[0]));
}

main().catch(e => { console.error(e); process.exit(1); });
