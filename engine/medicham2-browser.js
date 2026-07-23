/* MEDICHAM v3 — a real Gen-9 DOUBLES rollout engine (browser + node).
 * Expects MC (mons/moves/C type-chart/priors) and mcEff to be in scope.
 * In the browser these come from the embedded data block; in node tests they're injected.
 * Exposes winProb2(namesA, namesB, N, itemsOverride) -> P(A wins).
 *
 * Why doubles: the previous engine was a 1v1 OHKO chain, which collapses to speed-
 * deterministic 0/100 results. Real doubles (two active per side, spread moves, Protect,
 * positioning, redirection) restores the non-transitivity that makes win rates meaningful. */
(function(root){
'use strict';
// ---- curated metadata the compact move table lacks (only fields we can't derive) ----
const SPREAD = new Set(['earthquake','rockslide','heatwave','blizzard','muddywater','dazzlinggleam','hypervoice','makeitrain','glaciate','icywind','snarl','bulldoze','discharge','lavaplume','eruption','waterspout','surf','electroweb','strugglebug','sludgewave','mistyexplosion','explosion','selfdestruct','breakingswipe','petalblizzard','glaciallance','astralbarrage','originpulse','precipiceblades','landswrath','diamondstorm','sparklingaria','swift','pollenpuff']);
const PRIO = {fakeout:3,upperhand:3,feint:2,extremespeed:2,firstimpression:2,aquajet:1,bulletpunch:1,machpunch:1,iceshard:1,shadowsneak:1,vacuumwave:1,watershuriken:1,jetpunch:1,quickattack:1,suckerpunch:1,grassyglide:1,accelerock:1,thunderclap:1};
const ACC = {hydropump:80,hurricane:70,fireblast:85,focusblast:70,thunder:70,blizzard:70,stoneedge:80,megahorn:85,gunkshot:80,iciclecrash:90,playrough:90,dynamicpunch:50,zapcannon:50,highjumpkick:90,drillrun:95,crosschop:80,sleeppowder:75,willowisp:85,thunderwave:90,hypnosis:60,irontail:75,dragonrush:75,inferno:50,fissure:30,sheercold:30,rockslide:90,airslash:95,gigaimpact:90,overheat:90,leafstorm:90,powerwhip:85,meteorbeam:90,muddywater:85,darkvoid:50,sing:55};
const PROTECTMOVES = new Set(['protect','detect','spikyshield','kingsshield','banefulbunker','burningbulwark','silktrap','maxguard']);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const boostMul=s=>{s=clamp(s||0,-6,6);return s>=0?(2+s)/2:2/(2-s);};

function buildMon(name,ov){ const m=MC.mons[name]; if(!m)return null;
  return {name,types:m.t.slice(),st:{...m.st},item:(ov&&ov[name])||m.item||'',ability:m.ab||'',moves:m.mv.slice(),
    curHP:m.st.hp,boosts:{at:0,df:0,sa:0,sd:0,sp:0},status:'',slp:0,fainted:false,protect:false,tookProtectTurns:0,_turnsOut:0,_flinch:false}; }

function dmgRange(att,def,mv,field,spread){
  if(!mv||!mv.bp)return {min:0,max:0,eff:mcEff(mv?mv.t:'',def.types)};
  const phys=mv.c==='P';
  let A=phys?att.st.at:att.st.sa,D=phys?def.st.df:def.st.sd;
  A=Math.floor(A*boostMul(phys?att.boosts.at:att.boosts.sa));
  D=Math.floor(D*boostMul(phys?def.boosts.df:def.boosts.sd));
  if(phys&&att.item==='choiceband')A=Math.floor(A*1.5);
  if(!phys&&att.item==='choicespecs')A=Math.floor(A*1.5);
  if(!phys&&def.item==='assaultvest')D=Math.floor(D*1.5);
  if((att.ability==='hugepower'||att.ability==='purepower')&&phys)A*=2;
  // --- stat-multiplying abilities (validated gaps vs @smogon/calc) ---
  if(att.ability==='guts'&&phys&&att.status&&att.status!=='none')A=Math.floor(A*1.5);
  if(att.ability==='solarpower'&&!phys&&field.weather==='sun')A=Math.floor(A*1.5);
  if(att.ability==='orichalcumpulse'&&phys&&field.weather==='sun')A=Math.floor(A*5461/4096);
  if(att.ability==='hadronengine'&&!phys&&field.terrain==='electric')A=Math.floor(A*5461/4096);
  // Ruin abilities lower everyone-else's stat (field-wide; handled pairwise)
  if(phys&&att.ability==='swordofruin')D=Math.floor(D*0.75);
  if(!phys&&att.ability==='beadsofruin')D=Math.floor(D*0.75);
  if(phys&&def.ability==='tabletsofruin')A=Math.floor(A*0.75);
  if(!phys&&def.ability==='vesselofruin')A=Math.floor(A*0.75);
  let base=Math.floor(Math.floor(22*mv.bp*A/D)/50)+2;
  if(spread)base=Math.floor(base*0.75);
  if(field.weather==='rain'){if(mv.t==='Water')base=Math.floor(base*1.5);if(mv.t==='Fire')base=Math.floor(base*0.5);}
  if(field.weather==='sun'){if(mv.t==='Fire')base=Math.floor(base*1.5);if(mv.t==='Water')base=Math.floor(base*0.5);}
  if(att.ability==='technician'&&mv.bp<=60)base=Math.floor(base*1.5);
  const eff=mcEff(mv.t,def.types); if(eff===0)return{min:0,max:0,eff:0};
  // type-immunity abilities (defender absorbs the type)
  const IMM={waterabsorb:'Water',stormdrain:'Water',dryskin:'Water',voltabsorb:'Electric',lightningrod:'Electric',motordrive:'Electric',flashfire:'Fire',wellbakedbody:'Fire',sapsipper:'Grass',levitate:'Ground',eartheater:'Ground'};
  if(IMM[def.ability]===mv.t)return{min:0,max:0,eff:0};
  const stab=att.types.includes(mv.t)?(att.ability==='adaptability'?2:1.5):1;
  const burn=(phys&&att.status==='brn'&&att.ability!=='guts')?0.5:1;
  const lo=att.item==='lifeorb'?1.3:1;
  // final-modifier chain (validated vs @smogon/calc)
  let mod=1;
  if((def.ability==='filter'||def.ability==='solidrock'||def.ability==='prismarmor')&&eff>1)mod*=0.75;
  if(att.ability==='neuroforce'&&eff>1)mod*=1.25;
  if(att.ability==='tintedlens'&&eff<1)mod*=2;
  if((def.ability==='multiscale'||def.ability==='shadowshield')&&(def.curHP==null||def.st==null||def.curHP>=def.st.hp))mod*=0.5;
  if(def.ability==='thickfat'&&(mv.t==='Fire'||mv.t==='Ice'))mod*=0.5;
  if(def.ability==='heatproof'&&mv.t==='Fire')mod*=0.5;
  if(def.ability==='purifyingsalt'&&mv.t==='Ghost')mod*=0.5;
  if(att.ability==='waterbubble'&&mv.t==='Water')mod*=2;
  if(def.ability==='waterbubble'&&mv.t==='Fire')mod*=0.5;
  if(att.item==='expertbelt'&&eff>1)mod*=1.2;
  if(att.item==='muscleband'&&phys)mod*=1.1;
  if(att.item==='wiseglasses'&&!phys)mod*=1.1;
  const roll=r=>{let d=Math.floor(base*r/100);if(stab!==1)d=Math.floor(d*stab);d=Math.floor(d*eff);if(burn<1)d=Math.floor(d*burn);if(mod!==1)d=Math.floor(d*mod);if(lo>1)d=Math.floor(d*lo);return d;};
  return {min:roll(85),max:roll(100),eff};
}
function bestMoveVs(att,def,field){ let best=null,bs=-1;
  for(const id of att.moves){const mv=MC.moves[id];if(!mv||!mv.bp)continue;const d=dmgRange(att,def,mv,field,SPREAD.has(id));const sc=(d.min+d.max)/2;if(sc>bs){bs=sc;best={id,mv,spread:SPREAD.has(id),d};}}
  return best;
}
// pick the best target (max damage) for a SPECIFIC move
function targetForMove(me,id,live,field){ const mv=MC.moves[id]; if(!mv||!mv.bp)return null;
  let bt=null,bs=-1; for(const f of live){const d=dmgRange(me,f,mv,field,SPREAD.has(id));const sc=(d.min>=f.curHP?1e6:0)+d.max;if(sc>bs){bs=sc;bt={id,mv,spread:SPREAD.has(id),d,target:f};}}
  return bt; }
// MEDICHAM policy = behaviour cloning: sample what a real ladder player would click, but always
// take an obvious KO, and Protect defensively when threatened. This is the whole point of the model —
// the win rate is the expected outcome under *realistic* play by both sides, not optimal play.
function chooseAction(me,foes,ally,field,side,rng){
  if(me.status==='slp'&&me.slp>0)return{kind:'sleep'};
  const live=foes.filter(f=>f&&!f.fainted&&f.curHP>0); if(!live.length)return{kind:'struggle'};
  // strongest option + is a KO available?
  let bestAtk=null,bestKO=-1,tgt=null;
  for(const f of live){const b=bestMoveVs(me,f,field);if(!b)continue;const ko=b.d.min>=f.curHP?1:(b.d.max>=f.curHP?0.5:0);const sc=ko*1e4+b.d.max;if(sc>bestKO){bestKO=sc;bestAtk=b;tgt=f;}}
  const bestKOsNow=bestAtk&&tgt&&bestAtk.d.min>=tgt.curHP;
  const incoming=live.reduce((mx,f)=>{const b=bestMoveVs(f,me,field);return b?Math.max(mx,b.d.max):mx;},0);
  const inDanger=incoming>=me.curHP*0.8;
  const canProtect=me.moves.some(id=>PROTECTMOVES.has(id));
  // 1) take a guaranteed KO most of the time (real players do)
  if(bestKOsNow&&rng()<0.85) return {kind:'attack',move:bestAtk,target:tgt};
  // 2) Protect when threatened and can't KO back
  if(inDanger&&!bestKOsNow&&canProtect&&!me.protect&&me.tookProtectTurns<2&&rng()<0.5) return {kind:'protect'};
  // 3) behaviour clone: sample the move this species actually clicks, at its real frequency
  const pr=MC.priors[me.name];
  if(pr){ let r=rng(),pick=null; for(const q of pr){r-=q[1];if(r<=0){pick={mv:q[0],kind:q[2]};break;}}
    if(pick){
      if(pick.kind==='protect'&&!me.protect&&me.tookProtectTurns<2)return{kind:'protect'};
      if(pick.kind==='setup'&&!inDanger&&(me.boosts.at+me.boosts.sa+me.boosts.sp)<4)return{kind:'setup'};
      if(pick.kind==='speed'&&((side==='A'?field.twA:field.twB)<=0))return{kind:'tail'};
      if(pick.kind==='status'&&live.some(f=>!f.status))return{kind:'status',target:live.find(f=>!f.status)};
      const chosen=targetForMove(me,pick.mv,live,field);            // the sampled damaging move
      if(chosen)return{kind:'attack',move:chosen,target:chosen.target};
    }}
  // 4) fallback: best available attack
  if(bestAtk)return{kind:'attack',move:bestAtk,target:tgt};
  return{kind:'struggle'};
}
function effSpeed(m,field,side){let s=m.st.sp*boostMul(m.boosts.sp);if(m.item==='choicescarf')s*=1.5;if((side==='A'?field.twA:field.twB)>0)s*=2;if(m.status==='par')s*=0.5;return s;}
function applyStatus(t,st){if(t.status)return;t.status=st;if(st==='slp')t.slp=1+(Math.random()*2|0);}

function battle(teamA,teamB,ov,rng){ rng=rng||Math.random;
  const field={weather:null,weatherT:0,twA:0,twB:0,tr:0};
  const setW=ms=>{for(const m of ms){if(m.ability==='drizzle'){field.weather='rain';field.weatherT=5;}else if(m.ability==='drought'){field.weather='sun';field.weatherT=5;}else if(m.ability==='sandstream'){field.weather='sand';field.weatherT=5;}else if(m.ability==='snowwarning'){field.weather='snow';field.weatherT=5;}}};
  const actA=[teamA[0],teamA[1]].filter(Boolean),actB=[teamB[0],teamB[1]].filter(Boolean);
  const benchA=teamA.slice(2),benchB=teamB.slice(2);
  setW(actA.concat(actB));
  const intim=(as,fs)=>{for(const m of as)if(m.ability==='intimidate')for(const f of fs)if(f&&!f.fainted)f.boosts.at=clamp(f.boosts.at-1,-6,6);};
  intim(actA,actB);intim(actB,actA);
  const live=arr=>arr.filter(m=>m&&!m.fainted&&m.curHP>0);
  const alive=(a,b)=>live(a).length+live(b).length>0;
  for(let turn=0;turn<20;turn++){
    if(!alive(actA,benchA)||!alive(actB,benchB))break;
    [...actA,...actB].forEach(m=>{if(m)m.protect=false;});
    const acts=[];
    const mk=(mon,side,foes,ally)=>{if(!mon||mon.fainted||mon.curHP<=0)return;acts.push({mon,side,a:chooseAction(mon,foes,ally,field,side,rng)});};
    mk(actA[0],'A',actB,actA[1]);mk(actA[1],'A',actB,actA[0]);mk(actB[0],'B',actA,actB[1]);mk(actB[1],'B',actA,actB[0]);
    for(const it of acts){if(it.a.kind==='protect'){it.mon.protect=true;it.mon.tookProtectTurns++;}else it.mon.tookProtectTurns=0;}
    const prio=it=>it.a.kind==='attack'?(PRIO[it.a.move.id]||0):(it.a.kind==='protect'?4:0);
    acts.sort((x,y)=>{const dp=prio(y)-prio(x);if(dp)return dp;let sp=effSpeed(y.mon,field,y.side)-effSpeed(x.mon,field,x.side);if(field.tr>0)sp=-sp;return sp||(rng()<0.5?-1:1);});
    for(const it of acts){const m=it.mon;if(m.fainted||m.curHP<=0)continue;
      if(m._flinch){m._flinch=false;continue;}
      if(m.status==='par'&&rng()<0.25)continue;
      if(m.status==='slp'){if(m.slp>0){m.slp--;continue;}else m.status='';}
      const a=it.a;
      if(a.kind==='setup'){m.boosts.at=clamp(m.boosts.at+1,-6,6);m.boosts.sa=clamp(m.boosts.sa+1,-6,6);m.boosts.sp=clamp(m.boosts.sp+1,-6,6);continue;}
      if(a.kind==='tail'){if(it.side==='A')field.twA=4;else field.twB=4;continue;}
      if(a.kind==='status'){const t=a.target;if(t&&!t.fainted&&!t.protect&&!t.status)applyStatus(t,['brn','par','slp'][rng()*3|0]);continue;}
      if(a.kind!=='attack')continue;
      const mv=a.move.mv;
      if(a.move.id==='fakeout'&&m._turnsOut>0)continue;   // Fake Out only works the turn you enter
      if((ACC[a.move.id]||100)<100&&rng()*100>(ACC[a.move.id]||100))continue;
      const foes=it.side==='A'?actB:actA;
      let targets=a.move.spread?live(foes):[a.target].filter(t=>t&&!t.fainted&&t.curHP>0);
      if(!targets.length)targets=live(foes).slice(0,1);
      for(const tg of targets){if(!tg||tg.fainted||tg.protect)continue;
        const d=dmgRange(m,tg,mv,field,a.move.spread&&targets.length>1);
        let dmg=d.min+Math.floor(rng()*(d.max-d.min+1));if(rng()<1/24)dmg=Math.floor(dmg*1.5);
        tg.curHP-=dmg;if(tg.curHP<=0){tg.curHP=0;tg.fainted=true;}
        else if(a.move.id==='fakeout')tg._flinch=true;}   // Fake Out flinches survivors
      if(m.item==='lifeorb'&&a.move.d.max>0){m.curHP-=Math.floor(m.st.hp*0.1);if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
    }
    for(const m of [...actA,...actB]){if(!m||m.fainted||m.curHP<=0)continue;
      if(m.status==='brn')m.curHP-=Math.floor(m.st.hp/16);
      if(m.item==='leftovers')m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/16));
      if(m.item==='sitrusberry'&&m.curHP<=m.st.hp/2){m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/4));m.item='';}
      if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
    if(field.weatherT>0&&--field.weatherT<=0)field.weather=null;
    if(field.twA>0)field.twA--;if(field.twB>0)field.twB--;if(field.tr>0)field.tr--;
    [...actA,...actB].forEach(m=>{if(m&&!m.fainted)m._turnsOut++;});
    const refill=(act,bench,foes)=>{for(let i=0;i<act.length;i++){if(act[i]&&act[i].fainted){const nx=live(bench)[0];if(nx){bench.splice(bench.indexOf(nx),1);nx._turnsOut=0;act[i]=nx;if(nx.ability==='intimidate')for(const f of live(foes))f.boosts.at=clamp(f.boosts.at-1,-6,6);}}}};
    refill(actA,benchA,actB);refill(actB,benchB,actA);
  }
  const aA=live(actA).length+live(benchA).length,bA=live(actB).length+live(benchB).length;
  if(aA!==bA)return aA>bA?1:0;
  const hp=(a,b)=>[...a,...b].reduce((s,m)=>s+(m?Math.max(0,m.curHP)/m.st.hp:0),0);
  const ha=hp(actA,benchA),hb=hp(actB,benchB);return ha>hb?1:(ha<hb?0:0.5);
}
function winProb2(nA,nB,N,ov){
  const A0=nA.slice(0,4).filter(n=>MC.mons[n]),B0=nB.slice(0,4).filter(n=>MC.mons[n]);
  if(!A0.length||!B0.length)return null;
  let w=0;for(let i=0;i<N;i++){w+=battle(A0.map(n=>buildMon(n,ov)),B0.map(n=>buildMon(n,ov)),ov);}return w/N;
}
root.winProb2=winProb2; root.dmgRange=dmgRange; root.buildMon=buildMon; root.MEDI_SPREAD=SPREAD;
if(typeof module!=='undefined'&&module.exports) module.exports={winProb2,dmgRange,buildMon,battle};
})(typeof window!=='undefined'?window:globalThis);
