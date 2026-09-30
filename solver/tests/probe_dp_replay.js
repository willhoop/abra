/* solver/tests/probe_dp_replay.js — REPLAY ONE LIVE ROTOM DECISION THROUGH gen5 WITH AND WITHOUT THE DOUBLE-PROTECT GATE
 * (2026-09-29, docs/_reports/2026-09-30-double-protect-gate.md).
 *
 *   node solver/tests/probe_dp_replay.js --log <rotom game .log> --turn 4 [--account medicham32] [--release eaa5becc54eb]
 *        [--passes 96] [--seeds 3] [--out <json>]
 *
 * A MEASUREMENT on a FINISHED game (read only). The position is rebuilt the way ROTOM builds it: the protocol up to the
 * `|turn|N` line is parsed (solver/human/parse_game.js), and solver/rotom/world.js builds the world from it with the log
 * (the exact Protect counter) and a request SYNTHESISED from the log — the account's own bodies at their exact HP (the
 * account's own lines carry exact HP), actives first in slot order, then the rest in sheet order; each active's four
 * sheet moves, and the mega offered when the body holds its stone and the side has not mega-evolved. The live request
 * itself is not stored by ROTOM, so a disabled move or a trap the log does not show is not reproduced, and a brought body
 * the log has not shown yet is left out of the request (stated).
 *
 * Arms (the ROTOM policy `miltank-gen5`, solver/rotom/policy.js, with a spec override):
 *   ungated    solver/machamp/league/gen5.json — what played live
 *   dp         gen5 + gates { doubleProtect: true, tiers: false } — the double-Protect soft gate alone
 *   dp-noterr  the same with the terrain exemption switched off (a diagnostic: what the gate does if terrain did not count)
 * Each arm runs `--passes` passes (no clock, so the machine load does not change the answer) on `--seeds` coins. Printed:
 * the rows, the columns, the row mix, the value, the gate's counters and its stall reasons at the root.
 */
'use strict';
require('../arena/env.js');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LOG = flag('--log');
const TURN = +flag('--turn', 4);
const ACCOUNT = flag('--account', 'medicham32');
const REL = flag('--release', 'eaa5becc54eb');
const PASSES = +flag('--passes', 96);
const SEEDS = +flag('--seeds', 3);
const OUT = flag('--out', null);
const ROOT = path.join(__dirname, '..', '..');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const { parseGame, parseShowteam } = require('../human/parse_game.js');
const X = require('../human/dex.js');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const all = fs.readFileSync(LOG, 'utf8').split('\n');
const ti = all.findIndex(l => l === '|turn|' + TURN);
if (ti < 0) throw new Error('no |turn|' + TURN + ' in the log');
const lines = all.slice(0, ti + 1);
let me = null; const sheets = {};
for (const l of all) { const p = l.split('|'); if (p[1] === 'player' && new RegExp(ACCOUNT, 'i').test(p[3] || '')) me = p[2]; if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
if (!me || !sheets.p1 || !sheets.p2) throw new Error('no player line or no open sheets');
const id = path.basename(LOG).replace(/\.log$/, '').replace(/^battle-/, '');
const row = parseGame({ id, log: lines.join('\n') });
const st = row.turns[row.turns.length - 1].state;
const side = st.sides[me];

/* the synthesised request */
function synthRequest() {
  const sheet = sheets[me];
  const act = side.active || [];
  /* the bodies the log has shown (a brought body never shown is not in this request: stated in the header) */
  const brought = side.mons.filter(m => m && m.seen).map(m => m.i);
  const order = act.filter(i => i != null).concat(brought.filter(i => !act.includes(i)));
  const megaUsed = !!side.mega_used;
  const pokemon = order.map((i, j) => {
    const r = sheet[i], pub = side.mons[i] || {};
    const b = T.buildBody(M, r);
    const max = b.st.hp;
    const cond = pub.fnt ? '0 fnt' : `${pub.seen ? Math.max(1, Math.round((pub.hp / (pub.max || 100)) * max)) : max}/${max}${pub.status ? ' ' + pub.status : ''}`;
    return { ident: me + (j < 2 ? 'ab'[j] : 'a') + ': ' + r.nick, details: (pub.seen && pub.species ? pub.species : r.species) + ', L50', condition: cond, active: j < act.length && act[j] != null,
             item: pub.seen ? (pub.item === undefined ? r.item : (pub.item || '')) : r.item, ability: pub.seen && pub.ability ? pub.ability : r.ability, moves: r.moves.map(toID) };
  });
  const active = act.map((i, j) => {
    if (i == null) return null;
    const r = sheet[i];
    const it = X.D.items.get(toID(r.item));
    const canMega = !megaUsed && !!(it && it.exists && it.megaStone) && !/-mega/i.test(String((side.mons[i] || {}).species || ''));
    return { moves: r.moves.map(m => { const mv = X.D.moves.get(toID(m)); return { move: mv.name, id: mv.id, target: mv.target, disabled: false, pp: 8, maxpp: 8 }; }), canMegaEvo: canMega };
  });
  return { active, side: { id: me, pokemon } };
}
const req = synthRequest();

const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const WB = require('../rotom/world.js').create(API);
const PAmod = require('../miltank/prior_adapter.js');
const MAGI = require('../mag/infer.js');
const PA = PAmod.create(API, MAGI.load({ mag: path.join(ROOT, 'solver/mag/model/mag-v1.json'), doduo: path.join(ROOT, 'solver/mag/model/doduo-v1.json') }));
const tables = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/rotom/tables.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
const scratch = path.join(ROOT, 'solver', 'out', 'dp-replay');
fs.mkdirSync(scratch, { recursive: true });
const ARMS = {
  ungated: base,
  dp: Object.assign({}, base, { name: 'gen5-dp', gates: { doubleProtect: true, tiers: false } }),
  'dp-noterr': Object.assign({}, base, { name: 'gen5-dp-noterr', gates: { doubleProtect: { exemptOff: ['terrain'] }, tiers: false } }),
};
const out = { log: path.relative(ROOT, LOG).split(path.sep).join('/'), turn: TURN, me, release: ENGINE.stamp && ENGINE.stamp.engine_release, passes: PASSES, seeds: SEEDS,
  request_synthesised: { active: req.active.map(a => a && { moves: a.moves.map(m => m.id), canMegaEvo: a.canMegaEvo }), pokemon: req.side.pokemon.map(p => p.ident + ' ' + p.condition) }, arms: {} };
/* ONE ARM PER PROCESS: ROTOM's read-only tap on MILTANK's table (policy.js installTap) is installed once per process and
 * reports to the first policy created, so each arm runs in its own child (--arm <name>) and the parent merges */
const ARM = flag('--arm', null);
if (!ARM) {
  const cp = require('child_process');
  for (const name of Object.keys(ARMS)) {
    const a = argv.filter((x, i) => x !== '--out' && argv[i - 1] !== '--out');
    const r = cp.spawnSync(process.execPath, [__filename, ...a, '--arm', name], { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.status !== 0) { console.error(r.stderr); throw new Error('arm ' + name + ' exited ' + r.status); }
    const res = JSON.parse(r.stdout.split('\n').find(l => l.startsWith('{"arm"')));
    out.arms[name] = res.result;
    console.log('\n== ' + name);
    for (const x of res.result.runs) console.log('  choice ' + x.choice + '   value ' + x.value + '   passes ' + x.passes + '\n   rows ' + JSON.stringify(x.rows) + '\n   mix  ' + JSON.stringify(x.mix));
    if (res.result.runs[0]) console.log('   cols ' + JSON.stringify(res.result.runs[0].cols));
    if (res.result.stall) console.log('  stall reasons ' + JSON.stringify(res.result.stall.reasons) + '  detail ' + JSON.stringify(res.result.stall.detail));
    if (res.result.gate) console.log('  gate ' + JSON.stringify(res.result.gate));
  }
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('\nwrote ' + OUT); }
  process.exit(0);
}
for (const [name, spec] of Object.entries(ARMS).filter(([n]) => n === ARM)) {
  const specFile = path.join(scratch, name + '.json');
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 1));
  const P = require('../rotom/policy.js').create({ API, PA, R, tables, gen5Spec: specFile });
  const runs = [];
  for (let s = 0; s < SEEDS; s++) {
    const w = WB.build({ row, sheets, me, req, oppGuess: null, lines });
    const d = { req, world: w, coin: M.rngStreams({ seed: 4000 + s }).any, budgetMs: 600000, xatuBack: null, onPass: vs => vs.length >= PASSES };
    const r = P.move('miltank-gen5', d);
    const t = r.info.table || {};
    runs.push({ choice: r.choice, rows: t.rows, cols: t.cols, mix: t.mix, value: t.value, A: t.A, passes: r.info.passes });
  }
  const g = P.gen5();
  const gc = g.A && g.A.PA && g.A.PA.gateCounters;
  let stall = null;
  if (spec.gates) {
    const DP = require('../doduo/double_protect.js').create(API, spec.gates.doubleProtect === true ? {} : spec.gates.doubleProtect);
    const w = WB.build({ row, sheets, me, req, oppGuess: null, lines });
    stall = DP.stall(w.S, w.side, w.ctx);
  }
  console.log(JSON.stringify({ arm: name, result: { runs, gate: gc ? gc.doubleProtect || null : null, stall } }));
}
