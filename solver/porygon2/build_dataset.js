/* solver/porygon2/build_dataset.js — PORYGON2 v0 training tensors: every public position of every human
 * Reg M-C game, labelled with the game's eventual winner.
 *
 *   cmd.exe /c tools\lownode.cmd solver\porygon2\build_dataset.js [--human <dir>] [--out <dir>] [--limit N]
 *
 * --human is the directory holding games.jsonl + manifest.json. The dataset is an untracked build output of
 * the MAIN checkout (solver/human/build_dataset.js); a worktree reads it there, READ ONLY.
 *
 * ONE ROW PER POSITION (a turn's public state, before the turn), stored ONCE with both sides: the trainer
 * reads it from p1's view and from p2's view. Labels: `winner` 1 = p1 won, 0 = p2 won. A game with no
 * winner (a tie, no result) is skipped and counted.
 *
 * THE SPLIT IS MAG's AND DODUO's: sha256("abra-prior-v0:" + toID(player)) mod 100, <80 train, <90 val, else
 * test (solver/mag/build_features.js, the same salt on purpose). Both players' splits are stored per row;
 * the trainer decides which views each split may use (see train.py: a value label is a property of the
 * GAME, so a game whose other player is held out may not train).
 *
 * Files (float32 / int32, little-endian, row-major), in --out (default solver/out/porygon2/):
 *   tok_num.f32 [N,2,6,TOK_NUM]   tok_id.i32 [N,2,6,7]   side.f32 [N,2,SIDE_NUM]   field.f32 [N,FIELD_NUM]
 *   facts.f32 [N,2,FACT_NUM]      base.f32 [N,2]         meta.i32 [N,META]          meta.json (vocab, names, counts, digests)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
require('../arena/env.js');
const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
/* --release <id>: the engine facts come from a FROZEN release (solver/arena/engine.js), never the live tree,
 * and the release stamp goes into meta.json. Without it the live tree is read and meta says so. */
const ENGINE = require('../arena/engine.js').load(arg('--release', null));
const API = ENGINE.API;
const FX = require('./features.js');
const { toID } = require('../human/dex.js');

const HUMAN = path.resolve(ROOT, arg('--human', path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'human')));
const OUT = path.resolve(ROOT, arg('--out', 'solver/out/porygon2'));
const LIMIT = +arg('--limit', 0) || Infinity;
const SALT = 'abra-prior-v0';
const SPLITS = ['train', 'val', 'test'];
const splitOf = pid => { const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100; return h < 80 ? 0 : h < 90 ? 1 : 2; };
const META_COLS = ['game', 'turn', 'winner', 'split_p1', 'split_p2', 'turns_played', 'end', 'last_turn'];
const ENDS = ['normal', 'forfeit', 'inactivity'];

function sha256File(p) {
  const h = crypto.createHash('sha256'); const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(1 << 22); let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd); return h.digest('hex');
}

(async () => {
  const t0 = Date.now();
  const GAMES = path.join(HUMAN, 'games.jsonl'), MANIFEST = path.join(HUMAN, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const gamesSha = sha256File(GAMES);
  const declared = (manifest.outputs || []).find(o => o.path.endsWith('games.jsonl'));
  if (!declared || declared.sha256 !== gamesSha) throw new Error('games.jsonl does not match its manifest digest');
  const F = FX.create(API.M);
  if (F.BROKEN) throw new Error('refusing to build training data with PORY2_BREAK=' + F.BROKEN);
  fs.mkdirSync(OUT, { recursive: true });
  const files = ['tok_num.f32', 'tok_id.i32', 'side.f32', 'field.f32', 'facts.f32', 'base.f32', 'meta.i32'];
  const fd = Object.fromEntries(files.map(f => [f, fs.openSync(path.join(OUT, f), 'w')]));
  const w = (f, typed) => fs.writeSync(fd[f], Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  const vocab = { species: { '<unk>': 0 }, item: { '<unk>': 0 }, ability: { '<unk>': 0 }, move: { '<unk>': 0 } };
  const KIND = ['species', 'item', 'ability', 'move', 'move', 'move', 'move'];
  const trainCount = { species: {}, item: {}, ability: {}, move: {} };
  const idOf = (kind, s) => { const v = vocab[kind]; if (!(s in v)) v[s] = Object.keys(v).length; return v[s]; };
  const counts = { games: 0, games_skipped_no_winner: 0, positions: 0, by_split_pair: {}, players: [{}, {}, {}] };
  const rl = readline.createInterface({ input: fs.createReadStream(GAMES), crlfDelay: Infinity });
  let gi = 0, N = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (gi >= LIMIT) break;
    const row = JSON.parse(line); const G = row.game;
    const gIdx = gi++;
    if (G.tie || (G.winner !== 'p1' && G.winner !== 'p2')) { counts.games_skipped_no_winner++; continue; }
    counts.games++;
    const sp = ['p1', 'p2'].map(sd => splitOf(toID(G.players[sd].name)));
    ['p1', 'p2'].forEach((sd, k) => { counts.players[sp[k]][toID(G.players[sd].name)] = 1; });
    const key = SPLITS[sp[0]] + '/' + SPLITS[sp[1]];
    counts.by_split_pair[key] = (counts.by_split_pair[key] || 0) + 1;
    const bothTrain = sp[0] === 0 && sp[1] === 0;
    for (let t = 0; t < row.turns.length; t++) {
      const T = row.turns[t];
      const x = F.encode({ sheets: G.sheets, state: T.state, turn: T.n });
      const tn = new Float32Array(2 * 6 * FX.TOK_NUM_NAMES.length), ti = new Int32Array(2 * 6 * 7);
      let a = 0, b = 0;
      for (const sd of ['p1', 'p2']) for (let i = 0; i < 6; i++) {
        for (const v of x.tokNum[sd][i]) tn[a++] = v;
        x.tokId[sd][i].forEach((s, j) => { ti[b++] = idOf(KIND[j], s); if (bothTrain && t === 0) trainCount[KIND[j]][s] = (trainCount[KIND[j]][s] || 0) + 1; });
      }
      w('tok_num.f32', tn); w('tok_id.i32', ti);
      w('side.f32', Float32Array.from([...x.side.p1, ...x.side.p2]));
      w('field.f32', Float32Array.from(x.field));
      w('facts.f32', Float32Array.from([...x.facts.p1, ...x.facts.p2]));
      w('base.f32', Float32Array.from(x.base));
      w('meta.i32', Int32Array.from([gIdx, T.n, G.winner === 'p1' ? 1 : 0, sp[0], sp[1], row.turns.length, ENDS.indexOf(G.end), t === row.turns.length - 1 ? 1 : 0]));
      N++;
    }
    if (counts.games % 2000 === 0) console.log(`${counts.games} games, ${N} positions, ${((Date.now() - t0) / 1000).toFixed(0)}s, dmg calls ${F.COUNTERS.dmgCalls}`);
  }
  for (const f of files) fs.closeSync(fd[f]);
  counts.positions = N;
  counts.players = counts.players.map(o => Object.keys(o).length);
  const meta = {
    generated: new Date().toISOString(), generator: 'solver/porygon2/build_dataset.js', feature_version: FX.FEATURE_VERSION,
    status: 'engine facts are PRE-GATE: MEDICHAM Reg M-C gate not open',
    dataset: { read_from: GAMES, games_sha256: gamesSha, manifest_generated: manifest.generated, games_read: gi },
    split: { rule: 'sha256("' + SALT + ':" + toID(player name)) mod 100: <80 train, <90 val, else test (MAG/DODUO split)', salt: SALT, codes: SPLITS },
    N, names: { tok_num: FX.TOK_NUM_NAMES, tok_id: FX.TOK_ID_NAMES, side: FX.SIDE_NUM_NAMES, field: FX.FIELD_NUM_NAMES, facts: FX.FACT_NAMES, meta: META_COLS, ends: ENDS },
    vocab, train_count: trainCount, counts, engine_counters: F.COUNTERS, seconds: (Date.now() - t0) / 1000,
    engine_sha: crypto.createHash('sha256').update(fs.readFileSync(ENGINE.REL ? path.join(ENGINE.REL.dir, 'engine', 'medicham2-browser.js') : path.join(ROOT, 'engine', 'medicham2-browser.js'))).digest('hex').slice(0, 16),
    engine_release: ENGINE.id || null, release_stamp: ENGINE.stamp,
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({ N, counts, engine: F.COUNTERS, seconds: meta.seconds }));
})().catch(e => { console.error(e); process.exit(1); });
