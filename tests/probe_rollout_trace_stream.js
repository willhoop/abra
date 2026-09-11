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
 * EXIT: 0 green / 1 red / 2 cannot answer. Plays a rollout of at most 1 turn per sample.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', '2b5a6585d8cf');
const N = +arg('--n', 3);
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };

let REL, M, RL, dex;
try {
  REL = require(path.join(ROOT, 'engine', 'engine_release.js')).open(REL_ID);
  M = REL.require('engine/medicham2-browser.js', { want: ['buildMon', 'battleInit', 'MEDSEEN'] });
  RL = REL.require('engine/rollout_leaf.js', { want: ['rolloutWinProb'] });
  const CS = REL.require('engine/champions_sim.js');
  dex = CS.sim().Dex.forFormat(CS.FORMAT);
} catch (e) { cannot('release ' + REL_ID + ' would not open: ' + String(e && e.message || e)); }
console.log('\ntests/probe_rollout_trace_stream.js — ROADMAP #310   release ' + REL.id);

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

function rollout(leadAb) {
  const a = S0();
  let r;
  try { r = RL.rolloutWinProb(null, 'p1', { n: N, buildTeams: teams(leadAb), maxTurns: 3, dex }); }
  catch (e) { cannot('rolloutWinProb threw on the ' + leadAb + ' arm: ' + String(e && e.message || e)); }
  if (!r || !r.n) cannot('rolloutWinProb ran no sample on the ' + leadAb + ' arm');
  return { d: delta(a, S0()), n: r.n };
}
function direct(leadAb, opts) {
  const a = S0(); const t = teams(leadAb)();
  try { M.battleInit(t.A, t.B, opts); } catch (e) { cannot('battleInit threw: ' + String(e && e.message || e)); }
  return delta(a, S0());
}

const red = rollout('trace');
const c1 = rollout('synchronize');
const c2 = direct('trace', { rng: { seed: 20260911 } });
const plant = direct('trace', {});

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

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
