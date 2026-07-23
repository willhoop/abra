/* ABRA shared set-builder — turns a bare species name into a plausible, legal set.
 * Decodes CHOMP's champions-legal-moves bitmask (no /tmp dependency), picks a
 * coverage moveset by CHOMP's own stat table, and returns a built mon ready for
 * champ-model's damage engine. Used by MEDICHAM (rollouts) and DITTO (team search).
 * Sets are HEURISTIC v1 priors; behaviour-cloned sets from ABRA's revealed data
 * are the documented upgrade. */
const fs=require('fs'), path=require('path');
const CHOMP=path.join(__dirname,'../../CHOMP');
const M=require(path.join(CHOMP,'engine/champ-model.js'));
const LEGAL=JSON.parse(fs.readFileSync(path.join(CHOMP,'data/champions-legal-moves.json'),'utf8'));

// ---- decode the per-species legal-move bitmask for a regulation --------------
function movesFor(sid, reg='reg-mb'){
  const table=(LEGAL.regs&&(LEGAL.regs[reg]||LEGAL.regs['reg-mb']))||{};
  const b64=table[sid]; if(!b64) return [];
  const buf=Buffer.from(b64,'base64'); const out=[];
  for(let i=0;i<LEGAL.moves.length;i++){ if(buf[i>>3]&(1<<(i&7))) out.push(LEGAL.moves[i]); }
  return out;   // array of normalized move ids
}

// minimal ability / mega-item priors (weather + key abilities), else a safe default
const ABIL={ pelipper:'Drizzle', politoed:'Drizzle', torkoal:'Drought', charizard:'Drought',
  tyranitar:'Sand Stream', 'ninetales-alola':'Snow Warning', abomasnow:'Snow Warning',
  incineroar:'Intimidate', gyarados:'Intimidate', staraptor:'Intimidate', archaludon:'Stamina',
  meowscarada:'Protean', greninja:'Protean', kingambit:'Defiant', whimsicott:'Prankster',
  basculegion:'Adaptability', dragonite:'Multiscale', blastoise:'Mega Launcher', sylveon:'Pixilate',
  garchomp:'Rough Skin', sinistcha:'Hospitality', grimmsnarl:'Prankster', dragapult:'Clear Body' };
const MEGA_ITEM={ blastoise:'Blastoisinite', charizard:'Charizardite Y', tyranitar:'Tyranitarite',
  gyarados:'Gyaradosite', metagross:'Metagrossite', gengar:'Gengarite', staraptor:'Staraptite',
  venusaur:'Venusaurite', sceptile:'Sceptilite', aerodactyl:'Aerodactylite' };

function autoPaste(key){
  const mon=M.MONS[key]; if(!mon) return null;
  const legal=movesFor(key).map(n=>M.mvByName[n]).filter(Boolean);
  const phys = mon.bs.atk >= mon.bs.spa;
  const cat = phys?'Physical':'Special';
  const atks=legal.filter(m=>m.c===cat&&m.bp).sort((a,b)=>{
    const sa=(mon.t.includes(a.t)?1.5:1)*a.bp, sb=(mon.t.includes(b.t)?1.5:1)*b.bp; return sb-sa; });
  const picked=[], usedT=new Set();
  for(const m of atks){ if(picked.length>=3)break; if(usedT.has(m.t)&&picked.length>=1)continue; picked.push(m.n); usedT.add(m.t); }
  while(picked.length<3&&atks.length){ const m=atks.find(x=>!picked.includes(x.n)); if(!m)break; picked.push(m.n); }
  const hasProtect=movesFor(key).includes('protect');
  const moves=picked.slice(0,3).concat(hasProtect?['Protect']:[]);
  if(!moves.length) return null;
  const item=MEGA_ITEM[key]||'Life Orb';
  const nature=phys?'Adamant':'Modest';
  const sp=phys?'2 HP / 32 Atk / 32 Spe':'2 HP / 32 SpA / 32 Spe';
  return `${mon.name} @ ${item}\nAbility: ${ABIL[key]||'Pressure'}\nLevel: 50\n${nature} Nature\nEVs: ${sp}\n`+moves.map(x=>'- '+x).join('\n');
}
function buildOne(key){ const p=autoPaste(key); if(!p)return null; try{ return M.buildMon(M.parsePaste(p)[0]); }catch(e){ return null; } }
function team6(keys){ return keys.map(buildOne).filter(Boolean); }

module.exports={ M, movesFor, autoPaste, buildOne, team6 };
