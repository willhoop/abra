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
  { id:'store', name:'STORE', tier:'data', status:'live', metric:`${(guru.n_games||0).toLocaleString()} games`,
    detail:'Every public replay, stored raw; grows ~18k/week.', inputs:[] },
  { id:'medicham', name:'MEDI', full:'Medicham', tier:'damage', status:'validated', metric:`${dmg.result?dmg.result.within_5pct:'?'}% within 5%`,
    detail:'Exact Gen-9 doubles damage, validated vs @smogon/calc. (MEDIcham)', inputs:[] },
  { id:'guru', name:'GURU', full:'Oranguru', tier:'input', status:'built', metric:`${guru.n_archetypes||0} archetypes`,
    detail:`Real matchup matrix from ${(guru.n_games||0).toLocaleString()} games, Wilson CIs. (oranGURU)`, inputs:['store'] },
  { id:'xatu', name:'XATU', full:'Xatu', tier:'input', status:'built', metric:`top-3 ${pct(sc.top3_accuracy)}`,
    detail:`Opponent set/move belief. Held-out top-1 ${pct(sc.top1_accuracy)} / top-3 ${pct(sc.top3_accuracy)}.`, inputs:['store'] },
  { id:'pory', name:'PORY', full:'Porygon', tier:'input', status:'win', metric:`log-loss ${ll.pory} < coin ${ll.coin}`,
    detail:`Mid-game win% value net. Beats a coin, calibrated (ECE ${pct(pory.ece)}). Live in Kadabra. (PORYgon)`, inputs:['store','dusk'] },
  { id:'dusk', name:'DUSK', full:'Dusclops', tier:'roadmap', status:'roadmap', metric:'endgame solver',
    detail:'Solves small boards exactly; trains PORY, sharpens ALAKAZAM.', inputs:['medicham'] },
  { id:'hypno', name:'HYPNO', full:'Hypno', tier:'roadmap', status:'roadmap', metric:'opponent read',
    detail:'Estimates opponent skill + predictability; sets the exploit dial.', inputs:['store'] },
  { id:'mew', name:'MEW', full:'Mew', tier:'roadmap', status:'roadmap', metric:'self-play',
    detail:'Generates millions of self-play games — the fuel for ALAKAZAM.', inputs:['medicham'] },
  { id:'chomp', name:'CHOMP', full:'Garchomp', tier:'decision', status:'null', metric:`EV ${cev.chomp_align} ~ coin`,
    detail:`Bring-4 / lead-2. CHOMP-EV proof: brings tie a coin (honest null). Damage is exact. (garCHOMP)`, inputs:['medicham','guru'] },
  { id:'slowking', name:'KING', full:'Slowking', tier:'decision', status:'built', metric:`exploit ${ex.nash} vs greedy ${ex.greedy_single_deck}`,
    detail:'Team-preview Nash over GURU. Mixing beats one deck; playstyle cycle suggestive. (slowKING)', inputs:['guru','medicham'] },
  { id:'ditto', name:'DITTO', full:'Ditto', tier:'decision', status:'pivot', metric:'team-builder',
    detail:'PSRO team-build on validated damage + KING\'s Nash (NOT the retired win%). Enforces item clause.', inputs:['slowking','medicham'] },
  { id:'kadabra', name:'KADABRA', full:'Kadabra', tier:'decision', status:'built', metric:'per-turn win%',
    detail:'Replay coach; shows PORY\'s "you\'re at X%" each key turn. Evolves into ALAKAZAM.', inputs:['pory'] },
  { id:'alakazam', name:'ALAKAZAM', full:'Alakazam', tier:'capstone', status:'dev', metric:'in development',
    detail:'In-battle capstone: belief + depth-limited search + learned value, KL-anchored.', inputs:['xatu','pory','medicham','slowking','dusk','hypno'] },
  { id:'jolteon', name:'JOLT', full:'Jolteon', tier:'retired', status:'retired', metric:'ties a coin',
    detail:'Win-from-sheets predictor. Ties a coin — demoted to a usage prior. (JOLTeon)', inputs:['store'] },
  { id:'medi_win', name:'MEDI win%', full:'Medicham', tier:'retired', status:'retired', metric:'below coin (inverted)',
    detail:'Rollout win%. Systematically inverted (backs fast teams that lose). Damage kept; win% retired.', inputs:['medicham'] },
];

fs.writeFileSync(D('status.js'), 'window.STATUS=' + JSON.stringify({ generated: new Date().toISOString().slice(0,10), models: M }) + ';\n');
console.log('wrote data/status.js —', M.length, 'nodes');
