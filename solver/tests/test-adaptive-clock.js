/* solver/tests/test-adaptive-clock.js — ROTOM's adaptive per-decision budget (solver/rotom/adaptive.js) can never run the
 * VGC clock out, spends little on a clear table and more on a close one, and is wired through MILTANK.
 *
 *   node solver/tests/test-adaptive-clock.js [--no-red] [--no-arena] [--release <id>]    exit 0 GREEN, 1 RED, 2 CANNOT ANSWER
 *
 *   RULE     the clock rule is read from the checkout (clock.js readRule), not the fallback constants.
 *   BANK     4,000 SIMULATED SLOW GAMES (2,000 per timer model, see simulateGame) against the server's own timer model (pokemon-showdown-mc server/room-battle.ts:
 *            a 5 s tick restarting at each request, the bank = starting + grace, the turn = min(bank, 55), Timeout Auto
 *            Choose when the turn runs out, a loss when the bank does). Every game is long (40-80 requests), and every
 *            searched decision is as slow as the client allows: the stop rule never fires (a CLOSE table every time),
 *            the fill runs to `hard`, then MILTANK's worst measured overrun (+500 ms), the send gap (+650 ms) and up to
 *            3 s of between-decision GC before the plan is made. The tick phase is drawn uniformly, which charges at
 *            least as much as the real server. Required: ZERO bank-outs and ZERO turn timeouts.
 *   CREDIT   the mean spent per searched decision in a game is at most target + credit0/n when every table is close, and
 *            under the target when every table is clear.
 *   STOP     on synthetic per-pass tables: a dominant row stops CLEAR once minMs and minPasses have passed; two rows equal
 *            within noise are CLOSE and never stop before the hard line; a row ahead by less than the clear bar stops at
 *            the SOFT line.
 *   ARENA    (skipped with --no-arena) one honest arena game, gen5 with `adaptive` against DODUO-greedy, on the frozen
 *            release: every searched decision carries info.adapt, returns within hard + 500 ms, and the counters moved.
 *
 * RED, unless --no-red: ROTOM_CLOCK_BREAK=nocap (the safety line ignored) must turn BANK red, and ROTOM_CLOCK_BREAK=nostop
 * (the clear stop never fires) must turn STOP red. Both are run as child processes, since the break is read at load.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red') || argv.includes('--child');
const NO_ARENA = argv.includes('--no-arena') || argv.includes('--child');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const REL = process.env.ARENA_TEST_RELEASE || (argv.includes('--release') ? argv[argv.indexOf('--release') + 1] : 'eaa5becc54eb');
const want = c => !ONLY || ONLY.includes(c);

const AD = require('../rotom/adaptive.js');
const CLOCK = require('../rotom/clock.js');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails < 40) console.log('  FAIL [' + clause + '] ' + msg); } };

/* a seeded uniform */
function rng(a) { a >>>= 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32

const RULE = CLOCK.readRule();
const TABLE = CLOCK.loadTable();

/* ---- RULE ---- */
if (want('RULE')) {
  ok('RULE', /ruleTable of/.test(RULE.source), 'the clock rule came from ' + RULE.source);
  ok('RULE', RULE.starting > 0 && RULE.maxPerTurn > 0, 'rule ' + JSON.stringify(RULE));
  ok('RULE', RULE.addPerTurn === 0, 'Timer Add Per Turn is ' + RULE.addPerTurn + '; the simulation below assumes the checkout\'s 0');
}

/* ---- the server's timer, per request (room-battle.ts nextRequest / nextTick, TICK_TIME 5 s) ---- */
const TICK = 5;
/* model 'server': the tick restarts at our request (nextRequest clears the timer and sets a new 5 s timeout), so a
 * decision of t seconds costs 5 * floor((t + rtt) / 5), rtt = the round trip, drawn in [0, 0.5] s. Model 'harsh': the
 * tick phase is uniform in [0, 5) s, as if the timer had been reset up to 5 s BEFORE our request — more than the server
 * ever charges (every fast answer can cost a tick). */
function simulateGame(seed, cfg, model, lenLo, lenHi) {
  const u = rng(seed);
  const A = AD.create(cfg);
  A.newGame();
  let bank = RULE.starting + RULE.grace;          // secondsLeft
  const nReq = lenLo + Math.floor(u() * (lenHi - lenLo + 1));
  let turn = 1, minBank = bank, timeouts = 0, bankOut = false, searched = 0, spentMs = 0, lowBank = 0, maxSpent = 0;
  for (let r = 0; r < nReq; r++) {
    const first = r === 0;
    const turnLeft = Math.min(bank, first ? RULE.maxFirstTurn : RULE.maxPerTurn);
    const kind = first ? 'preview' : (u() < 0.15 ? 'switch' : 'move');
    const gc = u() < 0.5 ? u() * 3 : 0;              // a between-decision GC still running when the request lands
    let t;                                            // seconds from the request to the choice
    if (kind === 'preview') t = gc + 2 + u() * 3;     // the preview is not planned by this module; a slow preview anyway
    else {
      const p = A.plan({ kind, bankS: bank - gc, turnLeftS: turnLeft - gc, eRem: TABLE.eRem(turn), eRemHi: TABLE.eRemHi(turn) });
      if (p.lowBank) { lowBank++; t = gc + 0.2 + u() * 1.0 + 0.65; A.spent(t * 1000, false, null); }
      else {
        t = gc + p.hardMs / 1000 + 0.5 * u() + 0.65; // the fill ran to hard, MILTANK's overrun, the send gap
        searched++; spentMs += t * 1000; maxSpent = Math.max(maxSpent, t);
        A.spent(t * 1000, true, { kind, stop: 'hard' });
      }
    }
    const phase = model === 'harsh' ? u() * TICK : u() * 0.5;
    const ticks = Math.floor((t + phase) / TICK);
    if (TICK * ticks >= turnLeft) timeouts++;          // the turn ran out first: Timeout Auto Choose
    bank -= TICK * Math.min(ticks, Math.ceil(turnLeft / TICK));
    if (bank <= 0) { bankOut = true; break; }
    minBank = Math.min(minBank, bank);
    if (kind !== 'switch') turn++;
  }
  return { minBank, timeouts, bankOut, searched, spentMs, lowBank, maxSpent, nReq };
}

if (want('BANK')) {
  /* the store's longest games: the request table's last row is turn 17 (tables.json); 40-80 requests is past all of them */
  const arms = [
    { name: 'server 40-80 requests', model: 'server', lo: 40, hi: 80 },
    { name: 'harsh 10-30 requests', model: 'harsh', lo: 10, hi: 30 },
  ];
  const agg = { outs: 0, tos: 0, minB: Infinity };
  for (const a of arms) {
    let outs = 0, tos = 0, minB = Infinity, low = 0, maxT = 0, games = 0, dec = 0;
    for (let g = 0; g < 2000; g++) {
      const cfg = g % 2 ? { targetMs: 5000 } : { targetMs: 15000, stretch: 3 };   // half of them with a greedy target
      const r = simulateGame(1000 + g, cfg, a.model, a.lo, a.hi);
      games++; dec += r.searched;
      if (r.bankOut) outs++;
      tos += r.timeouts; low += r.lowBank; minB = Math.min(minB, r.minBank); maxT = Math.max(maxT, r.maxSpent);
    }
    console.log('  BANK [' + a.name + ']: ' + games + ' simulated slow games, ' + dec + ' searched decisions, bank-outs ' + outs + ', turn timeouts ' + tos +
                ', lowest bank ' + minB.toFixed(0) + ' s, low-bank prior answers ' + low + ', slowest decision ' + maxT.toFixed(1) + ' s' + (AD.BREAK ? '  [BREAK ' + AD.BREAK + ']' : ''));
    ok('BANK', outs === 0, a.name + ': ' + outs + ' simulated games ran the bank out');
    ok('BANK', tos === 0, a.name + ': ' + tos + ' turn timeouts');
    ok('BANK', low > 0, a.name + ': the low-bank prior answer never fired, so the safety line was never reached');
    agg.outs += outs; agg.tos += tos; agg.minB = Math.min(agg.minB, minB);
  }
  if (argv.includes('--child')) console.log('CHILD ' + JSON.stringify(agg));
}

if (want('CREDIT')) {
  for (const target of [1000, 5000]) {
    const A = AD.create({ targetMs: target }); A.newGame();
    let s = 0, n = 0;
    for (let i = 0; i < 12; i++) { const p = A.plan({ kind: 'move', bankS: 510, turnLeftS: 55, eRem: 8, eRemHi: 12 }); s += p.hardMs; n++; A.spent(p.hardMs, true, { kind: 'move', stop: 'hard' }); }
    ok('CREDIT', s / n <= target + target / n + 1, 'all-close game at target ' + target + ': mean ' + (s / n).toFixed(0) + ' > target + credit0/n');
    const B = AD.create({ targetMs: target }); B.newGame();
    let s2 = 0;
    for (let i = 0; i < 12; i++) { const p = B.plan({ kind: 'move', bankS: 510, turnLeftS: 55, eRem: 8, eRemHi: 12 }); const spent = Math.min(p.hardMs, 0.3 * target); s2 += spent; B.spent(spent, true, { kind: 'move', stop: 'clear' }); }
    ok('CREDIT', s2 / 12 < target, 'all-clear game mean ' + (s2 / 12).toFixed(0) + ' not under the target');
    const pl = B.plan({ kind: 'move', bankS: 510, turnLeftS: 55, eRem: 8, eRemHi: 12 });
    ok('CREDIT', pl.hardMs > target, 'after clear decisions the credit did not let a close one run past the target: hard ' + pl.hardMs);
  }
}

/* ---- STOP: synthetic tables ---- */
function passes(m, n, P, mean, sd, seed) {
  const u = rng(seed), g = () => { let z = 0; for (let k = 0; k < 6; k++) z += u(); return (z - 3) / Math.sqrt(0.5); };
  const vs = [];
  for (let q = 0; q < P; q++) { const shared = sd * g(); const v = new Float64Array(m * n); for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) v[i * n + j] = mean(i, j) + shared + 0.3 * sd * g(); vs.push(v); }
  return vs;
}
if (want('STOP')) {
  const A = AD.create({ targetMs: 5000 });
  const job = { rows: [0, 1, 2, 3], cols: [0, 1, 2, 3] };
  const plan = { hardMs: 10000, softMs: 5000 };
  /* a dominant row: row 0 is 0.2 ahead in every column */
  { const rec = {}; const f = A.stopper(plan, rec); const vs = passes(4, 4, 6, (i, j) => (i === 0 ? 0.7 : 0.5) + 0.01 * j, 0.1, 1);
    ok('STOP', f(vs, job, Date.now() - 1000) === true && rec.stop === 'clear', 'a dominant row did not stop CLEAR (stop ' + rec.stop + ', state ' + rec.state + ')');
    const rec2 = {}; const f2 = A.stopper(plan, rec2);
    ok('STOP', f2(vs, job, Date.now() - 100) === false, 'a clear table stopped before minMs');
    const rec3 = {}; const f3 = A.stopper(plan, rec3);
    ok('STOP', f3(vs.slice(0, 2), job, Date.now() - 1000) === false, 'a clear table stopped before minPasses'); }
  /* two rows equal within noise: CLOSE — no stop at 6 s (past soft), stop is the hard deadline's */
  { const rec = {}; const f = A.stopper(plan, rec); const vs = passes(4, 4, 30, (i, j) => (i < 2 ? 0.6 : 0.4), 0.1, 11);
    ok('STOP', f(vs, job, Date.now() - 6000) === false && rec.state === 'close', 'a close table stopped past soft (state ' + rec.state + ', stop ' + rec.stop + ')'); }
  /* a row ahead by a margin inside the clear bar but outside the close band: OPEN — stops at soft, not before */
  { const vs = passes(4, 4, 12, (i, j) => (i === 0 ? 0.53 : 0.5), 0.1, 3);
    const s = AD.assess(vs, 4, 4);
    if (s.state === 'open') {
      const rec = {}; const f = A.stopper(plan, rec);
      ok('STOP', f(vs, job, Date.now() - 2000) === false, 'an open table stopped at 2 s');
      const rec2 = {}; const f2 = A.stopper(plan, rec2);
      ok('STOP', f2(vs, job, Date.now() - 4900) === true && rec2.stop === 'soft', 'an open table did not stop at the soft line (' + rec2.stop + ')');
    } else ok('STOP', false, 'the open fixture assessed as ' + s.state + ' (t ' + s.minT.toFixed(2) + '): fixture, not rule');
  }
  /* a single candidate row: nothing to compare; stops at soft */
  { const rec = {}; const f = A.stopper(plan, rec); const vs = passes(1, 4, 5, () => 0.5, 0.1, 3);
    ok('STOP', f(vs, { rows: [0], cols: [0, 1, 2, 3] }, Date.now() - 4900) === true, 'a one-row table did not stop at soft'); }
  if (argv.includes('--child')) console.log('CHILD-STOP ' + [...failed].join(','));
}

/* ---- RED: the breaks, in child processes ---- */
if (!NO_RED) {
  const run = (brk, only) => {
    const r = cp.spawnSync(process.execPath, [__filename, '--child', '--only', only], { cwd: ROOT, env: Object.assign({}, process.env, { ROTOM_CLOCK_BREAK: brk }), encoding: 'utf8', timeout: 600000 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  if (want('BANK')) {
    const r = run('nocap', 'BANK');
    const m = /CHILD (\{.*\})/.exec(r.out); const j = m ? JSON.parse(m[1]) : null;
    ok('RED', r.code === 1 && j && j.outs > 0, 'ROTOM_CLOCK_BREAK=nocap did not run a simulated bank out (exit ' + r.code + ', ' + (m ? m[1] : r.out.slice(-300)) + ')');
    if (j) console.log('  RED ROTOM_CLOCK_BREAK=nocap -> BANK: ' + j.outs + ' bank-outs, ' + j.tos + ' turn timeouts (fails as required)');
  }
  if (want('STOP')) {
    const r = run('nostop', 'STOP');
    ok('RED', r.code === 1 && /CHILD-STOP .*STOP/.test(r.out), 'ROTOM_CLOCK_BREAK=nostop did not turn STOP red (exit ' + r.code + ')');
    if (r.code === 1) console.log('  RED ROTOM_CLOCK_BREAK=nostop -> STOP fails as required');
  }
}

/* ---- ARENA: one honest game through the real MILTANK ---- */
(async () => {
  if (!NO_ARENA && want('ARENA')) {
    const STORE = path.join(ROOT, 'data', 'team-pool-frozen-regmc');
    if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL)) || !fs.existsSync(path.join(STORE, 'games.bo3.jsonl'))) { console.log('CANNOT ANSWER: release ' + REL + ' or the frozen pool is missing'); process.exit(2); }
    const E = require('../arena/engine.js').load(REL);
    const API = E.API, M = API.M;
    const T = require('../arena/teams.js');
    const P = require('../mew/pairs.js').load({ teamStore: STORE });
    const AG = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
    const PA0 = require('../miltank/prior_adapter.js').create(API, null);
    const XW = AG.XW;
    const spec = Object.assign(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8')), { name: 'gen5-adaptive-test', adaptive: { targetMs: 1500 } });
    const X = AG.load(spec), Y = AG.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
    const G = require('../mew/pairs.js').pick(P.test, 1, 4242)[0];
    const seed = 4242;
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const truth = XW.truthSpreads(G.sheets, seed);
    for (const [p, t] of [['p1', a], ['p2', b]]) for (const m of t.team) XW.applySpread(m, truth[p][m._solverSheet], G.sheets[p][m._solverSheet]);
    const rngB = API.makeRng(seed);
    const S = API.newBattle(a.team, b.team, { rng: rngB });
    const H = XW.arenaGame(G, S, PA0), ctx = PA0.newGame(G);
    const bx = X.bot(11), by = Y.bot(12);
    let searched = 0, over = 0, noInfo = 0, stops = {};
    while (!API.isTerminal(S) && S.turn < 6) {
      const ch = {};
      for (const side of ['A', 'B']) {
        const hv = XW.arenaView(H, G, S, side, PA0);
        const t0 = Date.now();
        ch[side] = side === 'A' ? bx.choose(hv.V, side, ctx, hv.hb) : by.choose(hv.V, side, ctx, hv.hb);
        const ms = Date.now() - t0, info = ch[side].info || {};
        if (side === 'A' && !info.forced) {
          searched++;
          if (!info.adapt) noInfo++;
          else { stops[info.adapt.stop] = (stops[info.adapt.stop] || 0) + 1; if (ms > info.adapt.hard + 500) over++; }
        }
      }
      PA0.record(ctx, S, ch.A.joint, ch.B.joint);
      API.stepInPlace(S, ch.A.joint, ch.B.joint, rngB);
    }
    console.log('  ARENA: ' + searched + ' searched decisions, stops ' + JSON.stringify(stops) + ', over hard+500: ' + over + ', counters ' + JSON.stringify(AG.COUNTERS.adapt && { plans: AG.COUNTERS.adapt.plans, stops: AG.COUNTERS.adapt.stops, spent_ms: AG.COUNTERS.adapt.spent_ms }));
    ok('ARENA', searched > 0, 'no searched decision');
    ok('ARENA', noInfo === 0, noInfo + ' searched decisions carried no info.adapt');
    ok('ARENA', over === 0, over + ' decisions past hard + 500 ms');
    ok('ARENA', AG.COUNTERS.adapt && AG.COUNTERS.adapt.plans >= searched, 'the adaptive counters did not move');
    ok('ARENA', AG.COUNTERS.fallbacks === 0, AG.COUNTERS.fallbacks + ' search fallbacks (the search threw)');
  }
  console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + ' checks' + (failed.size ? '  failed: ' + [...failed].join(', ') : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
