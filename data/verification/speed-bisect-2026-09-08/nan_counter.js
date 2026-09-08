/* nan_counter.js — names the MEDSEEN key that goes non-numeric during play on a given release.
 * Written because instrumentation_rate.js reported `null` for MEDSEEN on 05e03b600fc7 and a null in
 * a measurement is a thing to name, not to caption. Throws if it finds nothing to report. */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..');
const id = process.argv[2];
if (!id) throw new Error('usage: node nan_counter.js <release-id>');
const REL = require(path.join(ROOT, 'engine', 'engine_release.js')).open(id);
const MEDI = REL.require('engine/medicham2-browser.js');
const RL = REL.require('engine/rollout_leaf.js');
const SWARM = require(path.join(ROOT, 'engine', 'diff_swarm.js'));
const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));
const TEAMS = SWARM.loadTeams({ storeDir: 'data/team-pool-frozen' });
function mul(s){let a=s>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let x=Math.imul(a^(a>>>15),1|a);x=(x+Math.imul(x^(x>>>7),61|x))^x;return ((x^(x>>>14))>>>0)/4294967296;};}
const A = GD.buildPair(TEAMS[0].team, { max: 4 }).filter(x => x && x.medi);
const B = GD.buildPair(TEAMS[400].team, { max: 4 }).filter(x => x && x.medi);
for (let i = 0; i < 40; i++) {
  const S = MEDI.battleInit(GD.freshBodies(A).filter(Boolean), GD.freshBodies(B).filter(Boolean), {});
  S.maxTurns = 60; S._explore = 1.0;
  RL.runPlayout(S, mul(i * 104729 + 13), 1.0, 'uniform', null, 0.0998);
}
const S = MEDI.MEDSEEN || {};
const bad = [];
for (const k in S) { const v = S[k]; if (typeof v === 'number' && !Number.isFinite(v)) bad.push(k + ' = ' + v); }
console.log(bad.length ? 'NON-FINITE AFTER PLAY: ' + bad.join(', ') : 'all MEDSEEN values finite after 40 playouts');
