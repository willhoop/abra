/* ABRA-HEAP: 1500  (lownode.cmd caps the heap from this line)
 * solver/xatu/selfplay.js — ground truth for the spread belief.
 *
 * Human replays never reveal spreads, so "did a constraint exclude the truth?" cannot be asked of them.
 * Here Showdown itself (the Reg M-C checkout, the authority) plays games between real human open sheets
 * given KNOWN random Stat Point spreads, with RandomPlayerAI choosing. The SPECTATOR channel of the log
 * (what a replay shows) is fed to the tracker and the belief, and after every observation the true SP
 * value of every stat of every mon is checked to still be alive. The target is zero exclusions.
 *
 *   node solver/xatu/selfplay.js --games 200 --seed 1 [--out solver/out/xatu/selfplay.json]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const SD = require('./sd.js');
const { Tracker } = require('./track.js');
const { SpreadBelief, STATS } = require('./spreads.js');
const X = require('../human/dex.js');
const { parseShowteam } = require('../human/parse_game.js');
const { RandomPlayerAI } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim', 'tools', 'random-player-ai'));
const { extractChannelMessages } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim', 'battle'));

const ROOT = path.join(__dirname, '..', '..');

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* random legal SP spread: half "two stats at the cap + remainder", half a random capped partition */
function randomSpread(R) {
  const sp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (R() < 0.5) {
    const order = STATS.slice().sort(() => R() - 0.5);
    let left = SD.SP_TOTAL;
    for (const s of order) { const v = Math.min(SD.SP_CAP, left); sp[s] = v; left -= v; if (!left) break; }
  } else {
    let left = Math.floor(SD.SP_TOTAL * (0.6 + 0.4 * R()));
    while (left > 0) { const s = STATS[Math.floor(R() * 6)]; if (sp[s] < SD.SP_CAP) { sp[s]++; left--; } else if (STATS.every(t => sp[t] >= SD.SP_CAP)) break; }
  }
  return sp;
}

/* open sheets from the raw Reg M-C shards (tracked data; read only) */
function loadSheets(max, R) {
  const dir = path.join(ROOT, 'data', 'raw', 'games.gen9championsvgc2026regmcbo3');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.gz')).sort();
  const out = [];
  for (const f of files.slice(-12)) {
    for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n')) {
      if (!line || /\|replace\|/.test(line)) continue;
      const log = JSON.parse(line).log || '';
      for (const l of log.split('\n')) if (l.startsWith('|showteam|')) out.push(parseShowteam(l.split('|').slice(3).join('|')));
    }
    if (out.length >= max * 4) break;
  }
  return out.filter(t => t.length === 6 && t.every(m => !/Illusion/.test(m.ability || ''))).sort(() => R() - 0.5).slice(0, max);
}

class Chooser extends RandomPlayerAI {
  constructor(seed, R) { const box = { c: null }; super({ write: c => { box.c = c; } }, { move: 0.85, mega: 0.7, seed }); this.box = box; this.R = R; }
  chooseTeamPreview(team) { const o = [1, 2, 3, 4, 5, 6].sort(() => this.R() - 0.5); return 'team ' + o.join(''); }
  pick(req) { this.box.c = null; this.receiveRequest(req); return this.box.c; }
}

function playOne(sheetsPair, spreads, seed) {
  const R = rng(seed);
  const b = new SD.Battle({ formatid: SD.FORMAT, seed: [seed & 0xffff, 1 + (seed >> 16), 3, 5] });
  for (const [k, s] of [['p1', 0], ['p2', 1]]) {
    const team = sheetsPair[s].map((m, i) => ({ ...SD.toSet(m), evs: spreads[k][i] }));
    b.setPlayer(k, { name: k, team: SD.Teams.pack(team) });
  }
  const ai = { p1: new Chooser([seed, 1, 2, 3], R), p2: new Chooser([seed, 4, 5, 6], R) };
  for (let guard = 0; guard < 400 && !b.ended; guard++) {
    let acted = false;
    for (const side of b.sides) {
      const req = side.activeRequest;
      if (!req || req.wait || side.isChoiceDone()) continue;
      let c = null;
      try { c = ai[side.id].pick(req); } catch (e) { c = 'default'; }
      if (!c || !b.choose(side.id, c)) { side.clearChoice && side.clearChoice(); b.choose(side.id, 'default'); }
      acted = true;
    }
    if (!acted) break;
    if (b.turn > 40) break;
  }
  const spect = extractChannelMessages(b.log.join('\n'), [0])[0].join('\n');
  return { log: spect, ended: b.ended, turns: b.turn };
}

/* run the belief on one self-play log, checking the truth after every observation */
function checkGame(log, sheets, truth) {
  const T = new Tracker({});
  T.feedLog(log);
  const out = T.out;
  const B = new SpreadBelief(T.sheets);
  const ev = [...out.order.map(o => ({ t: o.turn, k: 'o', o })), ...out.damage.map(o => ({ t: o.turn, k: 'd', o }))].sort((a, c) => a.t - c.t);
  const excl = [];
  const narrowing = { before: 0, after: 0 };
  for (const e of ev) {
    const res = e.k === 'o' ? B.applyOrder(e.o) : B.applyDamage(e.o);
    for (const s of ['p1', 'p2']) for (let i = 0; i < 6; i++) for (const st of STATS) {
      if (!B.dom[s][i].d[st][truth[s][i][st]]) excl.push({ kind: e.k, res, side: s, idx: i, species: T.sheets[s][i].species, stat: st, truth: truth[s][i][st], obs: { ...e.o, snap: undefined } });
    }
    if (excl.length) break;          // report the first observation that excluded the truth
  }
  for (const s of ['p1', 'p2']) for (let i = 0; i < 6; i++) for (const st of STATS) { narrowing.before += 33; narrowing.after += B.dom[s][i].alive(st).length; }
  return { excl, stats: B.stats, contradictions: B.contradictions, anomalies: B.anomalies, narrow: B.narrowing(), skipped: out.skipped, n_order: out.order.length, n_damage: out.damage.length, narrowing };
}

function main() {
  const args = process.argv.slice(2);
  const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const games = +flag('--games', 100), seed = +flag('--seed', 1);
  const outp = flag('--out', path.join(ROOT, 'solver', 'out', 'xatu', 'selfplay.json'));
  const R = rng(seed);
  const pool = loadSheets(games * 2, R);
  const agg = { games: 0, ended: 0, order_obs: 0, damage_obs: 0, stats: {}, skipped: {}, exclusions: [], contradictions: [], anomalies: [], narrowing: { before: 0, after: 0 }, touched: {} };
  const t0 = Date.now();
  for (let g = 0; g < games; g++) {
    const pair = [pool[(2 * g) % pool.length], pool[(2 * g + 1) % pool.length]];
    const spreads = { p1: pair[0].map(() => randomSpread(R)), p2: pair[1].map(() => randomSpread(R)) };
    let r;
    try { r = playOne(pair, spreads, seed * 100003 + g); } catch (e) { agg.stats.play_error = (agg.stats.play_error || 0) + 1; continue; }
    const c = checkGame(r.log, pair, spreads);
    agg.games++; if (r.ended) agg.ended++;
    agg.order_obs += c.n_order; agg.damage_obs += c.n_damage;
    for (const [k, v] of Object.entries(c.stats)) agg.stats[k] = (agg.stats[k] || 0) + v;
    for (const [k, v] of Object.entries(c.skipped)) agg.skipped[k] = (agg.skipped[k] || 0) + v;
    agg.narrowing.before += c.narrowing.before; agg.narrowing.after += c.narrowing.after;
    if (c.excl.length) agg.exclusions.push({ game: g, seed: seed * 100003 + g, first: c.excl[0], n: c.excl.length });
    for (const x of c.contradictions) agg.contradictions.push({ game: g, ...x });
    for (const x of c.anomalies) agg.anomalies.push({ game: g, seed: seed * 100003 + g, ...x });
    for (const [st, b] of Object.entries(c.narrow)) { const a = (agg.touched[st] = agg.touched[st] || { n: 0, alive: 0, narrowed: 0, bits: 0 }); a.n += b.n; a.alive += b.alive; a.narrowed += b.narrowed; a.bits += b.bits; }
    if ((g + 1) % 10 === 0) process.stderr.write(`selfplay ${g + 1}/${games} excl=${agg.exclusions.length} contra=${agg.contradictions.length} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  for (const b of Object.values(agg.touched)) { b.mean_alive = +(b.alive / b.n).toFixed(2); b.frac_narrowed = +(b.narrowed / b.n).toFixed(4); b.mean_bits = +(b.bits / b.n).toFixed(3); }
  agg.seconds = (Date.now() - t0) / 1000;
  agg.flags = { games, seed };
  agg.showdown = { path: X.SHOWDOWN_PATH, head: X.checkoutCommit() };
  fs.mkdirSync(path.dirname(outp), { recursive: true });
  fs.writeFileSync(outp, JSON.stringify(agg, null, 1));
  console.log(JSON.stringify({ games: agg.games, ended: agg.ended, order_obs: agg.order_obs, damage_obs: agg.damage_obs, stats: agg.stats, exclusions: agg.exclusions.length, contradictions: agg.contradictions.length, anomalies: agg.anomalies.length, touched: agg.touched, remaining_frac: +(agg.narrowing.after / agg.narrowing.before).toFixed(4), seconds: agg.seconds }));
}

module.exports = { playOne, checkGame, randomSpread, loadSheets, rng };
if (require.main === module) main();
