/* ABRA-HEAP: 3072
 * solver/machamp/build_doduo.js — DODUO's self-play training tensors: every searched self-play decision, its
 * candidates featurised by the SAME function DODUO reads live, and the SEARCH's mix as a soft target.
 *
 *   node solver/machamp/build_doduo.js --selfplay <dir>[,<dir>…] --out <dir> [--meta solver/out/mag/meta.json]
 *        [--mag solver/mag/model/mag-v1.json] [--max-unfilled 0.5] [--min-mass 0.5] [--val-pct 10]
 *
 * Reads MEW's shards (solver/mew/play.js). For each recorded decision it rebuilds the row the prior adapter built
 * at decision time — the open sheets, the deciding side's brought_seen view, the public history up to that turn
 * with the current turn's actions empty — and runs solver/mag/features.js decide() on it with the model's own
 * frequency table. The candidate KEYS recorded at play time must equal the rebuilt ones, cell for cell; a
 * decision that does not rebuild identically is dropped and COUNTED (`key_mismatch`), never trained on.
 *
 * THE TARGET is the search's row mix x, moved onto DODUO's (a, b) cells (rows that map to one cell add up). A row
 * with no DODUO cell (a forced or passing slot while the prior enumerated choices there) drops its mass; the
 * rest is renormalised, and a decision that keeps less than --min-mass is dropped (counted). A decision whose
 * matrix was more than --max-unfilled empty when the clock ran out is dropped too (its mix is mostly the fill).
 *
 * Output: the build_features.js tensor layout (ctx, cand, cand_attr, cand_label, slot, dec, slot_x, cand_x) in
 * <out>/train and <out>/val (val = --val-pct of GAMES by a hash of the game id), plus the soft target
 *   tgt.i32 [T, 3] (decision, a, b)   tgt.f32 [T] (mass)
 * and <out>/meta.json (counts, the source shards' digests, the vocabularies it indexed with — the HUMAN build's
 * meta, so the ids mean what the trainer's embeddings mean).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
require('../arena/env.js');
const F = require('../mag/features.js');
const F0 = F.V0;

const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const DIRS = String(arg('--selfplay', '')).split(',').filter(Boolean).map(d => path.resolve(ROOT, d));
const OUT = path.resolve(ROOT, arg('--out', 'solver/out/machamp/doduo'));
const META = JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('--meta', 'solver/out/mag/meta.json')), 'utf8'));
const MAGF = path.resolve(ROOT, arg('--mag', 'solver/mag/model/mag-v1.json'));
const MAXUNF = +arg('--max-unfilled', 0.5), MINMASS = +arg('--min-mass', 0.5), VALPCT = +arg('--val-pct', 10);
/* DELIBERATE BREAK (env MACHAMP_BREAK=row): the row is rebuilt one turn late (the previous turn's state stands in
 * for the decision's), the off-by-one this file could make. solver/tests/test-machamp.js REBUILD must go red. */
const BREAK = process.env.MACHAMP_BREAK || '';

const MJ = JSON.parse(fs.readFileSync(MAGF, 'utf8'));
const freqPath = path.resolve(ROOT, MJ.freq.path.split('\\').join('/'));
const freq = JSON.parse(fs.readFileSync(freqPath, 'utf8'));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
if (sha(freqPath) !== MJ.freq.sha256) throw new Error('build_doduo: the frequency table is not the one the model was trained with');
const moveVocab = META.move_vocab, speciesVocab = META.species_vocab;
const spIdx = id => (!id ? 0 : (speciesVocab[id] != null ? speciesVocab[id] : 0));
const isVal = id => crypto.createHash('sha256').update('machamp-val:' + id).digest().readUInt32BE(0) % 100 < VALPCT;

class Writer {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.fd = {};
    for (const f of ['ctx.f32', 'cand.f32', 'cand_attr.i32', 'cand_label.u8', 'slot.i32', 'dec.i32', 'slot_x.i32', 'cand_x.i32', 'tgt.i32', 'tgt.f32', 'val.f32'])
      this.fd[f] = fs.openSync(path.join(dir, f), 'w');
    this.nSlots = 0; this.nCands = 0; this.nDec = 0; this.nTgt = 0;
  }
  write(f, typed) { fs.writeSync(this.fd[f], Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)); }
  close() { for (const k in this.fd) fs.closeSync(this.fd[k]); }
}

function* records(dir) {
  for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) if (line) yield JSON.parse(line);
  }
}

/* the row the prior adapter built for `d` (solver/miltank/prior_adapter.js row()) */
function rowOf(rec, d) {
  const cur = BREAK === 'row' && d.t > 0 ? rec.hist[d.t - 1] : rec.hist[d.t];
  return { game: { sheets: rec.sheets, teamsize: { p1: 4, p2: 4 }, brought_seen: d.bs },
           turns: rec.hist.slice(0, d.t).concat([{ n: cur.n, state: cur.state, actions: { p1: {}, p2: {} } }]) };
}

function build() {
  const t0 = Date.now();
  const W = { train: new Writer(path.join(OUT, 'train')), val: new Writer(path.join(OUT, 'val')) };
  const c = { games: 0, decisions: 0, kept: 0, no_cells: 0, too_unfilled: 0, low_mass: 0, key_mismatch: 0, slot_mismatch: 0, mass_kept: 0, by_split: { train: 0, val: 0 }, hist_missing: 0 };
  const sources = [];
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) sources.push({ file: path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/'), sha256: sha(path.join(dir, f)) });
    let gi = 0;
    for (const rec of records(dir)) {
      c.games++; gi++;
      const split = isVal(rec.id + ':' + rec.run_seed + ':' + rec.g) ? 'val' : 'train';
      const w = W[split];
      for (const d of rec.decisions) {
        c.decisions++;
        if (!d.cells) { c.no_cells++; continue; }
        if (d.unfilled / (d.m * d.nc) > MAXUNF) { c.too_unfilled++; continue; }
        if (!rec.hist[d.t]) { c.hist_missing++; continue; }
        const side = d.side === 'A' ? 'p1' : 'p2';
        const dec = F.decide(rowOf(rec, d), d.t, side, freq);
        const nA = dec.slots[0] ? dec.slots[0].cands.length : 1, nB = dec.slots[1] ? dec.slots[1].cands.length : 1;
        if (!d.n || nA !== d.n[0] || nB !== d.n[1]) { c.slot_mismatch++; continue; }
        let bad = false;
        const mass = new Map();
        let kept = 0;
        d.cells.forEach((cell, r) => {
          if (!cell) return;
          const ka = dec.slots[0] ? dec.slots[0].cands[cell[0]].key : null, kb = dec.slots[1] ? dec.slots[1].cands[cell[1]].key : null;
          if (ka !== d.keys[r][0] || kb !== d.keys[r][1]) bad = true;
          const k = cell[0] + ',' + cell[1];
          mass.set(k, (mass.get(k) || 0) + d.x[r]); kept += d.x[r];
        });
        if (bad) { c.key_mismatch++; continue; }
        if (kept < MINMASS) { c.low_mass++; continue; }
        const slotIdx = [-1, -1];
        for (let k = 0; k < 2; k++) {
          const s = dec.slots[k];
          if (!s) continue;
          const n = s.cands.length;
          const cf = new Float32Array(n * F0.CAND_F), ca = new Int32Array(n * 7), cl = new Uint8Array(n), cx = new Int32Array(n);
          for (let i = 0; i < n; i++) {
            const cd = s.cands[i];
            cf.set(cd.f, i * F0.CAND_F);
            cx[i] = spIdx(cd.tx);
            const mvIdx = cd.attr.mv === 'SWITCH' ? 1 : cd.attr.mv === 'LOCKED' ? 2 : (moveVocab[cd.attr.mv] != null ? moveVocab[cd.attr.mv] : 0);
            ca.set([mvIdx, cd.attr.tc, cd.attr.stall, cd.attr.sw, cd.attr.to, cd.attr.spread, cd.attr.mega], i * 7);
          }
          if (!s.ctx.every(Number.isFinite) || !cf.every(Number.isFinite)) throw new Error('build_doduo: non-finite feature in ' + rec.id + ' t' + d.t);
          w.write('ctx.f32', Float32Array.from(s.ctx)); w.write('cand.f32', cf); w.write('cand_attr.i32', ca); w.write('cand_label.u8', cl);
          w.write('cand_x.i32', cx); w.write('slot_x.i32', Int32Array.from(s.sx.map(spIdx)));
          w.write('slot.i32', Int32Array.from([w.nCands, n, 0, speciesVocab[s.species] || 0, s.mon]));
          slotIdx[k] = w.nSlots++; w.nCands += n;
        }
        w.write('dec.i32', Int32Array.from([slotIdx[0], slotIdx[1], 0, gi, d.t, side === 'p1' ? 0 : 1, 0]));
        for (const [k, p] of mass) { const [a, b] = k.split(',').map(Number); w.write('tgt.i32', Int32Array.from([w.nDec, a, b])); w.write('tgt.f32', Float32Array.from([p / kept])); w.nTgt++; }
        w.write('val.f32', Float32Array.from([d.v]));
        w.nDec++; c.kept++; c.mass_kept += kept; c.by_split[split]++;
      }
    }
  }
  W.train.close(); W.val.close();
  c.mass_kept_mean = c.kept ? +(c.mass_kept / c.kept).toFixed(4) : null; delete c.mass_kept;
  const meta = { generated: new Date().toISOString(), generator: 'solver/machamp/build_doduo.js', what: 'DODUO self-play targets: the search mix on DODUO cells',
    sources, human_meta: { dataset: META.dataset, split: META.split }, mag_model: { path: path.relative(ROOT, MAGF).split(path.sep).join('/'), sha256: sha(MAGF), freq: MJ.freq },
    flags: { max_unfilled: MAXUNF, min_mass: MINMASS, val_pct: VALPCT, break: BREAK || null },
    ctx_names: META.ctx_names, cand_names: META.cand_names, pair_names: META.pair_names, slot_x_names: META.slot_x_names, v0_feature_version: META.v0_feature_version,
    joint_status: META.joint_status, slot_status: META.slot_status, move_vocab: moveVocab, species_vocab: speciesVocab,
    sizes: Object.fromEntries(Object.entries(W).map(([k, w]) => [k, { decisions: w.nDec, slots: w.nSlots, cands: w.nCands, targets: w.nTgt }])),
    counts: c, seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({ sizes: meta.sizes, counts: c, seconds: meta.seconds }));
  return meta;
}

if (require.main === module) build();
module.exports = { rowOf };
