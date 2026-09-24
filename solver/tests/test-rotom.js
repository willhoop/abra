/* solver/tests/test-rotom.js — ROTOM v0, the live client (solver/rotom/), without a server.
 *
 *   node solver/tests/test-rotom.js        exit 0 GREEN, 1 RED
 *
 *   CLOCK    the Time-left line parses; the budget is min(turn − margin, (bank − reserve)/E[rem]) with E[rem] read
 *            from tables.json; a low bank drops under the search floor; the rule is read from the checkout
 *            (420 / 90 / 55 / 90, no increment); tick and rejoin lines for MY name update the turn time, other
 *            names do not; with no server line the rule bounds the turn.
 *   REQUEST  on real requests captured from the local server (solver/tests/fixtures/rotom/): every joint the
 *            request module enumerates is legal, and the illegal shapes are refused — a disabled move, an
 *            out-of-range move, two switches to one body, two megas, a target the move cannot take, a mega the
 *            request does not offer, a switch while forced to pass; the heuristic is always legal; preview
 *            strings are checked for length, range and repeats.
 *   WORLD    the MEDICHAM position built from the captured log + request: my HP and max HP are the request's
 *            exactly, my actives are the request's, the opponent's revealed bodies are the log's, and MEDICHAM's
 *            joints that the request allows are non-empty.
 *   POLICY   prior, miltank (a short budget) and random each return a request-legal choice on a move request;
 *            prior, miltank and random on a forced switch; preview (prior and the search) returns four
 *            distinct positions.
 *   LOCK     a second client on the same lock is refused while the holder is alive; a dead holder's lock is
 *            taken over and reported; a public server has ONE machine-wide lock whatever the account; the
 *            password is read from the env var and reported by SOURCE only.
 *   GUARD    rotom.js refuses a non-local server (exit 2) before it takes a lock or connects.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
require('../arena/env.js');

let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };
const FIX = path.join(__dirname, 'fixtures', 'rotom');
const fx = n => JSON.parse(fs.readFileSync(path.join(FIX, n + '.json'), 'utf8'));

/* ---------------- CLOCK ---------------- */
const C = require('../rotom/clock.js');
{
  const r = C.readRule('gen9championsvgc2026regmcbo3');
  ok('CLOCK', r.starting === 420 && r.grace === 90 && r.maxPerTurn === 55 && r.maxFirstTurn === 90 && !r.addPerTurn, 'rule read from the checkout: ' + JSON.stringify(r));
  ok('CLOCK', /ruleTable/.test(r.source), 'rule source ' + r.source);
  const x = C.parseInactive('|inactive|Time left: 55 sec this turn | 420 sec total | 90 sec grace');
  ok('CLOCK', x && x.turnLeft === 55 && x.total === 420 && x.grace === 90, 'parse ' + JSON.stringify(x));
  const tab = C.loadTable();
  const k = new C.Clock({ rule: r, marginS: 8, reserveS: 30 });
  k.onInactive('|inactive|Time left: 55 sec this turn | 420 sec total | 90 sec grace', 1000);
  let b = k.budget({ kind: 'move', turn: 1, receivedAt: 1000, now: 1000 });
  const want = Math.floor(Math.min(55 - 8, (510 - 30) / tab.eRem(1)) * 1000);
  ok('CLOCK', b.ms === want && b.from === 'server', 'turn 1 full bank: ' + b.ms + ' want ' + want);
  k.onInactive('|inactive|Time left: 55 sec this turn | 60 sec total', 5000);
  b = k.budget({ kind: 'move', turn: 6, receivedAt: 5000, now: 5000 });
  const want2 = Math.floor(Math.min(47, (60 - 30) / tab.eRem(6)) * 1000);
  ok('CLOCK', b.ms === want2 && b.ms < 47000, 'turn 6 low bank: ' + b.ms + ' want ' + want2);
  k.onInactive('|inactive|Time left: 31 sec this turn | 31 sec total', 9000);
  b = k.budget({ kind: 'move', turn: 9, receivedAt: 9000, now: 9000 });
  ok('CLOCK', b.lowBank && b.ms < 400, 'bank 31 s is under the search floor: ' + JSON.stringify(b));
  b = k.budget({ kind: 'move', turn: 9, receivedAt: 9000, now: 12000 });
  ok('CLOCK', b.turnLeft <= 31.01, 'elapsed time is charged: ' + b.turnLeft);
  const k2 = new C.Clock({ rule: r });
  ok('CLOCK', !k2.onInactive('|inactive|someoneelse has 20 seconds left.', 0, 'rotomA'), 'another player\'s tick is not mine');
  ok('CLOCK', k2.onInactive('|inactive|rotomA reconnected and has 25 seconds left.', 0, 'rotomA') && k2.last.turnLeft === 25, 'my rejoin line sets the turn time');
  ok('CLOCK', k2.onInactive('|inactive|rotomA has 20 seconds left.', 10, 'rotomA') && k2.last.turnLeft === 20, 'my tick line sets the turn time');
  const k3 = new C.Clock({ rule: r, marginS: 8 });
  b = k3.budget({ kind: 'preview', receivedAt: 0, now: 0 });
  ok('CLOCK', b.from === 'rule' && b.byTurn === 90 - 8, 'no server line: the preview cap bounds it: ' + JSON.stringify(b));
  const k4 = new C.Clock({ rule: r, maxMs: 1500 });
  k4.onInactive('|inactive|Time left: 55 sec this turn | 420 sec total | 90 sec grace', 0);
  ok('CLOCK', k4.budget({ kind: 'move', turn: 1, receivedAt: 0, now: 0 }).ms === 1500, 'the operator cap applies');
}

/* ---------------- REQUEST ---------------- */
const RQ = require('../rotom/request.js');
const moveFx = ['move-mega-disabled', 'move-disabled'].map(fx), forceFx = ['force-a', 'force-b'].map(fx), prevFx = fx('preview');
for (const f of moveFx.concat(forceFx)) {
  const req = f.req;
  const J = RQ.joints(req);
  ok('REQUEST', J.length > 0, 'no joints for ' + JSON.stringify(req).slice(0, 80));
  ok('REQUEST', J.every(j => RQ.isLegal(req, RQ.joinChoice(j))), 'an enumerated joint is not legal');
  const h = RQ.heuristic(req);
  ok('REQUEST', h && RQ.isLegal(req, h), 'heuristic ' + h);
  if (req.active) {
    req.active.forEach((a, i) => {
      a.moves.forEach((m, k) => {
        if (!m.disabled) return;
        const bad = J.find(j => j[i].kind === 'move' && j[i].idx === k + 1);
        ok('REQUEST', !bad, 'a disabled move is offered: ' + m.id);
      });
      const other = RQ.options(req)[1 - i].options[0];
      ok('REQUEST', !RQ.isLegal(req, (i === 0 ? ['move 9', other.choice] : [RQ.options(req)[0].options[0].choice, 'move 9']).join(', ')), 'move 9 accepted');
      if (!a.canMegaEvo) ok('REQUEST', !J.some(j => j[i].mega), 'mega offered without canMegaEvo');
    });
    const sw = RQ.options(req)[0].options.find(o => o.kind === 'switch');
    if (sw) ok('REQUEST', !RQ.isLegal(req, sw.choice + ', ' + sw.choice), 'two switches to one body accepted');
    const megas = RQ.options(req).map(s => s.options.find(o => o.mega));
    if (megas[0] && megas[1]) ok('REQUEST', !RQ.isLegal(req, megas[0].choice + ', ' + megas[1].choice), 'two megas accepted');
    /* a target the move cannot take: a spread / self move given a target, or a single-target move aimed at itself */
    const s0 = RQ.options(req)[0].options.find(o => o.kind === 'move' && o.target === 1);
    if (s0) ok('REQUEST', !RQ.isLegal(req, 'move ' + s0.idx + ' -1, ' + RQ.options(req)[1].options[0].choice) || req.active[0].moves[s0.idx - 1].target === 'any', 'a move aimed at its own user accepted');
  }
  if (req.forceSwitch) {
    const i = req.forceSwitch.indexOf(false);
    if (i >= 0) ok('REQUEST', J.every(j => j[i].kind === 'pass'), 'an unforced slot does something during a forced switch');
    ok('REQUEST', !RQ.isLegal(req, 'pass, pass') || !J.some(j => j.some(o => o.kind === 'switch')), 'pass, pass accepted while a switch is possible');
  }
}
{
  /* both slots forced, ONE body left on the bench (this shape reached `default` in a live drill run before the fix) */
  const f = JSON.parse(JSON.stringify(forceFx[0].req));
  f.forceSwitch = [true, true];
  const mons = f.side.pokemon;
  mons.forEach((p, j) => { if (j >= 2) p.condition = '0 fnt'; });
  mons[2].condition = '50/100';
  mons[0].condition = '0 fnt'; mons[1].condition = '0 fnt';
  const J = RQ.joints(f);
  ok('REQUEST', J.length === 2 && J.every(j => j.filter(o => o.kind === 'switch').length === 1), 'two forced, one bench: ' + J.map(RQ.joinChoice).join(' | '));
  ok('REQUEST', RQ.isLegal(f, 'switch 3, pass') && RQ.isLegal(f, 'pass, switch 3') && !RQ.isLegal(f, 'pass, pass'), 'two forced, one bench: legality');
  ok('REQUEST', RQ.isLegal(f, RQ.heuristic(f)), 'two forced, one bench: heuristic');
}
{
  const r = prevFx.req;
  ok('REQUEST', r.teamPreview && RQ.isLegal(r, 'team 1234') && RQ.isLegal(r, 'team 6512'), 'preview strings refused');
  ok('REQUEST', !RQ.isLegal(r, 'team 1123') && !RQ.isLegal(r, 'team 123') && !RQ.isLegal(r, 'team 1237') && !RQ.isLegal(r, 'team 12345'), 'a bad preview string accepted');
}

/* ---------------- WORLD + POLICY ---------------- */
const API = require('../../engine/medicham_api.js');
const T = require('../arena/teams.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../mag/infer.js').load());
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const WB = require('../rotom/world.js').create(API);
const P = require('../rotom/policy.js').create({ API, PA, R, tables: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rotom', 'tables.json'), 'utf8')) });
const { parseGame } = require('../human/parse_game.js');
const coin = API.M.rngStreams({ seed: 11 }).any;
function worldOf(f, kind) {
  const lines = kind === 'switch' ? f.lines.concat(['|turn|' + (f.turn + 1)]) : f.lines;
  let row; try { row = parseGame({ id: 'fx', log: lines.join('\n') }); } catch (e) { row = parseGame({ id: 'fx', log: f.lines.join('\n') }); }
  return WB.build({ row, sheets: f.sheets, me: f.me, req: f.req, oppGuess: null });
}
for (const f of moveFx) {
  const w = worldOf(f, 'move');
  const act = w.side === 'A' ? w.S.actA : w.S.actB;
  f.req.side.pokemon.forEach((p, j) => {
    const c = WB.parseCond(p.condition);
    const b = w.mine[j].b;
    ok('WORLD', c.fnt ? b.fainted : (b.curHP === c.hp && b.st.hp === c.max), 'my ' + p.ident + ' HP ' + b.curHP + '/' + b.st.hp + ' vs request ' + p.condition);
    if (p.active && j < 2) ok('WORLD', act[j] === b, 'my active ' + p.ident + ' is not in slot ' + j);
  });
  const os = w.theirs.filter(x => x.pub && x.pub.seen);
  ok('WORLD', os.length >= 2, 'opponent revealed bodies ' + os.length);
  const { keep } = P.filteredLegal(w, f.req);
  ok('WORLD', keep.length > 0, 'no MEDICHAM joint maps onto the request');
  for (const name of ['prior', 'miltank', 'random']) {
    const r = P.move(name, { req: f.req, world: w, coin, budgetMs: 300, xatuBack: null });
    ok('POLICY', r.choice && RQ.isLegal(f.req, r.choice), name + ' move choice ' + (r && r.choice));
  }
}
for (const f of forceFx) {
  const w = worldOf(f, 'switch');
  for (const name of ['prior', 'miltank', 'random']) {
    const r = P.forceSwitch(name, { req: f.req, world: w, coin, budgetMs: 400, xatuBack: null });
    ok('POLICY', r.choice && RQ.isLegal(f.req, r.choice), name + ' forced-switch choice ' + (r && r.choice));
  }
}
{
  const f = prevFx;
  const d = { req: f.req, coin, sheets: f.sheets, me: f.me, budgetMs: 800, teamBring: [0, 1, 2, 3], series: { oppLast: { brought: [0, 1, 2, 3], leads: [0, 1], won: true } } };
  const p = P.preview('prior', d);
  ok('POLICY', p.order.length === 4 && new Set(p.order).size === 4, 'prior preview ' + p.order);
  const q = P.previewSearch(d, [0, 1, 2, 3]);
  ok('POLICY', q.order.length === 4 && new Set(q.order).size === 4 && q.order.every(x => x >= 1 && x <= 6), 'preview search ' + JSON.stringify(q.order));
  ok('POLICY', P.COUNTERS.previewPlayouts > 0 && q.info.oppModel === 'series carry-over', 'preview search played nothing / ignored the series: ' + JSON.stringify(q.info));
}

/* ---------------- LOCK ---------------- */
const L = require('../rotom/lock.js');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-lock-'));
  process.env.ROTOM_LOCK_DIR = dir;
  const srv = 'ws://localhost:8765/showdown/websocket';
  const p = L.lockPath(srv, 'rotomX');
  fs.writeFileSync(p, JSON.stringify({ pid: process.ppid || process.pid, name: 'rotomX', server: srv, started: 'x' }));
  let threw = null; try { L.acquire(srv, 'rotomX'); } catch (e) { threw = e; }
  ok('LOCK', threw && threw.code === 'LOCK_HELD', 'a live holder did not refuse: ' + (threw && threw.message));
  fs.writeFileSync(p, JSON.stringify({ pid: 2147480000, name: 'rotomX', server: srv, started: 'x' }));
  const msgs = [];
  const h = L.acquire(srv, 'rotomX', m => msgs.push(m));
  ok('LOCK', h.tookOverStale && msgs.some(m => /stale/.test(m)), 'a dead holder was not taken over and reported');
  h.release();
  ok('LOCK', !fs.existsSync(p), 'release left the lock');
  ok('LOCK', L.lockPath('wss://sim3.psim.us/showdown/websocket', 'a') === L.lockPath('wss://sim3.psim.us/showdown/websocket', 'b'), 'public lock is per-account');
  ok('LOCK', L.lockPath(srv, 'a') !== L.lockPath(srv, 'b'), 'local lock is not per-account');
  /* another live process (this test's parent) holds the public lock under a DIFFERENT account */
  const pub = 'wss://sim3.psim.us/showdown/websocket';
  fs.writeFileSync(L.lockPath(pub, 'first'), JSON.stringify({ pid: process.ppid || process.pid, name: 'first', server: pub, started: 'x' }));
  let t2 = null; try { L.acquire(pub, 'second'); } catch (e) { t2 = e; }
  ok('LOCK', t2 && t2.code === 'LOCK_HELD', 'a second public client was not refused');
  fs.unlinkSync(L.lockPath(pub, 'first'));
  process.env.SHOWDOWN_PASS = 'not-a-real-password';
  const c = L.readPassword();
  ok('LOCK', c.source === 'env' && c.pass === 'not-a-real-password', 'env password not read');
  delete process.env.SHOWDOWN_PASS;
  fs.rmSync(dir, { recursive: true, force: true });
}

/* ---------------- GUARD ---------------- */
{
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'rotom', 'rotom.js'), '--server', 'wss://sim3.psim.us/showdown/websocket', '--name', 'guardtest'], { encoding: 'utf8', timeout: 60000 });
  ok('GUARD', r.status === 2 && /local-only/.test(r.stderr), 'non-local server not refused: status ' + r.status + ' ' + (r.stderr || '').slice(0, 200));
  ok('GUARD', !/password|SHOWDOWN_PASS=/.test(r.stdout || ''), 'output mentions a password');
}

console.log((fails ? 'RED' : 'GREEN') + ' test-rotom: ' + (checks - fails) + '/' + checks);
process.exit(fails ? 1 : 0);
