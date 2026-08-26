/* validate_damage.js — MEDICHAM damage formula vs @smogon/calc (ground truth).
 * We feed BOTH the same stats (read from calc) so this isolates the damage MATH,
 * not stat-spread assumptions. Reports per-scenario min/max error, aggregate, and
 * WHERE MEDICHAM diverges (its known missing pieces). This is the GIGO audit. */
const path=require('path');
let SC; try{ SC=require('@smogon/calc'); }catch(e){ try{ SC=require('/tmp/calcval/node_modules/@smogon/calc'); }catch(e2){ console.error('need @smogon/calc: npm i @smogon/calc'); process.exit(2); } }
const {calculate,Pokemon,Move,Field,Generations}=SC;
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
/* THE SPECIES TABLE IS THE REAL ONE, AND THE STUB THAT USED TO STAND HERE MADE THIS GOLDEN MASTER
 * MEASURE A DIFFERENT ENGINE - 2026-08-26.
 *
 *     globalThis.MC = {mons:{}, moves:{}};        <- what this line was
 *
 * An empty `MC.mons` is not a harmless stand-in. `pasteKey()` resolves a species NAME through
 * `monKey()`, which reads `MC.mons`; with the table empty it answers nothing, so every tag whose
 * param is SPECIES-LOCKED silently stops applying. Light Ball is exactly that shape - `statMult`
 * carries `onlySpecies: 'Pikachu'` - and under the stub it read x1 while @smogon/calc read x2, a
 * clean 50% error that looked like a formula bug and was a harness bug.
 *
 * That is this project's signature failure with the roles reversed: the ENGINE was right and the
 * instrument was quietly running it with a piece missing. Suspect the instrument first
 * (docs/LESSONS.md, "suspect the instrument before the engine").
 *
 * The type chart is still this file's own TC, assigned AFTER the require so it wins - engine-data
 * exports an `mcEff` of its own and the point of this file is to isolate the damage MATH against a
 * chart that is known good, not to co-test the chart. */
require(path.join(__dirname,'..','data','engine-data.js'));
globalThis.mcEff=function(atk,defTypes){let m=1;for(const d of (defTypes||[])){const e=TC[atk]&&TC[atk][d];m*=(e===undefined?1:e);}return m;};
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
 bulletpunch:[40,'Steel','P',0],
};
const CALCMOVE={earthquake:'Earthquake',rockslide:'Rock Slide',closecombat:'Close Combat',bravebird:'Brave Bird',
 flareblitz:'Flare Blitz',heatwave:'Heat Wave',hydropump:'Hydro Pump',wavecrash:'Wave Crash',dracometeor:'Draco Meteor',
 moonblast:'Moonblast',makeitrain:'Make It Rain',shadowball:'Shadow Ball',iciclecrash:'Icicle Crash',
 thunderbolt:'Thunderbolt',dragonclaw:'Dragon Claw',suckerpunch:'Sucker Punch',playrough:'Play Rough',airslash:'Air Slash',bulletpunch:'Bullet Punch'};

/* THE SCENARIO TABLE, REPAIRED 2026-08-26. SEVEN OF ITS ENTITIES WERE NOT IN THIS REGULATION.
 *
 * This is the golden master on the damage number - the guard on the figure every other result in
 * the project rests on - and it had been RED at within-5% 92% / worst 50% for long enough to be
 * background noise. A check that is permanently red cannot report a regression, because a real one
 * is indistinguishable from the standing failure. That is the "known failure" trap CLAUDE.md bans
 * the phrase for, sitting on the damage number.
 *
 * All three red rows were the FIXTURE, and the engine agreed with the format on every one:
 *
 *   Choice Band     isNonstandard: 'Past' - BANNED here. CLAUDE.md names it on the ban list.
 *   Choice Specs    the same.
 *   Tinted Lens     legal, and ZERO legal carriers. It cannot occur in a game of this format.
 *
 * MEDICHAM already knew. The `if (phys && att.item === 'choiceband') ACH(1.5)` lines were removed
 * from medicham2-browser.js on 2026-08-10 precisely because those items are banned; this table went
 * on asking for them for sixteen days and reading the removal as a 34% error.
 *
 * FOUR MORE ENTITIES WERE ILLEGAL AND NOTHING WAS RED, WHICH IS WORSE. Flutter Mane, Chien-Pao,
 * Rillaboom and AMOONGUSS are all `isNonstandard: 'Past'`, and they appeared in 20 of the 36 rows.
 * @smogon/calc is MAINLINE, so it answers happily for a Pokemon this format does not have, and
 * MEDICHAM's table carries them too - the two agreed perfectly about a game nobody is playing.
 * Amoonguss is the one Will named by name: "IF I SEE ONE MORE AMOONGUSS OR BAXCALIBUR FROM YOU, YOU
 * ARE FIRED."
 *
 * EVERY REPLACEMENT KEEPS THE ROW'S INTENT, and the choice was derived rather than recalled:
 *
 *   Chien-Pao   -> Weavile           Dark/Ice, physical. The same two types.
 *   Amoonguss   -> Venusaur          Grass/Poison. The same two types.
 *   Flutter Mane-> Mimikyu-Busted    Ghost/Fairy - the only legal body with that pair, and the
 *                                    BUSTED forme so `@smogon/calc` does not apply Disguise (it
 *                                    excludes Mimikyu-Busted by name), which would zero the row.
 *   Flutter Mane-> Gardevoir         as the Fairy SPECIAL attacker; derived from the legal species
 *      (as attacker)                 that are Fairy, learn Moonblast and have SpA >= 100.
 *   Rillaboom   -> Machamp           a legal Fighting body that learns Close Combat.
 *   Choice Band -> Pikachu @ Light Ball, Play Rough
 *   Choice Specs-> Pikachu @ Light Ball, Thunderbolt
 *      Light Ball is the ONLY item left in this regulation that multiplies a RAW ATTACK STAT
 *      (`chainModify(2)` on both Atk and SpA) rather than base power - derived by walking every
 *      legal item for onModifyAtk/onModifySpA. Swapping in a type-boost item instead would have
 *      duplicated the Black Glasses / Charcoal / Fairy Feather rows, which is deleting coverage
 *      while appearing to keep it. It also has 49 corpus uses and was a roster DID-NOT-FIRE row.
 *   Tinted Lens -> Charizard-Mega-X @ Tough Claws, Flare Blitz into Pelipper
 *      An ATTACKER ability that multiplies damage under a condition - the layer Tinted Lens was
 *      standing for - carried by a legal body, and still a RESISTED hit, which is what the original
 *      row was checking. Derived from the legal abilities with carriers that declare onBasePower.
 *
 * AND TWO ABILITIES WERE STAMPED ON BODIES THAT CANNOT HAVE THEM. Solid Rock was put on Incineroar
 * and Thick Fat on Amoonguss. Both now sit on real carriers (Rhyperior, Venusaur-Mega), so the row
 * is a board that could occur.
 *
 * THE PREFLIGHT BELOW IS THE DURABLE HALF. Every literal in this table is put to the format on every
 * run, so the next regulation change is named rather than absorbed. */
// scenarios: [attacker, ability, item, nature, evAtkOrSpa, move, defender, defNature, defEVs, weather]
const W_NONE=undefined;
const S=[
 // --- plain STAB / neutral / resist / super-effective, no weather/item ---
 ['Garchomp','Rough Skin',null,'Adamant','atk','earthquake','Incineroar','Careful',{hp:252,spd:4},W_NONE],
 ['Garchomp','Rough Skin',null,'Adamant','atk','earthquake','Gholdengo','Bold',{hp:252,def:4},W_NONE],
 ['Kingambit','Defiant',null,'Adamant','atk','suckerpunch','Mimikyu-Busted','Timid',{hp:252},W_NONE],
 ['Weavile','Pressure',null,'Jolly','atk','iciclecrash','Garchomp','Jolly',{hp:252},W_NONE],
 ['Incineroar','Intimidate',null,'Adamant','atk','flareblitz','Venusaur','Calm',{hp:252,def:4},W_NONE],
 ['Gardevoir','Synchronize',null,'Timid','spa','moonblast','Garchomp','Jolly',{hp:252},W_NONE],
 ['Gholdengo','Good as Gold',null,'Modest','spa','makeitrain','Mimikyu-Busted','Timid',{hp:252},W_NONE],
 ['Archaludon','Stamina',null,'Modest','spa','thunderbolt','Pelipper','Bold',{hp:252,def:4},W_NONE],
 ['Machamp','Guts',null,'Adamant','atk','closecombat','Kingambit','Adamant',{hp:252},W_NONE],
 ['Dragonite','Multiscale',null,'Adamant','atk','dragonclaw','Garchomp','Jolly',{hp:252},W_NONE],
 // --- items: the raw attack-stat multiplier (Light Ball, x2, Pikachu-only) and Life Orb ---
 ['Pikachu','Static','Light Ball','Adamant','atk','playrough','Garchomp','Jolly',{hp:252},W_NONE],
 ['Pikachu','Static','Light Ball','Modest','spa','thunderbolt','Pelipper','Bold',{hp:252,def:4},W_NONE],
 ['Weavile','Pressure','Life Orb','Jolly','atk','iciclecrash','Dragonite','Adamant',{hp:252},W_NONE],
 ['Gholdengo','Good as Gold','Life Orb','Modest','spa','shadowball','Mimikyu-Busted','Timid',{hp:252},W_NONE],
 // --- spread moves (doubles x0.75) ---
 ['Garchomp','Rough Skin',null,'Adamant','atk','rockslide','Talonflame','Jolly',{hp:252},W_NONE],
 ['Incineroar','Intimidate',null,'Modest','spa','heatwave','Venusaur','Calm',{hp:252,spd:4},W_NONE],
 ['Gholdengo','Good as Gold',null,'Modest','spa','makeitrain','Mimikyu-Busted','Timid',{hp:252},W_NONE],
 // --- weather: Rain boosts Water / cuts Fire; Sun boosts Fire / cuts Water ---
 ['Pelipper','Drizzle',null,'Modest','spa','hydropump','Incineroar','Careful',{hp:252,spd:4},'Rain'],
 ['Basculegion','Swift Swim',null,'Adamant','atk','wavecrash','Garchomp','Jolly',{hp:252},'Rain'],
 ['Charizard','Solar Power',null,'Timid','spa','heatwave','Venusaur','Calm',{hp:252,spd:4},'Sun'],
 ['Torkoal','Drought',null,'Modest','spa','heatwave','Kingambit','Adamant',{hp:252},'Sun'],
 ['Pelipper','Drizzle',null,'Modest','spa','hydropump','Torkoal','Bold',{hp:252,def:4},'Sun'], // fire-cut water
 // --- ability/item layer (attacker ab/item; defAb is 11th, defItem 12th) ---
 ['Basculegion','Adaptability',null,'Adamant','atk','wavecrash','Garchomp','Jolly',{hp:252},W_NONE],            // STAB x2
 ['Scizor','Technician',null,'Adamant','atk','bulletpunch','Mimikyu-Busted','Timid',{hp:252},W_NONE],           // <=60bp x1.5
 ['Charizard-Mega-X','Tough Claws',null,'Adamant','atk','flareblitz','Pelipper','Bold',{hp:252,def:4},W_NONE],  // contact x1.3, resisted
 ['Garchomp','Rough Skin',null,'Adamant','atk','earthquake','Rhyperior','Careful',{hp:252,spd:4},W_NONE,'Solid Rock'],    // SE x0.75
 ['Mamoswine','Thick Fat',null,'Adamant','atk','iciclecrash','Dragonite','Adamant',{hp:252},W_NONE,'Multiscale'],         // full HP x0.5
 ['Incineroar','Intimidate',null,'Adamant','atk','flareblitz','Venusaur-Mega','Calm',{hp:252,def:4},W_NONE,'Thick Fat'],  // fire x0.5
 ['Garchomp','Rough Skin','Expert Belt','Adamant','atk','earthquake','Incineroar','Careful',{hp:252,spd:4},W_NONE],       // SE x1.2
 ['Garchomp','Rough Skin','Muscle Band','Adamant','atk','earthquake','Gholdengo','Bold',{hp:252,def:4},W_NONE],           // phys x1.1
 ['Gholdengo','Good as Gold','Wise Glasses','Modest','spa','shadowball','Mimikyu-Busted','Timid',{hp:252},W_NONE],        // spec x1.1
 /* --- ADDED 2026-07-29, and the reason matters. Will asked how the damage could line up with
    Showdown if the calc had so many errors. It lined up on everything it was ASKED: the original 31
    scenarios covered Choice Band, Life Orb, Expert Belt, Muscle Band and Wise Glasses, and not one
    type-boost item or resist berry. A grep for blackglasses|charcoal in this file returned 0. The
    case list was written from the same mental model as the calc, so both were blind to the same 18
    items. These scenarios are the gap, and they FAIL with ABRA_TAGS_OFF=1 by construction. */
 ['Kingambit','Defiant','Black Glasses','Adamant','atk','suckerpunch','Gholdengo','Bold',{hp:252,def:4},W_NONE],          // Dark x1.2
 ['Incineroar','Intimidate','Charcoal','Adamant','atk','flareblitz','Venusaur','Calm',{hp:252,def:4},W_NONE],             // Fire x1.2
 ['Gardevoir','Synchronize','Fairy Feather','Timid','spa','moonblast','Garchomp','Jolly',{hp:252},W_NONE],                // Fairy x1.2
 ['Kingambit','Defiant',null,'Adamant','atk','suckerpunch','Gholdengo','Bold',{hp:252,def:4},W_NONE,null,'Colbur Berry'], // SE Dark halved
 ['Machamp','Guts',null,'Adamant','atk','closecombat','Kingambit','Adamant',{hp:252},W_NONE,null,'Chople Berry'],         // SE Fighting halved
];

/* THE PREFLIGHT - EVERY LITERAL ABOVE, PUT TO THE FORMAT ON EVERY RUN.
 *
 * @smogon/calc is mainline Gen 9 and answers for anything; MEDICHAM's table carries the same bodies.
 * So two engines agreeing about a banned item, or about a Pokemon this regulation does not have, is
 * not evidence of anything - it is the FIXTURE being wrong in a way neither side can see. That is
 * how Amoonguss sat in twenty rows at 0% error.
 *
 * It is DERIVED, so a regulation change is caught with no edit here. It refuses BY CARRIER as well
 * as by `isNonstandard`, which is the clause that catches Tinted Lens: legal by every flag and
 * impossible in play.
 *
 * IT SKIPS LOUDLY RATHER THAN FAILING when no Showdown checkout is reachable, because the DAMAGE
 * comparison needs no format and must keep running in CI. A skip is not a pass and it says so. */
function preflight(){
  let PF=null;
  try{ PF=require(path.join(__dirname,'fixture_preflight.js')); }
  catch(e){
    console.log('\n  PREFLIGHT SKIPPED - no Champions format reachable ('+String(e.message).slice(0,60)+').');
    console.log('  The legality of these '+S.length+' scenarios was NOT checked on this run.');
    return true;
  }
  const bad=[];
  const seen=new Set();
  const put=(kind,name)=>{ if(!name)return; const k=kind+':'+name; if(seen.has(k))return; seen.add(k);
    const r=PF.playable(kind,name); if(!r.ok)bad.push(r.why); };
  for(const sc of S){
    const [att,ab,item,,,mvKey,def,,,,defAb,defItem]=sc;
    put('species',att); put('species',def);
    put('ability',ab);  put('ability',defAb);
    put('item',item);   put('item',defItem);
    put('move',mvKey);
  }
  if(bad.length){
    console.error('\nREFUSING: this scenario table names '+bad.length+' entities that are not in Reg M-B.');
    for(const b of bad) console.error('  - '+b);
    console.error('A fixture built on an entity that cannot occur measures a game we do not play.');
    return false;
  }
  console.log('  preflight: all '+seen.size+' named entities are playable in Reg M-B (derived at run time)');
  return true;
}

function medStat(res, side, cat){ const st=res[side].stats; return cat==='P'?st.atk:st.spa; }
function run(){
 if(!preflight()) process.exit(1);
 let rows=[], errsMin=[], errsMax=[];
 for(const sc of S){
  const [att,ab,item,nat,off,mvKey,def,dnat,devs,weather,defAb,defItem]=sc;
  const [bp,type,cat,spread]=MV[mvKey];
  const evA = off==='atk'?{atk:252}:{spa:252};
  const A=new Pokemon(gen,att,{level:50,ability:ab,item:item||undefined,nature:nat,evs:evA});
  const D=new Pokemon(gen,def,{level:50,nature:dnat,evs:devs,ability:defAb||undefined,item:defItem||undefined});
  const field=new Field({gameType:'Doubles', weather:weather});
  let calcLo,calcHi;
  try{ const res=calculate(gen,A,D,new Move(gen,CALCMOVE[mvKey]),field); const r=res.range(); calcLo=r[0];calcHi=r[1]; }
  catch(e){ rows.push({sc:`${att} ${mvKey} -> ${def}`,err:'calc:'+e.message}); continue; }
  // align stats: read calc's computed stats, feed MEDICHAM the same
  const Araw = cat==='P'?A.stats.atk:A.stats.spa;
  const Draw = cat==='P'?D.stats.def:D.stats.spd;
  /* `name` IS NOT COSMETIC. A species-locked tag param (Light Ball's `onlySpecies: 'Pikachu'`) is
   * matched against the body's own key, so a nameless body silently declines every one of them -
   * the same class of hole as the empty MC stub at the top of this file. The key shape is
   * medicham2's: lower case, hyphens kept, so `Charizard-Mega-X` -> `charizard-mega-x`. */
  const key=n=>String(n||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
  const mAtt={ st:{at:Araw,sa:Araw}, boosts:{at:0,sa:0}, item:(item||'').toLowerCase().replace(/[^a-z]/g,''),
    ability:(ab||'').toLowerCase().replace(/[^a-z]/g,''), types:A.types.slice(), status:null, name:key(att) };
  const mDef={ st:{df:Draw,sd:Draw,hp:D.stats.hp}, boosts:{df:0,sd:0}, item:(defItem||'').toLowerCase().replace(/[^a-z]/g,''),
    ability:(defAb||'').toLowerCase().replace(/[^a-z]/g,''), types:D.types.slice(), curHP:D.stats.hp, name:key(def) };
  const mMove={bp,c:cat,t:type,id:mvKey};
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
 const errored=rows.filter(r=>r.err).length;
 console.log('\n=== AGGREGATE (|% error| vs @smogon/calc, stats aligned) ===');
 console.log(`scenarios: ${errsMin.length} compared, ${errored} errored | median abs err: ${med(all).toFixed(1)}% | within 2%: ${within(all,2).toFixed(0)}% | within 5%: ${within(all,5).toFixed(0)}% | within 10%: ${within(all,10).toFixed(0)}%`);
 console.log(`worst: ${all.length?Math.max(...all).toFixed(0):'n/a'}%`);

 /* THIS GATE PRINTED "PASS" AND EXITED 0 WHEN EVERY SCENARIO FAILED.
  *
  * The catch above pushes an error row and `continue`s, so an erroring scenario never reaches
  * errsMin/errsMax — it is dropped from the numerator AND the denominator. With all 36 erroring,
  * `all` is empty, so within(all,5) is 100*0/0 = NaN and Math.max(...[]) is -Infinity. The old
  * condition was `if (w5 < 95 || worst > 8)`, and NaN < 95 is false while -Infinity > 8 is false,
  * so it did not fire: the file printed PASS and returned 0. Verified by execution, 2026-07-31.
  *
  * That is the golden master on the number every other result in this project depends on, and CI
  * runs it as a bare gate step (.github/workflows/tests.yml) with @smogon/calc installed UNPINNED —
  * so one upstream rename of `calculate` or `range()` makes all 36 throw and the gate reports
  * success. The sibling engine/validate_damage_sim.js already counts `errored` and exits 1; this
  * file never did.
  *
  * THREE CONDITIONS, ALL REQUIRED. Coverage first: a comparison that did not happen cannot pass. */
 if(errored){ console.error(`REFUSING: ${errored} of ${S.length} scenarios could not be compared at all (@smogon/calc threw).`);
   console.error('A scenario that never ran is not a scenario that agreed. Fix the calc call or pin the dependency.');
   process.exit(1); }
 if(errsMin.length!==S.length){ console.error(`REFUSING: only ${errsMin.length} of ${S.length} scenarios produced a comparison.`);
   process.exit(1); }
 if(!all.length){ console.error('REFUSING: no error measurements at all — there is nothing here to pass.'); process.exit(1); }

 const w5=within(all,5), worst=Math.max(...all);
 if(!(w5>=95)||!(worst<=8)){ console.error(`REGRESSION: within-5% ${w5.toFixed(0)}% (need >=95), worst ${worst.toFixed(0)}% (need <=8)`); process.exit(1); }
 console.log(`PASS: MEDICHAM damage within tolerance of @smogon/calc (${errsMin.length}/${S.length} scenarios compared)`);

 /* THE ARTIFACT IS NOW WRITTEN HERE, BECAUSE IT WAS BEING TYPED.
  *
  * data/damage-validation.json declared `"generated": "engine/validate_damage.js vs @smogon/calc"`
  * and THIS FILE HAS NEVER WRITTEN A BYTE — neither validate_damage.js nor validate_damage_sim.js
  * contained a single write. It was hand-maintained state wearing a generated artifact's clothes,
  * feeding engine/build-status.js and through it the site's status page.
  *
  * Its numbers happened to be right. Its PROSE was not: the verdict read "100% of 31 tested
  * scenarios" while the table had grown to 36. Somebody updated the counts and not the sentence,
  * which is precisely what a typed artifact does — half of it goes stale and nothing says so.
  * (S13: if it can be derived, generate it; never type it.)
  *
  * Every field below is derived from the run that just happened, including the verdict sentence. */
 const out = {
   generated: new Date().toISOString().slice(0, 10),
   by: 'engine/validate_damage.js',
   source: 'engine/validate_damage.js compared against @smogon/calc (MIT), stats aligned to isolate the damage math',
   gen: 9,
   level: 50,
   scenarios: S.length,
   compared: errsMin.length,
   result: {
     median_abs_err_pct: +med(all).toFixed(2),
     within_2pct: +within(all, 2).toFixed(0),
     within_5pct: +w5.toFixed(0),
     worst_pct: +worst.toFixed(0),
     note: 'the worst case is 16-roll quantisation rounding, not a formula error',
   },
   verdict: `MEDICHAM matches @smogon/calc within 5% on ${within(all, 5).toFixed(0)}% of ${errsMin.length} compared scenarios `
          + `(worst ${worst.toFixed(0)}%), at level ${50} in gen ${9}.`,
   caveat: 'Agreement with @smogon/calc is agreement on the DAMAGE FORMULA only. It says nothing '
         + 'about move selection, about the accuracy model, or about mechanics neither implements.',
 };
 require('fs').writeFileSync(require('path').join(__dirname, '..', 'data', 'damage-validation.json'),
   JSON.stringify(out, null, 1) + '\n');
 console.log('  -> data/damage-validation.json');
}
/* S1 - the scenario table has ONE home. engine/validate_damage_sim.js runs the same 31 scenarios
 * through the OFFICIAL Champions engine, and a second copy of this table would be free to drift from
 * this one without anything noticing. Export it instead. MV/CALCMOVE go with it because a scenario
 * is meaningless without the move metadata it indexes. */
module.exports = { SCENARIOS: S, MV, CALCMOVE, W_NONE };

if (require.main === module) run();
