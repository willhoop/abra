/* solver/mag/build_features.js — MAG v1 / DODUO v1 training tensors from the human dataset.
 *
 *   cmd.exe /c tools\lownode.cmd solver/mag/build_features.js [--human dir] [--limit N] [--out dir]
 *
 * A copy of solver/prior/build_features.js with the SAME split salt, the same decisions in the same
 * order and the same v0 tensors (the v1 test compares the two byte for byte), plus two extra files:
 *   slot_x.i32  [slots, SLOT_X]  species-vocab ids of the slot's identity extras (solver/mag/features.js)
 *   cand_x.i32  [cands]          species-vocab id each candidate points at
 * --human points at the directory holding games.jsonl + manifest.json (the dataset is an untracked
 * build output, so an isolated worktree reads it from the main checkout, read only).
 *
 * Reads solver/out/human/games.jsonl (and its manifest, whose digest is recorded), splits every
 * side-turn decision BY THE ACTING PLAYER (hash of the account id), fits the per-species frequency
 * tables on TRAIN actors only, and writes per-split binary tensors to solver/out/prior/<split>/.
 *
 * ABRA-HEAP: 4096
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const F = require('./features.js');
const F0 = F.V0;
const { toID } = require('../human/dex.js');

const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const LIMIT = +arg('--limit', 0) || Infinity;
const OUT = path.resolve(ROOT, arg('--out', 'solver/out/mag'));
const HUMAN = path.resolve(ROOT, arg('--human', 'solver/out/human'));
const GAMES = path.join(HUMAN, 'games.jsonl');
const MANIFEST = path.join(HUMAN, 'manifest.json');
const SALT = 'abra-prior-v0';   // v0's salt ON PURPOSE: the same player split, so v1 and v0 compare
const SPLIT_OF = pid => {
  const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100;
  return h < 80 ? 'train' : h < 90 ? 'val' : 'test';
};
const SPLITS = ['train', 'val', 'test'];
const SLOT_STATUS = ['exact', 'uncertain_target', 'hidden', 'locked', 'outside', 'none'];
const JOINT_STATUS = ['exact', 'uncertain_target', 'hidden', 'outside', 'all_locked', 'none'];
const SIDES = ['p1', 'p2'];

function sha256File(p) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(1 << 22); let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd); return h.digest('hex');
}
async function* games() {
  const rl = readline.createInterface({ input: fs.createReadStream(GAMES), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) { if (!line) continue; if (n++ >= LIMIT) break; yield JSON.parse(line); }
}

/* the frequency tables' contribution of ONE side of ONE game */
function contrib(row, side) {
  const out = [];
  for (let t = 0; t < row.turns.length; t++) {
    const d = F0.decide(row, t, side, null);
    for (const s of d.slots) {
      if (!s || !(s.label.status === 'exact' || s.label.status === 'uncertain_target')) continue;
      const c = s.cands[s.label.set[0]];
      const key = c.attr.sw ? 'SWITCH' : c.attr.mv;
      const megaChoice = s.cands.some(x => x.attr.mega === 1);
      out.push({ sp: s.species, key, tc: s.label.status === 'exact' && !c.attr.sw ? c.attr.tc : null, mega: megaChoice && !c.attr.sw ? c.attr.mega : null });
    }
  }
  return out;
}
function apply(freq, rows, sign) {
  for (const r of rows) {
    const a = (freq.act[r.sp] = freq.act[r.sp] || {}); a[r.key] = (a[r.key] || 0) + sign;
    if (r.tc != null) { const k = r.sp + '|' + r.key; const t = (freq.tc[k] = freq.tc[k] || {}); t[r.tc] = (t[r.tc] || 0) + sign; }
    if (r.mega != null) { const k = r.sp + '|' + r.key; const m = (freq.mega[k] = freq.mega[k] || [0, 0]); m[r.mega] += sign; }
  }
}

class Writer {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.dir = dir;
    this.fd = {};
    for (const f of ['ctx.f32', 'cand.f32', 'cand_attr.i32', 'cand_label.u8', 'slot.i32', 'dec.i32', 'slot_x.i32', 'cand_x.i32']) this.fd[f] = fs.openSync(path.join(dir, f), 'w');
    this.nSlots = 0; this.nCands = 0; this.nDec = 0;
  }
  write(f, typed) { fs.writeSync(this.fd[f], Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)); }
  close() { for (const k in this.fd) fs.closeSync(this.fd[k]); }
}

(async () => {
  const t0 = Date.now();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const gamesSha = sha256File(GAMES);
  const declared = (manifest.outputs || []).find(o => o.path.endsWith('games.jsonl'));
  if (!declared || declared.sha256 !== gamesSha) throw new Error('games.jsonl does not match its manifest digest; rebuild the dataset first');
  const manifestSha = sha256File(MANIFEST);

  /* pass 1: vocabularies + train-actor frequency tables */
  const freq = { act: {}, tc: {}, mega: {} };
  const moveVocab = { '<pad>': 0, SWITCH: 1, LOCKED: 2 }; const moveTrainCount = {};
  const speciesVocab = { '<unk>': 0 };
  const players = new Map();
  let g1 = 0;
  for await (const row of games()) {
    g1++;
    for (const side of SIDES) {
      const pid = toID(row.game.players[side].name);
      const split = SPLIT_OF(pid);
      players.set(pid, split);
      for (const sh of row.game.sheets[side]) {
        if (!(sh.species_id in speciesVocab)) speciesVocab[sh.species_id] = Object.keys(speciesVocab).length;
        for (const m of sh.moves) { const id = toID(m); if (!(id in moveVocab)) moveVocab[id] = Object.keys(moveVocab).length; }
      }
      if (split !== 'train') continue;
      const c = contrib(row, side);
      apply(freq, c, +1);
      for (const r of c) moveTrainCount[r.key] = (moveTrainCount[r.key] || 0) + 1;
    }
  }
  console.log(`pass 1: ${g1} games, ${players.size} players, ${(Date.now() - t0) / 1000}s`);

  /* pass 2: features */
  const W = Object.fromEntries(SPLITS.map(s => [s, new Writer(path.join(OUT, s))]));
  const counts = Object.fromEntries(SPLITS.map(s => [s, { decisions: 0, joint: {}, slot: {}, outside_detail: {} }]));
  const gameIds = [];
  let g2 = 0;
  for await (const row of games()) {
    const gi = g2++;
    gameIds.push(row.game.id);
    for (let si = 0; si < 2; si++) {
      const side = SIDES[si];
      const pid = toID(row.game.players[side].name);
      const split = players.get(pid);
      const w = W[split], cnt = counts[split];
      /* leave-own-game-out: a TRAIN row never sees its own clicks in the frequency features */
      const own = split === 'train' ? contrib(row, side) : null;
      if (own) apply(freq, own, -1);
      const pidIdx = playerIndex(pid);
      for (let t = 0; t < row.turns.length; t++) {
        const d = F.decide(row, t, side, freq);
        const js = F0.jointStatus(d);
        cnt.joint[js] = (cnt.joint[js] || 0) + 1;
        if (js === 'none' || js === 'all_locked') continue;
        const slotIdx = [-1, -1];
        for (let k = 0; k < 2; k++) {
          const s = d.slots[k];
          if (!s) continue;
          cnt.slot[s.label.status] = (cnt.slot[s.label.status] || 0) + 1;
          if (s.label.status === 'outside') cnt.outside_detail[s.label.detail] = (cnt.outside_detail[s.label.detail] || 0) + 1;
          const n = s.cands.length;
          const cf = new Float32Array(n * F0.CAND_F), ca = new Int32Array(n * 7), cl = new Uint8Array(n), cx = new Int32Array(n);
          for (let i = 0; i < n; i++) {
            const c = s.cands[i];
            cf.set(c.f, i * F0.CAND_F);
            cx[i] = spIdx(c.tx);
            const mvIdx = c.attr.mv === 'SWITCH' ? 1 : c.attr.mv === 'LOCKED' ? 2 : (moveVocab[c.attr.mv] != null ? moveVocab[c.attr.mv] : 0);
            ca.set([mvIdx, c.attr.tc, c.attr.stall, c.attr.sw, c.attr.to, c.attr.spread, c.attr.mega], i * 7);
          }
          for (const i of s.label.set) cl[i] = 1;
          if (!s.ctx.every(Number.isFinite) || !cf.every(Number.isFinite)) throw new Error(`non-finite feature: game ${row.game.id} turn ${t} ${side}${s.pos}`);
          w.write('ctx.f32', Float32Array.from(s.ctx));
          w.write('cand.f32', cf); w.write('cand_attr.i32', ca); w.write('cand_label.u8', cl);
          w.write('cand_x.i32', cx); w.write('slot_x.i32', Int32Array.from(s.sx.map(spIdx)));
          w.write('slot.i32', Int32Array.from([w.nCands, n, SLOT_STATUS.indexOf(s.label.status), speciesVocab[s.species] || 0, s.mon]));
          slotIdx[k] = w.nSlots++;
          w.nCands += n;
        }
        w.write('dec.i32', Int32Array.from([slotIdx[0], slotIdx[1], JOINT_STATUS.indexOf(js), gi, t, si, pidIdx]));
        w.nDec++; cnt.decisions++;
      }
      if (own) apply(freq, own, +1);
    }
    if (g2 % 5000 === 0) console.log(`pass 2: ${g2} games, ${(Date.now() - t0) / 1000}s`);
  }
  for (const s of SPLITS) W[s].close();

  const playerList = [...players.keys()];
  const meta = {
    generated: new Date().toISOString(), generator: 'solver/prior/build_features.js', feature_version: F.FEATURE_VERSION,
    dataset: { games_jsonl: 'solver/out/human/games.jsonl', read_from: GAMES, games_sha256: gamesSha, manifest_sha256: manifestSha, manifest_generated: manifest.generated, games_read: g2 },
    split: { rule: 'sha256("' + SALT + ':" + toID(player name)) mod 100: <80 train, <90 val, else test — by ACTING player', salt: SALT,
      players: Object.fromEntries(SPLITS.map(s => [s, playerList.filter(p => players.get(p) === s).length])) },
    ctx_names: F0.CTX_NAMES, cand_names: F0.CAND_NAMES, pair_names: F0.PAIR_NAMES, slot_x_names: F.SLOT_X_NAMES, v0_feature_version: F0.FEATURE_VERSION,
    cand_attr: ['move', 'tc', 'stall', 'sw', 'to', 'spread', 'mega'], slot_cols: ['cand_start', 'n_cands', 'status', 'species', 'mon'],
    dec_cols: ['slot_a', 'slot_b', 'joint_status', 'game', 'turn', 'side', 'player'],
    slot_status: SLOT_STATUS, joint_status: JOINT_STATUS,
    move_vocab: moveVocab, move_train_count: moveTrainCount, species_vocab: speciesVocab,
    sizes: Object.fromEntries(SPLITS.map(s => [s, { decisions: W[s].nDec, slots: W[s].nSlots, cands: W[s].nCands }])),
    counts, seconds: (Date.now() - t0) / 1000,
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  fs.writeFileSync(path.join(OUT, 'freq.json'), JSON.stringify(freq));
  fs.writeFileSync(path.join(OUT, 'games_index.json'), JSON.stringify(gameIds));
  fs.writeFileSync(path.join(OUT, 'players.json'), JSON.stringify(playerList));
  console.log(JSON.stringify(meta.sizes), JSON.stringify(meta.split.players), `${meta.seconds}s`);

  function spIdx(id) { return !id ? 0 : (speciesVocab[id] != null ? speciesVocab[id] : 0); }
  function playerIndex(pid) {
    if (!playerIndex.map) { playerIndex.map = new Map(); let i = 0; for (const p of players.keys()) playerIndex.map.set(p, i++); }
    return playerIndex.map.get(pid);
  }
})().catch(e => { console.error(e); process.exit(1); });
