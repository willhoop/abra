/* exposure.js — THE PRICING-RISK ENGINE: what does clicking this move into that body cost me?
 *
 * Will, 2026-07-29: "how can we build something that accurately values the risk of a flame body
 * proc". The rollouts already SIMULATE the risk (wire 6); nothing PRICED it at the decision point,
 * so MAG scores Close Combat into Flame Body exactly like Close Combat into anything else.
 *
 * WHAT THIS IS. A pure function from (attacker, target, move) to the EXPECTED COST of the click,
 * decomposed into unit-clean channels rather than one hand-mixed scalar:
 *
 *   selfHPFrac        expected fraction of the attacker's own max HP lost (Rough Skin's 1/8,
 *                     burn/poison chip over the remaining game)
 *   outputHalvedFrac  expected fraction of the attacker's damage output halved (burn x its
 *                     physical share; a burned Amoonguss lost nothing, a burned Ursaluna lost half)
 *   actionsLostFrac   expected share of remaining actions lost outright (full-para 12.5%/turn,
 *                     sleep 1.67 turns, freeze 1.31 turns -- the engine's own Champions rules)
 *   stagesLost        expected negative stat stages taken (Gooey's -1 speed per touch)
 *
 * The channels are separate BECAUSE the weights are not this file's to assert: board.js exposes
 * them as features and fit_policy learns what each is worth in wins. `total` is only a default
 * view for UIs and tests. Every probability and magnitude comes from data/tags.json -- the same
 * artifact the rollout procs from -- so the price and the simulation cannot disagree.
 *
 * WHAT IT DELIBERATELY DOES NOT PRICE (v0, stated not smuggled):
 *   - paralysis speed-halving (positional, needs a speed-order model; only the 12.5% is priced)
 *   - volatiles (Cursed Body disable, Cute Charm attract) and hazards (Toxic Debris)
 *   - the option value of BLOCKING a worse status by taking a burn on purpose
 *
 * HORIZON. "The rest of the game" is measured, not guessed: the 29,256-game self-play run of
 * 2026-07-29 has median 9 turns (p25 7, p75 11), so a mid-game click sees ~5 more turns. Override
 * per call via opts.horizon when the caller knows better (early game, endgame).
 *
 * Runs in node AND the browser, like medicham2-browser.js: no bare require at top level. */
(function(root){
'use strict';

function deps(){
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try {
      return { TAGS: require('./tags.js'), M: require('./medicham2-browser.js') };
    } catch (e) { /* fall through */ }
  }
  /* browser: medicham2-browser.js exports its own tag adapter as ABRA_TAG_LOOKUP, so the price
   * and the simulation read through ONE adapter and cannot disagree */
  return { TAGS: root.ABRA_TAG_LOOKUP || null, M: root };
}

var DEFAULT_HORIZON = 5;   // measured: half the median 9-turn game — see header

/* Champions status arithmetic, mirrored from the battle loop's OWN rules (medicham2-browser.js):
 * full-para 12.5%/turn; sleep loses turn 1 and 2/3 of turn 2 = 1.667 turns; freeze thaws 25% per
 * attempt, guaranteed turn 3 = 0.75 + 0.75^2 = 1.3125 turns; burn chips 1/16, poison 1/8, toxic
 * n/16 escalating. If the battle loop's constants change, these must change with them —
 * tests/test-exposure.js pins several of them through real battles for exactly that reason. */
var SLEEP_TURNS_LOST = 1 + 2/3;
var FREEZE_TURNS_LOST = 0.75 + 0.75*0.75;
var FULL_PARA = 0.125;

function physicalShare(att){
  var MCg = (typeof MC !== 'undefined') ? MC : null;
  if(!MCg || !att || !att.moves) return 0.5;
  var p=0, n=0;
  for(var i=0;i<att.moves.length;i++){
    var mv=MCg.moves[att.moves[i]];
    if(!mv || !mv.bp) continue;
    n++; if(mv.c==='P') p++;
  }
  return n ? p/n : 0.5;
}

function statusCost(att, status, H){
  /* Returns {selfHPFrac, outputHalvedFrac, actionsLostFrac} of ONE landed status. */
  var out = { selfHPFrac:0, outputHalvedFrac:0, actionsLostFrac:0 };
  if(status==='burn'){
    /* Guts turns the halving off (dmgRange applies burn=0.5 only when ability!=='guts'). */
    if(att.ability!=='guts') out.outputHalvedFrac = physicalShare(att);
    out.selfHPFrac = H/16;
  } else if(status==='poison'){
    out.selfHPFrac = H/8;
  } else if(status==='bad poison'){
    var s=0; for(var n=1;n<=H;n++) s+=Math.min(15,n)/16;
    out.selfHPFrac = s;
  } else if(status==='paralysis'){
    out.actionsLostFrac = FULL_PARA;               // per remaining turn, already a rate
  } else if(status==='sleep'){
    out.actionsLostFrac = Math.min(H, SLEEP_TURNS_LOST)/H;
  } else if(status==='freeze'){
    out.actionsLostFrac = Math.min(H, FREEZE_TURNS_LOST)/H;
  }
  return out;
}

function expectedHits(moveId, TAGS){
  var p = TAGS && TAGS.param('move', moveId, 'multiHit');
  if(!p) return 1;
  /* the artifact's 2-5 distribution: 2:35 3:35 4:15 5:15 -> 3.1 expected hits */
  if(p.distribution && p.distribution.indexOf('2:35')===0) return 3.1;
  return 2;
}

/* punishExposure(att, tgt, moveId, opts) -> null (no exposure) or the channel object.
 * att/tgt are buildMon() mons. A pure read: nothing is mutated, safe inside a scorer loop. */
function punishExposure(att, tgt, moveId, opts){
  opts = opts || {};
  var d = deps();
  var TAGS = opts.TAGS || d.TAGS;
  var M = d.M;
  if(!TAGS) return null;   // no artifact, no priced risk — visible, never invented
  if(!att || !tgt || !moveId) return null;

  var pun = TAGS.param('ability', tgt.ability, 'punishesAttacker');
  if(!pun || pun.requiresForme) return null;

  var MCg = (typeof MC !== 'undefined') ? MC : null;
  var mv = MCg && MCg.moves[moveId];
  if(!mv || !mv.bp) return null;                   // status clicks make no contact here

  /* the trigger, from the tag — the same gate the rollout obeys */
  var trig = pun.trigger==='contact' ? TAGS.has('move', moveId, 'contact')
           : pun.trigger==='physical' ? mv.c==='P'
           : pun.trigger==='special'  ? mv.c==='S'
           : true;
  if(!trig) return null;

  var H = opts.horizon || DEFAULT_HORIZON;
  var hits = expectedHits(moveId, TAGS);
  var out = { selfHPFrac:0, outputHalvedFrac:0, actionsLostFrac:0, stagesLost:0, parts:[] };

  /* Aftermath-shaped members fire only if this click kills — weight by the same crude kill
   * probability chooseAction uses (min-roll kills: 1, max-roll kills: 0.5, else 0). */
  var pApply = 1;
  if(pun.onFaintOnly){
    if(M && M.dmgRange){
      var dr = M.dmgRange(att, tgt, mv, opts.field || {terrain:'',weather:'',twA:0,twB:0}, false);
      pApply = dr.min>=tgt.curHP ? 1 : (dr.max>=tgt.curHP ? 0.5 : 0);
    } else pApply = 0;
    if(!pApply) return null;
  }

  if(pun.fraction){
    var f = hits * pApply / (+pun.fraction);
    out.selfHPFrac += f;
    out.parts.push({what:'1/'+pun.fraction+' max HP per hit', p:pApply, cost:+f.toFixed(4)});
  }
  if(pun.boosts){
    for(var k in pun.boosts) if(pun.boosts[k]<0){
      var st = hits * pApply * -pun.boosts[k];
      out.stagesLost += st;
      out.parts.push({what:k+' '+pun.boosts[k]+' per hit', p:pApply, cost:+st.toFixed(4)});
    }
  }
  if(pun.inflicts && M && M.canTakeStatus){
    var CODE = {paralysis:'par',burn:'brn',poison:'psn','bad poison':'tox',sleep:'slp',freeze:'frz'};
    for(var i=0;i<pun.inflicts.length;i++){
      var inf = pun.inflicts[i];
      if(!M.canTakeStatus(att, CODE[inf.status]||inf.status)) continue;   // immune or statused: free
      var pProc = (1 - Math.pow(1-inf.chance, hits)) * pApply;
      var c = statusCost(att, inf.status, H);
      out.selfHPFrac += pProc * c.selfHPFrac;
      out.outputHalvedFrac += pProc * c.outputHalvedFrac;
      out.actionsLostFrac += pProc * c.actionsLostFrac;
      out.parts.push({what:inf.status+' '+(100*inf.chance)+'%', p:+pProc.toFixed(4),
        cost:+(pProc*(c.selfHPFrac+c.outputHalvedFrac+c.actionsLostFrac)).toFixed(4)});
    }
  }

  if(!out.parts.length) return null;
  /* default view only — the real weights are fit_policy's to learn */
  out.total = +(out.selfHPFrac + out.outputHalvedFrac + out.actionsLostFrac + 0.125*out.stagesLost).toFixed(4);
  return out;
}

root.punishExposure = punishExposure;
if (typeof module !== 'undefined' && module.exports)
  module.exports = { punishExposure, statusCost, physicalShare, DEFAULT_HORIZON };
})(typeof window !== 'undefined' ? window : globalThis);
