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
/* THE TAG ARTIFACT is the source of truth for mechanics; see engine/tags.js.
 *
 * This file runs in BOTH node and the browser, so a bare require() would throw on the live site.
 * Under node it loads the module; in the browser it expects window.ABRA_TAGS (the same JSON) and
 * degrades to a null lookup if the page did not ship it -- which keeps the site working while
 * making the absence visible through TAGS.missing rather than silently scoring everything at x1. */
const TAGS = (function(){
  /* AN A/B SWITCH, so both arms of a head-to-head share one binary. ABRA_TAGS_OFF=1 makes every
   * lookup return null, which reverts the engine to exactly its pre-wire behaviour -- the honest
   * control for "did wiring the artifact make the bot stronger". Without this the comparison would
   * be against a different build, and half this project's null results came from arms that were not
   * actually comparable. */
  if (typeof process !== 'undefined' && process.env && process.env.ABRA_TAGS_OFF === '1') {
    return { off: true, param(){ return null; }, has(){ return false; },
             reactorsTo(){ return {abilities:[],items:[],moves:[]}; }, hits(){ return {}; } };
  }
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try { return require('./tags.js'); } catch (e) { /* fall through to the browser path */ }
  }
  const db = (typeof window !== 'undefined' && window.ABRA_TAGS) || null;
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const T = { move:'moves', item:'items', ability:'abilities' };
  return {
    missing: !db,
    param(kind, id, tag){
      if(!db) return null;
      const rec = (db[T[kind]]||{})[norm(id)];
      if(!rec || !rec.tags || !rec.tags.includes(tag)) return null;
      return (rec.params && rec.params[tag]) || {};
    },
    has(kind,id,tag){ return !!this.param(kind,id,tag); },
    reactorsTo(k){ return (db && db.linkage && db.linkage[k]) || {abilities:[],items:[],moves:[]}; },
    hits(){ return {}; }
  };
})();

const SPREAD = new Set(['earthquake','rockslide','heatwave','blizzard','muddywater','dazzlinggleam','hypervoice','makeitrain','glaciate','icywind','snarl','bulldoze','discharge','lavaplume','eruption','waterspout','surf','electroweb','strugglebug','sludgewave','mistyexplosion','explosion','selfdestruct','breakingswipe','petalblizzard','glaciallance','astralbarrage','originpulse','precipiceblades','landswrath','diamondstorm','sparklingaria','swift','pollenpuff']);
/* PRIORITY. Every move sits in a bracket from +5 (Helping Hand) down to -7 (Trick Room), and the
 * bracket is decided BEFORE speed. This was a hand-typed table of 18 positive-priority moves, and
 * everything absent from it resolved at 0 - so all 14 negative-priority moves went at normal speed.
 * Trick Room, which is -7 and must resolve last, was being treated as 0. Priority now comes from the
 * shared rulebook (Showdown's own value), so the bracket is right for all 954 moves.
 *
 * ONE documented exception: Grassy Glide is +1 only while Grassy Terrain is up, so Showdown stores no
 * static priority for it. It is kept here as a conditional, not as a hand-maintained duplicate. */
const PRIO_CONDITIONAL = { grassyglide:{ prio:1, needsTerrain:'grassy' } };
function movePriority(id, field){
  if(!id) return 0;
  const key=String(id).toLowerCase().replace(/[^a-z0-9]/g,'');
  const c=PRIO_CONDITIONAL[key];
  if(c) return (field&&field.terrain===c.needsTerrain)?c.prio:0;
  const fx=moveFx(key);
  return (fx&&typeof fx.priority==='number')?fx.priority:0;
}
const ACC = {hydropump:80,hurricane:70,fireblast:85,focusblast:70,thunder:70,blizzard:70,stoneedge:80,megahorn:85,gunkshot:80,iciclecrash:90,playrough:90,dynamicpunch:50,zapcannon:50,highjumpkick:90,drillrun:95,crosschop:80,sleeppowder:75,willowisp:85,thunderwave:90,hypnosis:60,irontail:75,dragonrush:75,inferno:50,fissure:30,sheercold:30,rockslide:90,airslash:95,gigaimpact:90,overheat:90,leafstorm:90,powerwhip:85,meteorbeam:90,muddywater:85,darkvoid:50,sing:55};
const PROTECTMOVES = new Set(['protect','detect','spikyshield','kingsshield','banefulbunker','burningbulwark','silktrap','maxguard']);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* Showdown spells stats atk/def/spa/spd/spe; this engine uses at/df/sa/sd/sp. A naming convention,
 * not a mechanic, so the map lives here rather than in data/tags.json. */
const SD2ENG={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp',accuracy:null,evasion:null};
const boostMul=s=>{s=clamp(s||0,-6,6);return s>=0?(2+s)/2:2/(2-s);};

// Mega abilities — sourced from Serebii's Champions data (not guessed). Champions runs BOTH the
// classic Megas (mainline abilities) AND a set of new Champions-only Megas with their own abilities.
const MEGA_ABIL={
  // classic Megas (mainline abilities) — stones present in the ladder data
  swampert:'swiftswim',venusaur:'thickfat',blastoise:'megalauncher',mawile:'hugepower',gengar:'shadowtag',
  gardevoir:'pixilate',gallade:'innerfocus',metagross:'toughclaws',aerodactyl:'toughclaws',tyranitar:'sandstream',
  garchomp:'sandforce',kangaskhan:'parentalbond',blaziken:'speedboost',scizor:'technician',sceptile:'lightningrod',
  alakazam:'trace',lucario:'adaptability',medicham:'purepower',manectric:'intimidate',absol:'magicbounce',
  sableye:'magicbounce',lopunny:'scrappy',heracross:'skilllink',pinsir:'aerilate',abomasnow:'snowwarning',
  altaria:'pixilate',beedrill:'adaptability',sharpedo:'strongjaw',camerupt:'sheerforce',banette:'prankster',houndoom:'solarpower',
  // Champions-specific Megas (Serebii megaabilities.shtml)
  staraptor:'contrary',malamar:'contrary',dragonite:'multiscale',glimmora:'adaptability',froslass:'snowwarning',
  chandelure:'infiltrator',delphox:'levitate',chimecho:'levitate',meowstic:'trace',clefable:'magicbounce',
  starmie:'hugepower',scrafty:'intimidate',greninja:'protean',dragalge:'regenerator',barbaracle:'toughclaws',
  chesnaught:'bulletproof',scolipede:'shellarmor',emboar:'moldbreaker',falinks:'defiant',drampa:'berserk',
  victreebel:'innardsout',golurk:'unseenfist',floette:'fairyaura',skarmory:'stalwart',crabominable:'ironfist',
  // Champions NEW abilities (effects added incrementally; labels correct now)
  excadrill:'piercingdrill',eelektross:'eelevate',pyroar:'firemane',meganium:'megasol',feraligatr:'dragonize',scovillain:'spicyspray',hawlucha:'noguard'};
function megaAbility(name,item,baseAb){ if(!item)return baseAb;
  if(name==='charizard'){ if(/itey$/.test(item))return 'drought'; if(/itex$/.test(item))return 'toughclaws'; }
  if(name==='raichu'){ if(/y$/.test(item))return 'noguard'; if(/x$/.test(item))return 'electricsurge'; }   // Raichunite Y / X
  if(MEGA_ABIL[name] && /ite[xy]?$/.test(item)) return MEGA_ABIL[name];
  return baseAb; }
/* Mega formes, from the SAME generated source the canonical engine uses (CHOMP/data/mega-formes.json,
 * exposed to the browser as window.MEGA_FORMES). This engine previously kept its own hand-written
 * mega table and never swapped mega STATS at all, so when the canonical engine learned real mega
 * stats the two silently disagreed by 30% on Charizard-Mega-Y's Special Attack. Reading one shared
 * file is what makes tests/test-engine-contract.js able to hold them together. */
function megaForme(item){
  const F=(typeof window!=='undefined'&&window.MEGA_FORMES)||null;
  if(!F||!item) return null;
  return F[String(item).toLowerCase().replace(/[^a-z0-9]/g,'')]||null;
}
// level-50 stat line, identical convention to champ-model's statL50/hpL50 (Champions SP system)
function l50(bs,sp){ const S=(b,v)=>Math.floor((Math.floor((2*b+31)*50/100)+5+(+v||0)));
  return { hp:Math.floor((2*bs.hp+31)*50/100)+50+10, at:S(bs.atk,sp&&sp.at), df:S(bs.def,sp&&sp.df),
           sa:S(bs.spa,sp&&sp.sa), sd:S(bs.spd,sp&&sp.sd), sp:S(bs.spe,sp&&sp.sp) }; }
function buildMon(name,ov){ const m=MC.mons[name]; if(!m)return null;
  const item=(ov&&ov[name])||m.item||'';
  const mf=megaForme(item);
  const types = mf&&mf.t&&mf.t.length ? mf.t.slice() : m.t.slice();
  /* Swap ONLY the base stats, keeping whatever SP investment this dataset already baked into m.st.
     Recomputing from scratch would silently drop the spread and make the mega look weaker than the
     base form. So: work out the SP the stored line implies, then re-apply it to the mega's bases. */
  let st = {...m.st};
  if(mf&&mf.bs){
    const base=l50(m.bs||{hp:0,atk:0,def:0,spa:0,spd:0,spe:0});
    const meg =l50(mf.bs);
    if(m.bs){ st={ hp:meg.hp+(m.st.hp-base.hp), at:meg.at+(m.st.at-base.at), df:meg.df+(m.st.df-base.df),
                   sa:meg.sa+(m.st.sa-base.sa), sd:meg.sd+(m.st.sd-base.sd), sp:meg.sp+(m.st.sp-base.sp) }; }
    else { st=meg; }
  }
  return {name,types,st,item,ability:megaAbility(name,item,m.ab||''),baseAbility:m.ab||'',moves:m.mv.slice(),
    curHP:st.hp,boosts:{at:0,df:0,sa:0,sd:0,sp:0},status:'',slp:0,fainted:false,protect:false,tookProtectTurns:0,_turnsOut:0,_flinch:false}; }

/* Does this move make contact? Read from the move's own flag via the tag artifact, which is the
 * `contact` linkage key -- 141 moves and 77,226 move-slots. No name list. */
const _contactCache=Object.create(null);
function mvMakesContact(id){
  if(!id) return false;
  const k=String(id).toLowerCase().replace(/[^a-z0-9]/g,'');
  if(k in _contactCache) return _contactCache[k];
  return (_contactCache[k]=TAGS.has('move',k,'contact'));
}

function dmgRange(att,def,mv,field,spread){
  if(!mv||!mv.bp)return {min:0,max:0,eff:mcEff(mv?mv.t:'',def.types)};
  const phys=mv.c==='P';
  let A=phys?att.st.at:att.st.sa,D=phys?def.st.df:def.st.sd;
  A=Math.floor(A*boostMul(phys?att.boosts.at:att.boosts.sa));
  D=Math.floor(D*boostMul(phys?def.boosts.df:def.boosts.sd));
  if(phys&&att.item==='choiceband')A=Math.floor(A*1.5);
  if(!phys&&att.item==='choicespecs')A=Math.floor(A*1.5);
  if(!phys&&def.item==='assaultvest')D=Math.floor(D*1.5);
  /* WEATHER RAISES A DEFENCE, and both halves were missing. Snow gives an Ice type x1.5 DEFENCE and
   * sand gives a Rock type x1.5 SPECIAL DEFENCE -- these are passive properties of the weather, not
   * abilities, so nothing in the ability chain above could ever have caught them. Found by Will
   * asking whether the engine knew; grep returned zero for both.
   *
   * Not a corner case: Snow Warning is 287,161 usage in this format and Sand Stream 147,107, and the
   * teams built around them are exactly the ones that field the Ice and Rock types this protects. The
   * effect is to OVERESTIMATE damage into every Rock in sand and every Ice in snow, which flows
   * straight into koTarget -- so MAG has been calling kills that cannot happen against the two
   * archetypes most likely to be running those types.
   *
   * Defence-raising only. Neither weather boosts the matching ATTACK, which is the natural
   * mis-statement of the rule and would be wrong in the opposite direction. */
  if(phys&&field.weather==='snow'&&def.types.includes('Ice'))D=Math.floor(D*1.5);
  if(!phys&&field.weather==='sand'&&def.types.includes('Rock'))D=Math.floor(D*1.5);
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
  const IMM={waterabsorb:'Water',stormdrain:'Water',dryskin:'Water',voltabsorb:'Electric',lightningrod:'Electric',motordrive:'Electric',flashfire:'Fire',wellbakedbody:'Fire',sapsipper:'Grass',levitate:'Ground',eartheater:'Ground',eelevate:'Ground'};
  if(IMM[def.ability]===mv.t)return{min:0,max:0,eff:0};
  const stab=att.types.includes(mv.t)?(att.ability==='adaptability'?2:1.5):1;
  const burn=(phys&&att.status==='brn'&&att.ability!=='guts')?0.5:1;
  /* WIRE 1 of N -- damageMultAll, from data/tags.json instead of a hardcoded name.
   * Was `att.item==='lifeorb'?1.3:1`, which is why the tag showed as "read": the string appeared.
   * The tag carries the same 1.3 AND the 1/10 max HP it charges per attack, which this calc still
   * does not apply -- recorded here rather than silently dropped, and owed a wire of its own. */
  const _all=TAGS.param('item',att.item,'damageMultAll');
  const lo=(_all&&_all.mult)||1;
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
  /* WIRE 2 of N -- damageMultType. This is a REAL GAIN, not a refactor: the eighteen type-boost
   * items on sheets (Black Glasses 1,332, Fairy Feather 1,521, Mystic Water 873, Charcoal 694 …
   * 5,918 uses) were entirely ABSENT from this calc. Every one of them was worth x1.0 here.
   * The tag names both the type and the factor, read from each item's own handler. */
  const _ty=TAGS.param('item',att.item,'damageMultType');
  if(_ty&&_ty.onType===mv.t&&_ty.mult)mod*=_ty.mult;
  /* Expert Belt is its own tag because it is conditional on the MATCHUP, not the type. */
  const _se=TAGS.param('item',att.item,'boostsSuperEffective');
  if(_se&&eff>1)mod*=(_se.mult||1.2);
  /* WIRE 3 of N -- resistBerry, on the DEFENDER. 6,479 holders and this calc had nothing for any of
   * them, which makes it the biggest single source of a kill that is not a kill.
   *
   * Will asked whether reading it here procs it. It does not, and the distinction matters: dmgRange
   * is a PURE read -- it never assigns to att or def -- and it is called dozens of times per turn
   * while scoring hypothetical moves. A mutation here would eat the berry during attacks that never
   * happen. The halve belongs here; the CONSUMPTION happens once, where real damage is applied.
   *
   * Chilan is the exception the tag already separates: it halves Normal with no effectiveness
   * requirement, so the condition comes from requiresSuperEffective rather than being assumed. */
  const _rb=TAGS.param('item',def.item,'resistBerry');
  if(_rb&&_rb.onType===mv.t&&(!_rb.requiresSuperEffective||eff>1))mod*=(_rb.mult||0.5);
  if(att.item==='muscleband'&&phys)mod*=1.1;
  if(att.item==='wiseglasses'&&!phys)mod*=1.1;
  const roll=r=>{let d=Math.floor(base*r/100);if(stab!==1)d=Math.floor(d*stab);d=Math.floor(d*eff);if(burn<1)d=Math.floor(d*burn);if(mod!==1)d=Math.floor(d*mod);if(lo>1)d=Math.floor(d*lo);return d;};
  return {min:roll(85),max:roll(100),eff};
}
const RECOIL={bravebird:1/3,flareblitz:1/3,wavecrash:1/3,doubleedge:1/3,volttackle:1/3,woodhammer:1/3,headsmash:1/2,lightofruin:1/2,wildcharge:1/4,takedown:1/4,submission:1/4,headcharge:1/4};
// move-specific self stat changes (negative = drop). Contrary REVERSES the sign, so e.g.
// Malamar's Superpower/Overheat RAISE the stat instead of dropping it — the classic Contrary combo.
const SELFDROP={closecombat:{df:-1,sd:-1},superpower:{at:-1,df:-1},overheat:{sa:-2},leafstorm:{sa:-2},dracometeor:{sa:-2},fleurcannon:{sa:-2},psychoboost:{sa:-2},makeitrain:{sa:-1},armorcannon:{df:-1,sd:-1},dragonascent:{df:-1,sd:-1},vcreate:{df:-1,sd:-1,sp:-1}};
function bestMoveVs(att,def,field){ let best=null,bs=-1;
  for(const id of att.moves){const mv=MC.moves[id];if(!mv||!mv.bp)continue;const acc=att.ability==='noguard'?1:(ACC[id]||100)/100;const d=dmgRange(att,def,mv,field,SPREAD.has(id));
    // value = expected damage discounted by accuracy AND by recoil self-damage (frail spammers shouldn't look free)
    const sc=((d.min+d.max)/2)*acc*(RECOIL[id]?0.85:1);
    if(sc>bs){bs=sc;best={id,mv,spread:SPREAD.has(id),d,acc};}}
  return best;
}
// pick the best target (max damage) for a SPECIFIC move
function targetForMove(me,id,live,field){ const mv=MC.moves[id]; if(!mv||!mv.bp)return null;
  let bt=null,bs=-1; for(const f of live){const d=dmgRange(me,f,mv,field,SPREAD.has(id));const sc=(d.min>=f.curHP?1e6:0)+d.max;if(sc>bs){bs=sc;bt={id,mv,spread:SPREAD.has(id),d,target:f};}}
  return bt; }
// MEDICHAM policy = behaviour cloning: sample what a real ladder player would click, but always
// take an obvious KO, and Protect defensively when threatened. This is the whole point of the model —
// the win rate is the expected outcome under *realistic* play by both sides, not optimal play.
/* POLICY SWITCH. `PURE_PRIORS` disables the three damage-dependent heuristics below, leaving only the
 * behaviour-clone prior sampling. It exists so this engine can be compared LIKE FOR LIKE against the
 * official simulator: the Showdown player (engine/prior_player.js) can sample priors but cannot run
 * the KO / Protect / Wide Guard heuristics, because the request object carries no damage numbers.
 * With this flag set, both sides are pure prior samplers, and any remaining difference in win rate is
 * attributable to the RULES rather than to how well each side plays. Off by default - normal rollouts
 * keep the heuristics, which is what makes them resemble real play. */
let PURE_PRIORS = false;
function setPurePriors(v){ PURE_PRIORS = !!v; }

function chooseAction(me,foes,ally,field,side,rng){
  // asleep? still pick a move — the turn loop applies Champions wake rules (33% turn 2, 100% turn 3)
  const live=foes.filter(f=>f&&!f.fainted&&f.curHP>0); if(!live.length)return{kind:'struggle'};
  // strongest option + is a KO available?
  let bestAtk=null,bestKO=-1,tgt=null;
  for(const f of live){const b=bestMoveVs(me,f,field);if(!b)continue;const acc=me.ability==='noguard'?1:(ACC[b.id]||100)/100;const ko=(b.d.min>=f.curHP?1:(b.d.max>=f.curHP?0.5:0))*acc;const sc=ko*1e4+b.d.max*acc;if(sc>bestKO){bestKO=sc;bestAtk=b;tgt=f;}}
  // a KO is only "guaranteed" if the move is accurate too — no relying on a 70% nuke
  const bestKOsNow=bestAtk&&tgt&&bestAtk.d.min>=tgt.curHP&&((ACC[bestAtk.id]||100)>=100||me.ability==='noguard');
  const incoming=live.reduce((mx,f)=>{const b=bestMoveVs(f,me,field);return b?Math.max(mx,b.d.max):mx;},0);
  const inDanger=incoming>=me.curHP*0.8;
  const canProtect=me.moves.some(id=>PROTECTMOVES.has(id));
  if(!PURE_PRIORS){
    // 1) take a guaranteed KO most of the time (real players do)
    if(bestKOsNow&&rng()<0.85) return {kind:'attack',move:bestAtk,target:tgt};
    // 2) Protect when threatened and can't KO back
    if(inDanger&&!bestKOsNow&&canProtect&&!me.protect&&me.tookProtectTurns<2&&rng()<0.5) return {kind:'protect'};
    // 3) Wide Guard against a spread threat
    if(me.moves.includes('wideguard')&&live.length>1&&me.tookProtectTurns<2&&!me.protect&&rng()<0.35){const foeSpread=live.some(fo=>(fo.moves||[]).some(id=>SPREAD.has(id)));if(foeSpread)return{kind:'wideguard'};}
  }
  // behaviour clone: sample the move this species actually clicks, at its real frequency
  const pr=MC.priors[me.name];
  if(pr){ let r=rng(),pick=null; for(const q of pr){r-=q[1];if(r<=0){pick={mv:q[0],kind:q[2]};break;}}
    if(pick){
      if(pick.kind==='protect'&&!me.protect&&me.tookProtectTurns<2)return{kind:'protect'};
      if(pick.kind==='setup'&&!inDanger&&(me.boosts.at+me.boosts.sa+me.boosts.sp)<4)return{kind:'setup'};
      if(pick.kind==='speed'&&((side==='A'?field.twA:field.twB)<=0))return{kind:'tail'};
      // carry the MOVE through, not just the intent: which status lands depends on which move it is
      if(pick.kind==='status'&&live.some(f=>!f.status))return{kind:'status',mv:pick.mv,target:live.find(f=>!f.status)};
      const chosen=targetForMove(me,pick.mv,live,field);            // the sampled damaging move
      if(chosen)return{kind:'attack',move:chosen,target:chosen.target};
    }}
  // 4) fallback: best available attack
  if(bestAtk)return{kind:'attack',move:bestAtk,target:tgt};
  return{kind:'struggle'};
}
function effSpeed(m,field,side){let s=m.st.sp*boostMul(m.boosts.sp);if(m.item==='choicescarf')s*=1.5;if((side==='A'?field.twA:field.twB)>0)s*=2;
  if((m.ability==='swiftswim'&&field.weather==='rain')||(m.ability==='chlorophyll'&&field.weather==='sun')||(m.ability==='sandrush'&&field.weather==='sand')||(m.ability==='slushrush'&&field.weather==='snow'))s*=2;
  if(m.status==='par')s*=0.5;return s;}
/* ---- SECONDARY AND PRIMARY MOVE EFFECTS -------------------------------------------------------
 * Read from the SHARED rulebook (CHOMP/data/move-effects.json, exposed here as window.MOVE_EFFECTS
 * by build/build_browser_data.js). Before this, the rollout had its own rules and they were wrong:
 *   - a status move applied a UNIFORMLY RANDOM status from ['brn','par','slp'], so Thunder Wave
 *     burned a third of the time and Will-O-Wisp could paralyse;
 *   - only Fake Out could ever flinch, so Rock Slide's 30% did nothing.
 * Reading the one rulebook is what lets the contract test hold this engine and champ-model together.
 */
let _FX=null;
function moveFxTable(){
  if(_FX) return _FX;
  _FX=(typeof window!=='undefined'&&window.MOVE_EFFECTS)||
      (typeof globalThis!=='undefined'&&globalThis.MOVE_EFFECTS)||null;
  /* In node the site's script tags do not exist, so load the generated file on first use. Without
   * this a node consumer silently gets NO secondary effects - the exact failure mode this change is
   * fixing - so it must load rather than degrade quietly. */
  if(!_FX&&typeof require!=='undefined'){
    try{ require('path'); require(require('path').join(__dirname,'..','data','move-effects.js'));
         _FX=(typeof globalThis!=='undefined'&&globalThis.MOVE_EFFECTS)||null; }catch(e){}
  }
  if(!_FX) throw new Error('MOVE_EFFECTS not loaded: include data/move-effects.js (generated by build/build_browser_data.js)');
  return _FX;
}
function moveFx(id){ if(!id) return null;
  return moveFxTable()[String(id).toLowerCase().replace(/[^a-z0-9]/g,'')]||null; }

/* Type and ability immunities. A Pokemon that cannot take a status must not take it - otherwise the
 * simulation paralyses Electric types and burns Fire types, which changes who wins. */
const STATUS_IMMUNE_TYPE={ brn:['Fire'], par:['Electric'], frz:['Ice'], psn:['Poison','Steel'], tox:['Poison','Steel'] };
const STATUS_IMMUNE_ABIL={ brn:['waterveil','waterbubble','comatose','thermalexchange'],
                           par:['limber','comatose'],
                           frz:['magmaarmor','comatose'],
                           psn:['immunity','comatose','poisonheal'],
                           tox:['immunity','comatose','poisonheal'],
                           slp:['insomnia','vitalspirit','comatose','sweetveil'] };
/* POWDER MOVES. Grass types are immune to all of them, as are Overcoat and Safety Goggles. This is
 * why Spore misses Rillaboom and Amoonguss entirely - a fact any bring recommendation depends on. */
const POWDER=new Set(['spore','sleeppowder','stunspore','poisonpowder','cottonspore','ragepowder',
                      'magicpowder','powder']);
function powderBlocked(t,moveId){
  if(!POWDER.has(String(moveId||'').replace(/[^a-z0-9]/g,''))) return false;
  const ab=(t.ability||'').replace(/[^a-z0-9]/g,'');
  return (t.types||[]).includes('Grass') || ab==='overcoat' ||
         String(t.item||'').replace(/[^a-z0-9]/g,'')==='safetygoggles';
}
/* PRANKSTER. Its +1 priority does not apply against Dark types, and the move fails on them outright
 * (Gen 7+). Prankster Thunder Wave into a Dark type does nothing at all. */
function pranksterBlocked(attacker,target,moveId){
  if((attacker.ability||'').replace(/[^a-z0-9]/g,'')!=='prankster') return false;
  const fx=moveFx(moveId);
  if(!fx||fx.category!=='Status') return false;
  return (target.types||[]).includes('Dark');
}
function canTakeStatus(t,st){
  if(!t||t.fainted||t.curHP<=0) return false;
  if(t.status) return false;                                  // one major status at a time
  const ab=(t.ability||'').replace(/[^a-z0-9]/g,'');
  if(ab==='shielddust') return false;                          // blocks secondary effects entirely
  const byType=STATUS_IMMUNE_TYPE[st]||[];
  if((t.types||[]).some(ty=>byType.includes(ty))) return false;
  if((STATUS_IMMUNE_ABIL[st]||[]).includes(ab)) return false;
  return true;
}
/* INTIMIDATE. This used to be an unconditional `boosts.at - 1` on every foe, which is wrong three
 * different ways, and Intimidate is on Incineroar - the most-used Pokemon in the format - so the
 * error was paid in almost every game:
 *   BLOCKED  by Clear Body, White Smoke, Full Metal Body, Hyper Cutter, Inner Focus, Oblivious,
 *            Own Tempo, Scrappy and Guard Dog. These take no drop at all.
 *   REVERSED by Defiant (+2 Attack) and Competitive (+2 Special Attack) - the target ends up
 *            STRONGER. Treating that as -1 gets the sign wrong, a 3-stage swing on Attack.
 *   FLIPPED  by Contrary (+1) and doubled by Simple (-2); Mirror Armor reflects it back.
 * Getting Defiant backwards means the engine thought a Defiant switch-in was punished when it is
 * actually rewarded - the exact read a bring/lead recommendation depends on. */
const INTIM_IMMUNE=['clearbody','whitesmoke','fullmetalbody','hypercutter','innerfocus','oblivious',
                    'owntempo','scrappy','guarddog','mirrorarmor'];
function applyIntimidate(f){
  if(!f||f.fainted) return 'none';
  const ab=(f.ability||'').replace(/[^a-z0-9]/g,'');
  if(INTIM_IMMUNE.includes(ab)) return 'blocked';
  if(ab==='defiant'){     f.boosts.at=clamp(f.boosts.at+2,-6,6); return 'defiant'; }
  if(ab==='competitive'){ f.boosts.sa=clamp(f.boosts.sa+2,-6,6); return 'competitive'; }
  if(ab==='contrary'){    f.boosts.at=clamp(f.boosts.at+1,-6,6); return 'contrary'; }
  if(ab==='simple'){      f.boosts.at=clamp(f.boosts.at-2,-6,6); return 'simple'; }
  f.boosts.at=clamp(f.boosts.at-1,-6,6);
  return 'dropped';
}
function applyStatus(t,st){if(!canTakeStatus(t,st))return false;t.status=st;
  if(st==='slp')t.slpTurns=0;if(st==='frz')t.frzTurns=0;if(st==='tox')t.toxTurns=0;return true;}

function battle(teamA,teamB,ov,rng){ rng=rng||Math.random;
  const field={weather:null,weatherT:0,twA:0,twB:0,tr:0,wgA:false,wgB:false};
  const setW=ms=>{for(const m of ms){if(m.ability==='drizzle'){field.weather='rain';field.weatherT=5;}else if(m.ability==='drought'){field.weather='sun';field.weatherT=5;}else if(m.ability==='sandstream'){field.weather='sand';field.weatherT=5;}else if(m.ability==='snowwarning'){field.weather='snow';field.weatherT=5;}}};
  const actA=[teamA[0],teamA[1]].filter(Boolean),actB=[teamB[0],teamB[1]].filter(Boolean);
  const benchA=teamA.slice(2),benchB=teamB.slice(2);
  setW(actA.concat(actB));
  const intim=(as,fs)=>{for(const m of as)if(m.ability==='intimidate')for(const f of fs)if(f&&!f.fainted)applyIntimidate(f);};
  intim(actA,actB);intim(actB,actA);
  const live=arr=>arr.filter(m=>m&&!m.fainted&&m.curHP>0);
  const alive=(a,b)=>live(a).length+live(b).length>0;
  for(let turn=0;turn<20;turn++){
    if(!alive(actA,benchA)||!alive(actB,benchB))break;
    [...actA,...actB].forEach(m=>{if(m)m.protect=false;});field.wgA=false;field.wgB=false;
    const acts=[];
    const mk=(mon,side,foes,ally)=>{if(!mon||mon.fainted||mon.curHP<=0)return;acts.push({mon,side,a:chooseAction(mon,foes,ally,field,side,rng)});};
    mk(actA[0],'A',actB,actA[1]);mk(actA[1],'A',actB,actA[0]);mk(actB[0],'B',actA,actB[1]);mk(actB[1],'B',actA,actB[0]);
    for(const it of acts){if(it.a.kind==='protect'){it.mon.protect=(it.mon.tookProtectTurns===0||rng()<Math.pow(1/3,it.mon.tookProtectTurns));it.mon.tookProtectTurns++;}else if(it.a.kind==='wideguard'){if(it.side==='A')field.wgA=true;else field.wgB=true;it.mon.tookProtectTurns=0;}else it.mon.tookProtectTurns=0;}
    /* Bracket first, then speed. Protect-likes are +4 and Wide Guard is +3 in the real game; a status
     * move sits in its own move's bracket (Thunder Wave 0, Trick Room -7), not a blanket 0. */
    const prio=it=>{
      const k=it.a.kind;
      if(k==='attack')    return movePriority(it.a.move.id, field);
      if(k==='protect')   return 4;
      if(k==='wideguard') return 3;
      if(k==='status')    return movePriority(it.a.mv, field);
      return 0;
    };
    acts.sort((x,y)=>{const dp=prio(y)-prio(x);if(dp)return dp;let sp=effSpeed(y.mon,field,y.side)-effSpeed(x.mon,field,x.side);if(field.tr>0)sp=-sp;return sp||(rng()<0.5?-1:1);});
    /* Move order is needed to resolve flinch correctly: a flinch only stops a target that has NOT
     * yet acted this turn. `acts` is already sorted into resolution order, so position in it IS the
     * move order. Without this, a slow Rock Slide would "flinch" a foe that had already attacked. */
    const actedAt=new Map(); acts.forEach((it,i)=>actedAt.set(it.mon,i));
    for(const [actIdx,it] of acts.entries()){const m=it.mon;if(m.fainted||m.curHP<=0)continue;
      if(m._flinch){m._flinch=false;continue;}
      if(m.status==='par'&&rng()<0.125)continue;   // Champions: 12.5% full-para (was 25%)
      if(m.status==='frz'){m.frzTurns=(m.frzTurns||0)+1;if(m.frzTurns>=3||rng()<0.25)m.status='';else continue;}   // Champions: 25%/attempt, guaranteed thaw turn 3
      if(m.status==='slp'){m.slpTurns=(m.slpTurns||0)+1;if(m.slpTurns>=3||(m.slpTurns===2&&rng()<1/3))m.status='';else continue;}   // Champions: 33% wake turn 2, 100% turn 3
      const a=it.a;
      if(a.kind==='setup'){m.boosts.at=clamp(m.boosts.at+1,-6,6);m.boosts.sa=clamp(m.boosts.sa+1,-6,6);m.boosts.sp=clamp(m.boosts.sp+1,-6,6);continue;}
      if(a.kind==='tail'){if(it.side==='A')field.twA=4;else field.twB=4;continue;}
      /* A status move inflicts the status THAT MOVE inflicts, at THAT MOVE's accuracy. This line used
       * to read `applyStatus(t, ['brn','par','slp'][rng()*3|0])` - a uniformly random pick, so Thunder
       * Wave burned a third of the time. The status and the accuracy now come from the rulebook. */
      if(a.kind==='status'){
        const t=a.target; if(!t||t.fainted||t.protect) continue;
        const fx=moveFx(a.mv);
        const st=(fx&&fx.status)||null;
        if(!st) continue;                                       // not a status-inflicting move; no effect
        if(powderBlocked(t,a.mv)) continue;                     // Grass / Overcoat / Safety Goggles
        if(pranksterBlocked(m,t,a.mv)) continue;                // Prankster does not touch Dark types
        const acc=(fx&&fx.accuracy===true)?100:((fx&&fx.accuracy)||ACC[a.mv]||100);
        if(rng()*100>acc) continue;                              // status moves miss (T-Wave 90, W-o-W 85)
        applyStatus(t,st);                                       // applyStatus enforces the immunities
        continue;
      }
      if(a.kind!=='attack')continue;
      const mv=a.move.mv;
      if(a.move.id==='fakeout'&&m._turnsOut>0)continue;   // Fake Out only works the turn you enter
      if((ACC[a.move.id]||100)<100&&rng()*100>(ACC[a.move.id]||100))continue;
      const foes=it.side==='A'?actB:actA;
      let targets=a.move.spread?live(foes):[a.target].filter(t=>t&&!t.fainted&&t.curHP>0);
      if(!targets.length)targets=live(foes).slice(0,1);
      if(a.move.spread&&((it.side==='A'&&field.wgB)||(it.side==='B'&&field.wgA)))targets=[];   // Wide Guard blocks spread
      let dealt=0;
      for(const tg of targets){if(!tg||tg.fainted)continue;
        if(tg.protect&&!(m.ability==='piercingdrill'&&mv.c==='P'))continue;   // Protect blocks — unless Piercing Drill (contact)
        const d=dmgRange(m,tg,mv,field,a.move.spread&&targets.length>1);
        let dmg=d.min+Math.floor(rng()*(d.max-d.min+1));if(rng()<1/24)dmg=Math.floor(dmg*1.5);
        if(tg.protect)dmg=Math.floor(dmg*0.25);   // Piercing Drill: contact hits through Protect for 25%
        dealt+=Math.min(dmg,tg.curHP);
        /* THE BERRY IS CONSUMED HERE AND ONLY HERE. dmgRange applied the halve as a pure read --
         * it is called dozens of times per turn on hypothetical moves and must never mutate -- so
         * the one-shot is spent at the point a real hit lands, exactly like the Sitrus line below. */
        const _rbHit=TAGS.param('item',tg.item,'resistBerry');
        if(_rbHit&&_rbHit.onType===mv.t&&(!_rbHit.requiresSuperEffective||d.eff>1))tg.item='';
        /* WIRE 5 -- punishesAttacker. Rough Skin (3,762 sheets) and its family were ABSENT: the
         * engine had no concept that touching something can cost you. Unlike buffsHolderOnHit this
         * does NOT compound -- it is a flat toll, so the right play is to keep attacking without
         * contact rather than to stop. Paid whether or not the target survived the hit, which is
         * why it sits outside the survivor branch below. Contact comes from the move's own flag. */
        const _pun=TAGS.param('ability',tg.ability,'punishesAttacker');
        if(_pun&&_pun.fraction&&mvMakesContact(a.move.id)){
          m.curHP-=Math.floor(m.st.hp/(+_pun.fraction));
          if(m.curHP<=0){m.curHP=0;m.fainted=true;}
        }
        tg.curHP-=dmg;if(tg.curHP<=0){tg.curHP=0;tg.fainted=true;}
        else {
          /* WIRE 4 of N -- buffsHolderOnHit and punishesAttacker, ONE dispatch through the `contact`
           * linkage key. Both were entirely absent from this engine.
           *
           * THIS IS WILL'S BELLIBOLT TURN. Discharge into Archaludon was resisted AND handed it a
           * free Stamina boost, and the bot could not see either half: it had no notion that hitting
           * something can make it STRONGER. buffsHolderOnHit compounds -- every hit makes the next
           * worse -- while punishesAttacker is a flat toll you can pay. Opposite decisions, which is
           * exactly why Will had them split into two tags.
           *
           * The order matters: the buff lands on a target that survived (checked above), and the
           * attacker toll is paid whether or not the target survived, so it sits outside this else.
           * Contact is read from the move's own flag via the linkage key rather than a name list. */
          const _buff=TAGS.param('ability',tg.ability,'buffsHolderOnHit');
          if(_buff&&_buff.boosts&&tg.boosts){
            /* The tag names the stats and the sizes, read from the handler's own this.boost({...}).
             * Showdown spells them atk/def/spa/spd/spe; this engine uses at/df/sa/sd/sp. That map is
             * a naming convention, not a mechanic, so it lives here rather than in the artifact. */
            for(const k in _buff.boosts){
              const st=SD2ENG[k]; if(!st||tg.boosts[st]==null)continue;
              tg.boosts[st]=clamp(tg.boosts[st]+_buff.boosts[k],-6,6);
            }
          }
          /* SECONDARY EFFECTS, from the shared rulebook. Rolled once per connecting hit, after
           * damage, and only on a target still standing. Previously ONLY Fake Out could flinch and
           * no attacking move could ever inflict a status, so Rock Slide, Iron Head, Scald, Nuzzle
           * and 207 others were inert. Shield Dust and Sheer Force suppress secondaries entirely. */
          const tgAb=(tg.ability||'').replace(/[^a-z0-9]/g,'');
          const mAb=(m.ability||'').replace(/[^a-z0-9]/g,'');
          const fx=moveFx(a.move.id);
          const suppressed = tgAb==='shielddust' || mAb==='sheerforce';
          if(fx&&fx.secondary&&!suppressed){
            for(const s of fx.secondary){
              if(rng()*100>=(s.chance==null?100:s.chance)) continue;
              if(s.status){ applyStatus(tg,s.status); }
              else if(s.volatile==='flinch'){
                /* Flinch needs BOTH conditions: the target must not have moved yet this turn, and
                 * Inner Focus blocks it outright. Position in `acts` is the move order. */
                const ti=actedAt.has(tg)?actedAt.get(tg):-1;
                if(ti>actIdx && tgAb!=='innerfocus') tg._flinch=true;
              }
            }
          }
          // Fake Out still flinches: it is a guaranteed flinch, and it always moves first (+3 priority)
          if(a.move.id==='fakeout'){ const ti=actedAt.has(tg)?actedAt.get(tg):-1;
            if(ti>actIdx && tgAb!=='innerfocus') tg._flinch=true; }
        }
        if(tg.ability==='spicyspray'&&mv.c==='P'&&!m.status&&!m.fainted)m.status='brn';}   // Spicy Spray: burns the (contact) attacker
      // recoil: frail spammers pay for Brave Bird / Flare Blitz / Wave Crash
      if(RECOIL[a.move.id]&&dealt>0){m.curHP-=Math.floor(dealt*RECOIL[a.move.id]);if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
      // self stat changes; Contrary flips drops into boosts (Malamar Superpower/Overheat ramp)
      const sdrop=SELFDROP[a.move.id];
      if(sdrop){const sgn=m.ability==='contrary'?-1:1;for(const k in sdrop)m.boosts[k]=clamp(m.boosts[k]+sdrop[k]*sgn,-6,6);}
      if(m.item==='lifeorb'&&a.move.d.max>0){m.curHP-=Math.floor(m.st.hp*0.1);if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
    }
    /* Flinch expires at the END of the turn it was applied. It used to be cleared only when the
     * flinched Pokemon tried to act, so a flinch landed by a SLOWER attacker (impossible to use this
     * turn) sat on the flag and stole the target's NEXT turn instead. Fake Out's +3 priority hid this
     * because it almost always moved first; adding Rock Slide's flinch would have made it common. */
    [...actA,...actB].forEach(m=>{if(m)m._flinch=false;});
    for(const m of [...actA,...actB]){if(!m||m.fainted||m.curHP<=0)continue;
      if(m.status==='brn')m.curHP-=Math.floor(m.st.hp/16);
      if(m.status==='psn')m.curHP-=Math.floor(m.st.hp/8);                       // regular poison: a flat 1/8
      if(m.status==='tox'){m.toxTurns=(m.toxTurns||0)+1;                        // Toxic: n/16, escalating
        m.curHP-=Math.floor(m.st.hp*Math.min(15,m.toxTurns)/16);}
      if(m.item==='leftovers')m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/16));
      if(m.item==='sitrusberry'&&m.curHP<=m.st.hp/2){m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/4));m.item='';}
      if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
    if(field.weatherT>0&&--field.weatherT<=0)field.weather=null;
    if(field.twA>0)field.twA--;if(field.twB>0)field.twB--;if(field.tr>0)field.tr--;
    [...actA,...actB].forEach(m=>{if(m&&!m.fainted)m._turnsOut++;});
    const refill=(act,bench,foes)=>{for(let i=0;i<act.length;i++){if(act[i]&&act[i].fainted){const nx=live(bench)[0];if(nx){bench.splice(bench.indexOf(nx),1);nx._turnsOut=0;act[i]=nx;if(nx.ability==='intimidate')for(const f of live(foes))applyIntimidate(f);}}}};   /* mid-game switch-in uses the same Intimidate rules */
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
// exported for tests: the rulebook-reading helpers must be assertable on their own, so a wrong
// priority or a missed immunity fails a unit test rather than showing up as a drifted win rate.
if(typeof module!=='undefined'&&module.exports) module.exports={winProb2,dmgRange,buildMon,battle,
  moveFx,movePriority,canTakeStatus,applyStatus,applyIntimidate,powderBlocked,pranksterBlocked,setPurePriors};
})(typeof window!=='undefined'?window:globalThis);
