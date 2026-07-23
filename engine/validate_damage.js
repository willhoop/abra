/* validate_damage.js — MEDICHAM damage formula vs @smogon/calc (ground truth).
 * We feed BOTH the same stats (read from calc) so this isolates the damage MATH,
 * not stat-spread assumptions. Reports per-scenario min/max error, aggregate, and
 * WHERE MEDICHAM diverges (its known missing pieces). This is the GIGO audit. */
const path=require('path');
const {calculate,Pokemon,Move,Field,Generations}=require(path.join('/tmp/calcval/node_modules/@smogon/calc'));
// The standalone engine expects mcEff (type chart) in scope (normally the site provides it).
// Supply a correct Gen-9 chart on globalThis BEFORE requiring, so dmgRange resolves it.
const TC={Normal:{Rock:.5,Ghost:0,Steel:.5},Fire:{Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},
 Water:{Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},Electric:{Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},
 Grass:{Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},
 Ice:{Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},
 Fighting:{Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2,Fairy:.5},
 Poison:{Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Fairy:2},
 Ground:{Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},
 Flying:{Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},
 Psychic:{Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},
 Bug:{Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5,Fairy:.5},
 Rock:{Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},
 Ghost:{Normal:0,Psychic:2,Ghost:2,Dark:.5},Dragon:{Dragon:2,Steel:.5,Fairy:0},
 Dark:{Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Fairy:.5},
 Steel:{Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5,Fairy:2},
 Fairy:{Fire:.5,Fighting:2,Poison:.5,Dragon:2,Dark:2,Steel:.5}};
globalThis.mcEff=function(atk,defTypes){let m=1;for(const d of (defTypes||[])){const e=TC[atk]&&TC[atk][d];m*=(e===undefined?1:e);}return m;};
globalThis.MC={mons:{},moves:{}};
const MEDI=require(path.join(__dirname,'medicham2-browser.js'));   // exports {dmgRange,...}
const gen=Generations.get(9);

// move dictionary (bp, type, category P/S, isSpread)
const MV={
 earthquake:[100,'Ground','P',1], rockslide:[75,'Rock','P',1], closecombat:[120,'Fighting','P',0],
 bravebird:[120,'Flying','P',0], flareblitz:[120,'Fire','P',0], heatwave:[95,'Fire','S',1],
 hydropump:[110,'Water','S',0], wavecrash:[120,'Water','P',0], dracometeor:[130,'Dragon','S',0],
 moonblast:[95,'Fairy','S',0], makeitrain:[120,'Steel','S',1], shadowball:[80,'Ghost','S',0],
 iciclecrash:[85,'Ice','P',0], thunderbolt:[90,'Electric','S',0], dragonclaw:[80,'Dragon','P',0],
 suckerpunch:[70,'Dark','P',0], playrough:[90,'Fairy','P',0], airslash:[75,'Flying','S',0],
};
const CALCMOVE={earthquake:'Earthquake',rockslide:'Rock Slide',closecombat:'Close Combat',bravebird:'Brave Bird',
 flareblitz:'Flare Blitz',heatwave:'Heat Wave',hydropump:'Hydro Pump',wavecrash:'Wave Crash',dracometeor:'Draco Meteor',
 moonblast:'Moonblast',makeitrain:'Make It Rain',shadowball:'Shadow Ball',iciclecrash:'Icicle Crash',
 thunderbolt:'Thunderbolt',dragonclaw:'Dragon Claw',suckerpunch:'Sucker Punch',playrough:'Play Rough',airslash:'Air Slash'};

// scenarios: [attacker, ability, item, nature, evAtkOrSpa, move, defender, defNature, defEVs, weather]
const W_NONE=undefined;
const S=[
 // --- plain STAB / neutral / resist / super-effective, no weather/item ---
 ['Garchomp','Rough Skin',null,'Adamant','atk','earthquake','Incineroar','Careful',{hp:252,spd:4},W_NONE],
 ['Garchomp','Rough Skin',null,'Adamant','atk','earthquake','Gholdengo','Bold',{hp:252,def:4},W_NONE],
 ['Kingambit','Defiant',null,'Adamant','atk','suckerpunch','Flutter Mane','Timid',{hp:252},W_NONE],
 ['Chien-Pao','Sword of Ruin',null,'Jolly','atk','iciclecrash','Garchomp','Jolly',{hp:252},W_NONE],
 ['Incineroar','Intimidate',null,'Adamant','atk','flareblitz','Amoonguss','Calm',{hp:252,def:4},W_NONE],
 ['Flutter Mane','Protosynthesis',null,'Timid','spa','moonblast','Garchomp','Jolly',{hp:252},W_NONE],
 ['Gholdengo','Good as Gold',null,'Modest','spa','makeitrain','Flutter Mane','Timid',{hp:252},W_NONE],
 ['Archaludon','Stamina',null,'Modest','spa','thunderbolt','Pelipper','Bold',{hp:252,def:4},W_NONE],
 ['Rillaboom','Grassy Surge',null,'Adamant','atk','closecombat','Kingambit','Adamant',{hp:252},W_NONE],
 ['Dragonite','Multiscale',null,'Adamant','atk','dragonclaw','Garchomp','Jolly',{hp:252},W_NONE],
 // --- items (Band / Specs / Life Orb) ---
 ['Garchomp','Rough Skin','Choice Band','Adamant','atk','earthquake','Incineroar','Careful',{hp:252,spd:4},W_NONE],
 ['Flutter Mane','Protosynthesis','Choice Specs','Timid','spa','moonblast','Kingambit','Adamant',{hp:252},W_NONE],
 ['Chien-Pao','Sword of Ruin','Life Orb','Jolly','atk','iciclecrash','Dragonite','Adamant',{hp:252},W_NONE],
 ['Gholdengo','Good as Gold','Life Orb','Modest','spa','shadowball','Flutter Mane','Timid',{hp:252},W_NONE],
 // --- spread moves (doubles ×0.75) ---
 ['Garchomp','Rough Skin',null,'Adamant','atk','rockslide','Talonflame','Jolly',{hp:252},W_NONE],
 ['Incineroar','Intimidate',null,'Modest','spa','heatwave','Amoonguss','Calm',{hp:252,spd:4},W_NONE],
 ['Gholdengo','Good as Gold',null,'Modest','spa','makeitrain','Flutter Mane','Timid',{hp:252},W_NONE],
 // --- weather: Rain boosts Water / cuts Fire; Sun boosts Fire / cuts Water ---
 ['Pelipper','Drizzle',null,'Modest','spa','hydropump','Incineroar','Careful',{hp:252,spd:4},'Rain'],
 ['Basculegion','Swift Swim',null,'Adamant','atk','wavecrash','Garchomp','Jolly',{hp:252},'Rain'],
 ['Charizard','Solar Power',null,'Timid','spa','heatwave','Amoonguss','Calm',{hp:252,spd:4},'Sun'],
 ['Torkoal','Drought',null,'Modest','spa','heatwave','Kingambit','Adamant',{hp:252},'Sun'],
 ['Pelipper','Drizzle',null,'Modest','spa','hydropump','Torkoal','Bold',{hp:252,def:4},'Sun'], // fire-cut water
];

function medStat(res, side, cat){ const st=res[side].stats; return cat==='P'?st.atk:st.spa; }
function run(){
 let rows=[], errsMin=[], errsMax=[];
 for(const sc of S){
  const [att,ab,item,nat,off,mvKey,def,dnat,devs,weather]=sc;
  const [bp,type,cat,spread]=MV[mvKey];
  const evA = off==='atk'?{atk:252}:{spa:252};
  const A=new Pokemon(gen,att,{level:50,ability:ab,item:item||undefined,nature:nat,evs:evA});
  const D=new Pokemon(gen,def,{level:50,nature:dnat,evs:devs});
  const field=new Field({gameType:'Doubles', weather:weather});
  let calcLo,calcHi;
  try{ const res=calculate(gen,A,D,new Move(gen,CALCMOVE[mvKey]),field); const r=res.range(); calcLo=r[0];calcHi=r[1]; }
  catch(e){ rows.push({sc:`${att} ${mvKey} -> ${def}`,err:'calc:'+e.message}); continue; }
  // align stats: read calc's computed stats, feed MEDICHAM the same
  const Araw = cat==='P'?A.stats.atk:A.stats.spa;
  const Draw = cat==='P'?D.stats.def:D.stats.spd;
  const mAtt={ st:{at:Araw,sa:Araw}, boosts:{at:0,sa:0}, item:(item||'').toLowerCase().replace(/[^a-z]/g,''),
    ability:(ab||'').toLowerCase().replace(/[^a-z]/g,''), types:A.types.slice(), status:null };
  const mDef={ st:{df:Draw,sd:Draw}, boosts:{df:0,sd:0}, item:'', types:D.types.slice() };
  const mMove={bp,c:cat,t:type};
  const mField={weather:(weather||'').toLowerCase()};
  const dr=MEDI.dmgRange(mAtt,mDef,mMove,mField,!!spread);
  const eMin=calcLo?100*(dr.min-calcLo)/calcLo:0, eMax=calcHi?100*(dr.max-calcHi)/calcHi:0;
  errsMin.push(Math.abs(eMin)); errsMax.push(Math.abs(eMax));
  rows.push({sc:`${att} ${mvKey}${item?' @'+item:''}${weather?' ['+weather+']':''} -> ${def}`,
    calc:`${calcLo}-${calcHi}`, med:`${dr.min}-${dr.max}`, dMin:eMin.toFixed(0)+'%', dMax:eMax.toFixed(0)+'%'});
 }
 const med=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0;};
 const within=(a,t)=>100*a.filter(x=>x<=t).length/a.length;
 console.log('\nSCENARIO'.padEnd(52),'CALC'.padEnd(12),'MEDICHAM'.padEnd(12),'dMIN','dMAX');
 console.log('-'.repeat(92));
 for(const r of rows){ if(r.err){console.log(r.sc.padEnd(52), 'ERROR', r.err); continue;}
   console.log(r.sc.padEnd(52), r.calc.padEnd(12), r.med.padEnd(12), r.dMin.padStart(5), r.dMax.padStart(5)); }
 const all=errsMin.concat(errsMax);
 console.log('\n=== AGGREGATE (|% error| vs @smogon/calc, stats aligned) ===');
 console.log(`scenarios: ${errsMin.length} | median abs err: ${med(all).toFixed(1)}% | within 2%: ${within(all,2).toFixed(0)}% | within 5%: ${within(all,5).toFixed(0)}% | within 10%: ${within(all,10).toFixed(0)}%`);
 console.log(`worst: ${Math.max(...all).toFixed(0)}%`);
}
run();
