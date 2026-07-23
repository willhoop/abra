/* CHOMP-as-predictor: turn CHOMP's exact-damage matchup score into a per-game
 * signal we can calibrate into a win probability and backtest against JOLTEON.
 * For each stored human game, cs1 = CHOMP's best-4 coverage score of p1's six vs
 * p2's six, cs2 = the reverse. (cs1 - cs2) is the damage-grounded edge.
 * Outputs data/chomp-scores.jsonl {id,date,y,cs1,cs2,r1,r2}. Node, cached by species.
 *   N=1500 node engine/chomp-predict.js
 */
const fs=require('fs'), path=require('path');
const S=require('./sets.js');
const STORE=path.join(__dirname,'../data/games.ladder.jsonl');
const OUT=path.join(__dirname,'../data/chomp-scores.jsonl');
const N=+(process.env.N||1500);
const idn=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

const monCache={};
const mon=k=>{ if(k in monCache) return monCache[k]; return monCache[k]=S.buildOne(k); };
const team6=six=>six.map(mon).filter(Boolean);

// load humans-only finished games with full sixes, temporal order
let rows=[];
const seen=new Set();
for(const line of fs.readFileSync(STORE,'utf8').split('\n')){
  if(!line.trim())continue; let g; try{g=JSON.parse(line);}catch(e){continue;}
  if(seen.has(g.id))continue; seen.add(g.id);
  if(!g.winner||g.p1.bot||g.p2.bot)continue;
  const a=g.six.p1.map(idn), b=g.six.p2.map(idn);
  if(a.length<4||b.length<4)continue;
  rows.push({id:g.id,date:g.date||'',y:idn(g.winner)===idn(g.p1.name)?1:0,a,b,r1:g.p1.rating||null,r2:g.p2.rating||null});
}
rows.sort((x,y)=>(x.date<y.date?-1:1));
if(rows.length>N) rows=rows.slice(rows.length-N);   // most recent N for runtime

const out=fs.createWriteStream(OUT); let done=0, t0=Date.now();
for(const r of rows){
  const A=team6(r.a), B=team6(r.b);
  if(A.length<3||B.length<3) continue;
  let cs1=0, cs2=0;
  try{ cs1=S.M.bring4(A,B).score; cs2=S.M.bring4(B,A).score; }catch(e){ continue; }
  out.write(JSON.stringify({id:r.id,date:r.date,y:r.y,cs1,cs2,r1:r.r1,r2:r.r2})+'\n');
  if(++done%200===0) process.stderr.write(`  ${done}/${rows.length}  (${((Date.now()-t0)/1000).toFixed(0)}s)\n`);
}
out.end();
out.on('finish',()=>process.stderr.write(`CHOMP scores: ${done} games -> ${OUT}  (${((Date.now()-t0)/1000).toFixed(0)}s)\n`));
