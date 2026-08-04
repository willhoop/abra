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
  if (typeof process !== 'undefined' && process.env) {
    const OFF_STUB = { off: true, param(){ return null; }, has(){ return false; },
                       reactorsTo(){ return {abilities:[],items:[],moves:[]}; }, hits(){ return {}; } };
    OFF_STUB.withTag=function(){return [];};
    if (process.env.ABRA_TAGS_OFF === '1') return OFF_STUB;
    /* ABRA_TAGS_OFF_TREE=<path> turns tags off ONLY for the copy of this file living under <path>.
     * The global switch above cannot arm a paired head-to-head: both arms battle inside ONE process
     * (mew.js --policy score --policy2 score@<worktree>), so a process-wide env var flips both arms
     * together. Scoping the switch to a directory lets a worktree of the SAME commit be the control
     * arm — identical code, identical tracked data, the artifact lookup is the only difference.
     * The trailing-slash compare stops ../ABRA from matching ../ABRA-old (a real prefix hazard). */
    if (process.env.ABRA_TAGS_OFF_TREE && typeof __dirname === 'string') {
      const norm = s => String(s).replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase() + '/';
      if (norm(__dirname).startsWith(norm(process.env.ABRA_TAGS_OFF_TREE))) return OFF_STUB;
    }
  }
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try { return require('./tags.js'); } catch (e) { /* fall through to the browser path */ }
  }
  const db = (typeof window !== 'undefined' && window.ABRA_TAGS) || null;
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const T = { move:'moves', item:'items', ability:'abilities' };
  return {
    missing: !db,
    withTag(kind, tag){
      const t=db&&db[T[kind]]; if(!t) return [];
      return Object.keys(t).filter(id=>(t[id].tags||[]).includes(tag));
    },
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

/* WIRE 15 -- the spread table is DERIVED. The 34-name set below is kept ONLY as the tags-off
 * control arm's world (pre-wire behaviour, exactly), and as the browser fallback when no artifact
 * shipped. With tags on, membership comes from the artifact's two spread tags -- and the split
 * matters: spreadFoes is ally-safe (Heat Wave), spreadAll HITS YOUR PARTNER (Earthquake, Discharge,
 * Surf -- "the one that killed its own Archaludon"), which the old set flattened into one shape
 * and the battle loop then ignored: no rollout Earthquake has ever hit its own ally. */
const SPREAD_LEGACY = new Set(['earthquake','rockslide','heatwave','blizzard','muddywater','dazzlinggleam','hypervoice','makeitrain','glaciate','icywind','snarl','bulldoze','discharge','lavaplume','eruption','waterspout','surf','electroweb','strugglebug','sludgewave','mistyexplosion','explosion','selfdestruct','breakingswipe','petalblizzard','glaciallance','astralbarrage','originpulse','precipiceblades','landswrath','diamondstorm','sparklingaria','swift','pollenpuff']);
const HITS_ALLY = new Set(TAGS.withTag ? TAGS.withTag('move', 'spreadAll') : []);
const SPREAD = (TAGS.off || TAGS.missing || !TAGS.withTag)
  ? SPREAD_LEGACY
  : new Set([...TAGS.withTag('move', 'spreadFoes'), ...HITS_ALLY]);
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
/* WHO REFUSES PRIORITY, in one place, because four consumers were each answering it differently.
 *
 * Will: "farig and tsareena blocking prio, same with psychic terrain, is that all coded in" -- and
 * the honest answer was that data/tags.json has carried armortail, queenlymajesty and dazzling
 * tagged blocksMove {what:'priority', priorityAbove:0} since tag_dex was written, while the only
 * thing that ever read it was clickFragility's bench check. The battle loop below sorted priority
 * moves to the front and let them connect; board.js's move-order features never heard of them; and
 * Psychic Terrain's block was not modelled anywhere at all.
 *
 * Returns the highest priority that still RESOLVES against this side -- so `Infinity` means nothing
 * is refused, and 0 means anything above +0 fails. A blocked move does not lose the speed tie, it
 * FAILS, which is why callers drop it rather than reorder it.
 *
 * DERIVED, NOT NAMED: the ability set and the threshold both come out of the artifact, so an ability
 * added later with the same tag shape is picked up without editing this file. */
let _prioBar=null;
function priorityBlockAbilities(){
  if(_prioBar) return _prioBar;
  _prioBar=new Map();
  try{
    for(const id of (TAGS.withTag?TAGS.withTag('ability','blocksMove'):[])){
      const p=TAGS.param('ability',id,'blocksMove');
      if(p&&p.what==='priority') _prioBar.set(id, typeof p.priorityAbove==='number'?p.priorityAbove:0);
    }
  }catch(e){}
  return _prioBar;
}
function priorityRefusedAbove(defenders, field){
  const bar=priorityBlockAbilities();
  let out=Infinity;
  for(const d of (defenders||[])){
    if(!d||d.fainted) continue;
    const ab=String(d.ability||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(ab&&bar.has(ab)) out=Math.min(out,bar.get(ab));
  }
  /* Psychic Terrain refuses priority against grounded targets. Grounded-ness is not tracked in this
   * engine, so this applies it unconditionally and says so: the common case is a grounded target and
   * ignoring the terrain entirely is wrong far more often than this is. */
  if(field&&String(field.terrain||'').toLowerCase().replace(/[^a-z0-9]/g,'')==='psychicterrain') out=Math.min(out,0);
  return out;
}

const ACC = {hydropump:80,hurricane:70,fireblast:85,focusblast:70,thunder:70,blizzard:70,stoneedge:80,megahorn:85,gunkshot:80,iciclecrash:90,playrough:90,dynamicpunch:50,zapcannon:50,highjumpkick:90,drillrun:95,crosschop:80,sleeppowder:75,willowisp:85,thunderwave:90,hypnosis:60,irontail:75,dragonrush:75,inferno:50,fissure:30,sheercold:30,rockslide:90,airslash:95,gigaimpact:90,overheat:90,leafstorm:90,powerwhip:85,meteorbeam:90,muddywater:85,darkvoid:50,sing:55};
const PROTECTMOVES = new Set(['protect','detect','spikyshield','kingsshield','banefulbunker','burningbulwark','silktrap','maxguard']);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* Showdown spells stats atk/def/spa/spd/spe; this engine uses at/df/sa/sd/sp. A naming convention,
 * not a mechanic, so the map lives here rather than in data/tags.json. */
const SD2ENG={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp',accuracy:null,evasion:null};
/* Same species of map as SD2ENG: the artifact speaks Showdown's names ("paralysis", "sandstorm"),
 * this engine speaks its own ('par', 'sand'). Naming conventions, not mechanics, so they live here. */
const CODE_OF_STATUS={paralysis:'par',burn:'brn',poison:'psn','bad poison':'tox',sleep:'slp',freeze:'frz'};
const SD2WEATHER={sandstorm:'sand',raindance:'rain',sunnyday:'sun',snowscape:'snow',snow:'snow',hail:'snow'};
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
  /* AN EXPLICIT EMPTY STRING MEANS NO ITEM, and `||` could not express that: buildMon(n,{n:''})
   * fell through to the table item, so an item-less mon was unbuildable. Every with-item/without-item
   * ratio was therefore item vs THE TABLE'S ITEM, not item vs nothing -- it only looked right while
   * the table happened to store something inert. The moment real sheets put Life Orb on Garchomp,
   * tests/test-tag-wire.js measured Life Orb against Life Orb and got x1.000. Caught 2026-07-31 when
   * the sets were rebuilt from open sheets. */
  const item=(ov&&ov[name]!=null)?ov[name]:(m.item||'');
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
  return {name,types,st,item,wt:m.wt||null,ability:megaAbility(name,item,m.ab||''),baseAbility:m.ab||'',moves:m.mv.slice(),
    curHP:st.hp,boosts:{at:0,df:0,sa:0,sd:0,sp:0},status:'',slp:0,fainted:false,protect:false,tookProtectTurns:0,_turnsOut:0,_flinch:false,_seededBy:null,
    /* THE DEATH COUNTER (Will: "the supreme overlord needs a count of the dead like last
     * respects"). _sf is a per-SIDE live counter shared by reference — Last Respects reads it at
     * each use. _fallenStuck is the SNAPSHOT taken when this mon entered — Supreme Overlord's
     * number, frozen for the stay exactly as its handler freezes effectState.fallen ("that only
     * works on first switchin, then the status is tuck" — confirmed against the source). */
    _sf:null,_fallenStuck:0}; }

/* ---- POKEPASTE IMPORT (Will: "can i pokepaste a team?") --------------------------------------
 * Mirrors CHOMP/engine/champ-model.js parsePaste + its VALIDATED stat math, and
 * tests/test-paste.js pins the two implementations together against Will's own myteam.txt so they
 * cannot drift apart. The math that matters and would have been silently wrong from memory:
 * Champions EVs are FLAT stat points added on top (statL50 adds +sp inside the nature multiply,
 * hpL50 adds +sp after) — NOT the mainline EV/4 formula. Nature is the standard 10% chart. */
const PASTE_NAT={adamant:['at','sa'],jolly:['sp','sa'],modest:['sa','at'],timid:['sp','at'],
  bold:['df','at'],calm:['sd','at'],careful:['sd','sa'],impish:['df','sa'],relaxed:['df','sp'],
  sassy:['sd','sp'],quiet:['sa','sp'],brave:['at','sp'],naive:['sp','sd'],hasty:['sp','df'],
  lonely:['at','df'],mild:['sa','df'],rash:['sa','sd'],gentle:['sd','df'],naughty:['at','sd'],lax:['df','sd']};
function parsePaste(text){
  const sets=[];
  for(const block of String(text||'').split(/\n\s*\n/)){
    const lines=block.trim().split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length)continue;
    let head=lines[0]; if(/^(===|\[)/.test(head))continue;
    const at=head.split(' @ ');
    const item=at.length>1?at[1].trim():null;
    let species=at[0].trim();
    const par=species.match(/\(([^)]+)\)\s*$/);
    if(par&&!['M','F'].includes(par[1]))species=par[1];
    species=species.replace(/\s*\((M|F)\)\s*$/,'').trim();
    const set={species,item,ability:null,nature:null,sp:{hp:0,at:0,df:0,sa:0,sd:0,sp:0},moves:[]};
    for(let i=1;i<lines.length;i++){
      const L=lines[i];
      if(/^Ability:/i.test(L))set.ability=L.split(':')[1].trim();
      else if(/Nature/i.test(L))set.nature=L.replace(/Nature/i,'').trim();
      else if(/^EVs:/i.test(L)){L.split(':')[1].split('/').forEach(p=>{
        const m2=p.trim().match(/(\d+)\s*(\w+)/);
        if(m2){const k={hp:'hp',atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'}[m2[2].toLowerCase()];if(k)set.sp[k]=+m2[1];}});}
      else if(/^-\s/.test(L))set.moves.push(L.replace(/^-\s*/,'').split('/')[0].trim());
    }
    if(set.species)sets.push(set);
  }
  return sets;
}
/* species name -> MC.mons key: lowercase, spaces to hyphens (the table's own convention),
 * -mega suffix stripped because the STONE decides the forme, exactly as buildMon does */
function pasteKey(name){
  let n=String(name||'').toLowerCase().trim().replace(/[’'.]/g,'').replace(/\s+/g,'-');
  n=n.replace(/-mega(-[xy])?$/,'');
  if(MC.mons[n])return n;
  const flat=n.replace(/-/g,'');
  for(const k in MC.mons)if(k.replace(/-/g,'')===flat)return k;
  return null;
}
function buildMonFromSet(set){
  let key=pasteKey(set.species);
  if(!key)return null;
  const item=String(set.item||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  /* THE STONE DECIDES THE FORME, and in THIS table megas are their own species entries with real
   * base stats — so "Gengar @ Gengarite" must resolve to gengar-mega's bs, or the import builds a
   * mega with base stats (caught by the champ-model contract test: SpA 182 where truth is 222). */
  if(/ite(x|y)?$/.test(item)&&!/-mega/.test(key)){
    const suffix=/itex$/.test(item)?'-mega-x':(/itey$/.test(item)?'-mega-y':'-mega');
    if(MC.mons[key+suffix])key=key+suffix;
  }
  const m=MC.mons[key];
  if(!m||!m.bs)return null;
  const bs=m.bs;
  const types=m.t.slice();
  const nat=PASTE_NAT[String(set.nature||'').toLowerCase()]||[];
  const mul=st2=>nat[0]===st2?1.1:(nat[1]===st2?0.9:1);
  const S=(b,sp2,st2)=>Math.floor((Math.floor((2*b+31)*50/100)+5+(+sp2||0))*mul(st2));
  const st={hp:Math.floor((2*bs.hp+31)*50/100)+50+10+(+set.sp.hp||0),
    at:S(bs.atk,set.sp.at,'at'),df:S(bs.def,set.sp.df,'df'),
    sa:S(bs.spa,set.sp.sa,'sa'),sd:S(bs.spd,set.sp.sd,'sd'),sp:S(bs.spe,set.sp.sp,'sp')};
  const norm2=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const declaredAb=norm2(set.ability);
  /* Keep every move the engine can DO anything with: damaging (move table), protect-class, or a
   * rulebook status move. Protect and Perish Song were being dropped by a damaging-only filter —
   * a pasted team without its Protects is a different team. Truly invisible moves are recorded on
   * droppedMoves so a UI can disclose them instead of silently thinning the set. */
  const ids=set.moves.map(norm2);
  const usable=ids.filter(id=>MC.moves[id]||PROTECTMOVES.has(id)||id==='wideguard'||id==='tailwind'||moveFx(id));
  return {name:key,types,st,item,wt:m.wt||null,
    ability:declaredAb||megaAbility(key,item,m.ab||''),baseAbility:m.ab||'',
    moves:usable,droppedMoves:ids.filter(id=>usable.indexOf(id)<0),
    curHP:st.hp,boosts:{at:0,df:0,sa:0,sd:0,sp:0},status:'',slp:0,fainted:false,protect:false,
    tookProtectTurns:0,_turnsOut:0,_flinch:false,_seededBy:null,_sf:null,_fallenStuck:0};
}

/* Does this move make contact? Read from the move's own flag via the tag artifact, which is the
 * `contact` linkage key -- 141 moves and 77,226 move-slots. No name list. */
const _contactCache=Object.create(null);
function mvMakesContact(id){
  if(!id) return false;
  const k=String(id).toLowerCase().replace(/[^a-z0-9]/g,'');
  if(k in _contactCache) return _contactCache[k];
  return (_contactCache[k]=TAGS.has('move',k,'contact'));
}

/* The compact move table stores no id on the move object, and dmgRange's signature is shared with
 * every caller, so the id is stamped ONTO the table once -- derived from the table's own key, which
 * is the id. Lazy because in the browser this module can load before window.MC does. */
let _mvIdsStamped=false;
function stampMoveIds(){
  if(_mvIdsStamped)return;
  const T=(typeof MC!=='undefined'&&MC&&MC.moves)?MC.moves:null; if(!T)return;
  for(const k in T)if(T[k]&&typeof T[k]==='object')T[k].id=k;
  _mvIdsStamped=true;
}
/* WIRE 7 -- weatherScaled, accuracy half. Thunder and Hurricane are 100-acc in rain and 50 in sun,
 * Blizzard is 100 in snow; the ACC table alone said 70/70/70 in every sky. The artifact names the
 * weather and the number; this helper is the single accuracy authority for both the battle loop's
 * to-hit roll and chooseAction's expected-value scoring. */
function moveAccuracy(id,field){
  stampMoveIds();
  const _ws=TAGS.param('move',id,'weatherScaled');
  if(_ws&&_ws.byWeather&&field&&field.weather){
    const w=_ws.byWeather[field.weather];
    if(w&&w.accuracy!=null)return w.accuracy;
  }
  return ACC[id]||100;
}
/* the type a move actually HAS under the current sky — one authority for the damage calc, the
 * absorb check in the battle loop, and the fragility pricer, so sand Weather Ball is a Rock move
 * to all three or to none */
function effMoveType(mv,moveId,field){
  const w=moveId&&TAGS.param('move',moveId,'weatherScaled');
  if(w&&w.byWeather&&field&&field.weather){const x=w.byWeather[field.weather];if(x&&x.type)return x.type;}
  return mv?mv.t:'';
}
/* WIRE 21 -- variablePower: does this move have power AT ALL, and what is it right now?
 * Low Kick and Grass Knot carry bp 0 in the table (the power IS the calculation), so the old
 * `!mv.bp` gate scored them as non-damaging everywhere -- 1.27% of move slots doing zero. The
 * absolute kinds (weight brackets) grant power through the gate; the conditional kinds multiply
 * a real base. */
function hasPower(mv){
  if(!mv)return false;
  if(mv.bp)return true;
  stampMoveIds();
  const v=mv.id&&TAGS.param('move',mv.id,'variablePower');
  return !!(v&&(v.kind==='targetWeightKg'||v.kind==='weightRatio'));
}
function dmgRange(att,def,mv,field,spread){
  stampMoveIds();
  if(!mv||!hasPower(mv))return {min:0,max:0,eff:mcEff(mv?mv.t:'',def.types)};
  /* WIRE 7 -- weatherScaled, damage half. Weather Ball was Normal 50 BP in every sky; in sand it is
   * a 100 BP Rock move, which is a different move. Solar Beam sheds half its power in rain, sand and
   * snow. The type and power overrides happen HERE, before STAB, effectiveness, the rain/sun x1.5,
   * items and absorb abilities, so every downstream read sees the move the weather actually makes.
   * chargeSkip is carried by the artifact but has no state to land on: this engine plays every move
   * in one turn, so Solar Beam is (wrongly, pre-existing) never charged anywhere -- stated, not fixed
   * by pretending. Pure: mv is never mutated, the overrides live in locals. */
  let mvT=mv.t,mvBP=mv.bp;
  const _ws=mv.id&&TAGS.param('move',mv.id,'weatherScaled');
  if(_ws&&_ws.byWeather&&field&&field.weather){
    const w=_ws.byWeather[field.weather];
    if(w){if(w.type)mvT=w.type;if(w.bpMult)mvBP=Math.floor(mvBP*w.bpMult);}
  }
  /* WIRE 9 -- the death counter, both freshness rules (Will's split). Last Respects reads the
   * side's LIVE count at each use; Supreme Overlord multiplies by the snapshot FROZEN at this
   * attacker's entry. Both zero when no counter is attached (site calls, unit tests). */
  const _pf=mv.id&&TAGS.param('move',mv.id,'powerFromFallen');
  if(_pf&&att._sf&&att._sf.fainted)mvBP=_pf.base+_pf.perFallen*Math.min(att._sf.fainted,5);
  /* WIRE 21, the power itself: weight brackets (kg, from the handler's own table), user-HP scaling
   * (a hurt Eruption is a weak Eruption), doubled-vs-status (Hex), doubled-itemless (Acrobatics),
   * and Knock Off's x1.5 when the target actually holds something -- sheet-known on open sheets. */
  const _vp=mv.id&&TAGS.param('move',mv.id,'variablePower');
  if(_vp&&_vp.kind){
    if(_vp.kind==='targetWeightKg'&&def.wt){for(const _b of _vp.brackets){if(def.wt>=_b[0]){mvBP=_b[1];break;}}}
    else if(_vp.kind==='weightRatio'&&att.wt&&def.wt){const _r=att.wt/def.wt;for(const _b of _vp.brackets){if(_r>=_b[0]){mvBP=_b[1];break;}}}
    else if(_vp.kind==='userHPFrac'&&att.st&&att.curHP!=null)mvBP=Math.max(1,Math.floor(mvBP*att.curHP/att.st.hp));
    else if(_vp.kind==='targetStatused'&&def.status)mvBP=mvBP*_vp.mult;
    else if(_vp.kind==='userNoItem'&&!att.item)mvBP=mvBP*_vp.mult;
    else if(_vp.kind==='targetHasItem'&&def.item)mvBP=mvBP*_vp.mult;
  }
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
  /* ONE READ OF THE ATTACKER'S ABILITY, reused. The ratcheted raw-identity count is a fitness
     function, not a style rule: it fired when the Infiltrator check below added a 235th raw read
     against a baseline of 234. Hoisting is the fix rather than a re-baseline -- the value cannot
     change inside a pure damage calc, so one local is strictly better than four lookups. */
  const attAb=att.ability;
  if((attAb==='hugepower'||attAb==='purepower')&&phys)A*=2;
  // --- stat-multiplying abilities (validated gaps vs @smogon/calc) ---
  if(attAb==='guts'&&phys&&att.status&&att.status!=='none')A=Math.floor(A*1.5);
  if(att.ability==='solarpower'&&!phys&&field.weather==='sun')A=Math.floor(A*1.5);
  if(att.ability==='orichalcumpulse'&&phys&&field.weather==='sun')A=Math.floor(A*5461/4096);
  if(att.ability==='hadronengine'&&!phys&&field.terrain==='electric')A=Math.floor(A*5461/4096);
  // Ruin abilities lower everyone-else's stat (field-wide; handled pairwise)
  if(phys&&att.ability==='swordofruin')D=Math.floor(D*0.75);
  if(!phys&&att.ability==='beadsofruin')D=Math.floor(D*0.75);
  if(phys&&def.ability==='tabletsofruin')A=Math.floor(A*0.75);
  if(!phys&&def.ability==='vesselofruin')A=Math.floor(A*0.75);
  let base=Math.floor(Math.floor(22*mvBP*A/D)/50)+2;
  if(spread)base=Math.floor(base*0.75);
  const _bf=TAGS.param('ability',att.ability,'boostsFromFallen');
  if(_bf&&att._fallenStuck)base=Math.floor(base*(1+_bf.perFallen*Math.min(att._fallenStuck,_bf.max)));
  if(field.weather==='rain'){if(mvT==='Water')base=Math.floor(base*1.5);if(mvT==='Fire')base=Math.floor(base*0.5);}
  if(field.weather==='sun'){if(mvT==='Fire')base=Math.floor(base*1.5);if(mvT==='Water')base=Math.floor(base*0.5);}
  if(att.ability==='technician'&&mvBP<=60)base=Math.floor(base*1.5);
  /* WIRE 13 -- boostsMoveClass x moveClass, the join the artifact was built for: the ability names
   * a FLAG and its multiplier (Tough Claws contact x1.3, Sharpness slicing x1.5, Mega Launcher
   * pulse x1.5 -- half the meta megas carry one), the move carries the flag, and no per-ability
   * case exists anywhere. Contact and sound ride their own tags; the rest live in moveClass. */
  const _bc=TAGS.param('ability',att.ability,'boostsMoveClass');
  if(_bc&&_bc.mult&&mv.id){
    const _f=_bc.boostsFlag;
    const _has=_f==='contact'?mvMakesContact(mv.id)
             :_f==='sound'?TAGS.has('move',mv.id,'sound')
             :(()=>{const c=TAGS.param('move',mv.id,'moveClass');return !!(c&&c.classes&&c.classes.indexOf(_f)>=0);})();
    if(_has)base=Math.floor(base*_bc.mult);
  }
  const eff=mcEff(mvT,def.types); if(eff===0)return{min:0,max:0,eff:0};
  // type-immunity abilities (defender absorbs the type)
  /* WIRE 11 -- typeImmunity, from the artifact instead of a 12-name table. The tag carries the
   * TYPE (checked against the weather-effective type computed above, so sand Weather Ball sails
   * past Volt Absorb) and the GAIN, which the old table never knew existed -- the battle loop
   * feeds the absorber below. Levitate/Eelevate ride the artifact's one documented name-exception. */
  const _imm=TAGS.param('ability',def.ability,'typeImmunity');
  if(_imm&&_imm.type===mvT)return{min:0,max:0,eff:0};
  const stab=att.types.includes(mvT)?(att.ability==='adaptability'?2:1.5):1;
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
  /* SCREENS. In DOUBLES the reduction is x2732/4096, not the x0.5 the tag carries — the tag states
   * the singles value and this is a doubles engine, so using 0.5 would overvalue every screen click
   * by a third. Stated here rather than corrected in the artifact, because the artifact is right
   * about singles and other consumers read it.
   * KNOWN SIMPLIFICATION, said out loud: a critical hit ignores screens, and this applies the
   * reduction to the whole range. dmgRange has no crit flag to branch on, so the alternative was to
   * skip screens entirely — a third off every hit is closer than nothing off any hit.
   * Infiltrator ignores screens, and the ability tag says which abilities do. */
  const _sf=def&&def._sf;
  if(_sf&&!TAGS.has('ability',attAb,'ignoresScreensAndSubs')){
    if(mv.c==='P'&&_sf.scrP>0)mod*=DOUBLES_SCREEN;
    if(mv.c==='S'&&_sf.scrS>0)mod*=DOUBLES_SCREEN;
  }
  if(def.ability==='thickfat'&&(mvT==='Fire'||mvT==='Ice'))mod*=0.5;
  if(def.ability==='heatproof'&&mvT==='Fire')mod*=0.5;
  if(def.ability==='purifyingsalt'&&mvT==='Ghost')mod*=0.5;
  if(att.ability==='waterbubble'&&mvT==='Water')mod*=2;
  if(def.ability==='waterbubble'&&mvT==='Fire')mod*=0.5;
  /* WIRE 2 of N -- damageMultType. This is a REAL GAIN, not a refactor: the eighteen type-boost
   * items on sheets (Black Glasses 1,332, Fairy Feather 1,521, Mystic Water 873, Charcoal 694 …
   * 5,918 uses) were entirely ABSENT from this calc. Every one of them was worth x1.0 here.
   * The tag names both the type and the factor, read from each item's own handler. */
  const _ty=TAGS.param('item',att.item,'damageMultType');
  if(_ty&&_ty.onType===mvT&&_ty.mult)mod*=_ty.mult;
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
  if(_rb&&_rb.onType===mvT&&(!_rb.requiresSuperEffective||eff>1))mod*=(_rb.mult||0.5);
  if(att.item==='muscleband'&&phys)mod*=1.1;
  if(att.item==='wiseglasses'&&!phys)mod*=1.1;
  const roll=r=>{let d=Math.floor(base*r/100);if(stab!==1)d=Math.floor(d*stab);d=Math.floor(d*eff);if(burn<1)d=Math.floor(d*burn);if(mod!==1)d=Math.floor(d*mod);if(lo>1)d=Math.floor(d*lo);return d;};
  return {min:roll(85),max:roll(100),eff};
}
/* Recoil and self stat drops now ride ON THE MOVE TABLE (mv.rc = [num,den] of damage dealt,
 * mv.self = the drop in Showdown stat names), generated into data/engine-data.js from the dex by
 * build/build_engine_data.js. The RECOIL and SELFDROP name tables that lived here priced 12 and 11
 * moves respectively — the format's dex says 9 and 10, so the hand tables carried entries for moves
 * not even in the pool while staying silent on any future addition. Look it up, never restate it. */
const recoilOf=mv=>(mv&&mv.rc)?mv.rc[0]/mv.rc[1]:0;

/* ---- THE PRICING-RISK ENGINE (Will: "what is the cost/risk of clicking this move" ... "that
 * actually get priced into decisions"). Lives HERE, not in a helper module, because the scorer
 * below consumes it and exposure.js already requires this file — a copy in each place is how the
 * price and the simulation drift apart. exposure.js re-exports these for its own callers.
 *
 * Channels, unit-clean, weights deliberately NOT mixed here (board.js features + fit_policy own
 * the real weights; `total` is a default view for the rollout heuristic and UIs):
 *   selfHPFrac        fraction of own max HP (Rough Skin 1/8, burn/poison chip over the horizon)
 *   outputHalvedFrac  share of own damage output lost (burn x physical share; GUTS INVERTS — a
 *                     statused Guts body is +50%, so the channel goes NEGATIVE: seek the proc)
 *   actionsLostFrac   share of remaining actions lost (full-para 12.5%, sleep 1.667, freeze 1.3125
 *                     — the battle loop's own Champions numbers above)
 *   stagesLost        negative stat stages taken (Gooey -1 speed a touch)
 *   speedFlipsFrac    share of foes whose move ORDER flips at paralysed speed, via effSpeed;
 *                     Trick Room inverts the sign, scaled by its remaining turns vs the horizon
 * HORIZON measured, not guessed: median self-play game is 9 turns (29,256 games, 2026-07-29),
 * so a mid-game click sees ~5 more. */
const EXPOSURE_HORIZON=5;
const SLEEP_TURNS_LOST=1+2/3, FREEZE_TURNS_LOST=0.75+0.75*0.75, FULL_PARA=0.125;
function physicalShare(att){
  let p=0,n=0;
  for(const id of (att.moves||[])){const mv=MC.moves[id];if(!mv||!mv.bp)continue;n++;if(mv.c==='P')p++;}
  return n?p/n:0.5;
}
function statusCostOf(att,status,H){
  const out={selfHPFrac:0,outputHalvedFrac:0,actionsLostFrac:0};
  const guts=att.ability==='guts';
  if(guts)out.outputHalvedFrac=-0.5*physicalShare(att);       // dmgRange's own x1.5-when-statused
  if(status==='burn'){if(!guts)out.outputHalvedFrac=physicalShare(att);out.selfHPFrac=H/16;}
  else if(status==='poison')out.selfHPFrac=H/8;
  else if(status==='bad poison'){let s=0;for(let n2=1;n2<=H;n2++)s+=Math.min(15,n2)/16;out.selfHPFrac=s;}
  else if(status==='paralysis')out.actionsLostFrac=FULL_PARA; // speed half priced via flips below
  else if(status==='sleep')out.actionsLostFrac=Math.min(H,SLEEP_TURNS_LOST)/H;
  else if(status==='freeze')out.actionsLostFrac=Math.min(H,FREEZE_TURNS_LOST)/H;
  return out;
}
function speedFlipShare(att,foes,field,side,H){
  if(!foes||!foes.length)return 0;
  field=field||{terrain:'',weather:'',twA:0,twB:0,tr:0};
  const mySide=side||'A',foeSide=mySide==='A'?'B':'A';
  const para=Object.assign({},att,{status:'par'});
  const now=effSpeed(att,field,mySide),then=effSpeed(para,field,mySide);
  let flips=0,n=0;
  for(const f of foes){
    if(!f||f.fainted)continue;n++;
    const fs=effSpeed(f,field,foeSide);
    let firstNow=now>fs,firstThen=then>fs;
    if(field.tr>0){firstNow=!firstNow;firstThen=!firstThen;}
    if(firstNow&&!firstThen)flips+=1;
    else if(!firstNow&&firstThen)flips-=(field.tr>0?Math.min(field.tr,H)/H:1);
  }
  return n?flips/n:0;
}
function expectedHitsOf(moveId){
  const p=TAGS.param('move',moveId,'multiHit');
  if(!p)return 1;
  return (p.distribution&&p.distribution.indexOf('2:35')===0)?3.1:2;
}
function punishExposure(att,tgt,moveId,opts){
  opts=opts||{};
  if(!att||!tgt||!moveId)return null;
  const pun=TAGS.param('ability',tgt.ability,'punishesAttacker');
  if(!pun||pun.requiresForme)return null;
  const mv=MC.moves[moveId];
  if(!mv||!mv.bp)return null;
  const trig=pun.trigger==='contact'?TAGS.has('move',moveId,'contact')
           :pun.trigger==='physical'?mv.c==='P'
           :pun.trigger==='special'?mv.c==='S':true;
  if(!trig)return null;
  const H=opts.horizon||EXPOSURE_HORIZON;
  const hits=expectedHitsOf(moveId);
  const out={selfHPFrac:0,outputHalvedFrac:0,actionsLostFrac:0,stagesLost:0,speedFlipsFrac:0,parts:[]};
  let pApply=1;
  if(pun.onFaintOnly){
    const dr=dmgRange(att,tgt,mv,opts.field||{terrain:'',weather:'',twA:0,twB:0},false);
    pApply=dr.min>=tgt.curHP?1:(dr.max>=tgt.curHP?0.5:0);
    if(!pApply)return null;
  }
  if(pun.fraction){
    const f=hits*pApply/(+pun.fraction);
    out.selfHPFrac+=f;
    out.parts.push({what:'1/'+pun.fraction+' max HP per hit',p:pApply,cost:+f.toFixed(4)});
  }
  if(pun.boosts)for(const k in pun.boosts)if(pun.boosts[k]<0){
    const st=hits*pApply*-pun.boosts[k];
    out.stagesLost+=st;
    out.parts.push({what:k+' '+pun.boosts[k]+' per hit',p:pApply,cost:+st.toFixed(4)});
  }
  if(pun.inflicts)for(const inf of pun.inflicts){
    if(!canTakeStatus(att,CODE_OF_STATUS[inf.status]||inf.status))continue;
    const pProc=(1-Math.pow(1-inf.chance,hits))*pApply;
    const c=statusCostOf(att,inf.status,H);
    out.selfHPFrac+=pProc*c.selfHPFrac;
    out.outputHalvedFrac+=pProc*c.outputHalvedFrac;
    out.actionsLostFrac+=pProc*c.actionsLostFrac;
    if(inf.status==='paralysis'&&opts.foes)
      out.speedFlipsFrac+=pProc*speedFlipShare(att,opts.foes,opts.field,opts.side,H);
    out.parts.push({what:inf.status+' '+(100*inf.chance)+'%',p:+pProc.toFixed(4),
      cost:+(pProc*(c.selfHPFrac+c.outputHalvedFrac+c.actionsLostFrac)).toFixed(4)});
  }
  if(!out.parts.length)return null;
  out.total=+(out.selfHPFrac+out.outputHalvedFrac+out.actionsLostFrac
            +0.125*out.stagesLost+0.25*out.speedFlipsFrac).toFixed(4);
  return out;
}
/* CLICK FRAGILITY — Will's Solar Beam scenario as a number: "the risk of me clicking solar beam
 * but them switching in pelipper mid beam". A click's value can depend on a precondition the
 * OPPONENT can delete with a switch that resolves before moves. Three threat classes, his list
 * verbatim ("weather, type immunities, or farigaraf blocking prio"), all read from the artifact:
 *
 *   weather flip     their benched setter replaces the sky; the click is re-valued under the new
 *                    weather through the same dmgRange (Weather Ball's type, Solar Beam's half,
 *                    rain/sun on Water/Fire — all of it moves together)
 *   type immunity    the pivot absorbs the click to zero AND may gain from it (heal 1/4, +1 SpA,
 *                    +2 Def, the Flash Fire volatile) — worse than zero, and the gain says so
 *   priority block   Armor Tail-class: a positive-priority click fails outright into the pivot
 *
 * Returns worst-case retention (0..1) of the click's damage and WHO causes it. Worst-case is the
 * right default for a risk the opponent controls — the same reason a 70-acc nuke is never a
 * "guaranteed" KO here. What they WOULD click is a behavior question the ladder will answer;
 * nothing here pretends to know it. Pure read. */
function clickFragility(att,moveId,tgt,benchFoes,field){
  const mv=MC.moves[moveId];
  if(!mv||!mv.bp||!benchFoes||!benchFoes.length)return null;
  field=field||{terrain:'',weather:'',twA:0,twB:0};
  const base=dmgRange(att,tgt,mv,field,false);
  if(!base.max)return null;
  let worst={retention:1,cause:null,how:null};
  const consider=(ret,cause,how,extra)=>{if(ret<worst.retention)worst={retention:+ret.toFixed(3),cause,how,extra:extra||null};};
  for(const b of benchFoes){
    if(!b||b.fainted)continue;
    const ws=TAGS.param('ability',b.ability,'weatherSetter');
    if(ws&&ws.weather&&ws.weather!==field.weather){
      const flipped=dmgRange(att,tgt,mv,Object.assign({},field,{weather:ws.weather}),false);
      consider(flipped.max/base.max,b.name,'flips the sky to '+ws.weather);
    }
    const im=TAGS.param('ability',b.ability,'typeImmunity');
    const mvType=effMoveType(mv,moveId,field);  // the type the click has UNDER the current sky
    if(im&&im.type===mvType)
      consider(0,b.name,'absorbs '+mvType+' entirely',im.gain?{feedsIt:im.gain}:null);
    else if(mcEff(mvType,b.types)===0)
      consider(0,b.name,'type-immune to '+mvType+' (chart)');
    if(movePriority(moveId,field)>priorityRefusedAbove([b],field))
      consider(0,b.name,'blocks priority outright');
  }
  return {retention:worst.retention,cause:worst.cause,how:worst.how,extra:worst.extra,
    fragile:worst.retention<0.75};
}
function bestMoveVs(att,def,field){ let best=null,bs=-1e18;
  for(const id of att.moves){const mv=MC.moves[id];if(!mv||!hasPower(mv))continue;
    /* LEGALITY AT PICK TIME, not just at execution: the loop already refuses a turn-2 Fake Out,
     * but nothing stopped the bot CLICKING one -- a silent no-op turn, sampled constantly off
     * Incineroar's priors. Found by Will asking whether Fake Out was modeled at all. */
    if(id==='fakeout'&&att._turnsOut>0)continue;
    const acc=att.ability==='noguard'?1:moveAccuracy(id,field)/100;const d=dmgRange(att,def,mv,field,SPREAD.has(id));
    /* value = expected damage MINUS the priced cost of the click (Will: "that actually get priced
     * into decisions"). The old line multiplied recoil moves by a flat 0.85 — a fudge that charged
     * Brave Bird and Head Smash identically and charged Rough Skin nothing. Both costs are now in
     * HP on the same scale as the damage: recoil as the dex fraction of what lands, the punisher
     * price as its exposure total times own max HP (the 1-own-HP = 1-enemy-HP exchange is this
     * heuristic's one modeling choice — the fitted policy learns its own weights instead). */
    const exp=((d.min+d.max)/2)*acc;
    const x=punishExposure(att,def,id,{field});
    const sc=exp-recoilOf(mv)*exp-(x?x.total*att.st.hp*acc:0);
    if(sc>bs){bs=sc;best={id,mv,spread:SPREAD.has(id),d,acc,cost:x?+(x.total*att.st.hp).toFixed(1):0};}}
  return best;
}
// pick the best target (max damage) for a SPECIFIC move
function targetForMove(me,id,live,field){ const mv=MC.moves[id]; if(!mv||!hasPower(mv))return null;
  if(id==='fakeout'&&me._turnsOut>0)return null;   // same pick-time legality as bestMoveVs
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
  /* WIRE 18 -- choiceLock. A Scarf holder (4,159 sheets) clicked a move and is LOCKED into it:
   * no priors sampling, no heuristics, no re-aiming to a status move -- the one move, best legal
   * target, exactly the constraint the item's tag declares. Freed only by leaving the field,
   * which in this rollout means fainting. Scarf mons re-picked freely every turn before this,
   * which quietly overstated every Scarf team the bot ever simulated. */
  /* ENCORE AND TAUNT ACTUALLY CONSTRAIN THE CHOICE, rather than being recorded and ignored.
   *
   * Recording a volatile and then choosing freely is the shape that made Encore LOOK modelled for a
   * whole session: playerAction returned a kind that was not 'pass', the probe accepted it, and the
   * target went on picking whatever it liked. A constraint that nothing reads is not a constraint.
   *
   * Encore repeats the last move. Taunt forbids status moves, so the mon falls through to the normal
   * chooser with its status options removed rather than being handed a specific click. Both decrement
   * and expire, because a lock that never ends is its own bug. */
  if(me._vol){
    if(me._vol.encore>0){
      me._vol.encore--;
      const _mv=me._encoreMove;
      if(_mv&&MC.moves[_mv]){
        const _t=live[Math.floor(rng()*live.length)%live.length];
        try{const _a=playerAction(me,_mv,_t,field); if(_a&&_a.kind!=='pass')return _a;}catch(e){/* fall through */}
      }
    }
    if(me._vol.taunt>0)me._vol.taunt--;
  }
  if(me._lock){
    const chosen=targetForMove(me,me._lock,live,field);
    if(chosen)return{kind:'attack',move:chosen,target:chosen.target};
    return{kind:'struggle'};
  }
  // strongest option + is a KO available?
  let bestAtk=null,bestKO=-1,tgt=null;
  for(const f of live){const b=bestMoveVs(me,f,field);if(!b)continue;const acc=me.ability==='noguard'?1:moveAccuracy(b.id,field)/100;const ko=(b.d.min>=f.curHP?1:(b.d.max>=f.curHP?0.5:0))*acc;const sc=ko*1e4+b.d.max*acc;if(sc>bestKO){bestKO=sc;bestAtk=b;tgt=f;}}
  // a KO is only "guaranteed" if the move is accurate too — no relying on a 70% nuke
  const bestKOsNow=bestAtk&&tgt&&bestAtk.d.min>=tgt.curHP&&(moveAccuracy(bestAtk.id,field)>=100||me.ability==='noguard');
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
      if(pick.kind==='setup'&&!inDanger&&(me.boosts.at+me.boosts.sa+me.boosts.sp)<4)return{kind:'setup',mv:pick.mv};
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
function effSpeed(m,field,side){let s=m.st.sp*boostMul(m.boosts.sp);if(m.item==='choicescarf')s*=1.5;
  /* UNBURDEN. Speed doubles once the item is GONE, from the speedOnItemLoss param -- which was
   * itself wrong until today: it matched any onTakeItem and so included STICKY HOLD, whose handler
   * exists to refuse the loss. Reading that would have doubled the Speed of an ability that does
   * the opposite. */
  if(m._hadItem&&!m.item){const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)s*=_ub.speedMult;}
if((side==='A'?field.twA:field.twB)>0)s*=2;
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
/* Screens last 5 turns (8 with Light Clay, which this engine does not model). The DOUBLES
 * multiplier is 2732/4096, not the 0.5 the tag states for singles -- see the note in dmgRange. */
const SCREEN_TURNS=5, DOUBLES_SCREEN=2732/4096;
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
/* ONE PLACE THAT ANSWERS "IS THIS PRANKSTER". Two callers now -- the Dark-type block below and the
   +1 priority in battleTurn -- and they were about to normalise the ability string separately, which
   is how the two halves of one ability drift apart. Will asked whether a universal fix existed; this
   is it for THIS engine. It is deliberately not shared with board.js, which asks a different question
   (pranksterProb: the probability an unseen species HAS the ability) because board.js scores real
   games where the opponent's ability is not known and a rollout's is. */
function isPrankster(mon){
  return (mon&&(mon.ability||'')).replace(/[^a-z0-9]/g,'')==='prankster';
}
function pranksterBlocked(attacker,target,moveId){
  if(!isPrankster(attacker)) return false;
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

/* ON-ENTRY FIELD EFFECTS, from the artifact instead of a four-name list. Called for the leads AND
 * for every faint replacement — the gap Will's Solar Beam/Pelipper question exposed: refill()
 * applied only Intimidate, so a mid-game Drizzle entrant set no rain in any rollout, ever. The
 * entrant's weather OVERRIDES what stands, exactly as the real setWeather does. Terrain now exists
 * on the field for the same reason (Psychic Surge blocks priority the way Armor Tail does; Grassy
 * Glide's +1 already reads field.terrain and could never see one). */
function applyEntryEffects(m,field){
  if(!m)return;
  const w=TAGS.param('ability',m.ability,'weatherSetter');
  if(w&&w.weather){field.weather=w.weather;field.weatherT=5;}
  const t=TAGS.param('ability',m.ability,'terrainSetter');
  if(t&&t.terrain){field.terrain=t.terrain;field.terrainT=5;}
}
/* THE STEP-WISE BATTLE API (the Battle Tower's spine). battle() was a sealed 20-turn loop, which is
 * right for a rollout and useless for a PLAYER — the Tower needs the same engine to stop each turn
 * and take side A's actions from a human. So the loop body moved verbatim into battleTurn():
 * identical code path, identical rng call order, and battle() is reimplemented on top of it — the
 * gate tests hold because nothing about a rollout changed. actsForA is a Map(mon -> action) built
 * by playerAction(); absent, side A plays itself exactly as before. */
const _live=arr=>arr.filter(m=>m&&!m.fainted&&m.curHP>0);
/* BRING A BENCHED POKEMON IN. Shared by faint replacement and by voluntary/pivot switching.
   WHICH mon: live(bench)[0], the same choice refill() has always made. A rollout needs SOME policy
   and the honest first version reuses the existing one rather than inventing a matchup heuristic
   here -- the engine's job is to make the switch possible, and choosing well is the searcher's.
   Stated because "it picks the first healthy body" is a real limitation, not a detail. */
function bringIn(act,i,bench,foes,sf,field,wanted){
  /* WHICH mon, when the caller knows. live(bench)[0] is the right default for a FAINT replacement --
     nobody chose it -- but a voluntary switch is a choice, and a search that cannot say WHO it is
     bringing in is not evaluating a switch, it is evaluating "leave". Will: switching is
     non-negotiable, and "switch to something" is not the decision; "switch to Amoonguss" is. */
  const nx=(wanted&&bench.indexOf(wanted)>=0&&!wanted.fainted&&wanted.curHP>0)?wanted:_live(bench)[0];
  if(!nx) return null;
  /* ZERO TO HERO. Palafin leaves and comes back as Palafin-Hero -- 154 Attack to 233. The engine
   * could BUILD palafin-hero all along; nothing ever transformed anything, so Palafin was a
   * permanently weak body and pivoting it looked pointless. Will asked for 'special AI' to make it
   * switch turn one; it needs no AI, it needs the mechanic, and a 233-Attack body earns the turn on
   * its own. The target forme comes from switchInForme, derived from the species table.
   *
   * Only on a RETURN: _wasOut is set by switchOut, so the first entry of the battle does not
   * transform, which is the actual rule. */
  if(nx._wasOut){
    const _sf=TAGS.param('ability',nx.ability,'switchInForme');
    if(_sf&&_sf.becomes){
      const _key=String(_sf.becomes).toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/--+/g,'-');
      if(MC.mons&&MC.mons[_key]&&nx.name!==_key){
        const _hp=nx.curHP/nx.st.hp;
        const _new=buildMon(_key,{});
        if(_new){nx.name=_new.name;nx.types=_new.types;nx.st=_new.st;nx.curHP=Math.max(1,Math.round(_new.st.hp*_hp));}
      }
    }
  }
  bench.splice(bench.indexOf(nx),1);
  nx._turnsOut=0; nx._fallenStuck=sf.fainted; act[i]=nx;
  applyEntryEffects(nx,field);
  if(nx.ability==='intimidate')for(const f of _live(foes))applyIntimidate(f);
  return nx;
}
/* SWITCH A LIVING MON OUT. The outgoing body goes back to the bench, so it can return later and its
   damage persists -- that is the whole point of pivoting. Volatile, one-turn state is cleared on the
   way out because it does not survive a switch in the real game: Protect's consecutive counter, the
   redirection mark and the Leech Seed link all belong to the body's time on the field. Boosts go too.
   Returns the incoming mon, or null when the bench is empty and the switch simply cannot happen. */
function switchOut(act,i,bench,foes,sf,field,wanted){
  const out=act[i]; if(!out||out.fainted) return null;
  if(!_live(bench).length) return null;
  out.protect=false; out.tookProtectTurns=0; out._redirect=null; out._seededBy=null;
  /* A charge does not survive leaving the field, and neither does the invulnerability. Left set,
   * a benched mon would come back locked into a move it started two switches ago -- or worse,
   * come back untargetable. */
  out._charging=null; out._invuln=false;
  /* IT HAS NOW BEEN OUT. Zero to Hero fires on the RETURN, never on the first entry, so the
   * transform needs to know this body has already left once. Written here rather than in bringIn
   * because leaving is the event -- and the first version read this flag without anything ever
   * setting it, which would have made the whole mechanic silently never fire. */
  out._wasOut=true;
  out._lock=null; out._lockT=0; out._flinch=false;
  out.boosts={at:0,df:0,sa:0,sd:0,sp:0};
  bench.push(out);
  return bringIn(act,i,bench,foes,sf,field,wanted);
}
/* `opts.seeded` starts the battle from a position that is ALREADY UNDER WAY, which is what a rollout
   leaf needs. The difference is entry effects: a fresh battle applies weather/terrain reactions and
   Intimidate as the leads arrive, and a mid-game seed must not, because those already happened in the
   real game. Re-applying Intimidate would drop the foe's Attack a SECOND time on every leaf, in the
   same direction, on every board with an Incineroar -- a silent, systematic bias exactly where the
   format is most crowded. */
function battleInit(teamA,teamB,opts){
  const S={field:{weather:null,weatherT:0,terrain:'',terrainT:0,twA:0,twB:0,tr:0,wgA:false,wgB:false},
    /* one shared death counter per side, handed to every mon by reference */
    sfA:{fainted:0},sfB:{fainted:0},
    actA:[teamA[0],teamA[1]].filter(Boolean),actB:[teamB[0],teamB[1]].filter(Boolean),
    benchA:teamA.slice(2),benchB:teamB.slice(2),turn:0};
  teamA.forEach(m=>{if(m)m._sf=S.sfA;});teamB.forEach(m=>{if(m)m._sf=S.sfB;});
  /* What each body STARTED holding, so Unburden can tell 'never had one' from 'lost it'. Stamped
   * once here rather than at each of the six places an item is cleared -- a flag set in six places
   * is a flag that will be missed in a seventh. */
  teamA.concat(teamB).forEach(m=>{if(m)m._hadItem=!!m.item;});
  if(!(opts&&opts.seeded)){
    for(const m of S.actA.concat(S.actB))applyEntryEffects(m,S.field);
    const intim=(as,fs)=>{for(const m of as)if(m.ability==='intimidate')for(const f of fs)if(f&&!f.fainted)applyIntimidate(f);};
    intim(S.actA,S.actB);intim(S.actB,S.actA);
  }
  return S;
}
/* THE HORIZON IS A PARAMETER NOW, because a SEARCH can exploit it and a rollout alone cannot.
   battleResult scores LIVE BODIES first, so inside a fixed 20-turn cap a side that keeps everything
   alive wins the readout -- and a search maximising that discovers switching back and forth, which
   loses no Pokemon before the horizon. Observed exactly: the live bot alternated between the same
   two switch pairs forever and never attacked.
   S.maxTurns lets a caller buy a horizon long enough that stalling stops paying. The default is
   unchanged, so every measurement taken before this still means what it meant. */
function battleOver(S){
  return S.turn>=(S.maxTurns||20)||_live(S.actA).length+_live(S.benchA).length===0||_live(S.actB).length+_live(S.benchB).length===0;
}
function battleTurn(S,rng,actsForA,actsForB){
  rng=rng||Math.random;
  if(battleOver(S))return S;
  const field=S.field,actA=S.actA,actB=S.actB,benchA=S.benchA,benchB=S.benchB,sfA=S.sfA,sfB=S.sfB;
  const live=_live;
  {
    [...actA,...actB].forEach(m=>{if(m){m.protect=false;m._redirect=null;m._helpingHand=false;}});field.wgA=false;field.wgB=false;
    const acts=[];
    /* actsForB exists for the Tower's LOWER floors: a floor-3 guardian clicks random legal moves,
     * so the caller hands the weak actions in rather than this engine growing a "play badly" mode. */
    const mk=(mon,side,foes,ally)=>{if(!mon||mon.fainted||mon.curHP<=0)return;
      const forced=(side==='A'?actsForA&&actsForA.get(mon):actsForB&&actsForB.get(mon));
      /* A CHARGING POKEMON HAS NO CHOICE. The release turn is not a decision in the real game and
         must not be one here, or the engine would let it wind up Solar Beam and then click
         something else -- a free stat boost and no turn ever spent. Target is re-aimed at
         execution, so a stale body is not carried across the turn. */
      let _a;
      if(mon._charging&&MC.moves[mon._charging]){
        const _t=live(foes)[0]||null;
        _a=playerAction(mon,mon._charging,_t,field);
        if(!_a||_a.kind!=='attack'){mon._charging=null;mon._invuln=false;_a=forced||chooseAction(mon,foes,ally,field,side,rng);}
      } else _a=forced||chooseAction(mon,foes,ally,field,side,rng);
      /* WHICH SLOT the click was aimed at, captured now while the board is still the pre-switch one.
         A move targets a SLOT, not a body: if the intended target switches out, the Pokemon that
         replaces it takes the hit. Without this the outgoing mon stayed targetable from the bench and
         a switch neither dodged the attack nor handed it to the replacement -- it hit a Pokemon that
         was no longer on the field. Only surfaced once voluntary switching existed to expose it. */
      acts.push({mon,side,a:_a,tgtSlot:_a&&_a.target?foes.indexOf(_a.target):-1});};
    mk(actA[0],'A',actB,actA[1]);mk(actA[1],'A',actB,actA[0]);mk(actB[0],'B',actA,actB[1]);mk(actB[1],'B',actA,actB[0]);
    /* what was actually clicked this turn, both sides, for observers (the Tower's local game
     * record). A summary, not the live objects -- nothing outside can mutate the turn. */
    S.lastActs=acts.map(it=>({side:it.side,name:it.mon.name,kind:it.a.kind,
      move:(it.a.move&&it.a.move.id)||it.a.mv||null,
      target:(it.a.target&&it.a.target.name)||null}));
    for(const it of acts){if(it.a.kind==='protect'){it.mon.protect=(it.mon.tookProtectTurns===0||rng()<Math.pow(1/3,it.mon.tookProtectTurns));it.mon.tookProtectTurns++;it.mon._lastMove='protect';}else if(it.a.kind==='wideguard'){if(it.side==='A')field.wgA=true;else field.wgB=true;it.mon.tookProtectTurns=0;}else it.mon.tookProtectTurns=0;}
    /* Bracket first, then speed. Protect-likes are +4 and Wide Guard is +3 in the real game; a status
     * move sits in its own move's bracket (Thunder Wave 0, Trick Room -7), not a blanket 0. */
    const prio=it=>{
      const k=it.a.kind;
      if(k==='attack')    return movePriority(it.a.move.id, field);
      /* PRANKSTER, +1 TO ANY STATUS CLICK. It was not modelled anywhere: pranksterBlocked() existed
         for the Dark-type immunity, but nothing ever gave Prankster its priority, so a Prankster
         screen went up AFTER the attack it was meant to blunt. Will's point exactly -- the damage is
         supposed to be halved before the attacker moves, and that is most of what the ability is for.
         Every kind below is a status move; only 'attack' is not, and it returns above. */
      const pk=isPrankster(it.mon)?1:0;
      /* A VOLUNTARY SWITCH RESOLVES BEFORE ANY MOVE. Not a priority bracket in the real game -- it
         is a separate phase that happens first -- but this engine orders everything through one
         sort, so it sits above Protect's +4. That ordering is the whole reason switching out of a
         predicted attack works, and getting it wrong would make every switch eat the hit it was
         meant to dodge. Prankster does not touch it. */
      if(k==='switch')    return 6;
      if(k==='protect')   return 4+pk;
      if(k==='wideguard') return 3+pk;
      /* Read from each move's own data, which is what makes Trick Room -7 and Rage Powder +2 without
         either being written here. `tail` and `trickroom` carry no mv on the action, so they name
         their move; the rest already do. */
      if(k==='tail')      return movePriority('tailwind', field)+pk;
      if(k==='trickroom') return movePriority('trickroom', field)+pk;
      return movePriority(it.a.mv, field)+pk;
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
      /* WIRE 19 -- REAL setup boosts. This applied a generic +1 to Attack, SpA AND Speed for every
       * setup click, so Swords Dance was one-third right, Iron Defense entirely wrong, and Dragon
       * Dance half right. The rulebook states each move's actual boosts (targetBoostsAlways); the
       * generic guess remains only as the fallback for a move the rulebook lacks. Contrary flips
       * the sign here exactly as it does for self-drops. */
      if(a.kind==='setup'){
        const _fx=a.mv&&moveFx(a.mv);
        const _bo=_fx&&_fx.targetBoostsAlways;
        m._lastMove=a.mv||m._lastMove;
        if(_bo){
          const _sg=m.ability==='contrary'?-1:1;
          for(const k in _bo){const _s2=SD2ENG[k];if(_s2&&m.boosts[_s2]!=null)m.boosts[_s2]=clamp(m.boosts[_s2]+_bo[k]*_sg,-6,6);}
        } else {
          m.boosts.at=clamp(m.boosts.at+1,-6,6);m.boosts.sa=clamp(m.boosts.sa+1,-6,6);m.boosts.sp=clamp(m.boosts.sp+1,-6,6);
        }
        continue;
      }
      /* THE GENERIC EFFECT APPLIER. Everything it does comes from the artifact, so a move added to
       * the format arrives here with no edit -- which is the whole point of deriving the spec rather
       * than writing branches. Accuracy, Protect and the Prankster/Dark immunity are checked the same
       * way the existing status branch checks them, because a target-drop is a status move. */
      if(a.kind==='affect'){
        m._lastMove=a.mv;
        const _t=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        if(!_t||_t.protect) continue;
        /* GOOD AS GOLD REFUSES A STATUS MOVE OUTRIGHT. Gholdengo was taking Charm for -2, which
         * makes it a different Pokemon to the one people build around. The tag is derived from the
         * ability's own onTryHit -- and tightened after the first version caught Telepathy, which
         * tests category !== 'Status' and blocks an ALLY'S DAMAGE, and Wonder Guard, which tests
         * for Status and then bare-returns to ALLOW it. */
        if(TAGS.has('ability',_t.ability,'refusesStatusMoves')&&_t!==m) continue;
        if(powderBlocked(_t,a.mv)) continue;
        if(pranksterBlocked(m,_t,a.mv)) continue;
        const _acc=moveAccuracy(a.mv,field);
        if(_acc<100&&rng()*100>_acc) continue;
        /* Stat changes. Contrary flips them and Clear Body refuses drops, both already modelled for
         * Intimidate -- asked here the same way so one ability does not behave differently by route. */
        for(const _e of ((a.sc&&a.sc.target)||[])){
          if(_e.chance<100&&rng()*100>=_e.chance) continue;
          const _sg=_t.ability==='contrary'?-1:1;
          for(const _k in _e.boosts){
            const _s2=SD2ENG[_k]; if(!_s2||_t.boosts[_s2]==null) continue;
            const _d=_e.boosts[_k]*_sg;
            if(_d<0&&TAGS.has('ability',_t.ability,'preventsStatDrop')) continue;
            _t.boosts[_s2]=clamp(_t.boosts[_s2]+_d,-6,6);
          }
        }
        /* Status and volatiles. applyStatus already enforces the type and ability immunities; a
         * VOLATILE is a different thing and is recorded by name on the mon so a consumer can see
         * which ones it does and does not act on, instead of a silent no-op. */
        for(const _e of ((a.si&&a.si.effects)||[])){
          const _who=_e.to==='user'?m:_t;
          if(!_who||_who.fainted) continue;
          if(_e.chance<100&&rng()*100>=_e.chance) continue;
          if(_e.status) applyStatus(_who,_e.status);
          if(_e.volatile){(_who._vol=_who._vol||{})[_e.volatile]=(_e.volatile==='encore')?3:(_e.volatile==='taunt'?3:1);
            if(_e.volatile==='encore')_who._encoreMove=_who._lastMove||null;}
        }
        continue;
      }
      if(a.kind==='tail'){if(it.side==='A')field.twA=4;else field.twB=4;continue;}
      /* TRICK ROOM. Every other piece of it was already here — field.tr inverts the speed sort in the
       * acts.sort above, ticks down at end of turn, and flipSpeedOdds already prices it — and nothing
       * could ever set it, so a Trick Room click was a no-op turn. 1.18% of real clicks
       * (engine/medicham_coverage.js) and one of the largest strategic swings in the format.
       *
       * IT TOGGLES. Clicking it while it is up ENDS it rather than refreshing it, which is the real
       * rule and matters here specifically: the counter to Trick Room is a second Trick Room, so a
       * version that refreshed would make the room permanent once either side started it and would
       * misprice every Trick Room mirror. Five turns, of which the mover's own is one — the end-of-turn
       * decrement leaves four behind, matching how twA/twB are set to 4 on the line above. */
      if(a.kind==='trickroom'){field.tr=field.tr>0?0:5;continue;}
      if(a.kind==='boostally'){
        const bt=TAGS.param('move',a.mv,'boostsTarget')||{};
        /* The ALLY is the target for every one of these except the self-targeting ones, and a lone
           active has no ally, in which case the click honestly does nothing. */
        const ally=(it.side==='A'?actA:actB).find(x=>x&&x!==m&&!x.fainted&&x.curHP>0);
        const BK={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'};
        if(ally&&bt.boosts)for(const k in bt.boosts){
          const kk=BK[k]; if(kk)ally.boosts[kk]=clamp((ally.boosts[kk]||0)+bt.boosts[k],-6,6);
        }
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='fixeddmg'){
        const t=a.target;
        if(t&&!t.fainted&&!t.protect&&t.curHP>0){
          /* Half the target's CURRENT hp, floored, and never less than 1 -- the move does not fail on
             a target at 1 HP, it takes it to 0. Type immunity still applies and is asked of mcEff
             rather than assumed: Super Fang is Normal, so a Ghost takes nothing. */
          const mv2=MC.moves[a.mv];
          const eff=mcEff(mv2?mv2.t:'',t.types);
          if(eff>0){
            const dmg=Math.max(1,Math.floor(t.curHP/2));
            t.curHP=Math.max(0,t.curHP-dmg);
            if(t.curHP<=0){t.fainted=true;if(t._sf)t._sf.fainted++;}
          }
        }
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='perish'){
        const tn=+(TAGS.param('move',a.mv,'perishClock')||{}).turns||3;
        /* BOTH SIDES, which is the whole shape of the move: the user's own team is on the same clock,
           so it is only a win condition if you can outlast it. Not re-applied to a mon that already
           carries one -- clicking it twice does not reset the timer. */
        for(const x of [...actA,...actB])if(x&&!x.fainted&&x.curHP>0&&x._perish==null)x._perish=tn;
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='yawn'){
        const t=a.target;
        if(t&&!t.fainted&&!t.protect&&!t.status&&t._yawn==null&&!pranksterBlocked(m,t,a.mv))
          /* +1 because the end-of-turn tick below fires on the APPLICATION turn too. Without it a
             delay of 1 puts the target to sleep on the turn Yawn was clicked, which is a turn early
             and turns a telegraphed threat into an instant one. Same correction the sealsMoves wire
             already carries for Encore. */
          t._yawn=(+(TAGS.param('move',a.mv,'delayedSleep')||{}).delay||1)+1;
        m._lastMove=a.mv;continue;
      }
      /* HELPING HAND marks the PARTNER, not the user. +5 priority means the mark is in place before
         any ordinary attack resolves, so the boost lands on the partner's move this turn -- which is
         the entire move. It is cleared at the top of the next turn beside protect and the redirection
         mark, because it does not persist. */
      if(a.kind==='helpinghand'){
        const ally=(it.side==='A'?actA:actB).find(x=>x&&x!==m&&!x.fainted&&x.curHP>0);
        if(ally)ally._helpingHand=true;
        m._lastMove=a.mv;continue;
      }
      /* Setting the weather REPLACES whatever was up -- that is the whole counter-play, and it is why
         a Politoed answers a snow team (see the Aurora Veil note below). Five turns; the rock items
         that extend it carry `extendsDuration` and are not consumed here, so a Damp Rock reads as
         five. Named as a gap rather than silently rounded. */
      if(a.kind==='weather'){
        const w=SD2WEATHER[String((moveFx(a.mv)||{}).weather||'').toLowerCase().replace(/[^a-z0-9]/g,'')];
        if(w){field.weather=w;field.weatherT=5;}
        m._lastMove=a.mv;continue;
      }
      /* The redirector marks ITSELF; the retarget happens at the attacker's targeting step below, so
       * the ordering falls out for free — priority +2 means the mark is almost always set before any
       * normal-priority attack looks for it, and a redirector that moves after an attacker correctly
       * fails to catch it. The volatile name is kept rather than a boolean so the attacker's side can
       * apply Rage Powder's powder immunity without asking which move set the mark. */
      if(a.kind==='redirect'){m._redirect=a.mv;m._lastMove=a.mv;continue;}
      /* VOLUNTARY SWITCH. The slot is found by identity rather than passed in, because the action
         was built before the sort and the arrays can have been rewritten by an earlier switch this
         same turn. A switch with an empty bench does nothing and still costs the turn. */
      if(a.kind==='switch'){
        const own=it.side==='A'?actA:actB, foes=it.side==='A'?actB:actA;
        const bench=it.side==='A'?benchA:benchB, sf=it.side==='A'?sfA:sfB;
        const idx=own.indexOf(m);
        /* `a.to` names the replacement when the caller chose one. A switch action without it keeps
           the old behaviour of taking whoever is first, so nothing that used this before changes. */
        if(idx>=0)switchOut(own,idx,bench,foes,sf,field,a.to);
        continue;
      }
      /* SCREENS live on the SIDE, and `_sf` is the only per-side object a mon already carries — it is
       * handed to every member of the team by reference in battleInit, bench included, so a switch-in
       * walks under a screen that was up before it arrived. Storing this on the mon instead would
       * have quietly dropped the screen the moment anything switched.
       *
       * AURORA VEIL NEEDS SNOW. The tag records `needsWeather:true` — a BOOLEAN. It says THAT the
       * move needs weather, not WHICH, and the first version of this compared the weather string
       * against `true`, so the click failed in every sky including snow. The artifact cannot express
       * the requirement today, so the weather is named here and this comment is why; auroraveil is
       * the only halvesDamage move carrying the tag.
       *
       * This blocks SETTING it, which is the real rule and is why a Politoed switching in answers a
       * snow team — Drizzle replaces the snow and the Veil can no longer go up. A Veil ALREADY up is
       * not removed when the weather changes; it rides out its turns. That is why the gate is here at
       * the click and not in the end-of-turn tick. A failed click still costs the turn. */
      if(a.kind==='screen'){
        const hd=TAGS.param('move',a.mv,'halvesDamage')||{};
        if(TAGS.has('move',a.mv,'failsWithoutWeather')&&field.weather!=='snow'){m._lastMove=a.mv;continue;}
        /* LIGHT CLAY, entirely from the item's own tag: it names WHICH screens it extends, the new
           duration and the one it replaces, so nothing about 8-vs-5 is written here and Damp/Heat/
           Icy/Smooth Rock stay untouched because they do not list these moves. */
        let turns=SCREEN_TURNS;
        const _ext=TAGS.param('item',m.item,'extendsDuration');
        if(_ext&&_ext.toTurns&&(_ext.extends||[]).some(nm=>String(nm).toLowerCase().replace(/[^a-z0-9]/g,'')===a.mv))
          turns=+_ext.toTurns;
        const sf=m._sf; if(sf){
          const cat=String(hd.category||'both');
          if(cat==='Physical'||cat==='both')sf.scrP=turns;
          if(cat==='Special' ||cat==='both')sf.scrS=turns;
        }
        m._lastMove=a.mv;continue;
      }
      /* HEAL. The fraction is the move's own (Roost/Recover 1/2, Life Dew 1/4), and 'allies' spreads
       * it across the user's side while 'self' does not — Life Dew healing only its user would make
       * the most-clicked doubles restore look like a worse Recover. Capped at max HP, and a fainted
       * ally is not resurrected. */
      if(a.kind==='heal'){
        const fx=moveFx(a.mv), fr=fx&&fx.heal;
        if(fr&&fr[1]){
          /* Max HP is `st.hp` — a mon carries curHP plus its stat block, and there is no maxHP field.
           * Written as maxHP first, which produced NaN on every heal rather than a wrong number, so
           * the test caught it; a silently wrong divisor would not have shown up at all. */
          const amt=x=>{if(x&&x.st)x.curHP=Math.min(x.st.hp,x.curHP+Math.floor(x.st.hp*fr[0]/fr[1]));};
          if(fx.target==='allies'){for(const x of (it.side==='A'?actA:actB))if(x&&!x.fainted&&x.curHP>0)amt(x);}
          else amt(m);
        }
        continue;
      }
      /* A status move inflicts the status THAT MOVE inflicts, at THAT MOVE's accuracy. This line used
       * to read `applyStatus(t, ['brn','par','slp'][rng()*3|0])` - a uniformly random pick, so Thunder
       * Wave burned a third of the time. The status and the accuracy now come from the rulebook. */
      if(a.kind==='status'){
        const t=a.target; if(!t||t.fainted||t.protect) continue;
        if(TAGS.has('ability',t.ability,'refusesStatusMoves')&&t!==m) continue;   // Good as Gold
        const fx=moveFx(a.mv);
        const st=(fx&&fx.status)||null;
        /* WIRE 8 -- perTurnHP, the drain half. Leech Seed carries no major status, so this branch
         * discarded the click as "no effect" -- 8th-most-clicked status move, a no-op. The tag says
         * everything the wire needs: effect drain, 1/8 of the TARGET's max HP, healed to the user,
         * blocked by Grass -- the immunity comes from the move's own onTryImmunity, not a name here.
         * Curse/Salt Cure (effect 'damage') and the self-heals stay unconsumed until the engine can
         * host them honestly; a tag consumed HALF-right is how the 20-mechanic batch went wrong. */
        if(!st){
          const _pt=TAGS.param('move',a.mv,'perTurnHP');
          if(_pt&&_pt.effect==='drain'&&_pt.on==='target'&&_pt.per&&!t._seededBy
             &&!(_pt.immuneType&&t.types.includes(_pt.immuneType))
             &&!pranksterBlocked(m,t,a.mv)){
            const acc=(fx&&fx.accuracy===true)?100:((fx&&fx.accuracy)||ACC[a.mv]||100);
            if(rng()*100<=acc) t._seededBy={by:m,per:_pt.per};
          }
          /* WIRE 20 -- Encore, riding the Scarf's lock. sealsMoves declares the turns (3); the
           * target is pinned to its LAST acted move for that long. Locked into Protect it fails
           * consecutively (tookProtectTurns already rules that) -- Will's stallIntoEncore scenario,
           * finally real in the rollouts instead of only in the feature that fears it. Needs a
           * last move to seal: a fresh switch-in has none, and the click honestly does nothing. */
          const _sm=TAGS.param('move',a.mv,'sealsMoves');
          if(_sm&&_sm.turns&&t._lastMove&&!pranksterBlocked(m,t,a.mv)){
            /* +1 because the end-of-turn tick fires on the application turn too — without it the
             * tag's 3 turns would force only 2 clicks */
            t._lock=t._lastMove;t._lockT=+_sm.turns+1;
          }
          m._lastMove=a.mv;
          continue;                                             // no major status to apply
        }
        m._lastMove=a.mv;
        if(powderBlocked(t,a.mv)) continue;                     // Grass / Overcoat / Safety Goggles
        if(pranksterBlocked(m,t,a.mv)) continue;                // Prankster does not touch Dark types
        const acc=(fx&&fx.accuracy===true)?100:((fx&&fx.accuracy)||ACC[a.mv]||100);
        if(rng()*100>acc) continue;                              // status moves miss (T-Wave 90, W-o-W 85)
        applyStatus(t,st);                                       // applyStatus enforces the immunities
        continue;
      }
      if(a.kind!=='attack')continue;
      /* THE CHARGE TURN. Ten moves cost a turn before they land and this engine played all of them
       * in one, so Electro Shot was a free 130 BP nuke in any weather -- Will watched it click one
       * out of rain. The comment two hundred lines up said so and called it "stated, not fixed".
       *
       * Handled HERE, at execution, rather than inside playerAction or chooseAction, because both of
       * those build actions: a rule placed in one would be missing from the other, which is exactly
       * how the coverage bug that started this week happened.
       *
       * Three states in order. Already charging this move -> it fires now and the user comes back
       * down. Skippable -> it fires immediately and no turn is spent (Electro Shot in rain, Solar
       * Beam in sun, or a Power Herb, which is consumed). Otherwise -> spend this turn charging,
       * take the charge-turn stat boost if the move grants one, and go untargetable if this is one
       * of the five that leave the field. Every branch reads the artifact; nothing is named here. */
      if(TAGS.has('move',a.move.id,'chargeTurn')){
        if(m._charging===a.move.id){
          m._charging=null; m._invuln=false;                    // release turn: fall through and hit
        } else {
          const _sk=TAGS.param('move',a.move.id,'chargeSkippedByWeather');
          const _herb=m.item==='powerherb';
          if(!(_sk&&_sk.skipsIn&&field.weather===_sk.skipsIn)&&!_herb){
            m._charging=a.move.id;
            m._invuln=TAGS.has('move',a.move.id,'semiInvulnerable');
            /* The charge turn is not always empty: Electro Shot and Meteor Beam raise Special
             * Attack as they wind up, which is most of why either is worth a turn. The boost comes
             * from the chargeTurn param, derived from the move's own onTryMove handler, so a new
             * one arrives with a regenerated artifact and no edit here. */
            const _cp=TAGS.param('move',a.move.id,'chargeTurn'), _b=_cp&&_cp.boosts;
            if(_b)for(const _k of Object.keys(_b)){
              const _kk={spa:'sa',spd:'sd',atk:'at',def:'df',spe:'sp'}[_k]||_k;
              if(m.boosts&&_kk in m.boosts)m.boosts[_kk]=Math.max(-6,Math.min(6,m.boosts[_kk]+_b[_k]));
            }
            m._lastMove=a.move.id;
            continue;                                           // the turn is spent
          }
          if(_herb)m.item='';                                   // Power Herb is consumed
        }
      }
      const mv=a.move.mv;
      /* the lock engages on the first attack a choiceLock holder commits (WIRE 18) */
      if(!m._lock&&TAGS.has('item',m.item,'choiceLock')){m._lock=a.move.id;m._lockT=Infinity;}m._lastMove=a.move.id;
      if(a.move.id==='fakeout'&&m._turnsOut>0)continue;   // Fake Out only works the turn you enter
      /* BLOCKED PRIORITY FAILS OUTRIGHT. The sort above puts a priority move at the front of the
       * turn and, until now, let it connect regardless of Armor Tail, Queenly Majesty, Dazzling or
       * Psychic Terrain -- so every rollout and every self-play game had Sucker Punch beating a
       * Farigiraf. Checked against the side actually being aimed at. */
      {
        const _foes=it.side==='A'?actB:actA;
        if(movePriority(a.move.id,field)>priorityRefusedAbove(_foes,field)) continue;
      }
      const _mvAcc=moveAccuracy(a.move.id,field);if(_mvAcc<100&&rng()*100>_mvAcc)continue;
      const foes=it.side==='A'?actB:actA;
      /* Resolve the aim to whoever is in that slot NOW. `foes` is the live slot array, so an object
         that is no longer in it has left the field and cannot be hit. */
      let aim=a.target;
      if(aim&&!foes.includes(aim))aim=(it.tgtSlot>=0?foes[it.tgtSlot]:null);
      let targets=a.move.spread?live(foes):[aim].filter(t=>t&&!t.fainted&&t.curHP>0);
      /* REDIRECTION APPLIES HERE, and only to SINGLE-TARGET moves aimed at the other side. Spread
       * moves already hit everything so there is nothing to draw, and the redirector must be a live
       * FOE of this attacker — a Follow Me on my own side does not pull my partner's attack.
       *
       * Rage Powder is a powder move, so a Grass type, Overcoat, or Safety Goggles ignores the draw
       * and hits what it aimed at; powderBlocked() already knows that and already lists ragepowder,
       * so the immunity is asked of the same helper Sleep Powder uses rather than restated. Follow Me
       * is not a powder and draws regardless. Getting this half-right — drawing everything, always —
       * would silently make every Amoonguss immune matchup wrong in the same direction. */
      if(!a.move.spread&&targets.length){
        const drawer=live(foes).find(f=>f&&f._redirect);
        if(drawer&&drawer!==targets[0]&&!powderBlocked(m,drawer._redirect))targets=[drawer];
      }
      if(!targets.length)targets=live(foes).slice(0,1);
      /* spreadAll hits the PARTNER too -- Earthquake beside your own Archaludon costs it the same
       * 0.75x packet the enemies eat. Membership from the artifact; the ally is appended AFTER the
       * Wide Guard check below because Wide Guard protects a SIDE, and the attacker's own side
       * never raised it against its own quake. */
      const _allyHit=a.move.spread&&HITS_ALLY.has(a.move.id)
        ?(it.side==='A'?actA:actB).find(x=>x&&x!==m&&!x.fainted&&x.curHP>0):null;
      if(a.move.spread&&((it.side==='A'&&field.wgB)||(it.side==='B'&&field.wgA)))targets=[];   // Wide Guard blocks spread
      if(_allyHit)targets=targets.concat([_allyHit]);
      /* SCREENS BREAK. Brick Break, Psychic Fangs and Raging Bull carry `clearsScreens`, so the set
         comes from the artifact rather than three names here. It fires on USE, before damage, which
         is the real rule -- the screen is gone for this very hit, not the next one. */
      if(TAGS.has('move',a.move.id,'clearsScreens')){
        const fsf=(it.side==='A'?actB:actA).map(x=>x&&x._sf).find(Boolean);
        if(fsf){fsf.scrP=0;fsf.scrS=0;}
      }
      let dealt=0;
      for(const tg of targets){if(!tg||tg.fainted)continue;
        /* OFF THE FIELD. A Pokemon in the charge turn of Fly, Dig, Dive, Bounce or Phantom Force
         * cannot be hit at all. Without this the charge is pure cost and those five become strictly
         * worse than reality -- the same one-directional error as the unmodelled charge, reversed. */
        if(tg._invuln)continue;
        if(tg.protect&&!(m.ability==='piercingdrill'&&mv.c==='P'))continue;   // Protect blocks — unless Piercing Drill (contact)
        /* WIRE 11 -- the absorb GAIN. dmgRange already prices the hit at zero; HERE the absorber
         * collects what its handler grants -- Volt Absorb heals 1/4, Storm Drain banks +1 SpA,
         * Well-Baked Body +2 Def -- all from the artifact's gain param. The old 12-name table knew
         * none of this: an absorbed hit was merely zero, never a gift. Flash Fire's volatile has no
         * state to land on -- carried, unconsumed, stated. The whole hit ends here: no secondaries,
         * no punishment, no berry, exactly as onTryHit returning null ends it in the real engine. */
        const _ab=TAGS.param('ability',tg.ability,'typeImmunity');
        if(_ab&&_ab.type===effMoveType(mv,a.move.id,field)){
          if(_ab.gain&&!tg.fainted){
            const _h=_ab.gain.heal&&String(_ab.gain.heal).match(/1\/(\d+)/);
            if(_h)tg.curHP=Math.min(tg.st.hp,tg.curHP+Math.floor(tg.st.hp/(+_h[1])));
            if(_ab.gain.boosts&&tg.boosts)for(const k in _ab.gain.boosts){
              const _s=SD2ENG[k];if(_s&&tg.boosts[_s]!=null)tg.boosts[_s]=clamp(tg.boosts[_s]+_ab.gain.boosts[k],-6,6);
            }
          }
          continue;
        }
        let d=dmgRange(m,tg,mv,field,a.move.spread&&targets.length>1);
        /* x1.5 on a boosted attack. Applied to the ROLLED range rather than to base power, which is
           where the real game applies it, and only to damaging moves -- a Helping Hand on a status
           click does nothing and must stay nothing. */
        if(m._helpingHand&&d&&(d.min||d.max))d={min:Math.floor(d.min*1.5),max:Math.floor(d.max*1.5),eff:d.eff};
        let dmg=d.min+Math.floor(rng()*(d.max-d.min+1));if(rng()<1/24)dmg=Math.floor(dmg*1.5);
        if(tg.protect)dmg=Math.floor(dmg*0.25);   // Piercing Drill: contact hits through Protect for 25%
        dealt+=Math.min(dmg,tg.curHP);
        /* THE BERRY IS CONSUMED HERE AND ONLY HERE. dmgRange applied the halve as a pure read --
         * it is called dozens of times per turn on hypothetical moves and must never mutate -- so
         * the one-shot is spent at the point a real hit lands, exactly like the Sitrus line below. */
        /* KNOCK OFF ACTUALLY KNOCKS THE ITEM OFF. It did not, on a move clicked 3,013 times in the
         * corpus -- every Life Orb, Focus Sash and Berry in a rollout was immortal, so the search
         * priced Knock Off as a weak Dark attack and nothing else.
         *
         * From the `removesItem` tag, derived from the move's own handler calling takeItem, with
         * `steals` set for the ones that also call setItem. That is Knock Off, Covet, Thief, Trick,
         * Switcheroo, Bug Bite, Pluck and Corrosive Gas from one rule and no names.
         *
         * Placed AFTER the hit lands, beside the resist berry it may have just spent, because an
         * item is only lost when the move actually connects. */
        {
          const _ri=TAGS.param('move',a.move.id,'removesItem');
          if(_ri&&tg.item&&!tg.fainted){
            const _taken=tg.item; tg.item='';
            if(_ri.steals&&!m.item)m.item=_taken;
          }
        }
        const _rbHit=TAGS.param('item',tg.item,'resistBerry');
        if(_rbHit&&_rbHit.onType===mv.t&&(!_rbHit.requiresSuperEffective||d.eff>1))tg.item='';
        /* WIRE 5 -- punishesAttacker, all of it. Rough Skin (3,762 sheets) and its family were
         * ABSENT: the engine had no concept that touching something can cost you. Unlike
         * buffsHolderOnHit this does NOT compound -- it is a flat toll, so the right play is to
         * keep attacking without contact rather than to stop. Paid whether or not the target
         * survived the hit, which is why it sits outside the survivor branch below.
         *
         * THE TRIGGER COMES FROM THE TAG, not from an assumption. The first cut of this wire
         * assumed contact-per-hit for every member, so Aftermath (whose handler fires only when
         * the HOLDER DIES to contact) chipped attackers 25% on every touch. requiresForme members
         * are skipped whole: this engine carries no forme state, and a base-forme Cramorant that
         * never Surfed punishing anyone would be a new wrong number, not a wired mechanic. */
        const _pun=TAGS.param('ability',tg.ability,'punishesAttacker');
        if(_pun&&!_pun.requiresForme){
          const _trig=_pun.trigger==='contact'?mvMakesContact(a.move.id)
                     :_pun.trigger==='physical'?mv.c==='P'
                     :_pun.trigger==='special'?mv.c==='S'
                     :true;
          if(_trig&&(!_pun.onFaintOnly||dmg>=tg.curHP)){
            if(_pun.fraction){
              m.curHP-=Math.floor(m.st.hp/(+_pun.fraction));
              if(m.curHP<=0){m.curHP=0;m.fainted=true;}
            }
            if(_pun.boosts&&m.boosts&&!m.fainted)for(const k in _pun.boosts){
              const _st=SD2ENG[k];if(_st&&m.boosts[_st]!=null)m.boosts[_st]=clamp(m.boosts[_st]+_pun.boosts[k],-6,6);
            }
            /* ONE roll against the cumulative, because the artifact's list entries are exclusive
             * branches of one random(100) -- rolling each independently would understate Effect
             * Spore's paralysis and poison. applyStatus enforces the immunities and one-at-a-time. */
            if(_pun.inflicts&&!m.fainted){
              const _r=rng();let _cum=0;
              for(const _inf of _pun.inflicts){_cum+=_inf.chance;
                if(_r<_cum){applyStatus(m,CODE_OF_STATUS[_inf.status]||_inf.status);break;}}
            }
            if(_pun.setsWeather&&!field.weather){
              const _w=SD2WEATHER[_pun.setsWeather];
              if(_w){field.weather=_w;field.weatherT=5;}
            }
            /* hazard (Toxic Debris) and inflictsVolatile (Cursed Body, Cute Charm, Perish Body)
             * are carried by the artifact but have nowhere to land: this rollout keeps no side
             * conditions and no volatiles. Left visibly unconsumed rather than faked. */
          }
        }
        /* WIRE 12 -- survivesFromFull. Focus Sash is the most-held item in the format (8,078
         * sheets) and Sturdy its ability twin, and neither existed here: every lethal hit into a
         * full-HP sash body was a kill that is not a kill. The gates come from the handler via the
         * tag -- full HP only, a MOVE only (burn chip still kills), survive at exactly 1 -- and the
         * sash is SPENT in the act while Sturdy is not, which the artifact's consumesItem states.
         * This engine rolls multi-hit as one packet, so a sash here also eats Bullet Seed -- the
         * one divergence from the real rule, stated rather than hidden. */
        if(dmg>=tg.curHP&&tg.curHP===tg.st.hp){
          const _sv=TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull');
          if(_sv&&(!_sv.onlyFromFullHP||tg.curHP===tg.st.hp)){
            dmg=tg.curHP-(_sv.leavesHP||1);
            if(_sv.consumesItem)tg.item='';
          }
        }
        /* WIRE 17 -- thaw on hit: a damaging Fire-type move thaws a frozen target (the game's own
         * rule since Gen VI), and the artifact's thawsTarget carries the non-Fire exceptions the
         * flag exists for -- Scald, Matcha Gotcha. Cleared BEFORE the damage lands so the thawed
         * target acts normally next turn. */
        if(tg.status==='frz'&&(effMoveType(mv,a.move.id,field)==='Fire'||TAGS.has('move',a.move.id,'thawsTarget')))tg.status='';
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
              /* WIRE 16 -- secondary STAT DROPS, the third kind of secondary and the one that was
               * silently missing: Icy Wind and Electroweb (100% spe-1, the format's speed control),
               * Snarl (spa-1), Breaking Swipe (atk-1), Crunch's 20% def-1. The rulebook carried
               * targetBoosts all along; this block only ever read status and flinch. Clear Body /
               * White Smoke / Full Metal Body refuse drops, from their own shared gate. */
              else if(s.targetBoosts&&tg.boosts){
                if(!(tgAb==='clearbody'||tgAb==='whitesmoke'||tgAb==='fullmetalbody')){
                  for(const k in s.targetBoosts){
                    const _st=SD2ENG[k];
                    if(_st&&tg.boosts[_st]!=null&&s.targetBoosts[k]<0)
                      tg.boosts[_st]=clamp(tg.boosts[_st]+s.targetBoosts[k],-6,6);
                  }
                }
              }
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
        /* Spicy Spray's burn was an independent hardcode here, gated on PHYSICAL -- the handler
         * has no such gate; it burns on ANY damaging hit. Now served by the punishesAttacker wire
         * above, from the artifact, with the gate the handler actually states (none). */
      }
      /* THE PIVOT HALF, AFTER THE DAMAGE. U-turn, Volt Switch and Flip Turn carry base power, so
         they arrived here as ordinary attacks and the user simply stayed -- the chip was modelled
         and the momentum, which is the reason the move is played, was not. The tag says which moves
         leave; `pivotDamaging` is the damaging set.
         AFTER, not before: the attack resolves from the ORIGINAL body, so its damage, its ability
         and its item are the outgoing mon's. Switching first would fire the move off the replacement.
         A user that fainted to recoil or to a contact punish does not leave, and an empty bench
         makes it a plain attack. */
      if(!m.fainted&&m.curHP>0&&TAGS.has('move',a.move.id,'pivotDamaging')){
        const own=it.side==='A'?actA:actB, foes=it.side==='A'?actB:actA;
        const bench=it.side==='A'?benchA:benchB, sf=it.side==='A'?sfA:sfB;
        const idx=own.indexOf(m);
        /* A PIVOT IS ALSO A CHOICE. U-turn is not 'leave' -- it is 'leave and bring THIS in', and
           the whole reason the move is played is the body that arrives. `a.pivotTo` carries it when
           the caller picked one; without it the first healthy bench mon comes in as before. */
        if(idx>=0)switchOut(own,idx,bench,foes,sf,field,a.pivotTo);
      }
      // recoil, from the move table's dex-generated fraction (was a 12-name hand table)
      const _rcF=recoilOf(a.move.mv);
      if(_rcF&&dealt>0){m.curHP-=Math.floor(dealt*_rcF);if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
      // self stat changes from mv.self (dex-generated); Contrary flips drops into boosts
      const sdrop=a.move.mv.self;
      if(sdrop){const sgn=m.ability==='contrary'?-1:1;
        for(const k in sdrop){const _st=SD2ENG[k];if(_st&&m.boosts[_st]!=null)m.boosts[_st]=clamp(m.boosts[_st]+sdrop[k]*sgn,-6,6);}}
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
      /* WIRE 14 -- healsAtThreshold, from the artifact instead of a Sitrus name check. The tag
       * carries the threshold AND the restore as the handler states them ('1/2' -> '1/4'), so a
       * future pinch berry joins by existing rather than by someone remembering. Oran restores a
       * FLAT 10 HP, not a fraction -- its param is honestly null and it stays unwired (0 uses). */
      {const _ht=TAGS.param('item',m.item,'healsAtThreshold');
       if(_ht&&_ht.restores&&_ht.triggersBelow){
         const _fr=s=>{const p=String(s).match(/(\d+)\s*\/\s*(\d+)/);return p?+p[1]/+p[2]:0;};
         if(m.curHP<=m.st.hp*_fr(_ht.triggersBelow)){
           m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp*_fr(_ht.restores)));m.item='';
         }
       }}
      /* WIRE 8 -- the drain lands here, with the residuals. The amount divides the VICTIM's max HP
       * (seeding a tank returns more than seeding a pixie -- that is the tag's per, not a constant)
       * and the same number is handed to the seeder, capped at full. If the seeder is down the chip
       * continues and the heal is simply lost -- close to the real slot rule without slot state. */
      if(m._seededBy&&m.curHP>0){
        /* Heal what was TAKEN, not the formula amount: the killing tick drains only the HP the
         * victim still had, and handing the seeder more than that would mint HP from nothing. */
        const _d=Math.min(Math.floor(m.st.hp/m._seededBy.per),m.curHP);
        m.curHP-=_d;
        const _s=m._seededBy.by;
        if(_s&&!_s.fainted&&_s.curHP>0)_s.curHP=Math.min(_s.st.hp,_s.curHP+_d);
      }
      if(m.curHP<=0){m.curHP=0;m.fainted=true;}}
    if(field.weatherT>0&&--field.weatherT<=0)field.weather=null;if(field.terrainT>0&&--field.terrainT<=0)field.terrain='';
    if(field.twA>0)field.twA--;if(field.twB>0)field.twB--;if(field.tr>0)field.tr--;
    /* Screens tick on the SIDE object, beside the field timers above so the two cannot drift. */
    for(const sf of [sfA,sfB]){if(sf){if(sf.scrP>0)sf.scrP--;if(sf.scrS>0)sf.scrS--;}}
    /* PERISH and YAWN tick here, with the field timers, so every clock in this engine advances in one
       place. Perish faints at zero -- that is the move. Yawn sleeps at zero, and only if the target is
       still statusless, because anything that landed in between takes precedence. */
    for(const x of [...actA,...actB]){
      if(!x||x.fainted)continue;
      if(x._perish!=null){x._perish--;if(x._perish<=0){x.fainted=true;x.curHP=0;}}
      if(x._yawn!=null){x._yawn--;if(x._yawn<=0){x._yawn=null;if(!x.status)applyStatus(x,'slp');}}
    }
    [...actA,...actB].forEach(m=>{if(m&&!m.fainted)m._turnsOut++;if(m&&m._lockT!==Infinity&&m._lockT>0&&--m._lockT<=0)m._lock=null;});
    /* THE DEATH COUNTERS update at turn end, before replacements enter: the live side count for
     * Last Respects (a mid-turn kill is seen one action late — an approximation, stated), and the
     * entrant's frozen snapshot for Supreme Overlord. Derived from the actual fainted flags every
     * turn — no hand-maintained tally to drift. */
    sfA.fainted=[...actA,...benchA].filter(x=>x&&x.fainted).length;
    sfB.fainted=[...actB,...benchB].filter(x=>x&&x.fainted).length;
    /* ONE SWITCH-IN PATH. Will's point: voluntary switching is not new machinery, it is the body
       refill() already had -- take the mon off the bench, reset its turn counter, stamp the fallen
       count, apply entry effects and Intimidate. Extracted to bringIn() at module scope so a faint
       replacement and a U-turn bring a Pokemon in through exactly the same code; two copies is how
       the voluntary path would quietly skip Intimidate. */
    /* THE POST-KO REPLACEMENT IS A DECISION TOO, and it was a coin flip: whoever happened to be first
       on the bench walked into whatever just got a kill. In doubles that is frequently the whole game.
       S.replaceWith lets a caller name the replacement per side; absent, the old behaviour stands. */
    const refill=(act,bench,foes,sf,side)=>{
      for(let i=0;i<act.length;i++){
        if(!act[i]||!act[i].fainted)continue;
        const want=S.replaceWith&&S.replaceWith[side];
        const nx=bringIn(act,i,bench,foes,sf,field,want);
        /* Consumed once. A standing preference would silently apply to every later faint in the game,
           which is a different and much stronger claim than the caller made. */
        if(nx&&want&&nx===want&&S.replaceWith)S.replaceWith[side]=null;
      }
    };
    refill(actA,benchA,actB,sfA,'A');refill(actB,benchB,actA,sfB,'B');
  }
  S.turn++;
  return S;
}
/* winner readout, shared by the sealed rollout and the Tower's end screen:
 * 1 = side A, 0 = side B, 0.5 = dead-even HP tie at the 20-turn horizon */
function battleResult(S){
  const aA=_live(S.actA).length+_live(S.benchA).length,bA=_live(S.actB).length+_live(S.benchB).length;
  if(aA!==bA)return aA>bA?1:0;
  const hp=(a,b)=>[...a,...b].reduce((s,m)=>s+(m?Math.max(0,m.curHP)/m.st.hp:0),0);
  const ha=hp(S.actA,S.benchA),hb=hp(S.actB,S.benchB);return ha>hb?1:(ha<hb?0:0.5);
}
function battle(teamA,teamB,ov,rng){ rng=rng||Math.random;
  const S=battleInit(teamA,teamB);
  while(!battleOver(S))battleTurn(S,rng);
  return battleResult(S);
}
/* Build ONE turn action from a player's click, in exactly the shape chooseAction emits — the page
 * must never hand-roll these, or the Tower and the rollout would resolve moves differently.
 * Unmodelled status clicks return kind 'pass' (a no-op turn): honest, and the Tower says so in
 * the log rather than pretending the engine played a move it cannot represent. */
function playerAction(me,moveId,target,field){
  const id=String(moveId||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(PROTECTMOVES.has(id))return {kind:'protect'};
  if(id==='wideguard')return {kind:'wideguard'};
  if(id==='tailwind')return {kind:'tail'};
  if(id==='trickroom')return {kind:'trickroom'};
  const mv=MC.moves[id];
  if(mv&&hasPower(mv)&&target){
    const spread=SPREAD.has(id);
    return {kind:'attack',move:{id,mv,spread,d:dmgRange(me,target,mv,field,spread),acc:moveAccuracy(id,field)/100},target};
  }
  const fx=moveFx(id);
  /* HEAL, from the rulebook's own `heal` fraction rather than a list of move names — so Roost,
   * Recover, Life Dew, Soft-Boiled and every other restore arrive together and a new one needs no
   * code. `target` decides who gets it: 'self' is the user, 'allies' is the whole side (Life Dew).
   * Checked before the status branch because nothing here carries a major status. */
  if(fx&&fx.heal)return {kind:'heal',mv:id};
  /* REDIRECTION, FROM THE `redirects` TAG. Will was right that these were already tagged and the
   * first version of this line was not: it named ragepowder and followme by their volatile, having
   * looked for the tag under ABRA_TAGS.move — the artifact spells it `moves`, so the search came back
   * empty and "there is no tag" got written into a comment. Asking the tag instead means any other
   * redirect move in the set arrives without another edit here, which is the whole point of the tags.
   *
   * 1.78% of real clicks, and the most positional mechanic in doubles: it is how a Fake Out or a
   * Sucker Punch ends up eaten by the wrong body. */
  if(TAGS.has('move',id,'redirects'))return {kind:'redirect',mv:id};
  /* SCREENS, from the `halvesDamage` tag, which carries both the multiplier and WHICH category it
   * applies to — Light Screen Special, Reflect Physical, Aurora Veil both. One branch, three moves,
   * and a fourth arrives free. 1.69% of real clicks. */
  if(TAGS.has('move',id,'halvesDamage'))return {kind:'screen',mv:id};
  /* PARTING SHOT and other STATUS pivots: no damage, the user leaves. 2.12% of real clicks and the
     single largest unmodelled move in the corpus.
     WHAT IS NOT DONE, said here rather than discovered: Parting Shot also drops the target's Attack
     and Special Attack by one. That is `statChangeInCode` -- procedural in the handler -- and NO
     artifact this engine reads carries the numbers (the lowersTarget param says "via onHit", and
     MOVE_EFFECTS has no boosts for it). So the switch is modelled and the drop is not. That is a
     known half, and it is the half that decides where the move is played. */
  if(TAGS.has('move',id,'pivotStatus'))return {kind:'switch',mv:id};
  /* WEATHER, from the rulebook's own `weather` field. SD2WEATHER already maps Showdown's names onto
     this engine's ('RainDance' -> 'rain'), and it is reused rather than restated so a weather setter
     and the ability that sets the same weather cannot disagree. Rain and sun are the two largest
     archetypes in the format, and until now clicking Rain Dance was a no-op turn. */
  /* HELPING HAND. The rulebook names the volatile and the +5 priority, and movePriority reads the
     priority, so the only thing written here is the multiplier -- x1.5, which no artifact this engine
     reads carries. Same call as DOUBLES_SCREEN above: state the constant and say why it is stated. */
  if(fx&&fx.volatile==='helpinghand')return {kind:'helpinghand',mv:id};
  /* BOOSTS ON AN ALLY. All six boostsTarget moves carry an explicit table -- Coaching {atk:1,def:1},
     Decorate {atk:2,spa:2}, Howl, Aromatic Mist, Flatter, Swagger -- so the stages come from the
     artifact and nothing is guessed. Contrast lowersTarget, which says readFrom:"m.boosts" and is
     therefore NOT implementable from anything this engine can read. */
  if(TAGS.has('move',id,'boostsTarget'))return {kind:'boostally',mv:id};
  /* LEECH SEED and the rest of the perTurnHP family. The RESOLUTION for this already existed -- the
     status branch reads the tag, checks the Grass immunity from the move's own onTryImmunity and sets
     _seededBy -- and playerAction simply never produced an action that could reach it, so the click
     was a no-op turn. Routing it through the status path is the whole fix. */
  if(TAGS.has('move',id,'perTurnHP'))return {kind:'status',mv:id,target};
  /* PERISH SONG: a three-turn clock on everything on the field, INCLUDING THE USER'S OWN SIDE. It is
     a win condition rather than a chip move, and the rollout could not represent it at all. */
  if(TAGS.has('move',id,'perishClock'))return {kind:'perish',mv:id};
  /* FIXED DAMAGE, but only the forms the tag actually specifies. `halfTargetCurrentHP` is Super Fang
     and Nature's Madness and is fully derivable. The others -- ohko, counterDamageTaken,
     myRemainingHP, callback -- name a SOURCE this engine cannot evaluate, and are deliberately left
     as no-ops rather than approximated: a Counter that guesses is worse than a Counter that is
     visibly missing. */
  {
    const _fd=TAGS.param('move',id,'fixedDamage');
    if(_fd&&_fd.source==='halfTargetCurrentHP')return {kind:'fixeddmg',mv:id,target};
  }
  /* YAWN sleeps the target after a delay the tag states. */
  if(TAGS.has('move',id,'delayedSleep'))return {kind:'yawn',mv:id,target};
  if(fx&&fx.weather&&SD2WEATHER[String(fx.weather).toLowerCase().replace(/[^a-z0-9]/g,'')])
    return {kind:'weather',mv:id};
  if(fx&&fx.status)return {kind:'status',mv:id,target};
  if(fx&&fx.targetBoostsAlways&&fx.target==='self')return {kind:'setup',mv:id};
  /* ONE READER FOR EVERY TARGET-SIDE EFFECT, from the artifact rather than a branch per move.
   *
   * `statChange` and `statusInflict` are derived uniformly in tag_dex from what the dex already
   * states, and cover 107 and 118 moves. Before them Charm, Fake Tears, Encore, Taunt and every
   * other target-side status move fell through to kind 'pass' -- a turn spent doing nothing, which
   * the search then had to be told to stop choosing. The self-boost path above is untouched: it
   * works, and re-applying those here would double every Swords Dance. */
  {
    const _sc=TAGS.param('move',id,'statChange'), _si=TAGS.param('move',id,'statusInflict');
    if((_sc&&_sc.target)||(_si&&_si.effects&&_si.effects.length))
      return {kind:'affect',mv:id,target,sc:_sc||null,si:_si||null};
  }
  if(TAGS.has('move',id,'sealsMoves'))return {kind:'status',mv:id,target};   // Encore rides the status path
  return {kind:'pass'};
}
function winProb2(nA,nB,N,ov){
  const A0=nA.slice(0,4).filter(n=>MC.mons[n]),B0=nB.slice(0,4).filter(n=>MC.mons[n]);
  if(!A0.length||!B0.length)return null;
  let w=0;for(let i=0;i<N;i++){w+=battle(A0.map(n=>buildMon(n,ov)),B0.map(n=>buildMon(n,ov)),ov);}return w/N;
}
/* ALAKAZAM'S FUTURE SIGHT — the user-facing prediction read. Will asked for this by name
 * (2026-07-26): a shipped feature that predicts. It predicts three things, none of them invented:
 *
 *   clicks    what each opposing species is likely to CLICK, straight from the behaviour-clone
 *             priors (data/move-priors.json) — the same distribution chooseAction samples, so the
 *             forecast and the bot cannot disagree. When a species has no priors the fallback is
 *             uniform over its set and SAYS SO: ADR-001 attempt 3 fell back silently and reported a
 *             32-point finding that measured nothing.
 *   threats   for every my-mon x their-mon pair, the best move they have into it and the damage as
 *             a share of max HP, from the same dmgRange the rollouts use — tags, weather and all.
 *   pWin      winProb2 over N rollouts of the full doubles engine.
 *
 * A PURE READ: builds its own mons, mutates nothing, safe to call from a UI on every change. */
function futureSight(myNames,foeNames,opts){
  opts=opts||{};
  const field={terrain:opts.terrain||'',weather:opts.weather||'',twA:0,twB:0};
  const ov=opts.items||{};
  const mine=(myNames||[]).map(n=>buildMon(n,ov)).filter(Boolean);
  const foes=(foeNames||[]).map(n=>buildMon(n,ov)).filter(Boolean);
  if(!mine.length||!foes.length)return null;
  const foesOut=foes.map(f=>{
    const pr=MC.priors&&MC.priors[f.name];
    let clicks,fromPriors=true;
    if(pr&&pr.length){
      const tot=pr.reduce((s,q)=>s+q[1],0)||1;
      clicks=pr.map(q=>({move:q[0],p:q[1]/tot,kind:q[2]||'attack'}));
    }else{
      fromPriors=false;
      clicks=(f.moves||[]).map(id=>({move:id,p:1/(f.moves.length||1),kind:'unknown'}));
    }
    const threats=mine.map(m=>{
      const b=bestMoveVs(f,m,field);
      if(!b)return {into:m.name,move:null,minPct:0,maxPct:0,ko:'no'};
      return {into:m.name,move:b.id,
        minPct:Math.round(100*b.d.min/m.st.hp),
        maxPct:Math.round(100*b.d.max/m.st.hp),
        ko:b.d.min>=m.curHP?'guaranteed':(b.d.max>=m.curHP?'possible':'no')};
    });
    return {name:f.name,clicks,fromPriors,threats};
  });
  const pWin=winProb2(myNames,foeNames,opts.rollouts||200,ov);
  /* MY CLICKS, PRICED (Will: "for every implementation i sorta want a 'what is the cost/risk' of
   * clicking this move"). For each of my mons, every damaging click gets: damage into each foe,
   * the punisher price of touching that foe (punishExposure), and worst-case retention against
   * their BENCH (clickFragility) with the threat named. All the same reads the scorer makes. */
  const bench=(opts.foeBench||[]).map(n=>buildMon(n,ov)).filter(Boolean);
  const mineOut=mine.map(m=>({name:m.name,clicks:(m.moves||[]).map(id=>{
    const mv=MC.moves[id];
    if(!mv||!mv.bp)return {move:id,kind:'status'};
    const into=foes.map(f=>{
      const d=dmgRange(m,f,mv,field,false);
      const x=punishExposure(m,f,id,{field,foes});
      return {vs:f.name,minPct:Math.round(100*d.min/f.st.hp),maxPct:Math.round(100*d.max/f.st.hp),
              cost:x?x.total:0};
    });
    const frag=bench.length?clickFragility(m,id,foes[0],bench,field):null;
    return {move:id,into,fragility:frag&&frag.fragile?frag:null};
  })}));
  return {foes:foesOut,mine:mineOut,pWin,
    priorsCoverage:foesOut.filter(f=>f.fromPriors).length+'/'+foesOut.length};
}
root.winProb2=winProb2; root.dmgRange=dmgRange; root.buildMon=buildMon; root.MEDI_SPREAD=SPREAD;
root.futureSight=futureSight;
/* the tag lookup, exported so exposure.js prices risk off the SAME adapter the wires read —
 * a second adapter over window.ABRA_TAGS would be a place for the two to disagree */
root.ABRA_TAG_LOOKUP=TAGS; root.canTakeStatus=canTakeStatus; root.effSpeed=effSpeed;
root.punishExposure=punishExposure; root.clickFragility=clickFragility;
root.battleInit=battleInit; root.battleTurn=battleTurn; root.battleOver=battleOver; root.battleResult=battleResult; root.playerAction=playerAction;
root.parsePaste=parsePaste; root.buildMonFromSet=buildMonFromSet;
// exported for tests: the rulebook-reading helpers must be assertable on their own, so a wrong
// priority or a missed immunity fails a unit test rather than showing up as a drifted win rate.
if(typeof module!=='undefined'&&module.exports) module.exports={winProb2,dmgRange,buildMon,battle,futureSight,
  punishExposure,clickFragility,statusCostOf,physicalShare,speedFlipShare,EXPOSURE_HORIZON,bestMoveVs,battleInit,battleTurn,battleOver,battleResult,playerAction,parsePaste,buildMonFromSet,
  moveFx,movePriority,priorityRefusedAbove,moveAccuracy,canTakeStatus,effSpeed,applyEntryEffects,applyStatus,applyIntimidate,powderBlocked,pranksterBlocked,setPurePriors,
  /* Exported so a caller can ask THIS engine what counts as a protect rather than keeping a second
   * list that drifts from it: the live bot tracks consecutive uses to seed tookProtectTurns. */
  PROTECTMOVES};
})(typeof window!=='undefined'?window:globalThis);
