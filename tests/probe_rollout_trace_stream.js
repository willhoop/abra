#!/usr/bin/env node
/* tests/probe_rollout_trace_stream.js — ROADMAP #310.
 * ==================================================================================================
 * DOES A ROLLOUT'S TRACE DRAW ITS TARGET FROM A STREAM, OR TAKE THE FIXED DEFAULT?
 *
 * `battleInit` accepts `opts.rng` and `game_differential.js` passes its arm's stream, so Trace samples
 * among eligible foes there. `engine/rollout_leaf.js` calls `MEDI.battleInit(A, Bt, { seeded })` with
 * NO rng (release 2b5a6585d8cf, rollout_leaf.js:1327 in rolloutWinProb and :1395 in
 * rolloutAfterActions), so every Trace inside a rollout finds no die in scope and counts
 * `MEDSEEN.traceChoiceNoDie` — loud by design, and the row's defect.
 *
 * THE REAL FUNCTION, ON THE FROZEN RELEASE. `rolloutWinProb` is called through its own
 * `opts.buildTeams` door (the team-preview road: no board, fresh bodies per sample), so the only thing
 * this file supplies is the two teams. No copy of the rollout.
 *
 *   RED ARM   a Trace lead (Gardevoir, a legal Trace carrier), item cleared so no mega is in play,
 *             against two foes whose abilities Trace may copy. traceChoiceNoDie must NOT move.
 *   CONTROL 1 the identical rollout with the lead's ability set to Synchronize (Gardevoir's slot 0):
 *             no Trace, so neither counter may move. A red here would mean the counter moves for a
 *             reason other than Trace.
 *   CONTROL 2 `battleInit(..., { rng: { seed } })` with the Trace lead, called directly: the SAME
 *             resolution with a stream in scope must count `traceChoiceDie` and not `...NoDie`. This is
 *             what proves the two counters separate the cases.
 *   PLANT     `battleInit(...)` directly with no rng: must count `...NoDie` — the defect by
 *             construction, with no rollout in the path. Once ENGINE hands rollouts a stream the RED
 *             ARM goes green and the PLANT stays red, which is the green-then-red demonstration.
 *
 *   PREVIEW, BATTLE, THE CALLERS (2026-09-24, ENGINE -- the row's residual): see the block above `const red`.
 *             `--plant-caller` adds an unseeded call site to the static scan, so that clause shows RED on
 *             demand.
 *
 * EXIT: 0 green / 1 red / 2 cannot answer. Plays a rollout of at most 3 turns per sample.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const path = require('path');
const ROOT = path.join(__dirname, '..');
/* EITHER REGULATION -- 2026-09-24 (MEASURE, abra/regmc). This line used to force SHOWDOWN_PATH to Reg M-B's
 * checkout, and the register runs this probe with `--release aefcb93baf14`, a release cut for Reg M-B's table.
 * Under `ABRA_REGULATION=regmc` both refused (engine_release.open: "cut for the damage table
 * data/engine-data.js ... this run selected regmc"), so the row read CANNOT-ANSWER in Reg M-C for a reason
 * that has nothing to do with Trace. The checkout now comes from engine/showdown_path.js, which resolves the
 * SELECTED regulation's authority (and still honours an explicit SHOWDOWN_PATH). A named release is honoured
 * when it serves the selected regulation; when it was cut for the OTHER regulation the probe measures that
 * regulation's CURRENT release instead and prints both ids -- a release is a photograph for one regulation,
 * and the question "does a rollout's Trace draw from a stream" is asked of whichever engine the regulation
 * runs. The cast (Gardevoir, Snorlax, Garchomp, Incineroar; Trace, Synchronize, Rough Skin, Intimidate) is
 * checked for legality against the selected format below, as before, so an M-C run that lost one refuses. */
const REGN = require(path.join(ROOT, 'engine', 'regulation.js'));
require(path.join(ROOT, 'engine', 'showdown_path.js'));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ASKED = arg('--release', '2b5a6585d8cf');
const N = +arg('--n', 3);
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };

let REL, M, RL, dex;
try {
  const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
  try { REL = ER.open(REL_ASKED); }
  catch (e) {
    if (!/was cut for the damage table/.test(String(e && e.message))) throw e;
    const cur = ER.currentId();
    if (!cur) throw new Error('release ' + REL_ASKED + ' was cut for the other regulation, and ' + REGN.ID + ' has no current release pointer');
    console.log('  release ' + REL_ASKED + ' was cut for the other regulation; measuring ' + REGN.ID + ' on its current release ' + cur);
    REL = ER.open(cur);
  }
  M = REL.require('engine/medicham2-browser.js', { want: ['buildMon', 'battleInit', 'battle', 'MEDSEEN'] });
  RL = REL.require('engine/rollout_leaf.js', { want: ['rolloutWinProb'] });
  const CS = REL.require('engine/champions_sim.js');
  dex = CS.sim().Dex.forFormat(CS.FORMAT);
} catch (e) { cannot('release ' + REL_ASKED + ' would not open: ' + String(e && e.message || e)); }
console.log('\ntests/probe_rollout_trace_stream.js — ROADMAP #310   regulation ' + REGN.ID + ' (' + REGN.FORMAT + ')   release ' + REL.id
  + '   authority ' + process.env.SHOWDOWN_PATH);

/* legality, derived: the lead's abilities and the foes' copyability come from the format */
const legal = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const GARD = dex.species.get('gardevoir');
const abIds = Object.values(GARD.abilities).map(a => dex.abilities.get(a).id);
if (!legal(GARD) || !abIds.includes('trace') || !abIds.includes('synchronize'))
  cannot('Gardevoir is not a legal carrier of both Trace and Synchronize in this format: ' + JSON.stringify(GARD.abilities));
for (const s of ['snorlax', 'garchomp', 'incineroar']) if (!legal(dex.species.get(s))) cannot(s + ' is not legal in this format');

const body = (sp, ab) => {
  const m = M.buildMon(sp, { [sp]: '' });                 /* item cleared: no stone, no mega road */
  if (!m) cannot('buildMon(' + sp + ') returned null');
  if (ab) { m.ability = ab; m.baseAbility = ab; }
  return m;
};
const teams = (leadAb) => () => ({ A: [body('gardevoir', leadAb), body('snorlax')], B: [body('garchomp'), body('incineroar')] });
const S0 = () => ({ die: M.MEDSEEN.traceChoiceDie | 0, noDie: M.MEDSEEN.traceChoiceNoDie | 0,
                    nothing: M.MEDSEEN.traceFoundNothing | 0, retry: M.MEDSEEN.traceRetryCopied | 0 });
const delta = (a, b) => ({ die: b.die - a.die, noDie: b.noDie - a.noDie, nothing: b.nothing - a.nothing, retry: b.retry - a.retry });
/* A SEEDED battleInit SKIPS THE LEAD ENTRY PASS (release medicham2-browser.js: `if(!(opts&&opts.seeded))`
 * guards the speed-sorted pass that calls traceCopy for a lead), because a seeded board is a position
 * already past its entry. The first form of this probe ran its direct controls SEEDED and read 0/0 on
 * both — the controls were asking a pass that never ran. The direct controls are therefore UNSEEDED, and
 * a rollout's Trace resolves on the retry sweep or a replacement's entry, so the rollout plays 3 turns. */
const foesCopyable = ['roughskin', 'intimidate'].every(a => {
  const f = (dex.abilities.get(a).flags || {}); return !f.notrace && !f.failroleplay; });
console.log('  foes carry Rough Skin and Intimidate; Trace may copy both (flags, derived): ' + foesCopyable);
if (!foesCopyable) cannot('a foe ability refuses Trace, so the lead has nothing to copy');

function rollout(leadAb, extra) {
  const a = S0();
  let r;
  try { r = RL.rolloutWinProb(null, 'p1', Object.assign({ n: N, buildTeams: teams(leadAb), maxTurns: 3, dex }, extra || {})); }
  catch (e) { cannot('rolloutWinProb threw on the ' + leadAb + ' arm: ' + String(e && e.message || e)); }
  if (!r || !r.n) cannot('rolloutWinProb ran no sample on the ' + leadAb + ' arm');
  return { d: delta(a, S0()), n: r.n };
}
function direct(leadAb, opts) {
  const a = S0(); const t = teams(leadAb)();
  try { M.battleInit(t.A, t.B, opts); } catch (e) { cannot('battleInit threw: ' + String(e && e.message || e)); }
  return delta(a, S0());
}

/* ---- THE RESIDUAL, 2026-09-24 (ENGINE) -------------------------------------------------------------
 * The row stayed open after the rollout half went green because of the CALLERS: every `battleInit` that
 * runs the lead entry pass with no `rng` takes `eligible[0]` for a lead Trace and draws no entry tie.
 * Two more cells close it, and both are asked of the frozen release, not of the tree:
 *
 *   PREVIEW   `rolloutWinProb(..., { seeded: false })` -- team preview, the one rollout road that DOES
 *             run the lead pass (engine/miltank.js). Its playout stream must reach `battleInit`.
 *   BATTLE    `battle(A, B, null, rng)`, MEDICHAM's own one-call game. Same question, same counters.
 *
 * And one STATIC clause, because a caller that never runs in a probe is still a caller: every
 * `battleInit(` in engine/*.js must hand it a stream (`rng`) or be a literal `seeded: true` (a seeded
 * board runs no lead pass, so it has no lead-in draw to make). Read off the WORKING TREE, not the
 * release -- the drivers (bench_speed.js, million_run.js, ...) are not release SOURCES -- and printed
 * site by site. A planted `battleInit(A, B, {})` must read UNSEEDED and a planted `{ rng }` must not,
 * or the clause cannot answer. */
const fsx = require('fs');
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (q) { out += c; if (c === '\\') { out += d || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const blk = src.slice(i, e < 0 ? src.length : e + 2);
      out += blk.replace(/[^\n]/g, ' '); i += blk.length; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '\'' || c === '"' || c === '`') q = c;
    out += c; i++;
  }
  return out;
}
function callSites(src) {
  const s = stripComments(src), out = [];
  const re = /(?<![\w$])battleInit\s*\(/g; let m;
  while ((m = re.exec(s))) {
    if (/function\s+$/.test(s.slice(Math.max(0, m.index - 12), m.index))) continue;   /* the definition */
    let depth = 0, j = m.index + m[0].length - 1, args = [], cur = '', k;
    for (k = j; k < s.length; k++) {
      const c = s[k];
      if ('([{'.includes(c)) { depth++; if (depth === 1) continue; }
      if (')]}'.includes(c)) { depth--; if (depth === 0) break; }
      if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    args.push(cur.trim());
    const opt = args[2] || '';
    const verdict = /(^|[{,\s])rng\s*[:,}]|(^|[{,\s])rng\s*$/.test(opt) ? 'STREAM'
                  : /(^|[{,\s])seeded\s*:\s*true\b/.test(opt) ? 'SEEDED-LITERAL' : 'UNSEEDED';
    out.push({ line: s.slice(0, m.index).split('\n').length, opt: opt || '(none)', verdict });
  }
  return out;
}
const planted = [callSites('M.battleInit(A, B, {});')[0], callSites('x.battleInit(A,\n  B, { trace, rng: { seed: 1 } })')[0],
                 callSites('/* battleInit(A,B,{}) */ M.battleInit(A, B, { seeded: true });')];
const scanOk = planted[0] && planted[0].verdict === 'UNSEEDED' && planted[1] && planted[1].verdict === 'STREAM'
  && planted[2].length === 1 && planted[2][0].verdict === 'SEEDED-LITERAL';
const SITES = [];
for (const f of fsx.readdirSync(path.join(ROOT, 'engine')).filter(f => f.endsWith('.js')).sort()) {
  const src = fsx.readFileSync(path.join(ROOT, 'engine', f), 'utf8');
  if (!src.includes('battleInit')) continue;
  for (const c of callSites(src)) SITES.push(Object.assign({ file: 'engine/' + f }, c));
}
/* `--plant-caller` adds an unseeded site to the scanned set, so the clause is shown RED on demand. */
if (process.argv.includes('--plant-caller')) SITES.push({ file: '(planted)', line: 0, opt: '{}', verdict: 'UNSEEDED' });

const red = rollout('trace');
const c1 = rollout('synchronize');
const c2 = direct('trace', { rng: { seed: 20260911 } });
const plant = direct('trace', {});
const preview = rollout('trace', { seeded: false });
const battleArm = (() => {
  if (typeof M.battle !== 'function') cannot('the release exports no battle()');
  const a = S0(); const t = teams('trace')(); let s = 20260924;
  const rng = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  try { M.battle(t.A, t.B, null, rng); } catch (e) { cannot('battle() threw: ' + String(e && e.message || e)); }
  return delta(a, S0());
})();

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const fmt = d => 'traceChoiceDie +' + d.die + ', traceChoiceNoDie +' + d.noDie + ' (traceFoundNothing +' + d.nothing + ', traceRetryCopied +' + d.retry + ')';
console.log('\n  CONTROLS');
ok(c1.d.die === 0 && c1.d.noDie === 0, 'control 1 — Synchronize lead, same rollout: ' + fmt(c1.d) + ' over ' + c1.n + ' samples');
ok(c2.die > 0 && c2.noDie === 0, 'control 2 — Trace lead, battleInit WITH a stream: ' + fmt(c2));
ok(plant.noDie > 0, 'plant — Trace lead, battleInit with NO stream counts the missing die: ' + fmt(plant));
if (!(c1.d.die === 0 && c1.d.noDie === 0) || !(c2.die > 0 && c2.noDie === 0) || !(plant.noDie > 0))
  cannot('a control failed, so the counters cannot separate "a die was drawn" from "no die was in scope"');
console.log('\n  THE CELL');
console.log('      rolloutWinProb, Trace lead, ' + red.n + ' samples x 3 turns: ' + fmt(red.d));
ok(red.d.noDie === 0 && (red.d.die > 0 || red.d.nothing > 0),
   'a Trace inside rolloutWinProb draws its target from a stream',
   red.d.noDie ? 'cell: engine/rollout_leaf.js rolloutWinProb (release ' + REL.id + ', :1327 battleInit with no opts.rng): '
     + fmt(red.d) + ' over ' + red.n + ' samples — ' + red.d.noDie + ' Trace resolution(s) took the fixed eligible[0]'
     : (red.d.die || red.d.nothing ? null : 'no Trace resolved inside the rollout at all, so this arm asked nothing'));
console.log('      rolloutWinProb seeded:false (team preview), Trace lead, ' + preview.n + ' samples: ' + fmt(preview.d));
ok(preview.d.noDie === 0 && preview.d.die > 0,
   'a Trace LEAD on the team-preview road (seeded:false, the lead pass runs) draws its target from a stream',
   preview.d.noDie ? 'cell: engine/rollout_leaf.js rolloutWinProb, battleInit({ seeded: false }) with no rng -- '
     + preview.d.noDie + ' lead Trace resolution(s) took the fixed eligible[0]' : (preview.d.die ? null : 'no Trace drew at all, so this arm asked nothing'));
console.log('      battle(A, B, null, rng), Trace lead: ' + fmt(battleArm));
ok(battleArm.noDie === 0 && battleArm.die > 0,
   'a Trace LEAD in MEDICHAM\'s own battle() draws its target from the caller\'s stream',
   battleArm.noDie ? 'cell: engine/medicham2-browser.js battle() -> battleInit(teamA, teamB) with no rng' : (battleArm.die ? null : 'no Trace drew at all'));

console.log('\n  THE CALLERS (static, engine/*.js on the working tree)');
if (!scanOk) cannot('the call-site scanner misread its own plants: ' + JSON.stringify(planted));
console.log('      scanner plants: `{}` -> ' + planted[0].verdict + ', `{ trace, rng }` -> ' + planted[1].verdict
  + ', `{ seeded: true }` beside a commented call -> ' + planted[2].map(x => x.verdict).join(','));
for (const c of SITES) console.log('      ' + (c.verdict === 'UNSEEDED' ? 'UNSEEDED ' : c.verdict.padEnd(15)) + '  ' + c.file + ':' + c.line + '   ' + c.opt.replace(/\s+/g, ' ').slice(0, 70));
const unseeded = SITES.filter(c => c.verdict === 'UNSEEDED');
ok(SITES.length > 0 && unseeded.length === 0,
   'every engine battleInit call hands it a stream or is a literal seeded board (' + SITES.length + ' sites)',
   unseeded.length ? unseeded.length + ' unseeded: ' + unseeded.map(c => c.file + ':' + c.line).join(', ') : null);

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
