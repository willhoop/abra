/* solver/arena/engine.js — the ONE place the solver's arena and its pool workers get MEDICHAM from.
 *
 *   const E = require('./engine.js').load(id);   // id = a release id, or null for the live tree
 *   E.API       the solver-facing API (engine/medicham_api.js), bound to the engine it was loaded from
 *   E.REL       the opened release (engine/engine_release.js open()), or null on the live tree
 *   E.stamp     REL.stamp() — release id, first cut, cut count, Showdown commit, every source digest —
 *               or { engine_release: null, live_tree: true } on the live tree
 *
 * A MEASUREMENT IS A PHOTOGRAPH (CLAUDE.md). With an id, every engine byte — the API, the simulator, the
 * damage table and every data file they read — comes out of data/releases/<id>/, so ENGINE may rewrite the
 * live tree while the arena plays. The only live engine files a release-bound run loads are the release
 * loader itself (engine/engine_release.js) and the regulation selector (engine/regulation.js), which must
 * run first to say which table the release serves. solver/tests/test-arena-release.js traces every file a
 * release-bound arena opens — the parent and a pool worker — and fails on any other live engine or data byte.
 *
 * The workers are forked processes with their own engine. They inherit the id through SOLVER_RELEASE, which
 * the arena sets before it forks, so the parent and the workers cannot play different engines.
 *
 * DELIBERATE BREAK (env ARENA_BREAK=live): the release is opened and STAMPED but the API is bound to the LIVE
 * engine — an artifact that names a release it never played. solver/tests/test-arena-release.js must go red.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

function load(id) {
  id = id || process.env.SOLVER_RELEASE || null;
  if (!id) return { API: require(path.join(ROOT, 'engine', 'medicham_api.js')), REL: null, id: null,
    stamp: { engine_release: null, live_tree: true } };
  const REL = require(path.join(ROOT, 'engine', 'engine_release.js')).open(id);
  REL.require('data/engine-data.js');              // the table first: the engine reads globalThis.MC at use time
  const MEDI = REL.require('engine/medicham2-browser.js');
  const API = process.env.ARENA_BREAK === 'live' ? require(path.join(ROOT, 'engine', 'medicham_api.js'))
    : REL.require('engine/medicham_api.js').bind(MEDI);
  process.env.SOLVER_RELEASE = id;                 // forked pool workers open the same release
  return { API, REL, id, stamp: REL.stamp() };
}

module.exports = { load };
