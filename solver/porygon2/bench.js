/* solver/porygon2/bench.js — what one PORYGON2 leaf costs inside MILTANK, in microseconds per position.
 *
 *   cmd.exe /c tools\lownode.cmd solver\porygon2\bench.js [--games 20] [--reps 5] [--out <json>]
 *
 * Positions are real: Reg M-C arena games (the humans' sheets and brings, solver/arena/teams.js) played
 * forward with uniform legal joints, a snapshot taken before every turn. Each position is then timed, on a
 * LEAN copy under the engine's lean binding (exactly how a playout calls the leaf), split into:
 *   public   the engine -> dataset public state (prior_adapter publicState)
 *   encode   features.js encode (tokens + the MEDICHAM damage-race facts)
 *   forward  infer.js logit
 * Warm-up positions are discarded first (V8 tier-up). Medians and means are reported; one process, one thread.
 */
'use strict';
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const API = require(path.join(ROOT, 'engine', 'medicham_api.js'));
const T = require('../arena/teams.js');
const PA = require('../miltank/prior_adapter.js').create(API, null);
const F = require('./features.js').create(API.M);
const NET = require('./infer.js').load();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const NG = +arg('--games', 20), REPS = +arg('--reps', 5);
const OUT = path.resolve(ROOT, arg('--out', 'solver/out/porygon2/bench.json'));

const L = T.loadGames({ n: NG, seed: 11, M: API.M });
const pos = [];
for (const G of L.games) {
  const S = API.newBattle(T.buildTeam(API.M, G, 'p1').team, T.buildTeam(API.M, G, 'p2').team, { rng: API.makeRng(3) });
  const rng = API.makeRng(4), coin = API.M.rngStreams({ seed: 5 }).any;
  while (!API.isTerminal(S) && S.turn < 30) {
    pos.push({ S: API.clone(S), sheets: G.sheets });
    const pick = sd => { const j = API.legalActions(S, sd).joint; return j[Math.floor(coin() * j.length)]; };
    API.stepInPlace(S, pick('A'), pick('B'), rng);
  }
}
const now = () => Number(process.hrtime.bigint()) / 1e3;
const t = { public: [], encode: [], forward: [], total: [] };
const WARM = Math.min(200, pos.length);
for (let r = 0; r < REPS; r++) {
  for (let i = 0; i < pos.length; i++) {
    const S = API.clone(pos[i].S); API.makeLean(S);
    API.leanRun(() => {
      const a = now(); const p = F.fromEngine(PA, S, pos[i].sheets);
      const b = now(); const x = F.encode(p);
      const c = now(); NET.logit(x);
      const d = now();
      if (r > 0 || i >= WARM) { t.public.push(b - a); t.encode.push(c - b); t.forward.push(d - c); t.total.push(d - a); }
    });
  }
}
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(1); };
const st = a => ({ n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p50: q(a, 0.5), p95: q(a, 0.95) });
const res = { what: 'PORYGON2 v0 leaf cost per position, microseconds, lean copy under leanRun, one thread', positions: pos.length, reps: REPS,
  public_state: st(t.public), encode: st(t.encode), forward: st(t.forward), total: st(t.total),
  dmg_calls_per_position: +(F.COUNTERS.dmgCalls / F.COUNTERS.positions).toFixed(1), node: process.version, generated: new Date().toISOString() };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
