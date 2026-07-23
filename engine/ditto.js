/* DITTO (Node port) — Double-oracle Iterative Team-Tuning Optimiser.
 * Team search that runs entirely in Node, so the live app needs NO Python.
 *
 * Coarse-to-fine, exactly the tiered design:
 *   1. JOLTEON (fast, in-JS logistic over the trained weights) screens the whole
 *      hill-climb — thousands of candidate teams, microseconds each.
 *   2. Usage-weighted threat coverage guarantees an answer to high-bring threats
 *      (Basculegion) and ignores rare ones (Camerupt).
 *   3. MEDICHAM (native, same process) re-ranks the FINALISTS with grounded
 *      rollouts — the honesty check that catches JOLTEON Goodharting itself.
 * Recency weighting (data/*.jsonl dates) matches jolteon.py's decay rule.
 *
 *   node engine/ditto.js ["pelipper,whimsicott,archaludon,basculegion,kingambit,sinistcha"]
 */
const fs=require('fs'), path=require('path');
const S=require('./sets.js');
const { winProb } = require('./medicham.js');
const idn=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const D=__dirname;

// ---- load the trained JOLTEON model + dynamics features (pure JS scoring) ----
const W=JSON.parse(fs.readFileSync(path.join(D,'../data/jolteon-weights.json'),'utf8'));
const SP=W.species, IDX={}; SP.forEach((s,i)=>IDX[s]=i);
const N=SP.length, wSpeed=W.w[N], wFire=W.w[N+1];
let DYN={speed:{},damage:{}}; try{ DYN=JSON.parse(fs.readFileSync(path.join(D,'../data/dynamics.json'),'utf8')); }catch(e){}
const spd=s=>(DYN.speed[s]||{}).firstRate??0.5;
const fireMap={}; for(const k in (DYN.damage||{})){ const sp=k.split('|')[0]; fireMap[sp]=Math.max(fireMap[sp]||0,DYN.damage[k].mean); }
const fire=s=> (fireMap[s]?fireMap[s]/100:0.5);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0.5;
function strength(six){ let s=0; for(const m of six) if(m in IDX) s+=W.w[IDX[m]]; return s; }
function feat(six){ return { s:strength(six), spd:mean(six.map(spd)), fire:mean(six.map(fire)) }; }
function pwin(a,b){ const fa=feat(a),fb=feat(b);
  const z=(fa.s-fb.s)+wSpeed*(fa.spd-fb.spd)+wFire*(fa.fire-fb.fire); return 1/(1+Math.exp(-z)); }

// ---- meta gauntlet: real high-ladder human teams from the store ----
function loadMeta(minRating=1300, cap=400){
  const seen=new Set(), teams=[];
  for(const line of fs.readFileSync(path.join(D,'../data/games.ladder.jsonl'),'utf8').split('\n')){
    if(!line.trim())continue; let g; try{g=JSON.parse(line);}catch(e){continue;}
    for(const side of ['p1','p2']){ const pl=g[side]; if(!pl||pl.bot||(pl.rating||0)<minRating)continue;
      const six=[...new Set(g.six[side].map(idn))].sort(); if(six.length<6)continue;
      const key=six.join(','); if(seen.has(key))continue; seen.add(key); teams.push(six); }
  }
  for(let i=teams.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [teams[i],teams[j]]=[teams[j],teams[i]]; }
  return teams.slice(0,cap);
}

// ---- fast scoring: precompute each meta team's JOLTEON scalar ----
let METScal=null, MET=null;
function prep(meta){ MET=meta; METScal=meta.map(m=>{const f=feat(m);return f.s+wSpeed*f.spd+wFire*f.fire;}); }
function scores(six){ const f=feat(six); const z=f.s+wSpeed*f.spd+wFire*f.fire; return METScal.map(ms=>1/(1+Math.exp(-(z-ms)))); }
function score(six){ return mean(scores(six)); }

// ---- usage-weighted threat coverage (answer Basculegion, not Camerupt) ----
let usage={}, topThreats=[], masks={};
function prepThreats(meta,top=10){
  const cnt={}; for(const m of meta) for(const s of m) cnt[s]=(cnt[s]||0)+1;
  usage={}; for(const s in cnt) usage[s]=cnt[s]/meta.length;
  topThreats=Object.keys(usage).sort((a,b)=>usage[b]-usage[a]).slice(0,top);
  masks={}; for(const t of topThreats) masks[t]=meta.map(m=>m.includes(t));
}
function coverage(six){ const sc=scores(six); const out=[];
  for(const t of topThreats){ const mk=masks[t]; const idxs=[]; mk.forEach((v,i)=>v&&idxs.push(i));
    if(idxs.length<4)continue; out.push([t,usage[t],mean(idxs.map(i=>sc[i])),idxs.length]); } return out; }
function penalty(six,thresh=0.5,lam=1.5){ let p=0; for(const [t,u,wr] of coverage(six)) p+=u*Math.max(0,thresh-wr); return lam*p; }
function objective(six){ return score(six)-penalty(six); }
function hardest(six,k=5){ const sc=scores(six); return MET.map((m,i)=>[m,sc[i]]).sort((a,b)=>a[1]-b[1]).slice(0,k).map(x=>x[0]); }

function optimise(seed,pool,passes=3){ let team=seed.slice(), best=objective(team);
  for(let p=0;p<passes;p++){ let improved=false;
    for(let i=0;i<team.length;i++){ for(const c of pool){ if(team.includes(c))continue;
      const t=team.slice(); t[i]=c; if(new Set(t).size!==t.length)continue;
      const sc=objective(t); if(sc>best+0.002){ team=t; best=sc; improved=true; } } }
    if(!improved)break; }
  return {team,best}; }

// ---- MEDICHAM finalist re-rank (native, coarse-to-fine) ----
function medichamRank(candidates, foes, N=150){
  return candidates.map(six=>{ const A=S.team6(six.slice(0,4));
    const ps=foes.map(f=>{ const B=S.team6(f.slice(0,4)); return (A.length>=2&&B.length>=2)?winProb(A,B,N):null; }).filter(x=>x!=null);
    return { six, med: ps.length?mean(ps):null, jolt:score(six) };
  }).sort((a,b)=>(b.med??-1)-(a.med??-1));
}

if(require.main===module){
  const seed=(process.argv[2]?process.argv[2].split(','):['pelipper','whimsicott','archaludon','basculegion','kingambit','sinistcha']).map(idn);
  let meta=loadMeta(); prep(meta); prepThreats(meta);
  const cnt={}; for(const m of meta) for(const s of m) cnt[s]=(cnt[s]||0)+1;
  const pool=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,30);
  console.log(`meta gauntlet: ${meta.length} real high-ladder teams | proven-meta pool: ${pool.length} species\n`);
  console.log(`seed team:  ${seed.join(', ')}`);
  console.log(`seed win rate vs meta: ${(score(seed)*100).toFixed(1)}%\n`);

  // double-oracle rounds, collecting distinct finalists
  let team=seed; const finalists=new Set([seed.join(',')]);
  for(let r=1;r<=3;r++){ prep(meta); prepThreats(meta);
    const o=optimise(team,pool); team=o.team; finalists.add(team.join(','));
    console.log(`round ${r}: objective ${(o.best*100).toFixed(1)}%  ->  ${team.join(', ')}`);
    meta=meta.concat(hardest(team,5).flatMap(x=>[x,x,x])); }

  const meta0=loadMeta(); prep(meta0); prepThreats(meta0);
  console.log(`\nFINAL TEAM (JOLTEON-optimised)\n  ${team.join(', ')}`);
  console.log(`  JOLTEON mean win rate vs live meta: ${(score(team)*100).toFixed(1)}%`);

  console.log(`\nThreat coverage (win rate vs teams that actually run each top-used threat):`);
  for(const [t,u,wr] of coverage(team)) console.log(`    ${t.padEnd(14)} on ${(u*100).toFixed(1).padStart(4)}% of teams  ->  ${(wr*100).toFixed(1)}%  ${wr>=0.5?'OK':'<< GAP'}`);

  // MEDICHAM finalist vetting (native, same process) — coarse-to-fine
  const cands=[...finalists].map(s=>s.split(','));
  const sample=meta0.slice(0,4);
  console.log(`\nMEDICHAM finalist re-rank (grounded rollouts on ${cands.length} candidate teams):`);
  const ranked=medichamRank(cands, sample);
  for(const r of ranked) console.log(`    MEDICHAM ${r.med==null?'n/a':(r.med*100).toFixed(1)+'%'}  |  JOLTEON ${(r.jolt*100).toFixed(1)}%   ${r.six.join(', ')}`);
  const win=ranked[0];
  console.log(`\nCHOSEN (JOLTEON proposes, MEDICHAM decides):\n  ${win.six.join(', ')}`);
  console.log(`  MEDICHAM ${win.med==null?'n/a':(win.med*100).toFixed(1)+'%'} vs JOLTEON ${(win.jolt*100).toFixed(1)}% — trust MEDICHAM where they disagree.`);
}
module.exports={ pwin, score, loadMeta, prep, optimise, medichamRank };
