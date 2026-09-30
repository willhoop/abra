/* ABRA-HEAP: 2048
 * solver/porygon2/v2/score_v1.js — the comparators' values on gate (a)'s positions: PORYGON2 v1 and gen5's PORYGON2.
 *
 *   node solver/porygon2/v2/score_v1.js --release eaa5becc54eb --human <dir with games.jsonl> --ids <json list of game ids>
 *        --v1 solver/porygon2/model/porygon2-v1.json --out <jsonl>
 *
 * For every turn-start position of the listed games in a solver/human dataset (build_dataset.js output), the value each
 * comparator gives it, through the SAME code path its training and its leaf use:
 *   v1    features.js fromDataset -> encode -> infer.js           (solver/porygon2/v1/build.js, human branch)
 *   gen5  solver/porygon2/features.js encode -> infer.js          (build.js `vgen5`)
 * One line per position: { id, turn, v1, gen5, z } (P(p1 wins), z = 1 if p1 won). A game with no winner is skipped (as in
 * build.js); every skip and error is counted. Store-only for the net; the release serves the facts.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* printed by nobody: not fatal */ }
require('../../arena/env.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const REL_ID = arg('release', null);
if (!REL_ID) { console.error('--release is required'); process.exit(2); }
const ENGINE = require('../../arena/engine.js').load(REL_ID);
const API = ENGINE.API;
const V1F = require('../v1/features.js');
const V1PATH = path.resolve(ROOT, arg('v1', 'solver/porygon2/model/porygon2-v1.json'));
const G5PATH = path.resolve(ROOT, arg('gen5', 'solver/machamp/models/gen5/porygon2-gen5.json'));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

async function main() {
  const t0 = Date.now();
  const F = V1F.create(API);
  if (F.BROKEN) throw new Error('refusing to score with PORY2V1_BREAK=' + F.BROKEN);
  const F0 = require('../features.js').create(API.M);
  const NET = require('../v1/infer.js').load(V1PATH);
  const G5 = require('../infer.js').load(G5PATH);
  const want = new Set(JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('ids')), 'utf8')));
  const HUMAN = path.resolve(ROOT, arg('human'));
  const OUT = path.resolve(ROOT, arg('out'));
  const out = fs.openSync(OUT + '.tmp', 'w');
  const c = { wanted: want.size, found: 0, positions: 0, skipped_no_winner: 0, errors: 0 };
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(HUMAN, 'games.jsonl')), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const row = JSON.parse(line); const G = row.game;
    if (!want.has(G.id)) continue;
    c.found++;
    if (G.tie || (G.winner !== 'p1' && G.winner !== 'p2')) { c.skipped_no_winner++; continue; }
    const z = G.winner === 'p1' ? 1 : 0;
    const buf = [];
    try {
      for (let k = 0; k < row.turns.length; k++) {
        const T = row.turns[k];
        const X = F.encode(F.fromDataset(G, row.turns, k), G.sheets);
        const x0 = F0.encode({ sheets: G.sheets, state: T.state, turn: T.n });
        buf.push(JSON.stringify({ id: G.id, turn: T.n, v1: NET.value(X), gen5: G5.value(x0), z }));
      }
    } catch (e) { c.errors++; if (c.errors < 5) console.error('score_v1:', G.id, String(e && e.stack || e).slice(0, 300)); continue; }
    fs.writeSync(out, buf.join('\n') + '\n'); c.positions += buf.length;
  }
  fs.closeSync(out); fs.renameSync(OUT + '.tmp', OUT);
  const meta = { generated: new Date().toISOString(), generator: 'solver/porygon2/v2/score_v1.js', argv, engine_release: ENGINE.id, release_stamp: ENGINE.stamp,
    v1: { path: path.relative(ROOT, V1PATH).split(path.sep).join('/'), sha256: sha(V1PATH) }, gen5: { path: path.relative(ROOT, G5PATH).split(path.sep).join('/'), sha256: sha(G5PATH) },
    human: { dir: HUMAN.replace(/\\/g, '/'), games_sha256: sha(path.join(HUMAN, 'games.jsonl')) }, counts: c, v1_counters: F.COUNTERS, v1_net: NET.COUNTERS || null,
    output: { path: OUT.replace(/\\/g, '/'), sha256: sha(OUT) }, seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(OUT + '.meta.json', JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({ counts: c, seconds: meta.seconds }));
  if (!c.positions) { console.error('score_v1: ZERO positions scored'); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
