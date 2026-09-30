/* solver/arena/teams.js — REAL Reg M-C open sheets from the human dataset, built into MEDICHAM bodies.
 *
 *   const T = require('./solver/arena/teams.js');
 *   const L = T.loadGames({ file, n, seed })    -> { games:[G], file, scanned, eligible, skipped:{...} }
 *   const L = T.loadGames({ file, ids, M })      -> exactly those game ids, in that order (a pre-registered list)
 *   G = { id, sheets:{p1:[6 sheet rows], p2:[...]}, brought:{p1:[4 sheet idx, leads first], p2:[...]} }
 *   T.buildTeam(M, G, 'p1')                      -> { team:[4 bodies], sheetOf:[sheet idx per team idx] } | null
 *   T.buildBody(M, sheetRow[, { abilityUnknown }]) -> one body, or null (an unknown ability refuses; see buildBody)
 *   T.COUNTERS                                    ability resolutions: only-option, filled-first (asked for), refused
 *
 * THE SOURCE IS READ ONLY. The dataset (solver/human/build_dataset.js, ~500 MB, untracked) lives in the
 * MAIN checkout at solver/out/human/games.jsonl; a worktree has no copy. `--human <file>` points
 * anywhere else. Nothing here writes to it.
 *
 * WHICH GAMES. A game is eligible when BOTH sides' brought four are fully known (`bring_complete`), it
 * has no custom rules (memory: the corpus can hold custom-rule games), both sheets have six rows and all
 * eight brought bodies build. The arena plays the humans' OWN bring and leads: team preview is out of
 * scope for the turn search, and a real bring is the most honest one available. The selection is a
 * seeded stride over the whole file, so N games span the corpus's dates rather than its first hour.
 *
 * A BODY is built the way tests/medicham_api_fixtures.js builds one (the fixture the API was accepted
 * on): the engine's table row by species (`buildMon`), then the sheet's moves, item and ability laid
 * on, stones kept so a body can mega mid-battle. Moves, items and abilities are validated against the
 * Reg M-C dex (solver/human/dex.js reads Dex.forFormat), never typed. SPREADS ARE THE TABLE'S FLAT LINE
 * FOR EVERY BODY ON BOTH SIDES — open sheets do not carry spreads and the nature is not applied — so
 * the arena is symmetric, and no bot can gain or lose from a spread it could not have known.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'human', 'games.jsonl');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let _X = null;
const dex = () => (_X || (_X = require('../human/dex.js')));

const COUNTERS = { abilityOnlyOption: 0, abilityFilledFirst: 0, abilityUnknownRefused: 0 };
function buildBody(M, p, opts) {
  if (!p || !p.species) return null;
  const D = dex().D;
  let b;
  try { b = M.buildMon(p.species, {}); } catch (e) { return null; }
  if (!b) return null;
  const moves = [];
  for (const mv of p.moves || []) {
    const m = D.moves.get(toID(mv));
    if (m && m.exists && !moves.includes(m.id)) moves.push(m.id);
  }
  if (!moves.length) return null;
  b.moves = moves;
  const it = toID(p.item);
  b.item = it && D.items.get(it).exists ? it : '';
  const sp = D.species.get(toID(p.species));
  const legal = sp && sp.exists ? [...new Set(Object.values(sp.abilities || {}).map(toID))] : [];
  const ab = toID(p.ability);
  /* THE ABILITY IS THE SHEET'S, OR IT IS KNOWN, OR THE BODY IS REFUSED (2026-09-30, CHOMP v2 brief). This used to read
   * `legal.includes(ab) ? ab : legal[0]`: a row with no ability, or one this species cannot have, was silently given
   * the species' FIRST ability, and nothing counted it. Open sheets declare the ability, so no current caller's data
   * reaches the fill (measured 2026-09-30: 0 of 225,720 human-dataset sheet rows have a missing or illegal ability);
   * the fill was a latent guess waiting for the first caller with an unknown one. Now:
   *   - the sheet's ability, when this species can have it;
   *   - else, when the species has exactly ONE legal ability, that one (it is a fact, not a guess) — counted;
   *   - else null (the body does not build) — counted — unless the caller asks for the old fill by name with
   *     opts.abilityUnknown === 'first', which is counted too.
   * DELIBERATE BREAK (env TEAMS_BREAK=abilityfill): the old silent fill. solver/tests/test-chomp2.js ABILITY must go red. */
  if (process.env.TEAMS_BREAK === 'abilityfill') { b.ability = legal.includes(ab) ? ab : (legal[0] || b.ability); return b; }
  if (legal.includes(ab)) b.ability = ab;
  else if (legal.length === 1) { b.ability = legal[0]; COUNTERS.abilityOnlyOption++; }
  else if (opts && opts.abilityUnknown === 'first' && legal.length) { b.ability = legal[0]; COUNTERS.abilityFilledFirst++; }
  else { COUNTERS.abilityUnknownRefused++; return null; }
  return b;
}

function buildTeam(M, G, side) {
  const team = [], sheetOf = [];
  for (const s of G.brought[side]) {
    const b = buildBody(M, G.sheets[side][s]);
    if (!b) return null;
    b._solverSheet = s;   // STABLE identity: the engine reorders `sf.team` on a switch, as Showdown does
    team.push(b); sheetOf.push(s);
  }
  return team.length === 4 ? { team, sheetOf } : null;
}

/* one pass over the file; keeps only the small per-game header + sheets. The eligible list is kept per
 * file for the life of the process (a second match in one process does not re-read 500 MB). */
const SCANS = new Map();
function loadGames(o) {
  o = o || {};
  const file = o.file || DEFAULT_FILE;
  if (!fs.existsSync(file)) return { refused: 'no human dataset at ' + file };
  const M = o.M;
  const sc = SCANS.get(file) || scan(file);
  SCANS.set(file, sc);
  const { eligible, scanned } = sc;
  const skipped = Object.assign({}, sc.skipped, { unbuildable: 0 });
  /* `ids`: exactly these games, in this order (a pre-registered pair list, solver/chomp/plan.js) */
  if (o.ids) {
    const byId = new Map(eligible.map(G => [G.id, G]));
    const games = [], missing = [];
    for (const id of o.ids) { const G = byId.get(id); if (!G || (M && (!buildTeam(M, G, 'p1') || !buildTeam(M, G, 'p2')))) missing.push(id); else games.push(G); }
    return { games, file, scanned, eligible: eligible.length, skipped: Object.assign(skipped, { not_in_eligible_or_unbuildable: missing.length }), stride: null, ids: true, missing };
  }
  /* seeded stride over the eligible list, then drop any pair that does not build */
  const n = o.n || 100;
  const games = [];
  const stride = Math.max(1, Math.floor(eligible.length / (n * 1.5)));
  const off = (o.seed || 0) % stride;
  for (let i = off; i < eligible.length && games.length < n; i += stride) {
    const G = eligible[i];
    if (M && (!buildTeam(M, G, 'p1') || !buildTeam(M, G, 'p2'))) { skipped.unbuildable++; continue; }
    games.push(G);
  }
  return { games, file, scanned, eligible: eligible.length, skipped, stride };
}

function scan(file) {
  const fd = fs.openSync(file, 'r');
  const chunk = Buffer.alloc(1 << 22);
  let buf = '', pos = 0, scanned = 0;
  const eligible = [];
  const skipped = { bring_incomplete: 0, custom_rules: 0, sheet_not_six: 0, unbuildable: 0 };
  try {
    for (;;) {
      const k = fs.readSync(fd, chunk, 0, chunk.length, pos);
      if (!k) break;
      pos += k; buf += chunk.toString('utf8', 0, k);
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line) continue;
        scanned++;
        /* the header sits before `"turns"`; parse only it (the turns are most of the 500 MB) */
        const cut = line.indexOf(',"turns":');
        const g = JSON.parse(cut > 0 ? line.slice(0, cut) + '}' : line).game;
        if (!g.bring_complete || !g.bring_complete.p1 || !g.bring_complete.p2) { skipped.bring_incomplete++; continue; }
        if (g.custom_rules) { skipped.custom_rules++; continue; }
        if ((g.sheets.p1 || []).length !== 6 || (g.sheets.p2 || []).length !== 6) { skipped.sheet_not_six++; continue; }
        const brought = {};
        for (const sd of ['p1', 'p2']) {
          const leads = g.leads[sd] || [];
          brought[sd] = leads.concat(g.brought_seen[sd].filter(i => !leads.includes(i)));
        }
        if (brought.p1.length !== 4 || brought.p2.length !== 4) { skipped.bring_incomplete++; continue; }
        eligible.push({ id: g.id, date: g.date, sheets: g.sheets, brought, winner: g.winner });
      }
    }
  } finally { fs.closeSync(fd); }
  return { eligible, scanned, skipped };
}

module.exports = { loadGames, buildTeam, buildBody, DEFAULT_FILE, toID, COUNTERS };
