#!/usr/bin/env node
/* solver/results/2026-10-01-lost-last-answer/maps.js — the live answer map at every move decision of ROTOM's saved ladder
 * games (2026-10-01). Plays no game: each position is rebuilt from the saved log with ROTOM's own world builder
 * (solver/rotom/world.js, the 1.40-1.44 fixes, via solver/tests/ladder_replay.js) and staged on the frozen release, and
 * answer_map.js plays one-on-ones on it with medicham_api.
 *
 *   tools\lownode.cmd solver/results/2026-10-01-lost-last-answer/maps.js [--root <main>/solver/out/rotom] [--workers 6]
 *        [--n 16] [--runs chomp1-...,gen5ab-...] [--out solver/out/lost-last-answer-v1]
 *   (env ABRA_REGULATION=regmc, SHOWDOWN_PATH=<pokemon-showdown-mc>)
 *
 * Output: <out>/maps-<run>.jsonl, one line per move decision (see rec below), plus <out>/maps-meta-<pass>.json and counters-<pass>-w<k>.json per pass (release stamp,
 * flags, counters). A game already in the output is skipped, so a re-run after more games finish only adds the new ones.
 *
 * HINDSIGHT, STATED: the opponent's back line is filled from the WHOLE log (every sheet row the game ever revealed), not
 * from XATU's guess, because this is a post-mortem of what was on the board. Our side is exact up to what the log shows
 * (ladder_replay.js rebuilds the request from the log: HP, status, forme, item; the stat line comes from the sheet).
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
/* BELOWNORMAL, as tools/lownode.cmd sets it: set here too so a launch that could not go through the .cmd (an isolated
 * agent shell refuses cmd.exe) still yields the desktop; the workers inherit it and set it again themselves */
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { console.error('could not lower priority:', e.message); }
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require(require('path').join(__dirname, '..', '..', 'arena', 'env.js'));   // the Reg M-C checkout (SHOWDOWN_PATH) for the dex
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const HERE = __dirname, WT = path.join(HERE, '..', '..', '..');
/* solver/out is not tracked and a worktree has none: this checkout's own, else the main checkout's */
const ROOT = arg('--root', fs.existsSync(path.join(WT, 'solver', 'out', 'rotom')) ? path.join(WT, 'solver', 'out', 'rotom') : 'C:/Users/willj/Projects/Pokemon/ABRA/solver/out/rotom');
const OUT = arg('--out', path.join(WT, 'solver', 'out', 'lost-last-answer-v1'));
const RUNS = arg('--runs', 'chomp1-2026-09-29T23-13-11-521Z,gen5ab-2026-09-26T04-06-53-848Z,chomptop-2026-10-01T04-18-07-546Z').split(',');
const N = +arg('--n', 16), WORKERS = +arg('--workers', 6), RELEASE = 'eaa5becc54eb', ME = 'medicham32';

function listGames() {
  const out = [];
  for (const run of RUNS) {
    const dir = path.join(ROOT, run, 'games', ME);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.decisions.jsonl')).sort()) {
      const room = f.replace('.decisions.jsonl', ''), log = path.join(dir, room + '.log');
      if (!fs.existsSync(log) || !/\n\|win\|/.test(fs.readFileSync(log, 'utf8'))) continue;    // finished games only
      out.push({ run, room, dir });
    }
  }
  return out;
}

function worker(k, K) {
  const ENGINE = require(path.join(WT, 'solver', 'arena', 'engine.js')).load(RELEASE);
  const API = ENGINE.API;
  const T = require(path.join(WT, 'solver', 'arena', 'teams.js'));
  const WB = require(path.join(WT, 'solver', 'rotom', 'world.js')).create(API);
  const LR = require(path.join(WT, 'solver', 'tests', 'ladder_replay.js'));
  const AM = require(path.join(HERE, 'answer_map.js')).create(API);
  const X = require(path.join(WT, 'solver', 'human', 'dex.js'));
  const { parseShowteam } = require(path.join(WT, 'solver', 'human', 'parse_game.js'));
  /* the master's list, so every worker partitions the SAME list even while a live run is still adding games */
  const games = JSON.parse(fs.readFileSync(path.join(OUT, 'games-list.json'), 'utf8')).filter((_, i) => i % K === k);
  const C = { games: 0, decisions: 0, built: 0, buildFailed: 0, skippedNoPreview: 0, skippedDone: 0 };
  const done = new Set();
  for (const run of RUNS) { const f = path.join(OUT, 'maps-' + run + '.jsonl'); if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) { try { done.add(JSON.parse(l).room); } catch (e) {} } }
  for (const g of games) {
    if (done.has(g.room)) { C.skippedDone++; continue; }
    const logF = path.join(g.dir, g.room + '.log');
    const txt = fs.readFileSync(logF, 'utf8').replace(/\r/g, '');
    const lines = txt.split('\n');
    const me = (/\|player\|(p[12])\|medicham32/.exec(txt) || [])[1];
    const ds = fs.readFileSync(path.join(g.dir, g.room + '.decisions.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const pv = ds.find(d => d.kind === 'preview');
    if (!me || !pv || !/^team \d{4}/.test(pv.choice || '')) { C.skippedNoPreview++; continue; }
    const bring = pv.choice.slice(5, 9).split('').map(c => +c - 1);
    const opp = me === 'p1' ? 'p2' : 'p1';
    const sheets = {}; for (const l of lines) { const p = l.split('|'); if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
    const oppNicks = new Set(); for (const l of lines) { const m = /^\|(?:switch|drag|replace)\|(p[12])[ab]: ([^|]*)\|/.exec(l); if (m && m[1] === opp) oppNicks.add(m[2]); }
    const oppSeen = sheets[opp].map((r, i) => oppNicks.has(r.nick) ? i : -1).filter(i => i >= 0);
    const recs = [];
    const seenT = new Set();
    for (const d of ds.filter(d => d.kind === 'move')) {
      if (seenT.has(d.turn)) continue; seenT.add(d.turn);
      const cut = '|turn|' + d.turn;
      if (!lines.includes(cut)) continue;
      let w;
      try {
        const b = LR.build({ log: logF, me, bring, cut, hpOf: r => T.buildBody(API.M, r).st.hp });
        w = WB.build({ row: b.row, sheets: b.sheets, me, req: b.req, oppGuess: oppSeen, lines: b.lines });
        C.built++;
      } catch (e) { C.buildFailed++; recs.push({ room: g.room, turn: d.turn, error: String(e.message).slice(0, 200) }); continue; }
      const S = w.S, side = w.side, sfMe = side === 'A' ? S.sfA : S.sfB, act = side === 'A' ? S.actA : S.actB;
      const map = AM.answerMap(S, side, { n: N, seed: d.turn });
      /* my actives: slot, sheet row, and what the legal menu offers to keep it (a switch, a stalling move) */
      const L = API.legalActions(S, side);
      const actives = act.map((m, s) => {
        if (!m || !(m.curHP > 0) || m.fainted) return null;
        const opts = (L.slots[s] && L.slots[s].options) || [];
        const stall = [...new Set(opts.filter(o => o.kind === 'move' && X.D.moves.get(o.move).stallingMove).map(o => o.move))];
        return { slot: s, sheet: m._solverSheet, name: m.name, canSwitch: opts.some(o => o.kind === 'switch'), stall, moves: m.moves };
      });
      const it = d.info || {}, tb = it.table || null;
      recs.push({ run: g.run, room: g.room, gnum: d.gnum, turn: d.turn, policy: d.policy, me,
        value: typeof it.value === 'number' ? +it.value.toFixed(4) : null, choice: d.choice,
        table: tb ? { rows: tb.rows, cols: tb.cols, A: tb.A, mix: tb.mix, row_mean: tb.row_mean } : null,
        mine: map.mine, theirs: map.theirs.map(t => Object.assign(t, { revealedEver: oppSeen.includes(t.sheet) })),
        P: map.P, answers: map.answers, threats: map.threats, actives });
      C.decisions++;
    }
    fs.appendFileSync(path.join(OUT, 'maps-' + g.run + '.jsonl'), recs.map(r => JSON.stringify(r)).join('\n') + (recs.length ? '\n' : ''));
    C.games++;
    process.stdout.write(`[w${k}] ${g.run.slice(0, 6)} ${g.room.slice(-40)} ${recs.length} decisions\n`);
  }
  fs.writeFileSync(path.join(OUT, 'counters-' + (process.env.MAPS_PASS || 'x') + '-w' + k + '.json'), JSON.stringify({ worker: k, C, AM: AM.C, world: WB.COUNTERS, api: API.COUNTERS, stamp: ENGINE.stamp }, null, 1));
}

if (process.argv.includes('--worker')) {
  const i = process.argv.indexOf('--worker');
  worker(+process.argv[i + 1], +process.argv[i + 2]);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const PASS = new Date().toISOString().replace(/[:.]/g, '-');   // one counters file per pass and worker; a re-run adds, never overwrites
  const LIST = listGames().slice(0, +arg('--limit', 1e9));
  fs.writeFileSync(path.join(OUT, 'games-list.json'), JSON.stringify(LIST));
  fs.writeFileSync(path.join(OUT, 'maps-meta-' + PASS + '.json'), JSON.stringify({ started: new Date().toISOString(), release: RELEASE, root: ROOT, runs: RUNS,
    n_duels_per_pair: N, duel_cap_turns: 10, pick_memo: true, prune: false, workers: WORKERS, argv: process.argv.slice(2), games_listed: LIST.length,
    regulation: process.env.ABRA_REGULATION || null }, null, 1));
  let left = WORKERS;
  for (let k = 0; k < WORKERS; k++) {
    const c = cp.spawn(process.execPath, [__filename, '--worker', String(k), String(WORKERS)].concat(process.argv.slice(2)), { stdio: 'inherit', env: Object.assign({}, process.env, { MAPS_PASS: PASS }) });
    c.on('exit', code => { if (code) console.error('worker', k, 'exit', code); if (--left === 0) console.log('all workers done in', ((Date.now() - t0) / 60000).toFixed(1), 'min'); });
  }
}
