/* solver/porygon2/v1/replay.js — rebuild a recorded MEW self-play game EXACTLY, position by position, on the release it was
 * played on. The one replay every PORYGON2 v1 builder uses (the dataset builder, the deep labeller, the producer test).
 *
 *   const RP = require('./solver/porygon2/v1/replay.js').create(API, { PA })   PA = a prior adapter (model-free is enough)
 *   for (const pos of RP.positions(rec)) { pos.S, pos.ctx, pos.t, pos.hist }   S is the TRUE battle before turn t (do not mutate;
 *                                                                               clone it: API.clone(pos.S))
 *   RP.COUNTERS  games, positions, replay_mismatch (the rebuilt public state departed from the record), no_joint
 *
 * The method is solver/machamp/deep_value.js's: the same sheets and brought fours, the same battle seed, and at each turn the
 * legal joint whose dataset actions equal the recorded ones. Before every position the rebuilt public state must equal the
 * recorded one byte for byte; a game that departs stops there and is COUNTED, never silently continued.
 * Omniscient records only (flat spreads): an honest-mode record's true battle carries XATU truth spreads that this replay
 * does not lay on, so it is refused and counted (`honest_refused`).
 */
'use strict';
const T = require('../../arena/teams.js');

function create(API, o) {
  const PA = o.PA;
  const M = API.M;
  const COUNTERS = { games: 0, positions: 0, replay_mismatch: 0, no_joint: 0, honest_refused: 0, wrong_release: 0, no_result: 0 };
  const key = x => JSON.stringify(x);
  function* positions(rec, releaseId) {
    if (releaseId && rec.release !== releaseId) { COUNTERS.wrong_release++; return; }
    if (rec.vA == null) { COUNTERS.no_result++; return; }
    if (rec.info === 'honest') { COUNTERS.honest_refused++; return; }
    COUNTERS.games++;
    const G = { id: rec.id, sheets: rec.sheets, brought: rec.brought };
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const rng = API.makeRng(rec.battle_seed);
    const S = API.newBattle(a.team, b.team, { rng });
    const ctx = PA.newGame(G);
    for (let t = 0; t < rec.hist.length; t++) {
      if (key(PA.publicState(ctx, S)) !== key(rec.hist[t].state)) { COUNTERS.replay_mismatch++; return; }
      COUNTERS.positions++;
      yield { S, ctx, t, G };
      const want = rec.hist[t].actions;
      const pick = side => API.legalActions(S, side).joint.find(j => key(PA.datasetActions(ctx, S, side, j)) === key(want[side === 'A' ? 'p1' : 'p2']));
      const jA = pick('A'), jB = pick('B');
      if (!jA || !jB) { COUNTERS.no_joint++; return; }
      PA.record(ctx, S, jA, jB);
      API.stepInPlace(S, jA, jB, rng);
    }
  }
  return { positions, COUNTERS };
}

/* A MEW shard is one gzip member per game, appended as each game ends. A run stopped mid-write can leave a TORN last member:
 * it is read with a sync flush (every complete member, plus whatever the torn one inflates to), and a last line that does
 * not parse is dropped and COUNTED — never silently kept, never a crash that loses the whole shard. */
function readShard(file, counters) {
  const zlib = require('zlib');
  const buf = require('fs').readFileSync(file);
  const txt = zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8');
  const out = [];
  for (const line of txt.split(/\n/)) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch (e) { if (counters) counters.torn_lines = (counters.torn_lines || 0) + 1; }
  }
  return out;
}

module.exports = { create, readShard };
