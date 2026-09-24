/* medicham_api_fixtures.js -- battles for the solver-API acceptance tests, built from REAL open sheets.
 *
 * Not a test. Shared by tests/test-medicham-api.js (T1 clone round trip, step purity, T2 interleaving).
 *
 * THE TEAMS COME FROM THE REGULATION'S FROZEN POOL, never typed: `<team-store>/games.ots.jsonl`, the
 * pool engine/regulation_stores.js names for the selected regulation (Reg M-C: data/team-pool-frozen-regmc).
 * The pool's .jsonl is a local measurement pin and is not tracked, so a checkout without it CANNOT ANSWER
 * and says so -- it never falls back to a made-up team. Pass `--team-store <dir>` to point at one.
 *
 * A body is built the way engine/game_differential.js's buildPair builds its medicham half: the table row
 * by species (`buildMon`), then the sheet's moves, item and ability laid on. Stones are KEPT, so a body can
 * mega mid-battle -- the post-mega positions the brief's T1 asks for. Spreads are the table's flat line;
 * these tests are about the API's plumbing, not about any number the engine reports.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function teamStore(argv) {
  const i = argv.indexOf('--team-store');
  if (i >= 0) return argv[i + 1];
  const RS = require('../engine/regulation_stores.js');
  let p = null;
  try { p = RS.pool(); } catch (e) { return { refused: e.message }; }
  /* the artifact owner (Reg M-B) keeps its frozen pool at the unsuffixed path (data/team-pool-frozen/FROZEN.md) */
  if (!p) return path.join(__dirname, '..', 'data', 'team-pool-frozen');
  return p.dir ? path.join(__dirname, '..', p.dir) : null;
}

/* The first `n` games of the pool's open-sheet half whose both sheets carry at least four bodies. */
function loadPairs(store, n) {
  const f = path.join(store, 'games.ots.jsonl');
  if (!fs.existsSync(f)) return { refused: 'no ' + f + ' (the pool is a local, untracked pin)' };
  const fd = fs.openSync(f, 'r');
  const out = [];
  let buf = '', pos = 0; const chunk = Buffer.alloc(1 << 20);
  try {
    while (out.length < n) {
      const k = fs.readSync(fd, chunk, 0, chunk.length, pos);
      if (!k) break;
      pos += k; buf += chunk.toString('utf8', 0, k);
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0 && out.length < n) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const g = JSON.parse(line);
        const s = g.sheets || {};
        if ((s.p1 || []).length >= 4 && (s.p2 || []).length >= 4) out.push({ id: g.id, p1: s.p1, p2: s.p2 });
      }
    }
  } finally { fs.closeSync(fd); }
  return { pairs: out, file: f };
}

function buildTeam(M, sheet) {
  const team = [];
  for (const p of sheet) {
    if (team.length >= 4) break;
    const b = M.buildMon(p.species, {});
    if (!b) continue;
    const moves = [...new Set((p.moves || []).map(id))].filter(Boolean);
    if (!moves.length) continue;
    b.moves = moves;
    b.item = id(p.item);
    b.ability = id(p.ability) || b.ability;
    team.push(b);
  }
  return team.length === 4 ? team : null;
}

/* A seeded uniform pick over a side's joint legal set -- the policy the tests drive games with. Its dice are
 * the caller's own, so the same seed picks the same joint on the same position. */
function pickJoint(A, S, side, r) {
  const la = A.legalActions(S, side);
  if (!la.joint.length) throw new Error('empty joint set for side ' + side + ' at turn ' + S.turn);
  return la.joint[Math.floor(r() * la.joint.length)];
}
/* The policy's own coin: the engine's seeded generator, not a second copy of one. */
const policyRng = (M, seed) => M.rngStreams({ seed }).any;

module.exports = { id, teamStore, loadPairs, buildTeam, pickJoint, policyRng };
