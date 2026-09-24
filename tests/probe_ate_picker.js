#!/usr/bin/env node
/* tests/probe_ate_picker.js — THE STAGED HARNESS NEVER TRIGGERS A MECHANIC WITH A MOVE ITS HANDLER EXCLUDES. 2026-09-24.
 *
 *   node tests/probe_ate_picker.js                                   Reg M-B
 *   ABRA_REGULATION=regmc node tests/probe_ate_picker.js             Reg M-C
 *   FIXTURE_PREFLIGHT_EXCLUSION_BLIND=1 ...                          restores the defect (must exit 1)
 *
 * The -ate handlers convert a Normal move unless it is on their own `noModifyType` literal (Weather Ball, Terrain
 * Pulse, ...). `fixture_preflight.moveNeeds` derived the need `type=Normal` and nothing else, and `stage_planner`
 * copied only `{kind, values}` off it, so the planner staged Pixilate and Refrigerate with WEATHER BALL -- the one
 * Normal move the handler skips. On the fixed engine (0.88.0) the Pixilate arm then reads DID-NOT-FIRE and the row
 * survives only through the legacy fallback.
 *
 * THE POPULATION IS DERIVED, never listed: every legal ability and item whose `moveNeeds` carries an `except` list
 * (read from the handler's text with the same polarity rule as the flags). Printed on every run. For each, the
 * planner's fixture must stage a carrier click that (a) is on no `except` list and (b) meets the need. Plays no game.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine', 'showdown_path.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const PRE = require(path.join(ROOT, 'engine', 'fixture_preflight.js'));
const SP = require(path.join(ROOT, 'engine', 'stage_planner.js'));
const D = CS.dexFor(CS.FORMAT);
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BLIND = process.env.FIXTURE_PREFLIGHT_EXCLUSION_BLIND === '1';

/* The handler-side exclusion is read with the knob OFF, so the red arm is judged against the same lists. */
function exclusionsOf(e) {
  const was = process.env.FIXTURE_PREFLIGHT_EXCLUSION_BLIND; delete process.env.FIXTURE_PREFLIGHT_EXCLUSION_BLIND;
  try { return PRE.moveNeeds(e).needs.filter(n => n.except && n.except.length); }
  finally { if (was !== undefined) process.env.FIXTURE_PREFLIGHT_EXCLUSION_BLIND = was; }
}
const pop = [];
for (const [coll, key] of [['abilities', 'ability'], ['items', 'item']])
  for (const e of D[coll].all()) if (legal(e)) { const ex = exclusionsOf(e); if (ex.length) pop.push({ key: key + ':' + e.id, e, ex }); }
console.log('probe_ate_picker — ' + CS.FORMAT + (BLIND ? '  [FIXTURE_PREFLIGHT_EXCLUSION_BLIND=1]' : ''));
console.log('  derived population (' + pop.length + '): ' + pop.map(p => p.key + ' except ' + p.ex[0].except.join('/')).join(' | '));
/* EVERY handler that excludes a move id, including the ones with NO move need to carry it (the picker then takes any
 * click, so the list cannot steer it). Printed so a new member arrives named. */
{
  const rows = [];
  for (const [coll, key] of [['abilities', 'ability'], ['items', 'item']]) for (const e of D[coll].all()) {
    if (!legal(e)) continue;
    for (const [k, v] of Object.entries(e)) {
      if (!/^on/.test(k) || typeof v !== 'function') continue;
      const src = String(v).replace(/\?\.(?=[A-Za-z_$])/g, '.');
      const ex = PRE.excludedMoveIds(src, PRE.guardsOf(src));
      if (!ex.length) continue;
      const carried = pop.some(p => p.key === key + ':' + e.id && p.ex.some(n => n.handler === k));
      rows.push(key + ':' + e.id + '.' + k + ' [' + ex.join('/') + ']' + (carried ? ' carried on its need' : ' NO NEED to carry it'));
    }
  }
  console.log('  every handler excluding a move id (' + rows.length + '):\n    ' + rows.join('\n    '));
}
if (!pop.length) { console.log('  NOTHING TO ASK — no handler excludes a move id. That is a derivation failure, not a pass.'); process.exit(1); }

/* This regulation's tag file (the planner's own default is Reg M-B's catalogue whatever is selected). */
const REG = require(path.join(ROOT, 'engine', 'regulation.js'));
const P = SP.plan({ only: pop.map(p => p.key), tagsPath: path.join(ROOT, REG.fileFor('data/tags.json')) });
console.log('  planner tags: ' + P.meta.tags);
let red = 0, asked = 0;
for (const p of pop) {
  const m = P.mechanics.find(x => x.key === p.key);
  if (!m || !m.fixtures.length) { console.log('  ' + p.key.padEnd(22) + ' no fixture (' + (m && m.refusal ? m.refusal.code : 'not planned') + ') — nothing staged, not asked'); continue; }
  for (const f of m.fixtures) {
    asked++;
    const clicks = f.turns.map(t => t.C).filter(c => c && c.m).map(c => id(c.m));
    const bad = clicks.filter(c => p.ex.some(n => n.except.includes(c)));
    const ctx = { userTypes: D.species.get(f.bodies.C.field).types, targetTypes: D.species.get(f.bodies.R.field).types };
    const meets = clicks.filter(c => p.ex.every(n => PRE.satisfiesNeed(c, n, ctx)));
    const ok = !bad.length && meets.length > 0;
    if (!ok) red++;
    console.log('  ' + (ok ? 'GREEN' : 'RED  ') + ' ' + p.key.padEnd(20) + ' [' + f.branch + '] ' + f.bodies.C.field + ' clicks ' + clicks.join(',')
      + (bad.length ? '  <- ' + bad.join(',') + ' is on the handler\'s own exclusion list' : '') + (meets.length ? '' : '  <- no click meets the need'));
  }
}
console.log('  ' + asked + ' fixture(s) asked, ' + red + ' RED');
process.exit(red || !asked ? 1 : 0);
