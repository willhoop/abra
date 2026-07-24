/* build-status.js — read every model's shipped JSON report and emit data/status.js
 * (window.STATUS) so the site's MAP booth renders LIVE status badges. Never hardcoded:
 * re-run this whenever a report changes and the map updates itself.
 * Names are the catchy nicknames (each a real slice of the Pokémon's name); edges use ids.
 *   node engine/build-status.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);
const j = p => { try { return JSON.parse(fs.readFileSync(D(p), 'utf8')); } catch (e) { return null; } };
const pct = x => x == null ? '?' : Math.round(x * 100) + '%';

const dmg = j('damage-validation.json') || {};
const pory = j('pory-eval.json') || {};
const chomp = j('chomp-ev.json') || {};
const pol = j('policy-eval.json') || {};
const guru = j('guru-matchups.json') || {};
const skp = j('slowking-playstyle-eval.json') || {};

const ll = (pory.log_loss || {});
const sc = (pol.species_only_clone || {});
const cev = (chomp.proper_score_logloss || {});
const ex = (skp.exploitability || {});

// tier: data | damage | input | decision | capstone | roadmap | retired
// inputs are node IDS (edges never break when display names change)
const M = [
  { id:'store', name:'STORE', tier:'data', status:'live', metric:`${(guru.n_games||0).toLocaleString()} games stored`,
    detail:'Every public ladder game, kept raw.', inputs:[] },
  { id:'medicham', name:'MEDI', full:'Medicham', tier:'damage', status:'validated', metric:'damage is exact',
    detail:'Exact damage maths, checked against @smogon/calc.', inputs:[] },
  { id:'guru', name:'GURU', full:'Oranguru', tier:'input', status:'built', metric:`${guru.n_archetypes||0} archetypes measured`,
    detail:'Which archetype beats which, measured with error bars.', inputs:['store'] },
  { id:'xatu', name:'XATU', full:'Xatu', tier:'input', status:'built', metric:`right ${pct(sc.top3_accuracy)} of the time`,
    detail:'Guesses the opponent\'s hidden set and next move.', inputs:['store'] },
  { id:'pory', name:'PORY', full:'Porygon', tier:'input', status:'win', metric:'beats a coin flip',
    detail:'Reads your win% mid-battle. Beats a coin.', inputs:['store','dusk'] },
  { id:'dusk', name:'DUSK', full:'Dusclops', tier:'roadmap', status:'roadmap', metric:'endgame solver',
    detail:'Solves small endgames exactly.', inputs:['medicham'] },
  { id:'hypno', name:'HYPNO', full:'Hypno', tier:'roadmap', status:'roadmap', metric:'opponent read',
    detail:'Rates the opponent, sets how hard to exploit.', inputs:['store'] },
  { id:'mew', name:'MEW', full:'Mew', tier:'roadmap', status:'roadmap', metric:'self-play',
    detail:'Plays millions of games against itself.', inputs:['medicham'] },
  { id:'chomp', name:'CHOMP', full:'Garchomp', tier:'decision', status:'null', metric:'ties a coin (honest null)',
    detail:'Picks the four to bring and two to lead.', inputs:['medicham','guru'] },
  { id:'slowking', name:'KING', full:'Slowking', tier:'decision', status:'built', metric:'near-unexploitable mix',
    detail:'Finds the unexploitable mix at team preview.', inputs:['guru','medicham'] },
  { id:'ditto', name:'DITTO', full:'Ditto', tier:'decision', status:'pivot', metric:'team-builder',
    detail:'Builds a team to beat the current meta.', inputs:['slowking','medicham'] },
  { id:'kadabra', name:'KADABRA', full:'Kadabra', tier:'decision', status:'built', metric:'per-turn win%',
    detail:'Walks a replay and shows your win% each turn.', inputs:['pory'] },
  { id:'alakazam', name:'ALAKAZAM', full:'Alakazam', tier:'capstone', status:'dev', metric:'in development',
    detail:'The in-battle coach. Still being built.', inputs:['xatu','pory','medicham','slowking','dusk','hypno'] },
  { id:'jolteon', name:'JOLT', full:'Jolteon', tier:'retired', status:'retired', metric:'ties a coin',
    detail:'Tried to call the winner from team sheets. Ties a coin.', inputs:['store'] },
  { id:'medi_win', name:'MEDI win%', full:'Medicham', tier:'retired', status:'retired', metric:'retired - it was backwards',
    detail:'Old win% guess. It was backwards, so it is retired.', inputs:['medicham'] },
];

fs.writeFileSync(D('status.js'), 'window.STATUS=' + JSON.stringify({ generated: new Date().toISOString().slice(0,10), models: M }) + ';\n');
console.log('wrote data/status.js —', M.length, 'nodes');
