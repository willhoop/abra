/* opt_status.js — DOES V8 OPTIMIZE THE HOT FUNCTIONS AT ALL? One hypothesis, one tiny run.
 *
 * The profile (profile_turn.js) put 4.8% of rollout samples on battleTurn's DECLARATION line and 2.3%
 * on dmgRangeOneHit's — ticks with no attributable line. One explanation is that these functions are
 * too large for TurboFan and run in a lower tier. This asks V8 directly after a warm-up.
 *
 *   node --allow-natives-syntax data/verification/opt-plan-2026-09-11/opt_status.js
 *   node --allow-natives-syntax --trace-opt data/verification/opt-plan-2026-09-11/opt_status.js | grep ...
 *
 * Bits decoded from V8's OptimizationStatus enum (src/runtime/runtime-test.cc); the raw value is
 * printed beside the decode so a changed enum cannot mislead silently. Reads the release only.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = 'C:/Users/willj/Projects/Pokemon/ABRA';
if (!process.env.SHOWDOWN_PATH) process.env.SHOWDOWN_PATH = 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const REL = require(path.join(ROOT, 'engine', 'engine_release.js')).open('13257c8bc397');
const MEDI = REL.require('engine/medicham2-browser.js', { need: ['battleInit', 'battleTurn', 'buildMonFromSet', 'dmgRange', 'playerAction'] });
const RL = REL.require('engine/rollout_leaf.js', { need: ['runPlayout'], dataMissingOk: ['data/rollout-switch-census.json'] });
const TAGSMOD = REL.require('engine/tags.js');
let status;
try { status = new Function('f', 'return %GetOptimizationStatus(f);'); } catch (e) { console.error('run with --allow-natives-syntax'); process.exit(2); }
function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const lines = fs.readFileSync(path.join(ROOT, 'data', 'team-pool-frozen', 'games.bo3.jsonl'), 'utf8').split('\n');
const pairs = [];
for (let i = 0; i < lines.length && pairs.length < 40; i += 97) {
  let g; try { g = JSON.parse(lines[i]); } catch (e) { continue; }
  const s = (t) => t.slice(0, 4).map(p => ({ species: p.species, item: p.item || '', ability: p.ability || '', moves: p.moves || [], nature: p.nature || '', sp: {} }));
  if (g && g.sheets && g.sheets.p1 && g.sheets.p2) pairs.push({ A: s(g.sheets.p1), B: s(g.sheets.p2) });
}
let turns = 0;
const N = +(process.argv[2] || 600);
for (let i = 0; i < N; i++) {
  const p = pairs[i % pairs.length];
  const A = p.A.map(x => MEDI.buildMonFromSet(x)), B = p.B.map(x => MEDI.buildMonFromSet(x));
  if (A.some(x => !x) || B.some(x => !x)) continue;
  const S = MEDI.battleInit(A, B, { rng: mulberry(i + 5) }); S.maxTurns = 20; S._explore = 1.0;
  RL.runPlayout(S, mulberry(i + 1), 1.0, 'uniform', null, 0.0998); turns += S.turn || 0;
}
const BITS = ['IsFunction', 'NeverOptimize', 'AlwaysOptimize', 'MaybeDeopted', 'Optimized', 'Maglevved', 'TurboFanned', 'Interpreted',
  'MarkedForOptimization', 'MarkedForConcurrentOptimization', 'OptimizingConcurrently', 'IsExecuting', 'TopmostFrameIsTurboFanned', 'LiteMode',
  'MarkedForDeoptimization', 'Baseline', 'TopmostFrameIsInterpreted', 'TopmostFrameIsBaseline', 'IsLazy', 'TopmostFrameIsMaglev'];
const dec = (v) => BITS.filter((b, i) => v & (1 << i)).join('|');
console.log('games ' + N + ', turns ' + turns + ', node ' + process.version);
for (const [name, f] of [['battleTurn', MEDI.battleTurn], ['battleInit', MEDI.battleInit], ['dmgRange', MEDI.dmgRange], ['playerAction', MEDI.playerAction],
  ['battleOver', MEDI.battleOver], ['runPlayout', RL.runPlayout], ['tags.param', TAGSMOD.param], ['tags.has', TAGSMOD.has], ['tags.tagsFor', TAGSMOD.tagsFor]]) {
  if (typeof f !== 'function') { console.log('  ' + name.padEnd(14) + 'NOT EXPORTED'); continue; }
  const v = status(f);
  console.log('  ' + name.padEnd(14) + String(v).padStart(8) + '  ' + dec(v));
}
