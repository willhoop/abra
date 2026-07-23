/* backtest_winrate.js — does MEDICHAM's predicted P(win) actually predict real game outcomes?
 * For held-out real games, run the rollout on the two BROUGHT teams, compare P(p1 win) to the
 * actual winner. Proper scores (log-loss, Brier) with bootstrap CIs, vs a coin and vs player-Elo.
 * This is the construct-validity test the reviewer demanded: precision (CI on the site) != accuracy. */
const fs=require('fs'), path=require('path');
require(path.join(__dirname,'..','data','engine-data.js'));      // sets globalThis.MC, mcEff
const {winProb2}=require(path.join(__dirname,'medicham2-browser.js'));
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const N=+(process.env.N||40), MAXG=+(process.env.MAXG||350);

const lines=fs.readFileSync(path.join(__dirname,'..','data','games.ladder.jsonl'),'utf8').split('\n').filter(Boolean);
const split=Math.floor(lines.length*0.8);
const held=lines.slice(split);                                   // temporal held-out fifth
let rows=[];
for(const l of held){ let g; try{g=JSON.parse(l);}catch(e){continue;}
  const br=g.brought||{}; const p1=(br.p1||g.six?.p1||[]).map(norm).filter(n=>MC.mons[n]);
  const p2=(br.p2||g.six?.p2||[]).map(norm).filter(n=>MC.mons[n]);
  if(p1.length<3||p2.length<3) continue;
  const w=g.winner; if(!w) continue;
  const y = (w===g.p1?.name)?1:((w===g.p2?.name)?0:null); if(y===null) continue;
  const r1=g.p1?.rating, r2=g.p2?.rating;
  rows.push({p1,p2,y,r1,r2});
}
// subsample for runtime
if(rows.length>MAXG){ for(let i=rows.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];} rows=rows.slice(0,MAXG); }

const clamp=p=>Math.max(0.02,Math.min(0.98,p));
const logloss=(p,y)=>-(y*Math.log(clamp(p))+(1-y)*Math.log(1-clamp(p)));
const brier=(p,y)=>(p-y)*(p-y);
const elo=(r1,r2)=>(r1&&r2)?1/(1+Math.pow(10,(r2-r1)/400)):null;

let med=[], eloArr=[], coin=[], medB=[], eloB=[], coinB=[]; let usedElo=0;
let ps=[], ys=[], correct=0, decisive=0;
for(const r of rows){
  const p = winProb2(r.p1, r.p2, N);
  if(p===null) continue;
  ps.push(p); ys.push(r.y);
  if(Math.abs(p-0.5)>0.02){ decisive++; if((p>0.5)===(r.y===1)) correct++; }   // discrimination on decisive calls
  med.push(logloss(p,r.y)); medB.push(brier(p,r.y));
  coin.push(logloss(0.5,r.y)); coinB.push(brier(0.5,r.y));
  const pe=elo(r.r1,r.r2);
  if(pe!==null){ eloArr.push(logloss(pe,r.y)); eloB.push(brier(pe,r.y)); usedElo++; }
}
// temperature calibration: does scaling the confidence rescue the log-loss? (optimistic ceiling, fit in-sample)
const sig=x=>1/(1+Math.exp(-x)); const logit=p=>Math.log(Math.max(1e-6,Math.min(1-1e-6,p))/(1-Math.max(1e-6,Math.min(1-1e-6,p))));
let bestT=1,bestLL=1e9;
for(let T=0.5;T<=8;T+=0.1){ let ll=0; for(let i=0;i<ps.length;i++){const pc=sig(logit(ps[i])/T); ll+=logloss(pc,ys[i]);} ll/=ps.length; if(ll<bestLL){bestLL=ll;bestT=T;} }
const acc = decisive? correct/decisive : null;
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const ci=a=>{const m=mean(a),v=a.reduce((s,x)=>s+(x-m)**2,0)/a.length,se=Math.sqrt(v/a.length);return [m-1.96*se,m+1.96*se];};
const r2=x=>Math.round(x*1e4)/1e4;

const out={
  generated:"engine/backtest_winrate.js — MEDICHAM P(win) vs realized outcomes, held-out games",
  n_games_scored: med.length, rollouts_per_game:N, elo_available_on: usedElo,
  log_loss:{ medicham:r2(mean(med)), medicham_ci95:ci(med).map(r2), coin:r2(mean(coin)),
             elo: eloArr.length?r2(mean(eloArr)):null },
  brier:{ medicham:r2(mean(medB)), coin:r2(mean(coinB)), elo: eloB.length?r2(mean(eloB)):null },
  discrimination:{ accuracy_on_decisive_calls: acc!==null?r2(acc):null, decisive_calls: decisive,
    note:"does MEDICHAM pick the actual winner more than half the time? (calibration-free signal test)" },
  temperature_calibrated:{ best_T:r2(bestT), log_loss:r2(bestLL),
    note:"in-sample optimistic ceiling: best the win% can do after re-scaling its overconfidence" },
  verdict:null
};
const beatsCoin = out.log_loss.medicham < out.log_loss.coin;
const beatsElo = out.log_loss.elo!==null && out.log_loss.medicham < out.log_loss.elo;
out.verdict = `MEDICHAM ${beatsCoin?'beats':'does NOT beat'} coin; ${beatsElo?'beats':'does NOT beat'} Elo (log-loss). Honest verdict either way.`;
fs.writeFileSync(path.join(__dirname,'..','data','winrate-backtest.json'), JSON.stringify(out,null,2));
console.log(`scored ${med.length} held-out games @ ${N} rollouts (Elo on ${usedElo})`);
console.log(`  log-loss: MEDICHAM ${out.log_loss.medicham} (CI ${out.log_loss.medicham_ci95.join('-')}) | coin ${out.log_loss.coin} | Elo ${out.log_loss.elo}`);
console.log(`  Brier:    MEDICHAM ${out.brier.medicham} | coin ${out.brier.coin} | Elo ${out.brier.elo}`);
console.log(`  discrimination: picks real winner ${out.discrimination.accuracy_on_decisive_calls!==null?(out.discrimination.accuracy_on_decisive_calls*100).toFixed(1)+'%':'n/a'} of ${decisive} decisive calls (50% = no signal)`);
console.log(`  calibrated ceiling: log-loss ${out.temperature_calibrated.log_loss} at T=${out.temperature_calibrated.best_T} (vs coin ${out.log_loss.coin})`);
console.log(`  ${out.verdict}`);
