/* Precompute the compact data MEDICHAM needs to run IN THE BROWSER (no server):
 * final L50 stats + types + auto-set moves/item/ability per species, the move
 * table (type/category/bp), the type chart, and the behaviour-clone priors.
 * Output embedded into web/index.html so the rollout runs client-side. */
const fs=require('fs'), path=require('path');
const S=require('../engine/sets.js'); const M=S.M;
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const out={mons:{},moves:{},C:M.C,priors:{}};

for(const k in M.MONS){
  let mon; try{ mon=S.buildOne(k); }catch(e){ mon=null; }
  if(!mon||!mon.st) continue;
  out.mons[k]={t:mon.types, st:{hp:mon.st.hp,at:mon.st.atk,df:mon.st.def,sa:mon.st.spa,sd:mon.st.spd,sp:mon.st.spe},
    mv:(mon.moves||[]).map(norm), item:norm(mon.item), ab:norm(mon.ability)};
}
for(const k in M.MOVES){ const mv=M.MOVES[k]; out.moves[norm(mv.n||k)]={t:mv.t,c:mv.c[0],bp:mv.bp||0}; }
try{ const pr=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/move-priors.json'),'utf8'));
  for(const s in pr.species){ out.priors[s]=pr.species[s].moves.slice(0,6).map(m=>[norm(m.mv),m.p,m.kind]); } }catch(e){}

fs.writeFileSync('/tmp/mc-embed.json',JSON.stringify(out));
process.stderr.write(`embed: ${Object.keys(out.mons).length} mons, ${Object.keys(out.moves).length} moves, ${Object.keys(out.priors).length} priors, ${(fs.statSync('/tmp/mc-embed.json').size/1024).toFixed(0)}KB\n`);
