/* policy.js — the behaviour-clone. Mines what each species ACTUALLY clicks from
 * the stored per-turn stream (real ladder players), split by turn 1 vs later.
 * This is the move policy MEDICHAM samples from, so its rollouts click Tailwind,
 * Fake Out, Spore, Swords Dance, Protect — because strong players do — instead of
 * only ever picking max damage. Pure re-computation over stored data.
 *
 *   node engine/policy.js   ->   data/move-priors.json
 */
const fs=require('fs'), path=require('path');
const { classify } = require('./moves-meta.js');
const STORE=process.argv[2]||path.join(__dirname,'../data/games.ladder.jsonl');
const OUT=process.argv[3]||path.join(__dirname,'../data/move-priors.json');
const key=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

const sp={};                 // species -> {all:{move:count}, t1:{move:count}, acts}
const seen=new Set();
function bump(o,m){ o[m]=(o[m]||0)+1; }

for(const line of fs.readFileSync(STORE,'utf8').split('\n')){
  if(!line.trim())continue; let r; try{r=JSON.parse(line);}catch(e){continue;}
  if(seen.has(r.id))continue; seen.add(r.id);
  for(const t of (r.turns||[])){
    for(const e of t.ev){
      if(e.t!=='m'||!e.mon||!e.mv)continue;
      const s=e.mon, mv=key(e.mv);
      sp[s]=sp[s]||{all:{},t1:{},acts:0}; sp[s].acts++;
      bump(sp[s].all,mv); if(t.n===1) bump(sp[s].t1,mv);
    }
  }
}

// finalize -> probabilities + tags, keep species with enough signal
const out={ generated:new Date().toISOString().slice(0,10), species:{} };
let kept=0, statusMoves=0;
for(const s in sp){
  const d=sp[s]; if(d.acts<15) continue;          // need a real sample
  const total=Object.values(d.all).reduce((a,b)=>a+b,0);
  const moves=Object.entries(d.all).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([mv,c])=>{
    const cls=classify(mv); if(cls.kind!=='other'&&cls.kind!=='pivot') statusMoves++;
    return { mv, p:+(c/total).toFixed(3), kind:cls.kind, effect:cls.effect||null, boosts:cls.boosts||null };
  });
  const t1total=Object.values(d.t1).reduce((a,b)=>a+b,0)||1;
  const lead=Object.entries(d.t1).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([mv,c])=>({mv,p:+(c/t1total).toFixed(3),kind:classify(mv).kind}));
  out.species[s]={ acts:d.acts, moves, lead };
  kept++;
}
fs.writeFileSync(OUT, JSON.stringify(out));
process.stderr.write(`behaviour-clone: ${kept} species profiled from real clicks, ${statusMoves} non-damage move slots tagged -> ${OUT}\n`);
// human peek: a support mon's real move mix
for(const s of ['whimsicott','incineroar','amoonguss','torkoal']){
  if(out.species[s]) process.stderr.write(`  ${s}: `+out.species[s].moves.map(m=>`${m.mv}${m.kind!=='other'?'['+m.kind+']':''} ${Math.round(m.p*100)}%`).join(', ')+'\n');
}
module.exports={};
