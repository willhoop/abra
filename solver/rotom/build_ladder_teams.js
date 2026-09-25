/* solver/rotom/build_ladder_teams.js — ROTOM's LADDER ROTATION: a few real top Reg M-C teams, one per leading
 * archetype, read out of the meta set library (solver/out/meta, GURU). Nothing here is typed.
 *
 *   tools\lownode.cmd solver/rotom/build_ladder_teams.js [--meta <dir>] [--teams 5] [--out <file>]
 *
 * WHY A ROTATION (SOLVER-PLAN §5 ladder protocol; …humans-and-ladder.md §3.4 step 3): the ladder A/B is read as a
 * per-series residual, and team choice is a far larger effect than any policy change, so both arms play the SAME
 * fixed small rotation. The rotation is drawn per series by the pre-committed coin in solver/rotom/ladder.js.
 *
 * HOW A TEAM IS CHOSEN.
 *   1. Archetypes: solver/out/meta/archetypes.json (spherical k-means on the species-of-six vector). Only the ones
 *      Hennig's bootstrap calls `stable` are eligible, taken in order of share; the first N are used.
 *   2. Membership: a six belongs to the archetype whose CORE vector (`core[].in_cluster`, the per-species rate inside
 *      the cluster) has the highest cosine with the six's binary vector, AND it carries every DEFINING species of that
 *      archetype (in_cluster >= 0.5). The core lists are truncated, so the cosine is an approximation of the k-means
 *      assignment; the defining-species rule is what keeps it honest. Stated, not hidden.
 *   3. The team: the highest-rated open-sheet bo3 side in games.clean.jsonl.gz that belongs to that archetype, one per
 *      player, not one of our own accounts, not a behavioural or named bot, with its full bring seen (br/ld of four).
 *   4. Packing: the same derived spread as build_assets.js (the store has no Stat Points), then Showdown's own
 *      TeamValidator for the bo3 format on the Reg M-C checkout. A refused six is skipped and counted.
 *
 * Output: solver/rotom/teams/ladder-rotation.json — the same team shape as regmc-pool.json (packed, bring = sheet
 * indices, leads first), plus the archetype and the source digests. rotom.js re-validates every team at start-up.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
require('../arena/env.js');
const X = require('../human/dex.js');
const BA = require('./build_assets.js');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;
const META = flag('--meta', path.join(MAIN, 'solver', 'out', 'meta'));
const N = +flag('--teams', 5);
const OUTF = flag('--out', path.join(__dirname, 'teams', 'ladder-rotation.json'));
/* our own accounts: the same set the meta extractor excludes (solver/meta/extract.js OWN) */
const OWN = new Set(['medicham32', 'willhoop', 'mag', 'mag2', 'miltank', 'miltank2']);
const toID = X.toID;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function cosine(core, six) {
  let dot = 0, nn = 0;
  for (const c of core) { nn += c.in_cluster * c.in_cluster; if (six.has(c.id)) dot += c.in_cluster; }
  return nn ? dot / (Math.sqrt(nn) * Math.sqrt(six.size)) : 0;
}

/* an archetype's DEFINING species: every core species present in at least half of its teams (in_cluster >= 0.5).
 * The chosen six must carry all of them — the cosine alone let a six in with none of the archetype's named species. */
const defining = a => a.core.filter(c => c.in_cluster >= 0.5).map(c => c.id);

/* a meta sheet row {s,i,a,m,nt,g} -> the human-dataset row shape build_assets.packTeam takes, NAMES read from the dex */
function rowOf(r) {
  const sp = X.D.species.get(r.s), it = r.i ? X.D.items.get(r.i) : null, ab = X.D.abilities.get(r.a), nat = r.nt ? X.D.natures.get(r.nt) : null;
  return { species: sp.exists ? sp.name : r.s, item: it && it.exists ? it.name : '', ability: ab.exists ? ab.name : r.a,
           moves: (r.m || []).map(m => { const x = X.D.moves.get(m); return x.exists ? x.name : m; }),
           nature: nat && nat.exists ? nat.name : '', gender: r.g || '' };
}

function main() {
  const A = JSON.parse(fs.readFileSync(path.join(META, 'archetypes.json'), 'utf8'));
  const GF = path.join(META, 'games.clean.jsonl.gz');
  const lines = zlib.gunzipSync(fs.readFileSync(GF)).toString('utf8').split('\n').filter(Boolean);
  const arch = A.archetypes.filter(a => a.stable === 'stable').sort((a, b) => b.share - a.share);
  const cands = [];
  for (const l of lines) {
    const g = JSON.parse(l);
    if (g.fmt !== 'bo3' || !g.open) continue;
    for (const s of [0, 1]) {
      const p = g.p && g.p[s];
      if (!p || p.bot || !p.r || OWN.has(toID(p.n))) continue;
      const sheet = g.sheets && g.sheets[s], six = g.six && g.six[s], br = g.br && g.br[s], ld = g.ld && g.ld[s];
      if (!sheet || sheet.length !== 6 || !br || br.length !== 4 || !ld || ld.length !== 2) continue;
      const set6 = new Set(six);
      let best = null, bestC = -1;
      for (const a of A.archetypes) { const c = cosine(a.core, set6); if (c > bestC) { bestC = c; best = a; } }
      const idx = sp => six.indexOf(sp);
      const bring = ld.concat(br.filter(x => !ld.includes(x))).map(idx);
      if (bring.some(i => i < 0)) continue;
      cands.push({ rating: p.r, player: toID(p.n), game: g.id, date: g.date, sheet, bring, archetype: best.id, cos: +bestC.toFixed(3), sixSet: set6 });
    }
  }
  cands.sort((a, b) => b.rating - a.rating || (a.game < b.game ? -1 : 1));
  const teams = [], refused = [], usedP = new Set();
  for (const a of arch) {
    if (teams.length >= N) break;
    for (const c of cands) {
      if (c.archetype !== a.id || usedP.has(c.player)) continue;
      if (!defining(a).every(sp => c.sixSet.has(sp))) continue;
      const rows = c.sheet.map(rowOf);
      const { sets, packed } = BA.packTeam(rows);
      const problems = BA.validate(sets);
      if (problems) { refused.push({ game: c.game, archetype: a.id, problems: problems.slice(0, 3) }); continue; }
      usedP.add(c.player);
      teams.push({ id: 'L' + (teams.length + 1), archetype: { id: a.id, label: a.label, share: a.share, stable: a.stable, cosine: c.cos, defining: defining(a) },
                   from_game: c.game, date: c.date, rating: c.rating, species: rows.map(r => r.species), bring: c.bring, packed });
      break;
    }
  }
  const out = { generated: new Date().toISOString(), format: X.FORMAT, checkout_commit: X.checkoutCommit(),
    source: { archetypes: { path: 'solver/out/meta/archetypes.json', sha256: sha(path.join(META, 'archetypes.json')), k: A.k_chosen },
              games: { path: 'solver/out/meta/games.clean.jsonl.gz', sha256: sha(GF), sides_considered: cands.length } },
    rule: 'one team per stable archetype in share order; the highest-rated open-sheet bo3 side assigned to it (max cosine to the archetype core) that carries every defining species (in_cluster >= 0.5); one per player; own accounts and bots excluded',
    spread_rule: '32 HP, 32 in the attack stat its moves use more (dex move category), 2 Spe; nature from the sheet (build_assets.js spreadFor)',
    validator: 'Showdown TeamValidator.get(' + X.FORMAT + ') on the Reg M-C checkout — every team below passed', refused: refused.length, refused_samples: refused.slice(0, 5), teams };
  fs.mkdirSync(path.dirname(OUTF), { recursive: true });
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1) + '\n');
  console.log('ladder rotation: ' + teams.length + ' teams (' + refused.length + ' refused) -> ' + OUTF);
  for (const t of teams) console.log('  ' + t.id + ' ' + t.rating + ' [' + t.archetype.label + ' cos ' + t.archetype.cosine + '] ' + t.species.join(' / '));
}
if (require.main === module) main();
module.exports = { cosine, rowOf };
